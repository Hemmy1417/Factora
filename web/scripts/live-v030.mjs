/**
 * v0.3.0, live and unmocked: who answers for an unpaid invoice.
 *
 *   node scripts/live-v030.mjs <address>            first run: prints RESUME=<n>
 *   RESUME=<n> node scripts/live-v030.mjs <address>  every later run
 *
 * A default cannot be hurried. The contract marks one only a full day after
 * the due date, so this run has two sittings and says which it is in:
 *
 *   SITTING ONE   two receivables are registered, judged, promoted and FUNDED
 *                 with a due date under an hour away. Then it stops and prints
 *                 when to come back.
 *   SITTING TWO   (a day later) both are marked defaulted, and each new
 *                 finding runs where it must fire and where it must not:
 *
 *     X  the seller files its collection notices against a buyer whose wallet
 *        countersigned the debt           -> BUYER_DEFAULT. After the window
 *        the liability is on the buyer's wallet; the buyer then repays, the
 *        liability leaves, and the invoice settles normally.
 *     Y  CONTROL: the buyer says it paid the seller directly and files its
 *        own remittance advice, the only thing behind the claim
 *                                         -> whatever the panel says, the
 *        contract names NOBODY: a party is not made liable on its opponent's
 *        own paper. The provider then files a bank confirmation
 *                                         -> SELLER_RECOURSE. The seller pays
 *        the advance plus the fee, exactly; the provider is whole; custody
 *        ends at zero.
 *
 * Every step reads the chain before it sends, so either sitting can be run
 * again after a lost connection. A round that reaches no majority writes
 * nothing and is run again, and the transcript says so.
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
  console.error("usage: node scripts/live-v030.mjs <contract-address>");
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
const gen = (atto) => `${(Number(BigInt(atto) / 10n ** 12n) / 1e6).toFixed(4)} GEN`;
const nowS = () => Math.floor(Date.now() / 1000);

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
/** Follow a transaction by hash: costs no contract reads. */
async function decided(who, hash) {
  for (let i = 0; i < 120; i++) {
    await sleep(10_000);
    let t;
    try { t = await clientFor(who).getTransaction({ hash }); } catch { continue; }
    if (["ACCEPTED", "FINALIZED", "UNDETERMINED", "CANCELED", "LEADER_TIMEOUT"].includes(String(t?.statusName ?? ""))) {
      return { votes: Object.values(t?.consensus_data?.votes ?? {}).join(","),
               leader: t?.consensus_data?.leader_receipt?.[0]?.execution_result };
    }
  }
  return { votes: "", leader: "never decided" };
}
/** Send, wait for the transaction itself, then check the effect. A panel
 *  round that reaches no majority is sent again, up to `rounds` times. */
async function step(label, who, fn, args, done, value = 0n, rounds = 1) {
  if (await done()) { info(`${label}: already on chain`); return; }
  for (let attempt = 1; attempt <= rounds; attempt++) {
    const r = await decided(who, await write(who, fn, args, value));
    await sleep(8000);
    if (await done()) { if (rounds > 1) info(`${label}: round ${attempt} landed (${r.votes})`); return; }
    if (attempt < rounds) info(`${label}: round ${attempt} reached no majority (${r.votes}); nothing was written, running it again`);
  }
  bad(`never landed: ${label}`);
  console.log(`\nRUN ABORTED at: ${label}`);
  process.exit(1);
}
async function mustRefuse(label, who, fn, args, value = 0n) {
  try {
    const r = await decided(who, await write(who, fn, args, value));
    expect(r.leader === "ERROR" || r.leader === "FINISHED_WITH_ERROR", `refused: ${label}`, `receipt ${r.leader}`);
  } catch (e) {
    ok(`refused: ${label}`, String(e?.message ?? e).slice(0, 60).replace(/\s+/g, " "));
  }
}

const STAMP = Number(process.env.RESUME ?? nowS());
console.log(`FACTORA v0.3.0 LIVE RUN  ·  ${ADDRESS}  ·  RESUME=${STAMP}\n`);
const cfg = await read("get_config");
expect(cfg.version === "0.3.0", "the deployed contract reports version 0.3.0", cfg.version);

const AMOUNT = 10n ** 17n;
const WINDOW = 900;
const DUE = STAMP + 75 * 60;             // soon: the day of grace does the waiting
const inv = (id) => read("get_invoice", [id]);

