/**
 * Mainnet DeDust volatile pool: ~50 TON + 250M AWN, then SetDexPool → jetton vault.
 * Does NOT EnableTrading / SetSellEnabled.
 *
 * AWN source: owner jetton wallet (admin) by default — simulated pool wallet cannot
 * send while trading is OFF (contract gate). Set AWN_SOURCE=pool only after EnableTrading.
 *
 * Run: npm run setup:dedust:mainnet
 * Dry-run: DRY_RUN=1 npm run setup:dedust:mainnet
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
    Factory,
    MAINNET_FACTORY_ADDR,
    Asset,
    PoolType,
    ReadinessStatus,
    VaultJetton,
} from "@dedust/sdk";
import {
    AwanToken,
    storeSetDexPool,
    storePushWalletConfig,
} from "../build/AwanToken_AwanToken";
import { AwanWallet } from "../build/AwanToken_AwanWallet";

const DEFAULT_MAINNET_ENDPOINT = "https://toncenter.com/api/v2/jsonRPC";
const EXPLORER = "https://tonviewer.com";
const MAINNET_GLOBAL_ID = -239;
const RPC_GAP_MS = 5000;

const LIQUIDITY_AWN = 250_000_000n * 1_000_000_000n;

/** DeDust Factory opcodes (match @dedust/sdk) */
const OP_CREATE_VAULT = 0x21cfe02b;
const OP_CREATE_VOLATILE_POOL = 0x97d51f2f;
const OP_DEPOSIT_LIQUIDITY = 0xd55e4686;

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
        /too many requests/i.test(msg) ||
        /Ratelimit exceed/i.test(msg)
    );
}

function buildCreateVaultBody(asset: Asset, queryId = 0n): Cell {
    return beginCell()
        .storeUint(OP_CREATE_VAULT, 32)
        .storeUint(queryId, 64)
        .storeSlice(asset.toSlice())
        .endCell();
}

function buildCreateVolatilePoolBody(
    assets: [Asset, Asset],
    queryId = 0n,
): Cell {
    return beginCell()
        .storeUint(OP_CREATE_VOLATILE_POOL, 32)
        .storeUint(queryId, 64)
        .storeSlice(assets[0].toSlice())
        .storeSlice(assets[1].toSlice())
        .endCell();
}

function buildDepositTonLiquidityBody(
    poolType: PoolType,
    assets: [Asset, Asset],
    targetBalances: [bigint, bigint],
    amount: bigint,
    queryId = 0n,
): Cell {
    return beginCell()
        .storeUint(OP_DEPOSIT_LIQUIDITY, 32)
        .storeUint(queryId, 64)
        .storeCoins(amount)
        .storeUint(poolType, 1)
        .storeSlice(assets[0].toSlice())
        .storeSlice(assets[1].toSlice())
        .storeRef(
            beginCell()
                .storeCoins(0)
                .storeCoins(targetBalances[0])
                .storeCoins(targetBalances[1])
                .endCell(),
        )
        .storeMaybeRef(null)
        .storeMaybeRef(null)
        .endCell();
}

async function withRetry<T>(
    label: string,
    fn: () => Promise<T>,
    maxAttempts = 12,
): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (!isRateLimitError(err) || attempt === maxAttempts) throw err;
            const backoff = Math.min(45_000, 4000 * 2 ** (attempt - 1));
            console.warn(
                `[429] ${label}: retry ${attempt}/${maxAttempts - 1} in ${Math.round(backoff / 1000)}s`,
            );
            await sleep(backoff);
        }
    }
    throw lastErr;
}

type MainnetDeploy = {
    minter?: string;
    owner?: string;
    ownerJettonWallet?: string;
    poolJettonWallet?: string;
    dexPool?: string;
    [key: string]: unknown;
};

function loadDeploy(): MainnetDeploy {
    const path = join(process.cwd(), "deployments", "mainnet.json");
    if (!existsSync(path)) {
        throw new Error("deployments/mainnet.json missing");
    }
    return JSON.parse(readFileSync(path, "utf8"));
}

function parseLpTonAmount(): bigint {
    const nano = process.env.LP_TON_NANO?.trim();
    if (nano) return BigInt(nano);
    const ton = process.env.LP_TON_AMOUNT?.trim() || "50";
    return toNano(ton);
}

function parseLpAwnAmount(): bigint {
    const raw = process.env.LP_AWN_NANO?.trim();
    if (raw) return BigInt(raw);
    return LIQUIDITY_AWN;
}

