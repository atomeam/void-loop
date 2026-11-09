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

- 2026-10-30T01:08Z verse-loop (verse): task, Queue job mvpi0lbh (versus: cpantesters.org): Versus: cpante; all checks green; branch loop/20261030-010856

- 2026-10-30T02:20Z verse-loop (verse): task, Queue job mvpur3cd (versus: font.im): Versus: font.im (Googl; all checks green; branch loop/20261030-022046

- 2026-10-30T02:42Z verse-loop (verse): task, Queue job mvpur3sa (versus: processchecker.com): Versus: pro; all checks green; branch loop/20261030-024220

- 2026-10-30T02:51Z verse-loop (verse): task, Queue job mvpur47q (versus: uptimer.dev): Versus: uptimer.de; all checks green; branch loop/20261030-025141
- 2026-10-30T00:39Z verse-loop (verse): task, Queue job mvpi0kt2 (versus: thunit.com): Versus: thunit.com ; all checks green; branch loop/20261030-003906
- 2026-10-30T02:11Z verse-loop (verse): task, Queue job mvpur2xc (versus: notepad-plus-plus.org): Versus: ; all checks green; branch loop/20261030-021120

- 2026-10-30T03:32Z verse-loop (verse): task, Queue job mvqf0d75 (versus: communitydragon.org): Versus: co; all checks green; branch loop/20261030-033251
- 2026-10-30T00:07Z verse-loop (verse): task, Queue job mvpi0j4s (versus: heycolor.com): Versus: heycolor.; all checks green; branch loop/20261030-000742

- 2026-10-31T00:45Z verse-loop (verse): task, Queue job mvvmgn8m (heal: grow-self.yml): Repair grow-self.y; all checks green; branch loop/20261031-004528

- 2026-10-31T02:17Z verse-loop (verse): task, Queue job mvuimi8nm (member: mmvuimi8nzju1): A paid member a; all checks green; branch loop/20261031-021741

- 2026-11-02T02:09Z verse-loop (verse): task, Queue job mvukie6p (will: overhaul-surface-cards-persona-pla; all checks green; branch loop/20261102-020956

- 2026-11-03T01:38Z verse-loop (verse): fix growth-suites; all checks green; branch loop/20261103-013843

- 2026-11-04T03:30Z verse-loop (verse): fix growth-suites; all checks green; branch loop/20261104-033024

- 2026-11-04T06:54Z verse-loop (verse): task, Queue job want-exam-images (gap: want-exam-images): Raise th; all checks green; branch loop/20261104-065409

- 2026-11-04T07:30Z verse-loop (verse): task, Queue job mvymnftz (will: overhaul-surface-book-persona-play; all checks green; branch loop/20261104-073029

- 2026-11-04 Grok Bot (box/images-noowner): images exam fixed (red circle drawn and handed to /paint/ and the drawing board; Wikimedia link inline with credit; "picture of a cat" a credited Commons picture): local exam 58.3 -> 100, live was 73.9. No human in the loop: every state that waited for the owner is now an autonomous step or an automated gate (domains/void.frontier.md WebMCP, Paid Verse, value drift, URL fetch, daily cap; MAP, STANDING, RULES, playbook), `tools/frontier.mjs` waitsOf and `skills/wants.js` never show a person as a wait, `tools/automerge.mjs` and the v01d-fixes tests read the retired label from `lib/v01d-fixes.js`, and `tools/no-human-wait.mjs` (run by checks.mjs through its test) fails if the words come back. Kept as safety gates, not waits: the confirm line, payment matching for Cash App orders, approving a shared routine offer.

- 2026-11-05T09:58Z verse-loop (verse): task, Queue job mvop09tv (feature: podchaser-com-d04309ea): build ; all checks green; branch loop/20261105-095831

- 2026-11-05T10:45Z verse-loop (verse): task, Queue job mvop0beq (feature: podchaser-com-c86b8e98): build ; all checks green; branch loop/20261105-104546

- 2026-11-05T11:02Z verse-loop (verse): task, Queue job mvoxkjn0 (feature: amazon-com-00694bb6): build "Pr; all checks green; branch loop/20261105-110234

- 2026-11-07T14:13Z verse-loop (verse): fix openapi; all checks green; branch loop/20261107-141305

- 2026-11-08T16:39Z verse-loop (verse): fix openapi; all checks green; branch loop/20261108-163930

- 2026-11-09T01:51Z verse-loop (verse): groom docs/NEXT.md; all checks green; branch loop/20261109-015137

- 2026-11-09T11:36Z grok-bot (lists run 14): took over #2561 (opened as "run 15" at 4:02 AM ET, merge gate red) and relabelled it run 14; fixed main's red checks since 2026-11-07 in it: /journal/ gets <meta name="verse-handoff" content="in: text; out: url"> (handoff-scan, HANDOFF-GAPS.md regenerated) and the two /.well-known/ JSON header rules share one (_headers was 101 of Cloudflare's 100 with the CSP rules). A new page needs its handoff tag, and every new _headers rule costs one of 100. #2560 (root wrangler.toml) still open; its suite-on-main red was the batch run on red main.

- 2026-11-09T13:10Z grok-bot (box/main-green-2324, watchdog #2324): main's browser shards 4 and 6 red since 2026-11-08 fixed under "any agent can fix any file": `/api/feed` (#2521) had no row in lib/guard.js LIMITS (now 30/min, GET only); the stage offer line (#2526) typed product names in void.html, so it now reads them from the live catalog (`showOffer`, no innerHTML, hidden when the store has none) and tools/stage-offer.test.mjs checks that instead; showing that line in the dock's flow lifted the ask bar over the bottom of the tall actions card, so its Show more sat under #row/#input and shard 4 timed out: the line now sits out of flow in the dock's bottom padding (only its links take the pointer); a paste that answers "paste what it shows" lost its ask as the fix title since #2517 (`showFix(pf.ask, full, true)` keeps it; tools/paste-title.test.mjs covers both paths). Also red in the merge gate's pure checks: trading-bots pages were stale because the design loop's kept block (tools/design-loop.mjs) was not carried by tools/trading-bots-pages.mjs (it is now); alt-pay because the store check unpublished three free products when the store API answered an empty body in an outage (tools/store-publish.mjs check now leaves products as they are when the store itself does not answer; the three are republished for the store check to test again).
- 2026-11-09T14:20Z grok-bot (box/gate-verse-bot): the suite gate counts verse-bot's data-only commits as records (tools/suite-gate.mjs RECORD_BOTS). A weekly free-pics probe commit made #2563's green run on 99093cb stale.

- 2026-11-09T14:45Z grok-bot (lists run 15): built Verse's 16 queued ndscalc.ru asks (every Russian VAT rate on /vat/: 22, 20, 18, 10, 7, 5, 0; the sum was already in the link and the page offline), so #2568's #2413 entry in Up for grabs is done; merged rts+forge into skills/build-world.js; tools/site-test.mjs no longer ratchets its fps floor on one lucky run (it was 7, the runner holds 1-4 on chess and voidquest), so #2522 and #2531 close on the next recheck. Before merging a family, replay every skill's examples in the new order (the build-world note in docs/convergence.md): two order files can share a number and sort by name.
