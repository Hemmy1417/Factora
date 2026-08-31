"""The recorded dossier is consensus-bound, not leader-authored: a leader
that agrees on the verdict but writes a forged record must find no validator
willing to sign it. These tests tamper with the leader's result between the
leader and the validator — the exact position a dishonest leader occupies."""
import json

import pytest

from conftest import (
    SELLER, BUYER, CHALLENGER, STRANGER, _SKEW,
    advance, as_, assessed, committed, demo_items, err, financeable,
    page, panel_answer, panel_says, text_item, url_item,
)


def _tampering(module, mutate):
    """Wrap run_nondet_unsafe: let the real leader run, corrupt its dossier
    the way a dishonest leader would, and require the validator to refuse."""
    real = module.gl.vm.run_nondet_unsafe

    def wrapper(leader_fn, validator_fn):
        value = leader_fn()
        if isinstance(value, dict) and "rows" in value:
            mutate(value)
            assert validator_fn(module.gl.vm.Return(value)) is False, \
                "the validator signed a forged record"
            raise module.gl.vm.UserError("[LLM_ERROR] forged record refused")
        # anything else (the clock) passes through untouched
        ok = validator_fn(module.gl.vm.Return(value))
        if not ok:
            raise module.gl.vm.UserError("[LLM_ERROR] validators did not agree")
        return value

    module.gl.vm.run_nondet_unsafe = wrapper
    return real


def test_a_forged_row_digest_finds_no_validator(module, c):
    iid = committed(module, c)
    panel_says(panel_answer())
    real = _tampering(module, lambda v: v["rows"][0].update(digest="0" * 64))
    try:
        as_(module, SELLER, 0)
        with pytest.raises(err(module), match="forged record refused"):
            c.request_assessment(iid)
    finally:
        module.gl.vm.run_nondet_unsafe = real


def test_forged_declared_bytes_find_no_validator(module, c):
    """A leader swaps a committed document's excerpt for friendlier text and
    honestly re-digests the swap. The digest self-check passes — the
    committed-bytes comparison is what must catch it."""
    import hashlib
    iid = committed(module, c)
    panel_says(panel_answer())

    def swap(v):
        forged = "The buyer has prepaid this invoice in full."
        v["rows"][0]["excerpt"] = forged
        v["rows"][0]["digest"] = hashlib.sha256(forged.encode()).hexdigest()

    real = _tampering(module, swap)
    try:
        as_(module, SELLER, 0)
        with pytest.raises(err(module), match="forged record refused"):
            c.request_assessment(iid)
    finally:
        module.gl.vm.run_nondet_unsafe = real


def test_a_reachability_claim_the_validator_cannot_reproduce_is_refused(module, c):
    """The leader found the page dark and the record excludes it as
    UNREACHABLE; this validator reads the page fine. A dossier asserting
    darkness the validator can see through is not a record it signs."""
    items = demo_items()[:2] + [url_item()]
    iid = committed(module, c, items=items)

    calls = [0]
    real_render = module.gl.nondet.web.render

    def first_dark(url, mode="text"):
        if "buyer.example.com" in url:
            calls[0] += 1
            if calls[0] == 1:
                raise RuntimeError("dark for the leader only")
            return "MegaRetail Ltd corporate information page."
        return real_render(url, mode=mode)

    module.gl.nondet.web.render = first_dark
    panel_says(panel_answer(n_items=3, excluded=[("EV-003", "UNREACHABLE")]))
    try:
        as_(module, SELLER, 0)
        with pytest.raises(err(module), match="did not agree"):
            c.request_assessment(iid)
    finally:
        module.gl.nondet.web.render = real_render


def test_evidence_cannot_change_while_a_challenge_is_open(module, c):
    iid = financeable(module, c)
    bond = int(json.loads(c.get_invoice(iid))["challenge_bond_required_atto"])
    as_(module, CHALLENGER, bond)
    c.challenge(iid, "the record contradicts the gate ledger for the stated "
                     "window", json.dumps([text_item(
                         "Gate ledger", "GATE LEDGER: no inbound consignment "
                         "from the seller in the stated window.",
                         "transaction_record")]))
    as_(module, SELLER, 0)
    with pytest.raises(err(module), match="already fixed"):
        c.commit_evidence(iid, json.dumps(demo_items()))


def test_mutually_diverged_wall_sources_read_as_no_clock(module, c):
    """Two edge hosts more than the envelope apart is not a time, it is a
    broken clock — and a broken clock refuses to act, never picks a side."""
    _SKEW["digitalocean"] = 2000
    as_(module, SELLER, 0)
    from conftest import _NOW, AMOUNT
    with pytest.raises(err(module), match="no consensus clock"):
        c.create_invoice(BUYER, "INV-X", str(AMOUNT), "2026-08-01",
                         _NOW[0] + 86400 * 30, _NOW[0] + 86400 * 20, 1800)
