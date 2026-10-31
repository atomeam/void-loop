// What Verse lacks most, and the first thing it does about it by itself (owner, 2026-10-19: "try to make it so Verse can open its own PRs and
// push them through and review all after thinking it up based on what it lacks most"). The fix lanes already there (propose-fix.yml,
// build-miss.yml) only start from asks a visitor missed, and with no misses they run daily and do nothing. This is the front end that
// thinks work up from Verse's own files, with no model and no network. It only ever proposes benchmark asks: additive, checked in the real page, never code:
//
//   rank      every skill scored for how little is proven about it: no benchmark ask at all, a weak evidence tier, a recent failed check
//             that names it. The score and its reasons are printed, so "why this one" is never a guess.
//   plan      the top N skills' own example asks, as benchmark candidates (the skill already claims them, so a candidate that does not route
//             to it is itself a finding: a routing bug, or an ask that needs the network).
//   settle    after tools/bench.mjs --probe has run them in the real page, the ones that routed become bench rows; the rest are listed
//             in a report with the reason, never added. Only asks the page really answered with the right skill reach the benchmark.
//
//   node tools/lacks.mjs [--n 6] [--json]                  print the ranking and the plan
//   node tools/lacks.mjs plan --out cand.json [--n 6]      write the candidates (tools/bench.json's shape)
//   node tools/lacks.mjs settle cand.json probe.log --out passing.json --failed failed.json --report report.md
//   node tools/lacks.mjs queue failed.json [--dry]         the asks that did not route become `probe:` jobs for propose-fix.yml (owner token; at most PROBE_OPEN_MAX open)
// Nothing here writes into the repo but the files named by --out/--report; adding rows is tools/append.mjs, opening the PR is the workflow.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { heavy as heavyLessons, chance, load as loadLessons } from './grow-lessons.mjs';
import { resolve, dirname } from 'node:path';
import { plan as probePlan, PROBE_OPEN_MAX } from './probe-asks.mjs';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const TIER_WEIGHT = { experiment: 40, checked: 25, tested: 10, proven: 0 };
export const COL = 42, UNBENCHED = 100, THIN = 30, PER_SKILL = 3, MAX_SKILLS = 12, MAX_ASK = 120;

/** how many benchmark rows name each skill: want "skill:name", "name", or "a|skill:name|b". Pure. */
export function benchedCount(rows) {
  const n = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    for (const part of String((r && r.want) || '').split('|')) {
      const m = /^(?:skill:)?([a-z0-9][a-z0-9-]*)(?:[:/].*)?$/.exec(part.trim());
      if (m) n.set(m[1], (n.get(m[1]) || 0) + 1);
    }
  }
  return n;
}

/** a skill's tier by name, from families.json. Pure. */
export function tiersOf(families) {
  const t = new Map();
  for (const f of (families && Array.isArray(families.families) ? families.families : [])) for (const s of f.skills || []) if (s && s.name) t.set(s.name, String(s.tier || ''));
  return t;
}

/** how many recent incidents name the skill in a failed check (the check's words, lower case, contain the skill name as a word). Pure. */
export function incidentHits(incidents, names) {
  const rows = incidents && Array.isArray(incidents.incidents) ? incidents.incidents : [];
  const hit = new Map();
  for (const name of names) {
    const re = new RegExp('(?:^|[^a-z0-9-])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:$|[^a-z0-9-])', 'i');
    let c = 0;
    for (const i of rows) if ((i.checks || []).some((x) => re.test(String(x)))) c++;
    if (c) hit.set(name, c);
  }
  return hit;
}

/** Every skill scored, most lacking first. { name, score, reasons[], examples[] }; a skill with no example asks of its own cannot be hardened here and is left out
 *  (examples the guide quoted from a header, examplesFrom: 'header', are labels or the owner's words, never asks that skill routes). Pure. */
