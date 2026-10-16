import "dotenv/config";
import { fromNano } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { TonClient, WalletContractV5R1 } from "@ton/ton";

async function main() {
  const mn = process.env.WALLET_MNEMONIC?.trim();
  if (!mn) {
    console.log("NO_MNEMONIC");
    process.exit(1);
  }
  const key = await mnemonicToPrivateKey(mn.split(/\s+/));
  const testnet = WalletContractV5R1.create({
    publicKey: key.publicKey,
    walletId: { networkGlobalId: -3 },
  });
  const mainnet = WalletContractV5R1.create({
    publicKey: key.publicKey,
    walletId: { networkGlobalId: -239 },
  });
  console.log("testnetW5", testnet.address.toString());
  console.log("mainnetW5", mainnet.address.toString());
  console.log(
    "mainnetNonBounce",
    mainnet.address.toString({ bounceable: false, urlSafe: true }),
  );

  const endpoint =
    process.env.TON_RPC_ENDPOINT?.trim() ||
    "https://toncenter.com/api/v2/jsonRPC";
  const client = new TonClient({
    endpoint,
    apiKey: endpoint.includes("toncenter.com")
      ? process.env.TONCENTER_API_KEY || undefined
      : undefined,
  });
  const bal = await client.open(mainnet).getBalance();
  const deployed = await client.isContractDeployed(mainnet.address);
  console.log("mainnetBalanceTON", fromNano(bal));
  console.log("mainnetDeployed", deployed);
  console.log("enoughForDeploy", bal >= 400000000n); // 0.4 TON
  console.log("note50TonForPool", "Keep ~50 TON aside for DEX LP after seed AWN");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
