/**
 * home skill - paint and flooring for a room, the way the best paint and flooring calculators do it (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Paint: "how much paint do i need for a 12x14 room", "paint for a 10x12 bedroom with 9 foot ceilings",
 *   "how many gallons of paint for a 12 by 14 room with 2 doors and 3 windows", "paint a 12x14 room and the ceiling",
 *   "how much paint for the ceiling of a 12x14 room", "how much paint for a 4 by 5 metre room", "paint calculator".
 *   Walls = perimeter x ceiling height (8 ft by default), less 20 sq ft a door and 15 sq ft a window (1 door, 2 windows
 *   unless you say), x coats (2) / 350 sq ft per gallon (the conservative end of Sherwin-Williams, Benjamin Moore and
 *   Behr's 350-400). Shows gallons, what to buy (gallons + quarts, a 5-gallon bucket when it pays), primer, and the cost
 *   when you give a price. Metric rooms get litres at 10 m2 per litre a coat (2.4 m walls, 1.9 m2 doors, 1.4 m2 windows).
 * Flooring: "how much flooring do i need for a 12x14 room", "how many boxes of laminate for a 15x20 room boxes cover 22 sq ft",
 *   "how many 12x24 tiles for a 10x12 floor", "how much carpet for a 12x14 room", "herringbone flooring for a 12x16 room",
 *   "flooring calculator". Area x (1 + waste: 10% straight, 15% diagonal, 20% herringbone or chevron), boxes rounded up,
 *   tiles from the tile size, carpet in square yards with the length off a 12-ft roll, and baseboard for the room.
 * Leaves calc's one-liners to calc ("how many gallons of paint for 400 square feet", "how many tiles 12 inch for 180 square feet").
 */
