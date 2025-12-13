import { validatorToAddress } from "@lucid-evolution/lucid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pj = JSON.parse(fs.readFileSync(path.join(__dirname, '../../StakingContract/plutus.json'), 'utf8'));
const treasuryVal = pj.validators.find(v => v.title === 'treasury.treasury.spend');
const script = { type: 'PlutusV3', script: treasuryVal.compiledCode };
const addr = validatorToAddress('Preview', script);
console.log(addr);
