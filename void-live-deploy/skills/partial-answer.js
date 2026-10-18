/**
 * partial-answer skill - "partial answer on <question>" / "tell me only what you know about <x>" (owner, 2026-10-18).
 * The answer is {known, missing, next_question}: the card shows only what the person's own facts say ("known: a; b / missing: c"),
 * then "blocked on: ...", and never pads. With no facts supplied it lists the inputs that kind of question usually needs (a small
 * local table). "fill the hole: <text>" fills exactly one hole and re-renders. No network, no model; the card lives until closed.
 */
import { partialOf, holeOf, fillHole } from '../lib/stage-pack-i.js';
import { softCard } from '../lib/stage-pack-h.js';

const CARD = 'partial-answer';
let live = null; // { subject, ans } of the open card

const open = () => typeof document !== 'undefined' && !!document.querySelector('.sph-card[data-sph="' + CARD + '"]');

function draw(esc) {
  const { subject, ans } = live;
  const li = (a) => a.map((x) => '<li>' + esc(x) + '</li>').join('');
  const el = softCard(CARD, '<strong>partial answer: ' + esc(subject) + '</strong>' // void-review: ok (every value is escaped)
    + (ans.known.length ? '<div style="margin-top:6px;opacity:.7">what is known</div><ul class="pa-known" style="margin:2px 0 6px 18px;padding:0">' + li(ans.known) + '</ul>' : '')
    + (ans.missing.length ? '<div class="pa-blocked" style="margin-top:6px"><span style="opacity:.7">blocked on:</span> ' + esc(ans.missing.join(', ')) + '</div>' : '<div class="pa-blocked" style="margin-top:6px">nothing blocked: that is everything you gave me.</div>')
    + (ans.next_question ? '<div class="pa-next" style="margin:6px 0">' + esc(ans.next_question) + ' <span style="opacity:.6">(reply: fill the hole: &hellip;)</span></div>' : '')
    + '<button type="button" class="g-btn pa-x">close</button>');
  el.querySelector('.pa-x').addEventListener('click', () => { live = null; el.remove(); });
}

function run(text, api) {
  const hole = open() && live ? holeOf(text) : '';
  if (hole) { live.ans = fillHole(live.ans, hole); draw(api.esc); return CARD; }
  const p = partialOf(text);
  if (!p) return 'none';
  live = { subject: p.subject, ans: { known: p.known, missing: p.missing, next_question: p.next_question } };
  draw(api.esc);
  return CARD;
}

export default {
  name: 'partial-answer',
  examples: ['partial answer on whether to move to Berlin', 'tell me only what you know about my trip'],
  nearMisses: ['the partial answer key for chapter 4', 'fill the hole in my wall', 'tell me everything about berlin'],
  match(lower, text) { const t = text || lower; return !!partialOf(t) || (open() && !!live && !!holeOf(t)); },
  run
};
