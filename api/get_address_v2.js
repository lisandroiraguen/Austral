const { Lucid, validatorToAddress } = require("@lucid-evolution/lucid");
const fs = require("fs");
const path = require("path");

(async () => {
    try {
        const plutusJsonPath = path.resolve(__dirname, "../StakingContract/plutus.json");
        const plutusJson = JSON.parse(fs.readFileSync(plutusJsonPath, "utf8"));

        const validator = plutusJson.validators.find(v => v.title === "staking.staking.spend");

        if (!validator) {
            console.error("Validator not found");
            process.exit(1);
        }

        const compiledCode = validator.compiledCode;
        const script = {
            type: "PlutusV3",
            script: compiledCode,
        };

        const address = validatorToAddress("Preview", script);
        console.log("Calculated Address:", address);

    } catch (e) {
        console.error(e);
    }
})();
