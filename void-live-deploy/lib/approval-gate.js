// The approval gate as tested functions (the frontier's "absorb and connect every repo": no repeats, a rollback, the owner's co-sign above low risk, a cooldown).
// lib/approval-core.js says what is gated and what the confirm line reads; this says whether a gated action may go ahead now, from the history of earlier ones.
// Pure: the caller passes the history ([{ fp, tool, at, state }]; state 'executed' counts, anything else does not) and the clock, and gets a verdict.
import { GATED } from './approval-core.js';

export const REPEAT_MS = 24 * 3600e3;         // the same request, word for word, is not run twice within a day
export const HIGH_SPEND = 25;                 // a spend or payment of this many dollars or more is high risk
export const COOLDOWN_MS = { low: 0, medium: 60e3, high: 10 * 60e3 };   // the least gap after an executed action of the same tool, by risk
export const LOW = new Set(['reminder.ping', 'bridge.task', 'automation.keep']);

/** how risky an action is: low (nothing leaves, or only a task is handed over), medium (it reaches another person), high (money moves, or a big standing spend). Pure. */
export function riskOf(tool, args) {
  if (!Object.prototype.hasOwnProperty.call(GATED, tool)) return 'none';
  if (LOW.has(tool)) return 'low';
  const g = GATED[tool], amount = args && args.cost && Number(args.cost.amount);
  if (g.kind === 'spend') return !(amount >= 0) || amount >= HIGH_SPEND || tool === 'payment.send' ? 'high' : 'medium';
  return 'medium';
}

/** what undoing the action takes: { undo: true|false, how }. A send cannot be taken back; a booking, an order and a standing spend can be cancelled or stopped. Pure. */
export function rollbackOf(tool) {
  if (tool === 'models.spend') return { undo: true, how: 'say "stop paying for stronger models"' };
  if (tool === 'calendar.book' || tool === 'booking.make') return { undo: true, how: 'cancel the booking with whoever took it' };
  if (tool === 'order.place') return { undo: true, how: 'cancel the order before it ships' };
  if (tool === 'automation.keep' || tool === 'bridge.task') return { undo: true, how: 'switch the automation off or drop the task from the queue' };
  if (GATED[tool] && GATED[tool].kind === 'spend') return { undo: false, how: 'money paid out is gone unless the other side sends it back' };
  return { undo: false, how: 'a sent message cannot be taken back' };
}

const done = (history) => (Array.isArray(history) ? history : []).filter((h) => h && h.state === 'executed' && Number.isFinite(Date.parse(h.at)));

/** may this action run now? { ok, need, risk, why, rollback }. `need` is what is still missing: 'cosign' (the owner's yes, from someone other than the requester), or 'wait' (a cooldown, with `waitMs`).
 *  req: { tool, args, fp, actor, cosigner } and opts.owner (the owner's id). Order: not gated, a repeat, the cooldown, then the co-sign. Pure. */
export function gate(req, history = [], now = Date.now(), opts = {}) {
  const r = req || {}, risk = riskOf(r.tool, r.args), rollback = rollbackOf(r.tool);
  if (risk === 'none') return { ok: true, need: null, risk, why: 'not a gated action', rollback };
  const past = done(history), t = typeof now === 'number' ? now : Date.parse(now);
  const same = past.find((h) => h.fp && h.fp === r.fp && t - Date.parse(h.at) < REPEAT_MS);
  if (same) return { ok: false, need: 'repeat', risk, why: 'this exact request already ran ' + Math.round((t - Date.parse(same.at)) / 60e3) + ' minutes ago; change it to run it again', rollback };
  const last = Math.max(0, ...past.filter((h) => h.tool === r.tool).map((h) => Date.parse(h.at))), gap = COOLDOWN_MS[risk] - (t - last);
  // stopping a standing spend ($0, the rollback rollbackOf names for models.spend) never waits out the cooldown: a held stop would leave the spend running
  const stop = r.tool === 'models.spend' && !!(r.args && r.args.cost) && Number(r.args.cost.amount) === 0;
  if (last && gap > 0 && !stop) return { ok: false, need: 'wait', waitMs: gap, risk, why: 'one ' + r.tool + ' ran a moment ago; wait ' + Math.ceil(gap / 1000) + ' seconds', rollback };
  if (risk !== 'low') {
    const owner = opts.owner;
    const signed = r.cosigner && r.cosigner !== r.actor && (!owner || r.cosigner === owner);
    if (!signed && !(owner && r.actor === owner && risk === 'medium')) return { ok: false, need: 'cosign', risk, why: (risk === 'high' ? 'high risk' : 'medium risk') + ': the owner\'s own yes is needed' + (rollback.undo ? '' : ' (' + rollback.how + ')'), rollback };
  }
  return { ok: true, need: null, risk, why: 'clear', rollback };
}
