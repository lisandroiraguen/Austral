/**
 * Unlock Staking Funds using Lucid Evolution
 */
import "dotenv/config";
import {
    Lucid,
    Blockfrost,
    Constr,
    Data,
    validatorToAddress,
    paymentCredentialOf,
} from "@lucid-evolution/lucid";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { inspect } from "util";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ========================================
// CONFIGURATION
// ========================================

const BLOCKFROST_PROJECT_ID = process.env.BLOCKFROST_PROJECT_ID;
const MNEMONIC = process.env.MNEMONIC;
const SCRIPT_PATH = process.env.SCRIPT_PATH || "../../StakingContract/plutus.json";
const NETWORK = process.env.NETWORK || "Preview";

// Hardcoded fallback values
const FALLBACK_UTXO_TX_HASH = "58fd8aac66046854887e1b4326d43089aedbe8d41bbe95b8dabb9187dc83c381";
const FALLBACK_UTXO_OUTPUT_INDEX = 0;

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
// MAIN
// ========================================

async function unlockFunds() {
    console.log("=== Lucid Staking Unlock ===\n");

    if (!BLOCKFROST_PROJECT_ID) throw new Error("BLOCKFROST_PROJECT_ID not set");
    if (!MNEMONIC) throw new Error("MNEMONIC not set");

    // Load state from state.json if it exists
    const statePath = path.join(__dirname, "state.json");
    let UTXO_TX_HASH = FALLBACK_UTXO_TX_HASH;
    let UTXO_OUTPUT_INDEX = FALLBACK_UTXO_OUTPUT_INDEX;

    if (fs.existsSync(statePath)) {
        console.log("Loading configuration from state.json...");
        const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
        UTXO_TX_HASH = state.txHash;
        UTXO_OUTPUT_INDEX = state.outputIndex;
    } else {
        console.log("⚠️ state.json not found! Using hardcoded fallback values.");
    }

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

    console.log("\n3. Checking Collateral...");
    const walletUtxos = await lucid.wallet().getUtxos();
    const collateral = walletUtxos.find(u =>
        Object.keys(u.assets).length === 1 && u.assets['lovelace'] > 3_000_000n
    );

    if (collateral) {
        console.log(`   ✅ Collateral found: ${collateral.txHash}#${collateral.outputIndex} (${Number(collateral.assets['lovelace']) / 1_000_000} ADA)`);
    } else {
        console.log(`   ⚠️ NO COLLATERAL FOUND! Transaction may fail.`);
    }

    console.log("\n4. Loading script...");
    const validator = loadPlutusScript();
    const scriptAddress = validatorToAddress("Preview", validator);
    console.log(`   Script address: ${scriptAddress}`);

    console.log("\n5. Fetching UTXOs from script...");
    const utxos = await lucid.utxosAt(scriptAddress);
    console.log(`   Found ${utxos.length} UTXOs at script address`);

    const targetUtxo = utxos.find(
        u => u.txHash === UTXO_TX_HASH && u.outputIndex === UTXO_OUTPUT_INDEX
    );

    if (!targetUtxo) {
        console.log(`\n❌ Target UTXO NOT FOUND: ${UTXO_TX_HASH}#${UTXO_OUTPUT_INDEX}`);
        console.log("Available UTXOs:");
        utxos.forEach(u => console.log(`   - ${u.txHash}#${u.outputIndex}`));
        process.exit(1);
    }
    console.log(`   ✅ Found Target: ${targetUtxo.txHash}#${targetUtxo.outputIndex}`);

    // --- EXTRACT DATUM VALUES ---
    console.log("\n6. Parsing datum from UTXO...");
    if (!targetUtxo.datum) {
        console.log("   ❌ No datum found on UTXO!");
        process.exit(1);
    }

    const datumData = Data.from(targetUtxo.datum);
    console.log("   Raw Datum:", inspect(datumData, { depth: null, colors: true }));

    if (datumData.index !== 0 || !datumData.fields || datumData.fields.length < 3) {
        console.log("   ❌ Unexpected datum format!");
        process.exit(1);
    }

    const datumOwner = datumData.fields[0];
    const datumStartTime = BigInt(datumData.fields[1]);
    const datumLockMonths = BigInt(datumData.fields[2]);

    console.log(`   Owner: ${datumOwner}`);
    console.log(`   Start Time: ${datumStartTime} (${new Date(Number(datumStartTime)).toISOString()})`);
    console.log(`   Lock Months: ${datumLockMonths}`);

    // --- CHECK LOCK PERIOD ---
    console.log("\n7. Checking lock period...");
    const lockDurationMs = Number(datumLockMonths) * 5 * 60 * 1000; // 5 min per "month" for testing
    const unlockTime = Number(datumStartTime) + lockDurationMs;
    const currentTime = Date.now();

    console.log(`   Unlock Time: ${new Date(unlockTime).toISOString()}`);
    console.log(`   Current Time: ${new Date(currentTime).toISOString()}`);

    if (currentTime < unlockTime) {
        const remaining = unlockTime - currentTime;
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        console.log(`   ❌ LOCK PERIOD NOT EXPIRED! Wait ${mins}m ${secs}s.`);
        process.exit(0);
    }
    console.log(`   ✅ Lock period expired. Ready to unlock!`);

    // --- BUILD TRANSACTION ---
    console.log("\n8. Building transaction...");

    // Redeemer: Withdraw = Constr(0, [])
    const redeemer = Data.to(new Constr(0, []));

    // ValidFrom must be >= unlockTime for the contract
    // Use unlockTime as lower bound, add small buffer
    const safeValidFrom = Math.max(unlockTime, currentTime - 60000);
    const validTo = currentTime + 15 * 60 * 1000; // 15 minutes

    console.log(`   ValidFrom  : ${new Date(safeValidFrom).toISOString()}`);
    console.log(`   ValidTo    : ${new Date(validTo).toISOString()}`);

    // Get Owner PKH
    const paymentCred = paymentCredentialOf(walletAddress);
    const ownerPkh = paymentCred.hash;
    console.log(`   Signer PKH : ${ownerPkh}`);
    console.log(`   Datum Owner: ${datumOwner}`);

    if (ownerPkh !== datumOwner) {
        console.log(`   ⚠️ WARNING: Wallet PKH doesn't match datum owner!`);
    }

    // UTXO value
    const utxoValue = targetUtxo.assets;
    console.log(`   UTXO Value : ${Number(utxoValue.lovelace) / 1_000_000} ADA`);

    try {
        console.log("\n   Building tx...");
        const tx = await lucid
            .newTx()
            .collectFrom([targetUtxo], redeemer)
            .attach.SpendingValidator(validator)
            .addSignerKey(ownerPkh)
            .validFrom(safeValidFrom)
            .validTo(validTo)
            .complete({ localUPLCEval: false }); // Disable local UPLC eval to get better error

        console.log("9. Signing...");
        const signedTx = await tx.sign.withWallet().complete();

        console.log("10. Submitting...");
        const txHash = await signedTx.submit();

        console.log(`\n✅ SUCCESS!`);
        console.log(`   TxHash: ${txHash}`);
        console.log(`   https://preview.cardanoscan.io/transaction/${txHash}`);

        return txHash;

    } catch (e) {
        console.error("\n❌ TRANSACTION BUILD FAILED");
        console.error("Error message:", e.message || e);

        if (e.cause) {
            console.error("Cause:", e.cause);
        }

        // Try to extract more info
        const errorStr = String(e);
        if (errorStr.includes("Insufficient")) {
            console.error("\n💡 TIP: This might be a coin selection issue. Check wallet balance.");
        }
        if (errorStr.includes("Validation") || errorStr.includes("Script")) {
            console.error("\n💡 TIP: Script validation failed. Check datum, redeemer, and time bounds.");
        }

        // Print full error object
        console.error("\nFull error object:");
        console.error(JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
    }
}

unlockFunds().catch(e => {
    console.error("\n❌ TOP LEVEL ERROR:", e.message || e);
    console.error(e);
    process.exit(1);
});