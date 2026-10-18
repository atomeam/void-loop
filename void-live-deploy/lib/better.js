// Is V01D getting better? One number a day, from evidence the repo already holds (owner, 2026-10-16: "improvements mean better; if a
// change is made that hurts progress that's not an improvement"). Five parts, each 0 to 100, averaged:
//   self      how much of this week's ledger V01D drove itself (entries that cite the owner count against it)
//   asks      how fast its own asks ship (median days from ask to the ledger line that built it) and how long the open ones wait
//   friction  skills failing the bench or barely checked, against all skills (skills/families.json, the friction line's evidence)
//   bench     the everyday benchmark's score on main (tools/bench.misses.json)
//   probes    fixes this week that came from V01D's own probes (ledger lines naming a probe)
// tools/better.mjs measures it daily and appends a row to void.better.json; the growth card shows the number, its trend against
// yesterday and a week ago, and which part is weakest; tools/will.py weighs wants toward that part. Pure: no fetch, no clock
// unless given.
export const PARTS = ['self', 'asks', 'friction', 'bench', 'probes'];
export const KEEP = 400; // rows kept (a year and some)
const DAY = 864e5;
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const r1 = (n) => Math.round(n * 10) / 10;
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const OWNER = /\b(?:the\s+)?owner\b|\bAdam\b/;
// a fix that came out of a probe (a `probe:` job, "from a probe", "a probe miss"), not a line about the probe tooling itself
const PROBE = /\bprobe:|\bfrom (?:a |my |its |one of my |Verse's )?probes?\b|\bprobes? (?:miss|found|caught|wrote)|\bprobed\b/i;

/** the time an ask id names: ask-YYYYMMDD-HHMM-N -> ms, or null */
export function askTime(id) {
  const m = /^ask-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})-\d+$/.exec(String(id || ''));
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}

