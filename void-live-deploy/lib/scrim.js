// The scrim scorer's arithmetic (tournaments/index.html), kept pure so it can be tested in Node and run in the page.
// The page's URL is the source of truth: results=Team:place:elims,... with matches split by ';' or a new line. Everything here reads
// that text or the rows worked out from it; nothing here touches the page.

/** The key a team or spot is matched by: trimmed, inner spaces collapsed, case ignored ("  alpha " is "Alpha"). */
export const nameKey = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();
/** A name as it is shown: trimmed and inner spaces collapsed, with ':', ',' and ';' (the format's own marks) turned into spaces. */
export const cleanName = (s) => String(s == null ? '' : s).replace(/[:;,]/g, ' ').replace(/\s+/g, ' ').trim();

/** One "Team:place:elims" entry, or null when it has no name. Place is at least 1, elims at least 0. */
export function parseTeam(text) {
  const bits = String(text).split(':').map((x) => x.trim());
  const name = cleanName(bits[0]);
  if (!name) return null;
  return { name, place: Math.max(1, parseInt(bits[1], 10) || 1), elims: Math.max(0, parseInt(bits[2], 10) || 0) };
}

/** The matches in the results text: [[{ name, place, elims }]], one array per match, empty matches dropped. */
export const parseMatches = (text) => String(text == null ? '' : text).split(/[;\n]/).map((group) => group.split(',').map(parseTeam).filter(Boolean)).filter((g) => g.length);

/** The roster: every team in the order it first appears, each under the spelling it was first typed with, so "alpha" in a later
 * match joins "Alpha" instead of making a second row. Returns [{ key, name }]. */
export function roster(matches) {
  const seen = new Map();
  for (const m of matches) for (const t of m) { const k = nameKey(t.name); if (k && !seen.has(k)) seen.set(k, t.name); }
  return [...seen].map(([key, name]) => ({ key, name }));
}

/** The matches with every name snapped to its roster spelling, and a team entered twice in one match kept once (its first entry). */
export function mergeNames(matches) {
  const names = new Map(roster(matches).map((r) => [r.key, r.name]));
  return matches.map((m) => {
    const inMatch = new Set();
    return m.filter((t) => { const k = nameKey(t.name); if (inMatch.has(k)) return false; inMatch.add(k); return true; }).map((t) => ({ ...t, name: names.get(nameKey(t.name)) }));
  });
}

/** Places given to more than one team in a match: [{ match (1-based), place, teams: [name] }]. */
export function duplicatePlaces(matches) {
  const out = [];
  matches.forEach((m, i) => {
    const by = new Map();
    for (const t of m) { const list = by.get(t.place) || []; list.push(t.name); by.set(t.place, list); }
    for (const [place, teams] of [...by].sort((a, b) => a[0] - b[0])) if (teams.length > 1) out.push({ match: i + 1, place, teams });
  });
  return out;
}

/** The plain warning for duplicate places, or '' when there are none. */
export const duplicateText = (dups) => dups.map((d) => 'Match ' + d.match + ': ' + d.teams.join(' and ') + ' are both ' + ordinal(d.place) + '.').join(' ');

/** The results text for matches, the format the URL carries: Team:place:elims, comma-separated, matches joined by ';'. */
export const serialize = (matches) => matches.filter((m) => m.length).map((m) => m.map((t) => cleanName(t.name) + ':' + t.place + ':' + t.elims).join(',')).join(';');

/** 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th, 21st. */
export function ordinal(n) {
  const v = Math.abs(n) % 100, s = v >= 11 && v <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[v % 10] || 'th';
  return n + s;
}

/** Set one cell of the match grid: the match (0-based; one past the end starts a new match) and the team (its roster name) get
 * place and elims. A place of 0 or blank takes the team out of that match. Returns new matches; the old ones are not changed. */
