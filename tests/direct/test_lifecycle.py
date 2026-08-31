"""End-to-end stories and the S30 class: concurrent actors racing one
position, actions arriving after terminal states, and conservation held
across the whole book — invariants, not scripted happy paths."""
import json

import pytest

from conftest import (
    SELLER, BUYER, PROVIDER, CHALLENGER, STRANGER, GEN, AMOUNT,
    advance, as_, assessed, committed, created, demo_items, err, financeable,
    funded, panel_answer, panel_says, sent, text_item,
)


def test_the_whole_happy_path_conserves_every_atto(module, c):
    """create → commit → ack → assess → finalize → fund → advance claimed →
    repay → prepare → execute → all claims. The book must end empty."""
    iid = funded(module, c)
    inv = json.loads(c.get_invoice(iid))
    as_(module, SELLER, 0)
    c.claim_advance(iid)

    as_(module, BUYER, int(inv["amount_atto"]))
    c.repay(iid)
    as_(module, STRANGER, 0)
    c.prepare_settlement(iid)
    c.execute_settlement(iid)
    for who in (SELLER, PROVIDER):
        as_(module, who, 0)
        c.claim()

    deposited = int(inv["amount_atto"]) + int(inv["funded_advance_atto"])
    assert sum(v for _, v in sent()) == deposited
    assert json.loads(c.get_stats())["escrow_atto"] == "0"
    final = json.loads(c.get_invoice(iid))
    assert final["status"] == "SETTLED"
    s = final["settlement"]
    assert (int(s["provider_total_atto"]) + int(s["seller_total_atto"])
            == int(inv["amount_atto"]))


def test_a_challenged_then_lapsed_book_also_conserves(module, c):
    iid = assessed(module, c)
    bond = int(json.loads(c.get_invoice(iid))["challenge_bond_required_atto"])
    as_(module, CHALLENGER, bond)
    c.challenge(iid, "the delivery record contradicts the gate ledger for "
                     "that window", json.dumps([text_item(
                         "Gate ledger", "GATE LEDGER: no inbound consignment "
                         "from the seller in the stated window.",
                         "transaction_record")]))
    advance(3601)
    as_(module, STRANGER, 0)
    c.challenge_lapse(iid)
    as_(module, CHALLENGER, 0)
    c.claim()
    assert sent() == [(CHALLENGER.lower(), bond)]
    assert json.loads(c.get_stats())["escrow_atto"] == "0"


def test_two_providers_racing_one_position(module, c):
    """S30(a): both pass the same pre-checks; only the first deposit lands.
    The second is refused with its value untouched by the contract."""
    iid = financeable(module, c)
    adv = int(json.loads(c.get_invoice(iid))["advance_atto"])
    as_(module, PROVIDER, adv)
    c.fund(iid)
    as_(module, STRANGER, adv)
    with pytest.raises(err(module), match="not open for funding"):
        c.fund(iid)
    assert json.loads(c.get_invoice(iid))["provider"] == PROVIDER
    assert json.loads(c.get_stats())["escrow_atto"] == str(adv)


def test_two_challengers_racing_one_record(module, c):
    iid = assessed(module, c)
    bond = int(json.loads(c.get_invoice(iid))["challenge_bond_required_atto"])
    payload = json.dumps([text_item(
        "Contradiction", "GATE LEDGER: no inbound consignment from the "
        "seller in the stated window.", "transaction_record")])
    as_(module, CHALLENGER, bond)
    c.challenge(iid, "the record contradicts the gate ledger in the stated "
                     "window", payload)
    as_(module, STRANGER, bond)
    with pytest.raises(err(module), match="already open"):
        c.challenge(iid, "an unrelated second objection to the same record "
                         "and window", payload)


