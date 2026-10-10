#!/usr/bin/env python3
"""Tests for tools/void_queue.py against a fake queue with the server's claim rules (tools/queue.test.mjs tests the real
route). Never touches the network or domains/void.queue.md. Run: python tools/void_queue_test.py"""
import io, json, os, sys, unittest, unittest.mock, urllib.error
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import void_queue  # noqa: E402  (importing it must not need the token or call the network)


class FakeQueue:
    """The /api/queue PATCH rules: a claim moves a job from `from` only if it is still there, else 409 with the holder."""
    def __init__(self, jobs):
        self.jobs = [dict(j) for j in jobs]  # oldest first, as the view lists them

    def view(self):
        return {"items": [dict(j) for j in self.jobs], "heartbeat": "now"}

    def __call__(self, method, body=None):
        b = body or {}
        if b.get("from") and (b.get("target") or b.get("id")):
            pick = [j for j in self.jobs if (j["target"] == b["target"] if b.get("target") else j["id"] == b["id"]) and j["state"] == b["from"]]
            if not pick:
                held = [j for j in self.jobs if (j["target"] == b.get("target") if b.get("target") else j["id"] == b.get("id"))]
                if held:
                    raise void_queue.Refused(409, json.dumps({"held": held[-1]}))
                raise void_queue.Refused(404, "not found")
            j = pick[0]
            j["state"] = b["state"]
            if b.get("by"):
                j["note"] = "claimed by " + b["by"] + (" · " + j["note"] if j.get("note") else "")
            return {"claimed": dict(j), **self.view()}
        if b.get("id"):
            j = next((j for j in self.jobs if j["id"] == b["id"]), None)
            if not j:
                raise void_queue.Refused(404, "not found")
            j["state"] = b.get("state") or j["state"]
        return self.view()


def job(id, target, state="queued", note=""):
    return {"id": id, "target": target, "state": state, "note": note, "at": "2026-10-10T00:00", "ask": "build " + target}


class Claim(unittest.TestCase):
    def run_main(self, q, *args, builder="laptop-a"):
        out = io.StringIO()
        with unittest.mock.patch.object(void_queue, "call", q), unittest.mock.patch.object(void_queue, "write", lambda v: None), \
             unittest.mock.patch.dict(os.environ, {"VOID_BUILDER": builder}), unittest.mock.patch("sys.stdout", out):
            code = void_queue.main(["void_queue.py", *args])
        return code, out.getvalue().strip()

    def test_claim_target_takes_the_job_and_names_the_claimer(self):
        q = FakeQueue([job("j1", "next"), job("j2", "step:5", note="asked by the owner")])
        code, line = self.run_main(q, "claim", "step:5")
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(line)["id"], "j2")
        self.assertEqual(q.jobs[1]["state"], "building")
        self.assertEqual(q.jobs[1]["note"], "claimed by laptop-a · asked by the owner")
        self.assertEqual(q.jobs[0]["state"], "queued", "only the named job")

    def test_claim_target_held_prints_who_holds_it_and_exits_1(self):
        q = FakeQueue([job("j2", "step:5")])
        self.run_main(q, "claim", "step:5", builder="laptop-a")
        code, line = self.run_main(q, "claim", "step:5", builder="laptop-b")
        self.assertEqual(code, 1)
        self.assertIn("step:5 is held: building", line)
        self.assertIn("claimed by laptop-a", line)

    def test_claim_target_with_no_job_exits_1(self):
        code, line = self.run_main(FakeQueue([job("j1", "next")]), "claim", "step:9")
        self.assertEqual((code, line), (1, "nothing queued for step:9"))

    def test_plain_claim_takes_the_oldest_and_skips_one_another_builder_just_took(self):
        q = FakeQueue([job("j1", "a"), job("j2", "b"), job("j3", "c")])
        real = q.__call__
        def racing(method, body=None):  # another builder takes j1 between our read and our claim
            if body and body.get("id") == "j1":
                q.jobs[0]["state"] = "building"
            return real(method, body)
        code, line = self.run_main(racing, "claim")
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(line)["id"], "j2")
        self.assertEqual([j["state"] for j in q.jobs], ["building", "building", "queued"])

    def test_plain_claim_with_nothing_queued(self):
        self.assertEqual(self.run_main(FakeQueue([job("j1", "a", "live")]), "claim"), (0, "nothing queued"))

    def test_call_turns_an_http_refusal_into_Refused_with_its_body(self):
        err = urllib.error.HTTPError("https://a-to-mind.com/api/queue", 409, "Conflict", {}, io.BytesIO(b'{"held":{"state":"building"}}'))
        with unittest.mock.patch.dict(os.environ, {"VOID_MISSES_TOKEN": "t"}), unittest.mock.patch("urllib.request.urlopen", side_effect=err):
            with self.assertRaises(void_queue.Refused) as c:
                void_queue.call("PATCH", {"target": "x", "from": "queued"})
        self.assertEqual(c.exception.code, 409)
        self.assertEqual(json.loads(c.exception.text)["held"]["state"], "building")


if __name__ == "__main__":
    unittest.main()
