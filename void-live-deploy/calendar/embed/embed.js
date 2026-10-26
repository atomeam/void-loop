// The embedded calendar: reads the share link after # (#share=<id>.<key>), asks /api/calshare for the calendar, and draws the next 60 days as text, read
// only, whatever key it holds (it never writes). An embed code for another site's page is made from a calendar's view link on /calendar/ (Calendars pane).
import * as C from '/lib/calendar.js';
import { fromHash } from '/lib/calshare.js';
const $ = (id) => document.getElementById(id), lang = navigator.language || 'en', de = /^de\b/i.test(lang);
const W = de ? { none: 'Nichts in den nächsten 60 Tagen', bad: 'Dieser Link öffnet keinen Kalender mehr.', away: 'Der Kalender ist gerade nicht erreichbar.', open: 'In Verse öffnen', sub: 'Die nächsten 60 Tage', all: 'ganztägig', more: 'Wiederholung' }
  : { none: 'Nothing in the next 60 days', bad: 'This link no longer opens a calendar.', away: 'The calendar cannot be reached just now.', open: 'Open in Verse', sub: 'The next 60 days', all: 'all day', more: 'repeats' };
document.documentElement.lang = de ? 'de' : 'en'; $('open').textContent = W.open; $('sub').textContent = W.sub;
const el = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; };
const link = fromHash(location.hash);
async function main() {
  const out = $('list');
  if (!link) { out.append(el('p', 'err', W.bad)); return; }
  $('open').href = '/calendar/#share=' + link.id + '.' + link.key;
  let r; try { r = await fetch('/api/calshare?id=' + link.id, { headers: { 'x-cal-key': link.key } }); } catch (_) { out.append(el('p', 'err', W.away)); return; }
  const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) { out.append(el('p', 'err', r.status === 404 ? W.bad : W.away)); return; }
  $('name').textContent = j.name; document.title = j.name + ' · Verse'; if (/^#[0-9a-f]{6}$/i.test(j.color || '')) $('title').style.setProperty('--c', j.color);
  const now = new Date(), from = C.dayKey(now), to = C.dayKey(C.addDays(now, 59)), byDay = new Map();
  for (const o of C.agenda(j.events || [], from, to)) { const k = o.start.slice(0, 10); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(o); }
  if (!byDay.size) { out.append(el('p', 'empty', W.none)); return; }
  for (const [k, list] of byDay) {
    out.append(el('h2', '', C.fmtDay(C.parseLocal(k), lang, { year: C.parseLocal(k).getFullYear() !== now.getFullYear() })));
    const ul = el('ul'); for (const o of list) { const li = el('li'), n = el('span', 'n'); li.append(el('span', 't', o.allDay ? W.all : C.fmtTime(C.parseLocal(o.start), lang))); n.append(document.createTextNode(o.title)); if (o.location) n.append(el('span', 'l', o.location)); li.append(n); ul.append(li); }
    out.append(ul);
  }
}
main();
