# Use Verse's own tools on Verse

The owner, 2026-10-26: "as we build sites be sure verse can use them, for example if we go after a seo site Verse uses its own tools as needed, same with editing and so on use your imagination we may already have useful tools we arent utilizing", and the same day: "verse uses its own tools to become successful and profitable like a person would given access to everything" (`docs/RULES.md`).

Every page Verse builds to beat a site is also a tool for Verse's own work. A person who built an SEO checker runs it on their own site; one who built an image compressor shrinks their own pictures. This playbook is how a builder finds a tool Verse already has and wires it into Verse's own pipeline, ranked by what it moves: visitors (search), returning people (speed, share cards) and sales (a path from a free page to what Verse sells).

**Starts when:** a builder ships a tool page or a lib (wire it in the same run), or is about to build something for Verse itself (check the table below first: Verse may already have it).

## The steps

1. **Find the tool.** The table below; then `docs/MAP.md`, `void-live-deploy/lib/toolkit.js` `TOOLS` (every tool page), `lib/tool-sites.js` (the lane pages), `ls void-live-deploy/lib/`. Most page tools have their maths in a pure lib (`lib/photo-edit.js`, `lib/colour.js`, `lib/writing-aids.js`, `lib/seo.js`) that runs in node as it is, because the page imports the same file.
2. **Pick where it pays.** Rank by what it moves, then by cost: search (titles, descriptions, links between pages, JSON-LD), speed and share cards (bytes Verse serves or that a link preview fetches), the path to an offer (`OFFERS` in `lib/seo-audit.js`). Tidiness alone is upkeep for other agents (AGENTS.md: growth over upkeep).
3. **Measure before.** Write the number down before touching anything: `node tools/seo-audit.mjs` (defects, orphans, pages leading to an offer, grade of the hardest descriptions), `du -cb void-live-deploy/og/*.png`, the tower gate's design defects (`designLook` in `tools/tower-gate.mjs`).
4. **Wire it as a small import.** A tool in `tools/` that imports the lib (never a copy of its code), a `--check` mode, and a line in `tools/checks.mjs` so it keeps holding. A generator that makes the thing (an og picture, a page) calls the tool itself, so a new one is born right.
5. **Offer it over MCP where it fits.** A pure, read-only tool goes into `lib/mcp.js` `TOOLS` and `RUN` (a name, a description, an input schema; no network), is named on `/code-review/` (the MCP section; `tools/mcp.test.mjs` checks every tool is named there) and in `openapi.json`'s `/api/mcp` description. Its own agents and outside agents call the same thing.
6. **Measure after and look.** The same command as step 3. For a picture: open the before and after side by side (a screenshot of both, as in "Mistakes" below) and say what you see; a smaller file that looks worse is not a win.
7. **Record it.** The table below (the "where Verse uses it" column), `docs/MAP.md`, the agent log with the before and after numbers.

**How to tell it worked:** the number moved and the check holds it: `node tools/checks.mjs --only seo-audit og-shrunk` passes, and a page or picture added later without the tool fails it.

## What is wired (2026-10-26)

| Wiring | Before | After | Holds it |
|:--|:--|:--|:--|
| SEO audit over every page (`lib/seo-audit.js`, `tools/seo-audit.mjs`) | 104 pages: 19 defects (6 no canonical, 9 no share card title or picture, 3 h1, 1 broken link), 44 pages no HTML linked to, 22 free pages leading to an offer; Code Review Pro, Keep-It-Running, Full Stack Audit and First Automation Setup linked from 0 pages | 5 defects (3 h1, 2 canonical on pages another session holds), 8 orphans, 28 pages leading to an offer; Keep-It-Running and Full Stack Audit from 23 pages, Code Review from 5, First Automation Setup from 4 | `seo-audit` in checks.mjs (`tools/seo-audit.baseline.json` only goes down) |
| The "Use with" row and `/tools/` in the HTML (`tools/seo-pages.mjs`) | the row was drawn by script only, so a crawler saw 44 pages linked from nowhere | the same links written into 61 pages (the script still replaces them with its own row), "More tools" on `/tools/` lists every tool page | `seo` refresh step (`seo-pages.mjs --check`) |
| Readability on Verse's own descriptions (`lib/writing-aids.js` `readingLevel`, the one `/word-count/` shows) | hardest: /translate/ grade 23.2, /boards/ 19.6, /full-stack-audit/ 13.9 | 4.3, 4.3 and 6.0, each under 160 characters | the audit lists the ten hardest each run |
| Verse's photo compressor on its share pictures (`lib/photo-edit.js` palette PNG, `tools/shrink-images.mjs`) | og/: 24 pictures, 7,548,237 bytes (280-440 KB each) | 1,119,760 bytes (36-65 KB each), 85% smaller; mean error 0.4-0.7 of 255; side by side no visible change. Comparing them also showed the long PDF and Kanban lines running into the chips, fixed in `tools/og-tool-sites.mjs`. The jobs floor's 8 pictures landed raw while this shipped; `og-shrunk` caught them: 2,510 KB to 406 KB | `og-shrunk` in checks.mjs; `og-tool-sites.mjs` and `og-sports.mjs` shrink what they draw |
| Over MCP: `seo_audit`, `readability`, `colour_contrast` (`lib/mcp.js`) | 0 of Verse's page tools callable by an agent | 3, pure and read-only | `tools/mcp.test.mjs` |

