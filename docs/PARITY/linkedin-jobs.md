# LinkedIn Jobs: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: LinkedIn Jobs (https://www.linkedin.com/jobs/)
- Verse: /jobs/ (jobs, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "LinkedIn Job Search: Find US Jobs, Internships, Jobs Near Me"
- History: [docs/HISTORY/linkedin-jobs.md](../HISTORY/linkedin-jobs.md)

**Match: 40%**: 10 have, 1 partial, 2 missing, 13 unreviewed, of 26 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search jobs by title and place | Find | have | its live page (2026-10-28): "LinkedIn Job Search: Find US Jobs, Internships, Jobs Near Me Skip to main content Close Agree & Join LinkedIn" | void-live-deploy/jobs/index.html:63 `<p class="intro">Search remote jobs by keyword, place, tag and salary, filter and sort t` |
| Filters: remote, type, level, salary | Find | have | every site of this kind offers it | void-live-deploy/jobs/index.html:63 `<p class="intro">Search remote jobs by keyword, place, tag and salary, filter and sort t` |
| Job alerts | Alerts | have | studied by hand: LinkedIn Jobs offers this (https://www.linkedin.com/jobs/) | void-live-deploy/jobs/index.html:68 `se with</span> <a href="/jobs/alerts/">Job alerts without an account</a> <a href="/jobs/sa` |
| Company pages | Data | have | its live page (2026-10-28): "Jobs Games Mobile Services Products Top Companies Top Startups Top Colleges Business Solutions Talent Marketin" | void-live-deploy/jobs/index.html:68 `nd Germany</a> <a href="/jobs/companies/">Remote companies hiring</a> <a href="/calendar/"` |
| Salary information | Data | have | studied by hand: LinkedIn Jobs offers this (https://www.linkedin.com/jobs/) | void-live-deploy/jobs/index.html:63 `bs by keyword, place, tag and salary, filter and sort them, save jobs and searches, see wh` |
| Apply, or go to the application | Apply | have | every site of this kind offers it | void-live-deploy/jobs/index.html:63 `ve, Jobicy and Himalayas; you apply on the original posting.</p>` |
| Save jobs | Personal | have | studied by hand: LinkedIn Jobs offers this (https://www.linkedin.com/jobs/) | void-live-deploy/jobs/index.html:63 `salary, filter and sort them, save jobs and searches, see what is new since your last visi` |
| A profile and CV | Personal | have | its live page (2026-10-28): "a career coach near you. 1,400+ experts Resume Writers Resume Writers Make your resume stand out. Hire a resum" | void-live-deploy/jobs/index.html:69 `this browser: no account, no profile, no email, nothing about you on a server. The page w` |
| Post a job | Employers | missing | its live page (2026-10-28): "your job for millions of people to see Post a job No more previous content Previous Slide Let the right peopl" | no sign of it in the source of /jobs/ |
| See who you know at a company | Personal | missing | its live page (2026-10-28): "es Take a break and reconnect with your network through quick daily games. Patches Zip Mini Sudoku Queens Tang" | no sign of it in the source of /jobs/ |
| A jobs API or feed | Developers | have | its live page (2026-10-28): "Up Help Center About Press Blog Careers Developers Browse LinkedIn Learning Jobs Games Mobile Services Product" | void-live-deploy/jobs/app.js:3 `","saved","alerts","tracker","feed","sources"],"de":{"h1":"Jobs","intro":"Suchen Sie Remot` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "inkedIn By clicking Continue to join or sign in, you agree to LinkedIn’s User Agreement , Privacy Policy , and" | void-live-deploy/lib/jobs-ui.js:19 `{ try { const m = JSON.parse(localStorage.getItem(KEY) // '{}'); return m && typeof m ===` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "n privately tell recruiters or publicly share with the LinkedIn community that you are looking for new job opp" | void-live-deploy/lib/jobs-ui.js:152 `ton" id="jb-share">' + esc(t('Share link')) + '</button><span class="live" id="jb-sharemsg` |
| User Agreement | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Join now | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Show | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| New to LinkedIn? Join now | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Engineering | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Business Development | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Finance | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Administrative Assistant | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Retail Associate | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Customer Service | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Operations | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Information Technology | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