type SendCtx = {
    client: TonClient;
    owner: Address;
    ownerWallet: ReturnType<typeof WalletContractV5R1.create>;
    ownerContract: ReturnType<TonClient["open"]>;
    secretKey: Buffer;
};

function isTransientSendError(err: unknown): boolean {
    if (isRateLimitError(err)) return true;
    const msg = err instanceof Error ? err.message : String(err);
    return (
        /exitcode=136/i.test(msg) ||
        /External message was not accepted/i.test(msg)
    );
}

async function sendOwnerTx(
    ctx: SendCtx,
    to: Address,
    value: bigint,
    body: Cell | undefined,
    label: string,
    bounce = true,
) {
    const { client, owner, ownerWallet, ownerContract, secretKey } = ctx;
    let seqno = 0;
    for (let attempt = 1; attempt <= 8; attempt++) {
        await sleep(RPC_GAP_MS);
        seqno = await withRetry(`getSeqno(${label})`, () =>
            ownerContract.getSeqno(),
        );
        const transfer = ownerWallet.createTransfer({
            seqno,
            secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            timeout: Math.floor(Date.now() / 1000) + 180,
            messages: [
                internal({
                    to,
                    value,
                    bounce,
                    body: body ?? beginCell().endCell(),
                }),
            ],
        });
        const ext = external({ to: owner, body: transfer });
        const boc = beginCell().store(storeMessage(ext)).endCell().toBoc();
        try {
            await sleep(RPC_GAP_MS);
            await withRetry(`sendBoc(${label})`, () => client.sendFile(boc));
            console.log(`${label}: submitted (seqno ${seqno})`);
            break;
        } catch (err) {
            if (!isTransientSendError(err) || attempt === 8) throw err;
            await sleep(Math.min(30_000, 5000 * attempt));
        }
    }
    await waitSeqnoBump(() => ownerContract.getSeqno(), seqno, label, 120);
}