export function rank({ guide, families, bench, incidents } = {}) {
  const pages = guide && Array.isArray(guide.pages) ? guide.pages : [];
  const skills = pages.filter((p) => p && p.kind === 'skill' && typeof p.name === 'string' && Array.isArray(p.examples) && p.examples.length && p.examplesFrom !== 'header');
  const tiers = tiersOf(families), benched = benchedCount(Array.isArray(bench) ? bench : (bench && (bench.asks || bench.items)) || []);
  const hits = incidentHits(incidents, skills.map((s) => s.name));
  return skills.map((s) => {
    const reasons = []; let score = 0;
    const b = benched.get(s.name) || 0;
    if (!b) { score += UNBENCHED; reasons.push('no benchmark ask'); }
    else if (b < PER_SKILL) { score += THIN; reasons.push('only ' + b + ' benchmark ask' + (b === 1 ? '' : 's')); }
    const tw = TIER_WEIGHT[tiers.get(s.name)] || 0;
    if (tw) { score += tw; reasons.push('evidence tier: ' + tiers.get(s.name)); }
    if (hits.get(s.name)) { score += 5 * hits.get(s.name); reasons.push(hits.get(s.name) + ' failed run' + (hits.get(s.name) === 1 ? '' : 's') + ' name it'); }
    return { name: s.name, score, reasons, examples: s.examples.map(String), benched: b };
  }).filter((r) => r.reasons.some((x) => /benchmark ask/.test(x))).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}


export const THIN_LINE = 45, MIN_EXAMPLES = 3;
/** Cards worth refining, worst first: a description too short to say what the skill does, fewer than three example asks, or an old brand name left in the card. Pure.
 * The words themselves are a builder's (or a model's, through the usual lanes); this is what keeps the list of what to refine current and ordered. */
export function cardGaps(guide, { limit = 10 } = {}) {
  const pages = guide && Array.isArray(guide.pages) ? guide.pages : [];
  const out = [];
  for (const p of pages) {
    if (!p || p.kind !== 'skill' || typeof p.name !== 'string') continue;
    const reasons = []; let score = 0;
    const line = String(p.line || '').trim(), ex = Array.isArray(p.examples) ? p.examples.length : 0;
    if (line.length < THIN_LINE) { score += 20 + (THIN_LINE - line.length); reasons.push('description is ' + line.length + ' characters'); }
    if (ex < MIN_EXAMPLES) { score += 15 * (MIN_EXAMPLES - ex); reasons.push(ex === 0 ? 'no example asks' : 'only ' + ex + ' example ask' + (ex === 1 ? '' : 's')); }
    if (/\bV01[Dd]\b/.test(line + ' ' + (p.examples || []).join(' ') + ' ' + (p.title || ''))) { score += 60; reasons.push('an old brand name on the card'); }
    if (reasons.length) out.push({ name: p.name, score, reasons });
  }
  return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, Math.max(1, limit | 0 || 10));
}

/** an example worth trying as a benchmark ask: plain words a person types, one line, no link, address or secret-looking string. Pure. */
export function usable(ask) {
  const a = String(ask == null ? '' : ask).trim();
  return a.length >= 2 && a.length <= MAX_ASK && !/[\n\r]/.test(a) && !/https?:|www\.|@\S+\.\S+|[A-Za-z0-9_-]{32,}/.test(a) && /[a-z]/i.test(a);
}

/** market reach (docs/STRATEGY.md, monetization first): 1 + the weight of each tag group (money, parity) whose pattern the skill's
 * name matches, from tools/revenue-tags.json. Pure. */
export function reach(name, tags = {}) {
  let w = 1;
  for (const g of Object.values(tags || {})) if (g && Array.isArray(g.patterns) && g.patterns.some((p) => new RegExp('(^|-)' + p + '($|-)').test(name))) w += +g.weight || 0;
  return Math.max(1, w); // boosts only: a tag never demotes or drops a want
}

