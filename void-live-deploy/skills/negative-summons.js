/**
 * negative-summons skill - "summon everything except urgency" (owner, 2026-10-18).
 * The person names what must NOT appear; Verse summons up to four existing stage things that fit the opposite mood
 * (lib/stage-pack-h.js: a curated mood table, then the skills' own examples), one after another through the stage's normal ask,
 * and a small card "without urgency" lists them with a clear button. No model call, nothing sent anywhere. Nothing appears until asked.
 */
import { negativeOf, summonSet, summonTitle, loadSkills, softCard } from '../lib/stage-pack-h.js';

async function run(text, api) {
  const word = negativeOf(text);
  if (!word) return 'none';
  const { esc } = api, stage = api.stage;
  const skills = await loadSkills();
  const set = summonSet(word, skills);
  const before = new Set(Object.keys(stage.things()));
  const done = [];
  for (const p of set.picks) {
    try { await stage.ask(p.ask); done.push(p); } catch (_) {}
  }
  const made = Object.keys(stage.things()).filter((id) => !before.has(id));
  const body = done.length
    ? '<ul style="margin:6px 0 8px;padding-left:18px">' + done.map((p) => '<li>' + esc(p.ask) + ' <span style="opacity:.6">(' + esc(p.name) + ')</span></li>').join('') + '</ul>'
    : '<p style="margin:6px 0 8px">Nothing on the stage fits that mood yet.</p>';
  const el = softCard('negative-summons', '<strong>' + esc(summonTitle(word)) + '</strong>' // void-review: ok (every value is escaped)
    + '<div style="opacity:.7">' + esc(set.opposite) + ': what I summoned instead</div>' + body
    + '<button type="button" class="g-btn ns-clear">clear</button>');
  el.querySelector('.ns-clear').addEventListener('click', () => {
    const things = stage.things();
    for (const id of made) delete things[id];
    try { stage.closePage(); } catch (_) {}
    try { stage.save(); stage.render(); } catch (_) {}
    el.remove();
  });
  return 'negative-summons';
}

export default {
  name: 'negative-summons',
  examples: [
    'summon everything except urgency',
    'summon everything except noise'
  ],
  nearMisses: [
    'summon the ancient ones',
    'everything except tuesday is fine'
  ],
  match(lower, text) { return !!negativeOf(text || lower); },
  run
};
