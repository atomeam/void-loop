# Playbook: the outcome exam

Owner, 2026-11-03: Verse was not getting better at videos, podcasts or songs; the improvement has to be what a visitor gets, not a count of skills or a lesson sentence.

## What starts it

`.github/workflows/exam.yml` runs `node tools/exam.mjs` after every successful deploy and once a day (09:17 UTC). A person can run it the same way. `EXAM_HOLDOUT`, a GitHub secret, is the sealed holdout file when it is set. Without it the public exam still runs and the last holdout score stays, marked not remeasured.

## What it does

Sixteen public asks a domain (videos, podcasts, songs, weather, directions, recipes, calculator, news, sports), taken from `tools/bench.json` where that file has the ask, and the same kind of ask where the public repo has no visitor log for it. Verbatim visitor asks are not committed (domains/void.misses.md is gitignored, so it is named without backticks). The holdout is four more asks a domain, rotated by ISO week from tools/exam-holdout.json, which is gitignored. Builders do not get that file. The published run stores holdout scores and ids, not the words.

Each ask is typed into live https://a-to-mind.com at phone width. A non-GET is answered inside the browser. The score is the share of checks that passed: a result that is not a refusal, the skill that owns the domain, under 12 seconds, the card fits the phone, and the domain's own check. A song passes when an `audio` element's time advances, the file returns 200 or 206 with an `audio/*` type, and the title and artist on the card are the ones iTunes Search returned for that ask. A check whose outside service did not answer is left out of the score, not failed.

`node tools/exam.mjs --against local` serves this tree and proxies `/api/` to the live site, so a change can be scored before it deploys.

The will (`tools/will.py`) adds the three failing public asks of the lowest domain at a weight above the frontier. The conductor (`examBoost` in `tools/conductor-core.mjs`) lifts a queued job that names that domain or that ask. A later run whose public score fell by 5 or more in any domain is recorded and exits 0. A second run in a row that also falls by 5 or more exits 1. On a deploy, `exam.yml` reverts that deploy only then (`revert=yes`). It leaves a commit that changes nothing under `void-live-deploy/`, and it leaves the first runs after the exam scale itself changes: those are a new baseline (`scaleSettling`). A crash does not set that output, so it does not revert. A daily run records the drop and does not revert.

## How to tell it worked

- `void-live-deploy/exam/latest.json` has a score per domain, and https://a-to-mind.com/progress/ draws it.
- A song ask that plays shows `audio: true` in a run you print with `node tools/exam.mjs --domains songs`.
- `node --test tools/exam.test.mjs tools/hear.test.mjs` passes without a browser.

## Commands

- `node tools/exam.mjs`
- `node tools/exam.mjs --against local --domains songs`
- `node --test tools/exam.test.mjs tools/hear.test.mjs`

## Mistakes made

- An iTunes preview is `audio/x-m4p`, not `audio/mpeg`. The check accepts any `audio/*` type. Headless Chrome on this machine does advance `currentTime` on that file when playback is muted.
- An `audio` with `width:100%` plus the card frame's 18px side margins is 36px wider than the phone card, so the mobile check fails. `max-width:100%` and no forced width fits.
- A bare "play despacito" is still a video search. The recording skill takes "play … by …" only, so the two do not overlap and the exam can check an artist.
- Missing domains must not count as zero, or the lowest domain is whichever one the run did not measure.
- Scale 2 (2026-11-04) adds ambiguous, follow-up, non-English, narrow-phone and slow-network asks, and ten domains (emoji, translate, units, maps, timers, images, prices, definitions, word problems, code). `checks.rival` is the best free source's answer (Wiktionary, Google Translate's keyless endpoint, Coinbase spot, Frankfurter, the Unicode name, the unit conversion). A run whose `scale` differs from the previous one is a new baseline: `compareRuns` does not treat the drop as a regression. The next run on the same scale still blocks a drop of 5.
- A directions card can draw a real map and still fail `route`: the check reads the card's words, and an address that lives only in a link's `href` is not among them. Say the kilometres, or the site name, in the text. A landmark Open-Meteo does not know ("eiffel tower", "Penn Station") comes back as "couldn't find", which the exam counts as a refusal. Wikipedia's coordinates cover those. "get me to …" was a food order, so the place skill never ran.
- The VAT card was not in the routing order, so "add vat to 100" never reached it. An order file is what puts a skill on the page.
- "news about earthquakes" was taken by the quake list, and "business news" / "science news" matched nothing. A news ask has to reach the news skill, and a section ask should open that section of `/api/news`.
