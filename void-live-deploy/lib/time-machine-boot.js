// Boot the Time Machine (ADR-001 v1 MVP): runtime + UI + lightweight stage hooks.
// Exposes window.__tm for debugging and window.__tmRec for inline-stage instrumentation.

import { createTmRuntime } from './time-machine-client.js';
// time-machine-ui (scrubber bar) removed: keep the engine + storage adapter + runtime instrumentation only
import { emptyState } from './time-machine.js';

function safe(fn) { try { return fn(); } catch { return undefined; } }
function getThings() { try { return globalThis.things || {}; } catch { return {}; } }

function projectThingsToTmState(things) {
  // MVP projection from live stage `things` map to TM replay state shape.
  const cards = {};
  const order = [];
  for (const [id, t] of Object.entries(things || {})) {
    if (!t || typeof t !== 'object') continue;
    const sid = String(id);
    order.push(sid);
    cards[sid] = {
      id: sid,
      kind: String(t.kind || 'card'),
      rect: { x: Number(t.x) || 0, y: Number(t.y) || 0, w: Number(t.w) || 0, h: Number(t.h) || 0, ...(Number.isFinite(t.scale) ? { scale: t.scale } : {}) },
      pinned: !!t.pinned,
      kept: !!t.keep,
      data: { ...t },
      visible: !t.tucked,
    };
  }
  return { schema: 'verse.tm.state.v1', cards, order, focus: { cardId: safe(() => globalThis.selectedId) || null }, camera: null, meta: { lastEventId: null, seq: -1, t: Date.now() } };
}

function applyTmState(state) {
  // Scrub view: MVP applies card positions/visibility for existing rendered things.
  if (!state || !state.cards) return;
  for (const [id, c] of Object.entries(state.cards)) {
    const th = getThings()[id];
    if (!th) continue;
    const r = c.rect || {};
    if (Number.isFinite(r.x)) th.x = r.x;
    if (Number.isFinite(r.y)) th.y = r.y;
    if (Number.isFinite(r.scale)) th.scale = r.scale; else delete th.scale;
  }
  safe(() => globalThis.render && globalThis.render());
  safe(() => globalThis.decorate && globalThis.decorate());
}

async function boot() {
  if (globalThis.__tmReady) return globalThis.__tmReady;
  const rt = await createTmRuntime({
    getStageState: () => projectThingsToTmState(getThings()),
    applyStageState: (st) => applyTmState(st),
  });
  // Expose recorder hooks (no-ops if scrubbing/disabled).
  globalThis.__tm = rt;
  globalThis.__tmRec = async (type, payload, meta) => { try { return await rt.record(type, payload || {}, meta || {}); } catch { return null; } };
  globalThis.__tmProject = async (writeLegacy) => { try { return await rt.projectHead(writeLegacy); } catch { return null; } };
  globalThis.__tmScrubbing = () => { try { return rt.isScrubbing(); } catch { return false; } };

  // Seed baseline if empty head.
  try {
    const data = await rt.allData();
    const a = rt.getActive();
    const b = data.branches[a.branchId];
    if (!b || b.headSeq < 0) {
      await rt.record('SESSION_STARTED', { baseState: projectThingsToTmState(getThings()) }, { actor: 'system' });
    }
  } catch {}

  // scrubber bar removed; runtime + instrumentation remain (window.__tm, __tmRec, __tmProject, __tmScrubbing)
  return rt;
}

globalThis.__tmReady = boot();
export default globalThis.__tmReady;
