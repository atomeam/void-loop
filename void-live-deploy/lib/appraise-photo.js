// Verse values anything from a photo (frontier #30; owner, 2026-10-15: "i already asked for the coin, card, value appraisal
// system which needs image viewing capabilities", "not just coin and card an image should value all items if asked", and
// "Verse can decide, it's an appraiser"). The vision model (lib/models.js, path 'vision') says what it sees; this file turns
// that description into Verse's valuation: one number, the details that moved it, and when an expert in hand is needed.
// Honest: an estimate from a photo, never a certified appraisal or an authentication; no comparable sale is ever invented.
// People are never priced (owner): a person in the photo, or an ask about a person, gets a sincere compliment and no number.
// Pure: no network, no DOM. functions/api/appraise.js and skills/appraise.js use it.

// what kind of thing it is, the words the model uses for it, and Verse's base value in cents for an ordinary example
export const KINDS = [
  { kind: 'coin', re: /\b(coins?|penny|pennies|nickel|dime|quarter|cent|dollar coin|medal(?:lion)?|token|bullion|sovereign|doubloon)\b/i, base: 300, expert: /\b(gold|silver|ancient|roman|greek|error|double die|proof|uncirculated|rare)\b/i },
  { kind: 'trading card', re: /\b(trading cards?|pok[eé]mon|baseball cards?|basketball cards?|football cards?|magic(?: the gathering)?|yu-?gi-?oh|holo(?:graphic)?|rookie card|psa|graded)\b/i, base: 400, expert: /\b(holo|first edition|1st edition|rookie|graded|psa|signed|autograph)\b/i },
  { kind: 'watch', re: /\b(wrist ?watch|watch|chronograph|timepiece|rolex|omega|seiko|casio)\b/i, base: 6000, expert: /\b(rolex|omega|patek|cartier|gold|automatic|vintage)\b/i },
  { kind: 'jewelry', re: /\b(ring|necklace|bracelet|earrings?|brooch|pendant|jewel(?:le)?ry|diamond|gemstone|pearl)\b/i, base: 4000, expert: /\b(diamond|gold|platinum|emerald|sapphire|ruby|antique)\b/i },
  { kind: 'painting', re: /\b(painting|canvas|oil on|watercolou?r|artwork|print|lithograph|drawing|sketch|framed art)\b/i, base: 8000, expert: /\b(signed|original|oil|antique|old master|19th|18th|17th)\b/i },
  { kind: 'guitar', re: /\b(guitar|bass guitar|fender|gibson|stratocaster|telecaster|les paul|ukulele|banjo|violin|piano|keyboard|drum)\b/i, base: 25000, expert: /\b(vintage|gibson|fender|martin|1950|1960|1970|signed)\b/i },
  { kind: 'phone', re: /\b(i?phone|smartphone|android phone|galaxy|pixel phone|mobile phone|cell ?phone)\b/i, base: 20000 },
  { kind: 'laptop', re: /\b(laptop|macbook|notebook computer|chromebook|thinkpad)\b/i, base: 35000 },
  { kind: 'camera', re: /\b(camera|dslr|mirrorless|leica|canon|nikon|polaroid|lens)\b/i, base: 20000, expert: /\b(leica|hasselblad|vintage|film camera)\b/i },
  { kind: 'console', re: /\b(game console|playstation|xbox|nintendo|switch|game ?boy|sega|atari|arcade)\b/i, base: 15000, expert: /\b(sealed|boxed|atari|prototype)\b/i },
  { kind: 'toy', re: /\b(toy|action figure|doll|lego|plush|teddy|model car|hot wheels|funko|figurine)\b/i, base: 1500, expert: /\b(sealed|boxed|vintage|first|1970|1980|signed)\b/i },
  { kind: 'comic or book', re: /\b(comic|graphic novel|book|novel|first edition|hardcover|paperback|manuscript)\b/i, base: 1200, expert: /\b(first edition|signed|1930|1940|1950|1960|rare|misprint)\b/i },
  { kind: 'vinyl record', re: /\b(vinyl|record album|lp record|45 rpm|78 rpm)\b/i, base: 1500, expert: /\b(first pressing|signed|test pressing|mono)\b/i },
  { kind: 'sneakers', re: /\b(sneakers?|trainers|jordans?|yeezy|nike|adidas|running shoes|boots)\b/i, base: 7000, expert: /\b(deadstock|signed|sample|1985|og)\b/i },
  { kind: 'bag', re: /\b(handbag|purse|backpack|tote|clutch|louis vuitton|chanel|hermes|gucci|wallet)\b/i, base: 5000, expert: /\b(hermes|chanel|louis vuitton|birkin|kelly|crocodile)\b/i },
  { kind: 'furniture', re: /\b(chair|table|desk|sofa|couch|cabinet|dresser|bookshelf|bed frame|armchair|stool|bench)\b/i, base: 12000, expert: /\b(antique|eames|mid-?century|designer|hand ?carved|18th|19th)\b/i },
  { kind: 'tool', re: /\b(drill|saw|hammer|wrench|tool ?box|power tool|lathe|chisel|plane)\b/i, base: 4000 },
  { kind: 'bicycle', re: /\b(bicycle|bike|e-?bike|mountain bike|road bike)\b/i, base: 25000 },
  { kind: 'vehicle', re: /\b(car|truck|motorcycle|motorbike|van|suv|sedan|convertible|scooter|boat)\b/i, base: 800000, expert: /\b(classic|vintage|1960|1970|porsche|ferrari|mustang|corvette)\b/i },
  { kind: 'clothing', re: /\b(jacket|coat|dress|shirt|jeans|sweater|hoodie|suit|hat|cap|scarf)\b/i, base: 2500, expert: /\b(vintage|designer|band tee|1970|1980|leather)\b/i },
  { kind: 'electronics', re: /\b(television|tv|monitor|speaker|headphones|earbuds|tablet|ipad|kindle|radio|turntable|amplifier|receiver)\b/i, base: 12000 },
  { kind: 'kitchenware', re: /\b(pan|pot|skillet|knife|kettle|mixer|blender|espresso|coffee maker|dish|plate|bowl|mug|cup|teapot|vase)\b/i, base: 2000, expert: /\b(antique|porcelain|china|hand ?painted|ming|meissen|wedgwood)\b/i },
  { kind: 'plant', re: /\b(plant|cactus|succulent|bonsai|orchid|tree|flowers?|bouquet)\b/i, base: 1500, expert: /\b(bonsai|rare|variegated)\b/i },
  { kind: 'sports gear', re: /\b(baseball|football|basketball|soccer ball|golf club|tennis racket|skateboard|surfboard|snowboard|skis|helmet|jersey)\b/i, base: 4000, expert: /\b(signed|autograph|game ?worn|game ?used)\b/i },
];
// condition words and what they do to the value
export const CONDITION = [
  [/\b(mint|pristine|sealed|unopened|brand new|new in box|flawless|immaculate)\b/i, 1.6, 'in mint or sealed condition'],
  [/\b(excellent|very good|like new|well[- ]kept|clean|gleaming|polished)\b/i, 1.2, 'in excellent condition'],
  [/\b(worn|scratched|scuffed|faded|chipped|dented|cracked|stained|torn|frayed|rusty|rusted|tarnished|bent|dirty|yellowed|missing)\b/i, 0.55, 'with visible wear or damage'],
  [/\b(broken|shattered|smashed|destroyed|burnt|burned|water damage|heavily damaged|not working)\b/i, 0.25, 'broken or heavily damaged'],
];
// cues that raise a value on their own
export const CUES = [
  [/\b(gold|solid gold|14k|18k|24k)\b/i, 4, 'gold'], [/\b(sterling|silver|925)\b/i, 1.8, 'silver'], [/\b(platinum)\b/i, 5, 'platinum'],
  [/\b(diamonds?)\b/i, 3, 'diamonds'], [/\b(antique|victorian|edwardian|art deco|18th century|19th century|17th century)\b/i, 2.5, 'antique'],
  [/\b(vintage|retro|1950s?|1960s?|1970s?|1980s?)\b/i, 1.6, 'vintage'], [/\b(signed|autographed|signature)\b/i, 2.2, 'signed'],
  [/\b(limited edition|numbered|first edition|1st edition|first pressing|prototype|one of a kind|handmade|hand-?crafted)\b/i, 1.8, 'a limited or first edition'],
  [/\b(designer|luxury|high-?end|rolex|omega|cartier|hermes|chanel|gucci|prada|louis vuitton|leica|gibson|fender|steinway|eames)\b/i, 2.5, 'a known maker'],
  [/\b(rare|scarce|hard to find|collectible|collector)\b/i, 1.7, 'rare or collectible'],
  [/\b(set of|collection of|lot of|several|multiple|pair of|two|three|four|five|dozen)\b/i, 1.8, 'more than one piece'],
  [/\b(replica|fake|counterfeit|knock-?off|imitation|reproduction|costume jewel(?:le)?ry|plastic|toy version)\b/i, 0.3, 'a replica or imitation'],
];
// ---- bullion (owner, 2026-10-26: the appraiser said \$20 for a 1 oz gold Krugerrand): a named bullion coin is worth its metal,
// not a multiplier on a pocket-coin base. The table is the coin's metal and weight in troy ounces; the price is the live spot the
// caller passes (Stooq, functions/api/appraise.js). No spot, no number: the fact is said instead, never invented.
const SIZE = [[/(?:\btenth\b|\b1\s*\/\s*10\b)/i, 0.1], [/(?:\bquarter\b|\b1\s*\/\s*4\b)/i, 0.25], [/(?:\bhalf\b|\b1\s*\/\s*2\b)/i, 0.5]];
const BULLION_NAME = '(?:krugerrand|eagles?|maple|philharmonic|britannia|kangaroo|sovereign|buffalo)';
export const BULLION = [
  { re: /\bsilver\s+eagles?\b/i, metal: 'silver', ozt: 1, label: 'American Silver Eagle' },
  { re: /\bsilver\s+maple\s+leaves?\b|\bsilver\s+maple\s+leaf\b/i, metal: 'silver', ozt: 1, label: 'Silver Maple Leaf' },
  { re: /\b(?:morgan|peace)\s+dollars?\b/i, metal: 'silver', ozt: 0.7735, label: 'Morgan/Peace dollar (0.7735 troy oz of silver)' },
  { re: /\bkrugerrands?\b/i, metal: 'gold', ozt: 1, label: 'Krugerrand' },
  { re: /\b(?:american?\s+)?(?:gold\s+)?eagles?\b/i, metal: 'gold', ozt: 1, label: 'American Gold Eagle' },
  { re: /\bgold\s+buffaloes?\b/i, metal: 'gold', ozt: 1, label: 'Gold Buffalo' },
  { re: /\bgold\s+maple\s+leaves?\b|\bmaple\s+leaves?\b/i, metal: 'gold', ozt: 1, label: 'Maple Leaf' },
  { re: /\b(?:vienna\s+)?philharmonics?\b/i, metal: 'gold', ozt: 1, label: 'Philharmonic' },
  { re: /\bbritannias?\b/i, metal: 'gold', ozt: 1, label: 'Britannia' },
  { re: /\bkangaroos?\b/i, metal: 'gold', ozt: 1, label: 'Kangaroo' },
  { re: /\bgold\s+pandas?\b/i, metal: 'gold', ozt: 1, label: 'Gold Panda' },
  { re: /\bsovereigns?\b/i, metal: 'gold', ozt: 0.2354, label: 'full sovereign' },
];
/** the bullion a description names: { metal, ozt, label } or null. Named coins beat stated weights; a fractional ('half krugerrand') resizes. Pure. */
export function bullionOf(text) {
  const t = String(text || '');
  const silverEagle = /\bsilver\s+eagles?\b/i.test(t);
  for (const b of BULLION) {
    if (!b.re.test(t)) continue;
    if (b.label === 'American Gold Eagle' && silverEagle) continue; // 'silver eagle' is its own coin, not a fractional Gold Eagle
    let ozt = b.ozt;
    for (const [re, n] of SIZE) if (new RegExp(re.source + '[\\s\\S]{0,16}' + BULLION_NAME, 'i').test(t) || new RegExp(BULLION_NAME + '[\\s\\S]{0,16}' + re.source, 'i').test(t)) { ozt = n; break; }
    return { metal: b.metal, ozt, label: b.label };
  }
  const m = /\b(\d+(?:\.\d+)?|one|half|quarter|tenth)\s*(?:troy\s*)?o(?:z|unces?)[\s\S]{0,40}?\b(gold|silver|platinum)\b|\b(gold|silver|platinum)\b[\s\S]{0,40}?\b(\d+(?:\.\d+)?|one|half|quarter|tenth)\s*(?:troy\s*)?o(?:z|unces?)\b/i.exec(t);
  if (!m) return null;
  const w = String(m[1] || m[4] || '').toLowerCase();
  const n = w === 'one' ? 1 : /half/.test(w) ? 0.5 : /quarter/.test(w) ? 0.25 : /tenth/.test(w) ? 0.1 : parseFloat(w);
  const metal = String(m[2] || m[3] || '').toLowerCase();
  return n > 0 && n <= 10 ? { metal, ozt: n, label: n + ' troy oz of ' + metal } : null;
}
const PERSON = /\b(person|people|man|woman|men|women|boy|girl|child|children|kid|baby|infant|toddler|teenager|adult|lady|gentleman|guy|someone|human|portrait|selfie|smiling|posing|crowd|couple|family|friend|bride|groom|athlete|his face|her face|their face|a face)\b/i;
const PERSON_ASK = /\b(what am i worth|how much am i worth|value me|appraise me|price me|how much (?:is|are) (?:my|our) (?:friend|mom|mother|dad|father|wife|husband|partner|girlfriend|boyfriend|son|daughter|brother|sister|kid|child|children|baby|family|dog|cat|pet)s?(?: worth)?|what (?:is|are) (?:my|our) (?:friend|mom|dad|wife|husband|partner|son|daughter|brother|sister|kid|child|baby|family|dog|cat|pet)s? worth|how much is (?:a|this) (?:person|human|man|woman|boy|girl|child|baby) worth|value (?:of )?(?:a |this )?(?:person|human|man|woman|boy|girl|child|baby))\b/i;
const PET = /\b(dog|puppy|cat|kitten|pet|hamster|rabbit|bunny|parrot|bird|horse|pony|goldfish)\b/i;

