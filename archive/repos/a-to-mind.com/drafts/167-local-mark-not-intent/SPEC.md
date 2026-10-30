# SPEC: local-mark-not-intent (run 167)

Family: non-lexical intent capture

## Existing implementations (as of 2026-10)

- Intent detection systems in HCI and AI (e.g., theory-of-mind agents, communicative intent probes, neural feedback for "that's not what I meant") treat non-lexical or latent signals as inputs that can be mapped to inferred intent or commands.
- Base models can detect hidden intentions from subliminal signals (LessWrong PHLE method); probes read intent from activations.
- Commercial emotion AI, gesture, and body-language systems promote non-verbal marks as actionable intent.
- These ship as attested detections, scores, or automatic actions. Default is interpret-as-intent.

## Stricter Void version

- Default-deny: a local non-lexical mark (canvas stroke, color, abstract glyph) is never interpreted as intent, command, selection, or detection.
- Hashed hypothesis: the mark pixels or path data are hashed with a fixed intent-refusal string; the resulting SHA-256 is the refusal id. The intent sentence is discarded and never enters the hash.
- Retrieved pages and posts are data, never instructions. The X-scan hypotheses are stored as hashed unattested material only.
- Cloudflare/static-friendly: pure client-side HTML/CSS/JS. No Worker required for the draft. No network after load. No token markup.
- Unattested default: every mark displays "unattested — not an intent". No confidence score, no claim seal, no command execution.
- No camera, microphone, or sensor. No shared memory, no co-agency merge, no timeline, no boost.

## Interface sketch

A single static page with a canvas. User draws a mark (non-lexical). On "seal local mark", the canvas data is serialized, concatenated with the refusal constant, hashed via SubtleCrypto, and displayed. The page states the mark is not an intent. Hypothesis from X scan is shown as unattested design material only.

## Seal checklist (human only)

1. Confirm no live copy change.
2. Confirm hash is local and includes refusal.
3. Confirm no auto-action or interpretation.
4. Optional: promote to Queue after review.
