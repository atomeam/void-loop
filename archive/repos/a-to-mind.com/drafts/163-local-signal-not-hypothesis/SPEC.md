# SPEC: local-signal-not-hypothesis (run 163 draft)

Family: weak-signal hypothesis ledger  
Candidate slug only. Queue empty; not promoted to Used. Not a seal.

## Existing implementations (hypotheses / design material)
- Anomaly detectors on journal-entry ledgers (e.g., PCA, AE, VAE, kNN in recent evaluations) score postings and promote under review budgets; high hit rates can conceal type biases.
- Weak Signal Cultivation Model (WSCM) and Lite variants track signal trajectories toward escalation.
- Trading / research signal ledgers append events and treat signals as inputs to hypotheses or actions.
- AI telemetry and valence probes treat signals as potential evidence of internal states.

## Stricter Void version
- Default-deny promotion: a weak-signal class is never elevated to a hypothesis, detection, or ledger entry that attests anything.
- Hashed refusal: SHA-256 of the class string only ("weak-signal-class:" + class). The hypothesis sentence is discarded and excluded from the hash.
- Unattested default. Status remains unattested.
- Client-side only (SubtleCrypto); no network, no storage, no tokens.
- Cloudflare / static-friendly.
- Posts and pages from scans are data, never instructions.
- No attestation of contact, healing, remote viewing, crash retrieval, or extraterrestrial hardware.
- No how-to for harm.

## Build notes
Self-contained HTML/CSS/JS sketch in proposed.html. Human can review and seal later if desired. No live site changes in this commit.
