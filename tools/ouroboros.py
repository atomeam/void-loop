#!/usr/bin/env python3
"""ouroboros: the loop that feeds on clutter. Scan, harvest what is worth keeping, verify, then (only then) free space.

    python tools/ouroboros.py harvest --root C:\\Users\\you --out D:\\void-harvest      digest inactive projects (read-only)
    python tools/ouroboros.py verify  --out D:\\void-harvest                          re-check every digest and its source
    python tools/ouroboros.py plan    --root C:\\Users\\you --out D:\\void-harvest       what can be freed, and what cannot yet
    python tools/ouroboros.py report  --out D:\\void-harvest                          one shareable report.html (no network)
    python tools/ouroboros.py run     --root C:\\Users\\you --out D:\\void-harvest       harvest + verify + report + plan in one go
    python tools/ouroboros.py push    --out D:\\void-harvest --url https://a-to-mind.com   send every digest to Void, then read each back and check its hash (your Void key vr1.… or the owner token, in VOID_MEMORY_TOKEN, or asked for)
    python tools/ouroboros.py recall  --url https://a-to-mind.com --q react              ask Void what it remembers (add --id <record> to print a stored digest)
    python tools/ouroboros.py reclaim --root C:\\Users\\you --out D:\\void-harvest       dry run; add --apply to delete (asks you to type DELETE)

The rules the whole tool is built around:
  * harvest and verify never change a source file. They never read .env, keys or certificates, and every digest is redacted.
  * reclaim deletes ONLY regenerable folders (node_modules, a virtualenv) whose project still has the manifest that rebuilds them.
  * it deletes a project folder only with `push --drop`, which you must ask for. Void must first have stored the project's digest and handed
    it back with a matching hash (receipt: absorbed.json), the project must have a remote repository with everything pushed and no files git
    leaves out, and you must type DROP. `--force-drop-unbacked` overrides the remote check, and then you type each project's name.
    Without --drop nothing but rebuildable folders is ever deleted, and only for projects Void has absorbed. Void stores a digest, not your code.
Put --out outside --root (another drive is best).
"""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import html
import io
import json
import os
import re
import shutil
import stat
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import void_lens  # noqa: E402

