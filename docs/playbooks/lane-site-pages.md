# Lane site pages: a page of its own for every site of a Versus lane

**Starts when:** a floor's lane is written (`LANES` in `lib/tower.js`) and a site in it has no page of ours that does its job. The owner, 2026-10-26: "even if we are sure we already stomp them we still make a page and beat them" (`docs/RULES.md`). A page built for the leader is a baseline, not the answer for the small sites.

**The shape that worked (PDF tools, Kanban):** one engine and one screen shared by every page of the family (`lib/pdf-tools.js` + `lib/pdf-ui.js`; `lib/kanban.js` + `lib/kanban-ui.js`), and one table of rows (`lib/tool-sites.js`): path, the card ask, the tools or feature flags that site has, its search phrases. A page is its row.

1. Read the site's feature list from `domains/features/<floor>.json` (research it first, `docs/playbooks/feature-research.md`). Give the page the features that site has, honestly: what it cannot do on a device (a server job, encryption) goes in the map as `missing` with "skipped: why".
2. Add the row to `lib/tool-sites.js` and the site to `LANE_PAGES` in `lib/tower.js`. `tools/tower-probes.mjs` `probeFor` then measures that lane site against its own page.
3. `node tools/tool-site-pages.mjs && node tools/seo-pages.mjs && node tools/preload.mjs && node tools/sitemap.mjs`. TOOLS, RELATED and the SEO row come from the table; `sw.js` TOOLS is a literal list and needs the path.
4. Tests: the engine in node (`tools/pdf-tools.test.mjs`, `tools/kanban.test.mjs`), then `node tools/heavy.mjs node tools/pdf-kanban-e2e.mjs --shots <dir>` at 390 px, and open the screenshots.
5. Push to main, then dispatch `tower-gate.yml` for the floor ids.

**Mistakes made:** a nested path (`/pdf/merge/`) failed the old related-nav test until its pattern took more than one segment; a placeholder is not visible text, so a fact the probe reads ("Add a card") has to be on the page in words; the page text must not claim a feature that page lacks (the kanban help line is built from the page's flags); do not run the shared `gen` scripts against the shared checkout, work in a `git worktree`.
