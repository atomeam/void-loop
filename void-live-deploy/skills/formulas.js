/**
 * formulas skill — one of the 164 formula calculators of /calculators/ (lib/calculators.js) on a card: "pipe surface area calculator",
 * "ohms law current calculator", "calculator for molar mass", and "formula calculators" for the library. The card works the calculator
 * out with its everyday inputs, shows the formula, each input with its unit and the answer, and links to the full page with the same
 * calculator open, where every box takes units and the answer is a link. Late in the order, so the page's own answers (sums, tip, units,
 * dates) keep their asks; only a calculator whose name holds every word asked is taken. Tests: tools/calculators.test.mjs.
 */
import { CALCULATORS, run, search } from '../lib/calculators.js';

const fold = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '');
const FILLER = new Set(['a', 'an', 'the', 'for', 'of', 'online', 'free', 'my', 'me', 'open', 'show', 'calculator', 'calculators', 'calc', 'with', 'units', 'unit']);
// asks a skill earlier in the order answers with its own card (time-math the age calculator, nutrition bmi and calories, savings,
// home paint and flooring, walls wallpaper and drywall): formulas does not claim them, so the two never overlap (tools/skill-overlap.mjs)
const OWNED = new Set(['age', 'bmi', 'calorie', 'calories', 'savings', 'paint', 'flooring', 'wallpaper', 'drywall', 'gpa', 'due date', 'sleep']); // gpa: grades, due date: pregnancy, sleep: sleep (tools/skill-overlap.mjs)
const LIBRARY = /^(?:open (?:the )?)?(?:formula|engineering|science|physics|chemistry) calculators?(?: with units)?$/;

/** the calculator an ask names: "<name> calculator" or "calculator for <name>", every word in its name; null otherwise. Pure. */
export function pick(text) {
  const t = fold(text).trim().replace(/[?.!]+$/, '');
  const m = t.match(/^(?:open (?:the |a )?)?(.+?) calc(?:ulator)?$/) || t.match(/^(?:open (?:the |a )?)?calc(?:ulator)? for (?:the |a )?(.+)$/);
  if (!m) return null;
  const words = m[1].split(/[^a-z0-9²³]+/).filter((w) => w && !FILLER.has(w));
  if (!words.length) return null;
  const top = search(words.join(' '))[0]; if (!top) return null;
  const name = fold(top.name + ' ' + top.id.replace(/-/g, ' '));
  return words.every((w) => name.includes(w)) ? top : null;
}
/** the words an ask names its calculator by, fillers dropped ("age calculator" gives "age"); '' when it names none. Pure. */
function asked(text) {
  const t = fold(text).trim().replace(/[?.!]+$/, '');
  const m = t.match(/^(?:open (?:the |a )?)?(.+?) calc(?:ulator)?$/) || t.match(/^(?:open (?:the |a )?)?calc(?:ulator)? for (?:the |a )?(.+)$/);
  return m ? m[1].split(/[^a-z0-9²³]+/).filter((w) => w && !FILLER.has(w)).join(' ') : '';
}
/** whether an ask opens the whole library. Pure. */
export const isLibrary = (text) => LIBRARY.test(fold(text).trim().replace(/[?.!]+$/, ''));

function card(calc, api) {
  const { showPage, esc } = api, r = run(calc), href = '/calculators/?calc=' + encodeURIComponent(calc.id);
  showPage((p) => {
    p.dataset.page = '/calculators/';
    p.innerHTML = '<h2>' + esc(calc.name) + '</h2><div class="sub">' + esc(calc.cat + ' · ' + calc.formula) + '</div>'
      + '<ul>' + r.inputs.map((i) => '<li><b>' + esc(i.label) + '</b> ' + esc(i.raw + (i.unit ? ' ' + i.unit : '')) + '</li>').join('') + '</ul>'
      + r.outputs.map((o, n) => '<div style="' + (n ? 'font-size:18px;margin:2px 0' : 'font-size:40px;font-weight:300;line-height:1.15;margin:6px 0 4px') + '">' + (n ? '<b>' + esc(o.label) + '</b> ' : '') + esc(r.error ? r.error : o.text) + '</div>').join('')
      + '<p><a href="' + esc(href) + '">Change the numbers and units</a> · every box takes units, and the answer is a link you can share.</p>';
  });
  return 'formulas';
}
function library(api) {
  const { showPage, esc } = api, cats = new Map();
  for (const c of CALCULATORS) cats.set(c.cat, (cats.get(c.cat) || 0) + 1);
  showPage((p) => {
    p.dataset.page = '/calculators/';
    p.innerHTML = '<h2>Formula calculators</h2><div class="sub">' + esc(CALCULATORS.length + ' calculators, every box takes units') + '</div>'
      + '<ul>' + [...cats].map(([c, n]) => '<li>' + esc(c + ' (' + n + ')') + '</li>').join('') + '</ul>'
      + '<p><a href="/calculators/">Open the calculators</a>, or <a href="/calculators/#build">build your own formula</a>.</p>';
  });
  return 'formulas';
}

export default {
  name: 'formulas',
  examples: ['pipe surface area calculator', 'ohms law current calculator', 'calculator for molar mass', 'kinetic energy calculator', 'formula calculators'],
  nearMisses: ['calculator', 'open a calculator', 'what is 17% of 240', 'how do calculators work', 'calculator watch'],
  pick, isLibrary,
  match(lower, text) { const t = text || lower; return isLibrary(t) || (!!pick(t) && !OWNED.has(asked(t))); },
  async run(text, api) {
    if (isLibrary(text)) return library(api);
    const c = pick(text); return c ? card(c, api) : 'none';
  },
};
