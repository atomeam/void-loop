/**
 * textgen skill: "fantasy name generator", "band name generator", "give me a story prompt", "random generators" (owner, 2026-10-25: "and vice
 * versa , should be a card for all too"): the generators page as a card on the stage. It names the generator the ask is about, shows five of its
 * results from a seed, and links to /generators/ with the same generator and seed, so the page shows the same five and more. Pure lists and
 * seeding are lib/generators.js (the page's own); nothing is fetched. Made with tools/new-skill.mjs (docs/UPGRADING.md).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { GENERATORS, generate, newSeed } from '../lib/generators.js';

// a generator by the words in its label: "fantasy names" -> fantasy-names, "story prompt" -> story-prompts, "d&d npc" -> dnd-npcs
const stem = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z& ]+/g, ' ').trim().replace(/s\b/g, '');
const BY = GENERATORS.map((x) => [stem(x.en), x]);
/** the generator an ask names, the first one when it names none but asks for generators, or null. Pure. */
export function textgenOf(text) {
  const l = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  if (/^(?:random |text |writing |name )?generators$/.test(l)) return GENERATORS[0];
  if (/^(?:an? |some )?random colou?rs?$/.test(l)) return null; // one colour is the color skill's (issue #1695); the prefix rule below would read "colour" as "colour palette names"
  const m = /^(?:(?:give me|make me|make|show me|generate|i need)\s+)?(?:an? |some |\d{1,2} )?(?:random )?(.{3,40}?)(?: generator)?$/.exec(l);
  if (!m) return null;
  const asked = /(?:generator$|name$|^(?:give me|make|show me|generate|i need|random)\b)/.test(l); // a bare "band names" stays an encyclopedia ask
  if (!asked) return null;
  const want = stem(m[1]); const hit = BY.find(([k]) => k === want || k === want.replace(/ idea$/, '') || (want.length > 4 && k.startsWith(want + ' ')));
  return hit ? hit[1] : null;
}

function run(text, api) {
  const { showPage, esc } = api, gen = textgenOf(text); if (!gen) return 'none';
  const seed = newSeed(), out = generate(gen.id, seed, 5), href = '/generators/?' + new URLSearchParams({ g: gen.id, seed: String(seed) });
  showPage((el) => {
    el.dataset.page = '/generators/';
    el.innerHTML = '<h2>' + esc(gen.en) + '</h2>' // void-review: ok: escaped
      + '<ol style="margin:6px 0 10px;padding-left:22px;line-height:1.5">' + out.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>'
      + '<p><a class="tg-open" href="' + esc(href) + '">These five and more, with ' + (GENERATORS.length - 1) + ' other generators</a></p>'
      + '<div class="src">Made on this device from seed ' + seed + ', so the link gives the same ones again. Ask again for new ones.</div>';
  });
  return 'textgen';
}

export default {
  name: 'textgen',
  examples: ['fantasy name generator', 'band name generator', 'random generators', 'give me a story prompt'],
  nearMisses: ['random colour', 'random number', 'password generator', 'qr code generator', 'band names', 'what is a haiku'],
  match(lower, text) { return !!textgenOf(text || lower); },
  run
};
