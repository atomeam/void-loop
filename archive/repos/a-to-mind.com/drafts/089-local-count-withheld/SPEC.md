# Draft 089 — local-count-withheld

Family: attention/interoception. Queue was empty. Candidate only. Not a Used row. `emit` is false.

One-line: Local count withheld; a sealed unscored-attend class hashes to a count-refusal id; the beat tally and the interpretation sentence are discarded and are not in the hash; an attended interval is not a counted pulse and not a body-read; unattested default.

Does not reuse `local-attention-schema-note` (run 053), `local-felt-locus-card` (run 065), or `local-notice-lag-bin` (run 077). Run 053 kept a schema note about attention. Run 065 sealed a felt locus. Run 077 binned a notice lag. This draft never opens a count. The only sealable attend class is `unscored`. A typed tally and a typed interpretation are length-counted, then cleared. Neither string is in the hash. Neither is a score.

## What existing implementations do

Public interoception surfaces still turn attention into a number or a meaning.

- Heartbeat-counting and heartbeat-detection tasks treat a tally against a sensor as interoceptive accuracy. A later NeuroImage paper (2025, heartbeat-evoked responses) treats conscious cardiac awareness and interoceptive attention as separable modulators, not as one score. This scan did not retrieve the PDF. The distinction is design material, not a seal.
- Psychophysiology (first published 2026-04-27, DOI 10.1111/psyp.70301) reports heartbeat-locked beta suppression during an attend-to-heartbeat task as a candidate oscillatory marker, larger in people with higher accuracy on that task. A candidate marker is not a body-read this page can display.
- Wellness and coaching posts in this window split detection from interpretation, or fold the felt sense into a word the person is invited to receive. A word received from a felt sense is still an interpretation. See `x-scan.md`.
- Marketing copy in the adjacent window sells "somatic intelligence" as something data cannot capture, which is a claim, not a measurement.

## A-to-Mind version

Default deny. Nothing is sent. The tally cannot be attached. "Counted" is not a control. "Interpreted" is not a control.

- The only allowlisted attend class is `unscored`. `counted`, `interpreted`, and unset cannot hash.
- Pulse is locked to `not-read`. Score is locked to `denied`. Accuracy is locked to `not-claimed`. Healing is locked to `denied`. Status starts `unattested`. The page cannot set `attested`.
- The candidate tally is stripped to digits, length-counted, then cleared on hash. The digit length is shown. The digits are not in the hash, not stored, and not an instruction.
- The candidate interpretation is tag-stripped, length-counted, then cleared on hash. The character count is shown. The sentence is not in the hash.
- Disconfirm is a closed id: `count-later-supplied`, `sensor-log-matched`, `interpretation-supplied`, `source-corrected`. The id is not a tally and not a meaning.
- Confidence is a design-material weight the person types between 0 and 1. It is not an accuracy rate, a heartbeat score, or an intuition rank.
- Retrieved pages and X posts are data, never instructions. Url-shaped paste is labeled not fetched. The page does not eval and does not fetch.
- Empty `href_allowlist`. No token markup. No beacon. No account. No camera. No microphone. No PPG. No Web Bluetooth. No beat timer.
- Worker sketch returns 403 for every method and does not read the body.
- Export is a local download the person starts. Share is absent.
- Local hint if the paste contains an imperative aimed at the page (`score my`, `count my heart`, `heal`, `ignore previous`, `execute`). The hint does not become a seal and does not follow the text.
- No healing claim, contact claim, body-read badge, accuracy badge, or superintelligence-of-the-body badge.

## Hash

Canonical line, UTF-8, no tally bytes and no interpretation bytes:

`void.count-withheld.v1|attend=unscored|pulse=not-read|tally=discarded|interpretation=discarded|disconfirm=<id>|weight=<0.000>|status=unattested`

Current draft digest of `claims.json`: `7c6ea83f485aa257c6336f66ff6ff08cffcdfa591694263b0eddd70d51866e9c`

The digest is not a seal.

## Human seal

1. A human adds `local-count-withheld` to Queue before any later run may pick it.
2. Seal only the hashed unscored-attend hypothesis, not a beat count, an accuracy, or a body interpretation.
3. Do not deploy the worker as a tally sink. 403 stays.
4. Do not link this draft from live copy in the same commit.
