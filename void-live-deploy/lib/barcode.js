// Code 128 barcodes, drawn here as an SVG (2026-11-06, docs/GAPS.md: "make a barcode for 12345" fell to an article). Nothing is fetched.
// The bar table is the standard one (checked symbol by symbol against JsBarcode 3.11.6's CODE128 constants). Code set C (two digits a symbol)
// is used for a text of 4 or more digits with an even length; any other text in printable ASCII uses code set B. Pure functions.
export const WIDTHS = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(' ');
export const MAX = 80;

/** { set, codes } for a text (codes are the symbol values: start, data, checksum, stop), or null when it cannot be encoded. Pure. */
export function code128(text) {
  const s = String(text == null ? '' : text);
  if (!s || s.length > MAX || !/^[\x20-\x7e]+$/.test(s)) return null;
  const C = /^\d+$/.test(s) && s.length >= 4 && s.length % 2 === 0;
  const data = C ? s.match(/\d\d/g).map(Number) : Array.from(s, (ch) => ch.charCodeAt(0) - 32);
  const start = C ? 105 : 104;
  const check = data.reduce((sum, v, i) => sum + v * (i + 1), start) % 103;
  return { set: C ? 'C' : 'B', codes: [start, ...data, check, 106] };
}

/** the bar widths in modules, bar first, with a 10-module quiet zone on each side left to the drawing. Pure. */
export const modulesOf = (codes) => codes.map((v) => WIDTHS[v]).join('');

/** an SVG of the barcode with the text under it, or '' when the text cannot be encoded. Pure. */
export function barcodeSvg(text, { module = 2, height = 80, esc = (x) => x } = {}) {
  const c = code128(text); if (!c) return '';
  const w = modulesOf(c.codes), quiet = 10;
  let x = quiet, d = '';
  for (let i = 0; i < w.length; i++) { const n = +w[i]; if (i % 2 === 0) d += 'M' + x * module + ' 0h' + n * module + 'v' + height + 'h-' + n * module + 'z'; x += n; }
  const width = (x + quiet) * module;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + (height + 22) + '" width="' + width + '" style="max-width:100%;height:auto;background:#fff;border-radius:6px" role="img" aria-label="Code 128 barcode">'
    + '<path fill="#000" d="' + d + '"/><text x="' + width / 2 + '" y="' + (height + 17) + '" text-anchor="middle" font-family="ui-monospace,monospace" font-size="14" fill="#000">' + esc(text) + '</text></svg>';
}
