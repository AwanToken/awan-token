/**
 * Owner: ForceOpenClaimWindow — send first, verify via tonapi (avoids RPC 429).
 */
import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import {
  Address,
  beginCell,
  external,
  fromNano,
  internal,
  storeMessage,
  toNano,
  SendMode,
} from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { TonClient, WalletContractV5R1 } from "@ton/ton";
import { storeForceOpenClaimWindow } from "../build/AwanToken_AwanToken";

const TESTNET_GLOBAL_ID = -3;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function tonapiClaim(minter: string) {
  const url = `https://testnet.tonapi.io/v2/blockchain/accounts/${minter}/methods/get_claim_status`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tonapi ${res.status}`);
  const j = (await res.json()) as {
    success: boolean;
    stack: { type: string; num: string }[];
  };
  const n = (i: number) => BigInt(j.stack[i]!.num);
  return {
    cycleId: Number(n(0)),
    open: n(2) !== 0n,
    snapshot: fromNano(n(5)),
    treasury: fromNano(n(4)),
  };
}

async function main() {
  const mnemonic = process.env.WALLET_MNEMONIC?.trim();
  if (!mnemonic) throw new Error("WALLET_MNEMONIC required");
  const dep = JSON.parse(
    readFileSync(join(process.cwd(), "deployments", "testnet.json"), "utf8"),
  );
  const minter = Address.parse(dep.minter as string);
  const endpoint =
    process.env.TON_RPC_ENDPOINT?.trim() ||
    "https://testnet.toncenter.com/api/v2/jsonRPC";

  console.log("Claim before:", await tonapiClaim(dep.minter));

  const client = new TonClient({
    endpoint,
    apiKey: endpoint.includes("toncenter.com")
      ? process.env.TONCENTER_API_KEY || undefined
      : undefined,
  });
  const key = await mnemonicToPrivateKey(mnemonic.split(/\s+/));
  const wallet = WalletContractV5R1.create({
    publicKey: key.publicKey,
    walletId: { networkGlobalId: TESTNET_GLOBAL_ID },
  });
  const w = client.open(wallet);

  await sleep(2000);
  const seqno = await w.getSeqno();
  console.log("Owner:", wallet.address.toString(), "seqno", seqno);

  const body = beginCell()
    .store(
      storeForceOpenClaimWindow({
        $$type: "ForceOpenClaimWindow",
        queryId: BigInt(Date.now() % 1_000_000),
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
        value: toNano("0.05"),
        bounce: true,
        body,
      }),
    ],
  });
  const ext = external({ to: wallet.address, body: transfer });
  await client.sendFile(beginCell().store(storeMessage(ext)).endCell().toBoc());
  console.log("ForceOpenClaimWindow submitted");

  for (let i = 0; i < 40; i++) {
    await sleep(2500);
    try {
      if ((await w.getSeqno()) > seqno) break;
    } catch {
      /* 429 */
    }
  }
  await sleep(4000);
  const after = await tonapiClaim(dep.minter);
  console.log("Claim after:", after);
  if (!after.open) throw new Error("Claim window still closed");
  console.log("PASS: claim window open, snapshot", after.snapshot, "TON");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
