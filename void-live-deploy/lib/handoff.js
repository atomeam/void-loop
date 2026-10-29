// lib/handoff.js: carrying a list between the prize, picking and scoring pages (/wheel/, /prizes/, /tournaments/, with /random/ and
// /generators/ in the same strip). The list always travels in the link it opens; a click on a "send" link also leaves one copy in this
// browser's localStorage (verse_handoff: { type, label, data, fromPage }) so the next page can offer a quiet "Paste from /x/" pill. Nothing
// is written until a person clicks, and nothing leaves the browser: no server, no account. Tests: tools/handoff.test.mjs.
import { pack, entriesOf } from './wheel.js';
import { parseSlices, labelsOf } from './prizes.js';

export const KEY = 'verse_handoff';
export const RING = Object.freeze([['/wheel/', 'Wheel of names'], ['/prizes/', 'Prize odds'], ['/tournaments/', 'Tournament standings'], ['/random/', 'Random number'], ['/generators/', 'Generators']]);
/** Game night: the point system a roster from the wheel starts under (every team on 0 until a result is typed) */
export const GAME_NIGHT = Object.freeze({ name: 'Game night', win: 3, top5: 1, elim: 0 });
const MAX = 200;
const clean = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
const teamName = (s) => clean(String(s == null ? '' : s).replace(/[:;,]/g, ' ')).slice(0, 40);
const uniq = (names) => { const seen = new Set(); return names.filter((n) => { const k = n.toLowerCase(); if (!n || seen.has(k)) return false; seen.add(k); return true; }).slice(0, MAX); };

/** labels from any list text: wheel lines ("Ann *3"), prize lines ("TV:500:1") or plain names, suffixes off */
export const labelsFrom = (text) => uniq(labelsOf(parseSlices(text)));

/** the links that carry a list (null when there is nothing to carry) */
export const wheelLink = (labels) => { const e = entriesOf(uniq(labels.map(clean)).join('\n')); return e.length ? '/wheel/#' + pack(e) : null; };
export const prizesLink = (text) => { const t = String(text == null ? '' : text).trim().slice(0, 20000); return t ? '/prizes/?s=' + encodeURIComponent(t) : null; };
export const tournamentsLink = (labels) => { const r = uniq(labels.map(teamName)); return r.length ? '/tournaments/?roster=' + encodeURIComponent(r.join('\n')) + '&preset=gamenight' : null; };

/** the roster a link carries to /tournaments/: [{ name, points: 0 }], names cleaned the way the scorer cleans them, each once */
export function rosterOf(search) {
  const raw = new URLSearchParams(search || '').get('roster'); if (!raw) return [];
  const lines = /\n/.test(raw) ? raw.split('\n') : raw.split(',');
  return uniq(lines.map(teamName)).map((name) => ({ name, points: 0 }));
}

/** the handoff in this browser, or null */
export function get(store = globalThis.localStorage) {
  try {
    const h = JSON.parse(store.getItem(KEY) || 'null');
    if (!h || typeof h !== 'object' || typeof h.fromPage !== 'string' || !RING.some(([p]) => p === h.fromPage)) return null;
    const data = Array.isArray(h.data) ? h.data.map(clean).filter(Boolean).slice(0, MAX) : typeof h.data === 'string' ? h.data.slice(0, 20000) : null;
    if (!data || !data.length) return null;
    return { type: h.type === 'slices' ? 'slices' : 'list', label: clean(h.label) || 'a list', data, fromPage: h.fromPage };
  } catch (_) { return null; }
}
/** keep one handoff (called from a click only) */
export function put(type, label, data, fromPage, store = globalThis.localStorage) {
  try { store.setItem(KEY, JSON.stringify({ type, label: clean(label), data, fromPage })); return true; } catch (_) { return false; }
}
/** a handoff's list as text a page can read (prize lines kept; a plain list one name a line) */
export const textOfHandoff = (h) => (!h ? '' : typeof h.data === 'string' ? h.data : h.data.join('\n'));

