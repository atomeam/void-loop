/**
 * certainty-budget skill - "certainty budget" / "certainty budget of 3" / "refill certainty" (owner, 2026-10-18).
 * A budget of hard claims for this session (default 5, memory only). The card has a box: a hard claim ("it will definitely work")
 * costs one; questions, options and hedged lines are free. At 0 the box accepts only questions and options. "refill certainty:
 * <a fact you confirmed>" (or the card's button, after typing the fact) restores it. A heuristic, not a lie detector.
 */
import { budgetIntent, newBudget, spend, refill, DEFAULT_BUDGET } from '../lib/stage-pack-i.js';
import { softCard } from '../lib/stage-pack-h.js';

let budget = newBudget(DEFAULT_BUDGET); // this session only

function draw(api, note) {
  const { esc } = api;
  const el = softCard('certainty-budget', '<strong>certainty budget <span class="cb-badge" style="padding:1px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.3)">' + budget.left + '/' + budget.max + '</span></strong>' // void-review: ok (every value is escaped)
    + '<div class="cb-note" role="status" style="margin:6px 0;min-height:1.2em">' + esc(note || (budget.left > 0 ? 'Hard claims cost 1. Questions and options are free.' : 'Out of certainty: only questions and options now.')) + '</div>'
    + '<input class="cb-in" type="text" aria-label="a claim, question or option" placeholder="' + (budget.left > 0 ? 'say something' : 'ask a question or give options') + '" style="width:100%;box-sizing:border-box;font:inherit">'
    + '<div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="g-btn cb-send">say it</button><button type="button" class="g-btn cb-refill">refill certainty</button><button type="button" class="g-btn cb-x">close</button></div>');
  const input = el.querySelector('.cb-in');
  for (const ev of ['keydown', 'keyup']) input.addEventListener(ev, (e) => e.stopPropagation());
  const go = () => { const r = spend(budget, input.value); if (r.ok) { budget = r.state; draw(api, r.kind + ' accepted' + (r.kind === 'hard' ? ': 1 spent' : '')); } else draw(api, r.why); };
  el.querySelector('.cb-send').addEventListener('click', go);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  el.querySelector('.cb-refill').addEventListener('click', () => {
    const r = refill(budget, input.value);
    if (r.ok) { budget = r.state; draw(api, 'Refilled: that fact is confirmed.'); } else draw(api, 'To refill, type a fact you have confirmed, then press refill.');
  });
  el.querySelector('.cb-x').addEventListener('click', () => el.remove());
}

function run(text, api) {
  const it = budgetIntent(text);
  if (!it) return 'none';
  if (it.act === 'refill') {
    const r = refill(budget, it.fact);
    if (r.ok) { budget = r.state; draw(api, 'Refilled: that fact is confirmed.'); } else draw(api, 'To refill, say a fact you confirmed: "refill certainty: the invoice was paid".');
    return 'certainty-budget';
  }
  if (it.n) budget = newBudget(it.n);
  draw(api);
  return 'certainty-budget';
}

export default {
  name: 'certainty-budget',
  examples: ['certainty budget', 'certainty budget of 3', 'refill certainty'],
  nearMisses: ['what is a budget for a wedding', 'how certain is the weather forecast', 'refill my water bottle'],
  match(lower, text) { return !!budgetIntent(text || lower); },
  run
};
