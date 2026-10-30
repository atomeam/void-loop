# Moved: the builders' shared board is now [domains/handoff.md](../domains/handoff.md).

Owner rule, 2026-10-28: any agent can edit any file, Claude's included; note such edits on the board ([domains/handoff.md](../domains/handoff.md)).

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

## Grok Bot green-main-4 (2026-10-28 ~7:30 PM ET): edits made under "any agent can do anything"
- tools/tower-self.mjs (was reserved for Claude): `PARTIAL` lists floors that are in the tower but not a family yet (`codebase`); `familiesOf()` skips PINNED, PARTIAL and `defer` floors, so tower-self.test is 11/11 again. Regenerated skills/deps.json, families.json, guide.json and self.json with `node tools/refresh.mjs`.
- tools/real-pages.mjs: a spec for `/ledger/` (fixture repo through a routed api.github.com: rows, tab counts, filter, PR tab, CSV download, copy CSV, shared link). `--list` is 127 of 127.
- Podcasts (functions/api/podcasts.js, lib/podcasts.js, podcasts/index.html; the function was reserved for Claude): live /api/podcasts answered 502 because Apple's directory did not answer the Worker, and Cloudflare covers a Function's 502 with its own HTML page. Now every Apple ask sends a `VerseBot/1.0` user agent; when Apple fails, search and charts fall back to fyyd.de (free, keyless), and the answer carries `source: 'fyyd'` and a `note` that the page shows above the list (`srcNote`). A real failure is a 503 with the JSON reason, and the page falls back to asking Apple from the browser whenever the server says `kind: 'away'`. Test: the last test in tools/podcasts.test.mjs.
- music-de: music-de.test passes 3/3 on main; the extra period is already gone, so nothing changed.
- claude-brain: the SDK is in devDependencies and the lockfile, and the test runs 4/4 with nothing skipped. Nothing changed.

- 2026-10-29T07:28Z verse-loop (verse): task, Queue job mvoxczpi (versus: wheelofgold.com): Versus: wheelo; all checks green; branch loop/20261029-072841

- 2026-10-29T08:41Z verse-loop (verse): task, Queue job mvoxrsct (versus: colorcanon.com): Versus: colorca; all checks green; branch loop/20261029-084136

- 2026-10-29T08:52Z verse-loop (verse): task, Queue job mvoxrt8e (versus: colornames.org): Versus: colorna; all checks green; branch loop/20261029-085251
- 2026-10-29T07:39Z verse-loop (verse): task, Queue job mvoxd09y (versus: magicchecker.com): Versus: magic; all checks green; branch loop/20261029-073906
- 2026-10-29T09:02Z verse-loop (verse): task, Queue job mvoxrtv8 (versus: online-calculator.com): Versus: ; all checks green; branch loop/20261029-090234

- 2026-10-30T00:18Z verse-loop (verse): task, Queue job mvpi0joe (versus: emojitracker.com): Versus: emoji; all checks green; branch loop/20261030-001805
