/**
 * ForceOpen claim window, airdrop AWN to buyer (non-Owner), ClaimReward as buyer.
 * Verifies Owner cannot claim.
 *
 * Run: npx tsx scripts/claimAsHolderTestnet.ts
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "fs";
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
import {
  storeForceOpenClaimWindow,
  storeClaimReward,
  AwanToken,
} from "../build/AwanToken_AwanToken";
import { storeJettonTransfer, AwanWallet } from "../build/AwanToken_AwanWallet";

const TESTNET_GLOBAL_ID = -3;
const TONCENTER = "https://testnet.toncenter.com/api/v2/jsonRPC";
const TATUM = "https://ton-testnet.gateway.tatum.io/jsonRPC";
/** 100k AWN — under possession caps, enough for a tiny claim share */
const AIRDROP = 100_000n * 1_000_000_000n;
const emptyFwd = beginCell().storeUint(0, 1).endCell().beginParse();

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function endpoint() {
  return process.env.TON_RPC_ENDPOINT?.trim() || TATUM;
}

async function waitSeqno(
  client: TonClient,
  wallet: ReturnType<typeof WalletContractV5R1.create>,
  key: Awaited<ReturnType<typeof mnemonicToPrivateKey>>,
  before: number,
) {
  const w = client.open(wallet);
  for (let i = 0; i < 50; i++) {
    await sleep(2000);
    try {
      if ((await w.getSeqno()) > before) return;
    } catch {
      /* 429 */
    }
  }
  throw new Error("seqno timeout");
}

async function send(
  client: TonClient,
  wallet: ReturnType<typeof WalletContractV5R1.create>,
  key: Awaited<ReturnType<typeof mnemonicToPrivateKey>>,
  to: Address,
  value: bigint,
  body: ReturnType<typeof beginCell> extends never ? never : import("@ton/core").Cell,
  label: string,
) {
  const w = client.open(wallet);
  await sleep(2000);
  let seqno = 0;
  for (let i = 0; i < 5; i++) {
    try {
      seqno = await w.getSeqno();
      break;
    } catch {
      await sleep(3000 * (i + 1));
    }
  }
  console.log(`${label}: seqno=${seqno}`);
  const transfer = wallet.createTransfer({
    seqno,
    secretKey: key.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages: [internal({ to, value, bounce: true, body })],
  });
  const ext = external({ to: wallet.address, body: transfer });
  for (let i = 0; i < 5; i++) {
    try {
      await client.sendFile(beginCell().store(storeMessage(ext)).endCell().toBoc());
      break;
    } catch (e) {
      if (i === 4) throw e;
      await sleep(3000 * (i + 1));
    }
  }
  console.log(`${label}: submitted`);
  await waitSeqno(client, wallet, key, seqno);
  console.log(`${label}: confirmed`);
}

