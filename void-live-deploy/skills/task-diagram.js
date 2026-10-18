/**
 * task-diagram skill - "map my tasks a -> b, b -> c, a -> d, d -> c" reads tasks as objects and each "->" as an arrow (what one
 * task unlocks). The card lists the commutative squares (two different routes from the same start to the same end that share no
 * task in between) and names "the real blocker": the tasks with no path to the goal, and the arrow that is missing (a dead end
 * that should lead on). The goal is "goal: c" if given, else the one task nothing follows. Kept with the stage on this device,
 * nothing sent anywhere. Asked for by the owner (2026-10-18; commutative diagrams for plans).
 */
import { addThing, cardEl } from '../lib/stage-pack.js';
import { h, splitOn } from '../lib/stage-math.js';

export const MAX_EDGES = 40, MAX_PATHS = 200;
const key = (s) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** { edges:[[from,to]], goal } from "a -> b, b -> c; goal: c". Chains ("a -> b -> c") count as two arrows. Pure. */
export function parseTasks(body) {
  let text = String(body || ''), goal = '';
  const g = /(?:^|[\s,;])(?:goal|target)\s*[:=]\s*([^,;\n]+)/i.exec(text);
  if (g) { goal = g[1].trim().slice(0, 40); text = text.replace(g[0], ' '); }
  const edges = [];
  for (const part of splitOn(text, /[,;\n]/)) {
    const names = splitOn(part, /\s*(?:->|=>|→|-->)\s*/).map((n) => n.slice(0, 40));
    for (let i = 0; i + 1 < names.length && edges.length < MAX_EDGES; i++) if (key(names[i]) !== key(names[i + 1])) edges.push([names[i], names[i + 1]]);
  }
  return { edges, goal };
}

/** the body of a "map my tasks ..." ask (it must hold at least one arrow), or null. Pure. */
export function bodyOf(text) {
  const m = /^\s*(?:please\s+)?(?:map|diagram|draw)\s+(?:out\s+)?(?:my|the)\s+tasks?\s*(?:[:\-]|as|from)?\s*([\s\S]+)$/i.exec(String(text || ''));
  return m && parseTasks(m[1]).edges.length ? m[1].trim() : null;
}

/** the graph: node display names, adjacency by key, the goal key (stated, else the single sink, else the last sink). Pure. */
export function graphOf({ edges, goal }) {
  const names = new Map(), out = new Map(), inn = new Map();
  const add = (n) => { const k = key(n); if (!names.has(k)) { names.set(k, n); out.set(k, new Set()); inn.set(k, new Set()); } return k; };
  for (const [a, b] of edges) { const ka = add(a), kb = add(b); out.get(ka).add(kb); inn.get(kb).add(ka); }
  const sinks = [...names.keys()].filter((k) => !out.get(k).size);
  let goalKey = goal ? key(goal) : '';
  if (goalKey && !names.has(goalKey)) { names.set(goalKey, goal); out.set(goalKey, new Set()); inn.set(goalKey, new Set()); }
  if (!goalKey) goalKey = sinks.length ? sinks[sinks.length - 1] : '';
  return { names, out, inn, goal: goalKey, sinks };
}

/** all simple paths from s to t (capped), each a list of keys. Pure. */
export function pathsBetween(g, s, t) {
  const found = [];
  const walk = (at, trail) => {
    if (found.length >= MAX_PATHS) return;
    if (at === t) { found.push(trail); return; }
    for (const nx of g.out.get(at)) if (!trail.includes(nx)) walk(nx, [...trail, nx]);
  };
  walk(s, [s]);
  return found;
}

/** the squares: for each start/end pair, two routes that share no task in between. Pure. */
export function squares(g) {
  const res = [];
  for (const s of g.names.keys()) for (const t of g.names.keys()) {
    if (s === t) continue;
    const ps = pathsBetween(g, s, t);
    if (ps.length < 2) continue;
    let pair = null;
    for (let i = 0; i < ps.length && !pair; i++) for (let j = i + 1; j < ps.length; j++) {
      const mi = new Set(ps[i].slice(1, -1));
      if (ps[j].slice(1, -1).every((x) => !mi.has(x))) { pair = [ps[i], ps[j]]; break; }
    }
    if (pair) res.push({ from: g.names.get(s), to: g.names.get(t), routes: pair.map((p) => p.map((k) => g.names.get(k))) });
  }
  return res;
}

