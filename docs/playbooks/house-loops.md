# Playbook: house loops

`tools/house-loops.mjs` runs one lane from `void-live-deploy/lib/house-loops.js`. `.github/workflows/house-loops.yml` starts it. `gh workflow run house-loops.yml -f lane=links` runs one now.

Links adds a redirect only for a 404 whose home is already in the tree (`/reading-list/` to the Echo Vault entry). Health, speed, twins, plain words, candle dates, titles, the next untested file, advisories, the next page pair, and the oldest open gap are the other lanes. Games and the Echo Vault page are not edited. A dependency is named, not bumped. The weekly link check and the audit summary in `upkeep.yml` stay as the wide pass; this lane is the one that can fix a known 404.

Free models first (`HOUSE_ASK=1` on the next-tool lane). The strong tier runs only when `payTier` says the treasury holds 500 cents, a month of it. Each row on `/progress/` records minutes and whether the treasury paid. One run a day of every lane is about 960 Actions minutes a month. This repo is public, so standard runner minutes are not billed.

A result that changed writes `void-live-deploy/progress/loops/<id>.json` and opens `house/<lane>`, labelled automerge. A later run pushes onto that branch. Three failures set a six-hour pause.

`node tools/house-loops.mjs run links --dry` prints the result and writes nothing.
