/** The confirmation predicates: each one anchored to the caller's change and
 * fed by injected readers, because these decide whether a user is told their
 * money moved. */
import { describe, expect, it } from "vitest";
import * as P from "@/lib/predicates";
import type { Invoice } from "@/lib/types";

const base = (over: Partial<Invoice> = {}): Invoice => ({
  invoice_id: "fac-000001", seller: "0xaa", buyer: "0xbb", reference: "INV-1",
  amount_atto: "100000000000000000", issue_date: "2026-08-01",
  due_epoch: 0, funding_deadline_epoch: 0, challenge_window_seconds: 1800,
  created_epoch: 0, evidence_version: 1, evidence_root: "r",
  status: "COMMITTED", monitoring: "NONE",
  buyer_ack_epoch: 0, buyer_dispute_epoch: 0,
  buyer_dispute_withdrawn_epoch: 0, buyer_dispute_text: "",
  assessed_version: 0, pending_version: 0, pending_until_epoch: 0,
  decision: "", risk: "", score: 0, advance_rate_bps: 0, fee_bps: 0,
  advance_atto: "0", provider: "", funded_epoch: 0, funded_advance_atto: "0",
  advance_claimed: false, repaid_epoch: 0, repaid_atto: "0",
  challenge_open: false, challenger: "", challenge_bond_required_atto: "0",
  challenge_reason: "", challenge_new_version: 0, challenged_version: 0,
  challenge_filed_epoch: 0, settlement: null, settled_epoch: 0,
  defaulted_epoch: 0, cancelled_epoch: 0, expired_epoch: 0,
  base_atto: "100000000000000000", due_atto: "100000000000000000",
  identity_tier: "", seller_entity: null, buyer_entity: null,
  credit_claim_atto: "0", credit_claim_text: "", credit_claim_epoch: 0,
  credit_claim_withdrawn_epoch: 0,
  default_filings_count: 0, default_ruled_filings: 0, default_ruling_count: 0,
  default_pending: null, default_pending_until: 0, default_liable: "",
  recourse_atto: "0", recourse_paid_epoch: 0,
  ...over,
});

const readers = (inv: Invoice | null, claimable = "0"): P.Readers => ({
  getInvoice: async () => inv,
  getClaimable: async () => claimable,
});

describe("predicates are anchored and force-read", () => {
  it("evidenceVersionIs matches only the exact next version", async () => {
    expect(await P.evidenceVersionIs("fac-000001", 2,
      readers(base({ evidence_version: 2 })))()).toBe(true);
    expect(await P.evidenceVersionIs("fac-000001", 2,
      readers(base({ evidence_version: 1 })))()).toBe(false);
    expect(await P.evidenceVersionIs("fac-000001", 2, readers(null))()).toBe(false);
  });

  it("assessmentPendingAt requires the status AND the version", async () => {
    const pending = base({ status: "PENDING_FINALITY", pending_version: 1 });
    expect(await P.assessmentPendingAt("fac-000001", 1, readers(pending))()).toBe(true);
    expect(await P.assessmentPendingAt("fac-000001", 2, readers(pending))()).toBe(false);
  });

  it("promotedFrom demands the pending verdict became the effective one", async () => {
    const promoted = base({ status: "FINANCEABLE", assessed_version: 1 });
    expect(await P.promotedFrom("fac-000001", 1, readers(promoted))()).toBe(true);
    const still = base({ status: "PENDING_FINALITY", pending_version: 1 });
    expect(await P.promotedFrom("fac-000001", 1, readers(still))()).toBe(false);
  });

  it("fundedBy is anchored to the caller, not to anyone having funded", async () => {
    const funded = base({ status: "FUNDED", provider: "0xCC" });
    expect(await P.fundedBy("fac-000001", "0xcc", readers(funded))()).toBe(true);
    expect(await P.fundedBy("fac-000001", "0xdd", readers(funded))()).toBe(false);
  });

  it("claimableDrained is satisfied only by zero", async () => {
    expect(await P.claimableDrained("0xaa", readers(base(), "0"))()).toBe(true);
    expect(await P.claimableDrained("0xaa", readers(base(), "5"))()).toBe(false);
  });

  it("invoiceCountAbove compares against the snapshot", async () => {
    const list = async () => [base(), base({ invoice_id: "fac-000002" })];
    expect(await P.invoiceCountAbove(1, "0xaa", list)()).toBe(true);
    expect(await P.invoiceCountAbove(2, "0xaa", list)()).toBe(false);
  });
});

