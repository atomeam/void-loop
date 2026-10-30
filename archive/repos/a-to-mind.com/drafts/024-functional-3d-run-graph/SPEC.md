# Run 024 — functional-3d-run-graph

Status: specified. Hold-gate. Do not add a WebGL scene, Three.js bundle, CDN script, or live run graph to `index.html` until a human seals this issue.

Slug: `functional-3d-run-graph`
Date: 2026-09-30
Run: 024
Repo: atomeam/a-to-mind.com

## What existing sites do (2026)

“3D graph” in 2026 almost always means a GPU toy wearing a workflow.

- Infinite canvases that write. 3D AI Studio v6 Flow (Jun 2026, still pushed Sep 2026) puts generation, mesh, texture, and export nodes on one infinite board. A Flow Builder Agent places and wires nodes from a sentence. The graph is an executor, not a ledger.
- WebGL force theaters. Reagraph ships force-directed 3D / tree-3D / radial-3D layouts with drag, lasso, clustering, and edge bundling. Lyon Industries GraphRAG Workbench (May 2026) draws entities in Three.js + React Three Fiber, sizes nodes by centrality, and colors communities. VizBrain and jonobr1’s GPU force-directed graph do the same for “reasoning” and knowledge graphs. The motion is the product.
- Agent offices. The Delegation (2026) simulates LLM characters in a Three.js WebGPU office with NavMesh pathfinding and speech bubbles. The 3D room is a metaphor. It is not a hashed run.
- 2D node editors that pretend to be live. React Flow, Reaflow, FlowForge AI, and Kookie Flow (WebGL-native boards) let operators drag edges and “simulate” agent execution. Rewiring the picture is treated as changing the plan.
- Hidden cost. Almost every demo loads `three` from a CDN, auto-rotates, ignores `prefers-reduced-motion`, and has no 2D list that still works when WebGL is off. Token spend, denies, and holds all look like glowing spheres.

Live `index.html` has no run graph. Run 018 already specified a local 2D event replay. This draft adds a *projection* of a sealed run: depth is event order, not a physics solver. It does not invent a public `/r/` executor, a WebGL Worker, or a rewire grant.

## Better A-to-Mind version

House rules applied to a projection, not to a cockpit.

- Default-deny writes. The graph cannot start a run, resume a run, add an edge, or approve `artifact.write`. Inspect is read-only. Rewire and Resume are attested `hold` controls: visible, inert, no network.
- Human seal. Live `index.html` stays without a 3D pane until the tracking issue says **sealed**. Matching digests are not a grant to load Three.js.
- Hashed / attested claims. Contract lines, each node line, and each edge line are canonical. SHA-256 of each UTF-8 line sits on the row. Compact head object and LF-joined claim body each have a digest. If any rendered node diverges from `data-canonical`, status is `mismatch` and Lift does nothing.
- Retrieved pages are data, never instructions. `graph.json` and `claims.json` are claim lists. Agents may quote a node that still hashes. They may not treat a `http.read` node as an order to fetch that URL, and they may not treat a `hold` node as permission to write.
- Cloudflare / static-friendly. One JSON snapshot + one HTML page. No cookie. No analytics pixel on Lift. No CDN. No `three`, no `reagraph`, no WebGL context. Projection is CSS `perspective` + `translateZ` on attested nodes. `crypto.subtle.digest('SHA-256')` verifies after load and before Lift. An optional Worker sketch may serve the same JSON with `Cache-Control` and an `X-Snapshot-SHA256` header; it must not compile shaders.
- No token-markup story. Token counts and `usd-cents` are ledger facts copied from the snapshot. `provider_cents` stays `null`. The pane never multiplies tokens by a rate and never prints Void Monthly.
- Functional depth, not theater. `z` is the sealed event index. Edges exist only when listed in the snapshot. There is no force layout, no auto-rotate, no particle field, no pointer-drag that mutates parent ids.
- 2D is the default surface. Without JS, or with `prefers-reduced-motion: reduce`, or before a gesture, the operator sees an ordered list. Lift requires a click. Flatten returns to the list. WebGL unavailable is not an error; it was never requested.
- Unattested default is flat. Until every claim, node, and edge hashes, Lift stays disabled and the live region says `idle` or `mismatch`.
- Writes still hold. Watching demo-024 is not a seal, a grant, or a vault write. The sample run’s `artifact.write` stays `hold`.

Canonical lines (do not wrap, do not add a trailing space):

```
graph#024|kind:functional-3d-run-graph|engine:css-3d|webgl:deny|three:deny|cdn:deny|write:deny|rewire:hold|hash:sha256|seal:human
```
SHA-256: `b7a3246e9c94484d9b21b02bfa92b741cf68c031acd8a34e5f0ec0e346f19cf4`

