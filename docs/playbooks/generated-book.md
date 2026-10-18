# Playbook: a page for everything, generated from the repo (the book)

**What starts it.** The owner asks for one place that holds everything ("a book you could flip through that contains everything so you don't have to search", 2026-10-16), or a list on the site has drifted from what the repo holds (a card that names skills by hand misses the new ones). The rule: a list of what Verse has is never written by hand. It is read off the repo's own files and a check fails when the written copy is stale.

**The pattern** (the same one `tools/families.mjs` and `tools/skills-index.mjs` follow):

1. **Pure functions first**, in `void-live-deploy/lib/<name>.js`, with no file reading: one that extracts each fact from a file's text (`oneLine(src, name)` reads the first sentence of a skill's header comment; `listOf(src, 'examples')` reads its examples the way `functions/tools.json.js` does; `partsOf(src)` opens a family skill into its members; `gamesOf(rackSrc)` reads the rack's GAMES), and one that composes the whole (`compose({ names, read, families, games, minis, ... })` returns chapters, pages, an index and `unplaced`).
2. **A generator** in `tools/<name>.mjs` that reads the files, calls `compose`, writes one JSON the page fetches (`void-live-deploy/skills/guide.json`), and has a `--check` that exits 1 when the file is stale or something is on no page. Keep the JSON deterministic: no dates, no random order, so `--check` compares text.
3. **Register the check** on its own line in `tools/checks.mjs` (the test file in the list, and a `{ run([... '--check']) }` block), so a new skill without a regenerated file cannot merge.
4. **A unit test** `tools/<name>.test.mjs` that pins the extractor on tricky headers (a line that is only a quoted ask, a build-order number, a miniature's "Card's miniature:" lead), the composition on a small sample, and completeness on the real repo (every skill in `skills/index.json`, families opened, on exactly one page; every rack game; every miniature file).
5. **The reader** in `void-live-deploy/skills/<name>.js`: fetch the one JSON once, draw pages on demand (never import every skill module), `a[data-ask]` links run asks through the page's own click handler, `window.__voidBook` for the browser test.
6. **A browser section** in `tools/test_void.mjs` under `if (want("the book: ..."))`, run with `node tools/test_void.mjs --only "the book"`.

**Commands.**

```
node tools/guide.mjs            # writes skills/guide.json, prints the chapters
node tools/guide.mjs --check    # exit 1 when stale or a skill is on no page
node --test tools/guide.test.mjs
node tools/test_void.mjs --only "the book"
node tools/ask.mjs "open the book" "what can you do"   # the book opens; the self page still answers "what can you do"
```

**How to tell it worked.** `--check` says `ok: the book has N pages in M chapters`; the unit test's completeness case passes; in the browser, the index at the back names every skill and a tap on an ask puts the thing on the stage.

**Mistakes made the first time.**
- The new skill itself was on no page until it was added to a family in `tools/families.mjs`: the check caught it, which is the point. A new skill goes in a family first, then `node tools/families.mjs && node tools/guide.mjs`.
- A boxed game wears its box name (Sorry is "Back to Start"), so the index lost the skill's own name; the index now lists both.
- Reading a header as one paragraph joined lines that were separate sentences without a full stop ("Open-Meteo, no key" then "The card stays current"); the extractor reads line by line and stops where the next line starts a new sentence.
- Skills whose `examples: []` is empty (tab, kept, eightball) got no asks to tap; the page falls back to the asks the header quotes.

**What to do next with it.** Per-skill illustrations beyond the glyphs (a small canvas drawing per card, or a still of its miniature), a search box inside the book, and a printed edition (`skills/poster.js` already makes print files).