/** the ask itself is about a person's worth: answered with warmth, never a number. Pure. */
export const isPersonAsk = (text) => PERSON_ASK.test(String(text || ''));
/** the photo shows a person (or a pet, who is family): the same rule. Pure. */
export const personIn = (desc) => PERSON.test(String(desc || '')) && !/\b(doll|figure|figurine|statue|painting|portrait of a|poster|photo of a card|action figure|mannequin|toy|lego)\b/i.test(String(desc || ''));
export const petIn = (desc) => PET.test(String(desc || ''));

const COMPLIMENTS = [
  'Priceless, and I mean that as a fact, not a dodge. Nobody else has that exact mix of curiosity, timing and face.',
  'No number fits a person. What I can say: the world is measurably better with you in it, and I would know, I count things for a living.',
  'I value coins, cards and chairs. People are the ones doing the valuing, which puts you above every price I know.',
  'There is no market for someone like you, because there is exactly one, and that is the whole point.',
];
/** a sincere line for a person (or their pet), no money anywhere in it. Pure. */
export function complimentFor(desc = '', seed = 0) {
  const d = String(desc || '');
  if (PET.test(d) && !PERSON.test(d)) return 'A pet is family, and family is never for sale. This one looks loved, which is the only grade that matters.';
  const hints = [];
  if (/\b(smil(?:e|ing)|laugh(?:ing)?|grin)\b/i.test(d)) hints.push('that smile would carry any room');
  if (/\b(glasses|hat|cap|scarf|jacket|dress|suit|hoodie)\b/i.test(d)) hints.push('the outfit is a good call');
  if (/\b(child|kid|baby|toddler|boy|girl)\b/i.test(d)) hints.push('and whoever is raising this one is doing fine');
  return COMPLIMENTS[Math.abs(seed) % COMPLIMENTS.length] + (hints.length ? ' Also: ' + hints.join(', ') + '.' : '');
}

