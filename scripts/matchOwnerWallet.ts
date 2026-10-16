import "dotenv/config";
import { Address } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import {
  WalletContractV5R1,
  WalletContractV4,
  WalletContractV3R2,
} from "@ton/ton";

async function main() {
  const mn = process.env.WALLET_MNEMONIC?.trim();
  if (!mn) {
    console.log("NO_MNEMONIC");
    process.exit(1);
  }
  const key = await mnemonicToPrivateKey(mn.split(/\s+/));
  const target = Address.parse(
    "UQA1G4lmw34UsL4P30mvW4k8WSCs1RHUkjXcp1DjE66L1ss9",
  );
  const variants: [string, { address: Address }][] = [
    [
      "W5-239",
      WalletContractV5R1.create({
        publicKey: key.publicKey,
        walletId: { networkGlobalId: -239 },
      }),
    ],
    [
      "W5-3",
      WalletContractV5R1.create({
        publicKey: key.publicKey,
        walletId: { networkGlobalId: -3 },
      }),
    ],
    ["V4-0", WalletContractV4.create({ publicKey: key.publicKey, workchain: 0 })],
    [
      "V3R2-0",
      WalletContractV3R2.create({ publicKey: key.publicKey, workchain: 0 }),
    ],
  ];
  for (const [name, w] of variants) {
    console.log(
      name,
      w.address.toString({ bounceable: false, urlSafe: true }),
      "match=" + w.address.equals(target),
    );
  }
  console.log(
    "envWalletKeys",
    Object.keys(process.env)
      .filter((k) => /MNEMONIC|MAINNET|WALLET/i.test(k))
      .join(","),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