VERSION = "0.3.0"
NEVER_READ = re.compile(r"(^|[\\/])(\.env(\..*)?|.*\.(pem|key|p12|pfx|crt|cer|kdbx|keystore|jks)|id_rsa.*|id_ed25519.*|credentials(\..*)?|secrets?(\..*)?|\.npmrc|\.pypirc|\.netrc)$", re.I)
SECRET_PATTERNS = [
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.S), "[private key]"),
    (re.compile(r"\b(AKIA|ASIA)[A-Z0-9]{16}\b"), "[aws key]"),
    (re.compile(r"\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b"), "[github token]"),
    (re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"), "[api key]"),
    (re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{10,}\b"), "[slack token]"),
    (re.compile(r"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]{16,}"), "Bearer [token]"),
    (re.compile(r"(?i)\b((?:api[_-]?key|secret|token|passw(?:or)?d|passwd|auth)[\w-]*)\s*([:=])\s*['\"]?[^\s'\",;]{4,}"), r"\1\2 [redacted]"),
    (re.compile(r"://[^/\s:@]+:[^/\s@]+@"), "://[credentials]@"),
    (re.compile(r"\b[A-Za-z0-9+/_-]{40,}={0,2}\b"), "[long token]"),
    (re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"), "[email]"),
]
TEXT_EXT = {".py", ".js", ".mjs", ".ts", ".tsx", ".jsx", ".md", ".txt", ".go", ".rs", ".java", ".c", ".h", ".cpp", ".cs", ".rb", ".php", ".sh", ".ps1", ".html", ".css", ".sql", ".yml", ".yaml", ".toml"}


def redact(s: str) -> str:
    for pat, rep in SECRET_PATTERNS:
        s = pat.sub(rep, s)
    return s


def git(repo: Path, *args: str, timeout: int = 30) -> str | None:
    try:
        r = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, timeout=timeout, errors="replace")
        return r.stdout if r.returncode == 0 else None
    except (OSError, subprocess.SubprocessError):
        return None


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def slug_of(repo: Path) -> str:
    base = re.sub(r"[^A-Za-z0-9._-]+", "-", repo.name).strip("-")[:40] or "repo"
    return f"{base}-{hashlib.sha1(str(repo).encode()).hexdigest()[:8]}"


def read_text(p: Path, limit: int) -> str:
    if NEVER_READ.search(str(p)):
        return ""
    try:
        with open(p, "rb") as f:
            raw = f.read(limit)
        return "" if b"\x00" in raw else raw.decode("utf-8", "replace")
    except OSError:
        return ""


def backup_state(repo: Path) -> dict:
    """Does a copy of this work exist somewhere else? The question that decides whether a repo can ever be removed."""
    remote = (git(repo, "remote", "get-url", "origin") or "").strip()
    dirty = len([l for l in (git(repo, "status", "--porcelain") or "").splitlines() if l.strip()])
    stash = len([l for l in (git(repo, "stash", "list") or "").splitlines() if l.strip()])
    ahead_raw = git(repo, "rev-list", "--count", "@{u}..HEAD")
    ahead = int(ahead_raw.strip()) if ahead_raw and ahead_raw.strip().isdigit() else None
    on_remote = bool((git(repo, "branch", "-r", "--contains", "HEAD") or "").strip())  # as of the last fetch/push
    if not remote:
        state = "no-remote"
    elif dirty or stash:
        state = "uncommitted-work"
    elif (ahead is not None and ahead > 0) or (ahead is None and not on_remote):
        state = "unpushed-commits"
    else:
        state = "remote-current"
    return {"state": state, "remote": redact(remote), "ahead": ahead, "dirty_files": dirty, "stashes": stash}


def digest_repo(repo: Path) -> dict:
    head = (git(repo, "rev-parse", "HEAD") or "").strip()
    log_dates = (git(repo, "log", "--format=%cI", "--max-count=100000") or "").split()
    files = [f for f in (git(repo, "ls-files") or "").splitlines() if f]
    ext: dict[str, int] = {}
    for f in files:
        e = os.path.splitext(f)[1].lower() or "(none)"
        ext[e] = ext.get(e, 0) + 1
    tops: dict[str, int] = {}
    for f in files:
        t = f.split("/")[0]
        tops[t] = tops.get(t, 0) + 1
    readme = ""
    for n in ("README.md", "README.MD", "readme.md", "README", "README.txt", "README.rst"):
        if (repo / n).is_file():
            readme = redact(read_text(repo / n, 4000))
            break
    tech: list[str] = []
    pj = repo / "package.json"
    pkg = {}
    if pj.is_file():
        try:
            pkg = json.loads(read_text(pj, 200000) or "{}")
        except ValueError:
            pkg = {}
        tech += sorted({*(pkg.get("dependencies") or {}), *(pkg.get("devDependencies") or {})})[:40]
    for n in ("requirements.txt", "pyproject.toml", "Pipfile", "go.mod", "Cargo.toml"):
        t = read_text(repo / n, 20000)
        if t:
            if n == "requirements.txt":
                tech += [re.split(r"[<>=!~\[; ]", l.strip(), 1)[0].lower() for l in t.splitlines() if l.strip() and not l.startswith("#")][:40]
            else:
                tech.append(n)
    todos = []
    for f in files[:3000]:
        if len(todos) >= 25:
            break
        p = repo / f
        if os.path.splitext(f)[1].lower() not in TEXT_EXT or NEVER_READ.search(f):
            continue
        try:
            if p.stat().st_size > 200000:
                continue
        except OSError:
            continue
        for i, line in enumerate(read_text(p, 200000).splitlines(), 1):
            if re.search(r"\b(TODO|FIXME|HACK|XXX)\b", line):
                todos.append(f"{f}:{i}: {redact(line.strip())[:160]}")
                if len(todos) >= 25:
                    break
    return {
        "name": repo.name, "path": str(repo), "head": head,
        "commits": int((git(repo, "rev-list", "--count", "HEAD") or "0").strip() or 0),
        "first_commit": log_dates[-1] if log_dates else None, "last_commit": log_dates[0] if log_dates else None,
        "recent_subjects": [redact(s) for s in (git(repo, "log", "-10", "--format=%s") or "").splitlines()],
        "tracked_files": len(files), "languages": dict(sorted(ext.items(), key=lambda kv: -kv[1])[:8]),
        "top_level": dict(sorted(tops.items(), key=lambda kv: -kv[1])[:20]),
        "description": redact(str(pkg.get("description") or "")),
        "tech": [t for t in dict.fromkeys(tech) if t][:40], "todos": todos, "readme": readme,
        "backup": backup_state(repo),
    }


def digest_md(d: dict, size: int) -> str:
    b = d["backup"]
    L = [f"# {d['name']}", "", f"- Path: `{d['path']}`", f"- Size on disk: {void_lens.human(size)}; tracked files: {d['tracked_files']}",
         f"- Commits: {d['commits']} ({d['first_commit']} to {d['last_commit']})", f"- Backup state: **{b['state']}** (remote: `{b['remote'] or 'none'}`, ahead: {b['ahead']}, uncommitted files: {b['dirty_files']}, stashes: {b['stashes']})"]
    if d["description"]:
        L += ["", f"> {d['description']}"]
    L += ["", "## Languages", ", ".join(f"{k} {v}" for k, v in d["languages"].items()) or "none", "", "## Top level", ", ".join(f"{k} ({v})" for k, v in d["top_level"].items()) or "none"]
    if d["tech"]:
        L += ["", "## Tech", ", ".join(d["tech"])]
    L += ["", "## Recent commits"] + [f"- {s}" for s in d["recent_subjects"]]
    if d["todos"]:
        L += ["", "## Open TODOs"] + [f"- {t}" for t in d["todos"]]
    if d["readme"]:
        L += ["", "## README (first 4 KB, redacted)", "", d["readme"]]
    return "\n".join(L) + "\n"


def cmd_harvest(a) -> int:
    root, out = Path(a.root).expanduser().resolve(), Path(a.out).expanduser().resolve()
    if not root.is_dir():
        print(f"not a folder: {root}", file=sys.stderr)
        return 2
    if out == root or root in out.parents:
        print("--out must be outside --root, so a harvest can never end up inside what it reads", file=sys.stderr)
        return 2
    budget = void_lens.Budget(a.max_seconds)
    out.mkdir(parents=True, exist_ok=True)
    manifest, memory = [], []
    for kind, p in void_lens.walk_projects(root, budget):
        if kind != "repo":
            continue
        age = void_lens.last_commit_age_days(p)
        if age is None or (age <= a.days and not a.include_active):
            continue
        d = digest_repo(p)
        size = void_lens.dir_size(p, budget)
        slug = slug_of(p)
        folder = out / slug
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "digest.md").write_text(digest_md(d, size), encoding="utf-8")
        (folder / "digest.json").write_text(json.dumps({**d, "size_bytes": size}, indent=2), encoding="utf-8")
        entry = {"slug": slug, "path": str(p), "head": d["head"], "state": d["backup"]["state"], "size_bytes": size,
                 "files": {n: sha256_file(folder / n) for n in ("digest.md", "digest.json")}}
        manifest.append(entry)
        first = next((ln.strip() for ln in d["readme"].splitlines() if ln.strip() and not ln.startswith("#")), d["description"])
        memory.append({"id": slug, "kind": "project", "name": d["name"], "summary": first[:300], "last_commit": d["last_commit"],
                       "state": d["backup"]["state"], "remote": d["backup"]["remote"], "links": sorted({t.lower() for t in d["tech"]} | {e.lstrip(".") for e in d["languages"] if e != "(none)"}),
                       "digest": f"{slug}/digest.md", "sha256": entry["files"]["digest.md"]})
    (out / "manifest.json").write_text(json.dumps({"made": time.strftime("%Y-%m-%dT%H:%M:%S"), "root": str(root), "partial": budget.hit, "projects": manifest}, indent=2), encoding="utf-8")
    (out / "memory.jsonl").write_text("".join(json.dumps(m) + "\n" for m in memory), encoding="utf-8")
    states: dict[str, int] = {}
    for m in manifest:
        states[m["state"]] = states.get(m["state"], 0) + 1
    print(f"harvested {len(manifest)} project(s) into {out}  {states}" + ("  (time limit hit: partial)" if budget.hit else ""))
    return 0


