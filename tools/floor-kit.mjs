// The floor kit (owner, 2026-10-25: "build what you need to move faster so any agent can move ultra fast on the tower"; "we are just a little
// fish we eat little sites first"): one command that tells a builder everything about one site of the tower and drafts what the fight needs,
// so a floor goes from "next in the queue" to "page built, probe in, gate dispatched" in minutes. It loads no rival site (owner: "we dont
// have to test rival"); what it knows comes from the repo: lib/tower.js (the floors, the lanes, the queue), tower.evidence.json (the gate's
// verdicts), tools/tower-probes.mjs (the probes), tower.shots/ (the gate's own screenshot of the site, when it has one).
//   node tools/floor-kit.mjs                          the next fight: where it stands and what to do
//   node tools/floor-kit.mjs "translate: deepl.com"   one floor by id (or a bare host: deepl.com)
//   node tools/floor-kit.mjs --add translate https://smalltranslator.example/   put a site into a lane, at its bottom (the next fight of that lane)
//   node tools/floor-kit.mjs --queue                  the queue, smallest site first, with each one's state
// Pure where it can be (brief, draftProbe, laneLine): tools/floor-kit.test.mjs.
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { FLOORS, LANES, COMMON_ASPECTS, tower, hostOf, noShotOf } from '../void-live-deploy/lib/tower.js';
import { probeFor, PROBES } from './tower-probes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE = path.join(root, 'void-live-deploy', 'tower.evidence.json'), FRONTIER = path.join(root, 'void-live-deploy', 'tower.frontier.json');
const TOWER_JS = path.join(root, 'void-live-deploy', 'lib', 'tower.js');
const readJson = (f, or) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return or; } };
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** the floor for an id, a host, or a site name; null when the tower has none. Pure. */
export function floorFor(want, floors = FLOORS) {
  const w = String(want || '').trim().toLowerCase(); if (!w) return null;
  return floors.find((f) => f.id.toLowerCase() === w) || floors.find((f) => hostOf(f.url) === hostOf(w) || String(f.site).toLowerCase() === w) || floors.find((f) => f.id.toLowerCase().endsWith(': ' + hostOf(w))) || null;
}

/** a probe drafted for a floor with none: a lane site takes its lane's probe; any other floor gets a skeleton that names every aspect it has
 *  to be measured on, with the asks and the regexes left for the builder to fill from what the site shows. Pure. */
export function draftProbe(f) {
  const have = probeFor(f.id); if (have) return { ready: true, text: '// ' + f.id + ' already has a probe (tools/tower-probes.mjs' + (f.lane ? ", its lane's: " + f.lane : '') + ')' };
  const extra = (f.extra || []).map((a) => "'" + a + "': [['" + a + " shown', /\\b" + a.split(' ')[0] + "\\b/i]]").join(', ');
  const page = f.page || '/' + slug(f.id) + '/';
  return { ready: false, text: [
    "  '" + f.id + "': {",
    "    site: '" + f.url + "', verse: '" + page + "',",
    '    // the question in the page\'s link; the truth any correct answer agrees on (worked out by hand, never read off the site); judged on Verse alone',
    "    ask: { verse: '" + page + "' },",
    "    truth: [['the right answer', /\\bTODO\\b/]],",
    '    askParts: { ' + extra + ' },',
    "    // what the best sites of this kind show, as words a page carries: fill from the site's own screen (void-live-deploy/tower.shots/" + slug(f.site) + ".jpg) or its controls",
    "    facts: [['TODO', /\\bTODO\\b/i]],",
    '  },',
  ].join('\n') };
}

