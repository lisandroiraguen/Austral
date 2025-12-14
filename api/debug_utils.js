const { Lucid, Blockfrost } = require("@lucid-evolution/lucid");

async function main() {
    console.log("Initializing Lucid...");
    const lucid = await Lucid(
        new Blockfrost("https://cardano-preview.blockfrost.io/api/v0", "preview..."), // Mock or invalid, just need structure
        "Preview"
    );

    console.log("Lucid keys:", Object.keys(lucid));
    if (lucid.utils) {
        console.log("Lucid.utils keys:", Object.keys(lucid.utils));
        if (typeof lucid.utils.validatorToAddress === 'function') {
            console.log("✅ validatorToAddress found in lucid.utils");
        } else {
            console.log("❌ validatorToAddress NOT found in lucid.utils");
        }
    } else {
        console.log("❌ lucid.utils is undefined");
    }

    // Check prototype or other places
    console.log("Lucid prototype:", Object.getOwnPropertyNames(Object.getPrototypeOf(lucid)));
}

main().catch(console.error);
