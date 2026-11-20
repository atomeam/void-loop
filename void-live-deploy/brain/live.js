// /brain/'s live brain (docs/brain.md): every region is a real part of Verse, lit by how recently it really fired (GET /api/brain). Click a
// region for its true state and recent events. The chain under it is the newest real one: sense -> want -> job -> PR -> result -> lesson.
// Nothing here is simulated; the old simulation is the separate "Simulation" view (brain/knows.js).
const $ = (s, r = document) => r.querySelector(s);
const root = $('#liveBrain');
const SVGNS = 'http://www.w3.org/2000/svg';
// where each region sits in the picture: input on the left, memory in the middle, output on the right, drives and sleep underneath
const AT = { senses: [95, 230], attention: [210, 120], working: [355, 85], episodic: [285, 235], semantic: [440, 215], procedural: [585, 255],
  reflection: [385, 335], planning: [530, 110], action: [680, 170], evaluation: [700, 320], lessons: [560, 390], sleep: [215, 370], drives: [400, 440] };
const HUE = { senses: 190, attention: 45, working: 280, episodic: 330, semantic: 210, procedural: 160, reflection: 300, planning: 25, action: 0, evaluation: 120, lessons: 95, sleep: 245, drives: 350 };
const el = (tag, attrs = {}, text) => { const n = tag.startsWith('svg:') ? document.createElementNS(SVGNS, tag.slice(4)) : document.createElement(tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (text != null) n.textContent = text; return n; };
const ago = (at) => { const t = Date.parse(at); if (!Number.isFinite(t)) return ''; const s = Math.max(0, (Date.now() - t) / 1000); return s < 90 ? 'just now' : s < 5400 ? Math.round(s / 60) + ' min ago' : s < 129600 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' d ago'; };
const et = (at) => { const t = Date.parse(at); return Number.isFinite(t) ? new Date(t).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET' : ''; };
// how lit a region is: 1 when it fired in the last 10 minutes, fading to a low glow at a day, dark when it never fired
const heat = (at) => { const t = Date.parse(at); if (!Number.isFinite(t)) return 0; const h = (Date.now() - t) / 36e5; return h < 1 / 6 ? 1 : Math.max(0.12, 1 - Math.log10(1 + h * 6) / Math.log10(1 + 24 * 6) * 0.88); };

let data = null, pick = 'senses', seen = new Map();
function draw() {
  if (!root || !data) return;
  const svg = $('#lbMap', root); svg.replaceChildren();
  const defs = el('svg:defs'); defs.innerHTML = '<filter id="lbGlow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="9"/></filter>'; svg.append(defs);
  svg.append(el('svg:path', { d: 'M60,250 C40,120 170,40 330,50 C430,20 560,30 650,80 C760,130 790,260 730,350 C680,430 560,470 430,470 C300,480 160,440 100,370 C70,340 62,300 60,250Z', class: 'lb-shell' }));
  const by = Object.fromEntries(data.regions.map((r) => [r.id, r]));
  for (const [a, b] of data.flow || []) {
    if (!AT[a] || !AT[b]) continue;
    const [x1, y1] = AT[a], [x2, y2] = AT[b], mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 18;
    const live = heat(by[a] && by[a].last) > 0.6;
    svg.append(el('svg:path', { d: `M${x1},${y1} Q${mx},${my} ${x2},${y2}`, class: 'lb-flow' + (live ? ' on' : ''), style: '--h:' + HUE[a] }));
  }
  for (const r of data.regions) {
    const [x, y] = AT[r.id] || [0, 0], h = heat(r.last), fresh = r.last && seen.has(r.id) && seen.get(r.id) !== r.last;
    const g = el('svg:g', { class: 'lb-region' + (pick === r.id ? ' picked' : '') + (fresh ? ' fresh' : '') + (h === 0 ? ' dark' : ''), tabindex: '0', role: 'button', 'aria-label': r.name + (r.last ? ', last fired ' + ago(r.last) : ', not fired yet'), style: `--h:${HUE[r.id]};--heat:${h.toFixed(2)}` });
    g.append(el('svg:circle', { cx: x, cy: y, r: 34, class: 'lb-halo', filter: 'url(#lbGlow)' }), el('svg:circle', { cx: x, cy: y, r: 24, class: 'lb-core' }));
    g.append(el('svg:text', { x, y: y + 44, class: 'lb-name' }, r.name.replace(' (the will)', '')), el('svg:text', { x, y: y + 58, class: 'lb-when' }, r.last ? ago(r.last) : 'not yet'));
    const go = () => { pick = r.id; draw(); }; g.addEventListener('click', go); g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    svg.append(g);
  }
  const r = by[pick] || data.regions[0], side = $('#lbSide', root); side.replaceChildren();
  side.append(el('h3', {}, r.name), el('p', { class: 'lb-does' }, r.does));
  const st = el('ul', { class: 'lb-state' }); for (const s of r.state || []) st.append(el('li', {}, s)); side.append(el('h4', {}, 'Right now'), st);
  side.append(el('h4', {}, 'Recent events'));
  const evs = el('ol', { class: 'lb-events' });
  for (const e of r.events || []) { const li = el('li'); li.append(el('time', { datetime: e.at || '' }, et(e.at))); if (e.url) { const a = el('a', { href: e.url, target: '_blank', rel: 'noopener' }, e.text); li.append(a); } else li.append(el('span', {}, e.text)); evs.append(li); }
  if (!evs.children.length) evs.append(el('li', { class: 'lb-none' }, 'No event yet.'));
  side.append(evs);
  const ch = $('#lbChain', root); ch.replaceChildren();
  const c = data.chain, step = (name, part, text) => { const li = el('li', { class: part ? 'got' : 'not' }); li.append(el('b', {}, name)); if (part && part.url) li.append(el('a', { href: part.url, target: '_blank', rel: 'noopener' }, text)); else li.append(el('span', {}, part ? text : 'not yet')); return li; };
  if (c) ch.append(step('Sense', c.sense, c.sense && (c.sense.text + (c.sense.value != null ? ': ' + c.sense.value : ''))), step('Want', c.want, c.want && c.want.text), step('Job', c.job, c.job && (c.job.id + ' · ' + c.job.state)),
    step('Pull request', c.pr, c.pr && ('#' + c.pr.url.split('/').pop())), step('Result', c.result, c.result && c.result.text), step('Lesson', c.lesson, c.lesson && c.lesson.text));
  else ch.append(el('li', { class: 'not' }, 'No chain yet: no want has a job.'));
  const dv = $('#lbDrives', root); dv.replaceChildren();
  for (const d of data.drives || []) { const li = el('li', { class: d.value == null ? 'not' : '' }); li.append(el('b', {}, d.id), el('span', { class: 'v' }, d.value == null ? '—' : String(d.value)), el('span', { class: 'u' }, d.value == null ? d.unit : d.unit + (d.more ? ' · ' + d.more : '')), el('em', {}, d.line)); dv.append(li); }
  $('#lbAt', root).textContent = 'Read ' + ago(data.at) + ' from /api/brain' + (data.cached ? ' (kept a minute at the edge)' : '');
  for (const g of data.regions) seen.set(g.id, g.last);
}
async function load() {
  try { const r = await fetch('/api/brain', { cache: 'no-cache' }); if (!r.ok) throw new Error('status ' + r.status); const j = await r.json(); if (!j.regions) throw new Error('no regions'); data = j; draw(); root.dataset.ready = '1'; }
  catch (e) { if (!data && root) $('#lbAt', root).textContent = 'The live brain could not be read just now; it tries again in a minute.'; }
}
if (root) { load(); setInterval(() => { if (!document.hidden) load(); }, 30000); setInterval(() => { if (data && !document.hidden) draw(); }, 60000); }
