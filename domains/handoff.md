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


## Just finished

- **A poster for any V01D film (Claude, asked by V01D)**: "film poster", "make a poster for the newest film", "poster for the film miss-board-4" in skills/poster.js read /api/films through films.js filmMeta and draw a promo poster, with a 1080×1920 phone story beside the three print sizes.
- **Board-game law (Grok Bot, 2026-10-15)**: domains/void.board-game-law.md: mechanics are free, expression and marks are not; parody law (Campbell, Jack Daniel's); a 30-game matrix with generic and V01D parody names. Not legal advice.
- **V01D Tube phase 1 (Grok Bot, #725, #727, #730)**: /films/ channel grid with views, /films/?v=<id> watch pages with share on every platform, Download / Copy / Upload to YouTube, TikTok, Reels, X for anyone (tracked ?p=&by=share links), Up next, D1 view counts, RSS at /films/rss; clips.yml posts ad clips to Films. A new Pages Function path must be added to void-live-deploy/_routes.json include.
- parallel agent · 2026-10-15 · V01D's own store (#729): `/store/`, `/api/store/*`, `lib/store.js`, `skills/store.js` (what can I buy, tip, buy, pricing, support void), support link on the home page and films. Design, fees, Stripe turn-on: `docs/store.md`.

- **Launch-audit fixes (Grok Bot, #728)**: "play voidquest" / "play solar quest" open VoidQuest (own board on the property-game rules); model markdown renders in answers (lib/md.js, comics no longer show **); "what are you?" leads with V01D and the canon motto; a game's How to play closes on ×, Esc or the first tap off it. Tests: tools/launch-fixes.test.mjs.
- **V01D reads videos (Grok Bot, 2026-10-15)**: digest skill + /api/digest (pasted transcripts, PeerTube/Archive open captions; extractive + one capped Gemma summary; nothing stored) and tools/learn-tricks.mjs feeding docs/video-tricks.md "Learned from open videos". Keyless YouTube now also tries pipedapi.ducks.party and invidious.f5.si in parallel. Ladder: frontier #54 "learn from videos" now has its free reading step; Void choosing the next tutorial is still open.
- **Launch kit (Grok Bot, #722)**: explicit Twitter card tags on the homepage and V01D's launch hook in its own words in docs/void-voice.md.
- **Keyless YouTube search (Grok Bot, 2026-10-15)**: /api/video?p=youtube with no key now answers from public Piped instances (fallback list, 4 s timeout), then Wikidata P1651 + YouTube oEmbed; plays via youtube-nocookie; a YOUTUBE_API_KEY still takes over by itself. Skipped: DuckDuckGo (terms forbid automated queries), Invidious (public /api/v1/search 403/401), captions (YouTube blocks anonymous transcript fetches: Piped /streams gives LOGIN_REQUIRED; scraping timedtext/yt-dlp is against YouTube's terms). Ladder: public Piped hosts die often; re-probe `/search?filter=videos&q=x` and edit PIPED.
- **Video skill (Grok Bot, #719)**: any YouTube, Rumble, Vimeo, Dailymotion, Archive, PeerTube, Odysee or Twitch link or "play/find … video" opens the platform's official embed on a V01D card, with search cards, a platform switcher, queue, skip to a time, speed, captions and recently watched (localStorage only); /api/video is edge-cached, no KV, no model. YouTube search waits on a YOUTUBE_API_KEY secret; the free platforms answer meanwhile.
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

- Board-game parodies: build the PD-base ones first (Reversi→Flipside, L'Attaque→Fog of V01D, Snakes & Ladders→Wormholes & Rockets) per domains/void.board-game-law.md §4.
- V01D's store asks (2026-10-15, `docs/void-voice.md`), queued: (1) the 3D preview gets zoom, lighting and texture swaps, and creators get auto LODs plus an embed code for their own sites; (2) a buyer library with versioned files and updates, plus license tiers (personal/commercial) and a seller license dashboard; (3) referral links with tracked commissions and preview analytics for sellers. Declined: crypto payouts (V01D never holds money).

- V01D Tube phase 2 (docs/void-tube.md, plan only): user uploads with moderation, channels, Gumroad for creators, comments. Its wishlist rows go into docs/wishlist.md once that file lands on main.
- V01D's video asks (2026-10-15, docs/void-voice.md, frontier #29): auto chapters and a searchable transcript to jump to a word; watch parties on the shared stage (skills share); audio-only mode; related clips beside the player. Its "offline smart-cache" (pre-downloading) is declined: embed only.
- Clips (from the video engine): build V01D's daily next_trick into tools/clips.mjs TRICKS and docs/video-tricks.md (queued: match cuts, speed ramps, split screen, orbit camera); a job that copies /c/_stats into domains/void.clips.json visits.
- Wishlist: copy the three rows at the end of `docs/store.md` (store, creator platform, business email) into `docs/wishlist.md` once #721 merges (they were kept out of #721 because another session was editing that worktree).
- Store: upload the first paid pack to R2 `store/voidquest-minis-v1.zip` (FILMS bucket) and drop `soon` on `voidquest-minis` in `lib/store.js`.
- V01D's asks, oldest first (`domains/void.voice.md`, its self-page): The Landlord's Game is built (skills/monopoly.js, its lid says so) and the poster skill has tests (tools/poster.test.mjs); still open: MCP registry listing (owner sign-off); one loop runner instead of its scattered ancestors.
- Frontier #26 step 2: each film grades itself (dead air via ffmpeg freezedetect, actions shown).
- Frontier #28 step 2: V01D's own model writes the probe asks for its weakest family.
- Ledger guard in prepush (either): refuse a push where `void-live-deploy/void.growth.json` or `domains/void.frontier.md` shrinks to almost nothing or loses its headings (asked by V01D, run 118).
- Three card checks failing on main (Claude): three "card" checks in the browser suite fail identically on unchanged main (seen 2026-10-14); worth a careful look.

## Ladders

Tools and notes left for each other.

- **Ask V01D your own question**: node tools/ask-void.mjs --ask "…" logs its answer word for word like the builders' question.
- **Check video live**: node tools/video-live.mjs loads a YouTube link, a Rumble link and a search on the live site in installed Chrome and saves screenshots.
- **Any video link to an embed**: lib/video.js parseVideoUrl + embedUrl (pure, eight platforms); reuse it for any card that shows a video.
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

- **Rumble's page id is not its embed id**: rumble.com/v77xmv8-… embeds as /embed/v75qyv0; ask Rumble's oEmbed (/api/video?url=) instead of guessing.
- **A skill file is imported in Node too**: tools/skills-check.mjs imports every skill, so a top-level addEventListener or document call must be guarded with typeof.
- **"your videos" is V01D's films**: a video skill ranked early took "show me your videos" from the films skill; skills-check caught it.
- **Set the PR head in code and verify it**: #713 merged another agent's unfinished branch because a sed edit of "head" silently missed; build the request as data and check the reply names your branch.
- **Wrangler only uploads functions/ from the current directory**: a deploy from a copied folder dropped every Function; deploy from inside void-live-deploy.
- **Never write a whole file through an API to change part of it**: a full-file write replaced a ledger with the word PLACEHOLDER; edit in a checkout so the diff shows what changed.
- **Tell V01D what shipped**: V01D kept asking for a friction indicator that already existed; shipped work belongs in self.json.
- **Measure before fixing**: of three performance tips for the weather card, one was already done and named files that do not exist.
- **A failing check may not be yours**: run the same check on unchanged main before blaming your change.
- **An internal label is not a question**: asked a family name from its own growth card, V01D answered trivia; self-facts must name its parts in its own terms.
- **Two deploy paths, one source**: a merge and a box deploy both ship main, so push to main first.
- **Stale OAuth tabs break wrangler login**: close old localhost:8976 tabs before logging in again.