async function register(tag) {
  const reference = `INV-V030-${tag}-${STAMP}`;
  const find = async () =>
    ((await read("get_invoices_for", [CAST.SELLER.addr])) ?? []).find((v) => v.reference === reference);
  await step(`${tag}: registered`, "SELLER", "create_invoice",
    [CAST.BUYER.addr, reference, AMOUNT.toString(), "2026-09-01", DUE, DUE, WINDOW],
    async () => !!(await find()));
  const id = (await find()).invoice_id;
  ok(`${tag}: registered as ${id}`, reference);
  return { id, reference };
}
const docs = (reference) => [
  { type: "invoice", label: "Invoice",
    content: `INVOICE ${reference}. Acme Industrial Supplies bills MegaRetail Ltd 0.100 GEN for 40 pallets of industrial fasteners delivered to the Apapa distribution warehouse. Payment terms: due on the stated date. Issued 2026-09-01.` },
  { type: "purchase_order", label: "Purchase order",
    content: "PURCHASE ORDER PO-2291. MegaRetail Ltd orders from Acme Industrial Supplies: 40 pallets industrial fasteners, 0.100 GEN total, deliver to Apapa distribution warehouse. Authorized by the procurement desk of MegaRetail Ltd." },
  { type: "delivery_receipt", label: "Delivery receipt",
    content: "DELIVERY RECEIPT. Consignment of 40 pallets received complete at Apapa distribution warehouse. Goods inspected on arrival and accepted without reservation. Signed: receiving clerk, MegaRetail Ltd." },
  { type: "payment_history", label: "Payment history",
    content: "PAYMENT HISTORY EXTRACT. MegaRetail Ltd settled the previous four invoices from this supplier in full, each within its stated terms. No chargebacks and no open balances." },
];

// ── SITTING ONE: two funded receivables with a near due date ────────────────
console.log("Sitting one. Two receivables, judged, promoted and funded");
const cases = {};
for (const tag of ["X", "Y"]) {
  const c = await register(tag);
  cases[tag] = c;
  await step(`${tag}: evidence committed`, "SELLER", "commit_evidence", [c.id, JSON.stringify(docs(c.reference))],
    async () => (await inv(c.id)).evidence_version >= 1);
  await step(`${tag}: countersigned`, "BUYER", "acknowledge_invoice", [c.id],
    async () => (await inv(c.id)).buyer_ack_epoch > 0);
  await step(`${tag}: the panel ruled`, "SELLER", "request_assessment", [c.id],
    async () => (await inv(c.id)).status !== "COMMITTED", 0n, 5);
}
for (const tag of ["X", "Y"]) {
  const { id } = cases[tag];
  let v = await inv(id);
  if (v.status === "PENDING_FINALITY") {
    const wait = Math.max(0, v.pending_until_epoch - nowS()) + 60;
    info(`${tag}: window closes in ${wait}s`);
    await sleep(wait * 1000);
    await step(`${tag}: promoted`, "KEEPER", "finalize_assessment", [id],
      async () => (await inv(id)).status !== "PENDING_FINALITY");
    v = await inv(id);
  }
  if (v.status === "FINANCEABLE") {
    await step(`${tag}: funded`, "PROVIDER", "fund", [id],
      async () => (await inv(id)).status !== "FINANCEABLE", BigInt(v.advance_atto));
    v = await inv(id);
  }
  expect(["FUNDED", "DEFAULTED", "REPAID", "SETTLEMENT_READY", "SETTLED", "RECOURSE_SETTLED"].includes(v.status),
    `${tag}: funded`, `${v.status} · advance ${gen(v.funded_advance_atto)}`);
  if (!["FUNDED", "DEFAULTED", "REPAID", "SETTLEMENT_READY", "SETTLED", "RECOURSE_SETTLED"].includes(v.status)) {
    console.log(`\n${tag} was judged ${v.decision}; a default needs a funded invoice. Run again with a fresh stamp.`);
    process.exit(1);
  }
}

const X = cases.X.id, Y = cases.Y.id;
const markable = DUE + cfg.grace_seconds + 60;
if (nowS() < markable && (await inv(X)).status === "FUNDED") {
  await mustRefuse("X: marking a default before the day of grace has passed", "KEEPER", "mark_defaulted", [X]);
  await mustRefuse("X: filing default evidence on an invoice that has not defaulted", "BUYER",
    "file_default_evidence", [X, JSON.stringify([{ label: "Early", content: "We intend to contest this invoice when it falls due." }])]);
  console.log(`\nSITTING ONE COMPLETE${failures ? ` with ${failures} FAILURE(S)` : ""}.`);
  console.log(`Both invoices fall due at ${new Date(DUE * 1000).toISOString()} and can be marked defaulted after`);
  console.log(`${new Date(markable * 1000).toISOString()}. Come back then:  RESUME=${STAMP} node scripts/live-v030.mjs ${ADDRESS}`);
  process.exit(failures === 0 ? 0 : 1);
}

