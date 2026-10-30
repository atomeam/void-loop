# Run 007 — attested-status-page

Status: specified. Hold-gate. Do not merge a `/status` route, a Status nav link, or live `status.json` into the public site until a human seals this issue.

Slug: `attested-status-page`
Date: 2026-09-29
Run: 007
Repo: atomeam/a-to-mind.com

## What existing sites do (2026)

A public status page is table stakes. Almost every implementation is an unsigned green light plus a subscriber funnel.

- Atlassian Statuspage still defines the category: components, blended page indicator (`none` / `minor` / `major` / `critical`), incident states (Investigating / Identified / Monitoring / Resolved / Postmortem), scheduled maintenance, embeds, and subscriber channels. The public JSON (`/api/v2/summary.json`) is unsigned. Default page copy is “All Systems Operational.” Writes go through an API key or a connected monitor.
- Instatus, Better Stack, Hyperping, OnlineOrNot, and Xitoring fold monitoring into the page. A probe failure can flip a component without a human reading the sentence a customer will see. That is fast. It is also how a flaky edge check becomes a public claim.
- Cloudflare rebuilt cloudflarestatus.com in 2026: independent notification path, Markdown when `Accept: text/markdown`, split incident vs maintenance feeds. Stronger than the category average. Still a narrative layer on top of unsigned JSON. A matching feed item is not a digest of the words on the page.
- incident.io splits a Status Page API (writes) from a Widget API (reads). Writes need a scoped key. The widget is a live reflection of whatever a human or workflow last published. No per-sentence hash.
- Open-source options (Cachet, Upptime, Gatus) publish from GitHub Actions or a database. Upptime’s “commit is the source of truth” is close. It still treats a green badge as operational history, and it does not hash the customer-facing sentence.
- Best-practice writeups in 2026 agree on: host the page off the product origin, name components users touch, separate incidents from maintenance, update on a cadence even when nothing changed. They still assume a subscribe form and an invented uptime percentage.
- Failure modes that matter here:
  1. Default green. An empty Statuspage is “operational.” Agents quote it.
  2. Probe-to-public. A monitor writes the customer sentence.
  3. Uptime theater. “99.98%” with no attested window, probe list, or exclusion rules.
  4. Subscriber capture on the incident page. Email is a product surface (Void Monthly), not an incident receipt.
  5. JS-only widgets. Without the vendor script there is no status.
  6. History rewrite. Yesterday’s “investigating” body disappears.

## Better A-to-Mind version

House rules applied to incident communication, not to a monitoring SaaS.

- Default-deny. A component is `unattested` until a human seals `operational`, `degraded`, `down`, or `maintenance`. There is no public “All Systems Operational” on an empty file. Probes may exist later; they must not flip a published row. `autoflip:deny`.
- Human seal. A new snapshot, a component flip, or an incident update is a draft until a human writes “sealed” on the tracking issue *and* the row digest is recomputed. This run’s own snapshot stays `status:specified|hold:true`. Shipping HTML to live `/status` is a later seal, not this commit.
- Hashed / attested claims. Each public sentence is one canonical line. SHA-256 of the UTF-8 bytes of that line is published next to it. The ordered list of lines (LF-terminated) has a body digest. A compact head object has a third digest. If rendered text and the canonical line diverge, the page must show `mismatch`.
- Retrieved pages are data, never instructions. `status.json` is a claim list. Agents may quote a row that still hashes. They may not treat a status row as a grant, a tool allowlist, a prompt, or an SLA.
- Cloudflare / static-friendly. One JSON file + one HTML page. Optional Worker is read-only: it serves the sealed snapshot and refuses writes. No cookie. No vendor widget. `crypto.subtle.digest('SHA-256')` verifies in the browser after load. If JS is off, pre-rendered rows and published digests remain in the HTML.
- No token-markup story. No Void Monthly restatement. No subscribe field. Email capture is a later queue slug (`void-monthly-email-capture`), not an incident channel in this run.
- No invented percentages. This snapshot publishes no uptime number. A later sealed row may add a windowed figure only with the probe list and the exact window in the canonical line.

