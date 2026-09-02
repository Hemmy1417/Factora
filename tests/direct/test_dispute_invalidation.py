"""The judges' regression: a buyer dispute filed AFTER judgment.

The obligor's repudiation outranks a verdict that never read it. These
tests pin every consequence: a pending verdict loses its promotion, an
effective verdict loses its terms, funding stays shut until a judgment
has READ the dispute, a lapsed challenge cannot resurrect struck terms,
and withdrawal — history, not erasure — is the honest exit that lets a
fresh version price the record again."""
import json

import pytest

from conftest import (
    BUYER, PROVIDER, SELLER, STRANGER,
    advance, as_, assessed, committed, demo_items, financeable, funded,
    panel_answer, panel_says,
)


def err(module):
    return module.gl.vm.UserError


DISPUTE = "A quality audit found a third of the fasteners out of specification."


# ── the regression the judges asked for ──────────────────────────────────────

def test_dispute_during_pending_finality_strikes_the_verdict(module, c):
    iid = assessed(module, c)
    as_(module, BUYER, 0)
    c.file_buyer_dispute(iid, DISPUTE)

    inv = json.loads(c.get_invoice(iid))
    assert inv["status"] == "REVIEW"
    assert inv["pending_version"] == 0
    assert inv["pending_until_epoch"] == 0
    assert inv["advance_rate_bps"] == 0
    assert inv["fee_bps"] == 0
    # the dossier itself is preserved — only its EFFECT is gone
    assert c.get_assessment(iid, 1)


def test_finalize_is_blocked_after_a_post_judgment_dispute(module, c):
    """The exact sequence from the letter: assess, window lapses, the buyer
    disputes, and promotion must be impossible."""
    iid = assessed(module, c)
    advance(1801)
    as_(module, BUYER, 0)
    c.file_buyer_dispute(iid, DISPUTE)

    as_(module, STRANGER, 0)
    with pytest.raises(err(module), match="nothing is pending finality"):
        c.finalize_assessment(iid)


def test_dispute_against_effective_terms_strikes_them_and_blocks_funding(module, c):
    iid = financeable(module, c)
    before = json.loads(c.get_invoice(iid))
    assert before["advance_rate_bps"] > 0

    as_(module, BUYER, 0)
    c.file_buyer_dispute(iid, DISPUTE)

    inv = json.loads(c.get_invoice(iid))
    assert inv["status"] == "REVIEW"
    assert inv["advance_rate_bps"] == 0
    assert inv["fee_bps"] == 0

    as_(module, PROVIDER, int(before["advance_atto"]) or 10**16)
    with pytest.raises(err(module), match="not open for funding"):
        c.fund(iid)


def test_dispute_after_funding_flags_review_but_cannot_unwind_money(module, c):
    iid = funded(module, c)
    as_(module, BUYER, 0)
    c.file_buyer_dispute(iid, DISPUTE)

    inv = json.loads(c.get_invoice(iid))
    assert inv["status"] == "FUNDED"
    assert inv["monitoring"] == "REVIEW_REQUIRED"
    assert inv["provider"]


