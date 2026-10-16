/**
 * Mainnet Owner: UpdateContent with public HTTPS logo (TEP-64).
 * Run: npx tsx scripts/updateJettonImageMainnet.ts
 * Env: JETTON_IMAGE=https://... WALLET_MNEMONIC_MAINNET=...
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import {
  Address,
  beginCell,
  external,
  internal,
  storeMessage,
  toNano,
  SendMode,
} from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { TonClient, WalletContractV5R1 } from "@ton/ton";
import { storeUpdateContent } from "../build/AwanToken_AwanToken";
import {
  buildOnchainMetadata,
  DEFAULT_AWN_METADATA,
} from "../wrappers/jettonMetadata";

const MAINNET_GLOBAL_ID = -239;
const DEFAULT_RPC = "https://toncenter.com/api/v2/jsonRPC";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const mnemonic =
    process.env.WALLET_MNEMONIC_MAINNET?.trim() ||
    process.env.WALLET_MNEMONIC?.trim();
  if (!mnemonic) throw new Error("WALLET_MNEMONIC_MAINNET required");

  const image = process.env.JETTON_IMAGE?.trim();
  if (!image || !/^https:\/\//i.test(image)) {
    throw new Error("Set JETTON_IMAGE to a public https:// URL");
  }
  const deployPath = join(process.cwd(), "deployments", "mainnet.json");
  if (!existsSync(deployPath)) throw new Error("deployments/mainnet.json missing");
  const dep = JSON.parse(readFileSync(deployPath, "utf8"));
  const minter = Address.parse(
    process.env.MINTER_ADDRESS?.trim() || (dep.minter as string),
  );

  const meta = {
    ...DEFAULT_AWN_METADATA,
    name: process.env.JETTON_NAME || DEFAULT_AWN_METADATA.name,
    symbol: process.env.JETTON_SYMBOL || DEFAULT_AWN_METADATA.symbol,
    description:
      process.env.JETTON_DESCRIPTION || DEFAULT_AWN_METADATA.description,
    image,
    decimals: process.env.JETTON_DECIMALS || DEFAULT_AWN_METADATA.decimals,
  };
  const content = buildOnchainMetadata(meta);
  console.log("Metadata image:", meta.image);
  console.log("Minter:", minter.toString());

  const raw =
    process.env.TON_RPC_ENDPOINT_MAINNET?.trim() ||
    process.env.TON_RPC_ENDPOINT?.trim() ||
    DEFAULT_RPC;
  const endpoint = /testnet/i.test(raw) ? DEFAULT_RPC : raw;
  const client = new TonClient({
    endpoint,
    apiKey: process.env.TONCENTER_API_KEY || undefined,
  });

  const key = await mnemonicToPrivateKey(mnemonic.split(/\s+/));
  const wallet = WalletContractV5R1.create({
    publicKey: key.publicKey,
    walletId: { networkGlobalId: MAINNET_GLOBAL_ID },
  });
  const w = client.open(wallet);

  await sleep(2000);
  const seqno = await w.getSeqno();
  console.log("Owner:", wallet.address.toString(), "seqno", seqno);

  const body = beginCell()
    .store(
      storeUpdateContent({
        $$type: "UpdateContent",
        queryId: BigInt(Date.now() % 1_000_000),
        content,
      }),
    )
    .endCell();

  const transfer = wallet.createTransfer({
    seqno,
    secretKey: key.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    timeout: Math.floor(Date.now() / 1000) + 120,
    messages: [
      internal({
        to: minter,
        value: toNano("0.08"),
        bounce: true,
        body,
      }),
    ],
  });
  const boc = beginCell()
    .store(storeMessage(external({ to: wallet.address, body: transfer })))
    .endCell()
    .toBoc();

  for (let i = 0; i < 6; i++) {
    try {
      await client.sendFile(boc);
      console.log("UpdateContent submitted");
      break;
    } catch (e) {
      console.warn("retry", i + 1, String(e).slice(0, 100));
      await sleep(12_000);
      if (i === 5) throw e;
    }
  }

  for (let i = 0; i < 40; i++) {
    await sleep(2500);
    try {
      if ((await w.getSeqno()) > seqno) {
        console.log("Confirmed");
        break;
      }
    } catch {
      /* 429 */
    }
  }

  dep.metadata = meta;
  dep.jettonImageUpdatedAt = new Date().toISOString();
  writeFileSync(deployPath, JSON.stringify(dep, null, 2));
  console.log("Saved deployments/mainnet.json");
  console.log("Explorer: https://tonviewer.com/" + minter.toString());
  console.log("Done. Wallets may cache old metadata briefly.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
