/**
 * Mainnet simulated DEX pool holder: dedicated wallet + 25% AWN + SetDexPool.
 * Does NOT SetSellEnabled(true). Does NOT spend the ~50 TON LP budget
 * (only ~0.3 TON to deploy/fund the pool wallet). Real DEX LP later.
 *
 * Prerequisites:
 *  1. Deploy + postdeploy (deployments/mainnet.json)
 *  2. .env WALLET_MNEMONIC_MAINNET (or WALLET_MNEMONIC)
 *
 * Run: npm run setup:pool:mainnet
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
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
import { mnemonicNew, mnemonicToPrivateKey } from "@ton/crypto";
import {
    AwanToken,
    storeSetDexPool,
    storePushWalletConfig,
} from "../build/AwanToken_AwanToken";
import {
    storeJettonTransfer,
    AwanWallet,
} from "../build/AwanToken_AwanWallet";

const DEFAULT_MAINNET_ENDPOINT = "https://toncenter.com/api/v2/jsonRPC";
const EXPLORER = "https://tonviewer.com";
const MAINNET_GLOBAL_ID = -239;
const RPC_GAP_MS = 2500;

/** 25% of 1e9 supply with 9 decimals */
const LIQUIDITY_AMOUNT = 250_000_000n * 1_000_000_000n; // 250000000000000000 nanoAWN

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
            ? (err as { response?: { headers?: Record<string, string> } })
                  .response?.headers
            : undefined;
    const ra = headers?.["retry-after"] ?? headers?.["Retry-After"];
    if (ra) {
        const sec = Number(ra);
        // Cap so we don't sit 60s+ and burn V5 validUntil on later sends
        if (!Number.isNaN(sec) && sec > 0) return Math.min(20_000, sec * 1000);
    }
    return 0;
}

async function withRetry<T>(
    label: string,
    fn: () => Promise<T>,
    maxAttempts = 5,
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
                fromHeader || Math.min(15_000, 2500 * 2 ** (attempt - 1));
            console.warn(
                `[429] ${label}: retry ${attempt}/${maxAttempts - 1} in ${Math.round(backoff / 1000)}s`,
            );
            await sleep(backoff);
        }
    }
    throw lastErr;
}

type TestnetDeploy = {
    minter?: string;
    owner?: string;
    ownerJettonWallet?: string;
    [key: string]: unknown;
};

function loadDeploy(): TestnetDeploy {
    const path = join(process.cwd(), "deployments", "mainnet.json");
    if (!existsSync(path)) {
        throw new Error("Run deploy first (deployments/mainnet.json missing)");
    }
    return JSON.parse(readFileSync(path, "utf8"));
}

type PoolFile = {
    network: string;
    mnemonic: string;
    address: string;
    createdAt: string;
};

async function ensurePoolWallet(): Promise<{
    words: string[];
    address: Address;
    keyPair: Awaited<ReturnType<typeof mnemonicToPrivateKey>>;
    created: boolean;
    poolPath: string;
}> {
    const outDir = join(process.cwd(), "deployments");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const poolPath = join(outDir, "mainnet-pool.json");

    let words: string[];
    let created = false;

    if (existsSync(poolPath)) {
        const existing = JSON.parse(readFileSync(poolPath, "utf8")) as PoolFile;
        if (!existing.mnemonic) {
            throw new Error("deployments/mainnet-pool.json missing mnemonic");
        }
        words = existing.mnemonic.trim().split(/\s+/);
        console.log("Reusing pool wallet from", poolPath);
    } else {
        words = await mnemonicNew(24);
        created = true;
    }

    const keyPair = await mnemonicToPrivateKey(words);
    const wallet = WalletContractV5R1.create({
        publicKey: keyPair.publicKey,
        walletId: { networkGlobalId: MAINNET_GLOBAL_ID },
    });
    const address = wallet.address;

    if (created) {
        const payload: PoolFile = {
            network: "mainnet",
            mnemonic: words.join(" "),
            address: address.toString(),
            createdAt: new Date().toISOString(),
        };
        writeFileSync(poolPath, JSON.stringify(payload, null, 2));
        console.log("Saved new pool wallet:", poolPath, "(gitignored — keep private)");
    }

    return { words, address, keyPair, created, poolPath };
}

