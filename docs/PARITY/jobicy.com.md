# jobicy.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: jobicy.com (https://jobicy.com/)
- Verse: /jobs/regions/ (jobs: jobicy.com, tower gate 15 of 17)
- Live scan: 2026-10-28, HTTP 200, page title "Remote Job Board & Career Intelligence Platform / Jobicy"
- History: [docs/HISTORY/jobicy.com.md](../HISTORY/jobicy.com.md)

**Match: 39%**: 10 have, 1 partial, 3 missing, 13 unreviewed, of 27 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search jobs by title and place | Find | have | its live page (2026-10-28): "Remote Job Board & Career Intelligence Platform / Jobicy Jobicy Jobicy home Jobicy Search remote jobs Job tit" | void-live-deploy/jobs/regions/index.html:63 `alary when it is given. Every search has an RSS feed for your reader, with no account.</p>` |
| Filters: remote, type, level, salary | Find | have | its live page (2026-10-28): "Remote Job Board & Career Intelligence Platform / Jobicy Jobicy Jobicy home Jobicy Search remote jobs Job tit" | void-live-deploy/jobs/regions/index.html:62 `<h1>Remote jobs by region</h1>` |
| Job alerts | Alerts | have | its live page (2026-10-28): "nt Companies Salaries Career Advice Job Alerts More Post a Remote Job Hiring Plans Back Remote jobs menu Explo" | void-live-deploy/jobs/regions/index.html:68 `nd Germany</a> <a href="/jobs/alerts/">Job alerts without an account</a> <a href="/time/">` |
| Company pages | Data | have | its live page (2026-10-28): "me Jobicy Search remote jobs Job title, company or skill Search jobs… Search remote jobs Main sections Remote" | void-live-deploy/lib/jobs-ui.js:39 `const bits = [j.company, j.loc // t('Anywhere'), j.type && t(C.TYPES[j.type] // j.type),` |
| Salary information | Data | have | its live page (2026-10-28): "eveloper resources Jobs API / MCP / RSS Salary API For Candidates Stand out to top remote companies My Profile" | void-live-deploy/jobs/regions/index.html:63 `e level, the job type and the salary when it is given. Every search has an RSS feed for yo` |
| Apply, or go to the application | Apply | have | its live page (2026-10-28): "d career tools Prepare before you press apply. Use purpose-built AI to evaluate your resume, tailor your story" | void-live-deploy/jobs/regions/index.html:69 `s original posting, where you apply. Your saved jobs, alerts and applications stay in this` |
| A profile and CV | Personal | have | its live page (2026-10-28): "Sign in Sign In Dark mode Dark mode My Profile Remote Jobs Job Categories Job Locations Post a Remote Job Tal" | void-live-deploy/jobs/regions/index.html:69 `this browser: no account, no profile, no email, nothing about you on a server. The page w` |
| Post a job | Employers | missing | its live page (2026-10-28): "es Salaries Career Advice Career Advice Post a Job Jobicy Pro PRO Sign in Sign In Dark mode Dark mode My Profi" | no sign of it in the source of /jobs/regions/ |
| See who you know at a company | Personal | missing | its live page (2026-10-28): "testing company with its own freelance network. Our freelancers test apps from companies across the globe. Te" | no sign of it in the source of /jobs/regions/ |
| A jobs API or feed | Developers | have | its live page (2026-10-28): "nada 🇪🇺 Europe All locations &rsaquo; Developer resources Jobs API / MCP / RSS Salary API For Candidates Sta" | void-live-deploy/jobs/regions/index.html:63 `is given. Every search has an RSS feed for your reader, with no account.</p>` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "Career Advice Post a Job Jobicy Pro PRO Sign in Sign In Dark mode Dark mode My Profile Remote Jobs Job Categor" | void-live-deploy/lib/jobs-ui.js:19 `{ try { const m = JSON.parse(localStorage.getItem(KEY) // '{}'); return m && typeof m ===` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "m Submit a Guest Post Apps & extensions App Store Google Play Chrome Extension Firefox Extension Earn with us" | void-live-deploy/jobs/regions/index.html:72 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Works offline | Apps | have | its live page (2026-10-28): "urvive parsing. Read article → Build an Offline Learning Library to Upskill Faster Build an Offline Learning L" | void-live-deploy/jobs/regions/index.html:69 `u on a server. The page works offline after one visit with the last listings it saw. No ad` |
| Dark mode | Settings | missing | its live page (2026-10-28): "st a Job Jobicy Pro PRO Sign in Sign In Dark mode Dark mode My Profile Remote Jobs Job Categories Job Location" | no sign of it in the source of /jobs/regions/ |
| PRO | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Content & Editorial | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Customer Success | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Creative & Design | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| DevOps & Infrastructure | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Software Engineering | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Finance & Accounting | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Data Science & Analytics | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Marketing & Sales | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| All categories &rsaquo; | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🇺🇸 USA | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🇨🇦 Canada | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
