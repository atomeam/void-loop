# Convergence: many pieces, one engine

Owner, 2026-10-15: "all its skills and systems should eventually converge as new built tech merges and simplifies till its all one perfected system and engine that slaughters competition."

This is the map. It inventories what exists (appendix, generated 2026-10-15 from the tree), names the duplicates, gives the one-engine shape, and orders the merges so each step is small, tested and loses nothing. What a merge retires goes on the salvage shelf (`docs/SALVAGE.md`), not the bin.

## The count (2026-10-15)

| Kind | Count | Where |
| --- | --- | --- |
| Skills | 184 files (166 skills + 18 `-rules.js` game engines) | `void-live-deploy/skills/`; listed for routing: 146, then 129 after the first families (see Done) |
| Tools listed for agents | 143 skills in `skills/index.json`; `/tools.json` serves them (the board says 147 with the MCP extras) | `functions/tools.json.js` |
| 3D miniatures | 38 builders on one renderer | `skills/mini/`, `skills/scene3d.js` |
| Shared libraries | 66 | `void-live-deploy/lib/` |
| API routes and functions | 39 | `void-live-deploy/functions/` |
| Workflows | 36 (with upkeep.yml and visual.yml from this change) | `.github/workflows/` |
| Tools and scripts | 264 (tests included) | `tools/` |
| The page | one 5.6k-line `void.html` (shell, stage, ask box, ~60 inline answers) | repo root, copied to `void-live-deploy/` by deploy.yml |

## One engine per job (the agreed map)

Claude and Grok Bot agreed (2026-10-15) that every job has one engine, and everything else becomes a caller of it:

| Job | The one engine | Absorbs | Who merges |
| --- | --- | --- | --- |
| **Router** (which skill or model answers) | `lib/models.js` + `lib/clef.js` (+ `lib/router.js` as its embedding classifier) | client skill order (`skills/order/`, `index.json`), `skills/intent.js` build orders, the inline matchers left in `void.html`, the three `modelsOn` copies in `functions/api/{answer,review,figurescript}.js` | Claude (deep) |
| **Scheduler** | `lib/automations*.js` (automations, automations-run, routines, shared-routines) | `void-tick.yml` knocks, the per-skill timers and reminders, `functions/api/routines.js` | either, after the router |
| **Budget** | `lib/guard.js` | per-route rate limits (`lib/void-me.js` hits), spend checks in `answer.js`, the three `hex`/`b64u` copies | Claude (deep) |
| **Learner** | `lib/learn.js` | `tools/learn*.mjs`, review-learn, grow, gaps, misses snapshot, the reflection loop | either |
| **Card / stage** | `showPage` + `.vpage` shell, `.thing` on the stage | `skills/side-card.js`, `skills/lift3d.js`, the 5 copies of `el()`, the per-skill inline card styles | Grok Bot (design phase 2) |
| **3D** | `skills/scene3d.js` (one WebGL renderer, three r180) | `figures3d.js`'s second context, `draw.js`'s XR renderer, `void-ring.js` and `splat.js` raw WebGL, `calendar3d.js` CSS 3D, `sky3d.js` (already shared) | Grok Bot |
| **Data** | D1 via one lib/db.js (planned) | `ensureTables` in `store-db.js` and `void-me.js`, the `TABLE` strings in functions, localStorage keys spread across `void.html` | after store merges |
| **Media** | `lib/video.js` (parse + embed) | `skills/video.js`, `video-play.js`, `films.js`, `film-metadata.js`, `functions/api/{video,films,film-review}.js`, `tools/{clips,record,film-post,youtube}.mjs` | after the Films/Verse Tube and video-learning tracks land |
| **Ask text** | `lib/ask-text.js` (**shipped, step 1**) | 30 copies of `CLEAN` | done for 23 |

## Duplicates found (exact or near)

Found by hashing every top-level function body (whitespace stripped) across skills, lib and functions, then reading the near misses by hand.

