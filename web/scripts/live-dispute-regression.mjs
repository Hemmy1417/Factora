/**
 * The judges' regression, live and unmocked:
 *
 *   node scripts/live-dispute-regression.mjs <address>
 *
 *   1. register → commit v1 → the buyer countersigns → the panel judges
 *      (PENDING_FINALITY, real consensus round, real challenge window)
 *   2. the buyer's wallet DISPUTES mid-window → the pending verdict is
 *      struck the moment the transaction lands: status REVIEW, pending
 *      cleared, terms zeroed
 *   3. finalize and fund are probed and MUST refuse
 *   4. the buyer withdraws; the seller commits v2 with the resolution
 *      memo; the panel re-judges a record that shows dispute history
 *   5. the window lapses → finalize → FINANCEABLE with table terms
 *   6. fund → claim advance → repay → prepare → execute → claims — the
 *      book reconciles to the atto and custody for this instrument is 0
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
  console.error("usage: node scripts/live-dispute-regression.mjs <contract-address>");
  process.exit(1);
}

const KEYS = JSON.parse(readFileSync(join(ROOT, ".data", "keys.json"), "utf8"));
const CAST = {
  SELLER: KEYS.CREATOR,
  BUYER: KEYS.YES,
  PROVIDER: KEYS.NO,
  KEEPER: KEYS.THIRD,
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
  return c.writeContract({ address: ADDRESS, functionName: fn, args, value });
}

async function until(label, fn, tries = 40, gap = 10_000) {
  for (let i = 0; i < tries; i++) {
    await sleep(gap);
    try {
      if (await fn()) return true;
    } catch { /* transient read */ }
  }
  bad(`timed out waiting: ${label}`);
  console.log(`\nARC ABORTED at: ${label}`);
  process.exit(1);
}

async function mustRefuse(label, who, fn, args, value = 0n) {
  try {
    const hash = await write(who, fn, args, value);
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
    ok(`refused: ${label}`, String(e?.message ?? e).slice(0, 60).replace(/\s+/g, " "));
  }
}

const gen = (atto) => `${(Number(BigInt(atto) / 10n ** 12n) / 1e6).toFixed(3)} GEN`;

// ─────────────────────────────────────────────────────────────────────────────

console.log(`FACTORA DISPUTE-INVALIDATION REGRESSION  ·  ${ADDRESS}\n`);

const AMOUNT = 10n ** 17n;
const WINDOW = 900;
const now = Math.floor(Date.now() / 1000);
const reference = `INV-DEMO-${now}`;

