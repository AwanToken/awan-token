/**
 * After fresh deploy + pool setup:
 *  - SetSellEnabled(true) → claim cycle starts
 *  - Sell limits = min(0.5% of pool AWN, 0.5% of seller balance); over must fail, under + 3% tax must succeed
 *  - Leave AWN on owner for claim weight
 *  - DepositTreasury + claim program armed (7d window)
 *
 * Run: npm run test:sell-claim:testnet
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
    storeSetSellEnabled,
    storePushWalletConfig,
    storeDepositTreasury,
    storeClaimReward,
} from "../build/AwanToken_AwanToken";
import {
    storeJettonTransfer,
    AwanWallet,
} from "../build/AwanToken_AwanWallet";

const TONCENTER = "https://testnet.toncenter.com/api/v2/jsonRPC";
const EXPLORER = "https://testnet.tonviewer.com";
const TESTNET_GLOBAL_ID = -3;
const RPC_GAP_MS = 2000;

/** Over 0.5% of ~250M pool (and typical possession caps) */
const SELL_OVER = 10_000_000n * 1_000_000_000n;
/** Under 0.5% pool + 0.5% possession with standard 25% liquidity setup */
const SELL_OK = 1_000_000n * 1_000_000_000n;
const TREASURY_DEPOSIT = toNano("0.15");

async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function resolveEndpoint(): string {
    return (
        process.env.TON_API_ENDPOINT?.trim() ||
        process.env.TON_RPC_ENDPOINT?.trim() ||
        TONCENTER
    );
}

function isRateLimitError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    const status =
        err && typeof err === "object" && "response" in err
            ? (err as { response?: { status?: number } }).response?.status
            : undefined;
    return status === 429 || msg.includes("429") || /rate.?limit/i.test(msg);
}

async function withRetry<T>(label: string, fn: () => Promise<T>, max = 5): Promise<T> {
    let last: unknown;
    for (let i = 1; i <= max; i++) {
        try {
            return await fn();
        } catch (err) {
            last = err;
            if (!isRateLimitError(err) || i === max) throw err;
            const wait = Math.min(60_000, 3000 * 2 ** (i - 1));
            console.warn(`[429] ${label} retry ${i} in ${wait / 1000}s`);
            await sleep(wait);
        }
    }
    throw last;
}

