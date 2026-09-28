"""Void's build queue, laptop side.

  python tools/void_queue.py            sync: heartbeat + write domains/void.queue.md (the task runs this every 10 min)
  python tools/void_queue.py claim      mark the oldest queued item 'building' and print it (builders run this first)
  python tools/void_queue.py done ID live|needs-you [note]   report the result so Void's status line shows it

Needs env VOID_MISSES_TOKEN (same value as the site's READ_TOKEN).
"""
import json, os, sys, urllib.request, urllib.error, datetime, pathlib
API = "https://a-to-mind.com/api/queue"
TOK = os.environ["VOID_MISSES_TOKEN"]

def call(method, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API, data=data, method=method, headers={
        "authorization": "Bearer " + TOK, "content-type": "application/json", "user-agent": "a2m-void-queue/1.0"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=30))
    except urllib.error.HTTPError as e:
        sys.exit(f"queue answered {e.code}: {e.read().decode(errors='replace')[:120]}")

def write(view):
    now = datetime.datetime.now().astimezone().isoformat(timespec="minutes")
    lines = ["# void.queue: builds the owner asked Void for", "", f"Synced {now}. Builders: run `python tools/void_queue.py claim` first; when done, `python tools/void_queue.py done <id> live` (or `needs-you \"why\"`).", "",
             "| id | target | state | asked | note |", "| --- | --- | --- | --- | --- |"]
    for i in reversed(view["items"]):
        lines.append(f"| {i['id']} | {i['target']} | {i['state']} | {i['at'][:16]} | {i.get('note','').replace('|','/')} |")
    out = pathlib.Path(__file__).resolve().parent.parent / "domains" / "void.queue.md"
    out.write_text("\r\n".join(lines) + "\r\n", encoding="utf-8")

cmd = sys.argv[1] if len(sys.argv) > 1 else "sync"
if cmd == "sync":
    write(call("PATCH", {"heartbeat": True})); print("synced")
elif cmd == "claim":
    v = call("PATCH", {"heartbeat": True})
    q = [i for i in v["items"] if i["state"] == "queued"]
    if not q: print("nothing queued"); write(v); sys.exit(0)
    it = q[0]
    write(call("PATCH", {"id": it["id"], "state": "building"}))
    print(json.dumps(it))
elif cmd == "done":
    note = " ".join(sys.argv[4:]) if len(sys.argv) > 4 else ""
    write(call("PATCH", {"id": sys.argv[2], "state": sys.argv[3], "note": note, "heartbeat": True})); print("reported")
