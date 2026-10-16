#!/usr/bin/env python3
"""Tests for the pure parts of tools/will.py. Never touches the network. Run: python tools/will_test.py"""
import sys, unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import will  # noqa: E402  (importing it must not need the token or call the network)


class Learnable(unittest.TestCase):
    """Owner, 2026-10-16 ("for the love of God clear this list"): 'tell me about zorbleflux', asked 64 times, sat at the top of
    Void's wants. Every source had been read and none knew it (fallback none:wikipedia,wiktionary): there is nothing to learn
    about a thing that does not exist, so such a miss is never a want. A miss a skill half-caught, or one no source could be
    reached for, still is."""

    def test_nothing_anywhere_is_not_a_want(self):
        self.assertFalse(will.learnable({"ask": "tell me about zorbleflux", "fallback": "none:wikipedia,wiktionary", "count": 64}))
        self.assertFalse(will.learnable({"ask": "what is a zorbleflux", "fallback": "none:wikipedia"}))

    def test_a_skill_answer_is_already_handled(self):
        self.assertFalse(will.learnable({"ask": "add milk", "fallback": "skill:list"}))

    def test_real_gaps_stay_wants(self):
        self.assertTrue(will.learnable({"ask": "book me a table for two", "fallback": "answer"}))
        self.assertTrue(will.learnable({"ask": "convert 3 cups to grams", "fallback": "unreached"}))
        self.assertTrue(will.learnable({"ask": "what's the tide in lisbon"}))
        self.assertTrue(will.learnable({"ask": "x", "fallback": None}))


if __name__ == "__main__":
    unittest.main()
