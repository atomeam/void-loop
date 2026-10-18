// Frontier #9, first piece: Clef-flash beside the embedding router on the bench's own asks. Each ask in tools/bench.json whose
// `want` is one of the router's skills (lib/router.js SKILLS: "calc", "timer", "skill:weather", …) or the answer engine
// ("answer", which the router should leave alone: none) is sent to the site (POST /api/bench { route: true }, owner only,
// ROUTE_CHUNK asks a call); both picks are scored against `want` and printed: accuracy, agreement, Clef's accuracy above and
// below a confidence, and per skill where Clef is better. Nothing switches here: the verdict names the skills where Clef wins.
//   READ_TOKEN=… node tools/route-bench.mjs [--site https://a-to-mind.com] [--sample 240] [--out route-bench.json] [--md table.md]
// Exit 3 when the site cannot be asked (no key, rejected, an older deployment without { route }).
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { SKILLS, SIMPLE, HARD, CLOSE } from '../void-live-deploy/lib/router.js';
import { NONE } from '../void-live-deploy/lib/clef.js';

export const CONFIDENT = 0.7; // the confidence a low-confidence answer would ask under ("not sure: did you mean…")
export const WIN = 2; // a skill switches to Clef only when Clef gets at least this many more of its asks right

// the asks both routers can be scored on, each with the set of picks that count as right
export function benchSet(bench, skills = SKILLS) {
  const keys = new Set(Object.keys(skills)), out = [], seen = new Set();
  for (const x of Array.isArray(bench) ? bench : (bench && bench.asks) || []) {
    if (!x || typeof x.ask !== 'string' || x.before || seen.has(x.ask.toLowerCase())) continue; // an ask with setup asks depends on the page
    const want = new Set();
    let ok = true;
    for (const p of String(x.want || '').split('|')) {
      const k = p.startsWith('skill:') ? p.slice(6).split(':')[0] : p.split(':')[0];
      if (k === 'answer') want.add(NONE); else if (keys.has(k)) want.add(k); else ok = false;
    }
    if (ok && want.size && x.ask.length <= 300) { out.push({ ask: x.ask, want: [...want] }); seen.add(x.ask.toLowerCase()); }
  }
  return out;
}

// n asks spread across the skills: one from each skill in turn (the bench is mostly calc), in bench order, so each run of the
// same bench sees the same asks
// the asks that should reach the answer engine, not a skill: each skill's near-misses ("who invented the clock") and the
// router's simple and hard questions. The bench has few of these (3 on 2026-10-13), and a router that sends a question to a
// skill is the costly mistake, so every run adds them. The embedding router has them as its own examples: it scores high here
// by construction, so this row shows Clef's false skills more than it compares the two.
export function noneSet(skills = SKILLS, simple = SIMPLE, hard = HARD) {
  const asks = [...Object.values(skills).flatMap((s) => s.near || []), ...simple, ...hard];
  return [...new Set(asks)].map((ask) => ({ ask, want: [NONE], examples: true }));
}

export function sample(set, n) {
  if (!n || n >= set.length) return set.slice();
  const groups = new Map();
  for (const r of set) { const k = r.want[0]; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); }
  const lists = [...groups.values()], out = [];
  for (let i = 0; out.length < n; i++) for (const g of lists) if (i < g.length && out.length < n) out.push(g[i]);
  return out;
}

const pickOf = (r) => (!r || r.error ? undefined : r.skill || NONE);