// ── SITTING TWO ─────────────────────────────────────────────────────────────
console.log("\nSitting two. The day of grace has passed and nobody paid");
for (const [tag, id] of [["X", X], ["Y", Y]]) {
  await step(`${tag}: marked defaulted`, "KEEPER", "mark_defaulted", [id],
    async () => (await inv(id)).status !== "FUNDED");
}
const filingsOf = async (id) => (await inv(id)).default_filings_count;
const ruling = async (id) => read("get_default_ruling", [id, (await inv(id)).default_ruling_count]);
async function rule(tag, id, who) {
  const before = (await inv(id)).default_ruling_count;
  await step(`${tag}: the panel ruled on the default`, who, "request_default_ruling", [id],
    async () => (await inv(id)).default_ruling_count > before, 0n, 5);
  const r = await ruling(id);
  info(`${tag}: panel said ${r.panel_said}; the contract records ${r.finding}; behind it: ${r.corroboration.join(",") || "nothing named"}`);
  info(`${tag}: ${r.reason}`);
  return r;
}
async function closeWindow(tag, id) {
  const v = await inv(id);
  if (!v.default_pending) return;
  const wait = Math.max(0, v.default_pending_until - nowS()) + 60;
  info(`${tag}: the ruling's window closes in ${wait}s`);
  await sleep(wait * 1000);
  await step(`${tag}: the ruling took effect`, "KEEPER", "finalize_default_ruling", [id],
    async () => !(await inv(id)).default_pending);
}
const liab = async (who) => Number(await read("get_liabilities", [CAST[who].addr]));

// X ── a valid debt, unpaid
console.log("\nX. The seller's collection notices, against a buyer who countersigned");
await mustRefuse("X: a stranger filing on somebody else's default", "KEEPER", "file_default_evidence",
  [X, JSON.stringify([{ label: "Opinion", content: "An onlooker believes the buyer should simply pay this invoice." }])]);
if ((await filingsOf(X)) === 0) {
  await step("X: the seller filed", "SELLER", "file_default_evidence", [X, JSON.stringify([
    { label: "Collection notices", content: `COLLECTION NOTICES. Acme Industrial Supplies demanded payment of ${cases.X.reference} on three dates after it fell due. MegaRetail Ltd acknowledged receipt of each notice, raised no objection to the goods or the amount, and paid nothing.` }])],
    async () => (await filingsOf(X)) >= 1);
}
let liabBefore = await liab("BUYER");
if ((await inv(X)).default_ruling_count === 0) await rule("X", X, "PROVIDER");
const rx = await ruling(X);
expect(rx.finding === "BUYER_DEFAULT", "X: the buyer is found in default on a debt its own wallet countersigned", rx.finding);
if ((await inv(X)).status === "DEFAULTED") {
  if ((await inv(X)).default_pending) {
    expect((await inv(X)).default_liable === "", "X: inside its window the ruling names nobody yet");
    await mustRefuse("X: finalizing the ruling inside its window", "KEEPER", "finalize_default_ruling", [X]);
  }
  await closeWindow("X", X);
  expect((await inv(X)).default_liable === "BUYER", "X: after the window the buyer's wallet carries the liability",
    `liabilities on the wallet: ${await liab("BUYER")}`);
  await step("X: the buyer repaid", "BUYER", "repay", [X], async () => (await inv(X)).repaid_epoch > 0,
    BigInt((await inv(X)).due_atto));
}
expect((await inv(X)).default_liable === "" , "X: payment answered the default and the liability left the wallet",
  `liabilities on the wallet: ${await liab("BUYER")}`);
await step("X: split prepared", "KEEPER", "prepare_settlement", [X],
  async () => ["SETTLEMENT_READY", "SETTLED"].includes((await inv(X)).status));
await step("X: settled", "KEEPER", "execute_settlement", [X], async () => (await inv(X)).status === "SETTLED");

