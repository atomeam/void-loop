# Playbook: Verse's own automations

Fifteen runs Verse keeps, independent of Grok. The rules live in `void-live-deploy/lib/verse-runs.js`. The 15-minute clock (`functions/api/automations/tick.js`, `.github/workflows/void-tick.yml`) can attach `dueReport`. Writing the public asks into the inbox is `node tools/verse-runs.mjs --write` (it refuses a private note).

## What starts it

A day, a Sunday, or a weekday hour. At most four runs at once. A run that would call the model waits after 20 calls that UTC day. These first runs distill from the repo and do not call a model.

## How to tell it worked

`node --test tools/verse-runs.test.mjs` passes. A public ask names a skill, a frontier item, or a floor. A stamina, fuel, daily-plan, weekend, or weekly-review note is not in the inbox text.

## Mistakes

`helper/numbers-prove` rewrote the hear skill's HTML escaping into a no-op. Do not take that diff. The proof is `tools/numbers-proof.test.mjs`.

A news headline that is only a backlash ("Midterm data-center backlash hits") is not a delivery ask.