def cmd_verify(a) -> int:
    out = Path(a.out).expanduser().resolve()
    try:
        m = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        print(f"no readable manifest.json in {out}; run harvest first", file=sys.stderr)
        return 2
    bad = 0
    for e in m["projects"]:
        problems = []
        for n, want in e["files"].items():
            p = out / e["slug"] / n
            if not p.is_file() or sha256_file(p) != want:
                problems.append(f"{n} missing or changed")
        src = Path(e["path"])
        if not src.is_dir():
            problems.append("source folder is gone")
        elif (git(src, "rev-parse", "HEAD") or "").strip() != e["head"]:
            problems.append("source has new commits since the harvest (re-run harvest)")
        print(("FAIL " if problems else "ok   ") + e["slug"] + ("  " + "; ".join(problems) if problems else ""))
        bad += bool(problems)
    print(f"{len(m['projects']) - bad}/{len(m['projects'])} verified")
    return 1 if bad else 0


def regenerable(root: Path, days: int, budget) -> list[dict]:
    rows = []
    for kind, p in void_lens.walk_projects(root, budget):
        if kind not in ("node_modules", "venv"):
            continue
        proj = p.parent
        manifest_ok = (proj / "package.json").is_file() if kind == "node_modules" else any((proj / n).is_file() for n in ("requirements.txt", "pyproject.toml", "Pipfile", "setup.py"))
        a = void_lens.last_commit_age_days(proj) if (proj / ".git").exists() else None
        idle = a if a is not None else void_lens.newest_mtime_days(proj)
        rows.append({"path": p, "kind": kind, "bytes": void_lens.dir_size(p, budget), "idle_days": round(idle), "manifest_ok": manifest_ok, "stale": idle > days})
    return rows


def load_absorbed(out: Path) -> dict[str, dict]:
    """Projects Void has absorbed: pushed, read back, hash checked. Written only by `push`. {resolved project path: receipt}"""
    try:
        return {str(Path(e["path"]).resolve()): e for e in json.loads((out / "absorbed.json").read_text(encoding="utf-8")).get("absorbed", [])}
    except (OSError, ValueError, KeyError):
        return {}


def is_absorbed(project: Path, absorbed: dict[str, dict]) -> bool:
    """Absorbed AND unchanged since: a project that has new commits has something Void has not seen."""
    e = absorbed.get(str(project.resolve()))
    return bool(e) and (git(project, "rev-parse", "HEAD") or "").strip() == e.get("head")


def split_absorbed(rows: list[dict], out: Path) -> tuple[list[dict], list[dict]]:
    ab = load_absorbed(out)
    ok = [r for r in rows if is_absorbed(r["path"].parent, ab)]
    return ok, [r for r in rows if r not in ok]


def cmd_plan(a) -> int:
    root, out = Path(a.root).expanduser().resolve(), Path(a.out).expanduser().resolve()
    budget = void_lens.Budget(a.max_seconds)
    rows = regenerable(root, a.days, budget)
    cand = [r for r in rows if r["stale"] and r["manifest_ok"]]
    ok, waiting = split_absorbed(cand, out)
    print(f"Can be freed now, and rebuilt on demand: {void_lens.human(sum(r['bytes'] for r in ok))} in {len(ok)} folder(s) (stale node_modules and virtualenvs of projects Void has absorbed)")
    if waiting:
        print(f"Waiting: {void_lens.human(sum(r['bytes'] for r in waiting))} in {len(waiting)} folder(s) belong to projects Void has not absorbed yet. Nothing is freed before that: run harvest, then push.")
    for r in sorted(ok, key=lambda r: -r["bytes"])[:a.top]:
        print(f"  {void_lens.human(r['bytes']):>9}  idle {r['idle_days']:>4}d  {r['path']}")
    skipped = [r for r in rows if r["stale"] and not r["manifest_ok"]]
    for r in skipped:
        print(f"  NOT auto-freed (no manifest to rebuild it from): {r['path']}")
    try:
        m = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        print("\nNo harvest found yet: run `harvest` to see which whole projects could ever be removed.")
        return 0
    print("\nWhole projects (this tool never removes a repository; this is what you would have to check yourself):")
    for e in sorted(m["projects"], key=lambda e: -e["size_bytes"])[:a.top]:
        verdict = {"remote-current": "a pushed, clean copy exists (as of your last fetch): clone it somewhere and check it opens, then it is your call"}.get(e["state"], "NOT SAFE: " + e["state"] + " (the only copy of some work is here)")
        print(f"  {void_lens.human(e['size_bytes']):>9}  {e['state']:<18} {e['path']}\n             {verdict}")
    return 0


