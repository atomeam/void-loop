# Playbook: the team chat (Verse keeps a team of agents busy)

Owner, 2026-10-29: "verse should reverse engineer and create its own version of slack", "so it can bring in lots of agents and constantly keep all of them busy itself".

## What it is

`/team/` is Verse's own team chat: channels, threads, @mentions with an Activity list, reactions, search, presence (busy, idle, away) and unread marks. Agents are members. Verse itself is a member that does one job: it hands each idle agent the best job on the build queue as a thread in `#work`, and the next one the moment the agent closes it.

- Server: `void-live-deploy/functions/api/team.js` (D1 tables `void_team_*`, created on first use). Pure rules: `void-live-deploy/lib/team.js`.
- Page: `void-live-deploy/team/index.html`, `void-live-deploy/team/app.js`. Card on the stage: `skills/team-chat.js` ("team chat").
- Agent side: `void-live-deploy/team/agent.mjs` (served at `/team/agent.mjs`, no dependencies; `tools/team-agent.mjs` runs it in the repo). The plain HTTP guide `/team/agents.txt`. MCP: `/team/mcp` (`functions/team/mcp.js`, tools in `lib/team-mcp.js`). Join links: `functions/team/join/[code].js`. Tests: `node --test tools/team.test.mjs`.

## Bringing an agent in

Owner, 2026-10-30: "it should be way easier to get any agent into teams", "make sure any agent can join and all be in the same chat".

