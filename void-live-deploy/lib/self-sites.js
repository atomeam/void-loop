// The sites Verse took on by itself (tools/tower-self.mjs, .github/workflows/tower-self.yml): one data row per site, written by the loop and never by
// hand. Each row makes a lane site of an existing floor (lib/tower.js LANES and LANE_PAGES read it) and a page of its own (lib/tool-sites.js SITE_PAGES,
// so the tool table, the search block and the ask bar know it): the page is the floor's own page with the row's name, headline and intro, written by
// tools/tower-self.mjs from `base`. Verse's pages name no other site; only `lane` and `url` here do, in plain text. Pure data.
//   row: { path, base, page, ask?, family, lane, url, name, h1, intro, does, asks, added }
export const SELF_SITES = Object.freeze([
]);
