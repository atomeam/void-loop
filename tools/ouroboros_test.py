#!/usr/bin/env python3
"""Tests for tools/ouroboros.py on a fake machine. Run: python tools/ouroboros_test.py"""
import contextlib, hashlib, http.server, io, json, os, subprocess, sys, tempfile, threading, time, unittest
from pathlib import Path, PureWindowsPath
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

    def _absorb(self):
        """harvest, then push to a stand-in Void that verifies, so projects count as absorbed"""
        self.harvest()
        srv, _ = self._server()
        with mock.patch.dict(os.environ, {"VOID_MEMORY_TOKEN": "t"}):
            rc, txt = call("push", ["--out", str(self.out), "--url", f"http://127.0.0.1:{srv.server_address[1]}"])
        self.assertEqual(rc, 0, txt)
        return srv

    def _reclaim(self, answer="DELETE"):
        with mock.patch("builtins.input", return_value=answer):
            return call("reclaim", ["--root", str(self.root), "--out", str(self.out), "--apply"])

    def test_nothing_is_deleted_before_void_has_absorbed_it(self):
        before = snapshot(self.root)
        rc, txt = self._reclaim()
        self.assertEqual(before, snapshot(self.root), "reclaim deleted something no one had absorbed")
        self.assertIn("NOT touched", txt)
        self.assertIn("0 folder(s)", txt)
        self.harvest()  # harvested but not yet pushed is still not absorbed
        rc, txt = self._reclaim()
        self.assertEqual(before, snapshot(self.root))

    def test_a_push_that_void_cannot_verify_absorbs_nothing(self):
        self.harvest()
        srv, _ = self._server(tamper=True)
        with mock.patch.dict(os.environ, {"VOID_MEMORY_TOKEN": "t"}):
            call("push", ["--out", str(self.out), "--url", f"http://127.0.0.1:{srv.server_address[1]}"])
        before = snapshot(self.root)
        self._reclaim()
        self.assertEqual(before, snapshot(self.root))
        self.assertFalse(json.loads((self.out / "absorbed.json").read_text())["absorbed"])

    def test_reclaim_after_absorption_removes_only_regenerable_folders_of_absorbed_projects(self):
        self._absorb()
        rc, txt = self._reclaim()
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

    def test_a_project_with_new_work_since_absorption_is_protected_again(self):
        self._absorb()
        a = self.root / "dev" / "alpha"
        write(a / "later.py", "new work Void has not seen"); commit_all(a)
        rc, txt = self._reclaim()
        self.assertTrue((a / "node_modules").exists(), "alpha changed after it was absorbed, so nothing of it may be deleted")
        self.assertFalse((self.root / "dev" / "beta" / ".venv").exists(), "beta is unchanged and absorbed, so its rebuildable folder goes")

    def test_plan_says_what_is_waiting_for_absorption(self):
        self.harvest()
        rc, txt = call("plan", ["--root", str(self.root), "--out", str(self.out)])
        self.assertIn("Nothing is freed before that", txt)

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

    def _server(self, status=200, tamper=False, no_get=False, refusal=None):
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
                if refusal is not None:  # a refusal as the real route sends it: plain text, not JSON
                    h.send_response(status); h.send_header("content-type", "text/plain"); h.end_headers(); h.wfile.write(refusal.encode()); return
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

    def test_push_as_a_member_sends_the_void_key_as_the_bearer_and_asks_for_it_at_a_terminal_without_echo(self):
        self.harvest()
        srv, got = self._server()
        url = f"http://127.0.0.1:{srv.server_address[1]}"
        key = "vr1." + "A" * 43
        with mock.patch.dict(os.environ, {"VOID_MEMORY_TOKEN": key}):
            rc, txt = call("push", ["--out", str(self.out), "--url", url])
        self.assertEqual(rc, 0, txt)
        self.assertTrue(got and all(g["auth"] == "Bearer " + key for g in got))
        # no variable, at a terminal: asked for with getpass (not echoed, not on the command line)
        srv2, got2 = self._server()
        url2 = f"http://127.0.0.1:{srv2.server_address[1]}"
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("VOID_MEMORY_TOKEN", None)
            with mock.patch.object(sys.stdin, "isatty", return_value=True), mock.patch("getpass.getpass", return_value="  " + key + "  ") as gp:
                rc, txt = call("push", ["--out", str(self.out), "--url", url2])
        self.assertEqual(rc, 0, txt)
        self.assertEqual(gp.call_count, 1)
        self.assertTrue(got2 and all(g["auth"] == "Bearer " + key for g in got2))

    def test_push_with_no_key_and_no_terminal_says_where_to_get_one(self):
        self.harvest()
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("VOID_MEMORY_TOKEN", None)
            with mock.patch.object(sys.stdin, "isatty", return_value=False):
                rc, txt = call("push", ["--out", str(self.out), "--url", "https://example.com"])
        self.assertEqual(rc, 2)
        self.assertIn("vr1.", txt); self.assertIn("paid Void", txt); self.assertIn("a-to-mind.com", txt)

    def test_push_refused_for_a_free_account_or_an_unknown_key_says_so_in_plain_words_and_claims_nothing(self):
        self.harvest()
        srv, got = self._server(status=403)
        url = f"http://127.0.0.1:{srv.server_address[1]}"
        with mock.patch.dict(os.environ, {"VOID_MEMORY_TOKEN": "vr1." + "B" * 43}):
            rc, txt = call("push", ["--out", str(self.out), "--url", url])
        self.assertEqual(rc, 1)
        self.assertIn("Void answered 403", txt); self.assertIn("owner and paid members", txt)
        # the server's own sentence is read from the refusal (urlopen raises before anything consumes the body) and shown
        srv2, _ = self._server(status=403, refusal="Void memory is for the owner and paid members: Void does not know this key. Make one at https://a-to-mind.com/code-review/#pro (signed in, on paid Void).")
        with mock.patch.dict(os.environ, {"VOID_MEMORY_TOKEN": "vr1." + "C" * 43}):
            rc, txt2 = call("push", ["--out", str(self.out), "--url", f"http://127.0.0.1:{srv2.server_address[1]}"])
        self.assertEqual(rc, 1); self.assertIn("Void does not know this key", txt2); self.assertIn("https://a-to-mind.com/code-review/#pro", txt)
        self.assertNotIn("Void remembers", txt)
        self.assertFalse((self.out / "absorbed.json").exists(), "a refused push never writes a receipt")
        self.assertIn("paid members", ouroboros.refused_text(403, ""))
        self.assertIn("500", ouroboros.refused_text(413))

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

    # ---------------- --drop: delete a project folder only after Void has verifiably absorbed it ----------------
    def _backed_up(self, name="omega"):
        """a project that is pushed, clean, and has only rebuildable ignored folders: the one kind --drop may remove without an override"""
        p = self.root / "dev" / name
        write(p / "main.py", "print('omega')\n"); write(p / ".gitignore", "node_modules\n"); write(p / "node_modules" / "m" / "i.js", "m" * 500)
        run_git(p, "init", "-q"); commit_all(p)
        run_git(p, "remote", "add", "origin", str(self.remote)); run_git(p, "push", "-q", "origin", "HEAD:refs/heads/omega")
        subprocess.run(["git", "-C", str(p), "fetch", "-q", "origin"], capture_output=True)
        subprocess.run(["git", "-C", str(p), "branch", "-u", "origin/omega"], capture_output=True)
        return p

    def _drop(self, *extra, answers=None, **server):
        srv, got = self._server(**server)
        url = f"http://127.0.0.1:{srv.server_address[1]}"
        ask = (lambda prompt="": (answers or (lambda q: "DROP"))(prompt))
        with mock.patch.dict(os.environ, {"VOID_MEMORY_TOKEN": "t"}), mock.patch("builtins.input", side_effect=ask):
            rc, txt = call("push", ["--out", str(self.out), "--url", url, "--drop", *extra])
        return rc, txt, srv

    def test_drop_removes_an_absorbed_backed_up_project_and_leaves_a_tombstone(self):
        omega = self._backed_up(); self.harvest()
        before = snapshot(self.root, skip=("omega",))
        rc, txt, srv = self._drop("--yes")
        self.assertFalse(omega.exists(), txt)
        tomb = json.loads((omega.parent / "omega.void-tombstone.json").read_text())
        self.assertEqual((tomb["status"], tomb["project"]), ("absorbed", "omega"))
        for k in ("timestamp", "record_id", "digest_sha256", "memory_endpoint", "head"):
            self.assertTrue(tomb[k], k)
        self.assertEqual(tomb["digest_sha256"], hashlib.sha256(srv.store[tomb["record_id"]]["body"].encode()).hexdigest(), "the tombstone points at what Void actually holds")
        self.assertIn("Dropped omega", txt); self.assertIn("reclaimed", txt)
        after = snapshot(self.root)
        self.assertEqual(before, {k: v for k, v in after.items() if "omega" not in k and "void-tombstone" not in k}, "nothing but omega may change")
        self.assertEqual(rc, 1, "other projects were kept, so the run is not a clean 'all dropped'")

    def test_drop_refuses_projects_that_would_lose_work(self):
        self._backed_up(); self.harvest()
        before = snapshot(self.root, skip=("omega",))
        rc, txt, _ = self._drop("--yes")
        for who, reason in (("beta", "no remote repository"), ("gamma", "uncommitted-work"), ("eta", "unpushed-commits"), ("alpha", ".env")):
            self.assertRegex(txt, rf"KEPT {who}: .*{reason}")
        after = {k: v for k, v in snapshot(self.root).items() if "omega" not in k}
        self.assertEqual(before, after, "a refused project must be untouched")

    def test_drop_needs_the_typed_confirmation(self):
        omega = self._backed_up(); self.harvest()
        rc, txt, _ = self._drop(answers=lambda q: "no")
        self.assertTrue(omega.exists()); self.assertIn("Not confirmed", txt)
        self.assertFalse(list(omega.parent.glob("*.void-tombstone.json")))

    def test_drop_halts_when_void_does_not_answer_exactly_200(self):
        omega = self._backed_up(); self.harvest()
        rc, txt, _ = self._drop("--yes", status=202)
        self.assertTrue(omega.exists(), "a 202 is not a 200: nothing may be deleted")
        self.assertIn("DROP ABORTED", txt); self.assertIn("exactly 200", txt)

    def test_drop_halts_when_voids_stored_copy_differs(self):
        omega = self._backed_up(); self.harvest()
        rc, txt, _ = self._drop("--yes", tamper=True)
        self.assertTrue(omega.exists()); self.assertIn("KEPT omega", txt); self.assertIn("unverified", txt)

    def test_drop_halts_when_void_cannot_be_read_back(self):
        omega = self._backed_up(); self.harvest()
        rc, txt, _ = self._drop("--yes", no_get=True)
        self.assertTrue(omega.exists())

    def test_drop_halts_on_a_failed_request(self):
        omega = self._backed_up(); self.harvest()
        with mock.patch.dict(os.environ, {"VOID_MEMORY_TOKEN": "t"}):
            rc, txt = call("push", ["--out", str(self.out), "--url", "http://127.0.0.1:9", "--drop", "--yes"])
        self.assertEqual(rc, 1); self.assertTrue(omega.exists()); self.assertIn("could not reach Void", txt)

    def test_drop_refuses_without_a_receipt_or_with_a_stale_one(self):
        omega = self._backed_up(); self.harvest()
        e = next(p for p in json.loads((self.out / "manifest.json").read_text())["projects"] if p["path"].endswith("omega"))
        root = self.root.resolve()
        self.assertIn("no verified receipt", " ".join(ouroboros.drop_blockers(e, None, root, self.out, False)))
        self.assertIn("new commits", " ".join(ouroboros.drop_blockers(e, {"head": "0" * 40}, root, self.out, False)))
        self.assertEqual(ouroboros.drop_blockers(e, {"head": e["head"]}, root, self.out, False), [])

    def test_drop_refuses_a_project_changed_after_it_was_absorbed(self):
        omega = self._backed_up(); self.harvest()
        self._drop(answers=lambda q: "no")  # absorbs everything, deletes nothing
        write(omega / "later.py", "new work"); commit_all(omega)
        e = next(p for p in json.loads((self.out / "manifest.json").read_text())["projects"] if p["path"].endswith("omega"))
        rec = ouroboros.load_absorbed(self.out)[str(omega.resolve())]
        self.assertIn("new commits", " ".join(ouroboros.drop_blockers(e, rec, self.root.resolve(), self.out, False)))

    def test_drop_never_follows_links_or_leaves_the_harvested_folder(self):
        e = {"path": str(self.root / "dev" / "linked" / "node_modules"), "head": "x"}
        self.assertTrue(ouroboros.drop_blockers(e, {"head": "x"}, self.root.resolve(), self.out, True))
        e2 = {"path": str(self.outside), "head": "x"}
        self.assertIn("not inside", " ".join(ouroboros.drop_blockers(e2, {"head": "x"}, self.root.resolve(), self.out, True)))

    def test_force_drop_unbacked_still_needs_each_name_typed(self):
        self._backed_up(); self.harvest()
        beta = self.root / "dev" / "beta"
        def answers(q):
            if "Type DROP" in q: return "DROP"
            return "beta" if "'beta'" in q else "nope"
        rc, txt, _ = self._drop("--force-drop-unbacked", answers=answers)
        self.assertFalse(beta.exists(), txt)
        self.assertTrue((beta.parent / "beta.void-tombstone.json").exists())
        for kept in ("alpha", "gamma", "eta"):
            self.assertTrue((self.root / "dev" / kept).exists(), kept + " was not confirmed by name")

    def test_force_flag_alone_is_refused(self):
        self.harvest()
        rc, _ = call("push", ["--out", str(self.out), "--url", "https://example.com", "--force-drop-unbacked"])
        self.assertEqual(rc, 2)

    def test_drop_dry_run_shows_the_plan_and_deletes_nothing(self):
        omega = self._backed_up(); self.harvest()
        before = snapshot(self.root)
        rc, txt = call("push", ["--out", str(self.out), "--url", "https://example.com", "--drop", "--dry-run"])
        self.assertEqual(rc, 0, txt)
        self.assertIn("would drop", txt); self.assertIn("would KEEP beta", txt)
        self.assertEqual(before, snapshot(self.root))


