/** Owner: ForceCloseClaimWindow on current testnet minter. */
import "dotenv/config";
import { readFileSync } from "fs";
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
import { storeForceCloseClaimWindow } from "../build/AwanToken_AwanToken";

const GID = -3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const dep = JSON.parse(
    readFileSync(join(process.cwd(), "deployments", "testnet.json"), "utf8"),
  );
  const minter = Address.parse(dep.minter);
  const endpoint =
    process.env.TON_RPC_ENDPOINT?.trim() ||
    "https://ton-testnet.gateway.tatum.io/jsonRPC";
  const client = new TonClient({
    endpoint,
    apiKey: endpoint.includes("toncenter.com")
      ? process.env.TONCENTER_API_KEY || undefined
      : undefined,
  });
  const key = await mnemonicToPrivateKey(
    process.env.WALLET_MNEMONIC!.trim().split(/\s+/),
  );
  const wallet = WalletContractV5R1.create({
    publicKey: key.publicKey,
    walletId: { networkGlobalId: GID },
  });
  const w = client.open(wallet);

  console.log("Cooling 20s…");
  await sleep(20_000);
  const seqno = await w.getSeqno();
  console.log("ForceClose", dep.minter, "seqno", seqno);

  const body = beginCell()
    .store(
      storeForceCloseClaimWindow({
        $$type: "ForceCloseClaimWindow",
        queryId: BigInt(Date.now() % 1e6),
      }),
    )
    .endCell();
  const transfer = wallet.createTransfer({
    seqno,
    secretKey: key.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages: [
      internal({ to: minter, value: toNano("0.05"), bounce: true, body }),
    ],
  });
  const boc = beginCell()
    .store(storeMessage(external({ to: wallet.address, body: transfer })))
    .endCell()
    .toBoc();

  for (let i = 0; i < 6; i++) {
    try {
      await client.sendFile(boc);
      console.log("submitted");
      break;
    } catch (e) {
      console.warn("retry", i + 1, String(e).slice(0, 60));
      await sleep(15_000);
      if (i === 5) throw e;
    }
  }

  await sleep(10_000);
  const st = await (
    await fetch(
      `https://testnet.tonapi.io/v2/blockchain/accounts/${dep.minter}/methods/get_claim_status`,
    )
  ).json();
  // stack[2] open: -0x1 = true, 0 = false
  const openRaw = String(st.stack?.[2]?.num ?? "");
  const open = openRaw === "-0x1" || openRaw === "0x1";
  const activeRaw = String(st.stack?.[7]?.num ?? "");
  const active = activeRaw === "-0x1" || activeRaw === "0x1";
  console.log({ open, active, stack: st.stack?.slice(0, 8) });
  if (open) throw new Error("window still open");
  console.log("PASS: claim window closed (program may still be armed until Claim OFF redeploy)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
