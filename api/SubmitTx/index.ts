import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import {
    Lucid,
    Blockfrost
} from "@lucid-evolution/lucid";

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('Submit transaction (SubmitTx) triggered.');

    try {
        const { signedTxCbor } = req.body;

        if (!signedTxCbor) {
            context.res = {
                status: 400,
                body: "Missing required field: signedTxCbor"
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

        const provider = new Blockfrost(networkUrl, projectId);
        const lucid = await Lucid(
            provider,
            network
        );

        // Submit
        const txHash = await provider.submitTx(signedTxCbor);

        context.res = {
            status: 200,
            body: {
                txHash
            }
        };

    } catch (error) {
        context.log.error("Error submitting tx:", error);
        context.res = {
            status: 500,
            body: `Error submitting transaction: ${error.message}`
        };
    }
};

export default httpTrigger;
