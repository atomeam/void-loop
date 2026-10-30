// /generators/'s stage card: the generator open on the page, as an ask the stage's textgen skill reads back (skills/textgen.js textgenOf), so
// "See it as a card on the stage" shows five from that generator, not always the fantasy names. The ask is "<generator> generator", and only
// when textgen names the same generator for it. A list of the visitor's own (g=own) or a generator the skill does not know gives '', so the
// example ask stays: the visitor's own words never go into an ask. Pure: tools/textgen.test.mjs.
import { GENERATORS } from './generators.js';
import { textgenOf } from '../skills/textgen.js';

/** the stage ask for the generator in the page's query (location.search), or ''. Pure. */
export function cardAsk(search) {
  let g = ''; try { g = new URLSearchParams(String(search || '')).get('g') || ''; } catch (_) { return ''; }
  const gen = GENERATORS.find((x) => x.id === g); if (!gen) return '';
  const ask = gen.en.toLowerCase().replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim() + ' generator', t = textgenOf(ask);
  return t && t.id === gen.id ? ask : '';
}
