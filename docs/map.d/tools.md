`checks-list.mjs` `helper-pr.mjs` `humble-copy.mjs` `calendar-rivals-e2e.mjs` `notes-rivals-e2e.mjs` `translate-rivals-e2e.mjs` `brain-probe.mjs` `flow-probe.mjs` `redirect-builders.mjs`
`proposal-pack` `ownership-map` `handoff-checklist` `reuse-pack` `progress-report` `system-slice`
- `tools/cards-delta.mjs` (lists run 20, `tools/cards-delta.test.mjs`): Verse review runs the generated cards' checks (refresh --check for index, first, deps, families, guide, what, and the map coverage) on a pull request that touches the skills, the families or the map; only a card the pull request itself leaves stale fails, with its fix named.
- `tools/wishlist-rank.mjs` (lists run 21, `tools/wishlist-rank.test.mjs`): the daily wishlist re-rank in upkeep.yml; docs/wishlist.md's own rule as code (value, then free ahead of paid, then items the providers block last, then the old order); only the # column moves, and lib/reinvest.js still finds a row that moved by its opening word.

- `tools/sync-free-lanes.mjs`: reads OpenRouter's model list and writes the free-model registry; `--dry` previews it and `--check` checks the saved registry age.
- `tools/no-third-party-sites.mjs`: the site-wide guard that keeps a third party's host names off the public pages (the /starboard/ cleanup): every HTML file under `void-live-deploy/` is read, and one of the named hosts fails the check.
- `tools/uni-pass.mjs`: the builder Uni pass helper for headless verification — seeds the existing Uni gate key from `VERSE_BUILDER_UNI_TOKEN` so builders inspect full live pages.
- `tools/daily-ai-radar.mjs`: the daily AI capability radar — fetches daily AI releases/papers, dedupes against `data/ai-radar-seen.json`, diffs against Verse's skill inventory, and queues net-new job specs.
- `tools/audit-sanity.mjs`: the copy and domain gate: every public HTML, JS, and worker/API endpoint under `void-live-deploy/` is read, and a forbidden third-party domain or lore/rivalry copy fails the check.
