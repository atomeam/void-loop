# Showing another site's listings under its terms (the jobs pages, 2026-10-26)

**What starts it:** a Versus floor whose page needs data Verse cannot make itself (job listings, events, products), where the rival sites or others offer a free public API
or feed. Owner, 2026-10-26: "dont forget Verse can use these sites as well as beat them". Done first for /jobs/ (`lib/jobs-core.js`).

## Steps

1. **Read each source's own terms yourself** (the API page or the official repository, not a scraper's summary). The builder's network may be closed: `WebFetch` reaches
   github.com, so a source's official GitHub repository is the first place to read. Write down, per source: attribution, link back, where Apply goes, rate limits, how
   often to sync, and any no-redistribution clause (feeds, structured data, other boards). If you cannot read the terms first-hand, do not use the source and say so
   (Remote OK and Arbeitnow were left out this way).
2. **Put the terms in code**, one table (`SOURCES` in `lib/jobs-core.js`): name, home, api, terms link, cache time (`ttl`) that matches the sync rule, and a flag for
   what may be passed on (`feed`). Normalise each source to one shape; keep only https links on the source's own host (`okUrl`), and cut descriptions to a short
   plain-text excerpt run through `scrub` (emails, phones, addresses, links out; the same rules as `tools/site-re.mjs` scrubPersonal). Load no logos.
3. **Fetch server-side** in a Pages Function with a fixed address per source and the edge cache per source (`functions/api/jobs.js`); write the "what a stranger could
   make this do" block at the top. `X-Robots-Tag: noindex`. Never emit JobPosting structured data when a source forbids it.
4. **Commit a daily snapshot** from a runner (`tools/jobs-snapshot.mjs`, `.github/workflows/jobs-snapshot.yml`, also on push of its own script so the first file is made
   at once). The page draws it first, labelled "Snapshot of <date>, not live", then the live answer, and keeps the last live list on the device for offline.
5. **Credit on every listing** ("Listing from <source>", Apply on the original posting) and say on the page what Verse does not do.
6. **Use the sites too:** a closed list of "open this search on <site>" links, each labelled confirmed, partly or unconfirmed (`searchLinks`), and record per site in
   `domains/features/<floor>.json` under `use` what Verse can use.

## How to tell it worked

`node --test tools/job-board.test.mjs` (normalising, scrub, the feed carries only the allowed source, the cache asks each address once);
`node tools/heavy.mjs node tools/jobs-page.mjs <dir>` (390 px play-through with a made-up `/api/jobs`); after the deploy, the gate.

## Mistakes made

- The sandbox could not reach the APIs, so the first committed snapshot is empty: the workflow's `push` trigger makes the first one right after the push.
- `Write` turned ` ` escapes into the raw characters and broke a regex: keep invisible characters escaped and check `node -e "import(...)"` after writing.
- A truncated excerpt ending in "…" fails the `no-ellipsis` check: cut at a whole sentence instead.
