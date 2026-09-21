# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# Disposable probe: can every validator read one GLEIF record, and do they
# all keep the same stable subset of it? Not part of Factora.
import json
from genlayer import *


class RegistryProbe(gl.Contract):
    last: str

    def __init__(self):
        self.last = ""

    @gl.public.write
    def probe(self, lei: str) -> str:
        url = "https://api.gleif.org/api/v1/lei-records/" + lei

        def read() -> dict:
            out = {"render": "", "get": ""}
            try:
                body = str(gl.nondet.web.render(url, mode="text") or "")
                a = json.loads(body)["data"]["attributes"]
                out["render"] = a["entity"]["legalName"]["name"] + "|" + a["entity"]["status"] + "|" + a["registration"]["status"]
            except Exception as e:
                out["render"] = "ERR " + type(e).__name__
            try:
                resp = gl.nondet.web.get(url)
                body = resp.body.decode("utf-8") if isinstance(resp.body, (bytes, bytearray)) else str(resp.body)
                a = json.loads(body)["data"]["attributes"]
                out["get"] = a["entity"]["legalName"]["name"] + "|" + a["entity"]["status"] + "|" + a["registration"]["status"]
            except Exception as e:
                out["get"] = "ERR " + type(e).__name__
            return out

        def agree(leader) -> bool:
            if not isinstance(leader, gl.vm.Return):
                return False
            mine = read()
            print("[PROBE] mine", mine, "theirs", leader.calldata)
            return mine == leader.calldata

        res = gl.vm.run_nondet_unsafe(read, agree)
        self.last = json.dumps(res)
        return self.last

    @gl.public.view
    def get_last(self) -> str:
        return self.last