async function main() {
    const mnemonic =
        process.env.WALLET_MNEMONIC_MAINNET?.trim() ||
        process.env.WALLET_MNEMONIC?.trim();
    if (!mnemonic) {
        throw new Error("Set WALLET_MNEMONIC_MAINNET or WALLET_MNEMONIC in .env");
    }
    const ownerWords = mnemonic.split(/\s+/);
    if (ownerWords.length < 12) {
        throw new Error("Mnemonic looks invalid (expected 12+ words)");
    }

    const deploy = loadDeploy();
    const minterAddr = Address.parse(
        process.env.MINTER_ADDRESS?.trim() || deploy.minter || "",
    );
    if (!deploy.minter && !process.env.MINTER_ADDRESS?.trim()) {
        throw new Error("deployments/mainnet.json missing minter");
    }

    const endpoint = resolveEndpoint();
    const apiKey = process.env.TONCENTER_API_KEY || undefined;
    console.log("NETWORK: mainnet");
    console.log("RPC:", endpoint);
    const client = new TonClient({
        endpoint,
        apiKey: endpoint.includes("toncenter.com") ? apiKey : undefined,
    });

    const ownerKeyPair = await mnemonicToPrivateKey(ownerWords);
    const ownerWallet = WalletContractV5R1.create({
        publicKey: ownerKeyPair.publicKey,
        walletId: { networkGlobalId: MAINNET_GLOBAL_ID },
    });
    const ownerContract = client.open(ownerWallet);
    const owner = ownerContract.address;

    if (deploy.owner && !Address.parse(deploy.owner).equals(owner)) {
        console.warn(
            "WARNING: .env wallet differs from deployments/mainnet.json owner",
        );
        console.warn("  .env:", owner.toString());
        console.warn("  json:", deploy.owner);
    }

    const pool = await ensurePoolWallet();
    const poolOwner = pool.address;

    console.log("Owner:", owner.toString());
    console.log("Pool owner:", poolOwner.toString());
    console.log("Minter:", minterAddr.toString());
    console.log("Explorer minter:", `${EXPLORER}/${minterAddr.toString()}`);
    console.log("Explorer pool:", `${EXPLORER}/${poolOwner.toString()}`);
    console.log("Liquidity:", LIQUIDITY_AMOUNT.toString(), "nanoAWN (25%)");

    await sleep(RPC_GAP_MS);
    const balance = await withRetry("getBalance(owner)", () =>
        ownerContract.getBalance(),
    );
    console.log("Owner balance:", fromNano(balance), "TON");

    // Prefer 0.3 TON fund; fall back to 0.15 if tight
    const preferredFund = toNano("0.3");
    const fallbackFund = toNano("0.15");
    // Budget: fund + jetton transfer (~0.15) + SetDexPool (~0.05) + 2x Push (~0.08*2) + buffer
    const minForPreferred = preferredFund + toNano("0.45");
    const minForFallback = fallbackFund + toNano("0.45");
    let fundAmount = preferredFund;
    if (balance < minForPreferred) {
        if (balance < minForFallback) {
            throw new Error(
                `Need at least ~${fromNano(minForFallback)} TON (fund pool + txs). Have ${fromNano(balance)}`,
            );
        }
        fundAmount = fallbackFund;
        console.warn(
            `Owner balance tight — funding pool with ${fromNano(fundAmount)} TON instead of 0.3`,
        );
    }

    await sleep(RPC_GAP_MS);
    const walletDeployed = await withRetry("isContractDeployed(owner)", () =>
        client.isContractDeployed(owner),
    );
    if (!walletDeployed) {
        throw new Error("Owner wallet is not deployed on-chain");
    }

    await sleep(RPC_GAP_MS);
    const minterDeployed = await withRetry("isContractDeployed(minter)", () =>
        client.isContractDeployed(minterAddr),
    );
    if (!minterDeployed) {
        throw new Error(`Minter not deployed: ${minterAddr.toString()}`);
    }

    const opened = client.open(AwanToken.fromAddress(minterAddr));

    await sleep(RPC_GAP_MS);
    let ownerJettonWalletAddr: Address;
    if (deploy.ownerJettonWallet) {
        ownerJettonWalletAddr = Address.parse(deploy.ownerJettonWallet);
    } else {
        ownerJettonWalletAddr = await withRetry("getGetWalletAddress(owner)", () =>
            opened.getGetWalletAddress(owner),
        );
    }

    await sleep(RPC_GAP_MS);
    const poolJettonWalletAddr = await withRetry(
        "getGetWalletAddress(pool)",
        () => opened.getGetWalletAddress(poolOwner),
    );
    console.log("Owner jetton wallet:", ownerJettonWalletAddr.toString());
    console.log("Pool jetton wallet (predicted):", poolJettonWalletAddr.toString());

    function isExpiredOrTransientSendError(err: unknown): boolean {
        if (isRateLimitError(err)) return true;
        const msg = err instanceof Error ? err.message : String(err);
        const data =
            err && typeof err === "object" && "response" in err
                ? (err as { response?: { data?: { error?: string; code?: number } } })
                      .response?.data
                : undefined;
        const detail = `${msg} ${data?.error ?? ""}`;
        // V5 valid_until expired (136) after long 429 waits — resign & retry
        return (
            /exitcode=136/i.test(detail) ||
            /External message was not accepted/i.test(detail) ||
            data?.code === 500
        );
    }

    async function sendOwnerTx(
        to: Address,
        value: bigint,
        body: Cell | undefined,
        label: string,
        bounce = true,
        deployInit?: { code: Cell; data: Cell },
    ) {
        let seqno = 0;
        const maxAttempts = 5;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await sleep(RPC_GAP_MS);
            seqno = await withRetry(`getSeqno(${label})`, () =>
                ownerContract.getSeqno(),
            );
            console.log(
                `${label}: seqno=${seqno}` +
                    (attempt > 1 ? ` (resign attempt ${attempt})` : ""),
            );

            // Fresh signature each attempt — V5 validUntil is absolute unix ts
            const transfer = ownerWallet.createTransfer({
                seqno,
                secretKey: ownerKeyPair.secretKey,
                sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
                timeout: Math.floor(Date.now() / 1000) + 120,
                messages: [
                    internal({
                        to,
                        value,
                        bounce,
                        init: deployInit,
                        body: body ?? beginCell().endCell(),
                    }),
                ],
            });
            const ext = external({
                to: owner,
                body: transfer,
            });
            const boc = beginCell().store(storeMessage(ext)).endCell().toBoc();

            try {
                await sleep(RPC_GAP_MS);
                await client.sendFile(boc);
                console.log(`${label}: submitted`);
                break;
            } catch (err) {
                if (!isExpiredOrTransientSendError(err) || attempt === maxAttempts) {
                    throw err;
                }
                const backoff = Math.min(30_000, 3000 * 2 ** (attempt - 1));
                console.warn(
                    `[send] ${label}: transient error, resign in ${Math.round(backoff / 1000)}s`,
                );
                await sleep(backoff);
            }
        }

        for (let i = 0; i < 30; i++) {
            await sleep(2000);
            try {
                const next = await ownerContract.getSeqno();
                if (next > seqno) {
                    console.log(`${label}: confirmed (seqno ${next})`);
                    return;
                }
            } catch (err) {
                if (isRateLimitError(err)) {
                    console.warn(`[429] waiting for ${label} confirm…`);
                    await sleep(5000);
                }
            }
            process.stdout.write(".");
        }
        console.log("");
        console.warn(`${label}: seqno not bumped yet — check explorer`);
    }

    // a) Fund pool owner so it can exist / receive jettons
    await sleep(RPC_GAP_MS);
    const poolBal = await withRetry("getBalance(pool)", async () => {
        try {
            return await client.getBalance(poolOwner);
        } catch {
            return 0n;
        }
    });
    console.log("Pool balance before fund:", fromNano(poolBal), "TON");

    await sleep(RPC_GAP_MS);
    const poolDeployed = await withRetry("isContractDeployed(pool)", () =>
        client.isContractDeployed(poolOwner),
    );
    if (!poolDeployed) {
        const poolKeyPair = pool.keyPair;
        const poolW = WalletContractV5R1.create({
            publicKey: poolKeyPair.publicKey,
            walletId: { networkGlobalId: MAINNET_GLOBAL_ID },
        });
        if (!poolW.init) throw new Error("pool wallet init missing");
        console.log(
            `\n--- Deploy+fund pool owner (${fromNano(fundAmount)} TON + StateInit) ---`,
        );
        await sendOwnerTx(
            poolOwner,
            fundAmount,
            undefined,
            "DeployFundPool",
            false,
            { code: poolW.init.code, data: poolW.init.data },
        );
        await sleep(3000);
    } else if (poolBal < toNano("0.1")) {
        console.log(`\n--- Fund pool owner (${fromNano(fundAmount)} TON) ---`);
        await sendOwnerTx(poolOwner, fundAmount, undefined, "FundPool", false);
        await sleep(3000);
    } else {
        console.log("Pool already funded+deployed — skipping TON transfer");
    }

    // b) JettonTransfer 25% → pool owner (BEFORE SetDexPool so not treated as sell)
    const emptyFwd = beginCell().endCell().beginParse();
    const jettonBody = beginCell()
        .store(
            storeJettonTransfer({
                $$type: "JettonTransfer",
                queryId: 0n,
                amount: LIQUIDITY_AMOUNT,
                destination: poolOwner,
                responseDestination: owner,
                customPayload: null,
                forwardTonAmount: toNano("0.01"),
                forwardPayload: emptyFwd,
            }),
        )
        .endCell();

    console.log("\n--- JettonTransfer 25% to pool (~0.15 TON attach) ---");
    await sendOwnerTx(
        ownerJettonWalletAddr,
        toNano("0.15"),
        jettonBody,
        "JettonTransfer25pct",
    );
    console.log("Waiting for jetton wallet deploy / credit…");
    await sleep(8000);

    // c) SetDexPool { pool: poolOwnerAddress }
    const setPoolBody = beginCell()
        .store(
            storeSetDexPool({
                $$type: "SetDexPool",
                queryId: 1n,
                pool: poolOwner,
            }),
        )
        .endCell();

    console.log("\n--- SetDexPool (~0.05 TON) ---");
    await sendOwnerTx(minterAddr, toNano("0.05"), setPoolBody, "SetDexPool");
    await sleep(4000);

    // d) PushWalletConfig → owner AND pool owner
    const pushOwnerBody = beginCell()
        .store(
            storePushWalletConfig({
                $$type: "PushWalletConfig",
                queryId: 2n,
                walletOwner: owner,
            }),
        )
        .endCell();

    console.log("\n--- PushWalletConfig(owner) (~0.08 TON) ---");
    await sendOwnerTx(minterAddr, toNano("0.08"), pushOwnerBody, "PushConfigOwner");
    await sleep(4000);

    const pushPoolBody = beginCell()
        .store(
            storePushWalletConfig({
                $$type: "PushWalletConfig",
                queryId: 3n,
                walletOwner: poolOwner,
            }),
        )
        .endCell();

    console.log("\n--- PushWalletConfig(pool) (~0.08 TON) ---");
    await sendOwnerTx(minterAddr, toNano("0.08"), pushPoolBody, "PushConfigPool");
    await sleep(5000);

    // e) Verify trading state + optional balances
    console.log("\n--- On-chain verification ---");
    let trading: Awaited<ReturnType<typeof opened.getGetTradingState>> | null =
        null;
    let poolJwBalance: bigint | null = null;
    let ownerJwBalance: bigint | null = null;

    try {
        await sleep(RPC_GAP_MS);
        trading = await withRetry("getGetTradingState", () =>
            opened.getGetTradingState(),
        );
        console.log("trading:", {
            isTradingEnabled: trading.isTradingEnabled,
            isSellEnabled: trading.isSellEnabled,
            isDexLimitsEnabled: trading.isDexLimitsEnabled,
            dexPool: trading.dexPool ? trading.dexPool.toString() : null,
        });

        if (!trading.dexPool || !trading.dexPool.equals(poolOwner)) {
            console.warn(
                "WARNING: dexPool not set to pool owner yet — check explorer / retry read",
            );
        } else {
            console.log("OK: dexPool == pool owner");
        }
        if (trading.isSellEnabled) {
            console.warn("WARNING: sells unexpectedly enabled");
        } else {
            console.log("OK: isSellEnabled still false");
        }
    } catch (e) {
        console.warn("Trading getters failed:", e);
    }

    try {
        await sleep(RPC_GAP_MS);
        const poolJwDeployed = await withRetry("isDeployed(poolJW)", () =>
            client.isContractDeployed(poolJettonWalletAddr),
        );
        if (poolJwDeployed) {
            const poolJw = client.open(
                AwanWallet.fromAddress(poolJettonWalletAddr),
            );
            await sleep(RPC_GAP_MS);
            const data = await withRetry("getGetWalletData(pool)", () =>
                poolJw.getGetWalletData(),
            );
            poolJwBalance = data.balance;
            console.log("pool jetton balance:", poolJwBalance.toString(), "nanoAWN");
            if (poolJwBalance >= LIQUIDITY_AMOUNT) {
                console.log("OK: pool received >= 25% liquidity");
            } else {
                console.warn(
                    `Pool balance ${poolJwBalance} < expected ${LIQUIDITY_AMOUNT} — may still be confirming`,
                );
            }
        } else {
            console.warn("Pool jetton wallet not deployed yet — transfer may still be pending");
        }

        await sleep(RPC_GAP_MS);
        const ownerJw = client.open(AwanWallet.fromAddress(ownerJettonWalletAddr));
        const oData = await withRetry("getGetWalletData(owner)", () =>
            ownerJw.getGetWalletData(),
        );
        ownerJwBalance = oData.balance;
        console.log("owner jetton balance:", ownerJwBalance.toString(), "nanoAWN");
    } catch (e) {
        console.warn("Balance read skipped/failed:", e);
    }

    // f) Update deployments/mainnet.json
    const outPath = join(process.cwd(), "deployments", "mainnet.json");
    const existing: Record<string, unknown> = existsSync(outPath)
        ? JSON.parse(readFileSync(outPath, "utf8"))
        : {};
    const updated = {
        ...existing,
        network: "mainnet",
        minter: minterAddr.toString(),
        owner: owner.toString(),
        ownerJettonWallet: ownerJettonWalletAddr.toString(),
        dexPool: poolOwner.toString(),
        poolOwner: poolOwner.toString(),
        poolJettonWallet: poolJettonWalletAddr.toString(),
        liquidityAmount: LIQUIDITY_AMOUNT.toString(),
        poolSetupAt: new Date().toISOString(),
        explorer: `${EXPLORER}/${minterAddr.toString()}`,
        tradingFlags: trading
            ? {
                  isTradingEnabled: trading.isTradingEnabled,
                  isSellEnabled: trading.isSellEnabled,
                  isDexLimitsEnabled: trading.isDexLimitsEnabled,
                  dexPool: trading.dexPool ? trading.dexPool.toString() : null,
              }
            : (existing.tradingFlags ?? null),
        poolBalances: {
            poolJetton: poolJwBalance?.toString() ?? null,
            ownerJetton: ownerJwBalance?.toString() ?? null,
        },
        noteLp:
            "25% AWN seeded to simulated pool. Create real DEX LP with ~50 TON later; then SetDexPool to DEX vault if needed.",
    };
    writeFileSync(outPath, JSON.stringify(updated, null, 2));
    console.log("Saved:", outPath);
    console.log("Pool mnemonic file:", pool.poolPath, "(gitignored — PRIVATE)");
    console.log("Done. (sells OFF — keep ~50 TON for real DEX LP)");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
