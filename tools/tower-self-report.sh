#!/bin/sh
# The report of a tower-self run (.github/workflows/tower-self.yml): the run's line (domains/tower-self.json, written by tools/tower-self.mjs judge)
# appended to the agent log and the growth ledger by Verse, then the verdicts, fixes, state and lines pushed with the workflow's token, retried from
# the newest main when another push won the race (the append-only files are re-appended, never merged by hand).
LINE=$(node -e "const s=JSON.parse(require('fs').readFileSync('domains/tower-self.json','utf8'));const r=(s.runs||[]).slice(-1)[0];console.log(r?r.line:'')")
[ -n "$LINE" ] || { echo "no report line"; exit 0; }
git config user.name "github-actions[bot]"; git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
mkdir -p "$RUNNER_TEMP/rep"; cp domains/tower-self.json void-live-deploy/tower.evidence.json void-live-deploy/sw.js "$RUNNER_TEMP/rep/"
pages=$(node tools/tower-self.mjs paths); for p in $pages; do mkdir -p "$RUNNER_TEMP/rep/$p"; cp "$p/index.html" "$RUNNER_TEMP/rep/$p/" 2>/dev/null; done
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
for i in 1 2 3 4 5; do
  if [ "$i" -gt 1 ]; then
    git fetch -q origin main && git reset -q --hard origin/main
    cp "$RUNNER_TEMP/rep/tower-self.json" domains/; cp "$RUNNER_TEMP/rep/sw.js" void-live-deploy/
    node tools/gate-land.mjs put "$RUNNER_TEMP/mine.json" 2>/dev/null || true
    for p in $pages; do cp "$RUNNER_TEMP/rep/$p/index.html" "$p/" 2>/dev/null; done
  fi
  printf '%s | verse | build | %s\n' "$TS" "$LINE" >> domains/void.agents.log.md
  node tools/grow.mjs build "$LINE" --by verse >/dev/null || true
  git add domains/tower-self.json domains/void.agents.log.md void-live-deploy/void.growth.json void-live-deploy/tower.evidence.json void-live-deploy/sw.js $pages
  git add void-live-deploy/tower.shots void-live-deploy/tower.icons 2>/dev/null || true
  git diff --cached --quiet && { echo "nothing to report"; exit 0; }
  git commit -q -m "Tower gate: Versus by itself, $LINE" && git push -q origin HEAD:main && { echo "$LINE"; exit 0; }
  sleep $((i * 5))
done
echo "::error::the report was not pushed"; exit 1
