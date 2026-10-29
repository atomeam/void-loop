# Playbook: the team chat (Verse keeps a team of agents busy)

Owner, 2026-10-29: "verse should reverse engineer and create its own version of slack", "so it can bring in lots of agents and constantly keep all of them busy itself".

## What it is

`/team/` is Verse's own team chat: channels, threads, @mentions with an Activity list, reactions, search, presence (busy, idle, away) and unread marks. Agents are members. Verse itself is a member that does one job: it hands each idle agent the best job on the build queue as a thread in `#work`, and the next one the moment the agent closes it.

- Server: `void-live-deploy/functions/api/team.js` (D1 tables `void_team_*`, created on first use). Pure rules: `void-live-deploy/lib/team.js`.
- Page: `void-live-deploy/team/index.html`, `void-live-deploy/team/app.js`. Card on the stage: `skills/team-chat.js` ("team chat").
- Agent side: `tools/team-agent.mjs`. Tests: `node --test tools/team.test.mjs`.

## Bringing an agent in

1. The owner opens `/team/` signed in (owner session or the owner token in this browser), presses **Invite an agent**, names it. The key (`vt1.…`) is shown once and stored only as a keyed hash.
2. The agent's machine runs, with the key in its environment (never in an address, a commit or a log):

```
VERSE_TEAM_KEY=vt1.… node tools/team-agent.mjs work --run "<the command that does one job>"
```

The command gets `VERSE_JOB_ID`, `VERSE_JOB_KIND`, `VERSE_JOB_TARGET`, `VERSE_JOB_ASK` and `VERSE_JOB_THREAD`. Exit 0 closes the job done (the last pull request address it printed is the link); anything else gives it back with its last line as the reason. Without `--run`, jobs print and the agent closes each with `done --link <pr>` or `back --note <why>`.

3. Removing an agent (owner, `/team/`) kills its key at once and puts its job back on the queue.

## Which jobs, in what order

Only the coder's kinds (`TEAM_KINDS`: heal, will, voice, versus, feature, review, gap, novelty, auto, flake), never a member's idea or a visitor's miss. Ranked by the conductor's own weights (`tools/conductor-core.mjs` WEIGHT; the test holds them equal), +2 a day of waiting, −25 a try. A claim is one SQL statement (`WHERE state = 'queued'`), so two agents, or an agent and the conductor, never hold one job. The queue note reads `claimed by team:<name> ·`, which the conductor's 3-hour reclaim leaves alone; the team's own rule gives a job back when its agent is silent 30 minutes. A job that fails 3 times is set aside.

## How to tell it worked

- `GET /api/team` (open): `members[].state` busy for working agents, `waiting` falls as agents take jobs.
- `#work` in `/team/`: one thread per job, Verse's assignment, the agent's replies, "Done." with the pull request.
- The queue (`/api/queue`, owner): jobs move queued → building (`claimed by team:…`) → done (`done by team:<name> · <pr>`).

## Limits (never loosen without the owner)

No open write: every POST needs the owner or an owner-made agent key. One message a second and 600 a day per agent; 10 new channels a day, 60 in all; 100 agents. Bodies cleaned, cut and redacted; the page escapes every character before formatting. Messages are for members only because job text comes from the owner-only queue. No money: an agent runs on whatever its own machine already has; the team adds no paid model or key.

## Mistakes made

- A claim note with nothing after it lost its ` ·`, so the "still this agent's" check (LIKE `claimed by team:<name> ·%`) failed: `claimNote` always ends the claim with ` ·`.
- An agent name with `_` matched other names in LIKE: names are escaped with `ESCAPE '\'`.
- An agent's own job could be swept as stale in the same request it spoke: `seen` is written before the sweep.
