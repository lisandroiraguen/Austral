import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import {
    Lucid,
    Blockfrost,
    Data,
    paymentCredentialOf,
} from "@lucid-evolution/lucid";

// CONSTANTS
import { STAKING_ADDRESS } from "../Shared/constants";
const REWARD_POLICY = "9ea5cd066fda8431f52565159c426b1717c8ffc9d7a1fbcda62e3b5c"; // Keep for now if not used or import if needed
const REWARD_ASSET_NAME = "4175737472616c2d54657374";

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
    context.log('CheckStake triggered.');

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

        // Get user's payment credential hash
        const paymentCred = paymentCredentialOf(walletAddress);
        const userPkh = paymentCred.hash;

        context.log(`Checking stake for PKH: ${userPkh}`);

        // Fetch UTXOs at the staking script address
        const utxos = await lucid.utxosAt(STAKING_ADDRESS);

        let activeStake = null;
        let allStakes: any[] = [];

        const LegacyDatum = Data.Object({
            beneficiary: Address,
            principal_lovelace: Data.Integer(),
            reward_percent: Data.Integer(),
            release_time: Data.Integer(),
            reward_policy: Data.Bytes(),
            reward_asset: Data.Bytes(),
        });

        for (const utxo of utxos) {
            if (utxo.datum) {
                // Try NEW Datum first
                try {
                    const datum = Data.from(utxo.datum, DepositDatum) as any;
                    const beneficiaryHash = datum.beneficiary.payment_credential.VerificationKey?.hash;
                    if (beneficiaryHash === userPkh) {
                        const stakeInfo = {
                            utxoTxHash: utxo.txHash,
                            utxoOutputIndex: utxo.outputIndex,
                            principalLovelace: Number(datum.principal_lovelace),
                            principalAda: Number(datum.principal_lovelace) / 1_000_000,
                            startTime: Number(datum.start_time),
                            releaseTime: Number(datum.release_time),
                            isLocked: Date.now() < Number(datum.release_time),
                            type: 'Tiered'
                        };
                        allStakes.push(stakeInfo);
                    }
                } catch (e) {
                    // Try LEGACY Datum
                    try {
                        const datumLegacy = Data.from(utxo.datum, LegacyDatum) as any;
                        const beneficiaryHash = datumLegacy.beneficiary.payment_credential.VerificationKey?.hash;
                        if (beneficiaryHash === userPkh) {
                            const stakeInfo = {
                                utxoTxHash: utxo.txHash,
                                utxoOutputIndex: utxo.outputIndex,
                                principalLovelace: Number(datumLegacy.principal_lovelace),
                                principalAda: Number(datumLegacy.principal_lovelace) / 1_000_000,
                                startTime: 0, // Legacy doesn't have start_time
                                releaseTime: Number(datumLegacy.release_time),
                                isLocked: Date.now() < Number(datumLegacy.release_time),
                                type: 'Legacy'
                            };
                            allStakes.push(stakeInfo);
                        }
                    } catch (e2) {
                        // Ignore unknown datums
                    }
                }
            }
        }

        // Log all stakes found before sorting
        context.log(`Found ${allStakes.length} raw stakes for user:`);
        allStakes.forEach((s, i) => {
            context.log(`  [${i}] txHash: ${s.utxoTxHash.substring(0, 16)}... startTime: ${s.startTime} (${new Date(s.startTime).toISOString()}) releaseTime: ${s.releaseTime} (${new Date(s.releaseTime).toISOString()}) type: ${s.type}`);
        });

        // Sort by start_time descending to get the most recent first
        allStakes.sort((a, b) => b.startTime - a.startTime);

        context.log(`After sorting (most recent first):`);
        allStakes.forEach((s, i) => {
            context.log(`  [${i}] txHash: ${s.utxoTxHash.substring(0, 16)}... startTime: ${s.startTime}`);
        });

        // Get the most recent stake
        if (allStakes.length > 0) {
            activeStake = allStakes[0];
        }

        context.log(`Selected stake: ${activeStake?.utxoTxHash}`);

        context.res = {
            status: 200,
            body: {
                activeStake,
                totalStakes: allStakes.length,
                allStakes: allStakes // Include all for debugging
            }
        };

    } catch (error) {
        context.log.error("Error checking stake:", error);
        context.res = {
            status: 500,
            body: `Error checking stake: ${error.message}`
        };
    }
};

export default httpTrigger;
