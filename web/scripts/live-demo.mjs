/**
 * The live demo arc, against the real deployment with real GEN.
 *
 *   node scripts/live-demo.mjs <address>
 *
 * The §-numbered flow from the build spec, end to end and honestly waited
 * out — the assessment's challenge window is real time, not a mock:
 *
 *   1. Acme (seller) registers FAC-DEMO invoice, commits evidence v1
 *   2. MegaRetail's wallet (buyer) ACKNOWLEDGES the obligation on-chain
 *   3. the panel judges v1 under consensus → PENDING_FINALITY
 *   4. two wall probes are refused (wrong-value fund, stranger repay)
 *   5. the window lapses → anyone finalizes → FINANCEABLE, table terms
 *   6. the capital provider funds the exact derived advance
 *   7. the seller claims the advance
 *   8. the buyer's wallet files an on-chain DISPUTE; a challenger bonds
 *      new contradicting evidence; reassessment re-judges the record
 *      (post-funding: monitoring flips, funded terms untouched)
 *   9. the buyer repays in full; settlement prepares then executes;
 *      every party claims; the book must reconcile
 *
 * Exit code 0 only if every step lands and every refusal refuses.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ADDRESS = (process.argv[2] ?? "").trim();
if (!/^0x[0-9a-fA-F]{40}$/.test(ADDRESS)) {
  console.error("usage: node scripts/live-demo.mjs <contract-address>");
  process.exit(1);
}

const KEYS = JSON.parse(readFileSync(join(ROOT, ".data", "keys.json"), "utf8"));
const CAST = {
  SELLER: KEYS.CREATOR,     // Acme Industrial Supplies
  BUYER: KEYS.YES,          // MegaRetail Ltd — the wallet that countersigns
  PROVIDER: KEYS.NO,        // the capital provider
  CHALLENGER: KEYS.THIRD,
};
const clientFor = (name) =>
  createClient({ chain: studionet, account: privateKeyToAccount(CAST[name].pk) });
const reader = createClient({ chain: studionet });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const ok = (label, extra = "") => console.log(`  ok    ${label}${extra ? `  (${extra})` : ""}`);
const bad = (label, extra = "") => { failures++; console.log(`  FAIL  ${label}${extra ? `  (${extra})` : ""}`); };
const info = (label) => console.log(`  ..    ${label}`);

async function read(fn, args = []) {
  for (let i = 0; i < 6; i++) {
    try {
      const raw = await reader.readContract({ address: ADDRESS, functionName: fn, args });
      return typeof raw === "string" && raw ? JSON.parse(raw) : raw;
    } catch (e) {
      if (i === 5) throw e;
      await sleep(4000 * (i + 1));
    }
  }
}

async function write(who, fn, args = [], value = 0n) {
  const c = clientFor(who);
  const hash = await c.writeContract({ address: ADDRESS, functionName: fn, args, value });
  return hash;
}

async function until(label, fn, tries = 40, gap = 10_000) {
  for (let i = 0; i < tries; i++) {
    await sleep(gap);
    try {
      if (await fn()) return true;
    } catch { /* transient read */ }
  }
  // A step that never lands invalidates everything after it: stop loudly
  // with the failure on record instead of narrating a fiction.
  bad(`timed out waiting: ${label}`);
  console.log(`
ARC ABORTED at: ${label}`);
  process.exit(1);
}

async function mustRefuse(label, who, fn, args, value = 0n) {
  try {
    const hash = await write(who, fn, args, value);
    // The write was accepted into the mempool — the refusal shows up as the
    // transaction finalizing with an errored deciding receipt.
    for (let i = 0; i < 20; i++) {
      await sleep(8000);
      const t = await clientFor(who).getTransaction({ hash });
      const status = t?.statusName ?? "";
      if (status === "FINALIZED" || status === "ACCEPTED") {
        const deciding = t?.consensus_data?.leader_receipt?.[0]?.execution_result;
        if (deciding === "ERROR" || deciding === "FINISHED_WITH_ERROR") {
          ok(`refused: ${label}`);
        } else {
          bad(`the wall did not hold: ${label}`, `receipt ${deciding}`);
        }
        return;
      }
    }
    bad(`refusal probe never decided: ${label}`);
  } catch (e) {
    // Estimation-level rejection is also a refusal, and a cheaper one.
    ok(`refused: ${label}`, String(e?.message ?? e).slice(0, 60).replace(/\s+/g, " "));
  }
}

const gen = (atto) => `${(Number(BigInt(atto) / 10n ** 12n) / 1e6).toFixed(3)} GEN`;

// ─────────────────────────────────────────────────────────────────────────────

console.log(`FACTORA LIVE DEMO  ·  ${ADDRESS}\n`);

const AMOUNT = 10n ** 17n;                 // 0.1 GEN face
const WINDOW = 900;                        // the minimum real challenge window
const now = Math.floor(Date.now() / 1000);
const reference = `INV-DEMO-${now}`;

