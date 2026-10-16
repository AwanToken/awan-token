/**
 * Rewrites public/tonconnect-manifest.json url/iconUrl to the current Vite origin.
 * Called from vite plugin on server start so TonConnect always matches the host.
 */
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "public", "tonconnect-manifest.json");

export function patchManifest(origin) {
  const base = (origin || "http://localhost:5174").replace(/\/$/, "");
  const data = existsSync(file)
    ? JSON.parse(readFileSync(file, "utf8"))
    : { name: "$AWN Mini App" };
  data.url = base;
  data.name = data.name || "$AWN Mini App";
  data.iconUrl = `${base}/awn-logo.png`;
  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  return data;
}

if (process.argv[1] && process.argv[1].includes("patch-tonconnect-manifest")) {
  const origin = process.argv[2] || "http://localhost:5174";
  console.log(patchManifest(origin));
}
