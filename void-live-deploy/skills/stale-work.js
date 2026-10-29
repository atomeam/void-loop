/**
 * stale-work skill - per-object counters (edits, decisions) kept on this device only; stale = edits >= 5 and decisions == 0
 * (owner, 2026-10-18). "note that I edited the pitch" / "note that I decided the pitch" drive the counters (a bare "I edited
 * the pitch" counts only for something already tracked, so ordinary chat is left alone). "show stale work" opens a card:
 * decide, defer to a date, or kill. Nothing leaves the browser.
 */
import { bumpOf, bump, staleList, staleIntent, decide, defer, kill, isDay } from '../lib/stage-pack-i.js';
import { localDay } from '../lib/stage-pack.js';
import { softCard } from '../lib/stage-pack-h.js';

const KEY = 'a2m.void.stale.v1';
const load = () => { try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (_) { return {}; } };
const save = (c) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (_) {} };
const tracked = (thing) => Object.prototype.hasOwnProperty.call(load(), thing);

function show(api) {
  const { esc } = api;
  let c = load();
  const items = staleList(c, localDay());
  const el = softCard('stale-work', '<strong>stale work</strong>' // void-review: ok (every value is escaped)
    + (items.length ? items.map((t) => '<div class="sw-row" data-thing="' + esc(t) + '" style="margin:8px 0;padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18)"><div>' + esc(t) + ' <span style="opacity:.6">(' + c[t].edits + ' edits, no decision)</span></div><div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="g-btn sw-decide">decide</button><input type="date" class="sw-date" aria-label="defer until" style="font:inherit"><button type="button" class="g-btn sw-defer">defer to date</button><button type="button" class="g-btn sw-kill">kill</button></div></div>').join('')
      : '<p style="margin:6px 0">Nothing is stale: no object has 5 edits without a decision.</p>')
    + '<button type="button" class="g-btn sw-x">close</button>');
  el.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('sw-x')) { el.remove(); return; }
    const row = b.closest('.sw-row');
    if (!row) return;
    const thing = row.dataset.thing;
    c = load();
    if (b.classList.contains('sw-decide')) c = decide(c, thing);
    else if (b.classList.contains('sw-kill')) c = kill(c, thing);
    else if (b.classList.contains('sw-defer')) { const d = row.querySelector('.sw-date').value; if (!isDay(d)) return; c = defer(c, thing, d); }
    save(c); row.remove();
    if (!el.querySelector('.sw-row')) el.remove();
  });
}

function run(text, api) {
  const b = bumpOf(text, tracked);
  if (b) { const c = bump(load(), b.kind, b.thing); save(c); const o = c[b.thing]; if (api.say) api.say(b.thing + ': ' + o.edits + ' edit' + (o.edits === 1 ? '' : 's') + ', ' + o.decisions + ' decision' + (o.decisions === 1 ? '' : 's')); return 'stale-work'; }
  if (staleIntent(text)) { show(api); return 'stale-work'; }
  return 'none';
}

export default {
  name: 'stale-work',
  examples: ['show stale work', 'note that I edited the pitch', 'note that I decided the pitch'],
  nearMisses: ['stale bread recipe', 'I edited a photo yesterday', 'how do I show my work in maths'],
  match(lower, text) { const t = text || lower; return staleIntent(t) || !!bumpOf(t, tracked); },
  run
};
