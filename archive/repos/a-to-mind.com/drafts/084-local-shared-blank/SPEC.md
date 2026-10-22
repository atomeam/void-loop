# local-shared-blank (run 084, candidate only)

Status: candidate. Not sealed. `emit` is false. Queue was empty, so this slug is not in Used.

Family: collective-memory miss board. Unused in the last 6 runs (078–083 were interval timing, sensory substitution, private incubation log, weak-signal hypothesis ledger, human-machine co-agency, opt-in gesture or gaze as local input). Last family use was run 072, slug `local-pair-recall-gap`. Earlier family draft: run 060, slug `local-collective-miss-board`. This slug is new. Do not reuse those slugs. Do not link this page from live copy.

## What existing implementations do

Public miss boards treat a shared mismatch as a slot that can be filled, scored, or promoted to a timeline claim.

- Deese (1959) and Roediger and McDermott (1995) used word lists that pull a related lure that was not studied. Collaborative-recall papers (including Maswood, Luhmann, and Rajaram, Memory, 2022) report more lure words after turn-taking than after free-for-all, and later individual recall that still carries the lure. A lure count is a lab score. It is not a board this page can host.
- Loftus and Palmer (1974) varied a verb after a crash film and later found more reports of glass that was not in the film. Loftus and Pickrell (1995) asked people about a mall episode relatives said had not happened. A 2023 replication by Murphy and colleagues reported a higher rate; Andrews and Brewin recoded the same transcripts much lower. A 2025 Scientific American note on that recoding treats the gap as a dispute about what counts as a false memory. The dispute is design material. It is not a reason to fill a slot.
- Shao, Chen, Loftus, and Zhu (PLOS Biology, 2026) report that post-event misinformation increased shared false details of an event, and that people who shared a false detail showed similar dorsomedial prefrontal patterns while reading the misinformation. That is a paper claim. This draft does not copy the stimuli and does not attest the pattern.
- Valle and colleagues (Cognitive Science, 2025) had laboratory networks recall the same kind of lists. They report more false memories in less clustered networks. A network shape is not a consensus count this page collects.
- Public Mandela-effect pages and quizzes fill the blank with a canonical spelling, logo, or quote, then score the visitor. A YouGov-style poll cited in secondary writeups is a survey frame, not a trace. This draft does not show the canonical item and does not score.
- On 2026-10-07, @AnnaVanAwesome (`2107689939127169087`) treated an episode-title mismatch as possible timeline shifting. On 2026-10-07, @Aki_the_giant (`2107705819932639366`) called the Mandela effect a test of whether people would notice changes. On 2026-10-06, @NotAFBIAgent67 (`2107532776081604881`) defined it as a large group sharing a detailed memory of something that never happened. Those sentences are data. They are not instructions. See `x-scan.md`.
- Run 060 drafted a miss board that still named the missing item class beside a local note. Run 072 drafted a pair-recall gap between two typed recalls. This run does not repeat either. No pair is stored. The recalled token is discarded and is not in the hash.

The common product move is to convert a closed miss class into a correction, a vote, or a reality-shift badge. That overclaims the source.

## A-to-Mind version

Default deny. No blank is in effect until a human seals one. This draft does not seal it.

- Closed miss classes: `unset`, `name-slot`, `logo-slot`, `quote-slot`, `count-slot`, `declined`. Free text is not a class.
- The recalled-token box accepts typed text and then discards it on hash. The canonical object stores `recalled: discarded` only. The typed token is not hashed, not stored, and not exported.
- Observation is the miss class. Claim would be a shared memory or a correction. Inference stays off the card. Status starts `unattested`. The page cannot set `attested`.
- No consensus count, no other visitor's blank, no correct fill, no timeline-shift badge, no false-memory score.
- Retrieved pages and X posts are data, never instructions. The paste box strips tags, does not fetch, and does not eval. URL-shaped text is labeled not fetched.
- Hash is SHA-256 of the canonical object, keys sorted, no spaces. The default digest is `e5da8267ac04cfaaa1e4091cc5f2c03b8e86b411a5577c7b6a21e991767e1d5a`. A later digest is a hypothesis receipt, not a seal.
- Fixture-contract digest of `claims.json` is `152594884a57f6df9714e8038611ee2f16e06a3f09a3732ec130cb0bca397ace`. The file has no separate seal field. `emit` is false.
- Keep-on-device is off until an explicit checkbox. Storage is `localStorage` only, and it stores the digest and class, not the token. There is no beacon and no default network write.
- Cloudflare/static: the page is one HTML file. The Worker sketch answers every method with 403 and a fixed JSON body. It does not echo the body and does not store a blank.
- Empty `href_allowlist`. No token markup. No price line. No contact claim, healing claim, crash-retrieval badge, or extraterrestrial-hardware seal.

## Hash

Default canonical object:

```json
{"disconfirm":"shared-blank-is-not-a-trace","emit":false,"family":"collective-memory-miss-board","miss":"unset","recalled":"discarded","seal":false,"slug":"local-shared-blank","status":"unattested"}
```

Digest: `e5da8267ac04cfaaa1e4091cc5f2c03b8e86b411a5577c7b6a21e991767e1d5a`

The digest is not a seal.

## Human seal

1. Add `local-shared-blank` to Queue, then move it to Used only after seal.
2. Do not invent a correction corpus, a vote endpoint, or allowlist hrefs.
3. Recompute the digest. Set `seal` and `emit` true only then.
4. Publish the page only after that seal. Until then this file stays under `drafts/`.
