/**
 * Sync jetton wallet config from minter (PushWalletConfig).
 * Use after EnableTrading when DeDust vault wallet still has isTradingEnabled=false.
 *
 * Run: npm run ops:push-wallet-config:mainnet
 * Optional owner sync: PUSH_OWNER=1 (default: vault + owner)
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
} from "../build/AwanToken_AwanToken";
import { AwanWallet } from "../build/AwanToken_AwanWallet";

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
  maxAttempts = 8,
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

type DeployJson = {
  minter?: string;
  dedustAwnVault?: string;
  dexPool?: string;
  poolJettonWallet?: string;
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
  const skipOwner = process.env.PUSH_OWNER === "0";

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

  await sleep(RPC_GAP_MS);
  const balance = await withRetry("getBalance", () =>
    walletContract.getBalance(),
  );
  console.log("Balance:", fromNano(balance), "TON");
  const needed = skipOwner ? toNano("0.12") : toNano("0.22");
  if (balance < needed) {
    throw new Error(`Need ≥ ${fromNano(needed)} TON for PushWalletConfig`);
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
  const trading = await withRetry("getGetTradingState", () =>
    minter.getGetTradingState(),
  );
  console.log("Minter trading:", {
    isTradingEnabled: trading.isTradingEnabled,
    isSellEnabled: trading.isSellEnabled,
    dexPool: trading.dexPool?.toString() ?? null,
  });
  if (!trading.isTradingEnabled) {
    console.warn("Warning: minter isTradingEnabled is false");
  }

  const vaultJettonWallet = await withRetry("getGetWalletAddress(vault)", () =>
    minter.getGetWalletAddress(vault),
  );
  console.log("Vault jetton wallet:", vaultJettonWallet.toString());

  async function readWalletConfig(label: string) {
    await sleep(RPC_GAP_MS);
    const jw = client.open(AwanWallet.fromAddress(vaultJettonWallet));
    try {
      const cfg = await withRetry(`getGetConfig(${label})`, () =>
        jw.getGetConfig(),
      );
      return cfg;
    } catch (e) {
      console.warn(`${label}: get_config failed (wallet may be undeployed):`, e);
      return null;
    }
  }

  const preCfg = await readWalletConfig("pre");
  if (preCfg) {
    console.log("Vault wallet config (before):", {
      isTradingEnabled: preCfg.isTradingEnabled,
      isSellEnabled: preCfg.isSellEnabled,
    });
  }

  let queryId = 20n;

  const pushVaultBody = beginCell()
    .store(
      storePushWalletConfig({
        $$type: "PushWalletConfig",
        queryId,
        walletOwner: vault,
      }),
    )
    .endCell();
  console.log("\n--- PushWalletConfig(vault) ---");
  await sendOwnerTx(minterAddr, toNano("0.1"), pushVaultBody, "PushWalletConfig(vault)");
  queryId += 1n;

  if (!skipOwner) {
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
  }

  console.log("\n--- Waiting for SyncWalletConfig on-chain ---");
  await sleep(8000);

  let postCfg = await readWalletConfig("post-1");
  for (let attempt = 2; attempt <= 8 && postCfg && !postCfg.isTradingEnabled; attempt++) {
    await sleep(5000);
    postCfg = await readWalletConfig(`post-${attempt}`);
  }

  if (postCfg) {
    console.log("Vault wallet config (after):", {
      isTradingEnabled: postCfg.isTradingEnabled,
      isSellEnabled: postCfg.isSellEnabled,
      isDexLimitsEnabled: postCfg.isDexLimitsEnabled,
    });
    if (!postCfg.isTradingEnabled) {
      console.error(
        "FAIL: vault jetton wallet still has isTradingEnabled=false",
      );
      process.exitCode = 1;
    } else {
      console.log("OK: vault jetton wallet isTradingEnabled=true");
    }
  } else {
    console.warn(
      "Could not verify get_config — check tonviewer:",
      `${EXPLORER}/${vaultJettonWallet.toString()}`,
    );
  }

  const outPath = join(process.cwd(), "deployments", "mainnet.json");
  const existing = loadDeploy();
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        ...existing,
        poolJettonWallet: vaultJettonWallet.toString(),
        walletConfigSyncAt: new Date().toISOString(),
        tradingFlags: {
          ...(typeof existing.tradingFlags === "object" && existing.tradingFlags
            ? existing.tradingFlags
            : {}),
          isTradingEnabled: trading.isTradingEnabled,
          isSellEnabled: trading.isSellEnabled,
          isDexLimitsEnabled: trading.isDexLimitsEnabled,
          dexPool: trading.dexPool?.toString() ?? vault.toString(),
          walletConfigSyncRequired: postCfg ? !postCfg.isTradingEnabled : false,
          vaultWalletIsTradingEnabled: postCfg?.isTradingEnabled ?? null,
          verifiedAt: new Date().toISOString(),
          note: postCfg?.isTradingEnabled
            ? "PushWalletConfig(vault): vault jetton wallet synced; DEX GRAM→AWN buys should deliver."
            : "PushWalletConfig sent — re-check vault get_config on explorer if not verified.",
        },
        launchFlags: {
          ...(typeof existing.launchFlags === "object" && existing.launchFlags
            ? existing.launchFlags
            : {}),
          trading: trading.isTradingEnabled,
          sells: trading.isSellEnabled,
          note: "EnableTrading ON. Vault wallet config pushed for DeDust delivery.",
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