export function setEntry(matches, matchIndex, name, place, elims) {
  const out = matches.map((m) => m.map((t) => ({ ...t })));
  while (out.length <= matchIndex) out.push([]);
  const m = out[matchIndex], k = nameKey(name), at = m.findIndex((t) => nameKey(t.name) === k);
  const p = parseInt(place, 10), e = Math.max(0, parseInt(elims, 10) || 0);
  if (!(p >= 1)) { if (at >= 0) m.splice(at, 1); return out; }
  const entry = { name: at >= 0 ? m[at].name : cleanName(name), place: p, elims: e };
  if (at >= 0) m[at] = entry; else m.push(entry);
  return out;
}

/** Rename a team everywhere (the grid's name cell). Renaming onto another team's name merges the two (mergeNames keeps the first entry per match). */
export function renameTeam(matches, from, to) {
  const k = nameKey(from), name = cleanName(to);
  if (!name) return matches;
  return mergeNames(matches.map((m) => m.map((t) => (nameKey(t.name) === k ? { ...t, name } : t))));
}

/** Placement points from the old fields (win, top5, top10, top15, top25): the highest matching threshold pays. */
export function legacyPoints(rules, place) {
  return place <= 1 ? rules.win : place <= 5 ? rules.top5 : place <= 10 ? (rules.top10 || 0) : place <= 15 ? (rules.top15 || 0) : place <= 25 ? (rules.top25 || 0) : 0;
}

/** The standings: one row per team (names merged), sorted by points, then wins, then eliminations, then average placement.
 * placePoints(place) gives placement points; elim is points per elimination. Each row carries per-match entries (null when absent). */
export function standings(matches, placePoints, elim) {
  const merged = mergeNames(matches);
  const by = new Map();
  merged.forEach((m, mi) => {
    for (const t of m) {
      const r = by.get(t.name) || { name: t.name, points: 0, wins: 0, elims: 0, places: [], matches: 0, per: new Array(merged.length).fill(null) };
      const pts = placePoints(t.place) + t.elims * elim;
      r.points += pts; r.wins += t.place === 1 ? 1 : 0; r.elims += t.elims; r.places.push(t.place); r.matches += 1;
      r.per[mi] = { pts, place: t.place, elims: t.elims };
      by.set(t.name, r);
    }
  });
  const rows = [...by.values()].map((r) => ({ ...r, avg: r.places.reduce((a, b) => a + b, 0) / r.places.length, best: Math.min(...r.places) }));
  rows.sort((a, b) => b.points - a.points || b.wins - a.wins || b.elims - a.elims || a.avg - b.avg || a.name.localeCompare(b.name));
  return { rows, matches: merged };
}

/** Snake seeding: rows dealt into n heats, the top team opens heat 1 and the turn comes back on the way down. */
export function heatList(rows, n) {
  const buckets = Array.from({ length: n }, () => []);
  rows.forEach((r, i) => { const round = Math.floor(i / n), pos = i % n; buckets[round % 2 === 0 ? pos : n - 1 - pos].push(r.name); });
  return buckets;
}

/** One cell of a per-match column: "22 (1/6)" is 22 points from 1st place and 6 eliminations; "–" when the team sat it out. */
export const matchCell = (e) => (e ? e.pts + ' (' + e.place + '/' + e.elims + ')' : '–');

/** What a single match can still be worth: the smallest win that closes a gap of `need` points, said plainly.
 * Returns "2 elims or a Top 5", "a win", "a win plus 3 elims" ... unit names what elims are called (elims, bonus points). */
export function catchUp(need, placePoints, elim, unit = 'elims') {
  const bits = [];
  if (elim > 0) { const n = Math.ceil(need / elim); bits.push(n + ' ' + (n === 1 ? unit.replace(/s$/, '') : unit)); }
  let best = 0;
  for (let p = 1; p <= 100; p++) if (placePoints(p) >= need) best = p;
  if (best) bits.push(best === 1 ? 'a win' : 'a Top ' + best);
  else if (placePoints(1) > 0 && elim > 0) { const n = Math.ceil((need - placePoints(1)) / elim); bits.push('a win plus ' + n + ' ' + (n === 1 ? unit.replace(/s$/, '') : unit)); }
  return bits.join(' or ');
}