/** the plan: the top n skills and, for each, up to PER_SKILL of its own examples not already in the benchmark, as candidate rows. Pure. */
export function plan(data, { n = 6, first = [] } = {}) {
  const have = new Set((Array.isArray(data.bench) ? data.bench : (data.bench && (data.bench.asks || data.bench.items)) || []).map((r) => String(r && r.ask || '').trim().toLowerCase()));
  // the card cycle's next cards come first (tools/card-cycle.mjs: every card gets a turn), then the least proven ones
  const ranked = rank(data), on = new Set(first);
  // skills whose examples keep routing elsewhere are deprioritized so the plan tries fresher candidates (owner 2026-10-21)
  const heavy = new Set(heavyLessons());
  // expected value (docs/LOOP-GAPS.md): how much proof a skill lacks times the chance a try at it lands, from the result memory
  // in tools/grow-lessons.json. A skill never tried scores its lack x 0.5, so fresh skills and proven-weak ones both get turns.
  const mem = data.lessons || loadLessons(), tags = data.revenue || readJson('tools/revenue-tags.json', {}), boost = data.studyBoost || {}, ev = (r) => r.score * chance(r.name, mem) * reach(r.name, tags) * (boost[r.name] || 1); // a finished study with strong evidence (tools/study-engine.mjs studyBoosts) moves its want up, never off
  const byEv = (a, b) => ev(b) - ev(a);
  const ordered = ranked.filter((r) => on.has(r.name)).concat(ranked.filter((r) => !on.has(r.name) && !heavy.has(r.name)).sort(byEv)).concat(ranked.filter((r) => heavy.has(r.name)).sort(byEv));
  // a skill whose examples are all in the benchmark already has nothing to add: it is passed over for the next one down, so the picks are
  // the weakest skills that can still be hardened (2026-10-20: the top six were all done, the plan came back empty and grow-self stopped)
  const want = Math.max(1, Math.min(MAX_SKILLS, n | 0 || 6)), picks = [], candidates = [], seen = new Set();
  for (const p of ordered) {
    if (picks.length >= want) break;
    let k = 0;
    for (const ex of p.examples) {
      const a = ex.trim(), key = a.toLowerCase();
      if (k >= PER_SKILL) break;
      if (!usable(a) || have.has(key) || seen.has(key)) continue;
      seen.add(key); k++; candidates.push({ ask: a, want: 'skill:' + p.name });
    }
    if (k) picks.push(p);
  }
  return { picks: picks.map((p) => ({ name: p.name, score: p.score, reasons: p.reasons })), candidates };
}

/** the asks tools/bench.mjs --probe printed as misses: " ---- <ask padded to 42> <who answered>". Pure. */
export function missedIn(log, candidates) {
  const lines = String(log || '').split('\n').filter((l) => l.startsWith(' ---- ')).map((l) => l.slice(6));
  const missed = new Map();
  for (const c of candidates) {
    // the probe prints the ask padded to COL characters, one space, then who answered: a short ask is the whole padded field, a long one is followed by a space
    const line = lines.find((l) => (c.ask.length < COL ? l.slice(0, COL).trimEnd() === c.ask && l.charAt(COL) === ' ' : l.startsWith(c.ask + ' ')));
    if (line) missed.set(c.ask, line.slice(Math.max(c.ask.length, COL)).trim());
  }
  return missed;
}

/** after the probe: the rows that routed to their skill, and a report that names every one that did not and what answered instead. Pure. */
/** true when the skill that answered is the one we wanted, or a near-name of it (skycard ≈ sky-card). Pure. */
export function nearMatch(want, got) {
  const w = String(want || '').replace(/^skill:/, '').toLowerCase().replace(/[-_]/g, '');
  const g = String(got || '').toLowerCase().replace(/^skill:/, '').replace(/[-_]/g, '').split(/\s/)[0];
  return w && g && (w === g || w.includes(g) || g.includes(w));
}
export function settle(candidates, log) {
  const missed = missedIn(log, candidates);
  const passing = candidates.filter((c) => !missed.has(c.ask) || nearMatch(c.want, missed.get(c.ask)));
  const failed = candidates.filter((c) => missed.has(c.ask) && !nearMatch(c.want, missed.get(c.ask))).map((c) => ({ ask: c.ask, want: c.want, got: missed.get(c.ask) }));
  return { passing, failed };
}

/** a row that routed must also answer (PR #1987, 2026-10-30: a "fixed" distance skill took its ask and the card said it could not find it):
 * check(skill, ask) runs the skill on the ask with a bare page (tools/propose-fix.mjs answers). A card that says it found nothing leaves the
 * benchmark list and is named in the report; a row the bare page cannot run stays, since its bench row claims routing only. */
