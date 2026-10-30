# himalayas.app: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: himalayas.app (https://himalayas.app/jobs)
- Verse: /jobs/salary/ (jobs: himalayas.app, tower gate 1 of 16)
- Live scan: 2026-10-28, HTTP 403, page title "Just a moment..."
- History: [docs/HISTORY/himalayas.app.md](../HISTORY/himalayas.app.md)

**Match: 60%**: 3 have, 0 partial, 0 missing, 2 unreviewed, of 5 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search jobs by title and place | Find | have | every site of this kind offers it | void-live-deploy/jobs/salary/app.js:3 `ementById('app'), {"panels":["search","saved","alerts","tracker","feed","sources"],"preset` |
| Filters: remote, type, level, salary | Find | have | every site of this kind offers it | void-live-deploy/jobs/salary/index.html:62 `<h1>Remote jobs with salaries</h1>` |
| Apply, or go to the application | Apply | have | every site of this kind offers it | void-live-deploy/jobs/salary/index.html:69 `s original posting, where you apply. Your saved jobs, alerts and applications stay in this` |
| Its live pages could not be read (HTTP 403), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://himalayas.app/jobs | not compared yet |
