---
name: paid-media
description: How to put big files (videos, audio, downloads) on Verse's site for people who pay only, beyond what D1 and Pages hold. Store in Cloudflare R2, check who pays with payer(), hand out short-lived signed links (a <video> cannot send a key), and refuse strangers' uploads before reading them. First used for Verse's films (/films/, functions/api/films.js).
---

# Paid-only media on Verse's site

Owner, 2026-10-14: "we need to scale up . just because we use cloudflare we can use whatever it takes on top of that to support our needs", and "we should learn that workaround for all if we pull this off save it as skills". Verse's films (`functions/api/films.js`, `/films/`) are the working example. Copy them.

## When

Something people pay for is too big for D1 (rows max out near 2 MB) or must not be public (Pages assets and GitHub releases are public). Video, audio, large downloads, generated files.

## The pattern

1. **Store it in R2, not D1 or the repo.** Make the bucket with the Cloudflare MCP tool `r2_bucket_create` (the cloud session's Cloudflare connection can make buckets) or `npx wrangler r2 bucket create <name>`. Bind it in `void-live-deploy/wrangler.toml`:
   ```toml
   [[r2_buckets]]
   binding = "FILMS"
   bucket_name = "void-films"
   ```
   R2 is free up to 10 GB stored, with no charge for egress. Past that it costs money: the owner's call (`STANDING.md`, Money). Keep the words (title, description) next to the file as `<id>.json` in the same bucket. No table is needed.
2. **Who may see it: `payer(request, env)`** from `functions/api/support.js`. It accepts the owner, a Verse Pro key, a Code Review Pro license, or a paid account's session, and returns `null` for anyone else. Reuse it; don't write a second rule.
3. **A signed link, because a `<video>`, `<audio>` or `<img>` cannot send a Bearer header.** The list endpoint checks `payer()` and returns, for each file, `src: /api/<route>?id=&exp=&sig=`. `sig` is an HMAC-SHA256 of `id|exp` keyed from `READ_TOKEN` + `SALT` (`sign()` / `watchLink()` in films.js). It lasts hours (`WATCH_MS`), and rotating either secret kills every link. Compare signatures in constant time.
4. **Stream with Range**, so a film starts at once and seeks: `env.FILMS.get(key, { range: { offset, length } })` returns 206 with `content-range`, and a range past the end returns 416. Send `accept-ranges: bytes` and `cache-control: private` so no shared cache keeps a member's copy.
5. **Only the owner writes, and a stranger's upload is refused before a byte is read.** Add the route to `OWNER_WRITES` in `lib/guard.js`; the guard buffers bodies, so this matters at tens of MB. Then give it a `LIMITS` entry with a body cap that fits the files and enough rpm for the many Range GETs one video makes.
6. **Uploads come from CI with the owner token** (`secrets.VOID_OWNER_TOKEN`, the site's `READ_TOKEN`). Example: `tools/film-post.mjs`, called from `.github/workflows/record.yml`. Any copy kept elsewhere is private (GitHub releases as `--draft`).
7. **The page**: credential from `sessionStorage` (a key pasted on the page, for that tab only), else `localStorage['a2m.void.owner.v1']`, else `localStorage['a2m.void.me.v1'].token`. On 401 or 403, show a members-only gate with a key field and the `buy` link from the response. Mark it `noindex`.

## Test it

- **A unit test with an in-memory R2** (`tools/films.test.mjs`: `put`/`head`/`get` with range/`list`). It checks that strangers and free accounts get 401, payers get signed links, and a changed, expired or other-file signature gets 403. A Range gives 206 with the right bytes. The guard reads 0 chunks of a stranger's upload: use a `ReadableStream` with `highWaterMark: 0`, or the stream reads one chunk on its own. Add it to `tools/checks.mjs`.
- **A browser check** in `tools/test_void.mjs` with `/api/<route>` stubbed: the gate for a stranger, the content for a member, and the extra controls for the owner.
- **Live, after the deploy:** `curl -s https://a-to-mind.com/api/<route>` gives 401 with `buy`. The owner token lists the files, and their `src` plays.
- **Prove the test can fail:** break the rule it guards and watch it go red.

## Gotchas

- Headless Playwright Chromium cannot decode H.264, so check MP4 playback on a real phone or Chrome. Range and bytes can still be tested.
- `wrangler.toml` bindings reach Pages on the next `deploy.yml` run. If the route answers 503 "bucket is not bound", the binding did not land: check the deploy log.
- Never put the files, or the raw asks people typed, in the repo. It is public.
