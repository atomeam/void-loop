# Playbook: a card that waits for a yes and then runs on the server clock

Written 2026-10-18 after building Verse's ask "Become tasks that keep running after you leave with an approve card on the stage" (growth-inbox #10) as `skills/approve-card.js`. The owner's decision for the first version: D1 automations only, nothing new in the gate or the executors.

## What starts it
One of Verse's asks for a task that outlives the tab: "keeps running after you leave", "an approve card", "approve and walk away". `node tools/reflect.mjs` lists them. Before building, check that the action already has a gate (`lib/approval-core.js` GATED) and an executor (`functions/api/approval.js` executors) whose yes changes STATE on the server rather than running something in the browser: here `automation.keep` puts a rule on the clock (`lib/keep-going.js`) and `/api/automations/tick` runs it with nobody here. If the action has no such executor, build that first (`lib/keep-going.js` is the pattern); the card is the last piece, not the first.

## The shape that worked
1. **The card runs nothing.** Its only authority is the ask text ("keep morning-digest running every 2 hours"). Approve calls `stageApi.ask(th.ask)`: the page's own confirm line asks for the yes, fingerprints the args and runs the executor once. The card never stores an approval id and never calls `/api/approval` itself; it re-parses its ask at click time so the fingerprint is always the current one.
2. **The page tells the card how it went.** `decideConfirm` (void.html) dispatches `void:confirm` with `{ toolName, args, decision, ran }` before it clears the whisper. The card listens once on `document`, matches its own tool and rule, and drops the listener when it is no longer connected.
3. **Status is read, never kept.** `statusOf(th, rule, runs, now)` is pure: it reads the rule's `enabled`/`when` and the runs since `approvedAt` from `GET /api/automations?rule=<id>` (`lib/automations-run.js list({ rule })` returns that rule's 100 newest runs; the default 30 across all rules is too short for a night). aborted and done are sticky; everything else is recomputed every minute with `skills/live.js keepLive` and on every mount.
4. **Away-time is a count, not a log.** `catchUp(runs, seenAt)` says "3 runs while you were away"; `seenAt` moves only when `document.visibilityState === 'visible'` so a background tab never marks runs as seen.
5. **A stage kind with a whitelist.** `THING_KINDS` gets the kind and `cleanThings` gets a branch that keeps only the named fields in their shapes (ask `/^(keep|stop keeping) /`, tool `automation.keep`, id `/^[a-z0-9-]{3,40}$/`, integer `every`, status in the enum, ISO dates, `times` ≤ 1000, strings ≤ 200, numbers x/y). A synced row from another device can carry nothing else.
6. **One "working" look.** `.vc-working` (a shimmer bar under the line, `animation: none; opacity: .6` under reduced motion) is shared with the chess card while Verse thinks: one CSS rule, two cards.
7. **Abort reuses the switch.** `PATCH /api/automations { id, enabled: false }` is exactly what the automations card's checkbox sends.

## How to tell it worked
- `node --test tools/approve-card.test.mjs` (approveOf accepts and refuses, the statusOf table, catchUp) and `node --test tools/automations.test.mjs` (list with a rule).
- `VOID_HEAVY_OFF=1 node tools/test_void.mjs --only "approve card"`: the section runs the real `/api/approval` and `/api/automations` Pages Functions against the suite's in-memory D1 (`memoryD1` learned `void_automations` and `void_automation_runs` for it), seeded with the rule by `A.save(gate.env, …)`. It checks: a reloaded pending card makes no `/api/approval` call; a synthetic click on Yes does nothing (`isTrusted`); a trusted Yes (`page.click`) flips the rule to `enabled` on a schedule and the card to approved; Abort switches it off and the card to aborted; the chess status carries `.vc-working[aria-busy=true]` while Verse thinks; the bar's `animationName` is `none` under `emulateMedia({ reducedMotion: 'reduce' })`.
- `--only "3d: chess and checkers"` after touching `skills/chess.js`.
- On the live site: "approve later: keep <one of your automations> running every 2 hours", Approve, Yes; the automations card shows the rule on a schedule and the approve card says "approved · on the clock"; come back the next day and the line says how many runs happened.

## Mistakes made
- `keepAsk` ids are one token (`[a-z0-9-]`): "keep the nightly check running" does not parse. The example is "keep the nightly-check automation running every day".
- `.g-status` is a flex container, so a `::after` bar lands beside the text, not under it. The approve card's status is a plain block; chess keeps its own `chess-status` class and the test selects on that.
- The suite's `memoryD1` throws "unexpected sql" for any statement it has not seen; the executor's `A.save` runs `ALTER TABLE` (caught), `SELECT hook, created, scope`, an upsert, and `list` runs two `all()` queries. Add each statement to the stand-in before expecting the yes to run.
- A stop ask ("approve later: stop keeping x") would make a card whose status never leaves pending (a disabled rule reads as pending), so `approveOf` refuses it: a stop is one typed yes, and the card's Abort already does it.
- The in-page listener for `void:confirm` fires for every decided line; filter on the tool and the rule id, or two cards for different rules answer the same yes.