def test_post_terminal_actions_bounce_off_a_settled_invoice(module, c):
    """S30(b): nothing resurrects. Fund, repay, assess, commit, cancel,
    prepare, execute — every verb refuses after SETTLED."""
    iid = funded(module, c)
    inv = json.loads(c.get_invoice(iid))
    as_(module, BUYER, int(inv["amount_atto"]))
    c.repay(iid)
    as_(module, STRANGER, 0)
    c.prepare_settlement(iid)
    c.execute_settlement(iid)

    as_(module, PROVIDER, int(inv["advance_atto"]))
    with pytest.raises(err(module)):
        c.fund(iid)
    as_(module, BUYER, int(inv["amount_atto"]))
    with pytest.raises(err(module)):
        c.repay(iid)
    as_(module, SELLER, 0)
    with pytest.raises(err(module)):
        c.commit_evidence(iid, json.dumps(demo_items()))
    with pytest.raises(err(module)):
        c.request_assessment(iid)
    with pytest.raises(err(module)):
        c.cancel_invoice(iid)
    as_(module, STRANGER, 0)
    with pytest.raises(err(module)):
        c.prepare_settlement(iid)
    with pytest.raises(err(module)):
        c.execute_settlement(iid)
    with pytest.raises(err(module)):
        c.mark_defaulted(iid)
    assert json.loads(c.get_invoice(iid))["status"] == "SETTLED"


def test_a_cancelled_invoice_stays_cancelled(module, c):
    iid = committed(module, c)
    as_(module, SELLER, 0)
    c.cancel_invoice(iid)
    panel_says(panel_answer())
    with pytest.raises(err(module)):
        c.request_assessment(iid)
    as_(module, SELLER, 0)
    with pytest.raises(err(module)):
        c.commit_evidence(iid, json.dumps(demo_items()))


def test_the_reassessment_story_end_to_end(module, c):
    """The §53 arc: financeable at v1, the buyer's own wallet disputes,
    a challenger brings the dispute into the record, reassessment lands
    REVIEW_REQUIRED at v2, and the pre-funding position closes honestly."""
    iid = financeable(module, c)
    as_(module, BUYER, 0)
    c.file_buyer_dispute(iid, "the goods failed inspection and were rejected "
                              "at the warehouse")
    bond = int(json.loads(c.get_invoice(iid))["challenge_bond_required_atto"])
    as_(module, CHALLENGER, bond)
    c.challenge(iid, "the buyer's own on-chain dispute contradicts the "
                     "delivery story", json.dumps([text_item(
                         "Dispute context",
                         "INSPECTION REPORT. Forty pallets rejected on "
                         "arrival; goods returned to the carrier.",
                         "transaction_record")]))
    panel_says(panel_answer(n_items=4, decision="REVIEW_REQUIRED",
                            risk="MEDIUM", score=54,
                            transaction_finding="INSUFFICIENT",
                            conflicts=["BUYER_DISPUTE_OPEN",
                                       "DELIVERY_CONTRADICTED"]))
    as_(module, STRANGER, 0)
    out = json.loads(c.reassess(iid))
    assert out["bond_returned"] is True
    advance(1801)
    c.finalize_assessment(iid)
    inv = json.loads(c.get_invoice(iid))
    assert inv["status"] == "REVIEW"
    assert inv["assessed_version"] == 2
    # history is intact: both dossiers readable, both manifests readable
    assert json.loads(c.get_assessment(iid, 1))["decision"] == "FINANCEABLE"
    assert json.loads(c.get_assessment(iid, 2))["decision"] == "REVIEW_REQUIRED"
    assert json.loads(c.get_evidence(iid, 1))["version"] == 1
    assert json.loads(c.get_evidence(iid, 2))["version"] == 2


def test_stats_count_what_happened(module, c):
    iid = funded(module, c)
    inv = json.loads(c.get_invoice(iid))
    as_(module, BUYER, int(inv["amount_atto"]))
    c.repay(iid)
    as_(module, STRANGER, 0)
    c.prepare_settlement(iid)
    c.execute_settlement(iid)
    stats = json.loads(c.get_stats())
    assert stats["invoices"] == 1
    assert stats["funded"] == 1
    assert stats["settled"] == 1