/** The gap on each row: to 1st, or for a team outside a qualifying cutoff (top `cutoff` qualify) to the last place that qualifies.
 * [{ gap, target, hint }]: the leader's hint says by how much it leads; everyone else's says the points behind and what one match
 * needs to pass (a tie goes to the tiebreakers, so passing is the gap plus one). */
export function gaps(rows, placePoints, elim, { cutoff = 0, unit = 'elims' } = {}) {
  return rows.map((r, i) => {
    if (i === 0) { const lead = rows.length > 1 ? r.points - rows[1].points : 0; return { gap: 0, target: 'lead', hint: rows.length > 1 ? 'leads by ' + lead + ' pts' : 'leads' }; }
    const out = cutoff > 0 && i >= cutoff, t = out ? rows[cutoff - 1] : rows[0];
    const gap = t.points - r.points, need = gap + 1, how = catchUp(need, placePoints, elim, unit);
    const goal = out ? 'to make the top ' + cutoff : 'to lead';
    return { gap, target: out ? 'cutoff' : 'first', hint: '-' + gap + ' pts' + (how ? ' · needs ' + how + ' ' + goal : ' ' + goal) };
  });
}

/** The match-point rule: a team that has reached `threshold` points becomes eligible, and the first eligible team to then win a match
 * takes the tournament. Returns { champion, match (1-based) or 0, eligible: [names] } worked out over the matches in order. */
export function matchPoint(matches, placePoints, elim, threshold) {
  const total = new Map(), merged = mergeNames(matches);
  if (!(threshold > 0)) return { champion: '', match: 0, eligible: [] };
  for (let i = 0; i < merged.length; i++) {
    const eligible = new Set([...total].filter(([, p]) => p >= threshold).map(([n]) => n));
    const winner = merged[i].find((t) => t.place === 1 && eligible.has(t.name));
    if (winner) return { champion: winner.name, match: i + 1, eligible: [...eligible] };
    for (const t of merged[i]) total.set(t.name, (total.get(t.name) || 0) + placePoints(t.place) + t.elims * elim);
  }
  return { champion: '', match: 0, eligible: [...total].filter(([, p]) => p >= threshold).map(([n]) => n) };
}

// ---- placement tiers: "1st:10, 2-5:5, 6-10:3, 11-25:1" (the chip editor's text and the tiers= URL value) ----

/** Tiers from text: comma, ';' or line separated "from-to:points" (ordinals and en dashes allowed). [{ from, to, pts }], sorted by from. */
export function parseTiers(text) {
  const out = [];
  for (const bit of String(text == null ? '' : text).split(/[,;\n]+/)) {
    const m = bit.trim().match(/^(\d+)(?:st|nd|rd|th)?\s*(?:[-–—]|to)?\s*(\d+)?(?:st|nd|rd|th)?\s*[:=]\s*(-?\d+)$/i);
    if (!m) continue;
    const from = Math.min(100, Math.max(1, +m[1])), to = Math.min(100, Math.max(from, m[2] ? +m[2] : from));
    out.push({ from, to, pts: Math.max(-99, Math.min(99, +m[3])) });
  }
  return out.sort((a, b) => a.from - b.from || a.to - b.to);
}
/** Placement points for a place: the first tier whose range holds it, 0 when none does. */
export const tierPoints = (tiers, place) => { const t = tiers.find((x) => place >= x.from && place <= x.to); return t ? t.pts : 0; };
/** The URL form: "1:10,2-5:5". */
export const serializeTiers = (tiers) => tiers.map((t) => (t.from === t.to ? t.from : t.from + '-' + t.to) + ':' + t.pts).join(',');
/** A tier's label as a chip shows it: "1st", "2nd-5th". */
export const tierLabel = (t) => (t.from === t.to ? ordinal(t.from) : ordinal(t.from) + '-' + ordinal(t.to));
/** The sentence under the point system: "1st 10, 2nd-5th 5; everyone else 0." */
export const tierSentence = (tiers) => {
  const shown = tiers.filter((t) => t.pts !== 0).map((t) => tierLabel(t) + ' ' + t.pts);
  return shown.length ? 'Placement points by the highest matching threshold: ' + shown.join(', ') + '; everyone else 0.' : 'Placement points are off; only the second column scores.';
};
/** Tiers from the old URL fields (win, top5, top10, top15, top25), so links made before tiers= still score the same. */
export function legacyTiers(rules) {
  const bands = [[1, 1, rules.win], [2, 5, rules.top5], [6, 10, rules.top10], [11, 15, rules.top15], [16, 25, rules.top25]];
  return bands.filter(([, , pts]) => pts > 0).map(([from, to, pts]) => ({ from, to, pts }));
}

