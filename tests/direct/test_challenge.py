"""Challenges: the bond, the appended evidence version, the snapshot that a
lapse restores, and the deterministic bond allocation after reassessment."""
import json

import pytest

from conftest import (
    SELLER, BUYER, PROVIDER, CHALLENGER, STRANGER,
    advance, as_, assessed, committed, err, financeable, funded,
    panel_answer, panel_says, text_item,
)


def _bond(c, iid):
    return int(json.loads(c.get_invoice(iid))["challenge_bond_required_atto"])


def _challenge_items():
    return [text_item("Independent delivery contradiction",
                      "LOGISTICS RECORD. No delivery to the Apapa warehouse "
                      "was logged in the stated window; the gate ledger shows "
                      "no inbound consignment from Acme Industrial Supplies.",
                      "transaction_record")]


def _file(module, c, iid, who=CHALLENGER):
    bond = _bond(c, iid)
    as_(module, who, bond)
    return c.challenge(iid, "the delivery receipt contradicts the gate ledger "
                            "for the stated window", json.dumps(_challenge_items()))


def test_challenge_requires_the_exact_bond(module, c):
    iid = assessed(module, c)
    as_(module, CHALLENGER, _bond(c, iid) - 1)
    with pytest.raises(err(module), match="bond is exactly"):
        c.challenge(iid, "the delivery receipt contradicts the gate ledger "
                         "for the stated window", json.dumps(_challenge_items()))


def test_challenge_appends_a_version_and_blocks_promotion(module, c):
    iid = assessed(module, c)
    _file(module, c, iid)
    inv = json.loads(c.get_invoice(iid))
    assert inv["challenge_open"] is True
    assert inv["evidence_version"] == 2
    man = json.loads(c.get_evidence(iid, 2))
    assert len(man["items"]) == 4
    assert man["items"][3]["label"].startswith("[CHALLENGER]")
    advance(1801)
    as_(module, STRANGER, 0)
    with pytest.raises(err(module), match="reassessment decides"):
        c.finalize_assessment(iid)


def test_the_seller_cannot_challenge_their_own_record(module, c):
    iid = assessed(module, c)
    as_(module, SELLER, _bond(c, iid))
    with pytest.raises(err(module), match="re-commits evidence instead"):
        c.challenge(iid, "actually my own record is wrong in my favour, "
                         "please re-run it", json.dumps(_challenge_items()))


def test_only_one_challenge_at_a_time(module, c):
    iid = assessed(module, c)
    _file(module, c, iid)
    as_(module, STRANGER, _bond(c, iid))
    with pytest.raises(err(module), match="already open"):
        c.challenge(iid, "another objection about the same delivery window "
                         "entirely", json.dumps(_challenge_items()))


def test_funding_is_blocked_while_a_challenge_is_open(module, c):
    iid = financeable(module, c)
    _file(module, c, iid)
    inv = json.loads(c.get_invoice(iid))
    as_(module, PROVIDER, int(inv["advance_atto"]))
    with pytest.raises(err(module), match="challenge is open"):
        c.fund(iid)


def test_reassessment_that_flips_the_verdict_returns_the_bond(module, c):
    iid = assessed(module, c)
    bond = _bond(c, iid)
    _file(module, c, iid)
    panel_says(panel_answer(n_items=4, decision="NOT_FINANCEABLE",
                            risk="HIGH", score=22,
                            transaction_finding="NOT_SUPPORTED",
                            conflicts=["DELIVERY_CONTRADICTED"]))
    as_(module, STRANGER, 0)
    out = json.loads(c.reassess(iid))
    assert out["bond_returned"] is True
    assert int(c.get_claimable(CHALLENGER)) == bond
    inv = json.loads(c.get_invoice(iid))
    assert inv["challenge_open"] is False
    assert inv["status"] == "PENDING_FINALITY"
    assert inv["pending_version"] == 2
    advance(1801)
    c.finalize_assessment(iid)
    assert json.loads(c.get_invoice(iid))["status"] == "NOT_FINANCEABLE"


def test_reassessment_that_upholds_forfeits_the_bond_to_the_seller(module, c):
    iid = assessed(module, c)
    bond = _bond(c, iid)
    _file(module, c, iid)
    panel_says(panel_answer(n_items=4))       # same verdict, same risk
    as_(module, STRANGER, 0)
    out = json.loads(c.reassess(iid))
    assert out["bond_returned"] is False
    assert int(c.get_claimable(SELLER)) == bond
    assert int(c.get_claimable(CHALLENGER)) == 0


def test_post_funding_challenge_updates_monitoring_not_money(module, c):
    iid = funded(module, c)
    bond = _bond(c, iid)
    _file(module, c, iid)
    panel_says(panel_answer(n_items=4, decision="REVIEW_REQUIRED",
                            risk="MEDIUM", score=48,
                            transaction_finding="INSUFFICIENT",
                            conflicts=["DELIVERY_CONTRADICTED"]))
    as_(module, STRANGER, 0)
    json.loads(c.reassess(iid))
    inv = json.loads(c.get_invoice(iid))
    assert inv["status"] == "FUNDED"           # money state untouched
    assert inv["monitoring"] == "REVIEW_REQUIRED"
    assert int(c.get_claimable(CHALLENGER)) == bond
    # the funded terms did not move
    assert inv["advance_rate_bps"] == 8500


