# Ouroboros: what is built, what is left before anyone can buy it

## Built and tested (Linux)
- `tools/ouroboros.py`: harvest, verify, report, plan, reclaim, run. 14 tests.
- `tools/build_ouroboros_pack.py`: builds `dist/ouroboros-<version>.zip` (one runnable `ouroboros.pyz`, README, checksums). 1 test builds it, unzips it and runs it on a fake machine.
- `tools/void_lens.py`: the free read-only scanner (the funnel). 6 tests.
- `drafts/ouroboros/landing.html`: the page. Its buy link is a placeholder on purpose.

## Before launch (owner steps; money stays behind the owner key)
1. **Run it on the Victus first.** `python tools/ouroboros.py run --root C:\Users\adamm --out D:\ouroboros-report`. Windows is untested: locked files, junctions, long paths. Do not sell it until this ran clean on a real Windows machine, and send the output so the digests can be checked on real projects.
2. **Build the download:** `python tools/build_ouroboros_pack.py` then upload `dist/ouroboros-<version>.zip`.
3. **Create the Gumroad product** (the repo already uses Gumroad) and set the price. A one-time price fits a local tool. The price is yours to set; no market data was gathered for this, so ask a few developers what they would pay before fixing it.
4. **Put the real product URL into `landing.html`** (replace `BUY_URL_HERE`), copy it to `void-live-deploy/ouroboros/index.html`, add `/ouroboros/` to `sitemap.xml`.
5. **Terms and refunds:** write short terms (what it does and does not guarantee, and that deleting files is the user's decision). Have them reviewed; no legal text is included here.

## Rule (owner, 2026-10-06): before anything is deleted, Void must remember it
`push` sends each project's full digest and then reads it back by id, comparing the hash Void computed with the hash of what was sent. It reports "Void remembers N of N" only when every one matches. The tool deletes no project, and `reclaim` now touches only the rebuildable folders (`node_modules`, virtualenvs) of projects that `push` has verified into Void (receipt: `absorbed.json`), and only while they are unchanged since. Void organizes what it holds: `GET /api/memory?view=topics` groups projects by shared tech, `?related=<id>` ranks the ones most like a given project. A delete step, if it is ever added, has to be gated on that read-back, on the project having a pushed remote copy, and on a typed confirmation; a 200 from the server alone is not proof (Void stores a digest, not the code).

## Later (not built)
- Cloud backup with hash verification, and restore: a subscription tier. Needs R2 and D1 set up and an upload endpoint.
- Loading `memory.jsonl` into Void's memory so "how did I solve this last time?" works.
- Windows and macOS hardening from real runs; non-git projects.
