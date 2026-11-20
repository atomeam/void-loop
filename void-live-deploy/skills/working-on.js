// "what are you working on": a card from the live will, never a model guess. Identity, the will card, and growth stay with those cards.
import { workingOnAsk, workingOnHtml, recentBuilt, artSubjectOf } from '../lib/will-card.js';

export function isWorkingOn(text) { return workingOnAsk(text); }

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>What I\'m working on</h2><div class="sub">…</div>'; });
  let w = null;
  try { const r = await fetch('/api/will'); w = r.ok ? await r.json() : null; } catch (_) {}
  if (api._pageStill && el && !api._pageStill(el)) return 'working-on';
  let ledger = null;
  if (!w || !Array.isArray(w.recent) || !w.recent.length) {
    try { const r = await fetch('/void.growth.json'); if (r.ok) ledger = await r.json(); } catch (_) {}
  }
  if (api._pageStill && el && !api._pageStill(el)) return 'working-on';
  el.innerHTML = workingOnHtml(w, esc, ledger);
  if (w && w.wants && w.wants[0]) el.dataset.artSubject = artSubjectOf(w.wants[0]);
  return 'working-on';
}

export const builtWith = ['will-card', 'wants'];
export default {
  name: 'working-on',
  examples: [
    'what are you working on',
    'what are you building',
    'what are you doing now',
    'what is verse working on',
    'what are you up to',
  ],
  nearMisses: [
    'what are you',
    'what do you want to become',
    'what do you think of yourself',
    "what's new with void",
    'find me work as a designer',
  ],
  match: (low, raw) => workingOnAsk(raw || low),
  run,
  part: null,
};
