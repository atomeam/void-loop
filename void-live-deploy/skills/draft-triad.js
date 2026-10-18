/**
 * draft-triad skill - "three drafts of <text>" (owner, 2026-10-18): three cards labelled aggressive, conservative, weird, built
 * from fixed templates (no model call). Each card has dismiss; "keep this draft" on a card marks the winner and the others go.
 */
import { triadOf, triad } from '../lib/stage-pack-i.js';
import { softCard } from '../lib/stage-pack-h.js';

function run(text, api) {
  const src = triadOf(text);
  if (!src) return 'none';
  const { esc } = api;
  const drafts = triad(src);
  const el = softCard('draft-triad', '<strong>three drafts</strong><div class="dt-list" style="display:grid;gap:8px;margin:8px 0">' // void-review: ok (every value is escaped)
    + drafts.map((d) => '<div class="dt-card" data-label="' + esc(d.label) + '" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.18)"><div class="dt-label" style="opacity:.7;text-transform:uppercase;font-size:11px">' + esc(d.label) + '</div><div class="dt-text">' + esc(d.text) + '</div><div style="margin-top:6px;display:flex;gap:6px"><button type="button" class="g-btn dt-keep">keep this draft</button><button type="button" class="g-btn dt-x">dismiss</button></div></div>').join('')
    + '</div><button type="button" class="g-btn dt-close">close</button>');
  el.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('button');
    if (!t) return;
    const card = t.closest('.dt-card');
    if (t.classList.contains('dt-close')) { el.remove(); return; }
    if (!card) return;
    if (t.classList.contains('dt-x')) { card.remove(); if (!el.querySelector('.dt-card')) el.remove(); return; }
    if (t.classList.contains('dt-keep')) {
      el.querySelectorAll('.dt-card').forEach((c) => { if (c !== card) c.remove(); });
      card.dataset.winner = 'true';
      card.querySelector('.dt-label').textContent = 'kept: ' + card.dataset.label;
      card.querySelector('.dt-keep').remove();
    }
  });
  return 'draft-triad';
}

export default {
  name: 'draft-triad',
  examples: ['three drafts of we are late with the report'],
  nearMisses: ['the three drafts of the novel are in the folder', 'write a draft email to bob', 'draft of my resume'],
  match(lower, text) { return !!triadOf(text || lower); },
  run
};
