/**
 * baseconv skill: "ff hex to binary", "1010 binary to decimal", "convert 255 to hex", "0xff in decimal" (owner, 2026-10-24: back to the easy sites; hextobinary.com).
 * A card with the number in the base asked for, big, and in all four bases at once, exact at any size (lib/baseconv.js), with its signed reading and its text when it
 * has one; the full page with a box for each base is /base-converter/. The calculator answers plain decimal conversions first ("convert 255 to binary"); this takes
 * the ones that name a base to start from. Worked out on this device.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { parseAsk, convert } from '../lib/baseconv.js';

const NAME = { 2: 'binary', 8: 'octal', 10: 'decimal', 16: 'hex' };
const nameOf = (b) => NAME[b] || 'base ' + b;

function run(text, api) {
  const { showPage, esc } = api, ask = parseAsk(text), r = ask ? convert(ask.value, ask.from, ask.to) : { ok: false, why: 'I could not read that.' };
  showPage((el) => {
    el.dataset.cardKind = 'Converter';
    if (!r.ok) { el.innerHTML = '<h2>Base converter</h2><p>' + esc(r.why) + '</p><p><a href="/base-converter/">Open the converter</a></p>'; return; } // void-review: ok (escaped)
    const a = r.all, href = [2, 8, 10, 16].includes(r.from) ? '/base-converter/?b=' + r.from + '&v=' + encodeURIComponent(r.input) : '/base-converter/', four = [['Binary', a.bin], ['Octal', a.oct], ['Decimal', a.dec], ['Hex', a.hex]];
    el.innerHTML = '<h2>' + esc(r.input) + ' ' + esc(nameOf(r.from)) + ' to ' + esc(nameOf(r.to)) + '</h2>' // void-review: ok (every part escaped)
      + '<p class="bc-out" style="font:700 26px ui-monospace,monospace;word-break:break-all;margin:8px 0">' + esc(r.outGrouped) + '</p>'
      + '<table class="bc-all" style="border-collapse:collapse;font-size:14px;width:100%">' + four.map(([n, v]) => '<tr><td style="padding:3px 10px 3px 0;opacity:.7">' + n + '</td><td style="font-family:ui-monospace,monospace;word-break:break-all">' + esc(v) + '</td></tr>').join('') + '</table>'
      + '<p style="font-size:13px;margin:8px 0">' + esc(a.bits + ' bits' + (a.signed ? '; as a signed ' + a.signed.width + '-bit number: ' + a.signed.value.toString() : '') + (a.text ? '; as text: "' + a.text + '"' : '') + '.') + '</p>'
      + '<p><a class="bc-open" href="' + esc(href) + '">Open the converter</a></p>';
  });
  return 'baseconv';
}

export default {
  name: 'baseconv',
  examples: ['ff hex to binary', '1010 binary to decimal', '255 in hex', 'convert ff from hex to binary', '0xff in decimal', '256 to hex', 'what is 1010 in decimal'],
  nearMisses: ['100 c to f', 'translate hello to spanish', 'hello world to binary', 'what time is it in tokyo', 'how many cups in 3 liters'],
  match(lower, text) { return !!parseAsk(text || lower); },
  run
};
