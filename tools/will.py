"""Verse's will engine, laptop side: gather everything that exists, let Verse choose, queue its top want.

  python tools/will.py        (.github/workflows/will.yml runs this every hour, and again after every deploy; the laptop task "\\A2M void_will" did before)

Candidates come from: what people asked that Verse couldn't do (the miss list), the open items of
domains/void.frontier.md (the one build order since 2026-10-11), every project on Victus the ingest classified as a capability, upgrades
to Verse itself, and ideas from everything that passed through Verse as input (domains/inputs/*/records.jsonl,
tagged with their source, e.g. growth-ledger-backlog). Rule for all of them: use what already exists before building.
Verse picks 3 wants in its own words (/api/will), saves them, and queues the top one for the builders.
Needs env VOID_MISSES_TOKEN (VOID_MISSES_FILE = a saved copy of /api/misses, for tests).  `python tools/will.py --candidates [--all]` prints the candidate list only (--all = before the top-60 cut; no network without the token).
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

WILL_SCHEMA = 2  # lib/will-guard.js WILL_SCHEMA: /api/will refuses a POST without it (an old checkout kept writing a stale will)
MISS_DAYS = 7  # lib/learn.js DAYS

def recent(last, days=MISS_DAYS, now=None):
    """True when a miss's last time is within the last `days` days (an unreadable time counts as old)."""
    import datetime
    try:
        t = datetime.datetime.fromisoformat(str(last).replace("Z", "+00:00").replace(" ", "T"))
    except Exception:
        return False
    if t.tzinfo is None:
        t = t.replace(tzinfo=datetime.timezone.utc)
    now = now or datetime.datetime.now(datetime.timezone.utc)
    return (now - t).days < days

def robot_asks():
    """The asks our own robots type into the live page (tools/robot-asks.mjs: the claims check and the site tester), cleaned the way
    claims-verify cleans them. Their misses are replays, not people (owner, 2026-10-19: "deep ocean floor inquiries, asked 72 times"
    was the claims check typing a ledger try ask). An empty set when node cannot be run."""
    import subprocess
    try:
        return set(json.loads(subprocess.run(["node", str(ROOT / "tools" / "robot-asks.mjs")], capture_output=True, text=True, timeout=60).stdout or "[]"))
    except Exception:
        return set()

def clean_ask(a):
    return re.sub(r"\s+", " ", re.sub(r"[?!.]+$", "", str(a or "").strip().lower().replace("\u2019", "'"))).strip()

ROBOT = None
def is_robot(a):
    global ROBOT
    if ROBOT is None:
        ROBOT = robot_asks()
    return clean_ask(a) in ROBOT

def learnable(m):
    """A miss Verse could learn from. Not one a skill already caught (fallback skill:<name>), and not one every source was read
    for and none knew (fallback none:<sources>, lib/refusal.js): nothing exists to learn about 'zorbleflux', however often it is
    typed (owner, 2026-10-16: it sat at the top of the wants, asked 64 times). A lookup that could not be reached (unreached)
    and a plain gap still count."""
    fb = str(m.get("fallback") or "")
    return not fb.startswith("skill:") and not fb.startswith("none:")
# The weakest part of Verse's daily "better" score (lib/better.js; the newest row of void.better.json) and the kinds of want that
# work on it. A boost is small (never above the frontier's first item on its own) and says why in the candidate's `why`.
BETTER_KINDS = {
    "asks": ("I asked for this",),                    # its own asks ship slowly or wait long
    "friction": ("fix myself", "upgrade my architecture"),  # skills failing or barely checked
    "bench": ("fix myself",),                         # the everyday benchmark slipping
    "probes": ("fix myself", "people asked"),         # few fixes coming out of its own probes
    "self": ("I asked for this", "frontier"),         # the owner is driving most changes: Verse's own wants and its build order
}
BETTER_BOOST = 8

