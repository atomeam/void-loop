/**
 * recipes-fill skill - a sentence saves or edits one of your recipes (owner, 2026-10-25: "make sure Verse knows how to fill out its own relevant pages for you just by chatting with it"). The
 * reading and the writing are lib/chat-recipes.js (pure, tested); the data is the one /recipes/ keeps on this device (a2m.void.recipes.v1). The card says what changed, has
 * Undo and a link to the page; a weak match asks Confirm, two that fit are listed. Nothing is sent anywhere.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import * as L from '../lib/chat-recipes.js';
import { drawFill } from '../lib/fill-card.js';

const KEY = 'a2m.void.recipes.v1', LOG = 'a2m.void.chatfill.rec.v1';
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };
const write = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (_) { return false; } };

function match(lower, text) {
  const it = L.parseIntent(text); if (!it) return false;
  if (it.op === 'save') return true;
  return L.plan(read(), it).kind !== 'none';
}
function run(text, api) {
  const el = api.showPage(() => {}); const it = L.parseIntent(text);
  drawFill(el, { intent: it, plan: (s, i) => L.plan(s, i), undo: L.undoOf, read, write, logKey: LOG, openHref: (id) => '/recipes/' + (id ? '?q=' + encodeURIComponent(id.replace(/-/g, ' ')) : ''), openLabel: 'Open it in Recipes', hint: L.HINT, heading: 'Recipes' });
  return 'recipes-fill';
}
export default {
  name: 'recipes-fill',
  examples: ['save this recipe: Lemon cake, ingredients: 200 g flour, 3 eggs; steps: mix. bake', 'save this recipe: Toast, ingredients: bread, butter; steps: toast it'],
  nearMisses: ['pancake recipe', 'how do i make pancakes', 'add eggs to my shopping list', 'recipe for banana bread'],
  match,
  run
};
