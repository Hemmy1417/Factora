/**
 * v0.2.0, live and unmocked:
 *
 *   node scripts/live-v020.mjs <address>
 *
 * Four receivables. Each new panel finding runs twice: once where it must
 * fire, once where it must NOT, the two records differing in one fact.
 *
 *   A  identity, positive   both wallets name a real entity in the public
 *                           LEI register and the documents name those same
 *                           parties        -> both REGISTERED, top table
 *   B  identity, control    the same identifiers, but the documents name a
 *                           DIFFERENT buyer -> buyer CONTRADICTED, not
 *                           financeable, no terms
 *   C  claim, positive      the buyer contests 8 of 40 units; the delivery
 *                           note and a credit note show the shortfall
 *                                          -> SUPPORTED, the remainder is
 *                           financed AND owed; funded, repaid, settled to
 *                           the atto, custody zero
 *   D  claim, control       the same claim, but the delivery note is signed
 *                           for all 40 units and there is no credit note
 *                                          -> NOT supported: the remainder
 *                           is financed, the FULL invoice is still owed
 *
 * Exit code 0 only if every step lands and every assertion holds.
 * State is read from the chain before each send, so a run that loses its
 * network is resumed by running it again with RESUME=<unix seconds printed
 * at start>.
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
  console.error("usage: node scripts/live-v020.mjs <contract-address>");
  process.exit(1);
}

const KEYS = JSON.parse(readFileSync(join(ROOT, ".data", "keys.json"), "utf8"));
const CAST = { SELLER: KEYS.CREATOR, BUYER: KEYS.YES, PROVIDER: KEYS.NO, KEEPER: KEYS.THIRD };
const clientFor = (name) =>
  createClient({ chain: studionet, account: privateKeyToAccount(CAST[name].pk) });
const reader = createClient({ chain: studionet });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const ok = (label, extra = "") => console.log(`  ok    ${label}${extra ? `  (${extra})` : ""}`);
const bad = (label, extra = "") => { failures++; console.log(`  FAIL  ${label}${extra ? `  (${extra})` : ""}`); };
const info = (label) => console.log(`  ..    ${label}`);
const expect = (cond, label, extra = "") => (cond ? ok(label, extra) : bad(label, extra));

async function read(fn, args = []) {
  for (let i = 0; i < 8; i++) {
    try {
      const raw = await reader.readContract({ address: ADDRESS, functionName: fn, args });
      return typeof raw === "string" && raw ? JSON.parse(raw) : raw;
    } catch (e) {
      if (i === 7) throw e;
      await sleep(4000 * (i + 1));
    }
  }
}

async function write(who, fn, args = [], value = 0n) {
  for (let i = 0; i < 5; i++) {
    try {
      return await clientFor(who).writeContract({ address: ADDRESS, functionName: fn, args, value });
    } catch (e) {
      if (i === 4) throw e;
      await sleep(5000 * (i + 1));
    }
  }
}

// StudioNet allows 500 reads an hour per address. Polling every ten seconds
// spends most of that on waiting; twenty leaves room for the run itself.
async function until(label, fn, tries = 60, gap = 20_000) {
  for (let i = 0; i < tries; i++) {
    try {
      if (await fn()) return true;
    } catch { /* transient read */ }
    await sleep(gap);
  }
  bad(`timed out waiting: ${label}`);
  console.log(`\nRUN ABORTED at: ${label}`);
  process.exit(1);
}

/** Send only if the chain does not already show the effect. */
async function step(label, who, fn, args, done, value = 0n, tries = 60) {
  if (await done()) { info(`${label}: already on chain`); return; }
  await write(who, fn, args, value);
  await until(label, done, tries);
}

async function mustRefuse(label, who, fn, args, value = 0n) {
  try {
    const hash = await write(who, fn, args, value);
    for (let i = 0; i < 25; i++) {
      await sleep(8000);
      const t = await clientFor(who).getTransaction({ hash });
      const status = t?.statusName ?? "";
      if (status === "FINALIZED" || status === "ACCEPTED") {
        const deciding = t?.consensus_data?.leader_receipt?.[0]?.execution_result;
        expect(deciding === "ERROR" || deciding === "FINISHED_WITH_ERROR",
          `refused: ${label}`, `receipt ${deciding}`);
        return;
      }
    }
    bad(`refusal probe never decided: ${label}`);
  } catch (e) {
    ok(`refused: ${label}`, String(e?.message ?? e).slice(0, 60).replace(/\s+/g, " "));
  }
}

const gen = (atto) => `${(Number(BigInt(atto) / 10n ** 12n) / 1e6).toFixed(4)} GEN`;

