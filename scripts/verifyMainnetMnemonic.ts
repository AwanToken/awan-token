import "dotenv/config";
import { Address, fromNano, toNano } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { TonClient, WalletContractV5R1 } from "@ton/ton";

async function main() {
  const mn = process.env.WALLET_MNEMONIC_MAINNET?.trim();
  if (!mn) {
    console.log("STATUS missing_WALLET_MNEMONIC_MAINNET");
    process.exit(1);
  }
  const words = mn.split(/\s+/);
  console.log("STATUS wordCount", words.length);
  if (words.length < 12) {
    console.log("STATUS invalid_word_count");
    process.exit(1);
  }

  const key = await mnemonicToPrivateKey(words);
  const wallet = WalletContractV5R1.create({
    publicKey: key.publicKey,
    walletId: { networkGlobalId: -239 },
  });
  const uq = wallet.address.toString({ bounceable: false, urlSafe: true });
  const target = Address.parse(
    "UQA1G4lmw34UsL4P30mvW4k8WSCs1RHUkjXcp1DjE66L1ss9",
  );
  const match = wallet.address.equals(target);
  console.log("STATUS address", uq);
  console.log("STATUS matchesFundedOwner", match);

  const client = new TonClient({
    endpoint:
      process.env.TON_RPC_ENDPOINT?.trim() ||
      "https://toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TONCENTER_API_KEY || undefined,
  });
  const opened = client.open(wallet);
  let bal = 0n;
  try {
    bal = await opened.getBalance();
  } catch (e) {
    console.log("STATUS balanceError", String(e).slice(0, 80));
    process.exit(1);
  }
  console.log("STATUS balanceTON", fromNano(bal));
  console.log("STATUS enoughForDeploy", bal >= toNano("0.5"));
  console.log("STATUS ready", match && bal >= toNano("0.5"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
