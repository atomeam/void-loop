/**
 * miss-jobs skill - today's misses as jobs (asked by the owner, 2026-10-18): "turn today's misses into jobs" lists the top asks Verse could
 * not answer that the build queue would take ("ready to queue"), ranked and filtered the way the server does it (lib/learn.js plan(), the
 * same board /api/misses and the same queue /api/queue). Owner only, like the status card's recovery: the board and the queue are read
 * with the owner key, and a job is queued only by a tap on its own button (Bearer owner key to /api/queue). Without the key the card is a
 * dry run: it says only the owner can queue, reads nothing and queues nothing. A job that needs the owner key is never queued by itself.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { plan, jobOf } from '../lib/learn.js';

const OWNER_KEY = 'a2m.void.owner.v1';
const ownerKey = () => { try { return localStorage.getItem(OWNER_KEY) || ''; } catch (_) { return ''; } };
const CLEAN = (t) => String(t || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ASK = /^(?:turn|make|convert|queue)\s+(?:(?:today'?s|the|this\s+week'?s|my|all)\s+)?misses\s+(?:in)?to\s+jobs$|^(?:today'?s|the)\s+misses\s+(?:as|to)\s+jobs$/;
/** whether the ask is to turn the misses into jobs. Pure. */
export const missOf = (text) => ASK.test(CLEAN(text));
export const SHOW = 5;

/** the cards: [{ ask, count, people, ready, target, job }]; the first `room` the queue would take are ready, the rest wait. Pure. */
export function readyList(rows, queue, now = Date.now()) {
  const p = plan(Array.isArray(rows) ? rows : [], queue || { items: [] }, { now });
  const card = (c, ready) => ({ ask: c.ask, count: c.count, people: Math.max(0, c.count - (c.agent || 0)), ready, target: c.target, job: jobOf(c) });
  return { open: p.open, room: p.room, cards: [...p.queue.map((c) => card(c, true)), ...p.later.map((c) => card(c, false))].slice(0, SHOW) };
}
/** POST one job to the owner's queue. Owner key only; returns { ok, why }. */
export async function queueOne(card, fetchFn = (u, o) => fetch(u, o), key = ownerKey()) {
  if (!key) return { ok: false, why: 'only the owner can queue a job' };
  try {
    const r = await fetchFn('/api/queue', { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify({ ask: card.job.ask.slice(0, 200), target: card.job.target }) });
    return r.ok ? { ok: true, why: 'queued for the builder' } : { ok: false, why: 'the queue answered HTTP ' + r.status };
  } catch (_) { return { ok: false, why: 'the queue could not be reached' }; }
}
/** read the board and the queue with the owner key: { rows, queue } or { why }. */
export async function readBoard(fetchFn = (u, o) => fetch(u, o), key = ownerKey()) {
  if (!key) return { why: 'only the owner can read the misses or queue jobs' };
  const h = { headers: { authorization: 'Bearer ' + key } };
  try {
    const [m, q] = await Promise.all([fetchFn('/api/misses', h), fetchFn('/api/queue', h)]);
    if (!m.ok) return { why: 'the miss board answered HTTP ' + m.status };
    return { rows: await m.json(), queue: q.ok ? await q.json() : { items: [] } };
  } catch (_) { return { why: 'the miss board could not be reached' }; }
}

export function cardHtml(esc, board, list) {
  const head = '<h2>Misses to jobs</h2>';
  if (!board || board.why) return head + '<p class="miss-jobs-dry">Dry run: ' + esc((board && board.why) || 'nothing was read') + '. Nothing was read and nothing was queued.</p>';
  if (!list.cards.length) return head + '<p>No learnable misses are waiting. Nothing to queue.</p><div class="sub">' + esc(list.open + ' miss job' + (list.open === 1 ? '' : 's') + ' open') + '</div>';
  return head + '<div class="sub">' + esc(list.open + ' miss job' + (list.open === 1 ? '' : 's') + ' open · room for ' + list.room + ' more') + '</div><ul class="miss-jobs-list" style="list-style:none;padding:0">'
    + list.cards.map((c, i) => '<li style="margin:8px 0"><b>' + esc(c.ask) + '</b> <span style="color:#9a9aa2">asked ' + esc(c.count) + '×</span> '
      + (c.ready ? '<span class="miss-jobs-state">ready to queue</span> <button type="button" data-i="' + i + '" class="miss-jobs-go" style="cursor:pointer">Queue this</button>' : '<span class="miss-jobs-state" style="color:#9a9aa2">waiting: the queue is full</span>') + '</li>').join('') + '</ul>'
    + '<div class="src">Source: the miss board and the build queue (owner only) · a job is queued only when you tap it</div>'; // void-review: ok: every value is escaped; the index is a number
}

async function run(text, api) {
  if (!missOf(text)) return 'none';
  const { esc } = api, key = ownerKey(), board = await readBoard(undefined, key), list = board.why ? null : readyList(board.rows, board.queue);
  api.showPage((el) => {
    el.innerHTML = cardHtml(esc, board, list);
    el.addEventListener('click', async (e) => {
      const b = e.target.closest && e.target.closest('button.miss-jobs-go'); if (!b || b.disabled) return;
      b.disabled = true; const c = list.cards[+b.dataset.i]; if (!c) return;
      const r = await queueOne(c, undefined, key);
      b.insertAdjacentText('afterend', ' ' + r.why); b.remove();
    });
  });
  return 'miss-jobs';
}

export default {
  name: 'miss-jobs',
  missOf,
  examples: ["turn today's misses into jobs", 'turn the misses into jobs'],
  nearMisses: ['hit or miss', 'turn the lights into jobs', 'jobs in miami', 'miss universe results'],
  match(lower, text) { return missOf(text || lower); },
  run,
};
