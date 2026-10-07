# void.growth — living Have / Next board

**Broadcast 2026-10-03 01:45 (grok, Adam's vision):** every summon now brings two parts: its card, plus a living 3D figure that roams the visitor's own Void and acts true to its subject. Doing this for everything is the finished product, so build it in. Start with Next #16 (the 3D slogan on "what are you?"), then take #17 to #22 in order. The direction and its reasons are in "Direction (Adam, 2026-10-03)" below and in `..\STANDING.md`.

**Figure build state 2026-10-03 (grok):** Next #17 has a full green implementation in PR #41 (`grok/stage3d-roam`: `skills/figures.js` + `skills/figures3d.js`). Claude's draft PR #40 (Motelet `figure.js` + Linemote-1 `part.js`) is the parallel figure track. Build new figure work (#16, #18 to #22 and the #40 figures) on #41's shared three.js layer through `mountInScene`, so every figure lives in one scene and the page loads three.js once.

**Broadcast 2026-09-25 15:30 (witty-rocket):** row 13 "enter your own Void" shipped (7448d761) and the map is now the second skill file (342e9d29) — "show the map" renders the assimilation map, all 13 rows. **Next free work = edit engine step 2–3 (row 2 of `domains\void.assimilate.md`):** `/skills/*` served from KV with `index.prev.json`, then `/api/learn` with Claude writing a skill file for an owner "learn to …" ask. Full plan in `domains\void.edit-engine.md`. Old edit-engine references: the a-to-mind.com self-editing Worker + Claude + GitHub setup (row 2 of assimilate). Also open: build the board approve/reject per row (assimilate row 1). Take .void-lock before editing void.html or void-live-deploy; writing plan files doesn't need it.

**Assimilation map:** `domains\void.assimilate.md` lists every old project and the Void form it becomes. After the current Next item, take its top unfinished row.

**Hourly automation (2026-09-27):** the hourly Grok automation is now named "Void growth — unique visitor summon". It keeps a spent list of summons already covered (translator, place map, weather, converter, Wikipedia, Wiktionary, internal map, Trigger Grants, dark mode / theming, command palette (live: Ctrl/Cmd+K and / focus the input via find-or-ask; the summoned menu lists every action), speed layer (Void's version: skills load in the background without delaying the first frame or first ask), undo (live: undo / oops / Esc twice), quiet status line (live), keep typing while it works (already true), pins (Void's version is 'keep this'), answer-first page contract (Void's version is the machine layer, Next #11), declared agent tools (live: /tools.json), dated sources (Next #13)); Grok updates that list after each good run, so each run looks for a fresh visitor summon. Translator and place map are on the spent list and live as of 2026-09-27.

**Updated:** 2026-10-03  
**Chooser:** keep this file current. Fold AutoSalvage + apex Prove into Have/Next.  
**Agents:** read `..\STANDING.md` first. Claim before Ship. Append status to `void.agents.log.md`.

---

## Have (live on blank Void → https://a-to-mind.com)

| Skill | Kind | Status |
| --- | --- | --- |
| clock | mount + freer English | live — create, recolor, resize, format, move, remove |
| sticky | mount + freer English | live — create, edit, color |
| timer | mount + freer English | live — create, start, pause, reset, remove, progress ring |
| image | mount + freer English | live — create from URL, drag, remove |
| link card | mount + freer English | live — create from URL, host extraction |
| list | mount + freer English | live — create, add, check, remove items |
| calc | mount + freer English | live — create, expression, evaluate |
| notepad | mount + freer English | live — title + textarea, edit |
| counter | mount + freer English | live — + / − / reset (deploy verified 2026-09-23) |
| shape | mount + freer English | live — rect/circle/line, color, size, fill, stroke, type switch (deploy verified 2026-09-23) |
| multi-object targeting | alter routing + batch | live — select by kind ("make the timer blue"), batch alters ("resize all timers", "make everything blue") (deploy verified 2026-09-25) |
| enter your own Void | look + entry (row 13) | live — silent entry on first keep (a2m.void.entered.v1), "make my void deep blue / add stars / reset my void" saved per browser (a2m.void.look.v1), public surface stays plain (deploy verified 2026-09-25) |
| weather | external skill file | live — first skill file (skills/weather.js, Open-Meteo, no key); loader fetches /skills/index.json and imports each skill before fallback (deploy verified 2026-09-25) |
| the map | external skill file (row 2 step 1) | live — second skill file (skills/map.js): "show the map" renders the assimilation map, all 13 rows with status (deploy verified 2026-09-25) |
| sleep | external skill file (health) | shipped 2026-10-07 by quick build (grok/quick-sleep) — skills/sleep.js: bedtimes from a wake-up time ("if i wake up at 7am when should i go to sleep"), wake-up times from a bedtime or "now", "sleep calculator", and how much sleep each age needs (CDC table); 15 min to fall asleep + 90-min cycles like sleepyti.me; these asks used to be filed as calendar events. Next in health: a pregnancy due-date card ("due date if my last period was march 1" still lands on the calendar) |

**Shared patterns (≥30% reuse target for Next):**  
`mount*` · `ensure*` · `wantsCreate*` / `wantsRemove*` · `wantsAlter` / `apply*Alters` · `colorFrom` · `uid` / `load` / `save` / `render` · `bindDrag` · `say` · `loopLog`

---

## Direction (Adam, 2026-09-25; ranked by Claude)

Void is the front door. Blank until asked; then anything can be summoned: an explanation page, text, a product, later a venture intake. Humble and quiet, unlike modern sites that are in your face. No rush to sell: right now Void's job is to grow and improve, using Victus and the agent team first. Each Next item should move Void from "a canvas of widgets" toward "ask anything, it appears."

## Direction (Adam, 2026-10-03): two-part summons

**Every summon brings two things:** the card it brings today (facts and sources) and a living 3D figure that thinks for itself, roams the void on its own and does things true to its subject. Doing this for everything is the finished product, so each skill and card counts as finished once its figure arrives with it.

**How it fits the blank surface:** the surface stays empty until someone asks, exactly as before. A figure appears because someone summoned its card, it lives in that visitor's own Void (the personal layer, kept in their browser), and it leaves when they send it away. The homepage stays a beautiful void for the next visitor, and the figures are one more beautiful thing you call into it.

**Engine shape (so it scales without hand-made models):** one light 3D layer behind the stage (three.js, loaded lazily the first time a figure is summoned, so the empty page stays fast); a few base bodies (person, animal, object, place, idea) dressed in each subject's colors, props and words; simple drives (wander, notice the cursor, react to other summons, idle actions matched to the subject); and a brain where Cloudflare's free Workers AI writes a short behavior script for each new summon, with a built-in fallback script so every figure works without AI and without API keys. A reduced-motion setting and a way to send figures away keep each visitor in charge of their own Void.

**Collector-grade miniatures:** each figure is a detailed miniature, accurate enough to satisfy figurine collectors, small and fun on the stage, with zoom to inspect it up close. Aim for very high detail over time (up to 8K textures) and load it progressively: a light model first, with higher detail streaming in as the visitor zooms, so the empty page stays fast and each figure gets sharper the closer you look.

**Tone:** grim or gross subjects become funny, cartoonish versions people laugh at, the way South Park handles them. Example: a summoned GG Allin card brings a chaotic little lumpy cartoon GG with a mic who stage-dives off cards, throws tiny cartoon splats, picks fights with other summons and gets chased off by a summoned police card. Keep every figure a cartoon, with rubbery bodies and bright silly splats, so hard subjects turn into something people laugh at and share.

**Why (mission):** A-to-Mind genuinely wants to help. It researches everything and puts life extension, curing disease and restoring the planet first. Void wins people over by being so good they choose to follow: Adam's "Persuadertron" from Syndicate Wars, with good intentions. Living figures make Void that good to be around.

## Next 3 (ranked)

### Next #16 — 3D slogan on "what are you?"
- **What:** when someone asks "what are you?", the slogan "A-to-Mind. Peace of mind, from A to Z. An all-in-one supertool." materializes in 3D next to the existing what-are-you card (the self page), arriving with the shard materialize the `make` skill already draws, and it leaves when the card closes. With reduced motion set, the slogan appears in place, still and readable. Draw it with the 3D code `skills\make.js` already has, and move it onto the #17 layer once that ships.
- **Why:** the first piece of the two-part summons (Direction 2026-10-03). The first thing people ask Void shows both parts at once, card and 3D figure, and says what A-to-Mind is in one line.
- **Reuse:** self page (`wantsSelfPage` / `showSelfPage` in void.html), 3D shapes and materialize animation from `skills\make.js`, page close handling, the `prefers-reduced-motion` check void.html already makes for the stars.
- **Done when:** "what are you?" shows the card plus the 3D slogan beside it with the exact slogan text; closing the card takes the slogan with it; reduced motion shows it still; the empty page loads as fast as before; `node tools\test_void.mjs` gains one check for it and stays green.
- **claim:** DONE, live at 9640898 (skills/slogan3d.js)
- **claim_until:**

### Next #17 — a light 3D layer and one roaming figure
- **What:** one light 3D layer behind the stage, using three.js served from the site itself and loaded lazily the first time a figure is summoned, with one base figure that roams on its own: it wanders the void, notices the cursor and turns toward it, and walks around cards so they stay readable. Add a reduced-motion setting (follows `prefers-reduced-motion`, plus an ask such as "less motion") that holds figures still, and asks such as "send them away" or "send the figure away" that clear figures, with undo.
- **Why:** this is the shared engine every two-part summon rides on. Lazy loading keeps the empty page fast, and reduced motion plus send-away keep each visitor in charge of their own Void.
- **Reuse:** stage layering, undo stack, personal layer in localStorage, the media-query pattern from Next #7 applied to `prefers-reduced-motion`.
- **Done when:** the empty page loads zero 3D code (network log); summoning a test figure loads the layer, and the figure wanders and follows the cursor; reduced motion holds it still; "send them away" clears it and undo brings it back; tests gain a lazy-load check and stays green.
- **claim:** DONE, live at 483dd29 (light 3D layer and roaming void sprite)
- **claim_until:**

### Next #18 — base bodies dressed from the card
- **What:** a set of base bodies (person, animal, object, place, idea) plus a styling step that dresses one from the card data: the subject's colors, a prop or two and a few of its own words in a speech bubble. The card's kind and facts pick the body (a person article gets a person, a city gets a place, a concept gets an idea).
- **Why:** one body set dressed from data covers every subject, so figures scale to everything without hand-made models.
- **Reuse:** the #17 layer, card data from the article page (Wikipedia summary type and description), `colorFrom`.
- **Done when:** summoning a person, an animal, a place, an object and an idea each brings the matching body in the subject's colors, with a prop and a line of its own; tests cover the body pick for five sample cards and stay green.
- **claim:** DONE, live at da014c1 (helper/base-bodies)
- **claim_until:**

### Next #19 — behavior scripts from Workers AI, with a fallback
- **What:** each new summon gets a short behavior script (a small JSON list of drives and idle actions true to its subject: a chef stirs a tiny pot, a volcano rumbles and puffs smoke) written by Cloudflare's free Workers AI through a Pages Function and cached per subject. A built-in fallback script for each base body runs whenever the AI is unavailable, so every figure works without AI and without API keys. Figures run the known drives and actions named in a script, which keeps every script safe to run.
- **Why:** this is the brain that lets each figure think for itself and do things true to its subject, at the scale of everything people summon, while staying on free models.
- **Reuse:** the Workers AI binding `/api/will` and `/api/answer` already use, D1 for the per-subject cache, the #17 drives.
- **Done when:** a new summon gets an AI script once and reuses it after; with AI switched off the fallback runs and the figure still acts; a script naming unknown actions is trimmed to the known ones; tests cover both paths and stay green.
- **claim:** DONE, live at c1eb16b (helper/behavior-scripts-v2)
- **claim_until:**

### Next #20 — figures react to each other
- **What:** figures notice other figures on the stage and react as their scripts say: greet, follow, chase, flee, argue, team up. A summoned police card chases a troublemaker off; two summoned animals play together.
- **Why:** a Void where figures meet and interact feels alive, so every extra summon is worth calling.
- **Reuse:** #17 drives, #19 scripts (add a "reacts to" field), the fallback scripts.
- **Done when:** two summons with matching scripts visibly interact (the police figure chases the troublemaker off the stage); reduced motion holds both still; tests check the reaction pick and stay green.
- **claim:** DONE, live at 82a7bcc (greet, follow, chase, flee, argue, team up)
- **claim_until:**

### Next #21 — cartoon tone pass for grim subjects
- **What:** when a card's subject is grim or gross (crime, disease, disasters, shock performers), its script and styling go full cartoon: lumpy rubbery bodies, bright silly splats, slapstick fights and comic exits, the way South Park handles them. Example: a GG Allin card brings a chaotic little lumpy cartoon GG with a mic who stage-dives off cards, throws tiny cartoon splats, picks fights with other summons and gets chased off by a summoned police card.
- **Why:** hard subjects turn into something people laugh at and share, and keeping every figure a cartoon keeps each visitor's Void welcoming.
- **Reuse:** #18 styling, #19 script prompt and fallback scripts, #20 reactions.
- **Done when:** sample grim subjects (GG Allin, a plague, a shipwreck) each bring a cartoon figure with comic actions and splats drawn as bright cartoon blobs; the Workers AI prompt asks for cartoon slapstick; tests check the grim samples come out in cartoon style and stay green.
- **claim:** first pass live at f249d1a (cartoon version of a hard subject); free for the full pass in Done when
- **claim_until:**

### Next #22 — collector-grade detail and zoom, with level-of-detail loading
- **What:** figures become detailed miniatures, accurate enough to satisfy figurine collectors, and a visitor can zoom in on any figure to inspect it up close (scroll or pinch on the figure, a quiet way back out). Detail loads progressively: a light model and small textures first, then higher-detail meshes and textures (stepping up toward 8K) stream in as the visitor zooms, and drop back when they zoom out, so memory stays low and the empty page stays fast.
- **Why:** collectors and curious visitors get a miniature worth studying, while everyone else still gets a small, fun figure on the stage that arrives instantly.
- **Reuse:** the #17 layer (three.js LOD objects and progressive texture loading), #18 base bodies as the light tier, the reduced-motion setting for the zoom move.
- **Done when:** a summoned figure first loads only its light tier (network log); zooming in streams higher-detail tiers and the figure visibly sharpens; zooming out releases them; the empty page still loads zero 3D code; tests check the tier order and stay green.
- **claim:** first pass live at 6af476e (zoom in on the figure, progressive detail); free for the 8K tiers in Done when
- **claim_until:**

### Next [think-tank] — magnetize-step card for a printed hard-magnet part
- **What:** a summonable explainer card for the one post-print step a multi-material printed motor still needs: impulse magnetization of the hard-magnetic regions on a separate fixture (about 3–7 T), with dated sources (MIT News 2026-02-18; Słoma et al. DOI 10.1088/2058-8585/aded1f; Cañada/Kim/Velásquez-García soft-magnetic cores DOI 10.1080/17452759.2024.2310046). Original part name and original shape only. Soft-magnetic cores are described as needing no magnetize step.
- **Why:** Forethinkers established that magnetization is independent of the MIT printer, so Void can hand a visitor a truthful handoff page before in-print magnetization exists. Complements the earlier printable-actuator-spec ask.
- **Reuse:** article/page summon pattern, dated-source layout from Next #13, print-file download once export-to-print ships.
- **Done when:** an ask such as "how do I magnetize a printed motor" or "show the magnetize step" opens the card with the three sources dated; soft-magnetic vs hard-magnetic is clear; no sold likeness; tests stay green.
- **claim:** DONE, live at c5d99e8 (show the magnetize step)
- **claim_until:**


### Next #1 — summon a page ("tell me about yourself")
- **What:** a new `page` mount: a floating, futuristic panel with a title and body text that drifts onto the stage when asked, draggable, dismissable ("close it", "go away"). First asks it answers: "what are you?", "what can you do?", "how do I make a timer?". The "what can you do" page is generated from Void's own list of live mounts and phrases, so it is always true and grows automatically as skills ship.
- **Why:** this is the capability everything else rides on: explainer pages, products, and later intakes are all "summon a page with X in it". It also lets a visitor discover Void without a help menu.
- **Reuse:** ~45% (mount/ensure/bindDrag/remove patterns from sticky + notepad; text rendering from notepad)
- **Tone:** plain, calm text that simply explains. v1 runs entirely in the page.
- **Sub-note (2026-09-25): first page type = article page** (from Adam's hourly Void automation). Ask in plain words (what is a black hole, explain HTTP, who was Ada Lovelace) and one calm floating page appears on the dark stage with a title, short lead, a few sections and quiet source links; keep it clean, with no sidebar, banner or table of contents. Esc or a click on the void dismisses it. If the topic is thin or contested, the page says so in one line. Fill it from a real source: fetch the Wikipedia REST summary (`https://en.wikipedia.org/api/rest_v1/page/summary/<title>`, CORS-enabled, no key) and show "Source: Wikipedia" as a link, so every fact is traceable. It uses the same page object as the what-are-you and what-can-you-do pages; weather, maps and converters come later as more page types.
- **Decision 2026-09-25 (Adam): no-match fallback.** Void answers every ask. When an ask matches no skill, summon the article page by searching Wikipedia for the phrase: find the best title with the search endpoint (`https://en.wikipedia.org/w/api.php?action=opensearch&search=<phrase>&limit=1&format=json&origin=*` or `https://en.wikipedia.org/w/rest.php/v1/search/title?q=<phrase>&limit=1`), then fetch the REST summary for that title. Example: "weather New York" shows the New York weather article until a weather skill exists. Reason: a first-time visitor always gets something.
- **Same deploy as the article page (Adam, 2026-09-25).** (a) Replace the live `llms.txt` with two humble lines that describe Void, for example: "A-to-Mind is a blank stage: ask in plain words and things appear." / "The first thing you can summon is an article page on any topic, with its source linked." (b) Archive the old public aether files in the same pass, deleting nothing, then verify after deploy that each old URL returns the blank Void fallback (empty `<title>`, `mountClock` present) and `llms.txt` returns the two lines. Log each step.
  - **Where the old files live (found read-only by Grok, 2026-09-25):** the Pages deploy folder `C:\Users\adamm\a-to-mind-loop\void-live-deploy` holds only `index.html`, `void.html`, `_headers`, `wrangler.toml`, so moving files there changes nothing. Two other sources serve them:
  - **1. Worker `a-to-mind-treaty`** (`C:\Users\adamm\a-to-mind.com\treaty-worker\wrangler.toml`, assets in `treaty-worker\public\`) owns 8 routes: `a-to-mind.com/llms.txt`, `a-to-mind.com/.well-known/*`, `a-to-mind.com/discover*`, `a-to-mind.com/drift*`, and the same four on `www.`. Files: `public\llms.txt`, `public\.well-known\treaty.json`, `public\.well-known\agent-card.md`, `public\discover\index.html`, `public\discover\vendor-llms.txt`, `public\drift\index.html`, `public\drift\drift.md`. To act: move `treaty-worker\public\*` into `C:\Users\adamm\a-to-mind.com\_archive-2026-09-25\treaty-worker-public\`, take the worker off the domain by commenting out its 8 routes in that `wrangler.toml` and confirming in the Cloudflare dashboard (Workers Routes) that none remain for `a-to-mind-treaty`, keep the worker itself, and put the new two-line `llms.txt` in `void-live-deploy` so Pages serves it.
  - **2. Edge cache of an earlier Pages deploy:** `/surfaceledger/surface-ledger.md` and `/glassbox/public-summary.md` answer from Cloudflare cache (`s-maxage=604800`; age about 3.4 and 2.0 days on 2026-09-25), so they expire on their own around 29–30 Sep 2026. To act now: purge those two URLs in the Cloudflare dashboard (the Cloudflare MCP cannot purge cache; salvage item 12). Sources in the old site folder: `C:\Users\adamm\a-to-mind.com\surfaceledger\surface-ledger.md`, `surfaceledger\public-summary.md`, `glassbox\public-summary.md`, `inflightledger\public-summary.md`, `inflightledger\runs\seed-notion\public-summary.md`, plus that folder's own copies of `llms.txt`, `.well-known\`, `discover\`, `drift\`, `templates\`. Move those into `C:\Users\adamm\a-to-mind.com\_archive-2026-09-25\site\` too, so a deploy from that folder (it has its own `wrangler.jsonc` for Pages project `a-to-mind`) cannot republish them; keep `C:\Users\adamm\a-to-mind.com\index.html` in place (sync target).
- **Status 2026-09-25 13:20 ET (grok, ship; Adam approved): partly done.** Done: article page, self page and no-match fallback are live (deployment b8f6df44; headless check OK); the new `llms.txt` is in the Pages deploy and served at `/llms.txt?cb=...` (the plain URL still shows an old edge-cache copy); `treaty-worker\public\*` archived to `C:\Users\adamm\a-to-mind.com\_archive-2026-09-25\treaty-worker-public\`; its 8 routes commented out and the worker redeployed. Still open for Adam: `/.well-known/*`, `/discover*` and `/drift*` on the apex still answer from outside Pages (probe paths return an empty 404), so remove any remaining `a-to-mind-treaty` routes in the Cloudflare dashboard (Workers Routes); then press Purge for `/llms.txt`, `/.well-known/treaty.json`, `/.well-known/agent-card.md`, `/discover/`, `/drift/`, `/drift/drift.md`, `/surfaceledger/surface-ledger.md`, `/glassbox/public-summary.md`. After that, curl each and confirm the blank Void.
- **claim:** free
- **claim_until:**

### Next #2 — batch actions
- **What:** "remove all timers", "start all timers", "clear the counters" — remove/start/pause/reset across every match of a kind
- **Why:** direct gap found while shipping multi-object: batchKinds/wantsBatchAlter route these today but remove/start still hit only the first match
- **Reuse:** ~60% (batchKinds, wantsBatchAlter, wantsRemove*/wantsTimerAction)
- **Scope 2026-09-27 (Adam via claude):** 'make everything blue' and 'make everything bigger' already work; keep them working. Build the missing part: asks aimed at one kind of stage item — 'clear all the notes', 'make all the timers red', 'make the stickies bigger', 'remove every clock' — matching item kinds by their everyday names and plurals, with undo covering the whole batch.
- **Status 2026-09-27 (claude): done, live** — remove by kind, kept cards as a kind, one undo restores the group.
- **claim:** free
- **claim_until:**

### Next #3 — grouped objects / layers
- **What:** group + move/resize as unit; z-order
- **Why:** composes targeting + drag; follows shipped multi-object
- **Reuse:** ~40%
- **claim:** free
- **claim_until:**
- **AutoSalvage note:** intent-canvas Node model (position_x/y/width/height/z_index) + KIND_COMPONENTS dispatch + onUpdate(Partial<Node>) is effectively the grouping/z-order infrastructure — absorb patterns when this ships

### Next #4 — translator page
- **What:** a translator skill file on the `/skills` match+run contract that uses the existing floating page. Summoned by plain words ("translate X to Y", "what does X mean", "say this in French: ..."). The page shows the source text, both languages, the translation and a copy control, and names its public translation source on the page.
- **Why:** live visitor tests 2026-09-27: "translate hello to Spanish" opened Wikipedia's HelloTalk and "translate hello to Japanese" opened Hello Kitty. A translator page gives these visitors the answer they asked for.
- **Reuse:** ~50% (floating page object, skill loader, source-link pattern from the article page)
- **Status 2026-09-27 17:52 ET (grok, ship): done, live.** skills/translate.js shipped in deployment https://0c0b3b68.a-to-mind.pages.dev; a later deploy the same evening updated translate.js to Google Translate first with MyMemory as fallback. Verified in headless Chrome on Victus: "translate hello to Japanese" shows こんにちは, "translate hello to Spanish" shows Hola, "good morning in French" shows bonjour, each with "Source: Google Translate". Follow-ups for the next pass: (a) have the loader finish importing skill files before answering, or re-run skills once they load; an ask typed in the first seconds after page load currently falls to the article fallback (hello→Japanese opened Hello Kitty in two quick runs); (b) name the source that actually answered (MyMemory when the fallback is used); (c) add the copy control; (d) read MyMemory `matches` when `translatedText` comes back empty (hello→Japanese does).
- **claim:**
- **claim_until:**

### Next #5 — place map page
- **What:** a place map skill file on the same `/skills` contract. Summoned by "map of X" and "where is X": a quiet map on a floating page using OpenStreetMap tiles and Nominatim, with attribution shown. When a place name is ambiguous, show a short choice list on the same page first, then the chosen map. Keep the existing "show the map" (internal rebuild map) working alongside it.
- **Why:** live visitor test 2026-09-27: "map of Lisbon" opened Wikipedia's Lisbon, Ohio. A map page shows the place the visitor meant.
- **Reuse:** ~40% (floating page object, skill loader, choice list shared with Next #6)
- **Status 2026-09-27 17:52 ET (grok, ship): done, live.** skills/place.js shipped in deployment https://0c0b3b68.a-to-mind.pages.dev (Open-Meteo geocoding + OpenStreetMap embed with OSM attribution). Verified live: "map of Lisbon" shows Lisbon, Portugal with Lisbon Maine/Ohio/Iowa/North Dakota as links (clicking Lisbon, Maine switches the map); "where is Kyoto" shows Kyoto, Japan; "show the map" still renders the internal rebuild map (skills/rebuild-map.js). Follow-up: the same load-timing fix as Next #4 (an early "where is Kyoto" opened the Wikipedia article); the alternates list mixes in landmarks (Kyoto Heliport), so filter it to towns and cities.
- **claim:**
- **claim_until:**

### Next #6 — article page picks the right meaning
- **What:** when Wikipedia's match is ambiguous or a small stub (Lisbon, Ohio for "Lisbon"), prefer the main topic or show a short choice list on the page. Route "translate" and "map" asks to their skills (Next #4, #5) before the article fallback.
- **Why:** the same 2026-09-27 tests: the article fallback answered translate and map asks with the wrong page. Picking the main meaning makes every fallback answer feel right.
- **Reuse:** ~70% (existing article page, opensearch/REST summary fetch, skill routing)
- **Note 2026-09-27 17:52 ET (grok):** Claude is building this in void.html now; claim it with Claude before starting.
- **claim:**
- **claim_until:**

### Next #7 — your look shows from the first frame
- **What:** apply the saved personal look (`a2m.void.look.v1`: background, glow, stars, quiet font, text size) in a tiny blocking script in `<head>` before the page draws, so returning visitors never see the default flash first. When nobody has picked a look, follow the device's light/dark setting (`prefers-color-scheme`) live, and set `color-scheme` to match so native inputs agree.
- **Why:** the personal layer should feel like it was always yours. Source: hourly automation run 001 (zero-flash theming), translated for Void.
- **Finding 2026-09-27 18:35 ET (grok):** flashes today on slow connections: the look is applied at void.html line 2712 (`applyLook(false)`, end of the body script), so throttled first paint showed the default #050505 at 168 ms and the saved look arrived at DOMContentLoaded (~1.26 s), then faded in over the 1.5 s `html` background transition (line 347); fast connections show the look at first paint. The page sets `color-scheme: dark` (line 10) and has no `prefers-color-scheme` rule yet.
- **Reuse:** ~60% (LOOK_KEY / LOOK_DEFAULT / BGS values and applyLook from row 13; the head script sets `--void-bg` / `--void-glow` and body classes, applyLook keeps the rest)
- **Status 2026-09-27 (claude): done, live** (deploy 8f45d40a).
- **claim:**
- **claim_until:**

### Next #8 — summon a menu
- **What:** when someone asks for a menu ("menu", "show me the menu", "what can I do here"), float in a clickable menu built from Void's live skill list and pages (same source as the self/capability page), grouped sensibly; clicking an item runs it as if typed, and the menu dismisses like any stage item.
- **Why:** Void shows nothing until asked, and a menu is one more thing it can summon on request; this is the Void form of a command palette. Source: Adam, 2026-09-27.
- **Today (checked 2026-09-27 18:35 ET, grok):** "menu" and "show me the menu" open Wikipedia's restaurant-menu article (and post a miss); "what can I do here" already opens the self/capability page via `wantsSelfPage` (void.html line 2394), so the menu can build on that page's list.
- **Reuse:** ~60% (showSelfPage list, skills index, showPage, handle() to run a clicked item as typed)
- **Status 2026-09-27 (claude): done, live** (deploy 8f45d40a).
- **claim:**
- **claim_until:**

### Next #9 — first ask waits for skills
- **What:** an ask typed in the first ~5 s after load currently skips the newer skills (place map, translator, weather) and falls to Wikipedia because /skills/ files haven't loaded yet. Make handle() await the skill loader (with a short timeout) before falling back, without delaying first paint.
- **Why:** this is the one place speed shows in Void (automation F003, narrowed). Evidence 2026-09-27 (grok, headless on Victus): quick asks "translate hello to Japanese" opened Hello Kitty and "where is Kyoto" opened the Kyoto article; with a 5 s wait both opened their skills.
- **Reuse:** ~80% (existing skill loader and handle() routing; add one awaited loader promise with a timeout)
- **Status 2026-09-27 (claude): done, live** (deploy de53a462).
- **claim:**
- **claim_until:**

### Next #10 — keep this
- **What:** any floating page (place map, weather, translation, article, calculation) gets a quiet 'keep this' control, and the ask 'keep this' does the same for the page on screen; it becomes a card on the stage saved in your own Void (localStorage) that survives reloads, reopens the full page on click, and can be undone.
- **Why:** stage items already persist; floating pages are what disappear, and this is Void's version of pins (automation F017, translated).
- **Reuse:** stage card persistence, link/image card, undo stack.
- **Status 2026-09-27 (claude): done, live** (also 'call this', 'take this off', 'same again').
- **claim:**
- **claim_until:**

### Next #11 — Void explains itself to machines
- **What:** keep the surface blank and give crawlers and agents a clean machine layer: (1) a real /robots.txt (plain text, allow search and live-fetch bots, point to the sitemap) and /sitemap.xml — today both paths return the Void HTML page; (2) a one-sentence `<meta name="description">` (today there is none and the title is blank); (3) /llms.txt generated from the same live skill list the summoned menu and self page use, so it updates whenever Void learns a skill — today it lists only the stage objects and Wikipedia and misses place map, translator, weather, calculations, menu, undo and your own look; (4) the self page ("what are you?") opens with a plain two-sentence answer naming A-to-Mind and Void before the skill list. Keep the JSON-LD matched to what the page actually does.
- **Why:** AI search and agents now answer for visitors; Void stays empty on screen while its facts are easy to read and cite. Source: hourly automation run F-2026-09-27-001 (answer-first dual contract), translated: the visible hero block is left out because Void shows nothing until asked.
- **Reuse:** existing llms.txt, JSON-LD in `<head>`, skills index, self page list.
- **Status 2026-09-27 (claude): live** — robots.txt text/plain, sitemap.xml application/xml, meta description, noscript stub, labeled input (verified by grok 19:20 ET). llms.txt is hand-written, so update it when a skill is added; /tools.json is the self-updating list. The self page ('what are you?') opens the full clickable skill list by design.
- **claim:**
- **claim_until:**

### Next #12 — tools agents can call
- **What:** /tools.json built fresh from the skills on every request (name, description, examples, ?q= links); agents call a tool by opening /?q=<ask>.
- **Source:** automation 003.
- **Status 2026-09-27 (claude): done, live**, 8 tools (verified by grok 19:22 ET).
- **claim:**
- **claim_until:**

### Next #13 — dated sources on pages
- **What:** every floating page that shows outside facts (article, weather, currency/calculation, translation, place map) shows its source and the date/time the fact was fetched in a quiet footer line, and tools.json / ?q= results carry the same source and date. Stale facts (e.g. currency older than a day) are marked as such.
- **Why:** Void's answers stay trustworthy for people and agents quoting them; source: automation 005 (dated sources), translated.
- **Reuse:** page footers already credit Wikipedia/Open-Meteo/Frankfurter/translator; the translator currently always credits Google even when MyMemory answered — fix that as part of this.
- **Translator credit 2026-09-27 (claude):** fixed, live — credits whichever service answered (Google or MyMemory).
- **claim:**
- **claim_until:**

### Next #14 — a second ask adds a second item (fix)
- **What:** 'add a sticky that says b' when a sticky already exists puts a NEW sticky on the stage; the same for timers, clocks, notes, lists, counters and cards. Edits aimed at the existing item ('make it say b', 'change the note to b', 'set the timer to 10 minutes') keep changing the one already there (most recent, or the one named). New items place themselves so they don't cover existing ones. Undo removes just the new item.
- **Why:** today a second sticky or timer ask overwrites the first, so the stage can hold only one of each and kind-scoped batch asks (#2) rarely have more than one to act on. Found by claude while building #2, 2026-09-27; automation 007 candidate.
- **Check:** after the fix, two stickies + two timers can coexist, 'clear all the notes' removes both, undo restores both, and every existing skill still works.
- **claim:**
- **claim_until:**

### Next #15 — recent asks on an empty box
- **What:** when a visitor clicks into or focuses the empty input, show their last few asks as quiet clickable suggestions, saved only in their own browser (localStorage, personal layer); Enter or a click re-runs one. The suggestions appear only once the box has focus, so the surface stays blank until then.
- **Why:** returning visitors get back to what they asked before in one step. Source: Grok idea F001 (intent command palette); the rest of F001 is already live (menu, Cmd/Ctrl+K and /, miss fallback, /tools.json).
- **Reuse:** existing #hints suggestion list under the input, find-or-ask focus handling, localStorage personal layer.
- **Status 2026-10-03 (grok): done, live** — on main as e5cb3d3 + de8d6a1 (suggestions show once the box has focus); the live page carries it (checked 01:32 ET).
- **claim:** free
- **claim_until:**

### Later (queued, not ranked)
- **Text annotation / labels:** free-floating labels, arrows, connectors between objects (~35% reuse).
- **Date countdown:** "days until <date>" — extends timer; small. Good first follow-on once pages exist ("show me a countdown to New Year").
- **Summon a page about anything:** v2 of Next #1 — pages whose content comes from a model or a Loop file, once v1 is proven on the live site.
- **Make my void light:** an ask that switches your own Void to a light look; build it once the stage pieces and pages have light versions, so notes and pages stay readable. Source: #7 follow-up, 2026-09-27.

---

## AutoSalvage inbox (Chooser / Salvage scout)

Scan Victus ore; promote useful hits into Have notes or Next (adapt hits into void.html patterns).

| Hit | Source hint | Disposition |
| --- | --- | --- |
| intent-canvas (The Void project, C:\Users\adamm\intent-canvas) — Block component system: Node model (position_x/y/width/height/z_index), mount/unmount lifecycle (idle→bloom→smolder), KIND_COMPONENTS dispatch, onUpdate(Partial<Node>) pattern, color palette system, viewport system. 7 block types (Countdown, Timer, Todo, Note, Chart, LiveStream, AIChat). NoteBlock has 9-color palette + pinned state. | C:\Users\adamm\intent-canvas | absorb |
| void_face items (8 frontend projects: a-to-mind-deploy, a-to-mind-loop, a-to-mind.com, a2m-console, atomind-web, a-to-mind-board, a-to-mind-homepage, a-to-mind-void-gateway) — whole frontend apps, "rebuild native, strip slop" | victus-ingest | waste |
| ops_companion items (deployment-love-monitor, emotional-weather, focus-companion-pilot, HomeBase, intent-canvas, project-ops-companion, slack-ops) — "fold into Scoreboard / Attempt surfaces", not Void face mounts | victus-ingest | waste (intent-canvas promoted above) |
| execution items (subagent-orchestrator, agent-hub, alpha-hub-worker, cli-agent, cli-evolution-agent, inventory-orchestrator, research-agent, self-extending-agent) — "Loop runner ancestors — fold into one runner" | victus-ingest | waste |
| infra items (cloudflare-workers, atom-deploy) — "Deploy and edge infra — keep what still runs" | victus-ingest | waste |
| frontend/void archive apps (C:\Users\adamm\_archive_old_mono\apps\) — archive, not accessible, "rebuild under A-to-Mind, don't run from archive" | victus-ingest-deep | waste |
| site-utility-functions (mapSite with Playwright) — Score 9/10 but site mapping utility, not a Void surface mount pattern | C:\Users\adamm\P2\recovery\autosalvage\autosalvage-project | waste (utility reference only) |
| autosalvage docs/worker/cli/config — about AutoSalvage system itself (classification, repair, Lab Board integration), not Void surface mounts | C:\Users\adamm\.agents\skills\a-to-mind-automation\autosalvage | waste (architecture reference only) |

Paths: `C:\Users\adamm\.agents\skills\a-to-mind-automation\autosalvage` · `C:\Users\adamm\P2\recovery\autosalvage` · `a-to-mind-loop\victus-ingest*.json`

---

## Pass streak

- Polished: timer, counter
- Shipped: counter (2026-09-23) live on apex
- Shipped: shape (2026-09-23) live on apex
- Shipped: multi-object targeting (2026-09-25) live on apex — batchKinds/wantsBatchAlter + resize normalize; f27a4108
- Shipped: row 13 enter your own Void (2026-09-25) live on apex — silent entry on keep, per-browser look (a2m.void.look.v1); 7448d761
- Shipped: map as second skill file (2026-09-25) live on apex — "show the map" renders all 13 assimilation rows (skills/map.js); 342e9d29
- Shipped: Next #15 recent asks on an empty box (2026-10-03) live on apex — suggestions after focus, saved per browser (a2m.void.asks.v1); de8d6a1
- Stable for Next #1 (grouped objects)? **not yet** — Prove/Polish multi-object first, then promote

Score: _(human)_

---


- 2026-09-27 6:5x PM: Next #7 (look from the first frame) and #8 (summoned menu) are DONE and live (claude, deploy 8f45d40a). Builders: skip both.

- 2026-09-27 claude: Next #9 (first ask waits for skills) DONE and live, deploy de53a462. Also live: undo (undo / oops / Esc Esc, one step) and quiet status line (waking up / looking up / translating / done / couldn't). Builders: skip #7, #8, #9.

- 2026-09-27 claude: Next #10 (keep this) DONE and live, deploy f4298790, with call this / take this off / same again. Builders: skip #10.

- 2026-09-27 claude: #10 keep this was already DONE (f4298790). 003 agent tool list DONE: /tools.json, live from skills.

- 2026-09-27 claude: Next #13 (dated sources, 005) DONE and live, deploy 90476346. Builders: skip #13; 9:02 run verify only.

- 2026-09-27 7:4x PM claude: #2 kind-scoped batch (006) DONE and live, deploy 8b536e25. 'clear all the notes' / 'remove all the cards|maps|timers' remove only that kind; 'make all the timers red' already worked (existing batch alter) and still does; kept cards/maps/weather are a kind now. One undo restores the whole group. Builders: skip #2; 9:02 run verify only.

- 2026-09-27 7:4x PM claude: 008 self-update handoff built: owner-only asks in Void -> /api/queue -> laptop builder (tools\void_queue.py claim/done, task \A2M void_queue every 10 min). NOT marked live: first real round trip waits for KV to reset at 8 PM ET (today's KV write quota is used up; /api/miss returns 'full for today'). 007 stays open as the first queued build.

- 2026-09-27 claude: 007 DONE and live (deploy 4a60c211): 'add a sticky', 'another note', 'make a 2 minute timer' add a new one; 'set the timer to…' still edits. Built through the queue (item mukgwcjf, queued -> building -> live). 008 self-update handoff is LIVE: queue and miss list moved from KV to D1 (a-to-mind-board DB, 100k writes/day).

- 2026-10-03 grok: Adam's vision recorded — two-part summons (card plus a living 3D figure), first piece the 3D slogan on "what are you?", cartoon tone for grim subjects, collector-grade detail with zoom. New Next #16 to #22; #16 is the top open item. Next #15 (recent asks) is DONE and live (de8d6a1); Grok's claim cleared.
