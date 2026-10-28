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
