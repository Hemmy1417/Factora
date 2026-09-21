"""Direct-mode harness: the real contract module run against a stub
`genlayer` that is AS STRICT AS the runtime where it matters — DynArray
refuses user construction, unknown gl attributes raise, validator functions
actually run, and a validator returning False surfaces as a failed round
rather than a settled state.

The panel is a queue: successive exec_prompt calls walk it and the last
entry repeats, so a test can hand the leader and the validator different
answers and prove the comparison logic notices."""

import importlib.util
import json
import pathlib
import sys
import types

import pytest

CONTRACT_PATH = pathlib.Path(__file__).resolve().parents[2] / "contracts" / "factora.py"

SELLER = "0x1111111111111111111111111111111111111111"
BUYER = "0x2222222222222222222222222222222222222222"
PROVIDER = "0x3333333333333333333333333333333333333333"
CHALLENGER = "0x4444444444444444444444444444444444444444"
STRANGER = "0x5555555555555555555555555555555555555555"

GEN = 10**18
AMOUNT = 10**17          # the canonical test invoice: 0.1 GEN

URL_BUYER_SITE = "https://buyer.example.com/about"


def make_lei(base18):
    """A Legal Entity Identifier with valid ISO 7064 mod 97-10 check digits."""
    digits = "".join(str(int(ch, 36)) for ch in base18 + "00")
    return base18 + f"{98 - int(digits) % 97:02d}"


SELLER_LEI = make_lei("FACTORASELLER00001")
BUYER_LEI = make_lei("FACTORABUYER000001")


def gleif_record(lei, name, status="ACTIVE", registration="ISSUED", country="NG"):
    """The register's answer for one entity, in GLEIF's own shape, with the
    volatile envelope a real response carries and the contract must ignore."""
    return json.dumps({
        "meta": {"goldenCopy": {"publishDate": "2026-09-21T08:00:00Z"}},
        "data": {"type": "lei-records", "id": lei, "attributes": {
            "lei": lei,
            "entity": {"legalName": {"name": name, "language": "en"},
                       "otherNames": [], "status": status, "jurisdiction": country,
                       "legalAddress": {"addressLines": ["1 Wharf Road"], "city": "Lagos",
                                        "region": "NG-LA", "country": country,
                                        "postalCode": "100001"}},
            "registration": {"status": registration,
                             "lastUpdateDate": "2026-08-01T00:00:00Z"}}}})


def register_pages():
    page(f"lei-records/{SELLER_LEI}", gleif_record(SELLER_LEI, "Acme Industrial Supplies Limited"))
    page(f"lei-records/{BUYER_LEI}", gleif_record(BUYER_LEI, "MegaRetail Ltd"))


def attest_both(module, c, iid):
    register_pages()
    as_(module, SELLER, 0)
    c.attest_entity(iid, "GLEIF", SELLER_LEI)
    as_(module, BUYER, 0)
    c.attest_entity(iid, "GLEIF", BUYER_LEI)

# Test wall-clock. Tests advance it to pass real time.
_NOW = [1_760_000_000]
_SKEW = {}
_DEAD = set()
_PAGES = {}
_PANEL = []
_PANEL_CALLS = [0]
_SENT = []
_PROMPTS = []
_RUN_DRIFT = []
_RUN_INDEX = [-1]


