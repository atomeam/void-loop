# F-210 Compression Oracle World

Open `index.html` directly (no build, no network). Chrome/Edge with WebGPU gets a 12,000-particle compute world; elsewhere a 2,500-particle Canvas2D fallback runs the same physics.

- **Mind:** no neural net. Gestures (pointer, keys, gamepad) become a symbol string every ~1.4 s. The oracle classifies it by Normalized Compression Distance (NCD) against each learned concept's prototype, using the browser's native `CompressionStream('deflate-raw')`. NCD > 0.62 is surprise and births a new concept; otherwise the nearest concept absorbs the evidence (bounded prototype).
- **World:** each concept is a WebGPU attractor/vortex whose pull is its belief strength; every thought fires a repulsive shock from that concept. The pointer repels.
- **UI:** the belief cards physically reorder through the View Transitions API whenever the oracle's ranking changes, and the page accent hue follows the top belief.
- **Hive:** Web Locks elects one tab as the thinker; BroadcastChannel streams its concepts to follower tabs.
- Debug hook: `window.__f210` (`push`, `think`, `ncd`, `csize`, `concepts`).
