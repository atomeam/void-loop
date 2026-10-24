# Site by site: make Verse really better than one real site

**Starts when:** the owner names the next site, or the last one is done (owner, 2026-10-24: "lets go site by site with the tower"). The tower (`lib/tower.js`) is the order, easiest real site first; it is a way to think, not a scoreboard.

**Why it exists:** on 2026-10-23 floors were marked "beaten" because Verse answered the floor's ask at all. The owner: "this whole card is fake, its all pretend". A floor is beaten when a person who uses that site would rather use Verse, and nothing else.

1. **Read the real site, never a memory of it.** If it is open source, clone it (`isitchristmas/web` was: `git clone --depth 1 https://github.com/isitchristmas/web`) and read its page and scripts. Otherwise run the scout where the site is reachable: `gh workflow run site-scout.yml -f url=https://justflipacoin.com/`, then read the job's log (visible text, every control, what each button does, weight, load time). A session whose network blocks the site uses one of these two; it never guesses.
2. **List what it does**, feature by feature, the way a visitor meets it, and **what Verse does for the same ask** (`node tools/ask.mjs "<the ask>"`, look at the screenshot).
3. **Write the side by side**: where Verse is ahead, where it is behind, where it is missing something. Be plain about each; a feature left out on purpose (a chat strangers type into) says why.
4. **Build what is behind**, smallest first, each with a test of the behaviour and a browser section that does it the way a person would (two tabs for anything shared); look at the screenshot before saying it works.
5. **Push to main** (owner: no PRs) after `VOID_SKIP_BENCH=1 node tools/checks.mjs`.
6. **Say what is left** and what blocks it (a missing secret, a site this session cannot reach). The owner looks at both on their own screen and makes the call. Only then is the floor signed: `node tools/tower-verdict.mjs "<floor>" --by <who> --beaten --report "<one line>"`.

**How to tell it worked:** the side by side has no "behind" left except what is blocked or left out on purpose, and the owner said so.

**Mistakes made:** calling floors beaten from "a skill answered" (taken back 2026-10-24); comparing with a remembered version of a site instead of its source; writing a scoreboard instead of improving Verse.

**Done so far:** isitchristmas.com (2026-10-24): matched or ahead on the answer, languages, countdown, feeds, JSON and the turning flag; behind on the live crowd across the internet until `CLOUDFLARE_WORKERS_TOKEN` is set; chat left out on purpose.
