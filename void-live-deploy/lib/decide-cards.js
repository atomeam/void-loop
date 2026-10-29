// Pure logic for the decision cards of tools pack 3 (owner, 2026-10-18, list items 51, 52, 56 to 60): ranked list, weighted
// pros and cons, vote marks, eliminate-until-one, pairwise compare, 2x2 score matrix, must / should / could buckets.
// Nothing here touches the page; skills/decide-cards.js draws the cards. Run: node --test tools/tools-pack3.test.mjs

export const MAX_ITEMS = 12, MAX_LEN = 30;

const tidy = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');

/** the items in "pizza, tacos and sushi" / "tea or coffee" / "a vs b": trimmed, no repeats, at most 12 of 30 characters. Pure. */
export function splitItems(s) {
  const t = tidy(s).replace(/^(?:between|from|of|for|among|:)\s+/i, '');
  if (!t) return [];
  const parts = /[,;]/.test(t) ? t.split(/\s*[,;]\s*(?:(?:or|and)\s+)?/i)
    : /\s+(?:or|vs\.?|versus)\s+/i.test(t) ? t.split(/\s+(?:or|vs\.?|versus)\s+/i)
    : /\s+and\s+/i.test(t) ? t.split(/\s+and\s+/i) : [t];
  if (parts.length > 1) parts.splice(parts.length - 1, 1, ...parts[parts.length - 1].split(/\s+(?:and|or)\s+/i)); // "a, b and c": the last pair
  const seen = new Set(), out = [];
  for (const raw of parts) {
    const name = raw.trim().slice(0, MAX_LEN);
    if (name && !seen.has(name.toLowerCase())) { seen.add(name.toLowerCase()); out.push(name); }
  }
  return out.slice(0, MAX_ITEMS);
}

const PRE = '^(?:please\\s+)?(?:(?:make|build|create|show|start|open|give|set\\s+up|run)\\s+(?:me\\s+)?(?:a\\s+|an\\s+|my\\s+|the\\s+)?)?';
const re = (body) => new RegExp(PRE + body + '$', 'i');
const REST = '\\s*(?:(?:of|for|about|on|between|from|with)\\s+|[:\\-]\\s*)?(.*?)';
// "my ..." or a short list: a personal topic, not a request for facts ("ranked list of the best movies" stays an ordinary question)
const mine = (r) => /^my\s+\S/i.test(r);

