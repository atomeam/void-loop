# Visible progress

Atom, 2026-11-03: "weve come so far and still feels like we are sitting still".

Progress is what a visitor can see and use on a-to-mind.com. A broken card, a wrong answer, a refusal shown on a card, a laggy render or a missing link outranks internal work. Laps, gates, incident logs and regenerated files are not progress.

## What starts it

A want, an ask or a conductor job whose words are about the visitor's screen, or a ship that should show up in the wants card's count.

## Commands

- The rule lives in `void-live-deploy/lib/visible.js` (`rankAdjust`, `shippedVisible`).
- `tools/will.py` calls `node tools/visible-rank.mjs` once per gather and adds the result to each candidate's weight (never below 1).
- `tools/conductor-core.mjs` `score` adds the same adjustment from the job's note.
- `tools/self-context.mjs` writes `visible: { day, week }` into `/self.json` from `git log` of pages and skills. The deploy rewrites that file, so the live wants card shows main.
- The wants card (`skills/wants.js`) shows the count, the top 3 wants and the top 3 asks, and folds the rest behind "Show the other N".

## How to tell it worked

`node --test tools/visible.test.mjs tools/wants.test.mjs tools/want-card.test.mjs tools/conductor.test.mjs`

A visible candidate's weight is higher than an internal one that started ahead. The wants card's first lines are the counts, the shipped line, and the top 3.

## Mistakes already made

Counting every commit, including regenerated files and workflow edits, made a quiet week look busy. Only a page (`void-live-deploy/**/*.html`, `void.html`) or a skill (`void-live-deploy/skills/*.js`) counts. A redraw of the wants card used to drop the reply section and the page mounted another; the redraw moves the one reply section back.
