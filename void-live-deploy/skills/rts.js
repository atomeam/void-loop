/**
 * rts skill — Verse's world as a real-time strategy game (owner, 2026-10-16: "the world of Verse itself should become a working RTS
 * game so if a background is added the floating figures are grounded and can interact and build. gather wood supplies all with
 * whatever the user has summoned. so new summons are treated as new resources for the chosen backdrop or scene"). The loop is Age of
 * Empires', taken whole: what you summon is the resource (a tree is wood, a rock is stone, every food thing is food), a villager
 * gathers the nearest node by itself and carries each load to the camp, the camp's stock pays for what the forge raises.
 *   "start a camp"            the camp: the drop-off with its stock, the resource bar on its label, the scene grounded
 *   "gather wood|stone|food"  steers every villager to one resource ("everyone gather stone")
 *   "build a hut"             pays from the stock and raises the forge model by the camp; short, says what is missing (lib/rts.js BUILDS)
 *   "how are we doing"        the stock in words
 * The walking is in skills/figures3d.js (gather, deliver) and skills/scripts.js (the same while you are away); the rules in lib/rts.js.
 * A grounded scene (a backdrop, a world, or a camp) keeps the figures to the ground band: <html class="v-grounded">.
 */
import { orderOf, BUILDS, canPay, pay, missing, stockLine, report, fullStock, yieldOf } from '../lib/rts.js';
import { natureOf } from './scripts.js';

let S = null; // the stage api, from the first render (decorate) or ask
const campOf = (things) => Object.values(things).find((t) => t && t.kind === 'camp') || null;
const figuresOf = (things) => Object.values(things).filter((t) => t && t.kind === 'figure');
const tagsOfThing = (t) => natureOf(String(t.kindOf || t.title || '')).tags;
export const villagersOf = (things) => figuresOf(things).filter((t) => tagsOfThing(t).includes('villager'));
export const nodesOf = (things) => figuresOf(things).filter((t) => yieldOf(tagsOfThing(t)) && !(t.res && t.res.left <= 0));

/** every summoned thing on the scene that yields something gets its loads (`res`); returns how many were new. Pure over the things. */
export function tagNodes(things) {
  let n = 0;
  for (const t of figuresOf(things)) { if (t.res) continue; const y = yieldOf(tagsOfThing(t)); if (y) { t.res = { kind: y.res, left: y.units }; n += 1; } }
  return n;
}
/** a backdrop on, a world mounted, or a camp: the figures are on the ground */
export function isGrounded(stageApi) {
  const things = stageApi.things();
  if (campOf(things) || (stageApi.world && stageApi.world())) return true;
  const bd = typeof document !== 'undefined' && document.getElementById('void-backdrop');
  return !!(bd && getComputedStyle(bd).backgroundImage && getComputedStyle(bd).backgroundImage !== 'none');
}
/** how many villagers stand idle right now (the 3D layer's brains), for the resource bar */
function idleCount() {
  try { const s = window.__void3d && window.__void3d.state(); return s ? s.figures.filter((f) => f.kindOf === 'villager' && !f.carry && (f.mode === 'idle' || f.mode === 'wander')).length : 0; } catch (_) { return 0; }
}

