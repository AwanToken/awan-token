/**
 * Owner SweepTaxJettons on testnet minter → destination (default: owner).
 * Verifies pending tax before/after. Does NOT fund the DEX pool with TON.
 *
 * Run: npx tsx scripts/sweepTaxTestnet.ts
 */
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import {
    Address,
    beginCell,
    Cell,
    internal,
    SendMode,
    toNano,
} from "@ton/core";
import { TonClient, WalletContractV5R1 } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import {
    AwanToken,
    storeSweepTaxJettons,
} from "../build/AwanToken_AwanToken";

const GID = -3;
const RPC_GAP = 2000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function is429(err: unknown): boolean {
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
            if (!is429(err) || i === max) throw err;
            const wait = Math.min(60_000, 3000 * 2 ** (i - 1));
            console.warn(`[429] ${label} retry ${i} in ${wait / 1000}s`);
            await sleep(wait);
        }
    }
    throw last;
}

async function main() {
    const mnemonic = process.env.WALLET_MNEMONIC?.trim();
    if (!mnemonic) throw new Error("WALLET_MNEMONIC required");

    const endpoint =
        process.env.TON_RPC_ENDPOINT?.trim() ||
        "https://testnet.toncenter.com/api/v2/jsonRPC";
    const client = new TonClient({ endpoint });
    console.log("RPC:", endpoint);

    const deployPath = join(process.cwd(), "deployments", "testnet.json");
    if (!existsSync(deployPath)) throw new Error("deployments/testnet.json missing");
    const dep = JSON.parse(readFileSync(deployPath, "utf8"));
    const minterAddr = Address.parse(dep.minter);

    const key = await mnemonicToPrivateKey(mnemonic.split(/\s+/));
    const wallet = WalletContractV5R1.create({
        publicKey: key.publicKey,
        walletId: { networkGlobalId: GID },
    });
    const opened = client.open(wallet);
    const owner = wallet.address;
    console.log("Owner:", owner.toString());
    console.log("Minter:", minterAddr.toString());

    // Destination: env SWEEP_DEST or owner (testnet-safe)
    const dest = Address.parse(
        process.env.SWEEP_DEST?.trim() || owner.toString(),
    );
    console.log("Sweep dest:", dest.toString());

    const minter = client.open(AwanToken.fromAddress(minterAddr));
    await sleep(RPC_GAP);
    const pendingBefore = await withRetry("pendingTax", () =>
        minter.getGetPendingTaxJettons(),
    );
    console.log("pendingTaxJettons before:", pendingBefore.toString());

    if (pendingBefore <= 0n) {
        console.log("Nothing to sweep — sell tax may not have credited yet, or already swept.");
        console.log("Done (no-op).");
        return;
    }

    async function send(body: Cell, label: string) {
        await sleep(RPC_GAP);
        const seqno = await withRetry(`seqno ${label}`, () => opened.getSeqno());
        console.log(`${label}: seqno=${seqno}`);
        await withRetry(`send ${label}`, () =>
            opened.sendTransfer({
                seqno,
                secretKey: key.secretKey,
                sendMode: SendMode.PAY_GAS_SEPARATELY,
                messages: [
                    internal({
                        to: minterAddr,
                        value: toNano("0.15"),
                        bounce: true,
                        body,
                    }),
                ],
            }),
        );
        console.log(`${label}: submitted`);
        for (let i = 0; i < 40; i++) {
            await sleep(2500);
            const n = await withRetry(`wait ${label}`, () => opened.getSeqno());
            if (n > seqno) {
                console.log(`${label}: confirmed (seqno ${n})`);
                return;
            }
        }
        console.warn(`${label}: timeout waiting seqno`);
    }

    const body = beginCell()
        .store(
            storeSweepTaxJettons({
                $$type: "SweepTaxJettons",
                queryId: BigInt(Date.now() % 1_000_000_000),
                destination: dest,
                amount: 0n, // all pending
            }),
        )
        .endCell();

    await send(body, "SweepTaxJettons");
    await sleep(8000);

    const pendingAfter = await withRetry("pendingTax2", () =>
        minter.getGetPendingTaxJettons(),
    );
    console.log("pendingTaxJettons after:", pendingAfter.toString());

    const ok = pendingAfter < pendingBefore;
    console.log(ok ? "PASS: pending tax reduced" : "FAIL: pending tax unchanged");

    const out = {
        at: new Date().toISOString(),
        minter: minterAddr.toString(),
        destination: dest.toString(),
        pendingBefore: pendingBefore.toString(),
        pendingAfter: pendingAfter.toString(),
        result: ok ? "pass" : "fail",
    };
    writeFileSync(
        join(process.cwd(), "deployments", "testnet-sweep-tax-results.json"),
        JSON.stringify(out, null, 2),
    );
    console.log("Saved deployments/testnet-sweep-tax-results.json");
    if (!ok) process.exitCode = 1;
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