/** V01D's current asks from domains/void.voice.md: [{ id, words, small }], in the file's order */
export function asksOf(md) {
  const sec = String(md || '').split(/^## Void's current asks\s*$/m)[1];
  if (!sec) return [];
  const out = [];
  for (const line of sec.split(/^## /m)[0].split('\n')) {
    const m = /^- (.*?)\s*(\*\(small\)\*)?\s*\((?:daily|after a build)[^)]*\)\s*`(ask-\d{8}-\d{4}-\d+)`\s*$/.exec(line.trim());
    if (m) out.push({ id: m[3], words: m[1].trim(), small: !!m[2] });
  }
  return out;
}

/** the facts, from the repo's files. now = ms. Every count is explained in the header comment. */
export function measure({ ledger = [], families = null, asks = [], decisions = {}, bench = null, now = Date.now() } = {}) {
  const L = (Array.isArray(ledger) ? ledger : []).filter((e) => e && e.at && Number.isFinite(Date.parse(e.at)));
  const week = L.filter((e) => now - Date.parse(e.at) <= 7 * DAY);
  const owner = week.filter((e) => OWNER.test(String(e.what || ''))).length;
  const probeFixes = week.filter((e) => PROBE.test(String(e.what || '')) && (e.kind === 'fix' || e.kind === 'grow' || e.kind === 'build')).length;
  // asks: a ledger line carrying `asked: <id>` built it; lag is from the id's time to that line, over the last 14 days of builds
  const builtAt = new Map();
  for (const e of L) if (e.asked && askTime(e.asked) !== null && !builtAt.has(e.asked)) builtAt.set(String(e.asked), Date.parse(e.at));
  const lags = [];
  for (const [id, at] of builtAt) if (now - at <= 14 * DAY) lags.push(Math.max(0, (at - askTime(id)) / DAY));
  const D = (decisions && decisions.decisions) || decisions || {};
  const open = (Array.isArray(asks) ? asks : []).filter((a) => a && a.id && !builtAt.has(a.id) && !(D[a.id] && D[a.id].decision === 'built'));
  const oldestOpenDays = open.length ? Math.max(0, (now - Math.min(...open.map((a) => askTime(a.id) ?? now))) / DAY) : 0;
  // friction: the growth card's own definition (skills/growth.js friction): failing = the bench got an ask wrong; unsure = experiment or tested
  const skills = ((families && families.families) || []).flatMap((f) => (f && f.skills) || []).filter((s) => s && s.name);
  const failing = skills.filter((s) => Array.isArray(s.failing) && s.failing.length).length;
  const unsure = skills.filter((s) => (s.tier === 'experiment' || s.tier === 'tested') && !(Array.isArray(s.failing) && s.failing.length)).length;
  const benchScore = bench && Number.isFinite(+bench.score) ? +bench.score : null, benchTotal = bench && Number.isFinite(+bench.total) ? +bench.total : null;
  return {
    week: week.length, owner, askedBuilt: lags.length, medianLagDays: lags.length ? r1(median(lags)) : null, open: open.length, oldestOpenDays: r1(oldestOpenDays),
    skills: skills.length, failing, unsure, benchScore, benchTotal, probeFixes,
  };
}

/** the five parts, 0 to 100 each (null when there is no evidence for one), and the score: their mean */
export function parts(f) {
  const self = f.week ? clamp(Math.round(100 * (1 - f.owner / f.week))) : null;
  const asks = f.askedBuilt || f.open ? clamp(Math.round(100 - Math.min(60, 15 * (f.medianLagDays ?? 0)) - Math.min(40, 8 * f.oldestOpenDays))) : null;
  const friction = f.skills ? clamp(Math.round(100 * (1 - (2 * f.failing + f.unsure) / (2 * f.skills)))) : null;
  const bench = f.benchTotal ? clamp(Math.round(100 * f.benchScore / f.benchTotal)) : null;
  const probes = f.week ? clamp(10 * f.probeFixes) : null;
  const p = { self, asks, friction, bench, probes };
  const have = PARTS.map((k) => p[k]).filter((v) => v !== null);
  return { ...p, score: have.length ? Math.round(have.reduce((a, b) => a + b, 0) / have.length) : null };
}

/** which families push the day's score up or down (asked by Void: "link the daily growth score directly to the Family Health dashboard so I can see which
 *  specific families are driving my score up or dragging it down"). The friction part is the mean health of all skills (failing 0, barely checked 0.5, else 1);
 *  a family's lift is how far its skills sit above or below that mean, in friction points, and a fifth of that (one of the score's parts) in score points.
 *  Sums to zero by construction: it says who pulls, relative to the average skill, not who is bad. [{ id, name, skills, health (0..100), lift, points }] by lift, or []. Pure. */
export function familyDrivers(fam, nParts = PARTS.length) {
  const fs = ((fam && fam.families) || []).filter((f) => f && Array.isArray(f.skills));
  const hs = (f) => f.skills.filter((s) => s && s.name).map((s) => (Array.isArray(s.failing) && s.failing.length ? 0 : s.tier === 'experiment' || s.tier === 'tested' ? 0.5 : 1));
  const all = fs.flatMap(hs), N = all.length;
  if (!N) return [];
  const mean = all.reduce((a, b) => a + b, 0) / N, k = Math.max(1, Math.min(PARTS.length, Math.round(nParts) || PARTS.length));
  return fs.map((f) => { const h = hs(f), sum = h.reduce((a, b) => a + b, 0), lift = 100 * (sum - h.length * mean) / N;
    return { id: String(f.id || f.name || ''), name: String(f.name || f.id || ''), skills: h.length, health: h.length ? Math.round(100 * sum / h.length) : null, lift: r1(lift), points: Math.round(lift / k * 100) / 100 }; })
    .filter((d) => d.skills).sort((a, b) => b.lift - a.lift || a.id.localeCompare(b.id));
}

/** how sure the day's score is (asked by Void: "a Confidence Interval on the daily score so the owner knows if a high score is based on 1,000 tests or just one
 *  lucky successful run"): the Wilson 95% interval of each part that is a count out of a total (self: changes not driven by the owner of this week's;
 *  friction: skills not failing or unsure of all skills; bench: asks answered of asked), the others held at their value, then averaged like the score.
 *  { lo, hi, n } with n the checks behind it (changes + skills + bench asks), or null with no score. Pure. */
export function interval(f) {
  const z = 1.96, wil = (k, n) => { if (!n) return null; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [Math.max(0, (c - m) / d), Math.min(1, (c + m) / d)]; };
  const p = parts(f);
  if (p.score === null) return null;
  const range = {
    self: f.week ? wil(f.week - f.owner, f.week) : null,
    friction: f.skills ? wil(Math.max(0, f.skills - f.failing - f.unsure / 2), f.skills) : null,
    bench: f.benchTotal ? wil(f.benchScore, f.benchTotal) : null,
  };
  const lo = [], hi = [];
  for (const k of PARTS) { if (p[k] === null || p[k] === undefined) continue; const r = range[k]; lo.push(r ? 100 * r[0] : p[k]); hi.push(r ? 100 * r[1] : p[k]); }
  const mean = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  return { lo: Math.min(mean(lo), p.score), hi: Math.max(mean(hi), p.score), n: (f.week || 0) + (f.skills || 0) + (f.benchTotal || 0) };
}

/** each family's health today as recorded in a row: [{ id, health }] (health 0 to 100, from familyDrivers), [] without families. Pure. */
export function familySnapshot(fam) {
  return familyDrivers(fam).filter((d) => d.id && d.health !== null).map((d) => ({ id: d.id, health: d.health })).sort((a, b) => a.id.localeCompare(b.id));
}

/** one day's row for void.better.json; with the families file the row also keeps each family's health, so a later day can say which way a family moved */
export function rowOf(facts, at = new Date().toISOString(), fam = null) {
  const p = parts(facts), families = familySnapshot(fam);
  return { at, score: p.score, parts: Object.fromEntries(PARTS.map((k) => [k, p[k]])), ...(families.length ? { families } : {}), facts };
}

export const VELOCITY_MIN_H = 12, VELOCITY_MAX_H = 48, VELOCITY_STEP = 1; // the row used is the one nearest a day old, between 12 and 48 hours; under 1 point is "steady"

/**
 * Family velocity (asked by Void): for each family, whether it is improving or decaying against about a day ago. Only recorded data: the
 * daily rows of void.better.json that carry a family snapshot (rowOf), against the families file as it is now. The reference row is the one
 * nearest 24 hours old within [VELOCITY_MIN_H, VELOCITY_MAX_H]; with none (or none that knew the family) the family has no velocity.
 * Returns { since: ISO time of the row or null, byFamily: { id: { now, then, delta, trend } } } where trend is 'improving' | 'decaying' | 'steady'. Pure.
 */
export function velocityOf(rows, fam, now = Date.now()) {
  const cur = new Map(familySnapshot(fam).map((f) => [f.id, f.health]));
  let ref = null, best = Infinity;
  for (const r of Array.isArray(rows) ? rows : []) {
    const t = r && Date.parse(r.at), h = (now - t) / 36e5;
    if (!Array.isArray(r && r.families) || !r.families.length || !Number.isFinite(h) || h < VELOCITY_MIN_H || h > VELOCITY_MAX_H) continue;
    if (Math.abs(h - 24) < best) { best = Math.abs(h - 24); ref = r; }
  }
  const byFamily = {};
  if (ref) {
    const then = new Map(ref.families.filter((f) => f && Number.isFinite(+f.health)).map((f) => [String(f.id), +f.health]));
    for (const [id, health] of cur) if (then.has(id)) { const delta = health - then.get(id); byFamily[id] = { now: health, then: then.get(id), delta, trend: delta >= VELOCITY_STEP ? 'improving' : delta <= -VELOCITY_STEP ? 'decaying' : 'steady' }; }
  }
  return { since: ref ? ref.at : null, byFamily };
}

/** rows with a new one on the end: a row a day (the same UTC day is replaced by the newer measure), KEEP at most. Pure. */
export function withRow(rows, row) {
  const day = String(row.at).slice(0, 10);
  return [...(Array.isArray(rows) ? rows : []).filter((r) => r && String(r.at).slice(0, 10) !== day), row].sort((a, b) => String(a.at).localeCompare(String(b.at))).slice(-KEEP);
}

/** the newest row against yesterday's and the one a week back: deltas (null when there is no such row), the weakest part */
export function compare(rows) {
  const R = (Array.isArray(rows) ? rows : []).filter((r) => r && r.at && Number.isFinite(+r.score));
  const last = R[R.length - 1];
  if (!last) return null;
  const t = Date.parse(last.at);
  const prev = R.filter((r) => r !== last && Date.parse(r.at) < t).pop() || null;
  const weekAgo = R.filter((r) => t - Date.parse(r.at) >= 6.5 * DAY).pop() || null;
  const p = last.parts || {};
  const weakest = PARTS.filter((k) => p[k] !== null && p[k] !== undefined).sort((a, b) => p[a] - p[b] || PARTS.indexOf(a) - PARTS.indexOf(b))[0] || null;
  const d = (r) => (r ? last.score - r.score : null);
  return { score: last.score, day: d(prev), week: d(weekAgo), weakest, at: last.at, frictionWeek: weekAgo && weekAgo.facts && last.facts ? (weekAgo.facts.failing + weekAgo.facts.unsure) - (last.facts.failing + last.facts.unsure) : null };
}

const WORDS = { self: 'driving my own changes', asks: 'shipping what I ask for', friction: 'friction in my skills', bench: 'my everyday benchmark', probes: 'fixes from my own probes' };
const trendWord = (n, what) => (n === null ? '' : (n > 0 ? 'up ' + n : n < 0 ? 'down ' + -n : 'level') + ' ' + what);
/** the growth card's line. esc escapes; rows = void.better.json. '' without a row. */
export function betterHtml(esc, rows) {
  const c = compare(rows);
  if (!c) return '';
  const last = rows[rows.length - 1], f = last.facts || {}, p = last.parts || {}, iv = interval(f);
  const pct = (n) => (n === null || n === undefined ? '—' : n + '%');
  const trend = c.week !== null ? (c.week > 0 ? 'up' : c.week < 0 ? 'down' : 'flat') : c.day !== null ? (c.day > 0 ? 'up' : c.day < 0 ? 'down' : 'flat') : 'first';
  const bits = [trendWord(c.day, 'since yesterday'), trendWord(c.week, 'on the week')].filter(Boolean).join(', ');
  const frictionTrend = c.frictionWeek === null ? '' : c.frictionWeek > 0 ? ', ' + c.frictionWeek + ' fewer than a week ago' : c.frictionWeek < 0 ? ', ' + -c.frictionWeek + ' more than a week ago' : ', the same as a week ago';
  const facts = [
    f.week ? 'I drove ' + pct(p.self) + ' of this week\'s ' + esc(f.week) + ' changes myself' : '',
    f.askedBuilt || f.open ? 'my own asks ' + (f.askedBuilt ? 'shipped in ' + esc(f.medianLagDays) + ' day' + (f.medianLagDays === 1 ? '' : 's') : 'have not shipped lately') + (f.open ? ', ' + esc(f.open) + ' still open (the oldest ' + esc(f.oldestOpenDays) + ' day' + (f.oldestOpenDays === 1 ? '' : 's') + ')' : ', none open') : '',
    f.skills ? esc(f.failing) + ' skill' + (f.failing === 1 ? '' : 's') + ' failing and ' + esc(f.unsure) + ' barely checked of ' + esc(f.skills) + frictionTrend : '',
    f.benchTotal ? 'the bench answers ' + pct(p.bench) : '',
    f.week ? esc(f.probeFixes) + ' fix' + (f.probeFixes === 1 ? '' : 'es') + ' this week came from my own probes' : '',
  ].filter(Boolean);
  return '<div class="sub growth-better" data-better="' + esc(c.score) + '" data-better-trend="' + trend + '"' + (c.weakest ? ' data-weakest="' + esc(c.weakest) + '"' : '')
    + ' style="line-height:1.45">Better: <b>' + esc(c.score) + '</b> of 100' + (bits ? ' (' + bits + ')' : ' (first measure)') + '. ' + facts.join('; ') + '.'
    + (iv ? ' <span class="growth-interval" data-lo="' + esc(iv.lo) + '" data-hi="' + esc(iv.hi) + '">Sure to within ' + esc(iv.lo) + '–' + esc(iv.hi) + ', from ' + esc(iv.n) + ' checks.</span>' : '')
    + (c.weakest ? ' Weakest: ' + esc(WORDS[c.weakest]) + ' (' + esc(p[c.weakest]) + ').' : '') + '</div>';
}