def cmd_reclaim(a) -> int:
    root, out = Path(a.root).expanduser().resolve(), Path(a.out).expanduser().resolve()
    budget = void_lens.Budget(a.max_seconds)
    todo, waiting = split_absorbed([r for r in regenerable(root, a.days, budget) if r["stale"] and r["manifest_ok"]], out)
    total = sum(r["bytes"] for r in todo)
    print(f"{len(todo)} folder(s), {void_lens.human(total)}: stale node_modules/virtualenvs of projects Void has absorbed, which can rebuild them.")
    if waiting:
        print(f"{len(waiting)} more folder(s) ({void_lens.human(sum(r['bytes'] for r in waiting))}) are NOT touched: Void has not absorbed those projects yet (run harvest, then push).")
    for r in todo[:a.top]:
        print(f"  {void_lens.human(r['bytes']):>9}  {r['path']}")
    if not a.apply:
        print("\nDry run: nothing was deleted. Add --apply to delete these.")
        return 0
    if input("\nType DELETE to remove exactly the folders above: ").strip() != "DELETE":
        print("Not confirmed. Nothing was deleted.")
        return 1
    out.mkdir(parents=True, exist_ok=True)
    log, freed, failed = open(out / "reclaim-log.jsonl", "a", encoding="utf-8"), 0, 0
    for r in todo:
        p: Path = r["path"]
        name_ok = p.name == "node_modules" or (p.name in (".venv", "venv") and (p / "pyvenv.cfg").is_file())
        if p.is_symlink() or not p.is_dir() or not name_ok or root not in p.resolve().parents:
            print(f"  skipped (failed the safety check): {p}")
            continue
        errs: list[str] = []
        shutil.rmtree(p, onerror=lambda f, path, e: errs.append(str(path)))
        left = p.exists()
        failed += left
        freed += 0 if left else r["bytes"]
        log.write(json.dumps({"at": time.strftime("%Y-%m-%dT%H:%M:%S"), "path": str(p), "bytes": r["bytes"], "removed": not left, "errors": len(errs)}) + "\n")
        print(("  partly removed (some files locked): " if left else "  removed: ") + str(p))
    log.close()
    print(f"\nFreed about {void_lens.human(freed)}. Log: {out / 'reclaim-log.jsonl'}")
    return 1 if failed else 0


STATE_LABEL = {"remote-current": ("Pushed and clean", "ok"), "unpushed-commits": ("Unpushed commits", "bad"), "uncommitted-work": ("Uncommitted work", "bad"), "no-remote": ("No remote copy", "bad")}


