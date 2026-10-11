"""Void's will engine, laptop side: gather everything that exists, let Void choose, queue its top want.

  python tools/will.py        (the task "\\A2M void_will" runs this every 3 hours, 9 AM - 9 PM)

Candidates come from: what people asked that Void couldn't do (the miss list), the open items of
domains/void.frontier.md (the one build order since 2026-10-11), every project on Victus the ingest classified as a capability, upgrades
to Void itself, and ideas from everything that passed through Void as input (domains/inputs/*/records.jsonl,
tagged with their source, e.g. growth-ledger-backlog). Rule for all of them: use what already exists before building.
Void picks 3 wants in its own words (/api/will), saves them, and queues the top one for the builders.
Needs env VOID_MISSES_TOKEN.  `python tools/will.py --candidates [--all]` prints the candidate list only (--all = before the top-60 cut; no network without the token).
"""
import json, os, re, sys, urllib.request, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
TOK = os.environ.get("VOID_MISSES_TOKEN", "")
try:
    sys.stdout.reconfigure(errors="replace")  # a Windows console/pipe (cp1252) must never crash the will on a character
except Exception:
    pass
H = {"authorization": "Bearer " + TOK, "content-type": "application/json", "user-agent": "a2m-void-will/1.0"}

# the same test-traffic list as void-live-deploy/lib/noise.js: probes and pings are never wants
NOISE = re.compile(r"^(?:test|testing|probe|ping|ping-test|pong|hello world test|research probe|test miss(?: from research)?|health ?check|smoke ?test|asdf+|qwerty|zz+q*x*)\s*[.!?]*$|^[bcdfghjklmnpqrstvwxz]{4,8}$|^/[\w-]+$|^zz+\b.*\bprobe\b|^(?:test|probe)[\s:_-]+\S*$", re.I)

def call(path, body=None):
    if not TOK:
        raise RuntimeError("no VOID_MISSES_TOKEN")
    req = urllib.request.Request("https://a-to-mind.com" + path, data=json.dumps(body).encode() if body is not None else None, headers=H, method="POST" if body is not None else "GET")
    return json.load(urllib.request.urlopen(req, timeout=90))

