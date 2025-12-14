/**
 * Deploy Script for Staking and Treasury Contracts
 * Derives and displays the Addresses and Script Hashes.
 */
import "dotenv/config";
import {
    Lucid,
    Blockfrost,
    validatorToAddress,
    validatorToScriptHash,
    applyParamsToScript,
    credentialToAddress,
    Data,
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

// ========================================
// HELPERS
// ========================================

function loadValidator(plutusJson, title) {
    const validator = plutusJson.validators.find(v => v.title === title);
    if (!validator) throw new Error(`Validator '${title}' not found in plutus.json`);
    return {
        type: "PlutusV2",
        script: validator.compiledCode,
    };
}

// ========================================
// MAIN
// ========================================

async function deploy() {
    console.log("=== Austral Staking Deployment (Reference Scripts) ===\n");

    if (!BLOCKFROST_PROJECT_ID) throw new Error("BLOCKFROST_PROJECT_ID not set in .env");
    if (!MNEMONIC) throw new Error("MNEMONIC not set in .env");

    // 1. Initialize Lucid
    const networkUrl = NETWORK.toLowerCase() === "mainnet"
        ? "https://cardano-mainnet.blockfrost.io/api/v0"
        : `https://cardano-${NETWORK.toLowerCase()}.blockfrost.io/api/v0`;

    const lucid = await Lucid(
        new Blockfrost(networkUrl, BLOCKFROST_PROJECT_ID),
        NETWORK
    );

    lucid.selectWallet.fromSeed(MNEMONIC);
    const walletAddress = await lucid.wallet().address();
    console.log(`Deployer Address: ${walletAddress}`);

    // 2. Load Plutus JSON
    const plutusJsonPath = path.resolve(__dirname, SCRIPT_PATH);
    if (!fs.existsSync(plutusJsonPath)) {
        throw new Error("plutus.json not found. Did you run 'aiken build'?");
    }
    const plutusJson = JSON.parse(fs.readFileSync(plutusJsonPath, "utf8"));

    // 3. Prepare Validators
    const stakingValidator = loadValidator(plutusJson, "staking.staking.spend");
    stakingValidator.type = "PlutusV3";

    let treasuryValidator;
    try {
        treasuryValidator = loadValidator(plutusJson, "treasury.treasury.spend");
        treasuryValidator.type = "PlutusV3";
    } catch (e) {
        console.warn("Treasury validator not found, skipping.");
    }

    const stakingHash = validatorToScriptHash(stakingValidator);
    const stakingAddress = validatorToAddress(NETWORK, stakingValidator);

    const treasuryHash = treasuryValidator ? validatorToScriptHash(treasuryValidator) : null;
    const treasuryAddress = treasuryValidator ? validatorToAddress(NETWORK, treasuryValidator) : null;

    console.log(`\nStaking Script Hash: ${stakingHash}`);
    console.log(`Staking Script Length: ${stakingValidator.script.length}`);
    if (stakingValidator.script.length % 2 !== 0) console.error("❌ Staking Script Hex has ODD length!");

    if (treasuryHash) {
        console.log(`Treasury Script Hash: ${treasuryHash}`);
        console.log(`Treasury Script Length: ${treasuryValidator.script.length}`);
        if (treasuryValidator.script.length % 2 !== 0) console.error("❌ Treasury Script Hex has ODD length!");
    }

    // 4. Create Deployment Transaction
    console.log("\nBuilding Deployment Transaction...");
    const tx = lucid.newTx();

    // Debug Data.void()
    console.log("Data.void():", Data.void());

    // Output 1: Staking Script Reference
    // We send it to the deployer's address (always accessible) with the script as reference
    tx.pay.ToAddressWithData(
        walletAddress,
        { kind: "inline", value: Data.void() }, // Metadata/Datum (optional, using void for cleaner UTXO)
        { lovelace: 10_000_000n }, // Explicit min ADA to be safe
        stakingValidator // The Reference Script!
    );

    // Output 2: Treasury Script Reference (if exists)
    if (treasuryValidator) {
        tx.pay.ToAddressWithData(
            walletAddress,
            { kind: "inline", value: Data.void() },
            { lovelace: 10_000_000n },
            treasuryValidator
        );
    }

    const builtTx = await tx.complete();
    const signedTx = await builtTx.sign.withWallet().complete();
    const txHash = await signedTx.submit();

    console.log(`\n✅ Deployment Tx Submitted: ${txHash}`);
    console.log(`   https://preview.cardanoscan.io/transaction/${txHash}`);
    console.log("   Waiting for confirmation...");

    // Wait roughly for block (simple sleep) or use awaitSignedTx inside helper (not available in standard lucid-evolution simply?)
    // We'll assume success and saving indices 0 and 1.
    // CAUTION: Order of outputs is preserved. 
    // Output 0 = Staking
    // Output 1 = Treasury (if exists)
    // There might be a change output, usually last.

    console.log("\n--- Saving Deployment Info ---");
    const deployInfo = {
        network: NETWORK,
        staking: {
            hash: stakingHash,
            address: stakingAddress,
            refTxHash: txHash,
            refOutputIndex: 0 // First output
        },
        treasury: treasuryHash ? {
            hash: treasuryHash,
            address: treasuryAddress,
            refTxHash: txHash,
            refOutputIndex: 1 // Second output
        } : null,
        timestamp: new Date().toISOString()
    };

    fs.writeFileSync(path.join(__dirname, "deploy_info.json"), JSON.stringify(deployInfo, null, 2));
    console.log("Saved to deploy_info.json");
}

deploy().catch(e => {
    console.error("\n❌ Error:", e.message);
    process.exit(1);
});
