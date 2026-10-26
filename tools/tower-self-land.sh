#!/bin/sh
# Lands a tower-self decision on main (.github/workflows/tower-self.yml): from the newest main, write the rows, pages, offline list, features and state
# (tools/tower-self.mjs apply), the pages' search blocks (tools/seo-pages.mjs), run the checks that cover them, and push only the loop's own paths.
# A build that fails a check is discarded (its sites recorded as "discarded" with the failing check) and only the state is pushed. Retries a push
# that lost a race with another builder from the newest main. Writes pushed=yes|no and built=yes|no to GITHUB_OUTPUT.
#   sh tools/tower-self-land.sh decision.json "commit message"
DEC="$1"; MSG="$2"; OUT="${GITHUB_OUTPUT:-/dev/null}"
built=$(node -e "const d=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log((d.rows||[]).length)" "$DEC")
checks() {
  node --test tools/tower-self.test.mjs tools/lane-pages.test.mjs tools/tower.test.mjs tools/tool-sites.test.mjs tools/toolkit.test.mjs tools/seo.test.mjs tools/calendar.test.mjs tools/generators.test.mjs tools/floor-kit.test.mjs >"$RUNNER_TEMP/checks.log" 2>&1 || { echo "tests"; return 1; }
  node tools/refresh.mjs --check --only seo >>"$RUNNER_TEMP/checks.log" 2>&1 || { echo "the search blocks"; return 1; }
  node tools/secret-scan.mjs --base origin/main >>"$RUNNER_TEMP/checks.log" 2>&1 || { echo "the secret scan"; return 1; }
  return 0
}
for i in 1 2 3 4 5; do
  git fetch -q origin main && git reset -q --hard origin/main
  node tools/tower-self.mjs apply "$DEC" || exit 1
  node tools/seo-pages.mjs >/dev/null; node tools/sitemap.mjs >/dev/null
  if [ "$built" -gt 0 ]; then
    why=$(checks) || {
      echo "::warning::the build failed $why: discarded"; tail -40 "$RUNNER_TEMP/checks.log"
      git reset -q --hard origin/main; node tools/tower-self.mjs discard "$DEC" "failed $why"; node tools/tower-self.mjs apply "$DEC"; built=0
    }
  fi
  pages=$(node tools/tower-self.mjs paths)
  git add void-live-deploy/lib/self-sites.js void-live-deploy/sw.js void-live-deploy/llms.txt void-live-deploy/sitemap.xml domains/tower-self.json domains/features $pages
  stray=$(git status --porcelain --untracked-files=no | grep -v '^[AM] ' || true)
  [ -n "$stray" ] && { echo "::warning::left out (not the loop's to change):"; echo "$stray"; }
  if git diff --cached --quiet; then echo "nothing to land"; echo "pushed=no" >>"$OUT"; echo "built=no" >>"$OUT"; exit 0; fi
  git commit -q -m "$MSG"
  if git push -q origin HEAD:main; then echo "pushed=yes" >>"$OUT"; [ "$built" -gt 0 ] && echo "built=yes" >>"$OUT" || echo "built=no" >>"$OUT"; exit 0; fi
  sleep $((i * 5))
done
echo "::error::not pushed after 5 tries"; exit 1