describe("dispute predicates track open versus withdrawn", () => {
  it("filed means open, withdrawal ends it, history stays checkable", async () => {
    const open = readers(base({ buyer_dispute_epoch: 100 }));
    const withdrawn = readers(base({
      buyer_dispute_epoch: 100, buyer_dispute_withdrawn_epoch: 200 }));
    expect(await P.disputeFiled("fac-000001", open)()).toBe(true);
    expect(await P.disputeFiled("fac-000001", withdrawn)()).toBe(false);
    expect(await P.disputeWithdrawn("fac-000001", withdrawn)()).toBe(true);
    expect(await P.disputeWithdrawn("fac-000001", open)()).toBe(false);
  });
});

describe("v0.2.0 predicates", () => {
  const claim = { registry: "GLEIF", entity_id: "5493001KJTIIGC8Y1R12", epoch: 1 };

  it("creditClaimFiled is true only while the claim stands", async () => {
    expect(await P.creditClaimFiled("fac-000001", readers(base({ credit_claim_epoch: 5 })))()).toBe(true);
    expect(await P.creditClaimFiled("fac-000001", readers(base()))()).toBe(false);
    expect(await P.creditClaimFiled("fac-000001",
      readers(base({ credit_claim_epoch: 5, credit_claim_withdrawn_epoch: 9 })))()).toBe(false);
  });

  it("creditClaimWithdrawn waits for the withdrawal itself", async () => {
    expect(await P.creditClaimWithdrawn("fac-000001", readers(base({ credit_claim_epoch: 5 })))()).toBe(false);
    expect(await P.creditClaimWithdrawn("fac-000001",
      readers(base({ credit_claim_epoch: 5, credit_claim_withdrawn_epoch: 9 })))()).toBe(true);
  });

  it("entityAttested is anchored to the caller's own side", async () => {
    const onlySeller = readers(base({ seller_entity: claim }));
    expect(await P.entityAttested("fac-000001", "seller", onlySeller)()).toBe(true);
    expect(await P.entityAttested("fac-000001", "buyer", onlySeller)()).toBe(false);
    expect(await P.entityAttested("fac-000001", "buyer", readers(null))()).toBe(false);
  });
});

describe("v0.3.0 predicates", () => {
  it("defaultFilingsAbove is anchored to the count the caller saw", async () => {
    expect(await P.defaultFilingsAbove("fac-000001", 1, readers(base({ default_filings_count: 2 })))()).toBe(true);
    expect(await P.defaultFilingsAbove("fac-000001", 2, readers(base({ default_filings_count: 2 })))()).toBe(false);
  });
  it("defaultRulingsAbove waits for a NEW ruling, not the last one", async () => {
    expect(await P.defaultRulingsAbove("fac-000001", 1, readers(base({ default_ruling_count: 1 })))()).toBe(false);
    expect(await P.defaultRulingsAbove("fac-000001", 1, readers(base({ default_ruling_count: 2 })))()).toBe(true);
  });
  it("defaultRulingSettled is false while a ruling waits out its window", async () => {
    expect(await P.defaultRulingSettled("fac-000001",
      readers(base({ default_pending: { n: 1, finding: "BUYER_DEFAULT" } })))()).toBe(false);
    expect(await P.defaultRulingSettled("fac-000001", readers(base()))()).toBe(true);
    expect(await P.defaultRulingSettled("fac-000001", readers(null))()).toBe(false);
  });
});
