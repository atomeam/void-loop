// Verse's facts about itself, for the answer engine (void-live-deploy/lib/self-context.js): what it is (llms.txt), and the
// growth inbox (domains/growth-inbox.md: what shipped, what is still open), its games and the cards that have a 3D miniature
// (so its opinions of itself are informed: lib/voice.js), and for the growth tree the think tank's open tracks, the claim
// being built now (domains/forethinkers/index.md, domains/void.frontier.md) and the last commits on main (git log). Skills, the will and its reflections are read live at answer time.
// What its two builders just finished, the ladders they left each other and their lessons (domains/handoff.md).
// Writes void-live-deploy/self.json. The deploy workflow runs this before every deploy, so the file never goes stale there.
//   node tools/self-context.mjs          write the file
//   node tools/self-context.mjs --check  exit 1 if the committed file differs from what would be written
import { openItems } from './frontier.mjs';
import { isPrivate, deepQuoteFree } from './private.mjs';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'void-live-deploy/self.json');
// cut on a word with an ellipsis, never mid-word (owner, 2026-10-19: the wants card showed "last used on a de" and "sent to the n")
const clip = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); if (t.length <= n) return t; const c = t.slice(0, n - 1), sp = c.lastIndexOf(' '); return (sp > n * 0.6 ? c.slice(0, sp) : c).replace(/[\s,;:(\-–—]+$/, '') + '…'; };

// skills that are games Verse plays with you (names as in skills/index.json)
export const GAMES = ['tictactoe', 'othello', 'mancala', 'checkers', 'chess', 'aggravation', 'go', 'monopoly', 'battleship', 'poker', 'fireworks', 'connect4'];

// domains/void.canon.md: Adam's words about what Verse is (motto, VoidQuest) and Verse's terms for its parts, versioned;
// '(not written yet)' stays unknown
export function readCanon(text) {
  const t = String(text || ''), sec = (h) => clip((new RegExp('^## ' + h + '\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))', 'm').exec(t) || [])[1], 600);
  const known = (v) => (v && !/^\(not written yet\)$/i.test(v) ? v : null);
  // terms: '- **name**: what it is' lines under ## Terms (Verse's names for its own parts); left out when there are none
  const terms = [...String((new RegExp('^## Terms\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))', 'm').exec(t) || [])[1] || '').matchAll(/^- \*\*(.+?)\*\*:\s*(.+)$/gm)]
    .map((m) => ({ term: m[1].trim().slice(0, 60), means: clip(m[2], 400) })).slice(0, 20);
  // how Verse is different: Adam's '- **name**: line' lines under ## How Verse is different (2026-10-11); left out when there are none
  const different = [...String((new RegExp('^## How (?:Verse|V01D) is different\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))', 'm').exec(t) || [])[1] || '').matchAll(/^- \*\*(.+?)\*\*:\s*(.+)$/gm)]
    .map((m) => ({ name: m[1].trim().slice(0, 60), line: clip(m[2], 400) })).slice(0, 8);
  return { version: +((/^version:\s*(\d+)/m.exec(t) || [])[1] || 0), motto: known(sec('Motto')), voidquest: known(sec('VoidQuest')), ...(terms.length ? { terms } : {}), ...(different.length ? { different } : {}) };
}

// domains/forethinkers/index.md: the think tank's open tracks (name, when last advanced), drawn as faint branches on the
// growth tree (frontier #3) because they are not grown yet
export function readTracks(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const c = line.split('|').slice(1, -1).map((x) => x.trim());
    if (c.length < 3 || /^-+$/.test(c[0]) || c[0] === 'Track') continue;
    const last = (/Last advanced (\d{4}-\d\d-\d\d)/.exec(c[2]) || /(\d{4}-\d\d-\d\d)/.exec(c[2]) || [])[1] || '';
    out.push({ name: clip(c[0], 60), last });
  }
  return out;
}

