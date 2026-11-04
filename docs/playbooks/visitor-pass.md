# Playbook: the visitor pass

A person types an everyday question. This checks that Verse answers it.

## What starts it

Nothing by hand. `tools/site-test.mjs` (the site tester, `.github/workflows/site-test.yml`, after every deploy and hourly) runs the short list first: `node` imports `pass()` from `tools/visitor-pass.mjs` with `TOP`. The conductor (`tools/conductor.mjs`, every 10 minutes from grow-clock.yml) reads the newest `visitor` row in `tools/site-test.log.json` and files each failed ask once as a `visit:` job on the build queue. Verse's will (`tools/will.py`) reads the same row into its candidates.

A person can run the whole fifty: `node tools/visitor-pass.mjs --full --out /tmp/visitor.json`. `--only desktop` or `phone,slow`. `slow` is a phone width on a 400 kbps link with 400 ms delay. `VOID_SITE` points it somewhere else.

## What it does

One fresh browser. Posts to Verse are answered inside the browser, so a pass never lands in the miss board. The weather, the dictionary and a price are real GETs. For each ask it records who answered, the card's words, how long until those words were useful, and whether the card is wider than the screen. A refusal, a card still on "…", or words that are not about the ask, fails it.

## How to tell it worked

The run prints `ok` or `FAIL` per ask, then `desktop: N/50 correct`. `node --test tools/visitor-pass.test.mjs` locks the verdict and the queue row. On the clock, a failed ask shows up as a `visit:` job and the conductor's summary names it.

## Mistakes made

Judging the card's frame ("COPY CARD") or the previous card as the answer. The verdict reads the card's own words. A 404 from another site is not a wrong answer when the card already says the thing asked.
