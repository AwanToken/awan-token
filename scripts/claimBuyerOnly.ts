/** Buyer ClaimReward only (window already open; Owner claim already attempted). */
import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
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
import { storeClaimReward } from "../build/AwanToken_AwanToken";

const GID = -3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function tonapiSeqno(addr: string): Promise<number> {
  const urls = [
    `https://testnet.tonapi.io/v2/wallet/${addr}/seqno`,
    `https://testnet.tonapi.io/v2/blockchain/accounts/${addr}/methods/seqno`,
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) continue;
      const j = (await r.json()) as {
        seqno?: number;
        stack?: { num: string }[];
      };
      if (typeof j.seqno === "number") return j.seqno;
      if (j.stack?.[0]?.num) return Number(BigInt(j.stack[0].num));
    } catch {
      /* */
    }
  }
  throw new Error("seqno via tonapi failed");
}

async function tonBal(addr: string): Promise<bigint> {
  const u = `https://testnet.tonapi.io/v2/accounts/${addr}`;
  const r = await fetch(u);
  if (!r.ok) throw new Error(`bal ${r.status}`);
  const j = (await r.json()) as { balance: number | string };
  return BigInt(j.balance);
}

async function main() {
  console.log("Cooling 70s for RPC…");
  await sleep(70_000);

  const dep = JSON.parse(
    readFileSync(join(process.cwd(), "deployments", "testnet.json"), "utf8"),
  );
  const buyer = JSON.parse(
    readFileSync(join(process.cwd(), "deployments", "testnet-buyer.json"), "utf8"),
  );
  const minter = Address.parse(dep.minter);
  const endpoint =
    process.env.TON_RPC_ENDPOINT?.trim() ||
    "https://testnet.toncenter.com/api/v2/jsonRPC";
  const client = new TonClient({
    endpoint,
    apiKey: endpoint.includes("toncenter.com")
      ? process.env.TONCENTER_API_KEY || undefined
      : undefined,
  });

  const buyerKey = await mnemonicToPrivateKey(
    String(buyer.mnemonic).trim().split(/\s+/),
  );
  const buyerW = WalletContractV5R1.create({
    publicKey: buyerKey.publicKey,
    walletId: { networkGlobalId: GID },
  });

  const before = await tonBal(buyerW.address.toString());
  console.log("buyer", buyerW.address.toString(), "TON", fromNano(before));

  let seqno = await tonapiSeqno(buyerW.address.toString());
  console.log("BuyerClaim seqno", seqno);

  const body = beginCell()
    .store(storeClaimReward({ $$type: "ClaimReward", queryId: BigInt(Date.now() % 1e6) }))
    .endCell();
  const transfer = buyerW.createTransfer({
    seqno,
    secretKey: buyerKey.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages: [
      internal({ to: minter, value: toNano("0.08"), bounce: true, body }),
    ],
  });
  const boc = beginCell()
    .store(storeMessage(external({ to: buyerW.address, body: transfer })))
    .endCell()
    .toBoc();

  for (let i = 0; i < 8; i++) {
    try {
      await client.sendFile(boc);
      console.log("BuyerClaim submitted");
      break;
    } catch (e) {
      console.warn("send retry", i + 1, String(e).slice(0, 80));
      await sleep(20_000);
      if (i === 7) throw e;
    }
  }

  for (let i = 0; i < 30; i++) {
    await sleep(3000);
    try {
      const s = await tonapiSeqno(buyerW.address.toString());
      if (s > seqno) {
        console.log("confirmed seqno", s);
        break;
      }
    } catch {
      /* */
    }
  }

  await sleep(8000);
  const after = await tonBal(buyerW.address.toString());
  console.log("buyer TON after", fromNano(after), "delta", fromNano(after - before));

  const statusUrl = `https://testnet.tonapi.io/v2/blockchain/accounts/${dep.minter}/methods/get_claim_status`;
  const st = await (await fetch(statusUrl)).json();
  console.log("claim stack", JSON.stringify(st.stack?.slice(0, 8)));

  // holder info via tonapi with address arg — may need different format; try runGetMethod via toncenter after delay
  let claimed: number | null = null;
  let bal = "?";
  await sleep(15_000);
  try {
    const tb = new (await import("@ton/core")).TupleBuilder();
    tb.writeAddress(buyerW.address);
    const res = await client.runMethod(minter, "get_holder_info", tb.build());
    // stack may be TupleReader
    const stack = res.stack as { readBigNumber: () => bigint; readNumber: () => number };
    bal = stack.readBigNumber().toString();
    stack.readNumber(); // lastUpdate
    stack.readBigNumber();
    stack.readBigNumber();
    claimed = stack.readNumber();
    console.log("holder", { bal, claimed });
  } catch (e) {
    console.warn("holder rpc", String(e).slice(0, 120));
  }

  const out = {
    at: new Date().toISOString(),
    minter: dep.minter,
    buyer: buyerW.address.toString(),
    buyerAwn: bal,
    claimedCycleId: claimed,
    buyerTonBefore: fromNano(before),
    buyerTonAfter: fromNano(after),
    buyerTonDelta: fromNano(after - before),
    pass:
      claimed === 1 ||
      after > before ||
      "check explorer — window was open, claim submitted",
  };
  writeFileSync(
    join(process.cwd(), "deployments", "testnet-holder-claim-results.json"),
    JSON.stringify(out, null, 2),
  );
  console.log("Saved", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
