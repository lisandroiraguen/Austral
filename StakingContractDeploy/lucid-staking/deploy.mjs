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
    console.log("=== Austral Staking Deployment Info ===\n");

    if (!BLOCKFROST_PROJECT_ID) throw new Error("BLOCKFROST_PROJECT_ID not set in .env");

    // 1. Initialize Lucid (needed for address derivation with network context)
    const networkUrl = NETWORK.toLowerCase() === "mainnet"
        ? "https://cardano-mainnet.blockfrost.io/api/v0"
        : `https://cardano-${NETWORK.toLowerCase()}.blockfrost.io/api/v0`;

    const lucid = await Lucid(
        new Blockfrost(networkUrl, BLOCKFROST_PROJECT_ID),
        NETWORK
    );

    // 2. Load Plutus JSON
    const plutusJsonPath = path.resolve(__dirname, SCRIPT_PATH);
    console.log(`Loading blueprint from: ${plutusJsonPath}`);
    if (!fs.existsSync(plutusJsonPath)) {
        throw new Error("plutus.json not found. Did you run 'aiken build'?");
    }
    const plutusJson = JSON.parse(fs.readFileSync(plutusJsonPath, "utf8"));

    // 3. Derive Staking Contract
    console.log("\n--- Staking Validator ---");
    const stakingValidator = loadValidator(plutusJson, "staking.staking.spend");
    if (stakingValidator) stakingValidator.type = "PlutusV3";

    const stakingHash = validatorToScriptHash(stakingValidator);
    const stakingAddress = validatorToAddress(NETWORK, stakingValidator);

    console.log(`Validator Title: staking.staking.spend`);
    console.log(`Script Hash:     ${stakingHash}`);
    console.log(`Address:         ${stakingAddress}`);

    // 4. Derive Treasury Contract
    console.log("\n--- Treasury Validator ---");

    let treasuryHash, treasuryAddress;

    try {
        const treasuryValidator = loadValidator(plutusJson, "treasury.treasury.spend");
        // Parameterization removed: treasury.ak is not parameterized.
        treasuryValidator.type = "PlutusV3";

        treasuryHash = validatorToScriptHash(treasuryValidator);
        treasuryAddress = validatorToAddress(NETWORK, treasuryValidator);

        console.log(`Validator Title: treasury.treasury.spend`);
        console.log(`Script Hash:     ${treasuryHash}`);
        console.log(`Address:         ${treasuryAddress}`);
    } catch (e) {
        console.log("Could not derive Treasury details:", e.message);
    }

    // Update deploy info
    if (treasuryHash && treasuryAddress) {
        const deployInfo = {
            network: NETWORK,
            staking: {
                hash: stakingHash,
                address: stakingAddress
            },
            treasury: {
                hash: treasuryHash,
                address: treasuryAddress
            },
            timestamp: new Date().toISOString()
        };
        fs.writeFileSync(path.join(__dirname, "deploy_info.json"), JSON.stringify(deployInfo, null, 2));
    }

    console.log("\n--- Deployment Info Saved ---");
    console.log("Saved to deploy_info.json");
}

deploy().catch(e => {
    console.error("\n❌ Error:", e.message);
    process.exit(1);
});
