# Secrets and privacy

Owner, 2026-10-15: "make Verse the best at keeping secrets ever made", and "Verse always should turn every negative ask into a
positive thing; Verse is a force of absolute good in the universe." The repo is **public**, so nothing secret or personal is
ever committed. Going private later would not take back what was already public.

## What is protected, and by what

| What | Guard | Where it runs |
|---|---|---|
| Keys and tokens in any added line, any file type | `tools/secret-scan.mjs` (#742, the one key-shape engine) | pre-push (`checks.mjs`) and the PR gate (`void-review.yml`) |
| Keys ever committed, in any commit | `node tools/secret-scan.mjs --history` | by hand / audit; 2026-10-15 run: only made-up test fixtures, nothing to rotate |
| Keys in what the site ships to browsers; owner checks against literals; `/api` without a rate limit | `tools/runtime-guard.mjs` | PR gate, `privacy-guard` check |
| Emails, phones, IPs, card numbers, tokens in `domains/`, logs, fixtures, `docs/void-voice.md`, `void.asks.json` | `tools/privacy-scan.mjs` (kind and line only) | PR gate on changed files |
| Personal data a visitor types | `lib/privacy.js` `redactPersonal`: placeholders `[email]` `[phone]` `[ip]` `[number]` `[redacted]` before storage | `/api/answer` (cache key, logs), `/api/miss` (miss board, product gaps) |
| Env vars, keys, instructions, other visitors' asks; prompt injection; harmful or mean asks | `lib/keeper.js` `keeperOf`: answered first, kindly, with a positive alternative; `scrubOut` removes env values from model output | `/api/answer`, red-team suite `tools/keeper.test.mjs` |
| The browser | `_headers`: CSP (per-page sha256 hashes for inline scripts added at deploy by `tools/csp-hashes.mjs`, so modern browsers run only the page's own inline code) (`default-src 'self'`, no remote scripts, `object-src 'none'`, `frame-ancestors`, `upgrade-insecure-requests`), HSTS 2 years, `Referrer-Policy: no-referrer`, Permissions-Policy, COOP | every page; `tools/csp-smoke.mjs` loads /, /films/, /store/ and Gumroad/YouTube embeds under it |

Rules: secrets live only in Cloudflare/Stripe/GitHub settings and are read as `env.X` in functions, never in client JS.
Visitor asks are stored and committed as paraphrases or redacted shapes, never verbatim. A deliberate placeholder line says
`privacy:ok`; a made-up test key says `secret-scan: ok`. `domains/capacity-marketplace.md` and `domains/handoff-studio.md`
hold published business contacts on purpose and are skipped by the privacy scan (owner's call to keep them public).

## The force-for-good rule

A harmful, mean or secret-seeking ask never gets just a no. Verse declines in one line and offers the nearest genuinely good
thing (an account-hacking ask becomes securing your own accounts or moving on; an insult becomes a kind, funny reply; a bomb
becomes a Verse film with fake explosions). The alternative never helps with the harmful part. Both values are in
`domains/void.canon.md` under "How Verse is different".

## Rotation

1. Anything that ever reached GitHub is public: rotate it, even if the commit is gone (forks, caches, clones).
2. Cloudflare keys rotate themselves. Verse holds one bootstrap key, `CF_KEYMASTER_TOKEN`: an account-owned Cloudflare token with
   Account > Account API Tokens > Edit, made once by the account owner and saved as a repo secret. From it, `tools/key-keeper.mjs`
   mints each job its own child key at the start of every run (scoped to that job, owned by the account, expiring in 1 to 3 hours),
   hands it over masked through `$GITHUB_ENV`, and a daily sweep (`.github/workflows/key-keeper.yml`) deletes Verse's own expired
   `verse-*` keys. No child key can make keys. No value is printed, logged, committed or stored. Without the keymaster, jobs fall
   back to the old `CLOUDFLARE_API_TOKEN` repo secret. Key health (names and yes/no only) shows on /autopilot/.
3. Keys from other providers (Stripe, Gumroad, Modal, GitHub) still need their first value from the account that owns them, once,
   saved as a repo secret. Modal mints new tokens only from a Team plan's service users; Stripe and Gumroad have no token API.
   Agents never paste or hold a value in chat.
4. Remove the value from the tree, add a test that would have caught it, and note the type and file (never the value) here.

Rotation log: none needed (2026-10-15 full-history scan: test fixtures only).

## A product: Verse Vault

The same stack (key-shape engine, history scan, privacy redactor, keeper with positive redirects, CSP smoke) could sell as
"Verse Vault / secret guard" in the store: a drop-in pre-push and PR gate for small teams. Not built as a product yet.