// ─────────────────────────────────────────────────────────────────────────────

const STAMP = Number(process.env.RESUME ?? Math.floor(Date.now() / 1000));
console.log(`FACTORA v0.2.0 LIVE RUN  ·  ${ADDRESS}  ·  RESUME=${STAMP}\n`);

const cfg = await read("get_config");
expect(cfg.version === "0.2.0", "the deployed contract reports version 0.2.0", cfg.version);

const AMOUNT = 10n ** 17n;
const SHORT = AMOUNT / 5n;                 // 8 of 40 units
const WINDOW = 900;
const SELLER_LEI = "506700GE1G29325QX363";  // Global Legal Entity Identifier Foundation
const BUYER_LEI = "5493001KJTIIGC8Y1R12";   // Bloomberg Finance L.P.
const SELLER_NAME = "Global Legal Entity Identifier Foundation";
const BUYER_NAME = "Bloomberg Finance L.P.";

async function register(tag) {
  const reference = `INV-V020-${tag}-${STAMP}`;
  const find = async () =>
    ((await read("get_invoices_for", [CAST.SELLER.addr])) ?? []).find((v) => v.reference === reference);
  await step(`${tag}: registered`, "SELLER", "create_invoice", [
    CAST.BUYER.addr, reference, AMOUNT.toString(), "2026-09-01",
    STAMP + 14 * 86400, STAMP + 7 * 86400, WINDOW,
  ], async () => !!(await find()));
  const id = (await find()).invoice_id;
  ok(`${tag}: registered as ${id}`, reference);
  return { id, reference };
}

const inv = (id) => read("get_invoice", [id]);

const docs = (reference, buyerName, delivered, extra = []) => [
  { type: "invoice", label: "Invoice",
    content: `INVOICE ${reference}. ${SELLER_NAME} bills ${buyerName} 0.100 GEN for 40 annual reference-data licence seats at 0.0025 GEN each. Payment terms net 14 days from issue. Issued 2026-09-01.` },
  { type: "purchase_order", label: "Purchase order",
    content: `PURCHASE ORDER PO-7741. ${buyerName} orders from ${SELLER_NAME}: 40 annual reference-data licence seats, 0.100 GEN total. Authorized by the procurement desk of ${buyerName}.` },
  { type: "delivery_receipt", label: "Activation record", content: delivered },
  { type: "payment_history", label: "Payment history",
    content: `PAYMENT HISTORY EXTRACT. ${buyerName} settled the previous four invoices from ${SELLER_NAME} in full, each within its stated terms. No chargebacks and no open balances.` },
  ...extra,
];
const FULL = (buyerName) => `ACTIVATION RECORD. All 40 of 40 licence seats were activated for ${buyerName} and accepted without reservation. Signed by the licence administrator of ${buyerName}.`;

async function commitAndAck(tag, id, items) {
  await step(`${tag}: evidence v1 committed`, "SELLER", "commit_evidence", [id, JSON.stringify(items)],
    async () => (await inv(id)).evidence_version >= 1);
  await step(`${tag}: countersigned`, "BUYER", "acknowledge_invoice", [id],
    async () => (await inv(id)).buyer_ack_epoch > 0);
}

async function attestBoth(tag, id) {
  await step(`${tag}: the seller named its entity`, "SELLER", "attest_entity", [id, "GLEIF", SELLER_LEI],
    async () => (await inv(id)).seller_entity !== null);
  await step(`${tag}: the buyer named its entity`, "BUYER", "attest_entity", [id, "GLEIF", BUYER_LEI],
    async () => (await inv(id)).buyer_entity !== null);
}

async function judge(tag, id) {
  await step(`${tag}: the panel ruled`, "SELLER", "request_assessment", [id],
    async () => (await inv(id)).status !== "COMMITTED", 0n, 90);
  const a = await read("get_assessment", [id, 1]);
  info(`${tag}: ${a.decision} · ${a.risk} · score ${a.score} · identity ${JSON.stringify(a.identity)} · claim ${a.credit_claim_finding}`);
  info(`${tag}: ${a.reason}`);
  return a;
}

