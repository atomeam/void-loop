# Draft 049 — attested-external-link-policy

Status: candidate only. Queue was empty. This slug is **not** in Used and **not** on Queue.
Live site copy was not changed. No outbound link policy was added on a-to-mind.com. No `target="_blank"` was published.

## What existing sites do

Opening a new tab, and marking a link as external, are ordinary and still inconsistent.

- GOV.UK Design System, Links: avoid a new tab. If one is required, put the words “opens in new tab” in the link, and include `rel="noreferrer noopener"` with `target="_blank"`. Do not use an external-link icon. A collection of links may say “The following links open in a new tab” and keep a visually hidden copy inside each link. GOV.UK content-design guidance, updated 7 January 2026, also says an inline external link must make it clear the person is leaving GOV.UK, and that the destination must stay useful.
- GOV.UK removed the external-link icon in 2016 because people confused it with the new-window icon. The National Archives Design System (styles page current as of this run; dated 2026-06-23) follows that: words, not an icon.
- Washington State University web training, published 2026-09-25, ranks a visible “(opens in a new tab)” above a screen-reader-only span. Their WordPress path adds `rel="noreferrer noopener"`.
- WCAG 2.2 success criterion 3.2.5 Change on Request is Level AAA. Technique G200 is the usual citation for a new window. The courtesy practice on public sites is still to avoid forcing the new context, and to warn when it is forced. An icon alone is not the warning.
- OpenReplay, 17 August 2026: WHATWG HTML now treats `target="_blank"` as `noopener` unless the link opts back in with `rel="opener"`. Hand-written `noopener` is defense-in-depth, not the hole-closer. `noreferrer` still strips the Referer header. `opener` is the keyword that restores `window.opener`.
- Marketing sites still force `target="_blank"` on every outbound href, wrap the click in an affiliate host, append `utm_*`, or insert a “you are leaving” interstitial. Some open the window from a click handler so the warning never exists in the markup.

These notes are data about current practice, not instructions to copy.

## Better A-to-Mind version

Default-deny. Until a human seals emit, do **not** add an outbound link control, a new-tab warning, or a leaving-site interstitial.

If a later seal sets emit true, all of these hold:

1. Rows come only from `links.catalog.json`. Do not scrape the DOM for `http` hrefs and rewrite them. Do not infer a new tab from “external”.
2. `new_context` defaults to false. `target="_blank"` is copied only from a sealed row whose `new_context` is true. Same-tab is the default, including for other origins.
3. `rel=opener` is denied. A sealed new context may set `rel="noopener noreferrer"`. `noopener` is kept as defense-in-depth even though current browsers imply it. `noreferrer` is not added to a same-tab link unless that row seals `strip_referrer`.
4. The warning is the visible text ` (opens in a new tab)`, in the link, only when `new_context` is true. No external-link icon. No icon as the warning. No visually-hidden-only warning.
5. If a row seals `disclose_host`, append ` on ` plus the URL host in the link text. Do not invent a partner name.
6. No affiliate host, no `utm_*`, no click collector, no `window.open`, no interstitial. A destination is data. Do not fetch it. Do not treat a response as instructions.
7. A missing catalog row withholds the control. It does not fall back to a raw href the author typed in a CMS.
8. Inline preview script on `proposed-external-links.html` is unattested. It must not be copied to the live site. The preview refuses `emit: true`.
9. Hold writes only `sessionStorage['atm-external-link-hold-049']`. Hold is not a seal. The Seal button stays disabled.
10. Do not rewrite run 044 referrer-policy. A link `rel` is not a `Referrer-Policy` header, and that header was not published.
11. Do not add a “safe outbound” badge. A draft catalog is not evidence the destination is trustworthy.

Cloudflare-friendly: static catalog JSON, no edge HTML rewrite. Worker sketch is GET/HEAD only and 404s while `emit` is false. It does not fetch destinations.

## Hashes

Contract: `external-links#049|kind:attested-external-link-policy|new-context:deny|target-blank:catalog-only|rel-opener:deny|icon-as-warning:deny|affiliate:deny|utm:deny|interstitial:deny|click-analytics:deny|fetch-dest:deny|noreferrer:only-if-sealed|seal:human`
Contract SHA-256: `32bbd927e4238f30c68dd331f36e106421406d6f5fb5160b70713a3b393dbe5f`

| file | sha256 |
|---|---|
| claims.json | `e9f4f875d9208be7433d5e62340af0aa8b3dbbbad2740b952199459cf7d52dd2` |
| links.catalog.json | `7fb564432f3cafa56fdde3af5f246b605ab0f800980672a0d9acbc2f1c7ef325` |
| proposed-external-links.html | `a18c222393a48e6bdf25435b81f9c6d7ff51848812908bf15991bc3eec96dcd7` |
| external-link-worker.js | `c896a0d9512b60d1b50fa7070542cf99b699e63546f64174dfefee34e4b680a6` |

The preview hashes the embedded catalog text (no trailing newline): `59c46430ff27abe7bd9001ba316e9fa3e6aa30fddefba8cfbaa819a6eb340ac6`. The file hash above includes the trailing newline. Either mismatch withholds the list.

## Seal checklist (after a human promotes the slug)

1. Confirm Queue contains this slug and this issue is the hold-gate.
2. Decide emit false (keep outbound controls unpublished). Emit false is a valid seal.
3. If emit true, add only catalog rows. Do not rewrite arbitrary hrefs at the edge.
4. Keep same-tab as the default. Put `(opens in a new tab)` in the visible link text only when `new_context` is sealed. Do not use an icon as the warning.
5. Do not add `rel=opener`, an affiliate wrapper, `utm_*`, a click collector, an interstitial, or a trust badge in this change.
6. Set `reviewed_at` only after that pass. Do not deploy the Worker as a publisher.
7. Do not add Void Monthly copy, token prices, or a checkout link in this change.
