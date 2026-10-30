// The tower gate's accuracy and completeness probes (tools/tower-gate.mjs): for a floor, the same question put to the real site and to Verse
// (owner, 2026-10-24: automate the unmeasured aspects in the head-to-head gate), and what the answer page must show.
//   truth: what a CORRECT answer contains, worked out here independently of both sites (accuracy = how many of these the page shows)
//   facts: what a COMPLETE answer offers, the union of what the best sites in the category show (completeness = how many of these it shows)
// Each is a list of [label, RegExp] read against the page's visible text after it has loaded. A floor without a probe leaves accuracy and
// completeness unverified (never counted as beaten); a probe with truth null leaves accuracy unverified (only a site whose own address carries the
// question can be asked the same thing as Verse). Pure data, plus the date the 'is it' truth depends on.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { LANE_PAGES, FLOORS } from '../void-live-deploy/lib/tower.js';
import { SELF_SITES } from '../void-live-deploy/lib/self-sites.js';
// a site Verse took on by itself (tools/tower-self.mjs) is asked its family's question on its own page: the row keeps that question's address
const SELF_ASK = new Map(SELF_SITES.filter((r) => r && r.lane && r.ask).map((r) => [r.lane, r.ask]));
import { tripToToken } from '../void-live-deploy/lib/flights-core.js';
import { CALCULATORS } from '../void-live-deploy/lib/calculators.js';
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

