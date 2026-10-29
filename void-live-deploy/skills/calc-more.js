/**
 * calc-more skill — two small converters the page's answers did not have (tools pack 3, owner 2026-10-18, list items 45 and 47):
 *   "pixels to cm at 96 dpi" / "300 px in cm at 150 dpi" / "5 cm to pixels at 300 dpi"   pixels <-> cm, mm, inches at a DPI
 *   "convert 100 usd to eur at 0.92" / "if 1 usd is 0.92 eur, what is 250 usd"           a currency at the rate YOU give it
 * and "dpi converter" / "currency converter with my own rate" for the live version of each. The currency one never looks a
 * rate up (the owner's rule: manual rate only, no live rates, no prices), so the answer says whose rate it used. Percent
 * change, split bill, ratio, aspect ratio, units, random number and dice are already answered by the page (calc, tip, chance).
 * Tip with tax lives in skills/tip.js. The maths is in lib/calc-more.js (tests: tools/tools-pack3.test.mjs).
 */
import { parsePx, parseFx, openerOf, pxConvert, fxConvert, fmt, DEFAULT_DPI, CODES } from '../lib/calc-more.js';

const UNIT_LABEL = { px: 'px', cm: 'cm', mm: 'mm', in: 'in' };
const sel = (id, opts, cur) => '<select id="' + id + '" aria-label="' + id + '">' + opts.map((o) => '<option value="' + o + '"' + (o === cur ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>';

function pxPage(p, api) {
  const { showPage, esc } = api;
  const v = p.value === null ? 100 : p.value, out = pxConvert(v, p.from, p.to, p.dpi);
  showPage((el) => {
    el.innerHTML = '<h2>' + esc('Pixels and ' + (p.from === 'px' ? UNIT_LABEL[p.to] : UNIT_LABEL[p.from])) + '</h2>'
      + '<div class="sub">' + esc(fmt(v) + ' ' + UNIT_LABEL[p.from] + ' at ' + fmt(p.dpi) + ' dpi' + (p.dpiGiven ? '' : ' (the screen standard, 96)')) + '</div>'
      + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(fmt(out)) + '<span style="font-size:18px;color:#8a8a8a"> ' + esc(UNIT_LABEL[p.to]) + '</span></div>'
      + '<p style="color:#8a8a8a">' + esc(p.value === null ? 'No number given, so this shows 100. Ask “dpi converter” to type your own.' : '1 inch is 2.54 cm is 25.4 mm, and a screen or print holds ' + fmt(p.dpi) + ' pixels in one inch.') + '</p>'
      + '<div class="src">Formula: inches = px ÷ dpi; cm = inches × 2.54; mm = inches × 25.4 · as of Oct 2026</div>';
  });
  return 'calc-more';
}

function pxLive(api) {
  const { showPage } = api;
  const el = showPage((p) => {
    p.innerHTML = '<h2>Pixels and print size</h2><div style="display:grid;grid-template-columns:auto 1fr;gap:8px 12px;align-items:center;max-width:340px;margin:10px 0">'
      + '<label for="pc-v">Value</label><input id="pc-v" type="number" inputmode="decimal" min="0" step="any" value="1920">'
      + '<label for="pc-a">From</label>' + sel('pc-a', ['px', 'cm', 'mm', 'in'], 'px')
      + '<label for="pc-b">To</label>' + sel('pc-b', ['px', 'cm', 'mm', 'in'], 'cm')
      + '<label for="pc-d">DPI</label><input id="pc-d" type="number" inputmode="numeric" min="1" max="2400" value="' + DEFAULT_DPI + '"></div>'
      + '<div id="pc-out" aria-live="polite" style="font-size:28px;line-height:1.4"></div><p style="color:#8a8a8a">96 is the screen standard; print is usually 300.</p>';
  });
  const q = (id) => el.querySelector('#' + id), out = q('pc-out');
  const upd = () => {
    const a = q('pc-a').value, b = q('pc-b').value, r = (a === 'px') === (b === 'px') ? null : pxConvert(+q('pc-v').value, a, b, +q('pc-d').value);
    out.textContent = r === null ? 'one side has to be px' : fmt(+q('pc-v').value) + ' ' + a + ' = ' + fmt(r) + ' ' + b;
  };
  ['pc-v', 'pc-a', 'pc-b', 'pc-d'].forEach((id) => q(id).addEventListener('input', upd)); upd();
  return 'calc-more';
}

function fxPage(f, api) {
  const { showPage, esc } = api;
  const c = fxConvert(f.amount, f.rate), F = f.from.toUpperCase(), T = f.to.toUpperCase();
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(F + ' to ' + T) + '</h2>'
      + '<div class="sub">' + esc(fmt(f.amount) + ' ' + F + ' at your rate of ' + fmt(f.rate) + ' ' + T + ' per 1 ' + F) + '</div>'
      + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(fmt(c.out)) + '<span style="font-size:18px;color:#8a8a8a"> ' + esc(T) + '</span></div>'
      + '<ul><li><b>Your rate</b> 1 ' + esc(F) + ' = ' + esc(fmt(f.rate)) + ' ' + esc(T) + '</li><li><b>The other way</b> 1 ' + esc(T) + ' = ' + esc(fmt(c.inverse)) + ' ' + esc(F) + '</li></ul>'
      + '<p style="color:#8a8a8a">This used only the rate you typed. I don’t look rates up here, so check yours against your bank or card before you rely on it.</p>'
      + '<div class="src">Formula: result = amount × rate · as of Oct 2026</div>';
  });
  return 'calc-more';
}

