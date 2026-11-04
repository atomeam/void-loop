// autosalvage, revived as Verse's unifier (owner, 2026-11-03: "autosalvage was meant to unify all work into verse"). The Python original
// (archive/repos/autosalvage: scan -> evaluate -> migrate, dry-run by default) set the shape; this is its living form in the repo's own tooling.
//   scan      every piece of past work: archive/repos/* (and their apps/packages), archive/*, drafts/*, domains/*, parked and inert workflows,
//             the rows of docs/SALVAGE.md, the owner's other GitHub repos (domains/autosalvage.repos.json) and free outside work
//             (domains/autosalvage.outside.json)
//   evaluate  each piece is unified (migrated, in domains/autosalvage.unified.json), live (Verse's live code already names it),
//             salvageable (with a target: skill, bot, page, tool or data, and a value score), history, or skipped (outside work whose
//             license Verse cannot reuse)
//   write     void-live-deploy/salvage.json (what /salvage/ and /credits/ show) and the generated block of docs/SALVAGE.md
//   node tools/autosalvage/unify.mjs                  dry run: print the counts and the top 10 (writes nothing)
//   node tools/autosalvage/unify.mjs --write          write salvage.json and docs/SALVAGE.md
//   node tools/autosalvage/unify.mjs --repos-refresh  re-list the owner's repos with gh (read-only) into domains/autosalvage.repos.json
//   node tools/autosalvage/unify.mjs --outside-refresh  re-read each outside source's license from GitHub
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const OUT = 'void-live-deploy/salvage.json', DOC = 'docs/SALVAGE.md', UNIFIED = 'domains/autosalvage.unified.json',
  REPOS = 'domains/autosalvage.repos.json', OUTSIDE = 'domains/autosalvage.outside.json';
const START = '<!-- autosalvage:start -->', END = '<!-- autosalvage:end -->';
const readJson = (f, d) => { try { return JSON.parse(readFileSync(resolve(root, f), 'utf8')); } catch (_) { return d; } };
const ls = (d) => { try { return readdirSync(resolve(root, d)).filter((n) => !n.startsWith('.')).sort(); } catch (_) { return []; } };
const isDir = (p) => { try { return statSync(resolve(root, p)).isDirectory(); } catch (_) { return false; } };

// licenses Verse may reuse with credit; GPL family only isolated (a separate service, never mixed into Verse's code)
export const PERMISSIVE = ['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'CC0-1.0', 'Unlicense', 'CC-BY-4.0', 'CC-BY-3.0', '0BSD', 'Zlib', 'PDDL-1.0', 'ODC-By-1.0', 'Python-2.0'];
export const SHARE_ALIKE = ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'LGPL-2.1', 'LGPL-3.0', 'MPL-2.0', 'ODbL-1.0', 'CC-BY-SA-4.0', 'EPL-2.0'];
/** what Verse may do with an outside license. Pure. */
export function licenseVerdict(spdx) {
  if (!spdx || spdx === 'NOASSERTION' || spdx === 'NONE') return { ok: false, how: 'no clear license: skipped, never guessed' };
  if (PERMISSIVE.includes(spdx)) return { ok: true, how: 'reuse with credit; keep the license notice' };
  if (SHARE_ALIKE.includes(spdx)) return { ok: true, isolated: true, how: 'only isolated (called as a separate service or kept as separate data under its own license), never mixed into Verse code' };
  return { ok: false, how: 'license not on the reviewed list: skipped until a person checks it' };
}

