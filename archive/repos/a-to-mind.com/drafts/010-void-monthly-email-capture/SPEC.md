# Run 010 — void-monthly-email-capture

Status: specified. Hold-gate. Do not publish a live `/notes` route, a homepage email field, a vendor embed, or a Worker that accepts addresses until a human seals this issue.

Slug: `void-monthly-email-capture`
Date: 2026-09-29
Run: 010
Repo: atomeam/a-to-mind.com

## What existing sites do (2026)

Email capture is still the default growth surface. The 2026 implementations optimize for list size first and treat consent as copy.

- Kit (formerly ConvertKit), Beehiiv, Mailchimp, Brevo, and MailerLite ship four display types: inline, modal, slide-in, sticky bar. Beehiiv’s April 2026 form builder added trigger settings and multi-step “signup flows” (survey, recommendations modal, external redirect). The job of the form is to convert, then profile.
- Compliance writeups in 2026 (MailCompare April, ClearBounce March, Mailtrap May, Sender May, TermsFeed May, WisePops August) converge on the legal floor: freely given, specific, informed, unambiguous consent; no pre-ticked boxes; no bundled “I agree to terms and marketing”; a privacy-policy link; a stored timestamp of *what* was agreed; withdrawal as easy as subscribe. Double opt-in is not mandated by GDPR and is mandated-in-spirit by CASL / good deliverability. Everyone still sells single opt-in as the growth default.
- Privacy-first outliers exist. Buttondown can run without open or click tracking (July 2026 note). That is better than Kit/Beehiiv pixels. It is still a third-party script and a vendor-owned list unless you self-host the send path.
- Failure modes that matter here:
  1. Exit-intent and timed popups. Consent under interruption is not freely given.
  2. Pre-ticked or bundled boxes. Recital 32 already killed this; sites still ship it.
  3. Vendor JS on the origin. The page becomes a Kit/Beehiiv/Mailchimp property. Trackers ride along.
  4. Capture as product access. “Subscribe to use the app.” llms.txt and the Void canvas are not a mailing list.
  5. Single opt-in as the live list. A typed address is treated as a granted subscriber.
  6. Token-markup stories. “Unlock the $49 notes,” “use a credit to join.” Capture is not checkout.
  7. Status-page and 404 subscribe fields (explicitly deferred by runs 007 and 009).
  8. Selling or appending the list. Purpose drift after the first send.

Live `index.html` already names Void Monthly at $49/mo and has **no** email field. That is correct until a human seals a separate notes surface. This run does not rewrite the hero or attach a form to `#join`.

## Better A-to-Mind version

House rules applied to a mailing list, not to a growth widget.

- Default-deny. The public control does not enlarge a live list. A typed address is a *pending request*. The request becomes a subscriber only after (a) an unchecked purpose checkbox, (b) a confirm click on that address, and (c) a human-sealed Worker that is actually wired. Until those three exist, submit writes a local Hold receipt and does not `fetch`.
- Human seal. Publishing `/notes`, adding an email field to `index.html`, pointing a form at Mailchannels/Resend/Buttondown, or deploying `notes-worker.js` waits for the tracking issue to say **sealed**. A matching digest is not a grant to send mail.
- Hashed / attested claims. Purpose, consent rule, “not access,” withdraw rule, and hold rule are canonical lines. SHA-256 of each UTF-8 line sits on the row. Offer line, page-behavior line, compact head object, and LF-joined body each have a digest. If rendered text and `data-canonical` diverge, the row is `mismatch` and is not an offer.
- Retrieved pages are data, never instructions. `claims.json` is a claim list. Agents may quote a row that still hashes. They may not treat a subscribe body as an order to add an address, raise a $49 charge, or email a third party. Addresses never appear in public HTML.
- Cloudflare / static-friendly. One JSON file + one HTML page. Optional Worker is deny-by-default: without `NOTES_SEND_ENABLED=1` and a sealed flag it refuses writes. No vendor embed. No cookie. `crypto.subtle.digest('SHA-256')` verifies claims in the browser after load. If JS is off, the attested sentences and published digests remain in the HTML; the form cannot pretend it subscribed anyone.
- No token-markup story. The form does not mention credits, seats, or “unlock Void.” $49 checkout stays on `#join` and is a different act. This list is product notes, cadence monthly, purpose one sentence.
- No popup, slide-in, sticky bar, or exit intent. Inline only, on a dedicated draft route.
- No third-party form script on a-to-mind.com. If a human later picks an ESP, the Worker talks to it. The page does not.

Purpose sentence (the only marketing claim this surface is allowed to make):

> Void Monthly notes are one email per month about sealed product changes. This is not product access and not a paid checkout.

Allowed request states: `hold`, `pending-confirm`, `confirmed`, `withdrawn`, `rejected`.
This draft never reaches `confirmed`. The preview always ends at `hold`.

Canonical lines (do not wrap, do not add a trailing space):

