/**
 * figures skill — a small 3D friend that roams your own Void, notices your cursor, and leaves when you send it away
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Board Next #17. "summon a sprite", "bring a friend", "show me a 3D buddy"; "send them away" / "dismiss figures" (undo brings
 * them back); "less motion" holds them still. Figures are stage items in this browser (the personal layer), so the next
 * visitor still arrives at a blank Void. The 3D layer (skills/figures3d.js + three.js) loads only once a figure is on the stage.
 */
import { fallbackScript, natureOf } from './scripts.js';
export const MOTION_KEY = 'a2m.void.motion.v1';

const NOUN = '(?:sprites?|buddy|buddies|friends?|figurines?|critters?|creatures?|companions?|pals?)'; // not bare figure(s): Motelet
const FIG = '(?:sprites?|buddy|buddies|friends?|figures?|figurines?|critters?|creatures?|companions?|pals?)';
const ADJ = '(?:(?:little|tiny|small|cute|new|roaming|void|3d|3-d|three[\\s-]?d)\\s+)*';
const SUMMON = new RegExp('^(?:please\\s+)?(?:summon|bring(?:\\s+(?:out|in))?|show\\s+me|give\\s+me|call(?:\\s+up)?|spawn|add|make\\s+me)\\s+'
  + '(?:me\\s+)?(?:a|an|another|one\\s+more|my|some)?\\s*' + ADJ + NOUN + '(?:\\s+(?:friend|buddy))?(?:\\s+please)?$');
const WHO = '(?:them|the\\s+' + ADJ + FIG + '|my\\s+' + ADJ + FIG + '|all\\s+(?:the\\s+)?' + ADJ + FIG + '|everyone|everybody)';
const DISMISS = [
  new RegExp('^(?:please\\s+)?(?:send|wave)\\s+' + WHO + '\\s+(?:away|off|home)(?:\\s+please)?$'),
  new RegExp('^(?:please\\s+)?(?:dismiss|remove|clear|hide)\\s+(?:the\\s+|all\\s+(?:the\\s+)?|my\\s+)?' + ADJ + FIG + '$'),
  new RegExp('^(?:bye|goodbye|bye\\s+bye|see\\s+you),?\\s+(?:little\\s+)?' + FIG + '$'),
];
const STILL = /^(?:please\s+)?(?:less\s+motion|reduce(?:d)?\s+motion|hold\s+still|stay\s+still|stop\s+moving|keep\s+(?:them|the\s+(?:figures?|sprites?))\s+still|(?:figures?|sprites?)\s+hold\s+still)$/;
const ROAM = /^(?:please\s+)?(?:more\s+motion|let\s+(?:them|the\s+(?:figures?|sprites?))\s+(?:roam|move|wander)(?:\s+again)?|roam\s+free|you\s+can\s+move(?:\s+again)?)$/;

/** What a figures ask wants: { act: 'summon' | 'dismiss' | 'still' | 'roam' } or null. */
// Things with a nature (skills/scripts.js NATURES): "summon a zombie" and "add a brain", and the zombie finds the brain and
// eats it; "bring a cat" and "add a mouse", and the cat gives chase. Each arrives with the body and colour its kind wears.
const NATURE_LOOK = { zombie: ['person', '#7d9a5a'], brain: ['object', '#e9a3b4'], cat: ['animal', '#e39a4f'], mouse: ['animal', '#b9b3ad'],
  dog: ['animal', '#a8784c'], bone: ['object', '#efe8da'], fish: ['animal', '#5fa8d8'], cheese: ['object', '#f2c94c'], rabbit: ['animal', '#e8e1d8'],
  carrot: ['object', '#ef8a2c'], monkey: ['animal', '#8a5a3a'], banana: ['object', '#f5d84a'], shark: ['animal', '#7c8fa3'], bee: ['animal', '#f2c230'], flower: ['object', '#ef6fa0'],
  cloud: ['object', '#eef1f4', 0.3], sun: ['object', '#ffc23a', 0.05], fire: ['object', '#ff6a1a', 0.05], ice: ['object', '#cfeaff', 0.05], water: ['place', '#2e6d96', 0.05] }; // third: walking pace (clouds drift, a fire stays put)
const NATURE_SUMMON = /^(?:please\s+)?(?:summon|bring(?:\s+(?:out|in))?|add|spawn|make|drop|put|release|let\s+loose|give\s+me|show\s+me)\s+(?:me\s+)?(?:(?:an|a|some|another|one\s+more|the)\s+)?([a-z]+(?:\s[a-z]+)?)(?:\s+(?:on\s+the\s+stage|here|in))?(?:\s+please)?$/;
// Every summon is an individual: a random seed picks its shade, size and build, so no two zombies match; "clone it"
// copies the seed, so a clone is identical. Pure: the same seed always gives the same look (tests rely on it).
export function lookFor(kind, seed) {
  let a = seed >>> 0; const r = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hex = (NATURE_LOOK[kind] || ['', '#9d8cff'])[1], n = parseInt(hex.slice(1), 16), rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255);
  const max = Math.max(...rgb), min = Math.min(...rgb), l = (max + min) / 2, d = max - min, sat = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
  let h = !d ? 0 : max === rgb[0] ? ((rgb[1] - rgb[2]) / d) % 6 : max === rgb[1] ? (rgb[2] - rgb[0]) / d + 2 : (rgb[0] - rgb[1]) / d + 4; h = (h * 60 + 360) % 360;
  h = (h + (r() - 0.5) * 36 + 360) % 360; const L = Math.max(0.12, Math.min(0.9, l + (r() - 0.5) * 0.24)), S = Math.max(0, Math.min(1, sat + (r() - 0.5) * 0.3));
  const C = (1 - Math.abs(2 * L - 1)) * S, X = C * (1 - Math.abs(((h / 60) % 2) - 1)), m = L - C / 2;
  const [r1, g1, b1] = h < 60 ? [C, X, 0] : h < 120 ? [X, C, 0] : h < 180 ? [0, C, X] : h < 240 ? [0, X, C] : h < 300 ? [X, 0, C] : [C, 0, X];
  const color = '#' + [r1, g1, b1].map((c) => Math.round((c + m) * 255).toString(16).padStart(2, '0')).join('');
  return { color, size: +(0.8 + r() * 0.42).toFixed(3), wide: +(0.84 + r() * 0.32).toFixed(3), tall: +(0.86 + r() * 0.3).toFixed(3), pace: +(0.8 + r() * 0.45).toFixed(3) };
}
const CLONE = /^(?:please\s+)?(?:clone|copy|duplicate|twin)\s+(?:it|that|this|him|her|them|(?:the|that|this|my)\s+([a-z]+(?:\s[a-z]+)?))$|^(?:make|give\s+me)\s+(?:a\s+)?(?:copy|clone|twin)\s+of\s+(?:it|that|(?:the|that|my)\s+([a-z]+(?:\s[a-z]+)?))$/;

