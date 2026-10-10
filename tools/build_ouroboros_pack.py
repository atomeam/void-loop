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

YOUR OWN VOID (paid Void members)
Your machine's projects can be remembered by your own Void, only yours, and then answer when you ask it things.
  1. Get your Void key: sign in at https://a-to-mind.com (passkey, on paid Void), then make one at https://a-to-mind.com/code-review/#pro
     (the same key does code review). It starts vr1. and is shown once.
  2. Put them in memory, one line after the report:
       python ouroboros.pyz push --out D:\\ouroboros-report --url https://a-to-mind.com
     It asks for the key (typed, not echoed). Or set it once in the VOID_MEMORY_TOKEN variable.
  3. Ask your Void: "what did I build with react" or "what do you remember about the parser".
A free account or an unknown key is told so in plain words and nothing is sent. Your memory holds up to 500 projects.

VOID MUST REMEMBER IT FIRST
  python ouroboros.pyz push --out D:\\ouroboros-report --url https://your-void.example   (your Void key or the owner token in the VOID_MEMORY_TOKEN variable)
This sends each project's full digest to your Void, then reads every one back and compares its hash. It only says
"Void remembers N of N" when each one matches. Ask Void what it holds with:  ouroboros.pyz recall --url ... --q react
Only after that is it reasonable to think about removing a project, and that is always your decision.

WHAT IT WILL NEVER DO
It deletes a project folder only if you pass --drop to push, and only when all of these hold: Void has stored the project's
digest and returned it with a matching hash, the project has a remote repository with everything pushed and no files git
leaves out (.env, local data), and you type DROP. Void keeps a DIGEST (what the project was), not your code, so a project
with no remote copy is refused unless you also pass --force-drop-unbacked and type its name. A tombstone file is left
beside every deleted folder. The report shows which projects hold the only copy of your work. Back those
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
