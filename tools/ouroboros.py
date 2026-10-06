#!/usr/bin/env python3
"""ouroboros: the loop that feeds on clutter. Scan, harvest what is worth keeping, verify, then (only then) free space.

    python tools/ouroboros.py harvest --root C:\\Users\\you --out D:\\void-harvest      digest inactive projects (read-only)
    python tools/ouroboros.py verify  --out D:\\void-harvest                          re-check every digest and its source
    python tools/ouroboros.py plan    --root C:\\Users\\you --out D:\\void-harvest       what can be freed, and what cannot yet
    python tools/ouroboros.py reclaim --root C:\\Users\\you --out D:\\void-harvest       dry run; add --apply to delete (asks you to type DELETE)

The rules the whole tool is built around:
  * harvest and verify never change a source file. They never read .env, keys or certificates, and every digest is redacted.
  * reclaim deletes ONLY regenerable folders (node_modules, a virtualenv) whose project still has the manifest that rebuilds them.
  * it never deletes a repository. `plan` says which repos already have a remote copy (pushed, clean) and which do not;
    removing a repo is your decision, made after you have checked the remote copy yourself.
Put --out outside --root (another drive is best).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import void_lens  # noqa: E402

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


def cmd_plan(a) -> int:
    root, out = Path(a.root).expanduser().resolve(), Path(a.out).expanduser().resolve()
    budget = void_lens.Budget(a.max_seconds)
    rows = regenerable(root, a.days, budget)
    ok = [r for r in rows if r["stale"] and r["manifest_ok"]]
    print(f"Can be freed now, and rebuilt on demand: {void_lens.human(sum(r['bytes'] for r in ok))} in {len(ok)} folder(s) (stale node_modules and virtualenvs)")
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
    todo = [r for r in regenerable(root, a.days, budget) if r["stale"] and r["manifest_ok"]]
    total = sum(r["bytes"] for r in todo)
    print(f"{len(todo)} folder(s), {void_lens.human(total)}: stale node_modules/virtualenvs whose projects can rebuild them.")
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


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Harvest what is worth keeping from old projects, verify it, then free regenerable space.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name, fn in (("harvest", cmd_harvest), ("verify", cmd_verify), ("plan", cmd_plan), ("reclaim", cmd_reclaim)):
        s = sub.add_parser(name)
        s.add_argument("--root", default=str(Path.home()))
        s.add_argument("--out", required=True)
        s.add_argument("--days", type=int, default=90)
        s.add_argument("--top", type=int, default=15)
        s.add_argument("--max-seconds", type=float, default=300)
        if name == "harvest":
            s.add_argument("--include-active", action="store_true", help="also digest projects with recent commits")
        if name == "reclaim":
            s.add_argument("--apply", action="store_true")
        s.set_defaults(fn=fn)
    a = ap.parse_args(argv)
    return a.fn(a)


if __name__ == "__main__":
    sys.exit(main())
