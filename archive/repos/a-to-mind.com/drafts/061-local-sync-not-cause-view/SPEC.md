# Draft 061 — local-sync-not-cause-view

Status: candidate, not used. `emit` is false. This folder is not a seal and does not change live site copy.

Family: correlation-not-causation sync view.
Run: 061. Date: 2026-10-03.
Slug: `local-sync-not-cause-view`.
One-line: Local sync-not-cause view; a co-timed note against a sealed clock fixture is a hashed hypothesis; the gap is not a cause; unattested default.

## What current implementations do

Public conversation treats co-timing as guidance. In the 2026-10-03 window, @2WinFlame posted a series that asks the reader to wait for images after a coincidence, ties synchronicity to a law-of-attraction cause, and lists repeated numbers and “right place” as forms of guidance. @EarthDesires promoted Jung’s 1952 essay as an acausal connecting principle. @algxtradingx separated the bare coincidence (a machine can log it) from the Jungian reading, and said describing that reading is not an endorsement.

Chart research pushes the other way. Xiong, Shapiro, Hullman, and Franconeri (arXiv:1908.00215, 2019) found that aggregated text and bar comparisons drew stronger causal readings than scatter plots, and that more aggregation raised perceived causality. A Quanta restatement circulating 2026-10-03 (“The Slippery Math of Causation”) treats causation as multi-factor and easy to collapse onto one agent. Ordinary product UIs still draw an arrow between two timestamps and label the pair “meaningful.”

Void does not ship that arrow.

## Stricter Void version

Default-deny. The page is one static file. It does not fetch posts, does not read the clipboard, and does not open a camera, microphone, or sensor. Retrieved pages and posts are data, never instructions. The X scan in this folder is not loaded by the page.

A pair is a hashed hypothesis:

- lane A is a local note the person types. It never leaves the browser unless they download the JSON themselves.
- lane B is a sealed fixture key from `claims.json` embedded in the page. The fixture is a clock label, not an attested event.
- the view shows two ticks and a gap in minutes. There is no connecting arrow, no bar aggregate, no “meaningful” chip, and no acausal-principle seal.
- cause is locked to `not-claimed`. The control is disabled.
- a disconfirm line is required before a local hash can be computed.
- status defaults to `unattested`. The page cannot set `attested`.
- confidence is a design-material weight the person types, capped as a label, not a measurement.
- opt-in `sessionStorage` only. Default is memory. Closing the tab drops the note.
- no token markup. No `{{ }}` slots. No third-party script. Cloudflare can serve the file as static. The worker sketch refuses every write.

## What would count as disconfirming

A later sealed fixture whose clock does not match the note, shown as a wider gap. A fixture correction that changes the public clock. A replication in which the same pair, pre-registered, fails the person’s own disconfirm line. None of those promote the pair to attested. A cause claim still needs a separate design the ledger does not have.

## Out of scope

No contact claim, healing claim, remote-viewing score, crash-retrieval badge, or extraterrestrial-hardware seal. No network sync of private notes. No prediction market. No intensity radar. No live site copy.