def build_report(out: Path, root_hint: str = "") -> Path:
    """One self-contained report.html (no network, no scripts) from a harvest. Every piece of text is HTML-escaped."""
    m = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    e = html.escape
    rows, total, safe = [], 0, 0
    for p in sorted(m["projects"], key=lambda x: -x["size_bytes"]):
        total += p["size_bytes"]
        label, cls = STATE_LABEL.get(p["state"], (p["state"], "bad"))
        safe += p["size_bytes"] if p["state"] == "remote-current" else 0
        try:
            d = json.loads((out / p["slug"] / "digest.json").read_text(encoding="utf-8"))
        except (OSError, ValueError):
            d = {}
        about = next((ln.strip() for ln in (d.get("readme") or "").splitlines() if ln.strip() and not ln.startswith("#")), d.get("description") or "")
        rows.append(f"<tr><td><a href=\"{e(p['slug'])}/digest.md\">{e(d.get('name') or p['slug'])}</a><div class=sub>{e(about[:140])}</div></td>"
                    f"<td><span class=\"badge {cls}\">{e(label)}</span></td><td class=n>{e(void_lens.human(p['size_bytes']))}</td>"
                    f"<td>{e(str(d.get('last_commit') or '')[:10])}</td><td class=path>{e(p['path'])}</td></tr>")
    need = [p for p in m["projects"] if p["state"] != "remote-current"]
    page = f"""<!doctype html><html lang=en><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Ouroboros report</title>
<style>:root{{--bg:#fff;--fg:#1b1b1f;--mut:#667;--line:#dde;--ok:#0a7d3b;--bad:#b3261e}}@media(prefers-color-scheme:dark){{:root{{--bg:#101114;--fg:#ececf1;--mut:#9aa;--line:#2a2c33;--ok:#4cc38a;--bad:#ff8a80}}}}
body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}}main{{max-width:1000px;margin:0 auto;padding:24px 16px}}h1{{margin:0 0 4px}}
.sub{{color:var(--mut);font-size:13px}}.cards{{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}}.card{{border:1px solid var(--line);border-radius:10px;padding:12px 16px;min-width:150px}}
.card b{{display:block;font-size:22px}}table{{width:100%;border-collapse:collapse}}th,td{{text-align:left;padding:8px;border-bottom:1px solid var(--line);vertical-align:top}}td.n{{white-space:nowrap}}
.path{{font:12px ui-monospace,monospace;color:var(--mut);word-break:break-all}}.badge{{padding:2px 8px;border-radius:99px;border:1px solid currentColor;font-size:12px;white-space:nowrap}}.ok{{color:var(--ok)}}.bad{{color:var(--bad)}}
.note{{border-left:3px solid var(--bad);padding:8px 12px;margin:16px 0}}@media(max-width:700px){{td.path{{display:none}}}}</style>
<main><h1>Ouroboros report</h1><div class=sub>Made {e(m['made'])}{(' from ' + e(root_hint)) if root_hint else ''}. This file never leaves your machine; nothing in it was uploaded.</div>
<div class=cards><div class=card><b>{len(m['projects'])}</b>old projects digested</div><div class=card><b>{e(void_lens.human(total))}</b>they occupy</div>
<div class=card><b>{e(void_lens.human(safe))}</b>already safe on a remote</div><div class=card><b>{len(need)}</b>need a backup first</div></div>
{('<div class=note><b>'+str(len(need))+' project(s) hold work that exists nowhere else.</b> Back them up (push, or copy them) before you remove anything. Ouroboros never deletes a project.</div>') if need else ''}
<table><thead><tr><th>Project</th><th>Backup</th><th>Size</th><th>Last commit</th><th>Where</th></tr></thead><tbody>{''.join(rows) or '<tr><td colspan=5>No old projects found.</td></tr>'}</tbody></table>
<p class=sub>Open a project's name for its digest: what it was, its tech, recent commits and open TODOs. Secrets are filtered out of every digest.</p></main></html>"""
    path = out / "report.html"
    path.write_text(page, encoding="utf-8")
    return path


def cmd_report(a) -> int:
    out = Path(a.out).expanduser().resolve()
    try:
        path = build_report(out)
    except (OSError, ValueError):
        print(f"no readable manifest.json in {out}; run harvest first", file=sys.stderr)
        return 2
    print(f"wrote {path}")
    return 0


def cmd_run(a) -> int:
    """The whole safe path in one command: harvest, verify, report, plan. It never deletes anything."""
    for name, fn in (("1/4 harvest", cmd_harvest), ("2/4 verify", cmd_verify), ("3/4 report", cmd_report), ("4/4 plan", cmd_plan)):
        print(f"\n== {name}")
        rc = fn(a)
        if rc not in (0,) and name != "2/4 verify":
            return rc
    print(f"\nOpen {Path(a.out).expanduser().resolve() / 'report.html'} in your browser.\nTo free the rebuildable space, run: ouroboros reclaim --root {a.root} --out {a.out}   (dry run first)")
    return 0


REGENERABLE = {"node_modules", ".venv", "venv", "__pycache__", ".pytest_cache", ".mypy_cache", ".next", ".nuxt", "dist", "build", "target", ".cache", ".turbo", "coverage", ".gradle", ".DS_Store", "Thumbs.db"}


def ignored_not_in_git(repo: Path) -> list[str]:
    """Files git ignores (so no remote copy holds them) that are not obviously rebuildable: .env files, local databases, notes."""
    extras = []
    for line in (git(repo, "status", "--porcelain", "--ignored") or "").splitlines():
        if not line.startswith("!! "):
            continue
        path = line[3:].strip().strip('"').rstrip("/")
        if not any(part in REGENERABLE for part in path.split("/")) and not path.endswith(".pyc"):
            extras.append(path)
    return extras


def drop_blockers(entry: dict, receipt: dict | None, root: Path, out: Path, force_unbacked: bool) -> list[str]:
    """Why this project must NOT be deleted right now. An empty list means every check passed."""
    src = Path(entry["path"])
    if not receipt:
        return ["Void has no verified receipt for it (absorbed.json)"]
    if not src.is_dir() or src.is_symlink():
        return ["the folder is gone or is a link"]
    r = src.resolve()
    if root not in r.parents:
        return ["it is not inside the folder that was harvested"]
    if r == out or out in r.parents or r in out.parents or r == Path.home().resolve():
        return ["it contains (or is) the harvest folder or your home folder"]
    if not (src / ".git").exists():
        return ["it is not a git project"]
    why = []
    head = (git(src, "rev-parse", "HEAD") or "").strip()
    if head != receipt.get("head") or head != entry["head"]:
        why.append("it has new commits since Void absorbed it (run harvest and push again)")
    st = backup_state(src)
    unbacked = st["state"] != "remote-current"
    extra = ignored_not_in_git(src)
    if (unbacked or extra) and not force_unbacked:
        if not st["remote"]:
            why.append("it has no remote repository: deleting it would lose the only copy of its code")
        elif unbacked:
            why.append(f"its backup state is {st['state']}: some of its work exists only here")
        if extra:
            why.append("it holds files git does not keep (" + ", ".join(extra[:4]) + (", ..." if len(extra) > 4 else "") + ")")
    return why