const css = 'display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;font-size:13px;margin:14px 0 4px;';
const linkCss = 'color:inherit;text-decoration:underline;text-underline-offset:3px;';

/** the strip: the other pages of the ring, then any send links ({ label, go: () => ({ href, type, data, name }) | null }) */
export function mountStrip(before, here, sends = []) {
  const doc = before.ownerDocument, nav = doc.createElement('nav');
  nav.className = 'vh-strip'; nav.setAttribute('aria-label', 'Prizes, picks and scores'); nav.style.cssText = css;
  const lab = doc.createElement('span'); lab.textContent = 'Prizes, picks and scores:'; lab.style.opacity = '0.75'; nav.append(lab);
  for (const [p, name] of RING) if (p !== here) { const a = doc.createElement('a'); a.href = p; a.textContent = name; a.style.cssText = linkCss; nav.append(a); }
  for (const s of sends) nav.append(sendLink(doc, here, s));
  before.parentNode.insertBefore(nav, before);
  return nav;
}
/** one send link: its href is worked out when it is pressed (so it carries what is on the page now); the click keeps a handoff copy */
export function sendLink(doc, here, s) {
  const a = doc.createElement('a'); a.href = '#'; a.textContent = s.label + ' →'; a.style.cssText = linkCss + 'font-weight:600;'; a.className = 'vh-send';
  const at = () => { const r = s.go(); if (r && r.href) a.href = r.href; return r; };
  a.addEventListener('pointerdown', at);
  a.addEventListener('click', (e) => {
    const r = at(); if (!r || !r.href) { e.preventDefault(); if (s.empty) s.empty(); return; }
    put(r.type || 'list', r.name || s.label, r.data, here);
  });
  return a;
}

/** the quiet pill: "Paste from /wheel/ · 6 names", shown when another ring page left a handoff; onPaste(handoff) takes it */
export function mountPill(before, here, onPaste) {
  const h = get(); if (!h || h.fromPage === here) return null;
  const doc = before.ownerDocument, wrap = doc.createElement('p');
  wrap.className = 'vh-pill'; wrap.style.cssText = 'margin:8px 0;display:flex;gap:6px;align-items:center;flex-wrap:wrap;';
  const b = doc.createElement('button'); b.type = 'button';
  const n = typeof h.data === 'string' ? labelsFrom(h.data).length : h.data.length;
  b.textContent = 'Paste from ' + h.fromPage + ' · ' + n + (n === 1 ? ' item' : ' items');
  b.setAttribute('aria-label', 'Paste ' + h.label + ' from ' + h.fromPage + ' (' + n + (n === 1 ? ' item' : ' items') + ')');
  b.style.cssText = 'border-radius:999px;font-size:13px;padding:4px 12px;min-height:32px;opacity:.9;';
  const x = doc.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'Dismiss the paste offer');
  x.style.cssText = 'border-radius:999px;font-size:13px;padding:4px 10px;min-height:32px;opacity:.7;';
  b.addEventListener('click', () => { wrap.remove(); onPaste(h); });
  x.addEventListener('click', () => wrap.remove());
  wrap.append(b, x); before.parentNode.insertBefore(wrap, before);
  return wrap;
}

/** /tournaments/: one isolated hook (its own script) so the scorer's code stays as it is. A ?roster= link (or a pasted list) shows the
 *  roster under Game night points, everyone on 0; the strip sends the teams on to the wheel or the prize page. */