// the list language probe's generator (lib/listgen.js), carried in the editor's link as a share code ('p.' + base64url): every result is "Owl x #7"
// or "Crow x #7" (or y) when nested lists, ^0 odds, an inline choice, titleCase and a kept value all work; "Cat" never shows (its odds are 0)
export const LIST_PROBE_TEXT = 'output\n  [n = num, ""][animal.titleCase] {x|y} #[n]\nanimal\n  cat ^0\n  bird\n    owl\n    crow\nnum\n  7\n';
export const LIST_PROBE = 'p.' + Buffer.from(LIST_PROBE_TEXT, 'utf8').toString('base64url');
/** the date n days from today as YYYY-MM-DD (UTC): a question with a date that is always still ahead. Pure but for today's date. */
export const inDays = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
// the trip the trip page is asked about: London (LHR) to New York (JFK) landing at 13:00 local, then a flight to Lisbon (LIS) leaving 40 minutes later
const ASK_TRIP = tripToToken([{ al: 'BA', no: '117', from: 'LHR', to: 'JFK', dep: '2027-03-12T10:00', arr: '2027-03-12T13:00', loc: 'ABC123' }, { al: 'UA', no: '904', from: 'JFK', to: 'LIS', dep: '2027-03-12T13:40', arr: '2027-03-13T01:50', loc: 'ABC123' }]);
// the formula library floor's rival size (lib/tower.js rivalCount: vcalc.com's published count) and the gap to Verse's library, for the label
const RIVAL_N = ((FLOORS.find((f) => f.id === 'formula calculators') || {}).rivalCount || {}).n || 15000;
/** the calculator count a page shows as "All calculators (N)", or 0. Pure. */
export const libraryCount = (t) => Number((String(t).match(/All calculators \(([\d,]+)\)/i) || [])[1]?.replace(/,/g, '') || 0);
const LIBRARY_GAP = 'at least ' + RIVAL_N.toLocaleString('en-US') + ' calculators, the size vcalc.com publishes (Verse has ' + CALCULATORS.length + ': ' + (RIVAL_N - CALCULATORS.length).toLocaleString('en-US') + ' short)';
// the Writing Room's share link for a draft (lib/fanfic.js shareHash): base64url of the UTF-8 JSON { t: title, x: text }, after #room=
const roomHash = (t, x) => 'room=' + Buffer.from(JSON.stringify({ t, x })).toString('base64url');
const FIC_TITLE = 'The gate counts a draft', FIC_TEXT = WC_TEXT + '\n\n' + "Hermione's half-blood friend didn't wait.";
// a rap carried whole in a /rap/ link (the music: neuralframes.com probe and journeys): written for the gate, so the page opens it with no model call
export const RAP_LINK = "/rap/?t=pizza&s=boom+bap&m=confident&f=steady&v=first&r=Title%3A+Slice+of+the+Night%0A%5BVerse+1%5D%0AI+fold+a+slice+in+half+and+let+the+cheese+hang+low%0AThe+oven+running+hot%2C+the+street+is+full+of+snow%0APepperoni+circles+stacked+like+records+on+a+shelf%0AI+never+share+the+crust%2C+I+keep+it+for+myself%0AThe+box+is+on+my+knees%2C+the+steam+is+in+the+air%0AThe+radio+is+loud%2C+I+do+not+have+a+care%0AA+little+extra+garlic%2C+basil+on+the+side%0AI+take+a+bite+of+summer+on+a+winter+ride%0A%5BHook%5D%0APizza+in+the+night%2C+pizza+in+the+light%0AEvery+single+slice%2C+I+hold+it+tight%0APizza+on+the+go%2C+pizza+on+the+low%0AEvery+time+I+eat%2C+I+steal+the+show%0A%5BVerse+2%5D%0AThe+dough+is+spinning+round+like+vinyl+on+a+deck%0AThe+chef+is+throwing+flour+like+confetti+at+a+check%0AI+order+one+large%2C+then+I+order+one+more%0AThe+driver+knows+my+name+and+waves+from+the+door%0AMozzarella+melting+like+the+stars+across+the+sky%0AI+count+a+dozen+toppings+and+I+never+ask+why%0AThe+last+piece+on+the+plate+is+a+trophy+in+my+hand%0APizza+is+the+only+crown+that+every+kid+can+stand";
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
  sports: {
    site: 'https://www.espn.com/', verse: '/scores/?league=epl&date=2025-05-25',
    // the question: one Premier League day in the page's link, the last matchday of 2024-25 (25 May 2025), worked out by hand and never read off a
    // rival: all ten games kicked off together that Sunday and are finished, and Arsenal were at home to Southampton. Judged on Verse alone (the
    // site is not asked); the same probe measures every site in the sports lane (lib/tower.js LANES). The page's own words ("Live scores",
    // "standings") are in its first paint, so the aspects below are asked of ROWS the page draws from a feed, never of a loading state
    ask: { verse: '/scores/?league=epl&date=2025-05-25' },
    truth: [['Arsenal against Southampton', /Arsenal[\s\S]{0,200}Southampton|Southampton[\s\S]{0,200}Arsenal/], ['all ten games of the day finished (FT)', (t) => (String(t).match(/\bFT\b/g) || []).length >= 10], ['a score beside Arsenal', /Arsenal\s+\d\b/]],
    pageParts: {
      // live scores: games with their score and status as rows from the feed (a past day is the fixed fact; the live refresh is the page's own 30 s loop)
      'live scores': { verse: '/scores/?league=epl&date=2025-05-25', items: [['a team with its score (Arsenal, Liverpool, Chelsea or Everton, then a number)', /(?:Arsenal|Liverpool|Chelsea|Everton)\s+\d\b/], ['a finished mark', /\bFT\b/], ['kick-off or status per game, ten rows', (t) => (String(t).match(/\bDetails\b/g) || []).length >= 10]] },
      // schedules: a team's page, Arsenal (ESPN team 359): last games with results and next games with dates in the viewer's zone
      schedules: { verse: '/scores/?league=epl&team=359&tn=Arsenal', items: [['last games', /\bLast games\b/], ['next games', /\bNext games\b/], ['a dated row', /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),? (?:[A-Z][a-z]{2} \d{1,2}|\d{1,2} [A-Z][a-z]{2})\b/]] },
      // standings: the Premier League table, twenty ranked rows with points
      standings: { verse: '/scores/?league=epl&tab=standings', items: [['a points column', /\bPts\b/], ['rank 1 and rank 20 rows', (t) => /^1\t/m.test(String(t)) && /^20\t/m.test(String(t))], ['goal difference', /\bGD\b/]] },
    },
    // what the best score sites show: the day's games with scores, live marks, a day picker, standings, box scores and match detail, favourite teams, schedules in your zone, a share link, offline
    facts: [['the day\'s games', /\bFT\b|\bLIVE\b/], ['a day picker', /\byesterday\b/i], ['standings', /\bstandings\b/i], ['leagues', /\bpremier league\b/i], ['match details', /\bdetails\b/i], ['my teams', /\bmy teams\b/i], ['follow a team', /\bfollow\b/i], ['a share link', /\bshare\b/i], ['the source named', /\bESPN\b/], ['delayed data said', /\bdelayed\b/i], ['no betting', /\bno betting\b/i], ['Formula 1', /\bFormula 1\b/], ['NBA', /\bNBA\b/], ['works offline', /\boffline\b|\bdevice\b/i]],
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
  news: {
    site: 'https://www.bbc.com/news', verse: '/news/?sec=world',
    // the question: the world headlines, in the page's link. A right answer is a list of real headlines, each with its source and its age, from
    // several outlets, and the page says how many of its sources answered: a page that is only loading, or that lists one outlet, shows none of it.
    // Judged on Verse alone (the site is not asked); the same probe measures every site in the news lane (lib/tower.js LANES)
    ask: { verse: '/news/?sec=world' },
    truth: [['headline rows from at least three different sources', (t) => distinctRows(t) >= 3], ['at least ten headline rows, each with an age', (t) => rowsIn(t).length >= 10], ['the sources that answered, three or more', (t) => { const m = String(t).match(/Sources \((\d+) of \d+ answered\)/); return !!m && +m[1] >= 3; }]],
    askParts: { 'breadth of sources': [['five or more sources in the rows', (t) => distinctRows(t) >= 5]], freshness: [['an age on a story', (t) => rowsIn(t).length > 0]], 'topic following': [['follow topics', /\bfollow\b/i], ['my news', /\bmy news\b/i]] },
    // what the best news pages show (BBC News' top stories, sections, search, follow topics, timestamps, share, languages, offline); Verse adds
    // the same story from several sources grouped, a source filter, a read-later list and a headlines-only view
    facts: [['top stories', /\btop stories\b/i], ['world', /\bworld\b/i], ['business', /\bbusiness\b/i], ['technology', /\btechnology\b/i], ['science', /\bscience\b/i], ['sport', /\bsport\b/i], ['culture', /\bculture\b/i], ['regions', /\bafrica\b[\s\S]*\basia\b/i],
      ['search', /\bsearch\b/i], ['follow topics', /\bfollow\b/i], ['my news', /\bmy news\b/i], ['saved for later', /\bsaved\b/i], ['several languages', /\bespañol\b[\s\S]*\bdeutsch\b|\bdeutsch\b/i], ['story ages', (t) => rowsIn(t).length > 0],
      ['the same story from several sources', /\b\d+ sources\b/i], ['a share link', /\bcopy link\b/i], ['headlines only', /\bheadlines only\b/i], ['works offline', /\boffline\b/i]],
  },
  finance: {
    site: 'https://finance.yahoo.com/', verse: '/markets/?s=SPX&r=5y&on=2024-12-31',
    // the question: the S&P 500's close on the last trading day of 2024, in the page's link (a day that never changes, so no live price is guessed). The truth any correct quote
    // page agrees on, worked out by hand from the exchange's record (never read off the site): the S&P 500 closed 2024 at 5,881.63 points on 31 Dec 2024 (the Associated Press's market report of that day, checked 2026-10-26). The words beside it
    // ("SPX · Index") appear only once the price has come back, so a page that is still loading fails. Judged on Verse alone (the site is not asked); the same probe measures
    // every site in the finance lane (lib/tower.js LANES)
    ask: { verse: '/markets/?s=SPX&r=5y&on=2024-12-31' },
    truth: [['the close on 31 Dec 2024 is 5,881.63', /Close on 31 Dec 2024:\s*5,881\.63\b/], ['the symbol and its kind, from the answer', /\bSPX · Index\b/], ['a price with cents', /\b\d{1,3}(?:,\d{3})*\.\d{2}\b[\s\S]{0,60}today/]],
    // real numbers for fixed params, so a loading-only page fails: a quote with a percent move and its source; a chart with its change over the range; the watchlist box
    askParts: { 'live quotes': [['a price with its move in percent', /[+−]\d+\.\d{2}%\) today/], ['the source named', /Source: (?:Stooq|Yahoo|CoinGecko|ECB)/], ['a 52-week range of two prices', /52-week range\s*\d[\d,]*\.\d{2}\s*–\s*\d[\d,]*\.\d{2}/]],
      charts: [['ranges from 1D to Max', /\b1D\b[\s\S]{0,40}\b5D\b[\s\S]{0,60}\bYTD\b[\s\S]{0,40}\b5Y\b[\s\S]{0,20}\bMax\b/], ['the move over the range, from the drawn series', /[+−]\d+\.\d+% over 5Y/], ['a hover readout', /Move across the chart/i]],
      watchlists: [['a watchlist', /\bwatchlist\b/i], ['kept on the device', /on this device/i]] },
    // what the best quote pages show (Yahoo Finance's price and change, previous close, day range, 52-week range, volume, market cap, a chart with ranges, a watchlist, indices,
    // movers, comparing, history); news, financial statements, options and portfolios are not here and not claimed
    facts: [['the price and its change in percent', /[+−]\d+\.\d{2}%/], ['the previous close', /previous close/i], ['the day range', /day range/i], ['the 52-week range', /52-week range/i], ['volume', /\bvolume\b/i], ['market cap', /market cap/i],
      ['chart ranges 1D to Max', /\b1D\b[\s\S]{0,40}\b5D\b[\s\S]{0,60}\b5Y\b/], ['a watchlist', /\bwatchlist\b/i], ['compare two symbols', /\bcompare\b/i], ['top movers', /top movers/i], ['the main indices', /S&P 500/], ['a currency converter', /convert currency/i], ['a close on any day', /close on a day/i], ['a written market wrap', /verse reports/i], ['the source and the delay said', /may be delayed/i]],
  },
  // the finance lane's own pages (owner, 2026-10-26: every lane site gets its own page): the market-cap site is measured against /markets/caps/, the screener site against
  // /markets/screener/. Each judged on Verse alone; the truth is what holds on any day.
  'finance: companiesmarketcap.com': {
    site: 'https://companiesmarketcap.com/', verse: '/markets/caps/',
    // the question: the coins by market cap. The truth on any day (worked out by hand): Bitcoin is rank 1, its name and ticker stand together on the row, with a price in dollars
    // and a market cap in billions or trillions; the page says it lists the 50 largest. Numbers only appear once the list has come back, so a loading page fails.
    ask: { verse: '/markets/caps/' },
    truth: [['Bitcoin is rank 1', /(?:^|\n)\s*1\s+\S*\s*Bitcoin\s*BTC\b/], ['a price in dollars on its row', /Bitcoin[\s\S]{0,40}\$[\d,]{3,}/], ['a market cap in trillions or billions', /\$\d+(?:\.\d+)?[TB]\b/], ['the 50 largest', /\b50 largest\b/i]],
    askParts: { 'live quotes': [['a price in dollars', /Bitcoin[\s\S]{0,40}\$[\d,]{3,}/], ['a 24 hour move in percent', /[+−]\d+\.\d{2}%/], ['prices said to be delayed', /may be delayed/i]], charts: [['a 7 day chart', /\b7d chart\b/i], ['the 7 day move', /\b7d [+−]\d+\.\d{2}%/]], watchlists: [['a watchlist', /\bwatchlist\b/i], ['kept on the device', /on this device/i]] },
    facts: [['rank', /(?:^|\n)\s*1\s/], ['price', /\$[\d,]{3,}/], ['market cap', /\bMkt cap\b|market cap/i], ['24 hour change', /[+−]\d+\.\d{2}%/], ['7 day change', /\b7d [+−]\d+\.\d{2}%/], ['24 hour volume', /\bVol 24h \$/i], ['a total market cap', /Total market cap of these \d+: \$\d/i], ['a coin search', /find a coin/i], ['sorting', /\bMkt cap\b/i], ['a 7 day chart', /\b7d chart\b/i], ['company market caps said to be absent, and why', /Company market caps[\s\S]{0,160}no free source/i]],
  },
  'finance: finviz.com': {
    site: 'https://finviz.com/', verse: '/markets/screener/?near=100&sort=pct',
    // the question: the whole small universe (a filter every symbol passes: within 100 percent of its high), biggest gain first. The truth on any day: the page counts how many of
    // the universe match, names a stock and a coin in its rows, and the universe is labelled as 12 stocks, 4 indices and 30 coins, "not every listed company".
    ask: { verse: '/markets/screener/?near=100&sort=pct' },
    truth: [['the matches counted', /\b\d+ of \d+ symbols match\b/], ['a share row with a price and a move', /\bAAPL\b[\s\S]{0,40}\d[\d,]*\.\d{2}[\s\S]{0,40}[+−]\d+\.\d{2}%/], ['a coin row', /\bBTC\b[\s\S]{0,60}[+−]\d+\.\d{2}%/], ['the universe labelled as small', /12 large US stocks[\s\S]{0,200}30 large coins[\s\S]{0,80}not every listed company/i]],
    askParts: { 'live quotes': [['a price and a move on a row', /\bAAPL\b[\s\S]{0,40}\d[\d,]*\.\d{2}[\s\S]{0,40}[+−]\d+\.\d{2}%/], ['prices said to be delayed', /may be delayed/i]], charts: [['a chart under each move', /small line under each move is its chart/i], ['the distance from the high', /Below high/i]], watchlists: [['a watchlist', /\bwatchlist\b/i], ['kept on the device', /on this device/i]] },
    facts: [['a move filter', /Move at least/i], ['a distance from the high filter', /Within % of high/i], ['a volume filter', /Volume at least/i], ['a group filter', /\bIndices\b[\s\S]{0,40}\bCoins\b/i], ['sorting', /Sort by/i], ['a match count', /\d+ of \d+ symbols match/], ['volume against the average', /Volume ×/], ['the universe said plainly', /not every listed company/i], ['a chart on each row', /small line under each move is its chart/i]],
  },
  'image boards': {
    site: 'https://www.4chan.org/', verse: '/boards/',
    // the boards start blank (owner, 2026-10-25: "leave the categories blank but user creatable"), so nothing here depends on a board or posts
    // anything: the question is a post's formatting, put in the page's link and drawn by its preview on the device (/boards/?preview=...). The truth any
    // correct board agrees on: the poster is Anonymous, the post has its number, a line starting with > stays as written (greentext), >>2 is a quote,
    // and [spoiler] tags are not shown as text. Judged on Verse alone (a rival's board is never loaded for it, nor pictured: noShot in lib/tower.js);
    // the same probe measures every site in the image boards lane
    ask: { verse: '/boards/?preview=' + encodeURIComponent('>be me\n>>2 quoted\nhello [spoiler]hidden words[/spoiler]') },
    truth: [['the name Anonymous', /\bAnonymous\b/], ['the post number', /\bNo\. 1\b/], ['the greentext line kept', /(?:^|\n)\s*>be me\b/], ['the quote of post 2', />>2 quoted/], ['the spoiler drawn, not its tags', /hello hidden words/]],
    askParts: { catalog: [['a catalog', /\bcatalog\b/i]], 'replies and quoting': [['replies', /\brepl(?:y|ies)\b/i], ['quotes', /\bquot(?:e|es|ing)\b|>>\d/i]], 'image posts': [['pictures', /\bpictures?\b|\bimages?\b/i]], archive: [['an archive', /\barchive\b/i]] },
    // what the best boards offer (4chan's board list, catalog, archive, replies and quotes, greentext, tripcodes, sage, spoilers, search, a thread
    // watcher, rules and reports, picture posts, work-safe and adult boards)
    facts: [['a board list', /\bboards?\b/i], ['a catalog', /\bcatalog\b/i], ['an archive', /\barchive\b/i], ['replies and quotes', /\brepl(?:y|ies)\b|>>\d/i], ['greentext', /\bgreentext\b/i], ['tripcodes', /\btripcodes?\b/i],
      ['sage', /\bsage\b/i], ['spoilers', /\bspoilers?\b/i], ['search', /\bsearch\b/i], ['a thread watcher', /\bwatch(?:er|ing)?\b/i], ['rules', /\brules\b/i], ['picture posts', /\bpictures?\b|\bimages?\b/i], ['work-safe and 18+ boards', /\b18\+|\bNSFW\b|\bwork[\s-]?safe\b|safe for work/i], ['make your own board', /\bmake (?:a|the first|your) board\b/i]],
  },
  'random generators': {
    site: 'https://perchance.org/', verse: '/generators/',
    // the question: the fantasy-name generator at seed 7 (the link reproduces it). Any correct answer is a list of at least five names, each one
    // capitalised word, with the seed named. Judged on Verse alone; the same probe measures every site in the random generators lane (lib/tower.js LANES)
    ask: { verse: '/generators/?g=fantasy-names&seed=7' },
    truth: [['a list of five or more capitalised names', (t) => String(t).split(/\n/).map((l) => l.trim()).filter((l) => /^[A-Z][a-z]{2,}(?: [A-Z][a-z]{2,})?$/.test(l) && !/^(?:Copy|Keep|Kept|Remove|Regenerate|Results|Generators?|Random|Share|Fantasy|Ask)(?: .*)?$/.test(l)).length >= 5], ['the seed, named', /\bseed 7\b/i]],
    askParts: { 'generator catalogue': [['a count of generators', /\b\d{2,} generators\b|catalogue/i]], 'make your own generator': [['make your own', /make your own/i]] },
    // aspects asked at addresses of their own (owner, 2026-10-25: "how do we beat perchance if we dont have images?"): a picture button is not
    // image generation; the image page, asked for a fixed prompt and seed in its link, has to show a picture it really made within 60 s. The list
    // language: the editor opened with a generator in its link (nested lists, ^0 odds, an inline choice, a method and a kept value) has to show
    // results that only a working engine gives; publish and remix: the same page offers sharing, publishing, remixing and embedding
    pageParts: {
      'image generation': { verse: '/image/?' + new URLSearchParams({ prompt: 'a red fox curled up in the snow', style: 'watercolor', shape: 'square', seed: '7', n: '1', go: '1' }), img: true, within: 60000, sel: '#pics img' }, // the results, never the public gallery below them
      'list language': { verse: '/generators/make/#g=' + LIST_PROBE, items: [['nested lists, odds, {a|b}, titleCase and a kept value worked out', (t) => (String(t).match(/^(?:Owl|Crow) (?:x|y) #7$/gm) || []).length >= 5], ['an item at odds ^0 never picked', (t) => !/^Cat (?:x|y) #7$/m.test(String(t))]] },
      'publish and remix': { verse: '/generators/make/#g=' + LIST_PROBE, items: [['a share link', /\bshare link\b/i], ['publish', /\bpublish\b/i], ['remix', /\bremix\b/i], ['embed', /\bembed\b/i]] },
    },
    // what the best generator sites show: a catalogue of generators, a count of results, regenerate, copy, a link that keeps the result, favourites
    facts: [['many generators', /\b\d{2,} generators\b/i], ['a count of results', /\bresults\b/i], ['regenerate', /\bregenerate\b/i], ['copy', /\bcopy\b/i], ['a share link', /\bshare\b/i], ['keep favourites', /\bkeep\b|\bkept\b/i], ['a seed', /\bseed\b/i], ['make your own', /make your own/i], ['picture it', /picture it/i], ['works offline', /\boffline\b/i]],
  },
  calendar: {
    site: 'https://calendar.google.com/', verse: '/calendar/',
    // the question: one line of plain words in the page's link, an event tomorrow at 3 pm with a reminder half an hour before, repeating monthly.
    // The truth is worked out from the gate's own clock (lib/calendar.js quickAdd and the page agree with it or they are wrong): the event is
    // shown by its title, on tomorrow's weekday, at 3:00 PM (15:00 for a German browser), with the reminder and the repeat in words. Judged on
    // Verse alone (the site is not asked); the same probe measures every site in the calendar lane (lib/tower.js LANES)
    ask: { verse: '/calendar/?q=' + encodeURIComponent('dentist tomorrow 3pm, remind me 30 minutes before, every month') },
    truth: () => { const t = new Date(Date.now() + 86400000); const wd = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][t.getDay()], day = t.getDate();
      return [['the event, dentist', /\bdentist\b/i], ["tomorrow's weekday and day", new RegExp('\\b' + wd + '\\b[^\\n]{0,4}\\b' + day + '\\b|\\b' + day + '\\.?\\s[^\\n]{0,12}' + wd)], ['3:00 PM', /\b3:00 PM\b|\b15:00\b/], ['the reminder, 30 minutes before', /\b30 (?:minutes|Minuten) (?:before|vorher)\b/i], ['the repeat, every month', /\bevery month\b|\bmonthly\b|\bjeden Monat\b|\bmonatlich\b/i]]; },
    askParts: { reminders: [['the reminder in words', /\d+ (?:minutes?|hours?|days?|Minuten?|Stunden?|Tage?) (?:before|vorher)\b/i], ['the next reminder shown', /next reminder|nächste Erinnerung/i]], invites: [['an invite', /\binvite\b|\beinladen\b/i], ['a share link', /\bshare\b|\bteilen\b/i], ['the .ics', /\.ics\b/i]], 'recurring events': [['the repeat in words', /\bevery (?:day|week|month|year|\d+)\b|\bjede[nr]? \b|\balle \d+\b/i], ['a repeat marker on the list', /↻/]] },
    // what the best calendars show: Google Calendar's month, week and day views, today, a new event, repeats, reminders, invites, search, .ics
    // import and export; the best add a share link, quick add in plain words, keyboard shortcuts, notifications on the device, and open offline
    facts: [['a month view', /\bmonth\b/i], ['a week view', /\bweek\b/i], ['a day view', /\bday\b/i], ['today', /\btoday\b/i], ['a new event', /\bnew event\b|\badd\b/i], ['repeating events', /\brepeat|\bevery\b/i], ['reminders', /\bremind/i], ['invites', /\binvite/i],
      ['a share link', /\bshare\b/i], ['.ics import and export', /\.ics\b/i], ['search', /\bsearch\b/i], ['quick add in plain words', /\bquick add\b/i], ['keyboard shortcuts', /\barrow keys\b|\bkeyboard\b/i], ['notifications', /\bnotification/i], ['works offline', /\boffline\b/i]],
  },
  'docs and notes': {
    site: 'https://docs.google.com/', verse: '/notes/',
    // the question: one line of plain words in the page's link, "note: Shopping list - milk, eggs, bread". A right answer is a note titled Shopping
    // list holding the three things (milk, eggs, bread) as a checklist, no more worked out than that. Judged on Verse alone (the site is not asked);
    // the same probe measures every site in the docs and notes lane (lib/tower.js LANES)
    ask: { verse: '/notes/?q=' + encodeURIComponent('note: Shopping list - milk, eggs, bread') },
    truth: [['the title, Shopping list', /\bShopping list\b/i], ['milk', /\bmilk\b/i], ['eggs', /\beggs\b/i], ['bread', /\bbread\b/i]],
    askParts: { 'rich formatting': [['bold, italic or headings shown', /bold|italic|heading/i]], search: [['search shown', /search/i]], 'version history': [['history or versions shown', /history|versions?/i]] },
    // what the best docs pages show: Google Docs' rich formatting, many documents, search, version history, share, export and print; the best add
    // checklists, word count, markdown in and out, keyboard shortcuts, dark mode, and notes that stay on the device and open offline
    facts: [['rich formatting', /\bbold\b/i], ['headings', /\bheadings?\b/i], ['lists', /\blists?\b/i], ['checklists', /\bchecklists?\b|\bcheckbox/i], ['links', /\blinks?\b/i], ['many documents', /\bnew note\b|\bnotes\b/i], ['search', /\bsearch\b/i],
      ['version history', /\bversion history\b/i], ['a word count', /\bwords\b/i], ['export', /\bexport\b/i], ['import', /\bimport\b/i], ['markdown', /\.md\b/i], ['print', /\bprint\b/i], ['a share link', /\bshare\b/i], ['keyboard shortcuts', /\bCtrl\b|\bkeyboard\b/i], ['works offline', /\boffline\b/i], ['on this device', /\bon this device\b|\bthis browser\b/i]],
  },
  pdf: {
    site: 'https://www.ilovepdf.com/', verse: '/pdf/',
    // the question: open the merge tool from a link. A right page names the tool, takes PDFs (choose or drop) and says the file stays on the device. Judged on
    // Verse alone (the site is not asked); the same probe measures every site in the PDF lane (lib/tower.js LANES)
    ask: { verse: '/pdf/?tool=merge' },
    truth: [['the merge tool', /\bmerge\b/i], ['PDFs chosen or dropped', /\b(?:choose|drop|add)\b[\s\S]{0,40}\bPDFs?\b/i], ['files stay on the device', /\bon (?:this|your) device\b|\bnever leaves?\b|\bnothing (?:is )?(?:uploaded|sent)\b/i]],
    askParts: { 'merge and split': [['merge', /\bmerge\b/i], ['split', /\bsplit\b/i]], 'page tools': [['rotate', /\brotate\b/i], ['delete pages', /\bdelete\b|\bremove\b/i], ['reorder', /\breorder\b|\bmove\b|\bdrag\b/i]], 'images to pdf': [['images to PDF', /\bimages?\b[\s\S]{0,20}\bPDF\b/i]], compress: [['compress', /\bcompress/i]] },
    // what the best PDF sites list: merge, split, remove, organize and rotate pages, compress, images to PDF and PDF to images, page numbers, watermark, protect and
    // unlock, edit and sign; the best add files kept on the device, no account, and offline
    facts: [['merge', /\bmerge\b/i], ['split', /\bsplit\b/i], ['delete pages', /\bdelete pages?\b|\bremove pages?\b/i], ['reorder pages', /\breorder\b/i], ['rotate', /\brotate\b/i], ['compress', /\bcompress/i], ['images to PDF', /\bimages? to pdf\b|\bpictures? to pdf\b/i], ['PDF to images', /\bpdf to (?:images?|jpg|png)\b/i],
      ['page numbers', /\bpage numbers?\b/i], ['watermark', /\bwatermark/i], ['on this device', /\bon (?:this|your) device\b/i], ['no account', /\bno (?:account|sign.?up)\b/i], ['works offline', /\boffline\b/i], ['ask questions about a PDF', /\bask\b[\s\S]{0,40}\bPDF\b/i]],
  },
  kanban: {
    site: 'https://trello.com/', verse: '/kanban/',
    // the question: open the page. A right page opens a board with its stages named (a fresh board starts To do, Doing, Done), a way to add a card, and says the
    // board stays on the device. Judged on Verse alone; the same probe measures every site in the kanban lane (lib/tower.js LANES)
    ask: { verse: '/kanban/' },
    truth: [['a To do column', /\bto do\b/i], ['a Doing column', /\bdoing\b/i], ['a Done column', /\bdone\b/i], ['a way to add a card', /\badd (?:a )?card\b/i]],
    askParts: { 'boards and columns': [['boards', /\bboards?\b/i], ['add a column', /\badd (?:a )?(?:column|list)\b/i]], 'card details': [['labels', /\blabels?\b/i], ['due dates', /\bdue\b/i], ['checklists', /\bchecklists?\b/i]], 'drag and drop': [['drag', /\bdrag\b/i], ['keyboard moves', /\bkeyboard\b|\barrow keys\b/i]], 'import and export': [['export', /\bexport\b/i], ['import', /\bimport\b/i]] },
    // what the best boards show: boards, columns, cards, labels, due dates, checklists, drag and drop, search and filter, archive, WIP limits, and import and export; the best
    // add keyboard moves, boards kept on the device with no account, and offline
    facts: [['boards', /\bboards?\b/i], ['columns', /\bcolumns?\b/i], ['cards', /\bcards?\b/i], ['labels', /\blabels?\b/i], ['due dates', /\bdue\b/i], ['checklists', /\bchecklists?\b/i], ['drag and drop', /\bdrag\b/i], ['search', /\bsearch\b|\bfilter\b/i], ['archive', /\barchive\b/i], ['WIP limits', /\bWIP\b|\blimit\b/i],
      ['export', /\bexport\b/i], ['import', /\bimport\b/i], ['keyboard moves', /\bkeyboard\b|\barrow keys\b/i], ['on this device', /\bon (?:this|your) device\b/i], ['works offline', /\boffline\b/i]],
  },
  // jobs (owner, 2026-10-26: "we have to have everything all the sites have"): LinkedIn Jobs is the floor; Verse's /jobs/ lists remote jobs from three free feeds whose
  // terms allow showing them (Remotive, Jobicy, Himalayas; lib/jobs-core.js), each credited and linked to its original posting. The question is a keyword search; a right
  // answer counts its jobs, shows ones that match, names each listing's source and sends Apply to the original posting. Judged on Verse alone (the listings are live).
  jobs: {
    site: 'https://www.linkedin.com/jobs/', verse: '/jobs/',
    ask: { verse: '/jobs/?q=developer' },
    truth: [['the jobs counted', /\b\d[\d,.]* jobs? · /], ['developer jobs listed', /developer/i], ['each listing names its source', /Listing from (?:Remotive|Jobicy|Himalayas)/], ['Apply opens the original posting', /Apply on (?:Remotive|Jobicy|Himalayas)/]],
    askParts: {
      'listing breadth': [['several sources', /Remotive[\s\S]*Jobicy[\s\S]*Himalayas/], ['the same search on other sites', /Open this search on other job sites/i], ['filters', /Job type[\s\S]{0,400}Level/]],
      alerts: [['save a search as an alert', /Save this search as an alert/i], ['new since the last visit', /new since/i], ['a feed', /RSS/]],
      applications: [['an application tracker', /Applications/], ['stages', /Interview[\s\S]{0,80}Offer|Offer[\s\S]{0,80}Interview/], ['notes', /Notes|your notes/i], ['CSV export', /Export CSV/i]],
    },
    facts: [['keyword search', /Keyword/], ['place', /\bPlace\b/], ['remote region', /Work from/], ['category', /Category/], ['tags', /\bTag\b/], ['job type', /Job type/], ['level', /\bLevel\b/], ['salary', /salary/i], ['date posted', /Posted/], ['sort', /\bSort\b/], ['saved jobs', /Saved jobs/],
      ['alerts', /alert/i], ['an RSS feed', /RSS/], ['application tracker', /Applications/], ['interview stage', /Interview/], ['calendar file', /\.ics/], ['CSV export', /Export CSV/], ['share link', /Share link/i], ['other job sites', /other job sites/i], ['visa sponsorship', /visa sponsorship/i], ['source credited', /Remotive/], ['no account', /no account/i], ['works offline', /\boffline\b/i]],
  },
  // paint (owner, 2026-10-26: "build wherever fits"): heycolor.com's paint-by-number art, fought from Verse's own /paint/. The ask opens a
  // known template, so the counts are checkable against the formula: the heart is 76 cells on a 12 by 12 grid in four numbered colours,
  // 10 + 26 + 28 + 12. Judged on Verse alone (their side is an app store listing, not a page).
  paint: {
    site: 'https://heycolor.com/', verse: '/paint/',
    ask: { verse: '/paint/?p=wave' },
    truth: [['the areas, counted (104)', /\b104 areas/], ['the pixels, counted (48,400)', /48,400 pixels/], ['ten numbered colours', /\b10 colours/],
      ['colour 1 has 10 areas', /1 \u00b7 10 left/], ['colour 8 has 16', /8 \u00b7 16 left/], ['colour 9 has 18', /9 \u00b7 18 left/], ['the painting it opened', /The Great Wave/]],
    facts: [
      ['paint by number', /paint by number/i], ['real paintings, numbered', /real paintings/i], ['numbered areas', /numbered areas/i], ['a numbered palette', /palette/i],
      ['the progress count', /pixels painted/], ['tap an area to fill it', /tap an area/i], ['find an area', /Find a 1/], ['start over', /Start over/],
      ['download a PNG', /Download PNG/], ['a share link', /Share link/], ['save to a gallery', /Save to gallery/], ['upload your own image', /Upload your own image/],
      ['the artwork is public domain', /public domain/i], ['kept on this device', /on this device/i], ['works offline', /works offline/i], ['no account', /no account/i], ['no ads', /no ads/i],
      ['a second painting', /The Starry Night/],
    ],
  },
  // emoji counts (owner, 2026-10-26: "drop the /emojis/ page and its tower probe right onto main"): emojitracker.com ranks the emoji
  // copied from Emojipedia; the Twitter stream its old page was built on is, by its own account, inactive. Verse's /emojis/ counts copies
  // of a closed list of emoji made on the page itself and says so, so the "realtime" is real and local and no global feed is pretended.
  // Judged on Verse alone (their page is a paragraph of history and a link to the source, not a tool).
  // yunite.xyz (owner, 2026-10-27): the scrim scorer a Fortnite lobby passes around. Its scores arrive through an account and its bot
  // reads screenshots; Verse's /tournaments/ takes results typed in and shows the arithmetic - placement pays the highest matching threshold
  // (a win is not a win plus the top-five), the tiebreakers are points, wins, eliminations then average placement, heats are dealt in snake
  // order and two teams on one starting spot are flagged contested. The seeded ask is a three-team match, worked out by hand below.
  tournaments: {
    site: 'https://yunite.xyz/', verse: '/tournaments/',
    ask: { verse: '/tournaments/?results=Alpha:1:6,Bravo:2:7,Charlie:6:3&drops=Alpha:Old%20Mill,Bravo:Harbor,Charlie:Old%20Mill&elim=2&win=10&top5=5' },
    truth: [['the first seeded team', /Alpha/], ['its points, worked out: 1st is 10 plus 6 x 2 (22)', /Alpha\s+22\s+1\s+6/],
      ['the second seeded team', /Bravo/], ['its points, worked out: 2nd is 5 plus 7 x 2 (19)', /Bravo\s+19\s+0\s+7/],
      ['the third seeded team', /Charlie/], ['its points, worked out: 6th is 0 plus 3 x 2 (6)', /Charlie\s+6\s+0\s+3/],
      ['the total teams', /3 teams/], ['the total eliminations, worked out (16)', /16 eliminations/], ['the total points, worked out (47)', /47 points/],
      ['the leader, named', /leader Alpha/], ['the threshold rule, said on the page', /highest matching threshold/],
      ['the tiebreakers, in order', /points, then wins, then eliminations, then average placement/],
      ['the contested starting spot', /Old Mill[\s\S]*?contested/], ['the snake heat split', /snake order/]],
    facts: [
      ['tournament standings', /tournament standings/i], ['a point system', /point system/i], ['preset systems', /Finals-style/i],
      ['team sizes', /(?:solo|duos|trios|squads)/i], ['points per elimination', /per elimination/i],
      ['the threshold rule, said', /highest matching threshold/], ['the standings table', /standings after every match entered/i],
      ['the tiebreakers, in order', /points, then wins, then eliminations, then average placement/], ['wins counted', /wins/i],
      ['average placement', /average placement/i], ['one match per line', /one match per line/i],
      ['snake heats', /snake order/i], ['starting spots', /starting spots/i], ['contested spots flagged', /contested/i],
      ['CSV in', /Import CSV/], ['CSV out', /Export CSV/], ['a share link', /Copy share link/],
      ['the share link carries the state', /Share link: \/tournaments\/\?results=/],
      ['nothing sent', /nothing is sent anywhere/i], ['no account', /no account/i], ['works offline', /works offline/i],
      ['stays on this device', /on this device/i], ['the worked example, marked as one', /worked example/i],
      ['back to Verse', /Back to Verse/], ['the stage bridge', /See it as a card on the stage/],
    ],
    // the five rows this floor is fought on (its extra aspects): each is read off the same seeded answer, so a page that shows all of
    // them is the most any page can show - judged on Verse alone, like the codebase rows (commit f108005d)
    askParts: {
      'point system presets': [['a finals-style preset', /Finals-style/], ['a cash-cup-style preset', /Cash-cup-style/], ['a scrim preset', /Scrim/], ['a custom choice', /Custom/]],
      'multi-match standings': [['one match per line', /one match per line/i], ['standings after every match', /standings after every match entered/i], ['average placement named', /average placement/i], ['the counts for the set', /\d+ teams? · \d+ match/]],
      'heat split': [['snake order', /snake order/i], ['the heats numbered', /Heat 1/], ['a second heat', /Heat 2/], ['seeded by standing rank', /seeded by standing rank/i]],
      'drop spots': [['starting spots', /starting spots \(drops/i], ['contested flagged', /contested/i], ['a claimed place', /Old Mill/], ['who is contesting, ranked', /#1 Alpha \(22 pts\) vs #3 Charlie \(6 pts\)/], ['clear ones too', /\bclear\b/]],
      'CSV in and out': [['import', /Import CSV/], ['export', /Export CSV/], ['the columns named', /team, place, eliminations/i], ['the heading', /CSV in and out/]],
    },
  },
  // thunit.com (owner, 2026-10-27): a 70-word brochure for "exclusive" hosting on a stock site, with six unnamed icon links and no tool of
  // any kind. Verse's /hosting/ answers the two claims it makes in numbers: a crowded shared host splits its cores, an exclusive one keeps
  // them; and the uptime an SLA actually buys, as downtime per year, month, week and day. The ask is traffic (50 requests/s of 200 KB at
  // 40 ms a worker) and a 99.9% SLA; the arithmetic is worked out by hand below (bandwidth, transfer, Little's law, memory, downtime).
  hosting: {
    site: 'https://thunit.com/', verse: '/hosting/',
    ask: { verse: '/hosting/?rps=50&kb=200&ms=40&ram=128&sla=99.9' },
    truth: [
      ['the sustained bandwidth, worked out (10,000 KB/s)', /10,000 KB\/s/],
      ['the same in MB/s (10 MB/s)', /10 MB\/s/],
      ['the same in Mbps (80 Mbps)', /80 Mbps/],
      ['requests per month, worked out (129,600,000)', /129,600,000 requests\/month/],
      ['the monthly transfer, worked out (25,920 GB)', /25,920 GB\/month/],
      ["the concurrent workers, by Little's law (2)", /2 active workers/],
      ['the vCPUs at 50% headroom (4)', /4 vCPUs/],
      ['the memory, worked out (1,024 MB)', /1,024 MB/],
      ['the RAM minimum (1 GB)', /1 GB RAM/],
      ['the RAM with cache headroom (2 GB)', /2 GB RAM/],
      ['the 99.9% downtime per year (8h 45m 36s)', /8h 45m 36s/],
      ['the 99.9% downtime per month (43m 48s)', /43m 48s/],
      ['the 99.9% downtime per week (10m 5s)', /10m 5s/],
      ['the 99.9% downtime per day (1m 26s)', /1m 26s/]],
    askParts: {
      'capacity sizing': [['requests per second', /requests\/s/i], ['a reply size', /KB replies/], ['bandwidth in Mbps', /\bMbps\b/], ['monthly transfer', /GB\/month/], ['active workers', /active workers/], ['shared vs exclusive', /shared vs exclusive/i]],
      'uptime and SLA': [['uptime', /uptime/i], ['downtime', /downtime/i], ['an SLA of 99.9%', /99\.9%/], ['an SLA of 99.99%', /99\.99%/]],
      'server config': [['NGINX', /\bNGINX\b/], ['Caddy', /\bCaddy\b/], ['TLS 1.3', /TLS 1\.3/], ['a copy control', /\bCopy\b/], ['a download control', /\bDownload\b/]],
      'security headers': [['HSTS', /Strict-Transport-Security/], ['CSP', /Content-Security-Policy/], ['nosniff', /X-Content-Type-Options/], ['a referrer policy', /Referrer-Policy/], ['a permissions policy', /Permissions-Policy/], ['a rate limit', /rate limit/i]],
    },
    facts: [
      ['requests per second', /requests\/s/i], ['bandwidth', /bandwidth/i], ['megabits', /\bMbps\b/], ['monthly transfer', /GB\/month/],
      ['virtual cores', /\bvCPUs?\b/], ['memory', /\bRAM\b/], ['concurrent workers', /concurrent/i], ['shared vs exclusive', /shared vs exclusive/i],
      ['uptime', /uptime/i], ['an SLA of 99.9%', /99\.9%/], ['allowed downtime', /downtime/i], ['NGINX', /\bNGINX\b/], ['Caddy', /\bCaddy\b/],
      ['TLS 1.3', /TLS 1\.3/], ['Strict-Transport-Security', /Strict-Transport-Security/], ['Content-Security-Policy', /Content-Security-Policy/],
      ['X-Content-Type-Options', /X-Content-Type-Options/], ['a rate limit', /rate limit/i], ['Copy', /\bCopy\b/], ['Download', /\bDownload\b/],
      ['Share link', /Share link/], ['on this device', /on this device/], ['works offline', /works offline/i], ['no account', /no account/i],
    ],
  },
  prizes: {
    site: 'https://wheelofgold.com/', verse: '/prizes/',
    // the reward faucet audit preset, worked out by hand: slices $1 x1, $0.10 x9, $0.01 x90, $0.001 x900 (1,000 tickets), so the EV is
    // (1 + 0.9 + 0.9 + 0.9) / 1000 = $0.0037 a spin; the top prize is 1 in 1,000, P(at least once in 1,000) = 1 - 0.999^1000 = 63.2%;
    // even odds take 693 spins; one spin an hour to a $5 cashout is ceil(5 / 0.0037) = 1,352 spins, 1,352 hours, 56.3 days
    ask: { verse: '/prizes/?preset=faucet' },
    truth: [
      ['the expected value per spin ($0.0037)', /Expected value per spin\s*\$0\.0037\b/],
      ['the top prize chance (0.1%, 1 in 1,000)', /0\.1% a spin, 1 in 1,000/],
      ['P(top prize at least once in 1,000 spins) (63.2%)', /P\(top prize ≥1 in 1,000\)\s*63\.2%/],
      ['the spins for even odds (693)', /even odds of the top prize\s*693\b/],
      ['the drip to a $5 cashout (1,352 spins, 1,352 hours, 56.3 days)', /1,352 spins · 1,352 hours · 56\.3 days to reach \$5/]],
    askParts: {
      'odds table': [['a chance column', /\bchance\b/i], ['every slice listed', /Top prize[\s\S]*Big[\s\S]*Small[\s\S]*Dust/]],
      'expected value': [['EV per spin', /EV per spin/i], ['net of the cost', /Net per spin/i]],
      'drip calculator': [['a cooldown', /cooldown/i], ['a minimum cashout', /minimum cashout/i], ['a referral share', /referral/i]],
    },
    facts: [
      ['a spin', /\bSpin\b/], ['a 1,000-spin check', /1,000 spins/], ['weights', /\bweight\b/i], ['a share link', /share link/i], ['CSV export', /Export CSV/],
      ['says it never pays or collects', /never pays out/i], ['secure random numbers', /secure random numbers/i]],
  },
  identity: {
    site: 'https://anycolorid.com/', verse: '/identity/',
    ask: { verse: '/identity/#name=Sky%20Rivera&email=sky%40example.com&aid=AC-0001&region=jp' },
    truth: [
      ['the profile name, edited (Sky Rivera)', /Sky Rivera/],
      ['the profile email, edited', /sky@example.com/],
      ['the account ID (AC-0001)', /AC-0001/],
      ['the region (JP)', /\bJP\b/],
      ['a change history ledger', /Change history/],
      ['a JWT claims inspector', /JWT claims/],
      ['a service portal', /Service portal/],
      ['no account required', /no account/i],
    ],
    askParts: {
      'profile metadata': [['a name field', /Name/], ['an email field', /Email/], ['an account ID', /Account ID/], ['a region selector', /Region/]],
      'change history': [['a ledger', /Change history/], ['a clear control', /Clear history/], ['kept on this device', /on this device/]],
      'SSO claims': [['a bearer token input', /Bearer token/], ['a decode control', /Decode/], ['decoded claims', /claims/i]],
      'service portal': [['Official Website', /Official Website/], ['Fan Club', /Fan Club/], ['Official Store', /Official Store/], ['Community Hub', /Community Hub/]],
      'sharing': [['a share link', /Share link/], ['an export', /Export JSON/], ['a copy card', /Copy card/]],
    },
    facts: [
      ['profile', /profile/i], ['name', /Name/], ['email', /Email/], ['account ID', /Account ID/], ['region', /Region/],
      ['change history', /Change history/], ['on this device', /on this device/], ['JWT', /JWT/], ['claims', /claims/i],
      ['SSO', /SSO/], ['service portal', /Service portal/], ['Official Website', /Official Website/], ['Fan Club', /Fan Club/],
      ['Official Store', /Official Store/], ['Community Hub', /Community Hub/], ['share link', /Share link/], ['export JSON', /Export JSON/],
      ['copy card', /Copy card/], ['no account', /no account/i], ['works offline', /works offline/i], ['no ads', /no ads/i],
      ['back to Verse', /Back to Verse/],
    ],
  },
  cpan: {
    site: 'https://www.cpantesters.org/', verse: '/cpan/',
    ask: { verse: '/cpan/' },
    truth: [
      ['ingested reports', /Ingested \d+ reports/],
      ['pass and fail counts', /\d+ PASS, \d+ FAIL/],
      ['distribution health', /Distribution health/],
      ['a test matrix', /CPAN test matrix/],
      ['module search', /Search modules/],
      ['export as JSON', /Export JSON/],
      ['export as CSV', /Export CSV/],
      ['no account', /no account/i],
    ],
    askParts: {
      'test reports': [['ingest control', /Ingest reports/], ['clear control', /Clear/], ['reports textarea', /CPAN test reports/]],
      'distribution health': [['pass count', /PASS/], ['fail count', /FAIL/], ['health line', /Distribution health/]],
      'module search': [['search input', /Search modules/], ['search control', /Search/], ['matching count', /matching reports/]],
      'live feed': [['connect live', /Connect Live Feed/], ['offline fallback', /Offline-first/]],
      'export': [['export JSON', /Export JSON/], ['export CSV', /Export CSV/], ['export box', /Exported summary|module,version/]],
    },
    facts: [
      ['test reports', /Test reports/], ['distribution health', /Distribution health/], ['module search', /Module search/],
      ['live feed', /Live feed/], ['export', /Export/], ['ingest reports', /Ingest reports/], ['clear', /Clear/],
      ['CPAN test matrix', /CPAN test matrix/], ['export JSON', /Export JSON/], ['export CSV', /Export CSV/],
      ['no account', /no account/i], ['works offline', /works offline/i], ['no ads', /no ads/i],
      ['back to Verse', /Back to Verse/], ['on this device', /on this device/],
    ],
  },
  colorzilla: {
    site: 'https://www.colorzilla.com/', verse: '/gradient/',
    ask: { verse: '/gradient/' },
    truth: [
      ['linear gradients', /linear/i],
      ['radial gradients', /radial/i],
      ['conic gradients', /conic/i],
      ['an eyedropper', /Pick a colour from the screen/i],
      ['copy CSS', /Copy CSS/],
    ],
    askParts: {
      'gradient editor': [['linear type', /linear/i], ['radial type', /radial/i], ['conic type', /conic/i]],
      'eyedropper': [['an eyedropper control', /Pick a colour from the screen/i], ['pick from the screen', /screen/i]],
      'color picker': [['colour stops', /colour stops/i], ['presets', /presets/i]],
      'css output': [['copy CSS', /Copy CSS/], ['copy link', /Copy link/]],
      'sharing': [['a share link', /Copy link/]],
    },
    facts: [
      ['gradient', /gradient/i], ['linear', /linear/i], ['radial', /radial/i], ['conic', /conic/i],
      ['eyedropper', /Pick a colour from the screen/i], ['copy CSS', /Copy CSS/],
    ],
  },
  sudowrite: {
    site: 'https://www.sudowrite.com/', verse: '/books/',
    ask: { verse: '/books/' },
    truth: [
      ['chapters from capability families', /Chapters/],
      ['export markdown', /Export Markdown/],
      ['export text', /Export text/],
      ['no credits', /no credits/i],
      ['no subscriptions', /no subscriptions/i],
      ['no API keys', /no API keys/i],
      ['works offline', /works offline/i],
    ],
    askParts: {
      'book studio': [['chapters heading', /Chapters/], ['export controls', /Export Markdown/]],
      'chapters': [['chapter titles', /Chapter \d/], ['surpassed count', /Surpassed \d+/]],
      'export': [['export markdown', /Export Markdown/], ['export text', /Export text/]],
      'offline': [['works offline', /works offline/i], ['no credits', /no credits/i]],
      'sharing': [['stage link', /See it as a card/], ['back to Verse', /Back to Verse/]],
    },
    facts: [
      ['book studio', /Verse Bookshelf/], ['chapters', /Chapters/], ['export markdown', /Export Markdown/],
      ['export text', /Export text/], ['no credits', /no credits/i], ['no subscriptions', /no subscriptions/i],
      ['works offline', /works offline/i], ['back to Verse', /Back to Verse/],
    ],
  },
  nameunit: {
    site: 'https://www.nameunit.com/', verse: '/hosting/',
    ask: { verse: '/hosting/?rps=50&kb=200&ms=40&ram=128&sla=99.9' },
    truth: [
      ['sustained bandwidth, worked out (10,000 KB/s)', /10,000 KB\/s/],
      ['monthly transfer, worked out (25,920 GB)', /25,920 GB\/month/],
      ['concurrent workers, by Little\'s law (2)', /2 active workers/],
      ['vCPUs at 50% headroom (4)', /4 vCPUs/],
      ['memory, worked out (1,024 MB)', /1,024 MB/],
      ['domain search', /Domain search/],
      ['tiered plans (Small, Medium, Large)', /Small/],
      ['no account', /no account/i],
    ],
    askParts: {
      'domain search': [['domain input', /Domain search/], ['search control', /\bSearch\b/], ['a real registry check (RDAP)', /asks the registry of every ending[\s\S]{0,120}\bRDAP\b/], ['the result line', /whether it is registered/]],
      'tiered plans': [['Small plan', /Small/], ['Medium plan', /Medium/], ['Large plan', /Large/], ['Norwegian servers', /Servere i Norge/]],
      'capacity sizing': [['requests per second', /requests\/s/i], ['bandwidth in Mbps', /\bMbps\b/], ['monthly transfer', /GB\/month/], ['active workers', /active workers/]],
      'uptime and SLA': [['uptime', /uptime/i], ['downtime', /downtime/i], ['an SLA of 99.9%', /99\.9%/]],
      'server config': [['NGINX', /\bNGINX\b/], ['Caddy', /\bCaddy\b/], ['TLS 1.3', /TLS 1\.3/]],
    },
    facts: [
      ['domain search', /Domain search/], ['tiered plans, labelled as the rival\'s', /Name Unit's hosting plans/], ['Small', /Small/],
      ['Medium', /Medium/], ['Large', /Large/], ['Norwegian servers', /Servere i Norge/],
      ['bandwidth', /bandwidth/i], ['monthly transfer', /GB\/month/], ['vCPUs', /\bvCPUs?\b/],
      ['memory', /\bRAM\b/], ['SLA', /SLA/], ['NGINX', /\bNGINX\b/], ['Caddy', /\bCaddy\b/],
      ['TLS 1.3', /TLS 1\.3/], ['no account', /no account/i], ['works offline', /works offline/i],
      ['back to Verse', /Back to Verse/],
    ],
  },
  // wheelroot.com (2026-10-29): "Drawing Fundamentals" (line, shape, proportion, shading; daily exercises; see like an artist; progress you can see),
  // a course page whose "Begin the course" button goes nowhere. The ask opens a shared drawing: a straight line laid dot to dot, which is 100.
  'wheelroot.com': {
    site: 'https://wheelroot.com/', verse: '/learn-to-draw/',
    ask: { verse: '/learn-to-draw/?d=line&s=14461e461o461y4628462i462s4632463c463m463w4646464g464q4650465a465k465u4664466e466o466y467846' },
    truth: [
      ['a straight line laid dot to dot scores 100', /Score: 100 of 100/],
      ['its distance from the line, measured (0.0 px)', /0\.0 px from the line on average/],
      ['how much of the way it covers, measured (100%)', /100% of the way covered/],
      ['the shared drawing scored again on open', /Scored again from the link/],
    ],
    askParts: {
      'the four fundamentals': [['line', /\bLine\b/], ['shape', /\bShape\b/], ['proportion', /\bProportion\b/], ['shading', /\bShading\b/]],
      'daily exercises': [['a drill of the day', /Today's drill/], ['a streak', /Streak: \d+/], ['short drills', /8 short drills/]],
      'see like an artist': [['draw from memory', /Draw it from memory/], ['judge by eye', /Find the middle/], ['a circle by eye', /A circle by eye/]],
      'progress you can see': [['first try and best', /first try and best/i], ['a score for each drill', /of 100/], ['how each drill is scored', /How each drill is scored/]],
    },
    facts: [
      ['a course to begin', /Begin the course/], ['line', /\bLine\b/], ['shape', /\bShape\b/], ['proportion', /\bProportion\b/], ['shading', /\bShading\b/],
      ['daily exercises', /Today's drill/], ['observation (drawing from memory)', /Draw it from memory/], ['progress you can see', /first try and best/i],
      ['absolute beginners', /absolute beginners/i], ['no talent required', /No talent needed/i], ['a few minutes a day', /a few minutes a day/i],
      ['no account', /No account/], ['no cookies', /no cookies/i], ['works offline', /works offline/i], ['back to Verse', /Back to Verse/],
    ],
  },
  // onlineconverter.com (the tower target since 2026-10-29), against /converter/. The site turns this network away (403), so nothing here is
  // read from it now: the facts are its own features as its home page showed them on 2026-10-29 (domains/targets/onlineconverter.json). A
  // group Verse cannot do counts only when Verse does some of it: a group whose header says every tool is 'not on Verse yet' is not a match,
  // so the video group (27 of 27 not on Verse) never counts for Verse. The ask: 'epub to txt' finds the tool, opens it, and says it is on the page.
  'onlineconverter.com': {
    site: 'https://www.onlineconverter.com/', verse: '/converter/',
    ask: { verse: '/converter/?q=epub%20to%20txt' },
    truth: [
      ['the tool found for the ask', /EPUB to TXT/],
      ['the tool opened, ready for a file', /Ebook to TXT/],
      ['it says the tool is on the page', /TXT \(ebook\)\s*\n\s*On this page/],
      ['every tool counted, worked out from the list (106)', /106 tools: \d+ on this page, \d+ on another Verse page, \d+ in part, \d+ not on Verse yet/],
    ],
    askParts: {
      'the six groups': ['Video', 'Audio', 'Image', 'Ebook', 'Document', 'Unit'].map((g) => [g.toLowerCase() + ' tools Verse does', { test: (t) => new RegExp('\\b' + g + '\\b', 'i').test(t) && !new RegExp('\\b' + g + ' \\((\\d+)\\)\\s*\\n+\\s*\\1 not on Verse yet\\.').test(t) }]),
    },
    facts: [
      ['a video converter', { test: (t) => /\bvideo\b/i.test(t) && !/\bVideo \((\d+)\)\s*\n+\s*\1 not on Verse yet\./.test(t) }],
      ['an audio converter', /\baudio\b|\bsound\b/i], ['an image converter', /\bimage\b|\bpictures?\b/i], ['an ebook converter', /\bebooks?\b|\bEPUB\b/i],
      ['a document converter', /\bdocuments?\b|\bDOCX\b|\bPDF\b/], ['a unit converter', /\bunits?\b/i],
      ['free', /\bfree\b|\bno account\b/i], ['nothing to install', /nothing to install|no (?:software|app) to install/i],
      ['on a computer or a phone', /computer or (?:a )?(?:cell )?phone|any device/i], ['encrypted files named as not supported', /encrypted/i],
    ],
  },
  emojis: {
    site: 'https://emojitracker.com/', verse: '/emojis/',
    ask: { verse: '/emojis/?pick=🔥' },
    truth: [['a known emoji on the wall', /rocket/], ['another (a heart)', /red heart/], ['the ranking it shows', /ranked today or all time/i],
      ['the search, said on the page', /searched by name/i], ['the honest line: not a feed', /not a feed of anyone's messages/i],
      ['the fire the link picked', /\bfire\b/i], ['its Unicode, worked out', /U\+1F525/], ['its UTF-8 bytes, worked out', /F0 9F 94 A5/], ['its HTML entity, worked out', /&#128293;/]],
    facts: [
      ['emoji counts', /emoji counts/i], ['a ranked wall', /ranked wall/i], ['tap to copy', /tap one to copy/i], ['today', /\bToday\b/], ['all time', /All time/],
      ['a search', /searched by name/i], ['refreshed while open', /refresh/i], ['a closed list', /closed list/i], ['no text to send', /no text to send/i],
      ['works offline', /works offline/i], ['no account', /no account/i], ['no ads', /no ads/i], ['back to Verse', /Back to Verse/],
      ['the picked emoji, named', /\bfire\b/i], ['its Unicode', /U\+1F525/], ['its UTF-8 bytes', /F0 9F 94 A5/], ['its HTML entity', /&#128293;/],
      ['copied on this device', /Copied on this device/i], ['everyone today', /Everyone today/i], ['a share link for it', /Share this emoji/i],
      ['the stage bridge', /See it as a card on the stage/i], ['the copy format picker', /Copy as/],
    ],
  },
  // codebase (owner, 2026-10-26: "let's make codebasehq.com our next clean sweep"): Codebase is a code host with project management
  // beside it; Verse's /g/ is a gist page that keeps the work beside the code — a task list, a timer and notes on this device, with the
  // code itself only in the link. The ask arrives carrying a gist (a seeded link, the way a shared one looks), so the counts are
  codebase: {
    site: 'https://www.codebasehq.com/', verse: '/g/',
    ask: { verse: '/g/?text=hello%20world&name=notes.txt' },
    truth: [['the file it was asked to hold', /notes\.txt/], ['the text it was asked to hold', /hello world/], ['the count of characters, worked out (11)', /11 characters/], ['the line count, worked out (1)', /1 line\b/], ['where the gist lives', /whole gist in the link/i]],
    askParts: {
      'code hosting': [['a raw view', /\bRaw\b/], ['a download', /\bDownload\b/], ['a copy-link', /Copy link/], ['a share control', /Share link/], ['a GitHub file it can open', /GitHub/], ['a stated limit', /[\d,]+ characters is the limit/]],
      'ticket tracking': [['a task list', /\bTask list\b/], ['add a task', /Add a task/], ['how many are left', /\d+ of \d+ tasks left/], ['kept on the device', /on this device/]],
      'time tracking': [['a timer', /\bTimer\b/], ['start', /\bStart\b/], ['stop', /\bStop\b/], ['the time shown', /\d+ m \d+ s/], ['a total', /Total \d+ m/], ['kept on the device', /on this device/]],
      'project files and docs': [['notes and docs', /\bNotes and docs\b/], ['a preview', /\bPreview\b/], ['file sizes', /\d+ B\b/], ['download them all', /Download all/], ['the code is in the link', /whole gist in the link/i]],
    },
    facts: [
      ['no account', /no account/i], ['nothing stored', /nothing stored/i], ['a passphrase lock', /passphrase/i], ['a raw view', /\bRaw\b/],
      ['a download', /\bDownload\b/], ['a copy link', /Copy link/], ['a share control', /Share link/], ['an editable copy', /Edit a copy/],
      ['the character count', /\d+ characters/], ['the line count', /\d+ lines?\b/], ['where the gist lives', /whole gist in the link/i],
      ['a task list', /\bTask list\b/], ['add a task', /Add a task/], ['how many tasks are left', /\d+ of \d+ tasks left/],
      ['a timer', /\bTimer\b/], ['start and stop', /Start[\s\S]{0,120}Stop/], ['the time shown', /\d+ m \d+ s/], ['the total time', /Total \d+ m/],
      ['notes and docs', /\bNotes and docs\b/], ['a preview', /\bPreview\b/], ['file sizes', /\d+ B\b/], ['download them all', /Download all/],
      ['kept on this device', /on this device/], ['works offline', /works offline/i], ['a GitHub file', /GitHub/],
    ],
  },
  // automation (owner, 2026-10-28: the Zapier trial runs out; two Zaps logged the issues and pull requests of atomeam/void-loop into a Zapier table):
  // Zapier is the floor, fought from /ledger/. The question is the oldest pull requests of the repo, which never change: #1 and #2 are pull requests,
  // merged by atomeam on 2026-09-28 (05:14 and 04:57 UTC, so Sep 27 or 28 in the reader's own zone). Judged on Verse alone (the Zapier table is private).
  automation: {
    site: 'https://zapier.com/', verse: '/ledger/',
    ask: { verse: '/ledger/?tab=pr&sort=old' },
    truth: [['pull request #1 by its title', /Void side-panel extension/], ['pull request #2 by its title', /PC-free deploys/], ['who opened them', /atomeam/], ['merged, not just closed', /Merged/], ['the day they merged', /Sep 2[78], 2026/]],
    askParts: {
      'repo activity log': [['issues and pull requests apart', /Issues[\s\S]{0,80}Pull requests/], ['a search', /Search title, number, author or label/], ['a state filter', /\bState\b/], ['how many are shown', /[\d,]+ of [\d,]+ (?:issues|pull requests) shown/]],
      tables: [['a CSV download', /Download CSV/], ['a JSON download', /Download JSON/], ['copy as CSV', /Copy as CSV/], ['the view as a link', /Copy link to this view/]],
      'triggers and actions': [['a refresh that asks only for what changed', /Refresh/], ['an unchanged answer is free', /304/]],
      'app integrations': [['opens in any spreadsheet', /spreadsheet/i]],
      'scheduled runs': [['the saved copy opens offline', /opens offline/]],
    },
    facts: [
      ['issues tab', /\bIssues\b/], ['pull requests tab', /Pull requests/], ['a search', /Search title, number, author or label/], ['a state filter', /\bState\b/],
      ['an author filter', /\bAuthor\b/], ['merged shown apart from closed', /Merged/], ['a CSV download', /Download CSV/], ['a JSON download', /Download JSON/],
      ['copy as CSV', /Copy as CSV/], ['a link to the exact view', /Copy link to this view/], ['no account', /no account/i], ['no token', /no token/i],
      ['the rate limit said plainly', /60 requests an hour/], ['an unchanged answer is free', /304/], ['kept on this device', /on this device/], ['opens offline', /opens offline/],
    ],
  },
  // shopping (owner, 2026-10-26: "need a /store page that beats amazons"; and, the same day: "we should just go after smaller sites no reason to go after big
  // sites yet"): Amazon is the floor, fought from Verse's own /store/. The ask arrives carrying a cart, so the money on the page is checkable against the
  // worked-out answer and the cart opens itself; the totals are the page's own, and the payment page (Gumroad or Stripe) is said to be the final word before
  // anyone pays. Digital goods: delivery is told as steps, not tracking theatre. Judged on Verse alone (nobody buys from both sites).
  shopping: {
    site: 'https://www.amazon.com/', verse: '/store/',
    ask: { verse: '/store/?cart=void-monthly,code-review-pro:2' },
    truth: [['Verse Monthly at $49.00', /\$49\.00/], ['two Code Review Pro, $20.00 on that line', /Code Review Pro[\s\S]{0,80}Qty 2[\s\S]{0,40}\$20\.00/], ['the subtotal, $69.00', /Subtotal\s*\$69\.00/], ['the total, $69.00', /Total\s*\$69\.00/], ['the payment page is the final word before anyone pays', /before you confirm/]],
    askParts: {
      catalogue: [['keyword search', /Search products/], ['a kind filter', /Kind/], ['a sort control', /Sort/], ['how many are shown', /\d+ of \d+ products/], ['every product names its price', /\$\d/], ['availability on the card', /Available now/], ['the price list as CSV', /price list \(CSV\)/]],
      checkout: [['quantities', /Qty/], ['what one costs', /each/], ['a subtotal', /Subtotal/], ['the total', /Total\s*\$\d/], ['the payment page is the final word', /before you confirm/], ['no account needed', /no account/i], ['checkout names its provider', /Gumroad/]],
      'delivery tracking': [['digital goods, nothing ships', /nothing ships/i], ['an order code', /order code/i], ['the steps named', /Ordered[\s\S]{0,200}Support window/], ['signed downloads ready', /Signed downloads/], ['license keys', /License key/], ['links re-openable any time', /re-open them any time/]],
    },
    facts: [
      ['keyword search', /Search products/], ['a kind filter', /Kind/], ['a sort control', /Sort/], ['a count of what is shown', /\d+ of \d+ products/],
      ['prices on the products', /\$\d/], ['availability', /Available now/], ['a 3D preview', /Turn any model/], ['the changelog', /changelog/],
      ['an order lookup', /Find my order/], ['order codes', /order code/i], ['license keys', /License key/], ['signed downloads', /Signed downloads/],
      ['links that last 24 hours', /last 24 hours/], ['a receipt any time', /receipt/i], ['a cart shared as a link', /shared as a link/],
      ['the cart kept on this device', /on this device/], ['works offline', /orks offline/], ['no account', /no account/i], ['no ads', /no ads/i],
      ['no trackers', /no trackers/i], ['the payment provider credited', /Gumroad/], ['ask Verse from the page', /what can I buy/], ['support the crew', /Tip the crew/],
    ],
  },
  // travel (owner, 2026-10-26: "need a flights page"): Google Flights is the floor; Verse has no paid fare feed, so the page says so and opens the same search on the providers.
  // The question is a route with dates: New York (JFK) to Lisbon (LIS), a return a week after leaving in a month. Truth worked out by hand: the great circle is about 5,400 km
  // (3,360 miles), a typical flight about 7 hours, Lisbon is 5 hours ahead of New York. Judged on Verse alone.
  travel: {
    site: 'https://www.google.com/travel/flights', verse: '/flights/',
    ask: { verse: '/flights/?from=JFK&to=LIS&d=' + inDays(30) + '&r=' + inDays(37) },
    truth: [['about 5,400 km (JFK to LIS)', /\b5,4\d\d km\b/], ['about 3,360 miles', /\b3,3\d\d miles\b/], ['a flight of about 7 hours', /Typical flight time\s*\n?\s*[67] h/], ['Lisbon 5 hours ahead', /\+5 h 00 min ahead/], ['links to the providers', /Search on Google Flights/]],
    askParts: {
      'search across providers': [['Google Flights', /Search on Google Flights/], ['Skyscanner', /Search on Skyscanner/], ['Kayak', /Search on Kayak/], ['Momondo', /Search on Momondo/], ['Expedia', /Search on Expedia/], ['an airline\'s own site', /airline.s own site/i], ['no live fares said', /no live fares/i]],
      'price tracking': [['a price tracker', /Price tracker/], ['the lowest seen', /Lowest seen|lowest you saw/i], ['a watch with a target', /Watch a route/], ['CSV export and import', /Export CSV[\s\S]*Import CSV/]],
      itineraries: [['paste a confirmation', /Paste a confirmation text/i], ['layovers', /layover/i], ['a calendar file', /\.ics/], ['a link to the trip', /link to this trip/i]],
    },
    facts: [['airport search', /City, airport or code|From[\s\S]{0,40}To/i], ['nearby airports', /Nearby airports/i], ['one way or return', /One way[\s\S]{0,40}Return|Return[\s\S]{0,40}One way/i], ['passengers', /\bAdults\b/], ['cabin class', /\bCabin\b/], ['search on several providers', /Search across providers/i], ['distance', /\bDistance\b/], ['flight time', /Typical flight time/i], ['time difference', /Time difference/i], ['CO2', /CO2/], ['price tracking', /Price tracker/i], ['a price target', /Watch a route/i], ['an itinerary', /Trip and layovers/i], ['layover warnings', /layover/i], ['a calendar file', /\.ics/], ['on your device', /on (?:this|your) device/i], ['works offline', /\boffline\b/i], ['no account', /no account/i], ['no ads', /no ads/i], ['a share link', /Share link/i]],
  },
  // music (owner, 2026-10-26: "we have to have everything all the sites have"): the hub is Spotify's floor; each small music site has a page of its own (LANE_PAGES) and
  // its own probe and aspects (LANE_EXTRAS in lib/tower.js), because a metronome and a tuner are not judged on a catalogue. Judged on Verse alone; the truths are worked out
  // by hand (60000 / 120 = 500 ms a beat, Allegro is 120 to 156 BPM, standard guitar is E A D G B E, C major is C E G).
  music: {
    site: 'https://open.spotify.com/', verse: '/music/',
    ask: { verse: '/music/' },
    truth: [['the five music tools named', /Metronome[\s\S]*Piano[\s\S]*Tuner[\s\S]*BPM counter[\s\S]*Chords and scales/], ['the tempo word Allegro for 120 to 156 BPM', /Allegro[\s\S]{0,40}120 to 156 BPM/], ['setlists kept on the device', /setlists?[\s\S]{0,200}(?:on this device|device)/i]],
    askParts: { catalogue: [['tempo words', /tempo words/i], ['scales', /\bscales\b/i], ['chords', /\bchords\b/i], ['tunings', /\btunings\b/i]], playlists: [['playlists', /\bplaylists\b/i], ['setlists', /\bsetlists?\b/i], ['shared by link', /shared by link|copy link/i]], recommendations: [['recommendations', /\brecommendations\b/i], ['a practice ladder', /\bstart at\b[\s\S]{0,30}\bBPM\b/i], ['what chord comes next', /goes to/i]] },
    facts: [['a metronome', /\bmetronome\b/i], ['a piano', /\bpiano\b/i], ['a tuner', /\btuner\b/i], ['a BPM counter', /BPM counter/i], ['chords and scales', /chords and scales/i], ['setlists', /\bsetlists?\b/i], ['a catalogue', /\bcatalogue\b/i], ['recommendations', /\brecommendations\b/i], ['no account', /no account/i], ['on your device', /on your device|on this device/i], ['songs in the public domain', /\bpublic domain\b|songs to play/i]],
  },
  'music: metronomeonline.com': {
    site: 'https://metronomeonline.com/', verse: '/metronome/?bpm=120',
    ask: { verse: '/metronome/?bpm=120' },
    truth: [['120 BPM', /\b120\b[\s\S]{0,12}BPM/], ['Allegro, the word for 120', /\bAllegro\b/], ['500 ms between beats (60000 / 120)', /\b500 ms\b/], ['a start control', /\bStart\b/]],
    askParts: { 'tap tempo': [['a tap tempo button', /tap tempo/i], ['the T key taps', /\bT taps\b/]], accents: [['an accent on each beat', /\baccent/i], ['strong, medium, soft or silent', /strong, medium, soft or silent/i], ['the first beat accented', /accent the first beat/i]], subdivisions: [['eighth notes', /eighth notes/i], ['triplets', /triplets/i], ['sixteenth notes', /sixteenth notes/i]], 'practice timer': [['a practice timer', /practice timer/i], ['in minutes', /minutes/i]], 'light and dark mode': [['light or dark', /light or dark/i]], sounds: [['a wood block', /wood block/i], ['a hi-hat', /hi-hat/i], ['a cowbell', /cowbell/i], ['a voice count', /voice count/i]] },
    facts: [['BPM', /\bBPM\b/], ['tap tempo', /tap tempo/i], ['time signatures', /time signature/i], ['accents', /\baccents?\b/i], ['subdivisions', /subdivision/i], ['sounds', /\bsound\b/i], ['a visual beat', /visual beat/i], ['a practice timer', /practice timer/i], ['a speed trainer', /speed trainer/i], ['silent bars', /silent bars/i], ['tempo presets', /presets/i], ['setlists', /setlist/i], ['volume', /\bvolume\b/i], ['nothing leaves your device', /nothing leaves your device|on this device/i], ['works offline', /\boffline\b/i]],
  },
  'music: virtualpiano.net': {
    site: 'https://virtualpiano.net/', verse: '/piano/',
    ask: { verse: '/piano/' },
    truth: [['the white keys on the computer keys 1 2 3 4 5 6 7 8 9 0 q w e r t y', /1 2 3 4 5 6 7 8 9 0 q w e r t y/], ['Shift for a sharp', /\bShift\b[\s\S]{0,20}sharp/i], ['middle C named C4', /\bC4\b[\s\S]{0,12}middle C/i]],
    askParts: { 'computer keyboard play': [['the key letters', /1 2 3 4 5 6 7 8 9 0 q w e r t y/], ['Shift for a sharp', /\bShift\b/]], 'touch and mouse play': [['tap or click the keys', /tap or click/i], ['a touch screen', /touch screen/i]], sustain: [['a sustain pedal', /sustain/i], ['the space bar', /space bar/i]], instruments: [['a grand piano', /grand piano/i], ['an organ', /\borgan\b/i], ['strings', /\bstrings\b/i]], 'sheet music': [['sheets', /\bsheets?\b/i], ['plain letters', /plain letters/i], ['a song: Ode to Joy', /ode to joy/i]], 'MIDI input': [['a MIDI keyboard', /MIDI keyboard/i]] },
    facts: [['the computer keyboard', /computer keyboard|computer key/i], ['touch', /touch screen/i], ['a sustain pedal', /sustain/i], ['instruments', /\binstrument\b/i], ['sheets', /\bsheets?\b/i], ['record', /\brecord/i], ['reverb', /\breverb\b/i], ['transpose', /\btranspose\b/i], ['MIDI', /\bMIDI\b/], ['key labels', /computer key on each note|key labels/i], ['an octave shift', /\boctave\b/i], ['works offline', /\boffline\b/i]],
  },
  'music: jasperbernaers.com': {
    site: 'https://jasperbernaers.com/free-online-guitar-tuner-and-instrument-tuner/', verse: '/tuner/',
    ask: { verse: '/tuner/' },
    truth: [['standard guitar tuning E A D G B E', /E A D G B E/], ['the A4 reference of 440 Hz', /\b440\b/], ['cents', /\bcents?\b/i], ['a microphone', /\bmicrophone\b/i]],
    askParts: { 'microphone tuning': [['a microphone', /\bmicrophone\b/i], ['cents flat or sharp', /\bcents\b[\s\S]{0,40}\b(?:flat|sharp)\b|\b(?:flat|sharp)\b[\s\S]{0,40}\bcents\b/i], ['in tune within 5 cents', /within 5 cents/i]], 'instrument presets': [['guitar', /\bguitar\b/i], ['bass', /\bbass\b/i], ['ukulele', /\bukulele\b/i], ['violin', /\bviolin\b/i]], 'reference tones': [['reference tones', /reference tones?/i], ['a pitch pipe', /pitch pipe/i]], 'adjustable A4': [['an A4 reference', /\bA4\b/], ['in Hz', /\bHz\b/]] },
    facts: [['a microphone', /\bmicrophone\b/i], ['cents', /\bcents\b/i], ['guitar', /\bguitar\b/i], ['bass', /\bbass\b/i], ['ukulele', /\bukulele\b/i], ['violin', /\bviolin\b/i], ['alternate tunings', /drop d|dadgad|open g/i], ['an adjustable A4', /\bA4\b/], ['reference tones', /reference tones?/i], ['a pitch pipe', /pitch pipe/i], ['nothing recorded or sent', /nothing is recorded or sent|never leaves your device/i], ['works offline', /\boffline\b/i]],
  },
  'music: anotherproducer.com': {
    site: 'https://anotherproducer.com/online-tools-for-musicians/bpm-counter/', verse: '/bpm/',
    ask: { verse: '/bpm/' },
    truth: [['a quarter note lasts 500 ms at 120 BPM', /\b500\b/], ['a dotted quarter lasts 750 ms', /\b750\b/], ['a quarter-note triplet lasts 333.33 ms', /\b333\.33\b/], ['an eighth lasts 250 ms', /\b250\b/]],
    askParts: { 'tap tempo counter': [['a tap button', /tap here/i], ['any key', /any key/i], ['an average of the last taps', /average the last/i]], 'half and double time': [['half time', /half time/i], ['double time', /double time/i]], 'note lengths': [['milliseconds', /\bms\b/], ['dotted notes', /\bdotted\b/i], ['triplets', /\btriplet\b/i], ['Hz', /\bHz\b/]], 'tempo of a file': [['an audio file', /audio file/i], ['not uploaded', /not uploaded|nothing is uploaded/i]] },
    facts: [['tap tempo', /\btap\b/i], ['any key', /any key/i], ['half and double', /half time[\s\S]*double time/i], ['a reset', /\breset\b/i], ['average of the last taps', /average the last/i], ['a click on each tap', /click on each tap/i], ['note lengths in ms', /\bms\b/], ['song length in bars', /\bbars\b/i], ['the tempo of a file', /audio file/i], ['nothing uploaded', /not uploaded|nothing is uploaded/i]],
  },
  'music: chordchord.com': {
    site: 'https://chordchord.com/chord-finder', verse: '/chords/',
    ask: { verse: '/chords/' },
    truth: [['C major is C E G', /\bC E G\b/], ['C major scale C D E F G A B', /C D E F G A B/], ['the open C chord shape x 3 2 0 1 0', /x 3 2 0 1 0/], ['Am (vi) among the chords of C major', /\bvi\b[\s\S]{0,12}\bAm\b/]],
    askParts: { 'chord finder': [['a chord finder', /chord finder/i], ['inversions', /inversion/i], ['naming a chord from notes', /which chord is this/i]], 'scale finder': [['a scale finder', /scale finder/i], ['Dorian', /\bdorian\b/i], ['the notes of the scale', /C D E F G A B/]], 'guitar and piano shapes': [['guitar fingerings', /guitar fingerings/i], ['an open shape', /x 3 2 0 1 0/], ['a piano keyboard', /piano keyboard/i]], 'chords in a key': [['roman numerals', /\bvii°/], ['the circle of fifths', /circle of fifths/i], ['progressions', /progressions/i]] },
    facts: [['chord finder', /chord finder/i], ['scale finder', /scale finder/i], ['guitar fingerings', /guitar fingerings/i], ['a piano keyboard', /piano keyboard/i], ['inversions', /inversion/i], ['a chord named from notes', /which chord is this/i], ['chords in a key', /chords in this key/i], ['seventh chords', /seventh chords/i], ['progressions', /progressions/i], ['the circle of fifths', /circle of fifths/i], ['a transposer', /transpose/i], ['plays the chord', /play the chord/i]],
  },
  // neuralframes.com's rap lyrics generator (owner, 2026-10-29: "Verse should learn to rap for those who hear the name and think thats what it is"): topic,
  // style, flow, mood, perspective and words to include, then two verses and a hook. The ask opens a rap carried whole in its link (RAP_LINK, written for
  // this probe, never shown as the page's own), so no model is called and the truths are counted by Verse alone: 20 bars in 3 parts, 18 ending on a
  // rhyme, boom bap at 90 BPM (lib/rap.js, checked in tools/rap.test.mjs).
  'music: neuralframes.com': {
    site: 'https://www.neuralframes.com/tools/rap-lyrics-generator', verse: '/rap/',
    ask: { verse: RAP_LINK },
    truth: [['the rap opened from its link', /Opened from its link, exactly as it was written/], ['20 bars in 3 parts', /20 bars in 3 parts/], ['18 of 20 bars rhyme at the end', /18 of 20 bars end on a rhyme/], ['boom bap at 90 BPM', /Boom bap · confident · 90 BPM/]],
    askParts: {
      'rap styles': [['boom bap', /Boom bap/i], ['trap', /\bTrap\b/i], ['drill', /\bDrill\b/i], ['melodic', /\bMelodic\b/i], ['conscious', /\bConscious\b/i]],
      'mood and flow': [['moods', /Confident[\s\S]*Hungry[\s\S]*Reflective[\s\S]*Party[\s\S]*Gritty/], ['flows', /Double time/], ['perspective', /First person/], ['words to work in', /Words or ad-libs to work in/]],
      'verses and hook': [['a first verse', /Verse 1/i], ['a hook', /\bHook\b/i], ['a second verse', /Verse 2/i], ['the rhyme scheme', /end on a rhyme/]],
      'perform it': [['perform over a beat', /Perform it/], ['rap it yourself', /Rap it yourself/], ['save the beat', /Save the beat/], ['copy the lyrics', /Copy the lyrics/]],
    },
    facts: [['a topic', /What should the rap be about/], ['styles', /Boom bap/], ['moods', /Confident/], ['flows', /Laid back/], ['perspective', /Perspective/], ['words to include', /Words or ad-libs/], ['write', /Write my rap/],
      ['verses and a hook', /\bHook\b/i], ['copy the lyrics', /Copy the lyrics/], ['another take', /Another take/], ['share the whole rap', /Share this rap/], ['perform it', /Perform it/], ['save the beat', /Save the beat/], ['no account', /no account/i], ['back to Verse', /Back to Verse/]],
  },
  podcasts: {
    site: 'https://podcasts.apple.com/', verse: '/podcasts/?show=verse&ep=ep1',
    // the question: open Verse Out Loud's first episode from a link. A page that only loaded shows its title and a search box; a page that works shows
    // a REAL episode row (title, length and notes read from the show's own episode file), and an audio element that has loaded its file and read the
    // length from it ("Ready to play · 3:24" is written from the element's duration, never from the feed). Judged on Verse alone (the site is not
    // asked); the same probe measures every site in the podcasts lane (lib/tower.js LANES). The fixture is Verse-hosted and stable (episode 1 is
    // append-only, /podcast/episodes.json and its mp3), so a red row is the page's fault, not a feed's
    ask: { verse: '/podcasts/?show=verse&ep=ep1' },
    truth: [['the show', /Verse Out Loud/], ['a real episode row', /Episode 1: the week to October 22, 2026/], ['its length in the row', /\b3 min\b/], ['its notes', /Verse.s week from 2026-10-15 to 2026-10-22/], ['an audio element with its length read', /Ready to play · 3:2\d\b/]],
    // the directory: a search at an address of its own must show real rows from Apple's free directory (a title line, then "author · genre"), not "Searching…"
    pageParts: { catalogue: { verse: '/podcasts/?q=history', items: [['real results from the directory', /Results for "history"\s*\n[^\n]{3,}\n[^\n]+ · [^\n]+/], ['paste any RSS link', /\bRSS link\b/i]] } },
    // what the best podcast apps show: search, a feed link, episodes with their lengths and notes, follow and a list of new episodes, a queue, speed, skip,
    // a sleep timer, a transcript, saved episodes for offline, share. Chapters need a feed that has them, so they are not claimed from this page
    facts: [['search any show', /\bsearch podcasts\b/i], ['paste an RSS link', /\bRSS link\b/i], ['episode lengths', /\b\d+ min\b/], ['show notes', /\bnotes\b/i], ['follow a show', /\bFollow\b/], ['a new-episodes list', /\bNew episodes\b/], ['a queue', /\bqueue\b/i], ['playback speed', /\bSpeed\b/],
      ['skip back and forward', /15[\s\S]{0,80}30/], ['a sleep timer', /\bSleep timer\b/], ['a transcript', /\bTranscript\b/], ['saved for offline', /\bDownload\b/], ['share', /\bShare\b/], ['works offline', /\boffline\b/i]],
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
  photos: {
    site: 'https://photos.google.com/', verse: '/photos/',
    // the page answers once a picture is put in, so the gate chooses its own one-pixel PNG (tower-gate.mjs PIXEL), as the photo resizer's does. The truth by
    // arithmetic: it is one pixel by one pixel, the page names its size before and after in bytes, and (the format being kept) says PNG. Judged on Verse alone
    // (a photo sites' own pages are not asked); the same probe measures every site in the photos lane (lib/tower.js LANES: squoosh.app, photopea.com,
    // tinypng.com, exif.tools, exifeditor.io, iloveimg.com)
    ask: { site: 'https://squoosh.app/', verse: '/photos/', verseFile: true },
    truth: [['the picture is 1 by 1 pixel', /\b1 [×x] 1 px\b/], ['its size before and after, in bytes', /\b\d+ B → \d+ B\b/], ['the format named', /\bPNG\b/]],
    askParts: {
      editing: [['crop', /\bcrop\b/i], ['rotate', /\brotate\b/i], ['adjust', /\badjust\b/i], ['filters', /\bfilters?\b/i], ['draw', /\bdraw\b/i], ['text', /\btext\b/i], ['undo', /\bundo\b/i]],
      'compress and convert': [['a quality choice', /\bquality\b/i], ['JPEG', /\bjpeg\b/i], ['WebP', /\bwebp\b/i], ['PNG', /\bpng\b/i], ['the size saved', /\b\d+% (?:saved|bigger)\b|\bthe same size\b/i], ['a resize', /\bwidth\b/i], ['before and after', /\boriginal\b[\s\S]{0,80}\bresult\b/i]],
      'metadata and privacy': [['EXIF', /\bexif\b/i], ['strip metadata', /\bstrip metadata\b/i]],
    },
    // what the lane's sites show between them (squoosh: formats, a quality slider, a compare slider, resize, offline; tinypng: PNG colours, batch, the saving; exif.tools and
    // exifeditor.io: EXIF and GPS viewer, strip, nothing uploaded; iloveimg: crop, rotate, convert, filters, text; photopea: adjustments, filters, text, drawing, history)
    facts: [['JPEG', /\bjpeg\b/i], ['PNG', /\bpng\b/i], ['WebP', /\bwebp\b/i], ['AVIF', /\bavif\b/i], ['a quality slider', /\bquality\b/i], ['a before and after slider', /\bbefore and after\b/i], ['the size saved', /\bsize saved\b|\bsaved\b/i], ['resize', /\bresize\b/i], ['crop with shapes', /\bcrop\b/i], ['rotate and flip', /\brotate\b[\s\S]{0,12}\bflip\b/i],
      ['brightness and contrast', /\bbrightness\b[\s\S]{0,20}\bcontrast\b/i], ['saturation', /\bsaturation\b/i], ['blur and sharpen', /\bblur\b[\s\S]{0,12}\bsharpen\b/i], ['filters', /\bfilters\b/i], ['text', /\btext\b/i], ['drawing', /\bdrawing\b/i], ['undo and redo', /\bundo\b[\s\S]{0,12}\bredo\b/i], ['EXIF', /\bexif\b/i], ['GPS', /\bgps\b/i], ['strip metadata', /\bstrip\b/i], ['batch to a zip', /\bzip\b/i], ['paste or drop', /\bpaste\b[\s\S]{0,12}\bdrop\b|\bdrop\b[\s\S]{0,40}\bpaste\b/i], ['nothing uploaded', /nothing is uploaded|never uploaded/i], ['works offline', /\boffline\b/i]],
  },
  photos: {
    site: 'https://photos.google.com/', verse: '/photos/',
    // the page answers once a picture is put in, so the gate chooses its own one-pixel PNG (tower-gate.mjs PIXEL), as the photo resizer's does. The truth by
    // arithmetic: it is one pixel by one pixel, the page names its size before and after in bytes, and (the format being kept) says PNG. Judged on Verse alone
    // (a photo sites' own pages are not asked); the same probe measures every site in the photos lane (lib/tower.js LANES: squoosh.app, photopea.com,
    // tinypng.com, exif.tools, exifeditor.io, iloveimg.com)
    ask: { site: 'https://squoosh.app/', verse: '/photos/', verseFile: true },
    truth: [['the picture is 1 by 1 pixel', /\b1 [×x] 1 px\b/], ['its size before and after, in bytes', /\b\d+ B → \d+ B\b/], ['the format named', /\bPNG\b/]],
    askParts: {
      editing: [['crop', /\bcrop\b/i], ['rotate', /\brotate\b/i], ['adjust', /\badjust\b/i], ['filters', /\bfilters?\b/i], ['draw', /\bdraw\b/i], ['text', /\btext\b/i], ['undo', /\bundo\b/i]],
      'compress and convert': [['a quality choice', /\bquality\b/i], ['JPEG', /\bjpeg\b/i], ['WebP', /\bwebp\b/i], ['PNG', /\bpng\b/i], ['the size saved', /\b\d+% (?:saved|bigger)\b|\bthe same size\b/i], ['a resize', /\bwidth\b/i], ['before and after', /\boriginal\b[\s\S]{0,80}\bresult\b/i]],
      'metadata and privacy': [['EXIF', /\bexif\b/i], ['strip metadata', /\bstrip metadata\b/i]],
    },
    // what the lane's sites show between them (squoosh: formats, a quality slider, a compare slider, resize, offline; tinypng: PNG colours, batch, the saving; exif.tools and
    // exifeditor.io: EXIF and GPS viewer, strip, nothing uploaded; iloveimg: crop, rotate, convert, filters, text; photopea: adjustments, filters, text, drawing, history)
    facts: [['JPEG', /\bjpeg\b/i], ['PNG', /\bpng\b/i], ['WebP', /\bwebp\b/i], ['AVIF', /\bavif\b/i], ['a quality slider', /\bquality\b/i], ['a before and after slider', /\bbefore and after\b/i], ['the size saved', /\bsize saved\b|\bsaved\b/i], ['resize', /\bresize\b/i], ['crop with shapes', /\bcrop\b/i], ['rotate and flip', /\brotate\b[\s\S]{0,12}\bflip\b/i],
      ['brightness and contrast', /\bbrightness\b[\s\S]{0,20}\bcontrast\b/i], ['saturation', /\bsaturation\b/i], ['blur and sharpen', /\bblur\b[\s\S]{0,12}\bsharpen\b/i], ['filters', /\bfilters\b/i], ['text', /\btext\b/i], ['drawing', /\bdrawing\b/i], ['undo and redo', /\bundo\b[\s\S]{0,12}\bredo\b/i], ['EXIF', /\bexif\b/i], ['GPS', /\bgps\b/i], ['strip metadata', /\bstrip\b/i], ['batch to a zip', /\bzip\b/i], ['paste or drop', /\bpaste\b[\s\S]{0,12}\bdrop\b|\bdrop\b[\s\S]{0,40}\bpaste\b/i], ['nothing uploaded', /nothing is uploaded|never uploaded/i], ['works offline', /\boffline\b/i]],
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
  'formula calculators': {
    site: 'https://www.vcalc.com/', verse: '/calculators/',
    // vcalc.com's robots.txt asks robots not to read it, so accuracy is Verse against the worked-out answer: the outside area of a pipe 2 inches
    // across and 10 feet long, pi x d x l = pi x (2/12 ft) x 10 ft = 5.235988 ft², and the same area in square metres (0.4864390 m²) and square
    // inches (753.9822 in²), the units a page that is unit-aware shows beside it
    ask: { verse: '/calculators/?calc=pipe-surface-area&d=2&d.u=in&l=10&l.u=ft' },
    truth: [['5.23599 ft²', /(?<![\d.])5\.2359\d*\s*ft²/], ['0.486439 m²', /(?<![\d.])0\.48643\d*\s*m²/], ['753.982 in²', /(?<![\d.])753\.98\d*\s*in²/]],
    askParts: {
      // the library: each kind of calculator the best formula sites keep, named as a section of the page
      'formula library': [['everyday', /\bEveryday\b/i], ['maths', /\bMath(?:s|ematics)?\b/i], ['geometry', /\bGeometry\b/i], ['statistics', /\bStatistics\b/i], ['physics', /\bPhysics\b/i],
        ['chemistry', /\bChemistry\b/i], ['electrical', /\bElectrical\b|\bElectricity\b/i], ['health', /\bHealth\b/i], ['dates', /\bDays between two dates\b/i], ['more than 100 calculators', /\bAll calculators \((?:[1-9]\d{2,})\)/i]],
      // unit-aware: every input offers the units of its kind, the answer in any unit, the same answer in every other unit, the formula and its working
      'unit-aware inputs': [['each input takes a unit of its kind', /Diameter of pipe\s*\n\s*m \(metres\)[\s\S]*?in \(inches\)[\s\S]*?ft \(feet\)/], ['the answer in any unit', /\bShow in\b/], ['every other unit', /\bIn other units\b/], ['the formula in its symbols, with the working', /A = π × d × l[\s\S]*\bWorking\b/], ['square metres beside square feet', /\bm²[\s\S]*\bft²|\bft²[\s\S]*\bm²/]],
      // a formula of your own: guided rows or the raw text, with units, kept on the device and shared by a link
      'custom formulas': [['build your own formula', /\bBuild your own formula\b/i], ['a guided mode', /\bGuided\b/], ['a raw mode', /\bRaw\b/], ['saved on the device', /\bSave on this device\b/i], ['shared by a link', /\bShare formula link\b/i]],
      // the library's size against what vcalc.com publishes (owner, 2026-10-28: not beaten while the count is short, the gap shown): the page's own
      // "All calculators (N)" read off the answer, held to the floor's rivalCount, so this fails, honestly, until Verse has as many
      'library size': [[LIBRARY_GAP, (t) => libraryCount(t) >= RIVAL_N]],
    },
    // what a full formula library offers: the everyday sums, the sciences, units, the working, and a way out (share, export) and in (your own)
    facts: [['percent', /\bpercent/i], ['tip', /\btip\b/i], ['loan', /\bloan\b/i], ['BMI', /\bBMI\b/], ['date maths', /\bdays between\b|\bdate\b/i], ['unit conversion', /\bconver/i], ['area', /\barea\b/i],
      ['physics', /\bPhysics\b/i], ['chemistry', /\bChemistry\b/i], ['electrical', /\bOhm/], ['geometry', /\bGeometry\b/i], ['statistics', /\bStatistics\b/i], ['the formula shown', /\b\w+ = [^\n]*[×÷+−^√π]/],
      ['a share link', /\bShare link\b/i], ['copy the answer', /\bCopy answer\b/i], ['export', /\bExport\b/i], ['a custom formula', /\bBuild your own formula\b/i], ['works offline', /\boffline\b/i]],
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
  // sycophanthex.com (the tower target since 2026-10-29), against /fanfic/. The site turns this network away (403), so nothing here is read
  // from it now: the facts are its own catalog features as its public pages showed them on 2026-10-29 (domains/targets/sycophanthex.json,
  // features), and the truth is worked out here. The question: a draft put in the Writing Room by its own share link (the link holds the draft,
  // nothing is posted, so no story is ever seeded): FIC_TEXT is 18 words as a word processor counts them (13 in the first two sentences, then
  // Hermione's, half-blood, friend, didn't, wait: an apostrophe or a hyphen inside a word keeps it one word), and the draft keeps its title.
  'sycophanthex.com': {
    site: 'https://sycophanthex.com/', verse: '/fanfic/',
    ask: { site: 'https://sycophanthex.com/', verse: '/fanfic/?v=room#' + roomHash(FIC_TITLE, FIC_TEXT) },
    truth: [['18 words', /(?<![\d,])18\s+words?\b/i], ['the title kept', new RegExp(FIC_TITLE)]],
    // one fact for each feature the archive's own pages show, read on the archive's front page as a reader sees it. An empty catalog shows no
    // story rows, so the row facts (words, chapters, hits, reviews) count only when real stories are there: they are never seeded
    facts: [['a catalog row for each story, with its words', /(?<![\d,])\d[\d,]*\s+words\b/i], ['browse by fandom or category', /\bfandoms?\b|\bcategor(?:y|ies)\b/i],
      ['browse by character', /\bcharacters?\b/i], ['browse by genre', /\bgenres\b|\bby genre\b|\bgenre\s*:/i], ['browse by rating', /\bratings?\b|\brated\b/i], ['content warnings', /\bwarnings?\b/i],
      ['an author list', { test: (t) => /\b(?:all|browse|list of|index of)\s+authors\b|\bauthors?\s+(?:a\s*to\s*z|index|list)\b/i.test(t) || /^Authors$/m.test(t) }], // a menu link; the site-info count "0 AUTHORS" is a number, not a list
      ['a title index A to Z', /\bA\s*(?:to|-|–)\s*Z\b/], ['sort the list', /\bsort\b|\balphabetical(?:ly)?\b/i],
      ['completed or in progress', { test: (t) => /\bcomplete(?:d)?\b/i.test(t) && /\bin progress\b|\bWIP\b/.test(t) }], ['pages of stories', /\bpage\s+\d+\s+of\s+\d+\b|\bnext page\b/i],
      ['series', /\bseries\b/i], ['chapters, words and hits on each story', { test: (t) => /\bchapters?\b/i.test(t) && /(?<![\d,])\d[\d,]*\s+words\b/i.test(t) && /\bhits\b|\bviews\b|\breads\b/i.test(t) }],
      ['reviews and a star rating', { test: (t) => /\breviews?\b/i.test(t) && /\bstars?\b|★/i.test(t) }], ['report a story', /\breport\b[^\n]{0,40}\b(?:story|this|spam|abuse)\b/i],
      ['keyword search', /\bsearch\b/i], ['most recent stories and a feed of them', { test: (t) => /\bmost recent\b/i.test(t) && /\bRSS\b|\bfeeds?\b/i.test(t) }],
      ['a random or featured story', /\brandom story\b|\bfeatured story\b/i], ['an account: register and log in', /\bregister\b|\blog ?in\b|\bsign ?(?:in|up)\b/i],
      ['rules, help, ratings and upload guides', { test: (t) => /\brules\b/i.test(t) && /\bhelp\b|\bhow to\b|\bquick start\b/i.test(t) && /\bratings?\b/i.test(t) }],
      ['site news', /\bnews\b|\bannouncements?\b/i], ['featured story lists', /\bfeatured (?:fics|stories|lists?)\b|\brecommended (?:stories|reads)\b|\brec lists?\b/i],
      ['writing contests', /\bcontests?\b|\bchallenges?\b/i], ['archives by subject', /\barchives?\b/i],
      ['forums and a help desk', { test: (t) => /\bforums?\b|\bboards\b/i.test(t) && /\bhelp desk\b|\bhelp\b|\bsupport\b/i.test(t) }],
      ['staff, contact, terms and credits pages', /\bterms\b|\bprivacy\b|\bcontact\b|\bcredits\b/i]],
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
// the news floor's rows: "<source> · <age>" lines as the news page prints them (lib/news.js SOURCES names), read off a page's visible text. Pure.
const NEWS_SOURCES = 'BBC News|The Guardian|NPR|Al Jazeera|DW|France 24|CBS News|ABC News Australia|Sky News|Euronews|RNZ|Ars Technica|The Verge|Hacker News|Nature|NASA|ScienceDaily|Africanews|El País|Le Monde|Tagesschau|Der Spiegel|RFI';
/** every "Source · 3 h ago" line in a text: [source, ...]. */
export const rowsIn = (t) => [...String(t || '').matchAll(new RegExp('(' + NEWS_SOURCES + ') · (?:just now|\\d+ (?:min|h|d) ago)', 'g'))].map((m) => m[1]);
/** how many different sources those rows name. */
export const distinctRows = (t) => new Set(rowsIn(t)).size;
export const PARTS = Object.freeze({ news: { 'breadth of sources': [['several sources', /\bsources\b/i]], freshness: [['ages', /\b\d+\s?(?:min|minutes?|h|hours?) ago\b|\bjust now\b|\bupdated\b/i]], 'topic following': [['follow', /\bfollow(?:ing)?\b/i], ['my news', /\bmy news\b/i]] }, 'docs and notes': { 'rich formatting': [['bold', /\bbold\b/i], ['headings', /\bheadings?\b/i], ['lists', /\blists?\b/i]], search: [['search across notes', /\bsearch\b/i]], 'version history': [['version history', /\bversion history\b/i]] }, colour: COLOUR_PARTS, 'colour codes': COLOUR_PARTS,
  gradient: { 'stops with opacity': [['colour stops', /\bstops?\b/i], ['opacity', /\bopacity\b/i]], 'import css': [['import', /\bimport\b|\bpaste\b/i]], presets: [['presets', /\bpresets?\b/i]] },
  'base converter': { 'signed reading': [['a signed reading', /\bsigned\b|two.?s complement/i]], 'all four bases': [['binary', /\bbinary\b/i], ['octal', /\boctal\b/i], ['decimal', /\bdecimal\b/i], ['hexadecimal', /\bhex/i]] },
  'coin flip': { 'flip history': [['a running count', /\b\d+\s+(?:flips?|heads|tails)\b|\bheads\s*:?\s*\d+|\btails\s*:?\s*\d+/i]] },
  translate: { 'language count': [['100 languages', /\b100 languages\b/i]], 'speech in and out': [['listen', /\blisten\b/i], ['speak', /\bspeak\b/i]], 'camera text': [['camera', /\bcamera\b/i]] },
  recipes: { 'search by ingredient': [['search by ingredient', /by ingredient|what can i make/i]], scaling: [['servings to scale', /\bservings?\b|\bscale\b/i]], 'step mode': [['one step at a time', /step mode|cook mode|one step/i], ['timers', /\btimers?\b/i]] },
  finance: { 'live quotes': [['a price with its move in percent', /[+−]\d+\.\d{2}%\) today/], ['the source named', /Source: (?:Stooq|Yahoo|CoinGecko|ECB)/]], charts: [['ranges from 1D to Max', /\b1D\b[\s\S]{0,40}\b5D\b[\s\S]{0,60}\bYTD\b[\s\S]{0,40}\b5Y\b[\s\S]{0,20}\bMax\b/], ['a hover readout', /Move across the chart/i]], watchlists: [['a watchlist', /\bwatchlist\b/i], ['kept on the device', /on this device/i]] },
  'image boards': { catalog: [['a catalog', /\bcatalog\b/i]], 'replies and quoting': [['replies', /\brepl(?:y|ies)\b/i], ['quotes', /\bquot(?:e|es|ing)\b|>>\d/i]], 'image posts': [['pictures', /\bpictures?\b|\bimages?\b/i]], archive: [['an archive', /\barchive\b/i]] },
  'random generators': { 'generator catalogue': [['a count of generators', /\b\d{2,} generators\b|catalogue/i]], 'make your own generator': [['make your own', /make your own/i]] }, // 'image generation', 'list language' and 'publish and remix' are pageParts: a real picture, a working engine
  calendar: { reminders: [['reminders', /\bremind/i], ['notifications on the device', /\bnotification/i]], invites: [['invites', /\binvite/i], ['the .ics', /\.ics\b/i]], 'recurring events': [['repeats', /\brepeat|\brecurr|\bevery (?:day|week|month|year)\b/i]] },
  podcasts: { subscriptions: [['follow a show', /\bFollow\b/], ['the shows you follow', /\bFollowing\b/], ['new episodes of those shows', /\bNew episodes\b/]], 'playback controls': [['speed', /\bSpeed\b/], ['skip back and forward', /15[\s\S]{0,80}30/], ['a sleep timer', /\bSleep timer\b/], ['a queue', /\bqueue\b/i], ['an audio element that read its length', /Ready to play · \d+:\d{2}/]] },
  pdf: { 'merge and split': [['merge', /\bmerge\b/i], ['split', /\bsplit\b/i]], 'page tools': [['rotate', /\brotate\b/i], ['delete pages', /\bdelete\b|\bremove\b/i], ['reorder', /\breorder\b|\bdrag\b/i]], 'images to pdf': [['images to PDF', /\bimages?\b[\s\S]{0,20}\bPDF\b/i]], compress: [['compress', /\bcompress/i]] },
  kanban: { 'boards and columns': [['boards', /\bboards?\b/i], ['columns', /\bcolumns?\b|\blists?\b/i]], 'card details': [['labels', /\blabels?\b/i], ['due dates', /\bdue\b/i], ['checklists', /\bchecklists?\b/i]], 'drag and drop': [['drag', /\bdrag\b/i]], 'import and export': [['export', /\bexport\b/i], ['import', /\bimport\b/i]] },
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
// a lane site with a page of its own may ask its own question (owner, 2026-10-26: every lane site gets its own page, gated against it): the keys it gives replace the leader's
// (ask, truth, askParts, pageParts, parts, facts); what it leaves out is the leader's. thesportsdb.com is a sports database: its page browses by sport, searches across all of
// them (teams, events, venues, players), lists who was born on this day and says its API is free; the question is a search for Arsenal, which any sports database answers
// with the club, its league and its sport. Truth worked out by hand, judged on Verse alone.
const LANE_PROBES = Object.freeze({
  // the travel lane (owner, 2026-10-26: "need a flights page"): each site has a page of its own (LANE_PAGES) and the question that page answers. Truths worked out by hand
  // (London to New York is 5,540 km and 3,442 miles; London to Singapore 10,880 km; a 40 minute wait is under 45 minutes; Lisbon's ICAO code is LPPT).
  'travel: tripwaffle.com': {
    ask: { verse: '/flights/trip/#trip=' + ASK_TRIP },
    truth: [['both flights listed', /BA 117[\s\S]{0,400}UA 904/], ['the wait of 40 minutes at New York', /Wait: 40 min/], ['a warning for a wait under 45 minutes', /Under 45 minutes/], ['the whole trip time', /from the first departure to the last arrival/]],
    askParts: { 'paste a confirmation': [['a box to paste', /Paste a confirmation text/i], ['a button to read the flights', /Read the flights/i]], 'day by day timeline': [['your flights in order', /Your flights in order/i], ['times', /\d\d:\d\d/], ['dates', /20\d\d-\d\d-\d\d/]], 'layover warnings': [['a wait', /Wait: \d/], ['tight or too short', /Under 45 minutes|Under an hour/], ['an overnight or long wait', /overnight|long wait/i]], 'calendar export': [['a calendar file', /\.ics/], ['for my calendar', /calendar/i]], 'share a trip': [['a link to this trip', /link to this trip/i]], 'works offline': [['offline', /\boffline\b/i], ['on this device', /on this device/i]] },
    pageParts: {}, parts: {},
    facts: [['paste a confirmation', /Paste a confirmation/i], ['flights read from text', /Read the flights/i], ['add a flight by hand', /Add a flight by hand/i], ['a booking reference', /Booking reference/i], ['local times', /Departs \(local\)/i], ['layovers', /Wait: /], ['layover warnings', /Under 45 minutes|Under an hour|overnight/i], ['airport changes', /airport/i], ['a calendar file', /\.ics/], ['a share link', /link to this trip/i], ['on this device', /on this device/i], ['works offline', /\boffline\b/i], ['no account', /no account/i]],
  },
  'travel: aruljohn.com': {
    ask: { verse: '/flights/airports/?code=LIS' },
    truth: [['LIS is Lisbon', /Lisbon/], ['its ICAO code LPPT', /LPPT/], ['its IATA code', /\bIATA\b/], ['its time zone Europe/Lisbon', /Europe\/Lisbon/]],
    askParts: { 'code lookup': [['IATA codes', /\bIATA\b/], ['ICAO codes', /\bICAO\b/]], 'search by city or country': [['a search for a city, name, country or code', /City, airport name, country or code/i]], 'airport details': [['a position', /Position/], ['a time zone', /Time zone/], ['a size', /large airport|medium airport|small airport/]], 'nearby airports': [['nearby airports', /Nearby airports:/]] },
    pageParts: {}, parts: {},
    facts: [['IATA codes', /\bIATA\b/], ['ICAO codes', /\bICAO\b/], ['search by city', /\bcity\b/i], ['search by country', /\bcountry\b/i], ['the position', /Position/], ['the time zone', /Time zone/], ['the time there now', /\bnow\b/i], ['nearby airports', /Nearby airports/i], ['other airports of the city', /same city/i], ['fly from or to here', /Fly from here/i], ['works offline', /\boffline\b/i], ['no account', /no account/i]],
  },
  'travel: clock7.com': {
    ask: { verse: '/flights/time/?from=JFK&to=LHR&d=' + inDays(30) },
    truth: [['JFK to LHR', /JFK → LHR/], ['a flight of about 7 hours', /\b7 h \d{2} min/], ['London 5 hours ahead', /\+5 h 00 min ahead/], ['arrives the next day', /\+1 day/]],
    askParts: { 'flight duration': [['a typical flight time', /Typical|\b\d h \d{2} min/i], ['the distance', /\bkm\b/]], 'local arrival time': [['arrives in local time', /Arrives[\s\S]{0,60}local/i], ['a time at the destination', /\d\d:\d\d local/]], 'time zone difference': [['a time difference', /Time difference/i], ['ahead of the departure city', /ahead of the departure city|behind the departure city/]], 'date line': [['the date line', /date line/i]], layover: [['a stop on the way', /Stop on the way/i], ['the wait at the stop', /Wait at the stop/i]] },
    pageParts: {}, parts: {},
    facts: [['from and to', /From[\s\S]{0,60}To/], ['a departure date', /Depart/], ['a departure time', /Departure time/i], ['flight duration', /Typical flight time|\b\d h \d{2} min/], ['local arrival time', /Arrives/], ['the time difference', /Time difference/i], ['the date line', /date line/i], ['a layover', /Wait at the stop/i], ['the whole journey', /door to door|whole journey/i], ['daylight saving on the date', /UTC[+−]\d/], ['works offline', /\boffline\b/i], ['no account', /no account/i]],
  },
  'travel: airmilescalculator.com': {
    ask: { verse: '/flights/distance/?from=LHR&to=JFK' },
    truth: [['about 5,540 km', /\b5,5\d\d km\b/], ['about 3,440 miles', /\b3,4\d\d miles\b/], ['nautical miles', /\bnm\b/], ['a flight of about 7 hours', /\b7 h \d{2} min/]],
    askParts: { 'distance in miles and km': [['kilometres', /\bkm\b/], ['miles', /\bmiles\b/], ['nautical miles', /\bnm\b/]], 'flight time': [['a typical flight time', /Typical flight time/i]], 'time difference': [['a time difference', /Time difference/i]], 'flown distance': [['the distance actually flown', /Distance actually flown/i]], 'multi leg trips': [['airports in order', /Airports in order/i], ['a total', /Total/]] },
    pageParts: {}, parts: {},
    facts: [['distance in km', /\bkm\b/], ['distance in miles', /\bmiles\b/], ['nautical miles', /\bnm\b/], ['flight time', /Typical flight time/i], ['time difference', /Time difference/i], ['the direction', /Direction/], ['the distance actually flown', /actually flown/i], ['a map', /Chain of airports|map/i], ['several legs and a total', /Total/], ['nearby airports', /Nearby airports/i], ['CO2', /CO2/], ['works offline', /\boffline\b/i], ['no account', /no account/i]],
  },
  'travel: gcmap.com': {
    ask: { verse: '/flights/map/?route=JFK-LHR-SIN' },
    truth: [['the leg JFK to LHR', /JFK → LHR/], ['the leg LHR to SIN', /LHR → SIN/], ['about 10,880 km for London to Singapore', /\b10,8\d\d km\b/], ['a total', /Total/]],
    askParts: { 'route map': [['a map of the route', /Chain of airports/i], ['great-circle paths', /great-circle paths/i]], 'chained routes': [['airports in order', /Airports in order/i], ['a dash between codes', /JFK-LHR-SIN/]], 'great circle distance': [['kilometres', /\bkm\b/], ['miles', /\bmiles\b/], ['a total', /Total/]], 'airport info': [['airport names', /Kennedy/], ['their countries', /United States/]] },
    pageParts: {}, parts: {},
    facts: [['chained airports', /Airports in order/i], ['each leg', /Leg/], ['a total', /Total/], ['kilometres', /\bkm\b/], ['miles', /\bmiles\b/], ['flight time', /\bTime\b/], ['a map', /great-circle paths/i], ['codes by dash or space', /dash or a space/i], ['works offline', /\boffline\b/i], ['no account', /no account/i]],
  },
  'travel: co2.myclimate.org': {
    ask: { verse: '/flights/co2/?from=LHR&to=JFK' },
    truth: [['about 530 kg of CO2 for one economy seat', /\b5\d\d kg CO2/], ['the method written out', /How this is worked out/i], ['0.09 kg for each kilometre', /0\.09 kg/], ['the high-altitude factor 1.9', /×1[.,]9/]],
    askParts: { 'CO2 per passenger': [['kg of CO2', /kg CO2/], ['a range', /\bRange\b/], ['per passenger-kilometre', /Per passenger-kilometre/i]], 'cabin class': [['a cabin choice', /\bCabin\b/], ['business', /\bBusiness\b/], ['first', /\bFirst\b/]], 'return trip': [['return or one way', /Return[\s\S]{0,60}One way|One way[\s\S]{0,60}Return/i]], 'method named': [['the method', /How this is worked out/i], ['an average, not an airline\'s figure', /average/i]] },
    pageParts: {}, parts: {},
    facts: [['kg of CO2', /kg CO2/], ['a range', /\bRange\b/], ['high-altitude effects', /high-altitude/i], ['cabin class', /\bCabin\b/], ['passengers', /\bAdults\b|passengers?/i], ['return trip', /\bReturn\b/], ['the method', /How this is worked out/i], ['per passenger-kilometre', /passenger-kilometre/i], ['nothing sent', /nothing is sent|on this device/i], ['works offline', /\boffline\b/i], ['no account', /no account/i]],
  },
  'travel: flightconnections.com': {
    ask: { verse: '/flights/routes/?from=LIS' },
    truth: [['from Lisbon', /(?:Airports a flight from|nonstop route from) Lisbon/], ['Madrid within reach', /\bMAD\b/], ['Porto within reach', /\bOPO\b/], ['a flight time for each', /\b\d h \d{2} min|\b\d{2} min/]],
    askParts: { 'where can I go': [['where can I go', /Where can I go/i], ['airports that could be reached', /could reach/i]], 'filter by distance': [['a flight time limit', /Flight time up to/i], ['a country filter', /Any country/i], ['larger airports only', /Larger airports only/i]], 'airport finder': [['the origin airport', /\bFrom\b/], ['airport codes in the list', /\b[A-Z]{3}\b/]], 'provider links': [['each opens the route', /\bnearest first\b/i], ['no timetable said', /not a timetable|may be out of date/i]] },
    pageParts: {}, parts: {},
    facts: [['a start airport', /\bFrom\b/], ['a flight time limit', /Flight time up to/i], ['a country filter', /Any country/i], ['larger airports only', /Larger airports only/i], ['distance for each', /\bkm\b/], ['flight time for each', /\b\d h \d{2} min/], ['nearest first', /nearest first/i], ['range not a timetable said', /not a timetable|may be out of date/i], ['nonstop routes', /nonstop/i], ['the routes\' date and source', /June 2014[\s\S]{0,200}OpenFlights|OpenFlights[\s\S]{0,200}June 2014/], ['works offline', /\boffline\b/i], ['no account', /no account/i]],
  },
  // the jobs lane (owner, 2026-10-26: "we have to have everything all the sites have"): each board has a page of its own (LANE_PAGES) on the same live listings; the
  // question each is asked is the job that board is known for. Truth is what a right answer shows whatever the day's listings are (counts, the filter applied, the source
  // credited and Apply on the original posting); judged on Verse alone.
  'jobs: jobicy.com': {
    ask: { verse: '/jobs/regions/?region=usa' },
    truth: [['jobs counted for the region', /\b\d[\d,.]* jobs? · USA/], ['region chips with counts', /USA \d+/], ['Apply opens the original posting', /Apply on (?:Remotive|Jobicy|Himalayas)/], ['each listing names its source', /Listing from (?:Remotive|Jobicy|Himalayas)/]],
    askParts: { 'jobs by region': [['regions', /Where you may work from/], ['anywhere', /Anywhere \d+/]], 'industry filter': [['a category filter', /Category/]], 'job level': [['a level filter', /\bLevel\b/]], 'salary when given': [['a salary filter', /Minimum salary/]], 'RSS feed': [['a feed', /RSS feed of this search/]] },
    pageParts: {}, parts: {},
    facts: [['region', /Work from/], ['industry', /Category/], ['level', /\bLevel\b/], ['job type', /Job type/], ['salary', /salary/i], ['keyword', /Keyword/], ['RSS', /RSS/], ['date posted', /Posted/], ['saved jobs', /Saved jobs/], ['alerts', /alert/i], ['no account', /no account/i], ['works offline', /\boffline\b/i]],
  },
  'jobs: workingnomads.com': {
    ask: { verse: '/jobs/alerts/?q=developer' },
    truth: [['jobs counted for the search', /\b\d[\d,.]* jobs? · “developer”/], ['a way to save it as an alert', /Save this search as an alert/], ['Apply opens the original posting', /Apply on (?:Remotive|Jobicy|Himalayas)/], ['each listing names its source', /Listing from (?:Remotive|Jobicy|Himalayas)/]],
    askParts: { 'saved searches': [['save a search', /Save this search as an alert/]], 'new since last visit': [['new since your last visit', /new since your last visit|each time you come back/i]], 'no email needed': [['no email', /No email/i]], categories: [['categories', /Category/]], 'RSS feed': [['a feed', /RSS/]] },
    pageParts: {}, parts: {},
    facts: [['alerts', /Alerts/], ['saved searches', /saved search/i], ['new matches marked', /new since/i], ['notifications', /Notify me/i], ['RSS', /RSS/], ['categories', /Category/], ['keyword', /Keyword/], ['no email', /No email/i], ['no account', /no account/i], ['works offline', /\boffline\b/i]],
  },
  'jobs: arbeitnow.com': {
    ask: { verse: '/jobs/europe/?region=germany' },
    truth: [['jobs counted for Germany', /\b\d[\d,.]* jobs? · Germany/], ['Germany counted', /Germany \d+/], ['Apply opens the original posting', /Apply on (?:Remotive|Jobicy|Himalayas)/], ['each listing names its source', /Listing from (?:Remotive|Jobicy|Himalayas)/]],
    askParts: { 'jobs open in Germany': [['Germany', /Germany \d+/]], 'visa sponsorship filter': [['a visa filter', /Visa sponsorship mentioned/]], 'remote filter': [['where you may work from', /Work from/]], 'German and English': [['German said', /English and German|German/]] },
    pageParts: {}, parts: {},
    facts: [['Germany', /Germany/], ['Europe', /Europe/], ['visa sponsorship', /visa sponsorship/i], ['place', /\bPlace\b/], ['keyword', /Keyword/], ['salary', /salary/i], ['job type', /Job type/], ['saved jobs', /Saved jobs/], ['alerts', /alert/i], ['German', /German/], ['no account', /no account/i], ['works offline', /\boffline\b/i]],
  },
  'jobs: himalayas.app': {
    ask: { verse: '/jobs/salary/?min=100000' },
    truth: [['jobs counted over the minimum', /\b\d[\d,.]* jobs? · ≥ 100,000/], ['highest paid first', /Highest salary/], ['a salary on each job', /(?:USD|EUR|GBP|CAD|AUD) [\d,]+/], ['Apply opens the original posting', /Apply on (?:Remotive|Jobicy|Himalayas)/], ['each listing names its source', /Listing from (?:Remotive|Jobicy|Himalayas)/]],
    askParts: { 'salary filter': [['a minimum salary', /Minimum salary a year/]], 'highest paid first': [['sort by salary', /Highest salary/]], seniority: [['a level filter', /\bLevel\b/]], 'time zones': [['time zones', /Time zones/]] },
    pageParts: {}, parts: {},
    facts: [['minimum salary', /Minimum salary/], ['sort by pay', /Highest salary/], ['pay as a year', /a year/], ['level', /\bLevel\b/], ['job type', /Job type/], ['time zones', /Time zones/], ['keyword', /Keyword/], ['saved jobs', /Saved jobs/], ['tracker', /Applications/], ['no account', /no account/i], ['works offline', /\boffline\b/i]],
  },
  'jobs: remotive.com': {
    ask: { verse: '/jobs/categories/' },
    truth: [['categories listed with counts', /Categories[\s\S]{0,200}\w \d+/], ['jobs counted', /\b\d[\d,.]* jobs? · /], ['Apply opens the original posting', /Apply on (?:Remotive|Jobicy|Himalayas)/], ['each listing names its source', /Listing from (?:Remotive|Jobicy|Himalayas)/]],
    askParts: { 'categories with counts': [['categories', /Categories/]], 'keyword search': [['keyword', /Keyword/]], 'job type': [['job type', /Job type/]], 'source credited': [['Remotive named', /Remotive/]] },
    pageParts: {}, parts: {},
    facts: [['categories', /Categories/], ['keyword', /Keyword/], ['place', /\bPlace\b/], ['job type', /Job type/], ['salary', /salary/i], ['date posted', /Posted/], ['saved jobs', /Saved jobs/], ['alerts', /alert/i], ['source credited', /Remotive/], ['no account', /no account/i], ['works offline', /\boffline\b/i]],
  },
  'jobs: remoteok.com': {
    ask: { verse: '/jobs/tags/?sort=salary' },
    truth: [['tags listed with counts', /Tags[\s\S]{0,200}\w \d+/], ['highest paid first', /Highest salary/], ['Apply opens the original posting', /Apply on (?:Remotive|Jobicy|Himalayas)/], ['each listing names its source', /Listing from (?:Remotive|Jobicy|Himalayas)/]],
    askParts: { 'tag cloud': [['tags', /Tags/]], salary: [['salaries', /salary/i]], 'sort by pay or date': [['sort', /\bSort\b/], ['newest', /Newest/]], 'RSS feed': [['a feed', /RSS/]] },
    pageParts: {}, parts: {},
    facts: [['tags', /Tags/], ['salary', /salary/i], ['sort', /\bSort\b/], ['region', /Work from/], ['keyword', /Keyword/], ['RSS', /RSS/], ['share link', /Share link/i], ['saved jobs', /Saved jobs/], ['alerts', /alert/i], ['no account', /no account/i], ['works offline', /\boffline\b/i]],
  },
  'jobs: weworkremotely.com': {
    ask: { verse: '/jobs/companies/' },
    truth: [['companies listed with their jobs counted', /Companies hiring[\s\S]{0,300}\w \d+/], ['most jobs first', /Most jobs first/], ['Apply opens the original posting', /Apply on (?:Remotive|Jobicy|Himalayas)/], ['each listing names its source', /Listing from (?:Remotive|Jobicy|Himalayas)/]],
    askParts: { 'companies hiring': [['companies', /Companies hiring/]], 'jobs of one company': [['a company filter', /A to Z/]], categories: [['categories', /Category/]], 'saved jobs': [['saved jobs', /Saved jobs/]] },
    pageParts: {}, parts: {},
    facts: [['companies', /Companies hiring/], ['A to Z', /A to Z/], ['categories', /Category/], ['keyword', /Keyword/], ['job type', /Job type/], ['saved jobs', /Saved jobs/], ['alerts', /alert/i], ['tracker', /Applications/], ['RSS', /RSS/], ['no account', /no account/i], ['works offline', /\boffline\b/i]],
  },
  'sports: thesportsdb.com': {
    ask: { verse: '/sports/?q=arsenal' },
    truth: [['Arsenal found as a team', /Teams[\s\S]{0,400}Arsenal/], ['its sport, soccer', /\bSoccer\b/], ['the source named', /TheSportsDB/]],
    askParts: { 'sport search': [['a search across sports', /Search every sport/i], ['teams', /\bTeams\b/], ['venues or events', /\bVenues\b|\bEvents\b/], ['players', /\bPlayers\b/]],
      'born on this day': [['born on this day', /Born on this day/i], ['a year and a name', /(?:1[89]|20)\d\d\s*[\s\S]{2,70} — /]],
      'sport grid': [['click a sport to browse', /Click a sport to browse/i], ['soccer', /\bSoccer\b/], ['basketball', /\bBasketball\b/], ['tennis', /\bTennis\b/], ['cricket', /\bCricket\b/]],
      'free api': [['a free API', /Free API/i], ['read only', /read only/i], ['its description', /openapi\.json/i]] },
    pageParts: {}, parts: {},
    facts: [['sports to browse', /Click a sport to browse/i], ['search across sports', /Search every sport/i], ['teams', /\bTeams\b/], ['events', /\bEvents\b/], ['venues', /\bVenues\b/], ['players', /\bPlayers\b/], ['born on this day', /Born on this day/i], ['a stats strip', /On this device/i], ['a free API', /Free API/i], ['the source named', /TheSportsDB/], ['no betting', /no betting/i]],
  },
});
/** a floor's probe with its lists resolved for today ({ site, verse, truth, facts, parts }), or null. Pure but for today's date. */
// a second floor standing on the same page reads it the same way (owner, 2026-10-26: tildegit is /g/ like codebase): the questions and the
// lists come from the page, and only the site it is compared with changes — said once here, never copied into a second probe that can drift
const SAME_PAGE = { tildegit: 'codebase', squibler: 'sudowrite', inkfluence: 'sudowrite', novelcrafter: 'sudowrite' };

export function probeFor(id) {
  // a lane site ('translate: deepl.com', lib/tower.js LANES) is measured by its lane's probe: the same Verse page, the same truth, that site
  const lane = String(id || '').match(/^(.+?): ([a-z0-9.-]+)$/i), id0 = id;
  const alias = SAME_PAGE[id], p = PROBES[id] || (alias && PROBES[alias]) || (lane && PROBES[lane[1]]); if (!p) return null;
  if (lane) id = lane[1];
  // a lane site with a page of its own (LANE_PAGES) is measured against that page, not its leader's
  const own = lane && LANE_PAGES[id0], lp = lane && LANE_PROBES[id0]; // a lane page may bring its own question, parts and facts (LANE_PROBES)
  const ownSite = alias ? ((FLOORS.find((f) => f.id === id0) || {}).url || p.site) : p.site;
  const base = { site: ownSite, verse: own || p.verse, ask: own && p.ask ? { ...p.ask, verse: SELF_ASK.get(id0) || own } : p.ask || null, askParts: p.askParts || {}, pageParts: p.pageParts || {}, motion: p.motion || {}, truth: typeof p.truth === 'function' ? p.truth() : p.truth || null, facts: p.facts || (id === 'colour codes' ? PROBES.colour.facts : []), parts: PARTS[id] || {} };
  return lp ? { ...base, ...lp, verse: own || base.verse, ask: lp.ask || base.ask, ownFacts: true } : base;
}
/** how many of the [label, RegExp] items a page's text shows: { n, of, has: [labels], missing: [labels] }. Pure. */
export function score(text, items) {
  const t = String(text || ''), has = [], missing = [];
  for (const [label, re] of items || []) { let ok = false; try { ok = typeof re === 'function' ? !!re(t) : re.test(t); } catch (_) { ok = false; } (ok ? has : missing).push(label); } // a check is a pattern, or a function of the page's text
  return { n: has.length, of: has.length + missing.length, has, missing };
}

// Feature maps in the gate (owner, 2026-10-25: "make sure you research all features of every site so we have everything"): a floor with a file in
// domains/features/ (hand research, or tools/feature-scan.mjs) adds the features Verse is marked as having to its completeness facts, so a site reads
// surpassed only when Verse's page shows them. A feature is shown when its key words are on the page (all of them up to two, all but one past that),
// or its own `shows` pattern when the file gives one. tools/tower-gate.mjs applies withFeatureFacts; probeFor itself is unchanged.
const FEATURE_STOP = new Set(('a an and are as at be by can for from has have in into is it its of on or per that the this to up with without your you ' +
  'any all more most new one own get use using via free online tool tools site page app web') .split(/\s+/));
/** a feature name's key words as stems: "Save favourite names" -> ['save', 'favourite', 'name'], at most four. Pure. */
export function keywordsOf(name) {
  const words = String(name || '').toLowerCase().match(/[a-z0-9][a-z0-9+#]*/g) || [], out = [];
  for (let w of words) { if (FEATURE_STOP.has(w) || (w.length < 3 && !/^\d+$/.test(w))) continue; if (/ies$/.test(w) && w.length > 4) w = w.slice(0, -3) + 'y'; else if (/[^s]s$/.test(w) && w.length > 3) w = w.slice(0, -1); const st = w.replace(/(?:ing|ed|ness)$/, ''); if (st.length >= 4) w = st; if (!out.includes(w)) out.push(w); if (out.length === 4) break; }
  return out;
}
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** whether a page's text shows a feature: { verse: has|partial|missing, found, lacking }. Pure. */
export function showsFeature(feature, text) {
  const f = typeof feature === 'string' ? { name: feature } : feature || {}, t = String(text || '');
  if (f.shows) { let ok = false; try { ok = new RegExp(f.shows, 'i').test(t); } catch (_) { ok = false; } return { verse: ok ? 'has' : 'missing', found: ok ? [f.shows] : [], lacking: ok ? [] : [f.shows] }; }
  const keys = keywordsOf(f.name), found = keys.filter((k) => new RegExp('(?<![a-z0-9])' + escRe(k) + (/[a-z]$/.test(k) ? '' : '(?![0-9])'), 'i').test(t)), need = keys.length <= 2 ? keys.length : keys.length - 1;
  return { verse: keys.length && found.length >= need ? 'has' : found.length ? 'partial' : 'missing', found, lacking: keys.filter((k) => !found.includes(k)) };
}
/** a floor's features file name: a lane site ('translate: deepl.com') shares its lane's file. Pure. */
export const featureSlug = (id) => { const lane = String(id || '').match(/^(.+?): ([a-z0-9.-]+)$/i); return (lane ? lane[1] : String(id || '')).replace(/\W+/g, '-'); };
// a feature named for what a site lacks or costs ("No sign-up", "Free with ads, no paywall") is not something a page shows in words: never a fact
const ABSENT = /\b(?:no|non|without|free|ads?|ad-supported|paywall|sign-?up|account)\b/i;
/** the top `n` features a file marks Verse as having (the leader's first, then the other sites, hand research before the scan's), as completeness
 *  facts [name, check of the page's text]. Pure. */
export function factsFromFile(file, n = 6) {
  const out = [], seen = new Set(), sitesOf = (s) => Object.values(s || {}).sort((a, b) => (b && b.leader ? 1 : 0) - (a && a.leader ? 1 : 0));
  for (const site of [...sitesOf(file && file.sites), ...sitesOf(file && file.auto && file.auto.sites)]) for (const f of (site && site.features) || []) {
    const key = String(f && f.name || '').toLowerCase().trim(); if (!key || seen.has(key) || f.verse !== 'has' || !(f.shows || keywordsOf(f.name).length) || (!f.shows && ABSENT.test(f.name))) continue;
    seen.add(key); out.push([String(f.name), (t) => showsFeature(f, t).verse === 'has']); if (out.length >= n) return out;
  }
  return out;
}
const FEATURE_DIR = new URL('../domains/features/', import.meta.url), featureFiles = new Map();
/** a floor's features file, read once, or null (none, or not JSON) */
export function featuresOf(id, dir = FEATURE_DIR) {
  const file = fileURLToPath(new URL(featureSlug(id) + '.json', dir)); if (featureFiles.has(file)) return featureFiles.get(file);
  let v = null; try { v = JSON.parse(readFileSync(file, 'utf8')); } catch (_) { v = null; } featureFiles.set(file, v); return v;
}
/** a probe with its floor's feature facts added after its own (none already named), or the probe as it was: no probe, no file, nothing Verse has */
export function withFeatureFacts(probe, id, n = 6, dir = FEATURE_DIR) {
  if (!probe || probe.ownFacts) return probe; // a lane page with its own facts is not asked for its leader's features
  const file = featuresOf(id, dir); if (!file) return probe;
  const have = new Set((probe.facts || []).map(([l]) => String(l).toLowerCase())), extra = factsFromFile(file, n).filter(([l]) => !have.has(l.toLowerCase()));
  return extra.length ? { ...probe, facts: [...(probe.facts || []), ...extra] } : probe;
}
