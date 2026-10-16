// Playing a stack of rule sets (frontier #35): which sets there are, "duel with mana and tribute rules" read into set names, and a
// deterministic player that tries its best moves in a fixed order, so a few turns of two sides can be shown with every clash in words.
// Pure: it uses rules-engine.js step() and nothing else. The player never cheats the engine: a move the rules forbid is logged as denied.
import { step, startGame, newGame, resolveStack, explain, makeDef } from './rules-engine.js';

export const SET_NAMES = ['duel', 'mana', 'tribute', 'initiative', 'merge', 'lines'];
const ALIASES = { duel: ['duel', 'the duel', 'cards', 'card duel', 'card game', 'the card game'], mana: ['mana', 'lands'], tribute: ['tribute', 'sacrifice'],
  initiative: ['initiative', 'turn order'], merge: ['merge', 'fusion'], lines: ['lines', 'chess', 'chess moves'] };
const alias = (w) => SET_NAMES.find((n) => ALIASES[n].includes(w.replace(/\s+(?:rules?|rule ?sets?|sets?)$/, '').trim())) || null;

/** "duel with mana and tribute rules" -> ['duel','mana','tribute']; null unless two or more known sets are named after play/duel. Pure. */
export function gamesOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = /^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(play|duel|try|run)\s+(?:a |the |some )?(.+)$/.exec(t); if (!m) return null;
  const rest = (m[1] === 'duel' ? 'duel, ' : '') + m[2].replace(/^with\s+/, '');
  const parts = rest.split(/\s*(?:,|\band\b|\bwith\b|\bplus\b|\bagainst\b)\s*/).filter(Boolean), names = [];
  for (const p of parts) { const n = alias(p); if (!n) return null; if (!names.includes(n)) names.push(n); }
  return names.length >= 2 ? names : null;
}

/** five cards of our own for the demo, the same for both sides */
export const DEMO_POOL = [
  { name: 'Ember Drake', kind: 'creature', power: 7, resistance: 4, cost: 2, speed: 2, arrows: 1 },
  { name: 'Gate Warden', kind: 'creature', power: 3, resistance: 6, cost: 2, speed: 0, arrows: 2 },
  { name: 'Spark Scout', kind: 'creature', power: 2, resistance: 2, cost: 1, speed: 3, arrows: 1 },
  { name: 'Coin Sprite', kind: 'creature', power: 1, resistance: 2, income: 2, cost: 2, speed: 1, arrows: 1 },
  { name: 'Lantern Song', kind: 'song', power: 1, resistance: 1, income: 1, cost: 1, speed: 0, arrows: 1 },
].map(makeDef);

const used = (stack) => new Set(resolveStack(stack).rules.flatMap((r) => r.when));
const mineActive = (st, side) => st.cards.filter((c) => c.side === side && !c.neutralised);
const strength = (c) => c.power + c.resistance;
/** the events the player would try, best first, for the side to move; a pure function of the state */
function candidates(st, stack, pool) {
  const side = st.side, ev = used(stack), out = [], mine = mineActive(st, side), foes = st.cards.filter((c) => c.side !== side && !c.neutralised);
  if (ev.has('land')) out.push({ type: 'land' });
  if (ev.has('attack')) for (const a of mine.slice().sort((p, q) => q.power - p.power)) for (const t of foes.slice().sort((p, q) => (q.root ? 1 : 0) - (p.root ? 1 : 0) || q.power - p.power)) for (let pledge = 0; pledge <= Math.min(3, st.res[side].coins); pledge++) out.push({ type: 'attack', from: a.id, target: t.id, pledge, answer: Math.min(3, st.res[t.side].coins), probe: true });
  if (ev.has('summon')) {
    const arrow = []; for (const c of st.cards) if (c.side === side) for (let i = 0; i < c.arrows; i++) if (!st.cards.some((o) => o.parent === c.id && o.slot === i)) arrow.push({ parent: c.id, slot: i });
    const spare = mine.filter((c) => !c.root).sort((p, q) => strength(p) - strength(q))[0];
    for (const def of pool.slice().sort((p, q) => strength(q) - strength(p) || (p.name < q.name ? -1 : 1))) if (arrow[0]) {
      out.push({ type: 'summon', def, parent: arrow[0].parent, slot: arrow[0].slot });
      if (spare) out.push({ type: 'summon', def, parent: arrow[0].parent, slot: arrow[0].slot, materials: [spare.id] });
    }
  }
  out.push({ type: 'pass' });
  return out;
}

/** play `turns` turns of both sides under the stack: { state, steps: [{ side, event, denied, log, clashes }], load } . Pure and deterministic. */
export function playTurns(stack, { turns = 4, pools = {}, state = null } = {}) {
  const load = resolveStack(stack).conflicts; let st = state || startGame(newGame(), stack).state; const steps = [];
  for (let t = 0; t < turns && !st.over; t++) {
    const side = st.side; let tried = 0;
    for (let n = 0; n < 7 && !st.over && st.side === side; n++) {
      let took = false;
      for (const ev of candidates(st, stack, pools[side] || DEMO_POOL)) {
        const r = step(st, ev, stack), isProbe = ev.probe;
        if (isProbe) { const tgt = r.state.cards.find((c) => c.id === ev.target); if (r.denied || !tgt.neutralised) continue; } // an attack is tried only when it gets through
        if (r.denied && r.denied.set === 'engine') continue;
        const clashes = r.conflicts.filter((c) => c.kind === 'clash');
        if (r.denied) { if (ev.type !== 'land' && tried++ < 2) steps.push({ side, event: ev, denied: r.denied, log: r.log, clashes }); continue; }
        steps.push({ side, event: ev, denied: null, log: r.log, clashes }); st = r.state; took = true; break;
      }
      if (!took) break;
    }
  }
  return { state: st, steps, load };
}

/** a played game as plain-words lines, in order (what was loaded out first, then each try and each move) */
export function playLines(play, { detail = false } = {}) {
  const out = explain(play.load), keep = (l) => detail || !((l.kind === 'modify' || l.kind === 'replace') && l.event === 'turnStart');
  for (const s of play.steps) out.push(...explain([...s.clashes, ...(s.denied ? s.log.filter((l) => l.kind === 'deny') : s.log.filter(keep))]));
  return out;
}