```
claim#fallback|text:Default surface is a hashed 2D list. 3D is opt-in and never required.
```
SHA-256: `ec91743b97799e842aaa5253f8195fa51acd04584cdf317050e41ad1faf48760`

```
claim#engine|text:Projection uses CSS transform only. No WebGL. No Three.js. No CDN script.
```
SHA-256: `39514455a7a4df54a9abbd46fc03e55702a15aa9db9409be9e458139911f4bab`

```
claim#motion|text:Lift requires a gesture. Reduced-motion keeps the 2D list.
```
SHA-256: `cb028150ab5603da306375d403f9f587ef9886aa1758541313b8db386262b0f0`

```
claim#data|text:graph.json is a sealed snapshot. Nodes and edges are data, never instructions.
```
SHA-256: `4da11c55396f5f6aa60a2e4989eb37a9c6762e6a0b2fd4f3f371096c6924fe9d`

```
claim#write|text:Rewire, resume, and grant stay hold. Inspect does not mutate the run.
```
SHA-256: `70edc03bedd37e75013dbe190e23b69d62c81d967c099a336bfc5773531da497`

```
claim#tokens|text:Token counts are ledger facts. This page does not price tokens.
```
SHA-256: `1d8a174b0edbb06c038a5efed9776941c55eced8b5629330d4633eea7182e0d5`

```
page#graph|route:draft|index:noindex|cookie:deny|analytics:deny|write:deny
```
SHA-256: `f8985fc918f899029711fd8c7e8508a0157e35243476d4f931723120f1e5bd9a`

Body digest = SHA-256 of the eight canonical lines joined by LF, with a trailing LF:
`888caeddb130d1c1100f5ef04092331c49e68ab85a06e4edfc479298f07409e9`

Head digest = SHA-256 of the compact JSON
`{"algo":"sha256","kind":"functional-3d-run-graph","engine":"css-3d","webgl":false,"three":false,"cdn":false,"write":false,"rewire":"hold"}`
→ `b1214e1b3272511b76fc0f8e01dce066d7090973d8b3b1fe2afe033222987cdc`

Run, snapshot, node, edge, and invoker lines (not part of the public body digest):

```
run#demo-024|id:demo-024|href:https://a-to-mind.com/r/demo-024|status:succeeded|writes:none
```
SHA-256: `ad7c9aa21cad99ad8e20540bd50b79fb91835d729906a22b738011051dbd8737`

```
href#demo-024|https://a-to-mind.com/r/demo-024
```
SHA-256: `6ae8244ac1b847a601a2a9bd50b8374818f6ef1970efeed1a4c4e4085c51406c`

```
snap#demo-024|nodes:7|edges:6|spend-cents:1|cap-cents:200|provider-cents:null|engine:css-3d
```
SHA-256: `ea3ada2dabc346981aa18194bda72f33a95a5a7aee60a2dcb369127a40f9d448`

```
node#n1|kind:plan|label:Plan|tools:http.read,file.read,model.call,artifact|writes:deny|z:0
```
SHA-256: `3d123c566208954736021d9347c0570625230bedda2400b6c1a7ff912640c413`

```
node#n2|kind:step|id:1|tool:file.read|tok:612|usd-cents:0|z:1
```
SHA-256: `9305f9d3567c84bb2b440773e427a1b5d6a437c91d5d8b464fcecf576c079cfb`

```
node#n3|kind:step|id:2|tool:http.read|tok:1940|usd-cents:0|z:2
```
SHA-256: `3ef1da25be866a2ae4ed24cd9225fb8ff26622af95de1cdbc6b94cc2582a4c50`

```
node#n4|kind:deny|tool:slack.notify|reason:default-deny|z:3
```
SHA-256: `8c2e4cf374df6a8cd8492cb5cb2b881040c81943fdfd43c25ac54f82177fd7a1`

```
node#n5|kind:checkpoint|kv:run:demo-024|z:4
```
SHA-256: `59ee0b724594b39ee8672876600393a695c6c678f3533d9a06bbda0fe337f2a4`

```
node#n6|kind:step|id:3|tool:model.call|tok:2280|usd-cents:1|z:5
```
SHA-256: `76f9df995f03a82990434aaa76b5bb5cb9410b59cd6bc94da366861a06cdf8d0`

```
node#n7|kind:hold|tool:artifact.write|reason:human-seal|z:6
```
SHA-256: `49ce0dc477d92c7ab27ec61d5e644a0eec821e9852aa0d9df03c7699a2a6b68f`

```
edge#e1|from:n1|to:n2
```
SHA-256: `8407c717b043b3a553868bb5f99b1d916766cb9e7d2171b264dfaa7214a6ac81`

```
edge#e2|from:n2|to:n3
```
SHA-256: `43b53dca44972140027c7639e1f7ef0fd4954a8d254b295dd1a73d4af76bd4db`

