/**
 * Testnet trade rules:
 *  1) BUY from simulated pool → buyer (within 0.5% of pool AWN) — must succeed
 *  2) BUY over 0.5% of pool — must fail / not credit
 *  3) SELL owner → pool while isSellEnabled=false — must fail
 *
 * Run: npm run test:trade:testnet
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
    storePushWalletConfig,
} from "../build/AwanToken_AwanToken";
import {
    storeJettonTransfer,
    AwanWallet,
} from "../build/AwanToken_AwanWallet";

const TONCENTER_TESTNET = "https://testnet.toncenter.com/api/v2/jsonRPC";
const DEFAULT_TESTNET_ENDPOINT = "https://ton-testnet.gateway.tatum.io/jsonRPC";
const EXPLORER = "https://testnet.tonviewer.com";
const TESTNET_GLOBAL_ID = -3;
const RPC_GAP_MS = 2000;

/** Under 0.5% of ~250M pool (=1.25M) */
const BUY_OK_AMOUNT = 1_000_000n * 1_000_000_000n;
/** Over 0.5% of pool buy limit */
const BUY_OVER_AMOUNT = 25_000_000n * 1_000_000_000n;
/** Small sell probe */
const SELL_PROBE_AMOUNT = 1_000n * 1_000_000_000n;

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

function isExpiredOrTransientSendError(err: unknown): boolean {
    if (isRateLimitError(err)) return true;
    const msg = err instanceof Error ? err.message : String(err);
    const data =
        err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { error?: string; code?: number } } })
                  .response?.data
            : undefined;
    const detail = `${msg} ${data?.error ?? ""}`;
    return (
        /exitcode=136/i.test(detail) ||
        /External message was not accepted/i.test(detail) ||
        data?.code === 500
    );
}

type Results = {
    buyOk: "pass" | "fail" | "unknown";
    buyOverLimit: "pass" | "fail" | "unknown";
    sellBlocked: "pass" | "fail" | "unknown";
    notes: string[];
};

