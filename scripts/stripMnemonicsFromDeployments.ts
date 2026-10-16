import { readFileSync, writeFileSync, existsSync } from "fs";

const files = [
  "deployments/archive/testnet-pool-20261015-182451.json",
  "deployments/testnet-pool.json",
  "deployments/testnet-buyer.json",
];

for (const f of files) {
  if (!existsSync(f)) {
    console.log("skip missing", f);
    continue;
  }
  const j = JSON.parse(readFileSync(f, "utf8")) as Record<string, unknown>;
  const had = typeof j.mnemonic === "string";
  if (had) {
    delete j.mnemonic;
    j.mnemonicRemoved = true;
    j.note =
      "Seed removed from this file — keep a private backup offline if you still need this wallet";
    writeFileSync(f, JSON.stringify(j, null, 2));
  }
  console.log(
    f,
    "stripped=" + had,
    "addr=" + String(j.address ?? j.wallet ?? "n/a"),
  );
}
