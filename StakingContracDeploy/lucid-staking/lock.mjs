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
const SCRIPT_PATH = process.env.SCRIPT_PATH || "../../StakingContract/plutus.json";
const NETWORK = process.env.NETWORK || "Preview";

const LOCK_AMOUNT = 1_000_000n; // 1 ADA
const LOCK_MONTHS = 1n; // 5 minutes for testing

// ========================================
// LOAD SCRIPT
// ========================================

function loadPlutusScript() {
    // Usar SCRIPT_PATH del .env o ruta por defecto
    const plutusJsonPath = path.resolve(__dirname, SCRIPT_PATH);
    console.log(`   Loading script from: ${plutusJsonPath}`);
    const plutusJson = JSON.parse(fs.readFileSync(plutusJsonPath, "utf8"));
    const validator = plutusJson.validators.find(v => v.title === "staking.staking.spend");

    if (!validator) throw new Error("Validator not found");

    return {
        type: "PlutusV3",
        script: validator.compiledCode,
    };
}

// ========================================
// DATUM SCHEMA
// ========================================

const StakingDatum = Data.Object({
    owner: Data.Bytes(),
    start_time: Data.Integer(),
    lock_period_months: Data.Integer(),
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

    // Get owner PKH using standalone function
    const paymentCred = paymentCredentialOf(walletAddress);
    const ownerPkh = paymentCred.hash;
    console.log(`   Owner PKH: ${ownerPkh}`);

    console.log("3. Loading script...");
    const validator = loadPlutusScript();
    const scriptHash = validatorToScriptHash(validator);
    const scriptAddress = validatorToAddress("Preview", validator);
    console.log(`   Script hash: ${scriptHash}`);
    console.log(`   Script address: ${scriptAddress}`);

    console.log("4. Building datum...");
    const startTime = BigInt(Date.now());
    const lockDurationMs = Number(LOCK_MONTHS) * 5 * 60 * 1000;
    const unlockTime = Number(startTime) + lockDurationMs;

    const datum = Data.to({
        owner: ownerPkh,
        start_time: startTime,
        lock_period_months: LOCK_MONTHS,
    }, StakingDatum);

    console.log(`   Start time: ${new Date(Number(startTime)).toLocaleString()}`);
    console.log(`   Lock months: ${LOCK_MONTHS} (= ${lockDurationMs / 60000} minutes)`);
    console.log(`   Unlock at: ${new Date(unlockTime).toLocaleString()}`);

    console.log("5. Building transaction...");
    console.log(`   Locking ${Number(LOCK_AMOUNT) / 1_000_000} ADA...`);

    const tx = await lucid
        .newTx()
        .pay.ToContract(
            scriptAddress,
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
        startTime: startTime.toString(), // Store as string to preserve BigInt details if needed, though JSON handles numbers
        lockMonths: LOCK_MONTHS.toString(),
        scriptAddress: scriptAddress
    };

    fs.writeFileSync(path.join(__dirname, "state.json"), JSON.stringify(state, null, 2));
    console.log(`   State saved! You can now run 'node unlock.mjs' without manual edits.`);

    return txHash;
}

lockFunds().catch(e => {
    console.error("\n❌ Error:", e.message || e);
    console.error(e);
    process.exit(1);
});