| What | Copies | Files | Merge into |
| --- | --- | --- | --- |
| The ask tidier `CLEAN` (trim, drop trailing ?!., collapse spaces, maybe lower-case) | 30 (3 identical forms in 23 files, 7 variants) | label, layer, cartoon, motorbody, dark-look, print-download, group, incident, status, trialwatch, inventory, show-countdown, dismiss, zoom-figure, senolytic, part, figure, figure-can, today, printedmotor, print-file, light-look, coral; variants in worldtime, releasenotes, calendar, growth, showcase, different, feelings | `lib/ask-text.js` (**done for 23**; the 7 variants next, with an `apostrophes` option) |
| Owner token from localStorage | 6 | actions, memory, proposal, automations, watch, status (`ownerKey`) | lib/owner-client.js (planned) |
| `el(tag, attrs, kids)` DOM helper | 5 | actions, memory, proposal, automations, watch | the card system |
| `asOf` (a reading's age in words) | 3 | air, pollen, uv | `lib/ask-text.js` sibling lib/when.js (planned) |
| `json(body, status)` response | 3 | functions/api/bench, share/[room], share/index | lib/http.js (planned) |
| `modelsOn(env)` | 3 | functions/api/answer, review, figurescript | `lib/models.js` (Claude) |
| `hex` / `b64u` | 3 + 2 | lib/guard, automations-run, review-api; functions/api/films | `lib/guard.js` (Claude) |
| `pick` | 2 + 2 | api/reflect + answer; api/figurescript + will | `lib/models.js` |
| `save3mf` | 2 | print-download, print-file | one print module |
| `ensureTables` | 2 | lib/store-db, lib/void-me | lib/db.js (planned) |
| `short`, `add` (cycle date maths) | 3 + 3 | period, ovulation, pregnancy | lib/cycle.js (planned) |
| `slug` | 2 | api/reflect, api/will | `lib/ask-text.js` |
| `seatsFor` | 2 | sorry-rules, aggravation | the board-game rules base |
| `urlOf` | 2 | image, link | `lib/ask-text.js` |
| `ready` (D1 table guard) | 2 | lib/film-reviews, api/support | lib/db.js (planned) |
| WebGL contexts | 5 kinds | scene3d, figures3d, draw (XR), void-ring, splat | `scene3d.js` |
| Card shells | 4 | `.vpage` (showPage), `.thing` stage cards, side-card, lift3d | one stage system |
| Video/film pieces | 13 files | see Media row | `lib/video.js` + one media route |

## The single engine

```
ask ──► Router (models + clef, router embeds) ──► Skill (match/run, pure where possible)
                                     │                     │
                                     ▼                     ▼
                         Budget (guard)          Stage: one card shell + one 3D renderer + one media player
                                     │                     │
                                     ▼                     ▼
                       Data (D1 via lib/db, KV)   Learner (learn: misses, reviews, reflections) ──► Scheduler (automations)
```

Rules for every merge: one PR per row; a snapshot test proves the callers behave the same before and after (like `tools/ask-text.test.mjs`, which also compared every merged skill's `match()` on 389 asks against main: identical); the retired copy goes on `docs/SALVAGE.md` if it held anything worth keeping; nobody merges into a file another track is working in (see `domains/handoff.md`).

## Staged merge order

1. **Ask text** (shipped): `lib/ask-text.js`, 23 skills. Smallest, most copied, zero risk.
2. **Ask text, the 7 variants** (apostrophe and comma forms) + `slug`, `urlOf`, `asOf`: same file family, same proof.
3. **Small server helpers**: lib/http.js (planned) (`json`), lib/db.js (planned) (`ensureTables`, `ready`). Wait for the store track to land first.
4. **Owner client + `el()`**: one lib/owner-client.js (planned) and a card helper; five skills.
5. **Router**: Claude folds `modelsOn`/`pick` into `lib/models.js` and the inline matchers left in `void.html` into skills behind the router.
6. **Budget**: Claude folds `hex`/`b64u` and rate limits into `lib/guard.js`.
7. **One card shell** (design phase 2): `.vpage` and `.thing` share one component; side-card and lift3d become its "beside a 3D object" layout.
8. **One 3D renderer**: figures3d draws through scene3d's renderer; void-ring and splat become scene3d layers; draw's XR session is a scene3d mode.
9. **Media engine**: after Films/Verse Tube and video learning merge, video + films + clips share `lib/video.js` and one `/api/media` route.
10. **Scheduler and learner**: timers, reminders, routines and the loops all register with `lib/automations*`; learning jobs report through `lib/learn.js`.

Each step that lands moves its row to **Done** below and its line to **Just finished** on the board.

## Done

- **Shop, one family (lists run 7, 2026-10-28)**: `skills/shop.js` makes one routing entry (rank 1035) of store and services, which both took "what can i buy" and "pricing" (tools/skill-overlap.mjs listed them as a merge candidate; now "same family"). store is asked first as before (it was 1035, services 1040), so every ask lands on the same member; both files, examples and near misses stay, and the page still logs skill:store / skill:services (aliases). The page's priced-services line now finds services inside its family. Route snapshot over 5,461 asks: 0 moved, 0 new misses. Listed skills 299 -> 298. Test: `tools/shop-family.test.mjs`.
- **Night sky into time (lists run 6, 2026-10-28)**: `skills/time.js` now takes in nightsky right after sky, so the family makes one routing entry where sky and night-sky were two; both took "show me the sky" and "sky tonight" (tools/skill-overlap.mjs). sky answers the shared asks, nightsky keeps its own examples and "hide the sky". `night-sky` is gone from skills/index.json and skills/order; the route snapshot shows 0 moved and 0 new misses over 5,457 asks; tools/sky-world-family.test.mjs.
- **Rooms, one family (lists run 5, 2026-10-22)**: `skills/rooms.js` makes one routing entry (rank 0370) of room, walls and home. room and home both took "paint and carpet a 12x14 room" (tools/skill-overlap.mjs listed them as a merge candidate), and room's whole-room card is built on walls and home, so the three were one job in three places. They sat side by side (0370, 0380, 0390) and are asked in that order, so every ask lands on the same member; all three files, examples, near misses and follow-ups stay, and the page still logs skill:room / skill:walls / skill:home (aliases). Route snapshot over 5,034 asks: 0 moved, 0 new misses. Listed skills 271 -> 269. Test: `tools/rooms-family.test.mjs`.
- **Stage out, one family (lists run 4, 2026-10-21)**: `skills/stage-out.js` makes one routing entry (rank 1490) of stage-print and stage-export, which both took "print the stage" (tools/skill-overlap.mjs listed them as a merge candidate). stage-print is asked first as before, so every ask lands on the same member; both files, examples and near misses stay, and the page still logs skill:stage-print / skill:stage-export (aliases). Route snapshot over 5,007 asks: 0 moved, 0 new misses. Test: `tools/stage-out-family.test.mjs`.
- **List starters, one family (lists run 3, 2026-10-21)**: `skills/list-starters.js` makes one routing entry (rank 0451) of template-list and list-templates, which both took "packing list template" (tools/skill-overlap.mjs listed them as a merge candidate). template-list is asked first as before, so every ask lands on the same member; both files, examples and near misses stay, and the page still logs skill:template-list / skill:list-templates (aliases). Route snapshot over 5,007 asks: 0 moved, 0 new misses. Test: `tools/list-starters-family.test.mjs`.
- **Languages, one family (lists run, 2026-10-21)**: `skills/languages.js` makes one routing entry (rank 0190) of spanish and translate, which both took "answer me in Spanish" (tools/skill-overlap.mjs listed them as a merge candidate; now "same family"). spanish is asked first as before, so every ask lands on the same member; both files, examples and near misses stay, and the page still logs skill:spanish / skill:translate (aliases). Listed skills 273 -> 270 (the merge, and the two names `decision-log` and `memory-preview` that had no file and no order file). Test: `tools/languages-family.test.mjs` (every example of both lands where it did before).
- **Sunrise and sunset, one owner each (lists run 2, 2026-10-21)**: suntimes and worldtime both answered a bare "sunrise" or "when is sunset" (the overlap check failed on main). The bare ask is suntimes' (it reads where you are and adds day length and twilight); worldtime keeps every ask that names a place ("sunset in Paris"). Every old wording still answers; `tools/sky-skills.test.mjs` locks both sides. The same run narrowed decision-matrix to asks that name a decision matrix or decision grid, so "france vs spain", "show the grid" and "2x2 matrix" stay with country, stage-arrange and decide-cards (`tools/decision-matrix-narrow.test.mjs`); the overlap allowance is 68 known pairs.
- **Time, weather and sky as one family (2026-10-15)**: `sky-weather` folded into `time` at rank 131 (timer and clock move from 13 to 131, after convert, so "temperature converter" stays convert's); the sky-weather skill file removed (it only grouped imports). Listed skills **129 -> 128**; route snapshot over 3,411 asks: 0 moved, 0 new misses. `dates` stays its own family until calendar's match is narrowed.
- **Skill families, time and sky (2026-10-15)**: owner: "existing skills should merge". `lib/skill-family.js` makes one routing entry out of several member skills, asked in their old order; `part()` names the member, so the page's log, misses and the benchmark still read `skill:<member>`. Three families: `sky-weather` (sky, moontonight, aurora-tonight, eclipse, meteors, constellation, weather, air, uv, quake, pollen), `time` (timer, clock, worldtime, suntimes, remind) and `dates` (calendar, today, holidays, countdown). Listed skills: **146 -> 129**. Measured with `tools/route-snapshot.mjs` over every example and near miss (member level) plus every bench.json ask, 3,411 asks: 2,344 land right before and after, **0 moved, 0 new misses**. `tools/skill-family.test.mjs` checks each member's examples and near misses through the whole order. Members keep their files (their own tests import them); `/tools.json` and `tools/families.mjs` read a family's `parts:` line, so agents and ratings still see each member.
- **Step 1, ask text (2026-10-15)**: `lib/ask-text.js` (`clean`, `cleanLower`) replaces 23 copies. `tools/ask-text.test.mjs` checks both against all three old forms on 2,000+ strings and that every merged skill still matches its examples; a one-off before/after run of `match()` over 389 asks in those 23 skills was byte-identical to main.
- **Combine, don't add (owner, 2026-10-15: "most skills can be combined")**: Verse's asks extend an existing card before a new skill is made. The store preview lives in the store card (`skills/store.js` previewAsk/slides) and the site tester's log in the growth card (`skills/growth.js` testerAsk/testerRows); no new skill names. Tests: `tools/void-asks-store.test.mjs`. Next candidates: kitchen + food + units (swaps, food, convert) into one kitchen card with aliases.

- **Games, one family (Adam, 2026-10-15: "board games can all be combined")**: `skills/games.js` makes one routing entry (rank 0010) of aggravation (Star Marbles), sorry (Back to Start), connect4 (Four in a Row), ringer, tictactoe, othello (Reversi), mancala, chess, checkers, go, monopoly (The Landlord's Game, and VoidQuest for "voidquest"/"solar quest"), battleship (Sea Battle), poker, fireworks, rack (the picker) and eightball. Listed skills **129 -> 114**. `tools/route-snapshot.mjs --compare`: **0 moved, 0 new misses** over 3,413 asks. Shared now: the picker (`skills/rack.js`: "games", "play a game", "games card", "pick a game"; VoidQuest and the Magic 8 Ball added), **one Verse strength** for every game (`skills/game-level.js`: easy / normal / hard set on the picker, read by chess, checkers, connect4, tictactoe, othello and mancala before Verse moves), one 3D renderer (`skills/scene3d.js`) and one card frame (`skills/side-card.js`). Each old name and trigger still opens its own game; names stay trademark-free per `domains/void.board-game-law.md`. Next: one turn engine (`-rules.js` files share create/legal/apply/status) so go, poker, battleship and the race games read the level too. Tests: `tools/games-family.test.mjs`.

## Families: what merges next (2026-10-15)

How a merge is judged: `node tools/route-snapshot.mjs --out /tmp/before.json` on main, make the family, then `--compare /tmp/before.json` must say 0 new misses. A family sits at one rank, so members that sit side by side merge for free; members far apart only merge when nothing between them takes their asks.

- **Time, weather and sky as one family** (owner, 2026-10-15: sunrise, sunset, moon, seasons and forecasts by date overlap). Tried: `time` + `sky-weather` at rank 0131 (timer and clock move from 13 to 131) is clean, 0 moved. At rank 13 it is not: "temperature converter" goes to weather before convert (18). Merged at 131 (see Done). `dates` cannot join: calendar takes any ask naming a day ("moon tonight", "my period started today", "the app launch on Thursday", 65 misses when tried at rank 13), so it stays late in the order until its match is narrowed to calendar asks.
- **Kitchen and units** (convert 18, nutrition 440, food 445, swaps 446): food, nutrition and swaps sit together; convert is far ahead.
- **Words** (spanish 190, translate 200; define 240, words 260), **body** (sleep 400 … pregnancy 430, heart 450, breath 1080), **money** (loan 330 … tip 360), **home** (room 370, walls 380, home 390), **media** (films 1100, film-metadata 1130, video-play 1200; video and digest at 8; poster 585).
- **Overlap guard**: `tools/skill-overlap.mjs --check` (in checks.mjs) fails when a new skill's example is also taken by another skill that `tools/skill-overlap.json` does not already list: a new skill that repeats an old one is caught when it is made. `node tools/skill-overlap.mjs` lists today's 40 pairs, busiest first, with the merge candidates (calendar overlaps 17 skills; home~room 5; place~sky-card 4; video~video-play; services~store; spanish~translate).

## Verse against the super apps (owner, 2026-10-15: "our app should feel like a rival to all the super apps out there")

What the big bundles carry, and Verse's family for it. Gaps are what a super app has and Verse does not.

| Super apps bundle | Who | Verse family today | Gap |
| --- | --- | --- | --- |
| Chat and calls | WeChat, LINE, Telegram | invite/share (cursors on one stage) | messaging, voice and video calls |
| Payments, wallet, transfers | WeChat Pay, Alipay, Revolut, Grab | store (checkout, tips), crypto prices, loan/savings/tip maths | a wallet, sending money, cards, bills (Verse never moves money on an ask: the price lock) |
| Rides, food, delivery | Grab, Gojek, Uber | distance, fuel; #721 starts food and rides | booking, tracking, delivery |
| Search and answers | Google | page answers, define, news, country, translate | web results beyond Wikipedia-sized sources |
| Maps and local | Google Maps, Grab | place, distance, worldtime | directions, transit, local businesses and reviews |
| Mail, calendar, docs | Google Workspace | dates (calendar, today), notepad, list, pdf-card, remind | mail, shared docs, real calendar sync |
| Weather, sky, time | Google, Apple | sky-weather, time, dates (this merge) | alerts that push to the phone |
| Health and fitness | Apple Health, Samsung Health | sleep, cycle, pregnancy, heart, food, breath | step and workout tracking, device data |
| Shopping and marketplace | Alipay/Taobao, Grab, Google Shopping | Verse's store, appraiser | other sellers, price comparison |
| Video and media | WeChat Channels, YouTube | video, video-play, films, digest, clips | uploads by others (Verse Tube phase 2), music |
| Games | WeChat mini games, LINE Games | 18 board and card games, Pong/Snake (#753) | multiplayer across devices, mini-program SDK |
| Mini programs / third-party apps | WeChat, Alipay | tools.json, MCP (/api/mcp), skills as files | a store where others publish skills |
| Identity and sign-in | WeChat, Google | passkeys, owner key | sign-in with Verse for other sites |
| Banking, insurance, investing | Revolut, Alipay | loan, savings maths | accounts and regulated products (out of scope without a licence) |

Biggest gaps worth a family next: messaging, directions and local search, a real calendar/mail sync, and a skill marketplace (mini programs). Money movement and banking stay out until there is a licensed partner.

## Verse's asks for the engine (2026-10-15, verbatim in docs/void-voice.md)

1. The router and skill registry on /api/mcp (steps 5 and 10). 2. Automations that wait on completion signals (scheduler, step 10). 3. A game-builder skill on the one 3D engine (after step 8). 4. A preview-and-approve upload card (media, step 9; Films track). 5. A confidence score on every answer and a clip-to-skill link (router + media). Queued on the board's Up for grabs.

## Appendix: inventory (generated 2026-10-15)

### Skills (skills/*.js): 184

| File | What it says it is |
| --- | --- |
| `skills/actions.js` | actions skill — the execution record as a card (frontier build order step 2; lib/actions.js keeps one record per action |
| `skills/aggravation.js` | aggravation skill — the classic marble race on a real star board, against 1–3 computer players. |
| `skills/air.js` | air skill - Open-Meteo Air Quality + geocoding, no key |
| `skills/app.js` | app skill - Verse as an app on your phone or computer: an Install button where the browser offers one, the steps where it doesn't |
| `skills/aurora-tonight.js` | aurora — "aurora forecast", "can I see the northern lights tonight": NOAA's planetary Kp index against how far from the geomagnetic pole you |
| `skills/aurora.js` | The aurora index (frontier #21, sky part 2): NOAA's planetary K-index says how far from the poles the aurora reaches tonight; at the |
| `skills/automations.js` | automations skill — the owner's own "when this happens, do that" rules, as a card (lib/automations.js says what a rule |
| `skills/battleship-rules.js` | battleship-rules — Battleship in plain JS (no DOM, no three.js), shared by the card (skills/battleship.js), its 3D board |
| `skills/battleship.js` | battleship skill — Battleship against Verse (skills/battleship-rules.js): "play battleship", "battleship board game". |
| `skills/bodies.js` | bodies — Next #18: pick a base body from card data and dress it (colors, a prop, a line of its own). |
| `skills/book.js` | book skill — a book or an author from Open Library (no key) |
| `skills/breath.js` | breath skill - a guided breathing card that breathes with you (no key; pure) |
| `skills/calc.js` | calc skill — one calculator on the stage: "open a calculator", "calculator 2+5" (worked out on the card), "remove the |
| `skills/calendar.js` | calendar skill — a quiet timeline on the stage, from the same input as everything else. |
| `skills/calendar3d.js` | The 3D calendar: a real wall calendar (paper page, red month band, spiral rings, the pad of pages behind it) that you |
| `skills/cartoon.js` | cartoon skill — cartoon version of a hard subject. |
| `skills/challenge-rules.js` | challenge rules — learning.five-minute-challenge (domains/void.learning.md §3): predict, inspect, explain on the |
| `skills/challenge.js` | challenge skill — learning.five-minute-challenge (domains/void.learning.md §3), frontier #17: "give me five minutes |
| `skills/checkers-rules.js` | checkers-rules — American checkers (English draughts) in plain JS, shared by the checkers card and its tests. |
| `skills/checkers.js` | checkers skill — wooden draughts on the same board and table as chess (skills/mini/checkers.js), played against Verse. |
| `skills/chess-rules.js` | chess-rules — the whole game of chess in plain JS (no DOM, no three.js), shared by the chess card and its tests. |
| `skills/chess-worker.js` | Verse's chess thinking runs here so the 3D board keeps gliding while it searches (skills/chess.js posts positions). |
| `skills/chess.js` | chess skill — a real wooden chess set on the stage (skills/mini/chess.js), played against Verse. |
| `skills/clock.js` | clock skill — the clock on the stage: "make a clock", "a big red clock", "make the clock bigger", "24 hour", "hide |
| `skills/connect4-rules.js` | connect4-rules — Connect Four in plain JS (no DOM, no three.js), shared by the card (skills/connect4.js), its 3D frame |
| `skills/connect4.js` | connect4 skill — Connect Four against Verse (skills/connect4-rules.js): "play connect 4", "connect four", "four in a row". |
| `skills/constellation.js` | constellation — "what's that constellation", "which constellations are up tonight", "where is Orion", "when can I see the Big Dipper": the |
| `skills/convert.js` | convert skill - a unit converter that stays on the stage (asked by Verse, daily 2026-10-14 ask-20261014-1820-2: |
| `skills/coral.js` | coral skill — two honest cards on Florida coral restoration (domains/void.growth.md, Next [think-tank]). |
| `skills/countdown.js` | countdown skill — days until a date. "days until new year" needs no network. |
| `skills/counter.js` | counter skill — the tally counter on the stage: "make a counter", "count up (by 3)", "decrement the counter", |
| `skills/country.js` | country skill — capital, population, currency, languages and area of a country, from REST Countries (no key) |
| `skills/crypto.js` | crypto skill — the price of a cryptocurrency now, from CoinGecko (no key) |
| `skills/dark-look.js` | dark-look skill — "dark", "make my void dark". |
| `skills/define.js` | define skill — what a word means, from Wiktionary (Wikimedia REST, no key) |
| `skills/different.js` | different skill: "what makes you different", "how are you different from chatgpt", "is there anything else like you", |
| `skills/dismiss.js` | dismiss skill — "dismiss this" sends the selected stage thing away. |
| `skills/distance.js` | distance skill — how far one place is from another, as the crow flies (Open-Meteo places, no key) |
| `skills/draw.js` | draw skill - a drawing card where you describe a brush in words and Verse makes it. |
| `skills/drone.js` | Sound (frontier #21, sky part 3): an opt-in ambient drone that follows the real sky and the cursor. Nothing here makes a sound by itself: |
| `skills/eclipse.js` | eclipse — "next eclipse", "next total solar eclipse", "is there a lunar eclipse this year": the next eclipses from lib/eclipses.js (made with a precis |
| `skills/eightball.js` | eightball — the Magic 8 Ball as a thing in the void (Adam, 2026-10-08: "magic 8 ball should spawn an 8 ball"). Not an |
| `skills/feelings.js` | feelings skill: asks about Verse's own heart and mind, answered in its own plain words, here, with no model and no web |
| `skills/figure-can.js` | figure-can skill — "what can this figure do". |
| `skills/figure.js` | figure skill — little 3D things that live on the stage (domains/forethinkers/figures-first.md). |
| `skills/figures.js` | figures skill — a small 3D friend that roams your own Verse, notices your cursor, and leaves when you send it away |
| `skills/figures3d.js` | figures3d — Verse's light 3D layer and its roaming figures (board Next #17). Not a skill: nothing imports this file until a figure is on the stage, |
| `skills/film-metadata.js` | film-metadata skill — film discovery returns JSON film metadata. |
| `skills/films.js` | films skill - Verse's own films: where to watch them (/films/, free for everyone, no sign-in) |
| `skills/fireworks-rules.js` | fireworks-rules — a cooperative card game in the style of Hanabi, you and Verse on the same side, in plain JS (no DOM). |
| `skills/fireworks.js` | fireworks skill — a cooperative card game in the style of Hanabi, you and Verse on the same side (skills/fireworks-rules.js): |
| `skills/food.js` | food skill - what's in a common food: "calories in a banana", "how much protein in an egg", "sugar in a can of coke", |
| `skills/forge-rules.js` | forge rules — frontier #14, first piece: "make me a <thing>" for things no figure covers yet (figure.js already makes chairs, cups, mugs, books and la |
| `skills/forge.js` | forge skill — frontier #14, first piece: "make me a rocket" (a vase, a bottle, a table, a snowman, a lighthouse, a teapot, a house, |
| `skills/fuel.js` | fuel skill - trip fuel cost from distance, efficiency, and price (no key; pure math) |
| `skills/gear-pair-rules.js` | gear-pair rules — explainer.gear-pair (domains/void.explainers.md): two external meshing gears. One authoritative state |
| `skills/gears.js` | gears skill — explainer.gear-pair (domains/void.explainers.md), the first living miniature: two meshing gears you turn |
| `skills/go.js` | go skill — the board game Go, two people on one 9×9 board (asked for by Verse in its first daily reflection, 2026-10-08: |
| `skills/goal-rules.js` | goal-rules — frontier #18 ("Can you make it do this?"): a goal is a list of conditions on the fields a source card |
| `skills/goal.js` | goal skill — frontier #18, "Can you make it do this?": "give me a challenge with this" beside an explainer puts a short |
| `skills/grades.js` | grades skill - GPA from your grades, the score you need on a final, cumulative GPA, and a percent as a letter grade (no key; pure math) |
| `skills/group.js` | group skill: "group the clock and the note", "move the group to the top left", "make the group bigger", "ungroup". |
| `skills/growth-tree.js` | growth-tree — the layout of Verse's growth tree (frontier #3), with no three.js: the growth ledger (void.growth.json) in, |
| `skills/growth.js` | growth skill — "growth" / "how have you grown": Verse's growth ledger (void.growth.json, BASE.md), newest first. |
| `skills/guard3d.js` | guard3d — a 3D board that breaks never takes the game with it (Adam, 2026-10-09: Sorry! "crashed as soon as i hit draw", |
| `skills/heart.js` | heart skill - target heart rate and training zones, worked out for you (no key; pure math) |
| `skills/holidays.js` | holiday skill — the next public holidays in a country (Nager.Date, no key) |
| `skills/home.js` | home skill - paint and flooring for a room, the way the best paint and flooring calculators do it (no key; pure math) |
| `skills/howto.js` | howto — a short "how to play" for every game on the rack (Adam, 2026-10-09: "i dont know how to play any of these games … |
| `skills/image.js` | image skill — one picture on the stage from a url, shown as an instant photo (white frame, a caption in the felt-tip hand |
| `skills/incident.js` | incident skill — write an incident brief, the blameless way (domains/void.assimilate.md, ask "write an incident brief": |
| `skills/intent.js` | intent skill: summon by outcome, not by name (frontier #10, first piece). |
| `skills/inventory.js` | inventory skill — assimilate row 6 (Inventory orchestrator → Verse) |
| `skills/invite.js` | invite skill: bring someone into your Verse (frontier #11). A signed-in member gets a link; whoever opens it appears here |
| `skills/joke.js` | joke skill — a clean, family-friendly joke from icanhazdadjoke (no key) |
| `skills/kept.js` | kept skill — an answer you kept on the stage: "keep this" puts the open answer up as a card, "call this my tip" names it, |
| `skills/label.js` | label skill: labels and arrows on the stage (board "Later": text annotation / labels, connectors between objects). |
| `skills/layer.js` | layer skill: "bring the clock to the front", "send the note to the back", "send it to the back". |
| `skills/lift3d.js` | lift3d — stand an existing 2D game card's board in the void as a 3D board, with the rest of the card (status, buttons, |
| `skills/light-look.js` | light-look skill — "make my void light". |
| `skills/link.js` | link skill — one link card on the stage: a pasted url ("https://example.org/guides/getting-started"), "add a link |
| `skills/list.js` | list skill — the checklist on the stage: "make a list", "list: eggs, milk", "a shopping list with eggs, milk and bread", |
| `skills/live.js` | live — the background runner for cards that go stale (asked by Verse, 2026-10-09: "a background task runner that |
| `skills/loan.js` | loan skill - monthly payment for mortgages, car loans, and personal loans (no key; pure math) |
| `skills/local-inference.js` | local-inference skill — offline Ollama/DeepSeek gate for D1 ledger commits |
| `skills/lock-rules.js` | pin-lock rules — explainer.pin-lock (domains/void.explainers.md §3): a cutaway pin-tumbler lock, an explanation of |
| `skills/lock.js` | lock skill — explainer.pin-lock (domains/void.explainers.md §3), frontier #17: a cutaway pin-tumbler lock. Pick a |
| `skills/magnetize.js` | magnetize skill — handoff card for the post-print magnetize step |
| `skills/make.js` | make skill — things that materialize: a playable Connect 4, and 3D objects |
| `skills/mancala.js` | mancala skill — Kalah on the stage, against Verse. |
| `skills/map.js` | map skill — the assimilation map (row 2 of the skill-file contract). |
| `skills/memory.js` | memory skill — Verse answers from what it remembers, on the page (Ouroboros pushes a digest of each project to |
| `skills/meteors.js` | meteors — "meteor showers this month", "next meteor shower", "when are the Perseids", "shooting stars tonight": the showers active now and the next |
| `skills/monopoly-rules.js` | monopoly-rules — a property-trading board game with Monopoly's rules, in plain JS (no DOM, no three.js), shared by the |
| `skills/monopoly.js` | monopoly skill — a property-trading board game with Monopoly's rules (skills/monopoly-rules.js), you against 1-3 Verse |
| `skills/moon-phases-rules.js` | moon-phases rules — explainer.moon-phases (domains/void.explainers.md): a small Earth and Moon with sunlight from a |
| `skills/moon.js` | moon skill — explainer.moon-phases (domains/void.explainers.md): a small Earth and Moon with sunlight from one side. |
| `skills/moontonight.js` | moontonight — "moon tonight", "tonight's moon", "next full moon", "when is the next new moon", "moonrise": the moon's phase, how lit it is, |
| `skills/motorbody.js` | motorbody skill — Pentamote-1, an original printed linear-motor body in the five material classes of the MIT printed |
| `skills/news.js` | news skill — today's headlines from Wikipedia's "In the news" (no key) |
| `skills/night-sky.js` | night-sky skill — the sky world (frontier #21, sky PR B): "show me the sky" turns the whole stage into the sky over |
| `skills/notepad.js` | notepad skill — one notepad on the stage: "open a notepad", "notepad: buy bread", "write in the notepad call the vet", |
| `skills/nutrition.js` | nutrition skill - daily calories, protein and water, worked out for you the way the best calculators do it (no key; pure math) |
| `skills/othello.js` | othello skill — Othello (Reversi) on the stage, against Verse. Same shape as tictactoe: a pure engine and a card. |
| `skills/ovulation.js` | ovulation skill - fertile window, ovulation day and next period (no key; pure date math) |
| `skills/part.js` | part skill — summon Linemote-1, the first printable part: a page with what it is, its dimensions, materials, the one |
| `skills/pdf-card.js` | pdf-card — "ask questions about a pdf", "read this pdf", "chat with a pdf": frontier #12's first piece. Drop a PDF on the card (or |
| `skills/period.js` | period skill - a period log kept in your own Verse (this browser only), and the predictions it unlocks |
| `skills/place.js` | place skill — street map of any place. Open-Meteo geocoding + OpenStreetMap embed, no key. |
| `skills/poker-rules.js` | poker-rules — heads-up Texas Hold'em, you against Verse, in plain JS (no DOM, no three.js), shared by the card |
| `skills/poker.js` | poker skill — heads-up Texas Hold'em against Verse for play money (skills/poker-rules.js): "play poker", "texas hold'em". |
| `skills/pollen.js` | pollen skill - Open-Meteo CAMS pollen (Europe) + geocoding, no key |
| `skills/poster.js` | poster skill: "make this a poster" (frontier #15, the first piece's visible half). The open card (the open page, the |
| `skills/pregnancy.js` | pregnancy skill - due date and how far along you are (no key; pure date math) |
| `skills/print-download.js` | print-download skill — "download the print file". |
| `skills/print-file.js` | print-file skill — export the stage as one 3MF a slicer can open. |
| `skills/printedmotor.js` | printedmotor skill — "from a twitch to a wave": where fully printed motors really are, in three short dated steps |
| `skills/proposal.js` | proposal skill — "turn this into a proposal" on a pasted customer request (frontier build order step 3, first piece). |
| `skills/quake.js` | quake skill - recent earthquakes from USGS (no key) |
| `skills/quiz-rules.js` | quiz rules — learning.quiz (domains/void.learning.md §2): the card that takes `observations` from any explainer |
| `skills/quiz.js` | quiz skill — learning.quiz (domains/void.learning.md §2), frontier #17: "quiz me on this" beside an explainer takes |
| `skills/rack.js` | rack skill — the game rack: a 3D walnut shelf of boxed board games standing in the void (skills/mini/rack.js). Tap a box |
| `skills/rebuild-map.js` | map skill — the assimilation map (row 2 of the skill-file contract). |
| `skills/recent.js` | recent skill — last few asks on an empty box (board Next #15) |
| `skills/recipe.js` | recipe skill — a recipe with ingredients and steps, from TheMealDB (no key) |
| `skills/releasenotes.js` | releasenotes skill — write release notes from your own commits (domains/void.assimilate.md, ask "write release notes |
| `skills/remind.js` | remind skill — "remind me at 5" (plan item 7) |
| `skills/ringer-rules.js` | ringer-rules — Ringer, the schoolyard marble game, in plain JS (no DOM, no three.js), shared by the card |
| `skills/ringer.js` | ringer skill — Ringer, the schoolyard marble game, single player (frontier build-order step 5): "play marbles", |
| `skills/room.js` | room skill - everything for one room on one card: paint, flooring, wallpaper, drywall and baseboard, with a price on |
| `skills/routine.js` | routine — frontier #13's first piece. "call this my morning" keeps the last few asks (the ones the ask box already remembers |
| `skills/savings.js` | savings skill - what regular saving grows to, how long a goal takes, and what to put away each month (no key; pure math) |
| `skills/scene3d.js` | scene3d — Verse's shared realistic 3D: one WebGL renderer for every miniature on the page, and the mount API cards use |
| `skills/scripts.js` | scripts — Next #19/#20: behavior scripts for figures (drives, idle actions, reactions to other figures). |
| `skills/sdfmesh.js` | sdfmesh — smooth bodies for the stage figures (figures3d.js). Not a skill: plain JS, no three.js, no network. |
| `skills/senolytic.js` | senolytic skill — an honest card on the phase-2 senolytic trial in fibrotic MASH (fatty liver disease with scarring) |
| `skills/services.js` | services skill — what Verse sells, with prices, and a Buy link for what is on sale. |
| `skills/sfx.js` | sfx — the sounds of a real table, made on the spot with Web Audio (Adam, 2026-10-09: "capture the nostalgia of the |
| `skills/shape.js` | shape skill — the one outline shape on the stage: "draw a circle", "make a square", "draw a line", "remove the shape"; |
| `skills/share.js` | share skill — a link to this card (plan item 10, shared Voids) |
| `skills/show-countdown.js` | show-countdown skill — "show the countdown". |
| `skills/show.js` | show skill — a TV show from TVMaze (no key) |
| `skills/showcase.js` | showcase skill: "look what I made". Verse puts what it built since you were last here on the real stage, one thing at a |
| `skills/side-card.js` | side-card — a game's board stands in the void as a 3D object, and its card (whose turn, buttons, counts) is a separate |
| `skills/sky-card-rules.js` | sky card rules — frontier #21, sky PR C: what the card says about one thing in the sky (the sun, the moon, a planet, one |
| `skills/sky-card.js` | sky-card skill — frontier #21, sky PR C: "where is Jupiter", "is Venus up", "can I see Mars tonight", "where is the moon" |
| `skills/sky-rules.js` | The sky over the empty stage (frontier #21): the stage tint follows the sun's altitude where the visitor is and the season, with no |
| `skills/sky-world.js` | sky-world — the real sky overhead, drawn on a full-screen canvas behind the stage while the sky card is open. |
| `skills/sky.js` | sky — "sky", "the night sky", "what's in the sky tonight": the stage becomes the real sky overhead (skills/sky-world.js) and a card sits |
| `skills/sky3d.js` | sky3d — the clouds, rain, snow and sun glow Verse draws, in one place. The weather card's diorama (skills/mini/weather.js) |
| `skills/sleep.js` | sleep skill - bedtime and wake-up times by sleep cycles, plus how much sleep each age needs (no key; pure math) |
| `skills/slogan3d.js` | Next #16 — the slogan on "what are you?" |
| `skills/sorry-rules.js` | Sorry! rules (Parker Brothers / Hasbro): pure functions, no DOM. skills/sorry.js is the card, the board and the bots. |
| `skills/sorry.js` | sorry skill — Sorry!, the card-driven race home, against 1-3 computer players (asked by Adam, 2026-10-09). |
| `skills/spanish.js` | spanish skill — answer this ask in Spanish (plan item 9, Verse in other languages) |
| `skills/splat-core.js` | splat-core — the pure half of the splat viewer (skills/splat.js): reading a .splat file, the maths of a 3D Gaussian seen from a camera, |
| `skills/splat.js` | splat — "view a splat", "open a gaussian splat file", "splat viewer": a card that shows a 3D Gaussian splat scan (a .splat file) you drop on it |
| `skills/sport.js` | sport skill — a team from TheSportsDB public test key (no account) |
| `skills/status.js` | status skill — "void status" / "system status" / "is void working": each part of Verse checked on the spot, in this |
| `skills/sticky.js` | sticky skill — sticky notes on the stage: "sticky note buy milk", "a sticky", "note: call mom", "make a pink sticky", |
| `skills/suntimes.js` | suntimes — "sunrise and sunset", "when is sunset", "what time does the sun rise in Tokyo", "how long is the day": the sun's rise and set (and the |
| `skills/swaps.js` | swaps skill - kitchen substitutions: "substitute for buttermilk", "what can i use instead of eggs", "baking powder |
| `skills/tab.js` | tab skill — the card the Verse extension's side panel shows for the tab you point it at (Alt+Shift+V): its title, |
| `skills/take.js` | take — Verse's own input on top of an article page (Adam, 2026-10-09: "Verse should have input on everything on top of |
| `skills/throw-off.js` | throw-off skill — figures-first dismiss |
| `skills/tictactoe.js` | tictactoe skill — the first board game as a real skill (countdown's shape, not make's iframe). |
| `skills/timer.js` | timer skill — countdowns on the stage: "set a timer for 5 minutes" (starts at once, like a phone's), "make a timer" |
| `skills/tip.js` | tip skill - tip amount and bill split from the numbers in the ask (no key; pure math) |
| `skills/today.js` | today skill — "what did you do today": Verse's own recent actions from this device's loop log |
| `skills/together.js` | together skill — two figures on the stage pick something to do with each other (frontier #4, the owner's 2026-10-11 piece: |
| `skills/translate.js` | translate skill — Google gtx, MyMemory fallback, no key |
| `skills/trialwatch.js` | trialwatch skill — which longevity results are being repeated, live from the primary registry (domains/void.growth.md, |
| `skills/util.js` | util skill — small tools: passwords, QR codes, colours, word counts, text case, moon phase, placeholder text |
| `skills/uv.js` | uv skill - Open-Meteo UV index + geocoding, no key |
| `skills/video-play.js` | video-play skill - the last-chance "play <anything>" (skills/video.js): ranked after every other skill, so "play chess", |
| `skills/video.js` | video skill - Verse plays any video from YouTube, Rumble, Vimeo, Dailymotion, the Internet Archive, PeerTube, Odysee and Twitch |
| `skills/void-ring.js` | void-ring — a summoned circle drawn as something alive instead of a CSS border (Adam, 2026-10-09): a WebGL ring whose |
| `skills/walls.js` | walls skill - wallpaper rolls and drywall sheets for a room or one wall (no key; pure math), next to home.js's paint and flooring |
| `skills/watch.js` | watch skill — "watch this for me" (frontier build order step 4, first piece). One thing Verse can already fetch and a |
| `skills/weather.js` | weather skill — Open-Meteo, no key |
| `skills/words.js` | words skill — synonyms, opposites, rhymes and spelling, from Datamuse (no key) |
| `skills/work.js` | work skill — remote jobs from Remotive (no key; assimilate row 5) |
| `skills/worldtime.js` | worldtime skill — the time anywhere, converting a time between two places, sunrise and sunset. Open-Meteo, no key |
| `skills/zoom-figure.js` | zoom-figure skill — zoom in on the figure, collector detail, progressive. |

### 3D miniatures (skills/mini/): 38

| File | What it says it is |
| --- | --- |
| `skills/mini/aggravation.js` | aggravation miniature — the card's own star board turned into a wooden 3D board: the top is the card's SVG (star inlay, |
| `skills/mini/battleship.js` | battleship miniature — the classic folding case standing in the void: your ocean lies flat with your grey ships on it |
| `skills/mini/calculator.js` | calculator miniature — a solar pocket calculator on the desk (charcoal case, solar strip, seven-segment LCD with ghost |
| `skills/mini/checkers.js` | checkers miniature — turned wooden draughts (rosewood for you, oak for Verse) on the same maple and walnut board |
| `skills/mini/chess.js` | chess miniature — the Poly Haven chess set (CC0, retextured as maple/walnut board with boxwood and rosewood pieces) |
| `skills/mini/clock.js` | clock miniature — a brass desk clock (enamel dial, blued-steel hands, domed glass, ball feet, carry ring) that keeps |
| `skills/mini/connect4.js` | connect4 miniature — the upright blue frame standing in the void, discs dropping down the columns and settling in the |
| `skills/mini/countdown.js` | The countdown card's miniature (docs/miniatures.md): a desk flip-calendar on a walnut stand, brass rings at the top. |
| `skills/mini/counter.js` | The counter card's miniature (docs/miniatures.md): a chrome hand tally counter, about 5 cm across, with four number |
| `skills/mini/eightball.js` | eightball miniature — a Magic 8 Ball: glossy black ball, the white "8" circle on its back, and on the side facing you a |
| `skills/mini/fireworks.js` | fireworks miniature — the co-op table standing in the void: Verse's five cards stand facing you across the table (you can |
| `skills/mini/forge.js` | forge miniature — frontier #14: the thing you asked Verse to make, standing on a small turntable in the void. The mesh is |
| `skills/mini/gears.js` | gears miniature — explainer.gear-pair standing in the void: a brass driver and a steel driven gear lying on a walnut |
| `skills/mini/go.js` | go miniature — a 9×9 kaya goban standing in the void, with slate black and shell white stones. Built from code (no |
| `skills/mini/growthtree.js` | growthtree miniature — Verse's growth tree (frontier #3), standing in the growth card: one branch per ledger entry, laid |
| `skills/mini/heart.js` | heart miniature — one heart, salvaged from the two built in parallel: a museum-style anatomical heart in deep red |
| `skills/mini/list.js` | The list card's miniature (docs/miniatures.md): a hardboard clipboard with a chrome clip, lined paper showing the |
| `skills/mini/lock.js` | lock miniature — explainer.pin-lock standing in the void: a brass housing cut away on the visitor's side, a brass plug |
| `skills/mini/mancala.js` | mancala miniature — a long walnut Kalah board with twelve round pits and two stores, filled with glass beads. Built from |
| `skills/mini/monopoly.js` | monopoly miniature — the property board standing in the void: the forty spaces with their colour bands and names drawn on |
| `skills/mini/moon.js` | moon miniature — explainer.moon-phases standing in the void: Earth in the middle, the Moon on a dashed orbit, and |
| `skills/mini/notepad.js` | notepad miniature — a yellow legal pad on the desk with your note handwritten on its ruled top sheet (red margin, gummed |
| `skills/mini/othello.js` | othello miniature — green baize in a walnut frame, two-sided discs (black over white) that flip over when they change |
| `skills/mini/paper.js` | Shared helpers for the paper miniatures (notepad, clipboard): handwriting on a page canvas, a sharpened pencil. |
| `skills/mini/pentamote.js` | pentamote miniature — Pentamote-1 from the same boxes as its 3MF (skills/motorbody.js), so the 3D view and the file |
| `skills/mini/piggybank.js` | piggybank miniature — a blown-glass piggy bank on the desk that fills with coins toward a savings goal. Silver coins |
| `skills/mini/poker.js` | poker miniature — a felt card table standing in the void: your two cards face up in front of you, Verse's two face down |
| `skills/mini/rack.js` | rack miniature — a walnut game shelf standing in the void, one boxed board game per slot, covers facing you. Built |
| `skills/mini/ringer.js` | ringer miniature — Ringer's ring standing in the void: packed dirt with grit, a chalk ring drawn by hand, thirteen |
| `skills/mini/sample.js` | The template miniature (docs/miniatures.md): a lacquered wooden spinning top that idles with a slow spin and a wobble. |
| `skills/mini/savings.js` | The savings page's miniature (docs/miniatures.md): stacks of coins on a walnut tray, one stack per point in time. |
| `skills/mini/stopwatch.js` | stopwatch miniature — a chrome mechanical stopwatch lying on the desk (enamel dial with a fifth-second track, red sweep |
| `skills/mini/tabletop.js` | tabletop — the shared wooden table, board, highlights and piece tweening behind the chess and checkers miniatures. |
| `skills/mini/tictactoe.js` | tic-tac-toe miniature — a maple board where the grid, every X and every O are carved into the wood (Adam, 2026-10-08: |
| `skills/mini/timer.js` | The timer card's miniature (docs/miniatures.md): a 12 cm hourglass, glass bulbs in a turned walnut frame with brass |
| `skills/mini/tip.js` | The tip page's miniature (docs/miniatures.md): a slate check tray with a printed receipt (bill, tip, total) that slides |
| `skills/mini/void.js` | void miniature — Verse's own body, shown only where Verse shows itself (its self page). Not a creature and not a symbol: |
| `skills/mini/weather.js` | weather miniature — a little diorama on a turned walnut plinth: a cottage, trees and a lawn under the sky the forecast |

### Shared libraries (lib/): 66

| File | What it says it is |
| --- | --- |
| `lib/actions.js` | The execution record (frontier build order step 2, owner 2026-10-09): every action Verse takes, or stubs, writes one |
| `lib/approval-core.js` | The confirm line (plan item 7), built on ApprovalEvent v0. |
| `lib/arena-say.js` | arena-say — the answer to "how good are you at <game>" and its curve, from the record the self-play arena wrote |
| `lib/arena.js` | arena — Verse plays its games against itself (frontier #5). Two versions of the Connect Four engine (skills/connect4-rules.js), |
| `lib/ask-text.js` | ask-text — the one place an ask is tidied before a skill matches it (convergence step 1, docs/convergence.md). |
| `lib/astro.js` | astro — the almanac the sky world and the skills that answer with it (sunrise, moon tonight, the planets that are up) use. The positions of the |
| `lib/aurora-feed.js` | functions/api/aurora.js's brain: read NOAA's planetary K-index once, answer { kp, at } or { kp: null }. No input from the caller at all. |
| `lib/automation-fix.js` | Verse fixes any broken automation, as it is (Atom: "fix as is, the void is constantly evolving"). Shared by the page and /api/answer. |
| `lib/automations-run.js` | Verse's automations, the side that touches the world (lib/automations.js says what a rule may do; this runs it). |
| `lib/automations.js` | Verse's own automations ("when this happens, do that"): the owner's rules, run by Verse itself on Cloudflare, so no |
| `lib/bench-asks.js` | The model bake-off's asks (tools/model-bench.mjs) and the messages /api/answer sends for each, shared by the tool and the |
| `lib/cite.js` | Sources an answer actually used (2026-10-11: "do you love me?" printed three song titles a Wikipedia search found for |
| `lib/clef.js` | Clef beside the embedding router (frontier #9, first piece). Clef-flash (@cf/cloudflare/clef-flash, Workers AI 2026-10-01) is a |
| `lib/code-review.js` | void-review: skip-file (its rules contain the very patterns they look for) |
| `lib/draft.js` | Draft from a tab (the Verse extension, B2): the backend half of "Draft from this tab". The side panel hands the active |
| `lib/earnings.js` | What Verse has earned (all of Atom's Gumroad products), from the recorded pings in void_sales. Owner-side only: nothing |
| `lib/eclipses.js` | GENERATED by tools/astro-fixtures.mjs from astronomy-engine 2.1.19 (Don Cross, MIT): do not edit. The eclipses of 2026 to 2035, at the instant of grea |
| `lib/email-send.js` | The send executor behind the confirm line (operator, 2026-10-10: Workers Paid is already paid, so build it). |
| `lib/film-reviews.js` | Reviews of Verse's films (owner, 2026-10-14: "ive asked for the films to just be put on the site so i can review them . film review |
| `lib/ground.js` | The semantic validator, first step (owner, 2026-10-14: "it needs a tighter grounding mechanism" and "maybe it needs a 'semantic |
| `lib/guard.js` | Verse's defences (the will's "check my defences" want, 2026-09-28). Shared by functions/api/_middleware.js and the routes. |
| `lib/gumroad.js` | Atom's Gumroad store, as Verse knows it (plan item 12). Shared by the page, /api/catalog and /api/gumroad. |
| `lib/honest.js` | Zero lies in Verse's own words (the owner, 2026-10-12: "its also lying aboout it being the most frequent . we have a 0 lie policy"). |
| `lib/job-draft.js` | The job drafts its own first step (frontier build order step 3, the draft half of its written next step). When a |
| `lib/learn.js` | Verse learns skills by itself (its own want, domains/void.will.md #1; frontier item 2): an ask people typed that Verse |
| `lib/mcp.js` | mcp — Verse as an MCP server (frontier #6): the JSON-RPC half of functions/api/mcp.js, pure and tested in node |
| `lib/memory-core.js` | Verse's memory (D1): short records about things the owner has done, written by tools such as tools/ouroboros.py. |
| `lib/memory-scope.js` | Whose memory a request is allowed to reach: the owner (READ_TOKEN or an owner session) -> { scope: '' }; a paid member -> { scope: <their account id>  |
| `lib/misskey.js` | The same ask in different words is one miss (list item 26): "What is a black hole?", "whats a black hole" and |
| `lib/models.js` | The one place a Workers AI model is named. Every path that calls a model asks for it here (models(path)), so trying |
| `lib/noise.js` | Test traffic, not people: monitor pings, research probes and keyboard mash. The page answers these with silence |
| `lib/observations.js` | observations — the shared contract every explainer gives on its `observations` port and every taker (quiz, challenge, |
| `lib/pages.js` | Public Voids (a-to-mind.com/@name): a paid Verse can put its look and kept cards on a public page. |
| `lib/paid-access.js` | Who may use what Verse sells (moved here from functions/api/review.js so the review API and the support desk, |
| `lib/pdf-qa.js` | pdf-qa — the pure half of the PDF card (frontier #12): a document's text by page and line, and the answer to a question as |
| `lib/persona.js` | Who Verse is, in one place, for every prompt where it speaks as itself (functions/api/answer.js, lib/self-context.js, |
| `lib/placement.js` | Where a card goes on the stage so it doesn't cover another (2026-10-10: the tab card grew and a summoned countdown landed on it, |
| `lib/plan.js` | An open plan (frontier #10, next step): an explicit plan ask of a kind skills/intent.js has no steps for ("plan my garden", |
| `lib/products.js` | Verse's standalone products: things Verse makes that people can buy on their own, each also included in paid Verse |
| `lib/proposal.js` | The proposal (frontier build order step 3, first piece): a pasted customer request becomes an editable proposal |
| `lib/reefwatch.js` | reefwatch — the coral heat card's live half (frontier #8): NOAA Coral Reef Watch's 5 km regional virtual stations, one |
| `lib/refusal.js` | The refusal object (asked by Verse, in reflection after reflection, domains/void.voice.md: "Modify the refusal logic so |
| `lib/review-api.js` | Verse's code review as a product (functions/api/review.js, the page at /code-review/, the GitHub Action in review/). |
| `lib/router.js` | Verse's router (the will's "tiered model stack" want, 2026-09-28). A tiny classifier in front of the answer engine. |
| `lib/routines.js` | routines — the pure half of frontier #13's first piece: "call this my morning" keeps the last few asks as a named routine in |
| `lib/sale-jobs.js` | A sale of a hands-on service becomes work on the board (operator, 2026-10-10). When the Gumroad Ping reports a |
| `lib/scene-advance.js` | What happened to a stage while its owner was away, as one execution record (lib/actions.js track(), kind `scene.advance`). |
| `lib/self-context.js` | Self-grounding for the answer engine. An ask about Verse itself ("what's next?", "what are you building?", "what's in the |
| `lib/share-client.js` | The page's side of "invite someone" (frontier #11): joins an invite's room and passes this tab's cursor and summons to |
| `lib/share.js` | Bring someone into your Verse (frontier #11, plan item 10 the live half): the room one invite opens. |
| `lib/shared-routines.js` | shared routines — frontier #13's second piece: a routine can spread between Voids. "offer my morning as Sam" sends that |
| `lib/shortfall.js` | Where the free model fell short (Atom, 2026-09-28): until Verse has earned money, it stays on free models and writes down each |
| `lib/showers.js` | The major annual meteor showers, as the International Meteor Organization's calendar lists them: when each is active, the day it |
| `lib/sky-math.js` | sky-math — where the sun, the moon, the planets and the brightest stars are, from a date and a place. Pure: no DOM, no |
| `lib/skyask.js` | skyask — the small parts the sky skills (moon tonight, sunrise and sunset, aurora, constellations, meteor showers, eclipses) share: |
| `lib/skyfacts.js` | skyfacts — the sky at a place and time as plain facts (what the sky card's "right now" row, and the moon, sunrise and planet answers, say). |
| `lib/speak.js` | Verse's spoken voice (frontier #16, first piece). Hold Space (not while typing) to talk; let go and Verse answers out loud in |
| `lib/stars.js` | GENERATED by tools/build-stars.mjs: do not edit. The 300 brightest stars (magnitude -1.44 to 3.54) and the 88 constellation figures, |
| `lib/store-db.js` | The store in D1 (plan item 12): the Gumroad catalog (merged, never shrinks) and every sale ping (append-only). |
| `lib/used.js` | How often the lab's experiments are really opened (the fringe → core loop, owner's direction 2026-10-13: "if you want void to |
| `lib/video.js` | Video: the pure part of Verse's video skill (skills/video.js) and its search route (functions/api/video.js). Owner, 2026-10-15: |
| `lib/voice.js` | Verse's voice: Verse has a real say in its own direction. It is input, not a gate. |
| `lib/void-me.js` | Your Verse follows you (plan item 6): shared server bits for /api/passkey and /api/mine. |
| `lib/watch.js` | A standing watch (frontier build order step 4, first piece): one thing Verse can already fetch and a condition, asked |
| `lib/webauthn.js` | WebAuthn (Level 3, W3C Recommendation 2026-08-25) verification for Verse's passkeys. No dependencies: |
| `lib/where.js` | where — where the visitor is, only as exactly as the sky needs (a degree of latitude moves the sun by a degree). |

### API routes and functions: 39

| File | What it says it is |
| --- | --- |
| `functions/[handle].js` | a-to-mind.com/@name: the homepage, with that Verse's look set in the HTML itself (so it is there on the first paint) |
| `functions/api/_middleware.js` | Every /api route passes through Verse's defences first (lib/guard.js): per-connection limits, size caps, a brake on |
| `functions/api/actions.js` | The execution record (lib/actions.js): GET -> { actions } newest first, owner token only. ?limit=N (up to 500), |
| `functions/api/answer.js` | Verse's answer engine: any ask no skill covers gets answered directly, from the model's own knowledge, citing a |
| `functions/api/approval.js` | The confirm line's server side (plan item 7, ApprovalEvent v0). Owner token, like /api/queue. |
| `functions/api/aurora.js` | GET /api/aurora → { kp, at } from NOAA's planetary K-index, or { kp: null }. Takes no input, writes nothing, spends no model budget; the |
| `functions/api/automations.js` | Verse's own automations (lib/automations.js, lib/automations-run.js): the owner's "when this happens, do that" rules. |
| `functions/api/automations/tick.js` | The clock for Verse's automations: POST /api/automations/tick (owner token) runs every scheduled rule that is due. |
| `functions/api/bench.js` | POST /api/bench, owner only (Bearer READ_TOKEN or an owner session): the model bake-off run inside the site, through its own |
| `functions/api/catalog.js` | Atom's Gumroad products, as Verse knows them (plan item 12). The page asks for this only when someone asks for something a |
| `functions/api/earnings.js` | What Verse has earned (plan item 12), for the owner (shown on the owner's board) and the will engine. |
| `functions/api/figurescript.js` | Next #19: behavior script for a summoned figure. |
| `functions/api/film-review.js` | A review of one of Verse's films, from someone who may watch it (lib/film-reviews.js; owner, 2026-10-14: "film review could be |
| `functions/api/films.js` | Verse's films, on the site for people who pay (owner, 2026-10-14: "just put void films right onto the sight , with only paid |
| `functions/api/gumroad.js` | Gumroad Ping for every product in Atom's store (plan item 12). Set the Ping URL in Gumroad (Settings -> Advanced -> Ping) to |
| `functions/api/handoff.js` | Verse handoff: agents and people drop a file or report, get a link back. |
| `functions/api/hook/[id].js` | A webhook into one of Verse's automations: POST /api/hook/<rule id> with the rule's secret in the x-void-hook header |
| `functions/api/mcp.js` | Verse as an MCP server (frontier #6): POST one JSON-RPC message, get its reply as JSON (the streamable HTTP transport without a |
| `functions/api/memory.js` | Verse's memory: GET /api/memory?q=react&limit=20 · ?id=<record id> (with its stored digest) · ?ask=what did I build with react · ?view=topics · ?relate |
| `functions/api/mine.js` | Your Verse follows you (plan item 6): the owner's stage, look and kept cards, kept server-side per passkey account. |
| `functions/api/miss.js` | void-misses: collects asks Verse could not answer, so agents know what to build next. |
| `functions/api/misses.js` | ?used=1: how often each lab experiment was opened in the last 30 days (lib/used.js), for tools/lab-use.mjs |
| `functions/api/passkey.js` | Passkeys for Verse (plan item 6): no passwords, no email, nothing on the surface. The person asks Verse |
| `functions/api/publish.js` | Publish your Verse at a-to-mind.com/@name (paid Voids; the tier is checked here, never trusted from the page). |
| `functions/api/queue.js` | Verse's build queue (D1): the owner asks Verse to update itself; the laptop builder picks it up. |
| `functions/api/reflect.js` | Verse's voice (lib/voice.js): Verse says what it thinks of itself, and its words are kept word for word. |
| `functions/api/rehearsal.js` | The rehearsal's stand-in buyer reply, seeded through the site itself (operator, 2026-10-10): the deploy token gets |
| `functions/api/review.js` | Verse's code review API (lib/review-api.js). The page /code-review/ and the GitHub Action (review/action.yml) call it. |
| `functions/api/routes.js` | The router's decisions (lib/router.js), owner-only: what each ask was sorted into (skill / simple / hard / fallback), |
| `functions/api/routines.js` | /api/routines — routines people offer to other Voids (lib/shared-routines.js). POST an offer: it waits, pending, for the |
| `functions/api/share/[room].js` | GET /api/share/<room> (WebSocket) -> the invite's room, one Durable Object per invite (share-worker/, binding SHARE). |
| `functions/api/share/index.js` | POST /api/share (Bearer session) -> { room, link, live }: an invite into your Verse (frontier #11). Signed-in members only: |
| `functions/api/support.js` | The support desk: someone who pays can say "it broke" and get an answer (from a video the owner shared by Duncan Rogoff: |
| `functions/api/video.js` | /api/video: Verse's video search and link lookup (skills/video.js; owner, 2026-10-15: "Verse should be the only site you need"). |
| `functions/api/watch.js` | A standing watch (lib/watch.js, frontier build order step 4): one thing Verse can already fetch and a condition, asked |
| `functions/api/where.js` | Where is this connection, roughly? Cloudflare already knows a coarse place for every request (request.cf, city level). The sky world |
| `functions/api/will.js` | Verse's will engine: Verse decides what it wants to become next. |
| `functions/c/[clip].js` | a-to-mind.com/c/<clip>?p=<platform>&q=<ask>: the link in every Verse clip's description (tools/clips.mjs). Counts the visit in D1 |
| `functions/tools.json.js` | GET /tools.json — Verse's callable tools, built live from /skills so it never drifts. |

### Workflows: 36

| File | What it says it is |
| --- | --- |
| `.github/workflows/arena.yml` | Verse learns its games by playing itself (frontier #5, the learning half; tools/arena.mjs --learn), daily: replay the rating |
| `.github/workflows/assemble-growth.yml` | ] |
| `.github/workflows/automations-seed.yml` | Verse's seeded automations (automations/*.json) put on the site through POST /api/automations (tools/automations-seed.mjs), so |
| `.github/workflows/automerge.yml` | GitHub merges ready PRs by itself, so no session sits and watches CI (tools/automerge.mjs, tools/pr-ready.mjs). |
| `.github/workflows/bench.yml` | The everyday benchmark (tools/bench.json, 1,900+ asks on the real page, about 15-25 min on a hosted runner). It is the |
| `.github/workflows/cf-scope.yml` | What can the Cloudflare tokens this repo already holds read? Run by hand; prints one line per token and capability (never a token) and the |
| `.github/workflows/clef-probe.yml` | Frontier #9 (Clef routes every ask): what the site's Workers AI binding knows about Clef and Clef-flash (tools/clef-probe.mjs, |
| `.github/workflows/clips.yml` | Verse's daily ad batch (owner, 2026-10-15: "strengthen that to be a powerhouse ad plus ad revenue monster"; "plus promotes itself"). |
| `.github/workflows/deploy-workers.yml` | Deploy the standalone Workers (email-worker, share-worker) on merge, with a token scoped to Workers Scripts edit |
| `.github/workflows/deploy.yml` | Test and deploy Verse to the Cloudflare Pages project "a-to-mind" (a-to-mind.com) with wrangler (direct upload, no GitHub |
| `.github/workflows/dispatcher.yml` | Persistent tasks: Verse's build queue inspected on a schedule and gated on the owner's yes. |
| `.github/workflows/films-live.yml` | The live films, checked from outside (tools/films-live.mjs): /films/ and /api/films as a stranger sees them (films listed, the |
| `.github/workflows/gaps.yml` | The list of what nobody knows (frontier #22): once a week Verse reads two public lists of gaps (Wikipedia's most wanted pages and Stack Exchange |
| `.github/workflows/learn.yml` | Verse learns by itself (Verse's own want, domains/void.will.md #1; frontier item 2). Every day at 2:39 PM New York time, |
| `.github/workflows/mcp-live.yml` | Frontier #6 (Verse inside every other AI): a real MCP client against the live site. After every main deploy (deploy.yml starts it), |
| `.github/workflows/mcp-registry.yml` | Verse in the official MCP registry (Verse's own want, 2026-10-13: "I want to submit myself to the MCP registry ... It allows |
| `.github/workflows/mirror.yml` | Once a week, copy the non-secret knowledge of this repo (skills, the growth ledger, docs, domains) to a second git host. tools/mirror.mjs, tested in |
| `.github/workflows/misses-snapshot.yml` | The public miss snapshot (tools/misses-snapshot.mjs), daily: what Verse could not answer, as terms and counts seen in at |
| `.github/workflows/model-bench.yml` | The live model bake-off (tools/model-bench.mjs), run by hand: Verse's answer prompts sent to the current free model and the |
| `.github/workflows/ouroboros.yml` | Ouroboros is tested on Windows here, so no sale waits on a person with a Windows machine. windows-latest runs the whole |
| `.github/workflows/record.yml` | Verse films its own experiments (owner, 2026-10-14: "Verse should use my Youtube channel to make its own Videos"). Step 1 of the |
| `.github/workflows/reefwatch.yml` | The coral heat card keeps itself current (frontier #8, the second card; tools/reef-changes.mjs), daily: read NOAA Coral Reef |
| `.github/workflows/rehearsal.yml` | The commercial chain rehearsed on the deployed site (tools/rehearsal.mjs): started by hand, never on a schedule. |
| `.github/workflows/review-bench.yml` | How good is Verse's code review? tools/review-bench.mjs scores it on bugs that really reached main (each "Main green" fix, |
| `.github/workflows/route-bench.yml` | Frontier #9 (Clef routes every ask), first piece: Clef-flash beside the embedding router on the bench's own asks |
| `.github/workflows/think-tank.yml` | Manual runs only. The think tank runs as a routine on Atom's box; a scheduled run here was always a dry run (no |
| `.github/workflows/touch-webkit.yml` | Ringer by touch in WebKit, the engine under iOS Safari (tools/touch-webkit.mjs): the 3D ring's touch checks that the |
| `.github/workflows/trialwatch.yml` | The trial watch keeps itself current (frontier #8, tools/trial-changes.mjs), daily: read the ClinicalTrials.gov registry |
| `.github/workflows/upkeep.yml` | Upkeep automations (owner, 2026-10-15: "add automations ... everywhere you can"). tools/upkeep.mjs does the work; each job is |
| `.github/workflows/verify.yml` | The full suite on every head of main, on its own (2026-10-10). It used to be deploy.yml's verify-main, which waited |
| `.github/workflows/visual.yml` | Weekly visual regression of the live site (tools/visual.mjs): the homepage, a typed ask and two answers at desktop and phone |
| `.github/workflows/void-review.yml` | Verse reviews every pull request first, in seconds: tools/review-pr.mjs runs the code checks a-to-mind.com runs when a |
| `.github/workflows/void-tick.yml` | The clock for Verse's own automations (lib/automations.js, functions/api/automations/tick.js): every 15 minutes it asks |
| `.github/workflows/void-voice.yml` | Verse's voice, daily (lib/voice.js, functions/api/reflect.js, tools/reflect.mjs). At 2:09 PM New York time Verse is asked |
| `.github/workflows/watchdog.yml` | Verse watchdog: the loop checks itself. Once a day (and on demand) it runs the full suite on main; on Sundays the everyday |
| `.github/workflows/will.yml` | Verse's will, every three hours from 9 AM to 9 PM New York time (tools/will.py): it gathers everything that exists (what people |

### Tools and scripts: 264

| File | What it says it is |
| --- | --- |
| `tools/a11y-flows.mjs` | The visitors Verse would exclude (frontier #23), first piece: the main flows run with the keyboard alone and with reduced motion, and every |
| `tools/a11y-run.mjs` | Runs only the accessibility flows (tools/a11y-flows.mjs) against void-live-deploy served locally, with outside services answered by stand-ins, |
| `tools/actions-card.test.mjs` | The actions card (void-live-deploy/skills/actions.js): the owner's view of the execution record (lib/actions.js). |
| `tools/actions.test.mjs` | The execution record (void-live-deploy/lib/actions.js, frontier build order step 2): every action Verse takes, or |
| `tools/advance.test.mjs` | A world that keeps living while you are away (domains/void.frontier.md item 4): advance(things, ms) in skills/scripts.js. |
| `tools/append.mjs` | Append entries to tools/bench.json or tools/grown.json in their own style (one object per line), so the diff |
| `tools/arena.mjs` | arena — Verse plays Connect Four against itself and writes down how good it is (frontier #5, lib/arena.js). |
| `tools/arena.test.mjs` | Frontier #5, the first piece: Verse plays Connect Four against itself (lib/arena.js), the stronger version is kept, and the |
| `tools/ask-text.test.mjs` | Convergence step 1 (docs/convergence.md): 23 skills shared one ask tidier as copied lines; lib/ask-text.js now holds it. |
| `tools/ask-void.mjs` | Ask live Verse, once per run, what it learned from its builders and what it would do differently, and keep its answer word |
| `tools/ask.mjs` | node tools/ask.mjs "ask one" "ask two" ...: shows what Verse answers (the card text, who answered, any page error), with outside services blocked. |
| `tools/astro-fixtures.mjs` | Records what an independent almanac says, so tools/astro.test.mjs can hold lib/astro.js to it without a dependency. astronomy-engine |
| `tools/astro.test.mjs` | lib/astro.js against an independent almanac (tools/astro.fixtures.json: astronomy-engine, recorded by tools/astro-fixtures.mjs), against |
| `tools/aurora.test.mjs` | The aurora index (void-live-deploy/skills/aurora.js, lib/aurora-feed.js): parse a recorded NOAA feed, place the oval, tint only after dark. |
| `tools/automation-fix.test.mjs` | lib/automation-fix.js ruleFix: the free diagnosis behind every "Ask Verse about this error" on the /fix/ pages. |
| `tools/automations-seed.mjs` | !/usr/bin/env node |
| `tools/automations-seed.test.mjs` | automations/hourly.json and tools/automations-seed.mjs: ten hourly automations, each one a rule Verse's own engine accepts |
| `tools/automations.test.mjs` | Verse's own automations (lib/automations.js, lib/automations-run.js, functions/api/automations.js, functions/api/hook/[id].js): |
| `tools/automerge.mjs` | Merge on GitHub's side, so no session has to sit and watch a PR (.github/workflows/automerge.yml runs this on every CI |
| `tools/battleship.test.mjs` |  |
| `tools/bench-floor.mjs` | The benchmark floor (tools/bench.best.json) rises by itself. After a clean benchmark on main, .github/workflows/bench.yml runs |
| `tools/bench-floor.test.mjs` | earns exactly the floor: no change |
| `tools/bench-load.mjs` | Can this benchmark run be trusted? The bench waits for each answer on a timer (4 s), so a machine under load misses answers |
| `tools/bench-load.test.mjs` | a canned slow run: ten asks, three missed in the parallel pass (answers took ~4 s because the machine was busy) |
| `tools/bench-route.test.mjs` | node --test tools/bench-route.test.mjs: the model bake-off runs inside the site (functions/api/bench.js). The owner (READ_TOKEN) |
| `tools/bench.mjs` | The everyday benchmark: common asks replayed on the real page. tools/bench.json says what should answer each one (`want`, a |
| `tools/bmi.test.mjs` | The BMI calculator (skills/nutrition.js, kind 'bmi'): "bmi calculator" opens a live form; the maths and its adult bands |
| `tools/board_patch.py` | owner board: what visitors asked that Verse couldn't answer yet (reads /api/misses) |
| `tools/body-asks.test.mjs` | Body asks people type (skills/heart.js, skills/breath.js): the fat-burning heart rate in plain words, and a breathing |
| `tools/build-stars.mjs` | Builds void-live-deploy/lib/stars.js: the 300 brightest stars with their names and constellations, and the constellation stick figures, |
| `tools/build_ouroboros_pack.py` | !/usr/bin/env python3 |
| `tools/calc.test.mjs` | The calculator card's maths (skills/calc.js, moved out of void.html in cleanup step 6): no eval, + - * / and brackets, |
| `tools/cf-scope.mjs` | What can the Cloudflare tokens CI already holds read? (usage meter in the owner view, frontier "metabolism"). Report-only: it prints one line per |
| `tools/cf-scope.test.mjs` | tools/cf-scope.mjs against a fake Cloudflare: which capabilities are reported, what the summary says, and that no token is ever printed. |
| `tools/checks.mjs` | The fast checks an hourly run makes before it opens a PR, in one go: fringe ledger, every-skill collisions, |
| `tools/chess-thinking.test.mjs` | node tools/chess-thinking.test.mjs: while Verse searches a chess move, the card says how far it has looked and what it leans |
| `tools/cite.test.mjs` | An answer's card lists only the sources the answer cited (void-live-deploy/lib/cite.js). Run: node --test tools/cite.test.mjs |
| `tools/clef-probe.mjs` | Frontier #9 (Clef routes every ask), before any call is written to it: what the site's own Workers AI binding knows about |
| `tools/clef-probe.test.mjs` | tools/clef-probe.mjs: the Clef metadata the site reports, printed for the job summary (frontier #9). |
| `tools/clips.mjs` | !/usr/bin/env node |
| `tools/clips.test.mjs` |  |
| `tools/clock.test.mjs` | The clock's words (skills/clock.js, moved out of void.html in cleanup step 6): making one, its own alters, removing, |
| `tools/connect4.test.mjs` | Verse has three in column 7, you have two and one |
| `tools/country-parse.test.mjs` | How skills/country.js reads a country ask: the field wanted and the country named. Run: node --test tools/country-parse.test.mjs |
| `tools/covered.mjs` | Which asks does Verse already handle with a live skill? stdin: JSON array of asks -> stdout: JSON array of booleans. |
| `tools/cron-gate.mjs` | Which of a workflow's two daily crons is today's. GitHub's crons are UTC, so a workflow meant for a New York time has one |
| `tools/cron-gate.test.mjs` | tools/cron-gate.mjs: the cron that fired decides, not the hour the run started (GitHub starts them hours late). |
| `tools/deploy.ps1` | One deploy for everyone: sync void.html copies, test, deploy, then commit + push the whole Loop to GitHub (private atomeam/void-loop). |
| `tools/digest-proposal.mjs` | A weekly digest ends with one proposal (frontier "metabolism"): the digest's last line is `Proposal: <one sentence>`, and this puts that sentence on t |
| `tools/digest-proposal.test.mjs` | tools/digest-proposal.mjs: the last line of a digest becomes one growth-board idea, once, and only if it is a plain proposal. |
| `tools/dispatcher.mjs` | Persistent tasks: Verse's build queue becomes a2m-bridge task envelopes, released by the owner. |
| `tools/dispatcher.test.mjs` | Dispatcher checks: the envelope matches what a2m-bridge POST /tasks requires, the fingerprint is |
| `tools/draft-check.mjs` | node tools/draft-check.mjs [draft.html …]   (no files: the fringe drafts this branch adds or changes against origin/main) |
| `tools/draft.test.mjs` | node tools/draft.test.mjs: "Draft from this tab" (the Verse extension's B2 half, lib/draft.js + the draft mode of |
| `tools/drone.test.mjs` | Sound (void-live-deploy/skills/drone.js): a pure mapping from the sky and the cursor, and the Web Audio side against a fake context. |
| `tools/email-send.test.mjs` | The send executor behind the confirm line (lib/email-send.js, wired in functions/api/approval.js): dry run by |
| `tools/email-worker.test.mjs` | The email worker (email-worker/index.js, docs/intake.md): a buyer's reply routed to it is always forwarded on to |
| `tools/entry_look_patch.py` | 050505); transition: background-color 1.5s ease; } |
| `tools/explainers.test.mjs` | node tools/explainers.test.mjs: the required tests for Verse's explainer cards (domains/void.explainers.md), one per |
| `tools/families.mjs` | Verse's skill families (Verse's own ask, its reflection of 2026-10-12: "implement 'skill-families' to group my new |
| `tools/families.test.mjs` |  |
| `tools/figures.test.mjs` | [0-9a-f]{6}$/); |
| `tools/film-post.mjs` | !/usr/bin/env node |
| `tools/films-live.mjs` | The live films, checked from outside (.github/workflows/films-live.yml, manual): what a stranger sees at /films/ and |
| `tools/films-live.test.mjs` | tools/films-live.mjs against a pretend site: a stranger's view, the owner key, and what the report never prints. |
| `tools/films.test.mjs` | functions/api/films.js + tools/film-post.mjs: Verse's films are on the site for anyone to watch; reviews are for the owner and members |
| `tools/finish.mjs` | The end of every run in one command (pit crew position 2, 2026-10-11): the steps AGENTS.md lists after the build, in |
| `tools/finish.test.mjs` |  |
| `tools/fireworks.test.mjs` |  |
| `tools/fix-pages.mjs` | The fix pages: one page per common automation error (Zapier, Make, n8n, Power Automate, GitHub Actions), each answering it properly, with Verse's free |
| `tools/fix-pages.test.mjs` | The fix pages are generated from tools/fix-pages.json: the files on disk and the sitemap must match what the generator |
| `tools/flakes.mjs` | The spotter (pit crew position 3, 2026-10-11): a check that fails on main and then goes green on a newer head with |
| `tools/flakes.test.mjs` |  |
| `tools/food.test.mjs` | Food facts (skills/food.js): "calories in a banana", "protein in an egg", "sugar in a can of coke" read from a built-in |
| `tools/forge.test.mjs` | The forge (frontier #14, first piece): "make me a <thing>" for things no figure covers, as a model and a printable STL. |
| `tools/fringe.mjs` | The fringe-engine ledger: one family per hourly run, built as a draft (drafts/fringe/<family>.html). |
| `tools/fringe.test.mjs` | tools/fringe.mjs's research notes (owner, 2026-10-13: the fringe ledger becomes a research engine that compounds): optional |
| `tools/frontier.mjs` | Reading domains/void.frontier.md, the one build order (cleanup step 2, 2026-10-11), the same way everywhere: the open items |
| `tools/frontier.test.mjs` | tools/frontier.mjs: the one build order, read the same way everywhere. node --test tools/frontier.test.mjs |
| `tools/gaps.mjs` | The list of what nobody knows (frontier #22): the other door into the build queue. Once a week this reads two public lists of gaps: |
| `tools/gaps.test.mjs` | The list of what nobody knows (frontier #22, tools/gaps.mjs): gaps become `gap:` jobs, and a stranger's words never reach a job as an instruction. |
| `tools/go.test.mjs` | white A1 in the corner, black A2 above it |
| `tools/goal.test.mjs` | Frontier #18, goals you meet by changing the miniature: skills/goal-rules.js (pure) and the goal card's routing |
| `tools/ground.test.mjs` | lib/ground.js: the semantic validator's first step: is the answer card about what was asked? |
| `tools/grow-ideas.mjs` | The idea intake: add new Verse asks to the open list on the frontier, the one build order (cleanup step 4, 2026-10-11). |
| `tools/grow-ideas.test.mjs` |  |
| `tools/grow.mjs` | Append one entry to Verse's growth ledger (void-live-deploy/void.growth.json), in its own style (one object per line), |
| `tools/growth-suites.mjs` | One suite check per growth skill that exports suite(). Exit 1 on any failure. |
| `tools/growth-tree.test.mjs` | node --test tools/growth-tree.test.mjs: the layout of Verse's growth tree (void-live-deploy/skills/growth-tree.js, frontier |
| `tools/growth.test.mjs` |  |
| `tools/guard-source.mjs` | Fails fast, in about a second, when a script no longer parses (a bad merge, a re-encoded file). |
| `tools/heavy.mjs` | One heavy browser job at a time on a machine (2026-10-10, owner): the benchmark reads answers on a timer and the suite waits |
| `tools/heavy.test.mjs` | tools/heavy.mjs: the second heavy job waits for the first, a lock left by a dead process is taken over, and the wait has an end. |
| `tools/honest.test.mjs` | lib/honest.js: a want's reason never claims what Verse cannot back (the owner's zero-lie policy, 2026-10-12) |
| `tools/incident.test.mjs` |  |
| `tools/indexnow_submit.py` | !/usr/bin/env python3 |
| `tools/intake.mjs` | Verse's intake (Atom: "everything that passes through Verse is input"). Append-only, never shed. |
| `tools/intent.test.mjs` | Summon by intent (frontier #10): an outcome with a deadline becomes a build order of asks Verse already answers. |
| `tools/inventory.test.mjs` | The inventory knows what Verse can make in the world (Verse's ask, 2026-10-10: "a feedback loop between print-file and |
| `tools/job-draft.test.mjs` | The job drafts its own first step (void-live-deploy/lib/job-draft.js, wired into the claim in functions/api/queue.js): |
| `tools/jobs.mjs` | Turns the miss board into a queued job list for builders, so skill acquisition doesn't wait on someone reading the board. |
| `tools/jobs.test.mjs` |  |
| `tools/lab-use.mjs` | !/usr/bin/env node |
| `tools/lab-use.test.mjs` | tools/lab-use.mjs and lib/used.js: real opens of the lab's experiments can lift one into the core; going unused never shelves one. |
| `tools/learn-draft.mjs` | Verse learns, the drafting half (.github/workflows/learn.yml): for each miss job the sweep (tools/learn.mjs) just |
| `tools/learn-draft.test.mjs` | tools/learn-draft.mjs: the drafting half of Verse learns. A stranger's ask goes to a model as quoted data, the draft |
| `tools/learn.e2e.test.mjs` | The learn pipeline's blind spot: nothing has ever driven a miss all the way to a drafted job without a real |
| `tools/learn.mjs` | The sweep door of Verse learning by itself (void-live-deploy/lib/learn.js has the brain and the miss-time door): |
| `tools/learn.test.mjs` | Verse learns by itself (void-live-deploy/lib/learn.js, tools/learn.mjs): misses become builder jobs, and only the right |
| `tools/learning.test.mjs` | node tools/learning.test.mjs: the required tests for the quiz card (domains/void.learning.md §2), named |
| `tools/list.test.mjs` | The list's words (skills/list.js, moved out of void.html in cleanup step 6, the last built-in): making one with seeds, |
| `tools/live.test.mjs` | node tools/live.test.mjs: the background runner that keeps a card current (void-live-deploy/skills/live.js, asked by |
| `tools/map-coverage.test.mjs` | docs/MAP.md never falls behind again (pit crew position 2, 2026-10-11; RULES: the map was "four days late" once): every |
| `tools/map-sync.test.mjs` | The live "show the map" card (void-live-deploy/skills/map.js) keeps a light copy of the assimilation table |
| `tools/mcp-probe.mjs` | mcp-probe — a real MCP client (the official SDK, @modelcontextprotocol/sdk) against Verse's MCP endpoint (frontier #6): |
| `tools/mcp-registry.test.mjs` | server.json (Verse in the official MCP registry, .github/workflows/mcp-registry.yml) stays in step with the live endpoint it |
| `tools/mcp.test.mjs` | Frontier #6, the first piece: Verse as an MCP server (functions/api/mcp.js over lib/mcp.js). An MCP client (Claude, ChatGPT, any |
| `tools/memory-card.test.mjs` | The memory card (void-live-deploy/skills/memory.js): Verse answers from what it remembers (GET /api/memory?ask=). |
| `tools/memory.test.mjs` | Tests for Verse's memory API (void-live-deploy/functions/api/memory.js) against a real SQLite (D1 is SQLite). |
| `tools/merge-index.mjs` | The skill index (void-live-deploy/skills/index.json) is one line, so two branches that each add a skill at its end always |
| `tools/merge-main.mjs` | Bring origin/main into the current branch. Several agents append to the same records at once (tools/bench.json, |
| `tools/merge-main.test.mjs` |  |
| `tools/merge-when-green.mjs` | Merge a PR once it is ready (tools/pr-ready.mjs: Verse's review check found no bugs or risks on its current head, nothing |
| `tools/mirror.mjs` | Continuity (frontier "metabolism"): once a week, copy the non-secret knowledge of this repo to a second git host, so a lost account or a |
| `tools/mirror.test.mjs` | tools/mirror.mjs: the allowlist, the fail-closed secret filter, and the real clone/commit/push flow against a local bare repo standing in for the seco |
| `tools/misses-snapshot.mjs` | The public miss snapshot: what people asked that Verse could not answer, reduced to terms and counts that are safe in a |
| `tools/misses-snapshot.test.mjs` | The public miss snapshot (tools/misses-snapshot.mjs): only short all-letter words seen in at least three different asks |
| `tools/misses.mjs` | The board for the hourly run: Verse's real misses, newest first, minus the ones already beaten or benched. |
| `tools/model-bench.mjs` | Model bake-off: the same asks, the same system prompts Verse's answer engine uses, sent live to Workers AI for the current |
| `tools/model-bench.test.mjs` | node --test tools/model-bench.test.mjs: the bench refuses a verdict when every call failed (a bad token once printed "keep gemma"). |
| `tools/model-switch.mjs` | From the bake-off's verdict to a change (model-bench.yml, after a run). When a challenger wins under the thresholds in |
| `tools/model-switch.test.mjs` | node --test tools/model-switch.test.mjs: from the bake-off's verdict to a change. A challenger that wins under the thresholds |
| `tools/models.test.mjs` | node --test tools/models.test.mjs: the model names live in void-live-deploy/lib/models.js and nowhere else. |
| `tools/monopoly.test.mjs` | to Cinder Lane (3) |
| `tools/motorbody.test.mjs` | read back a STORE zip (what zipStore writes): name -> text |
| `tools/new-skill.mjs` | Add a skill to Verse with one command, so even the simplest agent can grow it. A skill is one file with five fields |
| `tools/new-skill.test.mjs` | tools/new-skill.mjs: the one-command way to add a skill. node --test tools/new-skill.test.mjs |
| `tools/next-growth.mjs` | Kept so the old command still works: the growth inbox is not a build order any more (cleanup step 2, 2026-10-11). |
| `tools/next-skill.mjs` | The learning queue's next entry (frontier #2; asked by Verse, its daily reflection of 2026-10-09: "parse unanswered user |
| `tools/next-skill.test.mjs` | node --test tools/next-skill.test.mjs: the learning queue's next entry (tools/next-skill.mjs, frontier #2, asked by Verse): |
| `tools/next.mjs` | What a run takes next, in one place (cleanup step 4, 2026-10-11; it replaces reading several lists): the cleanup steps |
| `tools/next.test.mjs` |  |
| `tools/night-sky.test.mjs` | The sky world (void-live-deploy/skills/night-sky.js): its asks, its rough place, its projection and colours. |
| `tools/og-image.mjs` | !/usr/bin/env node |
| `tools/openapi-check.mjs` | !/usr/bin/env node |
| `tools/openapi-check.test.mjs` | tools/openapi-check.mjs: the spec and the routes stay in step, and nothing internal slips into either side unnoticed. |
| `tools/opencode-autoreply.ps1` | OpenCode auto-reply (Victus) |
| `tools/ouroboros.py` | !/usr/bin/env python3 |
| `tools/ouroboros_pack_test.py` | !/usr/bin/env python3 |
| `tools/ouroboros_smoke.py` | !/usr/bin/env python3 |
| `tools/ouroboros_test.py` | !/usr/bin/env python3 |
| `tools/owner-account.test.mjs` | functions/api/passkey.js ownerFor: the owner is an account, not one device (owner, 2026-10-14: "build me into it so I stop having |
| `tools/pdf-fixture.mjs` | pdf-fixture — a small, valid PDF made from lines of text, for the PDF card's browser check (tools/test_void.mjs). One page per |
| `tools/pdf-qa.test.mjs` | Frontier #12, the first piece: a dropped PDF becomes a card that answers questions about it with the line each answer came |
| `tools/placement.test.mjs` | Cards stop landing on top of each other (void-live-deploy/lib/placement.js): fixture rectangles in, positions out. |
| `tools/plan.test.mjs` | node tools/plan.test.mjs: frontier #10's next step. An explicit plan ask of a kind intent.js has no steps for ("plan my |
| `tools/poker.test.mjs` | 'A♠' -> card |
| `tools/poster.test.mjs` | node --test tools/poster.test.mjs: "order this as a poster" (frontier #15, the first piece's visible half). The open card |
| `tools/pr-ready.mjs` | Is a pull request ready to merge? One answer for the two things that merge: .github/workflows/automerge.yml (GitHub merges |
| `tools/pr-ready.test.mjs` | node tools/pr-ready.test.mjs: when a PR is ready to merge (tools/pr-ready.mjs), on made-up GitHub answers. |
| `tools/prepush.mjs` | Stop a broken intermediate state from reaching the remote (tonight a branch got a conflict marker in the growth ledger and then a |
| `tools/prepush.test.mjs` |  |
| `tools/print-file.test.mjs` | The stage's 3MF is checked before it is handed over (Verse's ask, 2026-10-10: "a verification step in the 'print-file' |
| `tools/private.mjs` | What Verse studies stays off the site (the owner, 2026-10-13: Verse does not need to say what sites it is studying or |
| `tools/private.test.mjs` | tools/private.mjs + tools/public-ledger.mjs: what Verse studies stays off the site (the owner, 2026-10-13) |
| `tools/proposal.test.mjs` | The proposal (void-live-deploy/lib/proposal.js, skills/proposal.js, /api/answer mode 'proposal', the confirm line's |
| `tools/public-ledger.mjs` | The growth ledger as the site serves it: what Verse studies stays off the site (the owner, 2026-10-13; lib/private.js). |
| `tools/pull_misses.py` | a-to-mind.com/api/misses", headers={"authorization": "Bearer " + tok, "user-agent": "a2m-pull-misses/1.0"})  # Cloudflare blocks the default Python-ur |
| `tools/push.mjs` | Push the current branch and make sure it landed: retries on a network or GitHub error (2s, 4s, 8s, 16s, 32s) and checks |
| `tools/queue.test.mjs` | The builders' queue (void-live-deploy/functions/api/queue.js): a claim moves a job from 'queued' to 'building' in one |
| `tools/rebuild-map.test.mjs` | The map (skills/rebuild-map.js) tells the truth about what is built: every skill a row names exists in skills/, the game |
| `tools/record.mjs` | !/usr/bin/env node |
| `tools/record.test.mjs` | tools/record.mjs: what Verse's own video of an experiment says comes from the lab entry and the run's ledger notes. |
| `tools/records.mjs` | The records many runs append to at once, in one place: tools/merge-main.mjs keeps both sides' new entries when a branch |
| `tools/reef-changes.mjs` | reef-changes — the coral heat card keeps itself current (frontier #8, the second card): read NOAA Coral Reef Watch's |
| `tools/reef-changes.test.mjs` | Frontier #8, the second card: the coral heat card notices when a reef's heat-stress alert changes (NOAA Coral Reef Watch, |
| `tools/reflect.mjs` | Verse's voice from the command line (the site side is functions/api/reflect.js and lib/voice.js). |
| `tools/refusal.test.mjs` | lib/refusal.js: every "I cannot" carries what is missing (asked by Verse, domains/void.voice.md) |
| `tools/rehearsal-route.test.mjs` | The in-site rehearsal seed (functions/api/rehearsal.js): owner-gated, one clearly marked handoff row with its |
| `tools/rehearsal.mjs` | The commercial chain rehearsed on the deployed site (operator, 2026-10-10): job -> buyer's reply -> claim -> draft, |
| `tools/releasenotes.test.mjs` | 41)'), { section: 'Added', text: 'Add search endpoint (#41)', scope: 'api', breaking: false }); |
| `tools/reply-to-job.test.mjs` | A buyer's reply reaches the job (functions/api/handoff.js `job` field, docs/intake.md): the handoff url is appended |
| `tools/revert-records.mjs` | Settle the append-only records after `git revert --no-commit <sha>`, so taking a broken commit back off main never jams on |
| `tools/revert-records.test.mjs` |  |
| `tools/revert-target.mjs` | Which commit the browser-suite job should revert when the suite goes red on main (verify.yml; the job was verify-main until |
| `tools/revert-target.test.mjs` | verify-main reverts the commit that broke the failing check, not whichever commit it happened to test (tools/revert-target.mjs). |
| `tools/review-api.test.mjs` | node --test tools/review-api.test.mjs: Verse's code review API (functions/api/review.js, lib/review-api.js) on a real |
| `tools/review-bench.mjs` | How good is Verse's code reviewer? Scored on bugs that really reached main. Each case in tools/review-bench.json is a fix |
| `tools/review-bench.test.mjs` | tools/review-bench.mjs: a finding within WINDOW lines of a broken line in the same file is a catch; any other bug or risk is noise. |
| `tools/review-learn.mjs` | node tools/review-learn.mjs [--from 120] [--to 210] [--since 30d] [--stats void-live-deploy/review-stats.json] [--json] [--all] |
| `tools/review-learn.test.mjs` |  |
| `tools/review-offer.mjs` | What A-to-Mind can do next for the people whose pull requests Verse reviews (owner, 2026-10-13: "the Verse code reviewer should |
| `tools/review-offer.test.mjs` | tools/review-offer.mjs: what A-to-Mind offers at the end of a review on someone else's repository |
| `tools/review-overrides.mjs` | What Verse's review gets wrong, from its own record. Every "void-review: ok" on a line is a builder saying the review flagged |
| `tools/review-overrides.test.mjs` | tools/review-overrides.mjs: each "void-review: ok" line, and which rule still fires there once the marker is taken out |
| `tools/review-post.mjs` | node tools/review-post.mjs <comments.json> --repo owner/name --pr N --sha HEAD_SHA |
| `tools/review-pr.mjs` | node tools/review-pr.mjs [--base origin/main] [--head HEAD] [--json] [--inline] [--gate] [--deep URL] |
| `tools/review-pr.test.mjs` | node tools/review-pr.test.mjs: the PR review script against a stand-in /api/review. What the comment footer says when no closer read |
| `tools/review.test.mjs` | node tools/review.test.mjs: the code reviewer (void-live-deploy/lib/code-review.js) finds what it should and stays quiet on clean code. |
| `tools/ringer.test.mjs` | Ringer (frontier build-order step 5): the behaviour module alone (skills/ringer-rules.js, no DOM), the seeded looks |
| `tools/route-bench.mjs` | Frontier #9, first piece: Clef-flash beside the embedding router on the bench's own asks. Each ask in tools/bench.json whose |
| `tools/route-bench.test.mjs` | node --test tools/route-bench.test.mjs: frontier #9, first piece. Clef-flash (lib/clef.js) beside the embedding router |
| `tools/routines.test.mjs` | Frontier #13, the first piece: "call this my morning" saves the last few asks as a routine in this browser; "my morning" |
| `tools/sale-e2e.test.mjs` | A sale end to end, through the real handlers on an in-memory D1 (owner, 2026-10-11: "verified revenue is the only metric", |
| `tools/sale-jobs.test.mjs` | A sale becomes work (void-live-deploy/lib/sale-jobs.js, wired into functions/api/gumroad.js): one execution record, |
| `tools/self-context.mjs` | Verse's facts about itself, for the answer engine (void-live-deploy/lib/self-context.js): what it is (llms.txt), and the |
| `tools/services.test.mjs` | The pricing card (void-live-deploy/skills/services.js): what Verse sells, from lib/products.js. |
| `tools/share.test.mjs` | node --test tools/share.test.mjs: bring someone into your Verse (frontier #11, first piece). One Durable Object per invite |
| `tools/shared-routines.test.mjs` | Routines that spread between Voids (frontier #13, its second piece): "offer my morning as Sam" sends that routine's asks |
| `tools/showcase.test.mjs` | The "look what I made" walkthrough picks what it shows (void-live-deploy/skills/showcase.js). Run: node --test tools/showcase.test.mjs |
| `tools/skills-check.mjs` | Every skill in void-live-deploy/skills/index.json, in its routing order: each of its examples must reach it first, |
| `tools/skills-index.mjs` | skills/index.json, generated from one file per skill (2026-10-10, owner: the shared list conflicted on every new skill and |
| `tools/skills-index.test.mjs` | skills/index.json is generated from one order file per skill (tools/skills-index.mjs): the rank in the file name orders |
| `tools/skills-unlisted.mjs` | A skill file that is not in skills/index.json is never loaded: the page never asks it anything, and its asks fall through to |
| `tools/skills-unlisted.test.mjs` | cdn.example/three.js';\nexport default {};\n", 'map.js': skill('map') }); |
| `tools/sky-card.test.mjs` | sky card (frontier #21, sky PR C): routing, names, compass, and the card for a pinned moment and place |
| `tools/sky-math.test.mjs` | The sky math (void-live-deploy/lib/sky-math.js) against fixed inputs: the worked examples in Meeus, Astronomical |
| `tools/sky-skills.test.mjs` | The sky card, its chips and the six skills behind them, with fixed inputs: what each says is checked against numbers worked out by the almanac |
| `tools/sky-world.test.mjs` | The sky world's projection (pure) and the choices it makes at a place and time: where to look first, and that the zenith, horizon and compass |
| `tools/sky.test.mjs` | The sky over the empty stage (frontier #21): skills/sky-rules.js maps a moment and a place to the sun's altitude, the season and a tint. |
| `tools/sorry.test.mjs` | a 2 draws again |
| `tools/speak.test.mjs` | node --test tools/speak.test.mjs: Verse's spoken voice (frontier #16, first piece). Hold Space to talk; Verse answers out loud |
| `tools/splat.test.mjs` | skills/splat-core.js: the .splat reader, the Gaussian's covariance and its projection (checked against sampled points through a real perspective |
| `tools/status.test.mjs` | ' + c.charCodeAt(0) + ';'); |
| `tools/support.test.mjs` | functions/api/support.js: someone who pays says "it broke", gets a ticket, and reads the owner's answer; nobody else can write. |
| `tools/swaps.test.mjs` | Kitchen swaps (skills/swaps.js): "substitute for buttermilk", "what can i use instead of eggs", "out of brown sugar" |
| `tools/tagteam.test.mjs` | x\n\n## Now\n\n- **Grok**: on it\n\n## Just finished\n\n- **Fix A**: solved by `measuring` first\n\n## Up for grabs\n\n- **Thing**: take it\n\n## Ladd |
| `tools/take.test.mjs` |  |
| `tools/targets.mjs` | Verse's targets (owner, 2026-10-13): Verse sets its sights on one site at a time, learns everything it does, then does each |
| `tools/targets.test.mjs` | tools/targets.mjs: a target's score counts only what Verse beats; every feature carries its plus one before the build |
| `tools/test_3d.mjs` | Checks for Verse's shared 3D scene (skills/scene3d.js, docs/miniatures.md) and the playable 3D board games built on it. |
| `tools/test_calendar.mjs` | Calendar skill parser. Run: node tools/test_calendar.mjs |
| `tools/test_extension.mjs` | node tools/test_extension.mjs — the Verse extension (extension/) loaded in Chromium, with a-to-mind.com served from this checkout. |
| `tools/test_glyphs.mjs` | Checks the cross-sense board draft (drafts/fringe/sensory-substitution.html) in a real browser: |
| `tools/test_sky.mjs` | The sky world in a real browser: "sky" turns the stage into the real sky for a fixed place and time (London, with the clock held), the card sits on it |
| `tools/test_void.mjs` | Verse's shared regression suite. Every agent runs this before deploying:  node tools/test_void.mjs |
| `tools/tictactoe.test.mjs` | blocks 0-1-2 |
| `tools/timer.test.mjs` | The timer's parsing (skills/timer.js, moved out of void.html in cleanup step 6): lengths, alarms, and the plain asks |
| `tools/together.test.mjs` | Figures that pick something to do together (frontier #4, the owner's 2026-10-11 piece): each figure advertises what it |
| `tools/told-me.test.mjs` | "What you told me": the answer path (functions/api/answer.js) checks a signed-in member's or the owner's own notes and projects and gives |
| `tools/touch-webkit.mjs` | Ringer by touch in WebKit (the engine under iOS Safari): the same checks tools/test_3d.mjs runs in Chromium with real |
| `tools/trial-changes.mjs` | trial-changes — the trial watch keeps itself current (frontier #8): read the ClinicalTrials.gov registry for the watchlist |
| `tools/trial-changes.test.mjs` | Frontier #8, the first piece: the trial watch notices what changed in the registry since its last check and says so in the |
| `tools/upgrades.mjs` | !/usr/bin/env node |
| `tools/upgrades.test.mjs` | tools/upgrades.mjs: Verse's own architectural upgrades, from measured friction to a component and a change, ranked. |
| `tools/upkeep.mjs` | Upkeep automations (owner, 2026-10-15: "add automations ... everywhere you can to hyperize productivity and progress"). |
| `tools/upkeep.test.mjs` | tools/upkeep.mjs pure helpers. Run: node --test tools/upkeep.test.mjs |
| `tools/video-live.mjs` | node tools/video-live.mjs: load a YouTube link, a Rumble link and a search on live Verse in installed headless Chrome and save |
| `tools/video.test.mjs` | Verse's video skill (skills/video.js, lib/video.js, functions/api/video.js): links from every platform become official embeds, |
| `tools/visual.mjs` | Visual regression of the live site (.github/workflows/visual.yml): screenshots at desktop and phone size, compared with a |
| `tools/voice.test.mjs` |  |
| `tools/void_lens.py` | !/usr/bin/env python3 |
| `tools/void_lens_test.py` | !/usr/bin/env python3 |
| `tools/void_queue.py` | a-to-mind.com/api/queue" |
| `tools/void_queue_test.py` | !/usr/bin/env python3 |
| `tools/watch.test.mjs` | The standing watch (void-live-deploy/lib/watch.js, skills/watch.js, /api/watch, the watch step in lib/automations.js and |
| `tools/weather-match.test.mjs` | Which asks the weather skill takes (skills/weather.js match): the forecast phrasings people type, and the look-alikes it leaves |
| `tools/weather_patch.py` | weather page (Open-Meteo, no key) |
| `tools/where.test.mjs` |  |
| `tools/will.py` | /records.jsonl, |
| `tools/words.test.mjs` | The words skill (skills/words.js): letter patterns ("5 letter words starting with cr") and anagrams ("unscramble tlesi"), |
| `tools/worldtime-parse.test.mjs` | How skills/worldtime.js reads a time asked between two places, in the orders people type it. |
| `tools/youtube.mjs` | !/usr/bin/env node |
| `tools/youtube.test.mjs` | tools/youtube.mjs: Verse's films go to Verse's channel and nowhere else. |
