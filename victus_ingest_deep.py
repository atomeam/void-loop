#!/usr/bin/env python3
"""Deep Victus ingest: _archive_old_mono + hold + Desktop -> Loop catalog."""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

HOME = Path(r"C:\Users\adamm")
OUT_DIR = HOME / "a-to-mind-loop"
OUT_JSON = OUT_DIR / "victus-ingest-deep.json"
OUT_MD = OUT_DIR / "victus-ingest-deep.md"
PRIOR_JSON = OUT_DIR / "victus-ingest.json"

SKIP_DIR = {
    "node_modules", ".git", ".venv", "venv", "__pycache__", ".next", "dist",
    "build", "target", ".cache", ".turbo", ".wrangler", ".vercel", ".qdrant_code_embeddings",
    ".crush", ".trunk", ".opencode", ".agents_tmp", ".devin", ".github",
}

SECRET_HINT = re.compile(r"(^|\.)(env|pem|key|credential|secret|token|password)(\.|$)", re.I)

# Map archive app / package name fragments -> six layers
LAYER_RULES = [
    ("void", re.compile(r"\bvoid\b|glassbox|surfaceledger|apex|pages", re.I), "Void"),
    ("bridge", re.compile(r"bridge|hold|gate|treaty|containment|credential-broker|inflight", re.I), "Bridge"),
    ("loop", re.compile(r"loop|scoreboard|attempt|capability|invent|absorb|ledger|provenance|evidence", re.I), "Loop"),
    ("runner", re.compile(r"agent|orchestr|runner|crew|autogen|cli-agent|self-extend|worker", re.I), "Runner"),
    ("capability", re.compile(r"cockpit|homebase|ops|companion|monitor|sentinel|stripe|notion|deploy|console|canvas|slack", re.I), "Capability"),
    ("domain", re.compile(r"marketplace|farm|review|funding|research|content|monetiz|venture|portfolio|alpha|forevor|p2|wix|surplus", re.I), "Domain"),
]


def read_safe(path: Path, limit: int = 6000) -> str:
    try:
        if SECRET_HINT.search(path.name):
            return ""
        return path.read_bytes()[:limit].decode("utf-8", errors="ignore")
    except Exception:
        return ""


def first_heading(text: str) -> str:
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("#"):
            return re.sub(r"^#+\s*", "", s)[:160]
        if s:
            return s[:160]
    return ""


def classify_name(name: str, blob: str = "") -> tuple[str, str]:
    text = f"{name} {blob}"
    for key, rx, layer in LAYER_RULES:
        if rx.search(text):
            return layer, key
    return "Review", "unmatched"


def package_meta(path: Path) -> dict:
    out = {"package_name": "", "package_desc": "", "readme_head": ""}
    pkg = path / "package.json"
    if pkg.exists():
        try:
            data = json.loads(read_safe(pkg, 12000) or "{}")
            out["package_name"] = data.get("name") or ""
            out["package_desc"] = data.get("description") or ""
        except Exception:
            pass
    for rn in ("README.md", "README.MD", "AGENTS.md", "OFFER.md"):
        p = path / rn
        if p.exists():
            out["readme_head"] = first_heading(read_safe(p, 2000))
            break
    return out


def item(path: Path, source: str, kind: str, layer: str, tag: str, extra: dict | None = None) -> dict:
    try:
        rel = str(path.relative_to(HOME))
    except Exception:
        rel = str(path)
    meta = package_meta(path) if path.is_dir() else {
        "package_name": "",
        "package_desc": "",
        "readme_head": first_heading(read_safe(path, 2000)) if path.is_file() else "",
    }
    mtime = None
    try:
        mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
    except Exception:
        pass
    row = {
        "path": str(path),
        "rel": rel,
        "name": path.name,
        "kind": kind,
        "source": source,
        "layer": layer,
        "tag": tag,
        "mtime": mtime,
        **meta,
    }
    if extra:
        row.update(extra)
    return row


