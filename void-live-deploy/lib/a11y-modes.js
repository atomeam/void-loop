// Pure logic of the accessibility modes (tools pack 7, owner 2026-10-18: items 171 to 180). The state is one small object kept in this
// browser; each switch is a class on <html> (the look is in void.html's style block) or a small behaviour in skills/accessibility-modes.js.

export const KEY = 'a2m.void.a11y.v1';

/** every switch: its saved name, the class it puts on <html> (or '' when it is a behaviour), its panel label and what it does */
export const MODES = [
  { id: 'labels', cls: '', label: 'Screen-reader labels on objects', does: 'Every card gets a spoken name made from what is on it, not just its kind.' },
  { id: 'keys', cls: 'a11y-keys', label: 'Keyboard-only stage move', does: 'Tab to a card, then the arrow keys move it (Shift for bigger steps).' },
  { id: 'trap', cls: 'a11y-trap', label: 'Focus trap in cards', does: 'Tab stays inside the card you are in; Escape returns to the ask box.' },
  { id: 'motion', cls: 'a11y-motion', label: 'Reduced motion (hard switch)', does: 'Animations and transitions stop, and the worlds and figures hold still.' },
  { id: 'dyslexia', cls: 'a11y-dyslexia', label: 'Dyslexia-friendly font', does: 'A clearer face (OpenDyslexic, Atkinson Hyperlegible or Verdana if your device has one) with wider spacing.' },
  { id: 'colorblind', cls: 'a11y-cb', label: 'Colorblind-safe palette', does: 'Done / not done and right / wrong use blue and orange from the Okabe-Ito palette, and carry a ✓ or ✗ as well.' },
  { id: 'targets', cls: 'a11y-targets', label: 'Click targets of at least 44px', does: 'Buttons, fields and checkboxes grow to a 44 by 44 pixel touch size.' },
  { id: 'captions', cls: '', label: 'Captions for system speech', does: 'When Void reads aloud, the words appear at the bottom of the screen.' },
  { id: 'haptic', cls: '', label: 'Haptic tick on keep (mobile)', does: 'A short vibration when something is kept, on phones that can.' },
  { id: 'outline', cls: 'a11y-outline', label: 'Sticky focus outline', does: 'A thick outline stays on whatever has focus, however it got it.' },
];
export const IDS = MODES.map((m) => m.id);
export const DEFAULTS = { labels: true };

/** the saved state out of its text: only known switches, only true or false. Pure. */
export function readState(raw) {
  let o = null;
  try { o = JSON.parse(raw || 'null'); } catch (_) { o = null; }
  const out = {};
  for (const id of IDS) out[id] = o && typeof o === 'object' && typeof o[id] === 'boolean' ? o[id] : !!DEFAULTS[id];
  return out;
}
/** the state as text to store. Pure. */
export const writeState = (state) => JSON.stringify(Object.fromEntries(IDS.map((id) => [id, !!state[id]])));
/** the classes that belong on <html> for a state. Pure. */
export const classesFor = (state) => MODES.filter((m) => m.cls && state[m.id]).map((m) => m.cls);

const WORDS = {
  motion: String.raw`(?:reduce[ds]?[ -]motion|motion[ -]reduc(?:ed|tion)|(?:no|stop|kill|freeze)\s+(?:all\s+)?(?:the\s+)?(?:animations?|motion)|still\s+mode|calm\s+motion|hard\s+switch\s+for\s+motion|(?:turn|switch)\s+off\s+(?:all\s+)?(?:the\s+)?(?:animations?|motion)|(?:allow|restore)\s+(?:motion|animations?)|(?:motion|animations?)\s+back)`,
  dyslexia: String.raw`(?:dyslexi(?:a|c)[ -]?(?:friendly|safe)?\s*(?:font|mode|type|text)|(?:font|text)\s+for\s+dyslexia|dyslexi(?:a|c)[ -]friendly)`,
  colorblind: String.raw`(?:colou?r[ -]?blind(?:ness)?[ -]?(?:safe|friendly)?\s*(?:palette|mode|colou?rs|theme)|colou?r[ -]?blind[ -](?:safe|friendly))`,
  targets: String.raw`(?:(?:big(?:ger)?|large(?:r)?|44\s?px|44-pixel)\s+(?:click|tap|touch)\s+targets?|(?:click|tap|touch)\s+targets?\s+(?:of\s+)?(?:at\s+least\s+)?(?:44|bigger|larger|big|large)\s?(?:px)?|44\s?px\s+(?:click\s+|tap\s+|touch\s+)?targets?\s+mode)`,
  captions: String.raw`(?:captions?\s+(?:for|on)\s+(?:the\s+)?(?:system\s+|void\s+)?(?:speech|voice|read[ -]aloud)|(?:speech|voice|read[ -]aloud)\s+captions?|caption\s+(?:the\s+)?(?:system\s+)?(?:speech|voice))`,
  haptic: String.raw`(?:haptic\s+(?:tick|feedback|buzz)(?:\s+on\s+keep)?|(?:vibrate|buzz|tick)\s+(?:when|on|as)\s+(?:i\s+|you\s+)?keep(?:ing)?)`,
  outline: String.raw`(?:(?:sticky|persistent|thick|strong(?:er)?|always[ -]on|bold)\s+focus\s+(?:outline|ring|indicator)|focus\s+(?:outline|ring)\s+(?:always|sticky|stays))`,
  keys: String.raw`(?:keyboard[ -]only\s+(?:stage\s+)?(?:move|mode|moving|navigation)|(?:move|drag)\s+(?:the\s+)?(?:cards?|things|objects)\s+with\s+(?:the\s+)?(?:keyboard|arrow\s+keys)|arrow[ -]key\s+(?:move|moving))`,
  trap: String.raw`(?:focus[ -]trap(?:\s+(?:options?|mode|in\s+cards?))?|trap\s+(?:the\s+)?focus(?:\s+in\s+(?:the\s+)?cards?)?)`,
  labels: String.raw`(?:screen[ -]?reader\s+labels?(?:\s+on\s+(?:objects|cards|things))?|(?:describe|label)\s+(?:the\s+)?(?:objects|cards|things)\s+for\s+(?:a\s+)?screen[ -]?readers?|aria\s+labels?)`,
};
const OFF = /\b(?:off|disable[ds]?|stop|remove|without|undo|clear|no\s+more|allow\s+(?:motion|animations?)|animations?\s+(?:back|on)|motion\s+(?:back|on))\b/i;
const ONLY_ON = /\b(?:turn|switch|set)\s+(?:on|up)\b|\b(?:enable|use|start|activate)\b/i;

