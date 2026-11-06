// Checks that nothing resembling an API key ended up in the build (dist/).
// Runs automatically after `npm run build`.
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const KEY_PATTERN = /sk-ant-[A-Za-z0-9_-]{16,}/;
const envKey = process.env.ANTHROPIC_API_KEY;

async function* files(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* files(p);
    else yield p;
  }
}

let hits = 0;
let scanned = 0;
for await (const f of files(dist)) {
  if (!/\.(js|css|html|json|webmanifest|txt|map|svg)$/.test(f)) continue;
  scanned++;
  const text = await readFile(f, "utf8");
  if (KEY_PATTERN.test(text) || (envKey && text.includes(envKey))) {
    console.error("FOUND SOMETHING THAT LOOKS LIKE A KEY IN", relative(root, f));
    hits++;
  }
}
if (hits) process.exit(1);
console.log(`check-no-key: scanned ${scanned} files in dist/, no key found.`);