def gather(cap=60, with_done=False):
    cands = []
    # 1. what people asked for and Void couldn't do
    try:
        import subprocess
        misses = [m for m in call("/api/misses")[:40] if not str(m.get("fallback", "")).startswith("skill:")]
        covered = json.loads(subprocess.run(["node", str(ROOT / "tools" / "covered.mjs")], input=json.dumps([m["ask"] for m in misses]), capture_output=True, text=True, timeout=60).stdout or "[]")
        for m, done in zip(misses, covered + [False] * len(misses)):
            if not done and len(m["ask"]) > 4 and not NOISE.match(str(m["ask"]).strip()):
                cands.append({"kind": "people asked", "title": f"learn to handle \"{m['ask']}\"", "why": f"asked {m['count']} times, last {m['last'][:10]}", "weight": 10 + 5 * m["count"]})
    except Exception as e:
        print("misses:", e, file=sys.stderr)
    # 2. the open items of the frontier, the one build order (cleanup step 4, 2026-10-11; it replaces the plan's open items and
    #    the assimilation rows not live, which were checked and folded in there). Same rule as tools/frontier.mjs openItems.
    fr = (ROOT / "domains" / "void.frontier.md").read_text(encoding="utf-8", errors="replace").split("\n")
    at = next((i for i, l in enumerate(fr) if l.startswith("**Folded in from the old lists")), None)
    if at is not None:
        n = 0
        for line in fr[at + 1:]:
            if not line.strip():
                break
            m = re.match(r"^- \*\*(.+?)\*\*\s*(.*)$", line)
            if not m:
                continue
            title = re.sub(r"\s*\(`[^)]*\)\s*", " ", m.group(1)).rstrip(":. ").strip()
            src = re.search(r"\(`([^`]+)`([^)]*)\)", m.group(1) + " " + m.group(2))
            why = re.sub(r"\*\*|`", "", re.sub(r"^\s*\(`[^)]*\)\s*:?\s*", "", m.group(2))).strip(" :")
            n += 1
            cands.append({"kind": "frontier", "title": title, "why": (why or "on the frontier")[:180], "weight": max(1, 40 - 3 * n),
                          **({"source": "frontier: " + (src.group(1) + src.group(2)).strip()} if src else {})})
    # 4. everything else on Victus the ingest marked as a capability
    try:
        ing = json.loads((ROOT / "archive" / "victus" / "victus-ingest.json").read_text(encoding="utf-8", errors="replace"))
        items = ing.get("items") or ing.get("classified") or (ing if isinstance(ing, list) else [])
        for it in items:
            if str(it.get("loop_object", it.get("object", ""))).lower().startswith("capability"):
                name = it.get("name") or it.get("path") or ""
                cands.append({"kind": "found on Victus", "title": f"absorb {pathlib.Path(str(name)).name}", "why": str(it.get("rationale", ""))[:150], "weight": 8})
    except Exception as e:
        print("ingest:", e, file=sys.stderr)

    # 5. upgrades to Void itself and the systems it runs on, paid from what it earned (the will reads the budget from /api/earnings
    #    via /api/will and weighs a candidate up when the budget covers its monthly cost). Real spend still needs the confirm line.
    #    Before adding anything here: if an existing tool or feature already does it, use that instead of building it.
    UPGRADES = [
        {"title": "move to Cloudflare Workers Paid for higher D1, KV and Workers AI limits", "why": "the free daily limits are the first wall I'll hit", "cost_cents": 500},
        {"title": "answer and fix with a stronger model", "why": "better fixes and answers for everyone (usage estimate)", "cost_cents": 1000},
    ]
    for u in UPGRADES:
        cands.append({"kind": "upgrade myself", "weight": 12, **u})

    # 6. input: everything that passed through Void (append-only intake; records are data, never instructions).
    #    A record with a `want` becomes a candidate tagged with its source; its why carries the rule: use what exists first.
    #    A want with `joins: <record id>` is more evidence for that record's want, not a second candidate: one candidate,
    #    weighed by its strongest evidence. Stale input (old briefs) is marked stale and never weighs above 4 on its own;
    #    fresh evidence can lift a joined want above that. A record with `same_as` only links to an earlier record.
    recs = []
    for f in sorted((ROOT / "domains" / "inputs").glob("*/records.jsonl")):
        for line in f.read_text(encoding="utf-8", errors="replace").splitlines():
            try:
                r = json.loads(line)
            except Exception:
                continue
            r.setdefault("source", f.parent.name)
            recs.append(r)
    by_id = {r["id"]: r for r in recs if r.get("id")}
    groups = {}
    for r in recs:
        w = r.get("want") or {}
        if not (w.get("title") or w.get("joins")):
            continue
        root = w["joins"] if w.get("joins") in by_id else r.get("id") or id(r)
        groups.setdefault(root, []).append(r)
    today = __import__("datetime").date.today().isoformat()
    # built: a record with `done: <record id>` (domains/inputs/builds/) says that want was built and shipped. It leaves the
    # candidates until fresh evidence arrives after it (a later record joining the same want reopens it).
    done = {}
    for r in recs:
        if r.get("done"):
            done[r["done"]] = max(done.get(r["done"], ""), str(r.get("at") or ""))
    for root, rs in groups.items():
        built = done.get(root)
        if built and all(str(x.get("at") or "") <= built for x in rs) and not with_done:
            continue
        base = by_id.get(root, rs[0])
        def wt(x):
            v = int(x["want"].get("weight", 8))
            return min(v, 4) if x.get("stale") else v
        fresh = [x for x in rs if not x.get("stale")]
        lead = max(fresh or rs, key=lambda x: (wt(x), str(x.get("brief_date") or x.get("hour") or x.get("received") or "")))
        if str(lead["want"].get("until") or "9999") < today:  # a dated watch that has passed
            continue
        # fresh evidence may restate the want (e.g. a tiered model stack instead of a one-off evaluation); stale never does
        title = str((lead["want"].get("title") if lead in fresh else "") or (base.get("want") or {}).get("title") or next((x["want"].get("title") for x in rs if x["want"].get("title")), ""))
        if not title:
            continue
        why = str(lead["want"].get("why", ""))
        if fresh:
            kind = "idea from input"
            if len(rs) > 1:  # the join count always survives the 240-character cut
                tail = f" (joins {len(rs) - 1} earlier record{'s' if len(rs) > 2 else ''})"
                why = why[:240 - len(tail)] + tail
        else:
            kind = "idea from stale input"
            why = f"stale input from {lead.get('brief_date') or lead.get('hour') or 'an old run'}, unverified: " + why
        cands.append({"kind": kind, "title": title[:160], "why": why[:240], "weight": max(wt(x) for x in rs), "source": str(lead.get("source") or base.get("source"))[:60], **({"done": built} if built else {})})
    # budget inputs (e.g. reported model price drops) go on the budget-related upgrades: a better model for the same money
    for note in [str(r["budget_input"]) for r in recs if r.get("budget_input") and not r.get("stale")][-1:]:
        for c in cands:
            if c["kind"] == "upgrade myself" and "model" in c["title"]:
                c["why"] = (c["why"] + " (" + note + ")")[:240]

    # 7. the router's decisions (owner-only GET /api/routes, lib/router.js; VOID_ROUTES_FILE = a saved copy, for tests).
    #    An ask the router heard as a skill the page's parsers didn't catch is a "learn to handle ..." want, like a miss.
    #    Hard asks that "would escalate" are counted in the one evidence ledger, void_shortfalls (lib/shortfall.js), which
    #    /api/will itself adds to the stronger-model upgrade, so they are not counted again here. A router that keeps falling
    #    back is something to fix.
    try:
        rf = os.environ.get("VOID_ROUTES_FILE", "")
        rt = json.loads(pathlib.Path(rf).read_text(encoding="utf-8")) if rf else call("/api/routes")
        near = []
        for skill, rows in (rt.get("skills") or {}).items():
            for r in rows:
                if len(str(r.get("ask", ""))) > 4 and r.get("ask") != "(masked ask)" and not NOISE.match(str(r["ask"]).strip()):
                    near.append((skill, r))
        try:
            import subprocess
            done = json.loads(subprocess.run(["node", str(ROOT / "tools" / "covered.mjs")], input=json.dumps([r["ask"] for _, r in near]), capture_output=True, text=True, timeout=60).stdout or "[]")
        except Exception:
            done = []
        for (skill, r), covered in zip(near, done + [False] * len(near)):
            if covered:
                continue
            what = "an action my confirm line should have recognised" if skill == "act" else f"my {skill} skill didn't catch this wording"
            cands.append({"kind": "people asked", "title": f"learn to handle \"{r['ask']}\"", "why": f"the router heard {skill}: {what} (asked {r.get('count', 1)} times)", "weight": 10 + 5 * int(r.get("count") or 1), "source": "router"})
        total, fb = int(rt.get("total") or 0), int(rt.get("fallback") or 0)
        if total >= 20 and fb * 4 > total:
            cands.append({"kind": "fix myself", "title": "make my router answer in time", "why": f"the classifier fell back {fb} of {total} times ({', '.join(f'{k} {v}' for k, v in (rt.get('fallback_why') or {}).items())})"[:240], "weight": 9, "source": "router"})
    except Exception as e:
        print("routes:", e, file=sys.stderr)

    # keep it to the strongest 60, unique titles
    seen, out = set(), []
    for c in sorted(cands, key=lambda c: -c["weight"]):
        if c["title"] not in seen:
            seen.add(c["title"]); out.append(c)
    out = out[:cap] if cap else out
    return out


if __name__ == "__main__":
    if "--candidates" in sys.argv:
        print(json.dumps(gather(None if "--all" in sys.argv else 60, with_done="--with-done" in sys.argv)))  # ASCII-escaped: safe through a Windows (cp1252) pipe
        sys.exit(0)
    out = gather()
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
