#!/usr/bin/env python3
"""End-to-end smoke of the real command line, for CI on Windows (and anywhere): a temp tree with spaces in its path and a
CRLF repo idle for a year, then `run` and `push --dry-run` against a stub Void. The stub counts requests: a dry run must make none.
Run: python tools/ouroboros_smoke.py"""
import http.server, json, os, subprocess, sys, tempfile, threading
from pathlib import Path

HERE = Path(__file__).resolve().parent
CLI = [sys.executable, str(HERE / "ouroboros.py")]
OLD = "2025-01-01T00:00:00"


def git(repo, *args):
    env = {**os.environ, "GIT_AUTHOR_DATE": OLD, "GIT_COMMITTER_DATE": OLD, "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t.io", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t.io"}
    subprocess.run(["git", "-C", str(repo), *args], check=True, env=env, capture_output=True)


def cli(*args):
    r = subprocess.run([*CLI, *args], capture_output=True, text=True, encoding="utf-8", env={k: v for k, v in os.environ.items() if k != "VOID_MEMORY_TOKEN"})
    print(f"$ ouroboros {' '.join(args)}\n{r.stdout}{r.stderr}")
    return r


def main() -> int:
    hits: list[str] = []

    class Stub(http.server.BaseHTTPRequestHandler):
        def _any(self):
            hits.append(f"{self.command} {self.path}")
            self.send_response(500); self.end_headers()
        do_GET = do_POST = _any

        def log_message(self, *a):
            pass

    srv = http.server.HTTPServer(("127.0.0.1", 0), Stub)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    with tempfile.TemporaryDirectory() as t:
        root, out = Path(t) / "Jane Doe" / "old projects", Path(t) / "harvest out"
        repo = root / "my app (v1)"
        repo.mkdir(parents=True)
        (repo / "README.md").write_bytes(b"# My app\r\n\r\nA small tool.\r\n")
        (repo / "main.py").write_bytes(b"# TODO: finish\r\nprint(1)\r\n")
        git(repo, "init", "-q"); git(repo, "add", "-A"); git(repo, "commit", "-q", "-m", "work", "--no-gpg-sign")
        ok = True
        r = cli("run", "--root", str(root), "--out", str(out), "--days", "30")
        ok &= r.returncode == 0 and (out / "report.html").is_file() and (out / "manifest.json").is_file()
        n = len(json.loads((out / "manifest.json").read_text(encoding="utf-8"))["projects"]) if (out / "manifest.json").is_file() else 0
        ok &= n == 1
        r = cli("push", "--out", str(out), "--url", f"http://127.0.0.1:{srv.server_port}", "--dry-run")
        ok &= r.returncode == 0 and "dry run: would send 1 record(s)" in r.stdout
        ok &= not hits
        print("projects:", n, "| stub requests:", hits or "none")
    srv.shutdown()
    print("smoke: " + ("ok" if ok else "FAILED"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
