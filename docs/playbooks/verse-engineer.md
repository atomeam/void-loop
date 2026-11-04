# Verse's engineer

**Starts when:** a deploy finishes, or 07:17 UTC, or someone runs the Verse engineer workflow by hand.

**Commands:** `.github/workflows/verse-engineer.yml` runs `node tools/live-verify.mjs`, `node tools/pr-doctor.mjs` and `node tools/priority-pick.mjs`. The coder it calls is `node tools/verse-coder.mjs` on Workers AI, then the free-tier keys the free-resource router already lists (OpenRouter, Groq, Gemini, Cerebras) when they are set.

**It worked when:** a changed page in the deploy log is `ok 200`, the stuck pull request has a new commit from main and is still open, and `/progress/nightly.json` names a share and a next pick. `/scoreboard/` shows the same share for the last 14 days. The agent probe runs in that deploy job when its script is on the commit.

**Mistakes:** reading a whole large file (use region, then patch). Closing a pull request or skipping a check to make a list shorter. Counting every Actions bot pull as the loop (only `loop/`, `verse/`, `tower-self/` and the loop's own titles).