function fxLive(api) {
  const { showPage } = api, codes = [...CODES].sort();
  const el = showPage((p) => {
    p.innerHTML = '<h2>Currency converter, your rate</h2><div style="display:grid;grid-template-columns:auto 1fr;gap:8px 12px;align-items:center;max-width:340px;margin:10px 0">'
      + '<label for="fx-v">Amount</label><input id="fx-v" type="number" inputmode="decimal" min="0" step="any" value="100">'
      + '<label for="fx-a">From</label>' + sel('fx-a', codes, 'usd')
      + '<label for="fx-b">To</label>' + sel('fx-b', codes, 'eur')
      + '<label for="fx-r">Rate</label><input id="fx-r" type="number" inputmode="decimal" min="0" step="any" placeholder="units of To per 1 From"></div>'
      + '<div id="fx-out" aria-live="polite" style="font-size:28px;line-height:1.4"></div><p style="color:#8a8a8a">You type the rate; nothing is looked up.</p>';
  });
  const q = (id) => el.querySelector('#' + id), out = q('fx-out');
  const upd = () => {
    const c = fxConvert(+q('fx-v').value, +q('fx-r').value);
    out.textContent = !c ? 'type the rate you want to use' : fmt(+q('fx-v').value) + ' ' + q('fx-a').value.toUpperCase() + ' = ' + fmt(c.out) + ' ' + q('fx-b').value.toUpperCase() + ' (1 ' + q('fx-b').value.toUpperCase() + ' = ' + fmt(c.inverse) + ' ' + q('fx-a').value.toUpperCase() + ')';
  };
  ['fx-v', 'fx-a', 'fx-b', 'fx-r'].forEach((id) => q(id).addEventListener('input', upd)); upd(); setTimeout(() => q('fx-r').focus(), 50);
  return 'calc-more';
}

export default {
  name: 'calc-more',
  examples: [
    'pixels to cm at 96 dpi', '300 px in cm at 150 dpi', '5 cm to pixels at 300 dpi', 'dpi converter',
    'convert 100 usd to eur at 0.92', '250 euros in dollars at a rate of 1.08', 'if 1 usd is 0.92 eur, what is 250 usd', 'currency converter with my own rate',
  ],
  nearMisses: ['convert 5 miles to km', '5 cm to inches', 'what is a pixel', 'pixel 8 review', '100 usd in eur', 'convert 5 kgs to lbs at 2.2', 'what is the dollar rate today', 'aspect ratio 1920x1080'],
  parsePx, parseFx,
  match(lower, text) { const t = text || lower; return !!(parsePx(t) || parseFx(t) || openerOf(t)); },
  async run(text, api) {
    const o = openerOf(text);
    if (o === 'px') return pxLive(api);
    if (o === 'fx') return fxLive(api);
    const p = parsePx(text); if (p) return pxPage(p, api);
    const f = parseFx(text); if (f) return fxPage(f, api);
    return 'none';
  },
};
