/**
 * bodies — Next #18: pick a base body from card data and dress it (colors, a prop, a line of its own).
 * Pure JS, no three.js: void.html and figures3d.js both use this, and the suite tests it offline.
 *
 * Card shape (Wikipedia summary or article page fields):
 *   { title?, description?, extract?, type? }
 */
export const BODIES = ['person', 'animal', 'object', 'place', 'idea'];

/** Same person cue void.html uses for "who is …" Wikipedia picks. */
export const PERSON_RE = /\((?:born|b\.)\s|\(\d{3,4}\s*[–-]\s*\d{2,4}\)|\b(?:actor|actress|singer|songwriter|musician|rapper|politician|writer|author|novelist|poet|playwright|scientist|mathematician|physicist|chemist|biologist|philosopher|artist|painter|sculptor|composer|conductor|director|filmmaker|producer|journalist|broadcaster|presenter|comedian|athlete|footballer|cricketer|basketball player|baseball player|tennis player|golfer|boxer|racing driver|swimmer|entrepreneur|businessman|businesswoman|executive|engineer|inventor|economist|historian|lawyer|judge|activist|monarch|king|queen|emperor|empress|pope|saint|president|prime minister|model|youtuber|streamer|astronaut|explorer|chef|designer|architect)\b/i;

const ANIMAL_RE = /\b(species of|genus of|breed of|mammal|bird|reptile|amphibian|insect|fish|animal|wildlife|canine|feline|dog|cat|horse|whale|eagle|lion|tiger|bear|snake|frog|shark|dolphin|penguin|owl|wolf|fox|deer|elephant|giraffe|monkey|ape|butterfly|bee|spider|rodent|marsupial)\b/i;
const PLACE_RE = /\b(capital|city|town|village|municipality|metropolis|country|nation|state of|province|region|district|borough|commune|island|archipelago|mountain|volcano|river|lake|sea|ocean|continent|peninsula|valley|desert|forest|park|neighborhood|suburb)\b/i;
const PLACE_EXTRACT_RE = /\b(located in|situated in|capital of|lies (?:on|in|at)|is a city|is a town|is a country)\b/i;
const OBJECT_RE = /\b(device|tool|instrument|machine|vehicle|weapon|furniture|appliance|invention|product|gadget|computer|phone|telephone|car|automobile|ship|boat|aircraft|airplane|bicycle|camera|telescope|microscope|clock|watch|lamp|book|chair|table|cup|bottle|food|dish|cuisine|drink|beverage|material|substance|chemical|compound|alloy|mineral|rock|element|software|hardware|weapon|firearm|sword|guitar|piano|violin)\b/i;
const OBJECT_EXTRACT_RE = /\b(used (?:to|for|as)|made of|consists of|an? (?:optical|electronic|mechanical|handheld|portable) )\b/i;

const COLOR_WORDS = {
  red: '#ff5c5c', blue: '#6aa8ff', green: '#5dffa5', yellow: '#ffe66a',
  white: '#f5f5f5', black: '#333344', purple: '#c79bff', orange: '#ffb060',
  pink: '#ff8ec8', gray: '#9a9a9a', grey: '#9a9a9a', gold: '#e6c35c',
  cyan: '#5eefff', teal: '#3dcfb6', brown: '#c48a5a', silver: '#c0c8d4',
};
export const BODY_PALETTE = ['#9d8cff', '#6ee7c8', '#ffa98a', '#7cc4ff', '#ff8fc7', '#c6f27a', '#ffd36b', '#a8b4ff'];

const PROPS = {
  person: ['book', 'mic', 'hat', 'wand', 'quill'],
  animal: ['leaf', 'ball', 'bone', 'flower', 'fish'],
  object: ['spark', 'gear', 'tag', 'ribbon', 'star'],
  place: ['pin', 'flag', 'key', 'map', 'lantern'],
  idea: ['bulb', 'star', 'orbit', 'spark', 'cloud'],
};

/** Five sample cards the suite locks: person, animal, place, object, idea. */
export const SAMPLE_CARDS = [
  { title: 'Marie Curie', description: 'Polish-French physicist and chemist (1867–1934)', extract: 'Marie Skłodowska Curie was a Polish and naturalised-French physicist and chemist who conducted pioneering research on radioactivity. She was the first woman to win a Nobel Prize.' },
  { title: 'Red fox', description: 'species of mammal', extract: 'The red fox is a small omnivorous mammal belonging to the family Canidae. It is the most widely distributed terrestrial carnivore.' },
  { title: 'Paris', description: 'capital and largest city of France', extract: 'Paris is the capital and most populous city of France. Situated on the Seine river, it is a major European city and a global centre for art and fashion.' },
  { title: 'Telescope', description: 'optical instrument designed for observation of remote objects', extract: 'A telescope is an optical instrument designed to make distant objects appear nearer. It is used in astronomy and navigation.' },
  { title: 'Democracy', description: 'form of government', extract: 'Democracy is a form of government in which the people have the authority to deliberate and decide legislation, or to choose governing officials.' },
];

function hay(card) {
  return [card && card.title, card && card.description, card && card.extract].map((s) => String(s || '')).join(' ');
}

/** Pick one of the five base bodies from card kind/facts. */
export function pickBody(card = {}) {
  const desc = String(card.description || '');
  const extract = String(card.extract || '');
  if (PERSON_RE.test(desc) || /\((?:born|b\.)\s|\(\d{3,4}\s*[–-]\s*\d{2,4}\)/.test(desc)) return 'person';
  if (ANIMAL_RE.test(desc) || ANIMAL_RE.test(card.title || '')) return 'animal';
  if (PLACE_RE.test(desc) || PLACE_EXTRACT_RE.test(extract.slice(0, 220))) return 'place';
  if (OBJECT_RE.test(desc) || OBJECT_RE.test(card.title || '') || OBJECT_EXTRACT_RE.test(extract.slice(0, 220))) return 'object';
  return 'idea';
}

/** Subject colors: a named color in the card text, else a stable hue from the title. */
export function colorFromCard(card = {}) {
  const t = hay(card).toLowerCase();
  for (const [k, v] of Object.entries(COLOR_WORDS)) {
    if (new RegExp('\\b' + k + '\\b').test(t)) return v;
  }
  const hex = t.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
  if (hex) return hex[0].length === 4
    ? '#' + hex[1].split('').map((c) => c + c).join('')
    : hex[0];
  const key = String(card.title || card.description || 'void');
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  return BODY_PALETTE[Math.abs(h) % BODY_PALETTE.length];
}

/** A small prop true to the body (and a hint from the card when we can). */
export function propFor(body, card = {}) {
  const list = PROPS[body] || PROPS.idea;
  const t = hay(card).toLowerCase();
  if (body === 'person') {
    if (/\b(singer|musician|rapper|songwriter|composer)\b/.test(t)) return 'mic';
    if (/\b(writer|author|novelist|poet|playwright|journalist)\b/.test(t)) return 'quill';
    if (/\b(scientist|physicist|chemist|mathematician|biologist)\b/.test(t)) return 'book';
    if (/\b(chef|cook)\b/.test(t)) return 'wand';
  }
  if (body === 'animal') {
    if (/\b(fox|wolf|dog|canine)\b/.test(t)) return 'bone';
    if (/\b(bird|eagle|owl|penguin)\b/.test(t)) return 'leaf';
    if (/\b(cat|feline|lion|tiger)\b/.test(t)) return 'ball';
  }
  if (body === 'place') {
    if (/\b(capital|city|town)\b/.test(t)) return 'pin';
    if (/\b(country|nation)\b/.test(t)) return 'flag';
  }
  if (body === 'object' && /\b(telescope|microscope|camera|optical)\b/.test(t)) return 'star';
  if (body === 'idea' && /\b(government|theory|philosophy|concept)\b/.test(t)) return 'bulb';
  const key = String(card.title || body);
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h + key.charCodeAt(i) * (i + 1)) % list.length;
  return list[h];
}

/** A short line of the subject's own words (first extract sentence, trimmed). */
export function lineFromCard(card = {}) {
  const raw = String(card.extract || card.description || card.title || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '…';
  let s = raw.split(/(?<=[.!?])\s+/)[0] || raw;
  s = s.replace(/^["'«»]+|["'»«]+$/g, '').trim();
  if (s.length > 72) {
    const cut = s.slice(0, 69);
    const sp = cut.lastIndexOf(' ');
    s = (sp > 40 ? cut.slice(0, sp) : cut).trim() + '…';
  }
  return s || String(card.title || '…');
}

/** Full dress for a card: body + color + prop + speech line. */
export function dressFromCard(card = {}) {
  const body = pickBody(card);
  return {
    body,
    color: colorFromCard(card),
    prop: propFor(body, card),
    line: lineFromCard(card),
    title: String(card.title || '').trim() || null,
  };
}

export default { BODIES, PERSON_RE, SAMPLE_CARDS, BODY_PALETTE, pickBody, colorFromCard, propFor, lineFromCard, dressFromCard };
