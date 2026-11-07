// Web Lore's list (a-to-mind.com/lore/): reads /lore.json and draws every shelf with text nodes, never parsed HTML.
const $ = (id) => document.getElementById(id);
const el = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
let LORE = null;
function tally(l) {
  const box = $('tally'); box.textContent = '';
  for (const [n, label] of [[l.count, 'sites'], [l.documented, 'with a cited history'], [l.facts, 'cited facts'], [l.cats.length, 'categories']]) {
    const d = el('div'); d.append(el('b', Number(n).toLocaleString()), el('span', label)); box.append(d);
  }
}
function draw(q = '') {
  const want = q.trim().toLowerCase(), box = $('shelves'); box.textContent = '';
  const by = new Map(); for (const s of LORE.sites) { if (!by.has(s.c)) by.set(s.c, []); by.get(s.c).push(s); }
  let shown = 0;
  for (const [cat] of LORE.cats) {
    const all = by.get(cat) || [], hit = want && cat.toLowerCase().includes(want);
    const rows = want && !hit ? all.filter((s) => s.n.toLowerCase().includes(want) || s.s.includes(want) || String(s.u).toLowerCase().includes(want)) : all;
    if (!rows.length) continue;
    shown += rows.length;
    const d = el('details'), sum = el('summary', cat + ' '); sum.append(el('span', '(' + rows.length + ')')); d.append(sum);
    if (want) d.open = true;
    const ul = el('ul');
    for (const s of rows) {
      const li = el('li'), a = el('a', s.n); a.href = '/lore/' + encodeURIComponent(s.s);
      li.append(a, el('span', s.st, 'st'));
      if (s.f) li.append(el('span', s.f + (s.f === 1 ? ' fact' : ' facts'), 'doc'));
      ul.append(li);
    }
    d.append(ul); box.append(d);
  }
  if (!shown) box.append(el('p', 'No site or category matches that yet.', 'note'));
}
try {
  const r = await fetch('/lore.json'); if (!r.ok) throw new Error(r.status);
  LORE = await r.json(); tally(LORE); draw();
  $('find').addEventListener('input', (e) => draw(e.target.value));
} catch (_) { $('shelves').textContent = ''; $('shelves').append(el('p', 'Web Lore did not load just now. Reload the page to try again.', 'note')); }
