"""Funding: derived amounts, single provider, and the pull-payment ledger."""
import json

import pytest

from conftest import (
    SELLER, BUYER, PROVIDER, STRANGER, advance, as_, assessed, committed,
    err, financeable, funded, sent,
)


def _advance_atto(c, iid):
    return int(json.loads(c.get_invoice(iid))["advance_atto"])


def test_funding_escrows_and_credits_the_seller(module, c):
    iid = financeable(module, c)
    adv = _advance_atto(c, iid)
    as_(module, PROVIDER, adv)
    c.fund(iid)
    inv = json.loads(c.get_invoice(iid))
    assert inv["status"] == "FUNDED"
    assert inv["provider"] == PROVIDER
    assert int(inv["funded_advance_atto"]) == adv
    assert int(c.get_claimable(SELLER)) == adv
    assert json.loads(c.get_stats())["escrow_atto"] == str(adv)


def test_the_deposit_must_equal_the_derived_advance_exactly(module, c):
    iid = financeable(module, c)
    adv = _advance_atto(c, iid)
    as_(module, PROVIDER, adv - 1)
    with pytest.raises(err(module), match="exactly"):
        c.fund(iid)
    as_(module, PROVIDER, adv + 1)
    with pytest.raises(err(module), match="exactly"):
        c.fund(iid)


def test_funding_requires_a_final_financeable_state(module, c):
    iid = assessed(module, c)          # still PENDING_FINALITY
    as_(module, PROVIDER, 1)
    with pytest.raises(err(module), match="not open for funding"):
        c.fund(iid)


def test_a_party_to_the_invoice_cannot_fund_it(module, c):
    iid = financeable(module, c)
    adv = _advance_atto(c, iid)
    as_(module, SELLER, adv)
    with pytest.raises(err(module), match="cannot be its"):
        c.fund(iid)
    as_(module, BUYER, adv)
    with pytest.raises(err(module), match="cannot be its"):
        c.fund(iid)


def test_double_funding_is_impossible(module, c):
    """S30 concurrency shape: the second provider racing the first finds the
    position taken, whatever value they attached."""
    iid = funded(module, c)
    adv = int(json.loads(c.get_invoice(iid))["funded_advance_atto"])
    as_(module, STRANGER, adv)
    with pytest.raises(err(module), match="not open for funding"):
        c.fund(iid)


def test_funding_after_the_deadline_refuses(module, c):
    iid = financeable(module, c)
    adv = _advance_atto(c, iid)
    advance(21 * 86400)
    as_(module, PROVIDER, adv)
    with pytest.raises(err(module), match="deadline has passed"):
        c.fund(iid)


def test_the_seller_claims_the_advance_once(module, c):
    iid = funded(module, c)
    adv = int(json.loads(c.get_invoice(iid))["funded_advance_atto"])
    as_(module, SELLER, 0)
    c.claim_advance(iid)
    assert sent() == [(SELLER.lower(), adv)]
    assert int(c.get_claimable(SELLER)) == 0
    with pytest.raises(err(module), match="already claimed"):
        c.claim_advance(iid)


def test_claim_with_nothing_claimable_refuses(module, c):
    as_(module, STRANGER, 0)
    with pytest.raises(err(module), match="nothing claimable"):
        c.claim()


def test_the_ledger_zeroes_before_the_transfer_is_emitted(module, c):
    iid = funded(module, c)
    as_(module, SELLER, 0)
    c.claim()
    assert int(c.get_claimable(SELLER)) == 0
    with pytest.raises(err(module), match="nothing claimable"):
        c.claim()
    assert len(sent()) == 1
