# Playbook: a bridge between two kinds of thing on the stage

Written 2026-10-16 after building 21 of Verse's own asks in one run (kept to notepad, list to notepad, a drop onto a list, figures to notepad, self-play to notepad, the pulse card, collision flags, the Bench icon, the friction slider, the Success Pulse, whole-stage sync). The owner's rule for these asks: build a simple working version of every ask first, then deepen.

## What starts it
A reflection ask of the form "connect X to Y", "make X trigger Y", "add a card that shows Z". `node tools/reflect.mjs` lists them; the oldest unbuilt one goes first. Check `void.growth.json` and the code before building (three of the 21 were already built: the Game Strength marks in `skills/rack.js`, the motto and VoidQuest text in `domains/void.canon.md`).

## The shape that worked
1. **Say what one kind hands the other, as text.** Put it in a pure function (`lib/bridges.js`: `keptNote`, `entryFor`, `itemLine`, `togetherLine`, `arenaNoteLine`) with a unit test (`tools/bridges.test.mjs`). The DOM work stays in the skill that owns the button.
2. **Reuse the receiving skill's own door.** `skills/notepad.js` exports `append(stageApi, line)`; a bridge calls it, it never writes `th.text` by hand. A new notepad appears when there is none.
3. **Events, not polling.** The page says `void:dropped` when a thing is set down and `void:moved` when a shared Verse moves one; `void:output` when an arrow hands a value over. A skill listens once (`globalThis.__flag` guards a second listener) and keeps the page's stageApi from its `decorate` hook. Record a fact at the moment it happens (`lib/pulse.js note()`), never from a timer that happens to look.
4. **A stage card is a stage kind.** `stageKinds: { name: { mount } }` plus `api.summon('name', { x, y })` from `run`; one card only (find the existing one and `center` it).
5. **Shared Verse messages are a closed list.** `lib/share.js clean` passes only cursor, summon, move, text, drop and sync; `cleanData` lets a sync carry list entries (8 x 40 chars), a timer's state or a counter's number. Never widen it for a stranger's markup; every new type needs a case in `tools/stage-extras.test.mjs`.

## How to tell it worked
- `node --test tools/<your>.test.mjs` for the pure parts.
- A scratch browser run before the queued suite: a small driver that serves `void-live-deploy`, blocks outside hosts and prints the notepad text, the list items, the card text. Faster than waiting for the heavy lock.
- `node tools/heavy.mjs node tools/test_void.mjs --only "<one shared word>"`: give all of a group's sections one common word in their headings ("stage extras", "bridges") so one lock wait runs them all.
- `finish.mjs --test "<words>" --try "<an ask that your skill answers>"`.

## Mistakes made
- The stage list card's class is `list-card`, not `list`; a selector on `.thing.list` found nothing.
- A kept card's saved html holds buttons, art, a title and a footer; take its words with `plainOf` (drops those), not `textContent`.
- `pkill -f "<test words>"` matched the shell that ran it and killed the session; look up pids with `ps` instead.
- A flick in a test needs pointer events dispatched with a tiny gap (`tools/test_void.mjs` "undo during a throw"); mouse moves in many steps read as a slow drop.
- Two worktrees that both add the same new line to `void.html` merge cleanly only if the line is character-for-character the same; copy it.
- Declare any `let`/`const` the page's `save()` reaches before the first `save()` runs (line ~1093 in `void.html`), or it is a temporal-dead-zone error at load.
- New skills made in separate branches got the same rank; give each group its own rank block (`skills/order/<rank>-<name>`).
