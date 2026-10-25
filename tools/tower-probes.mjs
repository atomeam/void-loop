// The tower gate's accuracy and completeness probes (tools/tower-gate.mjs): for a floor, the same question put to the real site and to Verse
// (owner, 2026-10-24: automate the unmeasured aspects in the head-to-head gate), and what the answer page must show.
//   truth: what a CORRECT answer contains, worked out here independently of both sites (accuracy = how many of these the page shows)
//   facts: what a COMPLETE answer offers, the union of what the best sites in the category show (completeness = how many of these it shows)
// Each is a list of [label, RegExp] read against the page's visible text after it has loaded. A floor without a probe leaves accuracy and
// completeness unverified (never counted as beaten); a probe with truth null leaves accuracy unverified (only a site whose own address carries the
// question can be asked the same thing as Verse). Pure data, plus the date the 'is it' truth depends on.
const christmas = (d = new Date()) => d.getUTCMonth() === 11 && d.getUTCDate() === 25;

// a number written whole, digit for digit, with any spacing or grouping between its digits (a converter may write 1001 0001 ...), and no digit
// run before or after it: a rounded 1.5123660752041709e+36 or a run of zeros at the end does not match. Pure.
/** what a spin's answer puts between what the spin showed and what the page had before it (tower-gate.mjs answer, `spin`) */
export const SPUN = '\u241e before the spin \u241e';
const spun = (t) => { const [after, before = ''] = String(t || '').split(SPUN); return { after, before }; };
// wheelofnames.com's own starting names, put on Verse's wheel in its link, so both spin the same eight
const WHEEL_NAMES = ['Ali', 'Beatriz', 'Charles', 'Diya', 'Eric', 'Fatima', 'Gabriel', 'Hanna'];
const exact = (digits) => new RegExp('(?<![0-9a-z])(?:0[\\s,_]?)*' + [...String(digits)].join('[\\s,_]?') + '(?![0-9a-z])', 'i'); // leading zeros allowed: 0001 0010 ... is the same number
const HUGE = 0x123456789abcdef0123456789abcdefn;
const WC_TEXT = 'The quick brown fox jumps over the lazy dog. It was not amused!'; // 13 words, 63 characters, 2 sentences

// the people in a page's JSON ({"results": [...]}, as randomuser.me's API and Verse's page both write it), each read the same way whatever its
// shape: randomuser.me nests dob and location, Verse's rows are flat. [] when the page holds no such JSON. Pure.
export function peopleIn(text) {
  const t = String(text || ''), at = t.indexOf('"results"'); if (at < 0) return [];
  const start = t.lastIndexOf('{', at); if (start < 0) return [];
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < t.length; i++) { const c = t[i];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) {
      try { const j = JSON.parse(t.slice(start, i + 1)); return (Array.isArray(j.results) ? j.results : []).map((p) => ({ country: p.country || (p.location && p.location.country) || '', dob: String(typeof p.dob === 'string' ? p.dob : (p.dob && p.dob.date) || '').slice(0, 10), age: typeof p.age === 'number' ? p.age : p.dob && p.dob.age, email: p.email, phone: p.phone })); } catch (_) { return []; } } }
  return [];
}
/** whole years from an ISO birthday to `now` (UTC). Pure. */
export const ageOn = (dob, now = new Date()) => { const b = new Date(String(dob).slice(0, 10) + 'T00:00:00Z'); if (isNaN(b)) return NaN; let a = now.getUTCFullYear() - b.getUTCFullYear(); if (now < new Date(Date.UTC(now.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()))) a--; return a; };
/** what a timed run puts between what the stopwatch showed and what it showed a moment later, around the gate's own measure in ms (tower-gate.mjs answer, `timed`) */
export const TIMED = '\u241e gate measured ms \u241e';
/** the clock readings in a text: "0:03.02", "00:00:03", "1:02:03.4", "3.02 s", each with its value and the step it shows (0.01 s, 1 s). Pure. */
export function clockReadings(text) {
  const out = [], t = String(text || '');
  for (const m of t.matchAll(/(?<![\d:.])(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?(?![\d:])/g)) out.push({ at: m[0], s: (+(m[1] || 0)) * 3600 + +m[2] * 60 + +m[3] + (m[4] ? +m[4] / 10 ** m[4].length : 0), step: m[4] ? 10 ** -m[4].length : 1 });
  for (const m of t.matchAll(/(?<![\d:.])(\d{1,3})[.,](\d{1,3})\s*s(?:ec(?:onds?)?)?\b/g)) out.push({ at: m[0], s: +m[1] + +m[2] / 10 ** m[2].length, step: 10 ** -m[2].length });
  return out;
}
// a run timed by the gate, read back: a reading is right when the run's real length falls inside what it shows (its step, plus 0.3 s for the press)
const timedRun = (t) => { const [a = '', ms = '', c = ''] = String(t || '').split(TIMED); const real = +ms / 1000; return { real, ok: Number.isFinite(real) && real > 0 ? clockReadings(a).filter((r) => r.s > 0 && r.s - 0.3 <= real && real <= r.s + r.step + 0.3) : [], later: c }; };
/** what a run of presses puts between each reading of the page (tower-gate.mjs answer, `presses`): the page before, then after each press */
export const FLIPPED = '␞ after a flip ␞';
/** the side a page shows in its text: the one short line naming heads or tails alone (no digits: "Heads 3 · Tails 1" is a count), or null. Pure. */
export function sideOf(text) {
  const seen = new Set();
  for (const l of String(text || '').split('\n').map((x) => x.trim())) { if (!l || l.length > 30 || /\d/.test(l)) continue; const h = /\bheads\b/i.test(l), t = /\btails\b/i.test(l); if (h !== t) seen.add(h ? 'heads' : 'tails'); }
  return seen.size === 1 ? [...seen][0] : null;
}
/** a running count in a page's text ("Heads 3 · Tails 1", "heads: 3 tails: 1"): { h, t }, or null. Pure. */
export function countOf(text) { const m = String(text || '').match(/\bheads\s*:?\s*([\d,]+)[^\n\d]{0,12}?\btails\s*:?\s*([\d,]+)/i); return m ? { h: +m[1].replace(/,/g, ''), t: +m[2].replace(/,/g, '') } : null; }
/** a run of presses read back: { sides: the side after each press (null where none could be read), before, after: the counts }. Pure. */
export function flipsOf(text) { const [before = '', ...after] = String(text || '').split(FLIPPED); return { sides: after.map(sideOf), before: countOf(before), after: after.length ? countOf(after[after.length - 1]) : null }; }
/** how many of the [label, check] items a measurement (an object, not text) passes, the same shape as score(). Pure. */
export function scoreOf(m, items) { const has = [], missing = []; for (const [label, f] of items || []) { let ok = false; try { ok = !!f(m); } catch (_) { ok = false; } (ok ? has : missing).push(label); } return { n: has.length, of: has.length + missing.length, has, missing }; }
const everyone = (f) => (t) => { const ps = peopleIn(t); return ps.length > 0 && ps.every(f); };

// the clock times in a text, as minutes after midnight: "9:05 PM", "21:05", "9:05:07 pm", "09:05" (a time with no AM or PM read as 24-hour). Pure.
export function timesIn(text) {
  const out = []; for (const m of String(text || '').matchAll(/(?<![\d:])(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([ap])\.?\s?m\.?\b)?/gi)) { let h = +m[1]; const mi = +m[2]; if (mi > 59) continue;
    if (m[3]) { if (h < 1 || h > 12) continue; h = (h % 12) + (/p/i.test(m[3]) ? 12 : 0); } else if (h > 23) continue; out.push(h * 60 + mi); }
  return out;
}
/** Tokyo's wall clock now, from the zone rules (UTC+9, no daylight saving since 1951): { min (after midnight), day, month (its English name) }. Pure. */
export function tokyoNow(now = new Date()) { const t = new Date(now.getTime() + 9 * 3600000); return { min: t.getUTCHours() * 60 + t.getUTCMinutes(), day: t.getUTCDate(), month: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][t.getUTCMonth()] }; }