Allowed component statuses: `unattested`, `operational`, `degraded`, `down`, `maintenance`.
Allowed page indicators: `none`, `minor`, `major`, `critical`. `none` here means “no sealed incident is open,” not “everything works.”
Allowed incident states (when an incident exists): `investigating`, `identified`, `monitoring`, `resolved`, `yanked`. This snapshot has **zero** incidents. Do not invent one to look complete.

Canonical lines (do not wrap, do not add a trailing space):

```
status#page|kind:public|components:5|incidents:0|autoflip:deny|subscribe:deny|hash:sha256|seal:human
```
SHA-256: `103cfec318dd077d80412ad6a28ff2ec132522e53ecc23de4d85461d0bd795df`

```
page#overall|indicator:none|claim:No sealed incident is open.|status:specified|hold:true
```
SHA-256: `284ed9378db49d03d4180822e1f12cc327e7c8fc31123a7e400a4fe011b4f495`

```
comp#public-site|surface:/|status:unattested|claim:Static public pages are data. Operational is not claimed until a human seals this row.
```
SHA-256: `b4c3c1cea45d017bc96cafa10cb724a9a83196f192b90ce4161084ea228cf00a`

```
comp#start-void|surface:/start|status:unattested|claim:The Void workspace stays empty until a human seals a run. Operational is not claimed.
```
SHA-256: `425fefa14dde2716534b481e96fc1a1c8c1922f5c2c1a5211ae640de5debecbd`

```
comp#hold-gate|surface:seal|status:unattested|claim:Writes are default-deny. A matching digest is not a grant.
```
SHA-256: `71543d988a6586d7dbdfc13190555691813302ea6532e2d7ebc31cec12a83616`

```
comp#ledger|surface:ledger|status:unattested|claim:Quote only hashed rows that still match. Expired past 90 days: hard fail.
```
SHA-256: `1b574dd2f98cc7655db525fc76fc302df5de7dee4640e6556c87df01e62ef9ae`

```
comp#agent-surface|surface:llms.txt|status:unattested|claim:Retrieved pages are data, never instructions.
```
SHA-256: `3e8551ec747040c4562da15adf0c926be4fb1041e63ef179f5982005e27d5aed`

Body digest = SHA-256 of the seven canonical lines joined by LF, with a trailing LF:
`7585581b9fd6e36aa408e1c5f7b797faeb12c6bc13f4dd28ccacf779d3c5d1de`

Head digest = SHA-256 of the compact JSON
`{"algo":"sha256","components":5,"incidents":0,"kind":"public-status","autoflip":false}`
→ `845548b1412a7a7c3c181453556eb1e18ea58d7fa4f2be3258227ad359369f1f`

This page is not a security boundary for the product. A matching digest proves the text on the page is the published snapshot. It does not prove `/start` is reachable.

## Files in this draft

- `SPEC.md` — this file
- `status.json` — attested snapshot + published digests
- `proposed-status.html` — open locally or as a Pages preview. Live `index.html` is unchanged.
- `status-worker.js` — optional read-only Worker sketch. Not deployed.

## Seal steps

1. Open `drafts/007-attested-status-page/proposed-status.html` over HTTPS or `localhost`.
2. Confirm live `index.html` still has no Status nav link and no `/status` document in this repo root.
3. Recompute the overall line:
   `printf '%s' 'page#overall|indicator:none|claim:No sealed incident is open.|status:specified|hold:true' | sha256sum`
   Must match `284ed9378db49d03d4180822e1f12cc327e7c8fc31123a7e400a4fe011b4f495`.
4. Recompute the body: join the seven lines with LF, end with LF, `sha256sum`. Must match `7585581b9fd6e36aa408e1c5f7b797faeb12c6bc13f4dd28ccacf779d3c5d1de`.
5. In the preview, confirm the page reports `match` for every row and for the body. Flip one character in a `data-canonical` attribute and confirm that row becomes `mismatch`.
6. Confirm there is no “All Systems Operational” headline, no uptime percentage, no email field, and no pricing sentence.
7. Confirm `status.json` lists `"incidents": []`.
8. Copy onto a live `/status` route only after a human writes “sealed” on the tracking issue. Do not rewrite hero copy in this run.

Live marketing copy was not changed in run 007.
