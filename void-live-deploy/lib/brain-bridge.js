// brain-bridge — one Verse Brain for every Verse page open in the same browser (owner, 2026-10-29: "all the pages are supposed to be able
// to work together"). The page that runs the brain (the Verse Brain card, skills/verse-brain.js) hosts it: it posts a summary of the brain
// on a BroadcastChannel a few times a second and takes words and rewards from any other Verse page (/fanfic/ sends the fandom a reader
// opens and the words they search). Any page can also reach the brain on its own tab through window.verseBrain.
//
// Same origin, same browser only: BroadcastChannel never leaves the visitor's browser, nothing here is sent to a server or stored, and a
// page with no brain open simply hears nothing. Messages:
//   host -> pages  { type: 'state', from, at, focus: { x, y, region }, thinking, action, gesture, expect, utility, metrics, words, related, self }
//   pages -> host  { type: 'words', text }   become concepts (lib/brain.js tell), at most MAX_TEXT characters
//                  { type: 'reward' }        "good" for what the brain did last
//                  { type: 'seen', text, page } the page the visitor opened (its name): ideas, not a goal (lib/brain-everywhere.js)
//                  { type: 'hello' }         asks the host to post its state now
export const CHANNEL = 'verse-brain', MAX_TEXT = 200, EVERY_MS = 400;

const open = () => { try { return typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null; } catch (_) { return null; } };
const clean = (t) => String(t == null ? '' : t).replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);

/** the summary another page sees: numbers, the brain's own words for what it does, and the visitor's concepts (their own words, back to
 *  their own pages). Pure on the brain. B is lib/brain.js. */
export function summaryOf(B, b) {
  const words = b.concepts.words.slice(-24), last = words[words.length - 1];
  const related = last ? (B.relatedOf ? B.relatedOf(b, last) : []) : [];
  return { type: 'state', at: b.ticks, focus: { x: +b.focus.x.toFixed(3), y: +b.focus.y.toFixed(3), region: b.focus.region }, thinking: b.board.thinking,
    action: b.board.action ? b.board.action.name : 'rest', gesture: b.board.gesture, expect: b.board.expect ? b.board.expect.region : null,
    utility: +b.utility.toFixed(3), metrics: Object.fromEntries(Object.entries(b.metrics).map(([k, v]) => [k, +(+v).toFixed(3)])), words, related, self: B.selfSays(b),
    wants: b.mind ? b.mind.goals.map((g) => g.word) : [], conflicts: b.mind ? b.mind.conflicts.length : 0 };
}

/** host a running brain: returns { publish(force), received, close() }. getBrain() is called each time (a Reset makes a new brain).
 *  onWords(text, from) runs after words from another page became concepts (so the card can show them). */
export function hostBrain(B, getBrain, { onWords = null, onReward = null, onSeen = null, id = 'brain-' + Math.random().toString(36).slice(2, 8) } = {}) {
  const ch = open(), received = { words: 0, rewards: 0, seen: 0 };
  let last = 0;
  const publish = (force = false) => {
    const now = Date.now(); if (!force && now - last < EVERY_MS) return null; last = now;
    const b = getBrain(); if (!b) return null; const s = { ...summaryOf(B, b), from: id };
    if (ch) { try { ch.postMessage(s); } catch (_) { /* closed */ } }
    return s;
  };
  const take = (m, from) => { // words from a page are asks: goals as well as ideas (a question gets its answer, nothing changes)
    const b = getBrain(); if (!b || !m || typeof m !== 'object') return null;
    if (m.type === 'words') { const t = clean(m.text); if (!t) return null; const r = B.ask ? B.ask(b, t) : B.tell(b, t); if (r.answer) return r; received.words++; if (onWords) onWords(t, from); publish(true); return r; }
    if (m.type === 'reward') { B.reward(b); received.rewards++; if (onReward) onReward(from); return true; }
    if (m.type === 'seen') { const t = clean(m.text); if (!t) return null; B.tell(b, t); received.seen++; if (onSeen) onSeen(t, clean(m.page).slice(0, 80), from); return true; }
    if (m.type === 'hello') return publish(true);
    return null;
  };
  if (ch) ch.onmessage = (e) => take(e.data, 'page');
  // the same tab: window.verseBrain, for a page script or the console
  const api = { state: () => { const b = getBrain(); return b ? summaryOf(B, b) : null; }, tell: (t) => take({ type: 'words', text: t }, 'tab'), reward: () => take({ type: 'reward' }, 'tab'), host: id };
  if (typeof window !== 'undefined') window.verseBrain = api;
  return { publish, take, received, api,
    close() { if (ch) { try { ch.close(); } catch (_) { /* gone */ } } if (typeof window !== 'undefined' && window.verseBrain === api) delete window.verseBrain; } };
}

/** reach the brain from any other Verse page: { tell(text), reward(), on(fn), get state(), get live(), close() }. live is true once a
 *  host has posted in the last few seconds. Works the same when no brain is open (nothing is heard). */
export function connectBrain() {
  const ch = open(), fns = new Set(); let state = null, heard = 0;
  if (ch) ch.onmessage = (e) => { const m = e.data; if (m && m.type === 'state') { state = m; heard = Date.now(); for (const f of fns) { try { f(m); } catch (_) { /* a listener's own problem */ } } } };
  const send = (m) => { if (!ch) return false; try { ch.postMessage(m); return true; } catch (_) { return false; } };
  send({ type: 'hello' });
  return {
    tell: (text) => { const t = clean(text); return t ? send({ type: 'words', text: t }) : false; },
    reward: () => send({ type: 'reward' }),
    seen: (text, page) => { const t = clean(text); return t ? send({ type: 'seen', text: t, page: clean(page) }) : false; },
    hello: () => send({ type: 'hello' }),
    on: (fn) => { fns.add(fn); if (state) fn(state); return () => fns.delete(fn); },
    get state() { return state; }, get live() { return !!state && Date.now() - heard < 3000; }, get available() { return !!ch; },
    close() { fns.clear(); if (ch) { try { ch.close(); } catch (_) { /* gone */ } } }
  };
}
