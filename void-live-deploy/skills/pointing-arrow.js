/**
 * pointing-arrow skill — Posner's cueing test, promoted from the lab (fringe/attention-7.html).
 * "the pointing arrow", "posner cueing test". "test my attention" stays the lab frame (the suite counts that open).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { TRIALS, plan, sitting, byPart, median, selftest } from '../lib/pointing-arrow.js';

export { plan, sitting, byPart, selftest };

const WHEN = /^(?:(?:show|open|play|start|run|try|do|give me)\s+(?:me\s+)?)?(?:the\s+)?(?:pointing arrow|posner(?:\s+cue(?:ing)?)?(?:\s+test)?)$/i;
const KEY = 'a2m.fringe.posner.v1';
const CSS = '.pa-field{display:grid;grid-template-columns:1fr 1fr 1fr;align-items:center;justify-items:center;height:120px;border:1px solid rgba(255,255,255,.08);border-radius:14px;margin:8px 0}'
  + '.pa-box{width:64px;height:64px;border:1px solid rgba(255,255,255,.25);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:30px}'
  + '.pa-cue{font-size:34px;min-width:1.2em;text-align:center}.pa-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:center;margin:6px 0}'
  + '.pa-row button{font:inherit;color:inherit;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:8px 12px;cursor:pointer}'
  + '.pa-note{white-space:pre-line}';

function load(store) {
  try { const j = JSON.parse(store.getItem(KEY) || 'null'); if (j && Array.isArray(j.sittings)) return j.sittings.filter((s) => s && Number.isFinite(s.cost) && s.hour >= 0 && s.hour < 24); } catch (_) {}
  return [];
}
function save(store, sittings, warn) {
  try { store.setItem(KEY, JSON.stringify({ sittings: sittings.slice(-200) })); if (warn) warn.hidden = true; }
  catch (_) { if (warn) { warn.hidden = false; warn.textContent = 'This browser is not saving your sittings. They count for now and are gone after a reload.'; } }
}

function mount(el, doc, store) {
  const sittings = load(store);
  el.innerHTML = '<style>' + CSS + '</style><h2>The pointing arrow</h2>'
    + '<p class="sub">An arrow points left or right, then a star appears. Press F or J, or tap the side, as fast as you can. Most arrows tell the truth. Some lie. The gap is your cost of a misleading pointer. Posner measured this in 1980. Sittings stay in this browser, same as the lab.</p>'
    + '<div class="pa-field" aria-hidden="true"><div class="pa-box" data-side="L"></div><div class="pa-cue"></div><div class="pa-box" data-side="R"></div></div>'
    + '<div class="pa-row" data-keys><button type="button" data-s="L" disabled>F left</button><button type="button" data-s="R" disabled>J right</button></div>'
    + '<div class="pa-row"><button type="button" data-go>start ' + TRIALS + '</button></div>'
    + '<div data-warn role="alert" hidden></div><div data-state aria-live="polite"></div><div class="sub pa-note" data-score aria-live="polite"></div>'
    + '<div class="src">Source: Michael Posner, Orienting of attention, 1980. The same test as <a href="/fringe/attention-7.html">the lab page</a>. Kept in this browser.</div>';
  const q = (s) => el.querySelector(s);
  const box = (side) => el.querySelector('.pa-box[data-side="' + side + '"]');
  const buttons = (on) => { for (const b of el.querySelectorAll('[data-keys] button')) b.disabled = !on; };
  const clear = () => { box('L').textContent = ''; box('R').textContent = ''; q('.pa-cue').textContent = ''; };
  const score = () => {
    if (!sittings.length) { q('[data-score]').textContent = ''; return; }
    q('[data-score]').textContent = sittings.length + ' sitting' + (sittings.length > 1 ? 's' : '') + ' · your usual cost ' + Math.round(median(sittings.map((s) => s.cost))) + ' ms\n'
      + byPart(sittings).map((p) => p.part + ' ' + (p.n ? Math.round(p.cost) + ' ms (' + p.n + ')' : '–')).join(' · ') + (sittings.length < 8 ? '\nAbout 8 sittings, spread over the day, before comparing.' : '');
  };
  let run = null;
  const show = () => {
    const t = run.trials[run.i]; clear(); buttons(false);
    run.timer = setTimeout(() => {
      q('.pa-cue').textContent = t.cue === 'L' ? '←' : '→';
      run.timer = setTimeout(() => { q('.pa-cue').textContent = ''; box(t.side).textContent = '★'; run.at = performance.now(); buttons(true); }, 300 + Math.random() * 300);
    }, 400 + Math.random() * 400);
  };
  const answer = (s) => {
    if (!run || !run.at) return;
    const t = run.trials[run.i]; t.ms = performance.now() - run.at; t.correct = s === t.side; run.at = 0;
    q('[data-state]').textContent = t.correct ? '' : 'The star was on the ' + (t.side === 'L' ? 'left' : 'right');
    run.i++;
    if (run.i < TRIALS) { show(); return; }
    const r = sitting(run.trials); clear(); buttons(false); const go = q('[data-go]'); go.disabled = false; go.textContent = 'another ' + TRIALS;
    if (r.cost != null) { r.hour = new Date().getHours(); r.at = Date.now(); sittings.push(r); save(store, sittings, q('[data-warn]')); }
    q('[data-state]').textContent = r.cost == null ? 'Too many misses to measure this time.' : 'This sitting: after a true arrow ' + Math.round(r.valid) + ' ms, after a lying one ' + Math.round(r.invalid) + ' ms, so the wrong pointer cost you ' + Math.round(r.cost) + ' ms · ' + Math.round(r.errors * 100) + '% wrong';
    run = null; score();
  };
  q('[data-go]').addEventListener('click', () => { if (run) return; run = { trials: plan(TRIALS), i: 0, at: 0 }; q('[data-go]').disabled = true; q('[data-state]').textContent = ''; show(); });
  q('[data-keys]').addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b && !b.disabled) answer(b.getAttribute('data-s')); });
  const onKey = (e) => { const s = { f: 'L', j: 'R' }[String(e.key).toLowerCase()]; if (s && run && run.at) { e.preventDefault(); answer(s); } };
  doc.addEventListener('keydown', onKey);
  score();
  return () => { doc.removeEventListener('keydown', onKey); if (run && run.timer) clearTimeout(run.timer); };
}

function run(text, api) {
  if (!WHEN.test(String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' '))) return 'none';
  const { showPage } = api;
  showPage((el) => { mount(el, el.ownerDocument || globalThis.document, globalThis.localStorage); });
  return 'pointing-arrow';
}

export default {
  name: 'pointing-arrow',
  about: 'The pointing arrow: an arrow hints where a star will appear, and sometimes it lies. Your cost of a misleading pointer, from Posner 1980.',
  examples: ['the pointing arrow', 'posner cueing test', 'posner test'],
  nearMisses: ['test my attention', 'attention field mind', 'make an arrow', 'what is attention'],
  match(lower, text) { return WHEN.test(String(text || lower || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ')); },
  run,
  plan, sitting, byPart, selftest,
};
