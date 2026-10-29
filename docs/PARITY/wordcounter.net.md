# wordcounter.net: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: wordcounter.net (https://wordcounter.net/)
- Verse: /word-count/ (word count, tower gate 11 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "WordCounter - Count Words &amp; Correct Writing"
- History: [docs/HISTORY/wordcounter.net.md](../HISTORY/wordcounter.net.md)

**Match: 43%**: 9 have, 1 partial, 0 missing, 12 unreviewed, of 22 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Words and characters as you type | Counting | have | its live page (2026-10-28): "WordCounter - Count Words & Correct Writing Toggle navigation Word Counter Logo Home Blog More More Tools Hel" | void-live-deploy/word-count/index.html:64 `id="big" aria-live="polite">0 words · 0 characters</div>` |
| Sentences and paragraphs | Counting | have | its live page (2026-10-28): "MAR & SPELL CHECK OFF ON THESAURUS CASE Sentence case Title Case UPPERCASE lowercase ACTIVITY SAVE PROOF READ" | void-live-deploy/word-count/index.html:78 `</span></li><li><b>0</b><span>Sentences</span></li><li><b>0</b><span>Paragraphs</span></li` |
| Reading and speaking time | Counting | have | its live page (2026-10-28): "ew you can see the average speaking and reading time for your text, while Reading Level is an indicator of the" | void-live-deploy/word-count/index.html:78 `an></li><li><b>0 sec</b><span>Reading time</span></li><li><b>0 sec</b><span>Speaking time<` |
| Keyword density | Writing | have | its live page (2026-10-28): "ition, WordCounter shows you the top 10 keywords and keyword density of the article you're writing. This allow" | void-live-deploy/word-count/index.html:83 `<h2>Keyword density</h2>` |
| Reading level | Writing | have | its live page (2026-10-28): "g and reading time for your text, while Reading Level is an indicator of the education level a person would ne" | void-live-deploy/word-count/index.html:78 `span></li><li><b>n/a</b><span>Reading level</span></li><li><b>0</b><span>Pages (single-spa` |
| Spelling and grammar checks | Writing | have | its live page (2026-10-28): "em in your blog or website. 7 DAYS FREE Grammarly Pro Enable unlimited checks for plagiarism and writing issue" | void-live-deploy/word-count/index.html:66 `<textarea id="text" spellcheck="true" placeholder="Start typing, or paste a document her` |
| Writing goals | Writing | have | its live page (2026-10-28): "ccidentally close your browser. Writing Goals Setup writing goals you want to work toward and even embed them" | void-live-deploy/word-count/index.html:71 `<div class="row" id="goalrow"><label for="goal">Goal</label><input type="number" id="goa` |
| Saves your text | Writing | have | its live page (2026-10-28): "t access to some awesome features. Auto Save We'll save whatever you're working on automatically and even stor" | void-live-deploy/word-count/index.html:97 `let saved = ''; try { saved = localStorage.getItem(KEY) // ''; } catch (_) {}` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "o Home Blog More More Tools Help Us Out Sign In Twitter Facebook Google &times; Sign In When you sign in to Wo" | void-live-deploy/word-count/index.html:97 `let saved = ''; try { saved = localStorage.getItem(KEY) // ''; } catch (_) {}` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "00 : 00 Disable Speed Box Speed : 0 WPM Share this! PRINT UPLOAD DOWNLOAD Text as .pdf Text as .txt Text as .d" | void-live-deploy/word-count/index.html:69 `utton type="button" id="link">Copy link</button><button type="button" id="clear">Clear</bu` |
| Toggle navigation | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| More Tools | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Help Us Out | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| &times; | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Yes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Skip this one | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Skip All | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| GO BASIC | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| OPTIONS | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| PASTE | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| THESAURUS | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| CASE | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