## Every tool, and where Verse uses it on itself

| Tool (page, lib) | Where Verse uses it on its own work |
|:--|:--|
| SEO table and audit (`lib/seo.js`, `lib/seo-audit.js`, `tools/seo-pages.mjs`, `tools/seo-audit.mjs`) | every page's canonical, JSON-LD and common asks; the audit over every page in checks; MCP `seo_audit` |
| IndexNow (`tools/indexnow.mjs`) | every main deploy tells search engines which pages changed (`docs/playbooks/indexnow.md`) |
| Sitemap (`tools/sitemap.mjs`) | the refresh step; llms.txt from the SEO table |
| Photo tools: compress, convert, EXIF (`/photos/`, `lib/photo-edit.js`) | the og/ share pictures (`tools/shrink-images.mjs`). Not yet: the home `og.png` (its glows band in 256 colours: needs dithering first), `podcast/cover.jpg` (630 KB JPEG; needs a JPEG encoder), `docs/img/` (not served) |
| Resize an image (`/resize-image/`, `lib/imgfit.js`) | not yet: idea: fit the tower screenshots (`tower.shots/`) to the size they are shown at |
| Word counter, readability, writing aids (`/word-count/`, `lib/wordcount.js`, `lib/writing-aids.js`) | the reading grade of every page description in the audit; MCP `readability`. Not yet: idea: grade the launch drafts in `drafts/` and the agent log lines before they ship |
| Colour codes and contrast (`/color/`, `lib/colour.js`) | MCP `colour_contrast`; the tower gate's design look measures contrast on tower floors (`designLook`). Not yet: idea: `designLook` over every page in the deploy, not only floors (needs a browser: a weekly job, not checks) |
| Design checks (`designLook`, `tools/tower-gate.mjs`) | tower floors only. Not yet: idea: every page, see above |
| Kanban (`/kanban/`, `lib/kanban.js`) | not yet: idea: `domains/void.queue.md` as a board (`lib/kanban.js` `importText`), linked from the queue card |
| Calendar and ICS (`/calendar/`, `lib/ics.js`, `lib/icsfeed.js`) | not yet: idea: Verse's deploys and scheduled runs as an ICS feed on /calendar/ |
| Notes (`/notes/`, `lib/notes.js`) | not yet |
| Translate (`/translate/`, `lib/translate-*.js`) | not yet: idea: the top tool pages in more languages (the German music and photo pages are written by hand today), measured by the traffic file |
| Free pictures (`lib/free-pics.js`) | card art and daily art (`functions/api/answer.js`, `functions/api/daily-art.js`) |
| Art forge (`lib/card-forge.js`) | painted card art (`docs/playbooks/art-forge.md`) |
| Tower gate measurement and site-re (`tools/tower-gate.mjs`, `tools/site-re.mjs`) | every floor's verdict (`docs/playbooks/tower-loop.md`, `site-re.md`) |
| Code review (`/code-review/`, `lib/code-review.js`) | Verse's own pull requests (`.github/workflows/void-review.yml`) and the conflict-marker check in `tools/checks.mjs`; MCP `review_code` |
| PDF tools (`/pdf/`, `lib/pdf-tools.js`) | not yet: idea: a PDF of the growth ledger or a playbook for people who ask for one |
| Base64, base converter, password tools (`lib/base64.js`, `lib/baseconv.js`, `lib/pwcheck.js`) | not yet (nothing in Verse's own work needs them today) |
| QR (`lib/qr.js`) | share images of cards (`lib/card-image.js`) |
| Gists (`/g/`) | not yet |
| Traffic (`domains/traffic.json`) | not yet: the measure for every wiring above once its first run lands: search visits to the pages the audit fixed, and the services' visits |

## Mistakes to not repeat

- **A smaller picture that looks worse is a loss.** The home `og.png` went from 428 KB to 63 KB at a mean error of 0.8 of 255, and its soft glows showed rings side by side. It was put back. Look at every recompressed picture next to its original (render both into one screenshot with the browser already used for tests), and leave out what bands.
- **Links drawn by a script are not links to a crawler.** The "Use with" row and the services had no links in their HTML; the SEO audit reads the HTML as a search engine's first pass does, which is why it found 44 orphan pages the site itself thought were linked.
- **A generator that rewrites a page must keep the blocks other tools write.** `tools/tool-site-pages.mjs` and `tools/music-pages.mjs` keep the `<!-- related -->` block as they keep `<!-- seo -->` and `<!-- asks -->`; a new page generator does the same. After `music-pages.mjs`, run `tools/preload.mjs` again.
- **Importing a generator must not run it.** `tools/og-tool-sites.mjs` ran its browser on import; it now runs only as the entry point, so a test can import `fitLine`.
- **A long title or description is a note, not a defect.** The `/fix/` titles carry the exact error people search for; Google reads the whole title even when it cuts it in the result.
- **A check must not stop Verse's own loops.** Within an hour of the audit landing it found `/convert/unit-converter/`, a page the tower-self loop built, carrying the same title as `/convert/`. A duplicate title is listed every run but not held by the check, so the loop keeps going while the title is fixed where it is made (`tools/tower-self.mjs`).