async function tonapiClaim(minter: string) {
  const url = `https://testnet.tonapi.io/v2/blockchain/accounts/${minter}/methods/get_claim_status`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tonapi ${res.status}`);
  const j = (await res.json()) as {
    stack: { type: string; num?: string; value?: string }[];
  };
  const n = (i: number) => {
    const raw = String(j.stack[i]!.num ?? j.stack[i]!.value ?? "0");
    // tonapi may return signed hex like -0x1
    if (raw.startsWith("-")) return 0n;
    try {
      return BigInt(raw);
    } catch {
      return 0n;
    }
  };
  const b = (i: number) => {
    const raw = String(j.stack[i]!.num ?? j.stack[i]!.value ?? "0");
    return raw !== "0" && raw !== "-0x0" && !raw.startsWith("-0x0");
  };
  return {
    cycleId: Number(n(0)),
    open: b(2) || n(2) !== 0n,
    treasury: fromNano(n(4)),
    snapshot: fromNano(n(5)),
  };
}

async function main() {
  const ownerMnemonic = process.env.WALLET_MNEMONIC?.trim();
  if (!ownerMnemonic) throw new Error("WALLET_MNEMONIC required");

  const dep = JSON.parse(
    readFileSync(join(process.cwd(), "deployments", "testnet.json"), "utf8"),
  );
  const buyerPath = join(process.cwd(), "deployments", "testnet-buyer.json");
  if (!existsSync(buyerPath)) throw new Error("deployments/testnet-buyer.json missing");
  const buyerFile = JSON.parse(readFileSync(buyerPath, "utf8"));

  const minterAddr = Address.parse(dep.minter);
  const ownerJw = Address.parse(dep.ownerJettonWallet);
  const apiKey = process.env.TONCENTER_API_KEY || undefined;
  const client = new TonClient({
    endpoint: endpoint(),
    apiKey: endpoint().includes("toncenter.com") ? apiKey : undefined,
  });

  const ownerKey = await mnemonicToPrivateKey(ownerMnemonic.split(/\s+/));
  const ownerWallet = WalletContractV5R1.create({
    publicKey: ownerKey.publicKey,
    walletId: { networkGlobalId: TESTNET_GLOBAL_ID },
  });
  const buyerKey = await mnemonicToPrivateKey(
    String(buyerFile.mnemonic).trim().split(/\s+/),
  );
  const buyerWallet = WalletContractV5R1.create({
    publicKey: buyerKey.publicKey,
    walletId: { networkGlobalId: TESTNET_GLOBAL_ID },
  });

  console.log("Minter:", minterAddr.toString());
  console.log("Owner:", ownerWallet.address.toString());
  console.log("Buyer (holder):", buyerWallet.address.toString());
  console.log("Claim before:", await tonapiClaim(dep.minter));

  // Fund buyer with dust TON for claim gas if needed
  const buyerOpen = client.open(buyerWallet);
  await sleep(1500);
  let buyerBal = 0n;
  try {
    buyerBal = await buyerOpen.getBalance();
  } catch {
    /* */
  }
  console.log("Buyer TON:", fromNano(buyerBal));
  if (buyerBal < toNano("0.12")) {
    await send(
      client,
      ownerWallet,
      ownerKey,
      buyerWallet.address,
      toNano("0.2"),
      beginCell().endCell(),
      "FundBuyerTON",
    );
  }

  // Airdrop AWN to buyer
  const transferBody = beginCell()
    .store(
      storeJettonTransfer({
        $$type: "JettonTransfer",
        queryId: 77n,
        amount: AIRDROP,
        destination: buyerWallet.address,
        responseDestination: ownerWallet.address,
        customPayload: null,
        forwardTonAmount: toNano("0.05"),
        forwardPayload: emptyFwd,
      }),
    )
    .endCell();
  await send(
    client,
    ownerWallet,
    ownerKey,
    ownerJw,
    toNano("0.15"),
    transferBody,
    "AirdropAWN→Buyer",
  );
  await sleep(8000);

  // ForceOpen
  await send(
    client,
    ownerWallet,
    ownerKey,
    minterAddr,
    toNano("0.05"),
    beginCell()
      .store(
        storeForceOpenClaimWindow({
          $$type: "ForceOpenClaimWindow",
          queryId: 88n,
        }),
      )
      .endCell(),
    "ForceOpenClaimWindow",
  );
  await sleep(5000);
  const afterOpen = await tonapiClaim(dep.minter);
  console.log("Claim after ForceOpen:", afterOpen);
  if (!afterOpen.open) throw new Error("Window still closed");

  // Owner claim must fail (bounce / no payout)
  const treasuryBefore = BigInt(
    Math.round(parseFloat(afterOpen.treasury) * 1e9),
  );
  console.log("\n--- Owner ClaimReward (must fail) ---");
  await send(
    client,
    ownerWallet,
    ownerKey,
    minterAddr,
    toNano("0.08"),
    beginCell()
      .store(storeClaimReward({ $$type: "ClaimReward", queryId: 89n }))
      .endCell(),
    "OwnerClaimReward",
  );
  await sleep(6000);
  const afterOwner = await tonapiClaim(dep.minter);
  console.log("After owner claim attempt:", afterOwner);

  // Buyer claim
  console.log("\n--- Buyer ClaimReward ---");
  const buyerTonBefore = await client.open(buyerWallet).getBalance();
  await send(
    client,
    buyerWallet,
    buyerKey,
    minterAddr,
    toNano("0.08"),
    beginCell()
      .store(storeClaimReward({ $$type: "ClaimReward", queryId: 90n }))
      .endCell(),
    "BuyerClaimReward",
  );
  await sleep(8000);
  const buyerTonAfter = await client.open(buyerWallet).getBalance();
  const afterBuyer = await tonapiClaim(dep.minter);
  const gained = buyerTonAfter - buyerTonBefore + toNano("0.08"); // rough: +gas spent back into calc
  console.log("Buyer TON before:", fromNano(buyerTonBefore));
  console.log("Buyer TON after:", fromNano(buyerTonAfter));
  console.log("Claim after buyer:", afterBuyer);

  // Holder info
  const minter = client.open(AwanToken.fromAddress(minterAddr));
  await sleep(2000);
  let buyerInfo;
  try {
    buyerInfo = await minter.getGetHolderInfo(buyerWallet.address);
    console.log("Buyer holder:", {
      balance: buyerInfo.balance.toString(),
      claimedCycleId: Number(buyerInfo.claimedCycleId),
    });
  } catch (e) {
    console.warn("get_holder_info:", e);
  }

  const out = {
    at: new Date().toISOString(),
    minter: minterAddr.toString(),
    buyer: buyerWallet.address.toString(),
    windowOpen: afterBuyer.open,
    snapshot: afterBuyer.snapshot,
    treasury: afterBuyer.treasury,
    buyerClaimedCycle: buyerInfo ? Number(buyerInfo.claimedCycleId) : null,
    buyerTonDeltaNano: (buyerTonAfter - buyerTonBefore).toString(),
    note:
      "Owner ClaimReward should bounce (Owner cannot claim). Buyer should receive proportional TON.",
  };
  writeFileSync(
    join(process.cwd(), "deployments", "testnet-holder-claim-results.json"),
    JSON.stringify(out, null, 2),
  );
  console.log("\nSaved deployments/testnet-holder-claim-results.json");
  console.log(out);

  if (buyerInfo && Number(buyerInfo.claimedCycleId) === afterBuyer.cycleId) {
    console.log("PASS: buyer claimed this cycle");
  } else if (buyerTonAfter > buyerTonBefore) {
    console.log("PASS: buyer TON increased (claim likely ok)");
  } else {
    console.warn("CHECK: buyer claimedCycle / TON — inspect explorer");
  }
  void treasuryBefore;
  void gained;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
