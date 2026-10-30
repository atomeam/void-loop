/**
 * generators-fill skill - a sentence makes your own generator or keeps a name (owner, 2026-10-25: "make sure Verse knows how to fill out its own relevant pages for you just by chatting with it"). The
 * reading and the writing are lib/chat-generators.js (pure, tested); the data is the one /generators/ keeps on this device (a2m.void.generators.v1). The card says what changed, has
 * Undo and a link to the page; a weak match asks Confirm, two that fit are listed. Nothing is sent anywhere.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import * as L from '../lib/chat-generators.js';
import { drawFill } from '../lib/fill-card.js';

const KEY = 'a2m.void.generators.v1', LOG = 'a2m.void.chatfill.gen.v1';
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };
const write = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (_) { return false; } };
const LAST = 'a2m.void.chatfill.last.v1';
const lastNames = () => { try { const v = JSON.parse(localStorage.getItem(LAST) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
const setLast = (l) => { try { localStorage.setItem(LAST, JSON.stringify(l.slice(0, 20))); } catch (_) {} };

function match(lower, text) {
  const it = L.parseIntent(text); if (!it) return false;
  if (it.op === 'make') return true;
  return L.plan(read(), it, Date.now(), lastNames()).kind !== 'none';
}
function run(text, api) {
  const el = api.showPage(() => {}); const it = L.parseIntent(text);
  drawFill(el, { intent: it, plan: (s, i, n) => { const r = L.plan(s, i, n, lastNames()); if (r.picks) setLast(r.picks); return r; }, undo: L.undoOf, read, write, logKey: LOG, openHref: (id) => '/generators/?g=own', openLabel: 'Open it in Generators', hint: L.HINT, heading: 'Generators' });
  return 'generators-fill';
}
export default {
  name: 'generators-fill',
  examples: [
    "make a generator of pirate ship names: Black Pearl, Sea Wolf, Revenge",
    "keep the name Sea Wolf"
  ],
  nearMisses: [
    "fantasy name generator",
    "keep calm"
  ],
  match,
  run
};
