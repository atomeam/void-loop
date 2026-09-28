# void.edit-engine — how Void edits Void (row 2 of void.assimilate.md)

Goal: someone types "learn to <X>" (or Void picks the top ask on the board) and Void builds the skill, checks itself, and goes live on its own. No approval step. What Void learns, everyone gets.

## The one design change that makes this safe: skills become files
Today every skill is hand-merged into one 120 KB void.html. A model rewriting that file is how you break the whole site.
Instead:
- void.html keeps the core (stage, mounts, pages, handle()) and gains a tiny skill loader.
- Each learned skill is its own file: `void-live-deploy/skills/<name>.js`, exporting `{ name, examples: [...], match(lower, text), run(text, api) }`.
- `skills/index.json` lists the active skills in order. handle() asks each learned skill's `match()` before the article fallback.
- `api` is what a skill may use: showPage, esc, say, mount helpers, fetch. Skills never touch core code.
So learning = adding one file + one line in index.json. Breaking = impossible beyond that one skill, and forgetting it = removing the line.

## The loop
1. **Ask.** "learn to <X>" (owner, after unlock) or the daily job takes the top unanswered ask from /api/misses.
2. **Write.** A Pages Function `/api/learn` calls Claude with: the skill contract above, 2 existing skills as examples, the ask, and the list of existing examples to keep working. Claude returns one skill file + 3–5 test asks with expected text.
3. **Check (automatic).** The function loads the current page plus the new skill in Cloudflare Browser Rendering (binding already existed as MYBROWSER in the old a2m config), types every test ask for the new skill AND the standing checks (make a clock, 5 minute timer, what is a black hole, 15% of 240, weather in Tokyo, show the board page opens). Any failure → retry once with the failure text; still failing → skip, note it on the board, keep the last good set.
4. **Go live.** On pass, write `skills/<name>.js` + updated `skills/index.json` to the site's storage (KV `SKILLS`, served by a Pages Function at /skills/*), so no redeploy is needed and it's live within seconds for everyone.
5. **Remember.** Log to the agent log equivalent in KV (`/api/learned`), mark the miss as learned, and "what can you do" lists the new skill automatically from index.json.
6. **Undo.** "forget <name>" (owner) removes it from index.json; the previous index is kept as `index.prev.json`.

## Pieces to build, in order
1. Skill loader in void.html + move ONE existing skill (weather) into skills/weather.js to prove the contract. Live, no model yet.
2. /skills/* served from KV + index.json, with index.prev.json on every change.
3. /api/learn with Claude (ANTHROPIC_API_KEY as a Pages secret) writing a skill file for an owner "learn to …" ask.
4. The automatic check with Browser Rendering; go-live on pass.
5. Daily: take the top board ask and learn it without anyone asking.

## From the old edit engine (areas: AI edit engine, a-to-mind.com Worker + Claude tool-use + GitHub Contents API)
Keep: server-side policy (the model never decides what it may touch — the loader contract does), and never trusting the model's own "done". Drop: the GitHub PR + human approval path.