/** the tasks that can reach the goal (the goal included). Pure. */
export function reaches(g, goal = g.goal) {
  const seen = new Set(goal ? [goal] : []), todo = goal ? [goal] : [];
  while (todo.length) for (const p of g.inn.get(todo.pop()) || []) if (!seen.has(p)) { seen.add(p); todo.push(p); }
  return seen;
}

/** the real blocker: tasks with no path to the goal, and for each dead end the arrow that is missing. Pure. */
export function blockers(g) {
  if (!g.goal) return { cycle: true, stuck: [], missing: [], unreached: false };
  const ok = reaches(g), stuck = [...g.names.keys()].filter((k) => !ok.has(k));
  const missing = stuck.filter((k) => !g.out.get(k).size && k !== g.goal).map((k) => g.names.get(k) + ' -> ' + g.names.get(g.goal));
  const starts = [...g.names.keys()].filter((k) => !g.inn.get(k).size && k !== g.goal);
  return { cycle: false, stuck: stuck.map((k) => g.names.get(k)), missing, unreached: !!g.goal && starts.length > 0 && !starts.some((s) => ok.has(s)) };
}

/** a plain one-line sentence about the blocker. Pure. */
export function blockerLine(b, g) {
  if (b.cycle) return 'Every task leads on, so there is a loop and no end: say the goal with "goal: <task>".';
  if (!b.stuck.length) return 'No blocker: every task leads to ' + g.names.get(g.goal) + '.';
  if (b.missing.length) return 'The real blocker: ' + b.missing.join(', ') + ' (missing). ' + b.stuck.length + ' task' + (b.stuck.length === 1 ? ' has' : 's have') + ' no path to ' + g.names.get(g.goal) + '.';
  return 'The real blocker: ' + b.stuck.join(', ') + ' cannot reach ' + g.names.get(g.goal) + ' (a gap in the path).';
}

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'task-diagram');
  const g = graphOf(parseTasks(th.body || '')), sq = squares(g), b = blockers(g);
  el.append(h('b', {}, 'Task diagram'), h('div', { style: 'font-size:12px;opacity:.8' }, g.names.size + ' tasks · goal: ' + (g.goal ? g.names.get(g.goal) : 'none')));
  el.append(h('div', { className: 'td-squares', style: 'margin-top:6px' }, h('b', {}, sq.length ? 'Commutative: ' + sq.length : 'No commutative squares')));
  for (const s of sq) el.append(h('div', { className: 'td-square', style: 'font-size:13px;margin:2px 0' }, s.from + ' to ' + s.to + ': ' + s.routes.map((r) => r.join(' -> ')).join('  =  ')));
  el.append(h('div', { className: 'td-blocker', style: 'margin-top:8px;font-weight:600;color:' + (b.stuck.length || b.cycle ? '#ffd166' : '#78dc96') }, blockerLine(b, g)));
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

export function ask(lower, text, stageApi) {
  const body = bodyOf(text);
  if (!body) return '';
  addThing(stageApi, 'taskdiagram', { body: body.slice(0, 2000) });
  stageApi.save(); stageApi.render();
  return 'task-diagram';
}

export default {
  name: 'task-diagram',
  examples: ['map my tasks a -> b, b -> c, a -> d, d -> c', 'map my tasks: write -> review -> ship, write -> test; goal: ship'],
  nearMisses: ['map my route to work', 'map my tasks for tomorrow', 'what is a commutative diagram'],
  bodyOf,
  match(lower, text) { return !!bodyOf(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'task-diagram' : 'none'; },
  stageKinds: { taskdiagram: { mount, ask } },
};