// A ── identity, positive ─────────────────────────────────────────────────────
console.log("A. Both parties are in the public register, and the documents name them");
const A = await register("A");
await commitAndAck("A", A.id, docs(A.reference, BUYER_NAME, FULL(BUYER_NAME)));
await mustRefuse("A: a stranger naming an entity for the seller", "KEEPER", "attest_entity", [A.id, "GLEIF", SELLER_LEI]);
await mustRefuse("A: an identifier with a wrong check digit", "SELLER", "attest_entity", [A.id, "GLEIF", "506700GE1G29325QX364"]);
await attestBoth("A", A.id);
await mustRefuse("A: the seller naming a second entity", "SELLER", "attest_entity", [A.id, "GLEIF", BUYER_LEI]);
const a = await judge("A", A.id);
expect(a.identity?.seller === "REGISTERED" && a.identity?.buyer === "REGISTERED",
  "A: both parties REGISTERED by the register every validator read");
expect(a.registry_rows?.length === 2 && a.registry_rows.every((r) => r.reachable && r.active && r.current),
  "A: both register records were read, active and current");
expect(a.registry_rows?.[1]?.excerpt?.includes(BUYER_NAME), "A: the stored record names the buyer's entity");
expect(!a.conflicts.includes("ENTITY_CONTRADICTED"), "A: no contradiction was raised on a matching record");

// C ── claim, positive (started now so its window runs alongside A's) ─────────
console.log("\nC. The buyer contests 8 of 40 seats, and the record shows the shortfall");
const C = await register("C");
await commitAndAck("C", C.id, docs(C.reference, BUYER_NAME,
  `ACTIVATION RECORD. 32 of 40 licence seats were activated for ${BUYER_NAME}. 8 seats could not be provisioned and were NOT delivered. Signed by the licence administrator of ${BUYER_NAME}.`,
  [{ type: "correspondence", label: "Credit note",
     content: `CREDIT NOTE CN-0412 against ${C.reference}. ${SELLER_NAME} credits ${BUYER_NAME} 0.020 GEN for 8 licence seats that were not delivered. The amount payable on the invoice is reduced to 0.080 GEN.` }]));
await mustRefuse("C: the seller filing the buyer's claim", "SELLER", "file_credit_claim",
  [C.id, SHORT.toString(), "Eight seats were never delivered."]);
await mustRefuse("C: a claim that swallows the invoice", "BUYER", "file_credit_claim",
  [C.id, AMOUNT.toString(), "None of it is owed at all."]);
await step("C: the claim is on the record", "BUYER", "file_credit_claim",
  [C.id, SHORT.toString(), "Eight of the forty seats were never activated; credit note CN-0412 refers."],
  async () => (await inv(C.id)).credit_claim_epoch > 0);
const c = await judge("C", C.id);
expect(c.credit_claim_open === true && c.credit_claim_finding === "SUPPORTED",
  "C: the panel found the claim SUPPORTED", c.credit_claim_finding);
expect(c.credit_corroboration?.length > 0, "C: an examined item stands behind the finding",
  (c.credit_corroboration ?? []).join(","));
expect(c.base_atto === (AMOUNT - SHORT).toString() && c.due_atto === (AMOUNT - SHORT).toString(),
  "C: the remainder is what is financed and what is owed", `${gen(c.base_atto)} / ${gen(c.due_atto)}`);
expect(c.decision === "FINANCEABLE", "C: a partial objection did not hold the whole record at review", c.decision);

// B ── identity, negative control ─────────────────────────────────────────────
console.log("\nB. CONTROL: the same identifiers, but the documents name a different buyer");
const B = await register("B");
const OTHER = "Harbour Freight Logistics SA";
await commitAndAck("B", B.id, docs(B.reference, OTHER, FULL(OTHER)));
await attestBoth("B", B.id);
const b = await judge("B", B.id);
expect(b.identity?.buyer !== "REGISTERED", "B: the buyer was NOT registered on a record naming someone else",
  b.identity?.buyer);
expect(b.identity?.buyer === "CONTRADICTED" && b.conflicts.includes("ENTITY_CONTRADICTED"),
  "B: the register contradicts the named buyer");
// Two honest verdicts deliver the property, and both are named. The code
// holds a contradicted party at REVIEW_REQUIRED; a panel that also finds
// the buyer pillar NOT_SUPPORTED, because the documents name someone the
// register does not, lands on NOT_FINANCEABLE. Either way nothing is priced.
// FINANCEABLE is not on the list and fails exactly as before.
expect(["REVIEW_REQUIRED", "NOT_FINANCEABLE"].includes(b.decision) && b.advance_rate_bps === 0,
  "B: no terms for a record whose buyer the register contradicts", b.decision);
expect(b.identity?.seller === "REGISTERED", "B: the seller, named correctly, is still REGISTERED");