/** every piece of past work, with a few facts the evaluator needs. Reads the tree. */
export function scan() {
  const pieces = [], add = (p) => pieces.push(p);
  const files = (dir) => { try { return execFileSync('git', ['ls-files', dir], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n').filter(Boolean); } catch (_) { return []; } };
  const facts = (path) => {
    const fs = isDir(path) ? files(path) : [path];
    return { files: fs.length, code: fs.filter((f) => /\.(m?js|ts|tsx|py|html)$/.test(f)).length, tests: fs.filter((f) => /test/i.test(f)).length,
      readme: fs.some((f) => /readme\.md$/i.test(f)), docs: fs.filter((f) => /\.md$/.test(f)).length, json: fs.filter((f) => /\.json$/.test(f)).length };
  };
  for (const repo of ls('archive/repos')) {
    const base = 'archive/repos/' + repo; if (!isDir(base)) continue;
    add({ id: base, kind: 'archived repo', name: repo, path: base, ...facts(base) });
    for (const sub of ['apps', 'packages', 'core', 'integrations', 'lib', 'src', 'tools', 'drafts'])
      for (const c of ls(base + '/' + sub)) add({ id: base + '/' + sub + '/' + c, kind: 'archived part', name: c.replace(/\.[^.]+$/, ''), path: base + '/' + sub + '/' + c, ...facts(base + '/' + sub + '/' + c) });
    for (const w of ls(base + '/github-inert/workflows')) add({ id: base + '/github-inert/workflows/' + w, kind: 'old workflow', name: w.replace(/\.ya?ml$/, ''), path: base + '/github-inert/workflows/' + w, ...facts(base + '/github-inert/workflows/' + w) });
  }
  for (const n of ls('archive')) if (n !== 'repos') add({ id: 'archive/' + n, kind: 'archive', name: n.replace(/\.[^.]+$/, ''), path: 'archive/' + n, ...facts('archive/' + n) });
  for (const n of ls('drafts')) add({ id: 'drafts/' + n, kind: 'draft', name: n.replace(/\.[^.]+$/, ''), path: 'drafts/' + n, ...facts('drafts/' + n) });
  for (const n of ls('domains')) if (!n.startsWith('autosalvage.')) add({ id: 'domains/' + n, kind: 'domain', name: n.replace(/\.(md|json|jsonl|mmd)$/, ''), path: 'domains/' + n, ...facts('domains/' + n) });
  for (const n of ls('docs')) if (/\.workflow\.ya?ml$/.test(n)) add({ id: 'docs/' + n, kind: 'parked workflow', name: n.replace(/\.workflow\.ya?ml$/, ''), path: 'docs/' + n, ...facts('docs/' + n) });
  for (const row of shelfRows(readFileSafe(DOC))) add({ id: 'shelf:' + row.path, kind: 'shelf row', name: basename(row.path).replace(/\.[^.]+$/, ''), path: row.path, size: row.size, files: 1, code: /\.(m?js|py|ps1)$/.test(row.path) ? 1 : 0, tests: 0, readme: false, docs: 1, json: 0, said: row.could });
  const archived = new Set(ls('archive/repos').map((s) => s.toLowerCase()));
  for (const r of (readJson(REPOS, { repos: [] }).repos || []))
    if (r.name !== 'void-loop') add({ id: 'github:atomeam/' + r.name, kind: 'github repo', name: r.name, path: 'https://github.com/atomeam/' + r.name, files: r.size ? 1 : 0, code: r.size ? 1 : 0, tests: 0, readme: false, docs: 0, json: 0, mirrored: archived.has(r.name.toLowerCase()), description: r.description || '', updated: r.updatedAt || '' });
  for (const s of (readJson(OUTSIDE, { sources: [] }).sources || []))
    add({ id: 'outside:' + s.id, kind: 'outside', name: s.id, path: s.url, files: 1, code: 0, tests: 0, readme: true, docs: 0, json: 1, license: s.license || '', author: s.author || '', what: s.what || '', gap: s.gap || '', target: s.target || 'data' });
  return pieces;
}
const readFileSafe = (f) => { try { return readFileSync(resolve(root, f), 'utf8'); } catch (_) { return ''; } };

/** the rows of the hand-written shelf (above the generated block). Pure. */
export function shelfRows(md) {
  const hand = md.split(START)[0], out = [];
  for (const line of hand.split('\n')) {
    const m = /^\|\s*`([^`]+)`[^|]*\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|/.exec(line); if (!m) continue;
    let path = m[1].trim(); if (!path.includes('/')) path = '?/' + path;
    out.push({ path, what: m[2].trim(), could: m[3].trim().slice(0, 200), size: m[4].trim() });
  }
  return out;
}

const HISTORY = /(^|[._-])(old|log|patch|backup|bak)([._-]|$)|\d{4}-\d\d-\d\d|^(AGENTS|STANDING|LOOP)|_patch$|\.lock$|lock\.ya?ml$|lockfile|^tsconfig|^eslint/i;
// names too common to prove anything when the live code mentions them
const GENERIC = new Set(['readme', 'index', 'frontend', 'backend', 'bridge', 'logger', 'tsconfig', 'utils', 'types', 'config', 'server', 'client', 'shared', 'common', 'assets', 'components', 'scripts', 'tests', 'public', 'styles', 'features', 'inputs', 'targets', 'handoff', 'vercel', 'deploy', 'release', 'build', 'lessons']);
/** where a salvageable piece would land in Verse. Pure. */
export function targetOf(p) {
  if (p.target) return p.target;
  if (/workflow/.test(p.kind)) return 'tool';
  if (/bot|agent|assistant|worker/i.test(p.name)) return 'bot';
  if (p.code && p.tests) return 'skill';
  if (p.code && /html/.test(p.path + '') ) return 'page';
  if (p.code) return 'tool';
  if (p.json && !p.docs) return 'data';
  return 'page';
}
/** a rough value score: more real work, tests and docs, and a named gap, rank higher. Pure. */
export function valueOf(p) {
  let v = Math.log2((p.files || 0) + 1) * 6 + Math.min(p.code || 0, 40) * 0.6 + Math.min(p.tests || 0, 20) * 1.5 + (p.readme ? 4 : 0) + Math.min(p.docs || 0, 10) * 0.5;
  if (p.kind === 'outside') v += 18;
  if (/^(L)$/.test(p.size || '')) v += 6; else if (p.size === 'M') v += 4; else if (p.size === 'S') v += 2;
  if (/money|ledger|bot|agent|skill|router|free|salvage|brief|handoff|memory/i.test(p.name + ' ' + (p.gap || '') + ' ' + (p.said || ''))) v += 6;
  return Math.round(v * 10) / 10;
}

/** classify every piece. `named(name)` says whether Verse's live code names it. Pure given named. */
export function evaluate(pieces, { unified = {}, named = () => false } = {}) {
  return pieces.map((p) => {
    const u = unified[p.id];
    if (u) return { ...p, status: 'unified', target: u.target, into: u.into, test: u.test, pr: u.pr || null, value: valueOf(p) };
    if (p.kind === 'outside') {
      const lv = licenseVerdict(p.license);
      if (!lv.ok) return { ...p, status: 'skipped', why: lv.how, value: 0 };
      return { ...p, status: 'salvageable', target: targetOf(p), isolated: !!lv.isolated, why: lv.how, value: valueOf(p) };
    }
    if (p.kind === 'github repo' && p.mirrored) return { ...p, status: 'live', why: 'mirrored into archive/repos and scanned there', value: 0 };
    if (p.kind === 'github repo' && !p.files) return { ...p, status: 'history', why: 'empty repository', value: 0 };
    if (HISTORY.test(basename(p.path + ''))) return { ...p, status: 'history', why: 'a dated, superseded or one-off file', value: 0 };
    if (p.kind === 'shelf row' && /^none$/i.test(p.size || '')) return { ...p, status: 'history', why: 'the shelf says it is done or history', value: 0 };
    if (p.kind !== 'outside' && p.name.length >= 5 && !GENERIC.has(p.name.toLowerCase()) && named(p.name)) return { ...p, status: 'live', why: "Verse's live code already names it", value: 0 };
    if (!p.files) return { ...p, status: 'history', why: 'nothing left to reuse', value: 0 };
    return { ...p, status: 'salvageable', target: targetOf(p), value: valueOf(p) };
  });
}

/** git grep over Verse's live code (the site, tools, workflows), not the archive or this tool. */
function namedInLive(name) {
  try {
    execFileSync('git', ['grep', '-q', '-i', '-w', '-F', name, '--', 'void-live-deploy', 'tools', '.github', ':!tools/autosalvage', ':!void-live-deploy/salvage.json', ':!void-live-deploy/salvage', ':!void-live-deploy/credits'], { cwd: root, stdio: 'ignore' });
    return true;
  } catch (_) { return false; }
}

/** the published summary. Pure. */
export function summarize(rows, at) {
  const count = (s) => rows.filter((r) => r.status === s).length;
  const top = rows.filter((r) => r.status === 'salvageable').sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
  const credits = rows.filter((r) => r.kind === 'outside' && (r.status === 'unified' || r.status === 'salvageable'))
    .map((r) => ({ name: r.name, author: r.author, license: r.license, link: r.path, used: r.status === 'unified' ? r.into : null, isolated: !!r.isolated }));
  const slim = (r) => ({ id: r.id, kind: r.kind, status: r.status, target: r.target || null, value: r.value, why: r.why || r.said || r.what || r.description || '', into: r.into || null, test: r.test || null, pr: r.pr || null, license: r.license || null });
  return { at, scanned: rows.length, counts: { unified: count('unified'), live: count('live'), salvageable: count('salvageable'), history: count('history'), skipped: count('skipped') },
    remaining: count('salvageable'), top10: top.slice(0, 10).map(slim), credits, pieces: rows.map(slim) };
}

/** docs/SALVAGE.md with its generated block replaced (appended the first time). Pure. */
export function docWith(md, s) {
  const lines = [START, '## Unifier status (generated by `node tools/autosalvage/unify.mjs --write`; do not edit by hand)', '',
    `Scanned ${s.scanned} pieces: ${s.counts.unified} unified into Verse, ${s.counts.live} already live, ${s.counts.salvageable} left to salvage, ${s.counts.history} history, ${s.counts.skipped} outside pieces skipped for their license. Live at https://a-to-mind.com/salvage/.`, '',
    '### Next 10 by value', '', '| Piece | Kind | Target | Value |', '| --- | --- | --- | --- |',
    ...s.top10.map((r) => `| \`${r.id}\` | ${r.kind} | ${r.target} | ${r.value} |`), '',
    '### Unified', '', ...(s.pieces.filter((r) => r.status === 'unified').map((r) => `- \`${r.id}\` → ${r.into} (test: \`${r.test}\`)`)), s.counts.unified ? '' : '- none yet', END];
  const block = lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
  return md.includes(START) ? md.replace(new RegExp(START + '[\\s\\S]*?' + END), block) : md.replace(/\s*$/, '\n\n' + block + '\n');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--repos-refresh')) {
    const repos = JSON.parse(execFileSync('gh', ['repo', 'list', 'atomeam', '--limit', '200', '--json', 'name,description,updatedAt,diskUsage,isArchived'], { encoding: 'utf8' }));
    writeFileSync(resolve(root, REPOS), JSON.stringify({ _: 'the owner\'s GitHub repos, read-only (gh repo list atomeam)', repos: repos.map((r) => ({ name: r.name, description: r.description, updatedAt: r.updatedAt, size: r.diskUsage, archived: r.isArchived })).sort((a, b) => a.name.localeCompare(b.name)) }, null, 2) + '\n');
  }
  if (args.includes('--outside-refresh')) {
    const o = readJson(OUTSIDE, { sources: [] });
    for (const s of o.sources) { try { s.license = execFileSync('gh', ['api', 'repos/' + s.id, '--jq', '.license.spdx_id // ""'], { encoding: 'utf8' }).trim(); } catch (_) { /* keep the last reading */ } }
    writeFileSync(resolve(root, OUTSIDE), JSON.stringify(o, null, 2) + '\n');
  }
  const unified = readJson(UNIFIED, { pieces: {} }).pieces || {};
  const s = summarize(evaluate(scan(), { unified, named: namedInLive }), new Date().toISOString().slice(0, 10));
  if (args.includes('--write')) {
    writeFileSync(resolve(root, OUT), JSON.stringify(s, null, 1) + '\n');
    writeFileSync(resolve(root, DOC), docWith(readFileSafe(DOC), s));
  }
  console.log(`autosalvage: ${s.scanned} scanned, ${JSON.stringify(s.counts)}`);
  for (const r of s.top10) console.log(`  ${r.value}\t${r.target}\t${r.id}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
