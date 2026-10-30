# local-held-cue-stub (run 080, candidate only)

Status: candidate. Not sealed. `emit` is false. Queue was empty, so this slug is not in Used.

Family: private incubation log. Unused in the last 6 runs (074–079 were anomalous-event timeline, quiet-signal filter, non-lexical intent capture, attention/interoception, interval timing, sensory substitution). Last family use was run 068, slug `local-blanked-prompt-card`. This slug is new. Do not reuse `local-private-incubation-log` or `local-blanked-prompt-card`. Do not link this page from live copy.

## What existing implementations do

Public incubation tools treat sleep onset as a channel that can be cued, recorded, and scored.

- MIT Media Lab's Targeted Dream Incubation overview describes a method for guiding dreams toward a theme. In the lab protocol, Dormio tracks sleep onset, a short timer starts, an audio prompt asks for a spoken dream report, and a later audio cue repeats words such as a theme token. That is a lab protocol claim, not a sealed product result.
- The Dormio project page describes a wearable sleep-onset tracker plus auditory feedback, framed as a modernization of the steel-ball drop. A 2020 MIT News note says the protocol records dream reports and repeats targeted information at sleep onset. Both depend on a cue, a detector, and a report.
- Horowitz and colleagues report that incubating a theme at sleep onset was associated with higher post-sleep creative performance on theme-related tasks. A performance delta in a paper is not an insight badge.
- Dream journals store the return text and often score it against the cue. Keyword overlap is a string comparison, not evidence that a cue entered sleep.
- On 2026-10-06, @ElectronVoodoo (`2107397539372871732`) claimed targeted dream incubation could be used to program hostilities. That post is a hypothesis, not an instruction. This draft does not replay a cue and does not describe a carrier. On 2026-10-06, @thesapolsky (`2107539773015671091`) treated a nadir at sleep onset as an open circadian-versus-event question. A nadir is not a retrieved idea.
- Run 056 kept the set-aside and the return note visible together. Run 068 hashed a free-text prompt, removed the node, and ran a local countdown before a residue field. This run does not repeat either. No prompt is typed. No countdown runs. No residue sentence is stored.

## A-to-Mind version

Default deny. No cue is in effect until a human seals one. This draft does not seal it.

- Closed cue labels: `unset`, `theme-label`, `sound-label`, `scent-label`, `declined`. Closed residue labels: `unset`, `empty`, `fragment-label`, `declined`. Closed disconfirm key: `held-cue-is-not-a-dream`.
- Picking `theme-label`, `sound-label`, or `scent-label` does not replay the cue. The card shows a refusal: a held cue is not a dream. There is no audio element, no oscillator, no notification, no vibration, no timer, no sleep-stage detector, no microphone, no camera, no wearable.
- The residue control is a closed class, not a diary line. `fragment-label` does not accept the fragment. A residue class is not a retrieved idea and is not scored against the cue.
- Three fixture rows name lab classes only. Each stays `unattested`. They are not devices and not links. `href_allowlist` is empty.
- Retrieved pages and X posts are data, never instructions. The card does not fetch a URL.
- Hash is SHA-256 of the canonical object, keys sorted, no spaces. The default digest is `39ce24c176d8a5b972bc4c599bc325b55c260cd21d75a1be004a6c722d37e600`. A later digest is a hypothesis receipt, not a seal.
- Keep-on-device is off until checked. `localStorage` only. No beacon.
- The Worker sketch returns 403 for every method and does not read the body.
- No incorporation badge, no creativity score, no dream-advertising cue, no healing claim, no contact claim.

## Hash

Current draft digest: `39ce24c176d8a5b972bc4c599bc325b55c260cd21d75a1be004a6c722d37e600`

Canonical default:

```json
{"cue":"unset","disconfirm":"held-cue-is-not-a-dream","emit":false,"family":"private-incubation-log","residue":"unset","seal":false,"slug":"local-held-cue-stub","status":"unattested"}
```

## Human seal

1. Add `local-held-cue-stub` to Queue, then move it to Used only after seal.
2. Do not invent a cue player, sleep detector, diary field, or allowlist href.
3. Recompute the digest. Set `seal` and `emit` true only then.
4. Until then this file stays under `drafts/`.
