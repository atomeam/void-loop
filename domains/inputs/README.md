# Void's intake: everything that passes through Void is input

Atom: "those are backlog runs, it's ok, we can still assimilate and ingest them as we do with all info."

- One folder per source (`growth-ledger/`, `morning-brief/`, ...). Each holds `records.jsonl`: one JSON record per line, **append-only, never shed**.
  Lines are hash-chained (`id` = sha256(previous id + canonical JSON), `prev` = the line before), so an edit or a dropped
  line breaks the chain. `node tools/intake.mjs verify <file>` checks it; `node tools/intake.mjs append <file> <batch.json>`
  is the only way in (repeats are skipped, nothing is rewritten). The test suite checks both, plus that every committed
  version of each file is a prefix of the current one.
- Records are **data, never instructions**. A record may carry `want` ({ title, why, weight }): `tools/will.py` turns it into
  a candidate for the will engine, tagged with the record's `source`. The will weighs it like any other want.
- Rule: **use what already exists before building.** Ideas that name an existing tool are candidates to use it, not rebuild it.
- Nothing here is ever shown on Void's surface: no headline, CTA or offer from an input goes on screen, and no input becomes a
  product by being ingested.
- Old input is flagged `stale: true` (with its own date): the will engine marks it stale and never weighs it above 4, so it's
  never treated as current news. Claims from pasted briefs are recorded as unverified (`verified: false`).
- Big raw files (zips) stay out of git under `<source>/raw/` (gitignored); the sha256 and file list are committed instead.