// 1 ── register, commit, countersign, judge ──────────────────────────────────
console.log("1. Register, commit v1, countersign, and put it to the panel");
{
  const before = (await read("get_invoices_for", [CAST.SELLER.addr])) ?? [];
  await write("SELLER", "create_invoice", [
    CAST.BUYER.addr, reference, AMOUNT.toString(), "2026-08-20",
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
  await until("evidence v1 committed", async () =>
    (await read("get_invoice", [INV])).evidence_version === 1);
  await write("BUYER", "acknowledge_invoice", [INV]);
  await until("acknowledged", async () =>
    (await read("get_invoice", [INV])).buyer_ack_epoch > 0);
  ok("evidence v1 committed and countersigned on-chain");

  await write("SELLER", "request_assessment", [INV]);
  await until("panel ruled", async () =>
    (await read("get_invoice", [INV])).status === "PENDING_FINALITY", 40, 10_000);
  const a = await read("get_assessment", [INV, 1]);
  ok(`panel ruled on v1: ${a.decision} · ${a.risk} · score ${a.score}`);
  if (a.buyer_dispute_open !== false) bad("v1 dossier claims a dispute it never saw");
}

// 2 ── the regression: dispute lands AFTER the judgment ──────────────────────
console.log("\n2. Mid-window, the buyer's wallet disputes — the verdict must fall");
{
  await write("BUYER", "file_buyer_dispute", [INV,
    "A quality audit after acceptance found a third of the fasteners out of specification; we contest the invoiced amount."]);
  await until("dispute recorded and verdict struck", async () => {
    const v = await read("get_invoice", [INV]);
    return v.buyer_dispute_epoch > 0 && v.status === "REVIEW";
  });
  const v = await read("get_invoice", [INV]);
  if (v.pending_version === 0 && v.pending_until_epoch === 0) {
    ok("pending verdict struck: nothing awaits promotion");
  } else {
    bad("the pending verdict survived the dispute", `pending v${v.pending_version}`);
  }
  if (v.advance_rate_bps === 0 && v.fee_bps === 0) {
    ok("terms zeroed — no table row prices a repudiated record");
  } else {
    bad("terms survived", `${v.advance_rate_bps} bps`);
  }
  const dossier = await read("get_assessment", [INV, 1]);
  if (dossier && dossier.decision) {
    ok("the v1 dossier is preserved — effect struck, history kept");
  } else {
    bad("the v1 dossier vanished");
  }
}

// 3 ── the walls the judges asked about, probed live ─────────────────────────
console.log("\n3. Finalization and funding are probed and must refuse");
await mustRefuse("finalize over the struck verdict", "KEEPER", "finalize_assessment", [INV]);
await mustRefuse("funding the struck verdict", "PROVIDER", "fund", [INV], 10n ** 16n);

// 4 ── withdrawal, v2, and a judgment that reads the history ─────────────────
console.log("\n4. The buyer withdraws; v2 goes back to the panel with the history");
{
  await write("BUYER", "withdraw_buyer_dispute", [INV]);
  await until("withdrawn", async () =>
    (await read("get_invoice", [INV])).buyer_dispute_withdrawn_epoch > 0);
  const v = await read("get_invoice", [INV]);
  if (v.status === "REVIEW" && v.advance_rate_bps === 0) {
    ok("withdrawal does not resurrect terms — only a judgment can");
  } else {
    bad("withdrawal alone changed the money state", v.status);
  }

  const V2 = ITEMS.concat([{
    type: "other", label: "Resolution memo",
    content: "JOINT RESOLUTION MEMO. Following the quality audit, Acme replaced the 13 non-conforming pallets at its own cost on the buyer's dock. MegaRetail confirms the consignment is now complete and conforming and has withdrawn its on-chain dispute. The invoiced amount stands unchanged.",
  }]);
  await write("SELLER", "commit_evidence", [INV, JSON.stringify(V2)]);
  await until("evidence v2 committed", async () =>
    (await read("get_invoice", [INV])).evidence_version === 2);

  await write("SELLER", "request_assessment", [INV]);
  await until("panel ruled on v2", async () =>
    (await read("get_invoice", [INV])).status === "PENDING_FINALITY", 40, 10_000);
  const a = await read("get_assessment", [INV, 2]);
  ok(`panel ruled on v2: ${a.decision} · ${a.risk} · score ${a.score}`);
  if (a.buyer_dispute_open === false && a.buyer_dispute_withdrawn === true) {
    ok("the v2 dossier records the dispute as filed-and-withdrawn history");
  } else {
    bad("v2 dossier misstates the dispute history",
        `open=${a.buyer_dispute_open} withdrawn=${a.buyer_dispute_withdrawn}`);
  }
  info(`reason: ${a.reason}`);
}

// 5 ── window lapses, verdict promotes, money moves, book closes ─────────────
console.log("\n5. Window lapses → finalize → fund → repay → settle → reconcile");
{
  const v0 = await read("get_invoice", [INV]);
  const wait = v0.pending_until_epoch - Math.floor(Date.now() / 1000) + 30;
  if (wait > 0) {
    info(`waiting ${wait}s for the real challenge window`);
    await sleep(wait * 1000);
  }
  await write("KEEPER", "finalize_assessment", [INV]);
  await until("finalized", async () =>
    (await read("get_invoice", [INV])).status === "FINANCEABLE");
  const v = await read("get_invoice", [INV]);
  ok(`FINANCEABLE: advance ${v.advance_rate_bps} bps · fee ${v.fee_bps} bps`);

  const advance = (BigInt(v.amount_atto) * BigInt(v.advance_rate_bps)) / 10_000n;
  await write("PROVIDER", "fund", [INV], advance);
  await until("funded", async () =>
    (await read("get_invoice", [INV])).status === "FUNDED");
  ok(`funded with the exact derived advance`, gen(advance));

  await write("SELLER", "claim_advance", [INV]);
  await until("advance claimed", async () =>
    (await read("get_invoice", [INV])).advance_claimed === true);

  await write("BUYER", "repay", [INV], AMOUNT);
  await until("repaid", async () =>
    (await read("get_invoice", [INV])).status === "REPAID");
  await write("KEEPER", "prepare_settlement", [INV]);
  await until("settlement prepared", async () =>
    (await read("get_invoice", [INV])).status === "SETTLEMENT_READY");
  const prep = (await read("get_invoice", [INV])).settlement;
  const total = BigInt(prep.provider_total_atto) + BigInt(prep.seller_total_atto);
  if (total === AMOUNT) {
    ok("the prepared split conserves the repayment to the atto");
  } else {
    bad("the split does not conserve", `${total} vs ${AMOUNT}`);
  }
  await write("KEEPER", "execute_settlement", [INV]);
  await until("settled", async () =>
    (await read("get_invoice", [INV])).status === "SETTLED");

  await write("PROVIDER", "claim", []);
  await write("SELLER", "claim", []);
  // Patient on purpose: by this point the arc has spent most of an hour of
  // StudioNet's per-IP read budget, so these polls can fail transiently for
  // minutes while the chain state is already correct. Longer gaps, more
  // tries — the truth is settled, the harness just has to outlast the
  // rate limiter.
  await until("both parties drained their claimables", async () => {
    const a = await read("get_claimable", [CAST.PROVIDER.addr]);
    const b = await read("get_claimable", [CAST.SELLER.addr]);
    return a === "0" && b === "0";
  }, 60, 20_000);
  ok("claims drained — the instrument's custody is zero");
}

console.log(`\n${failures === 0 ? "REGRESSION ARC COMPLETE" : `${failures} FAILURES`}  invoice ${INV}`);
process.exit(failures === 0 ? 0 : 1);