// domains/void.frontier.md: the claim being built now, the newest claim line (by when the line was last written, from
// git blame where history is there; the latest date on the line, then the lowest line, otherwise). Glows on the tree.
export function readBuilding(text, lineTimes = {}) {
  let best = null, item = '';
  String(text || '').split('\n').forEach((line, i) => {
    const h = /^##\s+(?:\d+\.\s+)?(.+)$/.exec(line); if (h) item = clip(h[1], 80);
    const m = /^\s*-?\s*\*\*claim[^*]*:\*\*\s*(\S[^:]*?)\s(\d{4}-\d\d-\d\d):\s*(.+)$/.exec(line);
    if (!m || /^\W*(?:done|closed)\b/i.test(m[3])) return; // a finished item is not being built
    const at = lineTimes[i + 1] || m[2] + 'T00:00:00Z', key = at + '|' + String(i).padStart(6, '0');
    if (!best || key > best.key) best = { key, at, date: m[2], by: clip(m[1], 40), item: item.replace(/[`*]/g, ''), what: clip(m[3].replace(/[`*]/g, ''), 220) };
  });
  if (!best) return null;
  const { key, ...b } = best; return b;
}

// the last commits on main (git log --no-merges --format=%cI%x09%s), newest first: the growth tree's new leaves, each read by
// touching it. Merge commits are skipped (their subject only names a branch); a subject is clipped and keeps no Markdown.
export function readCommits(log, n = 20) {
  return String(log || '').split('\n').map((l) => l.split('\t')).filter(([at, subject]) => at && subject && !isNaN(Date.parse(at)))
    .slice(0, n).map(([at, subject]) => ({ at: new Date(Date.parse(at)).toISOString().replace('.000', ''), subject: clip(subject.replace(/[`*]/g, ''), 140) }));
}

// domains/handoff.md: the two builders' shared board. Its Just finished, Ladders and Lessons ('- **name**: line' bullets) go into
// self.json trimmed, so Verse learns from how it is being built ("what did your builders learn?"). Now and Up for grabs stay out.
export function readTagteam(text, n = 6) {
  const t = String(text || '');
  const sec = (h) => [...String((new RegExp('^## ' + h + '\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))', 'm').exec(t) || [])[1] || '').matchAll(/^- \*\*(.+?)\*\*:\s*(.+)$/gm)]
    .map((m) => ({ name: clip(m[1].replace(/[`*]/g, ''), 80), line: clip(m[2].replace(/[`*]/g, ''), 240) }))
    .filter((x) => !isPrivate(x.name) && !isPrivate(x.line)).slice(0, n);
  const out = { finished: sec('Just finished'), ladders: sec('Ladders'), lessons: sec('Lessons') };
  return out.finished.length || out.ladders.length || out.lessons.length ? out : null;
}

// docs/wishlist.md: Verse's ranked improvement budget (plan only, nothing bought). Each table row goes into self.json 'wishlist'
// trimmed, so "what's on your wishlist?" is answered from it and Verse can propose a new order.
export function readWishlist(text, n = 12) {
  return String(text || '').split('\n').map((l) => l.split('|').slice(1, -1).map((c) => c.trim())).filter((c) => c.length >= 7 && /^\d+$/.test(c[0]))
    .map((c) => { const t = (x, k) => clip(x.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[`*]/g, ''), k); return { rank: +c[0], item: t(c[1], 80), free: t(c[2], 200), cost: t(c[3], 200), value: t(c[4], 120), why: t(c[5], 160) }; })
    .filter((x) => !isPrivate(x.item) && !isPrivate(x.why)).slice(0, n);
}

// the tower (lib/tower.js): the site Verse is assimilating now (tower.target.json) and the next smallest unbeaten sites, in the tower's own
// order, smallest first (owner's rule: every site ever made, smallest first). The answer engine lists what is still open from here,
// so the target leads (owner, 2026-10-29: "the open asks are not in smallest-first order behind sycophanthex.com"). Pure.
export function towerOf(floors, target, pages = {}, n = 3) {
  const fl = Array.isArray(floors) ? floors : [], open = fl.filter((f) => f && !f.beaten);
  const id = (target && target.id) || (open[0] && open[0].id); if (!id) return null;
  const t = fl.find((f) => f.id === id) || { id }, name = (f) => clip(f.site || f.id, 60);
  const page = t.page || pages[t.id] ? '' : 'my page for it is not built yet: it still needs a page, named for it in LANE_PAGES in lib/tower.js';
  return { target: name(t), ...(target && target.since ? { since: clip(target.since, 10) } : {}), ...(page ? { page } : {}), next: open.filter((f) => f.id !== id).slice(0, n).map(name), beaten: fl.length - open.length, total: fl.length };
}

export function buildSelf(llms, inbox, { skills = [], minis = [], canon = null, tracks = null, building = null, commits = null, open = null, builders = null, wishlist = null } = {}) {
  const about = clip((/^>\s*(.+)$/m.exec(llms) || [])[1], 300);
  const rows = [];
  for (const line of inbox.split('\n')) {
    const c = line.split('|').slice(1, -1).map((x) => x.trim());
    if (c.length < 4 || c[0] === 'status' || /^-+$/.test(c[0])) continue;
    const [status, date, ask, source] = c;
    const shipped = /^shipped\b/i.test(status);
    // the note in brackets is for agents (corrections, checks); the public line keeps only the source's first clause
    rows.push({ state: shipped ? 'shipped' : clip(status.split(/\s/)[0], 20).toLowerCase(), date: clip(date, 10), ask: clip(ask, 120), from: clip(source.replace(/\s*\(.*$/, ''), 120) });
  }
  // what Verse studies stays off the site (tools/private.mjs): self.json is served, and the answer engine reads it
  const pub = (r) => !isPrivate(r.ask) && !isPrivate(r.from) && !isPrivate(r.subject) && !isPrivate(r.title);
  if (commits) commits = commits.filter(pub);
  if (open) open = open.filter(pub);
  if (building && isPrivate(JSON.stringify(building))) building = null;
  return {
    about, shipped: rows.filter((r) => r.state === 'shipped' && pub(r)),
    // what is still open comes from the frontier, the one build order (cleanup step 4); the inbox keeps the shipped history
    // `waits` (tools/frontier.mjs waitsOf): what an item says it waits on, so the wants card can list it as blocked
    open: open ? open.map((o) => ({ state: 'open', date: '', ask: clip(o.title, 120), from: clip(o.from, 120), ...(o.waits ? { waits: clip(o.waits, 60) } : {}) })) : rows.filter((r) => r.state !== 'shipped' && pub(r)),
    games: GAMES.filter((g) => skills.includes(g)), minis: minis.filter((m) => m !== 'sample').sort(),
    ...(canon ? { canon } : {}),
    ...(tracks ? { tracks } : {}),
    ...(building ? { building } : {}),
    ...(commits && commits.length ? { commits } : {}),
    ...(builders ? { builders } : {}),
    ...(wishlist && wishlist.length ? { wishlist } : {}),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const skills = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/index.json'), 'utf8'));
  // the games are one family now (skills/families.json), most of them no longer listed on their own in index.json: they count as skills here
  try { const fam = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/families.json'), 'utf8')); for (const f of fam.families || []) if (f.id === 'games') for (const k of f.skills || []) if (!skills.includes(k.name)) skills.push(k.name); } catch (_) {}
  const minis = readdirSync(resolve(root, 'void-live-deploy/skills/mini')).filter((f) => /^[a-z0-9-]+\.js$/.test(f)).map((f) => f.slice(0, -3));
  const frontier = resolve(root, 'domains/void.frontier.md'), tank = resolve(root, 'domains/forethinkers/index.md');
  const tagteam = resolve(root, 'domains/handoff.md');
  const lineTimes = {}; // when each frontier line was last written; empty without git history (then the dates on the lines decide)
  const blame = spawnSync('git', ['blame', '--line-porcelain', '--', 'domains/void.frontier.md'], { cwd: root, encoding: 'utf8', timeout: 20000 });
  if (blame.status === 0) { let t = 0; for (const l of blame.stdout.split('\n')) { const h = /^[0-9a-f]{40} \d+ (\d+)/.exec(l); if (h) lineTimes.next = +h[1]; const c = /^committer-time (\d+)/.exec(l); if (c) t = +c[1]; if (l.startsWith('\t')) { lineTimes[lineTimes.next] = new Date(t * 1000).toISOString().replace('.000', ''); } } delete lineTimes.next; }
  const self = buildSelf(readFileSync(resolve(root, 'void-live-deploy/llms.txt'), 'utf8'), readFileSync(resolve(root, 'domains/growth-inbox.md'), 'utf8'), { skills, minis, canon: existsSync(resolve(root, 'domains/void.canon.md')) ? readCanon(readFileSync(resolve(root, 'domains/void.canon.md'), 'utf8')) : null,
    tracks: existsSync(tank) ? readTracks(readFileSync(tank, 'utf8')) : null, building: existsSync(frontier) ? readBuilding(readFileSync(frontier, 'utf8'), lineTimes) : null,
    open: existsSync(frontier) ? openItems(readFileSync(frontier, 'utf8')) : null,
    builders: existsSync(tagteam) ? readTagteam(readFileSync(tagteam, 'utf8')) : null,
    wishlist: existsSync(resolve(root, 'docs/wishlist.md')) ? readWishlist(readFileSync(resolve(root, 'docs/wishlist.md'), 'utf8')) : null,
    commits: readCommits(spawnSync('git', ['log', '--no-merges', '-20', '--format=%cI%x09%s', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 20000 }).stdout) });
  // Verse's clips (tools/clips.mjs): its tricks library and what performed, so it picks what to film next and which trick to learn
  const clipsFile = resolve(root, 'domains/void.clips.json');
  if (existsSync(clipsFile)) { try { const c = JSON.parse(readFileSync(clipsFile, 'utf8')); const { TRICKS } = await import('./clips.mjs');
    self.clips = { upload: 'Anyone can upload any Verse film or ad clip: a-to-mind.com/films/ has 1. Download (free), 2. Copy for YouTube, TikTok, Reels or X (title, description with a tracked a-to-mind.com link, the call to action and a share-this-ad line, hashtags) and 3. Upload to that platform, signed in as yourself. No API or token. Say "upload this to YouTube". Verse Tube: a-to-mind.com/films/ is the Verse video site: a watch page per video at /films/?v=<id>, view counts, share buttons for every platform and an RSS feed at /films/rss (docs/void-tube.md).', tricks: Object.keys(TRICKS), learned: (c.learned || []).slice(-20), visits: c.visits || {}, note: clip(c.note, 300) }; } catch (_) { /* leave clips out */ } }
  // who visits (tools/traffic.mjs, daily into domains/traffic.json): one line of counts, our own runs and bots taken out; the growth card shows it
  try { const t = JSON.parse(readFileSync(resolve(root, 'domains/traffic.json'), 'utf8')); if (t && typeof t.line === 'string' && t.line) self.people = { line: clip(t.line, 200), at: clip(t.at, 20), source: clip(t.source, 20) }; } catch (_) { /* no count yet */ }
  try {
    const { tower, LANE_PAGES } = await import('../void-live-deploy/lib/tower.js');
    const rd = (f) => { try { return JSON.parse(readFileSync(resolve(root, 'void-live-deploy', f), 'utf8')); } catch (_) { return null; } };
    const target = rd('tower.target.json'), ev = rd('tower.evidence.json') || {};
    const t = tower((rd('lap.items.json') || {}).onlySite || [], ev.floors || {}, rd('tower.frontier.json'), null, rd('tower.rank.json'), rd('tower.size.json'), target);
    const tw = towerOf(t.floors, target, LANE_PAGES); if (tw) self.tower = tw;
  } catch (_) { /* no tower data: the open list starts with the inbox */ }
  const text = JSON.stringify(deepQuoteFree(self), null, 1) + '\n'; // only Verse's words are served, never the owner's quoted ones (tools/private.mjs)
  if (process.argv.includes('--check')) {
    const same = existsSync(out) && readFileSync(out, 'utf8') === text;
    console.log(same ? 'self.json up to date' : 'self.json is stale: run node tools/self-context.mjs');
    process.exit(same ? 0 : 1);
  }
  writeFileSync(out, text);
  console.log(`self.json: ${self.shipped.length} shipped, ${self.open.length} open, ${self.games.length} games, ${self.minis.length} miniatures`);
}
