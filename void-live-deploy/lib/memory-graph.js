// The personal memory graph (asked by Verse, 2026-10-18: "an upgrade that lets me keep a persistent, personal knowledge graph across
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
  if (j.nodes && typeof j.nodes === 'object') for (const [id, n] of Object.entries(j.nodes)) if (isNode(n) && /^(topic|skill|fact|thing):/.test(id)) g.nodes[id] = { kind: n.kind, label: n.label, n: Math.floor(n.n), first: n.first, last: n.last, days: Number.isFinite(n.days) && n.days >= 1 ? Math.min(Math.floor(n.days), Math.floor(n.n) || 1) : 1 };
  if (j.edges && typeof j.edges === 'object') for (const [k, n] of Object.entries(j.edges)) { const [a, b] = k.split('>'); if (a && b && g.nodes[a] && g.nodes[b] && Number.isFinite(n) && n > 0) g.edges[k] = Math.floor(n); }
  if (Array.isArray(j.visits) && j.visits.length === 7) g.visits = j.visits.map((d) => (Array.isArray(d) && d.length === 4 ? d.map((x) => (Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0)) : [0, 0, 0, 0]));
  if (j.prev && typeof j.prev === 'object' && skillName(j.prev.skill) && Number.isFinite(j.prev.at)) g.prev = { skill: skillName(j.prev.skill), at: j.prev.at };
  if (g.asks === 0 && Object.keys(g.nodes).length === 0) g.first = null;
  return g;
}

const copy = (g) => ({ ...g, nodes: { ...g.nodes }, edges: { ...g.edges }, visits: g.visits.map((d) => d.slice()) });
const dayKey = (t) => { const d = new Date(t); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }; // the local day
// days = the distinct local days a node was seen on (a node from before this field counts as one)
const bump = (g, id, kind, label, now) => { const n = g.nodes[id]; g.nodes[id] = n ? { ...n, n: n.n + 1, last: iso(now), days: (n.days || 1) + (dayKey(Date.parse(n.last) || now) === dayKey(now) ? 0 : 1) } : { kind, label, n: 1, first: iso(now), last: iso(now), days: 1 }; };
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
/** a plain fact the person asked Verse to remember ("remember that …"): one node, kept word for word (clipped), said twice is one. Pure. */
export function noteFact(graph, text, at) {
  const f = String(text || '').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, FACT_MAX);
  if (!graph || !f) return graph;
  const g = copy(graph); bump(g, factId(f), 'fact', f, ms(at)); return trim(g);
}
/** the graph without that fact. Pure. */
export function forgetFact(graph, text) { const g = copy(graph); delete g.nodes[factId(String(text || '').trim().slice(0, FACT_MAX))]; return g; }

export const CONF_DAYS = 3, CONF_HALF_LIFE_DAYS = 30; // 3 distinct days is about two thirds sure; unseen for 30 days halves it
/**
 * how sure the graph is of a node, 0 to 1 (asked by Verse: "a confidence score on each node ... how many times a specific fact has been verified"):
 * evidence = 1 - exp(-d / 3), where d is the distinct days the node was seen on plus a quarter for each repeat on a day already counted (n), weighted by
 * recency, 0.5 ^ (days since last seen / 30). A fact told again (noteFact) or tapped "still true" raises it; "forget that" removes the node (0). Pure.
 */
export function confidence(node, at) {
  if (!node || typeof node !== 'object' || !Number.isFinite(node.n) || node.n < 1) return 0;
  const days = Math.min(Math.max(1, Number.isFinite(node.days) ? node.days : 1), node.n), d = days + 0.25 * (node.n - days);
  const age = Math.max(0, ((ms(at)) - (Date.parse(node.last) || ms(at))) / dayMs);
  const c = (1 - Math.exp(-d / CONF_DAYS)) * Math.pow(0.5, age / CONF_HALF_LIFE_DAYS);
  return Math.min(1, Math.max(0, c));
}
export const pct = (c) => Math.round(Math.min(1, Math.max(0, Number(c) || 0)) * 100);

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
    return { id, label: n.label, n: n.n, first: n.first, last: n.last, days: Math.floor(age), skill: strongestSkill(g, id), score: n.n * Math.pow(0.5, age / HALF_LIFE_DAYS), conf: confidence(n, now) };
  });
  const interests = topics.slice().sort((a, b) => b.score - a.score || b.n - a.n || b.conf - a.conf || a.label.localeCompare(b.label)).slice(0, 6);
  const pairs = Object.entries(g.edges).filter(([k, n]) => n >= 2 && /^skill:[^>]+>skill:/.test(k)).map(([k, n]) => { const [a, b] = k.split('>'); return { a: a.slice(6), b: b.slice(6), n, conf: (confidence(g.nodes[a], now) + confidence(g.nodes[b], now)) / 2 }; }).sort((x, y) => y.n - x.n || y.conf - x.conf || x.a.localeCompare(y.a)).slice(0, 3);
  const lapsed = topics.filter((t) => t.n >= 3 && t.days >= STALE_DAYS).sort((a, b) => b.n - a.n || a.days - b.days).slice(0, 3);
  const facts = Object.values(g.nodes).filter((n) => n.kind === 'fact').map((n) => n.label).sort(); // void-review: ok (labels, sorted as text)
  const factItems = Object.values(g.nodes).filter((n) => n.kind === 'fact').map((n) => ({ label: n.label, conf: confidence(n, now), n: n.n, days: n.days || 1 })).sort((a, b) => b.conf - a.conf || a.label.localeCompare(b.label)); // void-review: ok (labels, sorted as text)
  return { on: g.on !== false, asks: g.asks || 0, first: g.first, interests, pairs, when: whenWords(g.visits), lapsed, facts, factItems };
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

