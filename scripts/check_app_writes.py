"""Every write the app composes must be a write the contract has.

    python scripts/check_app_writes.py

The app and the contract are two documents describing one interface, and
nothing but a wallet prompt connects them at runtime. A method renamed, an
argument added, a payable flag flipped: each compiles, passes every unit
test on its own side, and fails only when a person presses the button. So
this reads both sides and compares them:

  * the contract's public writes, their argument counts, and which are
    payable, straight from the source's syntax tree;
  * every write the app composes, its argument count, and whether it sends
    value, from the two call shapes the app uses.

Exit code 0 only if every app write exists, carries the right number of
arguments, sends value exactly when the method is payable, and no contract
write is left without an action in the app.
"""
import ast
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "contracts" / "factora.py"
APP = ROOT / "web" / "app"


def contract_writes() -> dict:
    tree = ast.parse(CONTRACT.read_text(encoding="utf-8"))
    out = {}
    for cls in (n for n in tree.body if isinstance(n, ast.ClassDef) and n.name == "Factora"):
        for fn in (f for f in cls.body if isinstance(f, ast.FunctionDef)):
            decos = [ast.unparse(d) for d in fn.decorator_list]
            if any("public.write" in d for d in decos):
                out[fn.name] = (len(fn.args.args) - 1, any("payable" in d for d in decos))
    return out


def split_args(text: str, start: int) -> tuple:
    """-> (argument count, index just past the closing bracket). `start` is
    the index just after the opening '['."""
    depth, count, current, i = 1, 0, "", start
    while depth:
        ch = text[i]
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        if depth == 1 and ch == ",":
            count, current = count + 1, ""
        elif depth >= 1:
            current += ch
        i += 1
    return count + (1 if current.strip() else 0), i


def app_writes() -> list:
    found = []
    for path in sorted(APP.rglob("*.tsx")):
        text = path.read_text(encoding="utf-8")
        # shape one: write("method", [args], value, ...)
        for m in re.finditer(r'write\(\s*"([a-z_]+)",\s*\[', text):
            n, end = split_args(text, m.end())
            value = text[end:end + 60].split(",")[1].strip()
            found.append((m.group(1), n, value != "0n", path.name))
        # shape two: { functionName: "method", args: [...], valueAtto: ... }
        for m in re.finditer(r'functionName:\s*"([a-z_]+)",\s*args:\s*\[', text):
            n, end = split_args(text, m.end())
            v = re.search(r"valueAtto:\s*([^,\n]+)", text[end:end + 120])
            found.append((m.group(1), n, bool(v) and v.group(1).strip() != "0n", path.name))
    return found


def main() -> int:
    contract, app = contract_writes(), app_writes()
    problems = []
    for name, n, sends_value, where in app:
        if name not in contract:
            problems.append(f"{where}: the app calls {name}, which the contract does not have")
            continue
        want_n, payable = contract[name]
        if n != want_n:
            problems.append(f"{where}: {name} is composed with {n} arguments; the contract takes {want_n}")
        if sends_value != payable:
            problems.append(f"{where}: {name} {'sends' if sends_value else 'sends no'} value; "
                            f"the contract method is {'payable' if payable else 'not payable'}")
    unreachable = sorted(set(contract) - {a[0] for a in app})
    for name in unreachable:
        problems.append(f"the contract write {name} has no action anywhere in the app")
    for p in problems:
        print("  MISMATCH  " + p)
    print(f"{len(contract)} contract writes, {len({a[0] for a in app})} reachable from the app, "
          f"{len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