def test_reassessment_that_reads_the_dispute_reopens_the_path(module, c):
    """The full round trip: strike, withdraw, re-judge on a new version,
    finalize, fund. The way back always runs through a judgment that saw
    the record as it now is."""
    iid = assessed(module, c)
    as_(module, BUYER, 0)
    c.file_buyer_dispute(iid, DISPUTE)
    assert json.loads(c.get_invoice(iid))["status"] == "REVIEW"

    # withdrawal is the buyer's own act, and terms do not spring back
    as_(module, BUYER, 0)
    c.withdraw_buyer_dispute(iid)
    inv = json.loads(c.get_invoice(iid))
    assert inv["status"] == "REVIEW"
    assert inv["advance_rate_bps"] == 0

    # a NEW version carries the record back to the panel
    as_(module, SELLER, 0)
    c.commit_evidence(iid, json.dumps(demo_items()))
    panel_says(panel_answer(n_items=len(demo_items())))
    as_(module, SELLER, 0)
    c.request_assessment(iid)

    dossier = json.loads(c.get_assessment(iid, 2))
    assert dossier["buyer_dispute_open"] is False
    assert dossier["buyer_dispute_withdrawn"] is True

    advance(1801)
    as_(module, STRANGER, 0)
    c.finalize_assessment(iid)
    inv = json.loads(c.get_invoice(iid))
    assert inv["status"] == "FINANCEABLE"
    assert inv["advance_rate_bps"] > 0

    as_(module, PROVIDER, int(inv["amount_atto"]) * inv["advance_rate_bps"] // 10_000)
    c.fund(iid)
    assert json.loads(c.get_invoice(iid))["status"] == "FUNDED"


def test_an_open_dispute_read_by_the_panel_cannot_price(module, c):
    """Dispute BEFORE judgment: the round reads it and the derived verdict
    refuses FINANCEABLE regardless of what the model answered."""
    iid = committed(module, c)
    as_(module, BUYER, 0)
    c.acknowledge_invoice(iid)
    as_(module, BUYER, 0)
    c.file_buyer_dispute(iid, DISPUTE)

    panel_says(panel_answer(n_items=len(demo_items())))  # model tries FINANCEABLE
    as_(module, SELLER, 0)
    c.request_assessment(iid)

    dossier = json.loads(c.get_assessment(iid, 1))
    assert dossier["buyer_dispute_open"] is True
    assert dossier["decision"] != "FINANCEABLE"


# ── the resurrection hole ────────────────────────────────────────────────────

def test_a_lapsed_challenge_cannot_resurrect_struck_terms(module, c):
    """Dispute lands while a challenge is open; the challenge later lapses
    and restores its snapshot. The restored verdict must fall to the same
    invalidation — otherwise a stale challenge would be a way to sneak a
    repudiated verdict back into effect."""
    iid = financeable(module, c)
    inv = json.loads(c.get_invoice(iid))

    as_(module, STRANGER, int(inv["challenge_bond_required_atto"]))
    c.challenge(iid, "The delivery receipt does not cover the second lot.",
                json.dumps([demo_items()[0]]))

    as_(module, BUYER, 0)
    c.file_buyer_dispute(iid, DISPUTE)

    advance(3601)
    as_(module, STRANGER, 0)
    c.challenge_lapse(iid)

    after = json.loads(c.get_invoice(iid))
    assert after["challenge_open"] is False
    assert after["status"] == "REVIEW"
    assert after["advance_rate_bps"] == 0


# ── withdrawal boundaries ────────────────────────────────────────────────────

def test_withdrawal_is_the_buyers_alone_and_needs_an_open_dispute(module, c):
    iid = assessed(module, c)
    as_(module, BUYER, 0)
    c.file_buyer_dispute(iid, DISPUTE)

    as_(module, SELLER, 0)
    with pytest.raises(err(module), match="only the named buyer wallet"):
        c.withdraw_buyer_dispute(iid)

    as_(module, BUYER, 0)
    c.withdraw_buyer_dispute(iid)
    with pytest.raises(err(module), match="no dispute is open"):
        c.withdraw_buyer_dispute(iid)


def test_one_open_dispute_at_a_time_but_refiling_after_withdrawal_works(module, c):
    iid = assessed(module, c)
    as_(module, BUYER, 0)
    c.file_buyer_dispute(iid, DISPUTE)
    with pytest.raises(err(module), match="already open"):
        c.file_buyer_dispute(iid, "Second complaint about the same invoice.")

    c.withdraw_buyer_dispute(iid)
    c.file_buyer_dispute(iid, "The replacement lot failed inspection too.")
    inv = json.loads(c.get_invoice(iid))
    assert inv["buyer_dispute_withdrawn_epoch"] == 0
    assert "replacement lot" in inv["buyer_dispute_text"]
