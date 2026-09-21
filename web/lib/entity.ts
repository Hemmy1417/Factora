// The two party inputs v0.2.0 adds, checked in the browser with the SAME
// rules the contract enforces, so a mistake costs a keystroke and not a
// reverted transaction. The contract remains the authority; these mirror it.

const ATTO = 10n ** 18n;

/** ISO 17442 Legal Entity Identifier: eighteen alphanumerics plus two check
 *  digits, valid under ISO 7064 mod 97-10. */
export function validLei(raw: string): boolean {
  const lei = raw.trim().toUpperCase();
  if (!/^[A-Z0-9]{18}[0-9]{2}$/.test(lei)) return false;
  let rem = 0;
  for (const ch of lei) {
    for (const d of String(parseInt(ch, 36))) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

/** "0.02" -> atto, or null when the text is not a plain decimal amount.
 *  Parsed as text so no float touches the money. */
export function parseGenAmount(raw: string): bigint | null {
  const text = raw.trim();
  if (!/^\d+(\.\d{1,18})?$/.test(text)) return null;
  const [whole, frac = ""] = text.split(".");
  return BigInt(whole) * ATTO + BigInt((frac + "0".repeat(18)).slice(0, 18));
}

/** Why a contested amount cannot be filed, or "" when it can. Mirrors
 *  file_credit_claim: positive, and what remains uncontested is still an
 *  invoice the contract would accept. */
export function creditClaimProblem(
  claimAtto: bigint | null, invoiceAtto: bigint, minInvoiceAtto: bigint,
): string {
  if (claimAtto === null) return "Enter the contested amount in GEN.";
  if (claimAtto <= 0n) return "The contested amount must be more than zero.";
  if (invoiceAtto - claimAtto < minInvoiceAtto) {
    return "That contests nearly the whole invoice. Dispute the invoice instead.";
  }
  return "";
}

export const IDENTITY_TIER_LABEL: Record<string, string> = {
  REGISTERED: "both parties on the public register",
  KEYS_ONLY: "identity rests on wallet keys",
  NO_ACK: "buyer has not countersigned",
};

export const ENTITY_CLASS_LABEL: Record<string, string> = {
  NONE: "no entity named",
  DECLARED: "entity named, register did not confirm it",
  REGISTERED: "confirmed by the public register",
  CONTRADICTED: "contradicted by the public register",
};

export const CREDIT_FINDING_LABEL: Record<string, string> = {
  SUPPORTED: "the record supports the claim, so the buyer owes the remainder",
  NOT_SUPPORTED: "the record contradicts the claim, so the full amount is still owed",
  INSUFFICIENT: "the record does not settle the claim, so the full amount is still owed",
};
