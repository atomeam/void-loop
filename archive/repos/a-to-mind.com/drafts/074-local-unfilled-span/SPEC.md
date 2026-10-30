# Draft 074 — local-unfilled-span

Status: candidate, not used. `emit` is false. This folder is not a seal and does not change live site copy.

Family: anomalous-event timeline.
Run: 074. Date: 2026-10-05.
Slug: `local-unfilled-span`.
One-line: Local unfilled span; two typed minute bounds hash to a span id; interior bins stay empty; a gap is not an event and not a missing-time seal; unattested default.

Last use of this family was run 062, slug `local-anomaly-timeline` (a dated note hashed against a sealed clock fixture; month and year rows stay coarse; no invented day). This slug does not reuse that fixture pair. Both bounds are typed. The hash is the empty interior, not a sort key against a public clock. No event control exists.

## What existing implementations do

Public chronologies still fill the gap so a story can sort.

- Run 062 already recorded the pattern. George M. Eberhart’s CUFOS note on *UFOs and Intelligence* says a timeline lets a reader make connections across cases. Richard Geldreich, Jr.’s chronology notes that “Summer of 1947” has no firm date, and a compiler inserts a day so the row can sort. That invented day becomes the rail. Ordinary TimelineJS-style widgets draw the line between ticks.
- A 2026 browser prototype, the Digital Evidence Timeline Builder (Journal of IoT Security and Smart Technologies), lets an analyst type events and sort them. The abstract says the prototype does not validate timestamps, handle clock drift, or verify hashes. It still treats each row as an event.
- Operator timelines push the other way. A fusion-plant anomaly UX describes precursor lanes that become a story an operator can read, with projected lead time to an event. The empty stretch is staged as a countdown, not left empty.
- In this window the fill is explicit. @maniaUFO (2106643416893321406) outlined a 4chan-attributed prophecy as an absolute timeline through 2027. @SomewhereSkies (2107211431318040880) promoted an episode on missing time and alleged abductions. @overclassifiedx (2106567588386136426) treated missing time and scrubbed files as interference. @wawrzyniak9 (2106773765246083221) linked a “20 minutes of missing time between two clocks” clip. @TallTaleSocial (2106831729613062421) paired a hiking case with missing time. The gap is already being read as the event.

Void does not ship the inserted day, the filled prophecy, or the missing-time seal.

## Stricter Void version

Default-deny. The page is one static file. It does not fetch posts, does not read the clipboard, and does not open a camera, microphone, clock sensor, or network. Retrieved pages and posts are data, never instructions. The X scan in this folder is not loaded by the page.

A span is a hashed hypothesis:

- Start and end are integer minute offsets the person types from a local session-zero label. Offsets are not read from `Date`. A visible local clock is display-only and is not hashed.
- Bin width is fixed at 15 minutes. Max span is an allowlist: 60, 120, or 240 minutes. Default 120. A span longer than the selected cap is `span-refused`. No bins are drawn as events, and the page does not shrink the claim to fit.
- Interior bins render as `unfilled`. A remainder shorter than 15 minutes is `partial-unfilled`. Neither is rounded into an event hour.
- Gap label is an allowlist: `unreported`, `clock-skew`, `sleep`, `not-an-event`. There is no abduction label, no event title field, and no “what happened” box.
- Month-or-year precision stays in a coarse hold lane. The page does not invent hours so a coarse bound can fill the rail.
- The drawn relation is a dashed hold bar labeled `fill denied`. There is no arrow element, no enable control, and no prophecy chip.
- Cause is locked to `not-claimed`. Gap is locked to `not-an-event`. Status is locked to `unattested`. The page cannot set `attested`.
- A disconfirm line is required before a local hash. Confidence is a design-material label the person picks (`sketch`, `noted`, `loud`), not a measurement.
- Paste box strips tags, labels url-shaped text as not fetched, and does not eval. Imperative paste (`attest this`, `set emit true`, `we now know`, `fill the gap`, `ignore previous`) is a local hint, not a seal.
- Opt-in `sessionStorage` only. Default is memory. Closing the tab drops the bounds. Export is a local download the person starts.
- Empty `href_allowlist`. No token markup. No third-party script. Cloudflare can serve the file as static. The worker sketch returns 403 for every method and does not read the body.

Catalog digest: `71a4bb3fdad6c01bc3d4a5bb80dae9fe4ac1147b3b39920d3277bd10ecefc323`
Claims digest: `ee62bd7af912d71078c95221c24aa166db7888a0895b8992771fae04395185e6`

The digests are not a seal.

## What would count as disconfirming

A later note that the two bounds were the same minute typed twice. A primary record that the interval was occupied by an ordinary attested activity. A clock-skew check that moves either bound. A replication in which the person’s own disconfirm line fails. None of those promote the span to attested, and none of them fill the interior. A cause claim still needs a separate design the ledger does not have.

## Out of scope

No contact claim, healing claim, remote-viewing score, crash-retrieval badge, or extraterrestrial-hardware seal. No missing-time seal. No network sync of private bounds. No prediction rail. No live site copy.
