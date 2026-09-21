import { describe, expect, it } from "vitest";
import { creditClaimProblem, parseGenAmount, validLei } from "../lib/entity";

describe("validLei", () => {
  it("accepts a real identifier from the public register", () => {
    expect(validLei("5493001KJTIIGC8Y1R12")).toBe(true);
    expect(validLei(" 5493001kjtiigc8y1r12 ")).toBe(true);
  });
  it("refuses one wrong character, which is what the check digits are for", () => {
    expect(validLei("5493001KJTIIGC8Y1R13")).toBe(false);
    expect(validLei("5493001KJTIIGC8Y2R12")).toBe(false);
  });
  it("refuses the wrong shape", () => {
    for (const bad of ["", "5493001KJTIIGC8Y1R1", "5493001KJTIIGC8Y1R123", "5493001KJTIIGC8Y1-12", "5493001KJTIIGC8Y1RAB"]) {
      expect(validLei(bad)).toBe(false);
    }
  });
});

describe("parseGenAmount", () => {
  it("parses decimals as text, to the atto", () => {
    expect(parseGenAmount("0.02")).toBe(20_000_000_000_000_000n);
    expect(parseGenAmount("1")).toBe(10n ** 18n);
    expect(parseGenAmount("0.000000000000000001")).toBe(1n);
  });
  it("refuses anything that is not a plain amount", () => {
    for (const bad of ["", "-1", "1e3", "0.0000000000000000001", "1,5", "abc", "."]) {
      expect(parseGenAmount(bad)).toBeNull();
    }
  });
});

describe("creditClaimProblem", () => {
  const invoice = 10n ** 17n, min = 10n ** 16n;
  it("mirrors the contract: positive, and the remainder is still an invoice", () => {
    expect(creditClaimProblem(2n * 10n ** 16n, invoice, min)).toBe("");
    expect(creditClaimProblem(invoice - min, invoice, min)).toBe("");
    expect(creditClaimProblem(invoice - min + 1n, invoice, min)).toMatch(/Dispute the invoice/);
    expect(creditClaimProblem(0n, invoice, min)).toMatch(/more than zero/);
    expect(creditClaimProblem(null, invoice, min)).toMatch(/Enter the contested amount/);
  });
});