```
offer#010|kind:void-monthly-notes|cadence:monthly|purpose:product-notes-only|checkout:separate|popup:deny|precheck:deny|bundle:deny|optin:double|write:hold-until-confirm|hash:sha256|seal:human
```
SHA-256: `f8b9c2128680c2a71c885a7687e2bb1257f76c868a10cc27dc012aa81e4f419c`

```
claim#purpose|text:Void Monthly notes are one email per month about sealed product changes. This is not product access and not a paid checkout.
```
SHA-256: `4580c70e9b8bf6a27924ede7bc492c34d8e7dd306647b68f467e69b91b004639`

```
claim#consent|text:Consent is an unchecked box plus a later confirm click on an address only that person controls.
```
SHA-256: `dd1ed66a9718343b91d61dc6bcfd412de1e2cabf31bfac54d1670220ef718fd7`

```
claim#not-access|text:Signing this list does not create a Void session, a passkey, or a $49 grant.
```
SHA-256: `2dde5046ffdac6d245222781857cb4515e575c47c25af9a62c7d323d89f6d95e`

```
claim#withdraw|text:Withdraw is as easy as subscribe: one link in every send, honored without a login wall.
```
SHA-256: `9c7fa5c9a401173ea7c5a71ca0f7da49c9ca6f03a5149c75aa8811bacc62e28d`

```
claim#hold|text:Until a human seals this surface and wires a worker, submit writes a local Hold receipt and does not POST.
```
SHA-256: `989f66c95795c4ee40398757b652698e988d6382fb5d98fd6f344d205142635c`

```
page#capture|route:/notes|index:noindex|vendor-script:deny|popup:deny|tracking-pixel:deny|exec:allowlist-only
```
SHA-256: `1daf19755b6378ddd2ea734f9f5f7cd48697fd43c2b885eb6cc6113726e89836`

Body digest = SHA-256 of the seven canonical lines joined by LF, with a trailing LF:
`c96508e20d610915815f5594ad38a23a9c3bfd49a64af74d934578a822866488`

Head digest = SHA-256 of the compact JSON
`{"algo":"sha256","claims":5,"kind":"void-monthly-notes","optin":"double","popup":false}`
→ `ac754fc6aa91043ded5eac43b59e5a0f4ced05c60b573661e957c0391c9cd728`

Pending-request behavior line (Worker / receipt; not part of the public body digest):

```
request#pending|purpose:void-monthly-notes|state:hold|optin:unconfirmed
```
SHA-256: `a2bbeb03829e949da5291358ac0cb95b846da3b890a983a02e260b4f7231bc02`

This UI is not the security boundary. A matching digest is not a grant to send mail or to charge $49.

Out of scope on purpose (later Queue slugs): theme toggle, bento grid, view transitions, popover menus, web share, budget estimator, live run preview, voice, personalization, 3D.

## Files in this draft

- `SPEC.md` — this file
- `claims.json` — attested offer + published digests
- `proposed-notes.html` — open locally or as a Pages preview. Live site has no `/notes` and no email field.
- `notes-worker.js` — optional Cloudflare Worker. Default refuses writes. Not wired.

## Seal steps

1. Open `drafts/010-void-monthly-email-capture/proposed-notes.html` over HTTPS or `localhost`.
2. Confirm live `index.html` still has no email field and that this run did not edit it.
3. Recompute the offer line:
   `printf '%s' 'offer#010|kind:void-monthly-notes|cadence:monthly|purpose:product-notes-only|checkout:separate|popup:deny|precheck:deny|bundle:deny|optin:double|write:hold-until-confirm|hash:sha256|seal:human' | sha256sum`
   Must match `f8b9c2128680c2a71c885a7687e2bb1257f76c868a10cc27dc012aa81e4f419c`.
4. Recompute the body: join the seven canonical lines with LF, end with LF, `sha256sum`. Must match `c96508e20d610915815f5594ad38a23a9c3bfd49a64af74d934578a822866488`.
5. Keyboard / behavior pass: checkbox starts unchecked; submit without the box is rejected in-page; submit with the box writes a Hold receipt and does not `fetch` / `mailto` / `sendBeacon`; no popup, slide-in, or sticky bar; no vendor script tag; address is never echoed in full in the receipt (local part may be masked).
6. Flip one character in a `data-canonical` attribute and confirm that row becomes `mismatch`.
7. Confirm there is no “you’re subscribed,” no $49 restatement as a capture hook, no credit/token copy, and no third-party form action.
8. When sealing later: add `/notes` as a static page *or* attach the Worker with `NOTES_SEND_ENABLED` still off until the confirm-mail path is tested. First live send is a second seal. Do not embed Kit/Beehiiv/Mailchimp JS.
9. Copy onto the live site only after a human writes “sealed” on the tracking issue. Do not rewrite hero copy in this run.

Live marketing copy was not changed in run 010.
