# Salvage the next ranked piece into a bot

What starts it: the next row of `docs/SALVAGE.md` under "Next 10 by value" (written by `node tools/autosalvage/unify.mjs --write`). Take the next piece that is not already in `domains/autosalvage.unified.json`. A share-alike license (GPL, AGPL, ODbL) is called as a separate service or left as its own data. It is not copied into Verse's code. A license that is missing or not on the reviewed list stays skipped.

## Commands

```
node tools/autosalvage/unify.mjs
node --test tools/salvaged-bots.test.mjs tools/bot-factory.test.mjs
node tools/bot-factory.mjs
node tools/autosalvage/unify.mjs --write
```

Read the piece. Rewrite the behaviour Verse will actually run, in `void-live-deploy/bots/salvaged.js`, with `from` pointing at the archive path or `domains/autosalvage.outside.json`. The probe is a real input and the exact answer. A second case in `tools/salvaged-bots.test.mjs` shows the refusal (empty, a badge, a slugified id). A URL bot's test asks the pinned address and expects HTTP 200. Add a row to `domains/autosalvage.unified.json`. For an outside source whose license allows credit, add a row to `bots/credits.json` with no `api: true` (or the next `api-bots.mjs` run drops it), then `--write` so `/salvage/` and `/credits/` name it.

## How to tell it worked

- `tools/salvaged-bots.test.mjs` passes, including the live URL when the bot builds one.
- `node tools/bot-factory.mjs` prints a higher live count and does not list the new id under failed.
- The piece leaves "Next 10" and appears under Unified.

## Mistakes

- Do not vendor a word list or an icon set to make the count move. A pinned CDN URL with credit is the bot. The file stays on the CDN.
- Do not copy an AGPL or ODbL repository into this one. Open-Meteo is already the weather bot's separate service.
- `archive/script_0.js` is the old page. Do not paste it in. The clock, sticky, timer, list, calculator, link and weather in it are already the live page. The behaviour the live page has since changed is the look: stars start off, and text scale steps by 0.15 between 0.85 and 1.4 (`void-look`).
- `dwyl/english-words` has no release tags. Pin the commit in the CDN URL and HEAD it. Do not download the word list into the repo.
- `mledoze/countries` is ODbL. Pin the release URL. Do not parse the file into Verse.
- A draft that says "unpublished until a human seals it" stays a checker. Shipping the page is a different seal.
