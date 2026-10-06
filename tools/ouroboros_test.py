#!/usr/bin/env python3
"""Tests for tools/ouroboros.py on a fake machine. Run: python tools/ouroboros_test.py"""
import contextlib, hashlib, http.server, io, json, os, subprocess, sys, tempfile, threading, time, unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ouroboros  # noqa: E402

OLD = "2025-01-01T00:00:00"
SECRET_KEY = "sk-abcdefghijklmnopqrstuvwxyz123456"
ENV_SECRET = "SECRETVALUE9999"


def run_git(repo, *args, date=OLD):
    env = {**os.environ, "GIT_AUTHOR_DATE": date, "GIT_COMMITTER_DATE": date, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t.io", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t.io"}
    subprocess.run(["git", "-C", str(repo), *args], check=True, env=env, capture_output=True)


def write(p: Path, text="x"):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)


def commit_all(repo, date=OLD):
    run_git(repo, "add", "-A", date=date)
    run_git(repo, "commit", "-q", "-m", "work", "--no-gpg-sign", date=date)


def snapshot(root: Path, skip=()):
    out = {}
    for p in sorted(root.rglob("*")):
        if any(s in p.parts for s in skip):
            continue
        st = p.lstat()
        out[str(p)] = (st.st_size, hashlib.sha1(p.read_bytes()).hexdigest() if p.is_file() and not p.is_symlink() else "")
    return out


def call(fn, args):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        rc = ouroboros.main([fn, *args])
    return rc, buf.getvalue()


