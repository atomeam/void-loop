#!/usr/bin/env python3
"""Tests for the pure parts of tools/will.py: the "better" boost (void.better.json's weakest part lifts the wants that work on it).
Never touches the network. Run: python tools/will_test.py"""
import sys, unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import will  # noqa: E402  (importing it must not need the token or call the network)


def cands():
    return [
        {"kind": "frontier", "title": "a", "why": "on the frontier", "weight": 40},
        {"kind": "I asked for this", "title": "b", "why": "I asked", "weight": 15},
        {"kind": "fix myself", "title": "c", "why": "the bench", "weight": 14},
        {"kind": "people asked", "title": "d", "why": "asked twice", "weight": 20},
    ]


class BetterBoost(unittest.TestCase):
    def test_weakest_part_lifts_its_kinds_only(self):
        c = cands()
        rows = [{"at": "2026-10-15T06:51:00Z", "score": 70, "parts": {"self": 90, "asks": 40, "friction": 80, "bench": 98, "probes": 60}},
                {"at": "2026-10-16T06:51:00Z", "score": 72, "parts": {"self": 90, "asks": 85, "friction": 55, "bench": 98, "probes": 60}}]
        self.assertEqual(will.better_boost(c, rows), "friction")  # the newest row counts, not the first
        self.assertEqual([x["weight"] for x in c], [40, 15, 14 + will.BETTER_BOOST, 20])
        self.assertIn("my weakest part today: friction 55", c[2]["why"])
        self.assertEqual(c[0]["why"], "on the frontier")

    def test_ties_and_missing_parts(self):
        c = cands()
        self.assertEqual(will.better_boost(c, [{"parts": {"asks": 50, "probes": 50, "bench": None}}]), "asks")  # a tie goes to the earlier part
        self.assertEqual([x["weight"] for x in c], [40, 15 + will.BETTER_BOOST, 14, 20])

    def test_nothing_to_read_changes_nothing(self):
        c = cands()
        for rows in ([], None, [{"score": 1}], [{"parts": {"nope": 3}}], "junk"):
            self.assertIsNone(will.better_boost(c, rows if rows != "junk" else []))
        self.assertEqual([x["weight"] for x in c], [40, 15, 14, 20])

    def test_why_stays_within_240(self):
        c = [{"kind": "fix myself", "title": "x", "why": "w" * 239, "weight": 1}]
        will.better_boost(c, [{"parts": {"bench": 10}}])
        self.assertEqual(len(c[0]["why"]), 240)


if __name__ == "__main__":
    unittest.main()