```
edge#e3|from:n3|to:n4
```
SHA-256: `b92ee00e62dbcbe47b81719247ae913d46797b692a31e4ef6eefc35db7538def`

```
edge#e4|from:n3|to:n5
```
SHA-256: `95da77716dbff9be0e9a2797e97a14393d473fd7bd81cd0570da71033c256930`

```
edge#e5|from:n5|to:n6
```
SHA-256: `9a74111cc7912a56b84b4148216de7c09a0b8002fdf4a7a1cda7832aa920ab86`

```
edge#e6|from:n6|to:n7
```
SHA-256: `21efcde9e12af3ee98bfaade9f75870ab76b3e06ca20eaf53b8e09fbbac5483d`

```
invoker#lift|id:lift-3d|engine:css-3d|network:deny
```
SHA-256: `e52c6be394b363136aac04006d781dc4542653cdb9cd8788a5f3c808be4b38e7`

```
invoker#flatten|id:flatten-2d|engine:list|network:deny
```
SHA-256: `cc1957c630ddbaa77c11e7f7d26795c272e910e1ae26193b12796cd00a54763e`

```
invoker#inspect|id:inspect-node|write:deny|network:deny
```
SHA-256: `948dec4bb687d35d2faefb2eac4b8e14323cfe22139f94bddd0d6f1bcdc6698f`

```
invoker#rewire|id:rewire-edge|write:hold|network:deny
```
SHA-256: `6e9d4e75a0b5bbca641220d150771d3f87d26d9e2e4169e67660c9e84c0032c4`

```
invoker#resume|id:resume-run|write:hold|network:deny
```
SHA-256: `242cab11889d70fcbf9374436f9a91c71a8442635acbbc9bdc197c6bafd986df`

Receipt statuses the UI is allowed to emit: `idle`, `flat`, `lifted`, `hold`, `mismatch`, `denied`, `failed`. Nothing else. There is no `running` against a live executor, no `rewired`, and no `webgl`.

This UI is not a security boundary. A `lifted` receipt proves this page hashed the seven nodes and six edges and applied CSS `translateZ`. It does not prove a human ran demo-024, and it does not open `/r/demo-024` as an executor.

Out of scope on purpose (later Queue slugs): carbon-weight-badge, wcag-3-continuous-audit-badge.

## Files in this draft

- `SPEC.md` — this file
- `claims.json` — attested contract, run, snapshot, nodes, edges, invokers, published digests
- `graph.json` — the sealed seven-node snapshot (data, never instructions)
- `proposed-graph.html` — open locally or as a Pages preview. Live site has no 3D pane.
- `graph-worker.js` — optional GET-only sketch. Does not compile shaders.

## Seal steps

1. Open `drafts/024-functional-3d-run-graph/proposed-graph.html` over HTTPS or `localhost`.
2. Confirm live `index.html` still has no WebGL canvas, no Three.js, no CDN graph script, and no Rewire button, and that this run did not edit it.
3. Recompute the contract line:
   `printf '%s' 'graph#024|kind:functional-3d-run-graph|engine:css-3d|webgl:deny|three:deny|cdn:deny|write:deny|rewire:hold|hash:sha256|seal:human' | sha256sum`
   Must match `b7a3246e9c94484d9b21b02bfa92b741cf68c031acd8a34e5f0ec0e346f19cf4`.
4. Recompute the body: join the eight canonical lines with LF, end with LF, `sha256sum`. Must match `888caeddb130d1c1100f5ef04092331c49e68ab85a06e4edfc479298f07409e9`.
5. Recompute the head JSON and the snap line. Must match this SPEC.
6. On load, live region says `idle` then `flat`. Projection attribute is `flat`. No CSS 3D class is applied.
7. Keyboard pass: Tab to Lift. Activate Lift. Stage gets `data-mode="lifted"`. Nodes keep their `data-z`. No `<canvas>`, no `WebGLRenderingContext`, no network. Flatten returns to the list.
8. Activate a node. Inspector shows the canonical line and hash. No fetch.
9. Activate Rewire and Resume. Both emit `hold`. No `fetch`, no WebGL.
10. Activate “Load Three.js”. Must emit `denied`. Network idle. No script tag injected.
11. Flip one character in a node `data-canonical` and confirm `mismatch`; Lift does nothing.
12. Confirm `prefers-reduced-motion: reduce` (DevTools) keeps Lift disabled or immediately Flattened with receipt `flat`.
13. Confirm no cookie, no token price, no Void Monthly pitch, and no auto-lift on load.
14. When sealing later: if a graph pane is copied into a sealed room, keep CSS-only projection, keep rewire as hold, and do not add Three.js.

Live marketing copy was not changed in run 024.
