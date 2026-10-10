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
| weather | external skill file | live — first skill file (skills/weather.js, Open-Meteo, no key); loader fetches /skills/index.json and imports each skill before fallback (deploy verified 2026-09-25); a live card since 2026-10-09 (asked by Void): skills/live.js re-fetches the forecast every 15 min while the card is up, the diorama updates with it |
| live | shared module (not a skill) | shipped 2026-10-09, asked by Void ("a background task runner that allows my existing skills (like news, weather, or worldtime) to update autonomously") — skills/live.js: keepLive(api, el, { every, refresh }) re-runs a card's own fetch-and-redraw while the card is on the stage, the tab is visible and the browser is online; a hidden tab refreshes the moment it comes back if it is due; a failed refresh keeps the last good card (stale and dated beats blank) and waits 2x, 4x, up to 8x longer; a line under the card says "updated 3:04 PM · refreshes every 15 min · pause". Weather 15 min, news and topic news 30 min, tech news 10 min; worldtime already ticked on its own. tools/live.test.mjs holds the scheduling tests, checks.mjs runs it. Next: any card with a source goes live the same way (air, uv, pollen, quake, crypto, sport), and a "while you were away" line on a card that refreshed many times (frontier #4) |
| draft | extension + API (not a skill) | shipped 2026-10-10 (#254 backend, then the card buttons) — "Draft from this tab": on the Void extension's tab card (#248's Alt+Shift+V read, in-browser), four buttons "draft for me: reply · summary · notes · rewrite (sends it to Void)" post the title, address and selection to /api/answer mode draft once (lib/draft.js: the address kept to host and path, every field through redact, caps with a cut flag, the quoted-material prompt with the injection rule, Gemma under the existing model budget, no cache, no D1 row, a plain rules draft when no model answers); whatever is in the card's box goes along as a note; the draft lands in the box for "put in the page" or copy, and the card's footer says what was sent and for what (Adam, 2026-10-09: local by default, flag what leaves). Rewrite is disabled with nothing selected. Next: the four intents as asks typed in the panel ("summarise this tab"), and a per-intent tone (formal / warm / brief) |
| the map | external skill file (row 2 step 1) | live — second skill file (skills/map.js): "show the map" renders the assimilation map, all 13 rows with status (deploy verified 2026-09-25) |
| savings | external skill file (money) | shipped 2026-10-07 by quick build (grok/quick-savings) — skills/savings.js: what regular saving grows to ("how much will i have if i save 200 a month for 20 years at 7%", "invest 10k and add 300 a month for 15 years at 6%", weekly or yearly deposits too), how long a goal takes ("how long to save 50000 if i save 500 a month", with the month you get there and how much sooner at 1.5x the deposit), and the monthly amount a goal needs ("how much do i need to save a month to have 1 million in 30 years at 7%", plus the cost of starting 5 years later); every answer shows put in vs growth and a ±2-point range like the SEC's Investor.gov compound interest calculator, and no rate given shows 0%, 4% and 7% side by side; milestone table by year; "savings calculator" is a live form with an optional goal. Monthly compounding, end-of-month deposits; not financial advice. These asks used to go unanswered (plain "compound interest on 10000 at 5% for 10 years" stays with calc). Next in money: a debt payoff card ("how long to pay off 5000 at 22% paying 200 a month", avalanche vs snowball) |
| sleep | external skill file (health) | shipped 2026-10-07 by quick build (grok/quick-sleep) — skills/sleep.js: bedtimes from a wake-up time ("if i wake up at 7am when should i go to sleep"), wake-up times from a bedtime or "now", "sleep calculator", and how much sleep each age needs (CDC table); 15 min to fall asleep + 90-min cycles like sleepyti.me; these asks used to be filed as calendar events. Next in health: a pregnancy due-date card ("due date if my last period was march 1" still lands on the calendar) |
| pregnancy | external skill file (health) | shipped 2026-10-07 by quick build (grok/quick-due-date) — skills/pregnancy.js: due date from the last period (Naegele's rule, + 280 days, shifted for cycle length: "due date if my last period was march 1", "...and my cycle is 35 days"), from conception (+ 266), from a 3- or 5-day IVF transfer (ACOG: + 266 minus embryo age), and how far along you are from a known due date ("my due date is june 1 how far along am i"); shows weeks + days today, trimester, days left, likely conception date and the dated milestones (dating scan, cfDNA, anatomy scan, glucose screen, GBS, full term 39w0d–40w6d per ACOG); "due date calculator" is a live form with all five starting points. These asks used to be filed as calendar events. Next in health: an ovulation / fertile-window card ("when am i ovulating if my last period was march 1" is still unanswered) |
| ovulation | external skill file (health) | shipped 2026-10-07 by quick build (grok/quick-ovulation) — skills/ovulation.js: fertile window, ovulation day and next period from the last period ("when am i ovulating if my last period was march 1", "when is my next period if my last period was sept 20"), any cycle length and your own luteal phase (ovulation = next period − luteal phase, 14 by default; fertile window = the 5 days before and the day of ovulation, Wilcox NEJM 1995), irregular cycles as a range ("my cycle is 26 to 32 days": ACOG's calendar rule, shortest − 18 to longest − 11), a known next period ("my next period is due nov 3 when do i ovulate"); rolls the cycle forward to today (cycle day + where you are), shows the next three windows, a colored month view, the day to start LH tests and the day a home pregnancy test is most reliable; "ovulation calculator" is a live form. Listed before pregnancy so "lmp 9/28 when will i ovulate" no longer lands on a due date. These asks used to go unanswered. Next in health: a period / cycle log people can keep in their own Void ("my period started today" saves it, averages the cycle length) |
| period log | external skill file (health) | shipped 2026-10-07 by hourly builder (box/builder-1519) — skills/period.js: a period log kept only in this browser (a2m.void.cycle.v1, never synced): "my period started today", "my period started on october 1", "i got my period today", "log my period on sept 3", "today is day 1 of my period" save a start (a start within 10 days of a logged one corrects it instead of doubling it); "show my period log" / "how long is my cycle" list every start with the cycle between each, your own average, shortest and longest (gaps over 60 days count as a missed log), today's cycle day, the next period and this cycle's fertile window; "is my period late" reads the log; "remove my last period", "clear my period log". Builds on ovulation: "when am i ovulating" and "when is my next period" with no date now use the logged start and your averaged cycle (a range by ACOG's calendar rule when your cycles vary by 8+ days), and "ovulation calculator" opens filled in from the log. The health row from the ovulation row's "Next in health" is done. Next in health: a symptom or mood note per day on the same log, and a pregnancy due date that reads the log ("when is my due date" with no date) |
| home | external skill file (home) | shipped 2026-10-07 by quick build (grok/quick-paint) — skills/home.js: paint and flooring for a room, the way the best paint and flooring calculators do it. Paint: "how much paint do i need for a 12x14 room", "...with 9 foot ceilings", "...with 2 doors and 3 windows", "paint a 12x14 room and the ceiling", "how much paint for the ceiling of a 12x14 room", metric rooms in litres ("4 by 5 metre room"): walls = perimeter × height (8 ft / 2.4 m by default) less 20 sq ft a door and 15 sq ft a window (1 door, 2 windows unless you say), × coats (2) ÷ 350 sq ft a gallon (the careful end of Sherwin-Williams, Benjamin Moore and Behr's 350–400); says what to buy (gallons + quarts, 5-gallon buckets, or the 10/5/2.5/1 L tin mix with the least spare), ceiling paint separately, primer, trim and the cost when you give a price. Flooring: "how much flooring do i need for a 12x14 room", "how many boxes of laminate for a 15x20 room boxes cover 22 sq ft", "how many 12x24 tiles for a 10x12 floor", "how much carpet for a 12x14 room": area × (1 + 10% straight / 15% diagonal / 20% herringbone), whole boxes or tiles, carpet in sq yd off a 12-ft roll with the seams, underlayment, thinset, baseboard and cost. "paint calculator" and "flooring calculator" are live forms. Calc keeps its one-liners ("how many gallons of paint for 400 square feet"). These asks used to go unanswered. Next in home: wallpaper roll count and drywall sheet count shipped 2026-10-07 as the walls skill (row below) Follow-ups shipped 2026-10-07 by hourly builder (box/builder-1614): the last room stays in memory for 30 minutes on that page, so "what about 3 coats", "the ceiling too", "at $40 a gallon", the card's own "with 2 doors and no windows" and "9 foot ceilings", "with primer", "just the ceiling", "what about carpet", "how about 12x24 tiles", "herringbone", "with 15% waste" and "paint for it" redo the same room. |
| walls | external skill file (home) | shipped 2026-10-07 by hourly builder (box/builder-1719), built on the home skill and its follow-ups that merged this hour (#162, #164) — skills/walls.js: wallpaper rolls by the drop method decorators use ("how many rolls of wallpaper for a 12x14 room", "...with 9 foot ceilings", "...with a 64 cm repeat", "a 21 inch half drop repeat", "27 inch rolls", "an accent wall 12 feet wide", metric rooms): drops = wall width ÷ roll width rounded up, drop = height + 4 in / 10 cm trim rounded up to whole repeats (+ half a repeat for a half drop), drops per roll rounded down, so a 12x12 room is 11 rolls where area ÷ roll area says 7 (the card says why); doors and windows left in; default roll 20.5 in × 33 ft (0.53 × 10.05 m UK/Euro, a US double roll), 27 in rolls are 27 ft; buy one spare from the same batch. Drywall ("how many sheets of drywall for a 12x14 room", "4x12 sheets ... and the ceiling", "just the ceiling", "a wall 12 feet wide", "plasterboard for a 4 by 5 metre room"): area + 10% ÷ sheet area, plus screws, tape, compound and primer from USG's Sheetrock installation guide J371 (per 1,000 sq ft: 2.7 lb screws, 370 ft tape, 10 gal all-purpose; primer 400 sq ft a gallon). Follow-ups: "with a 21 inch repeat", "half drop", "27 inch rolls", "at $45 a roll", "at $15 a sheet", "4x12 sheets", "the ceiling too", "9 foot ceilings"; and across skills: after a paint or floor card "wallpaper for it" / "how many sheets of drywall" use that room, and after a walls card "paint for it" / "what about carpet" hand the room to home. "wallpaper calculator" and "drywall calculator" are live forms. These asks used to go unanswered. Next in home: a project list for one room (paint + floor + walls on one card with a total cost) shipped 2026-10-07 as the room skill (row below) |
| room | external skill file (home) | shipped 2026-10-07 by hourly builder (box/builder-1817), built on home + walls that merged this hour (#166) — skills/room.js: everything for one room on one card, from the same math as the single cards (home.js paintMath/floorMath, walls.js wpMath/dwMath): "redo a 12x14 room", "what do i need to redo a 12x14 bedroom", "paint and carpet a 12x14 room", "paint and new laminate for a 10x12 bedroom at $40 a gallon and $3 a sq ft", "wallpaper and carpet for a 12x12 room", "drywall paint and flooring for a 12x14 room and the ceiling", "shopping list for a 12x14 bedroom makeover", "wallpaper the walls and paint the ceiling of a 12x12 room" (papered walls put the paint on the ceiling), metric rooms. One line each for drywall (sheets, screws, tape, compound), paint (walls, ceiling white, primer when there is drywall), wallpaper (rolls + a spare), flooring (sq ft, carpet sq yd, tiles, boxes) and baseboard; each line has a price box and the total updates as you type; prices also come from the ask or a follow-up ("$40 a gallon", "$3 a sq ft", "$30 a sq yd", "$45 a roll", "$15 a sheet", "$1.50 a foot"); nothing is priced until the visitor gives a price. An order of work (drywall, ceiling, walls, paper, floor, baseboard last). Follow-ups: "add wallpaper", "drywall too", "no paint", "skip the baseboard", "what about hardwood", "12x24 tiles", "herringbone", "the ceiling too", "9 foot ceilings", "with 2 doors and 3 windows", "3 coats"; after any paint, floor, wallpaper or drywall card, "the whole room", "everything for it", "make a shopping list" or "what would it all cost" put that room on one card. These asks used to land on a single paint or floor card or go unanswered. Next in home: save a room project by name ("save this as the bedroom") and compare two rooms or two materials side by side |
| nutrition | external skill file (health) | shipped 2026-10-07 by quick build (grok/quick-nutrition) — skills/nutrition.js: daily calories, protein and water worked out for you, the way the best TDEE, protein and hydration calculators do it. Calories: "how many calories should i eat a day", "calories for a 30 year old male 5'10 180 lbs moderately active", "how many calories should a 25 year old woman 165 cm 60 kg eat to lose weight", "what is my bmr", "tdee calculator": Mifflin-St Jeor resting burn (the most reliable quick equation in the Frankenfield 2005 dietetics review) × the usual 1.2–1.9 activity factors, rows to lose 0.5/1/2 lb (or 0.25/0.5/1 kg) a week or gain, a 1,500 / 1,200 floor on the steep cuts, man and woman side by side when the ask doesn't say; with no body stats, the Dietary Guidelines 2020–2025 calorie ranges by age and sex plus a live calculator. Protein: "how much protein do i need (if i weigh 180 pounds)": RDA 0.8 g/kg (46 g / 56 g), exercising 1.4–2.0 g/kg (ISSN 2017), the 1.6 g/kg muscle plateau (Morton 2018), 1.0–1.2 g/kg past 65 (PROT-AGE), per meal. Water: "how much water should i drink a day", pregnant, breastfeeding, kids and teens from the National Academies 2004 adequate intakes (13 cups men, 9 women), plus sweat. Food lookups ("calories in a banana"), BMI and "calories to lose a pound" stay with calc and answer. These asks used to go unanswered. Next in health: calories in common foods ("how many calories in a banana" still misses) and heart-rate zones ("what is my target heart rate") Follow-ups and heart-rate zones shipped 2026-10-07 by hourly builder (box/builder-1912) (rows below). |
| nutrition follow-ups | external skill file (health) | shipped 2026-10-07 by hourly builder (box/builder-1912), built on nutrition (#165) that merged this hour — skills/nutrition.js keeps the last body numbers in page memory (30 min, this page only) so one change redoes the card: "what if i'm very active", "i'm sedentary", "to lose 1 pound a week", "to gain", "i'm a woman", "i weigh 200", "make it 85 kg", "i'm 45"; "and protein", "and water", "and calories" switch cards for the same person, and "how much protein do i need" / "how much water should i drink a day" / "how many calories should i eat a day" with no numbers use the ones you just gave (the card says so). Stat-only follow-ups go to whichever body card spoke last (nutrition or heart). Exports lastStatsOf() and shareBody() for other body skills. Unknown leftovers ("what about a 12x14 room") stay unclaimed. |
| heart | external skill file (health) | shipped 2026-10-07 by hourly builder (box/builder-1912), built on nutrition + its follow-ups — skills/heart.js: target heart rate and five training zones. "what is my target heart rate", "heart rate zones for a 40 year old", "max heart rate for a 55 year old", "fat burning heart rate for a 35 year old" (zone 2), "cardio heart rate" (zone 3), "what is zone 2 heart rate for a 45 year old", "what should my heart rate be when exercising": max 220 − age (the AHA chart) with Tanaka's 208 − 0.7 × age beside it (JACC 2001, 18,712 people) or a measured max ("my max heart rate is 186"); target 50–85% (moderate 50–70, vigorous 70–85); zones 50/60/70/80/90/100% with the talk test; a resting rate ("heart rate zones age 40 resting heart rate 60", or "my resting heart rate is 60" after the card) switches to heart rate reserve (Karvonen) with a verdict on the resting rate. "what is a normal resting heart rate" / "is a resting heart rate of 55 good": AHA 60–100, athletes 40–60, when to see a doctor. No age: the AHA chart by age plus a live form ("heart rate zone calculator", AHA or Tanaka). With no age in the ask it uses the age from the last calories card and shares its age back, so "and calories" after zones knows you. Follow-ups: "i'm 50", "zone 4", "fat burning", "resting 55". Core calc's one-line "heart rate at 40" now gets the full card. These asks used to go unanswered. Next in health: calories in common foods ("how many calories in a banana" still misses), and a resting-heart-rate log in the browser like the period log ("my resting heart rate was 58 today", trend over weeks). |
| grades | external skill file (learning) | shipped 2026-10-07 by quick build (grok/quick-grades) — skills/grades.js: GPA, finals and letter grades in plain words, built the way the most-used tools do it (the credit-weighted GPA of the big GPA calculators, RogerHub's final-grade formula) without their forms. GPA from any mix of letters and percents: "what is my gpa A B B+ A-", "gpa with A 4 credits, B+ 3 credits, C 3 credits", "calculate my gpa A 3, B 4, C 3", "what's my gpa if i got 3 A's and 2 B's", "gpa 93 88 79", "what is my gpa with an a and a b" (a lowercase "a" before another grade is read as the article); weighted GPA with AP/IB +1 and honors +0.5 shown beside the unweighted one ("weighted gpa A in AP, B+ honors, A-"); every class line shows points × credits, on the College Board 4.0 scale (A 93, A- 90, B+ 87 … F below 65). The score a final needs: "i have an 85 and my final is worth 20% what do i need to get a 90" = (goal − current × (1 − weight)) ÷ weight, with the A/B/C/D rows, what 100 and 0 on the final would leave, and "out of reach" / "locked in"; no weight given shows every common weight (10–50%); "to pass" counts 65. Cumulative GPA ("my gpa is 3.2 with 60 credits and i got a 3.8 this semester with 15 credits" = 3.32) and the term GPA needed to reach a goal (says when even a 4.0 can't, and how many credits would). "what letter grade is an 87", "87 percent is what grade", "3.7 gpa in letter grade". "gpa calculator" (rows with grade, credits, regular/honors/AP, add a class) and "final grade calculator" are live forms. Calc keeps "gpa of 3.5 and 4.0" and "42 out of 50". These asks used to go unanswered. Next in learning: the reverse final ask ("i got a 90 on my final, what is my grade now") and category-weighted class grades (homework 20%, tests 50% …) |

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
- **superseded (Adam, 2026-10-08):** "we are going for realistic not cute". Everything that appears is realistic, one of a kind, clonable and acts on its nature (STANDING.md); grim subjects are not turned into cartoons. Do not build this.
- **claim:** closed: superseded 2026-10-08 (see the line above); the first pass at f249d1a stays only until realistic bodies cover its subjects
- **claim_until:**

### Next #22 — collector-grade detail and zoom, with level-of-detail loading
- **What:** figures become detailed miniatures, accurate enough to satisfy figurine collectors, and a visitor can zoom in on any figure to inspect it up close (scroll or pinch on the figure, a quiet way back out). Detail loads progressively: a light model and small textures first, then higher-detail meshes and textures (stepping up toward 8K) stream in as the visitor zooms, and drop back when they zoom out, so memory stays low and the empty page stays fast.
- **Why:** collectors and curious visitors get a miniature worth studying, while everyone else still gets a small, fun figure on the stage that arrives instantly.
- **Reuse:** the #17 layer (three.js LOD objects and progressive texture loading), #18 base bodies as the light tier, the reduced-motion setting for the zoom move.
- **Done when:** a summoned figure first loads only its light tier (network log); zooming in streams higher-detail tiers and the figure visibly sharpens; zooming out releases them; the empty page still loads zero 3D code; tests check the tier order and stay green.
- **claim:** DONE 2026-10-08 run 56 (skills/figures3d.js detail tiers): every body meshed from distance fields (people, zombies, animals, food, fish, bees, flowers, the brain) arrives at the light tier and re-meshes at 1.5× then 2× resolution as you zoom in on it, one step at a time once the glide settles, then drops back to the light mesh the moment it is no longer the one zoomed on; nothing is downloaded (the bodies are built in the browser, so "8K textures" became finer geometry). A 3D test checks the order (light, finer, finer, light again with the same triangles and seed). Next: the same tiers for the sprite and the place/object/idea bodies.
- **claim_until:**

### Next [think-tank] — Motelet remembers you, on this device
- **What:** Motelet asks the visitor's name the first time it is summoned, keeps the name and the last thing they summoned in this browser only (localStorage, no server call), and on the next visit greets them by name and mentions that last summon ("Hi Sam, did you bring the chair back?"). "forget me" clears it and Motelet says goodbye to the memory. Works with the network off.
- **Why:** Forethinkers established (2026-10-07 12:17 ET) that a toy-sized offline mind now exists (M5Stack Module LLM, AX630C: 54 mm, 17 g, 1.5 W, wake word + ASR + 0.5B LLM + TTS, https://docs.m5stack.com/en/module/Module-LLM, accessed 2026-10-07), so the physical figure's memory of its kid will live on the toy. Building the same memory on the stage first proves the behaviour (toy problem 4: it stays) and keeps the visitor's data on their own device.
- **Reuse:** `void-live-deploy/skills/figure.js` (Motelet), the `store()` helper pattern in `skills/figures.js`, existing figure greet behaviour from Next #20.
- **Done when:** summon Motelet, give a name, reload the page, summon Motelet again and it greets by name with the last summon; "forget me" then reload and it asks again; a browser test covers both paths with the network blocked; tests stay green.
- **claim:** done in run 51 (claude): name and last summon kept in this browser only; "Motelet, forget me" or "forget my name" clears it (plain "forget me" stays the account's, which deletes passkeys and synced data); a bare word counts as a name only right after Motelet asks and only when written like one ("Sam"); browser test in tools/test_void.mjs
- **claim_until:**

### Next [think-tank] — Florida Keys reef-accretion card
- **What:** a summonable explainer card for Lower Florida Keys coral restoration geo-ecology: offshore *A. cervicornis* outplanting flips reef-accretion potential from −0.84 mm y⁻¹ to +2.80 mm y⁻¹ within 2–6 years, >16× gross carbonate production, ≈5% cover gain; cites Toth et al. Scientific Reports DOI 10.1038/s41598-025-04818-3 and USGS CC0 release 10.5066/P13HMEON; states inshore massive null, then shows what happened next: the 2023 heatwave killed 97.8–100% of Keys and Dry Tortugas *Acropora* (Manzello et al. Science DOI 10.1126/science.adx7825, 23 Oct 2025), so the card presents the accretion flip as proof that planting builds reef fast and heat tolerance decides whether it lasts, and links to the coral heat-survival card; links GSOCS-LULCC as soil companion dataset. No unverified planet-save claim; original wording only.
- **Why:** Forethinkers established (2026-10-03 12:11 ET) a measurable ocean restoration result with open primary data, so Void can hand a visitor a truthful planet-restoration card that separates rapid small-scale accretion gains from ecosystem-scale promises.
- **Reuse:** article/page summon pattern, dated-source layout from magnetize-step / senolytic MASH cards.
- **Done when:** an ask such as "coral restoration Florida Keys" or "reef accretion potential" opens the card with the three DOIs dated and the 2023 die-off visible; tests stay green.
- **claim:** done in run 52 (claude): skills/coral.js, "coral restoration florida keys", "reef accretion potential", "does planting coral work"; the three DOIs dated, the 2023 die-off and the takeaway visible, links to the heat-survival card; GSOCS-LULCC named without a link (no source URL in this entry)
- **claim_until:**

### Next [think-tank] — coral heat-survival card: can restored reefs live through the next heatwave?
- **What:** an ask such as "can coral survive heatwaves", "flonduran coral" or "heat tolerant coral" opens a card in three short parts, each line with its source and date. What happened: the 2023 heatwave held water at or above 31 °C for about 41 days and killed 97.8–100% of elkhorn and staghorn in the Florida Keys and Dry Tortugas (Science DOI 10.1126/science.adx7825, 23 Oct 2025); land gene banks kept both species alive (Conservation Biology DOI 10.1111/cobi.70168). What helps: elkhorn hosting *Durusdinium* symbionts tested 1.9 °C more heat tolerant (Coral Reefs DOI 10.1007/s00338-025-02652-7, 22 Apr 2025). What is being tried now: Florida x Honduras "Flonduran" elkhorns, the first permitted cross-border coral outplant, on a Miami reef since July 2025 (University of Miami, 15 Jul 2025) and side by side with Florida-only siblings at three Dry Tortugas sites since April 2026 (University of Miami, 19 May 2026), with the line "Survival results against the Florida-only controls are not published yet; first Dry Tortugas check is due about October 2026." Ends with one local action: report bleaching through Mote BleachWatch (mote.org/bleachwatch). Original wording only.
- **Why:** Forethinkers answered (2026-10-07 18:07 ET) the planet-restoration question of whether fast coral restoration survives bleaching years: in Florida it did not, and heat tolerance is now the deciding factor. The card gives a visitor the honest arc, from loss to rescue to the live field test, and the next date to watch.
- **Reuse:** the dated-source layout from the senolytic MASH, magnetize-step and trial-watch cards; the Florida Keys reef-accretion card links here.
- **Done when:** each example ask opens the card with the five sources dated, the "not published yet" line visible, and the BleachWatch action shown; a test checks the card renders offline; tests stay green.
- **claim:** done in run 52 (claude): skills/coral.js, "can coral survive heatwaves", "flonduran coral", "heat tolerant coral"; five dated sources, the "not published yet" line and the BleachWatch action; bench asks render it offline
- **claim_until:**

### Next [think-tank] — senolytic MASH trial card
- **What:** a summonable explainer card for the phase-2 intermittent dasatinib + quercetin trial in fibrotic MASH: primary fibrosis endpoint 47% vs 7% placebo, MASH resolution 53% vs 7%, Nature Metabolism 1 Oct 2026 and NCT05506488 dated, authors' hypothesis-generating caveat shown. Neighbouring context links to PEARL rapamycin safety (Aging 4 Apr 2025) and semaglutide epigenetic aging (Nature Communications 19 May 2026). No cure claim; original wording only.
- **Why:** Forethinkers established (2026-10-03 10:08 ET) the first human RCT histology signal for senolytics in MASH, so Void can hand a visitor a truthful disease-cure research card that separates proven endpoints from longevity marketing.
- **Reuse:** article/page summon pattern, dated-source layout from Next #13 / magnetize-step card.
- **Done when:** an ask such as "senolytics for fatty liver" or "dasatinib quercetin MASH trial" opens the card with the three sources dated and the caveat visible; tests stay green.
- **claim:** done in run 53 (claude): skills/senolytic.js, "senolytics for fatty liver", "dasatinib quercetin mash trial"; endpoints, the NCT record linked, the hypothesis-generating caveat in bold, PEARL and semaglutide as dated context marked "not the same claim"; the three papers are named and dated without links (this entry gives no DOIs)
- **claim_until:**

### Next [think-tank] — live longevity trial watch
- **What:** an ask such as "is anyone repeating the senolytic liver trial?", "trial watch", or "longevity trials" opens a card that queries the ClinicalTrials.gov API v2 live from the browser (`https://clinicaltrials.gov/api/v2/studies/<NCT id>`, open to any origin) for a watchlist: NCT05506488 (senolytic MASH), NCT07144293 (D+Q frailty in HIV), NCT07220473, NCT07707778 and NCT07293325 (GLP-1 DNA-methylation age), and NCT06727305 and NCT07191353 (rapamycin). Each row shows the trial's title, status, enrollment, primary-completion date, whether results are posted, and a link to the record. The card states the date and time of the check, and adds one plain line per topic, such as "No follow-up senolytic liver trial is registered yet." If the network is off, it shows the last saved snapshot with its date.
- **Why:** Forethinkers found (2026-10-07 16:20 ET) that the registry API is browser-readable and that the senolytic MASH signal has no registered successor, while GLP-1 epigenetic slowing has three prospective trials reading out in 2027. A live card lets a visitor see which longevity results are being repeated, which are not, and when answers are due, straight from the primary registry. This is the honest companion to the senolytic MASH trial card.
- **Reuse:** the dated-source layout from the senolytic MASH and magnetize-step cards, and existing live-fetch skill patterns (weather, quake) for timeout and offline fallback.
- **Done when:** "trial watch" opens the card with every watchlist NCT id showing status and primary-completion date from a live fetch; a browser test stubs the API response and checks the rows, the check timestamp, and the offline snapshot path; tests stay green.
- **claim:** done in run 53 (claude): skills/trialwatch.js, "trial watch", "longevity trials", "is anyone repeating the senolytic liver trial"; seven watchlist trials read live from the ClinicalTrials.gov API v2 with an 8 s timeout, the time of the check, the senolytic "no follow-up registered yet" line; each good check saved in this browser and shown with its date when the registry is unreachable; browser test in tools/test_void.mjs stubs the API for both paths
- **claim_until:**

### Next [think-tank] — multi-material 3MF download for a printed motor body
- **What:** a summonable original-named printed motor part page whose download emits a five-part **3MF** in the slicer-tested layout: five top-level build items, one mesh object per material class (dielectric, conductive, soft-magnetic, hard-magnetic, flexible), each object carrying that name plus `pid` pointing at its own one-color `m:colorgroup`. Keep a Core `basematerials` group with the same five names for portable tools, and add `Metadata/Slic3r_PE_model.config` with a per-object `extruder` 1-5 for PrusaSlicer 2.9. Companion magnetize-step card keeps the 1.5 T Sr-ferrite and 3-4 T bonded Neo numbers. Original part name and original shape only.
- **Why:** Forethinkers ran the slot test on 2026-10-07 14:40 ET. OrcaSlicer 2.4.2 keeps all five names and puts them on extruders 1-5 only in this layout; Core basematerials alone, a shared colorgroup, or a single assembly object with components all land every part on extruder 1. PrusaSlicer 2.9.6 reads extruders only from its own config file (source dated 2026-06-25). The layout is the difference between five material slots and one.
- **Reuse:** `void-live-deploy/skills/print-file.js` (`zipStore`, `modelXml`), the recipe and test results in `domains/forethinkers/tracks/printing-working-machines.md`, the magnetize-step card (live at c5d99e8) for the post-step.
- **Done when:** an ask such as "download the printed motor as 3MF" or "show the multi-material print file" yields a 3MF that passes lib3mf strict read and that OrcaSlicer CLI round-trips (`--export-3mf`) with five named objects on extruders 1-5; magnetize companion is linked; no sold likeness; tests stay green.
- **claim:** DONE 2026-10-08 run 54 (skills/motorbody.js + skills/mini/pentamote.js): "download the printed motor as 3mf" / "pentamote-1" shows Pentamote-1, an original 24 × 12 × 5 mm five-material linear motor body, and Download 3MF saves pentamote-1.3mf in the slot-tested layout plus the PrusaSlicer config. lib3mf 2.5.0 strict read: five manifold, oriented parts, one colour group each. OrcaSlicer 2.4.2 CLI `--export-3mf` round trip: dielectric, conductive, soft-magnetic, hard-magnetic, flexible on extruders 1-5. PrusaSlicer side is source-read, not run. Next: coil lead-outs to two printed pads, and one test print.
- **claim_until:**

### Next [think-tank] — magnetize-step card for a printed hard-magnet part
- **What:** a summonable explainer card for the one post-print step a multi-material printed motor still needs: impulse magnetization of the hard-magnetic regions on a separate fixture (about 3–7 T), with dated sources (MIT News 2026-02-18; Słoma et al. DOI 10.1088/2058-8585/aded1f; Cañada/Kim/Velásquez-García soft-magnetic cores DOI 10.1080/17452759.2024.2310046). Original part name and original shape only. Soft-magnetic cores are described as needing no magnetize step.
- **Why:** Forethinkers established that magnetization is independent of the MIT printer, so Void can hand a visitor a truthful handoff page before in-print magnetization exists. Complements the earlier printable-actuator-spec ask.
- **Reuse:** article/page summon pattern, dated-source layout from Next #13, print-file download once export-to-print ships.
- **Done when:** an ask such as "how do I magnetize a printed motor" or "show the magnetize step" opens the card with the three sources dated; soft-magnetic vs hard-magnetic is clear; no sold likeness; tests stay green.
- **claim:** DONE, live at c5d99e8 (show the magnetize step)
- **claim_until:**

### Next [think-tank] — printed-motor card: from a twitch to a wave
- **What:** an ask such as "can you 3D print a motor", "printed motor" or "printed robot arm" opens a card in three short dated steps. A printed linear motor, all five materials, moved 318 µm at 41.6 Hz with one post-step to magnetize (MIT News, 18 Feb 2026; doi 10.1080/17452759.2026.2613185). Printed rotary and linear motors, every element except the bought magnets, now run a fan, a water pump, a paddle-wheel boat, a multi-legged walking robot and a waving arm, at 7.62 N mm/A and 28.2% peak efficiency (Schwalbe et al., Advanced Materials Technologies, 20 Apr 2026, doi 10.1002/admt.70994). A one-print soft robot walks off a desktop printer on air alone (Zhai et al., Advanced Intelligent Systems, 26 Jan 2025, doi 10.1002/aisy.202400876). Ends with the line "Next: a printed motor small and cool enough to wave a toy figure's arm," and links the magnetize-step card. Original wording only.
- **Why:** Forethinkers established (2026-10-07 20:14 ET) that a printed motor already moves an arm, so Void can show a visitor the real state of one-shot printed machines with sources, and the honest next step toward a figure that waves.
- **Reuse:** the dated-source layout from the magnetize-step, senolytic MASH and coral cards; links to the magnetize-step card and Linemote-1.
- **Done when:** each example ask opens the card with the three sources dated and the "Next" line visible; a test checks the card renders offline; tests stay green.
- **claim:** DONE 2026-10-08 run 55 (skills/printedmotor.js): "can you 3d print a motor", "printed motor", "printed robot arm" show the three dated steps and the "Next" line, with the Pentamote-1 miniature moving on the card and links to the magnetize step, Pentamote-1 and Linemote-1; browser test checks it offline.
- **claim_until:**


[think-tank] 2026-10-03 summon / export: Linemote-1, the first printable part. "summon linemote-1" shows its page and Download STL saves linemote-1.stl (built on the printed linear motor, https://news.mit.edu/2026/3d-printing-platform-rapidly-produces-complex-electric-machines-0218, 2026-02-18). Next: one test print.

[think-tank] 2026-10-03 summon / spin / export: Motelet, the first figure that uses the stage. "a chair" then "summon motelet" and it sits; "a cup" and it holds it; "download motelet" saves its body as a print file. Next: a second ask that changes size, pose or a part, and one test print.

[grok builder] 2026-10-07 15:40 ET health: sleep, pregnancy and ovulation (quick builds this afternoon) now share one memory, the period log (`skills/period.js`). "my period started today" saves it in this browser; "how long is my cycle", "is my period late", and "when am i ovulating" with no date all read it. Natural next step: "when is my due date" with no date reads the same log, and a per-day note (symptoms, mood) on it.

[grok builder] 2026-10-07 layers and groups: Next #3 is complete. `skills/layer.js` (PR #152): "bring the clock to the front", "send the note to the back". `skills/group.js` (this PR): "group the clock and the note", then drag one and both move; "move the group to the top left", "make the group bigger", "bring the group to the front", "ungroup". Natural next step: labels and arrows between grouped things (Later: text annotation).

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
- **Status 2026-10-07 (grok builder): z-order half shipped** (`skills/layer.js`, PR #152): "bring the clock to the front", "send the note to the back", "send it to the back", "bring all the notes to the front" reorder the stage and survive a reload; "put the clock on top" stays a position move.
- **Status 2026-10-07 13:40 ET (grok builder): grouping half shipped** (`skills/group.js` + drag-along in `bindDrag`): "group the clock and the note", "group everything", "group all the notes", "stick the clock and the timer together", "glue the clock to the note" tie things together; dragging one carries the rest the same distance (a throw takes only the one in the hand); "move the group to the top left / left a bit / down 100px / to the middle" keeps their spacing; "make the group bigger / smaller / twice as big" scales spacing and sizes; "bring the group to the front" / "send the group to the back" (layer.js); "what is in the group"; "take the clock out of the group"; "ungroup". Saved with the stage, so groups survive a reload. Next #3 is complete.
- **claim:** DONE (both halves: layer.js at PR #152, group.js this PR)
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
- **Text annotation / labels:** shipped 2026-10-07 by the grok builder (`skills/label.js` + a `decorate` hook skills can register in void.html): "label the clock kitchen", "put a label on the timer that says pasta", "label it pasta" tag a thing (the tag rides with it); "add a label that says to do" puts a free-floating label on the stage; "draw an arrow from the clock to the note", "connect the timer to the counter", "point the note at the clock" draw an arrow that follows either end when dragged or when its group moves; labelled things answer to their label ("draw an arrow from kitchen to groceries"); "remove the arrows", "disconnect the clock from the note", "remove the label from the clock", "remove the labels", "show the labels"; all saved with the stage, "undo" takes the last change back. Next: arrows with words on them ("connect the clock to the note with 'then'"), and "connect kitchen to groceries" by label name without the word arrow.
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

Paths: `C:\Users\adamm\.agents\skills\a-to-mind-automation\autosalvage` · `C:\Users\adamm\P2\recovery\autosalvage` · `archive/victus/victus-ingest*.json`

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
