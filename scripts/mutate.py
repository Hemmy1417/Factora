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

    # ── judged-block coercions ──
    ("coerce: an open buyer dispute no longer caps the decision",
     'if decision == "FINANCEABLE" and dispute_open:',
     "if False:"),
    ("coerce: HIGH risk can be financeable",
     'if decision == "FINANCEABLE" and risk == "HIGH":',
     "if False:"),
    ("coerce: an empty examined set supports a verdict",
     "if len(ex_ids) == 0:",
     "if False:"),
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
    ("equivalence: the findings are not compared",
     'if mine["findings"] != theirs.get("findings"):',
     "if False:"),
    ("equivalence: the examined set is not compared",
     'if mine["examined"] != theirs.get("examined"):',
     "if False:"),
    ("equivalence: conflict codes are not compared",
     'if mine["conflicts"] != theirs.get("conflicts"):',
     "if False:"),
    ("equivalence: the score bucket is not compared",
     "if my_bucket != their_bucket:",
     "if False:"),
    ("record: row reachability is not compared",
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
     "table = ADVANCE_BPS if acked else ADVANCE_BPS_NO_ACK\n            adv = table.get(risk)",
     "table = ADVANCE_BPS\n            adv = table.get(risk)"),

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
     'fee = int(inv.amount_atto) * int(inv.fee_bps) // 10_000',
     'fee = int(inv.amount_atto) * int(inv.fee_bps) // 1_000'),
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
     "if False:"),
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
    ("DEPTH lapse: the status restore behind the walls that freeze status "
     "while a challenge is open",
     'inv.status = snap.get("status", inv.status)',
     'pass'),

    # ── the accept-control: must stay GREEN ──
    ("CONTROL (must survive)",
     '"version": "0.1.0",',
     '"version": "0.0.9",  # control'),
]

EXPECTED_MIN_GUARDS = 55


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
