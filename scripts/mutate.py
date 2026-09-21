"""The mutation sweep.

For every money-path and judgment guard in the contract, delete it in a
scratch copy and prove the direct suite goes red. A guard that nothing fails
for is a guard that does not exist.

An ACCEPT-CONTROL runs alongside: a harmless edit that must stay GREEN. If
the control also fails, the sweep is passing for the wrong reason and its
results mean nothing.

    python scripts/mutate.py

Each entry is (name, find, replace), or (name, find, replace, nth) when the
same text appears more than once and only one occurrence is the guard.

A name beginning with DEPTH marks a guard that sits BEHIND a stronger
upstream one and is expected to SURVIVE, because nothing can reach it while
the guard above holds. A DEPTH guard that DIES is the alarm: something now
reaches it, which means the guard above it has weakened.
"""
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "factora.py"
WORK = ROOT / ".mutwork"

MUTATIONS = [
    # ── authorization ──
    ("commit: a stranger commits evidence for another's invoice",
     'if self._sender() != inv.seller:\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the seller commits evidence")',
     'if False:\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the seller commits evidence")'),
    ("assess: a stranger triggers another's assessment",
     'if self._sender() != inv.seller:\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the seller requests assessment")',
     'if False:\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the seller requests assessment")'),
    ("cancel: anyone cancels another's invoice",
     'if self._sender() != inv.seller:\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the seller cancels")',
     'if False:\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the seller cancels")'),
    ("ack: anyone speaks as the buyer",
     'if self._sender() != inv.buyer:\n            raise gl.vm.UserError(\n                f"{ERROR_EXPECTED} only the named buyer wallet can acknowledge")',
     'if False:\n            raise gl.vm.UserError(\n                f"{ERROR_EXPECTED} only the named buyer wallet can acknowledge")'),
    ("dispute: anyone files the buyer's dispute",
     'if self._sender() != inv.buyer:\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the named buyer wallet can dispute")',
     'if False:\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the named buyer wallet can dispute")'),
    ("repay: a stranger repays and reroutes the split",
     'if self._sender() != inv.buyer:\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the named buyer wallet repays")',
     'if False:\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the named buyer wallet repays")'),

    # ── identity and bounds ──
    ("identity: the same receivable registers twice",
     "if self.identity_registry.get(identity) is not None:",
     "if False:"),
    ("bounds: any invoice amount is accepted",
     "if not (MIN_INVOICE_ATTO <= amount <= MAX_INVOICE_ATTO):",
     "if False:"),
    ("parties: the seller may be their own buyer",
     "if buyer == seller:",
     "if False:"),

    # ── evidence integrity ──
    ("evidence: unknown types are accepted",
     'if etype not in EVIDENCE_TYPES:\n                raise gl.vm.UserError(f"{ERROR_EXPECTED} unknown evidence type: {etype}")',
     'if False:\n                raise gl.vm.UserError(f"{ERROR_EXPECTED} unknown evidence type: {etype}")', 0),
    ("evidence: a url that forges fence headers is accepted",
     "if any(c in u for c in (\"<\", \">\", '\"', \"'\", \"`\", \"|\")):",
     "if False:"),
    ("evidence: duplicate content passes as two exhibits",
     "if body_key in seen_bodies:",
     "if False:"),
    ("evidence: re-commit keeps the old verdict effective",
     'inv.status = "COMMITTED"\n        inv.pending_version = u256(0)',
     'inv.pending_version = u256(0)'),
    ("evidence: changes allowed while a challenge is open",
     'if inv.challenge_open == "yes":\n            raise gl.vm.UserError(\n                f"{ERROR_EXPECTED} a challenge is open — its evidence version "\n                "is already fixed")',
     'if False:\n            raise gl.vm.UserError(\n                f"{ERROR_EXPECTED} a challenge is open — its evidence version "\n                "is already fixed")'),

    # ── the sanitizer, both halves ──
    ("defang: the opening delimiter survives into the prompt",
     'return str(s or "").replace("<<<", "‹‹‹").replace(">>>", "›››")',
     'return str(s or "").replace(">>>", "›››")'),
    ("defang: the closing delimiter survives into the prompt",
     'return str(s or "").replace("<<<", "‹‹‹").replace(">>>", "›››")',
     'return str(s or "").replace("<<<", "‹‹‹")'),

    # ── the deferral gate ──
    ("finality: a verdict promotes before its window lapses",
     "if now <= int(inv.pending_until_epoch):",
     "if False:"),
    ("finality: promotion proceeds over an open challenge",
     'if inv.challenge_open == "yes":\n            raise gl.vm.UserError(\n                f"{ERROR_EXPECTED} a challenge is open — reassessment decides")',
     'if False:\n            raise gl.vm.UserError(\n                f"{ERROR_EXPECTED} a challenge is open — reassessment decides")'),
    ("assess: the same version can be re-rolled for a kinder panel",
     'if inv.status != "COMMITTED":',
     "if False:"),

    # ── the derivation: the code that composes the money fields ──
    ("derive: a NOT_SUPPORTED pillar no longer refuses financeability",
     'any_not = any(v == "NOT_SUPPORTED" for v in values)',
     "any_not = False"),
    ("derive: an open buyer dispute no longer forces review",
     "elif (dispute_open or examined_count == 0",
     "elif (False or examined_count == 0"),
    ("derive: an empty examined set supports a verdict",
     "or examined_count == 0",
     "or False"),
    ("derive: an unsupported transaction pillar no longer forces review",
     '          or findings.get("transaction_finding") == "INSUFFICIENT"\n',
     ""),
    ("derive: a hard conflict no longer raises the risk class",
     "elif any_insuff or len(hard) == 1:",
     "elif any_insuff:"),
    ("accountability: examined+excluded no longer covers the committed set",
     "if ex_ids | xc_ids != set(committed_ids):",
     "if False:"),
    ("accountability: an unreachable page counts as examined",
     'if not r["reachable"] and r["id"] in ex_ids:',
     "if False:"),

    # ── validator equivalence, field by field ──
    ("equivalence: the decision is not compared",
     'if mine["decision"] != theirs.get("decision"):',
     "if False:"),
    ("equivalence: risk is not compared",
     'if mine["risk"] != theirs.get("risk"):',
     "if False:"),

    ("equivalence: the examined set is not compared",
     'if mine["examined"] != theirs.get("examined"):',
     "if False:"),
    ("equivalence: hard conflicts are not compared",
     'if mine["hard_conflicts"] != theirs.get("hard_conflicts"):',
     "if False:"),
    ("equivalence: the score bucket tolerance is unbounded",
     "if abs(my_bucket - their_bucket) > 1:",
     "if False:"),
    # v0.2.0 made this a second layer. A leader claiming a page this node
    # could not read now also fails the fetched-bytes binding (nothing this
    # node fetched can be a prefix of nothing), and a leader calling dark a
    # page this node read fails the examined-set rule inside this node's own
    # judgment. The comparison stays, declared as what it now is.
    ("DEPTH record: row reachability, behind the fetched-bytes binding",
     'if bool(me["reachable"]) != bool(them.get("reachable")):',
     "if False:"),
    ("record: a digest no longer has to cover its own excerpt",
     'if _sha256_hex(excerpt) != them.get("digest"):',
     "if False:"),
    ("record: declared documents can differ from the committed bytes",
     'if me["type"] != "external_url" and excerpt != me["excerpt"]:',
     "if False:"),

    # ── the terms table ──
    ("terms: the no-ack cap is gone",
     "        return \"NO_ACK\", ADVANCE_BPS_NO_ACK",
     "        return \"NO_ACK\", ADVANCE_BPS_KEYS_ONLY"),

    # ── money ──
    ("fund: any deposit value is accepted",
     "if self._value() != advance:",
     "if False:"),
    ("fund: a party to the invoice funds itself",
     "if sender in (inv.seller, inv.buyer):",
     "if False:"),
    ("fund: the deadline is not enforced",
     "if now > int(inv.funding_deadline_epoch):",
     "if False:"),
    ("fund: funding opens over an open challenge",
     'if inv.challenge_open == "yes":\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} a challenge is open")',
     'if False:\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} a challenge is open")'),
    ("fund: a non-financeable state funds anyway",
     'if inv.status != "FINANCEABLE":\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} not open for funding in {inv.status}")',
     'if False:\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} not open for funding in {inv.status}")'),
    ("repay: any value counts as repayment",
     "if self._value() != amount:",
     "if False:"),
    ("bond: any value counts as the challenge bond",
     "if self._value() != bond:",
     "if False:"),
    ("settle: the split is prepared before repayment",
     'if inv.status != "REPAID":',
     "if False:"),
    ("settle: prepared over an open challenge",
     'if inv.challenge_open == "yes":\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} a challenge is open — resolve it first")',
     'if False:\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} a challenge is open — resolve it first")'),
    ("settle: executes twice",
     'if inv.status != "SETTLEMENT_READY":',
     "if False:"),
    ("settle: the fee is ten times the agreed rate",
     'fee = self._base(inv) * int(inv.fee_bps) // 10_000',
     'fee = self._base(inv) * int(inv.fee_bps) // 1_000'),
    ("claim: the ledger pays without zeroing",
     "self.claimable[sender] = u256(0)\n        self.escrow_atto",
     "self.escrow_atto"),
    ("claim: custody never decrements",
     "self.escrow_atto = u256(int(self.escrow_atto) - amount)\n        _Payee",
     "_Payee"),
    ("credit: allocations overwrite instead of accumulate",
     "self.claimable[addr] = u256(cur + amount)",
     "self.claimable[addr] = u256(amount)"),

    # ── challenge mechanics ──
    ("challenge: the seller challenges their own record",
     "if sender == inv.seller:",
     "if False:", 1),
    ("challenge: a second challenge stacks on the first",
     'if inv.challenge_open == "yes":\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} a challenge is already open")',
     'if False:\n            raise gl.vm.UserError(f"{ERROR_EXPECTED} a challenge is already open")'),
    ("lapse: opens before the stale window",
     "if now <= int(inv.challenge_filed_epoch) + REASSESS_STALE_SECONDS:",
     "if False:"),
    ("lapse: the challenged evidence version is not restored",
     'inv.evidence_version = u256(_as_int(snap.get("evidence_version"),\n                                            int(inv.evidence_version)))',
     'pass'),
    ("default: marked before due plus grace",
     "if now <= int(inv.due_epoch) + GRACE_SECONDS:",
     "if False:"),
    ("expire: marked before the funding deadline",
     "if now <= int(inv.funding_deadline_epoch):",
     "if False:"),

    # ── the clock ──
    ("clock: the beacon ceiling no longer refuses forward skew",
     "if now > max(witnesses) + MAX_CLOCK_DIVERGENCE:",
     "if False:"),
    ("clock: wall sources may diverge from each other",
     "if len(cands) >= 2 and (max(cands) - min(cands)) > MAX_CLOCK_DIVERGENCE:",
     "if False:"),

    # ── depth (expected to SURVIVE — reachable only if an upstream wall falls) ──
    ("DEPTH fund: the provider-set check behind the FUNDED status wall",
     "if inv.provider:\n            raise gl.vm.UserError(f\"{ERROR_EXPECTED} already funded\")",
     "if False:\n            raise gl.vm.UserError(f\"{ERROR_EXPECTED} already funded\")"),
    ("DEPTH promote: the table-refuses-risk landing behind the judged coercion",
     "if adv is None or fee is None:",
     "if False:"),
    ("DEPTH settle: negative seller share behind the fee table bounds",
     "if seller_total < 0:",
     "if False:"),
    # This entry used to say the walls "freeze status while a challenge is
    # open". They do not: repayment and default both move it, and believing
    # otherwise hid a lapse that put FUNDED back over REPAID. What is true is
    # narrower. Of the statuses a lapse may still restore, none can change
    # under an open challenge (promotion, funding and re-commitment are all
    # refused), so the restore writes back the value already there.
    ("DEPTH lapse: restoring a status that an open challenge cannot have "
     "changed",
     'inv.status = snap.get("status", inv.status)',
     'pass'),
    ("DEPTH equivalence: the finding ladder behind the derived-field "
     "comparison (a two-step swing always flips a derived field first)",
     "if abs(FINDING_STEP[mv] - FINDING_STEP[tv]) > 1:",
     "if False:"),


    # ── the dispute-invalidation rule (judge letter, v0.1.2) ──
    ("dispute: a post-judgment dispute leaves a pending verdict promotable",
     '''        if inv.status == "PENDING_FINALITY":
            if self._objection_unread(inv, int(inv.pending_version)):''',
     '''        if False:
            if self._objection_unread(inv, int(inv.pending_version)):'''),
    ("dispute: effective terms survive the obligor's repudiation",
     '''        elif inv.status == "FINANCEABLE":
            if self._objection_unread(inv, int(inv.assessed_version)):''',
     '''        elif False:
            if self._objection_unread(inv, int(inv.assessed_version)):'''),
    ("dispute: a lapsed challenge resurrects struck terms",
     '''        self._dispute_invalidates(inv)
        return "lapsed"''',
     '''        return "lapsed"'''),
    ("dispute: anyone can withdraw another buyer's dispute",
     "if self._sender() != inv.buyer:", "if False:", 2),
    ("dispute: a second dispute can pile onto an open one",
     '''        if self._dispute_open(inv):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} a dispute is already open")''',
     ""),
    # Nothing reaches these two while the filing path strikes first — they
    # exist for the day it weakens, and the sweep says so instead of
    # pretending a test pins them.
    ("DEPTH dispute: finalize promotes over an unseen dispute",
     '''if self._dispute_open(inv) and not json.loads(raw).get(
                "buyer_dispute_open", False):''',
     "if False:"),
    ("DEPTH dispute: funding proceeds over a standing dispute",
     '''        if self._dispute_open(inv):
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} the buyer's dispute stands between this "
                "verdict and funding — a reassessment must read it first")''',
     ""),

    # ── v0.2.0: registrar-attested identity ──
    ("attest: a stranger attests an entity for a party",
     """        else:
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} only a party to the invoice attests its own entity")""",
     """        else:
            side = "buyer\""""),
    ("attest: a mistyped identifier is accepted",
     "        if not _valid_lei(entity_id):",
     "        if False:"),
    ("attest: the check digits are not checked",
     "    return int(digits) % 97 == 1",
     "    return True"),
    ("attest: a party names its own register",
     "        if registry not in REGISTRIES:",
     "        if False:"),
    ("attest: identities are shopped between judgments",
     """        if mine:
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} this party already attested its entity")""",
     ""),
    ("attest: one entity sits on both sides of an invoice",
     """        if other and json.loads(other).get("entity_id") == entity_id:""",
     "        if False:"),
    ("attest: an entity is attested after money has moved",
     """        if inv.status not in ("DRAFT", "COMMITTED", "PENDING_FINALITY",
                              "FINANCEABLE", "NOT_FINANCEABLE", "REVIEW"):
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} an entity is attested before funding, not in {inv.status}")""",
     ""),
    ("identity: keys alone earn the top table",
     """    if entity.get("seller") == "REGISTERED" and entity.get("buyer") == "REGISTERED":""",
     "    if True:"),
    ("identity: one registered party counts as two",
     """    if entity.get("seller") == "REGISTERED" and entity.get("buyer") == "REGISTERED":""",
     """    if entity.get("seller") == "REGISTERED" or entity.get("buyer") == "REGISTERED":"""),
    ("identity: registration stands in for the countersignature",
     """    if not acked:
        return "NO_ACK", ADVANCE_BPS_NO_ACK""",
     ""),
    ("identity: an unattested party is judged on the model's say-so",
     """    if not claimed:
        return "NONE\"""",
     ""),
    ("identity: an unreachable register still registers",
     """    if not reachable:
        return "DECLARED\"""",
     ""),
    ("identity: a dissolved entity is not a contradiction",
     """    if not active:
        return "CONTRADICTED\"""",
     ""),
    # Behind the question gate: the panel is only ASKED about a side whose
    # registration is current, so an uncurrent one reaches the ladder with no
    # match and lands on DECLARED either way. The rung stays for the day the
    # gate is loosened.
    ("DEPTH identity: a lapsed registration, behind the question gate",
     """    if not current:
        return "DECLARED\"""",
     ""),
    ("identity: a register naming another party does not hold the record",
     "    elif (dispute_open or examined_count == 0 or entity_contradicted",
     "    elif (dispute_open or examined_count == 0"),
    ("identity: the contradiction never reaches the conflict set",
     """            if entity_contradicted:
                conflicts = sorted(set(conflicts + ["ENTITY_CONTRADICTED"]))""",
     ""),
    ("identity: a model raises a code the contract owns",
     "                if c in CONFLICT_CODES and c not in CODE_OWNED_CONFLICTS))",
     "                if c in CONFLICT_CODES))"),
    ("identity: a record for another identifier is accepted",
     """        if str(attrs.get("lei", "")).strip().upper() != lei:
            return "", False, False""",
     ""),
    ("identity: the register's text reaches the prompt with its fences live",
     "        text = _defang(_canonical(subset))[:MAX_REGISTRY_CHARS]",
     "        text = _canonical(subset)[:MAX_REGISTRY_CHARS]"),
    ("identity: an entity answer outside the enum is waved through",
     """                    if match not in ENTITY_MATCHES:
                        raise gl.vm.UserError(
                            f"{ERROR_LLM} {side}_entity_match outside the enum: {match}")""",
     ""),
    ("equivalence: identity classes are not compared",
     """            if mine["identity"] != theirs.get("identity"):""",
     "            if False:"),
    ("equivalence: a leader's register bytes are not bound to this node's",
     """                if them.get("excerpt") != me["excerpt"]:
                    return False
            return True""",
     "            return True"),
    ("equivalence: a fetched page may carry a fabricated ending",
     """                    if not excerpt or not me["excerpt"].startswith(excerpt):""",
     """                    if not excerpt or not (me["excerpt"].startswith(excerpt)
                                           or excerpt.startswith(me["excerpt"])):"""),
    ("equivalence: a reachable page may be stored as nothing",
     """                    if not excerpt or not me["excerpt"].startswith(excerpt):""",
     """                    if not me["excerpt"].startswith(excerpt):"""),

    # ── v0.2.0: the credit claim ──
    ("credit: anyone files the buyer's claim",
     """        if self._sender() != inv.buyer:
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} only the named buyer wallet files a credit claim")""",
     ""),
    ("credit: a claim is filed against a paid invoice",
     """        if inv.status in ("REPAID", "SETTLEMENT_READY", "SETTLED",
                          "CANCELLED", "EXPIRED", "RECOURSE_SETTLED"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} nothing to contest in {inv.status}")""",
     ""),
    ("credit: a second claim piles onto an open one",
     """        if self._credit_open(inv):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} a credit claim is already open")""",
     ""),
    ("credit: a zero or negative claim is accepted",
     """        if claim <= 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} the contested amount must be positive")""",
     ""),
    ("credit: a claim may swallow the whole invoice",
     "        if int(inv.amount_atto) - claim < MIN_INVOICE_ATTO:",
     "        if False:"),
    ("credit: claim text is unbounded",
     "        if not (10 <= len(text) <= MAX_CREDIT_TEXT_CHARS):",
     "        if False:"),
    ("credit: filing does not strike a verdict that never read it",
     """        inv.credit_claim_withdrawn_epoch = u256(0)
        self._dispute_invalidates(inv)""",
     "        inv.credit_claim_withdrawn_epoch = u256(0)"),
    ("credit: a verdict that priced a withdrawn claim stays in effect",
     """        elif d.get("credit_claim_open", False):
            return True
        return False""",
     "        return False"),
    ("credit: a withdrawal does not re-examine the verdict",
     """        inv.credit_claim_withdrawn_epoch = u256(self._require_clock())
        self._dispute_invalidates(inv)""",
     "        inv.credit_claim_withdrawn_epoch = u256(self._require_clock())"),
    ("credit: a funded invoice is flagged with no objection standing",
     """        elif (inv.status in ("FUNDED", "REPAID")
              and (self._dispute_open(inv) or self._credit_open(inv))):""",
     """        elif inv.status in ("FUNDED", "REPAID"):"""),
    # Behind the epoch check below it: a filing's epoch already identifies it,
    # so a different amount always arrives with a different epoch unless both
    # filings share one second. The amount is compared anyway, because that
    # second exists.
    ("DEPTH credit: a different amount, behind the filing epoch",
     """            if str(d.get("credit_claim_atto", "")) != str(int(inv.credit_claim_atto)):
                return True""",
     ""),
    ("credit: the same amount refiled later passes as the claim the panel read",
     """            if _as_int(d.get("credit_claim_epoch"), 0) != int(inv.credit_claim_epoch):
                return True""",
     ""),
    ("credit: finalize promotes over an unread claim",
     """        if self._objection_unread(inv, version):
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} the buyer contested part of this invoice \"""",
     """        if False:
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} the buyer contested part of this invoice \""""),
    ("credit: funding proceeds over an unread claim",
     """        if self._objection_unread(inv, int(inv.assessed_version)):
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} the buyer's credit claim stands between \"""",
     """        if False:
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} the buyer's credit claim stands between \""""),
    ("credit: anyone withdraws the buyer's claim",
     """        if self._sender() != inv.buyer:
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} only the named buyer wallet can withdraw")
        if not self._credit_open(inv):""",
     "        if not self._credit_open(inv):"),
    ("credit: a withdrawal needs no open claim",
     """        if not self._credit_open(inv):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} no credit claim is open")""",
     ""),
    ("credit: the contested part is financed anyway",
     "    base = amount - claim_atto\n",
     "    base = amount\n"),
    ("credit: an unsettled claim cuts the debt",
     """    return base, (base if finding == "SUPPORTED" else amount)""",
     "    return base, base"),
    ("credit: a supported claim leaves the full debt standing",
     """    return base, (base if finding == "SUPPORTED" else amount)""",
     "    return base, amount"),
    ("credit: the buyer's word alone moves the finding (floor and mirror)",
     """                if credit_finding != "INSUFFICIENT" and not credit_corroboration:""",
     "                if False:"),
    ("credit: an unexamined item corroborates",
     """                    i for i in (str(x).strip() for x in named) if i in ex_ids))""",
     """                    i for i in (str(x).strip() for x in named)))"""),
    ("credit: a contradicted claim raises no risk",
     """                if credit_finding == "NOT_SUPPORTED":
                    conflicts = sorted(set(conflicts + ["CREDIT_CLAIM_CONTRADICTED"]))""",
     ""),
    ("credit: a claim finding outside the enum is waved through",
     """                if credit_finding not in FINDINGS:
                    raise gl.vm.UserError(
                        f"{ERROR_LLM} credit_claim_finding outside the enum: {credit_finding}")""",
     ""),
    ("equivalence: the claim finding is not compared",
     """            if mine["credit_claim_finding"] != theirs.get("credit_claim_finding"):""",
     "            if False:"),
    ("money: the advance is priced on the uncontested invoice",
     "        advance = self._base(inv) * int(inv.advance_rate_bps) // 10_000",
     "        advance = int(inv.amount_atto) * int(inv.advance_rate_bps) // 10_000"),
    ("money: repayment ignores what the judgment says is owed",
     "        amount = self._due(inv)",
     "        amount = int(inv.amount_atto)"),
    ("money: the fee is charged on the contested part too",
     "        fee = self._base(inv) * int(inv.fee_bps) // 10_000",
     "        fee = int(inv.amount_atto) * int(inv.fee_bps) // 10_000"),
    ("money: struck terms keep their base and debt",
     """        inv.base_atto = u256(0)
        inv.due_atto = u256(0)
        inv.identity_tier = \"\"
""",
     ""),

    # ── v0.3.0: default adjudication ──
    ("default: a stranger files on somebody else's default",
     """        if not side:
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} only the seller, the buyer or the provider files on a default")""",
     """        if not side:
            side = "PROVIDER\""""),
    ("default: evidence is filed on an invoice that has not defaulted",
     """        if inv.status != "DEFAULTED":
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} default evidence is filed on a defaulted invoice, not in {inv.status}")""",
     ""),
    ("default: a side files without limit",
     "        if mine >= MAX_DEFAULT_FILINGS_PER_SIDE:",
     "        if False:"),
    ("default: a filing carries any number of items",
     "        if not isinstance(items, list) or not (1 <= len(items) <= MAX_DEFAULT_ITEMS):",
     "        if not isinstance(items, list):"),
    ("default: item content is unbounded",
     "            if not (20 <= len(content) <= MAX_DEFAULT_ITEM_CHARS):",
     "            if False:"),
    ("default: an answer in the window leaves the ruling standing",
     """        inv.default_filings_count = u256(n)
        inv.default_pending = \"\"
        inv.default_pending_until = u256(0)""",
     "        inv.default_filings_count = u256(n)"),
    ("default: a stranger asks for a ruling",
     """        if not self._side_of(inv, self._sender()):
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} only the seller, the buyer or the provider asks for a ruling")""",
     ""),
    ("default: a ruling is asked on an invoice that has not defaulted",
     """        if inv.status != "DEFAULTED":
            raise gl.vm.UserError(
                f"{ERROR_EXPECTED} a default ruling is for a defaulted invoice, not {inv.status}")""",
     ""),
    ("default: a second ruling stacks on one still in its window",
     """        if inv.default_pending:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} a ruling is already waiting out its window")""",
     ""),
    ("default: the same record is re-rolled for a kinder panel",
     "        if filings <= int(inv.default_ruled_filings):",
     "        if False:"),
    ("default: a ruling is asked with nothing filed",
     """        if filings == 0:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} file evidence on the default first")""",
     ""),
    ("default: a ruling names somebody before its window closes",
     """        if now <= int(inv.default_pending_until):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} the ruling's window is still open")""",
     ""),
    ("default: the buyer's own proof names the seller (the floor)",
     """        return finding if any(a in ("SELLER", "PROVIDER") for a in named) else "UNRESOLVED\"""",
     "        return finding"),
    ("default: the seller's own documents name the buyer (the mirror)",
     """        if buyer_acked or any(a in ("BUYER", "PROVIDER") for a in named):
            return finding
        return "UNRESOLVED\"""",
     "        return finding"),
    ("default: the countersignature no longer carries a default",
     """        if buyer_acked or any(a in ("BUYER", "PROVIDER") for a in named):""",
     """        if any(a in ("BUYER", "PROVIDER") for a in named):"""),
    # Behind the floor itself, which looks each named item up by author and
    # so ignores any id that is not on the record. Filtering first keeps the
    # stored ruling honest about what stood behind it.
    ("DEPTH default: invented items, behind the floor's own author lookup",
     "            named = sorted(set(i for i in (str(x).strip() for x in named) if i in authors))",
     "            named = sorted(set(str(x).strip() for x in named))"),
    ("default: a finding outside the enum is waved through",
     """            if said not in DEFAULT_FINDINGS:
                raise gl.vm.UserError(f"{ERROR_LLM} default_finding outside the enum: {said}")""",
     ""),
    ("equivalence: the default finding is not compared",
     """            if mine["finding"] != theirs.get("finding"):
                print(f"[DISAGREE] default finding""",
     """            if False:
                print(f"[DISAGREE] default finding"""),
    ("equivalence: the default record is not compared",
     """            if mine["rows"] != theirs.get("rows"):
                return False""",
     ""),
    ("recourse: anyone pays it, or the seller pays it unruled",
     """        if inv.status != "DEFAULTED" or inv.default_liable != "SELLER":""",
     "        if False:"),
    ("recourse: only the status is checked, not the ruling",
     """        if inv.status != "DEFAULTED" or inv.default_liable != "SELLER":""",
     """        if inv.status != "DEFAULTED":"""),
    ("recourse: a stranger pays it",
     """        if self._sender() != inv.seller:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} only the seller pays recourse")""",
     ""),
    ("recourse: any amount is accepted",
     """        if self._value() != owed:
            raise gl.vm.UserError(f"{ERROR_EXPECTED} recourse is exactly {owed} atto")""",
     ""),
    ("recourse: the fee the provider was owed is left out",
     "        owed = int(inv.advance_atto) + self._base(inv) * int(inv.fee_bps) // 10_000\n        if self._value() != owed:",
     "        owed = int(inv.advance_atto)\n        if self._value() != owed:"),
    ("recourse: the deposit is credited but not held",
     """        self.escrow_atto = u256(int(self.escrow_atto) + owed)
        self._credit(inv.provider, owed)""",
     "        self._credit(inv.provider, owed)"),
    ("recourse: the instrument stays open after the provider is whole",
     """        inv.status = "RECOURSE_SETTLED\"""",
     "        pass"),
    ("recourse: a pending ruling outlives the payment",
     """        self._set_liable(inv, "")
        inv.default_pending = \"\"
        inv.default_pending_until = u256(0)
        inv.status = "RECOURSE_SETTLED\"""",
     """        self._set_liable(inv, "")
        inv.status = "RECOURSE_SETTLED\""""),
    ("ledger: repayment leaves the liability on the wallet",
     """        self._set_liable(inv, "")
        inv.default_pending = \"\"
        inv.default_pending_until = u256(0)
        return "repaid\"""",
     """        inv.default_pending = \"\"
        inv.default_pending_until = u256(0)
        return "repaid\""""),
    ("ledger: repayment leaves a ruling to finalize afterwards",
     """        self._set_liable(inv, "")
        inv.default_pending = \"\"
        inv.default_pending_until = u256(0)
        return "repaid\"""",
     """        self._set_liable(inv, "")
        return "repaid\""""),
    ("ledger: a moved liability is counted twice",
     "        for which, delta in ((old, -1), (side, 1)):",
     "        for which, delta in ((side, 1),):"),
    ("ledger: an adjudicated default does not follow the buyer",
     """            if buyer_liabilities:
                conflicts = sorted(set(conflicts + ["BUYER_IN_DEFAULT"]))""",
     ""),
    ("ledger: an adjudicated recourse does not follow the seller",
     """            if seller_liabilities:
                conflicts = sorted(set(conflicts + ["SELLER_IN_RECOURSE"]))""",
     ""),
    ("terminal: a settled recourse still takes a dispute",
     """        if inv.status in ("SETTLED", "CANCELLED", "EXPIRED", "RECOURSE_SETTLED"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} nothing to dispute in {inv.status}")""",
     """        if inv.status in ("SETTLED", "CANCELLED", "EXPIRED"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} nothing to dispute in {inv.status}")"""),
    ("terminal: a settled recourse still takes a credit claim",
     """                          "CANCELLED", "EXPIRED", "RECOURSE_SETTLED"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} nothing to contest in {inv.status}")""",
     """                          "CANCELLED", "EXPIRED"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} nothing to contest in {inv.status}")"""),
    ("terminal: a settled recourse still takes an acknowledgement",
     """        if inv.status in ("SETTLED", "CANCELLED", "EXPIRED", "RECOURSE_SETTLED"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} nothing to acknowledge in {inv.status}")""",
     """        if inv.status in ("SETTLED", "CANCELLED", "EXPIRED"):
            raise gl.vm.UserError(f"{ERROR_EXPECTED} nothing to acknowledge in {inv.status}")"""),
    ("defang: a default filing reaches the panel with its fences live",
     """                text = _defang(it["content"])
                rows.append({"id": it["id"], "side": f["side"], "kind": "DEFAULT FILING",""",
     """                text = it["content"]
                rows.append({"id": it["id"], "side": f["side"], "kind": "DEFAULT FILING","""),

    ("lapse: the snapshot is restored over money that moved since",
     '''        if inv.status not in ("REPAID", "SETTLEMENT_READY", "SETTLED",
                              "DEFAULTED", "RECOURSE_SETTLED"):
            inv.status = snap.get("status", inv.status)''',
     '''        if True:
            inv.status = snap.get("status", inv.status)'''),

    ("default: a challenger's paper names the seller (the buyer may be the challenger)",
     '''        return finding if any(a in ("SELLER", "PROVIDER") for a in named) else "UNRESOLVED"''',
     '''        return finding if any(a in ("SELLER", "PROVIDER", "CHALLENGER") for a in named) else "UNRESOLVED"'''),
    ("default: a challenger's item is read as the seller's own",
     '''                who = ("CHALLENGER" if str(it["label"]).startswith(CHALLENGER_TAG)
                       else "SELLER")''',
     '''                who = "SELLER"'''),
    ("evidence: the seller wears the challenger's label",
     "            if label.upper().startswith(CHALLENGER_TAG):",
     "            if False:"),

    # ── the accept-control: must stay GREEN ──
    ("CONTROL (must survive)",
     '"version": "0.3.0",',
     '"version": "0.0.9",  # control'),
]

