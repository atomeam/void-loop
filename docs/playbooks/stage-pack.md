# Playbook: a pack of stage skills from one owner brief

Written 2026-10-18 after building stage pack F (the Opposite Era: `skills/feud.js`, `skills/oracle.js`, `skills/crowd.js`, `skills/unkeepable.js`, `skills/spectators.js`) in one run. For the next pack of three to six small stage skills the owner describes in one message.

## What starts it
An owner brief that names several playful things for the stage at once, each in a sentence. Build the smallest useful version of every one in one branch, one unit test file and one browser section, so the whole pack is one PR.

## The shape that worked
1. **Look for the existing door first.** `grep -ln <word> void-live-deploy/skills/*.js void-live-deploy/lib/*.js` before writing: sharing a stage already had two doors (`publish my void as @name`, `invite someone` with `lib/share.js`), the layer behind the stage already existed (`skill.world` + `stageApi.setWorld`, as `skills/night-sky.js` uses), and a thing that must never be saved already had a rule (`ephemeral: true` on the stage kind, `keptThings()` in `void.html`).
2. **Scaffold with `node tools/new-skill.mjs <name> --ask ... --near ... --rank <n>`**, one rank each in a block of your own (1460 to 1464 here), so two packs built in parallel do not collide.
3. **The law is pure, the DOM is thin.** Every skill exports its parser (`xOf(text)`) and its law (`step`, `settle`, `corrupt`/`reveal`, `pack`/`unpack`) with no `document` in them; `mount`/`run` only draw. The unit test imports the skill files themselves (`import x, * as X from '../void-live-deploy/skills/x.js'`), which also satisfies the untested-code ratchet.
4. **A stage thing that ticks keeps one module-level `live` record** (`{ th, stageApi, timer }`) and clears it when the thing goes, in `end()`; a tick that finds its things gone ends itself. Match can read that record (a bet routes only while a feud runs).
5. **Values the page sets later go through `textContent`**; `innerHTML` holds only static markup or `esc()`-ed text, and the reviewer's eye goes to every `innerHTML` line.
6. **Routing: three near misses per skill** in `nearMisses`, checked in the unit test (`routes(skill, yes, no)`) and once with `node tools/ask.mjs` on the page, since the page fixes typos and aliases before a skill sees the ask.
7. **One browser section** whose heading starts with the pack's words (`stage pack f: ...`), run with `node tools/heavy.mjs node tools/test_void.mjs --only "stage pack f"`; every check reads `errors` too.
8. **Records last**: `tools/checks.mjs` line, `docs/MAP.md` line, the family in `tools/families.mjs`, then `node tools/families.mjs; node tools/deps.mjs; node tools/guide.mjs`, and `node --test tools/map-coverage.test.mjs`.

## How to tell it worked
`node --test tools/stage-pack-f.test.mjs` green; the browser section green; `VOID_SKIP_BENCH=1 node tools/checks.mjs` green; `node tools/ask.mjs "<a near miss>"` shows `by:` someone else or nothing, never the new skill.

## Mistakes made
- A crowd that "rises" cannot be measured by mean y when the particles wrap at the top: measure mean vertical speed instead.
- `moodOf(null, now)` with `now = Date.now()` read as "idle for ages" and spelt the word at once; the mount records a `start` event so the word comes after ten quiet seconds.
- The page's built-in "keep this" runs before any skill, so a skill cannot take that ask; it only ever keeps the open answer card, which is why the unkeepable traps the copy event, Ctrl/Cmd+C/S/P and a drag instead.
- A feud's "the clock" means the newest clock, but "shopping" means the thing named shopping: names first, kinds second, and never the rival already chosen.
- Spectator reactions that reach the owner need a server door (a new unauthenticated POST, or a new message type in the invite room); that is the owner's call, so the pack ships the read-only link and says so on the card.
