// Verse's own wants and its crew, live from /api/crew (lib/team-crew-run.js crewView), on /team/ and /brain/ (owner, 2026-11-03: "Verse's
// real brain should generate a never-ending queue of its own real wants and needs ... show the live queue on /team/ and /brain/"). Each want
// names the evidence it came from and the one number that closes it; a private want (what visitors typed, sales) shows neither. Nothing is
// sent from here; the list is read again every minute while the page is seen. Fills every element marked data-crew-wants.
const boxes = [...document.querySelectorAll('[data-crew-wants]')];
const node = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - (typeof t === 'number' ? t : Date.parse(t))) / 60e3)); return !Number.isFinite(m) ? '' : m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
const fmt = (v) => (v == null ? '?' : Math.round(v * 10) / 10);
const STATE = { open: 'open', met: 'met', 'set aside': 'set aside' };

function want(w) {
  const li = node('li'); li.dataset.state = w.state;
  li.append(node('span', STATE[w.state] || w.state, 'wst'), ' ', node('b', w.title), ' ');
  const by = node('span', '', 'wsub');
  by.append('for ' + w.bot + ' · ' + (w.label || 'its number'));
  if (!w.private) by.append(': ' + fmt(w.baseline) + (w.latest != null && w.latest !== w.baseline ? ' → ' + fmt(w.latest) : '') + (w.better === 'down' ? ' (lower is better)' : ''));
  else by.append(' (kept private)');
  by.append(' · filed ' + ago(w.filed) + (w.met ? ' · met ' + ago(w.met) : '') + (w.reopened ? ' · reopened ' + w.reopened + '×' : ''));
  li.append(by);
  const src = node('span', '', 'wsrc');
  if (w.cite && w.cite.length) { src.append('Source: '); w.cite.forEach((c, i) => { if (i) src.append(' · '); const a = node('a', c.what || c.url); a.href = c.url; a.rel = 'noopener'; src.append(a); }); }
  if (w.thread) { if (src.childNodes.length) src.append(' · '); const a = node('a', 'its #work thread'); a.href = '/team/#c=work&t=' + w.thread; src.append(a); }
  if (src.childNodes.length) li.append(src);
  return li;
}

function draw(box, j) {
  const list = box.querySelector('[data-list]') || box, sum = box.querySelector('[data-sum]'), crewList = box.querySelector('[data-crew]');
  if (!j || !j.ok) { if (sum) sum.textContent = 'The wants could not be read just now.'; return; }
  if (sum) sum.textContent = j.open + ' open · ' + j.met + ' met' + (j.lastRun ? ' · the crew last ran ' + ago(j.lastRun.at) + ' (run ' + j.lastRun.run + ': ' + j.lastRun.jobs + ' jobs done, ' + j.lastRun.filed + ' wants filed, ' + j.lastRun.met + ' met)' : ' · the crew has not run yet');
  list.replaceChildren(...(j.wants.length ? j.wants.slice(0, 24).map(want) : [node('li', 'No want filed yet: the crew files them from the evidence on its next run.')]));
  if (crewList) crewList.replaceChildren(...j.crew.map((c) => { const li = node('li'); li.append(node('b', c.name), ' ', node('span', (c.here ? 'here' : 'away') + ' · ' + c.done + ' done', 'wsub'), node('span', c.did ? 'Last: ' + c.did + (c.didAt ? ' (' + ago(c.didAt) + ')' : '') : 'Nothing done yet.', 'wsrc')); return li; }));
}

async function load() {
  if (!boxes.length || document.visibilityState === 'hidden') return;
  let j = null; try { const r = await fetch('/api/crew', { cache: 'no-cache' }); j = r.ok ? await r.json() : null; } catch (_) { j = null; }
  for (const b of boxes) draw(b, j);
}
load(); setInterval(load, 60e3);
