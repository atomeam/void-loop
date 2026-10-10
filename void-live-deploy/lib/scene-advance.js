// What happened to a stage while its owner was away, as one execution record (lib/actions.js track(), kind `scene.advance`).
// Asked by Void: "Connect 'frontier #4' to the 'automations' and 'actions' skills to allow for state changes without direct
// user input." advance() (skills/scripts.js) runs in the browser; the page sends its result here, and a record is written in the
// sender's own scope only: the owner's (owner 'owner') or a paid member's (owner 'member:<account id>'). A stranger, a free
// account and a made-up session get nothing written (nothing is stored for strangers; the note on the page stands alone).
// A hostile read of this door: it can only add a record to the sender's own scope, one per minute at most, with a fixed kind,
// a clipped note, and at most MAX_CHANGES changes whose words come from the lists below, so it cannot pose as another action,
// fill the record with free text, or crowd out other people's records (a member's records are capped at MEMBER_KEEP).
import { track } from './actions.js';

export const KIND = 'scene.advance';
export const MAX_CHANGES = 20;
export const MIN_GAP_MS = 60e3;
export const MEMBER_KEEP = 50;
export const WHAT = ['rained', 'snowed', 'grew', 'melted', 'melted away', 'found', 'caught'];
const THINGS = /^[a-z]{2,20}$/;
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]+/g, ' ').slice(0, n);

/** What a body may say, made safe: { note, changes: [{ kind, what, with? }] } or null when there is nothing worth a record. Pure. */
export function cleanScene(body) {
  const b = body && typeof body === 'object' ? body : {};
  const changes = (Array.isArray(b.changes) ? b.changes : []).slice(0, MAX_CHANGES)
    .filter((c) => c && THINGS.test(String(c.kind || '')) && WHAT.includes(String(c.what || '')) && (c.with == null || THINGS.test(String(c.with))))
    .map((c) => ({ kind: String(c.kind), what: String(c.what), ...(c.with != null ? { with: String(c.with) } : {}) }));
  if (!changes.length) return null;
  return { note: clip(b.note, 200), changes };
}

/** The words of the record: the note's text and the changes listed, short enough for a record (500 characters). Pure. */
export function describe(s, max = 500) {
  const head = s.note ? s.note + ' ' : '', count = '[' + s.changes.length + ': ';
  let list = s.changes.map((c) => c.kind + ' ' + c.what + (c.with ? ' ' + c.with : '')).join('; ');
  const room = Math.max(10, max - head.length - count.length - 1);
  if (list.length > room) list = list.slice(0, room - 1) + '…';
  return head + count + list + ']';
}

/** Write one record for this scope. scope: { scope: '' } is the owner, { scope: '<account id>' } a paid member. Returns { id } or { status, error }. */
export async function recordScene(env, scope, body) {
  const s = cleanScene(body);
  if (!s) return { status: 400, error: 'nothing to record' };
  const owner = scope.scope ? 'member:' + scope.scope : 'owner';
  const last = await env.DB.prepare("SELECT started FROM void_actions WHERE owner = ? AND kind = ? ORDER BY started DESC LIMIT 1").bind(owner, KIND).first().catch(() => null);
  if (last && Date.now() - Date.parse(last.started) < MIN_GAP_MS) return { status: 429, error: 'a scene record a minute at most' };
  const { record } = await track(env, { owner, kind: KIND, ref: 'stage' }, async () => describe(s));
  if (scope.scope) await env.DB.prepare('DELETE FROM void_actions WHERE owner = ? AND kind = ? AND id NOT IN (SELECT id FROM void_actions WHERE owner = ? AND kind = ? ORDER BY started DESC LIMIT ?)').bind(owner, KIND, owner, KIND, MEMBER_KEEP).run().catch(() => {});
  return { id: record.id };
}
