// What the AI model and assistant pages share in the browser (/models/..., /assistant/...; tools/ai-pages.mjs writes them): German words, the theme, the
// share button, what is kept on this device, a fetch that keeps a fresh copy for a while and answers from it offline, and a call to Verse's free models
// (functions/api/answer.js mode 'assistant'). Loaded after the page is painted. Tests: tools/ai-page.mjs (a 390 px play-through).
import { DE } from '/lib/ai-de.js';

export const $ = (id) => document.getElementById(id);
export const isDe = () => new URLSearchParams(location.search).get('lang') === 'de' || (new URLSearchParams(location.search).get('lang') !== 'en' && /^de\b/i.test(navigator.language || ''));
export const t = (s) => (isDe() && DE[s]) || s;
/** swaps the page's English words for German where the browser's language is German (a text node at a time, so controls keep working). */
export function translate(root = document.body) {
  if (!isDe()) return; document.documentElement.lang = 'de';
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const p = n.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA|CODE|PRE)$/.test(p.nodeName)) continue; const s = n.nodeValue.trim(); if (s && DE[s]) n.nodeValue = n.nodeValue.replace(s, DE[s]); }
  for (const e of root.querySelectorAll('[aria-label],[placeholder],[title]')) for (const a of ['aria-label', 'placeholder', 'title']) { const v = e.getAttribute(a); if (v && DE[v]) e.setAttribute(a, DE[v]); }
  if (DE[document.title]) document.title = DE[document.title];
}
/** the device's memory under a key; always the fallback when it cannot be read, never throws. */
export function load(key, or) { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? or : v; } catch (_) { return or; } }
export function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (_) { return false; } }
export function forget(key) { try { localStorage.removeItem(key); } catch (_) { /* blocked */ } }
const THEME = 'a2m.void.ai.theme';
export function theme(btn) {
  const set = (v) => { if (v) document.documentElement.setAttribute('data-theme', v); else document.documentElement.removeAttribute('data-theme'); };
  const saved = load(THEME, ''); if (saved) set(saved);
  if (!btn) return;
  const dark = () => (document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
  btn.setAttribute('aria-pressed', String(dark()));
  btn.addEventListener('click', () => { const v = dark() ? 'light' : 'dark'; set(v); save(THEME, v); btn.setAttribute('aria-pressed', String(v === 'dark')); });
}
/** shares a link (the system's share sheet where there is one) or copies it; `say` reports. */
export async function shareLink(url, title, say = () => {}) {
  try { if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); say(t('Copied the link.')); } catch (_) { say(url); }
}
export async function copy(text, say = () => {}) { try { await navigator.clipboard.writeText(text); say(t('Copied.')); } catch (_) { say(text.slice(0, 200)); } }
/** the things every page does once: German, the theme, the share button. */
export function boot(say = () => {}) {
  translate(); theme($('theme'));
  const b = $('shareBtn'); if (b) b.addEventListener('click', () => shareLink(location.href, document.title, say));
}
/** JSON from an address, kept on this device for `ttl` ms: a fresh copy answers without asking, a stale one answers when the network fails ({ data, at, stale }). */
export async function getJSON(url, ttl = 600000, key = 'a2m.void.ai.c.' + url) {
  const kept = load(key, null);
  if (kept && Date.now() - kept.at < ttl) return { data: kept.data, at: kept.at, stale: false, kept: true };
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' } }); if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json(); const s = JSON.stringify(data);
    if (s.length < 900000) { if (!save(key, { at: Date.now(), data })) { sweep(); save(key, { at: Date.now(), data }); } }
    return { data, at: Date.now(), stale: false };
  } catch (e) { if (kept) return { data: kept.data, at: kept.at, stale: true, kept: true }; throw e; }
}
/** drops the oldest kept answers when the device's store is full. */
function sweep() { try { const ks = Object.keys(localStorage).filter((k) => k.startsWith('a2m.void.ai.c.')).map((k) => [k, (load(k, {}) || {}).at || 0]).sort((a, b) => a[1] - b[1]); for (const [k] of ks.slice(0, Math.ceil(ks.length / 2) + 1)) forget(k); } catch (_) { /* nothing to drop */ } }
/** asks Verse's free models: { messages: [{ role, text }], model?, style?, instructions? } -> { reply } or { reply: null, say } (what to tell the person). */
export async function askModel(o, signal) {
  if (!navigator.onLine) return { reply: null, say: t('You are offline. Your message stays in the box; notes, chats and the text tools work offline.') };
  // the route takes 20,000 bytes: the newest turns are kept and the oldest dropped to stay under it
  let msgs = (o.messages || []).map((m) => ({ role: m.role, text: String(m.text).slice(0, 4000) })); while (msgs.length > 1 && new Blob([JSON.stringify(msgs)]).size > 15000) msgs = msgs.slice(1);
  try {
    const r = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, signal, body: JSON.stringify({ mode: 'assistant', messages: msgs, model: o.model || 'verse', style: o.style || 'default', instructions: o.instructions || '', lang: isDe() ? 'de' : 'en' }) });
    const j = await r.json().catch(() => ({}));
    return j && j.reply ? { reply: j.reply, model: j.model } : { reply: null, say: (j && (j.say || j.note)) || t('The model did not answer.') };
  } catch (e) { return { reply: null, say: e && e.name === 'AbortError' ? t('Stopped.') : t('The model did not answer.') }; }
}
/** a file of text offered for download. */
export function download(name, text, type = 'text/plain') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
/** an element with attributes and children. */
export function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn); else if (k === 'html') e.innerHTML = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v === true ? '' : String(v)); }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
  return e;
}
export const btn = (label, fn, attrs = {}) => el('button', { type: 'button', class: 'sm', ...attrs, on: { click: fn } }, t(label));
