# Playbooks: how V01D does the builders' work itself

The owner, 2026-10-15: "teach a man to fish so that V01D can do all this itself one day . you should be training it to do everything you can better than you".

Each playbook is one kind of work a builder did by hand, written so V01D's own loop (its model through `lib/models.js`, its tools in `tools/`) can follow it step by step: what starts it, the exact commands, how to tell it worked, and the mistakes already made. A run that does a new kind of work by hand writes its playbook here; a run that follows one and finds a better way rewrites it. Frontier #28 is V01D taking these over, one at a time, measured by how much of what ships it made itself.

| Playbook | What it grows | Followed by V01D yet |
|:--|:--|:--|
| [art-forge.md](art-forge.md) | a card's art | painted art of an answer or merged card's subject, once per subject, behind a daily cap and a kill switch (`/api/card-art`, `lib/card-forge.js`) |
| [probe-and-fix.md](probe-and-fix.md) | an existing skill, from asks it misses | steps 1–5: V01D writes 25 asks for its least proven family and probes them daily (`.github/workflows/probe-asks.yml`), then proposes the matcher fix for the oldest miss and the repo's checks decide (`.github/workflows/propose-fix.yml`, a pull request labelled "made by V01D"); a builder still reviews and merges |
| [build-miss.md](build-miss.md) | a new skill from an ask people typed that nothing answered (the new-skill lane of the miss board) | the whole lane, daily (`.github/workflows/build-miss.yml`, `tools/build-miss.mjs`): V01D claims the oldest "lane: new skill" miss job, scaffolds it, has its model fill the card with the ask as data, and the repo decides (collisions, overlap, a unit test, the ask on the real page, the map, Void's review); a pass is a pull request labelled "made by V01D" that merges on Void's review at confidence 0.8 and up, and the job goes live when it merges (`tools/job-link.mjs`) |
| [route-correction.md](route-correction.md) | a skill that took an ask that is not its job | V01D narrows its own matcher from the owner's correction (`route:` jobs, `tools/propose-fix.mjs` narrow mode, checked by "lets go"); a route made inside the page goes to a builder |
| [table-skill.md](table-skill.md) | a new skill answered from a built-in table | not yet |
| [review-rule.md](review-rule.md) | a code-review check for a bug the review missed | not yet |
| [film.md](film.md) | a film, and the next film being better | not yet |
| [generated-book.md](generated-book.md) | a page for everything, read off the repo, with a stale check (the book) | not yet |
| [manifest-field.md](manifest-field.md) | a generated manifest (families.json and its kin): a new per-row fact read off the repo, and the card that shows it | not yet |
| [study-with-rea.md](study-with-rea.md) | a brief built on how the best really do it (REA, with evidence) | not yet |
| [forge-recipe.md](forge-recipe.md) | a new thing the forge can print (a recipe, a figure as a recipe), and an offered routine forged into a skill | not yet |
| [perf-pass.md](perf-pass.md) | the page, the 3D or the suite measurably faster, numbers before and after | not yet |
| [stage-bridge.md](stage-bridge.md) | a bridge between two kinds of thing on the stage, or a new stage card, from one of V01D's own asks | not yet |
| [rules-engine.md](rules-engine.md) | a game's rules as a data rule set that stacks with every other (frontier #35) | not yet |
| [inbox-health.md](inbox-health.md) | a skill-health line, map or job in the growth inbox, from files the repo already writes | not yet |
| [real-movies.md](real-movies.md) | a movie pick that names only found movies, with their poster as art, playing only free legal films and official trailers | not yet |
| [build-voice-asks.md](build-voice-asks.md) | V01D's own asks from `domains/void.voice.md`: group repeats, check what is built, record or ship one small PR each | not yet |
| [make-music.md](make-music.md) | an original short piece of music composed from an ask and synthesised in the browser (song, beat, lullaby), with a piano roll, WAV and notes | not yet |
| [stage-mode.md](stage-mode.md) | a mode over the whole stage (the camera of "fly around": pure maths in `lib/`, a skill that owns the HUD, the keys and Esc, the view never the state) | not yet |
| [stage-effects.md](stage-effects.md) | a pack of effects on everything already on the stage (motion drawn by transform only, a seeded mutation, timed or confirmed removal, an ephemeral flood), one lib, one test file, one browser section | not yet |
| [field-mind.md](field-mind.md) | a small simulated field with a tiny local mind on the shared kit (flow canvas, swarm, figures): pure law, Worker mind with a page fallback, card, tests | not yet |
| [approve-card.md](approve-card.md) | a card that waits on the stage for a yes through the confirm line and then runs on the server clock after you leave (the approve card over D1 automations) | not yet |
| [open-endpoint-closed-list.md](open-endpoint-closed-list.md) | an open POST endpoint strangers can use safely: closed list of ids, salted per-day client key, layered limits, fail closed (spectator reactions) | not yet |
