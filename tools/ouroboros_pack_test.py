#!/usr/bin/env python3
"""The built download must work with nothing but Python: build it, unzip it, run it on a fake machine. Run: python tools/ouroboros_pack_test.py"""
import os, subprocess, sys, tempfile, unittest, zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_ouroboros_pack as pack  # noqa: E402
import ouroboros  # noqa: E402


class Pack(unittest.TestCase):
    def test_built_download_runs_standalone(self):
        with tempfile.TemporaryDirectory() as t:
            t = Path(t)
            z = pack.build(t / "dist")
            self.assertTrue(z.name.endswith(f"{ouroboros.VERSION}.zip"))
            ex = t / "unz"
            zipfile.ZipFile(z).extractall(ex)
            d = ex / f"ouroboros-{ouroboros.VERSION}"
            self.assertEqual(sorted(p.name for p in d.iterdir()), ["README.txt", "SHA256SUMS.txt", "ouroboros.pyz"])
            run = lambda *a, cwd=t: subprocess.run([sys.executable, "-I", str(d / "ouroboros.pyz"), *a], capture_output=True, text=True, cwd=cwd)
            r = run("--version")
            self.assertEqual(r.returncode, 0, r.stderr)
            self.assertIn(ouroboros.VERSION, r.stdout)
            home = t / "home" / "proj"
            home.mkdir(parents=True)
            (home / "a.py").write_text("print(1)\n")
            env = {**os.environ, "GIT_AUTHOR_DATE": "2025-01-01T00:00:00", "GIT_COMMITTER_DATE": "2025-01-01T00:00:00", "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t.io", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t.io"}
            for c in (["init", "-q"], ["add", "-A"], ["commit", "-q", "-m", "x", "--no-gpg-sign"]):
                subprocess.run(["git", "-C", str(home), *c], check=True, env=env, capture_output=True)
            r = run("run", "--root", str(t / "home"), "--out", str(t / "out"))
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertTrue((t / "out" / "report.html").is_file())
            self.assertIn("no-remote", (t / "out" / "manifest.json").read_text())
            self.assertTrue((home / "a.py").is_file())


if __name__ == "__main__":
    unittest.main()
