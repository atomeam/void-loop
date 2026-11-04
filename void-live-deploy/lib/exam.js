// The outcome exam (owner, 2026-11-03: "i want Verse to actually be learning and improving at everything, not mimic it").
// A domain's score is the share of objective checks a visitor's ask passed on the live page: a song's audio element advances
// and its title matches the iTunes row, a sum on screen is the sum, a forecast is near the forecast. Nothing here is a count
// of skills, pull requests or lesson sentences. Pure: the browser run lives in tools/exam.mjs and hands this what it saw.

export const DOMAINS = Object.freeze(['videos', 'podcasts', 'songs', 'weather', 'directions', 'recipes', 'calculator', 'news', 'sports', 'emoji', 'translate', 'units', 'maps', 'timers', 'images', 'prices', 'definitions', 'wordproblems', 'code']);
// when two domains tie, work on the one the owner named first. The later names are the harder scale (2026-11-04).
const TIE = Object.freeze(['songs', 'podcasts', 'videos', 'weather', 'directions', 'recipes', 'calculator', 'news', 'sports', 'code', 'images', 'wordproblems', 'translate', 'units', 'maps', 'timers', 'prices', 'definitions', 'emoji']);
export const ALLOW = Object.freeze({
  videos: ['video', 'video-play'],
  podcasts: ['podcast'],
  songs: ['hear'],
  weather: ['weather'],
  directions: ['place'],
  recipes: ['recipe'],
  calculator: ['calc', 'vat'],
  news: ['news'],
  sports: ['scores', 'sports-browse', 'sport'],
  emoji: ['emoji'],
  translate: ['translate'],
  units: ['calc', 'convert'],
  maps: ['place'],
  timers: ['timer'],
  images: ['image', 'draw', 'cartoon'],
  prices: ['crypto', 'markets', 'calc'],
  definitions: ['define'],
  wordproblems: ['calc', 'sums'],
  code: ['dev-tools', 'snippet'],
});
export const FAST_MS = 12000;
export const SLOW_MS = 20000;
// scale 2 is the harder exam (rival answer, ambiguous and follow-up asks, more domains). A run on a new scale is a new baseline, not a regression.
export const SCALE = 2;
// a run dropped when a domain's public score falls by at least this many points (about one ask of sixteen). Two such runs in a row revert the deploy.
export const DROP = 5;
const REFUSAL = /don.?t know this yet|couldn.?t find|isn.?t connected|something went wrong|didn.?t answer just now|no skill caught/i;

/** the skill the page's own log named ('skill:hear', or the page calculator's 'calc'). Pure. */
export function skillName(note) {
  const s = String(note || '').trim();
  const m = /^skill:([a-z0-9-]+)$/.exec(s);
  if (m) return m[1];
  if (s === 'calc' || s === 'vat') return s;
  return '';
}

/** ISO week 'YYYY-Www' in UTC, the rotation key for the holdout. Pure. */
export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - start) / 86400000 + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

/** `n` asks from a pool, starting at a week-dependent offset, wrapping. The same week always picks the same slice. Pure. */
export function holdoutSlice(pool, week, n = 4) {
  const list = Array.isArray(pool) ? pool.filter((a) => a && a.ask) : [];
  if (list.length <= n) return list.slice();
  const num = Number(String(week).replace(/\D/g, '')) || 0;
  const start = num % list.length, out = [];
  for (let i = 0; i < n; i++) out.push(list[(start + i) % list.length]);
  return out;
}