// 1 ── register + commit ──────────────────────────────────────────────────────
console.log("1. Acme registers the receivable and commits evidence v1");
{
  const before = (await read("get_invoices_for", [CAST.SELLER.addr])) ?? [];
  await write("SELLER", "create_invoice", [
    CAST.BUYER.addr, reference, AMOUNT.toString(), "2026-08-15",
    now + 14 * 86400, now + 7 * 86400, WINDOW,
  ]);
  await until("invoice registered", async () => {
    const mine = (await read("get_invoices_for", [CAST.SELLER.addr])) ?? [];
    return mine.length > before.length;
  });
}
const mine = await read("get_invoices_for", [CAST.SELLER.addr]);
const INV = mine[mine.length - 1].invoice_id;
ok(`registered as ${INV}`, reference);

const ITEMS = [
  { type: "invoice", label: "Invoice",
    content: `INVOICE ${reference}. Acme Industrial Supplies bills MegaRetail Ltd 0.100 GEN for 40 pallets of industrial fasteners delivered to the Apapa distribution warehouse. Payment terms: net 14 days from issue.` },
  { type: "purchase_order", label: "Purchase order",
    content: "PURCHASE ORDER PO-2291. MegaRetail Ltd orders from Acme Industrial Supplies: 40 pallets industrial fasteners, 0.100 GEN total, deliver to Apapa distribution warehouse. Authorized by procurement." },
  { type: "delivery_receipt", label: "Delivery receipt",
    content: "DELIVERY RECEIPT. Consignment of 40 pallets received complete at Apapa distribution warehouse. Goods inspected on arrival and accepted without reservation. Signed: receiving clerk, MegaRetail." },
  { type: "payment_history", label: "Payment history",
    content: "PAYMENT HISTORY EXTRACT. MegaRetail Ltd settled the previous four invoices from this supplier in full, each within its stated terms, most recently one month ago. No chargebacks recorded." },
];
{
  await write("SELLER", "commit_evidence", [INV, JSON.stringify(ITEMS)]);
  await until("evidence v1 committed", async () => {
    const v = await read("get_invoice", [INV]);
    return v.evidence_version === 1;
  });
  const v = await read("get_invoice", [INV]);
  ok("evidence v1 committed", `root ${v.evidence_root.slice(0, 16)}…`);
}

// 2 ── the buyer countersigns ────────────────────────────────────────────────
console.log("\n2. MegaRetail's own wallet acknowledges the obligation");
{
  await write("BUYER", "acknowledge_invoice", [INV]);
  await until("acknowledged", async () =>
    (await read("get_invoice", [INV])).buyer_ack_epoch > 0);
  ok("countersigned on-chain — the fact a seller cannot manufacture");
}

// 3 ── the panel judges ──────────────────────────────────────────────────────
console.log("\n3. The record goes to the panel (consensus round, real validators)");
{
  await write("SELLER", "request_assessment", [INV]);
  await until("panel ruled", async () =>
    (await read("get_invoice", [INV])).status === "PENDING_FINALITY", 40, 10_000);
  const v = await read("get_invoice", [INV]);
  const a = await read("get_assessment", [INV, 1]);
  ok(`panel ruled: ${a.decision} · ${a.risk} · score ${a.score}`);
  ok(`examined ${a.examined_count} of ${a.committed_count}, excluded ${a.excluded_count}`);
  info(`findings: seller ${a.seller_finding} · buyer ${a.buyer_finding} · transaction ${a.transaction_finding}`);
  info(`reason: ${a.reason}`);
  info(`window closes ${new Date(v.pending_until_epoch * 1000).toISOString()}`);
}

// 4 ── walls, probed live ────────────────────────────────────────────────────
console.log("\n4. The walls hold while the verdict is pending");
await mustRefuse("funding before finality", "PROVIDER", "fund", [INV], 10n ** 16n);
await mustRefuse("a stranger repaying", "CHALLENGER", "repay", [INV], AMOUNT);

// 5 ── finality ──────────────────────────────────────────────────────────────
console.log("\n5. The challenge window lapses; promotion is permissionless");
{
  const v = await read("get_invoice", [INV]);
  const wait = v.pending_until_epoch - Math.floor(Date.now() / 1000) + 30;
  if (wait > 0) {
    info(`waiting ${wait}s of real window`);
    await sleep(wait * 1000);
  }
  await write("CHALLENGER", "finalize_assessment", [INV]);
  await until("promoted", async () =>
    (await read("get_invoice", [INV])).status === "FINANCEABLE");
  const p = await read("get_invoice", [INV]);
  ok(`FINANCEABLE — advance ${p.advance_rate_bps} bps, fee ${p.fee_bps} bps (table on pinned risk)`);
  if (p.advance_rate_bps !== 8500 && p.advance_rate_bps !== 7000) {
    bad("terms are not from the acknowledged table");
  }
}

