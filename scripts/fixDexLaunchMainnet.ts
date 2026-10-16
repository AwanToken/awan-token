/**
 * Mainnet launch fix: zero sell tax, raise DEX buy/sell limits, PushWalletConfig.
 *
 * Run: npm run ops:fix-dex-launch:mainnet
 * Env: BUY_LIMIT_BP / SELL_LIMIT_BP (default 300 = 3% of pool)
 *
 * DeDust note: buy limit is enforced on vault JW outbound AFTER the AMM swap.
 * Over-limit buys strand TON in pool reserves (bounce 10374, no auto refund).
 * Prefer BUY_LIMIT_BP=1500 (15%)+ while users trade on external DeDust.fi UI.
 * Buy and sell bp are separate; isDexLimitsEnabled gates both.
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
  storeSetBuyLimitBp,
  storeSetSellLimitBp,
  storeSetSellTaxBp,
} from "../build/AwanToken_AwanToken";
import { AwanWallet } from "../build/AwanToken_AwanWallet";

const DEFAULT_MAINNET_ENDPOINT = "https://toncenter.com/api/v2/jsonRPC";
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

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxAttempts = 8,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRateLimitError(err) || attempt === maxAttempts) throw err;
      const backoff = Math.min(60_000, 4000 * 2 ** (attempt - 1));
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

type DeployJson = {
  minter?: string;
  dedustAwnVault?: string;
  dexPool?: string;
  [key: string]: unknown;
};

function loadDeploy(): DeployJson {
  const path = join(process.cwd(), "deployments", "mainnet.json");
  if (!existsSync(path)) throw new Error("deployments/mainnet.json missing");
  return JSON.parse(readFileSync(path, "utf8"));
}

function vaultAddress(deploy: DeployJson): Address {
  const raw =
    process.env.VAULT_ADDRESS?.trim() ||
    deploy.dedustAwnVault?.trim() ||
    deploy.dexPool?.trim();
  if (!raw) throw new Error("Set VAULT_ADDRESS or dedustAwnVault in mainnet.json");
  return Address.parse(raw);
}

async function main() {
  const deploy = loadDeploy();
  const vault = vaultAddress(deploy);
  const minterAddr = Address.parse(
    process.env.MINTER_ADDRESS?.trim() || deploy.minter!,
  );
  const buyLimitBp = Number(process.env.BUY_LIMIT_BP?.trim() || "300");
  const sellLimitBp = Number(process.env.SELL_LIMIT_BP?.trim() || "300");
  if (buyLimitBp <= 0 || buyLimitBp > 10_000) {
    throw new Error("BUY_LIMIT_BP must be 1..10000");
  }
  if (sellLimitBp <= 0 || sellLimitBp > 10_000) {
    throw new Error("SELL_LIMIT_BP must be 1..10000");
  }

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

  console.log("Owner:", owner.toString());
  console.log("Minter:", minterAddr.toString());
  console.log("Vault (walletOwner):", vault.toString());
  console.log("Target limits bp:", { buyLimitBp, sellLimitBp, sellTaxBp: 0 });

  await sleep(RPC_GAP_MS);
  const balance = await withRetry("getBalance", () =>
    walletContract.getBalance(),
  );
  console.log("Balance:", fromNano(balance), "TON");
  if (balance < toNano("0.55")) {
    throw new Error("Need ≥ ~0.55 TON for admin txs");
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
    for (let i = 0; i < 50; i++) {
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

  const minter = client.open(AwanToken.fromAddress(minterAddr));
  const pre = await withRetry("getGetTradingState", () =>
    minter.getGetTradingState(),
  );
  console.log("Minter state (before):", {
    isTradingEnabled: pre.isTradingEnabled,
    isSellEnabled: pre.isSellEnabled,
    isDexLimitsEnabled: pre.isDexLimitsEnabled,
    maxBuyLimitBp: pre.maxBuyLimitBp,
    maxSellLimitBp: pre.maxSellLimitBp,
    sellTaxBp: pre.sellTaxBp,
  });
  if (pre.isSellEnabled) {
    console.warn("Note: isSellEnabled is already true — not changing.");
  }

  let queryId = BigInt(Date.now() % 1_000_000_000);

  const taxBody = beginCell()
    .store(
      storeSetSellTaxBp({
        $$type: "SetSellTaxBp",
        queryId,
        sellTaxBp: 0n,
      }),
    )
    .endCell();
  queryId += 1n;
  console.log("\n--- SetSellTaxBp(0) ---");
  await sendOwnerTx(minterAddr, toNano("0.05"), taxBody, "SetSellTaxBp(0)");

  const buyBody = beginCell()
    .store(
      storeSetBuyLimitBp({
        $$type: "SetBuyLimitBp",
        queryId,
        maxBuyLimitBp: BigInt(buyLimitBp),
      }),
    )
    .endCell();
  queryId += 1n;
  console.log("\n--- SetBuyLimitBp ---");
  await sendOwnerTx(
    minterAddr,
    toNano("0.05"),
    buyBody,
    `SetBuyLimitBp(${buyLimitBp})`,
  );

  const sellBody = beginCell()
    .store(
      storeSetSellLimitBp({
        $$type: "SetSellLimitBp",
        queryId,
        maxSellLimitBp: BigInt(sellLimitBp),
      }),
    )
    .endCell();
  queryId += 1n;
  console.log("\n--- SetSellLimitBp ---");
  await sendOwnerTx(
    minterAddr,
    toNano("0.05"),
    sellBody,
    `SetSellLimitBp(${sellLimitBp})`,
  );

  const pushVaultBody = beginCell()
    .store(
      storePushWalletConfig({
        $$type: "PushWalletConfig",
        queryId,
        walletOwner: vault,
      }),
    )
    .endCell();
  queryId += 1n;
  console.log("\n--- PushWalletConfig(vault) ---");
  await sendOwnerTx(
    minterAddr,
    toNano("0.1"),
    pushVaultBody,
    "PushWalletConfig(vault)",
  );

  const pushOwnerBody = beginCell()
    .store(
      storePushWalletConfig({
        $$type: "PushWalletConfig",
        queryId,
        walletOwner: owner,
      }),
    )
    .endCell();
  console.log("\n--- PushWalletConfig(owner) ---");
  await sendOwnerTx(
    minterAddr,
    toNano("0.08"),
    pushOwnerBody,
    "PushWalletConfig(owner)",
  );

  await sleep(8000);
  const post = await withRetry("getGetTradingState(after)", () =>
    minter.getGetTradingState(),
  );
  console.log("Minter state (after):", {
    isTradingEnabled: post.isTradingEnabled,
    isSellEnabled: post.isSellEnabled,
    isDexLimitsEnabled: post.isDexLimitsEnabled,
    maxBuyLimitBp: post.maxBuyLimitBp,
    maxSellLimitBp: post.maxSellLimitBp,
    sellTaxBp: post.sellTaxBp,
  });

  const vaultJettonWallet = await withRetry("getGetWalletAddress(vault)", () =>
    minter.getGetWalletAddress(vault),
  );
  const jw = client.open(AwanWallet.fromAddress(vaultJettonWallet));
  let vaultCfg: Awaited<ReturnType<typeof jw.getGetConfig>> | null = null;
  try {
    vaultCfg = await withRetry("vault get_config", () => jw.getGetConfig());
    console.log("Vault jetton wallet config:", {
      maxBuyLimitBp: vaultCfg.maxBuyLimitBp,
      maxSellLimitBp: vaultCfg.maxSellLimitBp,
      sellTaxBp: vaultCfg.sellTaxBp,
      isTradingEnabled: vaultCfg.isTradingEnabled,
    });
  } catch (e) {
    console.warn("Could not read vault wallet config:", e);
  }

  const outPath = join(process.cwd(), "deployments", "mainnet.json");
  const existing = loadDeploy();
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        ...existing,
        poolJettonWallet: vaultJettonWallet.toString(),
        dexLimitsFixAt: new Date().toISOString(),
        dexLimits: {
          maxBuyLimitBp: Number(post.maxBuyLimitBp),
          maxSellLimitBp: Number(post.maxSellLimitBp),
          sellTaxBp: Number(post.sellTaxBp),
          isDexLimitsEnabled: post.isDexLimitsEnabled,
          vaultWalletSynced: vaultCfg
            ? Number(vaultCfg.maxBuyLimitBp) === Number(post.maxBuyLimitBp)
            : null,
        },
        tradingFlags: {
          ...(typeof existing.tradingFlags === "object" && existing.tradingFlags
            ? existing.tradingFlags
            : {}),
          isTradingEnabled: post.isTradingEnabled,
          isSellEnabled: post.isSellEnabled,
          isDexLimitsEnabled: post.isDexLimitsEnabled,
          maxBuyLimitBp: Number(post.maxBuyLimitBp),
          maxSellLimitBp: Number(post.maxSellLimitBp),
          sellTaxBp: Number(post.sellTaxBp),
          dexPool: post.dexPool?.toString() ?? vault.toString(),
          walletConfigSyncRequired: false,
          vaultWalletIsTradingEnabled: vaultCfg?.isTradingEnabled ?? null,
          verifiedAt: new Date().toISOString(),
          note: `Sell tax 0; buy/sell limits ${post.maxBuyLimitBp}/${post.maxSellLimitBp} bp. PushWalletConfig vault+owner.`,
        },
        launchFlags: {
          ...(typeof existing.launchFlags === "object" && existing.launchFlags
            ? existing.launchFlags
            : {}),
          trading: post.isTradingEnabled,
          sells: post.isSellEnabled,
          note: "DEX limits raised; sell tax removed. Sells still gated by isSellEnabled.",
        },
      },
      null,
      2,
    ),
  );
  console.log("Saved:", outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
