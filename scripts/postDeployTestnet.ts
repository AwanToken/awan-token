/**
 * Post-deploy (buys-only phase): PushWalletConfig → EnableTrading.
 * Does NOT SetSellEnabled(true). Does NOT require DEX pool.
 *
 * Prerequisites:
 *  1. Contract deployed (deployments/testnet.json or MINTER_ADDRESS)
 *  2. .env with WALLET_MNEMONIC (+ optional TON_API_ENDPOINT / TONCENTER_API_KEY)
 *
 * Run: npm run postdeploy:testnet
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

/** Prefer env override; else toncenter (with key) or Tatum public testnet RPC. */
const TONCENTER_TESTNET = "https://testnet.toncenter.com/api/v2/jsonRPC";
const DEFAULT_TESTNET_ENDPOINT = "https://ton-testnet.gateway.tatum.io/jsonRPC";
const EXPLORER = "https://testnet.tonviewer.com";
/** Tonkeeper testnet uses W5 (V5R1) with networkGlobalId -3 */
const TESTNET_GLOBAL_ID = -3;
/** Space RPC calls to avoid public-endpoint 429 */
const RPC_GAP_MS = 1500;

async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function resolveEndpoint(): string {
    const fromEnv =
        process.env.TON_API_ENDPOINT?.trim() ||
        process.env.TON_RPC_ENDPOINT?.trim();
    if (fromEnv) return fromEnv;
    if (process.env.TONCENTER_API_KEY?.trim()) return TONCENTER_TESTNET;
    return DEFAULT_TESTNET_ENDPOINT;
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
        if (!Number.isNaN(sec) && sec > 0) return Math.min(120_000, sec * 1000);
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
                fromHeader || Math.min(60_000, 3000 * 2 ** (attempt - 1));
            console.warn(
                `[429] ${label}: retry ${attempt}/${maxAttempts - 1} in ${Math.round(backoff / 1000)}s`,
            );
            await sleep(backoff);
        }
    }
    throw lastErr;
}

function loadMinterAddress(): Address {
    const fromEnv = process.env.MINTER_ADDRESS?.trim();
    if (fromEnv) return Address.parse(fromEnv);

    const path = join(process.cwd(), "deployments", "testnet.json");
    if (!existsSync(path)) {
        throw new Error(
            "Set MINTER_ADDRESS or run deploy first (deployments/testnet.json)",
        );
    }
    const json = JSON.parse(readFileSync(path, "utf8"));
    if (!json.minter) throw new Error("deployments/testnet.json missing minter");
    return Address.parse(json.minter);
}