EXPECTED_MIN_GUARDS = 150


def run_suite(cwd: pathlib.Path) -> bool:
    r = subprocess.run(
        [sys.executable, "-m", "pytest", "tests/direct", "-q", "-x",
         "--no-header", "-p", "no:cacheprovider"],
        cwd=cwd, capture_output=True, text=True,
    )
    return r.returncode == 0


def apply(src: str, find: str, repl: str, nth) -> str:
    if nth is None:
        if src.count(find) != 1:
            raise SystemExit(
                f"anchor is not unique ({src.count(find)} matches); add an nth index:\n  {find[:70]}")
        return src.replace(find, repl)
    parts = src.split(find)
    if len(parts) <= nth + 1:
        raise SystemExit(f"anchor occurrence {nth} not found:\n  {find[:70]}")
    return find.join(parts[:nth + 1]) + repl + find.join(parts[nth + 1:])


def main() -> int:
    entries = []
    for m in MUTATIONS:
        name, find, repl = m[0], m[1], m[2]
        nth = m[3] if len(m) > 3 else None
        entries.append((name, find, repl, nth))

    real_guards = sum(1 for e in entries
                      if not e[0].startswith(("CONTROL", "DEPTH")))
    if real_guards < EXPECTED_MIN_GUARDS:
        print(f"SWEEP TOO SMALL: {real_guards} guards, floor is "
              f"{EXPECTED_MIN_GUARDS}. Entries have gone missing, or the "
              f"floor was not raised deliberately.")
        return 1

    src = CONTRACT.read_text(encoding="utf-8")
    if WORK.exists():
        shutil.rmtree(WORK)
    shutil.copytree(ROOT, WORK, ignore=shutil.ignore_patterns(
        ".git", ".mutwork", "web", "node_modules", "__pycache__",
        ".pytest_cache", "artifacts"))

    killed, survived, control_ok, depth_ok = 0, [], True, []
    for name, find, repl, nth in entries:
        mutated = apply(src, find, repl, nth)
        (WORK / "contracts" / "factora.py").write_text(mutated, encoding="utf-8")
        green = run_suite(WORK)
        if name.startswith("CONTROL"):
            control_ok = green
            print(f"  {'ok' if green else 'BROKEN HARNESS'}  {name}")
        elif name.startswith("DEPTH"):
            depth_ok.append((name, green))
            print(f"  {'depth-holds' if green else 'DEPTH DIED'}  {name}")
        elif green:
            survived.append(name)
            print(f"  SURVIVED  {name}")
        else:
            killed += 1
            print(f"  killed    {name}")

    shutil.rmtree(WORK)
    print()
    print(f"{killed}/{real_guards} guards pinned; "
          f"{len(depth_ok)} depth declared; control "
          f"{'green' if control_ok else 'RED'}")
    if survived:
        print("UNPINNED GUARDS:")
        for s in survived:
            print(f"  - {s}")
        return 1
    if not control_ok:
        print("The accept-control failed: the harness is broken and this "
              "sweep proves nothing.")
        return 1
    for name, green in depth_ok:
        if not green:
            print(f"DEPTH GUARD DIED: {name} — something now reaches it; "
                  "the wall above it has weakened.")
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
