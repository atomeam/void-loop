# Playbook: a mode over the whole stage (a camera, a HUD chip, keys and Esc)

What it grows: a way of seeing or handling the whole stage that is not a card: a view (the camera of "fly around"), a tool mode, a lens. The first one is `skills/fly.js` with its maths in `lib/stage-camera.js` (asked by Owner, 2026-10-18: "You should be able to look around and fly around in v01d").

## What starts it

An ask from the owner or V01D that is about the stage as a whole ("look around", "fly around", "a grid to snap to", "a ruler") rather than one thing on it. Check first that no card already does it: `grep -rn "<the words>" void-live-deploy/skills/*.js` and `node tools/ask.mjs "<the ask>"`.

## The shape

1. **The maths is pure and lives in `lib/<name>.js`**, tested in `tools/<name>.test.mjs` and registered on its own line in `tools/checks.mjs`. For a camera: screen = stage × zoom + offset; `zoomAt` keeps the point under the pointer still; motion is `v += (want − v) × (1 − e^(−k·dt))` with dt capped at 0.25 s so a tab that slept does not leap; reduced motion means no easing at all (full speed at once, a snap home).
2. **The skill owns the mode, not `void.html`.** `node tools/new-skill.mjs <name> --ask "..." --near "..."`, then: module state for the mode, one `<style>` it injects itself, a HUD chip appended to `body` (not `#stage`: "surface is empty on arrival" counts `#stage > *`), its listeners bound on entering and unbound on leaving. `void.html` was not touched for the camera: the transform goes on `#stage` inline (`transformOrigin` 0 0; nothing in the page writes `stage.style`), `overflow: visible` while the mode is on so a panned stage is not clipped.
3. **The view is never the state.** Things keep their saved `x`, `y`; the mode's own setting goes in its own localStorage key named once in `lib/state.js` `STORES`, validated on the way back in (`fromStored`: a bad value is the default).
4. **Input in capture phase.** Keys on `document` with `true` so Esc lands before the page's own Esc (which closes a card, and twice undoes); never while typing (`INPUT`, `TEXTAREA`, `isContentEditable`). `pointerdown` on `#stage` in capture with `stopPropagation`, so the page's `bindDrag` never lifts the card under a pan, but a tap still clicks (a pan of more than 4 px swallows the click that follows). The wheel with `{ passive: false }` to `preventDefault`. Two pointers: zoom at their middle by the ratio of their distances, then pan with the middle.
5. **The asks.** Exact matchers for the mode's own words and `nearMisses` for the look-alikes that are other skills' asks ("fly to tokyo" is a trip, "look around the room" is a web answer); `node tools/ask.mjs` with both lists before and after shows nothing else moved.
6. **Nothing appears until asked.** The mode resumes on reload only when this device was in it; an empty stage stays empty.

## How to tell it worked

- `node --test tools/<name>.test.mjs` green; `node tools/skills-check.mjs` "all N skills clean".
- One browser section, run alone: `node tools/heavy.mjs node tools/test_void.mjs --only "<its words>"`. It presses the keys (`keyboard.down`, a wait, `keyboard.up`), turns the wheel (`mouse.wheel`), drags (`mouse.down`, `move` with steps, `up`), presses Esc, and compares the things' saved positions before and after as JSON: they are equal. A second context with `emulateMedia({ reducedMotion: 'reduce' })` checks the snap.
- `node tools/ask.mjs` on the look-alikes gives what it gave before.

## Mistakes made

- A test that reads the camera right after letting go of a key reads a value still easing: wait for rest (or compare loosely) before the next input's check.
- `tools/ask.mjs` presses Esc after every ask: a mode entered by one ask is left before the next, so "land" right after "fly around" there says "already on the ground"; that is the harness, not the skill.