export const PROBES = Object.freeze({
  'is it': {
    site: 'https://isitchristmas.com/', verse: '/is-it/christmas',
    truth: () => [[christmas() ? 'yes on Christmas Day' : 'no on any other day', christmas() ? /\bYES\b/i : /\bNO\b/i]],
    facts: [['the answer', /\b(?:YES|NO)\b/], ['which day it is about', /christmas/i], ['how long until it', /\b\d+\s+(?:days?|sleeps?)\b/i], ['the date itself', /\b25\b.*\bdec|\bdec\w*\s+25\b/i]],
  },
  'coin flip': {
    site: 'https://justflipacoin.com/', verse: '/flip/',
    // one flip has no right answer, but ten have a right SHAPE: the gate presses each page's own flip control 10 times, as a person would
    // (tower-gate.mjs answer, `presses`), and reads the page each time it settles: every flip lands on one side, a fair coin shows both
    // sides in 10 (all ten alike is 2 in 1024), and any running count the page keeps grows by exactly the flips made, heads by the heads seen
    ask: { site: 'https://justflipacoin.com/', verse: '/flip/', presses: 10 },
    truth: [['every flip lands on one side, heads or tails', (t) => { const f = flipsOf(t); return f.sides.length > 0 && f.sides.every(Boolean); }],
      ['both sides come up in 10 fair flips', (t) => new Set(flipsOf(t).sides.filter(Boolean)).size === 2],
      ['any count it shows adds up to the flips made', (t) => { const f = flipsOf(t); if (!f.after) return f.sides.length > 0; const b = f.before || { h: 0, t: 0 }, dh = f.after.h - b.h, dt = f.after.t - b.t;
        return dh + dt === f.sides.length && dh === f.sides.filter((s) => s === 'heads').length; }]],
    // the flip itself, seen: the screen the gate records while a flip lands (tower-gate.mjs motionOf); a page that swaps a word or a picture
    // repaints once or twice, a coin that turns repaints frame after frame
    motion: { 'flip animation': [['the coin moves between the tap and where it lands', (m) => m.frames >= 8]] },
    facts: [['heads or tails', /\b(?:heads|tails)\b/i], ['a flip control', /\bflip\b/i], ['a running count', /\b\d+\s+(?:flips?|heads|tails)\b|\bheads\s*:?\s*\d+|\btails\s*:?\s*\d+/i]],
  },
  'random number': {
    // the integer tool itself (random.org's home page holds its generator in a frame the gate cannot read): the form a person fills in
    site: 'https://www.random.org/integers/', verse: '/random/?min=1&max=100',
    // a random number has no right answer, but a right SHAPE: asked for 10 integers from 1 to 100, one a line, exactly 10 come back, every one in range
    ask: { site: 'https://www.random.org/integers/?num=10&min=1&max=100&col=1&base=10&format=plain&rnd=new', verse: '/random/?min=1&max=100&n=10&cols=1' },
    truth: () => [['10 integers, one a line, every one from 1 to 100', { test: (t) => { // an unbroken run of exactly 10 lines that are each a bare integer (a menu of numbers elsewhere on the page is its own run)
      const runs = [[]]; for (const l of String(t).split('\n').map((x) => x.trim())) { if (/^-?\d+$/.test(l)) runs[runs.length - 1].push(+l); else if (runs[runs.length - 1].length) runs.push([]); }
      return runs.some((r) => r.length === 10 && r.every((x) => x >= 1 && x <= 100)); } }]],
    facts: [['a range', /\bmin(?:imum)?\b[\s\S]{0,120}\bmax|\bfrom\b[\s\S]{0,60}\bto\b|\bbetween\b[\s\S]{0,40}\band\b/i], ['how many', /\bhow many\b|\bgenerate\s+\d+|\bnumber of\b/i],
      ['no repeats', /\bno repeats?\b|\bunique\b|\bwithout repe/i], ['sorted', /\bsort/i], ['pick from a list', /\blist\b/i], ['shuffle', /\bshuffle\b|\brandomi[sz]e (?:a |the )?(?:list|sequence)\b|\bsequence\b/i],
      ['a generate control', /\b(?:generate|get numbers|new number|pick one|roll)\b/i], ['a link that keeps the setting', /\bcopy link\b|\bpermalink\b|\bshare\b|\bbookmark\b/i],
      ['number base', /\bbase\b|\bbinary\b|\bhexadecimal\b|\boctal\b/i], ['columns', /\bcolumns?\b/i]],
  },
  colour: {
    site: 'https://www.color-hex.com/color/ff5733', verse: '/color/?c=ff5733',
    // #ff5733 worked out by hand: rgb 255 87 51; hsl hue 11, saturation 100%, lightness 60%; cmyk 0 66 80 0
    truth: () => [['the hex', /#?ff5733/i], ['RGB 255, 87, 51', /255\D{1,4}87\D{1,4}51\b/], ['HSL 11°, 100%, 60%', /\b11\D{1,4}100\s*%?\D{1,4}60\s*%/], ['CMYK 0, 66, 80, 0', /\b0\s*%?\D{1,4}66\s*%?\D{1,4}80\s*%?\D{1,4}0\b/]],
    facts: [['RGB', /\brgb\b/i], ['HSL', /\bhsl\b/i], ['HSV or HSB', /\bhs[vb]\b/i], ['CMYK', /\bcmyk\b/i], ['CIE Lab', /\blab\b|\bcie\b/i], ['shades', /\bshades?\b/i], ['tints', /\btints?\b/i], ['tones', /\btones?\b/i],
      ['complementary', /\bcomplement/i], ['triadic', /\btriad/i], ['analogous', /\banalog/i], ['text contrast', /\bcontrast\b|\bwcag\b/i], ['a colour name', /\b(?:name|tomato|orange|red)\b/i]],
  },
  'colour codes': {
    site: 'https://hexcolor16.com/ff5733', verse: '/color/?c=ff5733',
    truth: () => PROBES.colour.truth(), facts: null, // the colour floor's facts (below)
  },
  gradient: {
    site: 'https://www.colorzilla.com/gradient-editor/', verse: '/gradient/',
    // the same gradient put to both in the address (ColorZilla's own hash: colour+position stops, top to bottom; Verse's packed link at 180deg,
    // which is "to bottom"): the CSS each writes must hold every stop's exact colour at its exact position, in order, and the direction
    ask: { site: 'https://www.colorzilla.com/gradient-editor/#1e5799+0,2989d8+50,207cca+51,7db9e8+100', verse: '/gradient/#l180-1e5799ff.0-2989d8ff.50-207ccaff.51-7db9e8ff.100' },
    truth: [['the four stops, exact and in order', /linear-gradient\([^)]*#1e5799\s+0%\s*,\s*#2989d8\s+50%\s*,\s*#207cca\s+51%\s*,\s*#7db9e8\s+100%/i], ['top to bottom', /linear-gradient\(\s*(?:to bottom|180deg)\s*,\s*#1e5799/i]],
    facts: [['linear', /\blinear\b/i], ['radial', /\bradial\b/i], ['conic', /\bconic\b/i], ['opacity', /\bopacity\b/i], ['presets', /\bpresets?\b/i], ['import CSS', /\bimport\b|\bpaste\b/i],
      ['reverse', /\breverse\b/i], ['hue and saturation', /\bhue\b/i], ['SCSS', /\bscss\b/i], ['from a picture', /\b(?:image|picture)\b/i], ['text contrast', /\bcontrast\b|\bwcag\b/i], ['CSS output', /background(?:-image)?\s*:\s*(?:linear|radial|conic)-gradient/i]],
  },
  wheel: {
    site: 'https://wheelofnames.com/', verse: '/wheel/',
    // one spin of the same eight names on both (a tap at the wheel's centre): a winner is announced, and it is one of the names the wheel
    // held before the spin; after it, a way to remove the winner is offered (wheelofnames.com's dialog, Verse's button)
    ask: { site: 'https://wheelofnames.com/', verse: '/wheel/#' + Buffer.from(WHEEL_NAMES.join('\n')).toString('base64url'), spin: true },
    truth: [['announces a winner', (t) => /winner/i.test(spun(t).after)], ['the winner is one of the wheel\'s own names', (t) => { const { after, before } = spun(t), names = new Set(before.split('\n').map((l) => l.trim()).filter((l) => l && l.length <= 40));
      return after.split('\n').some((l) => { const x = l.replace(/^.*\bwinner(?:\s+is)?\s*:?\s*/i, '').replace(/[!.]+$/, '').trim(); return !!x && names.has(x); }); }]],
    askParts: { 'remove the winner': [['a way to remove the winner', (t) => /remove/i.test(spun(t).after)]] },
    facts: [['an entries list', /\bentries\b|\bnames\b/i], ['spin', /\bspin\b/i], ['shuffle', /\bshuffle\b/i], ['sort', /\bsort\b/i], ['results', /\bresults?\b|\bwinners?\b/i],
      ['a share link', /\bshare\b|\bcopy link\b/i], ['weights', /\bweights?\b|times as likely/i], ['says it is fair', /\bfair\b/i], ['sound control', /\bsound\b|\bmute\b/i]],
  },
  'random user': {
    site: 'https://randomuser.me/', verse: '/random-user/',
    // the same request to both in the address (randomuser.me's own API, Verse's page as JSON): made-up people are accurate when they hold
    // together, which can be checked: as many as asked, from the country asked, each age right for its birthday, each email well formed,
    // and each phone in the range set aside for fiction (555-0100 to 555-0199), so a test that dials one reaches nobody
    ask: { site: 'https://randomuser.me/api/?results=5&nat=us&seed=verse', verse: '/random-user/?n=5&nat=us&seed=verse&fmt=json' },
    truth: [['five people, as asked', (t) => peopleIn(t).length === 5], ['all from the United States, as asked', everyone((p) => p.country === 'United States')],
      ['every age right for its birthday', everyone((p) => Number.isFinite(p.age) && p.age === ageOn(p.dob))], ['every email well formed', everyone((p) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(p.email)))],
      ['every phone in the range reserved for fiction', everyone((p) => /555-01\d\d$/.test(String(p.phone)))]],
    facts: [['names', /\bnames?\b/i], ['emails', /\bemails?\b|@/i], ['phones', /\bphones?\b/i], ['addresses', /\baddress|\bstreet\b|\bcity\b/i], ['birthdays', /\bbirthday|\bdob\b|date of birth/i],
      ['passwords', /\bpasswords?\b/i], ['pictures', /\bpictures?\b|\bphotos?\b|\bavatars?\b/i], ['gender', /\bgender\b/i], ['nationality', /\bnationalit|\bcountr/i], ['a seed', /\bseed\b/i],
      ['JSON', /\bjson\b/i], ['CSV', /\bcsv\b/i], ['XML', /\bxml\b/i], ['YAML', /\byaml\b/i], ['SQL', /\bsql\b/i]],
  },
  // three floors measured through Verse's ask: the site gets the same words typed into its own box (tower-gate.mjs `type`), Verse gets the ask
  stopwatch: {
    site: 'https://www.online-stopwatch.com/', verse: '/stopwatch/',
    // the same question to both: started, run for 3 s by the gate's own clock, stopped, read; then read again 1.5 s later
    ask: { site: 'https://www.online-stopwatch.com/', verse: '/stopwatch/', time: 3000 },
    truth: () => [['the time shown is the real length of the run, to its last digit plus 0.3 s', { test: (t) => timedRun(t).ok.length > 0 }],
      ['it holds still once stopped', { test: (t) => { const r = timedRun(t); return r.ok.some((x) => r.later.includes(x.at)); } }]],
    // what a full stopwatch-and-timer page offers (online-stopwatch.com's own: stopwatch, countdown, laps, alarm, presets, full screen)
    facts: [['stopwatch', /\bstopwatch\b/i], ['countdown timer', /\bcountdown\b/i], ['laps', /\blaps?\b/i], ['fastest and slowest lap', /\bfastest\b[\s\S]{0,80}\bslowest\b/i], ['alarm', /\balarm\b/i],
      ['presets', /\b(?:1|3|5|10|15|25)\s*min\b/i], ['keyboard shortcuts', /\bspace\b[\s\S]{0,40}\b(?:start|stop)/i], ['pause and resume', /\bpause|\bresume|\bstop\b/i], ['share a timer', /\bcopy link\b|\bshare\b/i], ['keeps time in a background tab', /background tab|never (?:makes it )?drift/i]],
  },
  'word count': {
    site: 'https://wordcounter.net/', verse: '/word-count/',
    ask: { site: 'https://wordcounter.net/', type: WC_TEXT, verse: '/word-count/?t=' + encodeURIComponent(WC_TEXT) },
    // what wordcounter.net's own page counts and offers (its Details box, keyword density, auto-save, share)
    facts: [['words', /\bwords\b/i], ['characters', /\bcharacters\b/i], ['sentences', /\bsentences\b/i], ['paragraphs', /\bparagraphs\b/i], ['reading level', /\breading level\b/i],
      ['reading time', /\breading time\b/i], ['speaking time', /\bspeaking time\b/i], ['keyword density', /\bkeyword density\b/i], ['auto-save', /\bauto-?save\b/i], ['share', /\bshare\b|\bcopy link\b/i]],
    truth: [['13 words', /(?<![\d,])13\s+words?\b|\bwords?\s*:?\s*13(?![\d,])/i], ['63 characters', /(?<![\d,])63\s+characters?\b|\bcharacters?\s*:?\s*63(?![\d,])/i]],
  },
  'unit converter': {
    site: 'https://www.unitconverters.net/', verse: '/convert/',
    // the same question to both: 100 typed into the site's Celsius-to-Fahrenheit box, and the same words in Verse's page link (its ask box reads them)
    ask: { site: 'https://www.unitconverters.net/temperature/celsius-to-fahrenheit.htm', type: '100', box: true, verse: '/convert/?q=' + encodeURIComponent('100 c to f') },
    truth: [['212 °F', /(?<![\d.])212(?:\.0+)?(?![\d.])\s*(?:°\s*F|degrees? fahrenheit|fahrenheit)?/i]],
    // what a full converter page shows: unitconverters.net's own kinds (its common converters and its engineering groups: heat, fluids, light,
    // electricity, magnetism, radiology), and what its conversion pages add: a swap, the formula ("how to convert"), the result's precision
    facts: [['common converters', /\bcommon\b/i], ['length', /\blength\b/i], ['temperature', /\btemperature\b/i], ['area', /\barea\b/i], ['volume', /\bvolume\b/i], ['weight or mass', /\bweight\b|\bmass\b/i],
      ['time', /\btime\b/i], ['speed', /\bspeed\b|\bvelocity\b/i], ['pressure', /\bpressure\b/i], ['energy', /\benergy\b/i], ['power', /\bpower\b/i], ['force', /\bforce\b/i], ['data storage', /\bdata\b/i],
      ['angle', /\bangle\b/i], ['fuel consumption', /\bfuel\b/i], ['frequency', /\bfrequency\b/i], ['engineering', /\bengineering\b/i], ['heat', /\bheat\b/i], ['fluids', /\bfluids?\b|\bflow\b/i], ['light', /\blight\b|\billumin/i],
      ['electricity', /\belectric/i], ['magnetism', /\bmagnet/i], ['radiology', /\bradiolog|\bradiation\b/i], ['a swap or reverse control', /\bswap\b|\breverse\b|⇄|↔/i],
      ['the formula', /\bformula\b|how (?:it is|to) convert/i], ['precision', /\bprecision\b|\bsignificant digits\b|\bdecimal places\b/i]],
  },
  encoder: {
    site: 'https://www.base64encode.org/', verse: '/base64/',
    // Verse's own page (/base64/) takes the same text in its link; the site gets it typed into its box
    ask: { site: 'https://www.base64encode.org/', type: 'hello', box: true, verse: '/base64/?t=hello' },
    truth: [['aGVsbG8=', /aGVsbG8=/]],
    // what the best encoder pages offer (base64encode.org and base64decode.org: a character set, a newline choice, URL-safe output, lines of 76,
    // live encoding as you type, files; the best apps add decoding on the same page, copy and download)
    facts: [['encoding', /\bencod/i], ['decoding', /\bdecod/i], ['a character set choice', /\bchar(?:acter)?\s?sets?\b|\bcharset\b|\butf-?8\b/i], ['URL-safe Base64', /url[\s-]?safe|base64url/i],
      ['lines of 76 characters', /\b76\b/], ['the newline form', /\bnewline\b|\bline\s?breaks?\b|\bCRLF\b|\bLF\b/i], ['encoding as you type', /\blive\b|as you type/i], ['files', /\bfiles?\b/i], ['copy', /\bcopy\b/i], ['download', /\bdownload\b/i]],
  },
  'password strength': {
    site: 'https://www.howsecureismypassword.net/', verse: '/password-strength/',
    // the page never carries a password in its address (its own rule: nothing typed goes in a link), so the gate types the question into its box
    // (`verseType`). The question: qwerty123, at the head of every leaked list. The truth any correct checker agrees on: it is very weak, cracked
    // at once from a stolen list (a rig trying 10 billion a second needs far fewer), the word qwerty and the run 123 are why, and longer is the fix
    ask: { site: 'https://www.howsecureismypassword.net/', verse: '/password-strength/', verseType: 'qwerty123' },
    truth: [['rated very weak', /\bvery weak\b/i], ['cracked instantly', /\binstantly\b/i], ['the common password qwerty named', /\bqwerty\b/i], ['the run 123 named', /\b123\b/i], ['the fix: make it longer', /\blonger\b/i]],
    // the floor's own aspects, read off the same typed answer: a time at a login and a time from a stolen list; why it is weak and how to fix it
    askParts: { 'crack time': [['a time from a stolen list, offline', /\boffline\b|stolen list/i], ['a time at a login, online', /\blogin\b|\bonline\b/i]],
      'reasons and fixes': [['why it is weak', /\bcontains\b|looks like|follows the keys|first things|among the first/i], ['how to fix it', /make it longer|do not build|leave out|put more|unrelated words/i]] },
    // what the best checkers show (howsecureismypassword.net's time to crack and its rating; the best add the reasons, the fixes, a leak check, and say nothing leaves the device)
    facts: [['a strength rating', /\b(?:very weak|weak|fair|strong|very strong)\b|\bstrength\b/i], ['the time to crack', /\bcrack/i], ['why it is weak', /\bwhy\b|\breasons?\b/i], ['how to fix it', /\bfix\b|\btips?\b|\bimprove\b/i],
      ['a leak check', /\bleak|\bbreach|\bpwned\b/i], ['nothing sent anywhere', /never sent|not sent|on (?:this|your) device|in your browser/i], ['show the password', /\bshow\b/i]],
  },
  translate: {
    site: 'https://translate.google.com/', verse: '/translate/?q=hello&to=es',
    // the question: hello, into Spanish, in the page's link. The truth: hola (any correct translator agrees), with the language it came from named.
    // Judged on Verse alone (the site is not asked); the same probe measures every site in the translate lane (lib/tower.js LANES)
    ask: { verse: '/translate/?q=hello&to=es' },
    truth: [['hola', /\bhola\b/i], ['the language it came from, detected', /\bdetected\b|\berkannt\b|\bEnglish\b/i]],
    askParts: { 'language count': [['100 languages', /\b100 (?:languages|Sprachen)\b/i]], 'speech in and out': [['listen', /\blisten\b|\banhören\b/i], ['speak', /\bspeak\b|\bsprechen\b/i]], 'camera text': [['camera', /\bcamera\b|\bkamera\b/i], ['a photo', /\bphoto\b|\bfoto\b/i]] },
    // what the best translators show: the language detected, 100 or more languages, listen and speak, a camera, copy, share, a history and saved phrases, offline
    facts: [['the language detected', /detect/i], ['100 languages', /\b100 languages\b/i], ['listen', /\blisten\b/i], ['speak', /\bspeak\b/i], ['camera', /\bcamera\b/i], ['copy', /\bcopy\b/i], ['share', /\bshare\b/i], ['a history', /\bhistory\b/i], ['saved phrases', /\bsaved\b|\bphrasebook\b/i], ['works offline', /\boffline\b/i]],
  },
  recipes: {
    site: 'https://www.allrecipes.com/', verse: '/recipes/?q=pancakes',
    // the question: pancakes, in the page's link. The truth any correct pancake recipe agrees on (worked out by hand, lib/recipes.js BUILT_IN):
    // flour, an egg and milk among the ingredients, how many it serves, and the steps numbered. Judged on Verse alone (the site is not asked);
    // the same probe measures every site in the recipes lane (lib/tower.js LANES)
    ask: { verse: '/recipes/?q=pancakes' },
    truth: [['flour', /\bflour\b|\bMehl\b/i], ['an egg', /\begg\b|\beggs\b|\bEi\b|\bEier\b/i], ['milk', /\bmilk\b|\bMilch\b/i], ['how many it serves', /\bservings?\b|\bserves\b|\bPortionen\b/i], ['the steps numbered', /\bstep 1\b|\bschritt 1\b|(?:^|\n)\s*1\.\s/i]],
    askParts: { 'search by ingredient': [['search by ingredient', /by ingredient|\bingredients?\b|nach Zutat/i]], scaling: [['servings to scale', /\bservings?\b|\bscale\b|\bPortionen\b/i]], 'step mode': [['one step at a time', /step mode|one step|Schritt-Modus/i]] },
    // what the best recipe pages show (Allrecipes' ingredients, directions, servings, time and photo; the best add a servings scaler, a unit swap, a
    // cook mode with its timers, a shopping list, search by what you have, a share link, a history, print, and open offline). TheMealDB and the
    // built-in dozen carry no nutrition numbers, so none is claimed here
    facts: [['ingredients', /\bingredients\b/i], ['the steps', /\bsteps?\b|\bdirections\b|\binstructions\b/i], ['servings', /\bservings?\b/i], ['the time it takes', /\bready in\b|\bminutes\b|\bprep time\b|\btotal time\b/i],
      ['a servings scaler', /\bservings\b[\s\S]{0,40}[−+-]|\bscale\b|\badjust\b/i], ['metric and US units', /\bmetric\b/i], ['a step mode', /step mode|cook mode|one step/i], ['timers', /\btimers?\b/i], ['a shopping list', /\bcopy list\b|\bshopping list\b|\btick\b/i],
      ['search by ingredient', /by ingredient|what can i make/i], ['a share link', /\bshare\b/i], ['a history', /\bhistory\b/i], ['print', /\bprint\b/i], ['works offline', /\boffline\b/i]],
  },
  weather: {
    site: 'https://www.weather.gov/', verse: '/weather/?q=Boston',
    // the question: the weather in Boston, in the page's link. The truth needs no second forecast: a right answer names the place, shows every
    // temperature in °F and °C that agree with each other (F = C × 9/5 + 32), starts the days ahead with today in Boston's own zone, names
    // the hours ahead, and gives sunrise and sunset. Judged on Verse alone (the site is not asked)
    ask: { verse: '/weather/?q=Boston' },
    truth: () => [['the place asked for', /\bBoston\b/],
      ['a temperature in °F and °C that agree', (t) => { const ps = [...String(t).matchAll(/(-?\d+) °F \/ (-?\d+) °C/g)]; return ps.length > 0 && ps.every((m) => Math.abs(+m[1] - (+m[2] * 9 / 5 + 32)) <= 1.5); }],
      ['today first in the days ahead', (t) => { const m = String(t).match(/\b(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\b/); return !!m && m[1] === new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/New_York' }).format(new Date()); }],
      ['the hours ahead named', /\b\d{1,2}(?:am|pm)\b/i], ['sunrise and sunset', (t) => /\bsunrise\b/i.test(t) && /\bsunset\b/i.test(t)]],
    askParts: { 'hourly and daily forecast': [['the next 24 hours', /next 24 hours|\bhourly\b/i], ['the 7 days ahead', /7 days ahead|\bdaily\b/i]], alerts: [['alerts', /\balerts?\b/i]], radar: [['radar', /\bradar\b/i]] },
    // what the best weather pages show (weather.gov's conditions, hourly and 7-day forecasts, alerts and radar; the best add both scales, feels like,
    // humidity, wind, the chance of rain, sunrise and sunset, and a link to share)
    facts: [['conditions now', /\bnow\b/i], ['°F', /°\s?F\b/], ['°C', /°\s?C\b/], ['feels like', /feels like/i], ['humidity', /\bhumidity\b/i], ['wind', /\bwind\b/i], ['the chance of rain', /chance of rain|\bprecipitation\b|\bprobab/i],
      ['sunrise and sunset', /\bsunrise\b|\bsunset\b/i], ['an hourly forecast', /\bhourly\b|next 24 hours/i], ['a daily forecast', /\bdaily\b|days ahead|7.day|extended forecast/i], ['alerts', /\balerts?\b/i], ['radar', /\bradar\b/i], ['a share link', /\bshare\b|copy link/i]],
  },
  'photo resizer': {
    site: 'https://pancardresizer.com/', verse: '/resize-image/',
    // the page answers once a picture is put in, so the gate chooses its own one-pixel PNG (tower-gate.mjs PIXEL) with the size in the link: the
    // PAN card photo, 3.5 by 2.5 cm at 200 dpi under 50 KB. The truth by arithmetic: 3.5 cm is 3.5 / 2.54 inches, times 200 dots, 276 pixels;
    // 2.5 cm is 197; a one-pixel picture resized to that is far under 50 KB, so the limit is met and the quality chosen is the highest that fits
    ask: { site: 'https://pancardresizer.com/', verse: '/resize-image/?w=3.5&h=2.5&u=cm&dpi=200&kb=50', verseFile: true },
    truth: [['3.5 by 2.5 cm at 200 dpi is 276 by 197 pixels', /\b276\s*[×x]\s*197\s*px\b/], ['the file is under the 50 KB limit', /\bKB \(limit 50 KB\)/], ['the JPEG quality chosen, the highest that fits', /\bquality \d+%/i]],
    askParts: { 'exact size': [['the pixel size made', /\b\d+\s*[×x]\s*\d+\s*px\b/]], 'size limit': [['the file size against the limit', /\bKB\b[^\n]*\blimit\b/i]], pdf: [['a PDF to download', /\bpdf\b/i]] },
    // what the best resizers show (pancardresizer.com's fixed card size and KB limit; the best take any size in cm, mm, inches or pixels, a dpi, a
    // JPEG or a PDF back, crop or keep the whole picture, a signature too, nothing uploaded, and a link that carries the size)
    facts: [['a size in cm', /\bcm\b/], ['in mm', /\bmm\b/], ['in inches', /\binch/i], ['in pixels', /\bpixels?\b|\bpx\b/i], ['a resolution in dpi', /\bdpi\b/i], ['a size limit in KB', /\bKB\b/],
      ['a JPEG', /\bjpe?g\b/i], ['a PDF', /\bpdf\b/i], ['crop or keep the whole picture', /\bcrop\b|whole picture/i], ['a signature too', /\bsignature\b/i], ['nothing uploaded', /never uploaded|nothing is uploaded|on (?:this|your) device/i], ['a share link', /\bshare\b/i]],
  },
  'base converter': {
    site: 'https://hextobinary.com/', verse: '/base-converter/?v=ff&b=16',
    // hextobinary.com's address cannot carry a number, so the gate types it into the converter's box (`type`), as a person would; Verse takes it
    // in the link. The question: a 31-digit hex number (121 bits), past what a double holds exactly (53 bits); the truth is computed with BigInt
    ask: { site: 'https://hextobinary.com/convert/hex', type: HUGE.toString(16), verse: '/base-converter/?v=' + HUGE.toString(16) + '&b=16' },
    truth: [['the exact binary', exact(HUGE.toString(2))], ['the exact decimal', exact(HUGE.toString(10))]],
    askParts: { 'huge numbers': [['all 121 binary digits', exact(HUGE.toString(2))], ['all 37 decimal digits', exact(HUGE.toString(10))], ['all 41 octal digits', exact(HUGE.toString(8))]] },
    facts: [['binary', /\bbinary\b/i], ['decimal', /\bdecimal\b/i], ['hexadecimal', /\bhex/i], ['octal', /\boctal\b/i]],
  },
  calculator: {
    site: 'https://www.calculator.net/', verse: '/calculator/',
    // accuracy is Verse against the worked-out answer (owner, 2026-10-25: the rival is not driven): the floor's own ask in the page's link, its result read
    ask: { verse: '/calculator/?q=' + encodeURIComponent('17% of 240') },
    truth: [['40.8', /(?<![\d.])40\.8(?![\d.])/]],
    // what a full scientific calculator offers: calculator.net's own pad (the four operations, brackets, powers, roots, trig and its inverse in
    // degrees or radians, ln and log, pi, n!, %, memory, Ans, EXP, the sign key) and the history and keyboard input the best apps add
    facts: [['the four operations', /[×*][\s\S]{0,200}[÷/]|[÷/][\s\S]{0,200}[×*]/], ['brackets', /\([\s\S]{0,80}\)/], ['powers', /x\s*[ʸ^y²³]|\bpowers?\b/i], ['roots', /√|\broots?\b/i],
      ['sin, cos and tan', /\bsin\b[\s\S]{0,80}\bcos\b[\s\S]{0,80}\btan\b/i], ['inverse trig', /sin\s*(?:⁻¹|-1|\^-1)|\basin\b|\barcsin\b/i], ['degrees and radians', /\bdeg(?:rees?)?\b[\s\S]{0,80}\brad(?:ians?)?\b/i],
      ['logarithms', /\bln\b[\s\S]{0,80}\blog\b|\blog\b[\s\S]{0,80}\bln\b/i], ['pi', /π|\bpi\b/i], ['factorial', /n!|\bfactorial\b/i], ['percent', /%/],
      ['memory', /\bM\+[\s\S]{0,60}\bMR\b|\bMR\b[\s\S]{0,60}\bM\+|\bmemory\b/i], ['last answer', /\bAns\b/], ['exponent entry', /\bEXP\b|×\s*10/], ['change sign', /±|\+\/[-−]/],
      ['history of results', /\bhistory\b/i], ['keyboard input', /\bkeyboard\b/i]],
  },
  password: {
    // both pages make a password as they open (passwordsgenerator.net's default is 16 characters of every class; Verse's link asks for the same);
    // a random password has no right answer, but a right SHAPE: a 16-character word with an uppercase, a lowercase, a digit and a symbol among the
    // page's text (the gate reads a box's value too), and the exact entropy of 16 characters from all 94: log2(94^16) = 104.9 bits (104.6 with one of
    // each class required), which only a page that counts its own space can show
    site: 'https://passwordsgenerator.net/', verse: '/password/?len=16&upper=1&lower=1&digits=1&symbols=1',
    truth: [['a 16-character password with an uppercase, a lowercase, a digit and a symbol', (t) => String(t).split(/\s+/).some((w) => w.length === 16 && /[A-Z]/.test(w) && /[a-z]/.test(w) && /[0-9]/.test(w) && /[^A-Za-z0-9]/.test(w))],
      ['the entropy of 16 characters from all four classes, 104.6 to 104.9 bits', /\b104\.[6-9]\s*bits\b/i]],
    // what passwordsgenerator.net's page shows (a length, the four classes, its two exclusions, made on the device, a generate and a copy control, a
    // "remember" line that reads the password as words) and what the best generators add (passphrases, several at once, no repeats or sequences, a
    // strength with its bits and crack time, offline, a link that keeps the setting)
    facts: [['a length', /\blength\b/i], ['uppercase', /\buppercase\b|\bupper case\b/i], ['lowercase', /\blowercase\b|\blower case\b/i], ['numbers', /\bnumbers?\b|\bdigits?\b/i], ['symbols', /\bsymbols?\b|\bspecial characters?\b/i],
      ['exclude similar characters', /\bsimilar\b/i], ['exclude ambiguous characters', /\bambiguous\b/i], ['made on the device', /on (?:your|this) device|never sent|nothing (?:is )?sent|not sent/i], ['a generate control', /\bgenerate\b/i], ['copy', /\bcopy\b/i],
      ['a way to remember it', /\bremember\b|\bmnemonic\b/i], ['passphrases', /\bpassphrase\b/i], ['several at once', /\bhow many\b|\bat once\b|\bbulk\b|\bmultiple\b/i], ['no repeated characters', /\brepeat/i], ['no sequential characters', /\bsequential\b|\bin a row\b/i],
      ['strength', /\bstrength\b|\bvery strong\b|\bweak\b/i], ['entropy in bits', /\bentropy\b|\bbits\b/i], ['time to crack', /\bcrack\b|\bguesses\b/i], ['works offline', /\boffline\b/i], ['a link that keeps the setting', /\bcopy link\b|\bpermalink\b|\bshare\b|\bsave my preference\b/i]],
  },
  'time zones': {
    site: 'https://www.timeanddate.com/', verse: '/time/?c=Tokyo',
    // the same question to both: Tokyo's own page on each; the truth is worked out here, at the moment the answer is read, from the zone rules
    // (Japan keeps UTC+9 all year, no daylight saving): the wall clock in Tokyo to the minute (2 minutes either way for the read), the day, the offset
    ask: { site: 'https://www.timeanddate.com/worldclock/japan/tokyo', verse: '/time/?c=Tokyo' },
    truth: () => [['the time in Tokyo now, to the minute', { test: (t) => { const n = tokyoNow(); return timesIn(t).some((m) => Math.min(Math.abs(m - n.min), 1440 - Math.abs(m - n.min)) <= 2); } }],
      ["Tokyo's date today", { test: (t) => { const n = tokyoNow(); return new RegExp('\\b' + n.month + '\\s+' + n.day + '\\b|\\b' + n.day + '\\.?\\s+' + n.month + '\\b', 'i').test(t); } }],
      ['UTC+9', /\b(?:UTC|GMT)\s*\+\s*0?9(?![\d:])/i]],
    // what the best time-zone pages show for a city (timeanddate.com's city page and world clock, its converter and meeting planner)
    // (day length and solar noon are in timeanddate.com's own Tokyo page, beside sunrise and sunset; twilight, golden hour, the moon, date to date and
    // the event announcer are on its other pages, not this one, so they are not facts here: the site would be undercounted)
    facts: [['the time now', /\b\d{1,2}:\d{2}(?::\d{2})?\b/], ['the date', /\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b/i], ['the time zone', /\btime ?zones?\b/i], ['the UTC offset', /\b(?:UTC|GMT)\s*[+−-]\s*\d/],
      ['daylight saving', /\bdaylight saving\b|\bDST\b/i], ['a world clock', /\bworld ?clock\b/i], ['a converter', /\bconverter\b/i], ['a meeting planner', /\bmeeting planner\b/i],
      ['the difference from you', /\bhours?\s+(?:ahead|behind)\b|\btime difference\b/i], ['sunrise and sunset', /\bsunrise\b|\bsunset\b/i], ['day length', /\bday length\b/i], ['solar noon', /\bsolar noon\b/i], ['a share link', /\bcopy link\b|\bshare\b/i]],
  },
});
// a floor's own named aspects (its `extra` in lib/tower.js), each a list both pages are scored on the same way: how many of the list a page
// shows is its score, and the list's length is the best there is. The colour models are the union of what hexcolor16.com (hex, decimal, RGB,
// CMYK, HSL, HSV, XYZ, CIELab, CIELUV, CIELCh), color-hex.com (Yxy, Hunter Lab) and CSS (HWB, Oklab, OKLCH) list; the palettes are
// hexcolor16.com's three ramps, its six harmonies, the 16 VGA colours and a random colour
const MODELS = [['hex', /\bhex/i], ['decimal', /\bdecimal\b/i], ['RGB', /\brgb\b/i], ['CMYK', /\bcmyk\b/i], ['HSL', /\bhsl\b/i], ['HSV or HSB', /\bhs[vb]\b/i], ['HWB', /\bhwb\b/i],
  ['CIE XYZ', /\bxyz\b/i], ['CIE Yxy', /\byxy\b/i], ['CIELab', /\bcie[\s-]?l\*?a\*?b\*?(?![a-z])/i], ['CIELUV', /(?:\bcie[\s-]?|\b)l\*?u\*?v\*?(?![a-z])/i], ['CIELCh', /(?:\bcie[\s-]?|\b)lch\b/i],
  ['Hunter Lab', /\bhunter[\s-]?lab\b/i], ['Oklab', /\boklab\b/i], ['OKLCH', /\boklch\b/i]];
const PALETTES = [['shades', /\bshades?\b/i], ['tints', /\btints?\b/i], ['tones', /\btones?\b/i], ['monochromatic', /\bmonochromatic\b/i], ['complementary', /\bcomplementary\b/i],
  ['analogous', /\banalogous\b/i], ['triadic', /\btriadic\b/i], ['split-complementary', /\bsplit[\s-]?complement/i], ['tetradic', /\btetradic\b|\brectangle\b/i], ['square', /\bsquare\b/i],
  ['the 16 VGA colours', /\bvga\b/i], ['a random colour', /\brandom\b/i]];
// contrast: the colour floor's own aspect (lib/tower.js extra), whether the page says if text on the colour can be read (WCAG); only floors that list it are scored
const COLOUR_PARTS = Object.freeze({ 'every colour model': MODELS, 'shades and palettes': PALETTES, contrast: [['text contrast', /\bcontrast\b|\bwcag\b/i], ['AA and AAA', /\bAAA?\b/]] });
export const PARTS = Object.freeze({ colour: COLOUR_PARTS, 'colour codes': COLOUR_PARTS,
  gradient: { 'stops with opacity': [['colour stops', /\bstops?\b/i], ['opacity', /\bopacity\b/i]], 'import css': [['import', /\bimport\b|\bpaste\b/i]], presets: [['presets', /\bpresets?\b/i]] },
  'base converter': { 'signed reading': [['a signed reading', /\bsigned\b|two.?s complement/i]], 'all four bases': [['binary', /\bbinary\b/i], ['octal', /\boctal\b/i], ['decimal', /\bdecimal\b/i], ['hexadecimal', /\bhex/i]] },
  'coin flip': { 'flip history': [['a running count', /\b\d+\s+(?:flips?|heads|tails)\b|\bheads\s*:?\s*\d+|\btails\s*:?\s*\d+/i]] },
  translate: { 'language count': [['100 languages', /\b100 languages\b/i]], 'speech in and out': [['listen', /\blisten\b/i], ['speak', /\bspeak\b/i]], 'camera text': [['camera', /\bcamera\b/i]] },
  recipes: { 'search by ingredient': [['search by ingredient', /by ingredient|what can i make/i]], scaling: [['servings to scale', /\bservings?\b|\bscale\b/i]], 'step mode': [['one step at a time', /step mode|cook mode|one step/i], ['timers', /\btimers?\b/i]] },
  encoder: { 'decode too': [['decoding', /\bdecod/i]], 'files and character sets': [['files', /\bfiles?\b/i], ['character sets', /\bchar(?:acter)?\s?sets?\b|\bcharset\b/i]] },
  'password strength': { 'leak check': [['a leak check', /\bleak/i]] }, // crack time and the reasons are read off the typed answer (askParts)
  wheel: { 'entries list': [['entries', /\bentries\b|\bnames\b/i]], weights: [['weights', /\bweights?\b|times as likely/i]] }, // 'remove the winner' shows only after a spin, on both sites: unmeasured,
  'random number': { 'true randomness': [['names where its randomness comes from', /atmospheric noise|\bdrand\b|randomness beacon|getRandomValues|\bhardware\b/i], ['a draw others can check', /\bcheckable\b|\bverifiab|\bre-deriv|\bsigned\b/i]], 'range choice': [['a range', /\bmin(?:imum)?\b[\s\S]{0,120}\bmax|\bfrom\b[\s\S]{0,60}\bto\b|\bbetween\b[\s\S]{0,40}\band\b/i], ['how many', /\bhow many\b|\bgenerate\s+\d+|\bnumber of\b/i], ['no repeats', /\bno repeats?\b|\bunique\b|\bwithout repe/i]] },
  stopwatch: { alarms: [['an alarm', /\balarm\b/i]], laps: [['laps', /\blaps?\b/i]] },
  calculator: { history: [['a history of results', /\bhistory\b/i]], 'unit and scientific modes': [['scientific functions', /\bsin\b[\s\S]{0,80}\bcos\b/i], ['degrees and radians', /\bdeg(?:rees?)?\b[\s\S]{0,80}\brad(?:ians?)?\b/i], ['unit conversion', /\bunit conver|\bconvert\b|\bmiles\b[\s\S]{0,40}\bkm\b/i]] },
  password: { 'length and character choice': [['a length choice', /\blength\b/i], ['uppercase', /\buppercase\b|\bupper case\b/i], ['lowercase', /\blowercase\b|\blower case\b/i], ['numbers', /\bnumbers?\b|\bdigits?\b/i], ['symbols', /\bsymbols?\b|\bspecial characters?\b/i],
    ['exclude similar', /\bsimilar\b/i], ['exclude ambiguous', /\bambiguous\b/i], ['no repeats', /\brepeat/i], ['no sequential', /\bsequential\b|\bin a row\b/i], ['one of each class', /\bone of each\b|\bat least one\b/i], ['passphrases', /\bpassphrase\b/i]],
    'strength shown': [['a strength label', /\bstrength\b|\bvery strong\b|\bstrong\b|\bweak\b/i], ['entropy in bits', /\bentropy\b|\bbits\b/i], ['time to crack', /\bcrack\b|\bguesses\b/i]] },
  'time zones': { 'world time': [['several cities at once', /\bworld ?clock\b/i], ['the UTC offset', /\b(?:UTC|GMT)\s*[+−-]\s*\d/]], 'meeting planner': [['a meeting planner', /\bmeeting planner\b/i], ['the hours that suit everyone', /\bbest time\b|\bworking hours\b/i]] },
  'unit converter': { 'unit breadth': [['length', /\blength\b/i], ['temperature', /\btemperature\b/i], ['area', /\barea\b/i], ['volume', /\bvolume\b/i], ['weight or mass', /\bweight\b|\bmass\b/i], ['time', /\btime\b/i], ['speed', /\bspeed\b|\bvelocity\b/i],
      ['pressure', /\bpressure\b/i], ['energy', /\benergy\b/i], ['power', /\bpower\b/i], ['force', /\bforce\b/i], ['data storage', /\bdata\b/i], ['angle', /\bangle\b/i], ['fuel consumption', /\bfuel\b/i], ['frequency', /\bfrequency\b/i],
      ['heat', /\bheat\b/i], ['fluids', /\bfluids?\b|\bflow\b/i], ['light', /\blight\b|\billumin/i], ['electricity', /\belectric/i], ['magnetism', /\bmagnet/i], ['radiology', /\bradiolog|\bradiation\b/i]],
    'both directions': [['swap', /\bswap\b|\breverse\b|⇄|↔/i], ['from and to', /\bfrom\b[\s\S]{0,60}\bto\b/i]] },
  'word count': { 'live counting': [['counts as you type', /\bas you (?:type|edit)\b/i]], 'characters and sentences': [['characters', /\bcharacters\b/i], ['characters without spaces', /without spaces/i], ['sentences', /\bsentences\b/i], ['paragraphs', /\bparagraphs\b/i]] },
  'random user': { 'output formats': [['JSON', /\bjson\b/i], ['CSV', /\bcsv\b/i], ['XML', /\bxml\b/i], ['YAML', /\byaml\b/i], ['SQL', /\bsql\b/i]], seed: [['a seed', /\bseed\b/i]], nationalities: [['United States', /united states|\bamerican\b/i], ['United Kingdom', /united kingdom|\bbritish\b/i], ['France', /\bfrance\b|\bfrench\b/i], ['Germany', /\bgermany\b|\bgerman\b/i], ['Spain', /\bspain\b|\bspanish\b/i], ['Brazil', /\bbrazil/i], ['India', /\bindia\b|\bindian\b/i], ['Japan', /\bjapan/i]] },
});
/** a floor's probe with its lists resolved for today ({ site, verse, truth, facts, parts }), or null. Pure but for today's date. */
export function probeFor(id) {
  // a lane site ('translate: deepl.com', lib/tower.js LANES) is measured by its lane's probe: the same Verse page, the same truth, that site
  const lane = String(id || '').match(/^(.+?): ([a-z0-9.-]+)$/i);
  const p = PROBES[id] || (lane && PROBES[lane[1]]); if (!p) return null;
  if (lane) id = lane[1];
  return { site: p.site, verse: p.verse, ask: p.ask || null, askParts: p.askParts || {}, motion: p.motion || {}, truth: typeof p.truth === 'function' ? p.truth() : p.truth || null, facts: p.facts || (id === 'colour codes' ? PROBES.colour.facts : []), parts: PARTS[id] || {} };
}
/** how many of the [label, RegExp] items a page's text shows: { n, of, has: [labels], missing: [labels] }. Pure. */
export function score(text, items) {
  const t = String(text || ''), has = [], missing = [];
  for (const [label, re] of items || []) { let ok = false; try { ok = typeof re === 'function' ? !!re(t) : re.test(t); } catch (_) { ok = false; } (ok ? has : missing).push(label); } // a check is a pattern, or a function of the page's text
  return { n: has.length, of: has.length + missing.length, has, missing };
}