def test_a_forfeited_post_funding_bond_goes_to_the_provider(module, c):
    iid = funded(module, c)
    bond = _bond(c, iid)
    _file(module, c, iid)
    panel_says(panel_answer(n_items=4))
    as_(module, STRANGER, 0)
    json.loads(c.reassess(iid))
    assert int(c.get_claimable(PROVIDER)) == bond


def test_reassess_without_a_challenge_refuses(module, c):
    iid = assessed(module, c)
    with pytest.raises(err(module), match="no challenge is open"):
        c.reassess(iid)


def test_lapse_restores_the_snapshot_and_frees_the_bond(module, c):
    """S29 in miniature: the state restored is the one that was challenged,
    exactly as filed — including the evidence version the challenge had
    bumped."""
    iid = assessed(module, c)
    before = json.loads(c.get_invoice(iid))
    bond = _bond(c, iid)
    _file(module, c, iid)
    as_(module, STRANGER, 0)
    with pytest.raises(err(module), match="has not opened"):
        c.challenge_lapse(iid)
    advance(3601)
    c.challenge_lapse(iid)
    after = json.loads(c.get_invoice(iid))
    assert after["status"] == before["status"] == "PENDING_FINALITY"
    assert after["evidence_version"] == before["evidence_version"] == 1
    assert after["evidence_root"] == before["evidence_root"]
    assert after["pending_version"] == before["pending_version"]
    assert after["challenge_open"] is False
    assert int(c.get_claimable(CHALLENGER)) == bond
    # the challenger's manifest remains readable history at version 2
    assert json.loads(c.get_evidence(iid, 2))["version"] == 2


def test_challenge_on_a_settled_invoice_refuses(module, c):
    """S30 post-terminal shape."""
    iid = funded(module, c)
    inv = json.loads(c.get_invoice(iid))
    as_(module, BUYER, int(inv["amount_atto"]))
    c.repay(iid)
    as_(module, STRANGER, 0)
    c.prepare_settlement(iid)
    c.execute_settlement(iid)
    as_(module, CHALLENGER, _bond(c, iid))
    with pytest.raises(err(module), match="nothing challengeable"):
        c.challenge(iid, "objection raised after everyone has been paid "
                         "out entirely", json.dumps(_challenge_items()))


# ── a lapse restores the assessment's standing, never the money ──────────────
# Found in the pre-submission debug of v0.3.0, and older than it: repayment
# and default both stay open while a challenge is, and a lapse used to put
# FUNDED back over whatever they had written.

def _stale_challenge_on_a_funded_invoice(module, c, iid):
    from conftest import CHALLENGER
    bond = int(json.loads(c.get_invoice(iid))["challenge_bond_required_atto"])
    as_(module, CHALLENGER, bond)
    c.challenge(iid, "the delivery receipt names a different warehouse",
                json.dumps([text_item("Gate log", "GATE LOG. No delivery was logged at the Apapa gate that week at all.", "business_record")]))


def test_a_lapse_does_not_strand_a_repayment_made_while_the_challenge_was_open(module, c):
    from conftest import AMOUNT, BUYER, PROVIDER, funded
    iid = funded(module, c)
    _stale_challenge_on_a_funded_invoice(module, c, iid)
    as_(module, BUYER, AMOUNT)
    c.repay(iid)
    advance(3601)
    as_(module, STRANGER, 0)
    c.challenge_lapse(iid)
    inv = json.loads(c.get_invoice(iid))
    assert inv["status"] == "REPAID" and not inv["challenge_open"]
    as_(module, BUYER, AMOUNT)
    with pytest.raises(err(module), match="nothing to repay"):
        c.repay(iid)                                   # never twice
    as_(module, STRANGER, 0)
    c.prepare_settlement(iid)
    c.execute_settlement(iid)
    for who in (SELLER, PROVIDER, CHALLENGER):
        as_(module, who, 0)
        c.claim()
    assert json.loads(c.get_stats())["escrow_atto"] == "0"


def test_a_lapse_does_not_erase_a_default_recorded_while_the_challenge_was_open(module, c):
    from conftest import funded
    iid = funded(module, c)
    advance(30 * 86400 + 86400 - 100)
    _stale_challenge_on_a_funded_invoice(module, c, iid)
    advance(200)
    as_(module, STRANGER, 0)
    c.mark_defaulted(iid)
    advance(3601)
    c.challenge_lapse(iid)
    inv = json.loads(c.get_invoice(iid))
    assert inv["status"] == "DEFAULTED" and inv["defaulted_epoch"] > 0