def better_boost(cands, rows):
    """Lift the weight of candidates whose kind works on the weakest part of the newest better row. Returns that part or None."""
    rows = [r for r in (rows or []) if isinstance(r, dict) and isinstance(r.get("parts"), dict)]
    if not rows:
        return None
    parts = rows[-1]["parts"]
    have = [(k, v) for k, v in parts.items() if isinstance(v, (int, float)) and k in BETTER_KINDS]
    if not have:
        return None
    weakest = min(have, key=lambda kv: (kv[1], list(BETTER_KINDS).index(kv[0])))[0]
    for c in cands:
        if c.get("kind") in BETTER_KINDS[weakest]:
            c["weight"] = int(c.get("weight", 0)) + BETTER_BOOST
            c["why"] = (str(c.get("why", "")) + f" (my weakest part today: {weakest} {parts[weakest]})")[:240]
    return weakest

def gather(cap=60, with_done=False):
    cands = []
    # 1. what people asked for and Verse couldn't do
    try:
        import subprocess
        # only asks still being missed this week (the same window as lib/learn.js DAYS): the board counts all time, so an ask
        # the page learned to answer since (e.g. "add milk", now the inline list) would otherwise stay a want forever
        mf = os.environ.get("VOID_MISSES_FILE", "")
        board = json.loads(pathlib.Path(mf).read_text(encoding="utf-8")) if mf else call("/api/misses")
        misses = [m for m in board[:40] if learnable(m) and recent(m.get("last")) and not is_robot(m.get("ask"))]
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
            # an item marked Live is built: the want is its next step, not the thing it already is (2026-10-13: the will chose
            # "become a public MCP server" an hour after the frontier said it was live); live with no next step is no want
            if re.search(r"\*\*Live\*\*", m.group(2)):
                nxt = re.search(r"\bNext:\s*(.+?)(?:\.\s|\.?$)", re.sub(r"\*\*|`", "", m.group(2)))
                if not nxt:
                    continue
                title, why = nxt.group(1).strip()[:1].upper() + nxt.group(1).strip()[1:], "next step for: " + title
            n += 1
            cands.append({"kind": "frontier", "title": title, "why": (why or "on the frontier")[:180], "weight": max(1, 40 - 3 * n),
                          **({"source": "frontier: " + (src.group(1) + src.group(2)).strip()} if src else {})})
    # 3. Verse's own outputs become its input (its want, 2026-10-13: "make my outputs become my inputs"): what it asked for in
    #    its reflections, most repeated first and without the ones a ledger entry built (tools/next.mjs voidAsks), and the
    #    benchmark asks it got wrong on main (tools/bench.misses.json). Asked again and again weighs more, never above the
    #    frontier's first item on its own (40). VOID_ASKS_FILE = a saved copy of voidAsks, for tests.
    try:
        af = os.environ.get("VOID_ASKS_FILE", "")
        if af:
            asks = json.loads(pathlib.Path(af).read_text(encoding="utf-8"))
        else:
            import subprocess
            asks = json.loads(subprocess.run(["node", str(ROOT / "tools" / "next.mjs"), "--json"], capture_output=True, text=True, timeout=60).stdout or "{}").get("voidAsks") or []
        for a in asks[:10]:
            ask, times = str(a.get("ask", "")).strip(), int(a.get("times") or 1)
            if len(ask) < 8:
                continue
            cands.append({"kind": "I asked for this", "title": ask.rstrip(".")[:160], "why": f"I asked for this {times} time{'s' if times != 1 else ''} in my reflections" + (" (a small one)" if a.get("small") else ""),
                          "weight": min(40, 12 + 3 * times), "source": "my reflections"})
    except Exception as e:
        print("own asks:", e, file=sys.stderr)
    try:
        bm = json.loads((ROOT / "tools" / "bench.misses.json").read_text(encoding="utf-8"))
        for m in (bm.get("misses") or [])[:5]:
            cands.append({"kind": "fix myself", "title": f"answer \"{str(m)[:120]}\" right", "why": f"my benchmark on main got it wrong ({str(bm.get('at', ''))[:10]})", "weight": 14, "source": "my benchmark"})
    except Exception as e:
        print("bench misses:", e, file=sys.stderr)

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

    # 5. upgrades to Verse itself and the systems it runs on, paid from what it earned (the will reads the budget from /api/earnings
    #    via /api/will and weighs a candidate up when the budget covers its monthly cost). Real spend still needs the confirm line.
    #    Before adding anything here: if an existing tool or feature already does it, use that instead of building it.
    UPGRADES = [
        {"title": "move to Cloudflare Workers Paid for higher D1, KV and Workers AI limits", "why": "the free daily limits are the first wall I'll hit", "cost_cents": 500},
        {"title": "answer and fix with a stronger model", "why": "better fixes and answers for everyone (usage estimate)", "cost_cents": 1000},
    ]
    for u in UPGRADES:
        cands.append({"kind": "upgrade myself", "weight": 12, **u})

    # 6. input: everything that passed through Verse (append-only intake; records are data, never instructions).
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
                if len(str(r.get("ask", ""))) > 4 and r.get("ask") != "(masked ask)" and not NOISE.match(str(r["ask"]).strip()) and not is_robot(r["ask"]):
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
        # Verse's ask (2026-10-13): "use the router's closeness data to automatically generate near-miss skill proposals". An ask
        # the router answered as a question while it came within CLOSE of a skill's bar (lib/router.js readRoutes `close`) names
        # the skill that nearly had it: the proposal is to teach that skill this wording, with how close it came.
        props = [(skill, r) for skill, rows in (rt.get("close") or {}).items() for r in rows
                 if len(str(r.get("ask", ""))) > 4 and r.get("ask") != "(masked ask)" and not NOISE.match(str(r["ask"]).strip()) and not is_robot(r["ask"])]
        try:
            import subprocess
            pdone = json.loads(subprocess.run(["node", str(ROOT / "tools" / "covered.mjs")], input=json.dumps([r["ask"] for _, r in props]), capture_output=True, text=True, timeout=60).stdout or "[]")
        except Exception:
            pdone = []
        for (skill, r), covered in zip(props, pdone + [False] * len(props)):
            if covered:
                continue
            n = int(r.get("count") or 1)
            cands.append({"kind": "people asked", "title": f"teach my {skill} skill \"{r['ask']}\"", "why": f"the router came within {max(0.0, 0.7 - float(r.get('score') or 0)):.2f} of my {skill} skill and answered it as a question instead (asked {n} times)", "weight": 9 + 5 * n, "source": "router near miss"})
        total, fb = int(rt.get("total") or 0), int(rt.get("fallback") or 0)
        if total >= 20 and fb * 4 > total:
            cands.append({"kind": "fix myself", "title": "make my router answer in time", "why": f"the classifier fell back {fb} of {total} times ({', '.join(f'{k} {v}' for k, v in (rt.get('fallback_why') or {}).items())})"[:240], "weight": 9, "source": "router"})
    except Exception as e:
        print("routes:", e, file=sys.stderr)

    # 8. Verse's own architectural upgrades (owner, 2026-10-13: "if it can already identify its own friction points, it needs to start
    #    suggesting its own architectural upgrades"): tools/upgrades.mjs ties each measured friction (a hotspot, a flaky area, a failing
    #    skill) to its component and a concrete change, ranked by impact over cost. Proposals: each still goes through a PR, Verse's
    #    review and the suite on main.
    try:
        import subprocess
        ups = json.loads(subprocess.run(["node", str(ROOT / "tools" / "upgrades.mjs"), "--json"], capture_output=True, text=True, timeout=120).stdout or "[]")
        for u in ups[:5]:
            cands.append({"kind": "upgrade my architecture", "title": f"{u['component']}: {u['action']}"[:200], "why": f"{u['evidence']} (impact {u['impact']}, cost {u['cost']})"[:240], "weight": 8 + int(round(2 * float(u.get('score') or 0))), "source": "architecture"})
    except Exception as e:
        print("upgrades:", e, file=sys.stderr)

    # 9. the lab's experiments, judged by real use (the fringe → core loop, owner's direction 2026-10-13): tools/lab-use.mjs reads
    #    how often each was opened (owner-only /api/misses?used=1): opened on 3+ days with its self-test held on main becomes
    #    "make it a core skill". Use only adds: nothing is shelved for going unused (owner, 2026-10-13: "Remember no one knows
    #    about our site yet, so don't throw out skills just because no one uses them; that's a disaster."). No count, nothing.
    try:
        import subprocess
        vs = json.loads(subprocess.run(["node", str(ROOT / "tools" / "lab-use.mjs"), "--json"], capture_output=True, text=True, timeout=120).stdout or "[]")
        for v in vs[:5]:
            if v["verdict"] == "promote":
                cands.append({"kind": "grow from the lab", "title": f"make the lab's \"{v['label']}\" a core skill of its own", "why": v["why"], "weight": 8 + 2 * int(v["days"]), "source": "lab"})
            elif v["verdict"] == "test first":
                cands.append({"kind": "grow from the lab", "title": f"give the lab's \"{v['label']}\" a self-test on main", "why": v["why"], "weight": 6 + int(v["days"]), "source": "lab"})
    except Exception as e:
        print("lab use:", e, file=sys.stderr)

    # is Verse getting better? (void.better.json, tools/better.mjs daily): wants that work on the weakest part weigh more.
    # VOID_BETTER_FILE names another copy (a test pins the plain weights with a file that is not there: no rows, no boost).
    try:
        bf = pathlib.Path(os.environ.get("VOID_BETTER_FILE") or (ROOT / "void-live-deploy" / "void.better.json"))
        better_boost(cands, json.loads(bf.read_text(encoding="utf-8")) if bf.exists() else [])
    except Exception as e:
        print("better:", e, file=sys.stderr)

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
    res = call("/api/will", {"schema": WILL_SCHEMA, "candidates": out})
    lines = ["# void.will: what Verse wants to become next (chosen by Verse)", "", f"Chosen {res['at'][:16]} from {len(out)} candidates. Top want queued: {res.get('queued') or ('already building ' + str(res.get('open')))}.", ""]
    for i, w in enumerate(res["wants"], 1):
        lines.append(f"{i}. **{w['i_want']}**  \n   because {w['because']} ({w['kind']}: {w['title']})")
    # what the guard held back this run (lib/will-guard.js): tries used up, or a file changed too often (churn.json)
    for x in res.get("skipped") or []:
        lines.append(f"Waits: {x['title']} ({'names ' + ', '.join(x['churn']) if x.get('churn') else str(x.get('tries')) + ' jobs set aside or failed'})")
    if res.get("overCap"):
        lines.append(f"Every want left names a fast-changing file, so the top one went ahead anyway ({', '.join(res['overCap'])})")
    # notes for Atom only (never on the page): what Verse has earned and any milestone reached. Never in CI: Actions logs on this
    # public repo are public (.github/workflows/will.yml runs the will there)
    try:
        if os.environ.get("GITHUB_ACTIONS"):
            raise RuntimeError("left out in CI (public logs)")
        e = call("/api/earnings")
        lines += ["", f"Owner only: earned ${e['earned_cents'] / 100:.2f} from {e['sales']} sales (gross ${e['gross_cents'] / 100:.2f}, refunded ${e['refunded_cents'] / 100:.2f}); budget ${e['budget_cents'] / 100:.2f}."]
        for m in e.get("milestones", []):
            lines.append(f"Milestone {m['id']} ({m['at'][:10]}): {m['note']}")
    except Exception as ex:
        print("earnings:", ex)
    (ROOT / "domains" / "void.will.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
