/**
 * actions skill — the execution record as a card (frontier build order step 2; lib/actions.js keeps one record per action
 * Void takes or stubs: owner, kind, ref, state running → done | failed | stubbed, result or error; /api/actions serves
 * them to the owner). The card lists the newest 30 records with a mark per state, a tally line, a switch to see only what
 * failed, Show more for the next 30, and Refresh; it keeps itself live (skills/live.js, every minute) so a record that
 * is running settles on screen by itself. Nothing here takes an action; it only shows what Void did. Owner-only: without
 * the owner's key or session the card says so and fetches nothing.
 * "my actions", "show my actions", "action log", "the execution record", "what actions did you take". "what did you do today" stays
 * with the today skill (Void's recent actions from this device's loop log); this card is the server-side record.
 */
import { keepLive } from './live.js';

const OWNER_KEY = 'a2m.void.owner.v1';
export const PAGE = 30, EVERY = 60e3;
const ownerToken = () => { try { return localStorage.getItem(OWNER_KEY) || ''; } catch (_) { return ''; } };

export function actionsOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:(?:show|open|list)\s+)?(?:me\s+)?(?:my\s+|void'?s\s+|your\s+)?(?:actions|action log|action record|execution record)$|^(?:show\s+)?(?:me\s+)?the\s+(?:action log|execution record|record of (?:your )?actions)$|^what actions (?:did you take|have you taken)$|^(?:show\s+)?(?:me\s+)?(?:the\s+)?record of (?:what you did|your actions)$/.test(t)) return { open: true };
  return null;
}

export const MARK = { done: '✓', failed: '✗', stubbed: '○', running: '…' };
/** how many records sit in each state; running counts what started and never reported back */
export function tally(records) {
  const n = { done: 0, failed: 0, stubbed: 0, running: 0 };
  for (const r of records || []) if (r && n[r.state] != null) n[r.state] += 1;
  return n;
}
export function tallyText(n) {
  const parts = [];
  if (n.done) parts.push(n.done + ' done');
  if (n.failed) parts.push(n.failed + ' failed');
  if (n.stubbed) parts.push(n.stubbed + ' stubbed (nothing left Void)');
  if (n.running) parts.push(n.running + ' still running or never reported back');
  return parts.length ? parts.join(' · ') : 'No actions recorded yet. Every automation step writes one when it runs.';
}
const when = (iso) => { const d = new Date(iso); return isNaN(d) ? String(iso || '') : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
/** one record as a line: mark, when, kind, ref, and what it did or why it failed */
export function lineOf(r) {
  const what = r.state === 'failed' ? r.error || 'failed' : r.state === 'running' ? 'started ' + when(r.started) + ', no end recorded' : r.result || '';
  return (MARK[r.state] || '?') + ' ' + when(r.started) + ' · ' + r.kind + (r.ref ? ' · ' + r.ref : '') + (what ? ' · ' + String(what).slice(0, 160) : '');
}

const el = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; };
const MUTED = 'color:var(--muted,#9a9aa2)';
// a pressed .g-btn shrinks, and inside a tilted card that moves its hit area; this card shows a press by colour (as automations.js does)
const PRESS_CSS = '.actions-card .g-btn:active:not(:disabled){transform:none;background:rgba(255,255,255,.16)}';
function pressStyle() { if (document.getElementById('actions-press')) return; const st = document.createElement('style'); st.id = 'actions-press'; st.textContent = PRESS_CSS; document.head.append(st); }

