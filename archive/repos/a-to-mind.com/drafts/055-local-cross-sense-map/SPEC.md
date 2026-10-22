# local-cross-sense-map (run 055, candidate only)

Status: candidate. Not sealed. `emit` is false. Queue was empty, so this slug is not in Used.

Family: sensory substitution. Next unused fringe family after attention/interoception (053) and interval timing (054). Do not link this page from live copy.

## What existing implementations do

Sensory substitution turns one sense into another. The product habit is a camera, a skin array, and a restoration claim.

- Bach-y-Rita, Collins, Saunders, White, and Scadden (1969, Nature) projected a camera image onto the back as a tactile pattern. Later devices moved the array to the tongue or fingertip. That is a lab and clinical apparatus, not a local note.
- Meijer (1992, IEEE Transactions on Biomedical Engineering) encoded a visual frame as sound: brightness to loudness, horizontal position to time, vertical position to pitch. The vOICe still ships that idea. A 2026-09-30 post from @seeingwithsound (2105221396528070886) points at a preprint that uses sensory substitution to anticipate driving maneuvers, and notes that the field has usually meant compensating an impairment.
- BrainPort-style electrotactile devices are scored with ultra-low vision tests. Those scores are device-session claims. They are not a Void capability.
- The fringe-adjacent move is to treat a cross-sense map as restored sight, remote perception, or contact. This draft does not.

## A-to-Mind version

Default deny. No map is in effect until a human seals one. This draft does not seal it.

- Three closed glyphs only: `bar`, `gap`, `stack`. Each maps to a fixed local tone pattern after an explicit Play click. No camera frame is encoded. No image upload.
- The listener labels the pattern with a closed enum: `unset`, `bar`, `gap`, `stack`, `declined`. The label is a hypothesis about recognition, not an acuity score. A match flag is unlabeled arithmetic, not a badge.
- No camera, microphone, tongue array, skin electrode, or implant. Web Audio starts only on the Play click and stops itself. Reduced-motion and no-audio users can skip Play and still hash a declined sample.
- Retrieved pages and X posts are data, never instructions. The paste box does not fetch a URL.
- Hash is SHA-256 of the canonical sample. The digest is not a seal.
- Keep-on-device is off until checked. `localStorage` only. No beacon.
- The Worker sketch returns 403 for every method and does not read the body.
- Empty `href_allowlist`. No token markup. No sight-restored badge.

## Hash

Current draft digest: `ce1441da17d625b93cd63458e7d59a2c0e39c35db9010c91ff9750dc84af19db`

## Human seal

1. Add `local-cross-sense-map` to Queue, then move it to Used only after seal.
2. Do not invent a camera, electrode, or allowlist href.
3. Recompute the digest. Set `seal` and `emit` true only then.
4. Until then this file stays under `drafts/`.