/** "remember that …" / "forget that …" as the memory skill reads them (a whole sentence, three words or more): { remember } or { forget } or null. Pure. */
export function factAsk(text) {
  const o = String(text || '').trim().replace(/[’]/g, "'");
  const m = /^(?:(?:please|(?:verse|void)),?\s+)?(remember\s*(?:that|:)|forget\s+that)\s+(.+)$/i.exec(o);
  if (!m) return null;
  const f = m[2].trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
  if (f.split(' ').length < 3 || f.length > 280) return null;
  return /^forget/i.test(m[1]) ? { forget: f } : { remember: f };
}

// ---- export and import (asked by Verse: "download their graph as a structured JSON file for backup"). The file is the person's: made and read in the
// browser, never uploaded. An imported file is read with care: version-checked, caps enforced, every label cleaned again, unknown fields dropped.
export const SCHEMA = 'void.memory.v1';
export const IMPORT_MAX = 2e6; // characters; a bigger text is refused before it is parsed
const CLEAN_WORDS = (label) => String(label || '').toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9'\s-]+/g, ' ').split(/\s+/).filter((w) => w && WORD.test(w) && !STOP.has(w)).slice(0, WORDS_MAX);
const topicLabel = (label) => { let out = ''; for (const w of CLEAN_WORDS(label)) { const next = out ? out + ' ' + w : w; if (next.length > LABEL_MAX) break; out = next; } return out; };
const plain = (x) => x && typeof x === 'object' && !Array.isArray(x);
const count = (x, max) => (Number.isFinite(x) && x >= 0 ? Math.min(Math.floor(x), max) : 0);
const isoOf = (x) => { const t = typeof x === 'string' ? Date.parse(x) : NaN; return Number.isFinite(t) && t > 0 && t < 4.1e12 ? iso(t) : ''; };

/** the graph as a file's worth of data: the graph plus { schema, exportedAt }. A copy, so the file can be changed without touching the graph. Pure. */
export function exportOf(graph, at) {
  const g = graph && plain(graph) && plain(graph.nodes) ? graph : empty();
  return { schema: SCHEMA, exportedAt: iso(ms(at)), v: 1, on: g.on !== false, noted: g.noted === true, first: g.first || null, last: g.last || null, asks: g.asks || 0,
    nodes: JSON.parse(JSON.stringify(g.nodes)), edges: { ...g.edges }, visits: (Array.isArray(g.visits) ? g.visits : empty().visits).map((d) => d.slice()), prev: g.prev ? { ...g.prev } : null };
}

/**
 * a look inside an export before it downloads (asked by Verse, "memory-preview": a snippet of what the file holds): counts by kind, its size,
 * the span of days and the few labels it holds most of, biggest first. Only labels the graph already keeps (a few words, never a sentence). Pure.
 */
export function previewOf(exp, max = 5) {
  const e = exp && plain(exp) && plain(exp.nodes) ? exp : exportOf(empty(), 0);
  const nodes = Object.values(e.nodes).filter((n) => n && KINDS.has(n.kind) && typeof n.label === 'string');
  const kinds = {}; for (const n of nodes) kinds[n.kind] = (kinds[n.kind] || 0) + 1;
  const sample = nodes.slice().sort((a, b) => (b.n || 0) - (a.n || 0) || String(a.label).localeCompare(String(b.label))).slice(0, Math.max(0, max)).map((n) => ({ kind: n.kind, label: n.label, n: n.n || 0 }));
  const bytes = JSON.stringify(e, null, 2).length;
  return { things: nodes.length, links: Object.keys(e.edges || {}).length, kinds, sample, kB: Math.max(1, Math.round(bytes / 1024)), first: e.first || null, last: e.last || null, asks: e.asks || 0 };
}