export function natureSummon(t) {
  const m = NATURE_SUMMON.exec(t); if (!m) return null;
  const noun = m[1], last = noun.split(' ').pop(), find = (w) => natureOf(w).tags.find((x) => NATURE_LOOK[x]);
  // the last word is the thing ("a dog picture" is not a dog); a two-word name ("ice cube", "storm cloud") counts whole
  const kind = find(last) || (/^(?:pictures?|photos?|images?|drawings?|videos?|movies?|films?|songs?|facts?|names?|recipes?|emojis?|costumes?|toys?|games?)$/.test(last) ? null : find(noun));
  return kind ? { act: 'summon', kind, title: noun } : null;
}

export function figuresOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!t) return null;
  if (SUMMON.test(t)) return { act: 'summon' };
  const n = natureSummon(t); if (n) return n;
  const c = CLONE.exec(t); if (c) return { act: 'clone', what: c[1] || c[2] || null };
  if (DISMISS.some((re) => re.test(t))) return { act: 'dismiss' };
  if (STILL.test(t)) return { act: 'still' };
  if (ROAM.test(t)) return { act: 'roam' };
  return null;
}

function store() { try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (_) { return null; } }
function osWantsStill() { try { return !!(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; } }

async function run(text, api) {
  const q = figuresOf(text);
  if (!q) return 'none';
  const { say } = api;
  if (q.act === 'summon' && q.kind) {
    const [body, , pace] = NATURE_LOOK[q.kind], seed = (Math.random() * 4294967296) >>> 0, look = lookFor(q.kind, seed);
    if (pace) look.pace = +(look.pace * pace).toFixed(3);
    const th = api.summon && api.summon('figure', { body, ...look, seed, kindOf: q.kind, title: q.title, script: fallbackScript(body, q.title) });
    if (!th) { say('the stage is full'); return 'figures'; }
    say('a ' + q.title + ' is here, one of a kind');
    return 'figures';
  }
  if (q.act === 'clone') { // the last figure (or the last of the kind named), copied exactly from its seed
    const all = Object.values(api.stage.things()).filter((x) => x.kind === 'figure');
    const want = q.what ? natureOf(q.what.split(' ').pop()).tags.find((x) => NATURE_LOOK[x]) : null;
    const src = [...all].reverse().find((x) => !want || x.kindOf === want);
    if (!src) { say(want ? 'no ' + q.what + ' to clone yet' : 'nothing to clone yet'); return 'figures'; }
    const copy = { body: src.body, color: src.color, size: src.size, wide: src.wide, tall: src.tall, pace: src.pace, seed: src.seed, kindOf: src.kindOf, title: src.title, script: src.script };
    const th = api.summon && api.summon('figure', copy);
    if (!th) { say('the stage is full'); return 'figures'; }
    say('a twin of the ' + (src.title || 'figure'));
    return 'figures';
  }
  if (q.act === 'summon') {
    const th = api.summon && api.summon('figure', { body: 'sprite', script: fallbackScript('sprite', 'sprite') });
    if (!th) { say('the stage is full of friends'); return 'figures'; }
    say(osWantsStill() ? 'a sprite is here, holding still' : 'a sprite is here');
    return 'figures';
  }
  if (q.act === 'dismiss') {
    const n = api.summon ? api.summon('figure', { hide: true }) : 0;
    say(n ? (n === 1 ? 'sent away · undo brings it back' : n + ' sent away · undo brings them back') : 'no figures here');
    return 'figures';
  }
  const bag = store();
  if (q.act === 'still') {
    try { if (bag) bag.setItem(MOTION_KEY, 'still'); } catch (_) {}
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('void-motion'));
    say('holding still');
    return 'figures';
  }
  try { if (bag) bag.removeItem(MOTION_KEY); } catch (_) {}
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('void-motion'));
  say(osWantsStill() ? 'your device asks for less motion, so they stay still' : 'free to roam');
  return 'figures';
}

export default {
  name: 'figures',
  examples: ['summon a sprite', 'bring a friend', 'show me a 3D buddy', 'send them away', 'dismiss figures', 'less motion', 'summon a zombie', 'add a brain', 'bring a cat', 'add a mouse', 'clone the zombie', 'add a cloud', 'add a sea', 'add an ice cube', 'add a campfire'],
  nearMisses: ['what is a sprite', 'how do I make friends', 'show me a figure of the heart', 'summon a figure', 'summon motelet', 'send an email to sam', 'what is reduced motion', 'sprite soda'],
  match(lower, text) { return !!figuresOf(text); },
  run,
};
