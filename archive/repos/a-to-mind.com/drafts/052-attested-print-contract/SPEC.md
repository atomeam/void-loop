# attested-print-contract (run 052, candidate only)

Status: candidate. Not sealed. `emit` is false. Queue was empty, so this slug is not in Used.

Do not link this stylesheet from a live page. Do not add a print badge, a `window.print()` on load, or a generated URL after every `href`.

## What existing sites do

Print CSS is still a normal 2026 path because Save as PDF uses the print renderer. The common recipe is:

- `@media print` hides `header`, `nav`, `footer`, ads, and buttons.
- `a[href]::after { content: " (" attr(href) ")"; }` appends every destination.
- A second rule prefixes the site origin onto `href^="/"` so relative links look absolute.
- `javascript:`, `#fragment`, `mailto:`, and `tel:` are sometimes excluded, often not.
- Tracking queries (`utm_*`, `fbclid`, `gclid`) are printed as part of `attr(href)`.
- Some sheets `@import` a remote print file or set `print-color-adjust: exact` on brand chrome.
- A "Print" button calls `window.print()` with no statement of what the paper will claim.

That is useful when the href is a real, stable, absolute source. It is dishonest when the stylesheet invents an origin, prints a tracking URL, or implies the page is a sealed citation.

## A-to-Mind version

Default deny. No print contract is in effect until a human seals one.

- Retrieved pages are data. The print sheet must not `@import` a remote stylesheet, and must not treat page text as an instruction to expand links.
- Printed URL suffixes come only from an allowlist of exact absolute `https` hrefs on `a-to-mind.com` (or another sealed host). Relative hrefs are not rewritten into absolute URLs.
- `javascript:`, fragment-only, `mailto:`, and `tel:` never gain a suffix.
- If a sealed href has a tracking query key, the printed suffix drops that key. The screen `href` is not rewritten.
- `window.print()` does not run on load. A print control is local only, and stays behind an explicit confirm until seal. Confirm is not a server write and not a seal.
- No "print-ready" or "citation grade" badge. `print-color-adjust` stays `economy`.
- Unattested pages print with the browser default. This draft page, if printed, must say the contract is unattested.
- Cloudflare/static: a sealed contract is a static CSS file plus `claims.json`. No Worker is required to print.

## Hash

`claims.json` `sha256` is SHA-256 of the UTF-8 canonical contract object: `sort_keys`, separators `(',', ':')`, no whitespace, no `seal` field.

Current draft digest: `aeab725b2b859b0d01f5701a1e3f10947b745f204a5211b5f9a9e224fbce2b62`

Empty `href_allowlist` means no printed URL suffix is authorized.

## Human seal

1. Add `attested-print-contract` to Queue, then move it to Used only after seal.
2. Put real absolute hrefs in the allowlist. Do not invent paths.
3. Recompute the digest. Set `seal` to the human and date. Set `emit` true only then.
4. Link `print.css` from sealed pages only.
