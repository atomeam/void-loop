/**
 * goal skill — frontier #18, "Can you make it do this?": "give me a challenge with this" beside an explainer puts a short
 * goal next to it ("Make the driven gear turn half as fast as the driver"). The visitor uses the explainer's own controls;
 * the goal card takes the source's `observations` live (the stage tells it whenever something changed, see save() in
 * void.html) and shows what the source says now; Check compares that with the goal and says what matches and what still
 * needs changing; Hint explains the relationship without giving the setting. No timer, no hidden grading.
 * All the logic is skills/goal-rules.js (tests: tools/goal.test.mjs). Not saved: the goal card is ephemeral.
 */
import * as Goal from './goal-rules.js';
import { sourceOf } from './quiz.js';

export function goalAskOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const it = '(?:this|that|it|these|those|the\\s+(?:gears?|explainer))';
  return new RegExp('^(?:please\\s+)?(?:give|set|show)\\s+me\\s+a\\s+(?:challenge|goal)\\s+(?:with|for|on)\\s+' + it + '(?:\\s+please)?$|^challenge\\s+me\\s+(?:with|on)\\s+' + it + '$|^can\\s+(?:i|you)\\s+make\\s+' + it + '\\s+do\\s+something$').test(t) ? { start: true } : null;
}

const NONE = 'Nothing here to set a goal with yet · ask "explain gears", then "give me a challenge with this"';

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card goal-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(380px, calc(100vw - 20px))';
  const head = document.createElement('div'); head.className = 'g-head';
  head.innerHTML = '<span class="g-title">Goal</span><span class="g-sub goal-src"></span>';
  const text = document.createElement('div'); text.className = 'goal-text'; text.style.cssText = 'font-weight:600;margin:6px 0';
  const now = document.createElement('div'); now.className = 'goal-now g-sub'; now.setAttribute('aria-live', 'polite');
  const feedback = document.createElement('div'); feedback.className = 'goal-feedback g-status'; feedback.setAttribute('aria-live', 'polite'); feedback.style.cssText = 'display:block;margin-top:8px;white-space:pre-line';
  const hint = document.createElement('div'); hint.className = 'goal-hint g-rules'; hint.hidden = true;
  const bar = document.createElement('div'); bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:10px';
  el.append(head, text, now, bar, feedback, hint);
  const stop = (b) => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); return b; };
  const btn = (label, cls, fn) => { const b = stop(document.createElement('button')); b.type = 'button'; b.className = 'g-btn ' + cls; b.textContent = label; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };

  const goal = Goal.goalOf(th.sourceKind, th.goalId);
  const source = () => { const s = stageApi.things()[th.sourceId], k = s && stageApi.kinds()[s.kind]; return s && k && k.gives && k.gives.observations ? { s, doc: k.gives.observations(s) } : null; };
  // the live port: what the source says now, re-read whenever the stage says something changed
  function live() {
    const src = source();
    if (!goal) { text.textContent = NONE; now.textContent = ''; return; }
    text.textContent = goal.text;
    if (!src) { now.textContent = 'The ' + th.sourceKind + ' card is gone · ask for it again to keep going'; return; }
    now.textContent = 'Now: ' + goal.conditions.map((c) => { const i = src.doc.items.find((x) => x.id === c.id); return i ? (i.label || c.id) + ' ' + (i.displayValue != null ? i.displayValue : i.value) : c.id + ' –'; }).join(' · ');
    el.dataset.met = String(Goal.check(goal, src.doc).status === 'met');
  }
  function doCheck() {
    const src = source();
    const r = src ? Goal.check(goal, src.doc) : { status: 'invalid', rows: [], errors: ['the source card is gone'] };
    el.dataset.status = r.status;
    feedback.textContent = r.status === 'met' ? 'Done: ' + r.rows.map((x) => x.say).join('\n')
      : r.status === 'invalid' ? 'Could not check: ' + r.errors.join(' · ')
      : 'Not yet:\n' + r.rows.map((x) => (x.ok ? 'matches: ' : 'still to change: ') + x.say).join('\n');
  }
  head.querySelector('.goal-src').textContent = 'with the ' + th.sourceKind + ' · live';
  if (goal) bar.append(btn('Check', 'g-primary goal-check', doCheck), btn('Hint', 'goal-hint-btn', () => { hint.textContent = goal.hint; hint.hidden = false; }));
  live();
  const onChange = () => { if (!el.isConnected) { removeEventListener('void:stage-change', onChange); return; } live(); };
  addEventListener('void:stage-change', onChange);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

async function run(text, api) {
  if (!goalAskOf(text)) return 'none';
  const things = api.stage.things(), kinds = api.stage.kinds ? api.stage.kinds() : {};
  const src = sourceOf(things, kinds, api.stage.selected && api.stage.selected());
  const goals = src ? Goal.goalsFor(src.kind) : [];
  if (!src || !goals.length) { api.say(src ? 'No goals for the ' + src.kind + ' yet · the gears have them: "explain gears", then "give me a challenge with this"' : NONE); return 'goal'; }
  const g = Goal.nextGoal(src.kind, kinds[src.kind].gives.observations(src));
  if (!g) { api.say('The ' + src.kind + ' already meet every goal Void has for them · change them and ask again'); return 'goal'; }
  const mine = Object.values(things).find((t) => t.kind === 'goal');
  if (mine) { mine.sourceId = src.id; mine.sourceKind = src.kind; mine.goalId = g.id; api.stage.render(); if (api.stage.center) api.stage.center(mine.id); }
  else api.summon('goal', { sourceId: src.id, sourceKind: src.kind, goalId: g.id, center: true });
  api.say('Goal: ' + g.text + ' · use the ' + src.kind + '\'s own controls, then Check');
  return 'goal';
}

export default {
  name: 'goal',
  goalAskOf,
  examples: ['give me a challenge with this', 'give me a goal with this', 'set me a challenge with the gears', 'challenge me with this', 'can you make it do something'],
  nearMisses: ['give me a challenge', 'give me five minutes with this', 'quiz me on this', 'challenge accepted', 'set a goal to run 5k', 'the challenge of climate change'],
  match(lower, text) { return !!goalAskOf(text); },
  run,
  // ephemeral and a learning card; it takes the source's observations live (the quiz and the challenge take a snapshot)
  stageKinds: { goal: { mount, ephemeral: true, learning: true, takes: { observations: 'live' } } },
};
