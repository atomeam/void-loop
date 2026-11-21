# The growth loop

One daily pass. The tournament already lives in `void-live-deploy/lib/idea-core.js`. This playbook is the runner that was named and not built.

## What starts it

`.github/workflows/idea-engine.yml`, every day at 14:11 UTC, or `node tools/idea-engine.mjs --write`.

## What it reads

Skills, pages and games already in the tree. Open rows of `docs/GAPS.md`. Failed and partial rows of the capability sweep, by name only. Visitor misses only as topics that at least three people typed (`signals` in `lib/idea-core.js`). No raw ask is written down.

## What it does

Scores fun, useful, surprise and how buildable each idea is, then a round-robin. It builds 1 idea until the stranger gate (`lib/stranger.js`) has a pass rate, then up to 5 as that rate rises. A pick is recorded as waiting. It does not ship until that gate passes. The will reads `void-live-deploy/tower.ideas.json`. The next-tool house lane reports the top pick instead of choosing its own. The side-by-side Tower page stays; it is not what chooses the next build.

Each run records cost. This pass calls no model, so the cost is 0 cents and 2 runner minutes. A later rescore, if `GROWTH_ASK=1`, may use Workers AI or Groq only.

## How to tell it worked

`node --test tools/idea-core.test.mjs tools/idea-engine.test.mjs` passes. The board names one pick, a null pass rate, and 0 cents. `/tower/` (owner only) shows the same board.

## What it will not do

It will not open a second idea tournament, delete an old loop, or put a visitor's sentence in the repo.
