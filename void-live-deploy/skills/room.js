/**
 * room skill - everything for one room on one card: paint, flooring, wallpaper, drywall and baseboard, with a price on
 * each line and the total (no key; pure math, built on home.js and walls.js so every number matches their own cards)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Asks: "redo a 12x14 room", "what do i need to redo a 12x14 bedroom", "paint and carpet a 12x14 room",
 *   "paint and new laminate for a 10x12 bedroom at $40 a gallon and $3 a sq ft", "wallpaper and carpet for a 12x12 room",
 *   "drywall, paint and flooring for a 12x14 room and the ceiling", "shopping list for a 12x14 bedroom makeover",
 *   "wallpaper the walls and paint the ceiling of a 12x12 room" (wallpaper on the walls, paint on the ceiling).
 *   A room project with no job named gets paint and flooring. The paint, floor, wallpaper and drywall amounts come from
 *   home.js (homeOf / paintMath / floorMath) and walls.js (wallsOf / wpMath / dwMath), so they agree with those cards.
 * Prices: "$40 a gallon", "$3 a sq ft", "$2.50 a square foot", "$30 a sq yd", "$45 a roll", "$15 a sheet",
 *   "$1.50 a foot" (baseboard) in the ask or a follow-up; each line also has its own price box, and the total updates as you type.
 *   Nothing is priced unless you give the price: stores and regions differ too much for one number to be honest.
 * The whole room after a single card: after a paint, floor, wallpaper or drywall card (home.js, walls.js), "the whole room",
 *   "everything for it", "make a shopping list", "what would it all cost" put that room on one card with that job included.
 * Follow-ups on the last room card (this page, 30 minutes): "add wallpaper", "drywall too", "no paint", "skip the baseboard",
 *   "what about carpet", "hardwood instead", "12x24 tiles", "herringbone", "the ceiling too", "no ceiling", "9 foot ceilings",
 *   "with 2 doors and 3 windows", "3 coats", "with primer", and any of the prices above.
 */
import { clean, dimsOf, heightOf, countOf, homeOf, paintMath, floorMath, buyOf, lastRoomOf } from './home.js';
import { wallsOf, wpMath, dwMath, lastWallsOf } from './walls.js';

const NUM = '(\\d+(?:\\.\\d+)?)';
const fmt = (x, d) => Number(x).toLocaleString('en-US', { maximumFractionDigits: d == null ? 1 : d });
const money = (cur, v) => cur + fmt(v, 2).replace(/\.(\d)$/, '.$10');
const WORDN = { no: 0, none: 0, zero: 0, one: 1, two: 2, three: 3, four: 4 };