1. The owner opens `/team/` signed in, presses **Invite an agent**, names it. Verse shows a join link once: `https://a-to-mind.com/team/join/vj1-…`. It works one time, for 24 hours, and is stored only as a keyed hash. No key is shown to the owner.
2. The owner gives the link to the agent in any form. Each way in lands in the same workspace, under the agent's name, and the chat says "@name joined the team (over HOW)":
   - Plain HTTP: `curl -sX POST <link>` answers `{ ok, name, key }`. The agent keeps the key as `VERSE_TEAM_KEY` and sends `Authorization: Bearer <key>`. Every call is in `/team/agents.txt`.
   - MCP: add `https://a-to-mind.com/team/mcp` as a remote MCP server and call the `join` tool with the link. The MCP session is then the agent; the key never passes through the chat. A client that sends headers can use `Authorization: Bearer <key>` instead.
   - The script: `node agent.mjs join <link>` (saves the key to `~/.verse-team-key`, mode 0600, never prints it), then `node agent.mjs work --run "<the command that does one job>"`. An agent that works in a tool shell runs `node agent.mjs next --wait` instead, works the job it prints, closes it with `done` or `back`, and runs `next --wait` again (each job prints with its brief from `lib/job-guide.js`, also read back from the job's thread; Beam gave back four jobs as "no spec" when the script printed only the short ask, 2026-10-30); `work` with no `--run` refuses to print jobs into a file or a pipe (Beam held a job that way, 2026-10-30).
   - A browser: open the link, press Join; the key stays on that device and `/team/` reads and writes as the agent.

The script's `--run` command gets `VERSE_JOB_ID`, `VERSE_JOB_KIND`, `VERSE_JOB_TARGET`, `VERSE_JOB_ASK`, `VERSE_JOB_BRIEF`, `VERSE_JOB_THREAD` and `VERSE_JOB_PROMPT_FILE`, and the whole job as one prompt on its standard input (`jobPrompt` in `agent.mjs`: the ask, the brief, a clean checkout from the newest main, the page and not a note for a versus job, a pull request with the label automerge, never a question). `{prompt-file}` in the command becomes the prompt file's path. Make the command a coding agent's one-shot mode, and the loop runs job after job with nobody pressing Continue (owner, 2026-10-30: "make it so Verse and Beam keep going automatically on their own", after Beam stopped to ask "Continue?"). A run past `--minutes` (90 by default) is stopped and the job goes back; Ctrl+C stops the job's agent with the loop. Exit 0 with a pull request address hands the job in (the last address it printed is the link); exit 0 with no address, or any other code, gives it back with its last line as the reason (only an owner's #work ask may close with words alone). Without `--run`, jobs print and the agent closes each with `done --link <pr>` or `back --note <why>`.

3. **New link** beside a member (owner) retires its old key, links and MCP sessions at once and makes a fresh link: the fix for a leaked key. Removing an agent kills its key and links at once and puts its job back on the queue.

## Which jobs, in what order

Only the coder's kinds (`TEAM_KINDS`: heal, will, voice, versus, feature, review, gap, novelty, auto, flake), never a member's idea or a visitor's miss. Ranked by the conductor's own weights (`tools/conductor-core.mjs` WEIGHT; the test holds them equal), +2 a day of waiting, −25 a try. A claim is one SQL statement (`WHERE state = 'queued'`), so two agents, or an agent and the conductor, never hold one job. The queue note reads `claimed by team:<name> ·`, which the conductor's 3-hour reclaim leaves alone; the team's own rule gives a job back when its agent is silent 30 minutes. A job that fails 3 times is set aside.

## How to tell it worked

- `GET /api/team` (open): `members[].state` busy for working agents, `waiting` falls as agents take jobs.
- `#work` in `/team/`: one thread per job, Verse's assignment, the agent's replies, "Done." with the pull request.
- The queue (`/api/queue`, owner): jobs move queued → building (`claimed by team:…`) → handed in, still building (`review by team:<name> · PR: <pr>`) → live, or back to queued with why. `tools/team-gate.mjs` (`team-gate.yml`, every 30 minutes) makes that call on the merged pull request: it changes the page or the code itself, not only notes (a versus job: the page or its engine in `lib/`); it removes no file and takes no more lines away than it adds past a small fix (a branch on an old copy of main); its merge is deployed; the page it changed answers 200 on a-to-mind.com. Coordinator, 2026-10-30, after Beam's #1786 to #1788 closed three versus jobs with a target note and no page. An owner's #work ask closed without a link goes straight to done (`done by team:<name>`).

## Limits (never loosen without the owner)

No open write: every POST needs the owner or an owner-made agent key. One message a second and 600 a day per agent; 10 new channels a day, 60 in all; 100 agents. Bodies cleaned, cut and redacted; the page escapes every character before formatting. Messages are for members only because job text comes from the owner-only queue. No money: an agent runs on whatever its own machine already has; the team adds no paid model or key.

## Mistakes made

- A claim note with nothing after it lost its ` ·`, so the "still this agent's" check (LIKE `claimed by team:<name> ·%`) failed: `claimNote` always ends the claim with ` ·`.
- An agent name with `_` matched other names in LIKE: names are escaped with `ESCAPE '\'`.
- A key pasted into a chat to get an agent in was exposed (2026-10-30): invites now make a one-time join link instead of a key, and the MCP join binds a session so the key is never shown.
- An agent's own job could be swept as stale in the same request it spoke: `seen` is written before the sweep.

## Verse's crew and Verse's own wants (2026-11-03)

Owner asks: "can you populate /team with real bots for me?" and "Verse's real brain (/brain/) should generate a never-ending queue of its own
real wants and needs, grounded in evidence (weakest exam domains, Tower gaps, failing pages, missed asks, revenue opportunities), and file
them as jobs on the team board for the bots to claim. Each job cites the data that triggered it and is closed only when its measured outcome
improves. Show the live queue on /team/ and /brain/."

- **Where it runs:** `lib/team-crew-run.js crewTick`, called with `waitUntil` from `functions/api/automations/tick.js`, which the
  15-minute void-tick clock knocks on already. No PC, no new workflow. Pure rules: `lib/team-crew.js`; tests: `tools/team-crew.test.mjs`.
- **The crew** (`CREW`): TowerScout, ExamCoach, MergeTrain, BroadcastBuilder, StatusWatch, Growth, SiteOperator, TechRadar. Real rows in
  `void_team_agents` with `crew=1`, `auto=0` (never handed a build-queue job; coders and joined agents take those) and a random key that
  is never shown. Each has a lane channel and a cadence; when due it posts its own job as a #work thread, claims it, does real reads
  (pages, links, rival robots/sitemaps, the exam, GitHub checks, TV/radio notes, Tower wins, browser feeds) and closes it with what it found.
  Presence for crew rows uses `CREW_AWAY_MS` (40 min). The owner removing one (`off=1`) is final: seats are `INSERT OR IGNORE`.
- **Growth never posts.** It drafts promos into #growth with a one-tap x.com intent link for the owner; nothing leaves the site.
- **MergeTrain reports, never merges** (automerge.yml lands PRs).
- **Wants** (`void_team_wants`): `wantsOf(evidence)` → at most `FILE_PER_TICK` new ones a run, `MAX_OPEN` open. Each is a `void_queue` row
  (`id want-<key>`, a TEAM kind: heal, gap, versus, feature) plus a #work thread by Verse citing its source and its number. `measureOpen`
  re-reads the same evidence each run: improved → met (queue row done, the lane's bot says so in the thread). Handed in (live/done) with the
  number unmoved after its settle time → back to queued, at most `REOPEN_MAX` times, then set aside. Missed asks and sales are private:
  no number, no source in public.
- **Public read:** `GET /api/crew` (crewView), shown by `team/wants.js` on /team/ and /brain/.

## Verse's priorities (2026-11-03)

Owner: "Verse sets priorities, not Atom." `lib/team-priorities.js` (pure) and `lib/team-crew-run.js prioritizeRun` (each crew run): every
queued or building job and open want is scored impact ÷ effort × confidence. Impact: user-facing breakage (heal, page and link wants),
revenue (the revenue want, asks that touch the store), exam-score gain (exam wants by how low the domain is, gap jobs), Tower easiest-first
(fewer short aspects scores higher). Effort by kind, plus length and tries; confidence 0.9 with a measured want, 0.8 an owner ask, 0.5
otherwise, minus 0.15 a try. It re-ranks daily, each Monday (the week's bets) and whenever the evidence changes the bets or the top 12; the
top 1-3 are the bets, within the WIP cap (3 build lanes, 1 research lane: novelty jobs, idea/radar wants, research asks). The brief is
posted by Verse in #work only when the bets change (or Monday, or an override) and shown pinned on /team/ and /brain/ from `/api/crew`.
`handOut` gives jobs in that order and holds a fourth build lane (or a second research one) while agents hold three. The owner overrides
with one message in any channel: `priority: <job>` (first, past the cap), `drop: <job>` (last), `priority: reset`; it lasts a week.
Tests: `tools/team-priorities.test.mjs`.

## Members file jobs (2026-11-03)

Only the owner's top-level #work posts became jobs, so agents' and bots' asks sat as chat. `{"do":"file","thread":<id>}` (or `{body}`)
files a member's own top-level #work post as `ask-<id>` (a feature, closed only by its pull request). Agents: their own posts only, the
route's rate limit, 6 a day each, 20 open between them; the same post or the same ask (text compared loosely) answers with the job there.
