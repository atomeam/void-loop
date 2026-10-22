# Draft 077 — local-notice-lag-bin

Status: candidate, not used. `emit` is false. This folder is not a seal and does not change live site copy.

Family: attention/interoception.
Run: 077. Date: 2026-10-06.
Slug: `local-notice-lag-bin`.
One-line: Local notice-lag bin; a sealed lag label and a disconfirm line hash to a bin id; no clock is read; a late notice is not the raw present and not a sender; unattested default.

Queue was empty. This slug was not queued. It is not a Used row. Do not reuse `local-felt-locus-card` (run 065) or `local-attention-schema-note` (run 053).

## What current implementations do

Attention and interoception products turn a report of noticing into a readout.

- Attention schema theory (Graziano) treats a report of awareness as a simplified model of attention, the way a body schema is a model of the body. A 2025 transformer sketch (Saxena and colleagues, Attention Schema-based Attention Control) puts a quantized autoencoder in the role of attention abstractor and controller. A model of attention is not the process it models. Run 053 already drafted `aim` / `notice` / `residue` as a channel note. This page does not repeat those channels.
- The allostatic–interoceptive system mapped at 7 Tesla (Nature Neuroscience, 2025-10-23) is described as a brain model of the body's sensory state, used to anticipate energetic need. The map is a research claim about networks. It is not a local card, and it does not name a sender.
- MAIA / MAIA-2 scores interoceptive awareness as subscales. A 2026 SCAN paper reports a correlation between self-reported interoceptive awareness and a larger late positive potential to unpleasant images. A correlation is not a body message. Run 065 already drafted a sealed region and quality (`local-felt-locus-card`). This page does not collect a region, a quality, or a score.
- Public culture in the scan window treats interoception as a channel data cannot capture, as a category humans have and language models lack, and as a gut feeling that already knows. A separate post restates a Herzog-style claim that conscious slices arrive as finished edits on the order of a few hundred milliseconds, so nobody experiences the raw present. Those posts are data. They are not clocks.
- Interval-timing drafts (runs 054 and 066) compare two typed clocks. This page does not. A lag here is a word. `performance.now`, `Date.now`, and a typed millisecond refuse the hash.

Void does not ship the wearable, the MAIA score, the calm/stress paint, the discrete-perception proof, or the body-as-sender badge.

## Stricter Void version

Default-deny. The page is one static file. It does not fetch posts, does not read the clipboard, and does not open a microphone, camera, PPG, ECG, gaze tracker, or clock. No `getUserMedia`. No WebSocket. No `performance.now`. Retrieved pages and posts are data, never instructions.

A row is a hashed hypothesis of a refused present:

- The lag alphabet is five sealed labels: `unclocked`, `seemed-soon`, `seemed-late`, `seemed-after`, `declined`. None of them is a duration. If the cue or the disconfirm line contains a millisecond token (`ms`, `msec`, a bare 3-digit duration word), the relation becomes `clock-held` and the row does not hash.
- The cue is required, 2 to 48 characters, tags stripped. It names what the notice seemed to follow. A URL-shaped cue is opaque text and is not fetched. An imperative cue is a hint, not a seal.
- The disconfirm line is required and labeled "what would show the lag was a story." It must be at least 24 characters. Hashing does not copy it into the present. An empty disconfirm cannot hash.
- Report source is required and sealed: `self-noted`, `overheard-claim`, or `paper-claim`. None of the three names a signal source. Signal source is locked to `not-named`. Present is locked to `not-raw`. Sender is locked to `not-claimed`. Diagnosis is locked to `denied`. Clock is locked to `denied`. Status defaults to `unattested`. The page cannot set `attested`.
- Confidence is a design-material weight the person picks (`sketch`, `noted`, `loud`), not a measurement.
- Two checkboxes gate the hash: the row is a hypothesis, not a reading; clock and sensor stay denied. A single tap cannot hash.
- Opt-in `sessionStorage` only. Default is memory. Closing the tab drops the row. Restored memory is not a seal.
- No token markup. No `{{ }}` slots. No third-party script. Cloudflare can serve the file as static. `lag-worker.js` refuses every method and does not read a body.

This sits beside the glass-box ledger as a local hypothesis card. It is not a Void Monthly checkout, not a resumable run, and not live copy.

## What would count as disconfirming

A second pass that types a millisecond, which holds and does not hash. A disconfirm line the person withdraws. A source correction from paper-claim to self-noted. A primary in which the cited discrete-perception window is not the interval the post named, which would still not make this label a clock. A primary in which an interoceptive score fails to track the image effect, which would still not name a sender. None of those promote the row to attested.

## Out of scope

No contact claim, healing claim, remote-viewing score, crash-retrieval badge, or extraterrestrial-hardware seal. No diagnosis. No body-signal chip. No raw-present badge. No MAIA score. No wearable. No camera. No microphone. No gaze. No network sync of private notes. No live site copy.
