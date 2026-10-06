#!/usr/bin/env python3
"""Tests for tools/void_lens.py on a fake home folder. Run: python tools/void_lens_test.py"""
import hashlib, json, os, subprocess, sys, tempfile, time, unittest, unittest.mock
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import void_lens  # noqa: E402


def snapshot(root: Path):
    out = {}
    for p in sorted(root.rglob("*")):
        st = p.lstat()
        out[str(p)] = (st.st_size, st.st_mtime_ns, hashlib.sha1(p.read_bytes()).hexdigest() if p.is_file() and not p.is_symlink() else "")
    return out


def blob(path: Path, n: int):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"x" * n)


class Lens(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.home = Path(self.tmp.name)
        old = time.time() - 400 * 86400
        # a stale project: node_modules + venv + .git whose only commit is old
        proj = self.home / "dev" / "oldproj"
        blob(proj / "node_modules" / "a" / "x.js", 5000)
        blob(proj / ".venv" / "lib" / "y.py", 3000)
        (proj / ".venv" / "pyvenv.cfg").write_text("home = /usr\n")
        blob(proj / "src" / "main.py", 100)
        env = {**os.environ, "GIT_AUTHOR_DATE": "2025-01-01T00:00:00", "GIT_COMMITTER_DATE": "2025-01-01T00:00:00",
               "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t"}
        for cmd in (["init", "-q"], ["add", "-A"], ["commit", "-q", "-m", "old", "--no-gpg-sign"]):
            subprocess.run(["git", "-C", str(proj)] + cmd, check=True, env=env, capture_output=True)
        # a fresh project must NOT be reported stale
        fresh = self.home / "dev" / "fresh"
        blob(fresh / "node_modules" / "b" / "z.js", 7000)
        for cmd in (["init", "-q"], ["add", "-A"], ["commit", "-q", "-m", "new", "--no-gpg-sign"]):
            subprocess.run(["git", "-C", str(fresh)] + cmd, check=True, env={**env, "GIT_AUTHOR_DATE": time.strftime("%Y-%m-%dT%H:%M:%S"), "GIT_COMMITTER_DATE": time.strftime("%Y-%m-%dT%H:%M:%S")}, capture_output=True)
        blob(self.home / ".cache" / "huggingface" / "hub" / "m.bin", 9000)
        self._home = os.environ.get("HOME")
        os.environ["HOME"] = str(self.home)
        os.environ["USERPROFILE"] = str(self.home)

    def tearDown(self):
        if self._home is None:
            os.environ.pop("HOME", None)
        else:
            os.environ["HOME"] = self._home
        self.tmp.cleanup()

    def scan(self, **kw):
        return void_lens.scan(self.home, kw.get("days", 90), void_lens.Budget(30), 15)

    def test_finds_stale_and_ignores_fresh(self):
        d = self.scan()
        self.assertEqual(d["node_modules"]["all"], 2)
        stale = [r["path"] for r in d["node_modules"]["stale"]]
        self.assertTrue(any("oldproj" in p for p in stale))
        self.assertFalse(any("fresh" in p for p in stale))
        self.assertEqual(d["venvs"]["all"], 1)
        self.assertEqual(d["inactive_repos"]["count"], 1)
        self.assertTrue(any("huggingface" in c["path"] and c["bytes"] == 9000 for c in d["caches"]))

    def test_is_read_only(self):
        before = snapshot(self.home)
        d = self.scan()
        void_lens.report_md(d)
        self.assertEqual(before, snapshot(self.home), "the scan changed the tree")

    def test_report_text(self):
        md = void_lens.report_md(self.scan())
        self.assertIn("nothing was deleted", md)
        self.assertIn("Void Pro (planned, not available yet)", md)
        self.assertIn("hf cache", md)

    def test_json_and_cli(self):
        r = subprocess.run([sys.executable, str(HERE / "void_lens.py"), "--root", str(self.home), "--json"], capture_output=True, text=True, env={**os.environ})
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout)["inactive_repos"]["count"], 1)

    def test_time_budget_gives_partial(self):
        b = void_lens.Budget(0)
        time.sleep(0.01)
        d = void_lens.scan(self.home, 90, b, 15)
        self.assertTrue(d["partial"])

    def test_unreadable_folders_are_counted_and_the_report_says_the_sizes_are_a_lower_bound(self):
        locked = str(self.home / "dev" / "oldproj" / "node_modules")
        real = os.scandir
        def flaky(path):
            if str(path) == locked:
                raise PermissionError(13, "denied", locked)
            return real(path)
        with unittest.mock.patch.object(void_lens.os, "scandir", flaky):
            d = self.scan()
        self.assertGreaterEqual(d["unreadable"], 1)
        self.assertIn("could not be read", void_lens.report_md(d))
        self.assertIn("lower bound", void_lens.report_md(d))
        self.assertEqual(self.scan()["unreadable"], 0)
        self.assertNotIn("could not be read", void_lens.report_md(self.scan()))

    def test_bad_root(self):
        self.assertEqual(void_lens.main(["--root", str(self.home / "nope")]), 2)


if __name__ == "__main__":
    unittest.main()
