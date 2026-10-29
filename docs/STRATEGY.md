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

## The lap loop: everything, around and around (owner, 2026-10-22)

Nothing is ever finished; everything upgrades for ever. No item is marked done anywhere: each keeps a rolling next upgrade.

- **Parity inventory, a required step of every lap (owner, 2026-10-28: "we actually want to outdo them all in every way"):** for every tower site, `node tools/site-history.mjs --missing` (a cited timeline in `docs/HISTORY/<slug>.md`: every fact with its source link, unknowns marked unknown), `node tools/parity.mjs --scan <slug>` (the original's live menus and buttons), fix or add its rows in `tools/parity-catalog.mjs`, then `node tools/parity.mjs --write`. `docs/PARITY/<slug>.md` lists every feature the original offers as have, partial, missing or unreviewed, with evidence on both sides; `docs/PARITY/README.md` ranks the missing ones by the visitors they reach, and the lap builds from the top of that list. An obituary (/obituaries/) says "beaten" only when its parity page has 0 missing, partial or unreviewed rows and the tower gate's 9 of 9 has evidence (`lib/obituary.js`, `tools/parity.test.mjs`); until then it says "in progress" with its match % and what is still missing, and keeps its homage text.

- **What a lap covers:** every item in `void-live-deploy/lap.items.json` (written by `node tools/lap-items.mjs --write`): each skill, the
  surfaces (games, cards, the book, the store, films, the podcast, Mind Field, Tilt Arena, the loop itself), every doc, every archived repo in
  `archive/repos/` (its reusable parts), every check and tool, every business plan in `domains/` and the Forethinkers research. Plans and
  research get one concrete improvement each per lap, never an external action. On 2026-10-22 that is 675 items.
- **Order:** a lap goes around every item one by one (fix gaps, add basics, apply every discovered rule), then adds 100 new features (the
  will's own wants: studies, Grok drafts, frontier ideas), then the next lap starts over the whole, now bigger, set. Items can be weighted
  within a lap (rarely used, earning, stale: `staleness()` is one point per week since the last upgrade), but every item is touched each lap.
  An item added mid-lap joins this lap's tail.
- **Measurably better:** each upgrade records the item's facts before (counts only, such as lines, tests, examples, sections, reused parts).
  The next lap compares them (`compare()`, `lapProgress()`): an item is better only when a fact rose and none fell.
- **Resume:** the position is kept in `void_kv` row `lap` by `functions/api/will.js`, and moves on only when a job is queued, so an
  interruption resumes at the same item.
- **Public tracker (counts only):** `GET /api/will?lap=1`, and the will card shows the line, e.g. "Lap 2: upgraded 140 of 316 items, 37 of
  100 new this lap". Code: `void-live-deploy/lib/lap.js`, tested by `tools/lap.test.mjs` in `tools/checks.mjs`.
