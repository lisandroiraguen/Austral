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
    reward_percent: Data.Integer(),
    release_time: Data.Integer(),
    reward_policy: Data.Bytes(),
    reward_asset: Data.Bytes(),
});

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('Creates staking transaction (CreateStakeTx) triggered.');

    try {
        const { amount, lockMonths, walletAddress } = req.body;

        if (!amount || !lockMonths || !walletAddress) {
            context.res = {
                status: 400,
                body: "Missing required fields: amount, lockMonths, walletAddress"
            };
            return;
        }

        const projectId = process.env.BLOCKFROST_PROJECT_ID;
        const network = process.env.BLOCKFROST_NETWORK as any || "Preview";

        if (!projectId) {
            throw new Error("Server Misconfiguration: BLOCKFROST_PROJECT_ID missing");
        }

        context.log("CreateStakeTx: Initializing Lucid...");

        // Initialize Lucid (Read-only / Builder mode)
        const networkUrl = network.toLowerCase() === "mainnet"
            ? "https://cardano-mainnet.blockfrost.io/api/v0"
            : `https://cardano-${network.toLowerCase()}.blockfrost.io/api/v0`;

        context.log("CreateStakeTx: Network URL:", networkUrl);

        const lucid = await Lucid(
            new Blockfrost(networkUrl, projectId),
            network
        );

        context.log("CreateStakeTx: Lucid initialized.");

        // Select wallet (read-only for address) to act as sender
        lucid.selectWallet.fromAddress(walletAddress, []); // Empty UTXOs initially, Lucid fetches them

        const paymentCred = paymentCredentialOf(walletAddress);
        const ownerPkh = paymentCred.hash;

        // Calculate Times
        const startTime = BigInt(Date.now());
        // For TESTING: 5 minutes per "month" if lockMonths is small, or use real months logic
        // Original script used 5 mins per month for testing. We'll keep that for consistency with the "Test" tier.
        const lockDurationMs = Number(lockMonths) * 5 * 60 * 1000;
        const unlockTime = Number(startTime) + lockDurationMs;

        // Construct Datum
        const beneficiaryAddress = {
            payment_credential: { VerificationKey: { hash: ownerPkh } },
            stake_credential: null,
        };

        const lockAmountLovelace = BigInt(Math.floor(Number(amount) * 1_000_000));

        const datum = Data.to({
            beneficiary: beneficiaryAddress,
            principal_lovelace: lockAmountLovelace,
            reward_percent: 10n, // 10% Reward (Fixed for now or passed from frontend)
            release_time: BigInt(unlockTime),
            reward_policy: REWARD_POLICY,
            reward_asset: REWARD_ASSET_NAME,
        } as any, DepositDatum);

        // Build Transaction
        const tx = await lucid
            .newTx()
            .pay.ToContract(
                STAKING_ADDRESS,
                { kind: "inline", value: datum },
                { lovelace: lockAmountLovelace }
            )
            .complete();

        // Serialize to CBOR
        const txCbor = tx.toCBOR();

        context.res = {
            status: 200,
            body: {
                txCbor,
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
