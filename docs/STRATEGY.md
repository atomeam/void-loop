# Verse strategy (owner directive, 2026-10-21, paraphrased)

The owner's direction: Verse should be the best at what it does in every domain it touches, and pay for itself first.

## Phase I: benchmark and easy wins
- For each niche Verse serves (the skill families in `void-live-deploy/skills/families.json`), name the top sites people use for it and what they do better.
- Ship the easy wins first: gaps that are small to close and visible to a visitor.

## Phase II: faster, better, and paid
- Match the core features of the leaders, then beat them on speed and simplicity (one input, nothing to sign up for).
- Pick a revenue model per niche (membership, paid fixes, tips, sponsors, store items) and wire it to what visitors already ask for.
- Look for neglected segments the leaders underserve.

## Phase III: modular and continuous
- Each skill is a self-contained module that evolves on its own. Nothing is ever removed or deferred: a feature only evolves toward more revenue or value.
- Tightening that merges duplicate skills combines them into one evolved skill, and every phrase that worked before keeps working.
- Every change states what revenue or reach it serves. The want picker weighs this (`tools/revenue-tags.json`, `reach()` in `tools/lacks.mjs`). Revenue weight only boosts a want (reach is never below 1); it never demotes or drops one.
- The loop keeps iterating (`docs/LOOP-GAPS.md`): pick by expected value, verify live, revert on failure.

## Mandates
Monetization first. Velocity. Every domain.

## Guardrails (these always win)
- No dark patterns: no fake scarcity, hidden prices, forced sign-ups or tricky cancels. Visitors can't change prices; payments never unlock on a buyer's say-so.
- Count topics, never people. No visitor's words are copied anywhere public.
- No trademarked names for Verse's own things.
- No unverified claims: "best" or "faster" only next to a check that shows it. Dollar figures stay behind owner APIs.