// ---- kinds of event: every entry is still Team:a:b in the URL, read by the kind ----

/** What a and b mean, what the columns are called, and how a round is won, for each kind of event. */
export const KINDS = {
  br: { name: 'Battle royale', a: 'Place', b: 'Elims', bLong: 'Eliminations', unit: 'elims', per: 'Per elimination', word: 'match', placeBased: true, tiers: true },
  racing: { name: 'Racing / Tabletop', a: 'Place', b: 'Bonus', bLong: 'Bonus', unit: 'bonus points', per: 'Per bonus point', word: 'race', placeBased: true, tiers: true },
  league: { name: 'Sports league', a: 'Goals', b: 'Against', bLong: 'Goals against', unit: '', per: '', word: 'round', placeBased: false, tiers: false },
  gamenight: { name: 'Game night / Trivia', a: 'Score', b: '', bLong: '', unit: '', per: '', word: 'round', placeBased: false, tiers: false },
};
export const kindOf = (k) => (KINDS[k] ? k : 'br');

/** One entry read by kind: place-based kinds keep place >= 1 and b >= 0; a league keeps both goal counts >= 0; a game night's score may be 0 or negative. */
export function parseEntry(text, kind = 'br') {
  if (KINDS[kindOf(kind)].placeBased) return parseTeam(text);
  const bits = String(text).split(':').map((x) => x.trim());
  const name = cleanName(bits[0]);
  if (!name) return null;
  const a = parseInt(bits[1], 10) || 0, b = parseInt(bits[2], 10) || 0;
  return kind === 'league' ? { name, place: Math.max(0, a), elims: Math.max(0, b) } : { name, place: Math.max(-999, Math.min(9999, a)), elims: 0 };
}
/** parseMatches for any kind. */
export const parseRounds = (text, kind = 'br') => String(text == null ? '' : text).split(/[;\n]/).map((g) => g.split(',').map((t) => parseEntry(t, kind)).filter(Boolean)).filter((g) => g.length);
/** serialize for any kind: a game night writes Team:score. */
export const serializeRounds = (matches, kind = 'br') => (kind === 'gamenight' ? matches.filter((m) => m.length).map((m) => m.map((t) => cleanName(t.name) + ':' + t.place).join(',')).join(';') : serialize(matches));

/** setEntry for any kind: a blank first cell takes the team out of the round; for place-based kinds so does a place below 1. */
export function setRoundEntry(matches, matchIndex, name, a, b, kind = 'br') {
  if (KINDS[kindOf(kind)].placeBased) return setEntry(matches, matchIndex, name, a, b);
  const out = matches.map((m) => m.map((t) => ({ ...t })));
  while (out.length <= matchIndex) out.push([]);
  const m = out[matchIndex], k = nameKey(name), at = m.findIndex((t) => nameKey(t.name) === k);
  const n = parseInt(a, 10);
  if (String(a).trim() === '' || !Number.isFinite(n)) { if (at >= 0) m.splice(at, 1); return out; }
  const e = kind === 'league' ? Math.max(0, parseInt(b, 10) || 0) : 0;
  const entry = { name: at >= 0 ? m[at].name : cleanName(name), place: kind === 'league' ? Math.max(0, n) : n, elims: e };
  if (at >= 0) m[at] = entry; else m.push(entry);
  return out;
}