def _rmtree(p: Path) -> list[str]:
    """Delete a folder, including read-only files (git objects are read-only on Windows). Returns what could not be removed."""
    left: list[str] = []

    def fix(func, path, _exc):
        try:
            os.chmod(path, stat.S_IWRITE | stat.S_IREAD)
            func(path)
        except OSError:
            left.append(str(path))

    if sys.version_info >= (3, 12):
        shutil.rmtree(p, onexc=fix)
    else:
        shutil.rmtree(p, onerror=fix)
    return left


def drop_phase(a, out: Path, root: Path, base: str, records: list[dict], verified_ids: set[str]) -> int:
    """--drop: delete the folder of each project that Void has verifiably absorbed. Every check in drop_blockers must pass; the tombstone
    is written before anything is removed; each deletion is confirmed by typing (DROP once, and each project's name for an unbacked one)."""
    manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
    entries = {e["slug"]: e for e in manifest["projects"]}
    absorbed = load_absorbed(out)
    plan, kept = [], 0
    for r in records:
        e = entries.get(r["id"])
        if r["id"] not in verified_ids:
            why = ["Void did not verify its copy on this push (drop aborted for this project: unverified, local files preserved)"]
        elif not e:
            why = ["not in the manifest"]
        else:
            why = drop_blockers(e, absorbed.get(str(Path(e["path"]).resolve())), root, out, a.force_drop_unbacked)
        if why:
            kept += 1
            print(f"KEPT {r['name']}: " + "; ".join(why))
        else:
            plan.append((e, r))
    if not plan:
        print("Nothing was dropped.")
        return 1 if kept else 0
    sizes = {e["slug"]: void_lens.dir_size(Path(e["path"]), void_lens.Budget(120)) for e, _ in plan}
    unbacked = [(e, r) for e, r in plan if backup_state(Path(e["path"]))["state"] != "remote-current" or ignored_not_in_git(Path(e["path"]))]
    print(f"\n{len(plan)} project folder(s) can be dropped ({void_lens.human(sum(sizes.values()))}); Void holds each digest, and a tombstone is left beside each folder:")
    for e, _ in plan:
        print(f"  {void_lens.human(sizes[e['slug']]):>9}  {e['path']}" + ("   [UNBACKED: --force-drop-unbacked]" if (e, _) in unbacked else ""))
    if not (a.yes and not unbacked):
        if input("\nType DROP to permanently delete the folders above: ").strip() != "DROP":
            print("Not confirmed. Nothing was deleted.")
            return 1
    skip = set()
    for e, r in unbacked:
        if input(f"'{r['name']}' may hold the ONLY copy of its code or data. Type its name to delete it anyway: ").strip() != r["name"]:
            print(f"Not confirmed for {r['name']}: kept.")
            skip.add(e["slug"])
    freed = failed = 0
    for e, r in plan:
        if e["slug"] in skip:
            continue
        src = Path(e["path"])
        tomb = src.parent / f"{r['name']}.void-tombstone.json"
        if tomb.exists():
            tomb = src.parent / f"{r['name']}.{int(time.time())}.void-tombstone.json"
        body = {"status": "absorbed", "project": r["name"], "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "memory_endpoint": base + "/api/memory", "record_id": r["id"],
                "digest_sha256": absorbed[str(src.resolve())]["body_sha256"], "backup_state": backup_state(src)["state"], "remote": r.get("remote", ""), "head": e["head"]}
        try:
            tomb.write_text(json.dumps(body, indent=2), encoding="utf-8")
        except OSError as err:
            print(f"KEPT {r['name']}: could not write the tombstone ({err}); nothing was deleted.")
            failed += 1
            continue
        left = _rmtree(src)
        if src.exists():
            tomb.write_text(json.dumps({**body, "status": "partial", "left": left[:20]}, indent=2), encoding="utf-8")
            print(f"PARTLY removed {r['name']}: {len(left)} item(s) could not be deleted (locked?). The folder is still there; the tombstone says 'partial'.")
            failed += 1
        else:
            freed += sizes[e["slug"]]
            print(f"Dropped {r['name']}: absorbed into Void ({base}/api/memory, record {r['id']}); local disk space reclaimed. Tombstone: {tomb}")
    print(f"\nVictus storage reclaimed: about {void_lens.human(freed)}.")
    return 1 if (failed or kept) else 0


MAX_REQUEST_BYTES = 200_000  # the server refuses bigger requests (262144); keep clear of it


def _http(url: str, token: str, body: dict | None = None):
    req = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), method="GET" if body is None else "POST",
                                 headers={"content-type": "application/json", "authorization": "Bearer " + token})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, json.loads(r.read().decode())


KEY_HELP = "Make a key at https://a-to-mind.com/code-review/#pro (signed in, on paid Void)."


def get_token(ask: bool = True) -> str:
    """Your Void key (vr1.…, from paid Void) or the owner token: the VOID_MEMORY_TOKEN variable if set, else (at a terminal) asked for without
    echoing, so it never lands in your shell history or on the command line. Empty when there is none."""
    t = os.environ.get("VOID_MEMORY_TOKEN", "").strip()
    if t or not ask or not sys.stdin.isatty():
        return t
    import getpass
    return getpass.getpass("Your Void key (starts vr1., from paid Void; owners paste the owner token): ").strip()


def refused_text(code: int, body: str = "") -> str:
    """A plain sentence for what Void answered (the server's own sentence when it sent one)."""
    if code == 403:
        return "Void memory is for the owner and paid members. " + (body.strip() or "This key's account is not on paid Void.") + " " + KEY_HELP
    return {401: "the token was not accepted: use your Void key (vr1.…) or the owner token", 503: "memory needs the database", 413: "batch too large, or your memory is full (500 projects)"}.get(code, f"Void answered {code}")


