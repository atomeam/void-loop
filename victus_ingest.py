#!/usr/bin/env python3
"""Full-PC Victus ingest: classify project roots into Loop objects."""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

HOME = Path(r"C:\Users\adamm")
OUT_DIR = HOME / "a-to-mind-loop"
OUT_JSON = OUT_DIR / "victus-ingest.json"
OUT_MD = OUT_DIR / "victus-ingest.md"

SKIP_TOP = {
    "AppData", "Application Data", "Local Settings", "Cookies", "NetHood",
    "PrintHood", "Recent", "SendTo", "Start Menu", "Templates", "Links",
    "Favorites", "Contacts", "Saved Games", "Searches", "Music", "Videos",
    "OneDrive", "CrossDevice", "npm-cache", "terminals", "agent-tools",
    "__pycache__", "bin", "go", "Postman", "Claude",
}

SKIP_DIR_NAMES = {
    "node_modules", ".git", ".venv", "venv", "__pycache__", ".next", "dist",
    "build", ".cache", ".turbo", "target", ".wrangler", ".vercel",
}

SECRET_NAME_HINTS = re.compile(
    r"(^|\.)(env|pem|key|credential|secret|token|password)(\.|$)", re.I
)

CLUSTER_RULES = [
    ("void_face", re.compile(r"a-to-mind|atomind|void|a2m", re.I)),
    ("aether", re.compile(r"aether", re.I)),
    ("execution", re.compile(r"agent|orchestr|cli-agent|self-extend|console|hub", re.I)),
    ("ops_companion", re.compile(r"homebase|ops|companion|slack|intent|focus|weather|monitor", re.I)),
    ("infra", re.compile(r"cloudflare|worker|deploy|infra|docker|sql-schema", re.I)),
    ("domain_work", re.compile(r"farm|microclimate|surplus|borrowed|emotional|forevor|wix|p2|alpha", re.I)),
    ("docs_thesis", re.compile(r"docs|substrate|archive|doom_template|project-docs", re.I)),
    ("victus_nest", re.compile(r"^\.victus$|victus", re.I)),
]

LOOP_BY_CLUSTER = {
    "void_face": ("Capability", "Void / public and gateway surfaces — rebuild native, strip slop"),
    "aether": ("Waste_or_Capability", "Earlier control-plane brand — absorb modules, kill parallel brand"),
    "execution": ("Capability", "Loop runner ancestors — fold into one runner"),
    "ops_companion": ("Capability", "Private operator UX — fold into Scoreboard / Attempt surfaces"),
    "infra": ("Capability", "Deploy and edge infra — keep what still runs"),
    "domain_work": ("Domain", "Concrete work domains — candidate first Domains for The Loop"),
    "docs_thesis": ("Absorb", "Sources for Absorb; marketing thesis mostly Waste under Void"),
    "victus_nest": ("Domain", "Agency / earn experiments — strong Cycle 0 candidates"),
    "misc": ("Review", "Needs human glance"),
}


def is_project_root(path: Path) -> bool:
    markers = [
        "package.json", "pyproject.toml", "Cargo.toml", "go.mod",
        "wrangler.toml", "wrangler.jsonc", "docker-compose.yml",
        "Dockerfile", "requirements.txt", "README.md", "README.MD",
        ".git",
    ]
    if any((path / m).exists() for m in markers):
        return True
    # nested agency folders without markers
    if path.is_dir() and path.parent.name == ".victus":
        return True
    return False


def read_text_safe(path: Path, limit: int = 4000) -> str:
    try:
        if SECRET_NAME_HINTS.search(path.name):
            return ""
        data = path.read_bytes()[:limit]
        return data.decode("utf-8", errors="ignore")
    except Exception:
        return ""


def summarize(path: Path) -> dict:
    summary = {
        "has_git": (path / ".git").exists(),
        "has_package_json": (path / "package.json").exists(),
        "has_python": (path / "requirements.txt").exists() or (path / "pyproject.toml").exists(),
        "has_wrangler": (path / "wrangler.toml").exists() or (path / "wrangler.jsonc").exists(),
        "has_docker": (path / "docker-compose.yml").exists() or (path / "Dockerfile").exists(),
        "readme_head": "",
        "package_name": "",
        "package_desc": "",
        "mtime": None,
    }
    try:
        summary["mtime"] = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
    except Exception:
        pass

    for readme in ("README.md", "README.MD", "readme.md", "OFFER.md", "IMPLEMENTATION.md"):
        p = path / readme
        if p.exists():
            summary["readme_head"] = read_text_safe(p, 800).strip().replace("\r", "")[:500]
            break

    pkg = path / "package.json"
    if pkg.exists():
        try:
            data = json.loads(read_text_safe(pkg, 8000) or "{}")
            summary["package_name"] = data.get("name") or ""
            summary["package_desc"] = data.get("description") or ""
        except Exception:
            pass
    return summary


def cluster_for(name: str, rel: str) -> str:
    blob = f"{name} {rel}"
    for key, rx in CLUSTER_RULES:
        if rx.search(blob):
            return key
    return "misc"


def loop_class(cluster: str, summary: dict, name: str) -> tuple[str, str]:
    base, why = LOOP_BY_CLUSTER.get(cluster, LOOP_BY_CLUSTER["misc"])
    # refine
    lower = name.lower()
    if "archive" in lower or lower.startswith("_archive"):
        return "Waste", "Archived mono / dead path — keep as Waste history, don't revive"
    if summary["readme_head"] and re.search(r"\bTODO\b|\bnot implemented\b|\bstub\b", summary["readme_head"], re.I):
        if base == "Capability":
            return "Waste_or_Capability", why + " (stub signals — verify before Retain)"
    if cluster == "docs_thesis" and re.search(r"positioning|pricing|homepage|brand", lower):
        return "Waste", "Public-claims docs — Void does not tell; Absorb only if useful for scoring"
    if cluster == "domain_work":
        return "Domain", why
    if cluster == "victus_nest":
        return "Domain", why
    return base, why