class Ouroboros(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        t = Path(self.tmp.name)
        self.root, self.out, self.remote, self.outside = t / "home", t / "harvest", t / "remote.git", t / "outside"
        self.root.mkdir(); self.outside.mkdir()
        subprocess.run(["git", "init", "-q", "--bare", str(self.remote)], check=True)
        # A: pushed + clean, secrets everywhere, regenerable node_modules
        a = self.root / "dev" / "alpha"
        write(a / "README.md", f"# Alpha\n\nA tiny tool.\napi_key = {SECRET_KEY}\ncontact me@example.com\n")
        write(a / ".env", f"TOKEN={ENV_SECRET}\n")
        write(a / "src" / "main.py", "# TODO: handle errors\nprint(1)\n")
        write(a / "package.json", json.dumps({"name": "alpha", "description": "alpha thing", "dependencies": {"react": "1"}}))
        write(a / ".gitignore", "node_modules\n.env\n")
        write(a / "node_modules" / "r" / "i.js", "x" * 4000)
        run_git(a, "init", "-q"); commit_all(a)
        run_git(a, "remote", "add", "origin", str(self.remote)); run_git(a, "push", "-q", "origin", "HEAD:refs/heads/main"); run_git(a, "branch", "--set-upstream-to=origin/main") if False else None
        subprocess.run(["git", "-C", str(a), "branch", "-u", "origin/main"], capture_output=True)
        # B: no remote, virtualenv + requirements
        b = self.root / "dev" / "beta"
        write(b / "requirements.txt", "requests==2\nflask>=1\n"); write(b / ".venv" / "pyvenv.cfg", "home=/x\n"); write(b / ".venv" / "lib" / "a.py", "y" * 3000)
        write(b / "app.py", "print(2)\n")
        run_git(b, "init", "-q"); commit_all(b)
        # C: has remote but uncommitted work
        c = self.root / "dev" / "gamma"
        write(c / "g.py", "print(3)\n"); run_git(c, "init", "-q"); commit_all(c)
        run_git(c, "remote", "add", "origin", str(self.remote)); write(c / "new.py", "unsaved\n")
        # H: has a remote and is clean, but its commit was never pushed
        h = self.root / "dev" / "eta"
        write(h / "h.py", "print(8)\n"); run_git(h, "init", "-q"); commit_all(h); run_git(h, "remote", "add", "origin", str(self.remote))
        # D: node_modules with no package.json, old mtime, no git
        d = self.root / "dev" / "delta"
        write(d / "node_modules" / "z" / "z.js", "z" * 2000); write(d / "notes.txt", "n")
        old = time.time() - 500 * 86400
        for p in (d, d / "notes.txt"): os.utime(p, (old, old))
        # E: fresh project with node_modules
        e = self.root / "dev" / "fresh"
        write(e / "package.json", "{}"); write(e / "node_modules" / "q.js", "q" * 1000); write(e / "f.js", "1")
        run_git(e, "init", "-q"); commit_all(e, date=time.strftime("%Y-%m-%dT%H:%M:%S"))
        # F: stale project whose node_modules is a symlink to data outside the root
        f = self.root / "dev" / "linked"
        write(f / "package.json", "{}"); write(self.outside / "precious.txt", "keep me")
        (f / "node_modules").symlink_to(self.outside, target_is_directory=True)
        run_git(f, "init", "-q"); commit_all(f)

    def tearDown(self):
        self.tmp.cleanup()

    def harvest(self):
        rc, txt = call("harvest", ["--root", str(self.root), "--out", str(self.out)])
        self.assertEqual(rc, 0, txt)
        return json.loads((self.out / "manifest.json").read_text())

    def test_harvest_covers_stale_repos_only_and_classifies_backup(self):
        m = self.harvest()
        by = {Path(e["path"]).name: e["state"] for e in m["projects"]}
        self.assertEqual(by.get("alpha"), "remote-current")
        self.assertEqual(by.get("beta"), "no-remote")
        self.assertEqual(by.get("gamma"), "uncommitted-work")
        self.assertEqual(by.get("eta"), "unpushed-commits")
        self.assertNotIn("fresh", by)

    def test_no_secret_reaches_any_output(self):
        self.harvest()
        blob = "".join(p.read_text() for p in self.out.rglob("*") if p.is_file())
        for needle in (SECRET_KEY, ENV_SECRET, "me@example.com"):
            self.assertNotIn(needle, blob)
        self.assertIn("Alpha", blob)
        self.assertIn("TODO", blob)

    def test_memory_records_feed_void(self):
        self.harvest()
        rows = [json.loads(l) for l in (self.out / "memory.jsonl").read_text().splitlines()]
        alpha = next(r for r in rows if r["name"] == "alpha")
        self.assertIn("react", alpha["links"])
        self.assertEqual(alpha["state"], "remote-current")
        self.assertTrue(alpha["sha256"])

    def test_sources_never_change_through_harvest_verify_plan_dryrun(self):
        before = snapshot(self.root)
        self.harvest()
        call("verify", ["--out", str(self.out)])
        call("plan", ["--root", str(self.root), "--out", str(self.out)])
        call("reclaim", ["--root", str(self.root), "--out", str(self.out)])
        self.assertEqual(before, snapshot(self.root))

    def test_verify_catches_tampering_and_new_commits(self):
        self.harvest()
        rc, txt = call("verify", ["--out", str(self.out)])
        self.assertEqual(rc, 0, txt)
        victim = next(self.out.glob("alpha-*/digest.md"))
        victim.write_text("tampered")
        rc, txt = call("verify", ["--out", str(self.out)])
        self.assertEqual(rc, 1)
        self.assertIn("changed", txt)

    def test_verify_notices_source_moved_on(self):
        self.harvest()
        b = self.root / "dev" / "beta"
        write(b / "more.py", "m"); commit_all(b)
        rc, txt = call("verify", ["--out", str(self.out)])
        self.assertEqual(rc, 1)
        self.assertIn("new commits", txt)

    def test_plan_is_honest_about_whole_projects(self):
        self.harvest()
        rc, txt = call("plan", ["--root", str(self.root), "--out", str(self.out)])
        self.assertEqual(rc, 0)
        self.assertIn("NOT SAFE: no-remote", txt)
        self.assertIn("NOT SAFE: uncommitted-work", txt)
        self.assertIn("a pushed, clean copy exists", txt)
        self.assertIn("NOT SAFE: unpushed-commits", txt)
        self.assertIn("NOT auto-freed", txt)

    def test_reclaim_dry_run_deletes_nothing_and_wrong_confirm_deletes_nothing(self):
        before = snapshot(self.root)
        call("reclaim", ["--root", str(self.root), "--out", str(self.out)])
        with mock.patch("builtins.input", return_value="yes"):
            rc, txt = call("reclaim", ["--root", str(self.root), "--out", str(self.out), "--apply"])
        self.assertEqual(rc, 1)
        self.assertEqual(before, snapshot(self.root))

    def test_reclaim_apply_removes_only_regenerable_folders(self):
        with mock.patch("builtins.input", return_value="DELETE"):
            rc, txt = call("reclaim", ["--root", str(self.root), "--out", str(self.out), "--apply"])
        self.assertEqual(rc, 0, txt)
        dev = self.root / "dev"
        self.assertFalse((dev / "alpha" / "node_modules").exists())
        self.assertFalse((dev / "beta" / ".venv").exists())
        for keep in ((dev / "alpha" / "src" / "main.py"), (dev / "alpha" / ".env"), (dev / "beta" / "app.py"), (dev / "gamma" / "new.py"),
                     (dev / "delta" / "node_modules" / "z" / "z.js"), (dev / "fresh" / "node_modules" / "q.js"), (self.outside / "precious.txt")):
            self.assertTrue(keep.exists(), f"{keep} must survive")
        self.assertTrue((dev / "alpha" / ".git").exists())
        self.assertTrue((dev / "linked" / "node_modules").is_symlink())
        self.assertTrue((self.out / "reclaim-log.jsonl").read_text().strip())

    def test_harvest_refuses_out_inside_root(self):
        rc, _ = call("harvest", ["--root", str(self.root), "--out", str(self.root / "dev" / "out")])
        self.assertEqual(rc, 2)

    def test_report_is_self_contained_and_escapes_everything(self):
        evil = self.root / "dev" / "evil"
        write(evil / "README.md", "# <script>alert(1)</script>\n\n<img src=x onerror=alert(2)> hostile readme\n")
        run_git(evil, "init", "-q"); commit_all(evil)
        self.harvest()
        rc, txt = call("report", ["--out", str(self.out)])
        self.assertEqual(rc, 0, txt)
        page = (self.out / "report.html").read_text()
        self.assertNotIn("<script", page.lower())
        self.assertNotIn("onerror=", page.lower().replace("&lt;img src=x onerror=", ""))
        self.assertNotIn("http://", page); self.assertNotIn("https://", page)
        for needle in (SECRET_KEY, ENV_SECRET):
            self.assertNotIn(needle, page)
        self.assertIn("Pushed and clean", page)
        self.assertIn("No remote copy", page)
        self.assertIn("hold work that exists nowhere else", page)

    def test_report_needs_a_harvest(self):
        rc, _ = call("report", ["--out", str(self.out / "nothing")])
        self.assertEqual(rc, 2)

    def test_run_does_the_safe_path_and_never_deletes(self):
        before = snapshot(self.root)
        rc, txt = call("run", ["--root", str(self.root), "--out", str(self.out)])
        self.assertEqual(rc, 0, txt)
        for part in ("1/4 harvest", "2/4 verify", "3/4 report", "4/4 plan", "report.html"):
            self.assertIn(part, txt)
        self.assertTrue((self.out / "report.html").is_file())
        self.assertEqual(before, snapshot(self.root))

    def test_version_flag(self):
        with self.assertRaises(SystemExit):
            with contextlib.redirect_stdout(io.StringIO()):
                ouroboros.main(["--version"])

    def _server(self, status=200, tamper=False, no_get=False):
        """A stand-in for Void's /api/memory: stores what it is sent and hands it back by id with the hash it computed itself."""
        got, store = [], {}
        class H(http.server.BaseHTTPRequestHandler):
            def _send(h, code, obj):
                h.send_response(code); h.send_header("content-type", "application/json"); h.end_headers(); h.wfile.write(json.dumps(obj).encode())
            def do_POST(h):
                body = json.loads(h.rfile.read(int(h.headers["content-length"])))
                got.append({"auth": h.headers.get("authorization"), "path": h.path, "body": body})
                for r in body["records"]:
                    b = r.get("body", "") + ("x" if tamper else "")
                    store[r["id"]] = {**{k: v for k, v in r.items() if k != "body"}, "body": b, "body_sha256": hashlib.sha256(b.encode()).hexdigest()}
                h._send(status, {"saved": len(body["records"]), "rejected": 0})
            def do_GET(h):
                if no_get:
                    return h._send(404, {})
                from urllib.parse import urlparse, parse_qs
                q = parse_qs(urlparse(h.path).query)
                if "id" in q:
                    return h._send(200, {"memory": [store[q["id"][0]]] if q["id"][0] in store else []})
                words = (q.get("q", [""])[0]).lower().split()
                rows = [{k: v for k, v in r.items() if k not in ("body",)} for r in store.values() if all(w in (r["name"] + r["summary"] + " ".join(r["links"])).lower() for w in words)]
                h._send(200, {"memory": rows})
            def log_message(h, *a): pass
        srv = http.server.HTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        self.addCleanup(srv.server_close)
        self.addCleanup(srv.shutdown)
        srv.store = store
        return srv, got

    def test_push_sends_each_digest_then_reads_it_back_and_checks_the_hash(self):
        self.harvest()
        srv, got = self._server()
        url = f"http://127.0.0.1:{srv.server_address[1]}"
        with mock.patch.dict(os.environ, {"VOID_MEMORY_TOKEN": "tok-123"}):
            rc, txt = call("push", ["--out", str(self.out), "--url", url, "--batch", "2"])
        self.assertEqual(rc, 0, txt)
        self.assertGreaterEqual(len(got), 2)
        self.assertTrue(all(g["auth"] == "Bearer tok-123" and g["path"] == "/api/memory" for g in got))
        sent = json.dumps([g["body"] for g in got])
        self.assertNotIn(str(self.root), sent, "a local path leaked into what was sent")
        self.assertIn("<root>", sent)
        for needle in (SECRET_KEY, ENV_SECRET):
            self.assertNotIn(needle, sent)
        alpha = next(v for v in srv.store.values() if v["name"] == "alpha")
        self.assertIn("# alpha", alpha["body"])
        n = len(json.loads((self.out / "manifest.json").read_text())["projects"])
        self.assertIn(f"Void remembers {n} of {n}", txt)

    def test_push_does_not_claim_memory_when_voids_copy_differs(self):
        self.harvest()
        srv, _ = self._server(tamper=True)
        with mock.patch.dict(os.environ, {"VOID_MEMORY_TOKEN": "t"}):
            rc, txt = call("push", ["--out", str(self.out), "--url", f"http://127.0.0.1:{srv.server_address[1]}"])
        self.assertEqual(rc, 1)
        n = len(json.loads((self.out / "manifest.json").read_text())["projects"])
        self.assertIn(f"Void remembers 0 of {n}", txt)
        self.assertIn("differs", txt)

    def test_push_does_not_claim_memory_when_the_record_cannot_be_read_back(self):
        self.harvest()
        srv, _ = self._server(no_get=True)
        with mock.patch.dict(os.environ, {"VOID_MEMORY_TOKEN": "t"}):
            rc, txt = call("push", ["--out", str(self.out), "--url", f"http://127.0.0.1:{srv.server_address[1]}"])
        self.assertEqual(rc, 1)
        n = len(json.loads((self.out / "manifest.json").read_text())["projects"])
        self.assertIn(f"Void remembers 0 of {n}", txt)

    def test_push_splits_requests_by_size(self):
        self.harvest()
        srv, got = self._server()
        with mock.patch.object(ouroboros, "MAX_REQUEST_BYTES", 1), mock.patch.dict(os.environ, {"VOID_MEMORY_TOKEN": "t"}):
            rc, txt = call("push", ["--out", str(self.out), "--url", f"http://127.0.0.1:{srv.server_address[1]}"])
        self.assertEqual(rc, 0, txt)
        n = len(json.loads((self.out / "manifest.json").read_text())["projects"])
        self.assertEqual(len(got), n, "one record per request when every record is over the limit")

    def test_recall_lists_and_prints_a_stored_digest(self):
        self.harvest()
        srv, _ = self._server()
        url = f"http://127.0.0.1:{srv.server_address[1]}"
        with mock.patch.dict(os.environ, {"VOID_MEMORY_TOKEN": "t"}):
            call("push", ["--out", str(self.out), "--url", url])
            rc, txt = call("recall", ["--url", url, "--q", "react"])
            self.assertEqual(rc, 0, txt)
            self.assertIn("alpha", txt)
            self.assertNotIn("beta", txt)
            alpha_id = next(v["id"] for v in srv.store.values() if v["name"] == "alpha")
            rc, txt = call("recall", ["--url", url, "--id", alpha_id])
            self.assertIn("# alpha", txt)
            rc, txt = call("recall", ["--url", url, "--q", "nothing-matches-this"])
            self.assertIn("remembers nothing", txt)

    def test_push_dry_run_sends_nothing_and_needs_no_token(self):
        self.harvest()
        srv, got = self._server()
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("VOID_MEMORY_TOKEN", None)
            rc, txt = call("push", ["--out", str(self.out), "--url", f"http://127.0.0.1:{srv.server_address[1]}", "--dry-run"])
        self.assertEqual(rc, 0, txt)
        self.assertEqual(got, [])
        self.assertIn("dry run", txt)

    def test_push_refuses_clear_http_to_a_real_host_and_a_missing_token(self):
        self.harvest()
        rc, _ = call("push", ["--out", str(self.out), "--url", "http://example.com"])
        self.assertEqual(rc, 2)
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("VOID_MEMORY_TOKEN", None)
            rc, _ = call("push", ["--out", str(self.out), "--url", "https://example.com"])
        self.assertEqual(rc, 2)

    def test_push_refuses_when_the_harvest_no_longer_verifies(self):
        self.harvest()
        next(self.out.glob("alpha-*/digest.md")).write_text("tampered")
        srv, got = self._server()
        with mock.patch.dict(os.environ, {"VOID_MEMORY_TOKEN": "t"}):
            rc, txt = call("push", ["--out", str(self.out), "--url", f"http://127.0.0.1:{srv.server_address[1]}"])
        self.assertEqual(rc, 1)
        self.assertEqual(got, [])
        self.assertIn("nothing was sent", txt)


if __name__ == "__main__":
    unittest.main()
