"""Registration, identity, and the state walls around an invoice's life."""
import json

import pytest

from conftest import (
    SELLER, BUYER, PROVIDER, STRANGER, GEN, AMOUNT, _NOW,
    advance, as_, clock_drift, created, committed, err, financeable,
)


def test_create_registers_and_indexes(module, c):
    iid = created(module, c)
    assert iid == "fac-000001"
    inv = json.loads(c.get_invoice(iid))
    assert inv["status"] == "DRAFT"
    assert inv["seller"] == SELLER and inv["buyer"] == BUYER
    assert json.loads(c.get_invoices(0, 10))["total"] == 1
    mine = json.loads(c.get_invoices_for(SELLER))
    assert [m["invoice_id"] for m in mine] == [iid]
    theirs = json.loads(c.get_invoices_for(BUYER))
    assert [m["invoice_id"] for m in theirs] == [iid]


def test_the_same_receivable_cannot_register_twice(module, c):
    created(module, c)
    with pytest.raises(err(module), match="already registered"):
        created(module, c)


def test_a_different_reference_is_a_different_receivable(module, c):
    created(module, c)
    iid2 = created(module, c, reference="INV-2026-015")
    assert iid2 == "fac-000002"


def test_buyer_must_differ_from_seller(module, c):
    as_(module, SELLER, 0)
    with pytest.raises(err(module), match="cannot be the seller"):
        c.create_invoice(SELLER, "INV-1", str(AMOUNT), "2026-08-01",
                         _NOW[0] + 86400 * 30, _NOW[0] + 86400 * 20, 1800)


def test_amount_bounds(module, c):
    as_(module, SELLER, 0)
    with pytest.raises(err(module), match="amount out of bounds"):
        c.create_invoice(BUYER, "INV-1", str(10**15), "2026-08-01",
                         _NOW[0] + 86400 * 30, _NOW[0] + 86400 * 20, 1800)
    with pytest.raises(err(module), match="amount out of bounds"):
        c.create_invoice(BUYER, "INV-1", "not-a-number", "2026-08-01",
                         _NOW[0] + 86400 * 30, _NOW[0] + 86400 * 20, 1800)


def test_issue_date_must_be_a_date(module, c):
    as_(module, SELLER, 0)
    with pytest.raises(err(module), match="YYYY-MM-DD"):
        c.create_invoice(BUYER, "INV-1", str(AMOUNT), "yesterday",
                         _NOW[0] + 86400 * 30, _NOW[0] + 86400 * 20, 1800)


def test_funding_deadline_must_sit_inside_the_term(module, c):
    as_(module, SELLER, 0)
    with pytest.raises(err(module), match="funding deadline"):
        c.create_invoice(BUYER, "INV-1", str(AMOUNT), "2026-08-01",
                         _NOW[0] + 86400 * 30, _NOW[0] + 86400 * 31, 1800)
    with pytest.raises(err(module), match="funding deadline"):
        c.create_invoice(BUYER, "INV-1", str(AMOUNT), "2026-08-01",
                         _NOW[0] + 86400 * 30, _NOW[0] + 60, 1800)


def test_challenge_window_bounds(module, c):
    as_(module, SELLER, 0)
    with pytest.raises(err(module), match="challenge window"):
        c.create_invoice(BUYER, "INV-1", str(AMOUNT), "2026-08-01",
                         _NOW[0] + 86400 * 30, _NOW[0] + 86400 * 20, 100)


def test_no_clock_no_creation(module, c):
    clock_drift("DEAD")
    as_(module, SELLER, 0)
    with pytest.raises(err(module), match="no consensus clock"):
        c.create_invoice(BUYER, "INV-1", str(AMOUNT), "2026-08-01",
                         _NOW[0] + 86400 * 30, _NOW[0] + 86400 * 20, 1800)


def test_diverged_clock_runs_refuse(module, c):
    """The leader reads one time, the validator another, far apart — the
    round must fail rather than settle on either reading."""
    clock_drift(0, 2000)
    as_(module, SELLER, 0)
    with pytest.raises(err(module)):
        c.create_invoice(BUYER, "INV-1", str(AMOUNT), "2026-08-01",
                         _NOW[0] + 86400 * 30, _NOW[0] + 86400 * 20, 1800)


def test_forward_skewed_wall_clock_is_refused_by_the_beacon_ceiling(module, c):
    """A common forward skew of every cdn-cgi edge — the failure a floor
    cannot catch — must read as NO clock, not as a later time."""
    from conftest import _SKEW
    _SKEW["cdn-cgi"] = 4000
    as_(module, SELLER, 0)
    with pytest.raises(err(module), match="no consensus clock"):
        c.create_invoice(BUYER, "INV-1", str(AMOUNT), "2026-08-01",
                         _NOW[0] + 86400 * 30, _NOW[0] + 86400 * 20, 1800)


def test_seller_cancels_before_funding(module, c):
    iid = created(module, c)
    as_(module, SELLER, 0)
    assert c.cancel_invoice(iid) == "cancelled"
    assert json.loads(c.get_invoice(iid))["status"] == "CANCELLED"


def test_stranger_cannot_cancel(module, c):
    iid = created(module, c)
    as_(module, STRANGER, 0)
    with pytest.raises(err(module), match="only the seller"):
        c.cancel_invoice(iid)


def test_unfunded_financeable_expires_after_the_deadline(module, c):
    iid = financeable(module, c)
    as_(module, STRANGER, 0)
    with pytest.raises(err(module), match="has not passed"):
        c.mark_expired(iid)
    advance(21 * 86400)
    assert c.mark_expired(iid) == "expired"
    assert json.loads(c.get_invoice(iid))["status"] == "EXPIRED"


def test_unknown_invoice_reads_empty_and_writes_refuse(module, c):
    assert c.get_invoice("fac-999999") == ""
    with pytest.raises(err(module), match="unknown invoice"):
        c.cancel_invoice("fac-999999")


def test_paging_is_bounded_and_newest_first(module, c):
    for i in range(5):
        created(module, c, reference=f"INV-{i}")
    pg = json.loads(c.get_invoices(0, 2))
    assert pg["total"] == 5
    assert [m["invoice_id"] for m in pg["invoices"]] == ["fac-000005", "fac-000004"]
    pg2 = json.loads(c.get_invoices(2, 2))
    assert [m["invoice_id"] for m in pg2["invoices"]] == ["fac-000003", "fac-000002"]