export function score(rows, results) {
  const s = { n: rows.length, embed: { right: 0, errors: 0 }, clef: { right: 0, errors: 0 }, agree: 0, sure: { n: 0, right: 0 }, unsure: { n: 0, right: 0 }, skills: {}, ms: { embed: [], clef: [] } };
  rows.forEach((row, i) => {
    const r = results[i] || {}, e = pickOf(r.embed), c = pickOf(r.clef), key = row.want[0];
    const k = s.skills[key] || (s.skills[key] = { n: 0, embed: 0, clef: 0 });
    k.n += 1;
    if (e === undefined) s.embed.errors += 1; else if (row.want.includes(e)) { s.embed.right += 1; k.embed += 1; }
    if (c === undefined) s.clef.errors += 1; else {
      const ok = row.want.includes(c);
      if (ok) { s.clef.right += 1; k.clef += 1; }
      const band = r.clef.p != null && r.clef.p >= CONFIDENT ? s.sure : s.unsure; band.n += 1; if (ok) band.right += 1;
    }
    if (e !== undefined && e === c) s.agree += 1;
    if (r.embed && Number.isFinite(r.embed.ms)) s.ms.embed.push(r.embed.ms);
    if (r.clef && Number.isFinite(r.clef.ms)) s.ms.clef.push(r.clef.ms);
  });
  const p50 = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
  s.ms = { embed: p50(s.ms.embed), clef: p50(s.ms.clef) };
  return s;
}

// Verse's ask (its reflection on d53c33d): a routing confidence on every "none", so a none says whether the router nearly picked a
// skill or the ask was nowhere near one, and a missed skill says whether the wording was close (the bar, or a phrasing the
// examples nearly cover) or far (the router has no example like it). The embedding router's nearest skill and its score come
// back with each none (lib/router.js decide `nearest`); NEAR is how far under the bar still counts as close.
export const NEAR = CLOSE; // lib/router.js: the same "close" the will's near-miss proposals use
export function noneConfidence(rows, results, near = NEAR) {
  const out = { n: 0, close: 0, far: 0, missed: { close: 0, far: 0 }, right: { close: 0, far: 0 }, unknown: 0, rows: [] };
  rows.forEach((row, i) => {
    const e = (results[i] || {}).embed;
    if (!e || e.error || e.skill) return; // only the router's own nones
    out.n += 1;
    const x = e.nearest;
    if (!x || !Number.isFinite(x.score)) { out.unknown += 1; return; } // an older deployment that does not send it
    const close = x.score >= (x.bar ?? 0.7) - near, side = row.want.includes(NONE) ? 'right' : 'missed';
    out[close ? 'close' : 'far'] += 1; out[side][close ? 'close' : 'far'] += 1;
    out.rows.push({ ask: row.ask, want: row.want, nearest: x.skill, score: x.score, gap: Math.round(((x.bar ?? 0.7) - x.score) * 1000) / 1000, held: x.held || null, close, missed: side === 'missed' });
  });
  out.rows.sort((a, b) => b.score - a.score);
  return out;
}

export function noneTable(c, show = 8) {
  if (!c.n) return '';
  const lines = ['### How close each "none" came to a skill', '',
    `The embedding router said none ${c.n} times. ` + (c.n - c.unknown ? `${c.close} came within ${NEAR} of the bar to a skill (close), ${c.far} were further off (noise to the router).` : 'This deployment does not send the nearest skill yet.'), ''];
  if (c.n - c.unknown) {
    lines.push('| the none was | close to a skill | far from any |', '|:--|--:|--:|',
      `| wrong: the bench wanted a skill | ${c.missed.close} (the wording or the bar) | ${c.missed.far} (no example like it) |`,
      `| right: the bench wanted none | ${c.right.close} (a near miss to watch) | ${c.right.far} |`, '');
    const missed = c.rows.filter((r) => r.missed).slice(0, show);
    if (missed.length) lines.push('Missed skills, closest first:', '', '| ask | wanted | nearest | score | under the bar | held by |', '|:--|:--|:--|--:|--:|:--|',
      ...missed.map((r) => `| ${r.ask.replace(/\|/g, '\\|').slice(0, 70)} | ${r.want.join(' or ')} | ${r.nearest} | ${r.score} | ${r.gap} | ${r.held || '—'} |`), '');
  }
  return lines.join('\n') + '\n';
}