/** one imported node, cleaned: { id, node } or null. The id is made again from the cleaned label, never taken from the file. */
function cleanNode(id, n) {
  if (!plain(n) || !KINDS.has(n.kind) || typeof n.label !== 'string' || n.label.length > FACT_MAX || typeof id !== 'string' || !id.startsWith(n.kind + ':')) return null;
  let label = '', nid = '';
  if (n.kind === 'skill') { label = skillName(n.label); nid = 'skill:' + label; }
  else if (n.kind === 'fact') { label = n.label.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, FACT_MAX); nid = factId(label); }
  else { label = topicLabel(n.label); nid = n.kind + ':' + label; }
  const first = isoOf(n.first), last = isoOf(n.last);
  if (!label || !first || !last || !Number.isFinite(n.n) || n.n < 1) return null;
  const c = Math.min(Math.floor(n.n), 1e6), days = Number.isFinite(n.days) && n.days >= 1 ? Math.min(Math.floor(n.days), c) : 1;
  return { id: nid, node: { kind: n.kind, label, n: c, first: first <= last ? first : last, last: first <= last ? last : first, days } };
}

/**
 * a memory file merged onto the graph: { ok, graph, added, merged, skipped } or { ok: false, why }. Merging takes the larger count of each node and edge, the
 * earlier first and later last, so bringing in the same file twice changes nothing. The person's own on/off, note and previous-ask are kept; the caps (trim) apply. Pure.
 */
export function importInto(graph, json) {
  let j = json;
  if (typeof json === 'string') {
    if (json.length > IMPORT_MAX) return { ok: false, why: 'that file is over 2 MB' };
    try { j = JSON.parse(json); } catch (_) { return { ok: false, why: 'that is not a JSON file' }; }
  }
  if (!plain(j) || j.schema !== SCHEMA) return { ok: false, why: 'that is not a Verse memory file (schema ' + SCHEMA + ')' };
  if (j.v !== 1) return { ok: false, why: 'that file is version ' + String(j.v).slice(0, 12) + ', this page reads version 1' };
  if (!plain(j.nodes)) return { ok: false, why: 'that file has no nodes' };
  const g = copy(graph && plain(graph) && plain(graph.nodes) ? graph : empty());
  const ids = new Map(); let added = 0, merged = 0, skipped = 0;
  const entries = Object.entries(j.nodes);
  skipped += Math.max(0, entries.length - NODE_MAX * 2);
  for (const [id, n] of entries.slice(0, NODE_MAX * 2)) {
    const c = cleanNode(id, n);
    if (!c) { skipped += 1; continue; }
    ids.set(id, c.id);
    const have = Object.prototype.hasOwnProperty.call(g.nodes, c.id) ? g.nodes[c.id] : null;
    if (have) { g.nodes[c.id] = { ...have, n: Math.max(have.n, c.node.n), days: Math.max(have.days || 1, c.node.days), first: have.first < c.node.first ? have.first : c.node.first, last: have.last > c.node.last ? have.last : c.node.last }; merged += 1; }
    else { g.nodes[c.id] = c.node; added += 1; }
  }
  if (!added && !merged) return { ok: false, why: 'there was nothing usable in that file' };
  if (plain(j.edges)) for (const [k, n] of Object.entries(j.edges).slice(0, EDGE_MAX * 2)) {
    const [a, b, extra] = k.split('>'), na = ids.get(a), nb = ids.get(b);
    if (extra !== undefined || !na || !nb || !Number.isFinite(n) || n < 1) { skipped += 1; continue; }
    const key = na + '>' + nb;
    g.edges[key] = Math.max(g.edges[key] || 0, Math.min(Math.floor(n), 1e6));
  }
  if (Array.isArray(j.visits) && j.visits.length === 7) g.visits = g.visits.map((d, i) => (Array.isArray(j.visits[i]) && j.visits[i].length === 4 ? d.map((x, s) => Math.max(x, count(j.visits[i][s], 1e6))) : d));
  g.asks = Math.max(g.asks || 0, count(j.asks, 1e7));
  const first = isoOf(j.first), last = isoOf(j.last);
  if (first && (!g.first || first < g.first)) g.first = first;
  if (last && (!g.last || last > g.last)) g.last = last;
  return { ok: true, graph: trim(g), added, merged, skipped };
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

/** "remember that …" in storage: the fact is noted (told again, it is one node seen once more). Never throws; off leaves the graph alone. */
export function noteFactStored(s, text, at) { const g = readGraph(s); if (!g.on) return g; const after = noteFact(g, text, at); if (after !== g) writeGraph(after, s); return after; }
/** "forget that …" in storage: the fact leaves the graph, and with it its confidence. */
export function forgetFactStored(s, text) { const g = forgetFact(readGraph(s), text); writeGraph(g, s); return g; }
