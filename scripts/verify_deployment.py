"""Prove a deployed contract is the source in this repository.

    python scripts/verify_deployment.py <ADDRESS> [--rpc URL]

A deploy log says a transaction succeeded. It does not say the bytes running
on-chain are the bytes in front of you, and every claim this project makes
about the contract is worthless if those differ. So this reads the code back
off the chain and compares it character for character.

It also checks the two things a byte-match alone would miss:

  * the file's own version header agrees with what get_config reports live,
    so a reader of the source and a reader of the chain are told the same
    version;
  * the callable surface is what the tests exercised.

Exit code 0 only if everything matches, so CI can gate on it.

WHY THE OUTPUT NEEDS TRIMMING. `genlayer code` wraps the source in a banner:
deprecation notices and a progress line before it, a success tick after. A
naive comparison includes that wrapper and reports a mismatch on a contract
that is in fact identical, which trains everyone to ignore the check. It is
trimmed explicitly here, and the trimming is the only liberty taken.
"""
import argparse
import json
import pathlib
import re
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "factora.py"
DEFAULT_RPC = "https://studio.genlayer.com/api"

EXPECTED_VIEWS = {
    "get_assessment", "get_claimable", "get_config", "get_evidence",
    "get_invoice", "get_invoices", "get_invoices_for", "get_stats",
}
EXPECTED_WRITES = {
    "acknowledge_invoice", "cancel_invoice", "challenge", "challenge_lapse",
    "claim", "claim_advance", "commit_evidence", "create_invoice",
    "execute_settlement", "file_buyer_dispute", "finalize_assessment",
    "fund", "mark_defaulted", "mark_expired", "prepare_settlement",
    "reassess", "repay", "request_assessment",
}
EXPECTED_PAYABLE = {"challenge", "fund", "repay"}


def run(args: list[str]) -> str:
    # On Windows the CLI is a .cmd shim, which CreateProcess will not find from
    # the bare name. Resolving it keeps this runnable on every platform without
    # handing the argument list to a shell.
    exe = shutil.which(args[0])
    if exe is None:
        raise SystemExit(
            f"{args[0]} is not on PATH. Install the GenLayer CLI, or pass --rpc "
            "to a machine that has it.")
    r = subprocess.run([exe, *args[1:]], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    # stdout ONLY. The CLI writes its deprecation notices and progress lines to
    # stderr, and concatenating them lands that text AFTER the payload, where
    # it defeats the trailing trim and shows up as a phantom mismatch on a
    # contract that is in fact identical.
    if not (r.stdout or "").strip():
        raise SystemExit(
            f"`{' '.join(args)}` produced no output.\n{(r.stderr or '')[:600]}")
    return r.stdout


# The CLI's closing banner, which varies by subcommand: "Read operation
# successfully executed", "Contract code retrieved successfully". Matched on
# the word they share rather than on the leading tick, because that glyph
# arrives mangled when the console codepage is not UTF-8, and a trimmer that
# silently stops working reports a false mismatch on an identical contract.
BANNER = re.compile(r"\b(successfully|operation failed)\b", re.I)


def unwrap(cli_output: str) -> str:
    """Strip the CLI's banner from around the payload."""
    if "Result:" not in cli_output:
        raise SystemExit("the CLI produced no Result block:\n" + cli_output[:800])
    body = cli_output.split("Result:", 1)[1].lstrip("\n")
    lines = body.split("\n")
    while lines and (not lines[-1].strip() or BANNER.search(lines[-1])):
        lines.pop()
    return "\n".join(lines)


def unwrap_json(cli_output: str):
    """Pull the first complete JSON value out of a Result block.

    Structural rather than line-based: the payload is decoded from its opening
    brace and whatever the CLI prints afterwards is simply not consumed.
    """
    body = unwrap(cli_output)
    start = min((i for i in (body.find("{"), body.find("[")) if i >= 0), default=-1)
    if start < 0:
        raise SystemExit("the CLI's Result block held no JSON:\n" + body[:400])
    value, _ = json.JSONDecoder().raw_decode(body[start:])
    return value


def check_code(addr: str, rpc: str) -> bool:
    onchain = unwrap(run(["genlayer", "code", addr, "--rpc", rpc]))
    local = CONTRACT.read_text(encoding="utf-8").rstrip("\n")
    if onchain == local:
        print(f"  code      BYTE-MATCH ({len(local)} characters)")
        return True
    print(f"  code      MISMATCH: on-chain {len(onchain)} chars, local {len(local)}")
    for i, (a, b) in enumerate(zip(local.split("\n"), onchain.split("\n")), 1):
        if a != b:
            print(f"            first difference at line {i}")
            print(f"              local:   {a[:90]}")
            print(f"              onchain: {b[:90]}")
            break
    return False


def check_version(addr: str, rpc: str) -> bool:
    cfg = unwrap_json(run(["genlayer", "call", addr, "get_config", "--rpc", rpc]))
    live = str(cfg.get("version", ""))
    # The version comment sits below the pinned runner header (the Depends
    # line must be first), so it is looked for in the file's opening lines.
    src = ""
    for line in CONTRACT.read_text(encoding="utf-8").splitlines()[:6]:
        m = re.match(r"^#\s*v(\d\S*)$", line.strip())
        if m:
            src = m.group(1)
            break
    if src and src == live:
        print(f"  version   {live} on-chain, {src} in the source header")
        return True
    print(f"  version   MISMATCH: get_config says {live!r}, the source header says {src!r}")
    return False


def check_schema(addr: str, rpc: str) -> bool:
    text = run(["genlayer", "schema", addr, "--rpc", rpc])
    text = text[text.index("methods: {"):] if "methods: {" in text else text
    views, writes, payable = set(), set(), set()
    for m in re.finditer(r"\n    ([a-z_0-9]+): \{", text):
        name = m.group(1)
        body = text[m.end(): m.end() + 700]
        nxt = re.search(r"\n    [a-z_0-9]+: \{", body)
        if nxt:
            body = body[:nxt.start()]
        (views if "readonly: true" in body else writes).add(name)
        if "payable: true" in body:
            payable.add(name)

    ok = True
    for label, got, want in (("view", views, EXPECTED_VIEWS),
                             ("write", writes, EXPECTED_WRITES),
                             ("payable", payable, EXPECTED_PAYABLE)):
        if got == want:
            continue
        ok = False
        print(f"  schema    {label} surface differs")
        if want - got:
            print(f"              missing: {sorted(want - got)}")
        if got - want:
            print(f"              unexpected: {sorted(got - want)}")
    if ok:
        print(f"  schema    {len(views)} view, {len(writes)} write, "
              f"{len(payable)} payable ({', '.join(sorted(payable))})")
    return ok


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("address")
    ap.add_argument("--rpc", default=DEFAULT_RPC)
    a = ap.parse_args()

    print(f"verifying {a.address}")
    results = [check_code(a.address, a.rpc),
               check_version(a.address, a.rpc),
               check_schema(a.address, a.rpc)]
    if all(results):
        print("\nthe deployed contract IS this source")
        return 0
    print("\nVERIFICATION FAILED: do not record this address as live")
    return 1


if __name__ == "__main__":
    sys.exit(main())
