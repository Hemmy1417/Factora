/**
 * Deploy contracts/factora.py to GenLayer StudioNet, or verify a deployment.
 *
 *   node scripts/deploy.mjs                deploy, wait, print the address
 *   node scripts/deploy.mjs verify 0x...   read the code back off the chain and
 *                                          compare it byte for byte
 *
 * Signs with the CREATOR key in web/.data/keys.json (gitignored). Refuses a
 * working copy that carries a single CR byte: a CRLF deployment can never be
 * byte-verified from a fresh clone, and this project has shipped that
 * mistake twice.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";

const SOURCE = new URL("../../contracts/factora.py", import.meta.url);
const RPC = "https://studio.genlayer.com/api";
const sha = (s) => createHash("sha256").update(s, "utf-8").digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const code = readFileSync(SOURCE, "utf-8");
if (code.includes("\r")) throw new Error("contracts/factora.py carries CR bytes; normalize to LF first");

const [cmd, arg] = process.argv.slice(2);
if (cmd === "verify") {
  const res = await fetch(RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "gen_getContractCode", params: [arg] }),
  });
  const r = (await res.json()).result;
  const raw = typeof r === "string" ? r : (r?.code ?? "");
  const live = raw.startsWith("# ") ? raw : Buffer.from(raw, "base64").toString("utf-8");
  console.log(`live  sha256 ${sha(live)}  (${live.length} chars)`);
  console.log(`repo  sha256 ${sha(code)}  (${code.length} chars)`);
  if (live !== code) {
    const a = live.split("\n"), b = code.split("\n");
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (a[i] !== b[i]) { console.log(`first difference at line ${i + 1}\n  live: ${a[i]}\n  repo: ${b[i]}`); break; }
    }
    console.error("verify: the deployed source does NOT match contracts/factora.py");
    process.exit(1);
  }
  console.log("verify: byte-for-byte identical");
} else {
  const KEYS = JSON.parse(readFileSync(new URL("../.data/keys.json", import.meta.url), "utf8"));
  const client = createClient({ chain: studionet, account: privateKeyToAccount(KEYS.CREATOR.pk) });
  console.log(`deploying contracts/factora.py (sha256 ${sha(code)})`);
  const hash = await client.deployContract({ code, args: [] });
  console.log(`deploy tx ${hash}`);
  for (let i = 0; i < 120; i++) {
    await sleep(6000);
    let t;
    try { t = await client.getTransaction({ hash }); } catch { continue; }
    const st = String(t.statusName ?? t.status);
    if (["ACCEPTED", "FINALIZED"].includes(st)) {
      const leader = t.consensus_data?.leader_receipt?.[0]?.execution_result;
      console.log(`${st}; leader ${leader}`);
      console.log(`CONTRACT ${t.data?.contract_address ?? t.recipient ?? t.to_address}`);
      process.exit(leader === "SUCCESS" ? 0 : 1);
    }
    if (["UNDETERMINED", "CANCELED", "LEADER_TIMEOUT"].includes(st)) { console.error(st); process.exit(1); }
  }
  console.error("the deployment never landed"); process.exit(1);
}
