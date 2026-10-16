/**
 * Poll mainnet Owner balance; when ≥ 0.5 TON, run deploy:mainnet.
 * Fund address printed on start (from WALLET_MNEMONIC / WALLET_MNEMONIC_MAINNET).
 *
 * Run: CONFIRM_MAINNET=1 npx tsx scripts/waitAndDeployMainnet.ts
 */
import "dotenv/config";
import { spawn } from "child_process";
import { fromNano, toNano } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { TonClient, WalletContractV5R1 } from "@ton/ton";

const MAINNET_GLOBAL_ID = -239;
const NEED = toNano("0.5");
const POLL_MS = 20_000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (process.env.CONFIRM_MAINNET !== "1") {
    throw new Error("Set CONFIRM_MAINNET=1");
  }
  const mnemonic =
    process.env.WALLET_MNEMONIC_MAINNET?.trim() ||
    process.env.WALLET_MNEMONIC?.trim();
  if (!mnemonic) throw new Error("Missing mnemonic");

  const key = await mnemonicToPrivateKey(mnemonic.split(/\s+/));
  const wallet = WalletContractV5R1.create({
    publicKey: key.publicKey,
    walletId: { networkGlobalId: MAINNET_GLOBAL_ID },
  });
  const uq = wallet.address.toString({ bounceable: false, urlSafe: true });
  const raw =
    process.env.TON_RPC_ENDPOINT_MAINNET?.trim() ||
    process.env.TON_RPC_ENDPOINT?.trim() ||
    "https://toncenter.com/api/v2/jsonRPC";
  const endpoint = /testnet/i.test(raw)
    ? "https://toncenter.com/api/v2/jsonRPC"
    : raw;
  const client = new TonClient({
    endpoint,
    apiKey: process.env.TONCENTER_API_KEY || undefined,
  });
  const opened = client.open(wallet);

  console.log("=== MAINNET DEPLOY WAITING FOR FUNDS ===");
  console.log("Send ≥ 1.5 TON (deploy gas; keep ~50 TON on funded wallet for LP) to:");
  console.log(uq);
  console.log("Explorer: https://tonviewer.com/" + uq);
  console.log("Funded wallet (do NOT drain for LP): UQA1G4lmw34UsL4P30mvW4k8WSCs1RHUkjXcp1DjE66L1ss9");
  console.log("Polling every", POLL_MS / 1000, "s…");

  for (;;) {
    try {
      const bal = await opened.getBalance();
      console.log(new Date().toISOString(), "balance=", fromNano(bal), "TON");
      if (bal >= NEED) {
        console.log("Funds detected — starting deploy:mainnet");
        const child = spawn(
          "npx",
          ["tsx", "scripts/deployMainnet.ts"],
          {
            stdio: "inherit",
            shell: true,
            env: { ...process.env, CONFIRM_MAINNET: "1" },
            cwd: process.cwd(),
          },
        );
        const code: number = await new Promise((resolve) => {
          child.on("close", (c) => resolve(c ?? 1));
        });
        process.exit(code);
      }
    } catch (e) {
      console.warn("poll error:", String(e).slice(0, 120));
    }
    await sleep(POLL_MS);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