const PAINT_W = /\b(paint(?:ing|ed)?|repaint(?:ing)?)\b/;
const FLOOR_W = /\b(floor(?:ing|s)?|laminate|hardwood|engineered\s+wood|vinyl(?:\s+plank)?|lvp|lvt|carpet(?:ing|ed)?|tiles?|tiling|tiled|parquet)\b/;
const WP_W = /\b(wall\s*paper(?:ing|ed)?|wall\s*coverings?)\b/;
const DW_W = /\b(drywall|dry\s+wall|sheetrock|plasterboard|gypsum\s+board|wallboard|gyprock)\b/;
const PROJ = /\b(re-?do(?:ing)?|remodel(?:l?ing)?|renovat(?:e|ing|ion)|makeover|make\s*over|refresh(?:ing)?|refurbish(?:ing)?|do(?:ing)?\s+up|fix(?:ing)?\s+up|spruce\s+up|redecorat(?:e|ing)|decorat(?:e|ing)|project|shopping\s+list|materials?\s+(?:list|for)|supplies|supply\s+list|everything|the\s+whole\s+room)\b/;
const ROOMW = /\b(room|bedroom|kitchen|bathroom|bath|hallway|hall|office|den|nursery|lounge|basement|garage|attic|study|walls?)\b/;
const NOT = /\b(clock|notes?|sticky|timer|counter|stage|void|app|phone|screen|game|minecraft|sims|photo|picture|image|render|blueprint|floor\s+plan|ideas?|inspiration|how\s+to|tips|who|history|designer|contractor|hire|permit|concrete|slab|deck|fence|roof|roofing|siding|paint\s+(?:the|a|my)\s+floors?|floor\s+paint|epoxy)\b/;
const TILE1 = /(\d+(?:\.\d+)?)\s*(?:"|in(?:ch(?:es)?)?|cm|mm)?\s*(?:x|by)\s*(\d+(?:\.\d+)?)\s*("|in(?:ch(?:es)?)?|cm|mm)?\s*(?:(?:porcelain|ceramic|floor|marble|stone)\s+)?tiles?\b/;
const TILE2 = /(\d+(?:\.\d+)?)\s*(?:-\s*)?("|in(?:ch(?:es)?)?|cm|mm)\s*(?:square\s+)?(?:(?:porcelain|ceramic|floor|marble|stone)\s+)?tiles?\b/;
const HEIGHT_PHRASE = new RegExp(NUM + "\\s*(?:-\\s*)?(?:'|ft|feet|foot|m|meters?|metres?)?\\s*(?:-\\s*)?(?:high\\s+|tall\\s+)?ceilings?", 'g');
const PART_KEYS = ['dw', 'paint', 'wp', 'floor'];
const NAME = { paint: 'Paint', floor: 'Flooring', wp: 'Wallpaper', dw: 'Drywall', base: 'Baseboard' };

function matOf(t) {
  return /\bcarpet/.test(t) ? 'carpet' : /\btil(?:e|es|ing|ed)\b/.test(t) ? 'tile' : /\bhardwood|engineered\s+wood|parquet/.test(t) ? 'hardwood'
    : /\bvinyl|lvp|lvt/.test(t) ? 'vinyl plank' : /\blaminate/.test(t) ? 'laminate' : null;
}
function patternOf(t) { return /\bherringbone|chevron/.test(t) ? 'herringbone' : /\bdiagonal|45\s*(?:degrees?|\u00b0)/.test(t) ? 'diagonal' : null; }

// the prices said in an ask, by what they are for
function pricesOf(t) {
  const out = {};
  const cur = /\u00a3/.test(t) ? '\u00a3' : /\u20ac/.test(t) ? '\u20ac' : '$';
  const re = /(?:[$\u00a3\u20ac]\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:dollars|bucks|pounds|euros?))\s*(?:\/\s*|(?:a|an|per|each)\s+)(gal(?:lon)?s?|lit(?:er|re)s?|l|tin|can|sq(?:uare)?\.?\s*(?:ft|feet|foot|yd|yards?|m|met(?:er|re)s?)|sqft|m2|ft2|box(?:es)?|cartons?|rolls?|sheets?|panels?|boards?|(?:linear\s+)?(?:ft|foot|feet|metres?|meters?))\b/g;
  let m;
  while ((m = re.exec(t))) {
    const v = +(m[1] || m[2]), u = m[3].replace(/\s+/g, ' ');
    if (!(v > 0 && v < 100000)) continue;
    if (/^(?:gal|lit|l$|tin|can)/.test(u)) out.paint = { v, cur, per: /^(?:lit|l$)/.test(u) ? 'litre' : 'gallon' };
    else if (/^(?:sq|m2|ft2)/.test(u)) out.floor = { v, cur, per: /yd|yard/.test(u) ? 'sqyd' : 'area' };
    else if (/^(?:box|carton)/.test(u)) out.floor = { v, cur, per: 'box' };
    else if (/^roll/.test(u)) out.wp = { v, cur };
    else if (/^(?:sheet|panel|board)/.test(u)) out.dw = { v, cur };
    else out.base = { v, cur };
  }
  return out;
}

// the room itself: size, wall height, doors and windows, ceiling, floor material
function specOf(t) {
  let tile = null, rest = t;
  const tm = t.match(TILE1) || t.match(TILE2);
  if (tm) { tile = tm[0].replace(/\s+/g, ' '); rest = t.slice(0, tm.index) + ' tiles ' + t.slice(tm.index + tm[0].length); }
  const d = dimsOf(rest);
  if (!d) return null;
  const M = d.metric, h = heightOf(rest, M);
  if (h == null) return null;
  let doors = countOf(rest, 'door'), windows = countOf(rest, 'window');
  if (/\bno\s+(?:doors?\s+(?:or|and|nor)\s+)?windows?\b/.test(rest)) windows = 0;
  if (/\bno\s+doors?\b/.test(rest)) doors = 0;
  if (doors != null && doors > 20 || windows != null && windows > 40) return null;
  const noH = rest.replace(HEIGHT_PHRASE, '').replace(/ceilings?\s+(?:are|is|of|at)\s+\d[^ ]*/g, '');
  const ceiling = /\bceilings?\b/.test(noH) && !/\bno\s+ceiling/.test(noH);
  const cm = t.match(/\b(\d|one|two|three|four)\s+coats?\b/), coats = cm ? (cm[1] in WORDN ? WORDN[cm[1]] : +cm[1]) : null;
  if (coats != null && !(coats >= 1 && coats <= 4)) return null;
  return { a: d.a, b: d.b, metric: M, h, doors, windows, ceiling, coats, primer: /\bprimer|\bprime\b/.test(t), mat: tile ? 'tile' : matOf(rest), pattern: patternOf(t), tile, base: true };
}