def iter_candidates() -> list[Path]:
    found: list[Path] = []

    # top-level home dirs
    for child in sorted(HOME.iterdir(), key=lambda p: p.name.lower()):
        if not child.is_dir():
            continue
        name = child.name
        if name in SKIP_TOP:
            continue
        if name.startswith(".") and name not in {".victus", ".darwin", ".forevor", ".viktor", ".grok", ".openclaw"}:
            # still scan a few known tool homes lightly
            continue
        if name == ".victus":
            for nested in sorted(child.iterdir()):
                if nested.is_dir() and nested.name not in SKIP_DIR_NAMES:
                    found.append(nested)
            continue
        if is_project_root(child) or name.startswith("a-") or name.startswith("a2") or name in {
            "HomeBase", "projects", "apps", "dev", "docs", "hold", "surplus", "ALPHA", "ALPHA-1", "P2", "p2-gbc"
        }:
            found.append(child)

    # one level into projects/, apps/, GitHub/, Documents if present
    for container in ("projects", "apps", "GitHub", "Documents", "Desktop", "dev", "hold"):
        cpath = HOME / container
        if not cpath.is_dir():
            continue
        try:
            for child in sorted(cpath.iterdir(), key=lambda p: p.name.lower()):
                if child.is_dir() and child.name not in SKIP_DIR_NAMES and is_project_root(child):
                    if child not in found:
                        found.append(child)
        except Exception:
            continue

    # top-level markdown theses as Absorb sources
    for md in HOME.glob("a-to-mind-*.md"):
        found.append(md)

    return found


def classify_one(path: Path) -> dict:
    rel = str(path.relative_to(HOME)) if path.is_relative_to(HOME) else str(path)
    name = path.name
    if path.is_file():
        cluster = "docs_thesis"
        summary = {
            "has_git": False,
            "has_package_json": False,
            "has_python": False,
            "has_wrangler": False,
            "has_docker": False,
            "readme_head": read_text_safe(path, 500),
            "package_name": "",
            "package_desc": "",
            "mtime": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
        }
        kind = "file"
    else:
        cluster = cluster_for(name, rel)
        summary = summarize(path)
        kind = "dir"

    loop_obj, rationale = loop_class(cluster, summary, name)
    return {
        "path": str(path),
        "rel": rel,
        "name": name,
        "kind": kind,
        "cluster": cluster,
        "loop_object": loop_obj,
        "rationale": rationale,
        "signals": summary,
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    items = [classify_one(p) for p in iter_candidates()]
    # de-dupe by path
    uniq = {}
    for it in items:
        uniq[it["path"]] = it
    items = sorted(uniq.values(), key=lambda x: (x["cluster"], x["loop_object"], x["rel"].lower()))

    by_loop: dict[str, list] = {}
    by_cluster: dict[str, list] = {}
    for it in items:
        by_loop.setdefault(it["loop_object"], []).append(it)
        by_cluster.setdefault(it["cluster"], []).append(it)

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "home": str(HOME),
        "machine": "Victus",
        "counts": {
            "total": len(items),
            "by_loop_object": {k: len(v) for k, v in sorted(by_loop.items())},
            "by_cluster": {k: len(v) for k, v in sorted(by_cluster.items())},
        },
        "items": items,
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    lines = []
    lines.append(f"# Victus full-PC ingest")
    lines.append("")
    lines.append(f"Generated: {payload['generated_at']}")
    lines.append(f"Total classified: {payload['counts']['total']}")
    lines.append("")
    lines.append("## Counts by Loop object")
    for k, n in sorted(payload["counts"]["by_loop_object"].items()):
        lines.append(f"- **{k}**: {n}")
    lines.append("")
    lines.append("## Counts by cluster")
    for k, n in sorted(payload["counts"]["by_cluster"].items()):
        lines.append(f"- **{k}**: {n}")
    lines.append("")

    for loop_obj in sorted(by_loop.keys()):
        lines.append(f"## {loop_obj}")
        lines.append("")
        for it in by_loop[loop_obj]:
            desc = it["signals"].get("package_desc") or ""
            head = (it["signals"].get("readme_head") or "").splitlines()
            head1 = head[0] if head else ""
            lines.append(f"### `{it['rel']}`")
            lines.append(f"- cluster: {it['cluster']}")
            lines.append(f"- rationale: {it['rationale']}")
            if desc:
                lines.append(f"- package: {desc}")
            if head1:
                lines.append(f"- readme: {head1[:160]}")
            flags = []
            s = it["signals"]
            if s.get("has_git"):
                flags.append("git")
            if s.get("has_package_json"):
                flags.append("npm")
            if s.get("has_python"):
                flags.append("python")
            if s.get("has_wrangler"):
                flags.append("wrangler")
            if s.get("has_docker"):
                flags.append("docker")
            if flags:
                lines.append(f"- signals: {', '.join(flags)}")
            lines.append("")

    OUT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"ok": True, "total": len(items), "out_json": str(OUT_JSON), "out_md": str(OUT_MD), "counts": payload["counts"]}, indent=2))


if __name__ == "__main__":
    main()
