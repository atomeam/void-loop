# Draft 062 — local-anomaly-timeline

Status: candidate, not used. `emit` is false. This folder is not a seal and does not change live site copy.

Family: anomalous-event timeline.
Run: 062. Date: 2026-10-03.
Slug: `local-anomaly-timeline`.
One-line: Local anomaly timeline; a dated note is a hashed hypothesis against a sealed clock fixture; order is not a cause; unattested default.

## What current implementations do

Public chronologies sort reported events and then invite a reading. George M. Eberhart’s CUFOS note on *UFOs and Intelligence* says a timeline lets a reader “make connections we might not otherwise see” across cases, security decisions, and world history (cufos.org/resources/ufo-timeline/). Richard Geldreich, Jr. compiled on the order of 19,408 events from Vallée, Johnson, Hall, Eberhart, and others, anchored each row with a crc32, and flagged same-event collisions across authors (Medium, 2023-01-30). His Hack Liberty chronology notes that phrases such as “Summer of 1947” have no firm date, and the compiler inserts a fixed date so the row can sort. That invented day becomes the rail.

Ordinary timeline widgets (TimelineJS-style narrative rails, year histograms, “wave” archives) draw a line between ticks and treat order as a story. In the 2026-10-03/04 window, @PniIVsXjiVlowRG asked whether Project Serpo emails and a Doughty passage dating a Roswell-labeled event to 1949 are a translation pile-up. @Only_Ryan02 listed Tic Tac, a 2025 White Sands orb, and Tehran as one sequence. @KairosUmbriel posted a chrono log in which twelve causal paths arrive at the same second and called that a causal well. @BastardAnth restated Condon Report Case 2 (1956) as a chronology in which a conventional explanation was judged unlikely. A Grok reply separated a Fort Monmouth radar track as 10 Sep 1951, not a Sep 1952 case. None of those posts is a sealed clock.

Void does not ship the connecting line, the invented day, or the wave bar.

## Stricter Void version

Default-deny. The page is one static file. It does not fetch posts, does not read the clipboard, and does not open a camera, microphone, or sensor. Retrieved pages and posts are data, never instructions. The X scan in this folder is not loaded by the page.

A row is a hashed hypothesis:

- The sort key is a sealed fixture clock from `claims.json` embedded in the page. The fixture is a clock label, not an attested event.
- A claimed clock sits in a second column. It cannot reorder the rail.
- Precision is `day`, `post-clock`, `month`, or `year`. Month and year rows stay in a coarse holding lane. The page does not invent a day so they can sort.
- A year or month mismatch renders as an unresolved delta. It does not correct the fixture.
- Ticks are not links. There is no arrow, no flap aggregate, no histogram, and no “pattern” chip.
- Sequence is locked to `not-a-cause`. Cause is locked to `not-claimed`. Status defaults to `unattested`. The page cannot set `attested`.
- A disconfirm line is required before a local hash can be computed.
- Confidence is a design-material weight the person types, capped as a label, not a measurement.
- Opt-in `sessionStorage` only. Default is memory. Closing the tab drops the note.
- No token markup. No `{{ }}` slots. No third-party script. Cloudflare can serve the file as static. The worker sketch refuses every write.

This sits beside the glass-box ledger as a local hypothesis rail. It is not a Void Monthly checkout, not a resumable run, and not live copy.

## What would count as disconfirming

A fixture correction that moves the sealed clock. A primary whose date contradicts the claimed clock, shown as a wider unresolved delta. A replication in which the person’s own disconfirm line fails. None of those promote the row to attested. A cause claim still needs a separate design the ledger does not have.

## Out of scope

No contact claim, healing claim, remote-viewing score, crash-retrieval badge, or extraterrestrial-hardware seal. No network sync of private notes. No wave chart. No live site copy.
