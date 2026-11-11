# Live Workspace Fusion Step 1: explicit multi-input bridge (MVP)

**Purpose:** let a person stage 2–3 inputs they explicitly chose (tab snapshot, pasted URL, text snippet) on the stage and synthesize them into one Bridge Card (connections, deltas, next actions). No ambient capture.

## When to use
- A user wants to relate multiple artifacts (API doc/snippet + code, two configs, URL + notes) without the model guessing from one blob.
- Building on this flow: add staging sources, improve synthesis, or add checks.

## How it works
- **Staging (explicit only):**
  - **Tab:** open Verse extension side panel, read tab (Alt+Shift+V / menu) → tab card shows; click **"Add to workspace"** to bank a snapshot (title, URL, selection) into `stageInputs` (max 3). Re-reading updates the current tab card as before; banking is a separate explicit action (`void-live-deploy/skills/tab.js`, `stageApi.ext.addInput`).
  - **Paste / typed:** multi-line paste is captured as before (`pasteRaw`/`pasteFlat` in `void.html`) and shows a **"+ Stage paste"** action above the command bar to bank it as snippet/URL and clear the box. **Alt+Enter** stages the current input (or captured paste) as snippet/URL.
  - Chips render in `#stage-chips` above `#row` (`void.html`), hidden when empty, dismissible (`×`). Buffer is ephemeral (not saved/undo), capped at 3.
- **Synthesis:** when `stageInputs.length >= 2`, `handle()` routes to `showBridge(ask, inputs)` (`void.html`). It POSTs `/api/answer` `{ mode:"bridge", ask, inputs }`.
  - **Production/server:** `bridgeAnswer` in `void-live-deploy/functions/api/answer.js` runs deterministic analysis (`void-live-deploy/lib/bridge.js`) and returns the bridge contract.
  - **Local fallback:** if `/api/answer` returns 204/not-ok, client imports `void-live-deploy/skills/bridge.js` → `analyzeBridge` (same lib) and renders with `local: true`. This makes offline/local runs (e.g. `tools/ask.mjs` stubbing `/api/*`) produce real connections/deltas.
- **Renderer:** `renderBridgeCard` in `void-live-deploy/skills/bridge.js` renders sections Connections, Deltas, Next actions, Limitations and copy/ask actions.

## Contract (`kind:"bridge"`, v1)
```json
{
  "kind": "bridge", "version": 1,
  "inputs": [{"id","kind","title","sourceUrl"}],
  "summary": "string",
  "connections": [{"from","to","type","detail","refs":{"a","b"},"confidence"}],
  "deltas": [{"severity":"mismatch|missing|conflict|risk|info","between":["in_a","in_b"],"detail","evidence"}],
  "nextActions": [{"id","label","kind":"scaffold|copy|open|test|ask","rationale","payload"}],
  "limitations": ["string"]
}
```

## Deterministic analyzer (`void-live-deploy/lib/bridge.js`)
- Extracts JSON keys, snake_case/camelCase identifiers, function params/types, endpoints and URLs from excerpts (bounded).
- Connects equal or normalized-equal names across inputs (flags `snake_case ↔ camelCase`) and shared endpoints/URLs.
- Flags type mismatches (e.g. `string` vs `number`) and naming diffs as deltas; emits adapter/copy next actions.

## Verify
- **Unit logic (deterministic):** run `analyzeBridge` on the two-artifact fixture (schema with `user_id: "string"` + function with `userId: number`) and assert a field-map connection `user_id ↔ userId` and a `mismatch` delta `string vs number`.
- **Browser flow (local):** `tools/ask.mjs` stubs `/api/*` to 204; with staged inputs the page must fall back to local synthesis and render the Bridge card.
  - Seed inputs via `window.stageInputsApi` (exposed for test): `ASK_BRIDGE='[{"id":"in_api","kind":"snippet","title":"items.schema.json","content":"..."},{"id":"in_fn","kind":"snippet","title":"repo.ts","content":"..."}]' ASK_WAIT=4000 node tools/ask.mjs "Bridge these inputs..."` (ask.mjs seeds chips before submit and reports `chips: N`).
  - Expect: 2 chips before send; page shows Connections/Deltas/Next actions with `user_id` ↔ `userId` and string-vs-number mismatch.

## Files
- `void.html` (+ synced `void-live-deploy/index.html`, `void-live-deploy/void.html`): `stageInputs` buffer/helpers, `#stage-chips` UI/CSS, paste/Alt+Enter staging, `stageApi.ext.addInput`, bridge trigger in `handle()`, `showBridge`.
- `void-live-deploy/skills/tab.js`: "Add to workspace" action.
- `void-live-deploy/skills/bridge.js`: `analyzeBridge` re-export + `renderBridgeCard` + skill entry.
- `void-live-deploy/lib/bridge.js`: shared deterministic analyzer.
- `void-live-deploy/functions/api/answer.js`: `mode:"bridge"` → `bridgeAnswer`.
- `void-live-deploy/skills/order/1766-bridge`, `void-live-deploy/skills/index.json` (regenerated).
- `tools/ask.mjs`: `ASK_BRIDGE` seeding + chips count in output.

## Notes / next
- Inputs are explicit and bounded (max 3, truncated excerpts); nothing ambient. Tab snapshot currently banks title/URL/selection (not full page text).
- Future: richer extractors (OpenAPI/TS AST), model-assisted synthesis in production with deterministic grounding, multi-tab gesture UX, and moving staged-input seeding into a dedicated test helper if needed.