export function hookTournaments(search, doc = globalThis.document) {
  const $ = (sel) => doc.querySelector(sel);
  const standings = $('section[aria-labelledby="h-standings"]'), results = $('section[aria-labelledby="h-results"]') || standings;
  if (!standings) return;
  let card = null;
  const show = (names) => {
    const roster = uniq(names.map(teamName)).map((name) => ({ name, points: 0 })); if (!roster.length) return;
    if (card) card.remove();
    card = doc.createElement('section'); card.className = 'card'; card.id = 'roster'; card.setAttribute('aria-labelledby', 'h-roster');
    const h = doc.createElement('h2'); h.id = 'h-roster'; h.textContent = 'Roster · ' + GAME_NIGHT.name;
    const note = doc.createElement('p'); note.className = 'note';
    const sel = doc.getElementById('preset'), native = !!(sel && [...sel.options].some((o) => o.value === 'gamenight')); // the scorer's own Game night preset
    note.textContent = roster.length + (roster.length === 1 ? ' team' : ' teams') + ' brought here, every one on 0 points until a result is typed. ' + (native
      ? GAME_NIGHT.name + ': each round\'s score is added straight on, and the top score takes the round. The teams are in the scorer\'s grid and its share link.'
      : GAME_NIGHT.name + ' points: ' + GAME_NIGHT.win + ' for a win, ' + GAME_NIGHT.top5 + ' for 2nd to 5th.');
    const wrap = doc.createElement('div'); wrap.className = 'scroll';
    const t = doc.createElement('table'); t.id = 'rostertable';
    const cap = doc.createElement('caption'); cap.textContent = 'The roster, before any match';
    const head = doc.createElement('thead'), hr = doc.createElement('tr');
    for (const c of ['#', 'Team', 'Points']) { const th = doc.createElement('th'); th.scope = 'col'; th.textContent = c; hr.append(th); }
    head.append(hr); const body = doc.createElement('tbody');
    roster.forEach((r, i) => { const tr = doc.createElement('tr'); for (const v of [String(i + 1), r.name, String(r.points)]) { const td = doc.createElement('td'); td.textContent = v; tr.append(td); } body.append(tr); });
    t.append(cap, head, body); wrap.append(t);
    const row = doc.createElement('div'); row.className = 'row';
    const use = doc.createElement('button'); use.type = 'button'; use.id = 'gamenight'; use.textContent = 'Score with ' + GAME_NIGHT.name + ' points';
    use.addEventListener('click', () => {
      if (native) { sel.value = 'gamenight'; sel.dispatchEvent(new Event('change', { bubbles: true })); return; }
      for (const [id, v] of [['win', GAME_NIGHT.win], ['top5', GAME_NIGHT.top5], ['elim', GAME_NIGHT.elim]]) { const el = doc.getElementById(id); if (el) { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); } }
      const say = doc.getElementById('say'); if (say) say.textContent = GAME_NIGHT.name + ' points set: ' + GAME_NIGHT.win + ' for a win, ' + GAME_NIGHT.top5 + ' for 2nd to 5th, ' + GAME_NIGHT.elim + ' per elimination.';
    });
    row.append(use); card.append(h, note, wrap, row);
    results.parentNode.insertBefore(card, results);
  };
  const fromLink = rosterOf(search); if (fromLink.length) show(fromLink.map((r) => r.name));
  const names = () => {
    if (card) return [...card.querySelectorAll('tbody tr td:nth-child(2)')].map((td) => td.textContent);
    const s = doc.getElementById('standings'); return s ? [...s.querySelectorAll('tbody tr')].map((tr) => (tr.cells[1] ? tr.cells[1].textContent : '')).filter(Boolean) : [];
  };
  mountPill(results, '/tournaments/', (h) => show(labelsFrom(textOfHandoff(h))));
  const footer = $('main > footer') || standings.nextElementSibling || standings;
  mountStrip(footer, '/tournaments/', [
    { label: 'Spin these teams on the wheel', go: () => { const n = names(); return n.length ? { href: wheelLink(n), data: n, name: 'teams' } : null; } },
    { label: 'Prize odds for these teams', go: () => { const n = names(); return n.length ? { href: prizesLink(n.join('\n')), data: n, name: 'teams' } : null; } },
  ]);
}
