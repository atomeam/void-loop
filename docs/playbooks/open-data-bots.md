# Open-data bot families

What starts it: a useful public dataset that needs no key (exchange rates, holidays, country facts) and can be called from a-to-mind.com, either because it sends `Access-Control-Allow-Origin: *` or through `/api/apibot` when it does not.

## Commands

```
node tools/open-data.mjs
node --test tools/open-data.test.mjs tools/bot-factory.test.mjs tools/cross-checks.test.mjs
node tools/bot-factory.mjs
```

`open-data.mjs` fetches Frankfurter (ECB rates), Nager.Date (2026 public holidays, one call per country) and Wikidata (one SPARQL read of capitals, currencies and continents) and writes `void-live-deploy/bots/open-data.js`. `node tools/open-data.mjs --geo` refreshes only the country rows. Do not edit that file. Then `bot-factory.mjs` rewrites `bots/registry.json`. Credit each source in `bots/credits.json` (no `api: true`, or the next `api-bots.mjs` run drops it) and as a unified row in `domains/autosalvage.unified.json`, then `node tools/autosalvage/unify.mjs --write` so `/credits/` lists it.

## How to tell it worked

- `tools/open-data.test.mjs` passes, including the live call: the dollar is within 8% of the kept rate, US Christmas Day is still Christmas Day, and Wikidata still names Paris.
- `bot-factory.test.mjs` lists no country-fact failure. A new failure is a real break. `country-ag` answers St. John's (the English Wikipedia sitelink, because the Wikidata item has no English label) and `country-gq` answers Ciudad de la Paz since 2026-01-03, with Malabo until that date.
- `/bots/?q=fx-usd-to-eur`, `holiday-us` and `country-fr` show the bots, and the registry `live` count went up.

## Mistakes

- REST Countries answers with a redirect and no CORS header. Do not wrap it. Wikidata's query service does send CORS.
- Wikidata `wdt:` is the truthy value, and it also drops a capital whose item has no English label, because the label pattern is inside the same OPTIONAL. Read `p:P36` with the rank, the start and end dates, and the English label as its own OPTIONAL. Keep preferred rank when one exists, otherwise normal rank, and drop deprecated. That is what `wdt:` means, and a deprecated old capital (France once had London) stays out. When a current capital's start date is another statement's end date, the bot says both with those dates.
- A holiday whose legal date is a Saturday is listed on the observed Friday (US Independence Day 2026 is 2026-07-03). Check the observance rule, not a date copied from the first response.
- A country that still has no capital after the sitelink fallback stays in the family and fails. It is a fix job. Do not delete it to make the count clean. Antigua and Barbuda's capital item (Q36262) has no English label; the English Wikipedia sitelink is "St. John's, Antigua and Barbuda", and the bot says St. John's. Equatorial Guinea's preferred capital is Ciudad de la Paz from 2026-01-03 (English Wikipedia: the capital since January 2026); Malabo's statement ends that day, so the bot names both with the date. The built-in list in `skills/country.js` says Ciudad de la Paz for the same reason.
