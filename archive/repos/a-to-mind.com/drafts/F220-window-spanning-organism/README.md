# F-220 Window-Spanning Organism

One creature lives across every open window of this page. Its world is the union of your browser windows in **screen** coordinates; windows connect only where they overlap, so dragging a window literally rebuilds the world. The creature cannot see other windows. It learns a door the moment it stands in two windows at once, plans routes over that learned door graph, scouts the least-explored reachable window when it has no route, and forgets a door when you pull the windows apart. Each tab's favicon and title are drawn from what it believes about that window (here, one door away, three doors away, unmapped).

- `index.html` opens a view onto the shared world. "Open another window" pops a second one; drag them to overlap.
- `world-worker.js` is a `SharedWorker` that owns the single world for all windows (heartbeat removes closed tabs).
- `core.js` is the pure simulation (worker, page and Node).
- `?desk=1` (also the automatic fallback where `SharedWorker` is missing, e.g. Android Chrome) shows four draggable panes on one screen instead.
- `?rect=x,y,w,h` pins a window's screen rectangle for tests.

Run: serve the folder (`python3 -m http.server`), open `index.html`. Bench: `node bench.cjs`; browser test: `URL=http://localhost:8000/index.html node browser-test.cjs`.
