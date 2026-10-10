"""Void's build queue, laptop side.

  python tools/void_queue.py            sync: heartbeat + write domains/void.queue.md (the task runs this every 10 min)
  python tools/void_queue.py claim      mark the oldest queued item 'building' and print it (builders run this first)
  python tools/void_queue.py claim TARGET   claim that job (e.g. step:5) if it is queued and nobody holds it; else print
                                        who holds it (or that there is none) and exit 1
  python tools/void_queue.py done ID live|needs-you [note]   report the result so Void's status line shows it

A claim is atomic on the server (/api/queue moves a job from 'queued' to 'building' in one statement), so of two
builders claiming at once exactly one gets the job, and the job's note then starts "claimed by <you>" (VOID_BUILDER, or
this computer's name). Needs env VOID_MISSES_TOKEN (same value as the site's READ_TOKEN). Tests: tools/void_queue_test.py.
"""
import json, os, sys, socket, urllib.request, urllib.error, datetime, pathlib
API = "https://a-to-mind.com/api/queue"


class Refused(Exception):
    def __init__(self, code, text):
        super().__init__(f"queue answered {code}: {text[:120]}")
        self.code, self.text = code, text


def call(method, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API, data=data, method=method, headers={
        "authorization": "Bearer " + os.environ["VOID_MISSES_TOKEN"], "content-type": "application/json", "user-agent": "a2m-void-queue/1.1"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=30))
    except urllib.error.HTTPError as e:
        raise Refused(e.code, e.read().decode(errors="replace"))


def write(view):
    now = datetime.datetime.now().astimezone().isoformat(timespec="minutes")
    lines = ["# void.queue: builds the owner asked Void for", "", f"Synced {now}. Builders: run `python tools/void_queue.py claim` (or `claim <target>`) first; when done, `python tools/void_queue.py done <id> live` (or `needs-you \"why\"`).", "",
             "| id | target | state | asked | note |", "| --- | --- | --- | --- | --- |"]
    for i in reversed(view["items"]):
        lines.append(f"| {i['id']} | {i['target']} | {i['state']} | {i['at'][:16]} | {i.get('note','').replace('|','/')} |")
    out = pathlib.Path(__file__).resolve().parent.parent / "domains" / "void.queue.md"
    out.write_text("\r\n".join(lines) + "\r\n", encoding="utf-8")


def who():
    return (os.environ.get("VOID_BUILDER") or socket.gethostname() or "a builder")[:60]


def claim_target(target):
    """Claim the job for `target`. Returns (exit code, line to print)."""
    try:
        v = call("PATCH", {"heartbeat": True, "target": target, "state": "building", "from": "queued", "by": who()})
    except Refused as e:
        if e.code == 409:
            held = json.loads(e.text).get("held", {})
            return 1, f"{target} is held: {held.get('state', '?')} since {str(held.get('updated') or held.get('at') or '?')[:16]}" + (f" ({held['note']})" if held.get("note") else "")
        if e.code == 404:
            return 1, f"nothing queued for {target}"
        raise
    write(v)
    return 0, json.dumps(v["claimed"])


def claim_oldest():
    """Claim the oldest queued job; if another builder takes it first, try the next. Returns (exit code, line)."""
    v = call("PATCH", {"heartbeat": True})
    for it in [i for i in v["items"] if i["state"] == "queued"]:  # the view lists the oldest first
        try:
            v = call("PATCH", {"id": it["id"], "state": "building", "from": "queued", "by": who()})
        except Refused as e:
            if e.code in (404, 409):
                continue
            raise
        write(v)
        return 0, json.dumps(v["claimed"])
    write(v)
    return 0, "nothing queued"


def main(argv):
    cmd = argv[1] if len(argv) > 1 else "sync"
    try:
        if cmd == "sync":
            write(call("PATCH", {"heartbeat": True})); print("synced"); return 0
        if cmd == "claim":
            code, line = claim_target(argv[2]) if len(argv) > 2 else claim_oldest()
            print(line); return code
        if cmd == "done":
            note = " ".join(argv[4:]) if len(argv) > 4 else ""
            write(call("PATCH", {"id": argv[2], "state": argv[3], "note": note, "heartbeat": True})); print("reported"); return 0
    except Refused as e:
        print(e, file=sys.stderr); return 2
    print(__doc__); return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
