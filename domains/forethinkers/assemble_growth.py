#!/usr/bin/env python3
from pathlib import Path
parts = sorted(Path("domains/forethinkers/_growth_parts").glob("*.part"))
text = "".join(p.read_text(encoding="utf-8") for p in parts)
out = Path("domains/void.growth.md")
out.write_text(text, encoding="utf-8")
print("wrote", out, "bytes", out.stat().st_size, "from", len(parts), "parts")
assert "magnetize-step card" in text