def ingest_hold() -> list[dict]:
    root = HOME / "hold"
    rows = []
    if not root.exists():
        return rows
    rows.append(item(root, "hold", "repo", "Bridge", "phase_1_5_spine", {
        "rationale": "Declared Phase 1.5 execution plane; bridge + hold-gate + ledger. Canonical live spine.",
        "loop_object": "Capability",
    }))
    for sub in ("apps", "packages"):
        sp = root / sub
        if not sp.is_dir():
            continue
        for child in sorted(sp.iterdir()):
            if not child.is_dir() or child.name in SKIP_DIR:
                continue
            layer, tag = classify_name(child.name, read_safe(child / "README.md", 1500) if (child / "README.md").exists() else "")
            # hold apps are mostly Bridge/Loop
            if child.name == "bridge":
                layer, tag = "Bridge", "bridge_worker"
            if child.name == "ledger":
                layer, tag = "Loop", "evidence_ledger"
            loop_obj = {
                "Void": "Capability",
                "Bridge": "Capability",
                "Loop": "Capability",
                "Runner": "Capability",
                "Capability": "Capability",
                "Domain": "Domain",
                "Review": "Review",
            }[layer]
            rows.append(item(child, "hold", "package", layer, tag, {
                "rationale": f"hold/{sub}/{child.name} -> {layer}",
                "loop_object": loop_obj,
            }))
    # key docs
    for doc in ("README.md", "AGENTS.md"):
        p = root / doc
        if p.exists():
            rows.append(item(p, "hold", "doc", "Absorb", "contract_doc", {
                "rationale": "Hold contract / agents rules — Absorb into Loop doctrine",
                "loop_object": "Absorb",
            }))
    return rows


def ingest_desktop() -> list[dict]:
    root = HOME / "Desktop"
    rows = []
    if not root.exists():
        return rows
    for child in sorted(root.iterdir(), key=lambda p: p.name.lower()):
        name = child.name
        if name.startswith(".") or name.endswith(".lnk") or name.endswith(".url") or name.endswith(".bat"):
            continue
        if child.is_dir():
            layer, tag = classify_name(name)
            if "a-to-mind" in name.lower() or "atom" in name.lower():
                layer, tag = ("Void" if "board" in name.lower() or "mind" in name.lower() else "Capability"), "desktop_surface"
            rows.append(item(child, "desktop", "dir", layer, tag, {
                "rationale": f"Desktop project folder -> {layer}",
                "loop_object": "Capability" if layer != "Domain" else "Domain",
            }))
            continue
        # files
        lower = name.lower()
        if not (lower.endswith(".md") or lower.endswith(".html") or lower.endswith(".txt")):
            continue
        if re.search(r"positioning|pricing|brand|venture|portfolio|monetiz|site_architecture|homepage|experiment", lower):
            # public-claims / portfolio theater -> Waste for Void, still Absorb for anti-patterns
            layer = "Absorb"
            loop_obj = "Waste" if re.search(r"positioning|pricing|brand|venture|portfolio|monetiz", lower) else "Absorb"
            rationale = "Desktop thesis — Waste if claims/monetization pitch; else Absorb for architecture memory"
            if "architecture" in lower or "experiment" in lower:
                loop_obj = "Absorb"
                rationale = "Architecture / experiments — Absorb into system design, not public copy"
            rows.append(item(child, "desktop", "doc", layer, "desktop_thesis", {
                "rationale": rationale,
                "loop_object": loop_obj,
            }))
        elif "a-to-mind" in lower or "aether" in lower or "ai_" in lower:
            rows.append(item(child, "desktop", "doc", "Absorb", "desktop_doc", {
                "rationale": "Desktop A-to-Mind related doc",
                "loop_object": "Absorb",
            }))
    return rows


