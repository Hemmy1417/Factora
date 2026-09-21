/** Typed mirrors of the contract's JSON views. The contract is the source of
 * truth for every one of these shapes; nothing here invents a field. */

export type Invoice = {
  invoice_id: string;
  seller: string;
  buyer: string;
  reference: string;
  amount_atto: string;
  issue_date: string;
  due_epoch: number;
  funding_deadline_epoch: number;
  challenge_window_seconds: number;
  created_epoch: number;
  evidence_version: number;
  evidence_root: string;
  status: string;
  monitoring: string;
  buyer_ack_epoch: number;
  buyer_dispute_epoch: number;
  buyer_dispute_withdrawn_epoch: number;
  buyer_dispute_text: string;
  assessed_version: number;
  pending_version: number;
  pending_until_epoch: number;
  decision: string;
  risk: string;
  score: number;
  advance_rate_bps: number;
  fee_bps: number;
  advance_atto: string;
  /** what the effective terms finance: the invoice less any contested part */
  base_atto: string;
  /** what the buyer owes under the effective judgment */
  due_atto: string;
  identity_tier: string;
  seller_entity: EntityClaim | null;
  buyer_entity: EntityClaim | null;
  credit_claim_atto: string;
  credit_claim_text: string;
  credit_claim_epoch: number;
  credit_claim_withdrawn_epoch: number;
  /** default adjudication (v0.3.0) */
  default_filings_count: number;
  default_ruled_filings: number;
  default_ruling_count: number;
  default_pending: { n: number; finding: string } | null;
  default_pending_until: number;
  default_liable: string;
  recourse_atto: string;
  recourse_paid_epoch: number;
  provider: string;
  funded_epoch: number;
  funded_advance_atto: string;
  advance_claimed: boolean;
  repaid_epoch: number;
  repaid_atto: string;
  challenge_open: boolean;
  challenger: string;
  challenge_bond_required_atto: string;
  challenge_reason: string;
  challenge_new_version: number;
  challenged_version: number;
  challenge_filed_epoch: number;
  settlement: Settlement | null;
  settled_epoch: number;
  defaulted_epoch: number;
  cancelled_epoch: number;
  expired_epoch: number;
};

export type Settlement = {
  settlement_id: string;
  invoice_id: string;
  assessment_version: number;
  provider: string;
  seller: string;
  buyer: string;
  repaid_atto: string;
  provider_total_atto: string;
  advance_component_atto: string;
  fee_component_atto: string;
  seller_total_atto: string;
  prepared_epoch: number;
};

export type EvidenceItem = {
  id: string;
  type: string;
  label: string;
  content: string;
  url: string;
  content_hash: string;
};

export type Manifest = {
  invoice_id: string;
  version: number;
  items: EvidenceItem[];
  root: string;
};

export type DossierRow = {
  id: string;
  type: string;
  label: string;
  url: string;
  provenance: string;
  reachable: boolean;
  excerpt: string;
  digest: string;
};

export type Assessment = {
  assessment_id: string;
  invoice_id: string;
  evidence_version: number;
  evidence_root: string;
  observed_epoch: number;
  buyer_acknowledged: boolean;
  buyer_dispute_open: boolean;
  buyer_dispute_withdrawn: boolean;
  identity?: { seller: string; buyer: string };
  identity_tier?: string;
  credit_claim_open?: boolean;
  credit_claim_atto?: string;
  credit_claim_finding?: string;
  base_atto?: string;
  due_atto?: string;
  decision: string;
  risk: string;
  score: number;
  seller_finding: string;
  buyer_finding: string;
  transaction_finding: string;
  committed_count: number;
  examined_count: number;
  excluded_count: number;
  examined: string[];
  excluded: { id: string; code: string }[];
  conflicts: string[];
  reason: string;
  rows: DossierRow[];
  advance_rate_bps: number;
  fee_bps: number;
};

export type Stats = {
  invoices: number;
  funded: number;
  settled: number;
  escrow_atto: string;
};

export type ChainConfig = {
  version: string;
  min_invoice_atto: string;
  max_invoice_atto: string;
  reference_chars: [number, number];
  items: [number, number];
  item_chars: [number, number];
  label_chars: [number, number];
  url_chars: [number, number];
  dispute_text_chars: [number, number];
  reason_chars: [number, number];
  challenge_window_seconds: [number, number];
  challenge_bond_bps: number;
  challenge_bond_floor_atto: string;
  reassess_stale_seconds: number;
  grace_seconds: number;
  advance_bps: Record<string, number>;
  advance_bps_no_ack: Record<string, number>;
  fee_bps: Record<string, number>;
  evidence_types: string[];
  conflict_codes: string[];
  exclusion_codes: string[];
  decisions: string[];
  risks: string[];
  statuses: string[];
};

/** A party's own wallet named its legal entity in a public register. */
export interface EntityClaim {
  registry: string;
  entity_id: string;
  epoch: number;
}