const WORDN = { no: 0, none: 0, zero: 0, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
const nOf = (s) => (s in WORDN ? WORDN[s] : parseFloat(s));
const NUM = '(\\d+(?:\\.\\d+)?)';
const FT = "(?:'|ft|feet|foot)";
const MET = '(?:m|meters?|metres?)';
const UNIT = "(?:'|ft\\.?|feet|foot|m|meters?|metres?|cm)";
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const fmt = (x, d) => Number(x).toLocaleString('en-US', { maximumFractionDigits: d == null ? 1 : d });

// the exact asks calc already answers in one line stay calc's
const CALC_PAINT = /^how\s+(?:many\s+gallons\s+of|much)\s+paint\s+(?:do\s+i\s+need\s+)?(?:for|to\s+cover)\s+(\d+(?:\.\d+)?)\s*(?:square\s+feet|sq\s*ft|sqft)(?:\s+(?:with\s+)?(one|two|1|2|three|3)\s+coats?)?$/;
const CALC_TILE = /^how\s+many\s+(?:(\d+(?:\.\d+)?)\s*(?:inch|in|")\s+)?tiles?\s+(?:(\d+(?:\.\d+)?)\s*(?:inch|in|")\s+)?(?:do\s+i\s+need\s+)?(?:for|to\s+cover)\s+(\d+(?:\.\d+)?)\s*(?:square\s+feet|sq\s*ft|sqft)$/;

function clean(text) {
  return String(text || '').toLowerCase().replace(/[?!]+$/, '').replace(/[\u2019]/g, "'").replace(/[\u201c\u201d\u2033]/g, '"')
    .replace(/\u00d7/g, 'x').replace(/(\d)\s*\*\s*(\d)/g, '$1 x $2').replace(/\s+/g, ' ').trim().replace(/\.$/, '');
}

// "12x14", "12 by 14", "12 ft x 14 ft", "12' x 14'", "4 by 5 metre", "12'6\" x 14'": [a, b, metric]
function dimsOf(t) {
  const ftin = "(\\d+(?:\\.\\d+)?)\\s*(?:'|ft|feet|foot)\\s*(\\d{1,2})\\s*(?:\"|in(?:ch(?:es)?)?)";
  let m = t.match(new RegExp('(?:' + ftin + '|' + NUM + '\\s*(' + UNIT + ')?)\\s*(?:x|by)\\s*(?:' + ftin + '|' + NUM + '\\s*(' + UNIT + ')?)(?![\\d.])'));
  if (!m) return null;
  const val = (ft, inch, n) => (ft != null ? +ft + +inch / 12 : +n);
  let a = val(m[1], m[2], m[3]), b = val(m[5], m[6], m[7]);
  const u = (m[4] || m[8] || '').replace(/\.$/, '');
  let metric = /^(?:m|met|cm)/.test(u) || (!u && new RegExp('\\b' + MET + '\\b').test(t.slice(m.index + m[0].length, m.index + m[0].length + 12)));
  if (u === 'cm') { a /= 100; b /= 100; metric = true; }
  if (!(a > 0 && b > 0)) return null;
  if (metric ? (a > 60 || b > 60) : (a > 200 || b > 200)) return null; // a room, not a field
  return { a, b, metric, at: m.index, len: m[0].length };
}
function areaOf(t) { // "400 sq ft of walls", "35 m2 of floor"
  let m = t.match(new RegExp(NUM + '\\s*(square\\s+feet|square\\s+foot|sq\\.?\\s*ft|sqft|ft2|square\\s+met(?:er|re)s?|sq\\.?\\s*m|m2|m\\u00b2)\\b'));
  if (!m) return null;
  return { area: +m[1].replace(/,/g, ''), metric: /met|m2|m\u00b2|sq\.?\s*m\b/.test(m[2]) };
}
function countOf(t, word) {
  const m = t.match(new RegExp('\\b(\\d+|no|none|zero|a|an|one|two|three|four|five|six|seven|eight)\\s+(?:\\w+\\s+)?' + word + 's?\\b'));
  return m ? nOf(m[1]) : null;
}
function heightOf(t, metric) {
  let m = t.match(new RegExp(NUM + '\\s*(?:-\\s*)?(' + "'|ft|feet|foot|m|meters?|metres?" + ')?\\s*(?:-\\s*)?(?:high\\s+|tall\\s+)?ceilings?\\b'))
    || t.match(new RegExp('ceilings?\\s+(?:are\\s+|is\\s+|of\\s+|at\\s+)?' + NUM + '\\s*(' + "'|ft|feet|foot|m|meters?|metres?" + ')?'))
    || t.match(new RegExp('(?:walls?\\s+(?:are\\s+)?|wall\\s+height\\s+(?:of\\s+)?)' + NUM + '\\s*(' + "'|ft|feet|foot|m|meters?|metres?" + ')?\\s*(?:high|tall)?'));
  if (!m) return metric ? 2.4 : 8;
  let h = +m[1];
  const u = m[2] || '';
  if (metric && /^(?:'|f)/.test(u)) h *= 0.3048;
  if (!metric && /^m/.test(u)) h /= 0.3048;
  if (metric ? (h < 1.8 || h > 8) : (h < 6 || h > 30)) return null;
  return h;
}
function priceOf(t, per) { // "$45 a gallon", "at 38 per gallon", "$3.50 a sq ft", "£30 a tin"
  const re = per === 'paint'
    ? /(?:[$\u00a3\u20ac]\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:dollars|bucks))\s*(?:\/|a|an|per|each)?\s*(gal(?:lon)?s?|can|tin|bucket|l|lit(?:er|re)s?|quart)?\b/
    : /(?:[$\u00a3\u20ac]\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:dollars|bucks))\s*(?:\/|a|an|per|each)?\s*(sq(?:uare)?\.?\s*(?:ft|feet|foot|yd|yards?|m|met(?:er|re)s?)|box|carton|tile|yd)?\b/;
  const m = t.match(re);
  if (!m) return null;
  const v = +(m[1] || m[2]);
  return v > 0 && v < 100000 ? { v, unit: (m[3] || '').replace(/\s+/g, ' '), cur: /\u00a3/.test(t) ? '\u00a3' : /\u20ac/.test(t) ? '\u20ac' : '$' } : null;
}

const PAINT_RE = /\b(paint|painting|primer)\b/;
const FLOOR_RE = /\b(floor(?:ing)?|laminate|hardwood|engineered\s+wood|vinyl(?:\s+plank)?|lvp|lvt|carpet(?:ing)?|tiles?|tiling|parquet|planks?)\b/;
const ASK_RE = /\b(how\s+much|how\s+many|gallons?|litres?|liters?|quarts?|cans?|tins?|need|needed|enough|boxes|cartons?|estimate|calculat\w*|for\s+(?:a|an|my|the|our)|to\s+(?:paint|cover|do|tile|floor|carpet)|paint\s+(?:a|an|my|the|our))\b/;
const NOT_RE = /\b(concrete|mulch|gravel|topsoil|soil|sand|compost|stone|slab|who\s+painted|painting\s+of|paintings|paint\s+by\s+numbers|mona\s+lisa|colou?rs?\s+(?:for|to)|what\s+colou?r|floor\s+plan|floors?\s+(?:of|in)\s+the|first\s+floor|second\s+floor|pelvic|dance\s+floor|floor\s+it|price\s+floor|ocean|sea\s+floor|seafloor|how\s+many\s+floors|nail\s+polish|car|truck|wall\s*paper\s+app)\b/;

function homeOf(text) {
  const t = clean(text);
  if (!t || t.length > 220) return null;
  if (/^(?:a\s+|open\s+(?:a\s+|the\s+)?|show\s+(?:me\s+)?(?:a\s+|the\s+)?)?(?:room\s+)?paint(?:ing)?\s+(?:calculator|estimator)$|^how\s+much\s+paint\s+do\s+i\s+need$/.test(t)) return { kind: 'paintcalc' };
  if (/^(?:a\s+|open\s+(?:a\s+|the\s+)?|show\s+(?:me\s+)?(?:a\s+|the\s+)?)?(?:floor(?:ing)?|laminate|tile|carpet|hardwood|vinyl\s+plank|lvp)\s+(?:calculator|estimator)$|^how\s+much\s+flooring\s+do\s+i\s+need$/.test(t)) return { kind: 'floorcalc' };
  if (NOT_RE.test(t) || CALC_PAINT.test(t) || CALC_TILE.test(t)) return null;
  const paint = PAINT_RE.test(t), floor = FLOOR_RE.test(t);
  if (!paint && !floor) return null;
  if (!ASK_RE.test(t) && !/\bfor\s+\d/.test(t) && !/\b(?:room|bedroom|kitchen|bathroom|hallway|office|walls?|basement)\b/.test(t)) return null;
  if (paint && /\bpaint\s+(?:the|it|this|that|my|everything|all)\s+(?:clock|note|notes|sticky|timer|counter|shape|circle|square|list|image|stage|void|background)\b/.test(t)) return null;

  // a tile size comes out first so it is not read as the room
  let tile = null, rest = t;
  let tm = t.match(/(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?|cm|mm)?\s*(?:x|by)\s*(\d+(?:\.\d+)?)\s*("|in(?:ch(?:es)?)?|cm|mm)?\s*(?:(?:porcelain|ceramic|floor|wall|marble|stone|subway)\s+)?tiles?\b/);
  if (tm) tile = { a: +tm[1], b: +tm[2], u: tm[3] || '' };
  else if ((tm = t.match(/(\d+(?:\.\d+)?)\s*(?:-\s*)?("|in(?:ch(?:es)?)?|cm|mm)\s*(?:square\s+)?(?:(?:porcelain|ceramic|floor|wall|marble|stone|subway)\s+)?tiles?\b/))) tile = { a: +tm[1], b: +tm[1], u: tm[2] };
  if (tile) { rest = t.slice(0, tm.index) + ' tiles ' + t.slice(tm.index + tm[0].length); const cm = /cm/.test(tile.u), mm = /mm/.test(tile.u); tile = { a: tile.a, b: tile.b, sqft: cm ? tile.a * tile.b / 929.0304 : mm ? tile.a * tile.b / 92903.04 : tile.a * tile.b / 144, metricSize: cm || mm, label: tile.a + (tile.a === tile.b && !tm[0].match(/x|by/) ? '' : ' \u00d7 ' + tile.b) + (cm ? ' cm' : mm ? ' mm' : ' in') }; if (!(tile.sqft > 0.01 && tile.sqft < 40)) return null; }

  const d = dimsOf(rest), ar = d ? null : areaOf(rest);
  if (!d && !ar) return null;
  if (paint && !floor || paint && /\b(?:paint|primer)\b/.test(t) && !/\b(?:how\s+much|how\s+many)\s+(?:\w+\s+)?(?:floor(?:ing)?|laminate|hardwood|carpet|tiles?|vinyl|lvp|lvt|boxes)\b/.test(t)) {
    // paint
    const metric = d ? d.metric : ar.metric;
    if (ar && !/\bwalls?\b|\bceilings?\b/.test(t)) return null; // a bare area is calc's
    const h = heightOf(t, metric);
    if (h == null) return null;
    let doors = countOf(t, 'door'), windows = countOf(t, 'window');
    if (/\bno\s+(?:doors?\s+(?:or|and|nor)\s+)?windows?\b/.test(t)) windows = 0;
    if (/\bno\s+doors?\b/.test(t)) doors = 0;
    const said = { doors: doors != null, windows: windows != null };
    if (doors == null) doors = 1; if (windows == null) windows = 2;
    if (doors > 20 || windows > 40) return null;
    const coatsM = t.match(/\b(\d|one|two|three|four)\s+coats?\b/); let coats = coatsM ? nOf(coatsM[1]) : 2;
    if (/\b(?:a\s+single|one)\s+coat\b/.test(t)) coats = 1;
    if (!(coats >= 1 && coats <= 4)) return null;
    const cl = /\bceilings?\b/.test(t.replace(new RegExp(NUM + '\\s*(?:-\\s*)?(?:\'|ft|feet|foot|m|meters?|metres?)?\\s*(?:-\\s*)?(?:high\\s+|tall\\s+)?ceilings?', 'g'), '').replace(/ceilings?\s+(?:are|is|of|at)\s+\d[^ ]*/g, ''));
    const ceilingOnly = cl && /\b(?:the\s+|a\s+|my\s+)?ceiling\s+(?:of|in|for)\b|\bjust\s+the\s+ceiling\b|\bonly\s+the\s+ceiling\b|\bpaint\s+(?:the|a|my)\s+ceiling\b/.test(t) && !/\bwalls?\b/.test(t) && !/\b(?:and|plus|including|with|also)\s+(?:the\s+)?ceiling/.test(t);
    const ceiling = cl;
    const trim = /\btrim\b|\bbaseboards?\b/.test(t);
    const primer = /\bprimer|\bprime\b|\bnew\s+drywall|\bbare\s+drywall/.test(t);
    return { kind: 'paint', d, ar, metric, h, doors, windows, said, coats, ceiling, ceilingOnly, trim, primer, price: priceOf(t, 'paint'), raw: text };
  }
  // flooring
  const metric = d ? d.metric : ar.metric;
  const mat = /\bcarpet/.test(t) ? 'carpet' : tile || /\btil(?:e|es|ing)\b/.test(t) ? 'tile' : /\bhardwood|engineered\s+wood|parquet/.test(t) ? 'hardwood' : /\bvinyl|lvp|lvt/.test(t) ? 'vinyl plank' : /\blaminate/.test(t) ? 'laminate' : 'flooring';
  const pattern = /\bherringbone|chevron/.test(t) ? 'herringbone' : /\bdiagonal|45\s*(?:degrees?|\u00b0)/.test(t) ? 'diagonal' : 'straight';
  const wm = t.match(/(\d+(?:\.\d+)?)\s*%\s*(?:waste|extra|overage)|(?:waste|extra|overage)\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*%/);
  let waste = wm ? +(wm[1] || wm[2]) / 100 : mat === 'carpet' ? 0.1 : pattern === 'herringbone' ? 0.2 : pattern === 'diagonal' ? 0.15 : 0.1;
  if (/\bno\s+waste\b/.test(t)) waste = 0;
  if (!(waste >= 0 && waste <= 0.5)) return null;
  const bm = t.match(new RegExp('(?:boxe?s?|cartons?|packs?)\\s+(?:that\\s+)?(?:covers?|are|is|of|hold|holds)\\s+' + NUM + '\\s*(?:sq(?:uare)?\\.?\\s*(?:ft|feet|foot|m|met(?:er|re)s?)|sqft|m2|ft2)'))
    || t.match(new RegExp(NUM + '\\s*(?:sq(?:uare)?\\.?\\s*(?:ft|feet|foot|m|met(?:er|re)s?)|sqft|m2|ft2)\\s*(?:a|per|each|in\\s+a|in\\s+each|/)\\s*(?:box|carton|pack)'));
  let box = bm ? +bm[1] : null;
  if (box != null && !(box > 0 && box < 500)) return null;
  // a box size given as "boxes cover 22 sq ft" must not have been read as the floor area
  let area = d ? d.a * d.b : ar.area;
  if (!d && bm && t.indexOf(bm[0]) <= t.indexOf(String(ar.area))) {
    const other = rest.replace(bm[0], ' '), a2 = areaOf(other);
    if (!a2) return null; area = a2.area;
  }
  if (!(area > 1 && area < (metric ? 5000 : 50000))) return null;
  return { kind: 'floor', d, area, metric, mat, pattern, waste, box, tile, price: priceOf(t, 'floor'), raw: text };
}

function paintMath(q) {
  const M = q.metric;
  const cover = M ? 10 : 350, doorA = M ? 1.9 : 20, winA = M ? 1.4 : 15, primerCover = M ? 8 : 300;
  let walls = 0, ceil = 0, gross = 0;
  if (q.d) {
    gross = 2 * (q.d.a + q.d.b) * q.h;
    walls = Math.max(0, gross - q.doors * doorA - q.windows * winA);
    if (q.ceiling) ceil = q.d.a * q.d.b;
  } else {
    if (/\bceilings?\b/.test(clean(q.raw)) && !/\bwalls?\b/.test(clean(q.raw))) ceil = q.ar.area; else walls = q.ar.area;
    gross = walls;
  }
  if (q.ceilingOnly) walls = 0;
  const wallG = walls * q.coats / cover, ceilG = ceil * q.coats / cover;
  const primerG = q.primer ? (walls + ceil) / primerCover : 0;
  return { cover, doorA, winA, gross, walls, ceil, wallG, ceilG, primerG };
}
// what to carry home: US gallons (+ quarts, a 5-gallon bucket past 4) or metric tins of 1, 2.5, 5 and 10 L
function buyOf(amount, metric) {
  if (amount <= 0) return '';
  if (metric) {
    // the mix of 10, 5, 2.5 and 1 L tins with the least spare paint, counting each extra tin as 0.6 L of spare
    let best = null;
    for (let a = 0; a <= Math.ceil(amount / 10); a++) for (let b = 0; b <= 2; b++) for (let c = 0; c <= 2; c++) for (let d = 0; d <= 3; d++) {
      const vol = a * 10 + b * 5 + c * 2.5 + d, n = a + b + c + d;
      if (vol + 1e-9 < amount || !n) continue;
      const score = vol + 0.6 * n;
      if (!best || score < best.score - 1e-9) best = { score, vol, n, k: [[a, 10], [b, 5], [c, 2.5], [d, 1]] };
    }
    return best.k.filter(([x]) => x).map(([x, z]) => x + ' \u00d7 ' + z + ' L').join(' + ');
  }
  const whole = Math.floor(amount), frac = amount - whole;
  if (amount > 4.25) { const buckets = Math.floor(amount / 5), rem = amount - buckets * 5; const g = rem <= 0.01 ? 0 : rem <= 0.25 ? 0.25 : Math.ceil(rem);
    return (buckets ? buckets + ' \u00d7 5-gallon bucket' + (buckets > 1 ? 's' : '') : '') + (g >= 1 ? (buckets ? ' + ' : '') + g + ' gallon' + (g > 1 ? 's' : '') : g ? (buckets ? ' + ' : '') + '1 quart' : ''); }
  if (frac <= 0.02) return whole + ' gallon' + (whole === 1 ? '' : 's');
  if (frac <= 0.25) return (whole ? whole + ' gallon' + (whole === 1 ? '' : 's') + ' + ' : '') + '1 quart';
  if (frac <= 0.5 && whole) return whole + ' gallon' + (whole === 1 ? '' : 's') + ' + 2 quarts';
  return Math.ceil(amount) + ' gallon' + (Math.ceil(amount) === 1 ? '' : 's');
}
function floorMath(q) {
  const need = q.area * (1 + q.waste);
  const out = { need };
  if (q.tile) {
    const tileArea = q.metric ? q.tile.sqft * 0.09290304 : q.tile.sqft;
    out.tiles = Math.ceil(need / tileArea - 1e-9); out.tileArea = tileArea;
  }
  if (q.box) out.boxes = Math.ceil(need / q.box - 1e-9);
  else if (q.mat !== 'carpet' && q.mat !== 'tile') { out.boxGuess = Math.ceil(need / (q.metric ? 2 : 20) - 1e-9); }
  if (q.mat === 'carpet' && q.d && !q.metric) {
    // broadloom comes 12 ft wide: run the roll along the side that needs the fewest strips
    const opt = (w, l) => { const strips = Math.ceil(w / 12 - 1e-9); return { strips, lenFt: strips * l, area: strips * 12 * l }; };
    const x = opt(q.d.a, q.d.b), y = opt(q.d.b, q.d.a), best = x.area <= y.area ? x : y;
    out.roll = best; out.sqyd = best.area / 9; out.need = best.area;
  } else if (q.mat === 'carpet') out.sqyd = (q.metric ? need / 0.83612736 : need / 9);
  if (q.d) out.base = Math.max(0, 2 * (q.d.a + q.d.b) - (q.metric ? 0.9 : 3));
  return out;
}
const money = (cur, v) => cur + fmt(v, 2).replace(/\.(\d)$/, '.$10');

function paintHtml(q, esc) {
  const r = paintMath(q), M = q.metric, U = M ? 'm\u00b2' : 'sq ft', V = M ? 'L' : 'gallons';
  const total = r.wallG + r.ceilG;
  const room = q.d ? fmt(q.d.a, 2) + ' \u00d7 ' + fmt(q.d.b, 2) + (M ? ' m' : ' ft') + ' room' : fmt(q.ar.area) + ' ' + U;
  const sub = room + (q.d && !q.ceilingOnly ? ' \u00b7 ' + fmt(q.h, 2) + (M ? ' m' : ' ft') + ' walls' : '') + ' \u00b7 ' + q.coats + ' coat' + (q.coats > 1 ? 's' : '')
    + (q.d && !q.ceilingOnly ? ' \u00b7 ' + q.doors + ' door' + (q.doors === 1 ? '' : 's') + ', ' + q.windows + ' window' + (q.windows === 1 ? '' : 's') : '');
  const li = [];
  if (r.walls > 0) li.push('<li><b>Walls</b> ' + esc(fmt(r.walls, 0) + ' ' + U + ' \u2192 ' + fmt(r2(r.wallG), 2) + ' ' + V + ' \u00b7 buy ' + buyOf(r.wallG, M)) + '</li>');
  if (r.ceil > 0) li.push('<li><b>Ceiling</b> ' + esc(fmt(r.ceil, 0) + ' ' + U + ' \u2192 ' + fmt(r2(r.ceilG), 2) + ' ' + V + ' \u00b7 buy ' + buyOf(r.ceilG, M) + ' of ceiling paint (flat white, usually a different can)') + '</li>');
  if (q.primer) li.push('<li><b>Primer</b> ' + esc('one coat \u2192 ' + fmt(r2(r.primerG), 2) + ' ' + V + ' \u00b7 buy ' + buyOf(r.primerG, M) + ' (new drywall drinks the first coat: about ' + (M ? '8 m\u00b2/L' : '300 sq ft a gallon') + ')') + '</li>');
  if (q.trim && q.d) { const lin = 2 * (q.d.a + q.d.b) - (M ? 0.9 : 3) * q.doors; li.push('<li><b>Trim</b> ' + esc(fmt(lin, 0) + (M ? ' m' : ' ft') + ' of baseboard plus door casings \u2192 a quart of semi-gloss covers most rooms') + '</li>'); }
  if (q.price) { const per = /qu/.test(q.price.unit) ? 0.25 : /^l|lit/.test(q.price.unit) ? (M ? 1 : 1 / 3.785) : 1; const units = Math.ceil((total + r.primerG) / per - 1e-9); li.push('<li><b>Cost</b> ' + esc('about ' + money(q.price.cur, units * q.price.v) + ' (' + units + ' \u00d7 ' + money(q.price.cur, q.price.v) + (per === 1 ? (M ? ' a litre' : ' a gallon') : per === 0.25 ? ' a quart' : ' a litre') + ')') + '</li>'); }
  if (q.d && !q.ceilingOnly) li.push('<li><b>Paintable wall</b> ' + esc(fmt(r.gross, 0) + ' ' + U + ' of wall (perimeter ' + fmt(2 * (q.d.a + q.d.b), 2) + (M ? ' m' : ' ft') + ' \u00d7 ' + fmt(q.h, 2) + (M ? ' m' : ' ft') + ') less ' + fmt(q.doors * r.doorA + q.windows * r.winA, 1) + ' ' + U + ' for openings') + '</li>');
  const assumed = [];
  if (q.d && !q.ceilingOnly && !q.said.doors) assumed.push('1 door'); if (q.d && !q.ceilingOnly && !q.said.windows) assumed.push('2 windows');
  const how = 'Coverage: ' + (M ? '10 m\u00b2 per litre a coat (the careful end of the 10\u201314 most tins print)' : '350 sq ft per gallon a coat (the careful end of the 350\u2013400 printed on the can)') + ' \u00b7 ' + (M ? '1.9 m\u00b2 a door, 1.4 m\u00b2 a window' : '20 sq ft a door (36 \u00d7 80 in), 15 sq ft a window (3 \u00d7 5 ft)')
    + '. Textured, patched or unprimed walls take more (plan ' + (M ? '7\u20138 m\u00b2/L' : '250\u2013300 sq ft a gallon') + '); a big colour change, light over dark, can need a third coat. Buy it all at once: cans mixed on different days can differ.';
  return '<h2>' + (q.ceilingOnly ? 'Ceiling paint' : 'Paint for the room') + '</h2><div class="sub">' + esc(sub) + '</div>'
    + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(fmt(r2(total), 2) + ' ' + V) + '</div>'
    + '<div class="sub">buy ' + esc(buyOf(r.wallG, M) + (r.ceilG > 0 && r.wallG > 0 ? ' for the walls + ' + buyOf(r.ceilG, M) + ' for the ceiling' : r.ceilG > 0 ? buyOf(r.ceilG, M) : '')) + '</div>'
    + '<ul>' + li.join('') + '</ul>'
    + (assumed.length ? '<p style="color:#8a8a8a">Counted ' + esc(assumed.join(' and ')) + '. Say "with 2 doors and no windows" to change it' + (q.d ? (M ? ', or "2.7 m ceilings" for taller walls' : ', or "9 foot ceilings" for taller walls') : '') + '.</p>' : '')
    + '<p style="color:#8a8a8a">' + esc(how) + '</p>'
    + '<div class="src">Method: walls = perimeter \u00d7 height \u2212 openings; paint = area \u00d7 coats \u00f7 coverage (Sherwin-Williams, Benjamin Moore and Behr spread rates) \u00b7 ask "paint calculator" to change any number</div>';
}
function floorHtml(q, esc) {
  const r = floorMath(q), M = q.metric, U = M ? 'm\u00b2' : 'sq ft';
  const name = q.mat === 'flooring' ? 'Flooring' : q.mat === 'tile' ? 'Tile' : q.mat.charAt(0).toUpperCase() + q.mat.slice(1);
  const room = q.d ? fmt(q.d.a, 2) + ' \u00d7 ' + fmt(q.d.b, 2) + (M ? ' m' : ' ft') + ' room \u00b7 ' + fmt(q.area, 1) + ' ' + U : fmt(q.area, 1) + ' ' + U;
  const sub = room + (q.mat === 'carpet' && q.d && !M ? ' \u00b7 off a 12-ft roll' : ' \u00b7 ' + (q.mat === 'carpet' ? '' : q.pattern + ' lay \u00b7 ') + Math.round(q.waste * 100) + '% for cuts and waste');
  let big, line = '';
  if (q.tile) { big = fmt(r.tiles, 0) + ' tiles'; line = q.tile.label + ' tiles cover ' + fmt(r.tileArea, 2) + ' ' + U + ' each'; }
  else if (q.mat === 'carpet') big = fmt(Math.ceil(r.sqyd - 1e-9), 0) + ' sq yd';
  else if (r.boxes != null) big = r.boxes + ' box' + (r.boxes === 1 ? '' : 'es');
  else big = fmt(Math.ceil(r.need - 1e-9), 0) + ' ' + U;
  const li = [];
  li.push('<li><b>Order</b> ' + esc(r.roll ? fmt(r.need, 0) + ' sq ft of carpet (' + fmt(r.need / 9, 1) + ' sq yd): the roll width sets the waste' : fmt(r.need, 1) + ' ' + U + ' (' + fmt(q.area, 1) + ' + ' + Math.round(q.waste * 100) + '%)') + '</li>');
  if (q.tile) li.push('<li><b>Tiles</b> ' + esc(line + ' \u2192 ' + fmt(r.tiles, 0) + ' tiles; keep a few spare for repairs') + '</li>');
  if (r.boxes != null) li.push('<li><b>Boxes</b> ' + esc(fmt(r.need, 1) + ' \u00f7 ' + q.box + ' ' + U + ' a box = ' + r.boxes + ', rounded up') + '</li>');
  if (r.boxGuess != null) li.push('<li><b>Boxes</b> ' + esc('about ' + r.boxGuess + ' at ' + (M ? '2 m\u00b2' : '20 sq ft') + ' a box (typical for ' + (q.mat === 'flooring' ? 'laminate and vinyl plank' : q.mat) + '; the carton says the real number: add "boxes cover 24 sq ft")') + '</li>');
  if (r.roll) li.push('<li><b>Off a 12-ft roll</b> ' + esc(r.roll.strips + ' strip' + (r.roll.strips > 1 ? 's' : '') + ', ' + fmt(r.roll.lenFt, 1) + ' ft of roll = ' + fmt(r.roll.area, 0) + ' sq ft (' + fmt(r.roll.area / 9, 1) + ' sq yd)' + (r.roll.strips > 1 ? ' with ' + (r.roll.strips - 1) + ' seam' + (r.roll.strips > 2 ? 's' : '') : ', no seams') + '; add a few inches each way for trimming') + '</li>');
  if (q.mat === 'carpet') li.push('<li><b>Pad</b> ' + esc('the same area of carpet pad, ' + fmt(Math.ceil(q.area / (M ? 0.83612736 : 9) - 1e-9), 0) + ' sq yd') + '</li>');
  if (/laminate|vinyl|flooring|hardwood/.test(q.mat) && q.mat !== 'tile') li.push('<li><b>Underlayment</b> ' + esc(fmt(Math.ceil(q.area), 0) + ' ' + U + ' (no waste needed; skip it if the planks have a pad attached)') + '</li>');
  if (q.mat === 'tile') { const tA = q.metric ? q.area : q.area; li.push('<li><b>Thinset and grout</b> ' + esc('about ' + Math.ceil(tA / (M ? 3.7 : 40) - 1e-9) + ' bag' + (Math.ceil(tA / (M ? 3.7 : 40) - 1e-9) === 1 ? '' : 's') + ' of 50-lb thinset (one covers about ' + (M ? '3.7\u20134.6 m\u00b2' : '40\u201350 sq ft') + ' with a 1/4 \u00d7 3/8 in notch trowel); grout depends on joint width') + '</li>'); }
  if (r.base != null) li.push('<li><b>Baseboard</b> ' + esc('about ' + fmt(Math.ceil(r.base), 0) + (M ? ' m' : ' ft') + ' (the perimeter less one ' + (M ? '0.9 m' : '3-ft') + ' doorway); buy 10% extra for the corner cuts') + '</li>');
  if (q.price) { const p = q.price; const per = /yd/.test(p.unit) ? (r.sqyd != null ? Math.ceil(r.sqyd) : r.need / 9) : /box|carton/.test(p.unit) ? (r.boxes || r.boxGuess || 0) : /tile/.test(p.unit) ? (r.tiles || 0) : (r.roll ? r.roll.area : r.need);
    li.push('<li><b>Cost</b> ' + esc('about ' + money(p.cur, per * p.v) + ' for the ' + (q.mat === 'flooring' ? 'flooring' : q.mat) + ' at ' + money(p.cur, p.v) + (p.unit ? ' a ' + p.unit : (M ? ' a m\u00b2' : ' a sq ft'))) + '</li>'); }
  const how = q.mat === 'tile' ? 'Waste: 10% for a straight grid, 15% diagonal, 20% herringbone; big tiles and cut-up rooms need a little more. Buy every box from one lot (same shade and size code) so the colour matches, and keep the spares for repairs.' : q.mat === 'carpet' ? 'Carpet comes on 12-ft-wide rolls (some 15 ft), so you pay for the strip width, not just the floor; stairs and odd shapes need more.' : 'Waste: 10% for a straight lay, 15% diagonal, 20% herringbone or chevron; add a few points for rooms with many doorways or for a first install. Let planks sit flat in the room 48 hours before laying them.';
  return '<h2>' + esc(name) + ' for the room</h2><div class="sub">' + esc(sub) + '</div>'
    + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(big) + '</div>'
    + '<ul>' + li.join('') + '</ul><p style="color:#8a8a8a">' + esc(how) + '</p>'
    + '<div class="src">Method: area \u00d7 (1 + waste), rounded up to whole boxes or tiles (NWFA and TCNA waste ranges, as Home Depot and Lowe\u2019s calculators use) \u00b7 ask "flooring calculator" to change any number</div>';
}

function runForm(kind, api) {
  const { showPage, esc } = api;
  const inp = (id, label, v, step) => '<label style="display:inline-flex;flex-direction:column;font-size:12px;color:#8a8a8a;gap:2px">' + label + '<input id="' + id + '" type="number" min="0" step="' + (step || 'any') + '" value="' + v + '" style="width:76px"></label>';
  const paint = kind === 'paintcalc';
  const el = showPage((p) => { p.innerHTML = '<h2>' + (paint ? 'Paint calculator' : 'Flooring calculator') + '</h2>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin:10px 0">'
    + inp('hm-a', 'length (ft)', 12) + inp('hm-b', 'width (ft)', 14)
    + (paint ? inp('hm-h', 'wall height (ft)', 8) + inp('hm-d', 'doors', 1, 1) + inp('hm-w', 'windows', 2, 1) + inp('hm-c', 'coats', 2, 1)
      + '<label style="font-size:12px;color:#8a8a8a"><input id="hm-ceil" type="checkbox"> ceiling too</label>'
      : inp('hm-x', 'waste %', 10) + inp('hm-box', 'sq ft a box', 20))
    + '</div><div id="hm-out" aria-live="polite"></div>'; });
  const q = (id) => el.querySelector('#' + id), out = q('hm-out'), v = (id) => parseFloat(q(id).value);
  const upd = () => {
    const a = v('hm-a'), b = v('hm-b');
    if (!(a > 0 && b > 0)) { out.textContent = 'enter the room size'; return; }
    if (paint) {
      const pq = { d: { a, b, metric: false }, metric: false, h: v('hm-h') > 0 ? v('hm-h') : 8, doors: Math.max(0, v('hm-d') || 0), windows: Math.max(0, v('hm-w') || 0), said: { doors: true, windows: true }, coats: Math.max(1, Math.round(v('hm-c') || 1)), ceiling: q('hm-ceil').checked, ceilingOnly: false, raw: '' };
      const r = paintMath(pq);
      out.innerHTML = '<div style="font-size:40px;font-weight:300">' + esc(fmt(r2(r.wallG + r.ceilG), 2) + ' gallons') + '</div><div class="sub">' + esc('walls ' + fmt(r.walls, 0) + ' sq ft \u2192 buy ' + buyOf(r.wallG, false) + (r.ceilG ? ' \u00b7 ceiling ' + fmt(r.ceil, 0) + ' sq ft \u2192 buy ' + buyOf(r.ceilG, false) : '')) + '</div>';
    } else {
      const fq = { d: { a, b }, area: a * b, metric: false, mat: 'flooring', waste: Math.max(0, (v('hm-x') || 0) / 100), box: v('hm-box') > 0 ? v('hm-box') : null };
      const r = floorMath(fq);
      out.innerHTML = '<div style="font-size:40px;font-weight:300">' + esc(r.boxes != null ? r.boxes + ' boxes' : fmt(Math.ceil(r.need), 0) + ' sq ft') + '</div><div class="sub">' + esc(fmt(fq.area, 1) + ' sq ft + waste = ' + fmt(r.need, 1) + ' sq ft to order \u00b7 baseboard about ' + fmt(Math.ceil(r.base), 0) + ' ft') + '</div>';
    }
  };
  el.querySelectorAll('input').forEach((i) => i.addEventListener('input', upd)); upd();
  return 'home';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = homeOf(text);
  if (!q) return 'none';
  if (q.kind === 'paintcalc' || q.kind === 'floorcalc') return runForm(q.kind, api);
  showPage((el) => { el.innerHTML = q.kind === 'paint' ? paintHtml(q, esc) : floorHtml(q, esc); });
  return 'home';
}

export { homeOf, paintMath, floorMath, buyOf };
export default {
  name: 'home',
  examples: [
    'how much paint do i need for a 12x14 room',
    'paint for a 10x12 bedroom with 9 foot ceilings',
    'how many gallons of paint for a 12 by 14 room with 2 doors and 3 windows',
    'paint a 12x14 room and the ceiling',
    'how much paint for a 4 by 5 metre room',
    'paint calculator',
    'how much flooring do i need for a 12x14 room',
    'how many boxes of laminate for a 15x20 room boxes cover 22 sq ft',
    'how many 12x24 tiles for a 10x12 floor',
    'how much carpet for a 12x14 room',
    'flooring calculator'
  ],
  nearMisses: [
    'paint the clock blue',
    'who painted the mona lisa',
    'how many gallons of paint for 400 square feet',
    'how many tiles 12 inch for 180 square feet',
    'how many square feet is a 12x15 room',
    'how much concrete for a 10x10 slab 4 inches thick',
    'what is the ocean floor',
    'best paint colors for a bedroom'
  ],
  match(lower, text) { return !!homeOf(text); },
  run
};
