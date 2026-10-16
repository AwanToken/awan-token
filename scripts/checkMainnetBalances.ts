import "dotenv/config";
import { Address, fromNano } from "@ton/core";
import { TonClient } from "@ton/ton";

async function main() {
  const client = new TonClient({
    endpoint: "https://toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TONCENTER_API_KEY || undefined,
  });
  const addrs = [
    "UQA1G4lmw34UsL4P30mvW4k8WSCs1RHUkjXcp1DjE66L1ss9",
    "UQCKBs_vJoZzhIrcz46G4KieMA1xRPTA7ALT0KOnz-PhRou6",
    "UQBCRQ91LV540-R8ppHwkRpNUFILEpAqd5KBU9GIgtTlq3ii",
    "EQBCRQ91LV540-R8ppHwkRpNUFILEpAqd5KBU9GIgtTlqyVn",
  ];
  for (const a of addrs) {
    const addr = Address.parse(a);
    try {
      const bal = await client.getBalance(addr);
      const dep = await client.isContractDeployed(addr);
      console.log(a, "bal=" + fromNano(bal), "deployed=" + dep);
    } catch (e) {
      console.log(a, "ERR", String(e).slice(0, 100));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