const round = (c) => { if (c < 1000) return Math.max(100, Math.round(c / 100) * 100); if (c < 10000) return Math.round(c / 500) * 500; if (c < 100000) return Math.round(c / 2500) * 2500; return Math.round(c / 25000) * 25000; };
export const usd = (c) => '$' + (c % 100 ? (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : Math.round(c / 100).toLocaleString('en-US'));

/**
 * Verse's valuation from what the vision model saw (and what the person typed with the photo).
 * -> { kind, cents, text: '$240', says: [reasons], expert: bool, person: bool } (person: no cents, no text). Pure.
 */
export function valueFrom(desc, note = '', spot = null) {
  const d = String(desc || '') + ' ' + String(note || '');
  if (!String(desc || '').trim()) return { kind: 'unknown', cents: 0, text: '', says: ['I could not make out what is in the photo. Try a closer, brighter one, or tell me what it is.'], expert: false, person: false, unknown: true };
  if (personIn(d) || petIn(d)) return { kind: petIn(d) && !PERSON.test(d) ? 'pet' : 'person', cents: 0, text: '', says: [complimentFor(d, d.length)], expert: false, person: true };
  const b = bullionOf(d);
  if (b) {
    const px = spot && spot[b.metal];
    const ozt = b.ozt === 1 ? 'one troy ounce' : b.ozt + ' troy ounces';
    const why = 'a ' + b.label + ' is ' + ozt + ' of ' + b.metal + ' \u2014 it prices at the ' + b.metal + ' spot plus a small dealer premium, not a collector multiple';
    if (!(px > 0)) return { kind: 'coin', cents: 0, text: '', bullion: b, expert: true, person: false,
      says: ['what I see: a coin', why, 'my live ' + b.metal + ' quote did not come back just now, so I am not inventing a number: check the ' + b.metal + ' spot before you buy or sell'] };
    const step = px * b.ozt >= 50000 ? 2500 : 100, cents = Math.round((px * b.ozt) / step) * step;
    return { kind: 'coin', cents, text: usd(cents), bullion: b, expert: true, person: false,
      says: ['what I see: a coin', why, b.metal + ' spot ' + usd(px) + ' per troy ounce' + (spot.source || spot.at ? ' (' + [spot.source, spot.at].filter(Boolean).join(', ') + ')' : ''), 'condition barely moves it: the metal is the value, wear included'] };
  }
  const k = KINDS.find((x) => x.re.test(d)) || { kind: 'object', base: 1500 };
  let cents = k.base; const says = ['what I see: ' + (k.kind === 'object' ? 'an everyday object' : k.kind.replace(/^(?:a |an )/, ''))];
  let condition = null;
  for (const [re, mul, say] of CONDITION) { if (re.test(d)) { cents *= mul; condition = say; break; } }
  if (condition) says.push(condition);
  for (const [re, mul, say] of CUES) if (re.test(d)) { cents *= mul; says.push(say); }
  const expert = !!(k.expert && k.expert.test(d)) || cents >= 100000;
  cents = round(Math.min(cents, 50000000));
  return { kind: k.kind, cents, text: usd(cents), says, expert, person: false };
}

/** the card's words from a valuation. Pure. */
export function appraisalText(v) {
  if (!v) return '';
  if (v.unknown) return v.says[0];
  if (v.person) return v.says[0];
  if (!v.text) return v.says.join(' ') + ' An estimate from one photo, not a certified appraisal or an authentication.';
  const lines = ['Verse values this at ' + v.text + '.', 'Why: ' + v.says.join('; ') + '.'];
  if (v.expert) lines.push('This kind can be worth far more or far less than a photo shows: have it looked at in hand before you sell or insure it.');
  lines.push('An estimate from one photo, not a certified appraisal or an authentication; no comparable sales were checked.');
  return lines.join(' ');
}

/** the object a description is about: its first sentence up to where it says where the thing sits ("on a wooden table", "in a
 * garden", "next to a lamp"), so the table under a coin is never taken for the subject. Pure. */
export function subjectOf(desc) {
  const first = String(desc || '').split(/[.!?](?:\s|$)/)[0].toLowerCase();
  return first.split(/\b(?:sitting|resting|lying|placed|standing|set|displayed|photographed|shown|on|in front of|beside|next to|against|near|under|behind|atop|inside|in|with|and|held)\b/)[0].replace(/[^a-z0-9]+/g, ' ').trim();
}

/** the thing in a photo that Verse's forge can model, for a "make me one" link (asked by Verse, ask-20261015-2008-1: connect an
 * appraised photo to its make recipe): the longest forge name (skills/forge-rules.js THINGS, passed in so this file never loads the
 * mesher) found as whole words in the description's subject, as { key, label, ask }; null for none, and never for a person. Pure. */
export function makeableIn(desc, things) {
  if (!things || personIn(desc)) return null;
  const subject = ' ' + subjectOf(desc) + ' ';
  let best = null;
  for (const [key, t] of Object.entries(things)) for (const n of (t && t.names) || []) if (subject.includes(' ' + n + ' ') && (!best || n.length > best.n.length)) best = { key, label: t.label, n };
  return best ? { key: best.key, label: best.label, ask: 'make me a ' + best.key } : null;
}

/** the vision model's prompt: describe, never value (the valuing is Verse's own, above). Pure. */
export const VISION_PROMPT = 'Describe exactly what is in this photo in two or three plain sentences: what the object is, its material, brand or maker if printed on it, any year or edition marks, and its condition (scratches, wear, damage, or mint). If a person or pet is in the photo, say so first. Do not guess a price.';