/** a short label for a holdout ask. Not a secret by itself; the ask text is what stays off the page. Pure. */
export function askId(s) {
  let h = 2166136261;
  const t = String(s || '').trim().toLowerCase();
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** the same file, whether one address is absolute and the other is a path. Pure. */
function sameMedia(src, list) {
  if (!src) return false;
  let path = String(src);
  try { path = new URL(src).pathname; } catch (_) { /* already a path */ }
  return list.some((u) => {
    const s = String(u || '');
    let p = s;
    try { p = new URL(s, 'https://a-to-mind.com').pathname; } catch (_) {}
    return s === src || (p && p === path);
  });
}
const has = (text, words) => {
  const h = ' ' + String(text || '').toLowerCase() + ' ';
  const ws = String(words || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  return ws.length > 0 && ws.every((w) => h.includes(w));
};
const audioOk = (a) => !!(a && /^https:\/\//.test(a.src || '') && (a.status === 200 || a.status === 206) && /^audio\//i.test(a.type || '') && a.currentTime > 0.2);

/** does the card carry the rival's answer (the best free source), not merely some answer. Pure. */
export function rivalHit(text, rival) {
  if (!rival || typeof rival !== 'object') return null;
  const raw = String(text || ''), low = raw.toLowerCase();
  if (typeof rival.ok === 'boolean') return rival.ok;
  if (rival.phrase) return rival.phrase.test(raw);
  if (rival.emoji) return raw.includes(rival.emoji);
  if (Array.isArray(rival.any) && rival.any.length) return rival.any.some((s) => s && low.includes(String(s).toLowerCase()));
  if (Number.isFinite(rival.near)) {
    const tol = Number.isFinite(rival.tol) ? rival.tol : Math.max(0.05, Math.abs(rival.near) * (Number.isFinite(rival.pct) ? rival.pct : 0.02));
    return (raw.match(/-?\d+(?:[.,]\d+)?/g) || []).map((n) => Number(String(n).replace(/,/g, ''))).some((n) => Number.isFinite(n) && Math.abs(n - rival.near) <= tol);
  }
  if (Array.isArray(rival.words) && rival.words.length) {
    const need = Math.min(rival.need || 2, rival.words.length);
    return rival.words.filter((w) => w && low.includes(String(w).toLowerCase())).length >= need;
  }
  if (rival.text) return low.includes(String(rival.text).toLowerCase());
  return null;
}
const AMBIGUOUS = /which|several|more than one|do you mean|which one|a few different|did you mean|or the other/i;

/** one ask's checks. A check is true, false, or null when the outside service the check needs did not answer (null is left out of the score). Pure. */
export function judge(domain, obs, truth = {}) {
  const o = obs || {}, t = truth || {}, text = String(o.text || '');
  const checks = {};
  checks.answered = text.trim().length > 40 && !REFUSAL.test(text);
  checks.skill = (ALLOW[domain] || []).includes(skillName(o.note));
  checks.fast = !!(checks.answered && Number.isFinite(o.ms) && o.ms <= FAST_MS);
  checks.mobile = o.overflow === false;
  if (domain === 'songs' || domain === 'podcasts') {
    checks.audio = audioOk(o.audio);
    if (domain === 'songs') {
      checks.title = t.track ? has(text, t.track) : null;
      checks.artist = t.artist ? has(text, t.artist) : null;
    } else {
      checks.show = t.show ? has(text, t.show) : null;
      checks.episode = Array.isArray(t.enclosures) && t.enclosures.length ? sameMedia(o.audio && o.audio.src, t.enclosures) : (t.episode ? has(text, t.episode) : null);
    }
  } else if (domain === 'videos') {
    const frame = o.frame && /^https:\/\//.test(o.frame.src || '') && (o.frame.status === 200 || o.frame.status === 204) && (o.frame.box || 0) > 80;
    const vid = o.video && (o.video.status === 200 || o.video.status === 206) && (o.video.currentTime > 0.2 || /^video\//i.test(o.video.type || ''));
    checks.loaded = !!(frame || vid);
    checks.playable = !!(vid && o.video.currentTime > 0.2) || !!frame;
    checks.topic = t.topic ? has(text, t.topic) : null;
  } else if (domain === 'weather') {
    checks.place = t.place ? has(text, t.place) : null;
    const nums = (text.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    checks.temp = nums.some((n) => n >= -80 && n <= 130);
    checks.close = Number.isFinite(t.tempC) ? nums.some((n) => Math.abs(n - t.tempC) <= 8 || Math.abs(n - (t.tempC * 9 / 5 + 32)) <= 12) : null;
  } else if (domain === 'directions') {
    checks.place = t.dest ? has(text, t.dest) : null;
    checks.route = /openstreetmap\.org|google\.com\/maps|\/maps\b|\d+(?:\.\d+)?\s*(?:km|mi|miles|min|minutes)\b/i.test(text);
  } else if (domain === 'recipes') {
    checks.dish = t.dish ? has(text, t.dish) : null;
    checks.method = /ingredient|cup|tbsp|tablespoon|teaspoon|tsp|gram|minute|step|oven|simmer|chop|slice/i.test(text);
  } else if (domain === 'calculator') {
    const want = Array.isArray(t.numbers) ? t.numbers.map((n) => String(n)) : [];
    checks.number = want.length ? want.every((n) => text.includes(n)) : null;
  } else if (domain === 'news') {
    const links = Array.isArray(o.links) ? o.links : [];
    checks.headline = links.some((u) => /^https:\/\//.test(u) && !/a-to-mind\.com/i.test(u)) && text.length > 80;
    checks.topic = t.topic ? has(text, t.topic) : null;
  } else if (domain === 'sports') {
    checks.team = (t.team || t.league) ? (has(text, t.team || '') || has(text, t.league || '')) : null;
    checks.board = /\d+\s*[–\-]\s*\d+|standings|\bwon\b|\bpoints\b|\btable\b|\bfinal\b|\blive\b|\bvs\b/i.test(text);
  } else if (domain === 'images') {
    checks.picture = t.wantPicture ? !!o.drawn : null;
  }
  if (t.gap) {
    checks.answered = text.trim().length > 20;
    checks.rival = /don.?t know|couldn.?t find|no (?:definition|entry|page)|isn.?t (?:a |in the )|not (?:a word|in the dictionary)|nothing (?:for|called)/i.test(text);
  } else if (t.ambiguous) checks.rival = AMBIGUOUS.test(text);
  else if (t.rival) { const hit = rivalHit(text, t.rival); checks.rival = hit === null ? null : hit; }
  if (t.slow) checks.patient = !!(checks.answered && Number.isFinite(o.ms) && o.ms <= SLOW_MS);
  const names = Object.keys(checks);
  const measured = names.filter((k) => checks[k] !== null);
  const passed = measured.filter((k) => checks[k] === true);
  return {
    score: measured.length ? Math.round((passed.length / measured.length) * 1000) / 10 : null,
    checks, failed: names.filter((k) => checks[k] === false),
    measured: measured.length, passed: passed.length,
  };
}

/** a domain's score: the mean of its measured asks, one decimal, or null when none were measured. Pure. */
export function domainScore(rows) {
  const xs = (rows || []).map((r) => r && r.score).filter((n) => Number.isFinite(n));
  if (!xs.length) return null;
  return Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10;
}

/** the domain to work on: the lowest public score, owner's order on a tie. Pure. */
export function lowestDomain(scores) {
  let best = null, name = TIE[0];
  for (const d of TIE) {
    const s = scores && scores[d];
    if (!Number.isFinite(s)) continue;
    if (best === null || s < best) { best = s; name = d; }
  }
  return { domain: name, score: best === null ? 0 : best };
}

/**
 * A later run against the same kind of page. A domain whose public score fell by DROP points or more is a regression.
 * A domain either run did not measure is left out (an outage is not a drop). Pure.
 */
export function compareRuns(prev, next, drop = DROP) {
  const drops = [], rises = [];
  // a harder scale is a new baseline: the old 100s are not a bar the new asks have to clear
  if (next && Number(next.scale) && Number(next.scale) !== Number(prev && prev.scale || 1)) return { ok: true, drops, rises, rebaseline: true };
  const pd = (prev && prev.domains) || {}, nd = (next && next.domains) || {};
  for (const d of DOMAINS) {
    const a = pd[d] && pd[d].score, b = nd[d] && nd[d].score;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (b <= a - drop) drops.push({ domain: d, before: a, after: b });
    else if (b > a + 0.05) rises.push({ domain: d, before: a, after: b });
  }
  return { ok: drops.length === 0, drops, rises };
}

/**
 * True while the latest runs are still the new baseline after the exam scale itself changed.
 * The run that changes scale, and the runs after it until three in a row share one scale, are not a rollback. Pure.
 */
export function scaleSettling(runs) {
  const list = Array.isArray(runs) ? runs : [];
  if (list.length < 2) return false;
  const s = list.slice(-3).map((r) => Number(r && r.scale) || 1);
  return s.some((n) => n !== s[0]);
}

/**
 * Whether the deploy should be reverted. `runs` is oldest first and includes the run just recorded.
 * A revert needs two runs in a row that each fell by `drop` points or more, all on the same scale.
 * One drop is recorded and left. The first runs after a scale change are a new baseline. Pure.
 */
export function revertAfter(runs, drop = DROP) {
  const list = Array.isArray(runs) ? runs : [];
  if (list.length < 3 || scaleSettling(list)) return { revert: false, first: null, second: null };
  const first = compareRuns(list[list.length - 3], list[list.length - 2], drop);
  const second = compareRuns(list[list.length - 2], list[list.length - 1], drop);
  return { revert: !first.ok && !second.ok, first, second };
}

/** the will's candidates: up to three failing public asks from the lowest domain. No holdout text. Pure. */
export function examWants(latest) {
  if (!latest || !latest.lowest) return [];
  const d = latest.lowest.domain, score = Number(latest.lowest.score) || 0;
  const fails = ((latest.domains && latest.domains[d] && latest.domains[d].fails) || []).filter((a) => a && a.ask).slice(0, 3);
  const weight = 120 + Math.round((100 - score) / 5);
  return fails.map((a) => ({
    kind: 'fix the exam',
    title: ('fix the ' + d + ' exam: "' + String(a.ask).slice(0, 80) + '"').slice(0, 160),
    why: ('the ' + d + ' exam scored ' + score + ', the lowest; this ask failed ' + (a.failed || []).join(', ')).slice(0, 240),
    weight, source: 'exam:' + d,
  }));
}
