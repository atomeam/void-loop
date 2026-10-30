# rnz.co.nz: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: rnz.co.nz (https://www.rnz.co.nz/)
- Verse: /news/ (news: rnz.co.nz, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "RNZ / New Zealand news, culture, radio, podcasts and more"
- History: [docs/HISTORY/rnz.co.nz.md](../HISTORY/rnz.co.nz.md)

**Match: 39%**: 11 have, 0 partial, 4 missing, 13 unreviewed, of 28 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Top stories, updated through the day | Reading | have | its live page (2026-10-28): "RNZ / New Zealand news, culture, radio, podcasts and more Skip to main content Primary navigation RNZ Home Ne" | void-live-deploy/news/index.html:78 `sec="top" aria-pressed="true">Top stories</button><button type="button" data-sec="world" a` |
| Sections: world, business, science, sport | Reading | have | its live page (2026-10-28): "News Pitopito kōrero Show Hide Politics World Business Personal finance Sport Crime / Justice Health Education" | void-live-deploy/news/index.html:77 `<nav id="secs" aria-label="Sections">` |
| Regional editions | Reading | have | its live page (2026-10-28): "two high-speed trains collide in Spain Europe Emergency serivices work at the site of a train crash between a" | void-live-deploy/news/index.html:78 `dle-east" aria-pressed="false">Middle East</button><button type="button" data-sec="latin-a` |
| Search the news | Reading | have | its live page (2026-10-28): "asts Video Sections navigation Sections Search Sections navigation Search all of RNZ Rapua News Pitopito kōrer" | void-live-deploy/news/index.html:74 `<label class="vh" for="q">Search the headlines</label>` |
| Full articles written by its own reporters | Reading | have | its live page (2026-10-28): "es made&#x27;: Husband of pastor killed by roller door wants action Coroner Helen Verry. Surge in peptide use" | void-live-deploy/news/index.html:78 `"report" aria-pressed="false">Verse reports</button><button type="button" data-sec="my" ar` |
| Live pages for breaking stories | Reading | missing | its live page (2026-10-28): "k on the latest crime statistics. &#x27;Live with the choices made&#x27;: Husband of pastor killed by roller d" | no sign of it in the source of /news/ |
| Video reports | Media | have | its live page (2026-10-28): "ews navigation News Life Radio Podcasts Video Sections navigation Sections Search Sections navigation Search a" | void-live-deploy/lib/daily-art.js:137 `(/^[A-Za-z0-9_-]{11}$/.test(o.video // '')) u += '&video=' + o.video; }` |
| Radio, podcasts and audio stories | Media | have | its live page (2026-10-28): "RNZ / New Zealand news, culture, radio, podcasts and more Skip to main content Primary navigation RNZ Home Ne" | void-live-deploy/news/index.html:113 `addEventListener('load', async () => {` |
| Follow topics and sources | Personal | have | its live page (2026-10-28): "services Te Ao Māori Pacific IndoNZ 中文 Follow the news Show Hide Sign up for our Daily Newsletter Subscribe t" | void-live-deploy/news/index.html:100 `ton type="button" id="follow">Follow topics</button><button type="button" id="copyLink">Co` |
| Save stories for later | Personal | have | its live page (2026-10-28): "Analysis: National is now in a fight to save the furniture RNZ-Reid Research poll Justice Minister Paul Goldsm" | void-live-deploy/news/index.html:78 `c="saved" aria-pressed="false">Saved</button>` |
| The same story from several sides | Reading | missing | its live page (2026-10-28): "with Waitangi Tribunal Te Ao Māori From left Awatea Mita, Matilda Kahotea and Kelly Hume at the Waitangi Tribu" | no sign of it in the source of /news/ |
| Weather | Extras | have | its live page (2026-10-28): "h Emergencies Community Regions Country Weather Community news services Te Ao Māori Pacific IndoNZ 中文 News Pit" | void-live-deploy/news/index.html:105 `"/notes/">Notes</a> <a href="/weather/">Weather</a> <a href="/tools/">All tools</a>` |
| Newsletters and alerts | Personal | missing | its live page (2026-10-28): "he news Show Hide Sign up for our Daily Newsletter Subscribe to RNZ News with RSS Get the RNZ App Social accou" | no sign of it in the source of /news/ |
| Reader comments | Community | missing | its live page (2026-10-28): "Mihingarangi Forbes Māori newsmakers & commentators unpack recent political issues in Aotearoa. 4 seasons / 8" | no sign of it in the source of /news/ |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "art of the solution&#x27;: Wāhine Māori share justice system experiences with Waitangi Tribunal Te Ao Māori Fr" | void-live-deploy/news/index.html:100 `n type="button" id="copyLink">Copy link to this view</button></div>` |
| RNZ Home | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Life | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Politics | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Personal finance | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Crime / Justice | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Health | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Education | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Environment | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Science / Tech | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Emergencies | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Community | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Regions | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
