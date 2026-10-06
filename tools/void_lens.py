#!/usr/bin/env python3
"""void-lens: a read-only map of where a developer's disk went.

It never deletes, moves, writes or uploads anything. It reads sizes and dates only (never file contents),
works offline, and prints the commands YOU can run to reclaim the space. The only file it writes is the
report, and only if you pass --out.

    python tools/void_lens.py                    markdown report for your home folder, on screen
    python tools/void_lens.py --root D:\\dev      scan one folder
    python tools/void_lens.py --json --out lens.json
    python tools/void_lens.py --days 180         call a repo inactive after 180 days with no commit

Reports contain folder paths. Read one before you share it.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

PRUNE = {".git", "node_modules", ".venv", "venv", "__pycache__", "$RECYCLE.BIN", "System Volume Information", "Windows", "Program Files", "Program Files (x86)", "AppData"}
GB = 1024 ** 3


def human(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024 or unit == "TB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


class Budget:
    """A wall-clock limit, so a huge disk gives a partial report instead of hanging."""

    def __init__(self, seconds: float):
        self.end = time.monotonic() + seconds
        self.hit = False

    def spent(self) -> bool:
        if time.monotonic() > self.end:
            self.hit = True
        return self.hit


def dir_size(path: Path, budget: Budget) -> int:
    """Total bytes under path. Does not follow symlinks; unreadable entries are skipped."""
    total, stack = 0, [str(path)]
    while stack:
        if budget.spent():
            break
        cur = stack.pop()
        try:
            with os.scandir(cur) as it:
                for e in it:
                    try:
                        if e.is_symlink():
                            continue
                        if e.is_dir(follow_symlinks=False):
                            stack.append(e.path)
                        else:
                            total += e.stat(follow_symlinks=False).st_size
                    except OSError:
                        continue
        except OSError:
            continue
    return total


def last_commit_age_days(repo: Path) -> float | None:
    """Days since the last commit (read-only git call), or None if git is missing or the repo has no commits."""
    if not shutil.which("git"):
        return None
    try:
        r = subprocess.run(["git", "-C", str(repo), "log", "-1", "--format=%ct"], capture_output=True, text=True, timeout=10)
        if r.returncode == 0 and r.stdout.strip():
            return (time.time() - int(r.stdout.strip())) / 86400
    except (OSError, ValueError, subprocess.SubprocessError):
        pass
    return None


def newest_mtime_days(path: Path) -> float:
    try:
        return (time.time() - path.stat().st_mtime) / 86400
    except OSError:
        return 0.0


def walk_projects(root: Path, budget: Budget):
    """Yield (kind, path) for node_modules, virtualenvs and git repos, without descending into them."""
    stack = [str(root)]
    while stack:
        if budget.spent():
            return
        cur = stack.pop()
        try:
            entries = list(os.scandir(cur))
        except OSError:
            continue
        names = {e.name for e in entries}
        if ".git" in names:
            yield "repo", Path(cur)
        for e in entries:
            try:
                if e.is_symlink() or not e.is_dir(follow_symlinks=False):
                    continue
            except OSError:
                continue
            if e.name == "node_modules":
                yield "node_modules", Path(e.path)
            elif e.name in (".venv", "venv") and ("pyvenv.cfg" in {x.name for x in _ls(e.path)}):
                yield "venv", Path(e.path)
            elif e.name not in PRUNE:
                stack.append(e.path)


def _ls(p: str):
    try:
        return list(os.scandir(p))
    except OSError:
        return []


def known_caches(home: Path) -> list[tuple[str, Path, str]]:
    """(label, path, command-to-reclaim) for the well-known developer and AI caches that exist."""
    local = Path(os.environ.get("LOCALAPPDATA", home / "AppData" / "Local"))
    hf = Path(os.environ.get("HF_HOME", home / ".cache" / "huggingface"))
    cands = [
        ("Hugging Face model cache", hf, "hf cache scan   (then: hf cache prune, or delete revisions you do not use)"),
        ("Ollama models", Path(os.environ.get("OLLAMA_MODELS", home / ".ollama" / "models")), "ollama list   (then: ollama rm <model> for ones you do not run)"),
        ("pip cache", home / ".cache" / "pip", "pip cache purge"),
        ("pip cache (Windows)", local / "pip" / "Cache", "pip cache purge"),
        ("npm cache", home / ".npm", "npm cache clean --force"),
        ("npm cache (Windows)", local / "npm-cache", "npm cache clean --force"),
        ("pnpm store", home / ".local" / "share" / "pnpm" / "store", "pnpm store prune"),
        ("Yarn cache", home / ".cache" / "yarn", "yarn cache clean"),
        ("Cargo registry", home / ".cargo" / "registry", "cargo cache -a   (needs cargo-cache)"),
        ("Gradle caches", home / ".gradle" / "caches", "delete ~/.gradle/caches (it is re-downloaded on the next build)"),
        ("Playwright browsers", home / ".cache" / "ms-playwright", "delete the folder; npx playwright install brings back what you need"),
    ]
    return [(label, p, cmd) for label, p, cmd in cands if p.exists()]


def find_vhdx(home: Path, budget: Budget) -> list[tuple[Path, int]]:
    """WSL and Docker Desktop virtual disks (Windows). They only grow until you compact them."""
    local = Path(os.environ.get("LOCALAPPDATA", home / "AppData" / "Local"))
    out = []
    for base in (local / "Packages", local / "Docker", local / "Docker" / "wsl"):
        if not base.exists():
            continue
        for dirpath, _dirs, files in os.walk(base):
            if budget.spent():
                return out
            for f in files:
                if f.lower().endswith(".vhdx"):
                    p = Path(dirpath) / f
                    try:
                        out.append((p, p.stat().st_size))
                    except OSError:
                        pass
    return out


def docker_df() -> str | None:
    """`docker system df` is read-only. Returns its text, or None if Docker is not installed or not running."""
    if not shutil.which("docker"):
        return None
    try:
        r = subprocess.run(["docker", "system", "df"], capture_output=True, text=True, timeout=20)
        return r.stdout.strip() if r.returncode == 0 and r.stdout.strip() else None
    except (OSError, subprocess.SubprocessError):
        return None


def scan(root: Path, days: int, budget: Budget, top: int) -> dict:
    home = Path.home()
    nm, venvs, repos = [], [], []
    for kind, p in walk_projects(root, budget):
        if kind == "node_modules":
            nm.append(p)
        elif kind == "venv":
            venvs.append(p)
        else:
            repos.append(p)

    def sized(paths, age_of):
        rows = [{"path": str(p), "bytes": dir_size(p, budget), "idle_days": round(age_of(p))} for p in paths]
        return sorted(rows, key=lambda r: -r["bytes"])

    # a node_modules or venv is "stale" when its project has seen no commit (or edit) for `days`
    def project_age(p: Path) -> float:
        proj = p.parent
        a = last_commit_age_days(proj) if (proj / ".git").exists() else None
        return a if a is not None else newest_mtime_days(proj / "package.json" if (proj / "package.json").exists() else proj)

    nm_rows = sized(nm, project_age)
    venv_rows = sized(venvs, project_age)
    repo_rows = []
    for r in repos:
        age = last_commit_age_days(r)
        if age is not None and age > days:
            repo_rows.append({"path": str(r), "bytes": dir_size(r, budget), "idle_days": round(age)})
    repo_rows.sort(key=lambda x: -x["bytes"])

    caches = [{"label": lbl, "path": str(p), "bytes": dir_size(p, budget), "command": cmd} for lbl, p, cmd in known_caches(home)]
    caches.sort(key=lambda x: -x["bytes"])
    vhdx = [{"path": str(p), "bytes": s} for p, s in sorted(find_vhdx(home, budget), key=lambda t: -t[1])]

    stale = lambda rows: [r for r in rows if r["idle_days"] > days]
    return {
        "root": str(root),
        "days": days,
        "partial": budget.hit,
        "caches": caches,
        "node_modules": {"all": len(nm_rows), "total": sum(r["bytes"] for r in nm_rows), "stale": stale(nm_rows)[:top], "stale_total": sum(r["bytes"] for r in stale(nm_rows))},
        "venvs": {"all": len(venv_rows), "total": sum(r["bytes"] for r in venv_rows), "stale": stale(venv_rows)[:top], "stale_total": sum(r["bytes"] for r in stale(venv_rows))},
        "inactive_repos": {"count": len(repo_rows), "total": sum(r["bytes"] for r in repo_rows), "top": repo_rows[:top]},
        "virtual_disks": vhdx,
        "docker": docker_df(),
    }


def report_md(d: dict) -> str:
    L = ["# void-lens report", "", f"Scanned `{d['root']}`. Read-only: nothing was deleted, moved or uploaded.", ""]
    if d["partial"]:
        L += ["> The scan hit its time limit, so these numbers are a lower bound. Re-run with `--max-seconds` set higher, or scan one folder with `--root`.", ""]
    cache_total = sum(c["bytes"] for c in d["caches"])
    reclaim = cache_total + d["node_modules"]["stale_total"] + d["venvs"]["stale_total"]
    L += [f"**Safe to rebuild: about {human(reclaim)}** (caches, plus dependency folders of projects idle for {d['days']}+ days).", ""]
    L += ["## Caches (they come back on demand)", ""]
    if d["caches"]:
        L += ["| What | Size | Where | Reclaim with |", "|---|---|---|---|"] + [f"| {c['label']} | {human(c['bytes'])} | `{c['path']}` | `{c['command']}` |" for c in d["caches"]]
    else:
        L.append("None of the usual caches were found.")
    for key, title, cmd in (("node_modules", "Stale `node_modules`", "delete the folder; `npm install` restores it"), ("venvs", "Stale Python virtual environments", "delete the folder; recreate with `python -m venv` and `pip install -r requirements.txt`")):
        s = d[key]
        L += ["", f"## {title}", "", f"{s['all']} found, {human(s['total'])} in total; {human(s['stale_total'])} sit in projects idle for {d['days']}+ days. Reclaim: {cmd}.", ""]
        if s["stale"]:
            L += ["| Size | Idle (days) | Path |", "|---|---|---|"] + [f"| {human(r['bytes'])} | {r['idle_days']} | `{r['path']}` |" for r in s["stale"]]
    L += ["", "## Virtual disks (Windows: WSL, Docker Desktop)", ""]
    if d["virtual_disks"]:
        L += ["| Size | Path |", "|---|---|"] + [f"| {human(v['bytes'])} | `{v['path']}` |" for v in d["virtual_disks"]]
        L += ["", "Deleting files inside WSL does not shrink these. Run `wsl --shutdown`, then compact the `.vhdx` with `diskpart` (`select vdisk file=...`, `compact vdisk`) or `Optimize-VHD`."]
    else:
        L.append("None found.")
    if d["docker"]:
        L += ["", "## Docker (`docker system df`)", "", "```", d["docker"], "```", "", "Reclaim: `docker system prune` (add `-a` for unused images; leave out `--volumes` unless you are sure no data lives there)."]
    r = d["inactive_repos"]
    L += ["", f"## Inactive repositories (no commit in {d['days']}+ days)", ""]
    if r["count"]:
        L += [f"**{r['count']} inactive projects hold {human(r['total'])}.** These are NOT safe to delete as they are: they hold your only copy of the work unless you have pushed it.", ""]
        L += ["| Size | Idle (days) | Path |", "|---|---|---|"] + [f"| {human(x['bytes'])} | {x['idle_days']} | `{x['path']}` |" for x in r["top"]]
        L += ["", "> **Void Pro (planned, not available yet):** pull the documentation, architecture and reusable code out of projects like these into a searchable workspace, verify a cloud backup, and only then offer to remove the local copy.", "> If this is useful, tell us what you'd want it to do first."]
    else:
        L.append("None found.")
    return "\n".join(L) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Read-only map of where your developer disk went. Never deletes anything.")
    ap.add_argument("--root", default=str(Path.home()), help="folder to scan (default: your home folder)")
    ap.add_argument("--days", type=int, default=90, help="idle threshold in days (default 90)")
    ap.add_argument("--top", type=int, default=15, help="rows per table (default 15)")
    ap.add_argument("--max-seconds", type=float, default=120, help="stop scanning after this long (default 120)")
    ap.add_argument("--json", action="store_true", help="JSON instead of markdown")
    ap.add_argument("--out", help="write the report here (the only file this tool ever writes)")
    a = ap.parse_args(argv)
    root = Path(a.root).expanduser()
    if not root.is_dir():
        print(f"not a folder: {root}", file=sys.stderr)
        return 2
    d = scan(root, a.days, Budget(a.max_seconds), a.top)
    text = json.dumps(d, indent=2) if a.json else report_md(d)
    if a.out:
        Path(a.out).write_text(text, encoding="utf-8")
        print(f"wrote {a.out}")
    else:
        sys.stdout.buffer.write(text.encode("utf-8"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
