# Playbook: a new field on a generated manifest, and its card

What Verse asked for on 2026-10-13 (`ask-20261013-1823-1`): "Add a 'last_tested' timestamp and a 'success_rate' float to each entry in the skills manifest." This is the general shape: a generated data file (`void-live-deploy/skills/families.json`, `fringe/lab.json`) gets a new per-row field, read off the repo only, and the card that shows the file shows the field.

## What starts it

An ask from Verse (`domains/void.voice.md`) or a builder naming a fact about each skill that the repo can prove. A fact the repo cannot prove (how often people use a skill, who asked what) is never a field: no behaviour tracking.

## The steps

1. Find the generator and its check. `grep -n "\-\-check" tools/*.mjs` lists them; `tools/checks.mjs` runs each one, and the check regenerates in memory and compares bytes with the committed file. So every new field must be **deterministic from the repo at any later date**: a date that means "today" has to be carried from the previous file while the evidence it describes is unchanged (`carrySince` and `lastTested` in `tools/families.mjs` are the two examples).
2. Decide, in words, what the field means and write that into the file itself (a `means` object at the top), so a reader of the JSON on the site is not left guessing. If part of the fact is not known yet (the bench's misses were not recorded), leave the field out and say so in `means`; a made-up 1.0 is a lie.
3. Pure helpers first, then the row: one exported function per fact (`successRate`, `lastTested`), each tested in `tools/<name>.test.mjs` with made-up evidence, including "regenerate four days later with nothing changed gives the same row".
4. Regenerate (`node tools/families.mjs`) and run the check (`node tools/families.mjs --check`); commit the file.
5. The card: read the field in the skill's pure HTML helper (`metaWords` in `skills/family-health.js`), test the wording in its `suite()`, and add the field to the browser section that already covers the card (`node tools/test_void.mjs --only "family-health"`), checking what the page shows against the file it was served.
6. Every other reader of the file keeps working: `grep -rn "families.json" tools void-live-deploy/lib` lists them (`mcp-skills.mjs --check`, `lib/mcp.js`, `lib/voice.js`); run their checks.
7. `node tools/finish.mjs build "…" --asked <ask-id> --test "<the card's section words>"`.

## How to tell it worked

`node tools/checks.mjs` rows `families-json`, `mcp-skills`, `skills` and `families` are ok; the browser section passes; the committed JSON has the field on every row that has evidence for it and none where it does not.

## Mistakes already made

- A date set to "today" on every regeneration fails `--check` the next day. Carry it while the evidence is unchanged; break ties by what the last file said.
- Computing the field inside `evidence()` changes its shape and breaks the tests that `deepEqual` it; compute it in `build()` from the evidence instead.