// where Clef should take over: a skill with WIN or more asks more right than the embedding guess, and never fewer
export function verdict(s) {
  const wins = Object.entries(s.skills).filter(([, k]) => k.clef - k.embed >= WIN).map(([name]) => name).sort();
  const loses = Object.entries(s.skills).filter(([, k]) => k.embed > k.clef).map(([name]) => name).sort();
  const why = `Clef-flash ${s.clef.right}/${s.n} right, the embedding router ${s.embed.right}/${s.n}; they agree on ${s.agree}.`;
  return { switchTo: wins, keep: loses, why: wins.length ? why + ' Clef wins on ' + wins.join(', ') + '.' : why + ' Clef wins on no skill by ' + WIN + ' or more: nothing switches.' };
}

export function table(s, v) {
  const pct = (a, b) => (b ? Math.round((100 * a) / b) + '%' : '—');
  const lines = ['### Clef-flash beside the embedding router', '', `${s.n} bench asks (tools/bench.json: the router's skills, and "answer" = none).`, '',
    '| router | right | errors | median ms |', '|:--|--:|--:|--:|',
    `| embedding (bge-m3) | ${s.embed.right}/${s.n} (${pct(s.embed.right, s.n)}) | ${s.embed.errors} | ${s.ms.embed ?? '—'} |`,
    `| Clef-flash | ${s.clef.right}/${s.n} (${pct(s.clef.right, s.n)}) | ${s.clef.errors} | ${s.ms.clef ?? '—'} |`, '',
    (s.skills[NONE] ? `The ${s.skills[NONE].n} "none" asks include the router's own near-misses and simple/hard questions (the embedding router's examples, so it scores high there by construction): Clef sent ${s.skills[NONE].n - s.skills[NONE].clef} of them to a skill.\n\n` : '') +
    `Agreement: ${s.agree}/${s.n}. Clef at confidence ${CONFIDENT}+ : ${s.sure.right}/${s.sure.n} right (${pct(s.sure.right, s.sure.n)}); below: ${s.unsure.right}/${s.unsure.n} (${pct(s.unsure.right, s.unsure.n)}).`, '',
    '| skill | asks | embedding | Clef |', '|:--|--:|--:|--:|',
    ...Object.entries(s.skills).sort((a, b) => b[1].n - a[1].n).map(([k, x]) => `| ${k} | ${x.n} | ${x.embed} | ${x.clef} |`), '',
    '**Verdict:** ' + v.why];
  return lines.join('\n') + '\n';
}

export async function runSite(site, key, rows, { chunk = 16, get = fetch } = {}) {
  if (!key) throw Object.assign(new Error('READ_TOKEN is empty (the repository secret VOID_OWNER_TOKEN is the Pages READ_TOKEN)'), { code: 3 });
  const results = [];
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const r = await get(site.replace(/\/+$/, '') + '/api/bench', { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify({ route: true, asks: part.map((x) => x.ask) }) });
    if (r.status === 401 || r.status === 403) throw Object.assign(new Error('the site rejected READ_TOKEN (owner only)'), { code: 3 });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.route || !Array.isArray(j.results)) throw Object.assign(new Error('this deployment\'s /api/bench does not route yet (HTTP ' + r.status + ')'), { code: 3 });
    for (const x of j.results) results[i + x.i] = x;
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const here = path.dirname(fileURLToPath(import.meta.url));
  const rows = sample(benchSet(JSON.parse(fs.readFileSync(path.join(here, 'bench.json'), 'utf8'))), Number(opt('--sample', '240'))).concat(noneSet());
  try {
    const results = await runSite(opt('--site', 'https://a-to-mind.com'), process.env.READ_TOKEN || process.env.VOID_OWNER_TOKEN || '', rows);
    const s = score(rows, results), v = verdict(s), nones = noneConfidence(rows, results), md = table(s, v) + '\n' + noneTable(nones);
    if (opt('--out')) fs.writeFileSync(opt('--out'), JSON.stringify({ at: new Date().toISOString(), score: s, verdict: v, nones: { ...nones, rows: undefined }, rows: rows.map((r, i) => ({ ...r, ...results[i] })) }, null, 1));
    if (opt('--md')) fs.writeFileSync(opt('--md'), md);
    process.stdout.write(md);
  } catch (e) { console.error('route bench: ' + (e.message || e)); process.exit(e.code || 1); }
}