function projectOf(text) {
  const t = clean(text);
  if (!t || t.length > 240 || NOT.test(t)) return null;
  const parts = { paint: PAINT_W.test(t), floor: FLOOR_W.test(t), wp: WP_W.test(t), dw: DW_W.test(t) };
  const n = PART_KEYS.filter((k) => parts[k]).length;
  if (n < 2 && !(PROJ.test(t) && ROOMW.test(t))) return null;
  const s = specOf(t);
  if (!s) return null;
  if (!n) { parts.paint = true; parts.floor = true; }
  else if (n === 1 && PROJ.test(t)) { if (!parts.wp) parts.paint = true; parts.floor = true; } // "remodel a 10x12 kitchen with 12x24 tiles": the walls too
  s.parts = parts; s.prices = pricesOf(t);
  return s;
}

// one line per job, worked out by the same code as the single cards
function linesOf(s) {
  const M = s.metric, U = M ? 'm\u00b2' : 'sq ft', L = M ? ' m' : ' ft';
  const room = 'a ' + fmt(s.a, 3) + 'x' + fmt(s.b, 3) + (M ? ' metre' : '') + ' room';
  const hs = ' with ' + fmt(s.h, 3) + (M ? ' m' : ' foot') + ' ceilings';
  const lines = [], info = {};
  const paperWalls = s.parts.wp && s.parts.paint && s.ceiling; // paper on the walls, paint on the ceiling
  if (s.parts.dw) {
    const q = wallsOf('how many sheets of drywall for ' + room + hs + (s.ceiling ? ' and the ceiling' : ''));
    if (q && q.kind === 'dw') {
      const r = dwMath(q), mud = Math.max(1, Math.ceil(r.mudGal / 4.5 - 1e-9)), tape = Math.max(1, Math.ceil(r.tapeFt / 250 - 1e-9));
      lines.push({ key: 'dw', qty: r.sheets, unit: 'sheet', units: 'sheets', main: r.sheets + ' sheets of ' + (M ? fmt(q.sheet.w, 1) + ' \u00d7 ' + fmt(q.sheet.l, 1) + ' m' : q.sheet.w + ' \u00d7 ' + q.sheet.l + ' ft'),
        more: fmt(r.total, 0) + ' ' + U + (q.ceiling ? ' of walls and ceiling' : ' of walls') + ' + 10% for cuts; ' + fmt(Math.max(1, Math.ceil(r.screwsLb - 1e-9)), 0) + ' lb of screws, ' + tape + ' roll' + (tape > 1 ? 's' : '') + ' of tape, ' + mud + ' \u00d7 4.5-gal carton' + (mud > 1 ? 's' : '') + ' of joint compound (USG J371)' });
      info.dwPrimer = r.primerGal;
    }
  }
  if (s.parts.paint) {
    const said = (s.doors != null ? ' with ' + s.doors + ' doors' : '') + (s.windows != null ? (s.doors != null ? ' and ' : ' with ') + s.windows + ' windows' : '');
    const ask = paperWalls ? 'how much paint for the ceiling of ' + room
      : 'how much paint for ' + room + hs + said + (s.ceiling ? ' and the ceiling' : '') + (s.coats ? ' ' + s.coats + ' coats' : '') + (s.primer || s.parts.dw ? ' with primer' : '');
    const q = homeOf(ask);
    if (q && q.kind === 'paint') {
      const r = paintMath(q), V = M ? 'L' : 'gal', amt = r.wallG + r.ceilG + r.primerG;
      const per = s.prices.paint && s.prices.paint.per === 'litre' && !M ? 1 / 3.785 : 1; // a litre price on a US room
      const qty = Math.ceil(amt / per - 1e-9);
      const buy = [r.wallG > 0 ? buyOf(r.wallG, M) + ' for the walls' : '', r.ceilG > 0 ? buyOf(r.ceilG, M) + ' of ceiling white' : '', r.primerG > 0 ? buyOf(r.primerG, M) + ' of primer' : ''].filter(Boolean).join(' + ');
      lines.push({ key: 'paint', qty, unit: per !== 1 ? 'litre' : M ? 'litre' : 'gallon', units: per !== 1 || M ? 'L' : 'gal', main: buy,
        more: (r.walls > 0 ? fmt(r.walls, 0) + ' ' + U + ' of wall (' + q.doors + ' door' + (q.doors === 1 ? '' : 's') + ', ' + q.windows + ' window' + (q.windows === 1 ? '' : 's') + ' taken off)' : '') + (r.ceil > 0 ? (r.walls > 0 ? ' + ' : '') + fmt(r.ceil, 0) + ' ' + U + ' of ceiling' : '') + ', ' + q.coats + ' coat' + (q.coats > 1 ? 's' : '') + ' at ' + (M ? '10 m\u00b2/L' : '350 sq ft a gallon') + ' = ' + fmt(amt, 2) + ' ' + V + (r.primerG > 0 ? ' with one coat of primer' : '') });
      info.paint = { doors: q.doors, windows: q.windows, said: q.said };
    }
  }
  if (s.parts.wp) {
    const q = wallsOf('how many rolls of wallpaper for ' + room + hs);
    if (q && q.kind === 'wp') {
      const r = wpMath(q);
      if (r.rolls) lines.push({ key: 'wp', qty: r.rolls, unit: 'roll', units: 'rolls', main: r.rolls + ' rolls (' + (r.rolls + 1) + ' with a spare, one batch number)',
        more: r.drops + ' drops of ' + (M ? fmt(r.drop, 2) + ' m' : Math.floor(r.drop + 1e-9) + ' ft ' + fmt(Math.round((r.drop - Math.floor(r.drop + 1e-9)) * 12 * 10) / 10, 1) + ' in') + ', ' + r.perRoll + ' from each ' + (M ? '0.53 \u00d7 10.05 m' : '20.5 in \u00d7 33 ft') + ' roll (the drop method), plus paste' });
    }
  }
  if (s.parts.floor) {
    const mat = s.mat || 'flooring';
    const q = homeOf((s.tile ? 'how many ' + s.tile + ' for ' + room : 'how much ' + mat + ' for ' + room) + (s.pattern ? ' ' + s.pattern : ''));
    if (q && q.kind === 'floor') {
      const r = floorMath(q), p = s.prices.floor;
      let qty, unit, units, main;
      if (p && p.per === 'box') { const b = r.boxes || r.boxGuess || 0; qty = b; unit = 'box'; units = 'boxes'; }
      else if (mat === 'carpet' || p && p.per === 'sqyd') { qty = Math.ceil((r.sqyd != null ? r.sqyd : M ? r.need / 0.83612736 : r.need / 9) - 1e-9); unit = 'sq yd'; units = 'sq yd'; }
      else { qty = Math.ceil(r.need - 1e-9); unit = M ? 'm\u00b2' : 'sq ft'; units = unit; }
      if (q.tile) main = fmt(r.tiles, 0) + ' ' + q.tile.label + ' tiles (' + fmt(Math.ceil(r.need - 1e-9), 0) + ' ' + U + ')';
      else if (mat === 'carpet') main = fmt(Math.ceil(r.sqyd - 1e-9), 0) + ' sq yd of carpet' + (r.roll ? ' off a 12-ft roll' : '') + ' + the same of pad';
      else main = fmt(Math.ceil(r.need - 1e-9), 0) + ' ' + U + ' of ' + mat + (r.boxGuess ? ' (about ' + r.boxGuess + ' boxes)' : '');
      const extra = mat === 'tile' ? Math.ceil(q.area / (M ? 3.7 : 40) - 1e-9) + ' bag' + (Math.ceil(q.area / (M ? 3.7 : 40) - 1e-9) === 1 ? '' : 's') + ' of thinset and grout'
        : mat === 'carpet' ? (r.roll && r.roll.strips > 1 ? r.roll.strips - 1 + ' seam' + (r.roll.strips > 2 ? 's' : '') : 'no seams') : fmt(Math.ceil(q.area), 0) + ' ' + U + ' of underlayment unless the planks have a pad';
      lines.push({ key: 'floor', qty, unit, units, main, more: fmt(q.area, 1) + ' ' + U + ' of floor + ' + Math.round(q.waste * 100) + '% for ' + (mat === 'carpet' ? 'trimming' : q.pattern + ' lay cuts') + '; ' + extra });
      if (s.base && r.base) { const b = Math.ceil(r.base * 1.1 - 1e-9); lines.push({ key: 'base', qty: b, unit: M ? 'metre' : 'foot', units: M ? 'm' : 'ft', main: b + L + ' of baseboard', more: 'the perimeter less one doorway (' + fmt(r.base, 1) + L + ') + 10% for corner cuts' }); }
    }
  }
  return { lines, info, paperWalls };
}

