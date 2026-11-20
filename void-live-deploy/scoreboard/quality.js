// The quality board on /scoreboard/: each surface's measured score out of 100 over time, the improvement rate, and every improve-and-verify cycle with what it cost.
// Read from /quality/board.json (ids and numbers only). Built with the DOM and textContent, so nothing read here is ever parsed as HTML.
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = String(text); if (cls) e.className = cls; return e; };
const NS = 'http://www.w3.org/2000/svg';
const svg = (w, h, kids) => { const s = document.createElementNS(NS, 'svg'); s.setAttribute('viewBox', '0 0 ' + w + ' ' + h); s.setAttribute('width', w); s.setAttribute('height', h); s.setAttribute('role', 'img'); for (const k of kids) s.append(k); return s; };
const node = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
export const last = (s) => (s.history[s.history.length - 1] || {}).total;
/** a sparkline of one surface's scores, 0 to 100 */
export function spark(history) {
  const w = 96, h = 22, pts0 = history.length === 1 ? [history[0], history[0]] : history, pts = pts0.map((p, i) => [(i / Math.max(1, pts0.length - 1)) * w, h - (Math.max(0, Math.min(100, p.total)) / 100) * h]);
  return svg(w, h, [node('polyline', { points: pts.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '), fill: 'none', stroke: '#b6a9ff', 'stroke-width': 2 }), ...(pts.length ? [node('circle', { cx: pts[pts.length - 1][0], cy: pts[pts.length - 1][1], r: 2.5, fill: '#fff' })] : [])]);
}
/** bars of the points gained each day */
export function bars(series) {
  const w = 280, h = 70, max = Math.max(1, ...series.map((d) => d.gained)), bw = w / Math.max(1, series.length);
  return svg(w, h, series.map((d, i) => node('rect', { x: (i * bw + 1).toFixed(1), y: (h - (d.gained / max) * (h - 4) - 2).toFixed(1), width: (bw - 2).toFixed(1), height: ((d.gained / max) * (h - 4) + 2).toFixed(1), fill: d.gained > 0 ? '#7ee0a8' : '#2c3045' })));
}
export async function draw(into, fetchJson = (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)) {
  const b = await fetchJson('/quality/board.json'), box = el('section'); box.append(el('h2', 'Quality board'));
  if (!b || !b.board || !b.board.surfaces || !b.board.surfaces.length) { box.append(el('p', 'No surface has been measured yet.', 'note')); into.after(box); return box; }
  const s = b.summary || {}, r = b.rate || {}, rows = b.board.surfaces.filter((x) => x.history.length).sort((x, y) => last(x) - last(y));
  box.append(el('p', 'Each surface is scored out of 100 on how it looks and on whether it is right, against the best there is. ' + (s.surfaces || rows.length) + ' surfaces measured, average ' + (s.average == null ? 'unknown' : s.average) + ', ' + (s.passing || 0) + ' at the top.', 'note'));
  const rate = el('p'); rate.append('Improvement rate, last 7 days: ' + (r.gained || 0) + ' points gained, ' + (r.perDay || 0) + ' a day, ' + (r.cyclesPerDay || 0) + ' cycles a day' + (r.perDollar != null ? ', ' + r.perDollar + ' points per dollar' : ', no money spent') + '. ');
  box.append(rate); const ser = b.series || []; if (ser.some((d) => d.gained > 0)) box.append(bars(ser)); else box.append(el('p', 'No improve-and-verify cycle has finished yet, so there is no rate to chart.', 'note'));
  const wp = await fetchJson('/quality/win-posts.json'); if (wp && wp.reach && wp.reach.posts) box.append(el('p', 'Shared on X: ' + wp.reach.posts + ' posts, ' + wp.reach.views + ' views, ' + wp.reach.likes + ' likes.', 'note'));
  const t = el('table'), head = el('tr'); for (const c of ['Surface', 'Score', 'Over time']) head.append(el('th', c)); t.append(head);
  for (const x of rows.slice(0, 25)) { const tr = el('tr'); tr.append(el('td', x.id), el('td', last(x)), (() => { const td = el('td'); td.append(spark(x.history)); return td; })()); t.append(tr); }
  box.append(t);
  const cyc = (b.cycles || []).slice(-8).reverse();
  if (cyc.length) {
    box.append(el('h3', 'Improve and verify'));
    const ul = el('ul');
    for (const c of cyc) { const res = (c.results || []).map((x) => x.id + ' ' + x.before + ' to ' + x.after + (x.kept ? '' : ' (undone)')).join(', '); ul.append(el('li', c.at.slice(0, 16).replace('T', ' ') + ' UTC · ' + c.improver + ' · ' + (c.kept ? 'kept, +' + c.gain : 'undone') + ' · ' + (res || c.why || '') + ' · cost ' + ((c.cents || 0) ? '$' + (c.cents / 100).toFixed(2) : 'nothing paid') + (c.minutes ? ', ' + c.minutes + ' min' : ''))); }
    box.append(ul);
  }
  into.after(box); return box;
}
