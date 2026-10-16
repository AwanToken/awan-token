import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
    toNano,
    fromNano,
    beginCell,
    internal,
    external,
    storeMessage,
    SendMode,
    Address,
} from "@ton/core";
import { TonClient, WalletContractV5R1 } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";

const GID = -3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
    const endpoint =
        process.env.TON_RPC_ENDPOINT?.trim() ||
        "https://testnet.toncenter.com/api/v2/jsonRPC";
    const client = new TonClient({ endpoint });

    const ownerWords = process.env.WALLET_MNEMONIC!.trim().split(/\s+/);
    const ownerKey = await mnemonicToPrivateKey(ownerWords);
    const ownerW = WalletContractV5R1.create({
        publicKey: ownerKey.publicKey,
        walletId: { networkGlobalId: GID },
    });
    const owner = ownerW.address;
    console.log("Owner", owner.toString(), fromNano(await client.getBalance(owner)));

    async function withRetry<T>(fn: () => Promise<T>, n = 6): Promise<T> {
        let last: unknown;
        for (let i = 1; i <= n; i++) {
            try {
                return await fn();
            } catch (e) {
                last = e;
                const msg = e instanceof Error ? e.message : String(e);
                if (!msg.includes("429") && !(e as { status?: number })?.status) {
                    // still retry common rate limits
                }
                console.warn("retry", i, "…");
                await sleep(Math.min(60_000, 4000 * i));
            }
        }
        throw last;
    }

    async function sendAll(words: string[], label: string) {
        const key = await mnemonicToPrivateKey(words);
        const w = WalletContractV5R1.create({
            publicKey: key.publicKey,
            walletId: { networkGlobalId: GID },
        });
        const open = client.open(w);
        await sleep(2000);
        const deployed = await withRetry(() => client.isContractDeployed(w.address));
        await sleep(2000);
        const bal = await withRetry(() => client.getBalance(w.address));
        console.log(label, w.address.toString(), "deployed=" + deployed, "bal=" + fromNano(bal));
        if (!deployed || bal < toNano("0.05")) {
            console.log(label + ": skip");
            return;
        }
        await sleep(3000);
        const seqno = await withRetry(() => open.getSeqno());
        const sendVal = bal - toNano("0.02");
        if (sendVal <= 0n) {
            console.log(label + ": nothing");
            return;
        }
        const transfer = w.createTransfer({
            seqno,
            secretKey: key.secretKey,
            sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
            timeout: Math.floor(Date.now() / 1000) + 120,
            messages: [
                internal({
                    to: owner,
                    value: sendVal,
                    bounce: false,
                    body: beginCell().endCell(),
                }),
            ],
        });
        const boc = beginCell()
            .store(storeMessage(external({ to: w.address, body: transfer })))
            .endCell()
            .toBoc();
        await sleep(3000);
        await withRetry(() => client.sendFile(boc));
        console.log(label + ": sent", fromNano(sendVal));
        for (let i = 0; i < 25; i++) {
            await sleep(2500);
            try {
                if ((await withRetry(() => open.getSeqno())) > seqno) {
                    console.log(label + ": ok");
                    return;
                }
            } catch {
                await sleep(5000);
            }
        }
        console.warn(label + ": timeout");
    }

    const poolPath = join("deployments", "testnet-pool.json");
    if (existsSync(poolPath)) {
        const pool = JSON.parse(readFileSync(poolPath, "utf8"));
        await sendAll(pool.mnemonic.trim().split(/\s+/), "pool");
        await sleep(3000);
    }

    const buyerPath = join("deployments", "testnet-buyer.json");
    if (existsSync(buyerPath)) {
        const buyer = JSON.parse(readFileSync(buyerPath, "utf8"));
        await sendAll(buyer.mnemonic.trim().split(/\s+/), "buyer");
        await sleep(3000);
    }

    // Also reclaim leftover TON from old minter if any (owner-only Claim not implemented for excess)
    console.log("Owner after", fromNano(await client.getBalance(owner)));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
