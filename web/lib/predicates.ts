"use client";

/**
 * Confirmation predicates.
 *
 * lib/tx.ts confirms a write by asking the chain whether the thing the user
 * asked for is now true — never by trusting a receipt alone. These are those
 * questions. Two rules each one obeys:
 *
 *   IT IS ABOUT THE CALLER'S CHANGE — anchored to the invoice and, where it
 *   matters, compared against a snapshot taken before the write, so someone
 *   else's activity cannot satisfy it.
 *
 *   IT READS PAST THE CACHE — a cached answer from before the write would
 *   re-assert the old world.
 *
 * Readers are injectable so the logic that decides whether a user is told
 * their money moved can be exercised against fixtures.
 */
import { getClaimable, getInvoice } from "./read";
import type { Invoice } from "./types";

export type Readers = {
  getInvoice: (id: string, force?: boolean) => Promise<Invoice | null>;
  getClaimable: (addr: string, force?: boolean) => Promise<string>;
};

const real: Readers = { getInvoice, getClaimable };

const inv = async (r: Readers, id: string) => r.getInvoice(id, true);

export const evidenceVersionIs =
  (id: string, version: number, r: Readers = real) =>
  async (): Promise<boolean> => {
    const v = await inv(r, id);
    return !!v && v.evidence_version === version;
  };

export const statusIs =
  (id: string, statuses: string[], r: Readers = real) =>
  async (): Promise<boolean> => {
    const v = await inv(r, id);
    return !!v && statuses.includes(v.status);
  };

export const acknowledged =
  (id: string, r: Readers = real) =>
  async (): Promise<boolean> => {
    const v = await inv(r, id);
    return !!v && v.buyer_ack_epoch > 0;
  };

export const disputeFiled =
  (id: string, r: Readers = real) =>
  async (): Promise<boolean> => {
    const v = await inv(r, id);
    return !!v && v.buyer_dispute_epoch > 0;
  };

export const assessmentPendingAt =
  (id: string, version: number, r: Readers = real) =>
  async (): Promise<boolean> => {
    const v = await inv(r, id);
    return !!v && v.status === "PENDING_FINALITY" && v.pending_version === version;
  };

export const promotedFrom =
  (id: string, pendingVersion: number, r: Readers = real) =>
  async (): Promise<boolean> => {
    const v = await inv(r, id);
    return !!v && v.assessed_version === pendingVersion
      && v.status !== "PENDING_FINALITY";
  };

export const fundedBy =
  (id: string, provider: string, r: Readers = real) =>
  async (): Promise<boolean> => {
    const v = await inv(r, id);
    return !!v && v.status === "FUNDED"
      && v.provider.toLowerCase() === provider.toLowerCase();
  };

export const challengeOpenIs =
  (id: string, open: boolean, r: Readers = real) =>
  async (): Promise<boolean> => {
    const v = await inv(r, id);
    return !!v && v.challenge_open === open;
  };

export const invoiceCountAbove =
  (prevTotal: number, seller: string,
   list: (addr: string, force?: boolean) => Promise<Invoice[]>) =>
  async (): Promise<boolean> => {
    const mine = await list(seller, true);
    return mine.length > prevTotal;
  };

export const claimableDrained =
  (addr: string, r: Readers = real) =>
  async (): Promise<boolean> => {
    const v = await r.getClaimable(addr, true);
    return v === "0";
  };