class _UserError(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


class _VmModule:
    UserError = _UserError

    class Return:
        def __init__(self, calldata):
            self.calldata = calldata

    class Rollback:
        def __init__(self, message):
            self.message = message

    Result = object

    @staticmethod
    def run_nondet_unsafe(leader_fn, validator_fn):
        try:
            value = leader_fn()
        except Exception as e:
            res = _VmModule.Rollback(getattr(e, "message", str(e)))
            if validator_fn(res):
                raise _UserError(getattr(e, "message", str(e)))
            raise _UserError("[LLM_ERROR] validators disagreed with the leader's failure")
        ok = validator_fn(_VmModule.Return(value))
        if not ok:
            raise _UserError("[LLM_ERROR] validators did not agree with the leader")
        return value


class _TreeMap(dict):
    def get(self, k, default=None):
        return super().get(k, default)


class _U256(int):
    def __new__(cls, v):
        return super().__new__(cls, int(v))


class _DynArrayMeta(type):
    def __getitem__(cls, item):
        return cls


class _DynArray(list, metaclass=_DynArrayMeta):
    """Refuses user construction exactly like the runtime — a stub more
    permissive than the chain certifies bugs instead of catching them."""

    def __init__(self, *args, **kwargs):
        raise TypeError("this class can't be instantiated by user")

    @classmethod
    def _from_storage(cls, items=()):
        obj = list.__new__(cls)
        list.__init__(obj, items)
        return obj


class _Address(str):
    def __new__(cls, v):
        return super().__new__(cls, str(v))


class _CliAddress:
    """What the genlayer CLI delivers for a 40-hex argument: an Address
    OBJECT with .as_hex and no str methods."""
    def __init__(self, hex_str):
        self.as_hex = hex_str

    def __repr__(self):
        return f"<Address {self.as_hex}>"


class _ViewDeco:
    def __call__(self, fn):
        return fn


class _WriteDeco:
    payable = staticmethod(lambda fn: fn)

    def __call__(self, fn):
        return fn


class _Public:
    view = _ViewDeco()
    write = _WriteDeco()


class _EvmProxyInstance:
    def __init__(self, addr):
        self._addr = addr

    def emit_transfer(self, value=0, on="finalized"):
        if on != "finalized":
            raise AssertionError("payouts must ride on='finalized'")
        _SENT.append((str(self._addr).lower(), int(value)))


class _EvmModule:
    @staticmethod
    def contract_interface(cls):
        return lambda addr: _EvmProxyInstance(addr)


class _NondetWeb:
    @staticmethod
    def render(url, mode="text"):
        for dead in _DEAD:
            if dead in url:
                raise RuntimeError("source unreachable")
        skew = next((v for k, v in _SKEW.items() if k in url), 0)
        if "cloudflare.com/cdn-cgi/trace" in url:
            _RUN_INDEX[0] += 1
        drift = 0
        if _RUN_DRIFT:
            drift = _RUN_DRIFT[min(max(_RUN_INDEX[0], 0), len(_RUN_DRIFT) - 1)]
        if drift == "DEAD" and (
            "cdn-cgi/trace" in url or "blockscout" in url or "headers/head" in url
        ):
            raise RuntimeError("source unreachable")
        now = _NOW[0] + skew + (drift if isinstance(drift, int) else 0)
        if "cdn-cgi/trace" in url:
            return f"fl=1\nts={now}.000\n"
        if "blockscout" in url:
            import datetime as _dt
            t = _dt.datetime.fromtimestamp(now, _dt.timezone.utc)
            return json.dumps([{"timestamp": t.strftime("%Y-%m-%dT%H:%M:%S.000000Z")}])
        if "headers/head" in url:
            slot = (now - 1606824023) // 12
            return json.dumps({"data": {"header": {"message": {"slot": str(slot)}}}})
        for k, v in _PAGES.items():
            if k in url:
                if v is None:
                    raise RuntimeError("source unreachable")
                return v
        return ""


class _Nondet:
    web = _NondetWeb()

    @staticmethod
    def exec_prompt(prompt, response_format=None):
        _PROMPTS.append(prompt)
        if not _PANEL:
            raise AssertionError("test ran the panel without panel_says()")
        idx = min(_PANEL_CALLS[0], len(_PANEL) - 1)
        _PANEL_CALLS[0] += 1
        answer = _PANEL[idx]
        if isinstance(answer, BaseException):
            raise answer
        return answer


class _GL:
    class Contract:
        pass

    nondet = _Nondet()
    public = _Public()
    vm = _VmModule
    evm = _EvmModule()

    class message:
        sender_address = SELLER
        value = 0


def _install():
    mod = types.ModuleType("genlayer")
    mod.gl = _GL
    mod.TreeMap = _TreeMap
    mod.DynArray = _DynArray
    mod.u256 = _U256
    mod.Address = _Address
    mod.allow_storage = lambda cls: cls
    mod.__all__ = ["gl", "TreeMap", "DynArray", "u256", "Address", "allow_storage"]
    sys.modules["genlayer"] = mod


def _load():
    _install()
    spec = importlib.util.spec_from_file_location("factora_contract", CONTRACT_PATH)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


@pytest.fixture
def module():
    return _load()


@pytest.fixture
def c(module):
    _NOW[0] = 1_760_000_000
    _SKEW.clear()
    _DEAD.clear()
    _PAGES.clear()
    _SENT.clear()
    _PROMPTS.clear()
    _PANEL.clear()
    _PANEL_CALLS[0] = 0
    _RUN_DRIFT.clear()
    _RUN_INDEX[0] = -1

    as_(module, SELLER, 0)
    inst = module.Factora()
    for name in ("invoices", "identity_registry", "manifests", "assessments",
                 "actor_index", "claimable",
                 "default_filings", "default_rulings", "liabilities"):
        setattr(inst, name, module.TreeMap())
    inst.invoice_ids = _DynArray._from_storage()
    return inst


# ── helpers ──────────────────────────────────────────────────────────────────

def as_(module, who, value=0):
    module.gl.message.sender_address = who
    module.gl.message.value = value


def advance(seconds):
    _NOW[0] += seconds


def sent():
    return list(_SENT)


def prompts():
    return list(_PROMPTS)


def page(url_fragment, content):
    _PAGES[url_fragment] = content


def clock_drift(*offsets):
    _RUN_DRIFT.clear()
    _RUN_INDEX[0] = -1
    _RUN_DRIFT.extend(offsets)


def err(module):
    return module.gl.vm.UserError


def text_item(label="Invoice document", content=None, etype="invoice"):
    return {"type": etype, "label": label,
            "content": content or (
                "INVOICE INV-2026-014. Acme Industrial Supplies bills "
                "MegaRetail Ltd 0.1 GEN for 40 pallets of industrial "
                "fasteners, delivered to the Apapa warehouse. Net 60.")}


def url_item(label="Buyer public site", url=URL_BUYER_SITE):
    return {"type": "external_url", "label": label, "url": url}


def demo_items():
    return [
        text_item("Invoice", etype="invoice"),
        text_item("Purchase order",
                  "PURCHASE ORDER PO-9917. MegaRetail Ltd orders 40 pallets "
                  "of industrial fasteners from Acme Industrial Supplies at "
                  "0.1 GEN total, delivery to Apapa warehouse by end of month.",
                  "purchase_order"),
        text_item("Delivery receipt",
                  "DELIVERY RECEIPT. 40 pallets received at Apapa warehouse, "
                  "signed by receiving clerk, goods inspected and accepted "
                  "without reservation.",
                  "delivery_receipt"),
    ]


def panel_answer(n_items=3, decision="FINANCEABLE", risk="LOW", score=91,
                 seller_finding="SUPPORTED", buyer_finding="SUPPORTED",
                 transaction_finding="SUPPORTED", conflicts=None,
                 excluded=None, reason="the record coheres", **over):
    """A complete, valid panel answer for a record of n_items. `excluded`
    is a list of (id, code) pairs; everything else is examined."""
    excluded = excluded or []
    ex_ids = {e[0] for e in excluded}
    examined = [f"EV-{i + 1:03d}" for i in range(n_items)
                if f"EV-{i + 1:03d}" not in ex_ids]
    ans = {
        "decision": decision, "risk": risk, "score": score,
        "seller_finding": seller_finding, "buyer_finding": buyer_finding,
        "transaction_finding": transaction_finding,
        "conflicts": conflicts or [],
        "examined": examined,
        "excluded": [{"id": i, "code": c} for i, c in excluded],
        "reason": reason,
        # Read only when that side attested an entity the register answers for.
        "seller_entity_match": "MATCH", "buyer_entity_match": "MATCH",
    }
    ans.update(over)
    return ans


def panel_says(answer):
    _PANEL.clear()
    _PANEL_CALLS[0] = 0
    _PANEL.append(answer)


def panel_sequence(*answers):
    _PANEL.clear()
    _PANEL_CALLS[0] = 0
    _PANEL.extend(answers)


# ── lifecycle helpers ────────────────────────────────────────────────────────

def created(module, c, amount=AMOUNT, window=1800, due_in=30 * 86400,
            fund_in=20 * 86400, reference="INV-2026-014"):
    as_(module, SELLER, 0)
    return c.create_invoice(BUYER, reference, str(amount), "2026-08-01",
                            _NOW[0] + due_in, _NOW[0] + fund_in, window)


def committed(module, c, items=None, registered=True, **kw):
    """`registered` attests both parties to the public register, which is
    what the top advance table requires. Pass False for a record whose
    identities rest on keys alone."""
    iid = created(module, c, **kw)
    as_(module, SELLER, 0)
    c.commit_evidence(iid, json.dumps(items or demo_items()))
    if registered:
        attest_both(module, c, iid)
    return iid


def assessed(module, c, answer=None, items=None, ack=True, **kw):
    iid = committed(module, c, items=items, **kw)
    if ack:
        as_(module, BUYER, 0)
        c.acknowledge_invoice(iid)
    n = len(items or demo_items())
    panel_says(answer or panel_answer(n_items=n))
    as_(module, SELLER, 0)
    c.request_assessment(iid)
    return iid


def financeable(module, c, **kw):
    iid = assessed(module, c, **kw)
    advance(1801)
    as_(module, STRANGER, 0)
    c.finalize_assessment(iid)
    return iid


def funded(module, c, **kw):
    iid = financeable(module, c, **kw)
    inv = json.loads(c.get_invoice(iid))
    as_(module, PROVIDER, int(inv["advance_atto"]))
    c.fund(iid)
    return iid
