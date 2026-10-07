/**
 * walls skill - wallpaper rolls and drywall sheets for a room or one wall (no key; pure math), next to home.js's paint and flooring
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Wallpaper: "how many rolls of wallpaper for a 12x14 room", "...with 9 foot ceilings", "...with a 21 inch repeat", "half drop",
 *   "wallpaper for an accent wall 12 feet wide", "how much wallpaper for a 4 by 3 metre room", "wallpaper calculator".
 *   The drop (strip) method decorators and the best calculators use: drops per wall = wall width / roll width, rounded up;
 *   each drop = wall height + trim (4 in / 10 cm), rounded up to whole pattern repeats (+ half a repeat for a half-drop match);
 *   drops per roll = roll length / drop, rounded down; rolls = drops / drops per roll, rounded up. Doors and windows are not
 *   taken off (full drops go over them and the offcuts fill above the door and under the window). Default roll 20.5 in x 33 ft
 *   (0.53 x 10.05 m: the standard UK and Euro roll, which US sellers call a double roll); "27 inch rolls" are 27 in x 27 ft.
 * Drywall: "how many sheets of drywall for a 12x14 room", "...and the ceiling", "how many 4x12 sheets of drywall for a 12x14 room",
 *   "how much drywall for a wall 12 feet wide", "plasterboard for a 4 by 5 metre room", "drywall calculator".
 *   Area = perimeter x height (+ the ceiling), openings left in (they are cut out of whole sheets), + 10% for cuts, / sheet area
 *   (4x8 = 32 sq ft by default; 1.2 x 2.4 m metric). Screws, tape, joint compound and primer from USG's Sheetrock installation
 *   guide (J371): per 1,000 sq ft, 2.7 lb of Type W screws, 370 ft of tape, 10 gal of all-purpose compound; First Coat at 400 sq ft a gallon.
 * Follow-ups redo the last room (this page, 30 minutes), and reach across to home.js: after a paint or floor card,
 *   "wallpaper for it" or "how many sheets of drywall" use that room; after a wallpaper or drywall card, "paint for it" or
 *   "what about carpet" hand the same room to home. "with a 21 inch repeat", "half drop", "27 inch rolls", "4x12 sheets",
 *   "the ceiling too", "just the ceiling", "9 foot ceilings", "at $45 a roll", "at $15 a sheet", "drywall for it" change the last card.
 */
import home, { clean, dimsOf, roomOf, lastRoomOf } from './home.js';

const NUM = '(\\d+(?:\\.\\d+)?)';
const LU = "('|ft\\.?|feet|foot|m|meters?|metres?)";
const fmt = (x, d) => Number(x).toLocaleString('en-US', { maximumFractionDigits: d == null ? 1 : d });
const money = (cur, v) => cur + fmt(v, 2).replace(/\.(\d)$/, '.$10');
const isM = (u) => /^m/.test(u || '');

const WP_RE = /\b(wall\s*paper(?:ing)?|wall\s*coverings?)\b/;
const DW_RE = /\b(drywall|dry\s+wall|sheetrock|plasterboard|gypsum\s+(?:board|panels?)|wallboard|gyprock)\b/;
const NOT_RE = /\b(app|apps|phone|iphone|ipad|android|desktop|laptop|screen|monitor|computer|pc|mac|macbook|4k|hd|8k|live|wallpapers|anime|aesthetic|download|image|picture|photo|background|lock\s*screen|remove|removing|removal|steam|stripper|strip\s+wallpaper|repair|patch|patching|hole|holes|anchor|anchors|crack|cracks|mold|mould|asbestos|what\s+is|what\s+are|made\s+of|history|recipe|weight\s+of|how\s+heavy|thickness|thick\s+is|vs|versus|paint|painting|primer|tv)\b/;
const ASK_RE = /\b(how\s+much|how\s+many|rolls?|sheets?|panels?|boards?|need|needed|enough|estimate|calculat\w*|for\s+(?:a|an|my|the|our)|to\s+(?:cover|do|hang|paper)|hang(?:ing)?\s+(?:in\s+)?(?:a|an|my|the|our)|paper\s+(?:a|an|my|the|our))\b/;

