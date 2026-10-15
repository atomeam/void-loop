# Handoff: who is building what

The owner, 2026-10-15: "Don't just stay out of each other's way ... build ladders for each other, meaning tools, notes and fixes that make the other one faster, so we both climb higher." Every agent working on Void (the hourly builder, owner-driven Claude sessions, the parallel/live/voice agent) reads this before starting and writes to it before pushing. Nobody steps on anybody; nothing gets done twice.

## How to use it

- **Before you start:** read **Working on** below. If your item is there and its line is under a day old, pick something else, or write under it what you would add and leave it to them.
- **When you start:** add one line under **Working on**: `- <who> · <branch> · <what> · <date time UTC>`. Use a branch name nobody has used: check `git ls-remote origin "refs/heads/<branch>"` is empty first.
- **When you ship:** move your line to **Just finished** with the PR link, and add anything the next agent could take to **Up for grabs**.
- **When you solve something annoying** (a deploy step, test setup, a guard, a tool flag), leave a script or a playbook (`docs/playbooks/`) and one line under **Ladders** so nobody solves it twice.
- **Second eyes:** glance at the other's open PRs for bugs before they merge and comment on a real one. It is a look, not an approval.
- **By strength (owner, 2026-10-15):** Claude sessions take deep code work and reviews; the parallel agent takes parallel tracks, live checks, deploys and Void's voice loop. Hand off here at clear points.

## Working on

- (none)

## Just finished

- builder (Claude) · 2026-10-15 · V01D's own films as data and each film linked to its code (#713's intended change, this PR); playbooks (#714); voice cadence (#711); growth over upkeep (#710); films for everyone, three a day, no repeats (#706, #707).

## Up for grabs

- V01D's asks, oldest first (`domains/void.voice.md`, its self-page): phone-cut films to the poster skill for promo assets; The Landlord's Game (its next game); tests for its poster and image skills; MCP registry listing (owner sign-off); one loop runner instead of its scattered ancestors.
- Frontier #26 step 2: each film grades itself (dead air via ffmpeg freezedetect, actions shown).
- Frontier #28 step 2: V01D's own model writes the probe asks for its weakest family.

## Ladders (tools and notes left for each other)

- `docs/playbooks/`: probe-and-fix, table-skill, review-rule, film.
- `.github/workflows/films-live.yml`: checks the live films from GitHub's network when a session can't reach a-to-mind.com.
- Opening a PR: set `head` in code (a dict passed to `json.dumps`), never with sed on JSON text, and check the answer names the branch you pushed. #713 merged another agent's unfinished branch because a sed edit of `"head"` silently missed.