/** The scoring rules for a kind: { kind, pts(entry), won(entry, match), drew(entry), sort, cols, cell, reach, tiebreak }.
 * rules: { tiers, elim } (league and game night ignore both). */
export function scorer(kind, rules = {}) {
  kind = kindOf(kind);
  const tiers = rules.tiers || [], elim = rules.elim || 0, place = (p) => tierPoints(tiers, p);
  const K = KINDS[kind];
  if (kind === 'league') return {
    kind, word: K.word, placePoints: () => 0,
    pts: (t) => (t.place > t.elims ? 3 : t.place === t.elims ? 1 : 0),
    won: (t) => t.place > t.elims, drew: (t) => t.place === t.elims,
    sort: (a, b) => b.points - a.points || b.diff - a.diff || b.gf - a.gf || b.wins - a.wins || a.name.localeCompare(b.name),
    cols: [['Pts', (r) => r.points], ['W', (r) => r.wins], ['D', (r) => r.draws], ['L', (r) => r.losses], ['GD', (r) => (r.diff > 0 ? '+' : '') + r.diff], ['GF', (r) => r.gf]],
    cell: (e) => (e ? e.pts + ' (' + e.place + '-' + e.elims + ')' : '–'),
    reach: (need) => (need <= 1 ? 'a draw' : need <= 3 ? 'a win' : 'more than one game'),
    tiebreak: 'Win 3, draw 1, loss 0. Tiebreakers, in this order: points, then goal difference, then goals scored, then wins.',
  };
  if (kind === 'gamenight') return {
    kind, word: K.word, placePoints: () => 0,
    pts: (t) => t.place,
    won: (t, m) => m.length > 1 && t.place === Math.max(...m.map((x) => x.place)), drew: () => false,
    sort: (a, b) => b.points - a.points || b.wins - a.wins || b.top - a.top || a.name.localeCompare(b.name),
    cols: [['Points', (r) => r.points], ['Round wins', (r) => r.wins], ['Rounds', (r) => r.matches], ['Best round', (r) => r.top]],
    cell: (e) => (e ? String(e.pts) : '–'),
    reach: (need) => need + ' pts',
    tiebreak: 'Each round\'s score is added straight on; the top score in a round counts as a round win. Tiebreakers, in this order: points, then round wins, then the best single round.',
  };
  const brLike = {
    kind, word: K.word, placePoints: place,
    pts: (t) => place(t.place) + t.elims * elim,
    won: (t) => t.place === 1, drew: () => false,
    cell: (e) => (e ? e.pts + ' (' + e.place + '/' + e.elims + ')' : '–'),
    reach: (need) => catchUp(need, place, elim, K.unit),
  };
  if (kind === 'racing') return { ...brLike,
    sort: (a, b) => b.points - a.points || b.wins - a.wins || a.avg - b.avg || b.elims - a.elims || a.name.localeCompare(b.name),
    cols: [['Points', (r) => r.points], ['Wins', (r) => r.wins], ['Bonus', (r) => r.elims], ['Avg place', (r) => r.avg.toFixed(1)], ['Best', (r) => r.best]],
    tiebreak: 'Tiebreakers, in this order: points, then wins, then average placement, then bonus.',
  };
  return { ...brLike,
    sort: (a, b) => b.points - a.points || b.wins - a.wins || b.elims - a.elims || a.avg - b.avg || a.name.localeCompare(b.name),
    cols: [['Points', (r) => r.points], ['Wins', (r) => r.wins], ['Elims', (r) => r.elims], ['Avg place', (r) => r.avg.toFixed(1)], ['Best', (r) => r.best]],
    tiebreak: 'Tiebreakers, in this order: points, then wins, then eliminations, then average placement.',
  };
}

/** Standings for any kind: rows sorted by the kind's tiebreakers, each with points, wins, draws, losses, elims (the b column summed),
 * gf/ga/diff (a league's goals), places, avg, best, top (best single round) and per-round entries. */