function costOf(line, s) { const p = s.prices[line.key]; return p ? line.qty * p.v : null; }
function curOf(s) { const p = Object.values(s.prices)[0]; return p ? p.cur : '$'; }

function cardHtml(s, built, esc) {
  const { lines, info, paperWalls } = built, M = s.metric, L = M ? ' m' : ' ft', cur = curOf(s);
  const sub = fmt(s.a, 2) + ' \u00d7 ' + fmt(s.b, 2) + L + ' room \u00b7 ' + fmt(s.h, 2) + L + ' walls' + (s.ceiling ? ' \u00b7 ceiling too' : '')
    + (info.paint && !paperWalls ? ' \u00b7 ' + info.paint.doors + ' door' + (info.paint.doors === 1 ? '' : 's') + ', ' + info.paint.windows + ' window' + (info.paint.windows === 1 ? '' : 's') : '');
  const rows = lines.map((l) => {
    const p = s.prices[l.key], c = costOf(l, s);
    return '<tr data-k="' + l.key + '"><td style="padding:6px 8px 6px 0;vertical-align:top"><b>' + esc(NAME[l.key]) + '</b><div>' + esc(l.main) + '</div><div class="sub" style="font-size:12px">' + esc(l.more) + '</div></td>'
      + '<td style="padding:6px 0;vertical-align:top;white-space:nowrap"><label style="font-size:12px;color:#8a8a8a">' + esc(cur) + '<input class="rp-price" data-k="' + l.key + '" type="number" min="0" step="any" value="' + (p ? p.v : '') + '" placeholder="price" aria-label="' + esc(NAME[l.key] + ' price a ' + l.unit) + '" style="width:64px"> a ' + esc(l.unit) + '</label>'
      + '<div class="rp-qty sub" style="font-size:12px;text-align:right">' + esc(fmt(l.qty, 0) + ' ' + l.units) + '</div><div class="rp-cost" data-k="' + l.key + '" style="text-align:right">' + (c != null ? esc(money(cur, c)) : '') + '</div></td></tr>';
  }).join('');
  const names = lines.map((l) => NAME[l.key].toLowerCase());
  const order = [];
  if (s.parts.dw) order.push('hang the drywall (ceiling first), tape and mud it, then prime it');
  if (s.parts.paint && (s.ceiling || paperWalls)) order.push('paint the ceiling');
  if (s.parts.paint && !paperWalls) order.push('paint the walls');
  if (s.parts.wp) order.push('hang the wallpaper');
  if (s.parts.floor) order.push('lay the ' + (s.mat || 'floor'), 'fit the baseboard last so it sits on the new floor');
  const add = ['wallpaper', 'drywall', 'paint', 'flooring'].filter((x) => !names.includes(x) && !(x === 'flooring' && s.parts.floor));
  const ask = (a) => '<a href="#" data-ask="' + esc(a) + '">' + esc(a) + '</a>';
  const tips = [].concat(add.slice(0, 2).map((x) => 'add ' + x), s.parts.floor ? [s.mat === 'carpet' ? 'what about hardwood' : 'what about carpet'] : [], s.ceiling ? [] : ['the ceiling too'], [M ? '2.7 m ceilings' : '9 foot ceilings']);
  return '<h2>Everything for the room</h2><div class="sub">' + esc(sub) + '</div>'
    + '<div class="rp-total" style="font-size:44px;font-weight:300;line-height:1.15;margin:6px 0 4px"></div><div class="rp-total-sub sub"></div>'
    + '<table style="width:100%;border-collapse:collapse;margin:8px 0">' + rows + '</table>'
    + (paperWalls ? '<p style="color:#8a8a8a">Wallpaper goes on the walls, so the paint is just for the ceiling.</p>' : s.parts.wp && s.parts.paint ? '<p style="color:#8a8a8a">Paint and wallpaper are both for the walls here. Say "no wallpaper" or "no paint" to keep one, or "the ceiling too" to paint the ceiling and paper the walls.</p>' : '')
    + (order.length > 1 ? '<p><b>Order of work</b> ' + esc(order.map((x, i) => (i + 1) + '. ' + x).join(' \u00b7 ')) + ' (top down, so drips and dust land on what comes next)</p>' : '')
    + '<p style="color:#8a8a8a">Type a price on any line, or say it ("at $40 a gallon", "$3 a sq ft", "$45 a roll", "$15 a sheet"); nothing is priced until you do, because stores and regions differ too much for one honest number.</p>'
    + '<div class="src">Each line is the same math as its own card (paint and flooring: Sherwin-Williams, Benjamin Moore and Behr spread rates, NWFA and TCNA waste; wallpaper: the drop method; drywall: USG J371) \u00b7 try ' + tips.map(ask).join(', ') + '</div>';
}

