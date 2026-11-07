# ajsonline.org: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: ajsonline.org (https://ajsonline.org/)
- Verse: /journal/ (research journal, tower gate 0 of 17)
- Live scan: 2026-11-07, HTTP 200, page title "American Journal of Science"
- History: [docs/HISTORY/ajsonline.org.md](../HISTORY/ajsonline.org.md)

**Match: 87%**: 26 have, 2 partial, 3 missing, 0 unreviewed, of 31 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| The newest papers, with title, authors, date and volume | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:122 `t">About</a><a href="#latest">Latest papers</a><a href="#search">Search</a><a href="#volum` |
| The abstract of each paper | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:117 `the newest papers with their abstracts, a search across the whole archive, the volumes, t` |
| The authors of each paper | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:226 `<tr><td>Reply</td><td>The authors' answer to a Comment.</td><td>Usually invited</t` |
| The volume each paper is in | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:336 `a.dateText // 'no date') + (a.volume ? ' · Volume ' + a.volume : '') + (a.issue ? ' no. '` |
| The date each paper was published | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:131 `published by Yale University in New Haven, and it runs on the diamond open access mode` |
| The DOI that finds each paper | Papers | have | every site of this kind offers it | void-live-deploy/lib/journal.js:15 `export const DOI_PREFIX = '10.2475';` |
| Search the whole archive | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:149 `mit" class="go" id="searchGo">Search the whole archive</button>` |
| Browse the article archive | Papers | have | every site of this kind offers it | void-live-deploy/lib/journal.js:15 `export const DOI_PREFIX = '10.2475';` |
| Browse by volume and issue | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:117 `across the whole archive, the volumes, themed collections, a reading list kept` |
| Collections of papers by subject | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:117 `archive, the volumes, themed collections, a reading list kept` |
| Named collections of papers on one theme | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:117 `archive, the volumes, themed collections, a reading list kept` |
| A citation in the journal's own style | Papers | have | every site of this kind offers it | void-live-deploy/journal/index.html:118 `his device, and a citation in APA or BibTeX. Below them the rules an author works to, and` |
| The reference list of each paper | Papers | partial | every site of this kind offers it | void-live-deploy/journal/index.html:243 `<li>References for every source cited.</li>` |
| The PDF of each paper | Papers | missing | every site of this kind offers it | no sign of it in the source of /journal/ |
| The editorial board and the advisory board | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:264 `ss="note">The editors and the associate editors, with their fields, as the journal lists t` |
| The author guidelines | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:123 `aper</a><a href="#guidelines">For authors</a><a href="#board">The board</a><a href="#polic` |
| What a submission must have | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:205 `<h3>Before you submit</h3>` |
| The kinds of paper and their lengths | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:179 `<p class="note">Publication units (PU) are the measure the journal's guidelines use: 1` |
| The length of a paper in publication units, with the fee | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:179 `<p class="note">Publication units (PU) are the measure the journal's guidelines use: 1` |
| How a paper is judged | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:230 `<h3>How a paper is judged</h3>` |
| The order of a manuscript, and the rules for figures and tables | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:233 `<h3>The order of a manuscript</h3>` |
| The reference style, with examples | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:118 `his device, and a citation in APA or BibTeX. Below them the rules an author works to, and` |
| How errors and statistics are reported | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:254 `imated and at what level: SE (standard error of the mean) and CI (confidence interval) are` |
| Submit a manuscript | Authors | partial | every site of this kind offers it | void-live-deploy/journal/index.html:207 `<li>Word or PDF for the first submission, 12-point Times New Roman, 1.5 line spacing, line` |
| About the journal and its scope | Authors | have | every site of this kind offers it | void-live-deploy/journal/index.html:126 `glass" id="about" aria-label="About this journal">` |
| No publication charges within the standard limits | About | have | every site of this kind offers it | void-live-deploy/journal/index.html:131 `New Haven, and it runs on the diamond open access model: most papers carry no publication` |
| Copyright, peer review and publication ethics | About | have | every site of this kind offers it | void-live-deploy/journal/index.html:282 `<h3>Peer review</h3>` |
| Contact the editorial office | About | have | every site of this kind offers it | void-live-deploy/journal/index.html:259 `8109, USA, and its address is ajs@yale.edu.</p>` |
| An RSS feed of the newest papers | About | missing | every site of this kind offers it | no sign of it in the source of /journal/ |
| Links to the journal on other sites | About | missing | every site of this kind offers it | no sign of it in the source of /journal/ |
| A link back to the top of the page | About | have | every site of this kind offers it | void-live-deploy/journal/index.html:121 `<nav class="jump" aria-label="On this page">` |
