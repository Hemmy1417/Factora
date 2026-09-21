"""Repayment and the two-step settlement: conservation, custody, and every
path that must refuse to pay twice."""
import json

import pytest

from conftest import (
    SELLER, BUYER, PROVIDER, CHALLENGER, STRANGER,
    advance, as_, err, funded, panel_answer, panel_says, sent, text_item,
)


def _repaid(module, c):
    iid = funded(module, c)
    inv = json.loads(c.get_invoice(iid))
    as_(module, BUYER, int(inv["amount_atto"]))
    c.repay(iid)
    return iid


def test_only_the_buyer_repays_and_exactly(module, c):
    iid = funded(module, c)
    inv = json.loads(c.get_invoice(iid))
    amount = int(inv["amount_atto"])
    as_(module, STRANGER, amount)
    with pytest.raises(err(module), match="only the named buyer"):
        c.repay(iid)
    as_(module, BUYER, amount - 1)
    with pytest.raises(err(module), match="amount owed exactly"):
        c.repay(iid)
    as_(module, BUYER, amount)
    assert c.repay(iid) == "repaid"
    assert json.loads(c.get_invoice(iid))["status"] == "REPAID"


def test_repay_before_funding_refuses(module, c):
    from conftest import financeable
    iid = financeable(module, c)
    inv = json.loads(c.get_invoice(iid))
    as_(module, BUYER, int(inv["amount_atto"]))
    with pytest.raises(err(module), match="nothing to repay"):
        c.repay(iid)


def test_prepare_computes_a_conserving_split(module, c):
    iid = _repaid(module, c)
    as_(module, STRANGER, 0)
    s = json.loads(c.prepare_settlement(iid))
    inv = json.loads(c.get_invoice(iid))
    amount = int(inv["amount_atto"])
    advance_atto = int(inv["funded_advance_atto"])
    fee = amount * inv["fee_bps"] // 10_000
    assert int(s["provider_total_atto"]) == advance_atto + fee
    assert int(s["seller_total_atto"]) == amount - advance_atto - fee
    assert (int(s["provider_total_atto"]) + int(s["seller_total_atto"])) == amount
    assert json.loads(c.get_invoice(iid))["status"] == "SETTLEMENT_READY"


def test_settlement_before_repayment_refuses(module, c):
    iid = funded(module, c)
    with pytest.raises(err(module), match="follows repayment"):
        c.prepare_settlement(iid)


def test_settlement_is_blocked_while_a_challenge_is_open(module, c):
    """A challenge filed while FUNDED stays open through repayment: the
    repayment is welcome, the split is not — not until the record resolves."""
    iid = funded(module, c)
    bond = int(json.loads(c.get_invoice(iid))["challenge_bond_required_atto"])
    as_(module, CHALLENGER, bond)
    c.challenge(iid, "the record this position was funded on contradicts "
                     "the gate ledger", json.dumps([text_item(
                         "Late contradiction",
                         "GATE LEDGER EXTRACT. No inbound consignment was "
                         "recorded from the seller in the invoice window.",
                         "transaction_record")]))
    inv = json.loads(c.get_invoice(iid))
    as_(module, BUYER, int(inv["amount_atto"]))
    c.repay(iid)
    as_(module, STRANGER, 0)
    with pytest.raises(err(module), match="challenge is open"):
        c.prepare_settlement(iid)
    # resolve it, then settlement proceeds
    panel_says(panel_answer(n_items=4))
    c.reassess(iid)
    c.prepare_settlement(iid)
    c.execute_settlement(iid)
    assert json.loads(c.get_invoice(iid))["status"] == "SETTLED"


def test_execute_pays_the_prepared_record_once(module, c):
    iid = _repaid(module, c)
    as_(module, STRANGER, 0)
    s = json.loads(c.prepare_settlement(iid))
    c.execute_settlement(iid)
    inv = json.loads(c.get_invoice(iid))
    assert inv["status"] == "SETTLED"
    assert int(c.get_claimable(PROVIDER)) == int(s["provider_total_atto"])
    # the seller holds the advance credit (unclaimed) plus the reserve share
    assert int(c.get_claimable(SELLER)) == (
        int(s["seller_total_atto"]) + int(inv["funded_advance_atto"]))
    with pytest.raises(err(module), match="no prepared settlement"):
        c.execute_settlement(iid)
    with pytest.raises(err(module), match="follows repayment"):
        c.prepare_settlement(iid)


def test_every_atto_drains_and_custody_reconciles_to_zero(module, c):
    """The conservation invariant, end to end: everything deposited leaves
    through claims, and the contract's escrow counter lands on zero."""
    iid = _repaid(module, c)
    as_(module, STRANGER, 0)
    c.prepare_settlement(iid)
    c.execute_settlement(iid)
    inv = json.loads(c.get_invoice(iid))
    amount = int(inv["amount_atto"])
    advance_atto = int(inv["funded_advance_atto"])
    deposited = amount + advance_atto

    for who in (SELLER, PROVIDER):
        as_(module, who, 0)
        c.claim()
    paid = sum(v for _, v in sent())
    assert paid == deposited
    assert json.loads(c.get_stats())["escrow_atto"] == "0"
    assert int(c.get_claimable(SELLER)) == 0
    assert int(c.get_claimable(PROVIDER)) == 0


def test_default_marks_and_late_repayment_still_settles(module, c):
    iid = funded(module, c)
    as_(module, STRANGER, 0)
    with pytest.raises(err(module), match="grace has not passed"):
        c.mark_defaulted(iid)
    advance(32 * 86400)
    c.mark_defaulted(iid)
    assert json.loads(c.get_invoice(iid))["status"] == "DEFAULTED"
    inv = json.loads(c.get_invoice(iid))
    as_(module, BUYER, int(inv["amount_atto"]))
    c.repay(iid)
    as_(module, STRANGER, 0)
    c.prepare_settlement(iid)
    c.execute_settlement(iid)
    assert json.loads(c.get_invoice(iid))["status"] == "SETTLED"


def test_settlement_values_come_from_state_not_the_caller(module, c):
    """prepare/execute take no amounts at all — the only thing a caller
    chooses is WHEN. The split is state arithmetic."""
    iid = _repaid(module, c)
    import inspect
    assert list(inspect.signature(c.prepare_settlement).parameters) == ["invoice_id"]
    assert list(inspect.signature(c.execute_settlement).parameters) == ["invoice_id"]
