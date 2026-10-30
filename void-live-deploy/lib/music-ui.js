// What the music pages share (/metronome/, /piano/, /tuner/, /bpm/, /chords/, /music/): the small things kept on this device (the setlist, the theme),
// the German words, the share button and the "Use with" row. Browser only, loaded after the page's load event. Tests: tools/music-page.mjs.
import { cleanEntry, setlistFromQuery, setlistToQuery, tempoName } from '/lib/music-tools.js';
import { DE } from '/lib/music-de.js';

export const $ = (id) => document.getElementById(id);
export const KEY = 'a2m.void.music.v1';
/** the device's memory for the music pages: { setlist: [...], theme, ... }; always an object, never throws. */
export function mem() { try { const m = JSON.parse(localStorage.getItem(KEY) || '{}'); return m && typeof m === 'object' ? m : {}; } catch (_) { return {}; } }
export function keep(patch) { const m = Object.assign(mem(), patch); try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (_) { /* full or blocked: the page still works */ } return m; }
export const isDe = () => /^de\b/i.test(navigator.language || '') || new URLSearchParams(location.search).get('lang') === 'de';
export const t = (s) => (isDe() && DE[s]) || s;
/** swaps the page's English words for German where the browser's language is German (a text node at a time, so controls keep working). */
export function translate(root = document.body) {
  if (!isDe()) return; document.documentElement.lang = 'de';
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const p = n.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName)) continue; const s = n.nodeValue.trim(); if (s && DE[s]) n.nodeValue = n.nodeValue.replace(s, DE[s]); }
  for (const e of root.querySelectorAll('[aria-label],[placeholder],[title]')) for (const a of ['aria-label', 'placeholder', 'title']) { const v = e.getAttribute(a); if (v && DE[v]) e.setAttribute(a, DE[v]); }
  if (DE[document.title]) document.title = DE[document.title];
}
/** the colour theme: deep space, or the one picked on this page and kept. */
export function theme(btn) {
  const set = (v) => { if (v) document.documentElement.setAttribute('data-theme', v); else document.documentElement.removeAttribute('data-theme'); };
  const saved = mem().theme; if (saved) set(saved);
  if (btn) { const dark = () => (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark'; btn.setAttribute('aria-pressed', String(dark())); btn.addEventListener('click', () => { const v = dark() ? 'light' : 'dark'; set(v); keep({ theme: v }); btn.setAttribute('aria-pressed', String(v === 'dark')); }); }
}
/** a link that carries the page's state; copies it (or shares it where the browser can). */
export async function shareLink(url, title, say) {
  try { if (navigator.share) { await navigator.share({ title, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); say(t('Copied the link.')); } catch (_) { say(url); }
}
/** the things every page does once: German, the theme, the share button (each page mounts its own Use-with row: mountRelated in its app.js). */
export function boot(_path, say = () => {}) {
  translate(); theme($('theme'));
  const b = $('shareBtn'); if (b) b.addEventListener('click', () => shareLink(location.href, document.title, say));
  document.getElementById('app').removeAttribute('aria-busy');
}
/** the setlist on this device, with a link's entries (?list=) merged in when the page was opened from one. */
export function setlist() {
  const m = mem(), list = Array.isArray(m.setlist) ? m.setlist.map(cleanEntry).filter(Boolean) : [], q = new URLSearchParams(location.search).get('list');
  if (q) { for (const e of setlistFromQuery(q)) if (!list.some((x) => x.name === e.name && x.bpm === e.bpm && x.sig === e.sig)) list.push(e); keep({ setlist: list }); }
  return list;
}
export const saveSetlist = (list) => keep({ setlist: list.map(cleanEntry).filter(Boolean).slice(0, 60) });
export const setlistLink = (list) => location.origin + '/metronome/?list=' + setlistToQuery(list);
/** draws the setlist into an <ol>: each row names the tempo and has Load and Remove; onLoad(entry, index) runs for Load. */
export function drawSetlist(ol, list, onLoad, onChange) {
  ol.textContent = '';
  if (!list.length) { const li = document.createElement('li'); li.style.listStyle = 'none'; li.className = 'note'; li.textContent = t('Nothing saved yet. Set a tempo in the metronome and press Save to a setlist.'); ol.append(li); return; }
  list.forEach((e, i) => {
    const li = document.createElement('li'); li.style.margin = '4px 0';
    const lab = document.createElement('span'); lab.textContent = e.name + ' · ' + e.bpm + ' BPM ' + tempoName(e.bpm) + ' · ' + e.sig + (e.sub !== 'none' ? ' · ' + e.sub : '') + ' ';
    const ld = document.createElement('button'); ld.type = 'button'; ld.textContent = t('Load'); ld.setAttribute('aria-label', t('Load') + ' ' + e.name); ld.onclick = () => onLoad(e, i);
    const rm = document.createElement('button'); rm.type = 'button'; rm.textContent = '×'; rm.setAttribute('aria-label', t('Remove') + ' ' + e.name); rm.onclick = () => { list.splice(i, 1); saveSetlist(list); drawSetlist(ol, list, onLoad, onChange); if (onChange) onChange(); };
    li.append(lab, ld, ' ', rm); ol.append(li);
  });
}
export const wire = (el, ev, fn) => { if (el) el.addEventListener(ev, fn); };
/** a number box or range read as a clamped integer. */
export const num = (el, lo, hi, or) => { const v = Math.round(parseFloat(el && el.value)); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : or; };
