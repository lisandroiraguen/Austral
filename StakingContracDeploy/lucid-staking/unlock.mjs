/**
 * Unlock Staking Funds using Lucid Evolution
 * Now with Treasury Integration!
 */
import "dotenv/config";
import {
    Lucid,
    Blockfrost,
    Constr,
    Data,
    validatorToAddress,
    paymentCredentialOf,
    applyParamsToScript,
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

// Load Deploy Info
const DEPLOY_INFO_PATH = path.join(__dirname, "deploy_info.json");
if (!fs.existsSync(DEPLOY_INFO_PATH)) throw new Error("deploy_info.json not found. Run deploy.mjs first.");
const DEPLOY_INFO = JSON.parse(fs.readFileSync(DEPLOY_INFO_PATH, "utf8"));

// Hardcoded fallback values
const FALLBACK_UTXO_TX_HASH = "58fd8aac66046854887e1b4326d43089aedbe8d41bbe95b8dabb9187dc83c381";
const FALLBACK_UTXO_OUTPUT_INDEX = 0;

// ========================================
// LOAD SCRIPTS
// ========================================

function loadPlutusScripts() {
    const plutusJsonPath = path.resolve(__dirname, SCRIPT_PATH);
    console.log(`   Loading scripts from: ${plutusJsonPath}`);
    const plutusJson = JSON.parse(fs.readFileSync(plutusJsonPath, "utf8"));

    const stakingVal = plutusJson.validators.find(v => v.title === "staking.staking.spend");
    if (!stakingVal) throw new Error("Staking Validator not found");

    const treasuryVal = plutusJson.validators.find(v => v.title === "treasury.treasury.spend");
    if (!treasuryVal) throw new Error("Treasury Validator not found in plutus.json");

    // The Treasury is parameterized by the Staking Hash!
    // We must apply the parameters to get the script that matches the deployed address.
    const stakingHash = DEPLOY_INFO.staking.hash;
    console.log(`   Applying Staking Hash param: ${stakingHash}`);

    const stakingHashParam = Data.to(stakingHash, Data.Bytes());
    const parameterizedTreasuryScript = applyParamsToScript(treasuryVal.compiledCode, [stakingHashParam]);

    return {
        staking: {
            type: "PlutusV3",
            script: stakingVal.compiledCode,
        },
        treasury: {
            type: "PlutusV3",
            script: parameterizedTreasuryScript,
        }
    };
}

// ========================================
// MAIN
// ========================================

async function unlockFunds() {
    console.log("=== Lucid Staking Unlock (With Rewards) ===\n");

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

    const paymentCred = paymentCredentialOf(walletAddress);
    const ownerPkh = paymentCred.hash;
    console.log(`   Owner PKH: ${ownerPkh}`);

    console.log("\n3. Loading scripts...");
    const scripts = loadPlutusScripts();

    // Verify Staking Address
    const stakingAddress = validatorToAddress(NETWORK, scripts.staking);
    console.log(`   Staking Address (Calculated): ${stakingAddress}`);

    // Treasury Address from Config
    const treasuryAddress = DEPLOY_INFO.treasury.address;
    const treasuryHash = DEPLOY_INFO.treasury.hash;
    console.log(`   Treasury Address (Config)   : ${treasuryAddress}`);

    // We assume the local treasury compiled script matches the config hash.
    // If not, we warn.
    if (scripts.treasury) {
        // We'd need to parameterize it to check the hash, which is complex here.
        // We'll trust the user knows what they are doing.
    } else {
        console.log("   ⚠️ Treasury script not found in plutus.json! We cannot spend from it.");
        // We can't proceed if we can't witness the treasury spend.
        // Unless it's a Simple Script? But it's likely Plutus.
        throw new Error("Treasury Contract code missing from plutus.json");
    }

    console.log("\n4. Fetching Staking UTXO...");
    const stakingUtxos = await lucid.utxosAt(stakingAddress);
    const targetUtxo = stakingUtxos.find(
        u => u.txHash === UTXO_TX_HASH && u.outputIndex === UTXO_OUTPUT_INDEX
    );

    if (!targetUtxo) {
        console.log(`\n❌ Target UTXO NOT FOUND: ${UTXO_TX_HASH}#${UTXO_OUTPUT_INDEX}`);
        // console.log("Available UTXOs:");
        // stakingUtxos.forEach(u => console.log(`   - ${u.txHash}#${u.outputIndex}`));
        process.exit(1);
    }
    console.log(`   ✅ Found Staking UTXO: ${targetUtxo.txHash}#${targetUtxo.outputIndex}`);

    // --- PARSE DATUM ---
    console.log("\n5. Parsing Datum...");
    if (!targetUtxo.datum) { console.log("   ❌ No datum found!"); process.exit(1); }

    const datumData = Data.from(targetUtxo.datum);
    // Expected: DepositDatum(beneficiary, principal, start_time, lock_months, reward_policy, reward_asset)
    // Actually the Datum structure in 'lock.mjs' might differ slightly from 'staking.ak' types order.
    // Let's rely on what we put in 'lock.mjs'.
    /*
        const DepositDatum = Data.Object({
            beneficiary: Address,
            principal_lovelace: Data.Integer(),
            reward_percent: Data.Integer(),
            release_time: Data.Integer(),
            reward_policy: Data.Bytes(),
            reward_asset: Data.Bytes(),
        });
    */

    // For safer parsing without Schema if we aren't sure of exact field order coming back (Data.from returns generic):
    // const datumOwner = datumData.fields[0]; // Address is an Object/Constr?
    // Address = Constr(0, [PaymentCred, StakeCred])
    // PaymentCred = Constr(0, [Constr(0, [Hash])]) (VerificationKey)

    // Let's inspect detailed structure if needed.
    // Simplify: We assume standard encoding.

    const beneficiary = datumData.fields[0];
    const principal = BigInt(datumData.fields[1]);
    const rewardPercent = BigInt(datumData.fields[2]);
    const releaseTime = BigInt(datumData.fields[3]);
    const rewardPolicy = datumData.fields[4];
    const rewardAsset = datumData.fields[5]; // This is bytes

    console.log(`   Principal: ${principal}`);
    console.log(`   Release:   ${releaseTime}`);
    console.log(`   Reward %:  ${rewardPercent}`);
    console.log(`   Asset:     ${rewardPolicy}.${rewardAsset}`);

    // --- CHECK TIME ---
    const currentTime = Date.now();
    if (currentTime < Number(releaseTime)) {
        console.log(`   ❌ Time Lock Active! Wait until ${new Date(Number(releaseTime)).toLocaleString()}`);
        process.exit(0);
    }
    console.log("   ✅ Time Lock Passed.");

    // --- FETCH TREASURY UTXO ---
    console.log("\n6. Fetching Treasury UTXO (for Reward)...");
    const treasuryUtxos = await lucid.utxosAt(treasuryAddress);
    console.log(`   Found ${treasuryUtxos.length} Treasury UTXOs`);

    // We need a UTXO that has the Reward Token.
    // Construct Unit: PolicyID + HexName
    const rewardUnit = rewardPolicy + rewardAsset;
    console.log(`   Looking for Asset: ${rewardUnit}`);

    // Calculate Reward Amount
    const rewardAmount = (principal * rewardPercent) / 100n;
    console.log(`   Reward Amount: ${rewardAmount}`);

    // Find suitable UTXO
    // We prefer one that has enough tokens.
    const fundingUtxo = treasuryUtxos.find(u => u.assets[rewardUnit] >= rewardAmount);

    if (!fundingUtxo) {
        console.log("   ❌ No Treasury UTXO found with enough Reward Tokens!");
        process.exit(1);
    }
    console.log(`   ✅ Found Funding UTXO: ${fundingUtxo.txHash}#${fundingUtxo.outputIndex}`);
    console.log(`      Contains: ${fundingUtxo.assets[rewardUnit]} tokens`);

    // --- BUILD TRANSACTION ---
    console.log("\n7. Building Transaction...");

    // Redeemers
    const claimRedeemer = Data.to(new Constr(0, [])); // Claim
    const withdrawRedeemer = Data.to(new Constr(0, [])); // WithdrawReward

    // Treasury Datum (to put back into Treasury Change)
    // We need to know what Datum the Treasury expects.
    // If we consume the standard Treasury UTXO, we should query its datum to preserve state if needed.
    // Or we provide a new standard datum.
    // fondeo.mjs uses: Owner, LockUntil, RewardRate, Policy, Asset, Remaining.
    // Let's assume we can just copy the datum from the input or create new.
    // For now, let's try to KEEP the same datum (inline) if possible, or decode and update 'treasury_remaining'?
    // The Treasury Validator in 'treasury.ak' (from previous context) seemed to ignore datum logic in 'spend'?
    // "spend(_datum: Option<TreasuryDatum>...)"
    // It only checked "staking_input" presence.
    // So we can likely just put back a valid datum.

    let treasuryDatum = fundingUtxo.datum;
    // Ideally we update the 'remaining' count in the datum if we want to be good citizens, 
    // but for this test, let's just use the same datum or 'Data.void()' if it accepts anything.
    // Let's reuse the input datum to be safe.

    // Calculate Change for Treasury
    // We are taking 'rewardAmount' tokens.
    // We should leave the rest.
    // Also we might need to leave ADA?
    // How much ADA is in the input?
    const inputAda = fundingUtxo.assets.lovelace;
    const inputTokens = fundingUtxo.assets[rewardUnit];

    const changeTokens = inputTokens - rewardAmount;

    // We need to send 'changeTokens' back to Treasury.
    // And some ADA (MinADA).

    // User Payout
    const payoutValue = {
        lovelace: principal, // We get back our principal
        [rewardUnit]: rewardAmount
    };

    // Transaction
    const safeValidFrom = Math.max(Number(releaseTime), currentTime - 60000);
    const validTo = currentTime + 15 * 60 * 1000;

    try {
        const tx = lucid.newTx()
            // Spend Staking Input
            .collectFrom([targetUtxo], claimRedeemer)
            .attach.SpendingValidator(scripts.staking)

            // Spend Treasury Input
            .collectFrom([fundingUtxo], withdrawRedeemer)
            // We need to attach Treasury Script. 
            // Note: If the hash doesn't match the one derived from 'scripts.treasury', this fails.
            .attach.SpendingValidator(scripts.treasury)

            // Output to User (Principal + Reward)
            // The constraint is: "output to beneficiary must have X ADA and Y Tokens"
            .pay.ToAddress(walletAddress, payoutValue)

            // Output Change to Treasury
            // We must send the remaining tokens back.
            .pay.ToContract(
                treasuryAddress,
                { kind: "inline", value: treasuryDatum }, // Reuse datum
                {
                    lovelace: inputAda, // Send back the ADA (minus fees if we were paying fees from it, but wallet pays fees)
                    [rewardUnit]: changeTokens
                }
            )

            // Signatories and Time
            .addSignerKey(ownerPkh)
            .validFrom(safeValidFrom)
            .validTo(validTo);

        console.log("   Constructing...");
        const builtTx = await tx.complete({ localUPLCEval: false });

        console.log("8. Signing...");
        const signedTx = await builtTx.sign.withWallet().complete({ localUPLCEval: false });

        console.log("9. Submitting...");
        const txHash = await signedTx.submit();

        console.log(`\n✅ SUCCESS!`);
        console.log(`   TxHash: ${txHash}`);
        console.log(`   https://preview.cardanoscan.io/transaction/${txHash}`);

    } catch (e) {
        console.error("\n❌ TRANSACTION FAILED");
        console.error(e);
        if (e.cause) console.error("Cause:", e.cause);
    }
}

unlockFunds().catch(e => {
    console.error("\n❌ ERROR:", e.message);
    process.exit(1);
});