/**
 * technical-context skill - why a risky code term such as Rust unwrap or shell=True can fail, with the safer line and a caution shape on the stage (made with tools/new-skill.mjs).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 *   match: true when this skill should take the ask (the first skill in skills/order/ to say yes wins).
 *   run:   shows the answer; api.showPage(build) puts a card on the stage and api.esc escapes text. Return the skill's name.
 */
import { termOf, TERMS } from '../lib/technical-context.js';
import { ensure } from './shape.js';

/** the caution shape on the stage: the one shape becomes an amber triangle labelled with the term. */
function caution(st, term) {
  if (!st || !st.things || !st.stage) return false;
  const s = ensure(st, 'triangle');
  s.shapeType = 'triangle'; s.color = '#f5a623'; s.filled = true; s.caption = term.say;
  st.save(); if (st.render) st.render();
  return true;
}

function run(text, api) {
  const { showPage, esc } = api;
  const term = termOf(text);
  if (!term) return 'none';
  const shown = caution(api.stage, term);
  showPage((el) => {
    el.innerHTML = '<h2>\u26a0 ' + esc(term.say) + ' is a risk</h2><p>' + esc(term.sentence) + '</p>'
      + '<p><b>Goes wrong:</b> <code>' + esc(term.risky) + '</code></p><p><b>Safer:</b> <code>' + esc(term.safer) + '</code></p>'
      + (shown ? '<p class="sub">A caution shape is on the stage.</p>' : '')
      + '<div class="src">Source: Verse\'s own code review rules (the same words it uses on pasted code) \u00b7 paste code and say "review this" to check yours</div>';
  });
  return 'technical-context';
}

export default {
  name: "technical-context",
  examples: [
    "why is rust unwrap a risk",
    "is unwrap risky in rust",
    "technical context for unwrap",
    "is shell=True dangerous",
    "why is strcpy unsafe"
  ],
  nearMisses: [
    "unwrap a present",
    "what does context mean",
    "is rust faster than go",
    "is it risky to invest"
  ],
  match(lower, text) { return !!termOf(text || lower); },
  run
};