// D ── claim, negative control ────────────────────────────────────────────────
console.log("\nD. CONTROL: the same claim, but the record shows all 40 seats delivered");
const D = await register("D");
await commitAndAck("D", D.id, docs(D.reference, BUYER_NAME, FULL(BUYER_NAME)));
await step("D: the claim is on the record", "BUYER", "file_credit_claim",
  [D.id, SHORT.toString(), "Eight of the forty seats were never activated."],
  async () => (await inv(D.id)).credit_claim_epoch > 0);
const d = await judge("D", D.id);
expect(d.credit_claim_finding !== "SUPPORTED", "D: the claim was NOT supported on a record that shows full delivery",
  d.credit_claim_finding);
expect(d.base_atto === (AMOUNT - SHORT).toString(), "D: the contested part is still not financed", gen(d.base_atto));
expect(d.due_atto === AMOUNT.toString(), "D: the full invoice is still owed", gen(d.due_atto));

// promotion ───────────────────────────────────────────────────────────────────
console.log("\nThe challenge windows lapse; anyone promotes");
for (const [tag, id] of [["A", A.id], ["C", C.id]]) {
  const v = await inv(id);
  if (v.status === "PENDING_FINALITY") {
    const wait = Math.max(0, v.pending_until_epoch - Math.floor(Date.now() / 1000)) + 60;
    info(`${tag}: window closes in ${wait}s`);
    await sleep(wait * 1000);
    await step(`${tag}: promoted`, "KEEPER", "finalize_assessment", [id],
      async () => (await inv(id)).status !== "PENDING_FINALITY");
  }
}
const av = await inv(A.id);
expect(av.status === "FINANCEABLE" && av.identity_tier === "REGISTERED"
  && av.advance_rate_bps === cfg.advance_bps[av.risk],
  "A: the top table applies: countersigned, both parties registered",
  `${av.status} · ${av.identity_tier} · ${av.advance_rate_bps} bps`);

// C ── the money ──────────────────────────────────────────────────────────────
console.log("\nC. Funded, repaid and settled on the remainder");
let cv = await inv(C.id);
const NET = AMOUNT - SHORT;
const ADVANCE = NET * BigInt(cv.advance_rate_bps) / 10_000n;
const FEE = NET * BigInt(cv.fee_bps) / 10_000n;
// The risk class is the panel's; the rate is the table's. Read both from
// the chain rather than assuming the class a run happened to land on.
expect(cv.identity_tier === "KEYS_ONLY" && cv.advance_rate_bps === cfg.advance_bps_keys_only[cv.risk],
  "C: countersigned on keys alone, so the middle table at the judged risk",
  `${cv.identity_tier} · ${cv.risk} · ${cv.advance_rate_bps} bps`);
expect(cv.advance_atto === ADVANCE.toString(), "C: the advance is priced on the remainder", gen(cv.advance_atto));
await mustRefuse("C: funding the advance of the uncontested invoice", "PROVIDER", "fund", [C.id],
  AMOUNT * BigInt(cv.advance_rate_bps) / 10_000n);
await step("C: funded", "PROVIDER", "fund", [C.id], async () => (await inv(C.id)).status !== "FINANCEABLE", ADVANCE);
await mustRefuse("C: repaying the full invoice when the remainder is owed", "BUYER", "repay", [C.id], AMOUNT);
await step("C: repaid", "BUYER", "repay", [C.id], async () => (await inv(C.id)).repaid_epoch > 0, NET);
await step("C: split prepared", "KEEPER", "prepare_settlement", [C.id],
  async () => ["SETTLEMENT_READY", "SETTLED"].includes((await inv(C.id)).status));
await step("C: settled", "KEEPER", "execute_settlement", [C.id], async () => (await inv(C.id)).status === "SETTLED");
cv = await inv(C.id);
const s = cv.settlement;
expect(s && BigInt(s.provider_total_atto) === ADVANCE + FEE && BigInt(s.seller_total_atto) === NET - ADVANCE - FEE,
  "C: the split conserves to the atto", s ? `provider ${gen(s.provider_total_atto)} · seller ${gen(s.seller_total_atto)}` : "no settlement");
for (const who of ["SELLER", "PROVIDER"]) {
  const owed = BigInt((await read("get_claimable", [CAST[who].addr])) ?? "0");
  if (owed > 0n) {
    await step(`${who} claimed ${gen(owed)}`, who, "claim", [],
      async () => BigInt((await read("get_claimable", [CAST[who].addr])) ?? "0") === 0n);
    ok(`${who} claimed`, gen(owed));
  }
}
const stats = await read("get_stats");
expect(stats.escrow_atto === "0", "custody is zero: every atto left through claim()", JSON.stringify(stats));

console.log(failures === 0 ? "\nEVERY STEP PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