def ingest_archive() -> list[dict]:
    root = HOME / "_archive_old_mono"
    rows = []
    if not root.exists():
        return rows

    rows.append(item(root, "archive", "repo", "Review", "old_body", {
        "rationale": "Full old Aether body — ore only. Do not revive as tree. Mine apps/packages/docs.",
        "loop_object": "Waste",
    }))

    # apps/*
    apps = root / "apps"
    if apps.is_dir():
        for child in sorted(apps.iterdir()):
            if not child.is_dir() or child.name in SKIP_DIR:
                continue
            layer, tag = classify_name(child.name)
            # explicit archive app map
            explicit = {
                "void": ("Void", "void_app"),
                "homebase": ("Capability", "homebase_app"),
                "frontend": ("Capability", "frontend_app"),
                "ops-cockpit": ("Capability", "ops_cockpit"),
                "crew-room": ("Runner", "crew_room"),
                "bridge": ("Bridge", "bridge_app"),
                "backend": ("Bridge", "backend_api"),
                "notion-worker": ("Capability", "notion_worker"),
                "stripe-sentinel": ("Capability", "stripe_sentinel"),
                "provenance-marketplace": ("Domain", "provenance_marketplace"),
                "ambient": ("Capability", "ambient_app"),
            }
            if child.name in explicit:
                layer, tag = explicit[child.name]
            loop_obj = {
                "Void": "Capability",
                "Bridge": "Capability",
                "Loop": "Capability",
                "Runner": "Capability",
                "Capability": "Capability",
                "Domain": "Domain",
                "Review": "Review",
            }.get(layer, "Review")
            rows.append(item(child, "archive_apps", "app", layer, tag, {
                "rationale": f"Archive app '{child.name}' salvages into layer {layer}; rebuild under A-to-Mind, don't run from archive.",
                "loop_object": loop_obj,
            }))

    # packages — summarize by top-level package folders (cap listing)
    packages = root / "packages"
    if packages.is_dir():
        pkg_rows = []
        for child in sorted(packages.iterdir()):
            if not child.is_dir() or child.name in SKIP_DIR:
                continue
            layer, tag = classify_name(child.name)
            loop_obj = {
                "Void": "Capability",
                "Bridge": "Capability",
                "Loop": "Capability",
                "Runner": "Capability",
                "Capability": "Capability",
                "Domain": "Domain",
                "Review": "Review",
            }.get(layer, "Review")
            pkg_rows.append(item(child, "archive_packages", "package", layer, tag, {
                "rationale": f"Shared package candidate for {layer}",
                "loop_object": loop_obj if layer != "Review" else "Review",
            }))
        rows.extend(pkg_rows)

    # key architecture docs at archive root
    doc_patterns = re.compile(
        r"(ARCHITECTURE|AGENT|AETHER|AUTOMATION|API|AGENTS|STRATEGY|SYSTEM|COMPLETE|UNIFIED|ASSESSMENT)",
        re.I,
    )
    for child in sorted(root.iterdir()):
        if not child.is_file():
            continue
        if child.suffix.lower() not in {".md", ".html", ".json"}:
            continue
        if not doc_patterns.search(child.name):
            continue
        # skip env-like
        if SECRET_HINT.search(child.name):
            continue
        layer = "Absorb"
        loop_obj = "Absorb"
        if re.search(r"MONEY|MONETIZ|STRATEGIES-NOW", child.name, re.I):
            loop_obj = "Waste"
            layer = "Absorb"
        rows.append(item(child, "archive_docs", "doc", layer, "archive_doc", {
            "rationale": "Archive system doc — Absorb patterns; Waste if monetization theater",
            "loop_object": loop_obj,
        }))

    return rows