class WindowsPaths(unittest.TestCase):
    """What a Windows machine hands Ouroboros: C:\\ roots, backslashes, drive letters, CRLF files, spaces, a file another program holds.
    The path maths runs on PureWindowsPath so it is checked on every platform; the file work runs on the real disk
    (on windows-latest in CI, .github/workflows/ouroboros.yml, it is the real thing)."""

    def test_secret_files_are_never_read_on_a_backslash_path(self):
        for p in (r"C:\Users\you\proj\.env", r"D:\Work\app\.env.local", r"C:\Users\you\.ssh\id_rsa", r"E:\x\cert.PEM",
                  r"C:\Users\Jane Doe\proj\secrets.txt", r"C:\Users\you\.npmrc", "C:/Users/you/proj/.env"):
            self.assertTrue(ouroboros.NEVER_READ.search(p), p)
        for p in (r"C:\Users\you\environment.md", r"C:\Users\you\proj\keyboard.txt", r"C:\Users\you\proj\src\main.py"):
            self.assertFalse(ouroboros.NEVER_READ.search(p), p)

    def test_slug_of_a_windows_folder(self):
        a = ouroboros.slug_of(PureWindowsPath(r"C:\Users\Jane Doe\dev\My Project (old)"))
        self.assertRegex(a, r"^My-Project-old-[0-9a-f]{8}$")
        self.assertNotIn("\\", a)
        self.assertNotIn(" ", a)
        # same folder name on another drive is another project
        self.assertNotEqual(a, ouroboros.slug_of(PureWindowsPath(r"D:\Users\Jane Doe\dev\My Project (old)")))

    def test_the_scanned_root_never_leaves_in_either_slash_style(self):
        for root in (r"C:\Users\Jane Doe\dev", "C:/Users/Jane Doe/dev"):
            with tempfile.TemporaryDirectory() as t:
                out = Path(t)
                (out / "d.md").write_text("see C:\\Users\\Jane Doe\\dev\\alpha and C:/Users/Jane Doe/dev/beta\n", encoding="utf-8")
                got = ouroboros.digest_for_void(out, {"digest": "d.md"}, root)
                self.assertEqual(got, "see <root>\\alpha and <root>/beta\n", root)
                self.assertNotIn("Jane", got)

    def test_redact_leaves_a_windows_path_alone(self):
        for p in (r"C:\Users\Jane Doe\dev\app", r"C:\repos\x.git", r"\\server\share\old projects"):
            self.assertEqual(ouroboros.redact(p), p)

    def _repo(self, base: Path, name: str, files: dict[str, bytes]) -> Path:
        r = base / name
        r.mkdir(parents=True)
        for rel, data in files.items():
            (r / rel).parent.mkdir(parents=True, exist_ok=True)
            (r / rel).write_bytes(data)
        run_git(r, "init", "-q"); commit_all(r)
        return r

    def test_crlf_files_digest_without_carriage_returns(self):
        with tempfile.TemporaryDirectory() as t:
            r = self._repo(Path(t), "crlf", {
                "README.md": b"# Crlf\r\n\r\nA windows-edited tool.\r\n",
                "x.py": b"import os\r\n# TODO: second line\r\nprint(1)\r\n",
                "requirements.txt": b"requests==2\r\nflask>=1\r\n",
                "package.json": b'{\r\n "description": "crlf pkg",\r\n "dependencies": {"react": "1"}\r\n}\r\n',
            })
            d = ouroboros.digest_repo(r)
            self.assertEqual(d["todos"], ["x.py:2: # TODO: second line"])
            self.assertEqual(d["description"], "crlf pkg")
            self.assertIn("react", d["tech"]); self.assertIn("requests", d["tech"]); self.assertIn("flask", d["tech"])
            self.assertNotIn("\r", json.dumps(d))
            self.assertEqual(ouroboros.read_text(r / "x.py", 100).count("\r\n"), 3)  # the bytes are read as they are

    def test_a_path_with_spaces_goes_through_run_and_a_dry_push(self):
        with tempfile.TemporaryDirectory() as t:
            root, out = Path(t) / "Jane Doe" / "old projects", Path(t) / "harvest out"
            self._repo(root, "my app (v1)", {"README.md": b"# My app\r\n\r\nHello there.\r\n", "a.py": b"print(1)\r\n"})
            buf, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(err):
                rc = ouroboros.main(["run", "--root", str(root), "--out", str(out), "--days", "30"])
            self.assertEqual(rc, 0, buf.getvalue() + err.getvalue())
            self.assertTrue((out / "report.html").is_file())
            manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(len(manifest["projects"]), 1)
            self.assertIn("my app (v1)", manifest["projects"][0]["path"])
            buf = io.StringIO()
            with contextlib.redirect_stdout(buf), mock.patch.dict(os.environ, {}, clear=False):
                rc = ouroboros.main(["push", "--out", str(out), "--url", "http://localhost:9", "--dry-run"])
            self.assertEqual(rc, 0, buf.getvalue())
            self.assertIn("dry run: would send 1 record(s)", buf.getvalue())
            body = ouroboros.digest_for_void(out, json.loads((out / "memory.jsonl").read_text(encoding="utf-8").splitlines()[0]), manifest["root"])
            self.assertNotIn(str(root), body)
            self.assertNotIn("Jane Doe", body)

    def test_a_file_another_program_holds_is_reported_not_fatal(self):
        with tempfile.TemporaryDirectory() as t:
            folder = Path(t) / "locked app" / "node_modules"
            write(folder / "a" / "held.dll", "x"); write(folder / "a" / "free.js", "y")
            real_unlink = os.unlink

            def unlink(path, *a, **k):  # what Windows says for a file a running program has open: WinError 32 (PermissionError)
                if os.path.basename(str(path)) == "held.dll":
                    raise PermissionError(13, "The process cannot access the file because it is being used by another process", str(path))
                return real_unlink(path, *a, **k)

            with mock.patch("os.unlink", unlink), mock.patch("os.remove", unlink):
                left = ouroboros._rmtree(folder)
            self.assertIn("held.dll", [os.path.basename(x) for x in left])
            self.assertTrue((folder / "a" / "held.dll").exists(), "the held file is kept, not lost")
            self.assertFalse((folder / "a" / "free.js").exists(), "everything else is still removed")

    @unittest.skipUnless(os.name == "nt", "a held file is only refused like this on Windows; the simulation above covers the other platforms")
    def test_a_file_held_open_on_windows_is_kept_and_reported(self):
        """The real sharing violation: a file a program has open (no FILE_SHARE_DELETE) cannot be deleted. Nothing else is simulated."""
        with tempfile.TemporaryDirectory() as t:
            folder = Path(t) / "held app" / "node_modules"
            write(folder / "a" / "held.dll", "x"); write(folder / "a" / "free.js", "y")
            holder = open(folder / "a" / "held.dll", "rb")
            try:
                left = ouroboros._rmtree(folder)
                self.assertIn("held.dll", [os.path.basename(x) for x in left])
                self.assertTrue((folder / "a" / "held.dll").exists(), "the held file is kept, not lost")
                self.assertFalse((folder / "a" / "free.js").exists(), "everything else is still removed")
            finally:
                holder.close()
            self.assertEqual(ouroboros._rmtree(folder), [], "once the program lets go the folder goes")
            self.assertFalse(folder.exists())

    def test_a_file_that_cannot_be_opened_reads_as_empty(self):
        with tempfile.TemporaryDirectory() as t:
            p = Path(t) / "held file.md"
            p.write_text("# hello\n")
            with mock.patch("builtins.open", side_effect=PermissionError(13, "being used by another process")):
                self.assertEqual(ouroboros.read_text(p, 100), "")

    def test_windows_drive_and_case_rules_for_the_out_inside_root_guard(self):
        # cmd_harvest refuses an --out inside --root with `root in out.parents`; on Windows that must hold across case, not across drives
        root = PureWindowsPath(r"C:\Users\Jane Doe")
        self.assertIn(root, PureWindowsPath(r"c:\users\jane doe\harvest").parents)
        self.assertNotIn(root, PureWindowsPath(r"D:\Users\Jane Doe\harvest").parents)


if __name__ == "__main__":
    unittest.main()