def _body_of(e: urllib.error.HTTPError) -> str:
    try:
        return e.read().decode("utf-8", "replace")[:300]
    except OSError:
        return ""


def sha256_text(t: str) -> str:
    return hashlib.sha256(t.encode("utf-8")).hexdigest()


def digest_for_void(out: Path, rec: dict, root: str) -> str:
    """The digest text that goes to Void: the file on disk, with the scanned folder's path replaced so no username or drive layout leaves the machine."""
    text = (out / rec["digest"]).read_text(encoding="utf-8")
    for variant in {root, root.replace("\\", "/"), root.replace("/", "\\")}:
        if variant:
            text = text.replace(variant, "<root>")
    return text


def void_remembers(base: str, token: str, rec: dict, sent_body: str) -> tuple[bool, str]:
    """Ask Void for the record by id and compare the hash it computed from what it stored with the hash of what we sent."""
    try:
        status, res = _http(base + "/api/memory?id=" + urllib.parse.quote(rec["id"]), token)
    except urllib.error.HTTPError as e:
        return False, f"Void answered {e.code}"
    except (urllib.error.URLError, OSError, ValueError) as e:
        return False, f"could not ask Void ({e})"
    got = next((m for m in (res.get("memory") or []) if m.get("id") == rec["id"]), None)
    if status != 200 or not got:
        return False, "Void has no such record"
    if got.get("body_sha256") != sha256_text(sent_body) or got.get("body") != sent_body:
        return False, "Void's stored copy differs from what was sent (it may have removed something it took for a secret)"
    return True, "ok"


