/**
 * Read live AwanToken state from testnet.
 * Usage: npm run read:testnet
 * Optional: MINTER_ADDRESS in .env, else deployments/testnet.json
 */
import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { Address, fromNano } from "@ton/core";
import { TonClient } from "@ton/ton";
import { AwanToken } from "../build/AwanToken_AwanToken";

const DEFAULT_TESTNET_ENDPOINT = "https://ton-testnet.gateway.tatum.io/jsonRPC";

async function main() {
    let minterStr = process.env.MINTER_ADDRESS?.trim();
    if (!minterStr) {
        const path = join(process.cwd(), "deployments", "testnet.json");
        if (!existsSync(path)) {
            throw new Error("Set MINTER_ADDRESS or run deploy first (deployments/testnet.json)");
        }
        minterStr = JSON.parse(readFileSync(path, "utf8")).minter;
    }

    const endpoint = process.env.TON_RPC_ENDPOINT?.trim() || DEFAULT_TESTNET_ENDPOINT;
    const client = new TonClient({
        endpoint,
        apiKey: endpoint.includes("toncenter.com")
            ? process.env.TONCENTER_API_KEY || undefined
            : undefined,
    });

    const minter = Address.parse(minterStr!);
    const opened = client.open(AwanToken.fromAddress(minter));

    console.log("Minter:", minter.toString());

    const data = await opened.getGetJettonData();
    const treasury = await opened.getGetTreasuryBalance();
    const trading = await opened.getGetTradingState();
    const claim = await opened.getGetClaimStatus();
    const ownerWallet = await opened.getGetWalletAddress(data.owner);

    console.log("totalSupply:", data.totalSupply.toString());
    console.log("mintable:", data.mintable);
    console.log("owner:", data.owner.toString());
    console.log("owner jetton wallet:", ownerWallet.toString());
    console.log("treasury:", fromNano(treasury), "TON");
    console.log("trading:", {
        isTradingEnabled: trading.isTradingEnabled,
        isSellEnabled: trading.isSellEnabled,
        isDexLimitsEnabled: trading.isDexLimitsEnabled,
        dexPool: trading.dexPool ? trading.dexPool.toString() : null,
        maxBuyLimitBp: Number(trading.maxBuyLimitBp),
        maxSellLimitBp: Number(trading.maxSellLimitBp),
        possessionLimitBp: Number(trading.possessionLimitBp),
        sellTaxBp: Number(trading.sellTaxBp),
        maxSellAbsolute: trading.maxSellAbsolute.toString(),
        poolJettonBalance: trading.poolJettonBalance.toString(),
    });
    console.log("claim:", {
        cycleId: Number(claim.cycleId),
        claimProgramActive: claim.claimProgramActive,
        claimWindowOpen: claim.claimWindowOpen,
        sellsEnabled: claim.sellsEnabled,
        treasuryBalance: fromNano(claim.treasuryBalance),
    });
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
