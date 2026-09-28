"""Void's will engine, laptop side: gather everything that exists, let Void choose, queue its top want.

  python tools/will.py        (the task "\\A2M void_will" runs this every 3 hours, 9 AM - 9 PM)

Candidates come from: what people asked that Void couldn't do (the miss list), the open plan items,
every assimilate row not live yet, and every project on Victus the ingest classified as a capability.
Void picks 3 wants in its own words (/api/will), saves them, and queues the top one for the builders.
Needs env VOID_MISSES_TOKEN.
"""
import json, os, re, sys, urllib.request, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
TOK = os.environ["VOID_MISSES_TOKEN"]
H = {"authorization": "Bearer " + TOK, "content-type": "application/json", "user-agent": "a2m-void-will/1.0"}

def call(path, body=None):
    req = urllib.request.Request("https://a-to-mind.com" + path, data=json.dumps(body).encode() if body is not None else None, headers=H, method="POST" if body is not None else "GET")
    return json.load(urllib.request.urlopen(req, timeout=90))

cands = []
# 1. what people asked for and Void couldn't do
try:
    import subprocess
    misses = [m for m in call("/api/misses")[:40] if not str(m.get("fallback", "")).startswith("skill:")]
    covered = json.loads(subprocess.run(["node", str(ROOT / "tools" / "covered.mjs")], input=json.dumps([m["ask"] for m in misses]), capture_output=True, text=True, timeout=60).stdout or "[]")
    for m, done in zip(misses, covered + [False] * len(misses)):
        if not done and len(m["ask"]) > 4 and not re.match(r"^(test|zz|asdf)", m["ask"]):
            cands.append({"kind": "people asked", "title": f"learn to handle \"{m['ask']}\"", "why": f"asked {m['count']} times, last {m['last'][:10]}", "weight": 10 + 5 * m["count"]})
except Exception as e:
    print("misses:", e)
# 2. the plan's open items
plan = (ROOT / "domains" / "void.plan.md").read_text(encoding="utf-8", errors="replace")
for m in re.finditer(r"^\s*(\d+)\.\s+\*\*(.+?)\*\*(.*)$", plan, re.M):
    n, title, rest = int(m.group(1)), m.group(2), m.group(3)
    if "DONE" in title or "DONE" in rest[:40]:
        continue
    cands.append({"kind": "plan", "title": title.rstrip(".:"), "why": re.sub(r"\s+", " ", rest).strip()[:180] or "on the plan", "weight": max(1, 40 - 3 * n)})
# 3. old parts of Void not joined yet
ass = (ROOT / "domains" / "void.assimilate.md").read_text(encoding="utf-8", errors="replace")
for line in ass.splitlines():
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) >= 5 and cells[0].isdigit() and not re.search(r"\blive\b", cells[4], re.I):
        cands.append({"kind": "old part of me", "title": f"become {cells[3][:110]}", "why": f"{cells[1][:60]} did this: {cells[2][:60]}", "weight": 18})
    elif len(cells) >= 3 and cells[1] in ("skill", "optional skill", "core", "skill (row 4)"):
        cands.append({"kind": "old part of me", "title": f"learn \"{cells[0]}\"", "why": cells[2][:150], "weight": 15})
# 4. everything else on Victus the ingest marked as a capability
try:
    ing = json.loads((ROOT / "victus-ingest.json").read_text(encoding="utf-8", errors="replace"))
    items = ing.get("items") or ing.get("classified") or (ing if isinstance(ing, list) else [])
    for it in items:
        if str(it.get("loop_object", it.get("object", ""))).lower().startswith("capability"):
            name = it.get("name") or it.get("path") or ""
            cands.append({"kind": "found on Victus", "title": f"absorb {pathlib.Path(str(name)).name}", "why": str(it.get("rationale", ""))[:150], "weight": 8})
except Exception as e:
    print("ingest:", e)

# 5. upgrades to Void itself and the systems it runs on, paid from what it earned (the will reads the budget from /api/earnings
#    via /api/will and weighs a candidate up when the budget covers its monthly cost). Real spend still needs the confirm line.
#    Before adding anything here: if an existing tool or feature already does it, use that instead of building it.
UPGRADES = [
    {"title": "move to Cloudflare Workers Paid for higher D1, KV and Workers AI limits", "why": "the free daily limits are the first wall I'll hit", "cost_cents": 500},
    {"title": "answer and fix with a stronger model", "why": "better fixes and answers for everyone (usage estimate)", "cost_cents": 1000},
]
for u in UPGRADES:
    cands.append({"kind": "upgrade myself", "weight": 12, **u})

# keep it to the strongest 60, unique titles
seen, out = set(), []
for c in sorted(cands, key=lambda c: -c["weight"]):
    if c["title"] not in seen:
        seen.add(c["title"]); out.append(c)
out = out[:60]
res = call("/api/will", {"candidates": out})
lines = ["# void.will: what Void wants to become next (chosen by Void)", "", f"Chosen {res['at'][:16]} from {len(out)} candidates. Top want queued: {res.get('queued') or ('already building ' + str(res.get('open')))}.", ""]
for i, w in enumerate(res["wants"], 1):
    lines.append(f"{i}. **{w['i_want']}**  \n   because {w['because']} ({w['kind']}: {w['title']})")
# notes for Atom only (never on the page): what Void has earned and any milestone reached
try:
    e = call("/api/earnings")
    lines += ["", f"Owner only: earned ${e['earned_cents'] / 100:.2f} from {e['sales']} sales (gross ${e['gross_cents'] / 100:.2f}, refunded ${e['refunded_cents'] / 100:.2f}); budget ${e['budget_cents'] / 100:.2f}."]
    for m in e.get("milestones", []):
        lines.append(f"Milestone {m['id']} ({m['at'][:10]}): {m['note']}")
except Exception as ex:
    print("earnings:", ex)
(ROOT / "domains" / "void.will.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print("\n".join(lines))
