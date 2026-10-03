/**
 * figures skill — a small 3D friend that roams your own Void, notices your cursor, and leaves when you send it away
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Board Next #17. "summon a sprite", "bring a friend", "show me a 3D buddy"; "send them away" / "dismiss figures" (undo brings
 * them back); "less motion" holds them still. Figures are stage items in this browser (the personal layer), so the next
 * visitor still arrives at a blank Void. The 3D layer (skills/figures3d.js + three.js) loads only once a figure is on the stage.
 */
export const MOTION_KEY = 'a2m.void.motion.v1';

const NOUN = '(?:sprites?|buddy|buddies|friends?|figures?|figurines?|critters?|creatures?|companions?|pals?)';
const ADJ = '(?:(?:little|tiny|small|cute|new|roaming|void|3d|3-d|three[\\s-]?d)\\s+)*';
const SUMMON = new RegExp('^(?:please\\s+)?(?:summon|bring(?:\\s+(?:out|in))?|show\\s+me|give\\s+me|call(?:\\s+up)?|spawn|add|make\\s+me)\\s+'
  + '(?:me\\s+)?(?:a|an|another|one\\s+more|my|some)?\\s*' + ADJ + NOUN + '(?:\\s+(?:friend|buddy))?(?:\\s+please)?$');
const WHO = '(?:them|the\\s+' + ADJ + NOUN + '|my\\s+' + ADJ + NOUN + '|all\\s+(?:the\\s+)?' + ADJ + NOUN + '|everyone|everybody)';
const DISMISS = [
  new RegExp('^(?:please\\s+)?(?:send|wave)\\s+' + WHO + '\\s+(?:away|off|home)(?:\\s+please)?$'),
  new RegExp('^(?:please\\s+)?(?:dismiss|remove|clear|hide)\\s+(?:the\\s+|all\\s+(?:the\\s+)?|my\\s+)?' + ADJ + NOUN + '$'),
  new RegExp('^(?:bye|goodbye|bye\\s+bye|see\\s+you),?\\s+(?:little\\s+)?' + NOUN + '$'),
];
const STILL = /^(?:please\s+)?(?:less\s+motion|reduce(?:d)?\s+motion|hold\s+still|stay\s+still|stop\s+moving|keep\s+(?:them|the\s+(?:figures?|sprites?))\s+still|(?:figures?|sprites?)\s+hold\s+still)$/;
const ROAM = /^(?:please\s+)?(?:more\s+motion|let\s+(?:them|the\s+(?:figures?|sprites?))\s+(?:roam|move|wander)(?:\s+again)?|roam\s+free|you\s+can\s+move(?:\s+again)?)$/;

/** What a figures ask wants: { act: 'summon' | 'dismiss' | 'still' | 'roam' } or null. */
export function figuresOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!t) return null;
  if (SUMMON.test(t)) return { act: 'summon' };
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
  if (q.act === 'summon') {
    const th = api.summon && api.summon('figure', { body: 'sprite' });
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
  examples: ['summon a sprite', 'bring a friend', 'show me a 3D buddy', 'send them away', 'dismiss figures', 'less motion'],
  nearMisses: ['what is a sprite', 'how do I make friends', 'show me a figure of the heart', 'send an email to sam', 'what is reduced motion', 'sprite soda'],
  match(lower, text) { return !!figuresOf(text); },
  run,
};