/** the one camp, put up at the centre of the ground band when there is none; it becomes the picked thing */
export function ensure(stageApi) {
  const things = stageApi.things();
  let c = campOf(things);
  if (!c) {
    const st = stageApi.stage, w = st.clientWidth || 800, h = st.clientHeight || 600;
    c = { id: 'camp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind: 'camp', x: Math.max(40, w / 2 - 80), y: Math.max(40, h * 0.6), stock: fullStock(), built: [] };
    things[c.id] = c;
    stageApi.select(c.id);
  }
  return c;
}

function mount(th, stageApi) {
  S = stageApi;
  const el = document.createElement('div');
  el.className = 'thing camp'; el.dataset.id = th.id;
  el.style.left = th.x + 'px'; el.style.top = th.y + 'px';
  el.style.cssText += ';min-width:160px;padding:8px 10px 6px;border-radius:12px;background:rgba(28,22,16,.78);border:1px solid rgba(233,200,120,.25);color:#efe4cb;font:13px Georgia,"Times New Roman",serif;box-shadow:0 6px 18px rgba(0,0,0,.35)';
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';
  const label = document.createElement('div'); label.className = 'camp-label'; label.style.cssText = 'letter-spacing:.02em;white-space:nowrap';
  label.textContent = stockLine(th.stock, idleCount()); label.dataset.stock = JSON.stringify(fullStock(th.stock));
  const sub = document.createElement('div'); sub.className = 'camp-sub'; sub.style.cssText = 'font-size:11px;color:rgba(239,228,203,.6);margin-top:2px';
  const built = (th.built || []).length;
  sub.textContent = 'the camp' + (built ? ' · built ' + th.built.join(', ') : ' · say "build a hut" when the wood is in');
  el.append(label, sub);
  // the camp in 3D beside the label (skills/mini/camp.js): the fire, the log pile that grows with the wood, the cairn, the basket
  if (stageApi.miniature) stageApi.miniature(el, 'camp', { stock: fullStock(th.stock), built: th.built || [] }, { key: th.id, place: 'beside', width: 150, height: 130, label: 'the camp: ' + stockLine(th.stock) }).catch(() => {});
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** after every render: the ground, and every new summon's yield */
function decorate(stageApi) {
  S = stageApi;
  const things = stageApi.things();
  const on = isGrounded(stageApi);
  document.documentElement.classList.toggle('v-grounded', on);
  if (on) tagNodes(things); // saved with the next save; the 3D layer reads `res` when it builds the figure
}

// a villager reached the camp with a load (figures3d.js): into the stock, and the label follows
if (typeof document !== 'undefined') document.addEventListener('void:rts-deliver', (e) => {
  if (!S) return;
  const things = S.things(), c = campOf(things), res = e && e.detail && e.detail.res;
  if (!c || !res) return;
  c.stock = fullStock(c.stock); c.stock[res] = (c.stock[res] || 0) + 1;
  S.save(); S.render();
});

async function run(text, api) {
  const o = orderOf(text);
  if (!o) return 'none';
  const stageApi = api.stage; S = stageApi;
  const things = stageApi.things(), say = api.say;
  if (o.act === 'camp') {
    const had = campOf(things); const c = ensure(stageApi); tagNodes(things);
    stageApi.save(); stageApi.render();
    say(had ? 'the camp is here: ' + stockLine(c.stock) : 'camp started: summon a villager, add a tree or a rock, and they gather by themselves');
    return 'rts';
  }
  if (o.act === 'gather') {
    const vs = villagersOf(things);
    if (!vs.length) { say('no villagers yet: say "summon a villager"'); return 'rts'; }
    if (!campOf(things)) { ensure(stageApi); }
    for (const v of vs) v.script = { ...(v.script || {}), reactsTo: { ...((v.script && v.script.reactsTo) || {}), wood: 'greet', stone: 'greet', food: 'greet', [o.res]: 'gather' } };
    stageApi.save(); stageApi.render();
    say((vs.length === 1 ? 'the villager gathers ' : vs.length + ' villagers gather ') + o.res + (nodesOf(things).some((n) => yieldOf(tagsOfThing(n)).res === o.res) ? '' : ' (nothing to take it from yet: add a ' + (o.res === 'wood' ? 'tree' : o.res === 'stone' ? 'rock' : 'carrot') + ')'));
    return 'rts';
  }
  if (o.act === 'build') {
    // a build order on a bare stage starts the game: the camp goes up first and the order says what it still needs
    // (the forge's "make a hut" is still a printable model; the pair forge~rts in tools/skill-overlap.json is this one word, build)
    let c = campOf(things);
    if (!c) { c = ensure(stageApi); tagNodes(things); }
    if (!BUILDS[o.key]) { say('the camp cannot build that yet'); return 'rts'; }
    if (!canPay(c.stock, o.key)) { say(missing(c.stock, o.key) + (villagersOf(things).length ? '; the villagers are on it' : '; summon a villager to gather it')); return 'rts'; }
    c.stock = pay(c.stock, o.key); c.built = [...(c.built || []), o.key];
    const n = c.built.length;
    api.summon && api.summon('forge', { key: o.key, angle: 0, x: Math.round(c.x + 190 + (n % 3) * 70), y: Math.round(c.y - 40 - Math.floor(n / 3) * 60), ask: text, builtBy: 'camp' });
    stageApi.save(); stageApi.render();
    say('the villagers raised a ' + o.key + ' (' + Object.entries(BUILDS[o.key]).map(([r, k]) => k + ' ' + r).join(', ') + ')');
    return 'rts';
  }
  if (o.act === 'report') {
    const c = campOf(things);
    if (!c) { say('no camp yet: "start a camp"'); return 'rts'; }
    say(report(c.stock, { villagers: villagersOf(things).length, nodes: nodesOf(things).length, built: c.built || [] }));
    return 'rts';
  }
  return 'none';
}

export default {
  name: 'rts',
  examples: ['start a camp', 'gather wood', 'build a hut', 'how are we doing', 'everyone gather stone'],
  nearMisses: ['build a website', 'make a 3d house', 'how are you doing', 'campfire', 'gather my notes'],
  match(lower) { return !!orderOf(lower); },
  run,
  decorate,
  stageKinds: { camp: { mount, ensure } },
};
