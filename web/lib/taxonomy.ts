/** Human labels for the contract's enums. The vocabulary itself lives in the
 * contract (get_config reports it); this file only translates. */

export const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  invoice: "Invoice",
  purchase_order: "Purchase order",
  delivery_receipt: "Delivery receipt",
  contract: "Contract",
  business_record: "Business record",
  transaction_record: "Transaction record",
  payment_history: "Payment history",
  correspondence: "Correspondence",
  external_url: "External page",
  other: "Other",
};

/** Shown beside every kind picker and evidence list. The same sentence the
 * tribunal is told: a committed document is the seller's claim, hashed and
 * frozen but never verified; only the buyer's own wallet actions and pages
 * the contract fetches itself are contract-verified. */
export const PROVENANCE_NOTE =
  "Committed documents are hashed and frozen — and the panel is told they " +
  "are your declarations, not verified facts.";

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  COMMITTED: "Evidence committed",
  PENDING_FINALITY: "Verdict pending finality",
  FINANCEABLE: "Financeable",
  NOT_FINANCEABLE: "Not financeable",
  REVIEW: "Review required",
  FUNDED: "Funded",
  REPAID: "Repaid",
  SETTLEMENT_READY: "Settlement ready",
  SETTLED: "Settled",
  DEFAULTED: "Defaulted",
  RECOURSE_SETTLED: "Recourse paid",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

/** The stamp colour class per status — print-register, not traffic lights. */
export const STATUS_TONE: Record<string, string> = {
  DRAFT: "tone-neutral",
  COMMITTED: "tone-neutral",
  PENDING_FINALITY: "tone-hold",
  FINANCEABLE: "tone-good",
  NOT_FINANCEABLE: "tone-bad",
  REVIEW: "tone-hold",
  FUNDED: "tone-active",
  REPAID: "tone-active",
  SETTLEMENT_READY: "tone-hold",
  SETTLED: "tone-good",
  DEFAULTED: "tone-bad",
  RECOURSE_SETTLED: "tone-neutral",
  CANCELLED: "tone-neutral",
  EXPIRED: "tone-neutral",
};

export const DECISION_LABEL: Record<string, string> = {
  FINANCEABLE: "Financeable",
  NOT_FINANCEABLE: "Not financeable",
  REVIEW_REQUIRED: "Review required",
};

export const FINDING_LABEL: Record<string, string> = {
  SUPPORTED: "Supported",
  NOT_SUPPORTED: "Not supported",
  INSUFFICIENT: "Insufficient",
};

export const RISK_LABEL: Record<string, string> = {
  LOW: "Low risk",
  MEDIUM: "Medium risk",
  HIGH: "High risk",
};

export const CONFLICT_LABEL: Record<string, string> = {
  AMOUNT_MISMATCH: "Amounts disagree across the record",
  DATE_INCONSISTENT: "Dates are inconsistent",
  PARTY_MISMATCH: "Parties do not match across documents",
  DUPLICATE_INDICATION: "Signs of a duplicated receivable",
  DELIVERY_CONTRADICTED: "Delivery is contradicted",
  PAYMENT_TERMS_CONFLICT: "Payment terms conflict",
  BUYER_DISPUTE_OPEN: "The buyer's own wallet disputes this invoice",
  EXTERNAL_CONTRADICTION: "An external source contradicts the record",
  ENTITY_CONTRADICTED: "The public register contradicts a named party",
  CREDIT_CLAIM_CONTRADICTED: "The record contradicts the part the buyer contests",
  BUYER_IN_DEFAULT: "This buyer has an unpaid default a panel ruled on",
  SELLER_IN_RECOURSE: "This seller owes recourse a panel ruled on",
  OTHER_CONFLICT: "Other material conflict",
};

export const EXCLUSION_LABEL: Record<string, string> = {
  UNREADABLE: "Unreadable",
  IRRELEVANT: "Irrelevant to the obligation",
  DUPLICATE: "Duplicates another item",
  UNREACHABLE: "Unreachable at judgment time",
  OVERSIZED: "Oversized",
  OTHER: "Excluded",
};

export const MONITORING_LABEL: Record<string, string> = {
  NONE: "—",
  NORMAL: "Normal",
  REVIEW_REQUIRED: "Review required",
};
