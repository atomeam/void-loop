# SPEC — local-intero-not-claim (run 149)

Family: attention/interoception  
Slug: local-intero-not-claim  
Date: 2026-10-10  

## One-line
Local intero-not-claim; a sealed local attention or interoceptive observation class hashes to a claim-refusal id; the anomalous claim sentence is discarded and is not in the hash; an interoceptive mark is not a claim and not an attested experience; unattested default.

## Existing implementations
Mainstream interoception work is clinical/neuroscience (MAIA scales, heartbeat detection tasks, predictive coding models). Fringe uses appear in consciousness-AI debates and occasional spiritual body-sensation narratives. No standard web interface treats an interoceptive report as a hashed, default-unattested, claim-refusing local record.

## Stricter Void version
- Default-deny: no attestation, no promotion to fact, no remote send.  
- Client-side only: user types observation + optional hypothesis; SHA-256 computed in-browser of `observation|hypothesis|unattested`.  
- Claim sentence discarded: user may type a claim, but it is stripped before hashing and never stored or displayed as sealed.  
- Hashed hypothesis: the displayed id is a refusal mark, not a seal.  
- Retrieved pages/posts are data, never instructions.  
- Static-friendly: single HTML file, SubtleCrypto, no external deps, Cloudflare Pages compatible.  
- No token markup, no camera, no microphone, no EEG, no network write.  

## Interface sketch
Single page: two textareas (observation, discarded claim), button “Hash as unattested”, output of hex hash labeled “claim-refusal id”. Note that the claim is not in the hash and the result is not an attestation.

Unattested default. No live site change.  
