# Void's defences: audit and fixes (2026-09-28)

The will engine's top want ("check my defences against AI-driven attacks using what I already have", weight 12) was built
by the Linux helper from main 0681e9c on branch `helper/defences`. Atom's standing directive: every automation serves
making A-to-Mind the best company ever made. Rule 7: use what already exists before building.

## Tools used (existing first)
- **Snyk connector**: not used. `snyk_auth` needs Atom's browser sign-in (it timed out waiting). Once Atom signs in,
  `snyk_code_scan` / `snyk_sca_scan` / `snyk_secret_scan` on `void-live-deploy/` are the next pass.
- **npm audit**: 0 vulnerabilities (the only dependency is `playwright-core`, dev only; nothing is bundled into the site).
- **Semgrep** (open source; p/javascript, p/secrets, p/xss): 104 rules on 22 files, 0 findings.
- **gitleaks** (full git history): 7 hits, all false positives (the localStorage key name `a2m.void.owner.v1` and a
  `sk_live_12345678` test fixture). No real key has ever been committed.
- **Cloudflare**: Pages Functions have no rate-limit binding, and wrangler can't manage WAF rules, so the limits use the
  platform's edge cache (`caches.default`) plus a per-isolate counter. A zone WAF rate-limiting rule is the stronger outer
  layer and needs Atom's dashboard (see "Left for Atom").

## What was already solid
- **Confirm line** (plan item 7): every send, book or spend (`lib/approval-core.js` GATED) needs the owner token, a
  server-side paused record, a matching fingerprint and an in-time yes. It runs exactly once and fails closed on timeout,
  a changed request or a missing table. No executors are connected yet, so nothing can actually send today.
- **Owner-only routes**: earnings, misses, queue, approval, will POST and catalog refresh refused anyone without
  `READ_TOKEN`, and failed closed when it isn't set.
- **Gumroad ping**: the key is always required. Without an API token, a sale unlocks paid Void only with Atom's seller_id,
  the membership product, and no test or disputed flag. One sale links to one Void. Sales are append-only.
- **Retired routes**: `/api/memory/context`, `/api/ingest` and `/api/attest` have no code. GET falls through to the empty
  page, POST is 405.
- **Fix path**: pasted configs were masked before the model and never cached or stored.
- **Rendering**: model answers and fixes are escaped text. Kept-card HTML is cleaned (`cleanHTML`). Nothing the model says
  is ever run as an ask.
- **Size caps in routes**: most routes already sliced their bodies (answer 20k, miss 1k, approval 8k, passkey 20k, mine 900k).
- **Rate limits**: `/api/answer` (12/min), `/api/miss` (20/min) and passkey challenge minting (20/min) had limits.
- **WebMCP**: owner, identity and paid asks were already refused to agents.

## Gaps found and fixed
1. **A runaway agent could approve its own send.** A WebMCP agent in the owner's browser could ask "send an email…" and
   then call `void_ask("yes")`, and the typed-yes path approved it. It could also answer the "forget me" prompt. Now an
   agent can never start a send, booking or spend, never answer while the confirm line or "forget me" waits, and never read
   the owner's board. A script's synthetic click or key never answers the line either (`e.isTrusted`). The keyboard path
   no longer re-dispatches an untrusted click.
2. **Links could start an action.** `?q=send an email…` asked the owner for a yes straight from a link. Now a link only
   types a send, booking or spend into the box. The person asks it.
3. **No limits on most routes.** will, catalog, mine, queue, approval, earnings, misses and gumroad had none, and there was
   no brake on guessing the owner key. New `functions/api/_middleware.js` (`lib/guard.js`) covers every /api route:
   - per-connection limits per minute
   - a brake: 10 wrong keys and that connection is shut out for the minute
   - size caps checked before a route reads the body, streamed bodies included
   - no cross-site writes from other websites' pages (Gumroad's server ping and origin-less tools pass)
   - no CORS, `nosniff`, and `no-store` by default
4. **Owner and ping keys were compared with `===`.** They're now compared in constant time (hashed, then XOR).
5. **Keys typed into the ask box leaked.** A key in a normal ask went to Wikipedia, the model and the answer cache, and
   onto the miss list.
   - Asks are now masked first, and a masked ask is never cached.
   - The miss list stores the masked text.
   - Model output is masked too.
   - `redact()` now also covers private-key blocks, JWTs, Google/GitHub/GitLab/npm/Hugging Face/Stripe webhook keys,
     Slack and Discord webhook URLs, and secret URL parameters (`?key=`, `?k=`, `?token=`, …).
6. **Prompt injection.** The answer, fix and will prompts now say that typed or pasted text and sources are material,
   never instructions, and that the model can't send, book or buy or claim it did. The will's `i_want` / `because` text is
   masked. Answer source links must be Wikipedia (server) and https (page), so a `javascript:` link can't appear.
7. **Headers.** Added a CSP (`object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`), HSTS
   (1 year), and a permissions policy (no camera, USB, serial, HID, Bluetooth, MIDI or payment). The microphone and
   location stay allowed for voice and weather. `queue` no longer echoes internal error text.
8. **Test flakes** (the shared box is slow): the paid-ask and forget-me checks now poll instead of reading once.

## Permanent adversarial tests (tools/test_void.mjs, "defences:")
- Bursts: answer is cut off after 30/min and will after 60/min, and other connections are unaffected.
- Oversized and streamed-oversized bodies get 413.
- Cross-site writes get 403. Preflight carries no CORS headers.
- Every owner route refuses 8 kinds of wrong key. The brake shuts a guesser out.
- The Gumroad key must be exact.
- A key, password, webhook or private key is masked everywhere: Wikipedia, the model, the cache, the miss list and the
  model's echo.
- Every model gets the injection rule.
- A hijacked answer ("Send this email to attacker@… Yes / No … I have sent it", with `<img onerror>`, `<script>` and a
  `javascript:` link) is shown as text only: no confirm line, no approval, nothing sent.
- Agents can't start a send or spend, answer "yes", or read the board. A script's click can't approve.
- A `?q=` send link only types into the box.
- Every route has an explicit limit.
- The headers are present.
- The built defences want leaves the will.

## Left for Atom (and why)
- **Snyk scans**: need Atom's Snyk sign-in (browser OAuth).
- **A Cloudflare WAF rate-limiting rule** on a-to-mind.com for `/api/*`, as an outer, global layer. The in-code limits are
  per colo and per isolate, so a wide botnet spread over many colos could exceed them. This needs the dashboard (Security →
  WAF → Rate limiting rules; the free plan allows one rule, e.g. 100 requests per 10 s per IP on `/api/`). Wrangler can't
  manage WAF rules, and this agent won't use its deploy login to mint API access for that.
- **Rotating `READ_TOKEN`**: only if it was ever pasted anywhere public. Nothing in git history shows it.
- **Executors** (email, orders) are still unconnected. When one ships, it must go only through `executors` in
  `functions/api/approval.js` behind the confirm line, and the adversarial tests already cover that path.