def merge_prior(rows: list[dict]) -> list[dict]:
    if not PRIOR_JSON.exists():
        return rows
    try:
        prior = json.loads(PRIOR_JSON.read_text(encoding="utf-8"))
        prior_items = prior.get("items") or []
    except Exception:
        return rows
    # keep prior as source=surface for continuity, mark
    merged = []
    for it in prior_items:
        merged.append({
            "path": it.get("path"),
            "rel": it.get("rel"),
            "name": it.get("name"),
            "kind": it.get("kind"),
            "source": "surface",
            "layer": {
                "Domain": "Domain",
                "Capability": "Capability",
                "Absorb": "Absorb",
                "Waste": "Absorb",
                "Waste_or_Capability": "Capability",
                "Review": "Review",
            }.get(it.get("loop_object"), "Review"),
            "tag": it.get("cluster") or "surface",
            "mtime": (it.get("signals") or {}).get("mtime"),
            "package_name": (it.get("signals") or {}).get("package_name") or "",
            "package_desc": (it.get("signals") or {}).get("package_desc") or "",
            "readme_head": ((it.get("signals") or {}).get("readme_head") or "").splitlines()[0:1],
            "rationale": it.get("rationale") or "From surface ingest",
            "loop_object": it.get("loop_object") or "Review",
        })
        # fix readme_head list accident
        rh = merged[-1]["readme_head"]
        merged[-1]["readme_head"] = rh[0] if isinstance(rh, list) and rh else (rh if isinstance(rh, str) else "")
    return merged + rows


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    rows.extend(ingest_hold())
    rows.extend(ingest_desktop())
    rows.extend(ingest_archive())

    deep_only = list(rows)
    all_rows = merge_prior(rows)

    # dedupe by path preferring deeper sources
    rank = {"archive_apps": 5, "archive_packages": 4, "archive_docs": 4, "archive": 3, "hold": 5, "desktop": 4, "surface": 1}
    uniq = {}
    for r in all_rows:
        p = r["path"]
        if p not in uniq or rank.get(r["source"], 0) >= rank.get(uniq[p]["source"], 0):
            uniq[p] = r
    items = sorted(uniq.values(), key=lambda x: (x.get("source") or "", x.get("layer") or "", (x.get("rel") or "").lower()))

    def counts(xs):
        by_layer, by_loop, by_source = {}, {}, {}
        for it in xs:
            by_layer[it["layer"]] = by_layer.get(it["layer"], 0) + 1
            by_loop[it["loop_object"]] = by_loop.get(it["loop_object"], 0) + 1
            by_source[it["source"]] = by_source.get(it["source"], 0) + 1
        return {"by_layer": by_layer, "by_loop_object": by_loop, "by_source": by_source}

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "machine": "Victus",
        "scope": ["_archive_old_mono", "hold", "Desktop", "prior_surface_merge"],
        "counts_deep_only": {"total": len(deep_only), **counts(deep_only)},
        "counts_merged": {"total": len(items), **counts(items)},
        "items": items,
        "deep_only_items": deep_only,
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    lines = [
        "# Victus deep ingest (archive + hold + Desktop)",
        "",
        f"Generated: {payload['generated_at']}",
        f"Deep-only items: {payload['counts_deep_only']['total']}",
        f"Merged with surface: {payload['counts_merged']['total']}",
        "",
        "## Deep-only counts by layer (six-layer skeleton)",
    ]
    for k, n in sorted(payload["counts_deep_only"]["by_layer"].items()):
        lines.append(f"- **{k}**: {n}")
    lines.append("")
    lines.append("## Deep-only counts by Loop object")
    for k, n in sorted(payload["counts_deep_only"]["by_loop_object"].items()):
        lines.append(f"- **{k}**: {n}")
    lines.append("")

    # group deep_only by layer
    by_layer = {}
    for it in deep_only:
        by_layer.setdefault(it["layer"], []).append(it)

    for layer in ["Void", "Bridge", "Loop", "Runner", "Capability", "Domain", "Absorb", "Review"]:
        group = by_layer.get(layer) or []
        if not group:
            continue
        lines.append(f"## Layer: {layer}")
        lines.append("")
        for it in sorted(group, key=lambda x: x["rel"].lower()):
            lines.append(f"### `{it['rel']}`")
            lines.append(f"- source: {it['source']}")
            lines.append(f"- loop_object: {it['loop_object']}")
            lines.append(f"- tag: {it['tag']}")
            lines.append(f"- rationale: {it.get('rationale','')}")
            if it.get("package_name"):
                lines.append(f"- package: {it['package_name']} — {it.get('package_desc','')}")
            if it.get("readme_head"):
                lines.append(f"- head: {it['readme_head']}")
            lines.append("")

    OUT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({
        "ok": True,
        "deep_total": len(deep_only),
        "merged_total": len(items),
        "counts_deep_only": payload["counts_deep_only"],
        "out_json": str(OUT_JSON),
        "out_md": str(OUT_MD),
    }, indent=2))


if __name__ == "__main__":
    main()
