# Site reverse engineering: the features a site does not advertise

**The owner (2026-10-26):** "make sure you reverse-engineer each site so we dont miss any hidden features". Searches and marketing pages (`docs/playbooks/feature-research.md`) name what a site sells. Its own client code and loaded page also hold the keyboard shortcuts, URL parameters, settings, export and import formats, API paths, offline and share support, embeds, hidden routes, flags and languages. Parity means those too, for every tower floor and lane site (`lib/tower.js` FLOORS).

**Starts when:** once a week (`.github/workflows/site-re.yml` takes the six entries never scanned or scanned 30 or more days ago, smallest site first), or by hand: `gh workflow run site-re.yml -f floor="photos: squoosh.app,pdf: 10015.io"` (ids as the gate names them, commas between). The session container cannot reach the sites; a GitHub runner can. Easiest site first (`docs/RULES.md`): a builder about to work a site reads `domains/features/re/<id>.json` and the `re` block of the floor's features file before building.

## What it does (`tools/site-re.mjs`, test `tools/site-re.test.mjs`)

One polite visit per site, as dev tools would see it, and nothing more:

1. `robots.txt` first; a page it disallows for every crawler is not loaded (`blocked: robots`). `sitemap.xml` is read only when robots allows it.
2. The page at 390 and 1280 px as an ordinary Chrome, no clicks, no sign-in, no form, no consent, paywall or anti-bot step worked around. A refusal, a bot challenge, a sign-in or consent wall, a 429 or an unreachable site is written as `blocked` with a kind (`robots`, `refused`, `rate-limit`, `down`, `anti-bot`, `login`, `consent`, `unreachable`) and the scan stops there.
3. What the browser received: scripts and styles (a third party's are counted, not read), the manifest and service worker the page names, the requests the page made itself (origin, path and the NAMES of query parameters, never values), WebSocket addresses, localStorage / sessionStorage / IndexedDB key names after load, the visible controls and menu labels at each width.
4. The method of the `reverse-engineering` skill, in Node: triage the artifact (sizes, source-map hint), read the JS for what it says (URL parameters it reads, keydown handlers, chords and keys, API paths and hosts, flag-looking keys, storage names, `download` names and blob types, accepted file types, language lists, router paths, web APIs: share, File System Access, clipboard, camera, WebAssembly, workers, print, drag and drop, dark mode), cite a coordinate (`file@char offset`, or a selector) and tag every claim: `read` (in the code), `observed` (seen in the loaded page or network), `inferred` (a guess from a signal, e.g. a flag-looking key).
5. Short facts only (`clip`, `bareUrl`): no code, no text beyond feature names, no query values, no token-like runs; `secret-scan` blocks the write if anything key-shaped slipped in. A made-up key in a test says `secret-scan: ok`.

Output: `domains/features/re/<id>.json` (id with `: ` as `-`, `pdf-10015.io.json`), deterministic for the same input. `node tools/site-re.mjs --merge` (the workflow runs it) folds the candidates into the floor's features file (a lane site under its floor) as `"re": { "scanned", "sites": { "<host>": { "features": [...] } } }`, rows `{ name, detail, paid: false, verse: "missing", verse_evidence: "unbuilt (found by reverse engineering)", found_by: "re", tag, evidence }`. People's sections and the feature scan's `auto` are never touched; a floor with no file gets a minimal `source: auto` file the feature scan fills later. A row a builder moved off `missing` keeps its state on the next scan. `tools/feature-scan.mjs nextJobs` queues `re` rows tagged `read` or `observed` (never `inferred`) after hand research and the scan's, like any gap.

## Commands

```
node tools/site-re.mjs --list                  every tower entry, its address and when it was last scanned
node tools/site-re.mjs --which 6              the six due, smallest site first
node tools/site-re.mjs "photos: squoosh.app"   scan one (needs CHROME_PATH on a runner), write re/, merge
node tools/site-re.mjs --merge                 fold every re/ file into the features files (offline, safe to repeat)
node --test tools/site-re.test.mjs             fixture page + bundle + fake browser, no network
```

## How to tell it worked

The re file has `candidates` (each with `tag` and `evidence`), `assetCount`, `manifest` / `serviceWorker` / `sitemap` when the site has them, or a `blocked` kind and nothing else. The features file's `re.sites.<host>.features` has the same rows as `missing`. Open one coordinate by hand (the site's own bundle at that char offset, or the selector in dev tools) and confirm it says what the row says: a candidate nobody can find at its coordinate is a bug in the reader. Then build the row, mark it `has` with the page that shows it.

## Mistakes to avoid

- Reading a rival's scripts for a third-party's features: ads, analytics and tag managers contain every web API; only the site's own files (same registrable domain) produce candidates, the rest only name services.
- Treating `inferred` as fact (a flag key may be dead code); build `read` and `observed` rows first.
- Looping, clicking, submitting or retrying past a wall: one visit, the wall is the result.
- Keeping their code or text: store the label, the count, the path, the coordinate. Never a value from a query string.
- Minified variable names: `p.get("x")` is found through `p = new URLSearchParams(...)`; a reader that only matches `searchParams.get` misses most bundles.
- Running it from the session container: every outside host is refused there; use the workflow.
