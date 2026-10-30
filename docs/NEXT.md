# NEXT — every open track, in priority order (2026-10-22)

For Claude and the daily routines. Each line: status · open PRs · exact next step. Nothing is ever finished; each track keeps upgrading in the lap loop.

<!-- tower-plan: tools/tower-plan.mjs reads this block and writes void-live-deploy/tower.plan.json, which the Versus card shows (now, next, far). Edit the ids here, never the JSON. -->
**Tower queue, easiest first (owner, 2026-10-28: "meanwhile we can move backwards to easier sites").** Tiny single-purpose sites whose robots.txt lets us read them (checked 2026-10-28), worked in this order. Each one: a full feature inventory of the rival, parity plus more, the floor's journeys scripted in `tools/tower-journeys.mjs` with negative controls, then `tools/tower-gate.mjs` for wider use; a floor is marked beaten only on that evidence (blocked or unscripted is INCOMPLETE).
- now: `is it` — isitchristmas.com, one answer a day (robots: allowed). Before it, `paint` (heycolor.com) was surpassed on 2026-10-28: all 16 aspects, its six journeys scripted with negative controls (tower.evidence.json)
- next: `coin flip` — justflipacoin.com (robots: allowed except /flips)
- next: `password strength` — howsecureismypassword.net (no robots.txt: allowed)
- next: `word count` — wordcounter.net (robots: allowed)
- next: `stopwatch` — online-stopwatch.com (robots: allowed)
- next: `colour codes` — hexcolor16.com (robots: allowed)
- next: `wheel` — wheelofnames.com (robots: allowed)
- next: `gradient` — colorzilla.com gradient editor (robots: empty, allowed)
- next: `encoder` — base64encode.org (robots: allowed)
- next: `random number` — random.org (robots: home page allowed; /integers/?* disallowed, so only the home page is read)
- far: `shopping` — Amazon, far future
- far: `video` — YouTube, far future
- skipped: hextobinary.com — its robots.txt disallows every path for every agent
<!-- /tower-plan -->