/** what a card ask names: { kind, title, items, axes } or null when it is not one of the seven card asks. Pure. */
export function parseCardAsk(text) {
  const t = tidy(text);
  let m;
  const listOrTitle = (rest, kind, extra) => {
    const items = splitItems(rest);
    const isList = items.length >= 2;
    if (rest && !isList && !mine(rest)) return null; // "ranked list of the best movies" is a question about movies
    return { kind, title: isList ? '' : rest.slice(0, 60), items: isList ? items : [], ...(extra || {}) };
  };
  // ranked list: "ranked list", "ranked list of my movies", "rank pizza, tacos, sushi"
  if ((m = re('(?:ranked\\s+list|ranking\\s+list|rank\\s+list)' + REST).exec(t))) return listOrTitle(m[1].trim(), 'rank');
  if ((m = re('rank\\s+(.+)').exec(t)) && /[,;]|\s(?:or|and)\s/i.test(m[1])) { const items = splitItems(m[1]); if (items.length >= 2) return { kind: 'rank', title: '', items }; }
  // weighted pros and cons: needs "weighted", or the words list / card / table / chart ("pros and cons of solar" is a question)
  if ((m = re('(?:weighted\\s+pros\\s*(?:and|&|\\/|\\+)\\s*cons(?:\\s+(?:list|card|table|chart))?|pros\\s*(?:and|&|\\/|\\+)\\s*cons\\s+(?:list|card|table|chart))' + REST).exec(t))) return { kind: 'proscons', title: m[1].trim().slice(0, 60), items: [] };
  // vote marks: "vote marks for pizza, tacos", "tally votes", "vote on pizza or tacos"
  if ((m = re('(?:vote\\s+marks?|tally\\s+(?:marks|votes)|vote\\s+tally|tally\\s+card)' + REST).exec(t))) return listOrTitle(m[1].trim(), 'votes');
  if ((m = re('(?:vote|tally)\\s+(?:on|between)\\s+(.+)').exec(t)) && /[,;]|\s(?:or|vs\.?)\s/i.test(m[1])) { const items = splitItems(m[1]); if (items.length >= 2) return { kind: 'votes', title: '', items }; }
  // eliminate until one: needs the whole phrase, or "elimination round / list / game"
  if ((m = re('(?:eliminate[\\s-]+until[\\s-]+(?:only\\s+)?(?:one|1)(?:\\s+(?:is\\s+)?left)?|elimination\\s+(?:round|list|game|vote)|knock-?out\\s+(?:list|round|vote))' + REST).exec(t))) return listOrTitle(m[1].trim(), 'knockout');
  // pairwise compare
  if ((m = re('(?:pair-?wise\\s+(?:compar(?:e|ison|ing)|ranking|rank|choice|vote)|compare\\s+pair-?wise|compare\\s+in\\s+pairs|head[\\s-]to[\\s-]head\\s+(?:compar(?:e|ison)|vote|ranking))' + REST).exec(t))) {
    const r = listOrTitle(m[1].trim(), 'pairwise');
    if (r) r.items = r.items.slice(0, 8);
    return r;
  }
  // 2x2 score matrix: "2x2 matrix for impact vs effort", "2x2 score matrix", "eisenhower matrix"
  if ((m = re('(?:(?:a\\s+)?2\\s*[x×]\\s*2|two[\\s-]by[\\s-]two)\\s+(?:score\\s+)?(?:matrix|grid)' + REST).exec(t)) || (m = re('(?:score\\s+matrix\\s+2\\s*[x×]\\s*2)' + REST).exec(t))) {
    const r = m[1].trim(), ax = /^(?:of\s+)?(.+?)\s+(?:vs\.?|versus|and|against|by)\s+(.+)$/i.exec(r);
    return { kind: 'buckets', mode: 'quad', title: ax ? '' : r.slice(0, 60), items: [], axes: ax ? [ax[1].trim().slice(0, 20), ax[2].trim().slice(0, 20)] : ['Impact', 'Effort'] };
  }
  if ((m = re('eisenhower\\s+(?:matrix|grid|box)' + REST).exec(t))) return { kind: 'buckets', mode: 'quad', title: m[1].trim().slice(0, 60), items: [], axes: ['Important', 'Urgent'] };
  // must / should / could
  if ((m = re('(?:moscow|must[\\s,/]+should[\\s,/]+could)(?:\\s+(?:list|buckets?|sort|board|card|prioriti[sz]ation))?' + REST).exec(t))) {
    const r = m[1].trim(), items = splitItems(r);
    return { kind: 'buckets', mode: 'moscow', title: items.length >= 2 ? '' : r.slice(0, 60), items: items.length >= 2 ? items : [], axes: null };
  }
  return null;
}

/** a copy of the list with item i moved one place up (dir -1) or down (+1); out of range leaves it as it was. Pure. */
export function moveItem(list, i, dir) {
  const a = (list || []).slice(), j = i + dir;
  if (i < 0 || i >= a.length || j < 0 || j >= a.length) return a;
  [a[i], a[j]] = [a[j], a[i]];
  return a;
}

/** a tally as groups of five and the rest: 7 is one struck group and two marks. Pure. */
export function tallyView(n) {
  const c = Math.max(0, Math.min(999, Math.floor(Number(n) || 0)));
  return { fives: Math.floor(c / 5), rest: c % 5, count: c };
}

/** which options lead: indexes of the highest count (empty when nobody has a vote yet). Pure. */
export function leaders(counts) {
  const top = Math.max(0, ...(counts || []).map((c) => Number(c) || 0));
  return top > 0 ? counts.map((c, i) => [Number(c) || 0, i]).filter(([c]) => c === top).map(([, i]) => i) : [];
}

const clampW = (w) => { const n = Number(w); return Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : 1; };