export function rank(matches, sc) {
  const merged = mergeNames(matches), by = new Map();
  merged.forEach((m, mi) => {
    for (const t of m) {
      const r = by.get(t.name) || { name: t.name, points: 0, wins: 0, draws: 0, losses: 0, elims: 0, gf: 0, ga: 0, places: [], matches: 0, top: -Infinity, per: new Array(merged.length).fill(null) };
      const pts = sc.pts(t, m), won = sc.won(t, m), drew = sc.drew(t, m);
      r.points += pts; r.wins += won ? 1 : 0; r.draws += drew ? 1 : 0; r.losses += !won && !drew ? 1 : 0;
      r.elims += t.elims; r.gf += t.place; r.ga += t.elims; r.places.push(t.place); r.matches += 1; r.top = Math.max(r.top, pts);
      r.per[mi] = { pts, place: t.place, elims: t.elims, won };
      by.set(t.name, r);
    }
  });
  const rows = [...by.values()].map((r) => ({ ...r, diff: r.gf - r.ga, avg: r.places.reduce((a, b) => a + b, 0) / r.places.length, best: Math.min(...r.places) }));
  rows.sort(sc.sort);
  return { rows, matches: merged };
}

/** matchPoint for any kind: the first team at or over the threshold to then win a round takes it. */
export function matchPointFor(matches, sc, threshold) {
  const total = new Map(), merged = mergeNames(matches);
  if (!(threshold > 0)) return { champion: '', match: 0, eligible: [] };
  for (let i = 0; i < merged.length; i++) {
    const eligible = new Set([...total].filter(([, p]) => p >= threshold).map(([n]) => n));
    const winner = merged[i].find((t) => sc.won(t, merged[i]) && eligible.has(t.name));
    if (winner) return { champion: winner.name, match: i + 1, eligible: [...eligible] };
    for (const t of merged[i]) total.set(t.name, (total.get(t.name) || 0) + sc.pts(t, merged[i]));
  }
  return { champion: '', match: 0, eligible: [...total].filter(([, p]) => p >= threshold).map(([n]) => n) };
}

/** gaps for any kind, with the kind's own "what one round needs". */
export function gapsFor(rows, sc, { cutoff = 0 } = {}) {
  return rows.map((r, i) => {
    if (i === 0) { const lead = rows.length > 1 ? r.points - rows[1].points : 0; return { gap: 0, target: 'lead', hint: rows.length > 1 ? 'leads by ' + lead + ' pts' : 'leads' }; }
    const out = cutoff > 0 && i >= cutoff, t = out ? rows[cutoff - 1] : rows[0];
    const gap = t.points - r.points, how = sc.reach(gap + 1);
    const goal = out ? 'to make the top ' + cutoff : 'to lead';
    return { gap, target: out ? 'cutoff' : 'first', hint: '-' + gap + ' pts' + (how ? ' · needs ' + how + ' ' + goal : ' ' + goal) };
  });
}

// ---- Starting spots (drops, courts, tables): a conflict checker. Claims are "Team:Spot", one per line (or comma-separated); a spot
// typed a second time snaps to the spelling it was first claimed under, by key ("old mill") or by word prefix ("old m", "harb").

/** The word-prefix match: every typed word starts the same word of the known name, same word count ("old m" is "Old Mill"). */
const prefixOf = (typed, known) => {
  const a = nameKey(typed).split(' '), b = nameKey(known).split(' ');
  return a.length === b.length && a.every((w, i) => w && b[i].startsWith(w));
};

/** The known name a typed one snaps to: the same key first, else the only known name it is a word prefix of; else the typed name. */
export function snapName(typed, known) {
  const name = cleanName(typed), k = nameKey(name);
  if (!k) return '';
  const same = known.find((x) => nameKey(x) === k);
  if (same) return same;
  const hits = known.filter((x) => prefixOf(name, x));
  return hits.length === 1 ? hits[0] : name;
}

/** The claims in the spots text: [{ team, spot }], teams snapped to the roster and spots to the first spelling claimed. A line with
 * no spot is left out; a team claimed twice keeps its last claim. */