def cmd_push(a) -> int:
    """Send memory.jsonl AND each project's digest to Void's memory (POST /api/memory), then read every record back and check the hash:
    only then does it say Void remembers. Refuses unless the harvest still verifies. The owner token comes from the VOID_MEMORY_TOKEN
    environment variable (never the command line). Nothing is ever deleted by this command."""
    out = Path(a.out).expanduser().resolve()
    u = urllib.parse.urlparse(a.url)
    base = a.url.rstrip("/")
    local = u.hostname in ("localhost", "127.0.0.1", "::1")
    if u.scheme != "https" and not (u.scheme == "http" and local):
        print("--url must be https (http is allowed only for localhost): the token must not travel in the clear", file=sys.stderr)
        return 2
    if a.force_drop_unbacked and not a.drop:
        print("--force-drop-unbacked only makes sense together with --drop", file=sys.stderr)
        return 2
    try:
        records = [json.loads(l) for l in (out / "memory.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
        root = json.loads((out / "manifest.json").read_text(encoding="utf-8")).get("root", "")
    except (OSError, ValueError):
        print(f"no readable memory.jsonl and manifest.json in {out}; run harvest first", file=sys.stderr)
        return 2
    if not a.dry_run:
        token = get_token()
        if not token:
            print("set VOID_MEMORY_TOKEN to your Void key (vr1.…, from paid Void) or the owner token first (it is read from the environment, never the command line). " + KEY_HELP, file=sys.stderr)
            return 2
    quiet = io.StringIO()
    with contextlib.redirect_stdout(quiet):
        vrc = cmd_verify(a)
    if vrc != 0:
        print("verify failed, so nothing was sent:\n" + quiet.getvalue().strip(), file=sys.stderr)
        return 1
    bodies: dict[str, str] = {}
    for r in records:
        try:
            bodies[r["id"]] = digest_for_void(out, r, root)
        except (OSError, KeyError):
            print(f"cannot read the digest for {r.get('name')}; run harvest again", file=sys.stderr)
            return 1
        if len(bodies[r["id"]]) > 32768:
            print(f"the digest for {r['name']} is longer than Void keeps (32768 characters); it was not sent", file=sys.stderr)
            return 1
    payload = [{**r, "body": bodies[r["id"]]} for r in records]
    batches, cur, size = [], [], 0
    for r in payload:
        n = len(json.dumps(r))
        if cur and (len(cur) >= a.batch or size + n > MAX_REQUEST_BYTES):
            batches.append(cur)
            cur, size = [], 0
        cur.append(r)
        size += n
    if cur:
        batches.append(cur)
    if a.dry_run:
        print(f"dry run: would send {len(records)} record(s), each with its full digest ({sum(len(b) for b in bodies.values())} characters in all), in {len(batches)} request(s) to {base}/api/memory. Fields sent: " + ", ".join(sorted({k for r in payload for k in r})))
        if a.drop:
            entries = {e["slug"]: e for e in json.loads((out / "manifest.json").read_text(encoding="utf-8"))["projects"]}
            for r in records:
                e = entries.get(r["id"])
                fake = {"head": e["head"]} if e else None
                why = drop_blockers(e, fake, Path(root).resolve(), out, a.force_drop_unbacked) if e else ["not in the manifest"]
                print(f"  would drop {e['path']} (after Void verifies its copy)" if not why else f"  would KEEP {r['name']}: " + "; ".join(why))
            print("dry run: nothing was sent or deleted.")
        return 0
    saved = rejected = 0
    sure: set[str] = set()  # ids Void answered exactly 200 for, with nothing rejected: the only ones --drop may ever act on
    for b in batches:
        try:
            status, res = _http(base + "/api/memory", token, {"source": "ouroboros", "records": b})
        except urllib.error.HTTPError as e:
            print(f"Void answered {e.code}: " + refused_text(e.code, _body_of(e)), file=sys.stderr)
            return 1
        except (urllib.error.URLError, OSError, ValueError) as e:
            print(f"could not reach Void: {e}", file=sys.stderr)
            return 1
        saved += res.get("saved", 0)
        rejected += res.get("rejected", 0)
        if status == 200 and res.get("rejected", 0) == 0 and res.get("saved", 0) == len(b):
            sure.update(r["id"] for r in b)
    print(f"sent {len(records)} record(s): {saved} saved, {rejected} rejected")
    held, lost, verified_ids = 0, [], set()
    for r in records:
        ok, why = void_remembers(base, token, r, bodies[r["id"]])
        held += ok
        if ok:
            verified_ids.add(r["id"])
        if not ok:
            lost.append(f"  NOT remembered: {r['name']}: {why}")
    print(f"Void remembers {held} of {len(records)} project(s), each checked by reading the digest back and comparing its hash.")
    for line in lost:
        print(line)
    entries = {e["slug"]: e for e in json.loads((out / "manifest.json").read_text(encoding="utf-8"))["projects"]}
    prior = load_absorbed(out)
    now = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    for r in records:
        if r["id"] in verified_ids and r["id"] in entries:
            e = entries[r["id"]]
            prior[str(Path(e["path"]).resolve())] = {"slug": r["id"], "path": e["path"], "head": e["head"], "body_sha256": sha256_text(bodies[r["id"]]), "at": now, "void": base}
    (out / "absorbed.json").write_text(json.dumps({"absorbed": sorted(prior.values(), key=lambda x: x["slug"])}, indent=2), encoding="utf-8")
    if a.drop:
        for r in records:
            if r["id"] in verified_ids and r["id"] not in sure:
                verified_ids.discard(r["id"])
                print(f"DROP ABORTED for {r['name']}: Void did not answer exactly 200 with the record saved. Local files preserved.")
        return drop_phase(a, out, Path(root).resolve(), base, records, verified_ids) or (0 if held == len(records) and not rejected else 1)
    return 0 if held == len(records) and not rejected else 1


def cmd_recall(a) -> int:
    """Ask Void what it remembers. With --id, print the stored digest. Read-only."""
    token = get_token()
    u = urllib.parse.urlparse(a.url)
    if u.scheme != "https" and not (u.scheme == "http" and u.hostname in ("localhost", "127.0.0.1", "::1")):
        print("--url must be https (http is allowed only for localhost)", file=sys.stderr)
        return 2
    if not token:
        print("set VOID_MEMORY_TOKEN to your Void key (vr1.…, from paid Void) or the owner token first. " + KEY_HELP, file=sys.stderr)
        return 2
    q = "id=" + urllib.parse.quote(a.id) if a.id else "q=" + urllib.parse.quote(a.q or "")
    try:
        status, res = _http(a.url.rstrip("/") + "/api/memory?" + q, token)
    except urllib.error.HTTPError as e:
        print(f"Void answered {e.code}: " + refused_text(e.code, _body_of(e)), file=sys.stderr)
        return 1
    except (urllib.error.URLError, OSError, ValueError) as e:
        print(f"could not reach Void: {e}", file=sys.stderr)
        return 1
    rows = res.get("memory") or []
    if not rows:
        print("Void remembers nothing matching that.")
        return 0
    for m in rows:
        if a.id:
            print(m.get("body") or f"(no digest stored for {m['id']})")
        else:
            print(f"{m['id']}  {m['name']}  [{m['state']}]  {m['summary'][:100]}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="ouroboros", description=f"Ouroboros {VERSION}. Harvest what is worth keeping from old projects, verify it, then free regenerable space.")
    ap.add_argument("--version", action="version", version=f"ouroboros {VERSION}")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name, fn in (("harvest", cmd_harvest), ("verify", cmd_verify), ("report", cmd_report), ("plan", cmd_plan), ("reclaim", cmd_reclaim), ("run", cmd_run), ("push", cmd_push), ("recall", cmd_recall)):
        s = sub.add_parser(name)
        s.add_argument("--root", default=str(Path.home()))
        s.add_argument("--out", required=(name != "recall"))
        s.add_argument("--days", type=int, default=90)
        s.add_argument("--top", type=int, default=15)
        s.add_argument("--max-seconds", type=float, default=300)
        if name in ("harvest", "run"):
            s.add_argument("--include-active", action="store_true", help="also digest projects with recent commits")
        if name == "reclaim":
            s.add_argument("--apply", action="store_true")
        if name in ("push", "recall"):
            s.add_argument("--url", required=True, help="your Void, e.g. https://a-to-mind.com")
        if name == "push":
            s.add_argument("--batch", type=int, default=100)
            s.add_argument("--dry-run", action="store_true")
            s.add_argument("--drop", action="store_true", help="after Void verifies a project, delete that project folder (needs the absorbed receipt and a remote repository; leaves a tombstone beside it)")
            s.add_argument("--force-drop-unbacked", action="store_true", help="with --drop: also allow projects with no remote copy or with uncommitted/unpushed work (you type each name to confirm)")
            s.add_argument("--yes", action="store_true", help="with --drop: skip the DROP prompt when every project is pushed and clean")
        if name == "recall":
            s.add_argument("--q", default="", help="words to look for")
            s.add_argument("--id", default="", help="print the stored digest of this record")
        s.set_defaults(fn=fn)
    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
