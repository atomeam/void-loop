# remotive.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: remotive.com (https://remotive.com/)
- Verse: /jobs/categories/ (jobs: remotive.com, tower gate 14 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "Remote Jobs in Programming, Support, Design and more"
- History: [docs/HISTORY/remotive.com.md](../HISTORY/remotive.com.md)

**Match: 37%**: 8 have, 1 partial, 1 missing, 13 unreviewed, of 23 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search jobs by title and place | Find | have | its live page (2026-10-28): "Remote Jobs in Programming, Support, Design and more 23:59:59 Unlock All Jobs with 20% Off — Expires Soon! Cl" | void-live-deploy/jobs/categories/index.html:63 `word or a place, and save the search to see what is new next time.</p>` |
| Filters: remote, type, level, salary | Find | have | its live page (2026-10-28): "Remote Jobs in Programming, Support, Design and more 23:59:59 Unlock All Jobs with 20% Off — Expires Soon! Cl" | void-live-deploy/jobs/categories/index.html:62 `<h1>Remote jobs by category</h1>` |
| Job alerts | Alerts | have | its live page (2026-10-28): "added this week Close Create Custom Job Alert Be notified each time a job matching your filters gets published" | void-live-deploy/jobs/categories/index.html:66 `e you apply. Your saved jobs, alerts and applications stay in this browser: no account, no` |
| Company pages | Data | have | its live page (2026-10-28): "135,000+ fully remote jobs from vetted companies and get more jobs interviews. Filters 📁 Job Category ▾ 🌍 Y" | void-live-deploy/jobs/categories/index.html:65 `obs by tag</a> <a href="/jobs/companies/">Remote companies hiring</a> <a href="/tools/">Al` |
| Salary information | Data | have | its live page (2026-10-28): "▾ 🛠 Skills ▾ Match: Any All 💰 Minimum Salary ▾ 🗣 Language ▾ 🏢 Company ▾ 🕒 Posted ▾ Categories Categories" | void-live-deploy/lib/jobs-ui.js:43 `+ (j.salary ? '<div class="pay">' + esc(C.salaryText(j.salary, lang())) + '</div>' : '` |
| Apply, or go to the application | Apply | have | its live page (2026-10-28): "ll Jobs My Account Log in For Employers Apply To The Best Remote Jobs Before Everyone Else Browse 135,000+ ful" | void-live-deploy/jobs/categories/index.html:66 `s original posting, where you apply. Your saved jobs, alerts and applications stay in this` |
| Save jobs | Personal | have | its live page (2026-10-28): "All categories Create Email Alert Close Save this search Save this search to revisit it later from your portal" | void-live-deploy/jobs/categories/index.html:63 `add a keyword or a place, and save the search to see what is new next time.</p>` |
| Post a job | Employers | missing | its live page (2026-10-28): "u Unlock All Jobs My Account Log in For Employers Unlock All Jobs My Account Log in For Employers Apply To The" | no sign of it in the source of /jobs/categories/ |
| A jobs API or feed | Developers | have | its live page (2026-10-28): "Unlock 135,000+ jobs → Senior Back-end Developer • Lemon.io Lemon.io Software Development full-time senior Eu" | void-live-deploy/jobs/categories/app.js:3 `","saved","alerts","tracker","feed","sources"],"de":{"h1":"Remote-Jobs nach Kategorie","in` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "omepage Menu Unlock All Jobs My Account Log in For Employers Unlock All Jobs My Account Log in For Employers A" | void-live-deploy/lib/jobs-ui.js:19 `{ try { const m = JSON.parse(localStorage.getItem(KEY) // '{}'); return m && typeof m ===` |
| My Account | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🌍 Your Location ▾ | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ⭐ Career Level ▾ | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 💼 Employment Type ▾ | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🛠 Skills ▾ | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🗣 Language ▾ | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🕒 Posted ▾ | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Software Development | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Artificial Intelligence | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Customer Service | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Devops | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Finance | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