**Gate badges and stages (owner direction, 2026-10-28; `void-live-deploy/lib/gate-badge.js`, test `tools/gate-badge.test.mjs`).** Every tower floor shows one badge on the card: **[Gate: Code]** (software Verse can build now), **[Gate: Partner]** (the real thing needs a licensed partner or a partner's API: live fares, payments, licensed market or sports data, other people's videos, job boards) or **[Gate: License]** (a licence of Verse's own, such as a music streaming catalogue). A regulated floor (banking, lending, insurance, tax, government, health, food delivery, travel tickets, betting) also shows its stage: **Stage 1** on-device prep and the maths, then a hand-off to the official service; **Stage 2** a partner bridge; **Stage 3** a direct licence. No partner or licence exists today, so every regulated floor is at Stage 1. **The build queue picks only Code work, or Stage 1 on a regulated floor**: `tower()` puts every other floor behind all buildable work, and `tools/tower-self.mjs` never picks a site that is not buildable. A page whose real version needs a partner or a licence says so on the page and never fakes it (`tools/real-pages.mjs`).

**Standing lap item: page-to-page connections (owner direction, 2026-10-28; lap item `loop:handoffs`).** Every lap: run `node tools/handoff-scan.mjs --write`, which reads every page's inputs and outputs (its `<meta name="verse-handoff" content="in: ...; out: ...">` tag, or `tools/handoff-types.json` for pages from before the rule) and lists in `docs/HANDOFF-GAPS.md` every connection not built yet (one page's result opening another, through the `verse_handoff` ring in `lib/handoff.js` or a link that carries the data), ranked by usefulness (shared type weight, doubled when the target reads its link). Build the top few, and play each one end to end in `tools/handoff-e2e.mjs` (a real browser, from disk, with negative controls after every step). Facts that only rise: connections built, pages with their own tag, journeys played. **Every new page declares its handoff types in its own tag when it ships**; `tools/handoff-scan.test.mjs` fails a page with neither, and `tools/handoff-types.json` may only shrink. Built so far on this track: the BPM counter and the metronome hand each other the tempo. Next: chords → piano, time → weather, calendar → time (top of the list; the time page's inline module means a CSP hash update).
**The gate's standards (owner, 2026-10-28; `docs/GATE-STANDARDS.md`).** Every floor: scripted end-to-end journeys with positive and negative controls; blocked or skipped is INCOMPLETE, never a pass; an adversarial fixture for every false pass (`tools/tower-falsepass.test.mjs`); a live-data route that falls back to static or mock data shows a visible notice or fails the build. Amazon and YouTube are un-beaten far-future floors with honest gaps and plans; small single-purpose sites first, easiest first · next: journey scripts for the queue head (calculator, converters, time, hex colour, is it), then /paint/ · **Fix bugs, never weaken tests.**
**Every lap, required: parity inventory.** `node tools/site-history.mjs --missing` (a cited timeline in `docs/HISTORY/<slug>.md`: every fact with its source link, unknowns marked unknown), `node tools/parity.mjs --scan <slug>` (the original's live menus and buttons), fix or add its rows in `tools/parity-catalog.mjs`, then `node tools/parity.mjs --write`. Then build the top missing features from `docs/PARITY/README.md`. /obituaries/ says "beaten" only with 0 missing, partial or unreviewed rows plus the gate's 9 of 9 (2026-10-28: Google Translate, Google Docs and Google Calendar caught up most of the way: translate 96%, notes 89%, calendar 83%; next: real-time co-editing and writing help in /notes/, booking pages and email events in /calendar/, a real browser extension for /translate/).

0. **TOP: Verse does everything Grok Bot and Claude do, and better (a tower floor)** — status: not passed. This floor passes only with evidence for every item: the same task, run head to head, with Verse at least equal. Honest checklist (estimates until a head-to-head run proves them):
   - Answering: **partial**. Skills answer many asks, but free-form ones fall back. Next: log asks that fall back (topics only) and turn the most common into skills each lap.
   - Research: **partial**. Wikipedia/Wikidata lookups and passive REA studies. Next: a cited multi-source research card.
   - Writing: **partial**. Next: a draft, revise and tone flow, scored against a reference.
   - Coding and building features: **can't** on its own; builders do it. Next: Verse files a scoped build ask and a routine opens the PR; track asks turned into merged features.
   - Routines and automations: **partial**. Lap loop and daily routines run, but builders drive them. Next: Verse schedules its own checks from the self card.
   - Browsing: **can't** directly. Next: link cards plus a fetch-and-summarize skill via owner-gated APIs.
   - Files and images: **partial**. Next: upload, transform and export for common types.
   - Films: **partial**. Cut-off-word fix pending (item 1). Next: film-anything plus a films score.
   - Memory: **partial**. Private owner memory only. Next: Verse recalls owner notes in answers (owner-gated, never committed).
   - Running its own lap loop: **partial**. Next: Verse proposes the lap's ~100 upgrades and records the before and after itself.
   Next step: add the floor to the tower (#1271) with these items as "N of M aspects beaten"; it starts at 0 of 10.

1. **Films: cut-off words in shorts + "make this a film" for anything** — status: glitch rarer/slower merged (#1257, #1263, #1268); cut-off-word fix and film-anything in progress (worktree `films-fix`, F-236 in `f236`) · open PRs: none yet · next: captions/titles wrap inside safe areas, add a frame-sampling check on rendered shorts that fails on clipped text; then a "make this a film" action on every card/creation (games, comics via Panel Play, music via Loop Grid). Add the films score (cut words, caption size, shot variety, pacing, loudness, load time) + films chart on the self card; a film that scores below the best old film doesn't ship.
2. **F-236 Scene Blocker → into Films** — status: not dispatched · next: fold shots/storyboard blocking into the film-anything flow (item 1); no separate surface.
3. **Cards: throw away + minimize into miniatures** — status: forge/play/share merged (#1245, #1251, #1255, #1261, #1262, #1266) · open: none · next: verify throw-away and minimize-to-miniature on desktop + 390px phone; fix and add a browser check.
4. **Game Box (games + dice/coins/cards/number picks, binder with deeds)** — open PR **#1273** · next: rebase on main, get checks green, merge.
5. **Lap loop + real-site tower** — lap 1 overhaul merged (#1269); tower open PR **#1271** · next: merge #1271; each floor needs "N of M aspects beaten" evidence before it passes; each lap records a measurable before/after (include films, business plans, Forethinkers).
6. **Completeness + Monopoly/VoidQuest panels** — basics merged (#1254) · next: confirm property + money panels in the Monopoly-style game and VoidQuest; add a check that every game has its basic panels.
7. **Book repagination** (min font size, index.html copy sync, emoji row) · next: finish in worktree `bookfix`; check no cut-off text at 390px–1920px and 50–200% zoom.
8. **Mind Field + Tilt Arena** — Mind Field merged (#1252, #1267, #1270) · next: Tilt Arena stage, then phrases + book page + "what can you do" spot.
9. **Podcast "Verse Out Loud"** — open PR **#1260** · next: rebase, green, merge.
10. **Main browser suite** — green fixes merged (#1258, #1272) · next: keep green on two consecutive runs; owners fix their own failures.
11. **Duplicate IDs F-225 and F-232** · next: give the second of each a new number (internal only) and update references; check drift test.
12. **Cloudflare reconnect, budget guard, cache TTL** — blocked on owner reconnecting Cloudflare (never ask for tokens in chat) · next: after reconnect, add budget guard, optionally set Browser Cache TTL to "Respect Existing Headers".
13. **Other open PRs**: #1259 (lists run 5), #1189, #1188, #1187 — rebase or close with a note.

Rules stay: don't edit Claude's files (lib/models.js, lib/guard.js, lib/clef.js, router/limits, functions/api/gumroad.js); no force-push; paraphrased commits; automerge label.
