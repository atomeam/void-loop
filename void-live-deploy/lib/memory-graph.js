// The personal memory graph (asked by Void, 2026-10-18: "an upgrade that lets me keep a persistent, personal knowledge graph across
// conversations—so I could remember details you've shared before, notice patterns in your interests, and build on them over time
// without you having to repeat anything"). A tiny graph of what a person asks about, kept on this device only (the `graph` store in
// lib/state.js, localStorage) and never sent: nodes are skills, topics and explicit facts, edges join a skill to the topics it answered
// and two skills asked one after the other. A topic is never the sentence typed: only a few object words of it, lowercased, at most
// WORDS_MAX words and LABEL_MAX characters, letters only (no numbers, addresses or anything key-shaped). patterns() reads the graph back as
// what the person seems to care about; suggest() turns that into next asks taken only from skills' own example asks, never free text.
// Pure over the graph handed in; the three storage helpers at the end take the storage handed in (default localStorage) and never throw.
export const GRAPH_KEY = 'a2m.void.graph.v1';
export const NODE_MAX = 300, EDGE_MAX = 600; // beyond these the least recently seen nodes go, and the edges that touch them
export const LABEL_MAX = 40, WORDS_MAX = 4; // a topic label: a few object words, never the sentence
export const FACT_MAX = 120; // an explicit "remember that …" line
export const STALE_DAYS = 14; // a topic asked for often but not in this long is one "you have not come back to"
export const HALF_LIFE_DAYS = 14; // an interest's weight halves every two weeks without an ask
export const PAIR_WINDOW_MS = 30 * 60e3; // two skills asked within this long of each other are "together"
export const SKIP = new Set(['memory-graph']); // asking what the graph knows is not an interest
export const KINDS = new Set(['topic', 'skill', 'fact', 'thing']);
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const SLOTS = ['at night', 'in the morning', 'in the afternoon', 'in the evening']; // 0-6, 6-12, 12-18, 18-24, local time
export const NOTE = "I keep what you ask about on this device, to build on it. 'forget my patterns' clears it; 'stop remembering' turns it off";

const STOP = new Set(('a an the me my mine i you your please pls void v01d make makes made making add put show open give get set start create draw new ' +
  'another some this that these those it its is are be to for of on in at with and or from into up down out off as by do does did can could would will ' +
  'want need like let lets us we our what which who how when where why says saying say called named now here there just also again too today tomorrow tonight yesterday').split(' '));
