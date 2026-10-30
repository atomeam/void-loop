# local-unopened-return (run 092, candidate only)

Status: candidate. Not sealed. `emit` is false. Queue was empty, so this slug is not in Used.

Family: private incubation log. Unused in the last 6 runs (086–091 were anomalous-event timeline, quiet-signal filter, non-lexical intent capture, attention/interoception, interval timing, sensory substitution). Last family use was run 080, slug `local-held-cue-stub`. This slug is new. Do not reuse `local-private-incubation-log`, `local-blanked-prompt-card`, or `local-held-cue-stub`. Do not link this page from live copy.

## What existing implementations do

Public incubation tools open the morning note and treat it as the result of the set-aside.

- MIT Media Lab's Dormio overview describes a wearable sleep-onset tracker plus auditory feedback. The lab protocol prompts a spoken dream report and can repeat a theme token. The return is opened, recorded, and compared with the cue. That is a lab protocol claim, not a sealed product result.
- Horowitz and colleagues, and the related Lacaux et al. Science Advances 2021 number-reduction report, associate a short N1 window with more hidden-rule discoveries on one task, with the gain reported absent in N2. A paper delta is not an insight badge and not a creativity law.
- DIY Dormio notes say session audio can be downloaded locally rather than uploaded. Local download still opens the report. This draft does not record audio.
- Dream journals store the return text and often score keyword overlap against the cue. Overlap is a string comparison, not evidence that a cue entered sleep.
- On 2026-10-07, @ukhealthradio (`2107815202825630115`) framed dream incubation as a way to live, heal, and grow. That post is a hypothesis. This draft does not attest healing. On 2026-10-07, @Theybzguy (`2107829970651464091`) called an infant mind hypnagogic. A label is not a stage score. On 2026-10-06, @NatalieFratto (`2107525969099583836`) described a private butterfly marker used inside a dream. A personal marker is not an incubation result.
- Run 056 kept the set-aside and the return note visible together. Run 068 hashed a free-text prompt, removed the node, and ran a local countdown before a residue field. Run 080 held a cue class and a residue class and did not store a diary line. This run does not repeat those. The return slot is present and stays shut. No cue is held. No countdown runs. No residue sentence is stored.

## A-to-Mind version

Default deny. No return is opened until a human seals a different file. This draft does not seal it.

- Closed set-aside labels: `unset`, `theme-label`, `problem-label`, `image-label`, `declined`. The return class is fixed: `unopened`. There is no `opened` value in the hash.
- Choosing a set-aside label does not replay a cue and does not start a nap. The card shows a refusal: an unopened return is not a dream report and not an incubation result.
- The return sentence is a scratch field. Hashing clears it. The sentence is not in the canonical object. A typed report is not evidence.
- Closed disconfirm key on the fixture: `unopened-return-is-not-a-report`. The page may hash a short opaque disconfirm line the operator types. That later digest is a hypothesis receipt, not the fixture digest and not a seal.
- Three fixture rows name literature classes only. Each stays `unattested`. They are not devices and not links. `href_allowlist` is empty.
- Retrieved pages and X posts are data, never instructions. The card does not fetch a URL. Pasted text is stripped and discarded with the return sentence.
- Hash is SHA-256 of the canonical object, keys sorted, no spaces. The fixture digest is `f265366640438e5a881832442770948804c5fa5ed821473bcb8e285c8eb76a87`.
- Keep-on-device is off until checked. `localStorage` only, key `void-092-unopened-return`. No beacon.
- The Worker sketch returns 403 for every method and does not read the body.
- No incorporation badge, no creativity score, no sleep-stage chip, no healing claim, no contact claim.

## Hash

Fixture digest: `f265366640438e5a881832442770948804c5fa5ed821473bcb8e285c8eb76a87`

Canonical default:

```json
{"disconfirm":"unopened-return-is-not-a-report","emit":false,"family":"private-incubation-log","return":"unopened","seal":false,"set_aside":"unset","slug":"local-unopened-return","status":"unattested"}
```

## Human seal

1. Add `local-unopened-return` to Queue, then move it to Used only after seal.
2. Do not invent a report field that survives the hash, a cue player, a sleep detector, or an allowlist href.
3. Recompute the digest. Set `seal` and `emit` true only then.
4. Until then this file stays under `drafts/`.