async function main() {
    const results: Results = {
        buyOk: "unknown",
        buyOverLimit: "unknown",
        sellBlocked: "unknown",
        notes: [],
    };

    const ownerMnemonic = process.env.WALLET_MNEMONIC?.trim();
    if (!ownerMnemonic) throw new Error("Set WALLET_MNEMONIC in .env");

    const deployPath = join(process.cwd(), "deployments", "testnet.json");
    const poolPath = join(process.cwd(), "deployments", "testnet-pool.json");
    if (!existsSync(deployPath) || !existsSync(poolPath)) {
        throw new Error("Need deployments/testnet.json and testnet-pool.json");
    }
    const deploy = JSON.parse(readFileSync(deployPath, "utf8"));
    const poolFile = JSON.parse(readFileSync(poolPath, "utf8"));

    const minterAddr = Address.parse(deploy.minter);
    const poolOwner = Address.parse(poolFile.address);
    const poolWords = (poolFile.mnemonic as string).trim().split(/\s+/);

    const endpoint = resolveEndpoint();
    const apiKey = process.env.TONCENTER_API_KEY || undefined;
    console.log("RPC:", endpoint);
    const client = new TonClient({
        endpoint,
        apiKey: endpoint.includes("toncenter.com") ? apiKey : undefined,
    });

    const ownerKey = await mnemonicToPrivateKey(ownerMnemonic.split(/\s+/));
    const ownerWallet = WalletContractV5R1.create({
        publicKey: ownerKey.publicKey,
        walletId: { networkGlobalId: TESTNET_GLOBAL_ID },
    });
    const ownerContract = client.open(ownerWallet);
    const owner = ownerContract.address;

    const poolKey = await mnemonicToPrivateKey(poolWords);
    const poolWallet = WalletContractV5R1.create({
        publicKey: poolKey.publicKey,
        walletId: { networkGlobalId: TESTNET_GLOBAL_ID },
    });
    const poolContract = client.open(poolWallet);
    if (!poolWallet.address.equals(poolOwner)) {
        throw new Error("Pool mnemonic does not match saved pool address");
    }

    const minter = client.open(AwanToken.fromAddress(minterAddr));

    await sleep(RPC_GAP_MS);
    const trading = await withRetry("getTradingState", () =>
        minter.getGetTradingState(),
    );
    console.log("Trading state:", {
        isTradingEnabled: trading.isTradingEnabled,
        isSellEnabled: trading.isSellEnabled,
        dexPool: trading.dexPool?.toString() ?? null,
    });
    if (!trading.isTradingEnabled) {
        throw new Error("Trading not enabled — run postdeploy first");
    }
    if (!trading.dexPool || !trading.dexPool.equals(poolOwner)) {
        throw new Error("dexPool not set — run setup:pool:testnet first");
    }
    if (trading.isSellEnabled) {
        results.notes.push("WARNING: sells already enabled — sellBlocked test may not apply");
    }

    const ownerJw = Address.parse(
        deploy.ownerJettonWallet ||
            (await minter.getGetWalletAddress(owner)).toString(),
    );
    const poolJw = Address.parse(
        deploy.poolJettonWallet ||
            (await minter.getGetWalletAddress(poolOwner)).toString(),
    );

    // --- buyer wallet ---
    const buyerPath = join(process.cwd(), "deployments", "testnet-buyer.json");
    let buyerWords: string[];
    if (existsSync(buyerPath)) {
        buyerWords = JSON.parse(readFileSync(buyerPath, "utf8")).mnemonic.split(
            /\s+/,
        );
        console.log("Reusing buyer wallet");
    } else {
        buyerWords = await mnemonicNew(24);
        const outDir = join(process.cwd(), "deployments");
        if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    }
    const buyerKey = await mnemonicToPrivateKey(buyerWords);
    const buyerWallet = WalletContractV5R1.create({
        publicKey: buyerKey.publicKey,
        walletId: { networkGlobalId: TESTNET_GLOBAL_ID },
    });
    const buyer = buyerWallet.address;
    writeFileSync(
        buyerPath,
        JSON.stringify(
            {
                network: "testnet",
                mnemonic: buyerWords.join(" "),
                address: buyer.toString(),
                updatedAt: new Date().toISOString(),
            },
            null,
            2,
        ),
    );
    console.log("Buyer:", buyer.toString());
    console.log("Explorer buyer:", `${EXPLORER}/${buyer.toString()}`);

    await sleep(RPC_GAP_MS);
    const buyerJwPredicted = await withRetry("getWallet(buyer)", () =>
        minter.getGetWalletAddress(buyer),
    );
    console.log("Buyer jetton wallet (predicted):", buyerJwPredicted.toString());

    async function sendFrom(
        kind: "owner" | "pool" | "buyer",
        to: Address,
        value: bigint,
        body: Cell | undefined,
        label: string,
        bounce = true,
        deployInit?: { code: Cell; data: Cell },
    ) {
        const wallet =
            kind === "owner"
                ? ownerWallet
                : kind === "pool"
                  ? poolWallet
                  : buyerWallet;
        const contract =
            kind === "owner"
                ? ownerContract
                : kind === "pool"
                  ? poolContract
                  : client.open(buyerWallet);
        const key =
            kind === "owner" ? ownerKey : kind === "pool" ? poolKey : buyerKey;
        const from = wallet.address;

        let seqno = 0;
        const maxAttempts = 5;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            await sleep(RPC_GAP_MS);
            seqno = await withRetry(`getSeqno(${label})`, () =>
                contract.getSeqno(),
            );
            console.log(
                `${label}: seqno=${seqno}` +
                    (attempt > 1 ? ` (resign ${attempt})` : ""),
            );

            const transfer = wallet.createTransfer({
                seqno,
                secretKey: key.secretKey,
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
            const boc = beginCell()
                .store(storeMessage(external({ to: from, body: transfer })))
                .endCell()
                .toBoc();

            try {
                await sleep(RPC_GAP_MS);
                await withRetry(`sendFile(${label})`, () => client.sendFile(boc));
                console.log(`${label}: submitted`);
                break;
            } catch (err) {
                if (
                    !isExpiredOrTransientSendError(err) ||
                    attempt === maxAttempts
                ) {
                    throw err;
                }
                console.warn(`${label}: send failed, resigning…`);
                await sleep(3000);
            }
        }

        for (let i = 0; i < 30; i++) {
            await sleep(2000);
            try {
                const next = await contract.getSeqno();
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
        console.warn(`${label}: seqno not bumped yet`);
    }

    function jettonTransferBody(
        amount: bigint,
        destination: Address,
        response: Address,
        queryId: bigint,
    ): Cell {
        const emptyFwd = beginCell().endCell().beginParse();
        return beginCell()
            .store(
                storeJettonTransfer({
                    $$type: "JettonTransfer",
                    queryId,
                    amount,
                    destination,
                    responseDestination: response,
                    customPayload: null,
                    forwardTonAmount: toNano("0.01"),
                    forwardPayload: emptyFwd,
                }),
            )
            .endCell();
    }

    async function readJwBalance(jw: Address): Promise<bigint | null> {
        try {
            await sleep(RPC_GAP_MS);
            const deployed = await withRetry("isDeployed(jw)", () =>
                client.isContractDeployed(jw),
            );
            if (!deployed) return 0n;
            const w = client.open(AwanWallet.fromAddress(jw));
            const data = await withRetry("getWalletData", () =>
                w.getGetWalletData(),
            );
            return data.balance;
        } catch (e) {
            console.warn("balance read failed:", e);
            return null;
        }
    }

    // Fund buyer if needed
    await sleep(RPC_GAP_MS);
    let buyerTon = 0n;
    try {
        buyerTon = await withRetry("getBalance(buyer)", () =>
            client.getBalance(buyer),
        );
    } catch {
        buyerTon = 0n;
    }
    console.log("Buyer TON:", fromNano(buyerTon));
    await sleep(RPC_GAP_MS);
    const buyerDeployed = await withRetry("isDeployed(buyer)", () =>
        client.isContractDeployed(buyer),
    );
    if (!buyerDeployed || buyerTon < toNano("0.15")) {
        console.log("\n--- Deploy+fund buyer 0.25 TON (with StateInit) ---");
        if (!buyerWallet.init) {
            throw new Error("buyerWallet.init missing");
        }
        await sendFrom(
            "owner",
            buyer,
            toNano("0.25"),
            undefined,
            "FundBuyer",
            false,
            { code: buyerWallet.init.code, data: buyerWallet.init.data },
        );
        await sleep(5000);
    }

    // Ensure pool wallet is DEPLOYED (StateInit) — funding alone leaves seqno stuck at 0
    await sleep(RPC_GAP_MS);
    const poolTon = await withRetry("getBalance(pool)", () =>
        client.getBalance(poolOwner),
    );
    await sleep(RPC_GAP_MS);
    const poolDeployed = await withRetry("isDeployed(pool)", () =>
        client.isContractDeployed(poolOwner),
    );
    console.log("Pool TON:", fromNano(poolTon), "| deployed:", poolDeployed);
    if (!poolDeployed) {
        if (!poolWallet.init) throw new Error("poolWallet.init missing");
        console.log("\n--- Deploy pool wallet (StateInit) + 0.05 TON ---");
        await sendFrom(
            "owner",
            poolOwner,
            toNano("0.05"),
            undefined,
            "DeployPool",
            false,
            { code: poolWallet.init.code, data: poolWallet.init.data },
        );
        await sleep(5000);
    } else if (poolTon < toNano("0.2")) {
        console.log("\n--- Top-up pool 0.25 TON ---");
        await sendFrom(
            "owner",
            poolOwner,
            toNano("0.25"),
            undefined,
            "FundPool",
            false,
        );
        await sleep(3000);
    }

    // Sanity: pool must accept external messages now
    await sleep(RPC_GAP_MS);
    const poolSeq = await withRetry("getSeqno(pool)", () =>
        poolContract.getSeqno(),
    );
    console.log("Pool seqno after deploy check:", poolSeq);

    // ========== TEST 1: BUY OK ==========
    console.log("\n========== TEST 1: BUY OK (1M AWN from pool) ==========");
    const balBeforeBuy = await readJwBalance(buyerJwPredicted);
    console.log("Buyer AWN before:", balBeforeBuy?.toString() ?? "n/a");

    await sendFrom(
        "pool",
        poolJw,
        toNano("0.12"),
        jettonTransferBody(BUY_OK_AMOUNT, buyer, poolOwner, 10n),
        "BuyOk",
    );
    console.log("Waiting for buy credit…");
    await sleep(10000);

    const balAfterBuy = await readJwBalance(buyerJwPredicted);
    console.log("Buyer AWN after:", balAfterBuy?.toString() ?? "n/a");
    if (
        balAfterBuy != null &&
        balBeforeBuy != null &&
        balAfterBuy >= balBeforeBuy + BUY_OK_AMOUNT
    ) {
        results.buyOk = "pass";
        console.log("PASS: buy within limit credited");
    } else if (balAfterBuy != null && balAfterBuy >= BUY_OK_AMOUNT) {
        results.buyOk = "pass";
        console.log("PASS: buyer holds >= 1M AWN");
    } else {
        results.buyOk = "fail";
        results.notes.push("Buy OK did not credit expected amount");
        console.log("FAIL: buy amount not reflected");
    }

    // Sync buyer config so sell gate knows dexPool
    console.log("\n--- PushWalletConfig(buyer) ---");
    await sendFrom(
        "owner",
        minterAddr,
        toNano("0.08"),
        beginCell()
            .store(
                storePushWalletConfig({
                    $$type: "PushWalletConfig",
                    queryId: 11n,
                    walletOwner: buyer,
                }),
            )
            .endCell(),
        "PushBuyerConfig",
    );
    await sleep(5000);

    // ========== TEST 2: BUY OVER LIMIT ==========
    console.log("\n========== TEST 2: BUY OVER LIMIT (25M AWN) ==========");
    const balBeforeOver = await readJwBalance(buyerJwPredicted);
    const poolBalBefore = await readJwBalance(poolJw);

    await sendFrom(
        "pool",
        poolJw,
        toNano("0.12"),
        jettonTransferBody(BUY_OVER_AMOUNT, buyer, poolOwner, 12n),
        "BuyOver",
    );
    console.log("Waiting (expect bounce / no credit)…");
    await sleep(12000);

    const balAfterOver = await readJwBalance(buyerJwPredicted);
    const poolBalAfter = await readJwBalance(poolJw);
    console.log("Buyer after over-buy:", balAfterOver?.toString() ?? "n/a");
    console.log("Pool after over-buy:", poolBalAfter?.toString() ?? "n/a");

    if (
        balAfterOver != null &&
        balBeforeOver != null &&
        balAfterOver < balBeforeOver + BUY_OVER_AMOUNT
    ) {
        // Did not receive full 25M — good (either bounce or partial fail)
        if (balAfterOver === balBeforeOver) {
            results.buyOverLimit = "pass";
            console.log("PASS: over-limit buy did not credit buyer");
        } else {
            results.buyOverLimit = "fail";
            results.notes.push(
                `Over-limit buy partially credited delta=${(balAfterOver - balBeforeOver).toString()}`,
            );
            console.log("FAIL: partial credit on over-limit buy");
        }
    } else if (
        poolBalAfter != null &&
        poolBalBefore != null &&
        poolBalAfter === poolBalBefore
    ) {
        results.buyOverLimit = "pass";
        console.log("PASS: pool balance unchanged (transfer rejected)");
    } else {
        results.buyOverLimit = "fail";
        results.notes.push("Over-limit buy appears to have succeeded");
        console.log("FAIL: over-limit buy may have succeeded");
    }

    // ========== TEST 3: SELL BLOCKED ==========
    console.log("\n========== TEST 3: SELL BLOCKED (owner → pool) ==========");
    const ownerBalBefore = await readJwBalance(ownerJw);
    const poolBalBeforeSell = await readJwBalance(poolJw);

    await sendFrom(
        "owner",
        ownerJw,
        toNano("0.12"),
        jettonTransferBody(SELL_PROBE_AMOUNT, poolOwner, owner, 13n),
        "SellProbe",
    );
    console.log("Waiting (expect reject: Sells disabled)…");
    await sleep(12000);

    const ownerBalAfter = await readJwBalance(ownerJw);
    const poolBalAfterSell = await readJwBalance(poolJw);
    console.log("Owner AWN before/after:", ownerBalBefore?.toString(), "→", ownerBalAfter?.toString());
    console.log("Pool AWN before/after:", poolBalBeforeSell?.toString(), "→", poolBalAfterSell?.toString());

    if (ownerBalBefore != null && ownerBalAfter != null) {
        const lost = ownerBalBefore - ownerBalAfter;
        if (lost <= 0n) {
            results.sellBlocked = "pass";
            console.log("PASS: owner balance not reduced — sell blocked");
        } else if (lost >= SELL_PROBE_AMOUNT) {
            results.sellBlocked = "fail";
            results.notes.push("Sell succeeded while isSellEnabled=false");
            console.log("FAIL: sell appears to have succeeded");
        } else {
            results.sellBlocked = "fail";
            results.notes.push(`Owner lost partial ${lost.toString()} on sell probe`);
            console.log("FAIL: partial loss on blocked sell");
        }
    } else if (
        poolBalBeforeSell != null &&
        poolBalAfterSell != null &&
        poolBalAfterSell === poolBalBeforeSell
    ) {
        results.sellBlocked = "pass";
        console.log("PASS: pool did not receive sell amount");
    } else {
        results.sellBlocked = "unknown";
        results.notes.push("Could not conclusively verify sell block from balances");
        console.log("UNKNOWN: inconclusive sell-block check");
    }

    // Also try sell from buyer if they have tokens and config
    if (results.buyOk === "pass" && !trading.isSellEnabled) {
        console.log("\n========== TEST 3b: SELL from buyer → pool ==========");
        const bBefore = await readJwBalance(buyerJwPredicted);
        await sendFrom(
            "buyer",
            buyerJwPredicted,
            toNano("0.12"),
            jettonTransferBody(SELL_PROBE_AMOUNT, poolOwner, buyer, 14n),
            "SellFromBuyer",
        );
        await sleep(12000);
        const bAfter = await readJwBalance(buyerJwPredicted);
        console.log("Buyer AWN before/after sell:", bBefore?.toString(), "→", bAfter?.toString());
        if (bBefore != null && bAfter != null && bAfter >= bBefore) {
            console.log("PASS: buyer sell blocked");
            if (results.sellBlocked !== "fail") results.sellBlocked = "pass";
        } else if (bBefore != null && bAfter != null && bAfter < bBefore) {
            console.log("FAIL: buyer sell reduced balance");
            results.sellBlocked = "fail";
            results.notes.push("Buyer was able to sell to pool while sells disabled");
        }
    }

    // Persist report
    const report = {
        at: new Date().toISOString(),
        network: "testnet",
        results,
        addresses: {
            minter: minterAddr.toString(),
            pool: poolOwner.toString(),
            buyer: buyer.toString(),
            buyerJettonWallet: buyerJwPredicted.toString(),
        },
        amounts: {
            buyOk: BUY_OK_AMOUNT.toString(),
            buyOver: BUY_OVER_AMOUNT.toString(),
            sellProbe: SELL_PROBE_AMOUNT.toString(),
        },
    };
    writeFileSync(
        join(process.cwd(), "deployments", "testnet-trade-results.json"),
        JSON.stringify(report, null, 2),
    );

    console.log("\n========== SUMMARY ==========");
    console.log("buyOk:", results.buyOk);
    console.log("buyOverLimit:", results.buyOverLimit);
    console.log("sellBlocked:", results.sellBlocked);
    if (results.notes.length) console.log("notes:", results.notes);
    console.log("Saved deployments/testnet-trade-results.json");

    const failed =
        results.buyOk === "fail" ||
        results.buyOverLimit === "fail" ||
        results.sellBlocked === "fail";
    if (failed) process.exitCode = 1;
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