async function waitSeqnoBump(
    getSeqno: () => Promise<number>,
    prev: number,
    label: string,
    maxWaitSec = 90,
) {
    for (let i = 0; i < maxWaitSec / 2; i++) {
        await sleep(2000);
        try {
            const next = await withRetry(`seqno(${label})`, getSeqno);
            if (next > prev) {
                console.log(`${label}: confirmed seqno ${next}`);
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

async function main() {
    const dryRun = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
    const skipSetDexPool =
        process.env.SKIP_SET_DEX_POOL === "1" ||
        process.env.SKIP_SET_DEX_POOL === "true";
    const awnSource = (process.env.AWN_SOURCE?.trim() || "owner").toLowerCase();

    const lpTon = parseLpTonAmount();
    const lpAwn = parseLpAwnAmount();
    const gasBuffer = toNano(process.env.GAS_BUFFER_TON?.trim() || "1.5");

    const mnemonic =
        process.env.WALLET_MNEMONIC_MAINNET?.trim() ||
        process.env.WALLET_MNEMONIC?.trim();
    if (!mnemonic) {
        throw new Error("Set WALLET_MNEMONIC_MAINNET or WALLET_MNEMONIC in .env");
    }

    const deploy = loadDeploy();
    const minterAddr = Address.parse(
        process.env.MINTER_ADDRESS?.trim() || deploy.minter || "",
    );

    const endpoint = resolveEndpoint();
    const apiKey = process.env.TONCENTER_API_KEY || undefined;
    console.log("NETWORK: mainnet");
    console.log("RPC:", endpoint);
    console.log("TONCENTER_API_KEY:", apiKey ? "set" : "missing (429 likely)");
    console.log("DRY_RUN:", dryRun);
    console.log("AWN_SOURCE:", awnSource);

    const client = new TonClient({
        endpoint,
        apiKey: endpoint.includes("toncenter.com") ? apiKey : undefined,
    });

    const ownerKeyPair = await mnemonicToPrivateKey(mnemonic.split(/\s+/));
    const ownerWallet = WalletContractV5R1.create({
        publicKey: ownerKeyPair.publicKey,
        walletId: { networkGlobalId: MAINNET_GLOBAL_ID },
    });
    const ownerContract = client.open(ownerWallet);
    const owner = ownerContract.address;

    const minter = client.open(AwanToken.fromAddress(minterAddr));
    const factory = client.open(Factory.createFromAddress(MAINNET_FACTORY_ADDR));

    const TON_ASSET = Asset.native();
    const AWN_ASSET = Asset.jetton(minterAddr);
    const assets: [Asset, Asset] = [TON_ASSET, AWN_ASSET];

    await sleep(RPC_GAP_MS);
    let ownerBalance = await withRetry("balance(owner)", () =>
        ownerContract.getBalance(),
    );
    console.log("Owner TON:", fromNano(ownerBalance));

    await sleep(RPC_GAP_MS);
    const ownerJwAddr = deploy.ownerJettonWallet
        ? Address.parse(deploy.ownerJettonWallet)
        : await withRetry("getWalletAddress(owner)", () =>
              minter.getGetWalletAddress(owner),
          );

    let awnSenderOwner = owner;
    let awnJettonWalletAddr = ownerJwAddr;

    if (awnSource === "pool") {
        const poolPath = join(process.cwd(), "deployments", "mainnet-pool.json");
        if (!existsSync(poolPath)) {
            throw new Error("AWN_SOURCE=pool requires deployments/mainnet-pool.json");
        }
        const poolFile = JSON.parse(readFileSync(poolPath, "utf8")) as {
            mnemonic?: string;
            address?: string;
        };
        if (!poolFile.mnemonic || !poolFile.address) {
            throw new Error("mainnet-pool.json incomplete");
        }
        console.warn(
            "AWN_SOURCE=pool: pool wallet cannot send AWN while trading is OFF — tx will likely fail.",
        );
        const poolKey = await mnemonicToPrivateKey(poolFile.mnemonic.trim().split(/\s+/));
        const poolW = WalletContractV5R1.create({
            publicKey: poolKey.publicKey,
            walletId: { networkGlobalId: MAINNET_GLOBAL_ID },
        });
        awnSenderOwner = poolW.address;
        awnJettonWalletAddr = deploy.poolJettonWallet
            ? Address.parse(deploy.poolJettonWallet)
            : await withRetry("getWalletAddress(pool)", () =>
                  minter.getGetWalletAddress(awnSenderOwner),
              );
        if (awnSource === "pool" && !dryRun) {
            throw new Error(
                "AWN on simulated pool wallet is locked until EnableTrading. Use AWN_SOURCE=owner (default) or EnableTrading first.",
            );
        }
    }

    await sleep(RPC_GAP_MS);
    const awnWallet = client.open(AwanWallet.fromAddress(awnJettonWalletAddr));
    const awnBal = (await withRetry("walletData(awn)", () =>
        awnWallet.getGetWalletData(),
    )).balance;
    console.log("AWN source JW:", awnJettonWalletAddr.toString());
    console.log("AWN balance:", awnBal.toString(), "nanoAWN");
    if (awnBal < lpAwn) {
        throw new Error(`Insufficient AWN: need ${lpAwn}, have ${awnBal}`);
    }

    await sleep(RPC_GAP_MS);
    const tonVault = client.open(
        await withRetry("getNativeVault", () => factory.getNativeVault()),
    );
    await sleep(RPC_GAP_MS);
    const awnVault = client.open(
        await withRetry("getJettonVault(AWN)", () =>
            factory.getJettonVault(minterAddr),
        ),
    );
    await sleep(RPC_GAP_MS);
    const pool = client.open(
        await withRetry("getPool(TON/AWN)", () =>
            factory.getPool(PoolType.VOLATILE, assets),
        ),
    );

    console.log("DeDust factory:", MAINNET_FACTORY_ADDR.toString());
    console.log("TON vault:", tonVault.address.toString());
    console.log("AWN vault (SetDexPool target):", awnVault.address.toString());
    console.log("Pool:", pool.address.toString());
    console.log(`${EXPLORER}/${pool.address.toString()}`);

    await sleep(RPC_GAP_MS);
    const tonVaultReady = await withRetry("tonVaultReady", () =>
        tonVault.getReadinessStatus(),
    );
    await sleep(RPC_GAP_MS);
    const awnVaultReady = await withRetry("awnVaultReady", () =>
        awnVault.getReadinessStatus(),
    );
    await sleep(RPC_GAP_MS);
    const poolReady = await withRetry("poolReady", () =>
        pool.getReadinessStatus(),
    );

    console.log("Readiness:", {
        tonVault: tonVaultReady,
        awnVault: awnVaultReady,
        pool: poolReady,
    });

    const targetBalances: [bigint, bigint] = [lpTon, lpAwn];

    let skipTonDeposit =
        process.env.SKIP_TON_DEPOSIT === "1" ||
        process.env.SKIP_TON_DEPOSIT === "true";
    try {
        const liqDep = client.open(
            await factory.getLiquidityDeposit({
                ownerAddress: owner,
                poolType: PoolType.VOLATILE,
                assets,
            }),
        );
        await sleep(RPC_GAP_MS);
        const depBal = await withRetry("liqDeposit.balances", () =>
            liqDep.getBalances(),
        );
        if (depBal[0] >= lpTon / 2n) {
            skipTonDeposit = true;
            console.log(
                "Liquidity deposit already holds TON:",
                fromNano(depBal[0]),
                "— skip TON deposit",
            );
        }
    } catch {
        /* deposit contract may not exist yet */
    }

    const minGasNeeded = lpTon + gasBuffer + toNano("1.2");
    const minResumeGas = toNano("1.5");
    if (
        !skipTonDeposit &&
        ownerBalance < minGasNeeded &&
        ownerBalance >= minResumeGas
    ) {
        skipTonDeposit = true;
        console.warn(
            "Resume: low owner TON — assuming TON LP step already sent; skip TON deposit",
        );
    }
    if (!dryRun) {
        if (!skipTonDeposit && ownerBalance < minGasNeeded) {
            throw new Error(
                `Need ~${fromNano(minGasNeeded)} TON (LP ${fromNano(lpTon)} + gas buffer). Have ${fromNano(ownerBalance)}`,
            );
        }
        if (skipTonDeposit && ownerBalance < minResumeGas) {
            throw new Error(
                `Need ~${fromNano(minResumeGas)} TON for AWN deposit + SetDexPool. Have ${fromNano(ownerBalance)}`,
            );
        }
    }

    const trading = await withRetry("getTradingState", () =>
        minter.getGetTradingState(),
    );
    console.log("Minter trading:", {
        isTradingEnabled: trading.isTradingEnabled,
        isSellEnabled: trading.isSellEnabled,
        dexPool: trading.dexPool?.toString() ?? null,
    });

    if (dryRun) {
        console.log("\n--- DRY RUN plan ---");
        console.log("LP TON:", fromNano(lpTon));
        console.log("LP AWN nano:", lpAwn.toString());
        console.log("Steps: create vault/pool if needed → deposit TON → deposit AWN → SetDexPool");
        console.log("SetDexPool address:", awnVault.address.toString());
        return;
    }

    const sendCtx: SendCtx = {
        client,
        owner,
        ownerWallet,
        ownerContract,
        secretKey: ownerKeyPair.secretKey,
    };

    console.log("Cooling 30s before DeDust txs…");
    await sleep(30_000);

    if (awnVaultReady === ReadinessStatus.NOT_DEPLOYED) {
        console.log("\n--- create AWN vault ---");
        await sendOwnerTx(
            sendCtx,
            MAINNET_FACTORY_ADDR,
            toNano("0.12"),
            buildCreateVaultBody(AWN_ASSET, 1n),
            "CreateVault",
        );
        await sleep(8000);
    }

    let poolReadyNow = poolReady;
    await sleep(RPC_GAP_MS);
    poolReadyNow = await withRetry("poolReady2", () =>
        pool.getReadinessStatus(),
    );
    if (poolReadyNow === ReadinessStatus.NOT_DEPLOYED) {
        console.log("\n--- create volatile pool TON/AWN ---");
        await sendOwnerTx(
            sendCtx,
            MAINNET_FACTORY_ADDR,
            toNano("0.28"),
            buildCreateVolatilePoolBody(assets, 2n),
            "CreatePool",
        );
        await sleep(10_000);
    } else if (poolReadyNow === ReadinessStatus.NOT_READY) {
        console.log("Pool exists but not ready — waiting 20s…");
        await sleep(20_000);
    }

    if (!skipTonDeposit) {
    const skipTonDeposit =
        process.env.SKIP_TON_DEPOSIT === "1" ||
        process.env.SKIP_TON_DEPOSIT === "true";
    if (skipTonDeposit) {
        console.log("\n--- SKIP deposit TON (already submitted / pending) ---");
    } else {
        console.log("\n--- deposit TON liquidity ---");
        await sendOwnerTx(
            sendCtx,
            tonVault.address,
            lpTon + toNano("0.35"),
            buildDepositTonLiquidityBody(
                PoolType.VOLATILE,
                assets,
                targetBalances,
                lpTon,
                3n,
            ),
            "DepositTON",
        );
        await sleep(10_000);
    }
    } else {
        console.log("\n--- skip TON deposit (already funded) ---");
    }

    console.log("\n--- deposit AWN liquidity ---");
    const depositPayload = VaultJetton.createDepositLiquidityPayload({
        poolType: PoolType.VOLATILE,
        assets,
        targetBalances,
    });
    // TEP-74 forward payload as ref (DeDust deposit cell is too large for inline slice)
    const jettonBody = beginCell()
        .storeUint(0xf8a7ea5, 32)
        .storeUint(BigInt(Date.now()), 64)
        .storeCoins(lpAwn)
        .storeAddress(awnVault.address)
        .storeAddress(owner)
        .storeMaybeRef(null)
        .storeCoins(toNano("0.4"))
        .storeMaybeRef(depositPayload)
        .endCell();

    await sendOwnerTx(
        sendCtx,
        awnJettonWalletAddr,
        toNano("0.55"),
        jettonBody,
        "DepositAWN",
    );

    console.log("Waiting for liquidity deposit to finalize…");
    for (let i = 0; i < 40; i++) {
        await sleep(3000);
        try {
            const lpWallet = client.open(await pool.getWallet(owner));
            const lpBal = await withRetry("lpBalance", () => lpWallet.getBalance());
            if (lpBal > 0n) {
                console.log("LP tokens received:", lpBal.toString());
                break;
            }
        } catch (e) {
            if (!isRateLimitError(e)) console.warn("LP poll:", String(e).slice(0, 80));
        }
    }

    await sleep(RPC_GAP_MS);
    let reserves: [bigint, bigint] | null = null;
    try {
        reserves = await withRetry("getReserves", () => pool.getReserves());
        console.log("Pool reserves:", reserves[0].toString(), reserves[1].toString());
    } catch {
        console.warn("Could not read pool reserves yet");
    }

    let setDexPoolTx = "skipped";
    if (!skipSetDexPool) {
        const setPoolBody = beginCell()
            .store(
                storeSetDexPool({
                    $$type: "SetDexPool",
                    queryId: 10n,
                    pool: awnVault.address,
                }),
            )
            .endCell();

        console.log("\n--- SetDexPool → AWN jetton vault ---");
        await sendOwnerTx(
            sendCtx,
            minterAddr,
            toNano("0.08"),
            setPoolBody,
            "SetDexPool",
        );
        setDexPoolTx = "submitted";
        await sleep(6000);

        const pushVaultBody = beginCell()
            .store(
                storePushWalletConfig({
                    $$type: "PushWalletConfig",
                    queryId: 11n,
                    walletOwner: awnVault.address,
                }),
            )
            .endCell();
        console.log("\n--- PushWalletConfig(vault) ---");
        await sendOwnerTx(
            sendCtx,
            minterAddr,
            toNano("0.1"),
            pushVaultBody,
            "PushConfigVault",
        );
    }

    await sleep(RPC_GAP_MS);
    const tradingAfter = await withRetry("getTradingState(after)", () =>
        minter.getGetTradingState(),
    );
    const ownerBalAfter = await withRetry("balance(after)", () =>
        ownerContract.getBalance(),
    );

    const outPath = join(process.cwd(), "deployments", "mainnet.json");
    const existing = loadDeploy();
    const updated = {
        ...existing,
        dexPool: awnVault.address.toString(),
        dedustPool: pool.address.toString(),
        dedustAwnVault: awnVault.address.toString(),
        dedustTonVault: tonVault.address.toString(),
        simulatedPoolOwner: deploy.poolOwner ?? deploy.dexPool,
        liquidityAmount: lpAwn.toString(),
        lpTonAmount: lpTon.toString(),
        lpCreatedAt: new Date().toISOString(),
        lpExplorer: {
            pool: `${EXPLORER}/${pool.address.toString()}`,
            awnVault: `${EXPLORER}/${awnVault.address.toString()}`,
            factory: `${EXPLORER}/${MAINNET_FACTORY_ADDR.toString()}`,
        },
        noteLp:
            "DeDust volatile LP live. SetDexPool → AWN jetton vault. Simulated pool AWN remains until EnableTrading + pool wallet transfer. Next: EnableTrading from Command Deck.",
        tradingFlags: {
            isTradingEnabled: tradingAfter.isTradingEnabled,
            isSellEnabled: tradingAfter.isSellEnabled,
            isDexLimitsEnabled: tradingAfter.isDexLimitsEnabled,
            dexPool: tradingAfter.dexPool ? tradingAfter.dexPool.toString() : null,
        },
        ownerTonAfterLp: fromNano(ownerBalAfter),
        setDexPoolStatus: setDexPoolTx,
        poolReserves: reserves
            ? { tonNano: reserves[0].toString(), awnNano: reserves[1].toString() }
            : null,
    };
    writeFileSync(outPath, JSON.stringify(updated, null, 2));

    console.log("\n=== Done ===");
    console.log("DeDust pool:", pool.address.toString());
    console.log("SetDexPool (vault):", awnVault.address.toString());
    console.log("Owner TON remaining:", fromNano(ownerBalAfter));
    console.log("Saved:", outPath);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
