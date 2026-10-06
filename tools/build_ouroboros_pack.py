#!/usr/bin/env python3
"""Build the Ouroboros download: one runnable file (ouroboros.pyz, needs only Python 3.9+), a README and checksums.

    python tools/build_ouroboros_pack.py [--out dist]      writes dist/ouroboros-<version>.zip (and the folder it came from)
"""
from __future__ import annotations

import argparse
import hashlib
import shutil
import sys
import tempfile
import zipapp
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ouroboros  # noqa: E402

README = """OUROBOROS {version}
Find the old projects eating your disk, keep what is worth keeping, and free the space safely.

WHAT YOU NEED
Python 3.9 or newer, and git. Nothing else. It works offline and never uploads anything.

THE SAFE WAY (changes nothing on your machine except the report folder)
  python ouroboros.pyz run --root C:\\Users\\you --out D:\\ouroboros-report
Put --out on another drive, or at least outside the folder you scan.
Then open D:\\ouroboros-report\\report.html in your browser.

WHAT YOU GET
  report.html   every old project, its size, and whether a copy exists elsewhere
  <project>\\digest.md   what each project was: tech, recent commits, open TODOs (secrets are filtered out)
  memory.jsonl  one record per project, ready to load into a notes or knowledge tool
  manifest.json checksums, so `verify` can prove nothing was altered

FREEING SPACE
  python ouroboros.pyz reclaim --root C:\\Users\\you --out D:\\ouroboros-report
First run shows what it would remove and deletes nothing. Add --apply and type DELETE to remove it.
It removes ONLY stale node_modules folders and Python virtual environments whose project still has the
file that rebuilds them (package.json, requirements.txt, ...). `npm install` brings them back.

WHAT IT WILL NEVER DO
It never deletes a project. The report shows which projects hold the only copy of your work. Back those
up yourself before you remove anything. It never reads .env files, keys or certificates.

COMMANDS: run, harvest, verify, report, plan, reclaim.   ouroboros.pyz <command> --help for options.

LIMITS OF THIS VERSION
"Pushed and clean" reflects your last `git fetch`. Windows locked files may keep a folder from being removed;
the tool says so. It looks at git projects only.
"""


def build(out: Path) -> Path:
    v = ouroboros.VERSION
    folder = out / f"ouroboros-{v}"
    if folder.exists():
        shutil.rmtree(folder)
    folder.mkdir(parents=True)
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp)
        for n in ("ouroboros.py", "void_lens.py"):
            shutil.copy(HERE / n, src / n)
        (src / "__main__.py").write_text("import sys\nfrom ouroboros import main\nsys.exit(main())\n", encoding="utf-8")
        zipapp.create_archive(src, folder / "ouroboros.pyz", interpreter="/usr/bin/env python3")
    (folder / "README.txt").write_text(README.format(version=v), encoding="utf-8")
    sums = "".join(f"{hashlib.sha256((folder / n).read_bytes()).hexdigest()}  {n}\n" for n in ("ouroboros.pyz", "README.txt"))
    (folder / "SHA256SUMS.txt").write_text(sums, encoding="utf-8")
    zpath = out / f"ouroboros-{v}.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(folder.iterdir()):
            z.write(f, f"ouroboros-{v}/{f.name}")
    return zpath


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="dist")
    print(f"built {build(Path(ap.parse_args().out).resolve())}")
