// The tower gate's accuracy and completeness probes (tools/tower-gate.mjs): for a floor, the same question put to the real site and to Verse
// (owner, 2026-10-24: automate the unmeasured aspects in the head-to-head gate), and what the answer page must show.
//   truth: what a CORRECT answer contains, worked out here independently of both sites (accuracy = how many of these the page shows)
//   facts: what a COMPLETE answer offers, the union of what the best sites in the category show (completeness = how many of these it shows)
// Each is a list of [label, RegExp] read against the page's visible text after it has loaded. A floor without a probe leaves accuracy and
// completeness unverified (never counted as beaten); a probe with truth null leaves accuracy unverified (only a site whose own address carries the
// question can be asked the same thing as Verse). Pure data, plus the date the 'is it' truth depends on.
const christmas = (d = new Date()) => d.getUTCMonth() === 11 && d.getUTCDate() === 25;

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
    site: 'https://www.random.org/', verse: '/random/?min=1&max=100',
    truth: null, // a random number has no right answer to check
    facts: [['a minimum', /\bmin(?:imum)?\b/i], ['a maximum', /\bmax(?:imum)?\b/i], ['a generate control', /\b(?:generate|pick|roll|again)\b/i]],
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
    truth: null, // each opens on its own starting gradient: no same question to check
    facts: [['linear', /\blinear\b/i], ['radial', /\bradial\b/i], ['conic', /\bconic\b/i], ['opacity', /\bopacity\b/i], ['presets', /\bpresets?\b/i], ['import CSS', /\bimport\b|\bpaste\b/i],
      ['reverse', /\breverse\b/i], ['hue and saturation', /\bhue\b/i], ['SCSS', /\bscss\b/i], ['from a picture', /\b(?:image|picture)\b/i], ['text contrast', /\bcontrast\b|\bwcag\b/i], ['CSS output', /background(?:-image)?\s*:\s*(?:linear|radial|conic)-gradient/i]],
  },
  wheel: {
    site: 'https://wheelofnames.com/', verse: '/wheel/',
    truth: null, // a spin has no right answer to check
    facts: [['an entries list', /\bentries\b|\bnames\b/i], ['spin', /\bspin\b/i], ['shuffle', /\bshuffle\b/i], ['sort', /\bsort\b/i], ['results', /\bresults?\b|\bwinners?\b/i],
      ['a share link', /\bshare\b|\bcopy link\b/i], ['weights', /\bweights?\b|times as likely/i], ['says it is fair', /\bfair\b/i], ['sound control', /\bsound\b|\bmute\b/i]],
  },
  'base converter': {
    site: 'https://hextobinary.com/', verse: '/base-converter/?v=ff&b=16',
    truth: null, // the site's address cannot carry the question, so the same question cannot be put to both
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
const COLOUR_PARTS = Object.freeze({ 'every colour model': MODELS, 'shades and palettes': PALETTES });
export const PARTS = Object.freeze({ colour: COLOUR_PARTS, 'colour codes': COLOUR_PARTS });
/** a floor's probe with its lists resolved for today ({ site, verse, truth, facts, parts }), or null. Pure but for today's date. */
export function probeFor(id) {
  const p = PROBES[id]; if (!p) return null;
  return { site: p.site, verse: p.verse, truth: typeof p.truth === 'function' ? p.truth() : p.truth || null, facts: p.facts || (id === 'colour codes' ? PROBES.colour.facts : []), parts: PARTS[id] || {} };
}
/** how many of the [label, RegExp] items a page's text shows: { n, of, has: [labels], missing: [labels] }. Pure. */
export function score(text, items) {
  const t = String(text || ''), has = [], missing = [];
  for (const [label, re] of items || []) (re.test(t) ? has : missing).push(label);
  return { n: has.length, of: has.length + missing.length, has, missing };
}
