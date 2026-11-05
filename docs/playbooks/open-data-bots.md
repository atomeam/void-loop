# Open-data bot families

What starts it: a useful public dataset that needs no key (exchange rates, holidays, country facts) and can be called from a-to-mind.com, either because it sends `Access-Control-Allow-Origin: *` or through `/api/apibot` when it does not.

## Commands

```
node tools/open-data.mjs
node --test tools/open-data.test.mjs tools/bot-factory.test.mjs tools/cross-checks.test.mjs
node tools/bot-factory.mjs
```

`open-data.mjs` fetches Frankfurter (ECB rates), Nager.Date (2026 public holidays, one call per country) and Wikidata (one SPARQL read of capitals, currencies and continents) and writes `void-live-deploy/bots/open-data.js`. Do not edit that file. Then `bot-factory.mjs` rewrites `bots/registry.json`. Credit each source in `bots/credits.json` (no `api: true`, or the next `api-bots.mjs` run drops it) and as a unified row in `domains/autosalvage.unified.json`, then `node tools/autosalvage/unify.mjs --write` so `/credits/` lists it.

## How to tell it worked

- `tools/open-data.test.mjs` passes, including the live call: the dollar is within 8% of the kept rate, US Christmas Day is still Christmas Day, and Wikidata still names Paris.
- `bot-factory.test.mjs` lists only the two known Wikidata gaps (`country-ag`, `country-gq`) as failures. A new failure is a real break.
- `/bots/?q=fx-usd-to-eur`, `holiday-us` and `country-fr` show the bots, and the registry `live` count went up.

## Mistakes

- REST Countries answers with a redirect and no CORS header. Do not wrap it. Wikidata's query service does send CORS.
- Wikidata `wdt:` is the truthy value. `p:` also returns old capitals (France once had London). Use `wdt:`.
- A holiday whose legal date is a Saturday is listed on the observed Friday (US Independence Day 2026 is 2026-07-03). Check the observance rule, not a date copied from the first response.
- A country Wikidata will not answer (Antigua and Barbuda has no truthy capital; Equatorial Guinea's truthy capital is Ciudad de la Paz, not Malabo) stays in the family and fails. It is a fix job. Do not delete it to make the count clean.
