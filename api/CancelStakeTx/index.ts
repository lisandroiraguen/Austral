import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import {
    Blockfrost,
    Lucid,
    Data,
    Constr,
    paymentCredentialOf,
    credentialToAddress
} from "@lucid-evolution/lucid";
import * as fs from "fs";
import * as path from "path";
import { STAKING_ADDRESS } from "../Shared/constants";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('CancelStakeTx triggered.');

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

        // Address conversion not needed as frontend sends Bech32
        const bech32Address = walletAddress;

        lucid.selectWallet.fromAddress(bech32Address, []);
        const paymentCred = paymentCredentialOf(bech32Address);
        const ownerPkh = paymentCred.hash;

        // Load Script
        // Running from dist/CancelStakeTx/index.js -> ../../plutus.json
        const plutusJsonPath = path.resolve(__dirname, "../..", "plutus.json");
        let compiledCode = "";
        try {
            const plutusJson = JSON.parse(fs.readFileSync(plutusJsonPath, "utf8"));
            const validator = plutusJson.validators.find((v: any) => v.title === "staking.staking.spend");
            if (validator) {
                compiledCode = validator.compiledCode;
            } else {
                throw new Error("Validator not found in plutus.json");
            }
        } catch (e) {
            // Fallback or error if strictly required for spending?
            // Actually, we need the script to include it in the tx as witness!
            context.log.error("Failed to load plutus.json", e);
            throw new Error("Internal Server Error: Could not load contract script.");
        }

        const script = {
            type: "PlutusV3",
            script: compiledCode,
        };

        // Find UTXO to refund
        const utxos = await lucid.utxosAt(STAKING_ADDRESS);

        // Address strictness fix:
        const beneficiaryAddress = credentialToAddress(network, paymentCred);
        context.log("Paying Refund to:", beneficiaryAddress);

        // Also fix Datum Schema (for finding utxo properly)
        // Must match CreateStakeTx structure
        const Credential = Data.Enum([
            Data.Object({ VerificationKey: Data.Object({ hash: Data.Bytes() }) }),
            Data.Object({ Script: Data.Object({ hash: Data.Bytes() }) }),
        ]);

        const Address = Data.Object({
            payment_credential: Credential,
            stake_credential: Data.Nullable(Credential),
        });

        const StakingDatum = Data.Object({
            beneficiary: Address,
            principal_lovelace: Data.Integer(),
            reward_percent: Data.Integer(),
            release_time: Data.Integer(),
            reward_policy: Data.Bytes(),
            reward_asset: Data.Bytes(),
        });

        const myUtxo = utxos.find(u => {
            if (!u.datum) return false;
            try {
                const datum = Data.from(u.datum, StakingDatum) as any;
                const pkh = datum.beneficiary.payment_credential.VerificationKey?.hash;
                return pkh === ownerPkh;
            } catch (e) { return false; }
        });

        if (!myUtxo) {
            context.res = { status: 404, body: "No active stake found." };
            return;
        }

        const refundRedeemer = Data.to(new Constr(1, []));
        const principal = BigInt(Data.from(myUtxo.datum!, StakingDatum).principal_lovelace as any);

        const tx = await lucid.newTx()
            .collectFrom([myUtxo], refundRedeemer)
            .attach.SpendingValidator(script as any)
            .addSigner(bech32Address)
            // Refund MUST pay strictly to the beneficiary defined in datum
            .pay.ToAddress(beneficiaryAddress, { lovelace: principal })
            .complete();

        const partialTx = tx.toCBOR();

        context.res = {
            status: 200,
            body: { partialTx }
        };

    } catch (error: any) {
        context.log.error("CancelStakeTx Error:", error);
        context.res = {
            status: 500,
            body: `Error processing withdrawal: ${error.message}`
        };
    }
};

export default httpTrigger;
