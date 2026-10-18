/**
 * state skill - the one place that says what V01D keeps on this device (asked by Void, 2026-10-16: "Connect the memory card
 * session persistence to a centralized 'state' skill"). lib/state.js names every browser-storage key once; the memory card
 * reads its session through it, and this card lists them: what each holds, whether it is kept, how big. A secret (the owner
 * key, a member session) shows only as kept or not, never its value. Read-only; nothing is sent anywhere.
 * "what do you keep on this device", "show my state", "what is stored on this device". "state of texas" and "state machine" are not this.
 */
import { summary, sessionToken } from '../lib/state.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ASK_RE = /^(?:(?:please\s+)?(?:show|open)\s+(?:me\s+)?(?:my|the|your)\s+state(?:\s+card)?|what\s+(?:do\s+you\s+|does\s+(?:void|v01d|verse)\s+)?(?:keep|store|save|remember)\s+(?:on|in)\s+(?:this|my)\s+(?:device|browser)|what(?:'s| is)\s+(?:kept|stored|saved)\s+(?:on|in)\s+(?:this|my)\s+(?:device|browser)|what\s+state\s+do\s+you\s+keep)$/;
/** the ask wants the list of what is kept on this device. Pure. */
export const stateOf = (text) => ASK_RE.test(CLEAN(text));

const kb = (n) => (n < 1024 ? n + ' bytes' : (n / 1024).toFixed(1) + ' KB');
/** the card's markup from summary() rows and the session word. Pure; every value is escaped. */
export function stateHtml(esc, rows, session) {
  const kept = rows.filter((r) => r.kept), none = rows.filter((r) => !r.kept);
  return '<h2>What I keep on this device</h2><div class="sub">session: ' + esc(session) + ' · ' + esc(String(kept.length)) + ' of ' + esc(String(rows.length)) + ' kept · nothing here leaves this browser unless you ask</div>'
    + (kept.length ? '<ul class="state-kept">' + kept.map((r) => '<li><b>' + esc(r.name) + '</b>: ' + esc(r.what) + ' <span class="sub">' + (r.secret ? 'kept (secret, not shown)' : esc(kb(r.size))) + '</span></li>').join('') + '</ul>' : '<p>Nothing yet.</p>')
    + (none.length ? '<div class="sub">not kept yet: ' + none.map((r) => esc(r.name)).join(', ') + '</div>' : '')
    + '<div class="src">Source: this browser\'s storage, named once in lib/state.js</div>';
}
const sessionWord = (s) => { const t = sessionToken(s); if (!t) return 'not signed in'; try { return globalThis.localStorage.getItem('a2m.void.owner.v1') ? 'owner' : 'member'; } catch (_) { return 'signed in'; } };

function run(text, api) {
  if (!stateOf(text)) return 'none';
  const { showPage, esc } = api;
  showPage((el) => { el.innerHTML = stateHtml(esc, summary(), sessionWord()); });
  return 'state';
}

export default {
  name: 'state',
  examples: ['what do you keep on this device', 'show my state', 'what is stored on this device'],
  nearMisses: ['what is the state of texas', 'state machine', 'what is a state'],
  match(lower, text) { return stateOf(text || lower); },
  run,
  stateOf, stateHtml,
};