function mount(th, stageApi) {
  pressStyle();
  const card = el('div');
  card.className = 'thing kept-card game-card actions-card';
  card.dataset.id = th.id;
  card.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(460px, calc(100vw - 20px))';
  const head = el('div'); head.className = 'g-head';
  const title = el('span', null, 'Actions'); title.className = 'g-title';
  const sub = el('span', null, 'everything Void did, with its record'); sub.className = 'g-sub';
  head.append(title, sub);
  const status = el('div', 'margin-top:6px;' + MUTED); status.className = 'actions-status g-status'; status.setAttribute('aria-live', 'polite');
  const list = el('div', 'display:grid;gap:4px;margin-top:10px;font-size:13px'); list.className = 'actions-list';
  card.append(head, status, list);
  const stop = (b) => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); return b; };
  const btn = (label, cls, fn) => { const b = stop(el('button', null, label)); b.type = 'button'; b.className = 'g-btn ' + cls; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };

  const tok = ownerToken();
  stageApi.bindDrag(card, th);
  stageApi.stage.appendChild(card);
  if (!tok) { status.textContent = 'The record is the owner’s. Unlock Void first (unlock <key>, or sign in with your passkey), then ask again.'; return; }

  let rows = [], onlyFailed = false, more = true;
  const paint = () => {
    list.textContent = '';
    const shown = onlyFailed ? rows.filter((r) => r.state === 'failed') : rows;
    if (!shown.length) list.append(el('div', MUTED, onlyFailed ? 'Nothing failed.' : 'No actions recorded yet.'));
    for (const r of shown) { const d = el('div', r.state === 'failed' ? 'color:#ff8a8a' : r.state === 'running' ? MUTED : '', lineOf(r)); d.className = 'actions-row'; d.dataset.state = r.state; list.append(d); }
    status.textContent = tallyText(tally(rows));
    moreBtn.style.display = more && !onlyFailed ? '' : 'none';
  };
  const get = async (limit, offset) => {
    const r = await fetch('/api/actions?limit=' + limit + '&offset=' + offset, { headers: { authorization: 'Bearer ' + tok } });
    if (!r.ok) throw new Error(r.status === 401 ? 'only the owner can read the record' : r.status === 503 ? 'no database behind this copy of Void' : 'the record answered ' + r.status);
    const data = await r.json().catch(() => ({}));
    return Array.isArray(data.actions) ? data.actions : [];
  };
  // the newest rows again, as many as are on screen (at least one page): a running record settles in place
  const load = async () => {
    status.textContent = 'loading…';
    try { const want = Math.max(PAGE, rows.length); const got = await get(want, 0); rows = got; more = got.length >= want; paint(); }
    catch (e) { status.textContent = e.message; throw e; }
  };
  // the next page of older rows under the ones shown; a record that landed since the last tick shifts the offset by
  // one, so a row already on screen is not shown twice
  const showMore = async () => {
    moreBtn.disabled = true;
    try { const got = await get(PAGE, rows.length); const seen = new Set(rows.map((r) => r.id)); rows = rows.concat(got.filter((r) => !seen.has(r.id))); more = got.length >= PAGE; paint(); }
    catch (e) { status.textContent = e.message; }
    moreBtn.disabled = false;
  };
  const bar = el('div', 'display:flex;gap:6px;flex-wrap:wrap;margin-top:10px');
  const failedBtn = btn('Only failed', 'actions-failed', () => { onlyFailed = !onlyFailed; failedBtn.textContent = onlyFailed ? 'Show all' : 'Only failed'; paint(); });
  const moreBtn = btn('Show more', 'actions-more', showMore);
  bar.append(failedBtn, moreBtn, btn('Refresh', 'actions-refresh', () => (card._live ? card._live.now() : load())));
  card.append(bar);
  load().then(() => { if (card.isConnected) keepLive({}, card, { name: 'actions', every: EVERY, refresh: load, present: () => card.isConnected }); }).catch(() => {});
}

async function run(text, api) {
  if (!actionsOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'actions');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); }
  else api.summon('actions', { center: true });
  api.say('Actions · every action Void takes has its record: done, failed, stubbed, or still running');
  return 'actions';
}

export default {
  name: 'actions',
  actionsOf,
  examples: ['my actions', 'show my actions', 'action log', 'the execution record', 'what actions did you take'],
  nearMisses: ['what did you do today', 'actions speak louder than words', 'define action', 'what do you do', 'what can you do', 'class action lawsuit', 'record a voice note'],
  match(lower, text) { return !!actionsOf(text); },
  run,
  stageKinds: { actions: { mount } },
};
