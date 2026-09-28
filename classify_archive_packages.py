#!/usr/bin/env python3
"""Classify _archive_old_mono/packages into six layers + retain action."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

HOME = Path(r"C:\Users\adamm")
PKG_ROOT = HOME / "_archive_old_mono" / "packages"
OUT_DIR = HOME / "a-to-mind-loop"
OUT_JSON = OUT_DIR / "archive-packages-classified.json"
OUT_MD = OUT_DIR / "archive-packages-classified.md"

SECRET = re.compile(r"(^|\.)(env|pem|key|credential|secret|token|password)(\.|$)", re.I)

# (layer, action, regex on name+desc+readme)
# action: retain | fold | defer | waste
RULES: list[tuple[str, str, re.Pattern[str]]] = [
    # Bridge / governance / safety
    ("Bridge", "retain", re.compile(r"auth|governance|sandbox|sanitiz|validation|circuit-breaker|rate-limiter|throttle|idempotency|human-queue|credential|secrets|panic|tombstone", re.I)),
    ("Bridge", "retain", re.compile(r"hold|gate|allow|deny|permission|policy", re.I)),
    # Loop / learning / evidence
    ("Loop", "retain", re.compile(r"ledger|lessons|goals|dream|foresight|timecapsule|signed-provenance|provenance|replay|curator|council|convene|triage|vitalsigns|compactor", re.I)),
    ("Loop", "retain", re.compile(r"score|attempt|invent|absorb|retain|waste|expand|memory", re.I)),
    # Runner / agents / execution
    ("Runner", "retain", re.compile(r"\bcli\b|daemon|workflow|scheduler|scheduling|automation|browser-automation|gemini-browser|mcp-tools|llm-router|codegen|rag-engine|context-truncate|prompt-optimizer|chaos|test-runner", re.I)),
    ("Runner", "fold", re.compile(r"agent|orchestr|worker|crew", re.I)),
    # Void / public UI primitives
    ("Void", "fold", re.compile(r"\bui-core\b|\bpwa\b|\bcomponents\b|\bresponsive\b|\bdashboards\b|\bstoryteller\b|\bunbought\b|\bmedia\b", re.I)),
    # Capability / connectors / ops
    ("Capability", "retain", re.compile(r"notion-connector|payments|github-automation|deploy-automation|notifier|alerts|monitoring|observability|telemetry|metrics|network-health|cms|etl|kv-writers|storage|database|api-gateway|http-client|websocket|streaming", re.I)),
    ("Capability", "fold", re.compile(r"profile|reports|docs|logger|errors|config|env|contracts|infrastructure|cloud-providers|ci-cd|file-system|mobile-core|ml-core|web3-core|ambient-core|substrates|adversarial", re.I)),
    # Domain-ish
    ("Domain", "defer", re.compile(r"marketplace|unbought|web3|media|cms|ambient", re.I)),
]

DEFAULT = ("Review", "defer")


def read_safe(path: Path, n: int = 8000) -> str:
    try:
        if SECRET.search(path.name):
            return ""
        return path.read_bytes()[:n].decode("utf-8", errors="ignore")
    except Exception:
        return ""


def meta(path: Path) -> dict:
    name = path.name
    pkg_name = ""
    desc = ""
    readme = ""
    scripts = []
    deps = 0
    pkg = path / "package.json"
    if pkg.exists():
        try:
            data = json.loads(read_safe(pkg, 20000) or "{}")
            pkg_name = data.get("name") or ""
            desc = data.get("description") or ""
            scripts = sorted((data.get("scripts") or {}).keys())
            deps = len(data.get("dependencies") or {}) + len(data.get("devDependencies") or {})
        except Exception:
            pass
    for rn in ("README.md", "readme.md", "AGENTS.md"):
        p = path / rn
        if p.exists():
            text = read_safe(p, 2500)
            for line in text.splitlines():
                s = line.strip()
                if s:
                    readme = re.sub(r"^#+\s*", "", s)[:180]
                    break
            break
    # also peek index/src entry for docstring-ish
    blob = f"{name} {pkg_name} {desc} {readme}"
    return {
        "name": name,
        "package_name": pkg_name,
        "description": desc,
        "readme_head": readme,
        "scripts": scripts[:12],
        "dep_count": deps,
        "blob": blob,
    }


def classify(m: dict) -> tuple[str, str, str]:
    blob = m["blob"]
    for layer, action, rx in RULES:
        if rx.search(blob) or rx.search(m["name"]):
            why = f"matched {rx.pattern[:60]}"
            return layer, action, why
    return DEFAULT[0], DEFAULT[1], "no strong signal — needs human glance"


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    for child in sorted(PKG_ROOT.iterdir(), key=lambda p: p.name.lower()):
        if not child.is_dir():
            continue
        m = meta(child)
        layer, action, why = classify(m)
        # refine Domain collision: ambient-core etc already Capability fold via second rules — keep first match order
        rows.append({
            "path": str(child),
            "rel": str(child.relative_to(HOME)),
            "name": m["name"],
            "package_name": m["package_name"],
            "description": m["description"],
            "readme_head": m["readme_head"],
            "scripts": m["scripts"],
            "dep_count": m["dep_count"],
            "layer": layer,
            "action": action,
            "why": why,
            "loop_object": {
                "Void": "Capability",
                "Bridge": "Capability",
                "Loop": "Capability",
                "Runner": "Capability",
                "Capability": "Capability",
                "Domain": "Domain",
                "Review": "Review",
            }[layer],
        })

    by_layer = {}
    by_action = {}
    for r in rows:
        by_layer[r["layer"]] = by_layer.get(r["layer"], 0) + 1
        by_action[r["action"]] = by_action.get(r["action"], 0) + 1

    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "total": len(rows),
        "counts_by_layer": by_layer,
        "counts_by_action": by_action,
        "items": rows,
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    lines = [
        "# Archive packages classified",
        "",
        f"Generated: {payload['generated_at']}",
        f"Total: {payload['total']}",
        "",
        "## Counts by layer",
    ]
    for k, n in sorted(by_layer.items()):
        lines.append(f"- **{k}**: {n}")
    lines.append("")
    lines.append("## Counts by action")
    lines.append("- **retain**: pull into A-to-Mind native soon")
    lines.append("- **fold**: merge essence into an existing retain package / layer module")
    lines.append("- **defer**: not needed for skeleton; revisit when Domain expands")
    lines.append("- **waste**: skip unless proven")
    for k, n in sorted(by_action.items()):
        lines.append(f"- {k}: {n}")
    lines.append("")

    for layer in ["Bridge", "Loop", "Runner", "Void", "Capability", "Domain", "Review"]:
        group = [r for r in rows if r["layer"] == layer]
        if not group:
            continue
        lines.append(f"## {layer}")
        lines.append("")
        for action in ["retain", "fold", "defer", "waste"]:
            ag = [r for r in group if r["action"] == action]
            if not ag:
                continue
            lines.append(f"### {action}")
            lines.append("")
            for r in ag:
                desc = r["description"] or r["readme_head"] or ""
                lines.append(f"- `{r['name']}`" + (f" — {desc[:120]}" if desc else ""))
            lines.append("")

    OUT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"ok": True, "total": len(rows), "by_layer": by_layer, "by_action": by_action, "out_md": str(OUT_MD)}, indent=2))


if __name__ == "__main__":
    main()
