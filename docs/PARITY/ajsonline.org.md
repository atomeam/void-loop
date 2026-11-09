# ajsonline.org: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: ajsonline.org (https://ajsonline.org/)
- Verse: /journal/ (ajsonline.org, tower gate 0 of 12)
- Live scan: 2026-11-07, HTTP 200, page title "American Journal of Science"
- History: [docs/HISTORY/ajsonline.org.md](../HISTORY/ajsonline.org.md)

**Match: 71%**: 20 have, 4 partial, 7 missing, 0 unreviewed, of 31 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| The newest papers, with title, date and volume | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:84 `<button id="latest" aria-pressed="true">Latest</button>` |
| The abstract of each paper | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:99 `l for="words">Words (with the abstract, the notes and the references)</label><input type="` |
| The authors of each paper | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:258 `ssName = 'a'; a.textContent = p.authors;` |
| The volume each paper is in | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:260 `m.append((p.date // '') + (p.volume ? ' · Volume ' + p.volume : ''));` |
| The date each paper was published | Papers | have | every site of this kind offers it | void-live-deploy/lib/journal.js:29 `date: grab('pubDate') ? new Date(grab('pubDate')).toISOString().slice(0, 10) : '',` |
| The DOI that finds each paper | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:261 `ent('a'); doi.href = 'https://doi.org/' + p.doi; doi.textContent = p.doi; doi.target = '_b` |
| Search the papers | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:80 `peer-reviewed Earth science research, read from the journal's own public feed — no ads, no` |
| Browse the article archive | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:84 `<button id="latest" aria-pressed="true">Latest</button>` |
| Browse by volume and issue | Papers | partial | every site of this kind offers it | void-live-deploy/journal/index.html:260 `m.append((p.date // '') + (p.volume ? ' · Volume ' + p.volume : ''));` |
| Collections of papers by subject | Papers | missing | every site of this kind offers it | no sign of it in the source of /journal/ |
| Named collections of papers on one theme | Papers | missing | every site of this kind offers it | no sign of it in the source of /journal/ |
| A citation in the journal's own style | Papers | partial | every site of this kind offers it | void-live-deploy/journal/index.html:161 `<p class="note">APA, 7th edition. One author: (Fisher, 1953). Two: (Dewey &amp; Pitman, 19` |
| The reference list of each paper | Papers | missing | every site of this kind offers it | no sign of it in the source of /journal/ |
| The PDF of each paper | Papers | missing | every site of this kind offers it | no sign of it in the source of /journal/ |
| The editorial board and the advisory board | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:175 `ss="note">The editors and the associate editors, with their fields, as the journal lists t` |
| The author guidelines | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:112 `tion id="authors" aria-label="For authors">` |
| What a submission must have | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:120 `<h3>Before you submit</h3>` |
| The kinds of paper and their lengths | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:94 `<p class="note">Publication units (PU) are the measure the journal's guidelines use: 1 PU` |
| The length of a paper in publication units, with the fee | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:94 `<p class="note">Publication units (PU) are the measure the journal's guidelines use: 1 PU` |
| How a paper is judged | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:141 `<h3>How a paper is judged</h3>` |
| The order of a manuscript, and the rules for figures and tables | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:144 `<h3>The order of a manuscript</h3>` |
| The reference style, with examples | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:161 `<p class="note">APA, 7th edition. One author: (Fisher, 1953). Two: (Dewey &amp; Pitman, 19` |
| How errors and statistics are reported | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:165 `imated and at what level: SE (standard error of the mean) and CI (confidence interval) are` |
| Submit a manuscript | Authors | partial | every site of this kind offers it | void-live-deploy/journal/index.html:122 `i>Word or a PDF for the first submission, 12-point Times New Roman, 1.5 line spacing, line` |
| About the journal and its scope | Authors | partial | every site of this kind offers it | void-live-deploy/journal/index.html:116 `<h3>Scope</h3>` |
| No publication charges within the standard limits | About | have | every site of this kind offers it | void-live-deploy/journal/index.html:225 `note">The journal runs on the diamond open access model: no charge for readers and no char` |
| Copyright, peer review and publication ethics | About | have | every site of this kind offers it | void-live-deploy/journal/index.html:230 `<h3>Peer review</h3>` |
| Contact the editorial office | About | have | every site of this kind offers it | void-live-deploy/journal/index.html:170 `8109, USA, and its address is ajs@yale.edu.</p>` |
| An RSS feed of the newest papers | About | missing | every site of this kind offers it | no sign of it in the source of /journal/ |
| Links to the journal on other sites | About | missing | every site of this kind offers it | no sign of it in the source of /journal/ |
| A link back to the top of the page | About | missing | every site of this kind offers it | no sign of it in the source of /journal/ |
