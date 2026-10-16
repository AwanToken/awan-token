/**
 * Deploy AwanToken to TON **mainnet** + MintInitial (1B → Owner).
 *
 * Launch defaults: trading stays OFF until Owner EnableTrading.
 * Claim OFF, sells OFF.
 *
 * Prerequisites:
 *  1. npm run build
 *  2. .env WALLET_MNEMONIC = **mainnet** Owner (Tonkeeper W5)
 *  3. Owner funded with ≥ ~1 TON (deploy gas). Keep ~50 TON aside for DEX LP later.
 *  4. JETTON_IMAGE=https://awantoken.netlify.app/awn-logo.png
 *
 * Run: npm run deploy:mainnet
 *
 * Then: SKIP_ENABLE_TRADING=1 npm run ops:postdeploy:mainnet
 * Then: npm run setup:pool:mainnet  (seeds 25% AWN — TON LP separately on DEX)
 */
import "dotenv/config";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import {
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
import { AwanToken, storeMintInitial } from "../build/AwanToken_AwanToken";
import {
  buildOnchainMetadata,
  DEFAULT_AWN_METADATA,
} from "../wrappers/jettonMetadata";

const DEFAULT_MAINNET_ENDPOINT = "https://toncenter.com/api/v2/jsonRPC";
const EXPLORER = "https://tonviewer.com";
/** Tonkeeper mainnet W5 */
const MAINNET_GLOBAL_ID = -239;
const RPC_GAP_MS = 2000;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimit(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("429") || /rate.?limit/i.test(msg);
}

async function withRetry<T>(label: string, fn: () => Promise<T>, max = 6): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= max; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!isRateLimit(err) || i === max) throw err;
      const wait = Math.min(60_000, 4000 * 2 ** (i - 1));
      console.warn(`[429] ${label} retry ${i}/${max} in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
  throw last;
}

async function main() {
  if (process.env.CONFIRM_MAINNET !== "1") {
    throw new Error(
      'Refusing mainnet deploy without CONFIRM_MAINNET=1 (and owner phrase «vai mainnet»).',
    );
  }

  const mnemonic =
    process.env.WALLET_MNEMONIC_MAINNET?.trim() ||
    process.env.WALLET_MNEMONIC?.trim();
  if (!mnemonic) {
    throw new Error(
      "Set WALLET_MNEMONIC_MAINNET or WALLET_MNEMONIC in .env (mainnet Owner, 24 words)",
    );
  }
  const words = mnemonic.split(/\s+/);
  if (words.length < 12) {
    throw new Error("WALLET_MNEMONIC looks invalid");
  }

  // Never inherit testnet RPC from .env
  const rawEndpoint =
    process.env.TON_RPC_ENDPOINT_MAINNET?.trim() ||
    process.env.TON_RPC_ENDPOINT?.trim() ||
    DEFAULT_MAINNET_ENDPOINT;
  const endpoint = /testnet/i.test(rawEndpoint)
    ? DEFAULT_MAINNET_ENDPOINT
    : rawEndpoint;
  if (/testnet/i.test(rawEndpoint)) {
    console.warn(
      "Ignoring testnet TON_RPC_ENDPOINT — using mainnet:",
      endpoint,
    );
  }
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

  const balance = await withRetry("getBalance", () =>
    client.getBalance(owner),
  );
  console.log("Deployer:", owner.toString());
  console.log(
    "Deployer (UQ):",
    owner.toString({ bounceable: false, urlSafe: true }),
  );
  console.log("Balance:", fromNano(balance), "TON");
  if (balance < toNano("0.5")) {
    throw new Error(
      `Need ≥ ~0.5 TON on mainnet Owner for deploy (have ${fromNano(balance)}). ` +
        `Fund ${owner.toString({ bounceable: false, urlSafe: true })} — keep ~50 TON aside for DEX LP.`,
    );
  }

  const meta = {
    ...DEFAULT_AWN_METADATA,
    name: process.env.JETTON_NAME || DEFAULT_AWN_METADATA.name,
    symbol: process.env.JETTON_SYMBOL || DEFAULT_AWN_METADATA.symbol,
    description:
      process.env.JETTON_DESCRIPTION || DEFAULT_AWN_METADATA.description,
    image:
      process.env.JETTON_IMAGE?.trim() ||
      "https://awantoken.netlify.app/awn-logo.png",
    decimals: process.env.JETTON_DECIMALS || DEFAULT_AWN_METADATA.decimals,
  };
  const content = buildOnchainMetadata(meta);
  console.log("Metadata:", meta);

  const awan = await AwanToken.fromInit(owner, content);
  console.log("AwanToken address:", awan.address.toString());
  console.log("Explorer:", `${EXPLORER}/${awan.address.toString()}`);

  await sleep(RPC_GAP_MS);
  const walletDeployed = await withRetry("isDeployed(owner)", () =>
    client.isContractDeployed(owner),
  );
  console.log("Wallet deployed:", walletDeployed);

  await sleep(RPC_GAP_MS);
  const already = await withRetry("isDeployed(minter)", () =>
    client.isContractDeployed(awan.address),
  );
  if (already) {
    console.log(
      "Contract already deployed — sending MintInitial only (fails if already minted).",
    );
  } else {
    console.log("Deploying with MintInitial (state init + mint)...");
  }

  const mintBody = beginCell()
    .store(storeMintInitial({ $$type: "MintInitial", queryId: 0n }))
    .endCell();

  await sleep(RPC_GAP_MS);
  let seqno = 0;
  if (walletDeployed) {
    seqno = await withRetry("seqno", () => walletContract.getSeqno());
  }
  console.log("Wallet seqno:", seqno);

  const transfer = wallet.createTransfer({
    seqno,
    secretKey: keyPair.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages: [
      internal({
        to: awan.address,
        value: toNano("0.3"),
        bounce: true,
        init: already ? undefined : awan.init,
        body: mintBody,
      }),
    ],
  });
  const ext = external({
    to: owner,
    init: walletDeployed ? undefined : wallet.init,
    body: transfer,
  });
  const boc = beginCell().store(storeMessage(ext)).endCell().toBoc();

  await sleep(RPC_GAP_MS);
  await withRetry("sendBoc", () => client.sendFile(boc));
  console.log("Tx submitted. Waiting for deploy...");

  let deployed = already;
  for (let i = 0; i < 50 && !deployed; i++) {
    await sleep(3000);
    deployed = await withRetry("pollDeploy", () =>
      client.isContractDeployed(awan.address),
    );
    process.stdout.write(".");
  }
  console.log("");
  if (!deployed) {
    throw new Error("Deploy not confirmed — check explorer / wallet history.");
  }

  const opened = client.open(AwanToken.fromAddress(awan.address));
  await sleep(RPC_GAP_MS);
  let ownerJw = "";
  try {
    const jettonData = await opened.getGetJettonData();
    await sleep(RPC_GAP_MS);
    const walletAddr = await opened.getGetWalletAddress(owner);
    ownerJw = walletAddr.toString();
    await sleep(RPC_GAP_MS);
    const treasury = await opened.getGetTreasuryBalance();
    console.log("--- On-chain state ---");
    console.log("totalSupply:", jettonData.totalSupply.toString());
    console.log("owner:", jettonData.owner.toString());
    console.log("owner jetton wallet:", ownerJw);
    console.log("treasury:", fromNano(treasury), "TON");
  } catch (e) {
    console.warn("Getters not ready yet:", e);
  }

  const outDir = join(process.cwd(), "deployments");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "mainnet.json");
  const payload = {
    network: "mainnet",
    deployedAt: new Date().toISOString(),
    minter: awan.address.toString(),
    owner: owner.toString(),
    ownerNonBounceable: owner.toString({ bounceable: false, urlSafe: true }),
    ownerJettonWallet: ownerJw || null,
    metadata: meta,
    explorer: `${EXPLORER}/${awan.address.toString()}`,
    launchFlags: {
      trading: false,
      sells: false,
      claim: false,
      note: "EnableTrading one-way — use ops:postdeploy:mainnet with SKIP_ENABLE_TRADING=1 first",
    },
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log("Saved:", outPath);
  console.log("Done.");
  console.log(
    "\nNext:\n  SKIP_ENABLE_TRADING=1 npm run ops:postdeploy:mainnet\n  npm run setup:pool:mainnet\n  Then create DEX LP with your ~50 TON + 25% AWN\n  Then EnableTrading when ready",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
