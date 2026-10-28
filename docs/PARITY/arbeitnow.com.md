# arbeitnow.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: arbeitnow.com (https://www.arbeitnow.com/)
- Verse: /jobs/europe/ (jobs: arbeitnow.com, tower gate 13 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "Jobs in Germany: Remote, Visa Sponsorship &amp; English Speaking - October 2026"
- History: [docs/HISTORY/arbeitnow.com.md](../HISTORY/arbeitnow.com.md)

**Match: 30%**: 6 have, 1 partial, 2 missing, 13 unreviewed, of 22 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search jobs by title and place | Find | have | its live page (2026-10-28): "Jobs in Germany: Remote, Visa Sponsorship & English Speaking - October 2026 Arbeitnow is now in the UK , Fran" | void-live-deploy/jobs/europe/app.js:3 `'app'), {"panels":["regions","search","saved","alerts","tracker","feed","sources"],"preset` |
| Filters: remote, type, level, salary | Find | have | its live page (2026-10-28): "Jobs in Germany: Remote, Visa Sponsorship & English Speaking - October 2026 Arbeitnow is now in the UK , Fran" | void-live-deploy/jobs/europe/index.html:63 `<p class="intro">Remote jobs you may do from Europe or Germany, with the ones that menti` |
| Company pages | Data | have | its live page (2026-10-28): "Interviews Germany Job Market Insights Companies Hiring in Germany Jobs by Locations Tools Tax Calculator Ger" | void-live-deploy/lib/jobs-ui.js:39 `const bits = [j.company, j.loc // t('Anywhere'), j.type && t(C.TYPES[j.type] // j.type),` |
| Salary information | Data | have | its live page (2026-10-28): "ar Jobs with Visa Sponsorship Jobs with Salary 4 day work week jobs Jobs with Relocation Package English Speak" | void-live-deploy/jobs/europe/index.html:63 `or remote-only or a city, the salary when it is given, and the page in German on a German` |
| Apply, or go to the application | Apply | have | its live page (2026-10-28): "icense in Germany Sick leave in Germany Applying for German Citizenship Surrending Indian Passport Glossary Ab" | void-live-deploy/jobs/europe/index.html:69 `s original posting, where you apply. Your saved jobs, alerts and applications stay in this` |
| Post a job | Employers | missing | its live page (2026-10-28): "Rate us on Google Privacy Terms Imprint Post a Job Blog About Top Homepage arbeitnow by Adithya Popular Compan" | no sign of it in the source of /jobs/europe/ |
| See who you know at a company | Personal | missing | its live page (2026-10-28): "GmbH Karriereweg GmbH Kassel System and Network Administration System and Network Administration Unbefristeter" | no sign of it in the source of /jobs/europe/ |
| A jobs API or feed | Developers | have | its live page (2026-10-28): "a Engineer Data Scientist Design DevOps Developer Engineering Entwickler Freelance Frontend Homeoffice IT Java" | void-live-deploy/jobs/europe/app.js:3 `","saved","alerts","tracker","feed","sources"],"preset":{"region":"europe"},"de":{"h1":"Jo` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "articles Probation Period (Probezeit) Resigning your job in Germany Blue Card in Germany How to change jobs on" | void-live-deploy/lib/jobs-ui.js:19 `{ try { const m = JSON.parse(localStorage.getItem(KEY) // '{}'); return m && typeof m ===` |
| France | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Switzerland | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Popular | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Locations | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Categories | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Hiring Without Whiteboard Interviews | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Tax Calculator Germany - 2026 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Netherlands Income Tax Calculator 2025 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Tax Refund Calculator - Germany | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Einbürgerungstest Online | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Aachen | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Augsburg | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
