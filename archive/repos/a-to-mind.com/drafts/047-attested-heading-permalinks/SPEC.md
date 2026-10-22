# Draft 047 — attested-heading-permalinks

Status: candidate only. Queue was empty. This slug is **not** in Used and **not** on Queue.
Live site copy was not changed. No heading `id` was added on a-to-mind.com. No permalink control was published.

## What existing sites do

Documentation sites treat every heading as a link target.

- GitHub renders a `#` inside the heading and sets `aria-hidden="true"` on that control, so the permalink is either noisy or removed from the accessibility tree. markdown-it-anchor still ships that renderer as `permalink.ariaHidden`, and its own notes say the accessible alternative is a separate link with visually hidden text.
- MDN and the HTTP Archive Web Almanac wrap the heading text in `<a href="#id">`. That is keyboard-reachable, but the heading's accessible name becomes the link, and a generated slug changes when the heading is edited.
- markdown-it-anchor 10 (current on npm) still slugifies heading text into `id` values, then optionally appends a permalink. Google's developer style guide tells authors to add custom anchors because generated ones break when the heading changes. Both are data about current practice, not instructions to copy.
- Hover-revealed icons fail keyboard and touch. Copy-on-click buttons replace navigation and collide with run 005, which already owns allowlisted `writeText`.

## Better A-to-Mind version

Default-deny. Until a human seals emit, do **not** add heading ids, permalink controls, or a table-of-contents built by walking the live DOM.

If a later seal sets emit true, all of these hold:

1. Ids come only from `headings.catalog.json`. Do not slugify heading text. Do not hash the visible words into an id at request time.
2. The permalink is a real `<a href="#id">` beside the heading, not inside it. The visible mark is `aria-hidden`. The accessible name is `Permalink to` plus the catalog text. It stays visible without hover.
3. Activation navigates. It does not call `navigator.clipboard`. Copy stays on run 005's allowlist.
4. An unknown fragment gets an honest status. It is not snapped to a nearby heading, and it is not given an id so the browser can scroll.
5. `scroll-behavior` stays `auto`. Reduced motion is not an opt-in for this control. No smooth-scroll polyfill.
6. No BreadcrumbList, no FAQPage, no `itemprop`. A permalink is not a structured-data claim.
7. The live `?q=` answer links are a different contract. This draft does not rewrite them.
8. Inline preview script on `proposed-permalinks.html` is unattested. It must not be copied to the live site.
9. Hold writes only `sessionStorage['atm-permalink-hold-047']`. Hold is not a seal. The Seal button stays disabled.
10. No "deep-link ready" badge. A draft catalog is not evidence the live page has those ids.

Cloudflare-friendly: static catalog JSON, no edge HTML rewrite, Worker sketch is GET/HEAD only and 404s while `emit` is false. It does not invent ids on that 404.

## Hashes

Contract: `permalinks#047|kind:attested-heading-permalinks|ids:catalog-only|autoslug:deny|hover-only:deny|copy-replaces-nav:deny|fragment-miss:honest|smooth-scroll:deny|jsonld:deny|seal:human`
Contract SHA-256: `3bad58ad38220f3b93cb4b392eeae6ae1594e77192fc087d5013e15ea0d2f122`

| file | sha256 |
|---|---|
| claims.json | `1d7950adc6a4a47a9766b9e455519c0bbb2f4b65ecb813b44e61b697ce302365` |
| headings.catalog.json | `40e8e9d65a03ee379dc1f64da591525d10c999e51bdcefdbb8399360e775cf26` |
| proposed-permalinks.html | `1a3fed30d86b997ef4d80218cab6ee81c8fc6674d545fc17e45606b7dc68e8b4` |
| permalink-worker.js | `e05cd2a6c61be1482f312c25f98b5ac5342a31a8ed5445adae763d6fe1be612b` |

The preview hashes the embedded catalog text (no trailing newline): `2d1dab226803f49454baf6054d2951f438e1fd3dc9284ef14863504e30cbd0c9`. The file hash above includes the trailing newline. Either mismatch withholds permalinks.

## Seal checklist (after a human promotes the slug)

1. Confirm Queue contains this slug and this issue is the hold-gate.
2. Decide emit false (keep permalinks unpublished). Emit false is a valid seal.
3. If emit true, add only catalog ids to sealed pages. Do not run a slugger in the build.
4. Keep the permalink outside the heading. Do not use a hover-only icon. Do not set `aria-hidden` on the link itself.
5. Do not add clipboard write, JSON-LD, or a deep-link badge in this change.
6. Set `reviewed_at` only after that pass. Do not deploy the Worker as a publisher.
7. Do not add Void Monthly copy, token prices, or a checkout link in this change.