/** weighted pros and cons: each row { text, w } weighs 1 to 5; { pro, con, net, verdict }. Pure. */
export function sideTotals(pros, cons) {
  const sum = (rows) => (rows || []).reduce((s, r) => s + (String((r && r.text) || '').trim() ? clampW(r && r.w) : 0), 0);
  const pro = sum(pros), con = sum(cons), net = pro - con;
  return { pro, con, net, verdict: pro === 0 && con === 0 ? 'empty' : net > 0 ? 'pros' : net < 0 ? 'cons' : 'even' };
}

/** the indexes still in after the out ones; a bad index is ignored. Pure. */
export function survivors(n, out) {
  const gone = new Set((out || []).filter((i) => Number.isInteger(i)));
  return Array.from({ length: Math.max(0, n) }, (_, i) => i).filter((i) => !gone.has(i));
}

/** tap an item: out when two or more remain, back in when it is out; the last one standing can't go. Pure: returns the new out list. */
export function toggleOut(n, out, i) {
  if (!Number.isInteger(i) || i < 0 || i >= n) return (out || []).slice();
  const cur = (out || []).slice();
  if (cur.includes(i)) return cur.filter((x) => x !== i);
  if (survivors(n, cur).length <= 1) return cur;
  return cur.concat(i);
}

/** every pair of n items once, in a fixed order: [0,1] [0,2] ... Pure. */
export function pairsOf(n) {
  const out = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
  return out;
}

/** wins: { 'i|j': winnerIndex }. The first pair with no answer yet, or null when all are in. Pure. */
export function nextPair(n, wins) {
  return pairsOf(n).find(([i, j]) => !((i + '|' + j) in (wins || {}))) || null;
}

/** standing of each item by pairwise wins, best first: [{ i, wins, tied }]. Pure. */
export function standings(n, wins) {
  const w = Array.from({ length: n }, () => 0);
  for (const [i, j] of pairsOf(n)) { const k = (wins || {})[i + '|' + j]; if (k === i || k === j) w[k]++; }
  const rows = w.map((c, i) => ({ i, wins: c }));
  rows.sort((a, b) => b.wins - a.wins || a.i - b.i);
  return rows.map((r) => ({ ...r, tied: rows.some((o) => o.i !== r.i && o.wins === r.wins) }));
}

/** the bucket names of a board: quadrants named from the two axes, or must / should / could. Pure. */
export function bucketNames(mode, axes) {
  if (mode === 'moscow') return ['Must', 'Should', 'Could'];
  const [a, b] = (axes || ['Impact', 'Effort']);
  if (/^impact$/i.test(a) && /^effort$/i.test(b)) return ['Quick wins (high impact, low effort)', 'Big bets (high impact, high effort)', 'Fill-ins (low impact, low effort)', 'Skip (low impact, high effort)'];
  if (/^important$/i.test(a) && /^urgent$/i.test(b)) return ['Do first (important, urgent)', 'Schedule (important, not urgent)', 'Delegate (not important, urgent)', 'Drop (not important, not urgent)'];
  return ['High ' + a + ', low ' + b, 'High ' + a + ', high ' + b, 'Low ' + a + ', low ' + b, 'Low ' + a + ', high ' + b];
}

/** place item i in bucket b (null puts it back in the tray); returns the new place map. Pure. */
export function placeItem(place, i, b, nBuckets) {
  const p = { ...(place || {}) };
  if (b === null || b === undefined) delete p[i];
  else if (Number.isInteger(b) && b >= 0 && b < nBuckets) p[i] = b;
  return p;
}

/** remove item i from a list and shift the maps that point at later items down. Pure: returns { items, place, out, counts, wins }. */
export function removeAt(th, i) {
  const items = (th.items || []).filter((_, k) => k !== i);
  const shift = (k) => (k > i ? k - 1 : k);
  const place = {}; for (const [k, b] of Object.entries(th.place || {})) { const kk = Number(k); if (kk !== i) place[shift(kk)] = b; }
  const out = (th.out || []).filter((k) => k !== i).map(shift);
  const counts = (th.counts || []).filter((_, k) => k !== i);
  return { items, place, out, counts, wins: {} }; // a deleted item voids the pairwise answers
}
