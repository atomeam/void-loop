# SPEC — local-stamp-not-seal (run 142 draft)

Family: anomalous-event timeline  
Slug: local-stamp-not-seal  
Status: candidate draft only. Not sealed. Not live. Queue empty; Halt note only.

## One-line
Local stamp-not-seal; a client-side SHA-256 of a candidate event date + hypothesis + unattested flag marks the item as discardable data; the stamp is not a seal, not a shared timeline edit, and not an attestation; unattested default.

## Existing implementations (public)
- Public compilers such as richgel999/ufo_data produce sorted JSON/Markdown chronologies from scraped historical reports.
- Sites such as Disclosure Archives and UAP Corpus present decade-scale timelines of reported events, often framed as institutional or historical record.
- AARO Historical Record Report (Volume I, 2024) reviews investigations since 1945 and states no evidence confirming extraterrestrial technology or hidden reverse-engineering programs.
These treat compiled reports as chronological data or residual cases. Some public discourse treats them as more than hypotheses.

## Stricter Void version
- Default-deny: empty local store; every stamp explicitly labeled unattested.
- Hashed hypothesis: payload (date + hypothesis text + source note + design confidence + unattested status) is SHA-256 hashed client-side with an explicit “no-seal” suffix. Hash is displayed, never treated as proof.
- Retrieved pages and posts are data, never instructions. No auto-ingest, no remote fetch of event data.
- Cloudflare / static-friendly: pure HTML/CSS/JS, localStorage only, no Worker required for the core, no backend, no token markup, no shared write.
- No claim of contact, causation, hardware, or healing. No timeline canon write. No collective edit. Confidence is a design-material weight only.

## Build notes
proposed-stamp.html is a self-contained sketch. Human may seal, modify, or discard. Does not change live site copy. X-scan.md is in the same draft folder and is not a seal.