export function parseSpots(text, teams = []) {
  const spots = [], by = new Map();
  for (const line of String(text == null ? '' : text).split(/[\n,]+/)) {
    const at = line.indexOf(':');
    if (at < 0) continue;
    const team = snapName(line.slice(0, at), teams), raw = cleanName(line.slice(at + 1));
    if (!team || !raw) continue;
    const spot = snapName(raw, spots);
    if (!spots.includes(spot)) spots.push(spot);
    by.delete(nameKey(team)); by.set(nameKey(team), { team, spot });
  }
  return [...by.values()];
}

/** The claims grouped by spot, in the order spots were first claimed: [{ spot, teams: [{ name, rank, points }], contested }]. rows are
 * the standings (rank is the 1-based place in them, 0 for a team not in them yet). */
export function spotGroups(claims, rows = []) {
  const at = new Map(rows.map((r, i) => [nameKey(r.name), { rank: i + 1, points: r.points }])), groups = new Map();
  for (const c of claims) {
    const g = groups.get(c.spot) || { spot: c.spot, teams: [] };
    const s = at.get(nameKey(c.team)) || { rank: 0, points: 0 };
    g.teams.push({ name: c.team, rank: s.rank, points: s.points });
    groups.set(c.spot, g);
  }
  return [...groups.values()].map((g) => ({ ...g, teams: g.teams.sort((a, b) => (a.rank || 1e9) - (b.rank || 1e9)), contested: g.teams.length > 1 }));
}

/** One team's badge: "#1 Alpha (22 pts)", or the bare name for a team not in the standings yet. */
export const spotBadge = (t) => (t.rank ? '#' + t.rank + ' ' + t.name + ' (' + t.points + ' pts)' : t.name);
/** A spot's teams said in one line: "#1 Alpha (22 pts) vs #3 Charlie (6 pts)". */
export const spotLine = (g) => g.teams.map(spotBadge).join(' vs ');

/** The teams in the standings with no spot claimed. */
export const unclaimed = (claims, rows) => { const k = new Set(claims.map((c) => nameKey(c.team))); return rows.filter((r) => !k.has(nameKey(r.name))).map((r) => r.name); };

/** The spots text with one claim set (or replaced, for a team that had one): "Team:Spot" lines. */
export function claimSpot(text, team, spot, teams = []) {
  const claims = parseSpots(text, teams), t = snapName(team, teams);
  if (!t) return claims.map((c) => c.team + ':' + c.spot).join('\n');
  const s = snapName(spot, [...new Set(claims.map((c) => c.spot))]);
  const out = claims.filter((c) => nameKey(c.team) !== nameKey(t));
  if (s) out.push({ team: t, spot: s });
  return out.map((c) => c.team + ':' + c.spot).join('\n');
}

// ---- Copy for Discord: the standings as a monospace Markdown block, so the columns line up in a chat message.

/** The standings as a Discord message: a bold title line, then a ```text block with the rank, team and the kind's own columns,
 * padded so they line up (numbers right-aligned). Backticks in names become ' so a name cannot close the block early; a long name
 * is kept whole and the column widens to it (no sentence cut with an ellipsis, tools/no-ellipsis.mjs). */
export function discordText(rows, sc, { title = 'Standings', rounds = 0 } = {}) {
  const word = sc.word || 'match', clip = (s) => String(s).replace(/`/g, "'");
  const head = ['#', 'Team'].concat(sc.cols.map(([h]) => h));
  const body = rows.map((r, i) => [String(i + 1), clip(r.name)].concat(sc.cols.map(([, f]) => String(f(r)))));
  const width = head.map((h, c) => Math.max(h.length, ...body.map((b) => b[c].length)));
  const line = (cells) => cells.map((x, c) => (c === 1 ? x.padEnd(width[c]) : x.padStart(width[c]))).join('  ').trimEnd();
  const after = rounds ? ' · after ' + rounds + ' ' + word + (rounds === 1 ? '' : (word === 'match' ? 'es' : 's')) : '';
  return '**' + String(title).replace(/[*`]/g, '') + '**' + after + '\n```text\n' + [line(head)].concat(body.map(line)).join('\n') + '\n```';
}