async function main() {
    const mnemonic = process.env.WALLET_MNEMONIC?.trim();
    if (!mnemonic) {
        throw new Error("Set WALLET_MNEMONIC in .env (24 words, space-separated)");
    }

    const words = mnemonic.split(/\s+/);
    if (words.length < 12) {
        throw new Error("WALLET_MNEMONIC looks invalid (expected 12+ words)");
    }

    const endpoint = resolveEndpoint();
    const apiKey = process.env.TONCENTER_API_KEY || undefined;
    console.log("RPC:", endpoint);
    const client = new TonClient({
        endpoint,
        apiKey: endpoint.includes("toncenter.com") ? apiKey : undefined,
    });

    const keyPair = await mnemonicToPrivateKey(words);
    const wallet = WalletContractV5R1.create({
        publicKey: keyPair.publicKey,
        walletId: { networkGlobalId: TESTNET_GLOBAL_ID },
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
        throw new Error("Need at least ~0.2 testnet TON for PushWalletConfig + EnableTrading");
    }

    await sleep(RPC_GAP_MS);
    const walletDeployed = await withRetry("isContractDeployed(wallet)", () =>
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

    async function sendOwnerTx(to: Address, value: bigint, body: Cell, label: string) {
        await sleep(RPC_GAP_MS);
        const seqno = await withRetry(`getSeqno(${label})`, () =>
            walletContract.getSeqno(),
        );
        console.log(`${label}: seqno=${seqno}`);

        const transfer = wallet.createTransfer({
            seqno,
            secretKey: keyPair.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            messages: [
                internal({
                    to,
                    value,
                    bounce: true,
                    body,
                }),
            ],
        });
        const ext = external({
            to: owner,
            body: transfer,
        });
        const boc = beginCell().store(storeMessage(ext)).endCell().toBoc();

        await sleep(RPC_GAP_MS);
        await withRetry(`sendFile(${label})`, () => client.sendFile(boc));
        console.log(`${label}: submitted`);

        // Wait for seqno bump (tx processed)
        for (let i = 0; i < 30; i++) {
            await sleep(2000);
            try {
                const next = await walletContract.getSeqno();
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

    // 1) PushWalletConfig { queryId, walletOwner: owner } — always sync owner wallet
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

    // 2) EnableTrading — ONE-WAY. Skip for closed launch (SKIP_ENABLE_TRADING=1).
    const skipEnable =
        process.env.SKIP_ENABLE_TRADING === "1" ||
        process.env.LAUNCH_CLOSED === "1";
    if (skipEnable) {
        console.log(
            "\n--- SKIP EnableTrading (LAUNCH_CLOSED / SKIP_ENABLE_TRADING) ---",
        );
        console.log("Market stays closed until Owner enables trading later.");
    } else if (preTrading.isTradingEnabled) {
        console.log("Trading already enabled — skipping EnableTrading tx.");
    } else {
        console.log("Waiting briefly before EnableTrading…");
        await sleep(5000);
        const enableBody = beginCell()
            .store(
                storeEnableTrading({
                    $$type: "EnableTrading",
                    queryId: 1n,
                }),
            )
            .endCell();

        console.log("\n--- EnableTrading (~0.05 TON) ---");
        await sendOwnerTx(minterAddr, toNano("0.05"), enableBody, "EnableTrading");
    }

    // 3) Read getters
    console.log("\n--- On-chain state ---");
    await sleep(RPC_GAP_MS);
    const opened = client.open(AwanToken.fromAddress(minterAddr));

    let trading: Awaited<ReturnType<typeof opened.getGetTradingState>> | null =
        null;
    let jettonData: Awaited<ReturnType<typeof opened.getGetJettonData>> | null =
        null;
    let ownerJettonWallet: Address | null = null;

    try {
        await sleep(RPC_GAP_MS);
        trading = await withRetry("getGetTradingState", () =>
            opened.getGetTradingState(),
        );
        await sleep(RPC_GAP_MS);
        jettonData = await withRetry("getGetJettonData", () =>
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
            maxBuyLimitBp: Number(trading.maxBuyLimitBp),
            maxSellLimitBp: Number(trading.maxSellLimitBp),
            possessionLimitBp: Number(trading.possessionLimitBp),
            sellTaxBp: Number(trading.sellTaxBp),
            poolJettonBalance: trading.poolJettonBalance.toString(),
        });
        console.log("totalSupply:", jettonData.totalSupply.toString());
        console.log("owner:", jettonData.owner.toString());
        console.log("owner jetton wallet:", ownerJettonWallet.toString());
        console.log("owner wallet explorer:", `${EXPLORER}/${ownerJettonWallet.toString()}`);
    } catch (e) {
        console.warn("Getters not ready yet:", e);
    }

    // 4) Update deployments/testnet.json
    const outPath = join(process.cwd(), "deployments", "testnet.json");
    let existing: Record<string, unknown> = {};
    if (existsSync(outPath)) {
        existing = JSON.parse(readFileSync(outPath, "utf8"));
    }
    const updated = {
        ...existing,
        network: "testnet",
        minter: minterAddr.toString(),
        owner: owner.toString(),
        tradingEnabledAt: new Date().toISOString(),
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
            : existing.tradingFlags ?? null,
    };
    writeFileSync(outPath, JSON.stringify(updated, null, 2));
    console.log("Saved:", outPath);
    console.log("Done. (sells still disabled — SetSellEnabled later)");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
