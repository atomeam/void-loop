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
const exact = (digits) => new RegExp('(?<![0-9a-z])(?:0[\\s,_]?)*' + [...String(digits)].join('[\\s,_]?') + '(?![0-9a-z])', 'i'); // leading zeros allowed: 0001 0010 ... is the same number
const HUGE = 0x123456789abcdef0123456789abcdefn;
export const PROBES = Object.freeze({
  'is it': {
    site: 'https://isitchristmas.com/', verse: '/is-it/christmas',
    truth: () => [[christmas() ? 'yes on Christmas Day' : 'no on any other day', christmas() ? /\bYES\b/i : /\bNO\b/i]],
    facts: [['the answer', /\b(?:YES|NO)\b/], ['which day it is about', /christmas/i], ['how long until it', /\b\d+\s+(?:days?|sleeps?)\b/i], ['the date itself', /\b25\b.*\bdec|\bdec\w*\s+25\b/i]],
  },
  'coin flip': {
    site: 'https://justflipacoin.com/', verse: '/flip/',
    truth: null, // a flip has no right answer to check
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
    truth: null, // a spin has no right answer to check
    facts: [['an entries list', /\bentries\b|\bnames\b/i], ['spin', /\bspin\b/i], ['shuffle', /\bshuffle\b/i], ['sort', /\bsort\b/i], ['results', /\bresults?\b|\bwinners?\b/i],
      ['a share link', /\bshare\b|\bcopy link\b/i], ['weights', /\bweights?\b|times as likely/i], ['says it is fair', /\bfair\b/i], ['sound control', /\bsound\b|\bmute\b/i]],
  },
  'random user': {
    site: 'https://randomuser.me/', verse: '/random-user/',
    truth: null, // made-up people have no right answer to check
    facts: [['names', /\bnames?\b/i], ['emails', /\bemails?\b|@/i], ['phones', /\bphones?\b/i], ['addresses', /\baddress|\bstreet\b|\bcity\b/i], ['birthdays', /\bbirthday|\bdob\b|date of birth/i],
      ['passwords', /\bpasswords?\b/i], ['pictures', /\bpictures?\b|\bphotos?\b|\bavatars?\b/i], ['gender', /\bgender\b/i], ['nationality', /\bnationalit|\bcountr/i], ['a seed', /\bseed\b/i],
      ['JSON', /\bjson\b/i], ['CSV', /\bcsv\b/i], ['XML', /\bxml\b/i], ['YAML', /\byaml\b/i], ['SQL', /\bsql\b/i]],
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
  wheel: { 'entries list': [['entries', /\bentries\b|\bnames\b/i]], weights: [['weights', /\bweights?\b|times as likely/i]] }, // 'remove the winner' shows only after a spin, on both sites: unmeasured,
  'random number': { 'true randomness': [['names where its randomness comes from', /atmospheric noise|\bdrand\b|randomness beacon|getRandomValues|\bhardware\b/i], ['a draw others can check', /\bcheckable\b|\bverifiab|\bre-deriv|\bsigned\b/i]], 'range choice': [['a range', /\bmin(?:imum)?\b[\s\S]{0,120}\bmax|\bfrom\b[\s\S]{0,60}\bto\b|\bbetween\b[\s\S]{0,40}\band\b/i], ['how many', /\bhow many\b|\bgenerate\s+\d+|\bnumber of\b/i], ['no repeats', /\bno repeats?\b|\bunique\b|\bwithout repe/i]] },
  'random user': { 'output formats': [['JSON', /\bjson\b/i], ['CSV', /\bcsv\b/i], ['XML', /\bxml\b/i], ['YAML', /\byaml\b/i], ['SQL', /\bsql\b/i]], seed: [['a seed', /\bseed\b/i]], nationalities: [['United States', /united states|\bamerican\b/i], ['United Kingdom', /united kingdom|\bbritish\b/i], ['France', /\bfrance\b|\bfrench\b/i], ['Germany', /\bgermany\b|\bgerman\b/i], ['Spain', /\bspain\b|\bspanish\b/i], ['Brazil', /\bbrazil/i], ['India', /\bindia\b|\bindian\b/i], ['Japan', /\bjapan/i]] },
});
/** a floor's probe with its lists resolved for today ({ site, verse, truth, facts, parts }), or null. Pure but for today's date. */
export function probeFor(id) {
  const p = PROBES[id]; if (!p) return null;
  return { site: p.site, verse: p.verse, ask: p.ask || null, askParts: p.askParts || {}, truth: typeof p.truth === 'function' ? p.truth() : p.truth || null, facts: p.facts || (id === 'colour codes' ? PROBES.colour.facts : []), parts: PARTS[id] || {} };
}
/** how many of the [label, RegExp] items a page's text shows: { n, of, has: [labels], missing: [labels] }. Pure. */
export function score(text, items) {
  const t = String(text || ''), has = [], missing = [];
  for (const [label, re] of items || []) (re.test(t) ? has : missing).push(label);
  return { n: has.length, of: has.length + missing.length, has, missing };
}
