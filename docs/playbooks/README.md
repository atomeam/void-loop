# Playbooks: how Verse does the builders' work itself

The owner, 2026-10-15: "teach a man to fish so that Verse can do all this itself one day . you should be training it to do everything you can better than you".

Each playbook is one kind of work a builder did by hand, written so Verse's own loop (its model through `lib/models.js`, its tools in `tools/`) can follow it step by step: what starts it, the exact commands, how to tell it worked, and the mistakes already made. A run that does a new kind of work by hand writes its playbook here; a run that follows one and finds a better way rewrites it. Frontier #28 is Verse taking these over, one at a time, measured by how much of what ships it made itself.

| Playbook | What it grows | Followed by Verse yet |
|:--|:--|:--|
| [art-forge.md](art-forge.md) | a card's art | painted art of an answer or merged card's subject, once per subject, behind a daily cap and a kill switch (`/api/card-art`, `lib/card-forge.js`) |
| [probe-and-fix.md](probe-and-fix.md) | an existing skill, from asks it misses | steps 1–5: Verse writes 25 asks for its least proven family and probes them daily (`.github/workflows/probe-asks.yml`), then proposes the matcher fix for the oldest miss and the repo's checks decide (`.github/workflows/propose-fix.yml`, a pull request labelled "made by Verse"); a builder still reviews and merges |
| [build-miss.md](build-miss.md) | a new skill from an ask people typed that nothing answered (the new-skill lane of the miss board) | the whole lane, daily (`.github/workflows/build-miss.yml`, `tools/build-miss.mjs`): Verse claims the oldest "lane: new skill" miss job, scaffolds it, has its model fill the card with the ask as data, and the repo decides (collisions, overlap, a unit test, the ask on the real page, the map, Verse's review); a pass is a pull request labelled "made by Verse" that merges on Verse's review at confidence 0.8 and up, and the job goes live when it merges (`tools/job-link.mjs`) |
| [route-correction.md](route-correction.md) | a skill that took an ask that is not its job | Verse narrows its own matcher from the owner's correction (`route:` jobs, `tools/propose-fix.mjs` narrow mode, checked by "lets go"); a route made inside the page goes to a builder |
| [floor-kit.md](floor-kit.md) | one site of the tower, from next in the queue to gate dispatched, in minutes (lanes: the smallest site first, the leader last) | not yet |
| [lane-site-pages.md](lane-site-pages.md) | a page of its own for every site of a lane, from one table (PDF tools, Kanban) | not yet |
| [tower-rank.md](tower-rank.md) | which Versus site next: every site ranked by real traffic (Tranco), smallest first, with a hand order | not yet |
| [table-skill.md](table-skill.md) | a new skill answered from a built-in table | not yet |
| [review-rule.md](review-rule.md) | a code-review check for a bug the review missed | not yet |
| [film.md](film.md) | a film, and the next film being better | not yet |
| [generated-book.md](generated-book.md) | a page for everything, read off the repo, with a stale check (the book) | not yet |
| [manifest-field.md](manifest-field.md) | a generated manifest (families.json and its kin): a new per-row fact read off the repo, and the card that shows it | not yet |
| [study-with-rea.md](study-with-rea.md) | a brief built on how the best really do it (REA, with evidence) | not yet |
| [forge-recipe.md](forge-recipe.md) | a new thing the forge can print (a recipe, a figure as a recipe), and an offered routine forged into a skill | not yet |
| [perf-pass.md](perf-pass.md) | the page, the 3D or the suite measurably faster, numbers before and after | not yet |
| [changed-checks.md](changed-checks.md) | a builder's pre-push check runs only what covers the changed files (`checks.mjs --changed`); main runs everything | not yet |
| [stage-bridge.md](stage-bridge.md) | a bridge between two kinds of thing on the stage, or a new stage card, from one of Verse's own asks | not yet |
| [rules-engine.md](rules-engine.md) | a game's rules as a data rule set that stacks with every other (frontier #35) | not yet |
| [inbox-health.md](inbox-health.md) | a skill-health line, map or job in the growth inbox, from files the repo already writes | not yet |
| [real-movies.md](real-movies.md) | a movie pick that names only found movies, with their poster as art, playing only free legal films and official trailers | not yet |
| [tower-loop.md](tower-loop.md) | one tower floor driven to conquered: the gap read from the gate's evidence, the page or the gate fixed, the verdict read back | an hourly scheduled run (a fresh session each hour) follows it |
| [build-voice-asks.md](build-voice-asks.md) | Verse's own asks from `domains/void.voice.md`: group repeats, check what is built, record or ship one small PR each | not yet |
| [team.md](team.md) | a team of agents kept busy: Verse hands each idle agent its next build-queue job in the team chat (`/team/`, join links, `/team/agents.txt`, `/team/mcp`, `/team/agent.mjs`) | Verse hands out the jobs itself; agents join when the owner invites them |
| [make-music.md](make-music.md) | an original short piece of music composed from an ask and synthesised in the browser (song, beat, lullaby), with a piano roll, WAV and notes | not yet |
| [stage-mode.md](stage-mode.md) | a mode over the whole stage (the camera of "fly around": pure maths in `lib/`, a skill that owns the HUD, the keys and Esc, the view never the state) | not yet |
| [game.md](game.md) | a game that feels good to play: the brief names idea, vibe and 2D/3D; juice by name; a screenshot round after every change, fix the weakest thing; a plain-words playtest (from a video the owner shared by Duncan Rogoff) | not yet: the suite counts page errors and the Site Test measures fps; the screenshot round is a builder's |
| [stage-effects.md](stage-effects.md) | a pack of effects on everything already on the stage (motion drawn by transform only, a seeded mutation, timed or confirmed removal, an ephemeral flood), one lib, one test file, one browser section | not yet |
| [field-mind.md](field-mind.md) | a small simulated field with a tiny local mind on the shared kit (flow canvas, swarm, figures): pure law, Worker mind with a page fallback, card, tests | not yet |
| [approve-card.md](approve-card.md) | a card that waits on the stage for a yes through the confirm line and then runs on the server clock after you leave (the approve card over D1 automations) | not yet |
| [device-memory.md](device-memory.md) | something Verse keeps about a person on the device only: a key in `lib/state.js`, a pure lib with caps, a one-line hook where a skill answers, a card with tap-to-ask chips, "forget" and "stop" asks (the personal memory graph) | not yet |
| [open-endpoint-closed-list.md](open-endpoint-closed-list.md) | an open POST endpoint strangers can use safely: closed list of ids, salted per-day client key, layered limits, fail closed (spectator reactions) | not yet |
| [page-part-probe.md](page-part-probe.md) | a tower floor's aspect the gate must see on a page of its own: a real generated picture, a working engine (pageParts, pictureOf) | not yet |
| [daily-art.md](daily-art.md) | a report page that wants a picture that changes each day: an illustration inside its own budget, or an openly licensed photo or an official embed with its true credit (dailyArt, dailyArtInfo, mountCredit) | not yet |
| [lab.md](lab.md) | the lab repo's hourly experiments as live pages at /lab/, each opened in a headless browser first, the broken ones queued for a fixer (`tools/lab-sync.mjs`, `.github/workflows/lab-sync.yml`) | the daily run imports, tests and opens the pull request itself; fixing a broken one is the free coder's
| [conductor.md](conductor.md) | Verse runs its own work: every queued job goes to the loop that can do it, broken loops get repaired, the clock keeps itself alive | every 10 minutes (`grow-clock.yml`, `tools/conductor.mjs`) |
| [indexnow.md](indexnow.md) | search engines told within minutes which listed pages a deploy changed (IndexNow: Bing, Yandex and the rest) | every main deploy runs it (`deploy.yml`, `tools/indexnow.mjs`) |
| [jobs-feeds.md](jobs-feeds.md) | another site's listings shown under its own terms: terms read first-hand, one source table, a server fetch with the edge cache, a daily snapshot, credit and link back on every listing, search links labelled by how sure they are | not yet |
| [use-own-tools.md](use-own-tools.md) | Verse's own work done with the tools it built for people: the SEO audit on its pages, its compressor on its pictures, its readability tool on its copy, each with a before and after, and an inventory of every tool and where Verse uses it | the audit and the compressor hold in checks; finding the next wiring is not yet Verse's |
| [self-check.md](self-check.md) | a page of Verse's own that the self-check found broken, fixed and checked again on the live site | the finding, after every deploy (`.github/workflows/self-check.yml`); the fix is a builder's |