// a sheet size ("4x12 sheets", "12 foot sheets", "1.2 x 2.4 m boards") comes out first so it is not read as the room
const SHEET_RE = /\b(4|1\.2)\s*(?:'|ft|feet|foot|m)?\s*(?:x|by)\s*(8|9|10|12|14|16|2\.4|2\.7|3(?:\.0)?)\s*(?:'|ft|feet|foot|m)?\s*(?:sheets?|panels?|boards?|drywall|sheetrock|plasterboard)\b|\b(8|9|10|12|14|16)\s*(?:'|-?\s*(?:ft|feet|foot))\s+(?:long\s+)?(?:sheets?|panels?|boards?)\b/;
// a roll size: "27 inch rolls", "20.5 inch by 33 ft rolls", "53 cm rolls", "rolls are 27 inches wide"
const ROLL_RE = /\b(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?|cm)\s*(?:wide\s+)?(?:(?:x|by)\s*(\d+(?:\.\d+)?)\s*('|ft|feet|foot|m|meters?|metres?)\s*(?:long\s+)?)?(?:(?:wall\s*paper\s+)?rolls?|wall\s*paper)\b|\brolls?\s+(?:are|is)\s+(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?|cm)\s*(?:wide)?(?:\s*(?:and|by|x)\s*(\d+(?:\.\d+)?)\s*('|ft|feet|foot|m|meters?|metres?)\s*(?:long)?)?/;
const REPEAT_RE = /\b(\d+(?:\.\d+)?)\s*(?:-\s*)?("|in(?:ch(?:es)?)?|cm)\s*(?:-\s*)?(?:pattern\s+)?(?:repeat|match)\b|\brepeat\s+(?:of\s+|is\s+)?(\d+(?:\.\d+)?)\s*("|in(?:ch(?:es)?)?|cm)/;
const HALF_RE = /\bhalf[\s-]?drop\b|\boffset\s+match\b|\bdrop\s+match\b/;

function unitTo(v, u, metric) { // a length in its unit, into the job's unit (ft or m)
  u = (u || '').replace(/\.$/, '');
  if (/^(?:"|in)/.test(u)) return metric ? v * 0.0254 : v / 12;
  if (u === 'cm') return metric ? v / 100 : v / 30.48;
  if (isM(u)) return metric ? v : v / 0.3048;
  if (/^(?:'|f)/.test(u)) return metric ? v * 0.3048 : v;
  return v;
}
function heightIn(t, metric) { // "9 foot ceilings", "ceilings are 2.7 m", "walls 9 ft high" (a single wall's height is read in wallOf)
  const m = t.match(new RegExp(NUM + '\\s*(?:-\\s*)?' + LU + '?\\s*(?:-\\s*)?(?:high\\s+|tall\\s+)?ceilings?\\b'))
    || t.match(new RegExp('ceilings?\\s+(?:are\\s+|is\\s+|of\\s+|at\\s+)' + NUM + '\\s*' + LU + '?'))
    || t.match(new RegExp('walls?\\s+(?:are\\s+)?' + NUM + '\\s*' + LU + '?\\s*(?:high|tall)\\b'));
  if (!m) return metric ? 2.4 : 8;
  const h = m[2] ? unitTo(+m[1], m[2], metric) : +m[1];
  return metric ? (h >= 1.8 && h <= 8 ? h : null) : (h >= 6 && h <= 30 ? h : null);
}
function wallOf(t) { // one wall: "a wall 12 feet wide (and 9 feet high)", "a 12 foot accent wall", "a 12x8 wall"
  let m = t.match(new RegExp('\\b(?:accent\\s+|feature\\s+)?wall\\s+(?:that\\s+is\\s+|is\\s+|of\\s+)?' + NUM + '\\s*' + LU + '?\\s*(?:wide|long|across)\\b(?:\\s*(?:and|by|x|,)?\\s*' + NUM + '\\s*' + LU + '?\\s*(?:high|tall))?'))
    || t.match(new RegExp(NUM + '\\s*' + LU + '?\\s*(?:wide|long)\\s+(?:and\\s+' + NUM + '\\s*' + LU + '?\\s*(?:high|tall)\\s+)?(?:accent\\s+|feature\\s+)?wall\\b(?!s)'));
  if (!m) { m = t.match(new RegExp(NUM + '\\s*(?:-\\s*)?' + LU + '\\s+(?:wide\\s+)?(?:accent\\s+|feature\\s+)?wall\\b(?!s)')); if (m) m = [m[0], m[1], m[2]]; }
  if (m) {
    const metric = isM(m[2]) || isM(m[4]);
    const w = m[2] ? unitTo(+m[1], m[2], metric) : +m[1];
    let h = m[3] ? (m[4] ? unitTo(+m[3], m[4], metric) : +m[3]) : null;
    if (h == null) { const hm = t.match(new RegExp(NUM + '\\s*' + LU + '?\\s*(?:high|tall)\\b')); if (hm && hm.index !== m.index) h = hm[2] ? unitTo(+hm[1], hm[2], metric) : +hm[1]; }
    if (h == null) h = heightIn(t, metric);
    return { w, h, metric };
  }
  const d = dimsOf(t);
  if (d && /^\s*(?:'|ft|feet|foot|m)?\s*(?:accent\s+|feature\s+)?wall\b(?!s)/.test(t.slice(d.at + d.len))) return { w: d.a, h: d.b, metric: d.metric };
  return null;
}

function wallsOf(text) {
  const t = clean(text);
  if (!t || t.length > 220) return null;
  if (/^(?:a\s+|open\s+(?:a\s+|the\s+)?|show\s+(?:me\s+)?(?:a\s+|the\s+)?)?wall\s*paper\s+(?:roll\s+)?(?:calculator|estimator)$|^how\s+much\s+wall\s*paper\s+do\s+i\s+need$/.test(t)) return { kind: 'wpcalc' };
  if (/^(?:a\s+|open\s+(?:a\s+|the\s+)?|show\s+(?:me\s+)?(?:a\s+|the\s+)?)?(?:drywall|sheetrock|plasterboard)\s+(?:sheet\s+)?(?:calculator|estimator)$|^how\s+much\s+(?:drywall|sheetrock|plasterboard)\s+do\s+i\s+need$/.test(t)) return { kind: 'dwcalc' };
  const wp = WP_RE.test(t), dw = DW_RE.test(t);
  if (wp === dw || NOT_RE.test(t)) return null; // both or neither: not one clear job
  if (!ASK_RE.test(t) && !/\b(?:room|bedroom|kitchen|bathroom|hallway|office|walls?|basement|garage)\b/.test(t)) return null;
  let rest = t, sheet = null, roll = null, rep = 0;
  let m;
  if (dw && (m = t.match(SHEET_RE))) {
    sheet = m[3] ? { w: 4, l: +m[3], metric: false } : /^1\.2/.test(m[1]) ? { w: 1.2, l: +m[2], metric: true } : { w: 4, l: +m[2], metric: false };
    rest = t.replace(m[0], ' sheets ');
  }
  if (wp && (m = t.match(ROLL_RE))) {
    const wv = m[1] || m[4], lv = m[2] || m[5], lu = m[3] || m[6], cm = /cm/.test(m[0].slice(0, m[0].indexOf(wv) + wv.length + 6));
    roll = { wIn: cm ? +wv / 2.54 : +wv, lFt: lv ? (isM(lu) ? +lv / 0.3048 : +lv) : null };
    if (!(roll.wIn >= 12 && roll.wIn <= 60)) return null;
    rest = rest.replace(m[0], ' rolls ');
  }
  let half = false, repU = '';
  if (wp && (m = rest.match(REPEAT_RE))) { rep = +(m[1] || m[3]); repU = m[2] || m[4]; rest = rest.replace(m[0], ' '); }
  if (wp && HALF_RE.test(t)) half = true;
  const wall = wallOf(rest);
  const d = wall ? null : dimsOf(rest);
  if (!wall && !d) return null;
  const metric = wall ? wall.metric : d.metric;
  const h = wall ? wall.h : heightIn(rest, metric);
  if (h == null || !(h > 0) || (metric ? h > 8 : h > 30)) return null;
  if (wall && !(wall.w > 0 && wall.w <= (metric ? 30 : 100))) return null;
  const pr = t.match(/(?:[$\u00a3\u20ac]\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:dollars|bucks))\s*(?:\/|a|an|per|each)\s*(rolls?|sheets?|panels?|boards?)\b/);
  const price = pr ? { v: +(pr[1] || pr[2]), cur: /\u00a3/.test(t) ? '\u00a3' : /\u20ac/.test(t) ? '\u20ac' : '$' } : null;
  if (wp) {
    if (rep && !(rep > 0 && rep <= (/cm/.test(repU) ? 160 : 64))) return null;
    const rollW = roll ? unitTo(roll.wIn, 'in', metric) : metric ? 0.53 : 20.5 / 12;
    const rollL = roll && roll.lFt ? unitTo(roll.lFt, 'ft', metric) : roll && roll.wIn >= 26 && roll.wIn <= 28 ? unitTo(27, 'ft', metric) : metric ? 10.05 : 33;
    return { kind: 'wp', d, wall, metric, h, rollW, rollL, rollSaid: !!roll, rep: rep ? unitTo(rep, repU, metric) : 0, repLabel: rep ? fmt(rep, 2) + (/cm/.test(repU) ? ' cm' : ' in') : '', half: half && !!rep, price };
  }
  const ceiling = /\bceilings?\b/.test(rest.replace(new RegExp(NUM + '\\s*(?:-\\s*)?' + LU + '?\\s*(?:-\\s*)?(?:high\\s+|tall\\s+)?ceilings?', 'g'), '').replace(/ceilings?\s+(?:are|is|of|at)\s+\d[^ ]*/g, '')) && !wall;
  const ceilingOnly = ceiling && /\b(?:just|only)\s+the\s+ceiling\b|\b(?:the\s+|a\s+)?ceiling\s+(?:of|in|for)\b/.test(t) && !/\bwalls?\b/.test(t) && !/\b(?:and|plus|including|with|also)\s+(?:the\s+)?ceiling/.test(t);
  const wm = t.match(/(\d+(?:\.\d+)?)\s*%\s*(?:waste|extra|overage)|(?:waste|extra|overage)\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*%/);
  const waste = wm ? +(wm[1] || wm[2]) / 100 : /\bno\s+waste\b/.test(t) ? 0 : 0.1;
  if (!(waste >= 0 && waste <= 0.5)) return null;
  const sh = sheet ? (sheet.metric === metric ? sheet : metric ? { w: 1.2, l: sheet.l * 0.3048 > 2.6 ? (sheet.l >= 12 ? 3.6 : 3) : 2.4, metric } : { w: 4, l: sheet.l <= 2.4 ? 8 : sheet.l <= 2.7 ? 9 : 10, metric }) : metric ? { w: 1.2, l: 2.4, metric } : { w: 4, l: 8, metric };
  return { kind: 'dw', d, wall, metric, h, sheet: sh, sheetSaid: !!sheet, ceiling, ceilingOnly, waste, price };
}

function wpMath(q) {
  const trim = q.metric ? 0.1 : 4 / 12;
  let drop = q.h + trim;
  if (q.rep) drop = Math.ceil(drop / q.rep - 1e-9) * q.rep;
  if (q.half) drop += q.rep / 2;
  const perRoll = Math.floor(q.rollL / drop + 1e-9);
  const widths = q.d ? [q.d.a, q.d.b, q.d.a, q.d.b] : [q.wall.w];
  const each = widths.map((w) => Math.ceil(w / q.rollW - 1e-9));
  const drops = each.reduce((a, b) => a + b, 0);
  const rolls = perRoll > 0 ? Math.ceil(drops / perRoll - 1e-9) : null;
  const area = widths.reduce((a, b) => a + b, 0) * q.h;
  const byArea = Math.ceil(area / (q.rollW * q.rollL) - 1e-9);
  return { trim, drop, perRoll, each, drops, rolls, area, byArea, left: perRoll > 0 ? q.rollL - perRoll * drop : 0 };
}
function dwMath(q) {
  const walls = q.ceilingOnly ? 0 : q.d ? 2 * (q.d.a + q.d.b) * q.h : q.wall.w * q.h;
  const ceil = q.ceiling && q.d ? q.d.a * q.d.b : 0;
  const total = walls + ceil, sheetA = q.sheet.w * q.sheet.l;
  const sheets = Math.ceil(total * (1 + q.waste) / sheetA - 1e-9);
  const sqft = q.metric ? total / 0.09290304 : total;
  return { walls, ceil, total, sheetA, sheets, screwsLb: sqft * 2.7 / 1000, tapeFt: sqft * 0.37, mudGal: sqft / 100, primerGal: sqft / 400, sqft };
}
const unitL = (M) => (M ? ' m' : ' ft');
function roomLabel(q) {
  const M = q.metric;
  return q.d ? fmt(q.d.a, 2) + ' \u00d7 ' + fmt(q.d.b, 2) + unitL(M) + ' room \u00b7 ' + fmt(q.h, 2) + unitL(M) + ' walls' : 'one wall ' + fmt(q.wall.w, 2) + unitL(M) + ' wide \u00d7 ' + fmt(q.h, 2) + unitL(M) + ' high';
}
function wpHtml(q, esc) {
  const r = wpMath(q), M = q.metric, U = M ? 'm\u00b2' : 'sq ft';
  const rollLabel = M ? fmt(q.rollW * 100, 1) + ' cm \u00d7 ' + fmt(q.rollL, 2) + ' m' : fmt(q.rollW * 12, 1) + ' in \u00d7 ' + fmt(q.rollL, 1) + ' ft';
  const dropLabel = M ? fmt(r.drop, 2) + ' m' : Math.floor(r.drop + 1e-9) + ' ft ' + fmt(Math.round((r.drop - Math.floor(r.drop + 1e-9)) * 12 * 10) / 10, 1) + ' in';
  if (!r.rolls) return '<h2>Wallpaper</h2><p>' + esc('Each drop (' + dropLabel + ') is longer than a ' + rollLabel + ' roll, so it cannot be cut from one roll. Ask for a longer roll, like "rolls are 27 inches by 27 ft".') + '</p>';
  const sub = roomLabel(q) + ' \u00b7 ' + rollLabel + ' rolls' + (q.rep ? ' \u00b7 ' + q.repLabel + ' ' + (q.half ? 'half-drop' : 'straight') + ' repeat' : ' \u00b7 free match');
  const li = [];
  li.push('<li><b>Drops</b> ' + esc((q.d ? r.each.join(' + ') + ' around the four walls' : r.each[0] + ' across the wall') + ' = ' + r.drops + ' drops of ' + dropLabel + ' (wall height + ' + (M ? '10 cm' : '4 in') + ' to trim' + (q.rep ? ', rounded up to whole repeats' + (q.half ? ' plus half a repeat for the half drop' : '') : '') + ')') + '</li>');
  li.push('<li><b>Per roll</b> ' + esc(r.perRoll + ' drop' + (r.perRoll === 1 ? '' : 's') + ' from each ' + rollLabel + ' roll, ' + (M ? fmt(r.left, 2) + ' m' : fmt(r.left, 1) + ' ft') + ' left over (those ends cover above the door and under the windows)') + '</li>');
  li.push('<li><b>Buy</b> ' + esc(r.rolls + ' rolls, or ' + (r.rolls + 1) + ' with one spare, all with the same batch (lot) number so the shade matches') + '</li>');
  if (r.byArea < r.rolls) li.push('<li><b>Why not ' + r.byArea + '?</b> ' + esc('wall area \u00f7 roll area (' + fmt(r.area, 0) + ' ' + U + ') says ' + r.byArea + ', but a roll only gives whole drops, so the short ends are not enough to make another one') + '</li>');
  if (q.price) li.push('<li><b>Cost</b> ' + esc('about ' + money(q.price.cur, r.rolls * q.price.v) + ' (' + r.rolls + ' \u00d7 ' + money(q.price.cur, q.price.v) + ' a roll), ' + money(q.price.cur, (r.rolls + 1) * q.price.v) + ' with the spare') + '</li>');
  li.push('<li><b>Paste</b> ' + esc('check the label: non-woven papers go up with paste on the wall, others need the back pasted and left to soak') + '</li>');
  return '<h2>Wallpaper for the ' + (q.d ? 'room' : 'wall') + '</h2><div class="sub">' + esc(sub) + '</div>'
    + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(r.rolls + ' rolls') + '</div>'
    + '<div class="sub">' + esc('buy ' + (r.rolls + 1) + ' with a spare') + '</div><ul>' + li.join('') + '</ul>'
    + '<p style="color:#8a8a8a">' + esc('Doors and windows are not taken off: full drops go over them so the pattern keeps running, and the cut-outs are the waste. The pattern repeat is printed on the roll label; a big one can add several rolls. ' + (q.rollSaid ? '' : 'Rolls are taken as the standard ' + (M ? '0.53 \u00d7 10.05 m roll' : '20.5 in \u00d7 33 ft roll (the UK and Euro size; US sellers call it a double roll)') + '.')) + '</p>'
    + '<div class="src">Method: the drop method (wall width \u00f7 roll width, rounded up; drop = height + trim, rounded up to the repeat; drops per roll rounded down) \u00b7 ask "wallpaper calculator" to change any number, or just say "with a 21 inch repeat", "half drop", "27 inch rolls", "at $45 a roll", "drywall for it" or "paint for it"</div>';
}
function dwHtml(q, esc) {
  const r = dwMath(q), M = q.metric, U = M ? 'm\u00b2' : 'sq ft';
  const sheetLabel = M ? fmt(q.sheet.w, 1) + ' \u00d7 ' + fmt(q.sheet.l, 1) + ' m' : q.sheet.w + ' \u00d7 ' + q.sheet.l + ' ft';
  const sub = roomLabel(q) + (q.ceilingOnly ? ' \u00b7 ceiling only' : q.ceiling ? ' \u00b7 walls and ceiling' : '') + ' \u00b7 ' + sheetLabel + ' sheets \u00b7 ' + Math.round(q.waste * 100) + '% for cuts';
  const li = [];
  if (r.walls > 0) li.push('<li><b>Walls</b> ' + esc(fmt(r.walls, 0) + ' ' + U + (q.d ? ' (perimeter ' + fmt(2 * (q.d.a + q.d.b), 2) + unitL(M) + ' \u00d7 ' + fmt(q.h, 2) + unitL(M) + ')' : '')) + '</li>');
  if (r.ceil > 0) li.push('<li><b>Ceiling</b> ' + esc(fmt(r.ceil, 0) + ' ' + U + ' (hang it first, then the walls)') + '</li>');
  li.push('<li><b>Sheets</b> ' + esc(fmt(r.total, 0) + ' ' + U + ' + ' + Math.round(q.waste * 100) + '% \u00f7 ' + fmt(r.sheetA, 2) + ' ' + U + ' a sheet = ' + r.sheets + ', rounded up') + '</li>');
  li.push('<li><b>Screws</b> ' + esc('about ' + fmt(Math.max(1, Math.ceil(r.screwsLb - 1e-9)), 0) + ' lb of 1-1/4 in drywall screws (USG: 2.7 lb per 1,000 sq ft, 16 in apart on walls, 12 in on ceilings)') + '</li>');
  li.push('<li><b>Tape</b> ' + esc(fmt(Math.ceil(r.tapeFt), 0) + ' ft of paper tape: ' + Math.max(1, Math.ceil(r.tapeFt / 250 - 1e-9)) + ' roll' + (Math.ceil(r.tapeFt / 250 - 1e-9) > 1 ? 's' : '') + ' of 250 ft') + '</li>');
  li.push('<li><b>Joint compound</b> ' + esc('about ' + (M ? fmt(r.mudGal * 3.785, 1) + ' L' : fmt(r.mudGal, 1) + ' gallons') + ' of all-purpose: ' + Math.max(1, Math.ceil(r.mudGal / 4.5 - 1e-9)) + ' \u00d7 4.5-gal carton' + (Math.ceil(r.mudGal / 4.5 - 1e-9) > 1 ? 's' : '') + ' for tape, three coats and the screw heads') + '</li>');
  li.push('<li><b>Primer</b> ' + esc('about ' + (M ? fmt(r.primerGal * 3.785, 1) + ' L' : fmt(r.primerGal, 2) + ' gallons') + ' of drywall primer before paint (400 sq ft a gallon); "paint for it" gives the paint') + '</li>');
  if (q.price) li.push('<li><b>Cost</b> ' + esc('about ' + money(q.price.cur, r.sheets * q.price.v) + ' for the sheets (' + r.sheets + ' \u00d7 ' + money(q.price.cur, q.price.v) + ')') + '</li>');
  const other = q.sheetSaid ? '' : M ? '' : ' Longer sheets mean fewer seams to tape: say "4x12 sheets" (' + Math.ceil(r.total * (1 + q.waste) / 48 - 1e-9) + ' of them).';
  return '<h2>Drywall for the ' + (q.d ? 'room' : 'wall') + '</h2><div class="sub">' + esc(sub) + '</div>'
    + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(r.sheets + ' sheets') + '</div><ul>' + li.join('') + '</ul>'
    + '<p style="color:#8a8a8a">' + esc('Doors and windows are left in: sheets go over them and the openings are cut out, and that scrap is most of the waste. Run sheets across the studs on the walls for fewer joints.' + other + (q.d && !q.ceiling ? ' Say "the ceiling too" to add it.' : '')) + '</p>'
    + '<div class="src">Method: area (+ the ceiling) + waste \u00f7 sheet area, rounded up; screws, tape, compound and primer from the USG Sheetrock installation guide (J371) \u00b7 ask "drywall calculator" to change any number, or just say "4x12 sheets", "the ceiling too", "at $15 a sheet", "wallpaper for it" or "paint for it"</div>';
}

// follow-ups: change the last wallpaper or drywall card, or carry a room across to or from home.js
let last = null;
const FOLLOW_MS = 30 * 60 * 1000;
const LEAD = '^(?:(?:and|but|ok|okay|now|so|then)\\s+)?(?:(?:what|how)\\s+about\\s+(?:with\\s+)?|what\\s+if\\s+(?:it\\s+(?:has|had|is)\\s+|i\\s+(?:use|get|buy)\\s+)?|with\\s+|using\\s+|use\\s+|try\\s+|at\\s+|plus\\s+|add\\s+|include\\s+)?(?:a\\s+|an\\s+)?';
const TAIL = '(?:\\s+(?:too|instead|as\\s+well|then|for\\s+(?:it|that|this|the\\s+same\\s+room|that\\s+room|the\\s+room|the\\s+same\\s+wall|that\\s+wall)))?$';
function geoText(q) { // the room or wall of a card, as words another skill reads
  const M = q.metric, h = Math.abs(q.h - (M ? 2.4 : 8)) > 1e-6 ? ' with ' + fmt(q.h, 2) + (M ? ' m' : ' foot') + ' ceilings' : '';
  if (q.d) return { room: 'a ' + fmt(q.d.a, 3) + 'x' + fmt(q.d.b, 3) + (M ? ' metre' : '') + ' room' + h, walls: null };
  return { room: null, wall: 'a wall ' + fmt(q.wall.w, 3) + (M ? ' m' : ' feet') + ' wide and ' + fmt(q.h, 3) + (M ? ' m' : ' feet') + ' high', area: fmt(q.wall.w * q.h, 1) + (M ? ' m2' : ' sq ft') + ' of walls' };
}
function followOf(text) {
  const t = clean(text);
  if (!t || t.length > 90 || dimsOf(t) && !SHEET_RE.test(t) && !ROLL_RE.test(t)) return null;
  const hl = lastRoomOf(), mine = last && Date.now() - last.at <= FOLLOW_MS ? last : null;
  const fromHome = hl && (!mine || hl.at > mine.at);
  if (!fromHome && !mine) return null;
  let m;
  const WANT_WP = new RegExp(LEAD + '(?:(?:how\\s+(?:much|many\\s+rolls\\s+of)\\s+)?wall\\s*paper(?:\\s+(?:do\\s+i\\s+need|instead))?|wall\\s*paper(?:ing)?\\s+(?:it|the\\s+(?:room|walls?))|how\\s+many\\s+rolls(?:\\s+of\\s+wall\\s*paper)?)' + TAIL);
  const WANT_DW = new RegExp(LEAD + '(?:(?:how\\s+(?:much|many\\s+sheets\\s+of)\\s+)?(?:drywall|sheetrock|plasterboard)(?:\\s+(?:do\\s+i\\s+need|instead))?|how\\s+many\\s+sheets(?:\\s+of\\s+(?:drywall|sheetrock|plasterboard))?|(?:drywall|sheetrock)\\s+(?:it|the\\s+(?:room|walls?)))' + TAIL);
  const want = WANT_WP.test(t) && /\s/.test(t) ? 'wp' : WANT_DW.test(t) && /\s/.test(t) ? 'dw' : null;
  if (fromHome) { // a paint or floor card was the last one: only a switch to wallpaper or drywall is ours
    if (!want) return null;
    const room = roomOf(hl.t);
    if (!room) return null;
    const hm = clean(hl.t).match(new RegExp(NUM + '\\s*(?:-\\s*)?' + LU + '?\\s*(?:-\\s*)?(?:high\\s+|tall\\s+)?ceilings?\\b'));
    const q = wallsOf((want === 'wp' ? 'how many rolls of wallpaper for a ' : 'how many sheets of drywall for a ') + room + (hm ? ' with ' + hm[0] : ''));
    return q ? { q } : null;
  }
  const q0 = mine.q, g = geoText(q0);
  if (want) {
    if (want === q0.kind) return null;
    const q = wallsOf((want === 'wp' ? 'how many rolls of wallpaper for ' : 'how many sheets of drywall for ') + (g.room || g.wall));
    return q ? { q } : null;
  }
  // paint or flooring for the same room goes to home.js
  if (new RegExp(LEAD + '(?:(?:how\\s+much\\s+)?paint(?:ing)?(?:\\s+the\\s+walls)?|paint\\s+it)' + TAIL).test(t) && /\s/.test(t))
    return { home: g.room ? 'how much paint for ' + g.room : 'how much paint for ' + g.area };
  if ((m = t.match(new RegExp(LEAD + '(carpet|tiles?|hardwood|laminate|vinyl(?:\\s+plank)?|lvp|flooring|new\\s+floors?)' + TAIL))) && /\s/.test(t) && g.room)
    return { home: 'how much ' + (/^til/.test(m[1]) ? 'tile' : /^new/.test(m[1]) ? 'flooring' : m[1]) + ' for ' + g.room.replace(/ with .*$/, '') };
  const q = Object.assign({}, q0);
  // the wall height
  if ((m = t.match(new RegExp(LEAD + NUM + '\\s*(?:-\\s*)?' + LU + '?\\s*(?:-\\s*)?(?:high\\s+|tall\\s+)?(?:ceilings?|walls?)' + TAIL)))) {
    const h = m[2] ? unitTo(+m[1], m[2], q.metric) : +m[1];
    if (!(q.metric ? h >= 1.8 && h <= 8 : h >= 6 && h <= 30)) return null;
    q.h = h; return { q };
  }
  if ((m = t.match(/^(?:(?:and|if|what\s+if|but)\s+)?(?:(?:it|they|the\s+(?:paper|wallpaper|sheets?|drywall))\s+(?:is|are|costs?|was|were)\s+|at\s+|for\s+|it'?s\s+)?([$\u00a3\u20ac])\s*(\d+(?:\.\d+)?)\s*(?:\/|a|an|per|each)\s*(rolls?|sheets?|panels?|boards?)$/))) {
    if (/^roll/.test(m[3]) !== (q.kind === 'wp')) return null;
    q.price = { v: +m[2], cur: m[1] }; return { q };
  }
  if (q.kind === 'wp') {
    if ((m = t.match(new RegExp(LEAD + '(\\d+(?:\\.\\d+)?)\\s*(?:-\\s*)?("|in(?:ch(?:es)?)?|cm)\\s*(?:-\\s*)?(?:pattern\\s+)?(?:repeat|match)(?:\\s+(half[\\s-]?drop|straight(?:\\s+match)?))?' + TAIL)))) {
      const cm = /cm/.test(m[2]); if (!(+m[1] > 0 && +m[1] <= (cm ? 160 : 64))) return null;
      q.rep = unitTo(+m[1], m[2], q.metric); q.repLabel = fmt(+m[1], 2) + (cm ? ' cm' : ' in'); if (m[3]) q.half = /half/.test(m[3]); return { q };
    }
    if (new RegExp(LEAD + '(?:half[\\s-]?drop|offset)(?:\\s+(?:match|repeat|pattern))?' + TAIL).test(t)) { if (!q.rep) return null; q.half = true; return { q }; }
    if (new RegExp(LEAD + '(?:straight)(?:\\s+(?:match|repeat))?' + TAIL).test(t) && q.rep) { q.half = false; return { q }; }
    if (new RegExp(LEAD + '(?:no\\s+(?:pattern\\s+)?repeat|free\\s+match|random\\s+match|plain\\s+paper)' + TAIL).test(t)) { q.rep = 0; q.half = false; q.repLabel = ''; return { q }; }
    if ((m = t.match(ROLL_RE)) && new RegExp(LEAD).test(t)) {
      const probe = wallsOf('how many rolls of wallpaper for ' + (g.room || g.wall) + ' with ' + m[0]);
      if (!probe) return null;
      Object.assign(q, { rollW: probe.rollW, rollL: probe.rollL, rollSaid: true }); return { q };
    }
    return null;
  }
  if ((m = t.match(SHEET_RE)) && new RegExp(LEAD + '(?:\\d+(?:\\.\\d+)?\\s*)').test(t) && t.replace(m[0], '').replace(/^(?:(?:and|but|ok|okay|now|so|then)\s+)?(?:(?:what|how)\s+about|with|using|use|try)?\s*/, '').replace(/\s*(?:too|instead|then)$/, '').trim() === '') {
    const probe = wallsOf('how many sheets of drywall for ' + (g.room || g.wall) + ' with ' + m[0]);
    if (!probe) return null;
    q.sheet = probe.sheet; q.sheetSaid = true; return { q };
  }
  if (new RegExp(LEAD + '(?:the\\s+)?ceilings?' + TAIL).test(t) && /\s/.test(t) && q.d) { if (q.ceiling && !q.ceilingOnly) return null; q.ceiling = true; q.ceilingOnly = false; return { q }; }
  if (/^(?:(?:and|now|ok|okay|so)\s+)?(?:just|only)\s+the\s+ceiling$/.test(t) && q.d) { q.ceiling = true; q.ceilingOnly = true; return { q }; }
  if ((m = t.match(new RegExp(LEAD + '(\\d+(?:\\.\\d+)?)\\s*%\\s*(?:waste|extra|overage)' + TAIL)))) { const w = +m[1] / 100; if (!(w >= 0 && w <= 0.5)) return null; q.waste = w; return { q }; }
  return null;
}

function runForm(kind, api) {
  const { showPage, esc } = api;
  const inp = (id, label, v, step) => '<label style="display:inline-flex;flex-direction:column;font-size:12px;color:#8a8a8a;gap:2px">' + label + '<input id="' + id + '" type="number" min="0" step="' + (step || 'any') + '" value="' + v + '" style="width:76px"></label>';
  const wp = kind === 'wpcalc';
  const el = showPage((p) => { p.innerHTML = '<h2>' + (wp ? 'Wallpaper calculator' : 'Drywall calculator') + '</h2>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin:10px 0">'
    + inp('wl-a', 'length (ft)', 12) + inp('wl-b', 'width (ft)', 14) + inp('wl-h', 'wall height (ft)', 8)
    + (wp ? inp('wl-rw', 'roll width (in)', 20.5) + inp('wl-rl', 'roll length (ft)', 33) + inp('wl-rep', 'pattern repeat (in)', 0)
      + '<label style="font-size:12px;color:#8a8a8a"><input id="wl-half" type="checkbox"> half drop</label>'
      : inp('wl-sl', 'sheet length (ft)', 8, 1) + inp('wl-x', 'waste %', 10)
      + '<label style="font-size:12px;color:#8a8a8a"><input id="wl-ceil" type="checkbox"> ceiling too</label>')
    + '</div><div id="wl-out" aria-live="polite"></div>'; });
  const g = (id) => el.querySelector('#' + id), out = g('wl-out'), v = (id) => parseFloat(g(id).value);
  const upd = () => {
    const a = v('wl-a'), b = v('wl-b'), h = v('wl-h');
    if (!(a > 0 && b > 0 && h > 0)) { out.textContent = 'enter the room size and wall height'; return; }
    if (wp) {
      const rep = Math.max(0, v('wl-rep') || 0);
      const q = { d: { a, b }, metric: false, h, rollW: (v('wl-rw') > 0 ? v('wl-rw') : 20.5) / 12, rollL: v('wl-rl') > 0 ? v('wl-rl') : 33, rep: rep / 12, half: g('wl-half').checked && rep > 0 };
      const r = wpMath(q);
      out.innerHTML = r.rolls ? '<div style="font-size:40px;font-weight:300">' + esc(r.rolls + ' rolls') + '</div><div class="sub">' + esc(r.drops + ' drops, ' + r.perRoll + ' a roll \u00b7 buy ' + (r.rolls + 1) + ' with a spare') + '</div>' : esc('a drop is longer than the roll');
    } else {
      const q = { d: { a, b }, metric: false, h, sheet: { w: 4, l: v('wl-sl') > 0 ? v('wl-sl') : 8 }, ceiling: g('wl-ceil').checked, ceilingOnly: false, waste: Math.max(0, (v('wl-x') || 0) / 100) };
      const r = dwMath(q);
      out.innerHTML = '<div style="font-size:40px;font-weight:300">' + esc(r.sheets + ' sheets') + '</div><div class="sub">' + esc(fmt(r.total, 0) + ' sq ft \u00b7 ' + Math.ceil(r.tapeFt) + ' ft of tape \u00b7 ' + fmt(r.mudGal, 1) + ' gal of compound') + '</div>';
    }
  };
  el.querySelectorAll('input').forEach((i) => i.addEventListener('input', upd)); upd();
  return 'walls';
}

async function run(text, api) {
  const { showPage, esc } = api;
  let q = wallsOf(text);
  if (!q) {
    const f = followOf(text);
    if (f && f.home) { last = null; return home.run(f.home, api); }
    if (f) q = f.q;
  }
  if (!q) return 'none';
  if (q.kind === 'wpcalc' || q.kind === 'dwcalc') return runForm(q.kind, api);
  last = { q, at: Date.now() };
  showPage((el) => { el.innerHTML = q.kind === 'wp' ? wpHtml(q, esc) : dwHtml(q, esc); });
  return 'walls';
}

export { wallsOf, followOf, wpMath, dwMath };
export function _setLast(q) { last = q ? { q, at: Date.now() } : null; }
// the last wallpaper or drywall card (room.js reads it so "the whole room" after a walls card keeps that room and that job)
export function lastWallsOf() { return last && Date.now() - last.at <= FOLLOW_MS ? last : null; }
export default {
  name: 'walls',
  examples: [
    'how many rolls of wallpaper for a 12x14 room',
    'how much wallpaper do i need for a 10x12 bedroom with 9 foot ceilings',
    'wallpaper for an accent wall 12 feet wide',
    'how many rolls of wallpaper for a 4 by 3 metre room with a 64 cm repeat',
    'wallpaper calculator',
    'how many sheets of drywall for a 12x14 room',
    'how many 4x12 sheets of drywall for a 12x14 room and the ceiling',
    'how much drywall for a wall 12 feet wide and 8 feet high',
    'drywall calculator'
  ],
  nearMisses: [
    'wallpaper for my phone',
    'how to remove wallpaper',
    'how to patch a hole in drywall',
    'what is drywall made of',
    'how much paint do i need for a 12x14 room',
    'best 4k wallpapers',
    'the ceiling too'
  ],
  match(lower, text) { if (wallsOf(text)) return true; return !!followOf(text); },
  run
};