/**
 * What an accessibility ask means: { act:'panel' }, { act:'status' }, { act:'set', id, on } or null. Every switch needs its own words
 * ("what is dyslexia" is not an ask), and "off" works for all of them. Pure.
 */
export function parseA11y(text) {
  const t = String(text || '').trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ');
  if (!t || t.length > 120) return null;
  if (/^(?:please\s+)?(?:open\s+|show\s+|give\s+me\s+)?(?:the\s+|my\s+)?accessibility\s+(?:settings|modes?|panel|options|switches|toggles)$/i.test(t)) return { act: 'panel' };
  if (/^(?:which|what)\s+accessibility\s+(?:settings|modes?|switches)\s+are\s+on$/i.test(t)) return { act: 'status' };
  for (const id of ['trap', 'keys', 'labels', 'dyslexia', 'colorblind', 'targets', 'captions', 'haptic', 'outline', 'motion']) {
    if (!new RegExp('\\b' + WORDS[id] + '\\b', 'i').test(t)) continue;
    // a question about the thing is not a request to switch it
    if (/^(?:what|who|why|how|when|where|is|are|does|do|can|could)\b/i.test(t) && !/\b(?:on|off|enable|disable|turn|switch|use)\b/i.test(t)) return null;
    const turnOffMotion = id === 'motion' && /\b(?:turn|switch)\s+off\s+(?:all\s+)?(?:the\s+)?(?:animations?|motion)\b/i.test(t);
    const stopMotion = id === 'motion' && /\b(?:no|stop|kill|freeze)\s+(?:all\s+)?(?:the\s+)?(?:animations?|motion)\b/i.test(t) && !/\b(?:allow|back|no\s+more)\b/i.test(t);
    const off = !turnOffMotion && !stopMotion && OFF.test(t) && !ONLY_ON.test(t);
    return { act: 'set', id, on: !off };
  }
  return null;
}

// ---- labels for the screen reader --------------------------------------------------------------------

const KIND_NAMES = { sticky: 'Sticky note', notepad: 'Notepad', timer: 'Timer', clock: 'Clock', counter: 'Counter', list: 'Checklist', link: 'Link', image: 'Image', kept: 'Kept answer', calc: 'Calculator', shape: 'Shape', calendar: 'Calendar', tab: 'Tab',
  habits: 'Habit ring', decision: 'Decision matrix', study: 'Study card', devtool: 'Dev tool', minimap: 'Minimap', a11y: 'Accessibility settings', recipe: 'Recipe stack', figure: 'Figure' };
const TEXT_FIELDS = ['title', 'name', 'text', 'label', 'term', 'ask', 'expr', 'url'];

/** a spoken name for a stage thing: its kind and the first words it holds, at most 90 characters. Pure. */
export function describeThing(th) {
  if (!th || typeof th !== 'object') return '';
  const kind = KIND_NAMES[th.kind] || String(th.kind || 'card').replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const parts = [];
  if (th.kind === 'study' || th.kind === 'devtool') parts.push(String(th.mode || '').replace(/^./, (c) => c.toUpperCase()));
  for (const f of TEXT_FIELDS) {
    const v = th[f];
    if (typeof v === 'string' && v.trim()) { parts.push(v.trim().replace(/\s+/g, ' ')); break; }
  }
  if (th.kind === 'habits' && Array.isArray(th.habits)) parts.push(th.habits.map((x) => x.name).join(', '));
  if (th.kind === 'list' && Array.isArray(th.items)) parts.push(th.items.length + ' items');
  const label = (kind + (parts.filter(Boolean).length ? ': ' + parts.filter(Boolean).join(', ') : '')).slice(0, 90);
  return label;
}
/** is this label the page's own generic one ("sticky card") that a better name may replace? Pure. */
export const isGenericLabel = (s) => s == null || s === '' || /^[\w -]+ card$/i.test(String(s));

/** the new position for a thing moved by an arrow key (never off the top left); null for any other key. Pure. */
export function moveBy(th, key, big) {
  const d = big ? 40 : 10, v = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[key];
  if (!v) return null;
  return { x: Math.max(0, Math.round((+th.x || 0) + v[0])), y: Math.max(0, Math.round((+th.y || 0) + v[1])) };
}
