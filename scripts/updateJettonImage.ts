/**
 * Owner: UpdateContent with $AWN logo (TEP-64 on-chain metadata).
 * Run: npx tsx scripts/updateJettonImage.ts
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

const GID = -3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const mnemonic = process.env.WALLET_MNEMONIC?.trim();
  if (!mnemonic) throw new Error("WALLET_MNEMONIC required");

  const deployPath = join(process.cwd(), "deployments", "testnet.json");
  if (!existsSync(deployPath)) throw new Error("deployments/testnet.json missing");
  const dep = JSON.parse(readFileSync(deployPath, "utf8"));
  const minter = Address.parse(
    process.env.MINTER_ADDRESS?.trim() || (dep.minter as string),
  );

  const meta = {
    ...DEFAULT_AWN_METADATA,
    name: process.env.JETTON_NAME || DEFAULT_AWN_METADATA.name,
    symbol: process.env.JETTON_SYMBOL || DEFAULT_AWN_METADATA.symbol,
    description: process.env.JETTON_DESCRIPTION || DEFAULT_AWN_METADATA.description,
    image:
      process.env.JETTON_IMAGE?.trim() ||
      "https://awantoken.netlify.app/awn-logo.png",
    decimals: process.env.JETTON_DECIMALS || DEFAULT_AWN_METADATA.decimals,
  };
  const content = buildOnchainMetadata(meta);
  console.log("Metadata image:", meta.image);
  console.log("Minter:", minter.toString());

  const endpoint =
    process.env.TON_RPC_ENDPOINT?.trim() ||
    "https://ton-testnet.gateway.tatum.io/jsonRPC";
  const client = new TonClient({
    endpoint,
    apiKey: endpoint.includes("toncenter.com")
      ? process.env.TONCENTER_API_KEY || undefined
      : undefined,
  });

  const key = await mnemonicToPrivateKey(mnemonic.split(/\s+/));
  const wallet = WalletContractV5R1.create({
    publicKey: key.publicKey,
    walletId: { networkGlobalId: GID },
  });
  const w = client.open(wallet);

  console.log("Cooling 15s for RPC…");
  await sleep(15_000);
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
      console.warn("retry", i + 1, String(e).slice(0, 80));
      await sleep(15_000);
      if (i === 5) throw e;
    }
  }

  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    try {
      if ((await w.getSeqno()) > seqno) break;
    } catch {
      /* 429 */
    }
  }

  dep.metadata = meta;
  dep.jettonImageUpdatedAt = new Date().toISOString();
  writeFileSync(deployPath, JSON.stringify(dep, null, 2));
  console.log("Saved deployments/testnet.json metadata");
  console.log("Explorer:", `https://testnet.tonviewer.com/${minter.toString()}`);
  console.log("Done. Wallets may cache old image for a while.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