// 6 ── funding ───────────────────────────────────────────────────────────────
console.log("\n6. The capital provider funds the derived advance exactly");
{
  const p = await read("get_invoice", [INV]);
  const advance = BigInt(p.advance_atto);
  await mustRefuse("funding one atto short", "PROVIDER", "fund", [INV], advance - 1n);
  await write("PROVIDER", "fund", [INV], advance);
  await until("funded", async () =>
    (await read("get_invoice", [INV])).status === "FUNDED");
  ok(`funded with ${gen(advance)} — escrowed, seller credited`);
}

// 7 ── the seller takes the advance ──────────────────────────────────────────
console.log("\n7. Acme claims the advance");
{
  await write("SELLER", "claim_advance", [INV]);
  await until("advance claimed", async () =>
    (await read("get_invoice", [INV])).advance_claimed === true);
  ok("advance claimed — the transfer rides finalization");
}

// 8 ── the world changes ─────────────────────────────────────────────────────
console.log("\n8. New facts: the buyer disputes on-chain; a challenger bonds evidence");
{
  await write("BUYER", "file_buyer_dispute",
    [INV, "A quality audit after acceptance found a third of the fasteners out of specification; we contest the invoiced amount."]);
  await until("dispute filed", async () =>
    (await read("get_invoice", [INV])).buyer_dispute_epoch > 0);
  ok("buyer dispute recorded from the buyer's own wallet");

  const p = await read("get_invoice", [INV]);
  const bond = BigInt(p.challenge_bond_required_atto);
  await write("CHALLENGER", "challenge", [
    INV,
    "The buyer's own on-chain dispute contradicts the clean-acceptance story this record was financed on.",
    JSON.stringify([{ type: "correspondence", label: "Quality audit notice",
      content: "AUDIT NOTICE. Post-acceptance inspection of the fastener consignment found 13 of 40 pallets outside tolerance. Replacement or credit requested from the supplier." }]),
  ], bond);
  await until("challenge open", async () =>
    (await read("get_invoice", [INV])).challenge_open === true);
  ok(`challenged with a ${gen(bond)} bond — evidence appended as v2`);

  await write("CHALLENGER", "reassess", [INV]);
  await until("reassessed", async () =>
    (await read("get_invoice", [INV])).challenge_open === false, 40, 10_000);
  const after = await read("get_invoice", [INV]);
  const a2 = await read("get_assessment", [INV, 2]);
  ok(`re-judged: ${a2.decision} · ${a2.risk} · score ${a2.score} (was ${ (await read("get_assessment", [INV, 1])).score })`);
  ok(`monitoring is now ${after.monitoring}; funded terms untouched (${after.advance_rate_bps} bps)`);
  if (!a2.conflicts.includes("BUYER_DISPUTE_OPEN")) {
    bad("the reassessment did not carry the buyer dispute as a conflict");
  }
  if (after.status !== "FUNDED") bad(`status drifted to ${after.status}`);
}

// 9 ── repayment and the split ───────────────────────────────────────────────
console.log("\n9. The buyer repays; the split prepares, executes, and reconciles");
{
  await write("BUYER", "repay", [INV], AMOUNT);
  await until("repaid", async () =>
    (await read("get_invoice", [INV])).status === "REPAID");
  ok(`repaid ${gen(AMOUNT)} into custody`);

  await write("CHALLENGER", "prepare_settlement", [INV]);
  await until("prepared", async () =>
    (await read("get_invoice", [INV])).status === "SETTLEMENT_READY");
  const s = (await read("get_invoice", [INV])).settlement;
  ok(`split prepared: provider ${gen(s.provider_total_atto)} · seller ${gen(s.seller_total_atto)}`);
  if (BigInt(s.provider_total_atto) + BigInt(s.seller_total_atto) !== AMOUNT) {
    bad("the prepared split does not conserve the repayment");
  }

  await write("CHALLENGER", "execute_settlement", [INV]);
  await until("settled", async () =>
    (await read("get_invoice", [INV])).status === "SETTLED");
  ok("executed — SETTLED");

  await mustRefuse("settling twice", "CHALLENGER", "execute_settlement", [INV]);

  for (const who of ["PROVIDER", "SELLER", "CHALLENGER"]) {
    const owed = await read("get_claimable", [CAST[who].addr]);
    if (BigInt(owed) > 0n) {
      await write(who, "claim", []);
      await until(`${who} claimed`, async () =>
        BigInt(await read("get_claimable", [CAST[who].addr])) === 0n);
      ok(`${who} claimed ${gen(owed)}`);
    } else {
      info(`${who} had nothing further to claim`);
    }
  }

  const stats = await read("get_stats", []);
  if (stats.escrow_atto === "0") {
    ok("custody reconciled to zero — every atto left through a claim");
  } else {
    bad(`custody did not drain: ${stats.escrow_atto} atto remain`);
  }
}

console.log(failures === 0
  ? `\nARC COMPLETE  ·  ${INV}  ·  0 failures`
  : `\nARC FINISHED WITH ${failures} FAILURES  ·  ${INV}`);
process.exit(failures === 0 ? 0 : 1);
