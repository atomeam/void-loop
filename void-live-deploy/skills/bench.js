/**
 * bench skill - the Bench icon (asked by Void, 2026-10-16: "a functional 'Bench' icon on the stage that counts active false
 * alarms"). "show the bench" puts a small bench on the stage with a number on it: how many of Verse's review findings a person
 * read and found wrong and that are still on record (tools/review-noise.json, written to /bench-alarms.json by
 * tools/bench-alarms.mjs at each deploy). Tap it and it lists them, file and line and why. The everyday bench's last score sits
 * under it. A bench with nothing on record says 0, not a guess. "park bench" and "bench press" are not this.
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
/** the ask wants the bench icon. Pure. */
export const benchOf = (text) => /^(?:(?:show|open|add|make|give)\s+(?:me\s+)?(?:the\s+|a\s+|my\s+)?)?(?:bench(?:\s+icon)?|bench\s+alarms|(?:the\s+)?false\s+alarms)$/.test(CLEAN(text));

/** the icon's number and its list from the file's content. Pure; null when the file has none. */
export function countOf(j) {
  if (!j || !Number.isFinite(+j.falseAlarms)) return null;
  const alarms = (Array.isArray(j.alarms) ? j.alarms : []).slice(0, 20).map((a) => ({ file: String(a.file || '').slice(0, 120), line: +a.line || 0, why: String(a.why || '').slice(0, 200) }));
  return { n: +j.falseAlarms, alarms, bench: j.bench && Number.isFinite(+j.bench.score) ? { score: +j.bench.score, total: +j.bench.total } : null };
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing bench-card'; el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:200px;padding:8px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(20,20,30,.75);font-size:12px';
  const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'bench-icon'; btn.setAttribute('aria-expanded', 'false');
  btn.style.cssText = 'display:flex;align-items:center;gap:8px;font:inherit;color:inherit;background:none;border:0;cursor:pointer;padding:0';
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 32 20'); svg.setAttribute('width', '32'); svg.setAttribute('height', '20'); svg.setAttribute('aria-hidden', 'true');
  for (const [x, y, w, h] of [[2, 4, 28, 4], [2, 10, 28, 3], [4, 13, 3, 6], [25, 13, 3, 6]]) { const r = document.createElementNS(NS, 'rect'); r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', w); r.setAttribute('height', h); r.setAttribute('fill', 'currentColor'); svg.appendChild(r); }
  const count = document.createElement('b'); count.className = 'bench-count'; count.textContent = '…';
  const label = document.createElement('span'); label.textContent = 'false alarms';
  btn.append(svg, count, label);
  const list = document.createElement('div'); list.className = 'bench-list'; list.hidden = true; list.style.cssText = 'margin-top:6px';
  const score = document.createElement('div'); score.className = 'bench-score'; score.style.cssText = 'margin-top:4px;opacity:.7';
  el.append(btn, list, score);
  btn.addEventListener('pointerdown', (e) => e.stopPropagation());
  btn.addEventListener('click', () => { list.hidden = !list.hidden; btn.setAttribute('aria-expanded', String(!list.hidden)); });
  fetch('/bench-alarms.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((j) => {
    const c = countOf(j);
    if (!c) { count.textContent = '?'; list.textContent = 'no record of the bench yet'; return; }
    count.textContent = String(c.n); count.dataset.n = String(c.n);
    list.textContent = '';
    if (!c.alarms.length) list.textContent = 'none on record';
    for (const a of c.alarms) { const d = document.createElement('div'); d.style.marginBottom = '4px'; d.textContent = a.file + ':' + a.line + ' — ' + a.why; list.appendChild(d); }
    if (c.bench) score.textContent = 'everyday bench: ' + c.bench.score + ' of ' + c.bench.total;
  });
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

async function run(text, api) {
  if (!benchOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'bench');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'bench'; }
  api.summon('bench', { x: 40, y: 140 });
  api.say('the bench: tap it to see which alarms were false');
  return 'bench';
}

export default {
  name: 'bench',
  examples: ['show the bench', 'bench icon', 'bench alarms'],
  nearMisses: ['park bench', 'bench press', 'what is a bench', 'benchmark my code'],
  match(lower, text) { return benchOf(text || lower); },
  run,
  benchOf, countOf,
  stageKinds: { bench: { mount } },
};
