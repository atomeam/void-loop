# workingnomads.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: workingnomads.com (https://www.workingnomads.com/jobs)
- Verse: /jobs/alerts/ (jobs: workingnomads.com, tower gate 15 of 17)
- Live scan: 2026-10-28, HTTP 200, page title "Remote Jobs / Working Nomads"
- History: [docs/HISTORY/workingnomads.com.md](../HISTORY/workingnomads.com.md)

**Match: 54%**: 7 have, 1 partial, 1 missing, 5 unreviewed, of 14 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search jobs by title and place | Find | have | its live page (2026-10-28): "Remote Jobs / Working Nomads MENU Remote Jobs Companies ✦ Go Premium Job Alerts Post a Job Log in Sign up Tog" | void-live-deploy/jobs/alerts/index.html:63 `<p class="intro">Save a search and come back: each saved search shows how many jobs are` |
| Filters: remote, type, level, salary | Find | have | its live page (2026-10-28): "Remote Jobs / Working Nomads MENU Remote Jobs Companies ✦ Go Premium Job Alerts Post a Job Log in Sign up Tog" | void-live-deploy/jobs/alerts/index.html:68 `> <a href="/jobs/categories/">Remote jobs by category</a> <a href="/jobs/tags/">Remote job` |
| Job alerts | Alerts | have | its live page (2026-10-28): "Remote Jobs Companies ✦ Go Premium Job Alerts Post a Job Log in Sign up Toggle navigation Working Nomads logo" | void-live-deploy/jobs/alerts/index.html:62 `<h1>Job alerts without an account</h1>` |
| Company pages | Data | have | its live page (2026-10-28): "Jobs / Working Nomads MENU Remote Jobs Companies ✦ Go Premium Job Alerts Post a Job Log in Sign up Toggle nav" | void-live-deploy/lib/jobs-ui.js:39 `const bits = [j.company, j.loc // t('Anywhere'), j.type && t(C.TYPES[j.type] // j.type),` |
| Salary information | Data | have | its live page (2026-10-28): "nce Level Jobs by Position Type Jobs by Salary API Scam Alert FAQ Privacy policy Terms and conditions Contact" | void-live-deploy/lib/jobs-ui.js:43 `+ (j.salary ? '<div class="pay">' + esc(C.salaryText(j.salary, lang())) + '</div>' : '` |
| Apply, or go to the application | Apply | have | every site of this kind offers it | void-live-deploy/jobs/alerts/index.html:69 `s original posting, where you apply. Your saved jobs, alerts and applications stay in this` |
| Post a job | Employers | missing | its live page (2026-10-28): "Jobs Companies ✦ Go Premium Job Alerts Post a Job Log in Sign up Toggle navigation Working Nomads logo Workin" | no sign of it in the source of /jobs/alerts/ |
| A jobs API or feed | Developers | have | its live page (2026-10-28): "el Jobs by Position Type Jobs by Salary API Scam Alert FAQ Privacy policy Terms and conditions Contact us Abou" | void-live-deploy/jobs/alerts/index.html:63 `oked, and marks them. Add its RSS feed to a reader for alerts away from the page. No email` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "nies ✦ Go Premium Job Alerts Post a Job Log in Sign up Toggle navigation Working Nomads logo Working Nomads Re" | void-live-deploy/lib/jobs-ui.js:19 `{ try { const m = JSON.parse(localStorage.getItem(KEY) // '{}'); return m && typeof m ===` |
| ✦ Go Premium | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Premium Subscription | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sponsorship | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Reviews | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
