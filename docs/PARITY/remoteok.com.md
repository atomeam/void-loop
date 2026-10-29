# remoteok.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: remoteok.com (https://remoteok.com/)
- Verse: /jobs/tags/ (jobs: remoteok.com, tower gate 14 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "Remote Jobs in Programming, Design, Sales and more #OpenSalaries"
- History: [docs/HISTORY/remoteok.com.md](../HISTORY/remoteok.com.md)

**Match: 40%**: 8 have, 1 partial, 2 missing, 10 unreviewed, of 21 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search jobs by title and place | Find | have | its live page (2026-10-28): "Remote Jobs in Programming, Design, Sales and more #OpenSalaries Remote OK Close Log in Post a Job → Post a j" | void-live-deploy/jobs/tags/index.html:63 `date, and keep a feed of the search.</p>` |
| Filters: remote, type, level, salary | Find | have | its live page (2026-10-28): "Remote Jobs in Programming, Design, Sales and more #OpenSalaries Remote OK Close Log in Post a Job → Post a j" | void-live-deploy/jobs/tags/index.html:62 `<h1>Remote jobs by tag</h1>` |
| Job alerts | Alerts | have | studied by hand: remoteok.com offers this (https://remoteok.com/) | void-live-deploy/jobs/tags/index.html:66 `e you apply. Your saved jobs, alerts and applications stay in this browser: no account, no` |
| Company pages | Data | have | its live page (2026-10-28): "emote 🤓 Engineer jobs 🤓 Engineer jobs Companies 🚨 Post a remote job 🏷 Ask for a discount 📦 Buy a job bund" | void-live-deploy/lib/jobs-ui.js:39 `const bits = [j.company, j.loc // t('Anywhere'), j.type && t(C.TYPES[j.type] // j.type),` |
| Salary information | Data | have | its live page (2026-10-28): "discount 📦 Buy a job bundle 🌐 Global Payroll 🪶 Health insurance for teams Feeds 🛠 Remote Jobs API 🪓 JSON" | void-live-deploy/jobs/tags/index.html:63 `Combine a tag with a minimum salary or a region, sort by pay or date, and keep a feed of` |
| Apply, or go to the application | Apply | have | its live page (2026-10-28): "ra 🇾🇪 Yemen 🇿🇲 Zambia 🇿🇼 Zimbabwe Apply for this job Next job Close 🔍 Search 🌏 Location 💵 Salary 🎪 B" | void-live-deploy/jobs/tags/index.html:66 `s original posting, where you apply. Your saved jobs, alerts and applications stay in this` |
| A profile and CV | Personal | have | its live page (2026-10-28): "Post a job ⭐️ Go premium 📄 Build your resume 🪶 Health insurance for nomads Top jobs 🌎 Distributed team Rem" | void-live-deploy/jobs/tags/index.html:66 `this browser: no account, no profile, no email, nothing about you on a server. The page w` |
| Post a job | Employers | missing | its live page (2026-10-28): "re #OpenSalaries Remote OK Close Log in Post a Job → Post a job to reach 17,500,000+ remote workers on the #1" | no sign of it in the source of /jobs/tags/ |
| A jobs API or feed | Developers | have | its live page (2026-10-28): "nsurance for teams Feeds 🛠 Remote Jobs API 🪓 JSON feed Hacker News mode Hacker News mode Safe for work mode" | void-live-deploy/jobs/tags/index.html:63 `rt by pay or date, and keep a feed of the search.</p>` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "and more #OpenSalaries Remote OK Close Log in Post a Job → Post a job to reach 17,500,000+ remote workers on" | void-live-deploy/lib/jobs-ui.js:19 `{ try { const m = JSON.parse(localStorage.getItem(KEY) // '{}'); return m && typeof m ===` |
| Dark mode | Settings | missing | its live page (2026-10-28): "afe for work mode Help 🛟 FAQ & Help 🌗 Dark mode Other projects 📊 Remote work stats new 👷 Top remote compan" | no sign of it in the source of /jobs/tags/ |
| ⭐️ Go premium | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🪶 Health insurance for nomads | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🌎 Distributed team | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🏷 Ask for a discount | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🪶 Health insurance for teams | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🛟 FAQ & Help | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Health insurance | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| &times; | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Input: 🌏 Location | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