const WORD = /^[a-z][a-z'-]{1,15}$/; // words of letters only, two or more: a number, an address, a key, a long token or a stray letter is never a label
const ms = (at) => { const n = at instanceof Date ? at.getTime() : Number(at); return Number.isFinite(n) ? n : Date.now(); };
const iso = (t) => new Date(t).toISOString();
const dayMs = 864e5;

/** a skill name as the router writes it ('skill:clock' or 'clock'), or ''. Pure. */
export function skillName(s) { const m = /^(?:skill:)?([a-z0-9][a-z0-9_-]{0,40})$/i.exec(String(s || '').trim()); return m ? m[1].toLowerCase() : ''; }

/** the topic of an ask: its object words (lowercased, stop words out, letters only, at most WORDS_MAX words and LABEL_MAX characters), else the skill's name. Pure. */
export function topicOf(skill, text) {
  const words = String(text || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9'\s-]+/g, ' ').split(/\s+/).filter((w) => w && WORD.test(w) && !STOP.has(w)).slice(0, WORDS_MAX);
  let label = '';
  for (const w of words) { const next = label ? label + ' ' + w : w; if (next.length > LABEL_MAX) break; label = next; }
  return label || skillName(skill) || 'something';
}

/** an empty graph. Pure. */
export function empty() {
  return { v: 1, on: true, noted: false, first: null, last: null, asks: 0, nodes: {}, edges: {}, visits: Array.from({ length: 7 }, () => [0, 0, 0, 0]), prev: null };
}

const isNode = (n) => n && typeof n === 'object' && KINDS.has(n.kind) && typeof n.label === 'string' && n.label.length <= FACT_MAX && Number.isFinite(n.n) && typeof n.first === 'string' && typeof n.last === 'string';
/** a graph from its stored text: only a well-formed one; anything else is an empty graph. Pure. */
export function parseGraph(text) {
  let j = null; try { j = JSON.parse(text || 'null'); } catch (_) {}
  const g = empty();
  if (!j || typeof j !== 'object' || Array.isArray(j) || j.v !== 1) return g;
  g.on = j.on !== false; g.noted = j.noted === true;
  g.first = typeof j.first === 'string' ? j.first : null; g.last = typeof j.last === 'string' ? j.last : null;
  g.asks = Number.isFinite(j.asks) && j.asks >= 0 ? Math.floor(j.asks) : 0;
  if (j.nodes && typeof j.nodes === 'object') for (const [id, n] of Object.entries(j.nodes)) if (isNode(n) && /^(topic|skill|fact|thing):/.test(id)) g.nodes[id] = { kind: n.kind, label: n.label, n: Math.floor(n.n), first: n.first, last: n.last };
  if (j.edges && typeof j.edges === 'object') for (const [k, n] of Object.entries(j.edges)) { const [a, b] = k.split('>'); if (a && b && g.nodes[a] && g.nodes[b] && Number.isFinite(n) && n > 0) g.edges[k] = Math.floor(n); }
  if (Array.isArray(j.visits) && j.visits.length === 7) g.visits = j.visits.map((d) => (Array.isArray(d) && d.length === 4 ? d.map((x) => (Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0)) : [0, 0, 0, 0]));
  if (j.prev && typeof j.prev === 'object' && skillName(j.prev.skill) && Number.isFinite(j.prev.at)) g.prev = { skill: skillName(j.prev.skill), at: j.prev.at };
  if (g.asks === 0 && Object.keys(g.nodes).length === 0) g.first = null;
  return g;
}

const copy = (g) => ({ ...g, nodes: { ...g.nodes }, edges: { ...g.edges }, visits: g.visits.map((d) => d.slice()) });
const bump = (g, id, kind, label, now) => { const n = g.nodes[id]; g.nodes[id] = n ? { ...n, n: n.n + 1, last: iso(now) } : { kind, label, n: 1, first: iso(now), last: iso(now) }; };
const join = (g, a, b) => { const k = a + '>' + b; g.edges[k] = (g.edges[k] || 0) + 1; };
const lastOf = (g, id) => Date.parse((g.nodes[id] || {}).last || 0) || 0;
/** the graph within its caps: the least recently seen nodes go first, with every edge that touches a gone node; then the edges whose ends are oldest. Pure. */
export function trim(g) {
  const ids = Object.keys(g.nodes);
  if (ids.length > NODE_MAX) {
    const gone = new Set(ids.sort((a, b) => lastOf(g, a) - lastOf(g, b)).slice(0, ids.length - NODE_MAX));
    for (const id of gone) delete g.nodes[id];
    for (const k of Object.keys(g.edges)) { const [a, b] = k.split('>'); if (gone.has(a) || gone.has(b)) delete g.edges[k]; }
  }
  const keys = Object.keys(g.edges);
  if (keys.length > EDGE_MAX) {
    const age = (k) => { const [a, b] = k.split('>'); return Math.max(lastOf(g, a), lastOf(g, b)); };
    for (const k of keys.sort((x, y) => age(x) - age(y) || g.edges[x] - g.edges[y]).slice(0, keys.length - EDGE_MAX)) delete g.edges[k];
  }
  return g;
}

/** the graph with one answered ask noted: the skill, the ask's topic, the edge between them, the pair with the skill asked just before, the visit slot. Off, or a skipped skill, leaves it as it was. Pure. */
export function noteAsk(graph, ask) {
  const skill = skillName(ask && ask.skill);
  if (!graph || !graph.on || !skill || SKIP.has(skill)) return graph;
  const now = ms(ask.at), g = copy(graph), topic = topicOf(skill, ask.topic != null ? ask.topic : ask.text);
  const sid = 'skill:' + skill, tid = 'topic:' + topic;
  bump(g, sid, 'skill', skill, now); bump(g, tid, 'topic', topic, now); join(g, sid, tid);
  if (g.prev && g.prev.skill !== skill && Math.abs(now - g.prev.at) <= PAIR_WINDOW_MS && g.nodes['skill:' + g.prev.skill]) { const [a, b] = [sid, 'skill:' + g.prev.skill].sort(); join(g, a, b); } // void-review: ok (two node ids, sorted as text so the pair has one key)
  g.prev = { skill, at: now };
  g.asks += 1; g.first = g.first || iso(now); g.last = iso(now);
  const d = new Date(now); g.visits[d.getDay()][Math.min(3, Math.floor(d.getHours() / 6))] += 1;
  return trim(g);
}

const factId = (t) => 'fact:' + String(t).toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
/** a plain fact the person asked V01D to remember ("remember that …"): one node, kept word for word (clipped), said twice is one. Pure. */
export function noteFact(graph, text, at) {
  const f = String(text || '').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, FACT_MAX);
  if (!graph || !f) return graph;
  const g = copy(graph); bump(g, factId(f), 'fact', f, ms(at)); return trim(g);
}
/** the graph without that fact. Pure. */
export function forgetFact(graph, text) { const g = copy(graph); delete g.nodes[factId(String(text || '').trim().slice(0, FACT_MAX))]; return g; }

const daysSince = (at, now) => Math.max(0, (now - (Date.parse(at) || now)) / dayMs);
const strongestSkill = (g, tid) => { let best = '', n = 0; for (const [k, c] of Object.entries(g.edges)) { const [a, b] = k.split('>'); if (b === tid && a.startsWith('skill:') && c > n) { best = a.slice(6); n = c; } } return best; };
/** when the person usually visits, from the 7x4 histogram: { days: [names], slots: [phrases], total, words }. Pure. */
export function whenWords(visits, min = 3) {
  const v = Array.isArray(visits) && visits.length === 7 ? visits : empty().visits;
  const byDay = v.map((d) => d.reduce((a, b) => a + b, 0)), bySlot = [0, 1, 2, 3].map((s) => v.reduce((a, d) => a + (d[s] || 0), 0)), total = byDay.reduce((a, b) => a + b, 0);
  if (total < min) return { days: [], slots: [], total, words: '' };
  const top = (arr, names) => { const max = Math.max(...arr); return arr.map((n, i) => [n, i]).filter(([n]) => n >= max * 0.6 && n > 0).sort((a, b) => b[0] - a[0]).slice(0, 2).map(([, i]) => names[i]); };
  const days = top(byDay, DAYS), slots = top(bySlot, SLOTS);
  const dayWords = days.length === 1 ? 'on ' + days[0] + 's' : days.length === 2 ? 'on ' + days[0] + 's and ' + days[1] + 's' : 'any day';
  return { days, slots, total, words: 'usually ' + dayWords + (slots.length ? ', ' + slots.join(' or ') : '') };
}
/** what the graph shows about the person: top interests (recency-weighted), the usual skill pairs, when they visit, what they have not come back to, their facts. Pure. */
export function patterns(graph, at) {
  const g = graph && graph.nodes ? graph : empty(), now = ms(at);
  const topics = Object.entries(g.nodes).filter(([, n]) => n.kind === 'topic').map(([id, n]) => {
    const age = daysSince(n.last, now);
    return { id, label: n.label, n: n.n, first: n.first, last: n.last, days: Math.floor(age), skill: strongestSkill(g, id), score: n.n * Math.pow(0.5, age / HALF_LIFE_DAYS) };
  });
  const interests = topics.slice().sort((a, b) => b.score - a.score || b.n - a.n || a.label.localeCompare(b.label)).slice(0, 6);
  const pairs = Object.entries(g.edges).filter(([k, n]) => n >= 2 && /^skill:[^>]+>skill:/.test(k)).map(([k, n]) => { const [a, b] = k.split('>'); return { a: a.slice(6), b: b.slice(6), n }; }).sort((x, y) => y.n - x.n || x.a.localeCompare(y.a)).slice(0, 3);
  const lapsed = topics.filter((t) => t.n >= 3 && t.days >= STALE_DAYS).sort((a, b) => b.n - a.n || a.days - b.days).slice(0, 3);
  const facts = Object.values(g.nodes).filter((n) => n.kind === 'fact').map((n) => n.label).sort(); // void-review: ok (labels, sorted as text)
  return { on: g.on !== false, asks: g.asks || 0, first: g.first, interests, pairs, when: whenWords(g.visits), lapsed, facts };
}

/** at most three next asks, each a skill's own example (examples: { skill: [ask] }) with why, from the patterns alone; [] with no examples. Pure. */
export function suggest(graph, at, examples) {
  const ex = examples && typeof examples === 'object' ? examples : {}, p = patterns(graph, at), out = [];
  const take = (skill, why, avoid) => {
    if (out.length >= 3 || !skill) return;
    const list = Array.isArray(ex[skill]) ? ex[skill].filter((e) => typeof e === 'string' && e.trim()) : [];
    const pick = list.find((e) => !out.some((o) => o.ask === e) && (!avoid || topicOf(skill, e) !== avoid)) || list.find((e) => !out.some((o) => o.ask === e));
    if (pick) out.push({ ask: pick, skill, why });
  };
  for (const l of p.lapsed) take(l.skill, 'you have not come back to ' + l.label + ' in ' + l.days + ' days');
  for (const t of p.interests) take(t.skill, 'you often ask about ' + t.label, t.label);
  for (const pr of p.pairs) { take(pr.b, pr.a + ' and ' + pr.b + ' go together for you'); take(pr.a, pr.a + ' and ' + pr.b + ' go together for you'); }
  return out.slice(0, 3);
}

// ---- storage: over the storage handed in (default localStorage); never throws
const store = (s) => { try { return s || globalThis.localStorage || null; } catch (_) { return null; } };
export function readGraph(s) { const st = store(s); if (!st) return empty(); try { return parseGraph(st.getItem(GRAPH_KEY)); } catch (_) { return empty(); } }
export function writeGraph(graph, s) { const st = store(s); if (!st) return false; try { st.setItem(GRAPH_KEY, JSON.stringify(graph)); return true; } catch (_) { return false; } }
/** note one answered ask in storage: { graph, note } where note is true exactly once, the first time anything is kept (the page shows NOTE then). */
export function noteAskStored(s, ask) {
  const before = readGraph(s), after = noteAsk(before, ask);
  if (after === before) return { graph: before, note: false };
  const note = !after.noted; after.noted = true;
  return { graph: after, note: writeGraph(after, s) && note };
}
/** turn the noting on or off (what is kept stays until "forget my patterns"). */
export function setOn(s, on) { const g = readGraph(s); g.on = !!on; g.noted = true; writeGraph(g, s); return g; }
/** forget everything: an empty graph, still on, the note not shown again. */
export function clearGraph(s) { const g = empty(); g.on = readGraph(s).on; g.noted = true; writeGraph(g, s); return g; }