/** the LANES line that puts `url` at the bottom of a lane (the next fight of that lane: little fish eat little sites first). Pure. */
export function laneLine(leader, url, lanes = LANES) {
  const have = lanes[leader] || [], h = hostOf(url); if (!h) throw new Error('not a site: ' + url);
  if (have.some((u) => hostOf(u) === h)) return null;
  return "  " + JSON.stringify(leader).replace(/^"|"$/g, (q) => (/^[a-z_$][\w$]*$/i.test(leader) ? '' : q)) + ": ['" + url.replace(/'/g, '') + "', " + have.map((u) => "'" + u + "'").join(', ') + '],';
}

/** where a floor stands, in plain words: each aspect's verdict, what is lost, what is not measured, and the three things to do next. Pure. */
export function brief(f, evidence = {}, t = null) {
  const rows = evidence[f.id] || {}, state = t && t.floors.find((x) => x.id === f.id);
  const want = COMMON_ASPECTS.concat(f.extra || []);
  const lines = want.map((a) => { const r = rows[a]; return '  ' + a.padEnd(20) + (r ? r.verdict + (r.evidence ? '  ' + String(r.evidence).replace(/\s+/g, ' ').slice(0, 110) : '') : 'not measured yet'); });
  const lost = want.filter((a) => rows[a] && rows[a].verdict === 'worse'), unm = want.filter((a) => !rows[a] || rows[a].verdict === 'unverified');
  const p = probeFor(f.id), page = f.page || (p && p.verse) || '';
  const next = [];
  if (!page) next.push('build the page: copy void-live-deploy/translate/index.html (two panes, a module after load, the asks row, the related nav) to void-live-deploy/' + slug(f.id) + '/index.html; register it in lib/toolkit.js TOOLS and RELATED, sw.js TOOLS, lib/seo.js, docs/MAP.md; set page: on the floor in lib/tower.js');
  if (!p) next.push('add the probe below to tools/tower-probes.mjs PROBES (and PARTS for its extra aspects), then node --test tools/tower-gate.test.mjs');
  for (const a of lost) next.push('fix ' + a + ': ' + (rows[a].evidence ? String(rows[a].evidence).replace(/\s+/g, ' ').slice(0, 160) : 'see the row'));
  if (unm.length && p && page) next.push('measure: dispatch the gate for "' + f.id + '" (tower-gate.yml, floor input; several: a,b,c) after the deploy');
  if (!next.length) next.push('nothing left: the gate\'s next run should read it beaten');
  return { id: f.id, site: f.site, url: f.url, lane: f.lane || null, page, state: state ? state.state + ' (' + state.n + ' of ' + state.m + ' aspects)' : 'not in the queue', lines, lost, unmeasured: unm, next, shot: noShotOf(f) ? null : 'void-live-deploy/tower.shots/' + slug(f.site) + '.jpg' };
}

function print(b, f) {
  console.log('=== ' + b.id + ' ===  ' + b.site + '  ' + b.url + (b.lane ? '  (lane: ' + b.lane + ')' : ''));
  console.log('state: ' + b.state + ' | Verse\'s page: ' + (b.page || '(none yet)') + ' | the site as the gate saw it: ' + (!b.shot ? '(never pictured: a noShot floor, lib/tower.js)' : fs.existsSync(path.join(root, b.shot)) ? b.shot : '(no screenshot yet)'));
  console.log('aspects:\n' + b.lines.join('\n'));
  console.log('do next:\n' + b.next.map((x, i) => '  ' + (i + 1) + '. ' + x).join('\n'));
  const d = draftProbe(f); console.log((d.ready ? 'probe: ' : 'probe to add:\n') + d.text);
  console.log('gate by hand: the tower-gate workflow with floor="' + b.id + '"; ship with the tower-loop playbook (docs/playbooks/floor-kit.md)');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), evidence = readJson(EVIDENCE, { floors: {} }).floors || {}, frontier = readJson(FRONTIER, null), t = tower([], evidence, frontier);
  if (argv[0] === '--add') {
    const [leader, url] = argv.slice(1); if (!leader || !LANES[leader] && !FLOORS.some((f) => f.id === leader)) { console.error('no floor ' + leader + '; floors with lanes: ' + Object.keys(LANES).join(', ')); process.exit(2); }
    const line = laneLine(leader, url); if (!line) { console.log(hostOf(url) + ' is already in the ' + leader + ' lane'); process.exit(0); }
    const src = fs.readFileSync(TOWER_JS, 'utf8'), re = new RegExp('^  ["\']?' + leader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\']?' + ": \\[[^\\n]*\\],$", 'm');
    if (!re.test(src)) { console.error('the ' + leader + ' lane is not one line in lib/tower.js LANES; add it by hand'); process.exit(2); }
    fs.writeFileSync(TOWER_JS, src.replace(re, line)); console.log('added ' + hostOf(url) + ' at the bottom of the ' + leader + ' lane: it is that lane\'s next fight'); process.exit(0);
  }
  if (argv[0] === '--queue') { for (const f of t.floors.filter((x) => !x.beaten)) console.log(String(f.floor).padStart(3) + '  ' + f.state.padEnd(8) + f.id.padEnd(40) + f.n + '/' + f.m + (f.lost.length ? '  lost: ' + f.lost.join(', ') : '')); process.exit(0); }
  const f = argv.length ? floorFor(argv.join(' ')) : t.floors.find((x) => x.state === 'current');
  if (!f) { console.error('no floor ' + argv.join(' ') + '; try --queue'); process.exit(2); }
  print(brief(f, evidence, t), f);
}