// Y ── the control, then the real thing
console.log("\nY. CONTROL: the buyer's own remittance advice is the only thing behind its story");
if ((await filingsOf(Y)) === 0) {
  await step("Y: the buyer filed", "BUYER", "file_default_evidence", [Y, JSON.stringify([
    { label: "Remittance advice", content: `REMITTANCE ADVICE issued by MegaRetail Ltd. We paid Acme Industrial Supplies 0.100 GEN by bank transfer against ${cases.Y.reference}, directly to the supplier's account, one week before the due date. Nothing further is owed.` }])],
    async () => (await filingsOf(Y)) >= 1);
}
if ((await inv(Y)).default_ruling_count === 0) await rule("Y", Y, "BUYER");
const ry1 = await read("get_default_ruling", [Y, 1]);
expect(ry1.finding !== "SELLER_RECOURSE", "Y: the seller was NOT named on the buyer's own paper", `panel said ${ry1.panel_said}; recorded ${ry1.finding}`);
await mustRefuse("Y: asking again with nothing new filed", "BUYER", "request_default_ruling", [Y]);

console.log("\nY. The provider files what the buyer could not mint");
if ((await filingsOf(Y)) === 1) {
  await step("Y: the provider filed", "PROVIDER", "file_default_evidence", [Y, JSON.stringify([
    { label: "Bank confirmation", content: `BANK CONFIRMATION obtained by the capital provider from the supplier's bank. The account of Acme Industrial Supplies received 0.100 GEN from MegaRetail Ltd referencing ${cases.Y.reference}, one week before the due date. The supplier did not pass the payment on.` }])],
    async () => (await filingsOf(Y)) >= 2);
  expect(!(await inv(Y)).default_pending, "Y: the new filing dropped the ruling that had not read it");
}
if ((await inv(Y)).default_ruling_count === 1) await rule("Y", Y, "PROVIDER");
const ry2 = await read("get_default_ruling", [Y, 2]);
expect(ry2.finding === "SELLER_RECOURSE" && ry2.corroboration.some((i) => i.startsWith("DF-2-")),
  "Y: recourse against the seller, resting on the provider's evidence", `${ry2.finding} · ${ry2.corroboration.join(",")}`);
if ((await inv(Y)).status === "DEFAULTED") {
  const owed = BigInt((await inv(Y)).recourse_atto);
  await mustRefuse("Y: paying recourse before the ruling has taken effect", "SELLER", "pay_recourse", [Y], owed);
  await closeWindow("Y", Y);
  expect((await inv(Y)).default_liable === "SELLER", "Y: after the window the seller's wallet carries the liability",
    `liabilities on the wallet: ${await liab("SELLER")}`);
  // the seller needs the money it was advanced: claim it, then pay it back with the fee
  const mine = BigInt((await read("get_claimable", [CAST.SELLER.addr])) ?? "0");
  if (mine > 0n) {
    await step("Y: the seller claimed what it holds", "SELLER", "claim", [],
      async () => BigInt((await read("get_claimable", [CAST.SELLER.addr])) ?? "0") === 0n);
  }
  await mustRefuse("Y: the buyer paying the seller's recourse", "BUYER", "pay_recourse", [Y], owed);
  await mustRefuse("Y: recourse one atto short", "SELLER", "pay_recourse", [Y], owed - 1n);
  await step("Y: the seller paid recourse", "SELLER", "pay_recourse", [Y],
    async () => (await inv(Y)).status === "RECOURSE_SETTLED", owed);
  ok("Y: the seller paid the advance plus the fee", gen(owed));
}
const vy = await inv(Y);
expect(vy.status === "RECOURSE_SETTLED" && vy.default_liable === "" && (await liab("SELLER")) === 0,
  "Y: the provider is whole, the instrument is closed, the liability has left the wallet");
await mustRefuse("Y: the buyer repaying an instrument that is closed", "BUYER", "repay", [Y], BigInt(vy.due_atto));

console.log("\nClaims");
for (const who of ["SELLER", "PROVIDER"]) {
  const owed = BigInt((await read("get_claimable", [CAST[who].addr])) ?? "0");
  if (owed > 0n) {
    await step(`${who} claimed`, who, "claim", [],
      async () => BigInt((await read("get_claimable", [CAST[who].addr])) ?? "0") === 0n);
    ok(`${who} claimed`, gen(owed));
  }
}
const stats = await read("get_stats");
expect(stats.escrow_atto === "0", "custody is zero: every atto left through claim()", JSON.stringify(stats));
console.log(failures === 0 ? "\nEVERY STEP PASSED" : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
