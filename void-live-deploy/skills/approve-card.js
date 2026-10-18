/**
 * approve-card skill — a task that waits on the stage, is approved through the confirm line, and keeps running on the server
 * clock after you leave (asked by Verse: "Become tasks that keep running after you leave with an approve card on the stage";
 * growth-inbox #10). Owner's decision, 2026-10-18: the first version runs D1 automations only.
 *
 * "approve later: keep morning-digest running every 2 hours" puts a pending card on the stage and runs NOTHING. Its Approve
 * button asks the card's own line as if typed (stageApi.ask), so it goes through the page's confirm line exactly as the typed
 * ask would: handleGatedAsk, a trusted Yes, decideConfirm, the automation.keep executor (lib/keep-going.js) switches the rule
 * onto the clock. Nothing new in GATED or the executors. The card never stores an approval id: `ask` is the only authority,
 * re-parsed at click time, so the fingerprint is always fresh. Abort switches the rule off (PATCH /api/automations, the same
 * call as the automations card's switch). The status is read off D1 through GET /api/automations?rule=<id> (the rule's
 * enabled/when, its runs): pending, approved, running, done, failed, aborted. Nothing persists beyond the stage JSON
 * (synced through /api/mine, cleaned by void.html's cleanThings) and the tables that already exist.
 * "approve later: keep morning-digest running every 2 hours", "approve later: keep the nightly-check automation running every day".
 * A card pending, approved or running for more than 48 hours (createdAt, else seenAt) shows an amber "waiting 3 days — still want this?" line (staleOf; asked by
 * Verse) beside its Approve or Abort, and "Keep waiting" starts the 48 hours again.
 */
import { keepAsk, keepLine } from '../lib/keep-going.js';
import { cardEl, keepOut } from '../lib/stage-pack.js';
import { keepLive } from './live.js';

const OWNER_KEY = 'a2m.void.owner.v1';
const ownerToken = () => { try { return localStorage.getItem(OWNER_KEY) || ''; } catch (_) { return ''; } };
export const STATUSES = ['pending', 'approved', 'running', 'done', 'failed', 'aborted'];
const TOOL = 'automation.keep';

/** "approve later: keep <automation> running every 2 hours" -> the card's facts, or null (a stop needs no card: one yes stops it). Pure. */
export function approveOf(text) {
  const m = /^approve later:\s*(.+)$/i.exec(String(text || '').trim().replace(/\s+/g, ' '));
  if (!m) return null;
  const k = keepAsk(m[1]);
  if (!k || !k.args.on) return null;
  const ask = m[1].trim().replace(/[.!?]+$/, '');
  return { ask, tool: TOOL, args: k.args, rule: k.args.id, what: keepLine(k.args) };
}

const t = (at) => { const n = Date.parse(at || ''); return Number.isFinite(n) ? n : 0; };

/**
 * What the card says, from what D1 holds: th (the thing), rule (its row from /api/automations, or null), runs (its runs, newest
 * first), now (ms). aborted and done are sticky; no rule = failed; a rule not on the clock = pending; no run since the yes =
 * approved; the last run ok = running, else failed; th.times runs since the yes = done. Pure.
 */
export function statusOf(th, rule, runs, now = Date.now()) {
  const x = th || {};
  if (x.status === 'aborted' || x.status === 'done') return x.status;
  if (!rule) return 'failed';
  if (!x.approvedAt || !rule.enabled || !rule.when || rule.when.on !== 'schedule') return 'pending'; // no yes through this card yet, or not on the clock
  const since = t(x.approvedAt);
  const mine = (Array.isArray(runs) ? runs : []).filter((r) => r && t(r.at) >= since && t(r.at) <= now).sort((a, b) => t(b.at) - t(a.at));
  if (!mine.length) return 'approved';
  const times = Number(x.times) || 0;
  if (times > 0 && mine.length >= times) return 'done';
  return mine[0].ok ? 'running' : 'failed';
}

/** the runs since the card was last looked at: { n, last } (last = the newest run, or null). Pure. */
export function catchUp(runs, seenAt) {
  const list = (Array.isArray(runs) ? runs : []).filter(Boolean).sort((a, b) => t(b.at) - t(a.at));
  const seen = t(seenAt);
  return { n: list.filter((r) => t(r.at) > seen).length, last: list[0] || null };
}

