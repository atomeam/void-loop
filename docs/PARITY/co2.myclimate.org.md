# co2.myclimate.org: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: co2.myclimate.org (https://co2.myclimate.org/en/flight_calculators/new)
- Verse: /flights/co2/ (travel: co2.myclimate.org, tower gate 14 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "Calculate flight emissions – flight CO2 calculator / myclimate"
- History: [docs/HISTORY/co2.myclimate.org.md](../HISTORY/co2.myclimate.org.md)

**Match: 40%**: 8 have, 0 partial, 0 missing, 12 unreviewed, of 20 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Search flights by place and date | Find | have | its live page (2026-10-28): "Calculate flight emissions – flight CO2 calculator / myclimate Career Career About us About us Contact Contac" | void-live-deploy/flights/co2/index.html:63 `<h1>Flight CO2 calculator</h1>` |
| Explore destinations on a map | Find | have | its live page (2026-10-28): "Climate Protection Projects FAQ FAQ Sitemap Facebook Instagram Youtube X Linkedin Stay informed: Sign up for N" | void-live-deploy/lib/flights-ui.js:88 `>' + Object.entries(C.CABINS).map(([k, v]) => '<option value="' + k + '">' + esc(t(v)) + '` |
| Emissions for each flight | Data | have | its live page (2026-10-28): "Calculate flight emissions – flight CO2 calculator / myclimate Career Career About us About us Contact Contac" | void-live-deploy/flights/co2/index.html:63 `<h1>Flight CO2 calculator</h1>` |
| Distance and flight time | Data | have | its live page (2026-10-28): "es off per passenger for a given flight distance. Nitrogen compounds and aerosols are also included and conver" | void-live-deploy/flights/co2/index.html:69 `with</span> <a href="/flights/distance/">Flight distance calculator</a> <a href="/flights/` |
| Direct routes from an airport | Data | have | its live page (2026-10-28): "flight_calculator_control_via_fields"> Direct flight Flight with stopover From required * Aircraft type calcu" | void-live-deploy/lib/flights-ui.js:114 `const s = pane('Route facts', 'facts'); s.insertAdjacentHTML('beforeend', '<div id="fa-o` |
| Plan a trip with several stops | Plan | have | its live page (2026-10-28): "Other aircraft type To required * Roundtrip One way Number of passengers required * 1 2 3 4 5 6 7 8 9 10 11 1" | void-live-deploy/flights/co2/index.html:64 `er of passengers and a return trip you choose. The method is written out below the figure,` |
| Go on to book | Book | have | its live page (2026-10-28): "onomy Business Class First Class Before booking your flight: check low-emission alternatives and calculate you" | void-live-deploy/lib/flights-ui.js:284 `ass="note">' + esc(t('Paste a booking confirmation and the flights are read out of it, or` |
| An account that keeps your things on every device | Accounts | have | its live page (2026-10-28): "ur future&quot; in smaller font. Toggle login Profile Toggle search Suche Toggle navigation Menü Close Menü Ge" | void-live-deploy/lib/flights-ui.js:78 `const sync = () => { for (const i of r.querySelectorAll('input')) i.checked = (i.value` |
| Career | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Global English | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Schweiz Deutsch | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Suisse Français | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Svizerra Italiano | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Deutschland | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Österreich | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Profile | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Suche | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Menü | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Get Active | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Consulting | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
