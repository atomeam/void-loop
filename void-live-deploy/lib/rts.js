// Verse's world as a real-time strategy game (owner, 2026-10-16: "the world of Verse itself should become a working RTS game so if a
// background is added the floating figures are grounded and can interact and build. gather wood supplies all with whatever the
// user has summoned. so new summons are treated as new resources for the chosen backdrop or scene"). The loop is Age of Empires':
// resource nodes, villagers who carry one load home, a camp with a stock, buildings with costs. Verse's twist: what you summon is
// the node (a tree is wood, a rock is stone, every food thing is food). Pure rules; skills/rts.js is the stage half, skills/scripts.js
// and skills/figures3d.js walk the villagers.
export const RESOURCES = ['wood', 'stone', 'food'];
/** a nature tag (skills/scripts.js NATURES) -> what a thing yields and how many loads it holds */
export const YIELD = { tree: { res: 'wood', units: 8 }, rock: { res: 'stone', units: 6 }, food: { res: 'food', units: 2 } };
/** what can be built, from what (Age of Empires' costs, scaled to a camp that starts with nothing) */
export const BUILDS = {
  hut: { wood: 6 }, wall: { stone: 4 }, well: { stone: 3 }, bridge: { wood: 10 }, tower: { stone: 8, wood: 4 },
};
export const CAMP_WORDS = /^(?:please\s+)?(?:start|make|build|set\s+up|found|begin|pitch)\s+(?:(?:a|the|my|our)\s+)?(?:camp|base|settlement|village|town\s+cent(?:er|re))(?:\s+here)?$/;
const GATHER = /^(?:please\s+)?(?:(?:everyone|everybody|all\s+of\s+you|villagers?|workers?)[,:]?\s+)?(?:go\s+)?(?:gather|collect|harvest|chop|cut|mine|fetch|get|bring\s+back)\s+(?:some\s+|the\s+|more\s+)?(wood|stone|food|logs?|timber|rocks?|stones?|berries|supplies)(?:\s+(?:for\s+(?:the\s+)?camp|please|now))?$/;
const BUILD = /^(?:please\s+)?(?:build|construct|raise|put\s+up)\s+(?:(?:a|an|the|another)\s+)?(hut|house|cabin|wall|well|bridge|tower|watchtower)(?:\s+(?:here|there|by\s+the\s+camp|near\s+the\s+camp|please))?$/;
const REPORT = /^(?:please\s+)?(?:how\s+(?:are\s+we|is\s+the\s+camp|is\s+my\s+camp)\s+doing|(?:show\s+(?:me\s+)?(?:the\s+|our\s+|my\s+)?)?(?:resources|supplies|stock(?:pile)?|the\s+camp(?:'s\s+stock)?)|what\s+(?:do\s+we\s+have|have\s+we\s+gathered)|camp\s+(?:status|report))$/;
const RES_WORD = { logs: 'wood', log: 'wood', timber: 'wood', rocks: 'stone', rock: 'stone', stones: 'stone', berries: 'food', supplies: 'wood' };
const BUILD_WORD = { house: 'hut', cabin: 'hut', watchtower: 'tower' };

/** what a thing with these nature tags yields: { res, units } or null (scenery yields nothing). Pure. */
export function yieldOf(tags) {
  for (const t of Array.isArray(tags) ? tags : []) if (YIELD[t]) return { ...YIELD[t] };
  return null;
}
/** a stock with every resource present. Pure. */
export const fullStock = (s) => Object.fromEntries(RESOURCES.map((r) => [r, Math.max(0, Math.floor(+(s && s[r]) || 0))]));
/** can the camp pay for this build? Pure. */
export function canPay(stock, key) {
  const cost = BUILDS[key]; if (!cost) return false;
  const s = fullStock(stock); return Object.entries(cost).every(([r, n]) => s[r] >= n);
}
/** the stock after paying (or the same stock when it cannot). Pure. */
export function pay(stock, key) {
  if (!canPay(stock, key)) return fullStock(stock);
  const s = fullStock(stock); for (const [r, n] of Object.entries(BUILDS[key])) s[r] -= n; return s;
}
/** what a build still lacks, in words: "a hut needs 6 wood: 2 so far" ('' when it can be paid). Pure. */
export function missing(stock, key) {
  const cost = BUILDS[key]; if (!cost) return 'nothing like that can be built yet';
  const s = fullStock(stock), short = Object.entries(cost).filter(([r, n]) => s[r] < n);
  if (!short.length) return '';
  return 'a ' + key + ' needs ' + Object.entries(cost).map(([r, n]) => n + ' ' + r).join(' and ') + ': ' + short.map(([r]) => s[r] + ' ' + r).join(', ') + ' so far';
}
/** the camp's line: "wood 12 · stone 3 · food 4 · 2 idle" (idle left out when zero). Pure. */
export function stockLine(stock, idle = 0) {
  const s = fullStock(stock);
  return RESOURCES.map((r) => r + ' ' + s[r]).join(' · ') + (idle > 0 ? ' · ' + idle + ' idle' : '');
}
/** the stock in a sentence, for "how are we doing". Pure. */
export function report(stock, { villagers = 0, nodes = 0, built = [] } = {}) {
  const s = fullStock(stock), have = RESOURCES.filter((r) => s[r] > 0).map((r) => s[r] + ' ' + r);
  const can = Object.keys(BUILDS).filter((k) => canPay(s, k));
  return (have.length ? 'the camp has ' + have.join(', ') : 'the camp has nothing yet')
    + (villagers ? '; ' + villagers + ' villager' + (villagers === 1 ? '' : 's') : '; no villagers yet: summon one')
    + (nodes ? ', ' + nodes + ' thing' + (nodes === 1 ? '' : 's') + ' to gather from' : ', nothing to gather: add a tree or a rock')
    + (built.length ? '; built: ' + built.join(', ') : '')
    + (can.length ? '; you can build ' + can.map((k) => 'a ' + k).join(', ') : '') + '.';
}
/** what an ask orders: { act: 'camp' } | { act: 'gather', res } | { act: 'build', key } | { act: 'report' } | null. Pure. */
export function orderOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!t) return null;
  if (CAMP_WORDS.test(t)) return { act: 'camp' };
  const g = GATHER.exec(t); if (g) return { act: 'gather', res: RES_WORD[g[1]] || g[1] };
  const b = BUILD.exec(t); if (b) return { act: 'build', key: BUILD_WORD[b[1]] || b[1] };
  if (REPORT.test(t)) return { act: 'report' };
  return null;
}