export async function answered(passing, check) {
  const keep = [], silent = [];
  for (const c of passing || []) {
    let a; try { a = await check(String(c.want || '').replace(/^skill:/, '').split('|')[0], c.ask); } catch (e) { a = { outcome: 'not run' }; }
    if (a && a.outcome === 'no answer') silent.push({ ask: c.ask, want: c.want, why: String(a.why || '').slice(0, 120) }); else keep.push(c);
  }
  return { passing: keep, silent };
}

/** the words under a pull request or in a run summary. Pure. */
export function report({ picks, passing, failed, silent = [] }) {
  const L = ['Verse looked at its own files for what is least proven and tried the asks each skill already claims.', '', '| skill | score | why |', '|---|---|---|'];
  for (const p of picks) L.push('| ' + p.name + ' | ' + p.score + ' | ' + p.reasons.join('; ') + ' |');
  L.push('', passing.length + ' ask' + (passing.length === 1 ? '' : 's') + ' routed to the skill that claims them in the real page, answered there, and are added to tools/bench.json:');
  for (const c of passing) L.push('- `' + c.ask + '` → ' + c.want);
  if (silent.length) {
    L.push('', silent.length + ' routed but the card did not answer, and are not added (the skill needs the answer, not the route):');
    for (const f of silent) L.push('- `' + f.ask + '` → ' + f.want + (f.why ? '; the card said: ' + f.why : ''));
  }
  if (failed.length) {
    L.push('', failed.length + ' did not, and are not added (each is a routing gap or an ask that needs the network; a builder looks):');
    for (const f of failed) L.push('- `' + f.ask + '` wanted ' + f.want + (f.got ? '; the page said: ' + f.got.slice(0, 120) : ''));
  }
  return L.join('\n') + '\n';
}

const readJson = (p, d) => { try { return JSON.parse(readFileSync(resolve(root, p), 'utf8')); } catch (_) { return d; } };
export const load = () => ({
  guide: readJson('void-live-deploy/skills/guide.json', {}), families: readJson('void-live-deploy/skills/families.json', {}),
  bench: readJson('tools/bench.json', []), incidents: readJson('void-live-deploy/incidents.json', {}),
});

