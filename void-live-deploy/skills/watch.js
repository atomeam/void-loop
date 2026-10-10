/**
 * watch skill — "watch this for me" (frontier build order step 4, first piece). One thing Void can already fetch and a
 * condition: "tell me when it's below 0 in Oslo", "let me know if https://… says sold out", "alert me when the price on
 * https://… drops below 50", "watch https://… for changes" (a time in a zone is the calendar's reminder on the page). Void keeps the watch
 * (/api/watch, the owner's or a paid member's own), checks it on its 15-minute clock, keeps every check as a watch.check
 * record, and tells a match on the stage. "my watches" lists them with the last check, the evidence, pause and stop.
 * The card keeps itself live (skills/live.js) so a check that lands while it is up shows by itself. Nothing is watched
 * that was not asked for.
 */
import { watchOf, describe } from '../lib/watch.js';
import { keepLive } from './live.js';

const OWNER_KEY = 'a2m.void.owner.v1';
const ownerToken = () => { try { return localStorage.getItem(OWNER_KEY) || ''; } catch (_) { return ''; } };
const el = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; };
const MUTED = 'color:var(--muted,#9a9aa2)';
const PRESS_CSS = '.watch-card .g-btn:active:not(:disabled){transform:none;background:rgba(255,255,255,.16)}';
function pressStyle() { if (document.getElementById('watch-press')) return; const st = document.createElement('style'); st.id = 'watch-press'; st.textContent = PRESS_CSS; document.head.append(st); }
const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
/** the line under a watch: its last check, in the record's words */
export function lastLine(w) {
  const c = w.checks && w.checks[0];
  if (!c) return w.last && w.last.at ? 'checked ' + when(w.last.at) : 'not checked yet';
  return (c.state === 'failed' ? '✗ ' : /^MATCH/.test(c.result || '') ? '★ ' : '· ') + when(c.started) + ' · ' + (c.state === 'failed' ? c.error : c.result || '');
}

function mount(th, stageApi) {
  pressStyle();
  const card = el('div');
  card.className = 'thing kept-card game-card watch-card';
  card.dataset.id = th.id;
  card.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(480px, calc(100vw - 20px))';
  const head = el('div'); head.className = 'g-head';
  const title = el('span', null, 'Watches'); title.className = 'g-title';
  const sub = el('span', null, 'Void checks these for you every 15 minutes'); sub.className = 'g-sub';
  head.append(title, sub);
  const status = el('div', 'margin-top:6px;' + MUTED); status.className = 'watch-status g-status'; status.setAttribute('aria-live', 'polite');
  const list = el('div', 'display:grid;gap:8px;margin-top:10px'); list.className = 'watch-list';
  card.append(head, status, list);
  const stop = (b) => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('keydown', (e) => e.stopPropagation()); return b; };
  const btn = (label, cls, fn) => { const b = stop(el('button', null, label)); b.type = 'button'; b.className = 'g-btn ' + cls; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  stageApi.bindDrag(card, th);
  stageApi.stage.appendChild(card);

  let data = { watches: [] }, seenMatch = new Set();
  const headers = () => ({ 'content-type': 'application/json', ...(ownerToken() ? { authorization: 'Bearer ' + ownerToken() } : {}) });
  const call = async (method, body) => {
    const r = await fetch('/api/watch', { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) throw new Error('Watches are the owner\'s and paid members\'. Unlock Void (unlock <key>) or sign in with your passkey, then ask again.');
    if (r.status === 403) throw new Error('Watches are for the owner and paid members.');
    if (!r.ok) throw new Error(j.error || 'the watch service answered ' + r.status);
    return j;
  };
  const paint = () => {
    list.textContent = '';
    if (!data.watches.length) list.append(el('div', MUTED, 'Nothing is watched. Ask: "tell me when it\'s below 0 in Oslo", "let me know if https://… says sold out", "watch https://… for changes".'));
    for (const w of data.watches) {
      const row = el('div', 'padding:8px 10px;border:1px solid rgba(255,255,255,.12);border-radius:10px' + (w.enabled ? '' : ';opacity:.6')); row.className = 'watch-row'; row.dataset.watch = w.id;
      const top = el('div', 'display:flex;align-items:center;gap:8px;flex-wrap:wrap');
      top.append(el('strong', 'flex:1', describe(w.watch) + (w.enabled ? '' : ' (paused)')));
      top.append(btn(w.enabled ? 'Pause' : 'Resume', 'watch-toggle', () => act('PATCH', { id: w.id, enabled: !w.enabled }, w.enabled ? 'pausing…' : 'resuming…')),
        btn('Stop', 'watch-stop', () => { if (confirm('Stop watching ' + describe(w.watch) + '?')) act('DELETE', { id: w.id }, 'stopping…'); }));
      const last = el('div', 'margin-top:4px;font-size:13px;' + MUTED, lastLine(w)); last.className = 'watch-last';
      row.append(top, last);
      const c = w.checks && w.checks[0];
      if (c && /^MATCH/.test(c.result || '') && !seenMatch.has(c.id)) { seenMatch.add(c.id); if (seenMatch.size > 1 || th.told) stageApi.say && stageApi.say('Watch: ' + c.result.slice(0, 140)); th.told = true; }
      list.append(row);
    }
    status.textContent = status.textContent === 'loading…' ? '' : status.textContent;
  };
  const act = async (method, body, said) => {
    status.textContent = said || 'working…';
    try { data = await call(method, body); paint(); status.textContent = ''; return data; }
    catch (e) { status.textContent = e.message; return null; }
  };
  const load = async () => { data = await call('GET'); paint(); };
  const bar = el('div', 'display:flex;gap:6px;flex-wrap:wrap;margin-top:10px');
  bar.append(btn('Refresh', 'watch-refresh', () => (card._live ? card._live.now() : act('GET'))));
  card.append(bar);

  (async () => {
    status.textContent = 'loading…';
    try {
      if (th.ask) { const ask = th.ask; delete th.ask; stageApi.save(); const j = await call('POST', { ask }); data = j; paint(); status.textContent = 'Watching for ' + describe(j.saved.do[0].watch) + ' · checked once now'; }
      else await load();
      if (card.isConnected) keepLive({}, card, { name: 'watches', every: 60e3, refresh: load, present: () => card.isConnected });
    } catch (e) { status.textContent = e.message; }
  })();
}

async function run(text, api) {
  const w = watchOf(text);
  if (!w) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'watch');
  if (w.watch) {
    if (existing) { existing.ask = text; api.stage.save && api.stage.save(); if (api.stage.center) api.stage.center(existing.id); api.stage.render(); }
    else api.summon('watch', { center: true, ask: text });
    api.say('Watch · ' + describe(w.watch) + ' · checked every 15 minutes');
  } else {
    if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); }
    else api.summon('watch', { center: true });
    api.say('Watches · what Void checks for you');
  }
  return 'watch';
}

export default {
  name: 'watch',
  watchOf,
  examples: ['tell me when it\'s below 0 in Oslo', 'let me know if https://shop.example/x says sold out', 'alert me when the price on https://shop.example/y drops below 50', 'watch https://example.com/news for changes', 'my watches', 'what are you watching for me'],
  nearMisses: ['watch a movie', 'apple watch', 'tell me a joke', 'what time is it in Tokyo', 'weather in Oslo', 'watch the throne'],
  match(lower, text) { return !!watchOf(text); },
  run,
  stageKinds: { watch: { mount } },
};
