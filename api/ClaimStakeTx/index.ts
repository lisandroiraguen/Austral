import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import {
    Blockfrost,
    Lucid,
    Data,
    Constr,
    paymentCredentialOf,
    validatorToAddress,
    credentialToAddress
} from "@lucid-evolution/lucid";
import * as fs from "fs";
import * as path from "path";
import { STAKING_ADDRESS, REWARD_POLICY, REWARD_ASSET_NAME } from "../Shared/constants";

// TREASURY CONSTANTS (Needs to be verified/extracted from contract or config)
// Placeholder for now, user might have it in `deploy_info.json`. 
// Assuming a known Treasury address for now or finding it. 
// For this implementaton, I'll search for the Treasury UTXO using the Policy ID if possible, 
// or I need the Treasury Script Address.
// Let's assume the user knows it or we can derive it. 
// Ideally we should have it in constants.
// For now, I will use a placeholder and might need to ask or calculate it.
// UPDATE: I can calculate it from plutus.json similar to staking address!
// But for this step, I'll assume we can pass it or use a constant.
// I will calculate it dynamically in code to be safe.

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('ClaimStakeTx triggered.');

    try {
        const { walletAddress } = req.body;

        if (!walletAddress) {
            context.res = {
                status: 400,
                body: "Missing required field: walletAddress"
            };
            return;
        }

        const projectId = process.env.BLOCKFROST_PROJECT_ID;
        const network = process.env.BLOCKFROST_NETWORK as any || "Preview";

        if (!projectId) {
            throw new Error("Server Misconfiguration: BLOCKFROST_PROJECT_ID missing");
        }

        const networkUrl = network.toLowerCase() === "mainnet"
            ? "https://cardano-mainnet.blockfrost.io/api/v0"
            : `https://cardano-${network.toLowerCase()}.blockfrost.io/api/v0`;

        const lucid = await Lucid(
            new Blockfrost(networkUrl, projectId),
            network
        );

        // Address conversion handled by frontend
        const bech32Address: string = walletAddress;

        lucid.selectWallet.fromAddress(bech32Address, []);
        const paymentCred = paymentCredentialOf(bech32Address);
        const ownerPkh = paymentCred.hash;

        // Load Staking & Treasury Scripts
        const plutusJsonPath = path.resolve(__dirname, "../..", "plutus.json");
        let stakingCode = "";
        let treasuryCode = "";

        try {
            const plutusJson = JSON.parse(fs.readFileSync(plutusJsonPath, "utf8"));

            const stakingVal = plutusJson.validators.find((v: any) => v.title === "staking.staking.spend");
            if (stakingVal) stakingCode = stakingVal.compiledCode;

            const treasuryVal = plutusJson.validators.find((v: any) => v.title === "treasury.treasury.spend");
            if (treasuryVal) treasuryCode = treasuryVal.compiledCode;

            if (!stakingCode || !treasuryCode) throw new Error("Validators not found");

        } catch (e) {
            context.log.error("Failed to load plutus.json", e);
            throw new Error("Internal Server Error: Could not load contract scripts.");
        }

        const stakingScript = { type: "PlutusV3", script: stakingCode };
        const treasuryScript = { type: "PlutusV3", script: treasuryCode };

        // Calculate Treasury Address
        const treasuryAddress = validatorToAddress(network, treasuryScript as any);

        // 1. Find User's Stake UTXO
        const stakeUtxos = await lucid.utxosAt(STAKING_ADDRESS);

        // Datum Schema for Staking (Must match CheckStake)
        const Credential = Data.Enum([
            Data.Object({ VerificationKey: Data.Object({ hash: Data.Bytes() }) }),
            Data.Object({ Script: Data.Object({ hash: Data.Bytes() }) }),
        ]);

        const Address = Data.Object({
            payment_credential: Credential,
            stake_credential: Data.Nullable(Credential),
        });

        const StakingDatum = Data.Object({
            beneficiary: Address,
            principal_lovelace: Data.Integer(),
            reward_percent: Data.Integer(),
            release_time: Data.Integer(),
            reward_policy: Data.Bytes(),
            reward_asset: Data.Bytes(),
        });

        const myStakeUtxo = stakeUtxos.find(u => {
            if (!u.datum) return false;
            try {
                const datum = Data.from(u.datum, StakingDatum) as any;
                // Handle Enum Variant: VerificationKey
                const pkh = datum.beneficiary.payment_credential.VerificationKey?.hash;
                return pkh === ownerPkh;
            } catch (e) { return false; }
        });

        if (!myStakeUtxo) {
            context.res = { status: 404, body: "No active stake found." };
            return;
        }

        // Deserialize Datum to get details
        const stakeDatumData = Data.from(myStakeUtxo.datum!, StakingDatum);
        const principal = BigInt(stakeDatumData.principal_lovelace);
        const releaseTime = BigInt(stakeDatumData.release_time);

        // Check Time Lock
        if (BigInt(Date.now()) < releaseTime) {
            context.res = { status: 403, body: "Stake is still locked." };
            return;
        }

        const rewardPercent = BigInt(stakeDatumData.reward_percent);
        // Reward = (Principal * Percent / 100)
        // Adjust for percent representation? 100 = 100%? Or 10 = 10%?
        // Staking.tsx logic: month 1, baseApy 100...
        // Smart Contract Logic: expected_reward = (principal * percent / 100) / 1_000_000 ??

        // Let's check contract logic again (Step 545 is treasury, Step 294 is staking)
        // Step 294: let expected_reward = (d.principal_lovelace * d.reward_percent / 100) / 1000000 
        // Wait, division by 1M? That seems to assume principal is lovelace but reward is... Token units?
        // If principal is 100 ADA (100M lovelace), and percent is 10.
        // (100M * 10 / 100) / 1M = 10M / 1M = 10 Tokens.
        // Yes, likely returns Tokens (not lovelace).

        const rewardAmount = (principal * rewardPercent / 100n) / 1_000_000n;

        // 2. Find Treasury UTXO
        const treasuryUtxos = await lucid.utxosAt(treasuryAddress);
        // We need ANY treasury UTXO that has enough tokens? Or just the one that matches this staking instance?
        // Treasury Datum has `staking_hash`.
        // If `staking_hash` is used to link to THIS specific staking contract, any UTXO from it should work? 

        // Treasury Schema
        const TreasuryDatum = Data.Object({
            owner: Data.Bytes(),
            lock_until: Data.Integer(),
            reward_rate: Data.Integer(),
            policy_id: Data.Bytes(),
            asset_name: Data.Bytes(),
            treasury_remaining: Data.Integer(),
            staking_hash: Data.Bytes(),
        });

        const treasuryUtxo = treasuryUtxos.find(u => {
            if (!u.datum) return false;
            try {
                // We could filter by policy/asset if needed
                const d = Data.from(u.datum, TreasuryDatum);
                return true; // Use first valid one for now
            } catch (e) { return false; }
        });

        if (!treasuryUtxo) {
            context.res = { status: 404, body: "Treasury empty or not found." };
            return;
        }

        // Redeemers
        const claimRedeemer = Data.to(new Constr(0, [])); // Claim (Index 0)
        const withdrawRedeemer = Data.to(new Constr(0, [])); // WithdrawReward (Index 0)

        // Derive Enterprise Address (Payment Credential Only) to match Datum Beneficiary
        // STAKING CONTRACT ENFORCES STRICT ADDRESS EQUALITY
        // CreateStakeTx stores: { payment_credential: ..., stake_credential: null }
        // So we MUST pay to the Enterprise Address.
        const beneficiaryAddress = credentialToAddress(network, paymentCred);

        context.log("Paying to Beneficiary (Enterprise):", beneficiaryAddress);

        // Build Tx
        const tx = await lucid.newTx()
            .collectFrom([myStakeUtxo], claimRedeemer)
            .collectFrom([treasuryUtxo], withdrawRedeemer)
            .attach.SpendingValidator(stakingScript as any)
            .attach.SpendingValidator(treasuryScript as any)
            .addSigner(bech32Address) // User signs with their wallet (Key matches payment_cred)
            .pay.ToAddress(beneficiaryAddress, {
                lovelace: principal,
                [REWARD_POLICY + REWARD_ASSET_NAME]: rewardAmount
            })
        // We need to pay back to treasury the change?
        // Lucid handles change automatically to wallet? No, to Treasury script?
        // "Everything else" goes to... change address (Wallet).
        // BUT Treasury script demands `input_ada <= output_ada`.
        // So we MUST pay back the Treasury UTXO input value (ADA) + remaining tokens back to Treasury Address.
        // AND we must ensure Datum is preserved (or updated).
        // The contract says: `(input_ada <= output_ada)`.
        // It doesn't strictly enforce Token preservation? 
        // `treasury.ak`:
        // `let output_ada = list.foldl(..., if out.address == script_address ...)`
        // `(input_ada <= output_ada)`
        // So we just need to send the ADA back.
        // What about the remaining Tokens?
        // If we consume the UTXO, we naturally consume the tokens.
        // If we don't output them back to Treasury, they go to Change (User).
        // This would drain the treasury!
        // We MUST verify if the contract enforces token retention.
        // Step 545: It does NOT enforce token logic in `spend`. Only ADA logic.
        // THIS IS A SECURITY VULNERABILITY IN THE CONTRACT?
        // `spend` only checks `input_ada <= output_ada`.
        // If I am the `staking` script (is_staking_present), I can withdraw ANYTHING?
        // Yes, "is_authorized".
        // So as the backend, I MUST manually reconstruct the Treasury output with:
        // Same Datum (updated?) + Same ADA + (InputAsset - RewardAsset).

        const treasuryDatum = Data.from(treasuryUtxo.datum!, TreasuryDatum);
        const treasuryAssets = treasuryUtxo.assets;
        const treasuryAda = treasuryAssets.lovelace;
        const rewardUnit = REWARD_POLICY + REWARD_ASSET_NAME;
        const currentRewardBalance = treasuryAssets[rewardUnit] || 0n;
        const newRewardBalance = currentRewardBalance - rewardAmount;

        const newTreasuryAssets = {
            ...treasuryAssets,
            [rewardUnit]: newRewardBalance
        };

        tx.pay.ToContract(
            treasuryAddress,
            { kind: "inline", value: treasuryUtxo.datum! }, // Keep same datum
            newTreasuryAssets
        );

        // Required Valid Range for Staking (must be > release_time)
        // Add validity range
        tx.validFrom(Number(Date.now()));

        const finalTx = await tx.complete();
        const partialTx = finalTx.toCBOR();

        context.res = {
            status: 200,
            body: { partialTx }
        };

    } catch (error: any) {
        context.log.error("ClaimStakeTx Error:", error);
        context.res = {
            status: 500,
            body: `Error claiming: ${error.message}`
        };
    }
};

export default httpTrigger;