export const STALE_HOURS = 48; // a task waiting or running this long gets "still want this?"
/**
 * Has the card been waiting too long (asked by Verse: "a stale-warning ... if the task has been running/pending for more than 48 hours")? Only a pending,
 * approved or running card can be stale; its age is from createdAt (set when summoned), else the older card's seenAt. { stale, hours } (hours is whole, 0 when unknown). Pure.
 */
export function staleOf(th, now = Date.now()) {
  const x = th || {};
  if (!['pending', 'approved', 'running'].includes(x.status)) return { stale: false, hours: 0 };
  const from = t(x.createdAt) || t(x.seenAt);
  if (!from || !Number.isFinite(now)) return { stale: false, hours: 0 };
  const hours = Math.max(0, Math.floor((now - from) / 36e5));
  return { stale: (now - from) / 36e5 > STALE_HOURS, hours };
}
/** "waiting 3 days — still want this?" (whole days, since it is only said after 48 hours). Pure. */
export const staleLine = (hours) => 'waiting ' + Math.floor(hours / 24) + ' days — still want this?';

const PILL = { pending: '#c9a84a', approved: '#7aa9ff', running: '#6fd38f', done: '#9ad', failed: '#ff7b7b', aborted: '#999' };
const WORDS = { pending: 'waiting for your yes · nothing runs', approved: 'approved · on the clock, no run yet', running: 'running by itself', done: 'done', failed: 'failed', aborted: 'aborted · switched off' };
const el = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; };
const clock = (at) => new Date(at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

function mount(th, stageApi) {
  const card = cardEl(th, stageApi, 'approve-card');
  card.style.width = 'min(360px, calc(100vw - 20px))';
  const title = el('div', 'font-weight:600;font-size:15px;cursor:grab', th.title || 'Approve later'); title.className = 'approve-title';
  const what = el('div', 'margin-top:4px;color:#b8bcc8', th.what || ''); what.className = 'approve-what';
  const status = el('div', 'margin-top:8px;font-size:13px'); status.className = 'approve-status'; status.setAttribute('aria-live', 'polite');
  const pill = el('span', 'display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;border:1px solid currentColor'); pill.className = 'approve-pill';
  const line = el('div', 'margin-top:6px;font-size:12px;color:#8b90a0'); line.className = 'approve-line';
  const stale = el('div', null); stale.className = 'approve-stale vc-stale'; stale.setAttribute('role', 'status'); stale.hidden = true;
  const bar = el('div', 'display:flex;gap:6px;margin-top:10px'); bar.className = 'approve-bar';
  const btn = (label, cls, fn) => { const b = keepOut(el('button', null, label)); b.type = 'button'; b.className = 'g-btn ' + cls; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  const approve = btn('Approve', 'approve-yes', () => {
    const now = approveOf('approve later: ' + th.ask); // the ask is the only authority: re-parsed now, so the fingerprint is fresh
    if (!now) { line.textContent = 'this card\'s ask no longer parses'; return; }
    status.classList.add('vc-working'); status.setAttribute('aria-busy', 'true');
    line.textContent = 'asking the confirm line…';
    stageApi.ask(th.ask); // the page's own gate: handleGatedAsk -> a trusted Yes -> decideConfirm -> the automation.keep executor
  });
  const abort = btn('Abort', 'approve-abort', async () => {
    const tok = ownerToken(); if (!tok) { line.textContent = 'the owner only'; return; }
    line.textContent = 'switching off…';
    try {
      const r = await fetch('/api/automations', { method: 'PATCH', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify({ id: th.rule, enabled: false }) });
      if (!r.ok) throw new Error(r.status === 404 ? 'no automation called ' + th.rule : 'the automations service answered ' + r.status);
      th.status = 'aborted'; stageApi.save(); line.textContent = 'switched off · it runs again only when you approve it again'; paint();
    } catch (e) { line.textContent = e.message; }
  });
  const keepWaiting = btn('Keep waiting', 'approve-keep', () => { th.createdAt = new Date().toISOString(); stageApi.save(); paint(); }); // starts the 48 hours again
  if (!th.createdAt) { th.createdAt = th.seenAt || new Date().toISOString(); stageApi.save(); } // an older card: its age is when it was last looked at
  status.append(pill); bar.append(approve, abort, keepWaiting);
  card.append(title, what, status, stale, line, bar);
  stageApi.bindDrag(card, th);
  stageApi.stage.appendChild(card);

  const working = (on) => { status.classList.toggle('vc-working', on); if (on) status.setAttribute('aria-busy', 'true'); else status.removeAttribute('aria-busy'); };
  function paint() {
    const s = STATUSES.includes(th.status) ? th.status : 'pending';
    pill.textContent = s; pill.style.color = PILL[s]; pill.dataset.status = s; card.dataset.status = s;
    status.title = WORDS[s];
    approve.style.display = s === 'pending' || s === 'failed' || s === 'aborted' ? '' : 'none';
    abort.style.display = s === 'approved' || s === 'running' ? '' : 'none';
    const old = staleOf(th);
    stale.hidden = !old.stale; keepWaiting.style.display = old.stale ? '' : 'none'; card.classList.toggle('vc-stale-card', old.stale);
    if (old.stale) stale.textContent = staleLine(old.hours);
  }
  paint();

  const tok = ownerToken();
  if (!tok) { line.textContent = 'the owner\'s: unlock Verse (unlock <key>, or sign in with your passkey) to approve or read it'; return; }
  let runs = [];
  const progress = () => {
    if (!runs.length) return th.status === 'pending' ? WORDS.pending : th.status === 'aborted' ? WORDS.aborted : 'no run yet · the clock ticks every 15 minutes';
    const last = runs[0], said = (last.log || []).map((l) => l.said).join(' · ').slice(0, 120);
    return (th.times ? runs.length + '/' + th.times : runs.length + ' run' + (runs.length === 1 ? '' : 's')) + ' · last ' + clock(last.at) + (said ? ' · ' + said : '');
  };
  const refresh = async () => {
    const r = await fetch('/api/automations?rule=' + encodeURIComponent(th.rule), { headers: { authorization: 'Bearer ' + tok } });
    if (!r.ok) throw new Error(r.status === 401 ? 'only the owner can read it' : 'the automations service answered ' + r.status);
    const j = await r.json();
    const rule = (j.rules || []).find((x) => x.id === th.rule) || null;
    const since = Date.parse(th.approvedAt || '') || 0;
    runs = (j.runs || []).filter((x) => x.rule === th.rule && Date.parse(x.at) >= since);
    th.status = statusOf(th, rule, runs);
    const away = catchUp(runs, th.seenAt);
    line.textContent = (away.n > 0 ? away.n + ' run' + (away.n === 1 ? '' : 's') + ' while you were away · ' : '') + (rule ? progress() : 'no automation called ' + th.rule + ' (say "my automations" to see them)');
    if (document.visibilityState === 'visible') th.seenAt = new Date().toISOString();
    stageApi.save(); paint();
  };
  refresh().catch((e) => { line.textContent = e.message; });
  keepLive(stageApi, card, { name: 'approve card', every: 60e3, refresh, present: () => card.isConnected });

  // the confirm line's answer (void.html decideConfirm says 'void:confirm'): only this card's own tool and rule count
  const onConfirm = (e) => {
    if (!card.isConnected) { document.removeEventListener('void:confirm', onConfirm); return; }
    const d = (e && e.detail) || {};
    if (d.toolName !== TOOL || !d.args || d.args.id !== th.rule) return;
    working(false);
    if (d.decision === 'approve' && d.ran) { th.approvedAt = new Date().toISOString(); th.status = 'approved'; stageApi.save(); paint(); line.textContent = 'approved · on the clock'; refresh().catch(() => {}); return; }
    line.textContent = d.decision === 'approve' ? 'the yes did not switch it on (see the actions card), nothing changed' : 'not approved, nothing changed';
  };
  document.addEventListener('void:confirm', onConfirm);
}

async function run(text, api) {
  const a = approveOf(text);
  if (!a) return 'none';
  api.summon('approve', { ...a, title: 'Keep “' + a.rule + '” running', status: 'pending', approvedAt: null, seenAt: new Date().toISOString(), createdAt: new Date().toISOString(), times: 0, center: true });
  api.say('Approve later · the card waits on the stage · Approve asks the confirm line, then it runs by itself after you leave');
  return 'approve-card';
}

export default {
  name: 'approve-card',
  approveOf, staleOf,
  examples: ['approve later: keep morning-digest running every 2 hours', 'approve later: keep the nightly-check automation running every day'],
  nearMisses: ['approve my leave request', 'keep morning-digest running every 2 hours', 'approve this proposal', 'approve later', 'what does approve mean'],
  match(lower, text) { return !!approveOf(text); },
  run,
  stageKinds: { approve: { mount } },
};
