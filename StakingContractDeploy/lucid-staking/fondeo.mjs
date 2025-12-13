// fondeo.mjs
import { config } from "dotenv";
import { Lucid, Blockfrost, Data, fromHex, getAddressDetails } from "@lucid-evolution/lucid";
import { readFileSync } from "fs";

config();

const BLOCKFROST_PROJECT_ID = process.env.BLOCKFROST_PROJECT_ID;
const MNEMONIC = process.env.MNEMONIC;
const NETWORK = process.env.NETWORK || "Preview";

if (!BLOCKFROST_PROJECT_ID) throw new Error("Falta BLOCKFROST_PROJECT_ID");
if (!MNEMONIC) throw new Error("Falta MNEMONIC");

async function main() {
    const networkUrl =
        NETWORK.toLowerCase() === "mainnet"
            ? "https://cardano-mainnet.blockfrost.io/api/v0"
            : `https://cardano-${NETWORK.toLowerCase()}.blockfrost.io/api/v0`;

    console.log(`Conectando a ${NETWORK}`);

    const lucid = await Lucid(new Blockfrost(networkUrl, BLOCKFROST_PROJECT_ID), NETWORK);

    lucid.selectWallet.fromSeed(MNEMONIC);
    const walletAddress = await lucid.wallet().address();
    console.log("Wallet:", walletAddress);

    const details = getAddressDetails(walletAddress);

    if (!details.paymentCredential) {
        throw new Error("No se encontró payment credential");
    }

    const paymentCred = details.paymentCredential;

    const policyId = "9ea5cd066fda8431f52565159c426b1717c8ffc9d7a1fbcda62e3b5c";
    const assetNameHex = "4175737472616c2d54657374"; // Austral-Test

    // Load Script Address from deploy_info.json
    const deployInfo = JSON.parse(readFileSync("./deploy_info.json", "utf8"));
    const scriptAddress = deployInfo.treasury.address;
    console.log(`Funding Treasury Address: ${scriptAddress}`);

    // Datum exacto esperado por la mayoría de treasuries Aiken 2025
    const TreasuryDatum = Data.Object({
        owner: Data.Bytes(),
        lock_until: Data.Integer(),
        reward_rate: Data.Integer(),
        policy_id: Data.Bytes(),
        asset_name: Data.Bytes(),
        treasury_remaining: Data.Integer(),
    });

    const datum = Data.to({
        owner: paymentCred.hash,
        lock_until: 0n,
        reward_rate: 0n,
        policy_id: policyId,
        asset_name: assetNameHex,
        treasury_remaining: 500000n,
    }, TreasuryDatum);

    console.log("Construyendo transacción de fondeo...");

    const tx = await lucid
        .newTx()
        .pay.ToContract(
            scriptAddress,
            { kind: "inline", value: datum },
            {
                lovelace: 5_000_000n,
                [policyId + assetNameHex]: 500_000n,
            }
        )
        .complete();

    console.log("Firmando...");
    const signed = await tx.sign.withWallet().complete();

    console.log("Enviando...");
    const txHash = await signed.submit();

    console.log(`FONDEO EXITOSO!`);
    console.log(`https://${NETWORK.toLowerCase()}.cardanoscan.io/tx/${txHash}`);
    // o cexplorer si prefieres:
    // console.log(`https://${NETWORK.toLowerCase()}.cexplorer.io/tx/${txHash}`);
}

main().catch((err) => {
    console.error("\nERROR:");
    console.error(err.message || err);
    process.exit(1);
});