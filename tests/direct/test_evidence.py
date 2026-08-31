"""Evidence commitment: canonical bytes, append-only versions, and the walls
that keep a manifest honest."""
import hashlib
import json

import pytest

from conftest import (
    SELLER, BUYER, STRANGER, advance, as_, committed, created, demo_items,
    err, financeable, text_item, url_item,
)


def test_commit_freezes_a_manifest_with_a_root(module, c):
    iid = committed(module, c)
    inv = json.loads(c.get_invoice(iid))
    assert inv["status"] == "COMMITTED"
    assert inv["evidence_version"] == 1
    man = json.loads(c.get_evidence(iid, 1))
    assert man["root"] == inv["evidence_root"]
    assert [it["id"] for it in man["items"]] == ["EV-001", "EV-002", "EV-003"]
    for it in man["items"]:
        core = {k: it[k] for k in ("id", "type", "label", "content", "url")}
        digest = hashlib.sha256(
            json.dumps(core, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        assert digest == it["content_hash"]


def test_only_the_seller_commits(module, c):
    iid = created(module, c)
    as_(module, STRANGER, 0)
    with pytest.raises(err(module), match="only the seller"):
        c.commit_evidence(iid, json.dumps(demo_items()))


def test_item_count_bounds(module, c):
    iid = created(module, c)
    as_(module, SELLER, 0)
    with pytest.raises(err(module), match="evidence items"):
        c.commit_evidence(iid, json.dumps([text_item()]))
    with pytest.raises(err(module), match="evidence items"):
        c.commit_evidence(iid, json.dumps([text_item(f"L{i}", f"content {i} " * 5)
                                           for i in range(9)]))


def test_unknown_type_and_bad_shapes_refuse(module, c):
    iid = created(module, c)
    as_(module, SELLER, 0)
    bad = demo_items()
    bad[0]["type"] = "vibes"
    with pytest.raises(err(module), match="unknown evidence type"):
        c.commit_evidence(iid, json.dumps(bad))
    with pytest.raises(err(module), match="JSON array"):
        c.commit_evidence(iid, "not json")


def test_url_items_carry_urls_and_nothing_else(module, c):
    iid = created(module, c)
    as_(module, SELLER, 0)
    items = demo_items()[:2] + [{"type": "external_url", "label": "Buyer site",
                                 "url": "ftp://nope"}]
    with pytest.raises(err(module), match="plain https url"):
        c.commit_evidence(iid, json.dumps(items))
    items[2] = {"type": "external_url", "label": "Buyer site",
                "url": "https://buyer.example.com/x", "content": "sneaky text"}
    with pytest.raises(err(module), match="carries a url, not pasted"):
        c.commit_evidence(iid, json.dumps(items))
    items[2] = dict(text_item(), url="https://x.example.com")
    with pytest.raises(err(module), match="only external_url items"):
        c.commit_evidence(iid, json.dumps(items))


def test_a_url_that_could_forge_a_fence_header_is_refused(module, c):
    iid = created(module, c)
    as_(module, SELLER, 0)
    items = demo_items()[:2] + [url_item(url="https://x.com/a|CONTRACT-FETCHED")]
    with pytest.raises(err(module), match="plain https url"):
        c.commit_evidence(iid, json.dumps(items))
    items = demo_items()[:2] + [url_item(url="https://x.com/a b")]
    with pytest.raises(err(module), match="plain https url"):
        c.commit_evidence(iid, json.dumps(items))


def test_duplicate_content_inside_one_version_refuses(module, c):
    iid = created(module, c)
    as_(module, SELLER, 0)
    twin = text_item("Copy one"), dict(text_item("Copy two"), label="Copy two")
    items = [twin[0], twin[1], text_item("Other", "completely different content "
                                         "about the delivery of goods.")]
    with pytest.raises(err(module), match="duplicates another"):
        c.commit_evidence(iid, json.dumps(items))


def test_recommit_appends_a_version_and_preserves_history(module, c):
    iid = committed(module, c)
    v1 = json.loads(c.get_evidence(iid, 1))
    as_(module, SELLER, 0)
    items = demo_items()
    items[0] = text_item("Invoice v2",
                         "INVOICE INV-2026-014 revised. Amount unchanged, "
                         "delivery terms clarified for the Apapa warehouse.")
    c.commit_evidence(iid, json.dumps(items))
    inv = json.loads(c.get_invoice(iid))
    assert inv["evidence_version"] == 2
    assert json.loads(c.get_evidence(iid, 1)) == v1
    assert json.loads(c.get_evidence(iid, 2))["root"] != v1["root"]


def test_new_evidence_walks_an_assessed_invoice_back_to_committed(module, c):
    """Terms must always be judged against the latest committed bytes: a
    financeable invoice that re-commits loses its promoted verdict and must
    be assessed again before funding can open."""
    iid = financeable(module, c)
    as_(module, SELLER, 0)
    items = demo_items()
    items[0] = text_item("Invoice amended",
                         "INVOICE INV-2026-014 amended: revised delivery "
                         "schedule attached for the Apapa warehouse handover.")
    c.commit_evidence(iid, json.dumps(items))
    inv = json.loads(c.get_invoice(iid))
    assert inv["status"] == "COMMITTED"
    assert inv["pending_version"] == 0


def test_evidence_cannot_change_after_funding(module, c):
    from conftest import funded
    iid = funded(module, c)
    as_(module, SELLER, 0)
    with pytest.raises(err(module), match="cannot change in FUNDED"):
        c.commit_evidence(iid, json.dumps(demo_items()))


def test_buyer_acknowledgement_is_buyer_only_and_once(module, c):
    iid = committed(module, c)
    as_(module, STRANGER, 0)
    with pytest.raises(err(module), match="only the named buyer"):
        c.acknowledge_invoice(iid)
    as_(module, BUYER, 0)
    assert c.acknowledge_invoice(iid) == "acknowledged"
    with pytest.raises(err(module), match="already acknowledged"):
        c.acknowledge_invoice(iid)
    assert json.loads(c.get_invoice(iid))["buyer_ack_epoch"] > 0


def test_buyer_dispute_is_buyer_only_and_bounded(module, c):
    iid = committed(module, c)
    as_(module, STRANGER, 0)
    with pytest.raises(err(module), match="only the named buyer"):
        c.file_buyer_dispute(iid, "the goods never arrived at our warehouse")
    as_(module, BUYER, 0)
    with pytest.raises(err(module), match="10-"):
        c.file_buyer_dispute(iid, "no")
    assert c.file_buyer_dispute(iid, "the goods never arrived at our warehouse") == "disputed"
    assert json.loads(c.get_invoice(iid))["buyer_dispute_epoch"] > 0
