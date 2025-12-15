import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import {
    Lucid,
    Blockfrost,
    Data,
    paymentCredentialOf,
} from "@lucid-evolution/lucid";

// CONSTANTS (Hardcoded from deploy_info.json)
// CONSTANTS
import { STAKING_ADDRESS, REWARD_POLICY, REWARD_ASSET_NAME } from "../Shared/constants";

// DATUM SCHEMA
const Credential = Data.Enum([
    Data.Object({ VerificationKey: Data.Object({ hash: Data.Bytes() }) }),
    Data.Object({ Script: Data.Object({ hash: Data.Bytes() }) }),
]);

const Address = Data.Object({
    payment_credential: Credential,
    stake_credential: Data.Nullable(Credential),
});

const DepositDatum = Data.Object({
    beneficiary: Address,
    principal_lovelace: Data.Integer(),
    tier: Data.Integer(),
    start_time: Data.Integer(),
    release_time: Data.Integer(),
    reward_policy: Data.Bytes(),
    reward_asset: Data.Bytes(),
});

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('Creates staking transaction (CreateStakeTx) triggered.');

    try {
        const { amount, lockMonths, walletAddress } = req.body;

        if (!amount || !walletAddress) {
            context.res = {
                status: 400,
                body: "Missing required fields: amount, walletAddress"
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

        // Fetch user's UTXOs from Blockfrost - required for building the transaction
        const userUtxos = await lucid.utxosAt(walletAddress);
        lucid.selectWallet.fromAddress(walletAddress, userUtxos);
        const paymentCred = paymentCredentialOf(walletAddress);
        const ownerPkh = paymentCred.hash;

        // Calculate Times & Tier
        const startTime = BigInt(Date.now());
        const months = Number(lockMonths) || 0; // 0 = Flexible

        // Map Months to Tier
        let tier = 0n;
        if (months === 1) tier = 1n;
        else if (months === 3) tier = 2n;
        else if (months === 6) tier = 3n;
        else if (months === 12) tier = 4n;
        else tier = 0n; // Default to Flexible

        // Calculate Release Time
        // If Flexible, Release Time is technically 0 or StartTime (doesn't matter for logic, but cleaner to set 0)
        // If Fixed, Release Time = Start + Duration
        // PRODUCTION: 30 days * 24h * 60m * 60s * 1000ms per month
        const durationMs = months > 0 ? (months * 30 * 24 * 60 * 60 * 1000) : 0;

        const unlockTime = Number(startTime) + durationMs;

        const beneficiaryAddress = {
            payment_credential: { VerificationKey: { hash: ownerPkh } },
            stake_credential: null,
        };

        const lockAmountLovelace = BigInt(Math.floor(Number(amount) * 1_000_000));

        const datum = Data.to({
            beneficiary: beneficiaryAddress,
            principal_lovelace: lockAmountLovelace,
            tier: tier,
            start_time: startTime,
            release_time: BigInt(unlockTime),
            reward_policy: REWARD_POLICY,
            reward_asset: REWARD_ASSET_NAME,
        } as any, DepositDatum);

        const tx = await lucid
            .newTx()
            .pay.ToContract(
                STAKING_ADDRESS,
                { kind: "inline", value: datum },
                { lovelace: lockAmountLovelace }
            )
            .complete();

        context.res = {
            status: 200,
            body: {
                txCbor: tx.toCBOR(),
                unlockTime
            }
        };

    } catch (error) {
        context.log.error("Error creating tx:", error);
        context.res = {
            status: 500,
            body: `Error creating transaction: ${error.message}`
        };
    }
};

export default httpTrigger;
