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

        // Fetch user's UTXOs from Blockfrost - required for building the transaction
        const userUtxos = await lucid.utxosAt(bech32Address);
        lucid.selectWallet.fromAddress(bech32Address, userUtxos);
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
            tier: Data.Integer(),
            start_time: Data.Integer(),
            release_time: Data.Integer(),
            reward_policy: Data.Bytes(),
            reward_asset: Data.Bytes(),
        });

        // Collect all matching UTXOs with their datum info
        interface MatchedStake {
            utxo: typeof stakeUtxos[0];
            datum: any;
            startTime: bigint;
        }

        const matchedStakes: MatchedStake[] = [];

        for (const u of stakeUtxos) {
            if (!u.datum) continue;
            try {
                const datum = Data.from(u.datum, StakingDatum) as any;
                const pkh = datum.beneficiary.payment_credential.VerificationKey?.hash;
                if (pkh === ownerPkh) {
                    matchedStakes.push({
                        utxo: u,
                        datum,
                        startTime: BigInt(datum.start_time)
                    });
                }
            } catch (e) { /* not a valid datum for this user */ }
        }

        if (matchedStakes.length === 0) {
            context.res = { status: 404, body: "No active stake found." };
            return;
        }

        // Sort by start_time descending to get most recent
        matchedStakes.sort((a, b) => Number(b.startTime - a.startTime));
        const mostRecent = matchedStakes[0];
        const myStakeUtxo = mostRecent.utxo;
        const stakeDatumData = mostRecent.datum;

        context.log(`Found ${matchedStakes.length} stakes. Using most recent: ${myStakeUtxo.txHash}`);

        // Deserialize Datum to get details
        const principal = BigInt(stakeDatumData.principal_lovelace);
        const releaseTime = BigInt(stakeDatumData.release_time);
        const tier = BigInt(stakeDatumData.tier);
        const startTime = BigInt(stakeDatumData.start_time);

        const now = BigInt(Date.now());

        // Check Time Lock (Only for Fixed Tiers > 0)
        // Flexible (Tier 0) is always unlocked for Claim (but reward calc uses now)
        if (tier > 0n && now < releaseTime) {
            context.res = { status: 403, body: "Stake is still locked." };
            return;
        }

        // Calculate Reward
        const getReward = (prin: bigint, tr: bigint, start: bigint, end: bigint): bigint => {
            const yearMs = 31536000000n;
            let rate = 0n;
            const t = Number(tr);
            if (t === 0) rate = 35n;
            else if (t === 1) rate = 47n;
            else if (t === 2) rate = 64n;
            else if (t === 3) rate = 89n;
            else if (t === 4) rate = 135n;

            const dura = end - start;
            if (dura <= 0n) return 0n;

            return (prin * rate * dura) / (1000n * yearMs);
        };

        // Determine End Time for Calc: if tier == 0, use NOW. If tier > 0, use RELEASE_TIME.
        const calcEndTime = (tier === 0n) ? now : releaseTime;

        const rewardAmount = getReward(principal, tier, startTime, calcEndTime);

        // 2. Find Treasury UTXO
        const treasuryUtxos = await lucid.utxosAt(treasuryAddress);

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

        // Manual Treasury Reconstruction
        const treasuryDatum = Data.from(treasuryUtxo.datum!, TreasuryDatum);
        const treasuryAssets = treasuryUtxo.assets;
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
        // Add validity range covering 'Now'
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