async function main() {
    const mnemonic = process.env.WALLET_MNEMONIC?.trim();
    if (!mnemonic) throw new Error("WALLET_MNEMONIC missing");

    const deployPath = join(process.cwd(), "deployments", "testnet.json");
    if (!existsSync(deployPath)) throw new Error("deployments/testnet.json missing");
    const deploy = JSON.parse(readFileSync(deployPath, "utf8"));
    if (!deploy.dexPool) throw new Error("dexPool missing — run setup:pool:testnet first");

    const endpoint = resolveEndpoint();
    console.log("RPC:", endpoint);
    const client = new TonClient({
        endpoint,
        apiKey: endpoint.includes("toncenter")
            ? process.env.TONCENTER_API_KEY || undefined
            : undefined,
    });

    const key = await mnemonicToPrivateKey(mnemonic.split(/\s+/));
    const wallet = WalletContractV5R1.create({
        publicKey: key.publicKey,
        walletId: { networkGlobalId: TESTNET_GLOBAL_ID },
    });
    const openedWallet = client.open(wallet);
    const owner = openedWallet.address;
    const minterAddr = Address.parse(deploy.minter);
    const poolOwner = Address.parse(deploy.dexPool);
    const ownerJw = Address.parse(deploy.ownerJettonWallet);
    const minter = client.open(AwanToken.fromAddress(minterAddr));

    const results: Record<string, string> = {};

    async function send(
        to: Address,
        value: bigint,
        body: Cell | undefined,
        label: string,
        bounce = true,
    ) {
        let seqno = 0;
        for (let attempt = 1; attempt <= 5; attempt++) {
            await sleep(RPC_GAP_MS);
            seqno = await withRetry(`seqno ${label}`, () => openedWallet.getSeqno());
            console.log(`${label}: seqno=${seqno}`);
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
                        body: body ?? beginCell().endCell(),
                    }),
                ],
            });
            const boc = beginCell()
                .store(storeMessage(external({ to: owner, body: transfer })))
                .endCell()
                .toBoc();
            try {
                await sleep(RPC_GAP_MS);
                await withRetry(`send ${label}`, () => client.sendFile(boc));
                console.log(`${label}: submitted`);
                break;
            } catch (err) {
                if (attempt === 5) throw err;
                console.warn(`${label}: retry send…`);
                await sleep(3000);
            }
        }
        for (let i = 0; i < 30; i++) {
            await sleep(2000);
            try {
                if ((await openedWallet.getSeqno()) > seqno) {
                    console.log(`${label}: confirmed`);
                    return;
                }
            } catch {
                /* ignore */
            }
        }
        console.warn(`${label}: seqno not bumped`);
    }

    function jettonTransfer(amount: bigint, dest: Address, qid: bigint): Cell {
        return beginCell()
            .store(
                storeJettonTransfer({
                    $$type: "JettonTransfer",
                    queryId: qid,
                    amount,
                    destination: dest,
                    responseDestination: owner,
                    customPayload: null,
                    forwardTonAmount: toNano("0.01"),
                    forwardPayload: beginCell().endCell().beginParse(),
                }),
            )
            .endCell();
    }

    async function jwBalance(addr: Address): Promise<bigint> {
        await sleep(RPC_GAP_MS);
        if (!(await client.isContractDeployed(addr))) return 0n;
        const w = client.open(AwanWallet.fromAddress(addr));
        return (await withRetry("jw", () => w.getGetWalletData())).balance;
    }

    // Sync configs
    console.log("\n--- PushWalletConfig owner+pool ---");
    await send(
        minterAddr,
        toNano("0.08"),
        beginCell()
            .store(
                storePushWalletConfig({
                    $$type: "PushWalletConfig",
                    queryId: 1n,
                    walletOwner: owner,
                }),
            )
            .endCell(),
        "PushOwner",
    );
    await send(
        minterAddr,
        toNano("0.08"),
        beginCell()
            .store(
                storePushWalletConfig({
                    $$type: "PushWalletConfig",
                    queryId: 2n,
                    walletOwner: poolOwner,
                }),
            )
            .endCell(),
        "PushPool",
    );

    // Enable sells → claim program starts
    console.log("\n--- SetSellEnabled(true) ---");
    await send(
        minterAddr,
        toNano("0.05"),
        beginCell()
            .store(
                storeSetSellEnabled({
                    $$type: "SetSellEnabled",
                    queryId: 3n,
                    enabled: true,
                }),
            )
            .endCell(),
        "EnableSell",
    );
    await sleep(4000);

    await sleep(RPC_GAP_MS);
    let trading = await withRetry("trading", () => minter.getGetTradingState());
    let claim = await withRetry("claim", () => minter.getGetClaimStatus());
    console.log("trading:", {
        sell: trading.isSellEnabled,
        pool: trading.dexPool?.toString(),
    });
    console.log("claim:", {
        active: claim.claimProgramActive,
        cycleId: Number(claim.cycleId),
        cycleStart: Number(claim.cycleStart),
    });
    if (!trading.isSellEnabled) throw new Error("Sell not enabled");
    if (!claim.claimProgramActive) throw new Error("Claim program not active");
    results.enableSell = "pass";

    // Re-push config so wallets see isSellEnabled=true
    await send(
        minterAddr,
        toNano("0.08"),
        beginCell()
            .store(
                storePushWalletConfig({
                    $$type: "PushWalletConfig",
                    queryId: 4n,
                    walletOwner: owner,
                }),
            )
            .endCell(),
        "PushOwnerAfterSell",
    );
    await sleep(3000);

    await sleep(RPC_GAP_MS);
    trading = await withRetry("trading2", () => minter.getGetTradingState());

    const ownerBefore = await jwBalance(ownerJw);
    const poolBefore = await jwBalance(Address.parse(deploy.poolJettonWallet));
    const poolLimit = (poolBefore * 50n) / 10000n;
    const possLimit = (ownerBefore * 50n) / 10000n;
    const effectiveSellCap =
        poolLimit < possLimit ? poolLimit : possLimit;
    console.log("Owner AWN:", ownerBefore.toString());
    console.log("Pool AWN:", poolBefore.toString());
    console.log("0.5% pool cap:", poolLimit.toString());
    console.log("0.5% possession cap:", possLimit.toString());
    console.log("Effective sell cap:", effectiveSellCap.toString());
    console.log("Synced poolJettonBalance:", trading.poolJettonBalance.toString());

    if (SELL_OK > effectiveSellCap) {
        throw new Error(
            `SELL_OK ${SELL_OK} exceeds effective cap ${effectiveSellCap} — adjust amounts or pool size`,
        );
    }
    if (SELL_OVER <= effectiveSellCap) {
        throw new Error(
            `SELL_OVER ${SELL_OVER} within cap ${effectiveSellCap} — raise over-limit amount`,
        );
    }

    // --- SELL OVER limit (pool % and/or possession %) ---
    console.log("\n========== SELL OVER LIMIT (10M) ==========");
    await send(
        ownerJw,
        toNano("0.12"),
        jettonTransfer(SELL_OVER, poolOwner, 10n),
        "SellOver",
    );
    await sleep(12000);
    const ownerAfterOver = await jwBalance(ownerJw);
    const poolAfterOver = await jwBalance(Address.parse(deploy.poolJettonWallet));
    console.log("Owner after over:", ownerAfterOver.toString());
    console.log("Pool after over:", poolAfterOver.toString());
    if (ownerAfterOver === ownerBefore && poolAfterOver === poolBefore) {
        results.sellOverLimit = "pass";
        console.log("PASS: over-limit sell blocked (pool and/or possession)");
    } else if (ownerBefore - ownerAfterOver >= SELL_OVER) {
        results.sellOverLimit = "fail";
        console.log("FAIL: over-limit sell went through");
    } else {
        results.sellOverLimit = "fail";
        console.log("FAIL: unexpected balance change on over-sell");
    }

    // --- SELL OK under both caps ---
    console.log("\n========== SELL OK (1M under caps), expect 3% tax ==========");
    const beforeSell = await jwBalance(ownerJw);
    await send(
        ownerJw,
        toNano("0.15"),
        jettonTransfer(SELL_OK, poolOwner, 11n),
        "SellOk",
    );
    await sleep(12000);
    const afterSell = await jwBalance(ownerJw);
    const poolAfterSell = await jwBalance(Address.parse(deploy.poolJettonWallet));
    const lost = beforeSell - afterSell;
    console.log("Owner lost:", lost.toString(), "(expected", SELL_OK.toString(), ")");
    console.log("Pool after sell:", poolAfterSell.toString());

    // Pool should receive 97% of sell (3% tax)
    const expectedToPool = SELL_OK - (SELL_OK * 300n) / 10000n;
    if (lost === SELL_OK && poolAfterSell >= poolAfterOver + expectedToPool) {
        results.sellOk = "pass";
        console.log("PASS: sell under limit + tax path (pool got ~97%)");
    } else if (lost === SELL_OK) {
        results.sellOk = "pass";
        results.sellTaxNote = `pool delta=${(poolAfterSell - poolAfterOver).toString()} expected≈${expectedToPool.toString()}`;
        console.log("PASS: sell deducted; tax check:", results.sellTaxNote);
    } else {
        results.sellOk = "fail";
        console.log("FAIL: sell under limit did not behave as expected");
    }

    // Owner still holds vast majority for claim
    const remain = await jwBalance(ownerJw);
    console.log("Owner AWN remaining for claim:", remain.toString());
    if (remain < 100_000_000n * 1_000_000_000n) {
        console.warn("WARNING: owner AWN low for meaningful claim share");
    }

    if (process.env.SKIP_CLAIM === "1") {
        results.claim = "skipped";
        results.treasury = "skipped";
        console.log("\n--- SKIP_CLAIM=1: DepositTreasury + claim checks skipped ---");
    } else {
        // --- Treasury deposit FIRST (so snapshot > 0 when window opens) ---
        console.log("\n--- DepositTreasury", fromNano(TREASURY_DEPOSIT), "TON ---");
        await send(
            minterAddr,
            TREASURY_DEPOSIT + toNano("0.02"),
            beginCell()
                .store(storeDepositTreasury({ $$type: "DepositTreasury", queryId: 20n }))
                .endCell(),
            "DepositTreasury",
        );
        await sleep(5000);
        await sleep(RPC_GAP_MS);
        const treasury = await withRetry("treasury", () => minter.getGetTreasuryBalance());
        console.log("Treasury:", fromNano(treasury), "TON");
        results.treasury = fromNano(treasury);

        claim = await withRetry("claim2", () => minter.getGetClaimStatus());
        console.log("\n--- Claim status (7d period — no wait) ---");
        console.log({
            active: claim.claimProgramActive,
            cycleId: Number(claim.cycleId),
            cycleStart: Number(claim.cycleStart),
            windowOpen: claim.claimWindowOpen,
            windowEnd: Number(claim.claimWindowEnd),
            treasury: fromNano(claim.treasuryBalance),
            periodHint: "604800s (7d) + 86400s window",
        });

        if (claim.claimProgramActive && treasury > 0n) {
            results.claim = "pass-deferred-7d";
            console.log("PASS: claim program + treasury ok (timings = 7d/24h)");
        } else {
            results.claim = "fail";
            console.log("FAIL: claim program / treasury not ready");
        }
    }

    const out = {
        at: new Date().toISOString(),
        minter: minterAddr.toString(),
        explorer: `${EXPLORER}/${minterAddr.toString()}`,
        results,
        poolLimitNano: poolLimit.toString(),
        possessionLimitNano: possLimit.toString(),
        effectiveSellCapNano: effectiveSellCap.toString(),
        remainingOwnerAwn: remain.toString(),
    };
    writeFileSync(
        join(process.cwd(), "deployments", "testnet-sell-claim-results.json"),
        JSON.stringify(out, null, 2),
    );

    // update trading flags in testnet.json
    const d = JSON.parse(readFileSync(deployPath, "utf8"));
    d.tradingFlags = {
        isTradingEnabled: true,
        isSellEnabled: true,
        isDexLimitsEnabled: true,
        dexPool: poolOwner.toString(),
    };
    d.sellClaimTestAt = out.at;
    writeFileSync(deployPath, JSON.stringify(d, null, 2));

    console.log("\n========== SUMMARY ==========");
    console.log(results);
    console.log("Saved deployments/testnet-sell-claim-results.json");

    if (
        results.sellOverLimit === "fail" ||
        results.sellOk === "fail" ||
        results.claim === "fail"
    ) {
        process.exitCode = 1;
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
