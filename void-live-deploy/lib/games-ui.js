/**
 * games-ui: what every page under /games/ shares (owner, 2026-10-26: the games lane): a store on this device per game (try/catch: a private window keeps
 * it for the visit only), German for a German browser (the page's own words swapped in place from a table), a timer, the Share button and the
 * the page's own module mounts its related row (lib/toolkit.js). No game rules here.
 */
export const $ = (id) => document.getElementById(id);
export const lang = /^de\b/i.test(new URLSearchParams(location.search).get('lang') || navigator.language || '') ? 'de' : 'en';
/** a game's store: get() the saved object (with defaults), put(obj) saves it */
export function store(key, defaults = {}) {
  const k = 'a2m.void.games.' + key + '.v1';
  const get = () => { try { return { ...defaults, ...(JSON.parse(localStorage.getItem(k) || '{}') || {}) }; } catch (_) { return { ...defaults }; } };
  const put = (o) => { try { localStorage.setItem(k, JSON.stringify(o)); } catch (_) { /* private mode */ } };
  return { get, put };
}
const COMMON_DE = { 'New game': 'Neues Spiel', Undo: 'Rückgängig', Hint: 'Tipp', 'Share link': 'Link teilen', 'Free, no account, no ads. It runs on your device and works offline after one visit.': 'Kostenlos, kein Konto, keine Werbung. Läuft auf Ihrem Gerät und nach einem Besuch auch offline.', 'Link copied.': 'Link kopiert.', 'every game': 'alle Spiele', 'every tool': 'alle Werkzeuge',
  Chess: 'Schach', 'All games': 'Alle Spiele', Checkers: 'Dame', Solitaire: 'Patience', Mines: 'Minen', 'Word guess': 'Worträtsel', 'Slide and merge': 'Schieben und Verschmelzen', Games: 'Spiele', 'Klondike solitaire': 'Klondike-Patience', 'Hidden word': 'Verstecktes Wort' };
/** swap the page's words for German ones from `table` (text nodes whose whole text is a key), and the lede; returns t() for words made later */
export function german(table = {}, lede = '') {
  const all = { ...COMMON_DE, ...table }; const t = (s) => (lang === 'de' && all[s]) || s;
  if (lang !== 'de') return t;
  document.documentElement.lang = 'de';
  const walk = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT); const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
  for (const n of nodes) { const k = n.textContent.trim(); if (all[k]) n.textContent = n.textContent.replace(k, all[k]); }
  for (const o of document.querySelectorAll('option')) if (all[o.textContent]) o.textContent = all[o.textContent];
  if (lede) $('lede').textContent = lede;
  return t;
}
/** seconds as m:ss */
export const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
/** a timer that counts from start(), shown in el, kept as the moment it started so a background tab loses nothing */
export function timer(el) { let t0 = 0, iv = 0, stopped = 0; const show = () => { el.textContent = mmss(seconds()); }; const seconds = () => (t0 ? ((stopped || Date.now()) - t0) / 1000 : 0);
  return { start(from = 0) { t0 = Date.now() - from * 1000; stopped = 0; clearInterval(iv); iv = setInterval(show, 500); show(); }, stop() { if (!stopped && t0) stopped = Date.now(); clearInterval(iv); show(); return seconds(); }, reset() { t0 = 0; stopped = 0; clearInterval(iv); el.textContent = '0:00'; }, seconds, running: () => !!t0 && !stopped }; }
/** the Share button: the link (with the settings given) shared or copied, said in `say` */
export function shareButton(btn, linkOf, say, t = (s) => s) {
  btn.onclick = async () => { const url = location.origin + location.pathname + linkOf(); history.replaceState(null, '', url);
    if (navigator.share) { try { await navigator.share({ title: document.title, url }); return; } catch (_) { /* closed */ } }
    try { await navigator.clipboard.writeText(url); say(t('Link copied.')); } catch (_) { say(url); } };
}
