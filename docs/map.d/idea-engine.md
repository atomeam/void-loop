# The idea engine (2026-11-20)

Owner, 2026-11-20: "how can we keep coming up with really good ideas?", "make sure it checks everything we already have", and consolidate
the idea systems into one. **One engine**, daily, so Verse keeps coming up with good ideas by itself:

- **Core:** `void-live-deploy/lib/idea-core.js` (pure; test `tools/idea-core.test.mjs`). Inventory of everything that exists (skills,
  pages, games, cards, loops, tricks, MAP entries, the older idea lists), aggregated visitor signals (a topic only at 3+ people, never an
  ask), five generators (improve lenses on existing features, mash-ups across families, signals, the pattern study of what makes games, apps
  and easter eggs fun, and seeds from the older lists), dedupe, taste scoring (fun first, grow what exists, linked, a minimal homepage,
  business capped), a round-robin tournament, the picks, and ship-small-and-measure (grow, or rework: never deleted) with a per-generator
  bandit weight. Ideas from Verse's take on an answer card (`splitTake`, `judgeTake`) start at once when they clear the bar.
- **Runner:** `tools/idea-engine.mjs` (workflow `idea-engine.yml`, playbook `docs/playbooks/growth-loop.md`): writes `void-live-deploy/tower.ideas.json` (owner-only; `/tower/` shows it), `void-live-deploy/idea-ids.json` (slugs `lib/idea-use.js` counts) and `void-live-deploy/growth/latest.json` (the public share card: title, link, score). How many it builds scales from 1 to 5 with the stranger-gate pass rate (`pickCount`). The will reads the picks. Levers on the board: weak-answer feedback, callable blocks, live-revert repair, share cards, regression rows.
- **Methods borrowed (public practice):** SCAMPER, morphological mash-ups, the Kano model's delighters, ICE-style scoring, round-robin
  tournaments, multi-armed bandits. Models: Workers AI, Verse's own (/api/coder) or Groq only; past the free limits the treasury pays
  and the cents are logged on the board.
- **Older idea systems, folded in:** the frontier's open items, the growth inbox, docs/GAPS.md, the game catalogue's wishes, the brain's
  drafts and `tools/grow-ideas.mjs`'s bank are seeds in the same tournament; the verdict for each system is on the board (`engines`).
