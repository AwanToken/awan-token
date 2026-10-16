/**
 * Deploy AwanToken to TON testnet and run MintInitial (full supply → owner wallet).
 *
 * Prerequisites:
 *  1. npm run build
 *  2. Copy .env.example → .env and set WALLET_MNEMONIC (+ optional TONCENTER_API_KEY)
 *  3. Fund the wallet with testnet TON: https://t.me/testgiver_ton_bot
 *
 * Run: npm run deploy:testnet
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
import { buildOnchainMetadata, DEFAULT_AWN_METADATA } from "../wrappers/jettonMetadata";

/** Public testnet RPC. Override with TON_RPC_ENDPOINT. */
const DEFAULT_TESTNET_ENDPOINT = "https://ton-testnet.gateway.tatum.io/jsonRPC";
const EXPLORER = "https://testnet.tonviewer.com";
/** Tonkeeper testnet uses W5 (V5R1) with networkGlobalId -3 */
const TESTNET_GLOBAL_ID = -3;
/** Space RPC calls to avoid public-endpoint 429 */
const RPC_GAP_MS = 1500;

async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
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

    const endpoint = process.env.TON_RPC_ENDPOINT?.trim() || DEFAULT_TESTNET_ENDPOINT;
    const apiKey = process.env.TONCENTER_API_KEY || undefined;
    console.log("RPC:", endpoint);
    const client = new TonClient({
        endpoint,
        apiKey: endpoint.includes("toncenter.com") ? apiKey : undefined,
    });

    const keyPair = await mnemonicToPrivateKey(words);
    // Match Tonkeeper testnet: Wallet V5R1 (W5), not V4
    const wallet = WalletContractV5R1.create({
        publicKey: keyPair.publicKey,
        walletId: { networkGlobalId: TESTNET_GLOBAL_ID },
    });
    const walletContract = client.open(wallet);
    const owner = walletContract.address;

    const balance = await walletContract.getBalance();
    console.log("Deployer:", owner.toString());
    console.log("Balance:", fromNano(balance), "TON");
    if (balance < toNano("0.4")) {
        throw new Error(
            "Need at least ~0.4 testnet TON for deploy. Faucet: https://actonscan.com/faucet or https://t.me/tnfaucet_bot",
        );
    }

    // --- Metadata (on-chain TEP-64) ---
    const meta = {
        ...DEFAULT_AWN_METADATA,
        name: process.env.JETTON_NAME || DEFAULT_AWN_METADATA.name,
        symbol: process.env.JETTON_SYMBOL || DEFAULT_AWN_METADATA.symbol,
        description: process.env.JETTON_DESCRIPTION || DEFAULT_AWN_METADATA.description,
        image: process.env.JETTON_IMAGE || DEFAULT_AWN_METADATA.image,
        decimals: process.env.JETTON_DECIMALS || DEFAULT_AWN_METADATA.decimals,
    };
    const content = buildOnchainMetadata(meta);
    console.log("Metadata:", meta);

    // --- Contract address from init ---
    const awan = await AwanToken.fromInit(owner, content);
    console.log("AwanToken address:", awan.address.toString());
    console.log("Explorer:", `${EXPLORER}/${awan.address.toString()}`);

    await sleep(RPC_GAP_MS);
    const walletDeployed = await client.isContractDeployed(owner);
    console.log("Wallet deployed:", walletDeployed);

    await sleep(RPC_GAP_MS);
    const already = await client.isContractDeployed(awan.address);
    if (already) {
        console.log("Contract already deployed. Sending MintInitial only (safe if genesis already done — will fail on-chain).");
    } else {
        console.log("Deploying with MintInitial (state init + mint in one message)...");
    }

    // Manual BOC: avoid sendTransfer's hidden isContractDeployed+sendBoc burst (429 on public RPCs)
    const mintBody = beginCell()
        .store(storeMintInitial({ $$type: "MintInitial", queryId: 0n }))
        .endCell();

    await sleep(RPC_GAP_MS);
    // seqno 0 if wallet still uninitialized; otherwise read on-chain
    let seqno = 0;
    if (walletDeployed) {
        const state = await walletContract.getSeqno();
        seqno = state;
        await sleep(RPC_GAP_MS);
    }
    console.log("Wallet seqno:", seqno);

    const transfer = wallet.createTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
        messages: [
            internal({
                to: awan.address,
                value: toNano("0.25"),
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
    await client.sendFile(boc);

    console.log("Tx submitted. Waiting for deploy...");

    // Wait until active
    let deployed = already;
    for (let i = 0; i < 40 && !deployed; i++) {
        await sleep(2500);
        deployed = await client.isContractDeployed(awan.address);
        process.stdout.write(".");
    }
    console.log("");

    if (!deployed) {
        throw new Error("Deploy not confirmed in time. Check explorer / wallet history.");
    }

    // Read getters
    const opened = client.open(AwanToken.fromAddress(awan.address));
    await sleep(RPC_GAP_MS);
    try {
        const jettonData = await opened.getGetJettonData();
        await sleep(RPC_GAP_MS);
        const walletAddr = await opened.getGetWalletAddress(owner);
        await sleep(RPC_GAP_MS);
        const treasury = await opened.getGetTreasuryBalance();
        console.log("--- On-chain state ---");
        console.log("totalSupply:", jettonData.totalSupply.toString());
        console.log("owner:", jettonData.owner.toString());
        console.log("owner jetton wallet:", walletAddr.toString());
        console.log("treasury (nanoTON):", treasury.toString());
    } catch (e) {
        console.warn("Getters not ready yet (try again in a few seconds):", e);
    }

    // Persist deployment info
    const outDir = join(process.cwd(), "deployments");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, "testnet.json");
    const payload = {
        network: "testnet",
        deployedAt: new Date().toISOString(),
        minter: awan.address.toString(),
        owner: owner.toString(),
        metadata: meta,
        explorer: `${EXPLORER}/${awan.address.toString()}`,
    };
    writeFileSync(outPath, JSON.stringify(payload, null, 2));
    console.log("Saved:", outPath);
    console.log("Done.");
    console.log("\nNext (later): SetDexPool → PushWalletConfig → EnableTrading → seed 25% liquidity.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
