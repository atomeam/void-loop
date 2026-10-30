#!/usr/bin/env bash
# Ledger guard. Suggested-by: Void (run 118). Hardened 2026-10-15 after 758c7c1.
# Usage: check-ledger.sh [FILE] [PREVIOUS_FILE]
# Refuses a FEATURE_LEDGER.md that lost required sections, was blanked/truncated,
# or (given the previous version) dropped any '## ' heading or shrank by >10%.
set -euo pipefail
f="${1:-FEATURE_LEDGER.md}"; prev="${2:-}"
fail(){ echo "LEDGER GUARD FAILED: $1 ($f). Write the ledger with git on disk, append only; never full-file API writes." >&2; exit 1; }
[ -f "$f" ] || fail "file missing"
grep -q '^## Rules for every future run' "$f" || fail "missing '## Rules for every future run'"
grep -q '^## Used' "$f" || fail "missing '## Used'"
grep -q '^## Queue' "$f" || fail "missing '## Queue'"
grep -q '^## Halt (run ' "$f" || fail "missing any '## Halt (run N)'"
grep -qxE 'PLACEHOLDER|SEE_DISK' "$f" && fail "contains a bare placeholder"
grep -q '^## Halt (run 027)' "$f" || fail "oldest Halt note (run 027) is gone: history was truncated"
n=$(wc -l < "$f"); [ "$n" -ge 300 ] || fail "only $n lines (looks truncated)"
b=$(wc -c < "$f"); [ "$b" -ge 60000 ] || fail "only $b bytes (looks truncated)"
h=$(grep -c '^## Halt (run ' "$f"); [ "$h" -ge 140 ] || fail "only $h Halt notes (looks truncated)"
if [ -n "$prev" ] && [ -s "$prev" ]; then
  lost=$(comm -23 <(grep '^## ' "$prev" | sort -u) <(grep '^## ' "$f" | sort -u) || true)
  [ -z "$lost" ] || fail "headings removed since previous version: $(echo "$lost" | head -3 | tr '\n' ';')"
  pb=$(wc -c < "$prev"); [ $((b * 10)) -ge $((pb * 9)) ] || fail "shrank from $pb to $b bytes"
fi
echo "ledger ok: $n lines, $b bytes, $h Halt notes"
