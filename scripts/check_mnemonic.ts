import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";
import { wordlists } from "bip39";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, ".env") });

const rawMnemonic = process.env.MNEMONIC || "";
const mnemonicWords = rawMnemonic.replace(/\s+/g, " ").trim();
const words = mnemonicWords.split(" ");

console.log(`Checking ${words.length} words...`);

const english = wordlists.english;
const invalidWords = [];

words.forEach((w, i) => {
    if (!english.includes(w)) {
        console.log(`Word ${i + 1}: '${w}' is INVALID`);
        invalidWords.push(w);
    }
});

if (invalidWords.length === 0) {
    console.log("All words are valid BIP39 words.");
    // Check checksum?
    // bip39.mnemonicToEntropy...
} else {
    console.log("Found invalid words:", invalidWords);
}