async function main(argv) {
  const opt = (f, d = '') => { const i = argv.indexOf(f); return i >= 0 ? String(argv[i + 1] || d) : d; };
  const n = parseInt(opt('--n', '6'), 10) || 6;
  const cmd = ['plan', 'settle', 'queue'].includes(argv[0]) ? argv[0] : 'show';
  if (cmd === 'settle') {
    const [candFile, logFile] = argv.slice(1).filter((a) => !a.startsWith('--') && a !== opt('--out') && a !== opt('--report') && a !== opt('--failed'));
    if (!candFile || !logFile || !existsSync(candFile) || !existsSync(logFile)) { console.error('usage: lacks.mjs settle cand.json probe.log --out passing.json --report report.md'); return 2; }
    const cands = JSON.parse(readFileSync(candFile, 'utf8')), data = JSON.parse(readFileSync(candFile + '.plan', 'utf8'));
    const s0 = settle(cands, readFileSync(logFile, 'utf8'));
    const { answers } = await import('./propose-fix.mjs');
    const check = (name, ask) => { const f = resolve(root, 'void-live-deploy', 'skills', name + '.js'); return existsSync(f) ? answers(f, ask, { timeoutMs: 8000 }) : { outcome: 'not run' }; };
    const s = { ...s0, ...(await answered(s0.passing, check)) };
    if (opt('--out')) writeFileSync(opt('--out'), JSON.stringify(s.passing, null, 1));
    if (opt('--failed')) writeFileSync(opt('--failed'), JSON.stringify(s.failed.map((f) => ({ ask: f.ask, want: f.want })), null, 1));
    const rep = report({ picks: data.picks, ...s });
    if (opt('--report')) writeFileSync(opt('--report'), rep); else console.log(rep);
    console.log('passing ' + s.passing.length + ' failed ' + s.failed.length + ' no answer ' + s.silent.length);
    return 0;
  }
  if (cmd === 'queue') {
    const file = argv[1];
    if (!file || file.startsWith('--') || !existsSync(file)) { console.error('usage: lacks.mjs queue failed.json [--dry]'); return 2; }
    const misses = JSON.parse(readFileSync(file, 'utf8')).filter((m) => m && usable(m.ask) && /^skill:[a-z0-9-]+$/.test(String(m.want || '')));
    const dry = argv.includes('--dry'), site = process.env.VOID_SITE || 'https://a-to-mind.com';
    const api = async (path, method = 'GET', body) => {
      const tok = process.env.VOID_OWNER_TOKEN || process.env.VOID_MISSES_TOKEN; if (!tok) throw new Error('VOID_OWNER_TOKEN is not set in this environment');
      const res = await fetch(site + path, { method, headers: { authorization: 'Bearer ' + tok, 'user-agent': 'a2m-lacks/1.0', ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
      if (!res.ok) throw new Error(method + ' ' + path + ': HTTP ' + res.status + ' ' + (await res.text()).slice(0, 120)); return res.json();
    };
    let q; try { q = dry && argv.includes('--empty-queue') ? { items: [] } : await api('/api/queue'); } catch (e) { console.error('lacks: queue not read: ' + e.message); return 3; }
    const p = probePlan(misses, q, 'own examples', { openMax: PROBE_OPEN_MAX });
    for (const job of p.queue) {
      if (dry) { console.log('would queue ' + job.target + ': ' + job.ask); continue; }
      try {
        const r = await api('/api/queue', 'POST', { ask: job.ask, target: job.target }), it = r.item || {};
        if (it.id && it.ask === job.ask) { await api('/api/queue', 'PATCH', { id: it.id, note: ('Verse tried an example ask its own skill claims and the page did not route it there (wanted ' + (misses.find((m) => job.target === 'probe:' + job.target.slice(6) && job.ask.includes(m.ask)) || {}).want + '); found by tools/lacks.mjs, not a visitor\'s words').slice(0, 300) }); console.log('queued ' + job.target); }
        else console.log('already open: ' + job.target);
      } catch (e) { console.error('lacks: could not queue ' + job.target + ': ' + e.message); }
    }
    console.log(p.queue.length + ' queued, ' + p.later.length + ' waiting for room (' + p.open + ' probe jobs were open)');
    return 0;
  }
  let first = [];
  if (argv.includes('--cycle')) { const C = await import('./card-cycle.mjs'), c = C.load(); first = C.next(c.cards, c.audits, c.cursor, Math.ceil(n / 2)).picks.filter((x) => x.build && x.build.kind === 'bench').map((x) => x.name); }
  const p = plan(load(), { n, first });
  if (cmd === 'plan') {
    if (!opt('--out')) { console.error('usage: lacks.mjs plan --out cand.json [--n 6]'); return 2; }
    writeFileSync(opt('--out'), JSON.stringify(p.candidates, null, 1)); writeFileSync(opt('--out') + '.plan', JSON.stringify({ picks: p.picks }));
    console.log(p.picks.length + ' skills, ' + p.candidates.length + ' candidate asks -> ' + opt('--out')); return p.candidates.length ? 0 : 3;
  }
  if (argv.includes('--json')) { console.log(JSON.stringify(p, null, 1)); return 0; }
  const all = rank(load());
  console.log(all.length + ' skills lack proof; the ' + p.picks.length + ' most:');
  for (const x of p.picks) console.log('  ' + String(x.score).padStart(4) + '  ' + x.name.padEnd(24) + x.reasons.join('; '));
  console.log(p.candidates.length + ' candidate asks from their own examples');
  const cards = cardGaps(load().guide, { limit: n });
  console.log('cards to refine (words a builder or Verse\'s model improves; the list is regenerated every run):');
  for (const c of cards) console.log('  ' + String(c.score).padStart(4) + '  ' + c.name.padEnd(24) + c.reasons.join('; '));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c)).catch((e) => { console.error('lacks: ' + e.message); process.exit(1); });
