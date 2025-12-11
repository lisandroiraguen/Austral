/**
 * Lock Staking Funds using Lucid Evolution
 */
import "dotenv/config";
import {
    Lucid,
    Blockfrost,
    Data,
    validatorToAddress,
    validatorToScriptHash,
    getAddressDetails,
    paymentCredentialOf,
} from "@lucid-evolution/lucid";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ========================================
// CONFIGURATION
// ========================================

const BLOCKFROST_PROJECT_ID = process.env.BLOCKFROST_PROJECT_ID;
const MNEMONIC = process.env.MNEMONIC;
const NETWORK = process.env.NETWORK || "Preview";

// Load Deploy Info
const DEPLOY_INFO_PATH = path.join(__dirname, "deploy_info.json");
if (!fs.existsSync(DEPLOY_INFO_PATH)) throw new Error("deploy_info.json not found. Run deploy.mjs first.");
const DEPLOY_INFO = JSON.parse(fs.readFileSync(DEPLOY_INFO_PATH, "utf8"));

const LOCK_AMOUNT = 1_000_000n; // 1 ADA
const LOCK_MONTHS = 1n; // 5 minutes for testing

// ========================================
// DATUM SCHEMA
// ========================================

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

// ========================================
// MAIN
// ========================================

async function lockFunds() {
    console.log("=== Lucid Staking Lock ===\n");

    if (!BLOCKFROST_PROJECT_ID) throw new Error("BLOCKFROST_PROJECT_ID not set");
    if (!MNEMONIC) throw new Error("MNEMONIC not set");

    console.log("1. Initializing Lucid...");
    const networkUrl = NETWORK.toLowerCase() === "mainnet"
        ? "https://cardano-mainnet.blockfrost.io/api/v0"
        : `https://cardano-${NETWORK.toLowerCase()}.blockfrost.io/api/v0`;

    const lucid = await Lucid(
        new Blockfrost(networkUrl, BLOCKFROST_PROJECT_ID),
        NETWORK
    );

    console.log("2. Loading wallet...");
    lucid.selectWallet.fromSeed(MNEMONIC);
    const walletAddress = await lucid.wallet().address();
    console.log(`   Address: ${walletAddress}`);

    const paymentCred = paymentCredentialOf(walletAddress);
    const ownerPkh = paymentCred.hash;
    console.log(`   Owner PKH: ${ownerPkh}`);

    console.log("3. Loading Staking Contract...");
    // We use the address from deploy_info to ensure we send to the right place.
    const stakingAddress = DEPLOY_INFO.staking.address;
    const stakingHash = DEPLOY_INFO.staking.hash;
    console.log(`   Staking Address: ${stakingAddress}`);
    console.log(`   Staking Hash:    ${stakingHash}`);

    console.log("4. Building datum...");
    const startTime = BigInt(Date.now());
    const lockDurationMs = Number(LOCK_MONTHS) * 5 * 60 * 1000; // Using 5 mins per "month" for testing
    const unlockTime = Number(startTime) + lockDurationMs;

    // Construct Address Object for Datum
    const beneficiaryAddress = {
        payment_credential: { VerificationKey: { hash: ownerPkh } },
        stake_credential: null,
    };

    // Token for Reward: Austral-Test
    // Policy: 9ea5cd066fda8431f52565159c426b1717c8ffc9d7a1fbcda62e3b5c
    // Name: 4175737472616c2d54657374 (Austral-Test)
    const REWARD_POLICY = "9ea5cd066fda8431f52565159c426b1717c8ffc9d7a1fbcda62e3b5c";
    const REWARD_ASSET_NAME = "4175737472616c2d54657374";

    const datum = Data.to({
        beneficiary: beneficiaryAddress,
        principal_lovelace: LOCK_AMOUNT,
        reward_percent: 10n, // 10% Reward
        release_time: BigInt(unlockTime),
        reward_policy: REWARD_POLICY,
        reward_asset: REWARD_ASSET_NAME,
    }, DepositDatum);

    console.log(`   Release time: ${new Date(unlockTime).toLocaleString()}`);
    console.log(`   Reward: 10% of ${Number(LOCK_AMOUNT) / 1000000} ADA`);
    console.log(`   Reward Token: ${REWARD_POLICY.slice(0, 6)}...${REWARD_ASSET_NAME}`);

    console.log("5. Building transaction...");
    console.log(`   Locking ${Number(LOCK_AMOUNT) / 1_000_000} ADA...`);

    const tx = await lucid
        .newTx()
        .pay.ToContract(
            stakingAddress,
            { kind: "inline", value: datum },
            { lovelace: LOCK_AMOUNT }
        )
        .complete();

    console.log("6. Signing...");
    const signedTx = await tx.sign.withWallet().complete();

    console.log("7. Submitting...");
    const txHash = await signedTx.submit();

    console.log(`\n✅ SUCCESS!`);
    console.log(`   TxHash: ${txHash}`);
    console.log(`   https://preview.cardanoscan.io/transaction/${txHash}`);

    console.log(`\n📋 Saving state to state.json...`);
    const state = {
        txHash: txHash,
        outputIndex: 0,
        releaseTime: unlockTime,
        ownerPkh: ownerPkh,
        scriptAddress: stakingAddress
    };

    fs.writeFileSync(path.join(__dirname, "state.json"), JSON.stringify(state, null, 2));
    console.log(`   State saved! You can now wait 5 minutes and run 'node unlock.mjs'.`);

    return txHash;
}

lockFunds().catch(e => {
    console.error("\n❌ Error:", e.message || e);
    console.error(e);
    process.exit(1);
});