function totalUpdate(el, s, lines) {
  const cur = curOf(s);
  let sum = 0, priced = 0;
  for (const l of lines) { const c = costOf(l, s); const cell = el.querySelector('.rp-cost[data-k="' + l.key + '"]'); if (cell) cell.textContent = c != null ? money(cur, c) : ''; if (c != null) { sum += c; priced++; } }
  const big = el.querySelector('.rp-total'), small = el.querySelector('.rp-total-sub');
  if (big) big.textContent = priced === lines.length && priced ? 'about ' + money(cur, sum) : lines.length + ' thing' + (lines.length === 1 ? '' : 's') + ' to buy';
  if (small) small.textContent = !priced ? 'add a price to each line for the total' : priced === lines.length ? 'the whole room, ' + lines.length + ' lines priced' : money(cur, sum) + ' so far, ' + priced + ' of ' + lines.length + ' lines priced';
}

// follow-ups: edit the last room card, or put the room of the last paint, floor, wallpaper or drywall card on one card
let last = null;
const FOLLOW_MS = 30 * 60 * 1000;
const LEAD = '^(?:(?:and|but|ok|okay|now|so|then|also|actually)\\s+)?';
const WHAT = '(?:(?:what|how)\\s+about\\s+|with\\s+|make\\s+it\\s+|use\\s+|try\\s+|go\\s+with\\s+)?';
const PARTW = '(paint(?:ing)?|wall\\s*paper|drywall|dry\\s+wall|sheetrock|plasterboard|floor(?:ing)?|carpet|tiles?|hardwood|laminate|baseboards?|trim|primer)';
const keyOfWord = (w) => /^paint/.test(w) ? 'paint' : /paper/.test(w) ? 'wp' : /dry|sheet|plaster/.test(w) ? 'dw' : /base|trim/.test(w) ? 'base' : /primer/.test(w) ? 'primer' : 'floor';
const WHOLE = /^(?:(?:and|now|ok|okay|so|then)\s+)?(?:(?:do|plan|price)\s+)?(?:(?:the\s+)?whole\s+(?:room|thing|job|project)|everything(?:\s+(?:for\s+(?:it|that|this|the\s+room)|else))?|all\s+of\s+it|(?:make\s+(?:me\s+)?)?(?:a\s+|the\s+)?(?:project|shopping|materials?|supply)\s+list(?:\s+for\s+(?:it|that|this|the\s+room))?|put\s+it\s+all\s+together|(?:what|how\s+much)\s+(?:would|will|does)\s+(?:it\s+all|the\s+whole\s+(?:room|thing|job))\s+cost|what'?s\s+the\s+total(?:\s+cost)?|redo\s+the\s+(?:whole\s+)?room|(?:the\s+)?room\s+project)(?:\s+please)?$/;
const clone = (s) => ({ ...s, parts: { ...s.parts }, prices: { ...s.prices } });

function editOf(s0, t) {
  const s = clone(s0);
  let m;
  // prices only: "at $40 a gallon and $3 a sq ft"
  const pr = pricesOf(t);
  if (Object.keys(pr).length) {
    const left = t.replace(/(?:[$\u00a3\u20ac]\s*\d+(?:\.\d+)?|\d+(?:\.\d+)?\s*(?:dollars|bucks|pounds|euros?))\s*(?:\/\s*|(?:a|an|per|each)\s+)(?:gal(?:lon)?s?|lit(?:er|re)s?|l|tin|can|sq(?:uare)?\.?\s*(?:ft|feet|foot|yd|yards?|m|met(?:er|re)s?)|sqft|m2|ft2|box(?:es)?|cartons?|rolls?|sheets?|panels?|boards?|(?:linear\s+)?(?:ft|foot|feet|metres?|meters?))\b/g, ' ')
      .replace(/\b(?:at|and|with|plus|for|the|of|is|are|costs?|paint|flooring|floor|carpet|tiles?|hardwood|laminate|wallpaper|drywall|sheetrock|baseboards?|trim|prices?|it'?s|its|so|ok|okay|now|then|what\s+about|how\s+about|if)\b|[,.]/g, ' ').trim();
    if (left) return null;
    Object.assign(s.prices, pr); // a price never adds a job: "add wallpaper" does
    return s;
  }
  if ((m = t.match(new RegExp(LEAD + '(?:add|include|plus|with|and)\\s+(?:the\\s+|some\\s+|new\\s+)?' + PARTW + '(?:\\s+(?:too|as\\s+well))?$'))) || (m = t.match(new RegExp(LEAD + '(?:new\\s+)?' + PARTW + '\\s+(?:too|as\\s+well)$')))) {
    const k = keyOfWord(m[1]);
    if (k === 'primer') { s.primer = true; return s; }
    if (k === 'base') { s.base = true; s.parts.floor = true; return s; }
    if (s.parts[k] && !(k === 'floor' && matOf(m[1]) && matOf(m[1]) !== s.mat)) return null;
    s.parts[k] = true; if (k === 'floor' && matOf(m[1])) { s.mat = matOf(m[1]); s.tile = null; }
    return s;
  }
  if ((m = t.match(new RegExp(LEAD + '(?:no|without|skip|drop|remove|lose|forget|take\\s+(?:off|out))\\s+(?:the\\s+)?' + PARTW + '(?:\\s+(?:then|please))?$')))) {
    const k = keyOfWord(m[1]);
    if (k === 'primer') { if (!s.primer) return null; s.primer = false; return s; }
    if (k === 'base') { if (!s.base) return null; s.base = false; return s; }
    if (!s.parts[k]) return null;
    s.parts[k] = false;
    return PART_KEYS.some((x) => s.parts[x]) ? s : null;
  }
  if ((m = t.match(new RegExp(LEAD + WHAT + '(?:new\\s+)?(carpet|hardwood|laminate|vinyl\\s+plank|vinyl|lvp|tiles?)(?:\\s+(?:floors?|flooring))?(?:\\s+instead)?$')))) {
    const mat = matOf(m[1]); if (!mat || mat === s.mat && !s.tile) return null;
    s.mat = mat; s.tile = null; s.parts.floor = true; return s;
  }
  if ((m = t.match(new RegExp(LEAD + WHAT + '(\\d+(?:\\.\\d+)?\\s*(?:"|in(?:ch(?:es)?)?|cm|mm)?\\s*(?:x|by)\\s*\\d+(?:\\.\\d+)?\\s*(?:"|in(?:ch(?:es)?)?|cm|mm)?\\s*tiles?)(?:\\s+instead)?$')))) { s.tile = m[1]; s.mat = 'tile'; s.parts.floor = true; return s; }
  if ((m = t.match(new RegExp(LEAD + WHAT + '(herringbone|chevron|diagonal|straight)(?:\\s+(?:lay|pattern))?(?:\\s+instead)?$')))) { if (!s.parts.floor) return null; s.pattern = /straight/.test(m[1]) ? null : patternOf(m[1]); return s; }
  if (new RegExp(LEAD + '(?:add\\s+|plus\\s+|with\\s+)?(?:the\\s+)?ceilings?(?:\\s+(?:too|as\\s+well))$|' + LEAD + '(?:add|plus|with)\\s+(?:the\\s+)?ceilings?$').test(t)) { if (s.ceiling) return null; s.ceiling = true; return s; }
  if (new RegExp(LEAD + '(?:no|not\\s+the|without\\s+the|skip\\s+the)\\s+ceilings?$').test(t)) { if (!s.ceiling) return null; s.ceiling = false; return s; }
  if ((m = t.match(new RegExp(LEAD + WHAT + NUM + "\\s*(?:-\\s*)?('|ft|feet|foot|m|meters?|metres?)?\\s*(?:-\\s*)?(?:high\\s+|tall\\s+)?ceilings?(?:\\s+instead)?$")))) {
    const h = heightOf(t, s.metric); if (h == null) return null; s.h = h; return s;
  }
  if ((m = t.match(new RegExp(LEAD + WHAT + '(\\d|one|two|three|four)\\s+coats?(?:\\s+instead)?$')))) { const c = m[1] in WORDN ? WORDN[m[1]] : +m[1]; if (!(c >= 1 && c <= 4) || !s.parts.paint) return null; s.coats = c; return s; }
  if (new RegExp(LEAD + WHAT + '(?:(?:\\d+|no|one|two|three|four|five|six|a|an)\\s+doors?)?(?:\\s*(?:and|,)?\\s*(?:(?:\\d+|no|one|two|three|four|five|six|seven|eight|a|an)\\s+windows?))?$').test(t) && /door|window/.test(t)) {
    const d = /\bno\s+doors?\b/.test(t) ? 0 : countOf(t, 'door'), w = /\bno\s+windows?\b/.test(t) ? 0 : countOf(t, 'window');
    if (d != null) s.doors = d; if (w != null) s.windows = w;
    if (s.doors > 20 || s.windows > 40) return null;
    return s;
  }
  return null;
}

function specFromWalls(q) { // a walls.js card's room, with its job (papered walls: the paint goes on the ceiling)
  if (!q.d) return null;
  return { a: q.d.a, b: q.d.b, metric: q.metric, h: q.h, doors: null, windows: null, ceiling: !!q.ceiling || q.kind === 'wp', coats: null, primer: false, mat: null, pattern: null, tile: null, base: true,
    parts: { paint: true, floor: true, wp: q.kind === 'wp', dw: q.kind === 'dw' }, prices: q.price ? { [q.kind]: { v: q.price.v, cur: q.price.cur } } : {} };
}
function specFromHome(h) { // a home.js card's room (its ask), paint and flooring
  const s = specOf(h.t);
  if (!s) return null;
  s.parts = { paint: true, floor: true, wp: false, dw: false }; s.prices = pricesOf(h.t);
  if (s.prices.paint && h.kind !== 'paint' && !PAINT_W.test(h.t)) delete s.prices.paint;
  if (h.kind === 'paint' && s.prices.floor) delete s.prices.floor;
  return s;
}
function followOf(text) {
  const t = clean(text);
  if (!t || t.length > 120 || /\d\s*(?:x|by)\s*\d/.test(t) && !/tiles?$|tiles?\s+instead$/.test(t)) return null;
  const hl = lastRoomOf(), wl = lastWallsOf(), mine = last && Date.now() - last.at <= FOLLOW_MS ? last : null;
  const newest = Math.max(hl ? hl.at : 0, wl ? wl.at : 0);
  if (mine && mine.at >= newest) { const s = editOf(mine.s, t); if (s) return { s }; if (WHOLE.test(t)) return { s: clone(mine.s) }; return null; }
  if (!WHOLE.test(t) || !newest) return null;
  const s = wl && wl.at >= newest ? specFromWalls(wl.q) : specFromHome(hl);
  return s ? { s } : null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  let s = projectOf(text);
  if (!s) { const f = followOf(text); if (f) s = f.s; }
  if (!s) return 'none';
  const built = linesOf(s);
  if (!built.lines.length) return 'none';
  last = { s, at: Date.now() };
  const el = showPage((p) => { p.innerHTML = cardHtml(s, built, esc); });
  if (el && el.querySelectorAll) {
    totalUpdate(el, s, built.lines);
    el.querySelectorAll('input.rp-price').forEach((inp) => inp.addEventListener('input', () => {
      const k = inp.getAttribute('data-k'), v = parseFloat(inp.value);
      if (v > 0) s.prices[k] = { ...(s.prices[k] || {}), v, cur: curOf(s) }; else delete s.prices[k];
      totalUpdate(el, s, built.lines);
    }));
  }
  return 'room';
}

export { projectOf, followOf, linesOf, pricesOf };
export function _setLast(s) { last = s ? { s, at: Date.now() } : null; }
export default {
  name: 'room',
  examples: [
    'redo a 12x14 room',
    'what do i need to redo a 12x14 bedroom',
    'paint and carpet a 12x14 room',
    'paint and new laminate for a 10x12 bedroom at $40 a gallon and $3 a sq ft',
    'wallpaper and carpet for a 12x12 room',
    'drywall paint and flooring for a 12x14 room and the ceiling',
    'shopping list for a 12x14 bedroom makeover',
    'wallpaper the walls and paint the ceiling of a 12x12 room'
  ],
  nearMisses: [
    'how much paint do i need for a 12x14 room',
    'how many rolls of wallpaper for a 12x14 room',
    'how much carpet for a 12x14 room',
    'bedroom makeover ideas',
    'how to redo a 12x14 room cheaply',
    'redo',
    'the whole room'
  ],
  match(lower, text) { return !!projectOf(text) || !!followOf(text); },
  run
};
