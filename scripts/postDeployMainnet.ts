/**
 * Post-deploy mainnet: PushWalletConfig → (optional) EnableTrading.
 * Launch: SKIP_ENABLE_TRADING=1 so market stays closed.
 *
 * Run: SKIP_ENABLE_TRADING=1 npm run ops:postdeploy:mainnet
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import {
  Address,
  Cell,
  toNano,
  fromNano,
  beginCell,
  internal,
  external,
  storeMessage,
  SendMode,
} from "@ton/core";
import { TonClient, WalletContractV5R1 } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import {
  AwanToken,
  storePushWalletConfig,
  storeEnableTrading,
} from "../build/AwanToken_AwanToken";

const DEFAULT_MAINNET_ENDPOINT = "https://toncenter.com/api/v2/jsonRPC";
const EXPLORER = "https://tonviewer.com";
const MAINNET_GLOBAL_ID = -239;
const RPC_GAP_MS = 2000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function resolveEndpoint(): string {
  const raw =
    process.env.TON_RPC_ENDPOINT_MAINNET?.trim() ||
    process.env.TON_API_ENDPOINT?.trim() ||
    process.env.TON_RPC_ENDPOINT?.trim() ||
    DEFAULT_MAINNET_ENDPOINT;
  if (/testnet/i.test(raw)) return DEFAULT_MAINNET_ENDPOINT;
  return raw;
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status =
    err && typeof err === "object" && "response" in err
      ? (err as { response?: { status?: number } }).response?.status
      : undefined;
  return (
    status === 429 ||
    msg.includes("429") ||
    /rate.?limit/i.test(msg) ||
    /too many requests/i.test(msg)
  );
}

function retryAfterMs(err: unknown): number {
  const headers =
    err && typeof err === "object" && "response" in err
      ? (err as { response?: { headers?: Record<string, string> } }).response
          ?.headers
      : undefined;
  const ra = headers?.["retry-after"] ?? headers?.["Retry-After"];
  if (ra) {
    const sec = Number(ra);
    if (!Number.isNaN(sec) && sec > 0) return Math.min(120_000, sec * 1000);
  }
  return 0;
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxAttempts = 6,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRateLimitError(err) || attempt === maxAttempts) throw err;
      const fromHeader = retryAfterMs(err);
      const backoff =
        fromHeader || Math.min(60_000, 4000 * 2 ** (attempt - 1));
      console.warn(
        `[429] ${label}: retry ${attempt}/${maxAttempts} in ${Math.round(backoff / 1000)}s`,
      );
      await sleep(backoff);
    }
  }
  throw lastErr;
}

function loadMnemonic(): string {
  const mn =
    process.env.WALLET_MNEMONIC_MAINNET?.trim() ||
    process.env.WALLET_MNEMONIC?.trim();
  if (!mn) throw new Error("Set WALLET_MNEMONIC_MAINNET or WALLET_MNEMONIC");
  return mn;
}

function loadMinterAddress(): Address {
  const fromEnv = process.env.MINTER_ADDRESS?.trim();
  if (fromEnv) return Address.parse(fromEnv);
  const path = join(process.cwd(), "deployments", "mainnet.json");
  if (!existsSync(path)) {
    throw new Error(
      "Set MINTER_ADDRESS or run deploy first (deployments/mainnet.json)",
    );
  }
  const json = JSON.parse(readFileSync(path, "utf8"));
  if (!json.minter) throw new Error("deployments/mainnet.json missing minter");
  return Address.parse(json.minter);
}

async function main() {
  const words = loadMnemonic().split(/\s+/);
  if (words.length < 12) throw new Error("Mnemonic looks invalid");

  const endpoint = resolveEndpoint();
  console.log("NETWORK: mainnet");
  console.log("RPC:", endpoint);
  const client = new TonClient({
    endpoint,
    apiKey: endpoint.includes("toncenter.com")
      ? process.env.TONCENTER_API_KEY || undefined
      : undefined,
  });

  const keyPair = await mnemonicToPrivateKey(words);
  const wallet = WalletContractV5R1.create({
    publicKey: keyPair.publicKey,
    walletId: { networkGlobalId: MAINNET_GLOBAL_ID },
  });
  const walletContract = client.open(wallet);
  const owner = walletContract.address;
  const minterAddr = loadMinterAddress();

  console.log("Owner:", owner.toString());
  console.log("Minter:", minterAddr.toString());
  console.log("Explorer:", `${EXPLORER}/${minterAddr.toString()}`);

  await sleep(RPC_GAP_MS);
  const balance = await withRetry("getBalance", () =>
    walletContract.getBalance(),
  );
  console.log("Balance:", fromNano(balance), "TON");
  if (balance < toNano("0.2")) {
    throw new Error("Need ≥ ~0.2 TON for PushWalletConfig (+ EnableTrading)");
  }

  await sleep(RPC_GAP_MS);
  if (!(await withRetry("isDeployed(wallet)", () => client.isContractDeployed(owner)))) {
    throw new Error("Owner wallet is not deployed on-chain");
  }
  await sleep(RPC_GAP_MS);
  if (!(await withRetry("isDeployed(minter)", () => client.isContractDeployed(minterAddr)))) {
    throw new Error(`Minter not deployed: ${minterAddr.toString()}`);
  }

  async function sendOwnerTx(
    to: Address,
    value: bigint,
    body: Cell,
    label: string,
  ) {
    await sleep(RPC_GAP_MS);
    const seqno = await withRetry(`getSeqno(${label})`, () =>
      walletContract.getSeqno(),
    );
    console.log(`${label}: seqno=${seqno}`);
    const transfer = wallet.createTransfer({
      seqno,
      secretKey: keyPair.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      messages: [internal({ to, value, bounce: true, body })],
    });
    const ext = external({ to: owner, body: transfer });
    const boc = beginCell().store(storeMessage(ext)).endCell().toBoc();
    await sleep(RPC_GAP_MS);
    await withRetry(`sendFile(${label})`, () => client.sendFile(boc));
    console.log(`${label}: submitted`);
    for (let i = 0; i < 40; i++) {
      await sleep(2500);
      try {
        const next = await walletContract.getSeqno();
        if (next > seqno) {
          console.log(`${label}: confirmed (seqno ${next})`);
          return;
        }
      } catch (err) {
        if (isRateLimitError(err)) await sleep(5000);
      }
      process.stdout.write(".");
    }
    console.log("");
    console.warn(`${label}: seqno not bumped yet — check explorer`);
  }

  await sleep(RPC_GAP_MS);
  const openedPre = client.open(AwanToken.fromAddress(minterAddr));
  const preTrading = await withRetry("getGetTradingState(pre)", () =>
    openedPre.getGetTradingState(),
  );
  console.log("Trading before:", {
    isTradingEnabled: preTrading.isTradingEnabled,
    isSellEnabled: preTrading.isSellEnabled,
    isDexLimitsEnabled: preTrading.isDexLimitsEnabled,
  });

  const pushBody = beginCell()
    .store(
      storePushWalletConfig({
        $$type: "PushWalletConfig",
        queryId: 0n,
        walletOwner: owner,
      }),
    )
    .endCell();
  console.log("\n--- PushWalletConfig (~0.08 TON) ---");
  await sendOwnerTx(minterAddr, toNano("0.08"), pushBody, "PushWalletConfig");

  const skipEnable =
    process.env.SKIP_ENABLE_TRADING === "1" ||
    process.env.LAUNCH_CLOSED === "1";
  if (skipEnable) {
    console.log("\n--- SKIP EnableTrading ---");
    console.log("Market stays closed until Owner enables trading later.");
  } else if (preTrading.isTradingEnabled) {
    console.log("Trading already enabled — skipping EnableTrading.");
  } else {
    await sleep(5000);
    const enableBody = beginCell()
      .store(storeEnableTrading({ $$type: "EnableTrading", queryId: 1n }))
      .endCell();
    console.log("\n--- EnableTrading (~0.05 TON) ---");
    await sendOwnerTx(minterAddr, toNano("0.05"), enableBody, "EnableTrading");
  }

  console.log("\n--- On-chain state ---");
  await sleep(RPC_GAP_MS);
  const opened = client.open(AwanToken.fromAddress(minterAddr));
  let trading: Awaited<ReturnType<typeof opened.getGetTradingState>> | null =
    null;
  let ownerJettonWallet: Address | null = null;
  try {
    trading = await withRetry("getGetTradingState", () =>
      opened.getGetTradingState(),
    );
    await sleep(RPC_GAP_MS);
    const jettonData = await withRetry("getGetJettonData", () =>
      opened.getGetJettonData(),
    );
    await sleep(RPC_GAP_MS);
    ownerJettonWallet = await withRetry("getGetWalletAddress", () =>
      opened.getGetWalletAddress(owner),
    );
    console.log("trading:", {
      isTradingEnabled: trading.isTradingEnabled,
      isSellEnabled: trading.isSellEnabled,
      isDexLimitsEnabled: trading.isDexLimitsEnabled,
      dexPool: trading.dexPool ? trading.dexPool.toString() : null,
    });
    console.log("totalSupply:", jettonData.totalSupply.toString());
    console.log("owner jetton wallet:", ownerJettonWallet.toString());
  } catch (e) {
    console.warn("Getters not ready yet:", e);
  }

  const outPath = join(process.cwd(), "deployments", "mainnet.json");
  let existing: Record<string, unknown> = {};
  if (existsSync(outPath)) {
    existing = JSON.parse(readFileSync(outPath, "utf8"));
  }
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        ...existing,
        network: "mainnet",
        minter: minterAddr.toString(),
        owner: owner.toString(),
        postDeployAt: new Date().toISOString(),
        ownerJettonWallet: ownerJettonWallet
          ? ownerJettonWallet.toString()
          : (existing.ownerJettonWallet ?? null),
        explorer: `${EXPLORER}/${minterAddr.toString()}`,
        tradingFlags: trading
          ? {
              isTradingEnabled: trading.isTradingEnabled,
              isSellEnabled: trading.isSellEnabled,
              isDexLimitsEnabled: trading.isDexLimitsEnabled,
              dexPool: trading.dexPool ? trading.dexPool.toString() : null,
            }
          : (existing.tradingFlags ?? null),
      },
      null,
      2,
    ),
  );
  console.log("Saved:", outPath);
  console.log("Done. (sells still OFF — SetSellEnabled later)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
