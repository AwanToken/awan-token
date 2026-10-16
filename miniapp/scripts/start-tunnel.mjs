#!/usr/bin/env node
/**
 * Opens a public HTTPS tunnel to the local Vite Mini App (port 5174).
 * Prefers cloudflared (npx), falls back to localtunnel.
 * Patches tonconnect-manifest.json to the public origin and prints BotFather steps.
 */
import { spawn } from "child_process";
import { writeFileSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const PORT = Number(process.env.MINIAPP_PORT || 5174);
const manifestPath = join(root, "public", "tonconnect-manifest.json");

function patchManifest(origin) {
  const base = origin.replace(/\/$/, "");
  const data = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : { name: "$AWN Mini App" };
  data.url = base;
  data.name = data.name || "$AWN Mini App";
  data.iconUrl = `${base}/awn-logo.png`;
  writeFileSync(manifestPath, JSON.stringify(data, null, 2) + "\n");
  // Also patch dist if present (preview mode)
  const distManifest = join(root, "dist", "tonconnect-manifest.json");
  if (existsSync(join(root, "dist"))) {
    writeFileSync(distManifest, JSON.stringify(data, null, 2) + "\n");
  }
  console.log(`\n[tonconnect] manifest patched → ${base}\n`);
  return base;
}

function printBot(url) {
  spawn(process.execPath, [join(__dirname, "print-botfather.mjs"), url], {
    stdio: "inherit",
  });
}

function watchCloudflared(child) {
  const rl = createInterface({ input: child.stdout });
  let done = false;
  rl.on("line", (line) => {
    console.log(line);
    if (done) return;
    const m = line.match(/(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/i);
    if (m) {
      done = true;
      const url = patchManifest(m[1]);
      printBot(url);
    }
  });
  child.stderr.on("data", (buf) => {
    const line = buf.toString();
    process.stderr.write(line);
    if (done) return;
    const m = line.match(/(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/i);
    if (m) {
      done = true;
      const url = patchManifest(m[1]);
      printBot(url);
    }
  });
}

function startCloudflared() {
  console.log(`Starting Cloudflare quick tunnel → http://127.0.0.1:${PORT} …`);
  const child = spawn(
    "npx",
    ["--yes", "cloudflared", "tunnel", "--url", `http://127.0.0.1:${PORT}`],
    { cwd: root, shell: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  watchCloudflared(child);
  child.on("exit", (code) => {
    console.log("Tunnel exited:", code);
    process.exit(code ?? 0);
  });
  return child;
}

function startLocaltunnel() {
  console.log(`Starting localtunnel → port ${PORT} …`);
  const child = spawn(
    "npx",
    ["--yes", "localtunnel", "--port", String(PORT)],
    { cwd: root, shell: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  const rl = createInterface({ input: child.stdout });
  rl.on("line", (line) => {
    console.log(line);
    const m = line.match(/(https:\/\/[^\s]+)/i);
    if (m) {
      const url = patchManifest(m[1]);
      printBot(url);
    }
  });
  child.stderr.on("data", (d) => process.stderr.write(d));
  child.on("exit", (code) => process.exit(code ?? 0));
  return child;
}

const mode = (process.env.TUNNEL || "cloudflare").toLowerCase();
if (mode === "localtunnel" || mode === "lt") startLocaltunnel();
else startCloudflared();
