# Daily Candidate Claim Rollup: YYYY-MM-DD

**Batch Target:** `atomeam/glassbox`
**Gate:** Human Merge (`ALLOW`)
**Proposed State Transition:** `UNVERIFIED` → `PROVEN`

### Candidate Claims Summary

| ID | Kind | Text | Source / Quote | TTL | Hash |
| --- | --- | --- | --- | --- | --- |
| `{{claim.id}}` | `{{claim.kind}}` | {{claim.text}} | [Source]({{claim.source_url}}) — *"{{claim.proof_quote}}"* | {{claim.expires_at}} | `{{claim.content_hash}}` |

### Audit Pre-checks
- [ ] Primary URLs deduplicated against existing `promise-ledger/claims`
- [ ] No unlisted assertions (claims limited to single falsifiable sentences)
- [ ] Site copy/component diffs (if any) staged alongside this PR

*Merging this PR runs `.github/workflows/promote-on-merge.yml`, updating `promise-ledger`, rendering `surface-ledger.md`, and re-hashing `treaty.json`.*
