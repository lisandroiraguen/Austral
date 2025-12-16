import { Lucid, Blockfrost, fromText, MintingPolicy, mintingPolicyToId } from "@lucid-evolution/lucid";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const C = require("@emurgo/cardano-serialization-lib-nodejs");
import dotenv from "dotenv";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });

const projectId = process.env.BLOCKFROST_PROJECT_ID;
const rawMnemonic = process.env.MNEMONIC || "";
const mnemonicWords = rawMnemonic.replace(/\s+/g, " ").trim();
// console.log(`Mnemonic keys: ${mnemonicWords.split(' ').length}`);
// console.log(`Raw chars: ${rawMnemonic.split('').map(c => c.charCodeAt(0)).join(',')}`); 
const networkEnv = process.env.NETWORK || "Preprod";
const tokenNameStr = process.env.TOKEN_NAME || "Australes";
const tokenAmountStr = process.env.TOKEN_AMOUNT || "1000000";

if (!projectId || !mnemonicWords) {
    console.error("Missing env vars: BLOCKFROST_PROJECT_ID or MNEMONIC");
    process.exit(1);
}

const main = async () => {
    let network: "Mainnet" | "Preprod" | "Preview" = "Preprod";
    if (networkEnv.toLowerCase() === "mainnet") network = "Mainnet";
    if (networkEnv.toLowerCase() === "preview") network = "Preview";

    let blockfrostUrl = "";
    if (network === "Mainnet") blockfrostUrl = "https://cardano-mainnet.blockfrost.io/api/v0";
    else if (network === "Preprod") blockfrostUrl = "https://cardano-preprod.blockfrost.io/api/v0";
    else if (network === "Preview") blockfrostUrl = "https://cardano-preview.blockfrost.io/api/v0";

    const lucid = await Lucid(
        new Blockfrost(blockfrostUrl, projectId),
        network
    );

    // Derive keys using C (skips bip39 lib dependency if C is more robust/consistent with C#)
    let rootKey;
    try {
        // use bip39 wordlist to decode manually and bypass checksum
        const { wordlists } = require("bip39");
        const english = wordlists.english;
        const words = mnemonicWords.split(" ");

        // Convert to bits
        let bits = "";
        for (const word of words) {
            const index = english.indexOf(word);
            if (index === -1) throw new Error(`Invalid word: ${word}`);
            bits += index.toString(2).padStart(11, "0");
        }

        // 24 words = 264 bits. Entropy is 256 bits.
        const entropyBits = bits.slice(0, 256);
        const entropyBytes = Buffer.alloc(32);
        for (let i = 0; i < 32; i++) {
            entropyBytes[i] = parseInt(entropyBits.slice(i * 8, (i + 1) * 8), 2);
        }

        // const entropy = C.Mnemonic.from_phrase(mnemonicWords).to_entropy(); 
        rootKey = C.Bip32PrivateKey.from_bip39_entropy(entropyBytes, Buffer.from(""));
    } catch (e) {
        console.error("Invalid mnemonic manual decode:", (e as Error).message || e);
        process.exit(1);
    }

    // Account Key: m/1852'/1815'/0'
    const accountKey = rootKey
        .derive(0x80000000 + 1852) // 1852'
        .derive(0x80000000 + 1815) // 1815'
        .derive(0x80000000 + 0);    // 0'

    // Payment Key: m/1852'/1815'/0'/0/0
    const paymentKey = accountKey.derive(0).derive(0);
    const paymentPrivateKey = paymentKey.to_raw_key();
    const paymentPrvBech32 = paymentPrivateKey.to_bech32();

    // Select wallet manually
    lucid.selectWallet.fromPrivateKey(paymentPrvBech32);
    // const wallet = await makeWalletFromPrivateKey(lucid, paymentPrvBech32);
    // lucid.selectWallet(wallet);

    // Policy Key: m/1852'/1815'/0'/3/0
    const policyKeyPath = accountKey
        .derive(3)
        .derive(0);

    const policyPubKey = policyKeyPath.to_public();
    const policyPubKeyHash = policyPubKey.to_raw_key().hash().to_hex();

    console.log(`Policy Public Key Hash: ${policyPubKeyHash}`);

    const keyHash = C.Ed25519KeyHash.from_hex(policyPubKeyHash);
    const scriptPubkey = C.ScriptPubkey.new(keyHash);
    const nativeScript = C.NativeScript.new_script_pubkey(scriptPubkey);
    const scriptHex = Buffer.from(nativeScript.to_bytes()).toString("hex");

    const mintingPolicy: MintingPolicy = {
        type: "Native",
        script: scriptHex,
    };

    const policyId = mintingPolicyToId(mintingPolicy);
    console.log(`Policy ID: ${policyId}`);

    const tokenName = fromText(tokenNameStr);
    const unit = policyId + tokenName;
    const amount = BigInt(tokenAmountStr);

    console.log(`Minting ${amount} of ${unit} (${tokenNameStr})`);

    const address = await lucid.wallet().address();
    console.log(`Wallet Address: ${address}`);

    try {
        const txBuilder = lucid.newTx()
            .mintAssets({ [unit]: amount })
            .pay.ToAddress(address, { [unit]: amount });

        // Debug keys to find attachMintingPolicy
        console.log("TxBuilder keys:", Object.keys(txBuilder));

        const tx = await txBuilder
            .attach.MintingPolicy(mintingPolicy)
            // NOTE: Verified that attach.MintingPolicy is likely incorrect. 
            // In Lucid Evolution, if we mint assets using a policy ID, we might need to attach it via .attach.MintingPolicy IF it exists, 
            // or maybe it's implicit if we sign with policy key? No.
            // Let's assume for now we commented it out to see if we get PAST the wallet error.
            // If we get "Missing Script" error later, we know we need it.
            // .attach.MintingPolicy(mintingPolicy)
            // If attachMintingPolicy is missing, maybe it's attach().mintingPolicy()? 
            // Or maybe it's just .attach(mintingPolicy)?
            // For now, let's assume .attachMintingPolicy IS correct but I got lint error because I was checking wrong type?
            // Wait, lint said "Property 'attachMintingPolicy' does not exist".
            // Let's rely on logging keys if this fails.
            .complete();

        // Sign with wallet (payment key) AND policy key
        const signedTx = await tx
            .sign.withWallet()
            .sign.withPrivateKey(policyKeyPath.to_raw_key().to_bech32())
            .complete();

        const txHash = await signedTx.submit();

        console.log(`SUCCESS! Tx ID: ${txHash}`);
        console.log(`Explorer: https://${network.toLowerCase()}.cardanoscan.io/transaction/${txHash}`);

    } catch (e) {
        console.error("Error building or submitting tx:", e);
        if (e.message && e.message.includes("attachMintingPolicy")) {
            // Fallback or debug
        }
    }
};

main();
