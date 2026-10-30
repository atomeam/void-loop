# F-220 — Window-Spanning Organism

Date: 2026-10-21 · Draft: `drafts/F220-window-spanning-organism/`

## Concept (novel combination)
The user's desktop layout is the level. A `SharedWorker` hosts one world and one learning creature for every open window of the page; each window reports its own screen rectangle (`screenX/screenY` plus chrome offset) and renders only its slice of the shared world, so stars, trails and the creature line up across physically separate windows. Walkable space is the union of the windows, and two windows connect only where they overlap, so dragging a window is level editing. The creature does not get the map: it learns doors by sensing itself inside two windows at once, plans over the learned door graph (BFS), scouts the least-explored reachable window when it has no route, and forgets doors by surprise (it reaches a remembered door, or is walled off from it, and the other window is not there). The browser chrome is part of its body: every tab's favicon (canvas-drawn) and title show the creature's belief about that window, so the tab strip is a live readout of its map.

## Why it is not a variation
Ledger and drafts had no use of `SharedWorker`, `window.screenX`/screen-space world coordinates, or favicon/title as an output surface (grep: 0 hits each). Earlier multi-device work (F-175, F-193, F-205) synchronized peers over WebRTC/BroadcastChannel with each peer owning its own state; here one authoritative mind lives in a worker shared by all tabs, and the geometry of the user's windows is the environment the agent learns. Prior agents (F-171…F-219) were MLP/RNN/NCA/attention/spiking learners on a fixed canvas; this is a model-based map learner whose map is the user's live window arrangement, with forgetting driven by the user moving windows.

## Architecture
- `core.js`: `World` with rooms (window rects), creature (point mass, wall sliding), food, door map (`"a|b" -> running-average position`), per-room 4×4 coverage grid, planner (`decide`), `belief(roomId)` for chrome, `rescue()` (creature falls to nearest window if one is dragged out from under it), food carried with its window when dragged.
- `world-worker.js`: SharedWorker; ports send `rect` every 120 ms (doubles as heartbeat, 3 s timeout removes a closed tab), `bye` on `pagehide`, `feed`, `mode`. Steps the world 60/s and posts a snapshot plus that port's belief.
- `index.html`: renders the world translated by the window's screen origin; dashed outlines for other windows, glowing door markers whose brightness is confidence; favicon redrawn from belief every 15 frames; click drops food; toggle between learning and a "straight-line smell" baseline; `?desk=1` fallback with four draggable panes; `?rect=` override for tests.

## Measured outcome
Node (`bench-node.json`), 12,000 ticks, seeds 1–5, food eaten:
- Chain of 4 windows: learning 85.6 mean (92, 87, 90, 75, 84) vs straight-line smell 1.0 (stuck at the first wall every seed).
- Zigzag of 5 windows: learning 74 (83, 93, 50, 94, 50) vs straight 1.2.
- Ring (four windows tiling a near-convex block): learning 130 vs straight 159.2. Honest loss: where the union is nearly convex, going through learned doors costs detours that a straight line does not pay.
- Window drag (chain, seed 3): 33 food in 6,000 ticks; window 0 is then dragged so the 0–1 door vanishes and a new overlap opens lower down; 2 doors forgotten by surprise, the new door learned, 39 food in the next 6,000 ticks.
Headless Chrome (`bench-browser.json`): four real pages in one context with pinned rects all joined one SharedWorker world (4 rooms, identical door map `w1|w2, w2|w3, w3|w4`, same tick); each tab had a different favicon and title matching its hop distance ("◉ eat", "◐ 1 door away", "○ 2 doors away", "○ 3 doors away"); closing one tab removed its room and its door within 4 s; desk mode ran 4 panes, learned 2 doors and ate 2 in 15 s. No page errors.

## Failure modes / knowledge
- First version only explored its current window when it had no route, so it never left window 0 (1 food). Fix: frontier scouting over already-reachable windows, scored by edge coverage plus 4 per hop.
- Dragging a window out from under the creature stranded it outside the union (stuck forever); `rescue()` drops it to the nearest point of the nearest window.
- A remembered door that becomes unreachable was never "arrived at", so it was never forgotten; surprise now also fires after 10 blocked steps toward a door.
- Food left at old coordinates after its window moved became unreachable; windows now carry their contents.
- Touching edges (overlap of zero width) count as inside on both, but are almost never hit; real doors need a few pixels of overlap.
- Real-window mode needs a desktop browser with `SharedWorker`; Android Chrome lacks it, so it falls back to desk mode. Background tabs still render via the worker clock, but rAF pauses, so only visible windows animate.
- Screen-origin estimate assumes chrome is on top; on some platforms it is off by a few pixels.

## Building blocks for next runs
A shared, authoritative SharedWorker world that any number of Void tabs can join; screen-space rendering so content spans physical windows; favicon/title as an always-visible output channel even when the tab is in the background; a learn-by-overlap topological map with surprise forgetting. Next: let a local language model narrate from the door graph, let two creatures with different learners compete for the same food across windows, or let Void cards live in separate windows that the creature carries data between.
