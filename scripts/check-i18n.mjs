// Usage: node scripts/check-i18n.mjs   (from the project root)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const dictionary = ["lib/translations.ts", "lib/translations.extra.ts"].map((f) => readFileSync(f, "utf8")).join("\n");
const defined = new Set([...dictionary.matchAll(/^\s*"([\w.]+)":/gm)].map((m) => m[1]));

const used = new Map(); // key -> first file using it
const SKIP = new Set(["node_modules", ".next", ".git", "scripts"]);

function walk(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
            if (!SKIP.has(name)) walk(path);
        } else if (/\.tsx?$/.test(name) && !path.includes("translations")) {
            const text = readFileSync(path, "utf8");
            for (const m of text.matchAll(/\b(?:t|tx|translate)\(\s*(?:lang,\s*)?"([\w.]+)"|\bk="([\w.]+)"/g)) {
                const key = m[1] ?? m[2];
                if (!used.has(key)) used.set(key, path);
            }
        }
    }
}
walk(".");

const missing = [...used].filter(([key]) => !defined.has(key));
if (missing.length === 0) {
    console.log(`OK: all ${used.size} translation keys used in the code are defined.`);
} else {
    console.log(`MISSING ${missing.length} key(s):`);
    for (const [key, file] of missing) console.log(`  ${key}   (used in ${file})`);
    process.exitCode = 1;
}