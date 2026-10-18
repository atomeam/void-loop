/**
 * interrupt-priority skill - "set priority deep|normal|interruptible", "show deferred" (owner, 2026-10-18).
 * The level lives in memory for this page. Opt-in hook for the stage's soft suggestions: import { maySuggest } from
 * '../lib/stage-pack-i.js'; if it returns false the suggestion was queued instead of shown. deep blocks every soft suggestion,
 * normal lets only 'important' ones through, interruptible lets all. "show deferred" lists the queue. Nothing is hooked by default.
 */
import { priorityOf, deferredIntent, setPriority, getPriority, deferred, clearDeferred } from '../lib/stage-pack-i.js';
import { softCard } from '../lib/stage-pack-h.js';

function run(text, api) {
  const { esc } = api;
  const lvl = priorityOf(text);
  if (lvl) { setPriority(lvl); if (api.say) api.say('priority: ' + lvl + (lvl === 'deep' ? ' · soft suggestions wait in the queue' : '')); return 'interrupt-priority'; }
  if (!deferredIntent(text)) return 'none';
  const q = deferred();
  const el = softCard('interrupt-priority', '<strong>deferred</strong> <span style="opacity:.7">(priority: ' + esc(getPriority()) + ')</span>' // void-review: ok (every value is escaped)
    + (q.length ? '<ul class="ip-list" style="margin:6px 0 6px 18px;padding:0">' + q.map((m) => '<li>' + esc(m) + '</li>').join('') + '</ul><button type="button" class="g-btn ip-clear">clear</button> ' : '<p style="margin:6px 0">Nothing deferred.</p>')
    + '<button type="button" class="g-btn ip-x">close</button>');
  el.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('ip-clear')) clearDeferred();
    el.remove();
  });
  return 'interrupt-priority';
}

export default {
  name: 'interrupt-priority',
  examples: ['set priority deep', 'set priority interruptible', 'show deferred'],
  nearMisses: ['set priority to deep clean the kitchen', 'show deferred revenue accounting', 'set priority high on my task'],
  match(lower, text) { const t = text || lower; return !!priorityOf(t) || deferredIntent(t); },
  run
};
