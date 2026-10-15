# Handoff: who is building what

The owner, 2026-10-15: "Don't just stay out of each other's way ... build ladders for each other, meaning tools, notes and fixes that make the other one faster, so we both climb higher." Every agent working on Void (the hourly builder, owner-driven Claude sessions, the parallel/live/voice agent) reads this before starting and writes to it before pushing. Nobody steps on anybody; nothing gets done twice. This is the one board (it absorbed `docs/TAGTEAM.md` on 2026-10-15). The other workers, the video player, the everything-app verticals (social, dating, crypto, delivery) and the video engine, log here too.

## How to use it

- **Before you start:** read **Working on** below. If your item is there and its line is under a day old, pick something else, or write under it what you would add and leave it to them.
- **When you start:** add one line under **Working on**: `- <who> · <branch> · <what> · <date time UTC>`. Use a branch name nobody has used: check `git ls-remote origin "refs/heads/<branch>"` is empty first.
- **When you ship:** move your line to **Just finished** with the PR link, and add anything the next agent could take to **Up for grabs**.
- **When you solve something annoying** (a deploy step, test setup, a guard, a tool flag), leave a script or a playbook (`docs/playbooks/`) and one line under **Ladders** so nobody solves it twice.
- **Second eyes:** glance at the other's open PRs for bugs before they merge and comment on a real one. It is a look, not an approval.
- **V01D reads it:** `tools/self-context.mjs` puts Just finished, Ladders and Lessons (trimmed) into self.json `builders`. Write those as one-line bullets `- **name**: line`, newest first. Nothing owner-only or private: the repo is public.
- **Sharing the tree:** `git pull --rebase` before every push; never force-push.
- **By strength (owner, 2026-10-15):** Claude sessions take deep code work and reviews; the parallel agent takes parallel tracks, live checks, deploys and Void's voice loop. Hand off here at clear points.

## Working on

- (none)

## Just finished

- **V01D ad engine (Grok Bot, video engine)**: tools/clips.mjs plans and renders 9:16 clips with 18 named tricks incl. explosion and UFO; clips.yml daily draft release; /c/<clip> tracked deep links; next_trick in the daily reflection. Docs: docs/video-engine.md, docs/video-tricks.md.
- **One board (Grok Bot, 2026-10-15)**: docs/TAGTEAM.md merged into this file; self.json builders, tests, STANDING and MAP now read domains/handoff.md, and V01D may only cite files that hold its builders' lessons.
- **V01D's films as data (Claude, #716)**: each film linked to its code; playbooks (#714); voice cadence (#711); growth over upkeep (#710); films for everyone, three a day, no repeats (#706, #707).
- **Builders' lessons in V01D's self-knowledge (Grok Bot)**: Just finished, Ladders and Lessons go into self.json; tools/ask-void.mjs logs V01D's answer word for word in docs/void-voice.md.
- **Playbooks for the builders' work (Claude, #714)**: docs/playbooks/ says how a table skill, a review rule, a probe-and-fix and a film are made, so V01D can follow them (frontier #28).
- **Weather card on phones (Grok Bot)**: no backdrop blur on touch screens and the hourly row scrolls at 320px; found by measuring at 320 and 360px first.
- **Unit converter, asked by V01D (Grok Bot)**: nine kinds of units, kept across a reload.
- **Friction indicator told to V01D (Grok Bot)**: shipped work now goes into self.json so V01D stops asking for what it has.
- **Code review rules (Claude)**: unchecked malloc, PHP magic-hash compares, on-line pull_request_target.

## Up for grabs

- Clips (from the video engine): build V01D's daily next_trick into tools/clips.mjs TRICKS and docs/video-tricks.md (queued: match cuts, speed ramps, split screen, orbit camera); a job that copies /c/_stats into domains/void.clips.json visits.
- V01D's asks, oldest first (`domains/void.voice.md`, its self-page): phone-cut films to the poster skill for promo assets; The Landlord's Game (its next game); tests for its poster and image skills; MCP registry listing (owner sign-off); one loop runner instead of its scattered ancestors.
- Frontier #26 step 2: each film grades itself (dead air via ffmpeg freezedetect, actions shown).
- Frontier #28 step 2: V01D's own model writes the probe asks for its weakest family.
- Ledger guard in prepush (either): refuse a push where `void-live-deploy/void.growth.json` or `domains/void.frontier.md` shrinks to almost nothing or loses its headings (asked by V01D, run 118).
- Three card checks failing on main (Claude): three "card" checks in the browser suite fail identically on unchanged main (seen 2026-10-14); worth a careful look.

## Ladders

Tools and notes left for each other.

- **Render one ad clip**: node tools/clips.mjs render --only <moment> --out dir (Chrome + ffmpeg on the box); plan prints the day.
- **Open a PR with its head set in code**: pass head in a dict to json.dumps (never sed on JSON text) and check GitHub's answer names the branch you pushed.
- **Deploy**: merge to main and .github/workflows/deploy.yml deploys; from the box, run node tools/self-context.mjs then wrangler pages deploy from inside void-live-deploy, look for "Uploading Functions bundle", check /tools.json serves JSON, revert self.json.
- **Fast checks**: TZ=UTC node tools/checks.mjs runs every unit test (date tests assume UTC); VOID_SKIP_BENCH=1 skips the long benchmark.
- **Playbooks**: docs/playbooks/ has probe-and-fix, table-skill, review-rule and film.
- **Films checked from GitHub**: .github/workflows/films-live.yml checks the live films when a session can't reach a-to-mind.com.
- **Headless browser that does not crash**: point VOID_TEST_BROWSER at a full installed Chrome, not chromium-headless-shell.
- **Worktree per job**: git worktree add --no-track -b box/<name> /workspace/void-wt-<name> origin/main, then symlink node_modules from the main clone.
- **Prepush check**: tools/prepush.mjs (or .githooks/pre-push) stops conflict markers, unparsable JS and broken JSON.
- **Parse guard**: node tools/guard-source.mjs tells in a second which script no longer parses after a merge.
- **See what V01D answers locally**: node tools/ask.mjs "ask" runs the page in headless Chrome and prints the card.
- **V01D's voice**: node tools/reflect.mjs prints V01D's current asks; node tools/ask-void.mjs asks live V01D what it learned from its builders and logs it.
- **Credit an ask**: node tools/grow.mjs --asked <ask-id> ties a growth-ledger entry to the V01D ask it answers.

## Lessons

- **Set the PR head in code and verify it**: #713 merged another agent's unfinished branch because a sed edit of "head" silently missed; build the request as data and check the reply names your branch.
- **Wrangler only uploads functions/ from the current directory**: a deploy from a copied folder dropped every Function; deploy from inside void-live-deploy.
- **Never write a whole file through an API to change part of it**: a full-file write replaced a ledger with the word PLACEHOLDER; edit in a checkout so the diff shows what changed.
- **Tell V01D what shipped**: V01D kept asking for a friction indicator that already existed; shipped work belongs in self.json.
- **Measure before fixing**: of three performance tips for the weather card, one was already done and named files that do not exist.
- **A failing check may not be yours**: run the same check on unchanged main before blaming your change.
- **An internal label is not a question**: asked a family name from its own growth card, V01D answered trivia; self-facts must name its parts in its own terms.
- **Two deploy paths, one source**: a merge and a box deploy both ship main, so push to main first.
- **Stale OAuth tabs break wrangler login**: close old localhost:8976 tabs before logging in again.
