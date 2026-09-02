/**
 * Open one genuine funding listing and stop.
 *
 *   node scripts/live-open-listing.mjs <address>
 *
 * register → commit → countersign → panel → window lapses → finalize →
 * FINANCEABLE. Nothing is funded: the instrument stands in the
 * marketplace as a real, open, fundable listing until its deadline.
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
  console.error("usage: node scripts/live-open-listing.mjs <contract-address>");
  process.exit(1);
}

const KEYS = JSON.parse(readFileSync(join(ROOT, ".data", "keys.json"), "utf8"));
const SELLER = KEYS.CREATOR;
const BUYER = KEYS.YES;
const KEEPER = KEYS.THIRD;
const clientFor = (k) =>
  createClient({ chain: studionet, account: privateKeyToAccount(k.pk) });
const reader = createClient({ chain: studionet });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (l, e = "") => console.log(`  ok    ${l}${e ? `  (${e})` : ""}`);
const info = (l) => console.log(`  ..    ${l}`);

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
async function write(k, fn, args = [], value = 0n) {
  return clientFor(k).writeContract({ address: ADDRESS, functionName: fn, args, value });
}
async function until(label, fn, tries = 40, gap = 10_000) {
  for (let i = 0; i < tries; i++) {
    await sleep(gap);
    try { if (await fn()) return; } catch { /* transient */ }
  }
  console.log(`  FAIL  timed out: ${label}`);
  process.exit(1);
}

console.log(`FACTORA OPEN LISTING  ·  ${ADDRESS}\n`);
const AMOUNT = 10n ** 17n;
const now = Math.floor(Date.now() / 1000);
const reference = `INV-2026-${String(now).slice(-4)}`;

const before = ((await read("get_invoices_for", [SELLER.addr])) ?? []).length;
await write(SELLER, "create_invoice", [
  BUYER.addr, reference, AMOUNT.toString(), "2026-08-28",
  now + 21 * 86400, now + 10 * 86400, 900,
]);
await until("registered", async () =>
  ((await read("get_invoices_for", [SELLER.addr])) ?? []).length > before);
const mine = await read("get_invoices_for", [SELLER.addr]);
const INV = mine[mine.length - 1].invoice_id;
ok(`registered as ${INV}`, reference);

const ITEMS = [
  { type: "invoice", label: "Invoice",
    content: `INVOICE ${reference}. Acme Industrial Supplies bills MegaRetail Ltd 0.100 GEN for the September consignment: 25 pallets of fastener assortments delivered to the Ikeja fulfilment centre. Payment terms: net 21 days.` },
  { type: "purchase_order", label: "Purchase order",
    content: "PURCHASE ORDER PO-2318. MegaRetail Ltd orders from Acme Industrial Supplies: 25 pallets fastener assortments, 0.100 GEN total, deliver to Ikeja fulfilment centre. Authorized by procurement." },
  { type: "delivery_receipt", label: "Delivery receipt",
    content: "DELIVERY RECEIPT. Consignment of 25 pallets received complete at Ikeja fulfilment centre. Checked against the purchase order and accepted. Signed: goods-in supervisor, MegaRetail." },
  { type: "payment_history", label: "Payment history",
    content: "PAYMENT HISTORY EXTRACT. MegaRetail Ltd has settled five invoices from this supplier this year, all inside their stated terms, including the fully settled September quality-dispute invoice. No open balances." },
];
await write(SELLER, "commit_evidence", [INV, JSON.stringify(ITEMS)]);
await until("evidence committed", async () =>
  (await read("get_invoice", [INV])).evidence_version === 1);
await write(BUYER, "acknowledge_invoice", [INV]);
await until("countersigned", async () =>
  (await read("get_invoice", [INV])).buyer_ack_epoch > 0);
ok("evidence committed and countersigned");

await write(SELLER, "request_assessment", [INV]);
await until("panel ruled", async () =>
  (await read("get_invoice", [INV])).status === "PENDING_FINALITY", 40, 10_000);
const a = await read("get_assessment", [INV, 1]);
ok(`panel ruled: ${a.decision} · ${a.risk} · score ${a.score}`);

const v = await read("get_invoice", [INV]);
const wait = v.pending_until_epoch - Math.floor(Date.now() / 1000) + 30;
if (wait > 0) { info(`waiting ${wait}s for the challenge window`); await sleep(wait * 1000); }
await write(KEEPER, "finalize_assessment", [INV]);
await until("finalized", async () =>
  (await read("get_invoice", [INV])).status === "FINANCEABLE");
const f = await read("get_invoice", [INV]);
ok(`OPEN LISTING: advance ${f.advance_rate_bps} bps · fee ${f.fee_bps} bps · deadline in ${Math.round((f.funding_deadline_epoch - now) / 86400)}d`);
console.log(`\nLISTING LIVE  invoice ${INV}`);
