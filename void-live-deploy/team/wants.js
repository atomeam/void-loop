// Verse's own wants and its crew, live from /api/crew (lib/team-crew-run.js crewView), on /team/ and /brain/ (owner, 2026-11-03: "Verse's
// real brain should generate a never-ending queue of its own real wants and needs ... show the live queue on /team/ and /brain/"). Each want
// names the evidence it came from and the one number that closes it; a private want (what visitors typed, sales) shows neither. Nothing is
// sent from here; the week's bets (Verse's own priorities, lib/team-priorities.js) fill every element marked data-crew-bets; the list is read again every minute while the page is seen. Fills every element marked data-crew-wants.
import { crewNext } from '/lib/team.js';
const boxes = [...document.querySelectorAll('[data-crew-wants]')], betBoxes = [...document.querySelectorAll('[data-crew-bets]')];
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
  if (crewList) crewList.replaceChildren(...j.crew.map((c) => { const li = node('li'); li.append(node('b', c.name), ' ', node('span', crewNext(c.next) + ' · ' + c.done + ' done', 'wsub'), node('span', c.did ? 'Last: ' + c.did + (c.didAt ? ' (' + ago(c.didAt) + ')' : '') : 'Nothing done yet.', 'wsrc')); return li; }));
}

function bets(box, j) {
  const p = j && j.ok ? j.priorities : null, list = box.querySelector('[data-list]'), sum = box.querySelector('[data-sum]');
  if (!p) { sum.textContent = j && j.ok ? 'Verse has not ranked its queue yet: it does on the crew\'s next run.' : 'The priorities could not be read just now.'; list.replaceChildren(); return; }
  sum.replaceChildren('Ranked ' + ago(p.at) + ' (' + p.why + '), ' + p.week + '. Impact (revenue, exam-score gain, breakage, Tower easiest-first) ÷ effort × confidence. WIP: ' + p.wip.build + ' build lanes + ' + p.wip.research + ' research lane.');
  if (p.brief) { const a = node('a', ' The pinned brief in #work.'); a.href = '/team/#c=work&t=' + p.brief; sum.append(a); }
  if (p.override && (p.override.pin.length || p.override.drop.length)) sum.append(node('span', ' Owner override: ' + [...p.override.pin.map((x) => x + ' first'), ...p.override.drop.map((x) => x + ' last')].join(', ') + '.', 'wsub'));
  const row = (b, i) => { const li = node('li'); li.dataset.state = 'bet'; li.append(node('span', i == null ? String(b.score) : 'Bet ' + (i + 1), 'wst'), ' ', node('b', b.title || b.id), ' ', node('span', b.ask, 'wask'), node('span', b.lane + ' · score ' + b.score + ' = impact ' + b.impact + ' × confidence ' + b.confidence + ' ÷ effort ' + b.effort + (b.override ? ' · ' + b.override : '') + ' · job ' + b.id + ' · why: ' + b.drivers.join('; '), 'wsub'));
    if (b.evidence && b.evidence.length) { const s = node('span', 'Evidence: ', 'wsrc'); b.evidence.forEach((e, k) => { if (k) s.append(' · '); const a = node('a', e.what); a.href = e.url; a.rel = 'noopener'; s.append(a); }); li.append(s); }
    return li; };
  list.replaceChildren(...(p.bets.length ? p.bets.map((b, i) => row(b, i)) : [node('li', 'No bet: nothing is on the queue.')]), ...(p.next.length ? [node('li', 'Then, in order: ' + p.next.map((r) => (r.title || r.id) + ' (' + r.score + ')').join(' · '), 'wsub')] : []));
}

async function load() {
  if ((!boxes.length && !betBoxes.length) || document.visibilityState === 'hidden') return;
  let j = null; try { const r = await fetch('/api/crew', { cache: 'no-cache' }); j = r.ok ? await r.json() : null; } catch (_) { j = null; }
  for (const b of boxes) draw(b, j);
  for (const b of betBoxes) bets(b, j);
}
load(); setInterval(load, 60e3);
