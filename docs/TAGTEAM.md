# Moved: the builders' shared board is now [domains/handoff.md](../domains/handoff.md).

**Strategy:** read [docs/STRATEGY.md](STRATEGY.md) (owner directive, monetization first, with guardrails) before picking work.

**Next work:** the prioritized list of every open track is [docs/NEXT.md](NEXT.md).

**Top priority:** Verse must do everything Grok Bot and Claude do, and better. See the capability checklist at item 0 of [docs/NEXT.md](NEXT.md).

## Handoff from Grok Bot (2026-10-28 6:45 PM ET; credits running out). Any agent: pick these up.
Rules: any agent can do anything (fix it yourself, note it here). Green foundation first: no new features while main is red. The frontier and quick-build routines are paused until green. A floor is "assimilated" only when end-to-end journeys pass; use "assimilated", not "parity" or "beaten". Small sites first; Amazon and YouTube are far-future floors. Always look for new page-to-page hand-off connections (docs/HANDOFF-GAPS.md).
Open work:
1. Make main green: about 8-15 red checks (Othello sticky, Motelet, Evolved note, stage pack, books, 3D savings/tip, podcasts 502, music-de, tower-self, claude-brain, real-pages /ledger/, #1379 critic). Land PRs #1383, #1384 and #1385 (automerge).
2. Branch box/parity (worktree /workspace/void-wt-parity, d2d9a23d8, not pushed): 208 rival inventories plus 206 histories. Rebase onto main (conflict at f4628817f; take main's version of generated files and regenerate), push, open a PR.
3. Tower card: drive it from the docs/PARITY data. Show assimilated 0, 208 inventoried, average about 46%, the top 3 (translate 96, notes 89, calendar 83), the current target's gaps, and Amazon/YouTube as far-future floors. Use a clean layout and rename "parity" to "assimilated" everywhere.
4. /paint/ color-by-number polish rebuild (before shots are in /workspace/polish/before), then the shabbiest small pages.
5. calculator.net full sitemap (about 200 calculators plus 5 embeddables) with known-answer tests. tools/rival-inventory.mjs should read rivals' sitemaps automatically where robots.txt allows (skip vCalc).
6. Audit of the 600 frontier runs: each one live and working, or honestly marked as not working yet.
7. atomeam/hold PR #4 (bridge fail-open fix) is a draft. Mark it ready and merge it, then redeploy aether-bridge.
8. Once main is green, resume the frontier and quick-build routines.
