import { readFileSync } from "node:fs";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";
const KEYS = JSON.parse(readFileSync(new URL("../../.data/keys.json", import.meta.url), "utf8"));
const client = createClient({ chain: studionet, account: privateKeyToAccount(KEYS.CREATOR.pk) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const code = readFileSync(new URL("./registry_probe.py", import.meta.url), "utf8");
if (code.includes("\r")) throw new Error("CR bytes in the probe");
const wait = async (hash, label) => {
  for (let i = 0; i < 90; i++) {
    await sleep(6000);
    try {
      const t = await client.getTransaction({ hash });
      const st = t.statusName ?? t.status_name ?? t.status;
      if (i % 5 === 0) console.log(`  ${label} ${st}`);
      if (["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED", "LEADER_TIMEOUT"].includes(String(st))) return t;
    } catch {}
  }
  throw new Error(`${label} never landed`);
};
const dep = await client.deployContract({ code, args: [] });
console.log("deploy", dep);
const dt = await wait(dep, "deploy");
const addr = dt.data?.contract_address ?? dt.contract_address ?? dt.to_address ?? dt.recipient;
console.log("address", addr);
const h = await client.writeContract({ address: addr, functionName: "probe", args: [process.argv[2] ?? "5493001KJTIIGC8Y1R12"], value: 0n });
console.log("probe", h);
const pt = await wait(h, "probe");
console.log("result_name", pt.resultName ?? pt.result_name, "status", pt.statusName ?? pt.status_name);
await sleep(4000);
console.log("last", await client.readContract({ address: addr, functionName: "get_last", args: [] }));
