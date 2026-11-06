// Verse's crew and its wants, the half that reads and writes (lib/team-crew.js is the pure half; tools/team-crew.test.mjs runs both).
// The clock (POST /api/automations/tick, the owner's token, every 15 minutes from .github/workflows/void-tick.yml) calls crewTick after
// the automations. Each run: every crew member is marked here; the evidence is read (the exam, the Tower, the guards, probes of the key
// pages, what the due members fetch); Verse's brain measures every open want and closes the ones whose number moved, then files new
// wants as build-queue jobs with a #work thread; then each member whose turn it is does its own job and posts what it did.
// WHAT THIS CAN TOUCH: reads of a-to-mind.com, of public rival robots.txt and sitemaps, of public browser release feeds and of the
// public GitHub API for this repo; writes only to its own D1 tables, the team chat and the build queue (team kinds, ids "want-*").
// It never spends, never sends anything outside, never merges, never posts on X.
import * as C from './team-crew.js';
import * as P from './team-priorities.js';
import { TEAM_KINDS, kindOf } from './team.js';
import { readStatus } from '../functions/api/status.js';
import { crewReady, crewWrite } from '../functions/api/team.js';

const ORIGIN = 'https://a-to-mind.com', REPO = 'atomeam/void-loop';
const TABLES = [
  'CREATE TABLE IF NOT EXISTS void_team_crew (k TEXT PRIMARY KEY, v TEXT NOT NULL, at INTEGER NOT NULL)',
  "CREATE TABLE IF NOT EXISTS void_team_wants (key TEXT PRIMARY KEY, lane TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, label TEXT NOT NULL, metric TEXT NOT NULL, better TEXT NOT NULL, baseline REAL, latest REAL, cite TEXT NOT NULL DEFAULT '[]', private INTEGER NOT NULL DEFAULT 0, job TEXT NOT NULL, thread INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL, filed INTEGER NOT NULL, checked INTEGER NOT NULL DEFAULT 0, met_at INTEGER NOT NULL DEFAULT 0, reopened INTEGER NOT NULL DEFAULT 0, nag INTEGER NOT NULL DEFAULT 0)",
];
const KEEP_MET_MS = 7 * 864e5; // a met want is kept a week, then the same evidence may file it again
const SETTLE = { tower: 48 * 3600e3, exam: 24 * 3600e3, miss: 72 * 3600e3, revenue: 7 * 864e5 }; // how long a handed-in job gets before its number counts
const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');

async function getState(env, k) { const r = await env.DB.prepare('SELECT v FROM void_team_crew WHERE k = ?').bind(k).first(); if (!r) return null; try { return JSON.parse(r.v); } catch (_) { return null; } }
async function setState(env, k, v, now) { await env.DB.prepare('INSERT INTO void_team_crew (k, v, at) VALUES (?, ?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v, at = excluded.at').bind(k, JSON.stringify(v), now).run(); }

/** one GET with a time limit: { status, ms, text } (status 0: no answer). Bodies over max bytes are not read. */
export async function get(env, url, { ms = 8000, max = 3e6, headers = {} } = {}) {
  const f = env.CREW_FETCH || fetch, ac = new AbortController(), t0 = Date.now(), timer = setTimeout(() => ac.abort(), ms);
  try {
    const r = await f(url, { headers: { 'user-agent': 'VerseCrew/1 (+https://a-to-mind.com/team/)', ...headers }, redirect: 'follow', signal: ac.signal });
    const len = Number(r.headers && r.headers.get && r.headers.get('content-length')) || 0;
    const text = len > max ? '' : await r.text();
    return { status: r.status, ms: Date.now() - t0, text: text.length > max ? '' : text };
  } catch (_) { return { status: 0, ms: Date.now() - t0, text: '' }; } finally { clearTimeout(timer); }
}
const json = (t) => { try { return JSON.parse(t); } catch (_) { return null; } };

/** the crew's rows in the team chat: made once each (never over a member the owner removed), here this run */
async function seat(env, now) {
  for (const b of C.CREW) {
    await env.DB.prepare('INSERT OR IGNORE INTO void_team_agents (id, name, about, key, joined, seen, auto, crew) VALUES (?, ?, ?, ?, ?, ?, 0, 1)').bind(b.id, b.name, b.about, hex(32), now, now).run(); // void-review: ok (eight fixed rows; the key is random and never shown, so nobody signs in as a crew member)
    await env.DB.prepare('INSERT OR IGNORE INTO void_team_channels (code, title, about, created, by) VALUES (?, ?, ?, ?, ?)').bind(b.channel, b.channel, b.name + '\'s lane: ' + b.about.replace(/^Crew · runs on Verse's clock\. /, ''), now, 'verse').run(); // void-review: ok (eight fixed channels)
  }
  const ids = C.CREW.map((b) => b.id);
  await env.DB.prepare(`UPDATE void_team_agents SET seen = ?, auto = 0, crew = 1 WHERE off = 0 AND id IN (${ids.map(() => '?').join(',')})`).bind(now, ...ids).run(); // void-review: ok (placeholders only)
  const { results } = await env.DB.prepare(`SELECT id, name, off FROM void_team_agents WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all(); // void-review: ok (placeholders only)
  const on = new Set(results.filter((r) => !r.off).map((r) => r.id));
  return C.CREW.filter((b) => on.has(b.id));
}
async function did(env, bot, line, now, doneOne) {
  await env.DB.prepare('UPDATE void_team_agents SET did = ?, did_at = ?, done = done + ? WHERE id = ?').bind(String(line).slice(0, 200), now, doneOne ? 1 : 0, bot.id).run();
}

// ---- the evidence ----
async function probe(env, paths) {
  return Promise.all([...new Set(paths)].slice(0, 20).map(async (path) => { const r = await get(env, ORIGIN + path, { ms: 10000, max: 4e6 }); return { path, status: r.status, ms: r.ms }; }));
}
async function readExam(env) {
  const a = await get(env, ORIGIN + '/exam/latest.json', { max: 2e6 }), j = a.status === 200 ? json(a.text) : null;
  if (j && j.domains) return { exam: j, src: '/exam/latest.json' };
  const b = await get(env, ORIGIN + '/progress/exam.json'), k = b.status === 200 ? json(b.text) : null;
  return { exam: k && k.cases ? k : null, src: k ? '/progress/exam.json' : '' };
}
async function count(env, sql, ...args) { try { const r = await env.DB.prepare(sql).bind(...args).first(); return r ? Number(r.n) || 0 : null; } catch (_) { return null; } }
async function ideas(env, now) {
  try { return (await env.DB.prepare("SELECT h, topic, note, show, station, value_cents FROM void_watch_notes WHERE kind = 'idea' AND at >= ? ORDER BY at DESC LIMIT 12").bind(new Date(now - 3 * 864e5).toISOString()).all()).results || []; } catch (_) { return []; }
}
async function jobStates(env, ids) {
  if (!ids.length) return {};
  try { const { results } = await env.DB.prepare(`SELECT id, state FROM void_queue WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all(); return Object.fromEntries(results.map((r) => [r.id, r.state])); } catch (_) { return {}; } // void-review: ok (placeholders only)
}
// SiteOperator: the links on a few pages, a window of them followed each run so the whole set is walked over runs
async function linkWalk(env, run) {
  const pages = await Promise.all(C.LINK_PAGES.map(async (p) => ({ p, r: await get(env, ORIGIN + p, { max: 3e6 }) })));
  const from = new Map();
  for (const { p, r } of pages) for (const l of C.linksIn(r.text)) if (!from.has(l)) from.set(l, p);
  const all = [...from.keys()].sort(), pick = C.rotate(all, C.LINKS_PER_RUN, run);
  const res = await probe(env, pick);
  return { total: all.length, links: res.map((x) => ({ ...x, from: from.get(x.path) })) };
}

// ---- the wants ----
async function measureOpen(env, ev, bots, now) {
  const { results } = await env.DB.prepare("SELECT * FROM void_team_wants WHERE state = 'open'").all();
  const jobs = await jobStates(env, results.map((w) => w.job));
  const out = { met: [], reopened: [] };
  for (const w of results) {
    const v = C.measure(w.metric, { ...ev, jobs });
    if (v == null) continue;
    const bot = bots.find((b) => b.lane === w.lane) || null, by = bot ? bot.id : 'verse';
    if (C.improved(w.better, w.baseline, v)) {
      await env.DB.prepare("UPDATE void_team_wants SET state = 'met', latest = ?, checked = ?, met_at = ? WHERE key = ?").bind(v, now, now, w.key).run(); // void-review: ok (only open wants, at most MAX_OPEN, and only the ones whose number moved)
      const note = 'outcome met (' + (bot ? 'team:' + bot.name : 'Verse') + '): ' + w.label + ' ' + (w.private ? 'moved the right way' : w.baseline + ' -> ' + v);
      await env.DB.prepare("UPDATE void_queue SET state = 'done', note = ?, updated = ? WHERE id = ? AND state != 'building'").bind(note.slice(0, 300), new Date(now).toISOString(), w.job).run().catch(() => null); // void-review: ok (only open wants, at most MAX_OPEN, and only the ones whose number moved)
      if (w.thread) await crewWrite(env, { c: 'work', by, thread: w.thread, now, body: 'Outcome met: ' + w.label + (w.private ? ' moved the right way.' : ' went from ' + w.baseline + ' to ' + v + '.') + ' Closing this want.' + (jobs[w.job] === 'building' ? ' (The coder holding the job closes it with its pull request.)' : '') });
      out.met.push(w.key);
      continue;
    }
    await env.DB.prepare('UPDATE void_team_wants SET latest = ?, checked = ? WHERE key = ?').bind(v, now, w.key).run();
    // handed in, but the number has not moved: the job goes back on the queue (at most REOPEN_MAX times, once a day)
    const st = jobs[w.job], settle = SETTLE[w.lane] || C.SETTLE_MS;
    if ((st === 'live' || st === 'done') && now - w.filed > settle && now - (w.nag || 0) > C.REOPEN_GAP_MS) {
      const aside = (w.reopened || 0) >= C.REOPEN_MAX;
      const why = 'outcome not met yet: ' + w.label + ' is ' + (w.private ? 'unchanged' : v + ' (was ' + w.baseline + ')');
      await env.DB.prepare('UPDATE void_queue SET state = ?, note = ?, updated = ? WHERE id = ?').bind(aside ? 'set aside' : 'queued', (why + ' · reopened by Verse\'s brain').slice(0, 300), new Date(now).toISOString(), w.job).run().catch(() => null);
      await env.DB.prepare('UPDATE void_team_wants SET nag = ?, reopened = reopened + 1, state = ? WHERE key = ?').bind(now, aside ? 'set aside' : 'open', w.key).run();
      if (w.thread) await crewWrite(env, { c: 'work', by, thread: w.thread, now, body: (aside ? 'Set aside: ' : 'Back on the queue: ') + why + '. The job was handed in, but the number it is measured by did not move.' });
      out.reopened.push(w.key);
    }
  }
  await env.DB.prepare("DELETE FROM void_team_wants WHERE state = 'met' AND met_at < ?").bind(now - KEEP_MET_MS).run();
  return out;
}
async function fileWants(env, wants, bots, now) {
  const { results } = await env.DB.prepare('SELECT key, state FROM void_team_wants').all();
  const have = new Set(results.map((r) => r.key)), open = results.filter((r) => r.state === 'open').length, filed = [];
  for (const w of wants) {
    if (filed.length >= C.FILE_PER_TICK || open + filed.length >= C.MAX_OPEN) break;
    if (have.has(w.key)) continue;
    const j = C.jobOf(w), at = new Date(now).toISOString(), bot = bots.find((b) => b.lane === w.lane) || C.byLane(w.lane);
    await env.DB.prepare("INSERT INTO void_queue (id, ask, target, state, note, at, updated) VALUES (?, ?, ?, 'queued', ?, ?, ?) ON CONFLICT(id) DO UPDATE SET ask = excluded.ask, target = excluded.target, state = 'queued', note = excluded.note, updated = excluded.updated") // void-review: ok (at most FILE_PER_TICK a run)
      .bind(j.id, j.ask, j.target, 'wanted by Verse\'s brain · measured by ' + w.metric.label, at, at).run();
    const thread = await crewWrite(env, { c: 'work', by: 'verse', job: j.id, now, body: C.wantPost(w, bot) });
    await env.DB.prepare("INSERT INTO void_team_wants (key, lane, kind, title, label, metric, better, baseline, latest, cite, private, job, thread, state, filed, checked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)") // void-review: ok (at most FILE_PER_TICK a run)
      .bind(w.key, w.lane, w.kind, w.title, w.metric.label, w.metric.id, w.metric.better, w.metric.value, w.metric.value, JSON.stringify(w.cite), w.private ? 1 : 0, j.id, thread, now, now).run(); // void-review: ok (at most FILE_PER_TICK a run)
    filed.push(w.key);
  }
  return filed;
}

// ---- each member's own job: claimed, worked, closed, as a thread in #work ----
async function job(env, bot, run, title, work, now) {
  const id = 'crew-' + bot.slug + '-' + run;
  const thread = await crewWrite(env, { c: 'work', by: 'verse', job: id, now, body: '@' + bot.name + ' your next job (crew): ' + title });
  await crewWrite(env, { c: 'work', by: bot.id, thread, now, body: 'Claimed. Working it now.' });
  let res;
  try { res = await work(); } catch (e) { res = { say: 'Could not finish: ' + String((e && e.message) || e).slice(0, 160), line: 'tried ' + title.toLowerCase() + ', failed', ok: false }; }
  await crewWrite(env, { c: 'work', by: bot.id, thread, now, body: res.say + (res.ok === false ? '' : '\nDone.') });
  if (res.lane) await crewWrite(env, { c: bot.channel, by: bot.id, now, body: res.lane });
  await did(env, bot, res.line, now, res.ok !== false);
  return { bot: bot.name, ok: res.ok !== false, thread };
}

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const duties = {
  'status-watch': (env, ev) => async () => {
    const ok = ev.probe.filter((p) => p.status === 200), bad = ev.probe.filter((p) => p.status !== 200), slow = [...ok].sort((a, b) => b.ms - a.ms)[0];
    const guards = (ev.guards || []), down = guards.filter((g) => g.now === 'down');
    const say = 'Probed ' + ev.probe.length + ' pages on a-to-mind.com: ' + ok.length + ' answered 200, median ' + median(ok.map((p) => p.ms)) + ' ms' + (slow ? ', slowest ' + slow.path + ' ' + slow.ms + ' ms' : '') + '.'
      + (bad.length ? '\nFailing: ' + bad.map((p) => p.path + ' (' + (p.status || 'no answer') + ')').join(', ') + '. Filed as heal wants.' : '')
      + '\nHourly guards: ' + (guards.length ? guards.map((g) => g.name + ' ' + g.now).join(', ') : 'no record read') + '.';
    return { say, line: 'probed ' + ev.probe.length + ' pages: ' + ok.length + ' up' + (bad.length ? ', ' + bad.length + ' failing' : '') + (down.length ? ', ' + down.length + ' guard down' : ''), lane: bad.length || down.length ? say : '' };
  },
  'site-operator': (env, ev) => async () => {
    const w = ev.walk; if (!w) return { say: 'The link walk did not run.', line: 'link walk did not run', ok: false };
    const bad = w.links.filter((l) => l.status !== 200);
    const say = 'Walked ' + w.links.length + ' of the ' + w.total + ' internal links on ' + C.LINK_PAGES.join(', ') + ' (a new window each run, so every link gets walked): ' + (w.links.length - bad.length) + ' answered 200.'
      + (bad.length ? '\nBroken: ' + bad.map((l) => l.path + ' (' + (l.status || 'no answer') + ', linked from ' + l.from + ')').join(', ') + '. Filed as heal wants.' : '');
    return { say, line: 'walked ' + w.links.length + ' links, ' + bad.length + ' broken', lane: bad.length ? say : '' };
  },
  'tower-scout': (env, ev, run, now) => async () => {
    const floors = ev.tower && ev.tower.floors ? Object.entries(ev.tower.floors) : [];
    const cand = floors.map(([f, rows]) => ({ f, miss: C.towerMisses(rows), rival: C.rivalOf(f) })).filter((x) => x.miss.length && x.rival);
    if (!cand.length) return { say: 'No floor with a named rival is short right now.', line: 'no rival floor short' };
    const pick = C.rotate(cand, 1, run)[0], host = pick.rival;
    const robots = await get(env, 'https://' + host + '/robots.txt', { max: 5e5 });
    let maps = C.sitemapsIn(robots.text); if (!maps.length) maps = ['https://' + host + '/sitemap.xml'];
    const first = await get(env, maps[0], { max: 8e6 }), sm = C.readSitemap(first.text);
    let pages = sm.index ? [] : sm.locs, children = sm.index ? sm.locs.length : 0;
    if (sm.index && sm.locs[0]) { const c = await get(env, sm.locs[0], { max: 8e6 }); pages = C.readSitemap(c.text).locs; }
    const secs = C.sectionsOf(pages), est = sm.index && children ? children + ' sitemaps (the first lists ' + pages.length + ' pages)' : pages.length + ' pages';
    await setState(env, 'crawl:' + host, { at: now, maps: maps.length, children, pages: pages.length, sections: secs }, now);
    const say = 'Mapped ' + host + ' across its whole site: robots.txt ' + (robots.status || 'no answer') + ', ' + maps.length + ' sitemap' + (maps.length === 1 ? '' : 's') + ' listed, ' + (first.status === 200 ? est : 'sitemap answered ' + (first.status || 'nothing')) + '.'
      + (secs.length ? '\nIts biggest sections: ' + secs.map((x) => x.section + ' (' + x.pages + ')').join(', ') + '.' : '')
      + '\nVerse is short on the ' + pick.f + ' floor: ' + pick.miss.map((m) => m.aspect + ' (' + m.verdict + ')').join(', ') + '. Every section above is a feature to match or beat; the floor\'s want is on the board.';
    return { say, line: 'mapped ' + host + ': ' + (pages.length || 0) + ' pages, ' + pick.miss.length + ' aspects short', lane: say };
  },
  'exam-coach': (env, ev) => async () => {
    if (!ev.exam) return { say: 'The exam did not load (' + ORIGIN + '/exam/latest.json and /progress/exam.json).', line: 'exam did not load', ok: false };
    if (ev.exam.domains) {
      const d = Object.entries(ev.exam.domains).filter(([, x]) => x && typeof x.score === 'number').sort((a, b) => a[1].score - b[1].score);
      const say = 'Read the outcome exam (' + ev.examSrc + ', ' + d.length + ' domains). Lowest: ' + d.slice(0, 4).map(([k, x]) => k + ' ' + x.score).join(', ') + '. The lowest two are wants on the board; each closes only when its score rises.';
      return { say, line: 'exam: lowest ' + (d[0] ? d[0][0] + ' ' + d[0][1].score : 'none'), lane: say };
    }
    const cases = ev.exam.cases || [], bad = cases.filter((c) => !c.ok);
    const say = 'Read the outcome exam (' + ev.examSrc + '): ' + (cases.length - bad.length) + ' of ' + cases.length + ' outcomes hold' + (bad.length ? '; regressed: ' + bad.map((c) => c.ask).join('; ') : '') + '. The 19-domain scoreboard (/exam/latest.json) is not live yet, so I score these cases until it is.'
      + (ev.misses7 != null ? '\nMissed asks in the last 7 days: ' + ev.misses7 + ' different ones.' : '');
    return { say, line: 'exam: ' + (cases.length - bad.length) + '/' + cases.length + ' hold' + (ev.misses7 != null ? ', ' + ev.misses7 + ' asks missed this week' : ''), lane: '' };
  },
  'merge-train': (env) => async () => {
    const h = { accept: 'application/vnd.github+json', ...(env.GITHUB_TOKEN ? { authorization: 'Bearer ' + env.GITHUB_TOKEN } : {}) };
    const open = json((await get(env, 'https://api.github.com/repos/' + REPO + '/pulls?state=open&per_page=30', { headers: h })).text);
    const closed = json((await get(env, 'https://api.github.com/repos/' + REPO + '/pulls?state=closed&sort=updated&direction=desc&per_page=30', { headers: h })).text);
    if (!Array.isArray(open)) return { say: 'GitHub did not answer the pull request list.', line: 'GitHub did not answer', ok: false };
    const rows = await Promise.all(open.slice(0, 8).map(async (p) => {
      const cr = json((await get(env, 'https://api.github.com/repos/' + REPO + '/commits/' + p.head.sha + '/check-runs?per_page=100', { headers: h })).text);
      const runs = (cr && cr.check_runs) || [], red = runs.filter((r) => ['failure', 'timed_out', 'cancelled', 'action_required'].includes(r.conclusion)), wait = runs.filter((r) => r.status !== 'completed');
      return { n: p.number, title: String(p.title || '').slice(0, 70), red: red.map((r) => r.name).slice(0, 3), wait: wait.length, state: red.length ? 'red' : wait.length ? 'running' : 'green' };
    }));
    const day = Date.now() - 864e5, landed = (Array.isArray(closed) ? closed : []).filter((p) => p.merged_at && Date.parse(p.merged_at) > day);
    const say = 'The train: ' + open.length + ' open pull request' + (open.length === 1 ? '' : 's') + ', ' + landed.length + ' landed in the last 24 hours' + (landed.length ? ' (latest #' + landed[0].number + ' ' + String(landed[0].title || '').slice(0, 60) + ')' : '') + '.\n'
      + rows.map((r) => '#' + r.n + ' ' + r.state + (r.red.length ? ' on ' + r.red.join(', ') : r.wait ? ' (' + r.wait + ' checks running)' : ', lands on its own') + ': ' + r.title).join('\n');
    return { say, line: open.length + ' PRs open (' + rows.filter((r) => r.state === 'green').length + ' green, ' + rows.filter((r) => r.state === 'red').length + ' red), ' + landed.length + ' landed in 24h', lane: say };
  },
  'broadcast-builder': (env, ev) => async () => {
    const list = ev.ideas || [];
    if (!list.length) return { say: 'No new idea in Verse\'s TV and radio notes in the last 3 days.', line: 'no new TV or radio idea' };
    const top = [...list].sort((a, b) => (b.value_cents || 0) - (a.value_cents || 0))[0];
    const say = 'Read ' + list.length + ' ideas Verse noted on TV and radio in the last 3 days. The most valuable: "' + String(top.topic).slice(0, 80) + '" (from ' + String(top.show || top.station).slice(0, 60) + '): ' + String(top.note).slice(0, 220)
      + '\nIt is a want on the board: build it onto the page that already covers it, linked to a paid product, and it closes when the build is live.';
    return { say, line: 'picked "' + String(top.topic).slice(0, 60) + '" from ' + list.length + ' TV/radio ideas', lane: say };
  },
  'growth': (env, ev, run, now) => async () => {
    const seen = (await getState(env, 'promos')) || [], drafts = C.promosOf(ev.tower, 6).filter((p) => !seen.includes(C.hash(p.text))).slice(0, 3);
    if (!drafts.length) return { say: 'No new measured win to promote since my last drafts.', line: 'no new win to promote' };
    await setState(env, 'promos', [...seen, ...drafts.map((p) => C.hash(p.text))].slice(-200), now);
    const say = 'Drafted ' + drafts.length + ' promo' + (drafts.length === 1 ? '' : 's') + ' from measured Tower wins, for the owner to send (I never post outside):\n'
      + drafts.map((p, i) => (i + 1) + '. ' + p.text + '\n   One tap to post: ' + p.intent).join('\n');
    return { say, line: 'drafted ' + drafts.length + ' promos from Tower wins (owner sends)', lane: say };
  },
  'tech-radar': (env, ev, run, now) => async () => {
    const feeds = [['Chrome', 'https://developer.chrome.com/static/blog/feed.xml'], ['WebKit', 'https://webkit.org/feed/']];
    const got = await Promise.all(feeds.map(async ([n, u]) => ({ n, items: C.feedItems((await get(env, u, { max: 2e6 })).text, 8) })));
    const seen = (await getState(env, 'radar')) || [], fresh = [];
    for (const g of got) for (const it of g.items) if (!seen.includes(C.hash(it.url)) && fresh.length < 5) fresh.push({ ...it, n: g.n, fit: C.fitOf(it.title) });
    const read = got.reduce((a, g) => a + g.items.length, 0);
    if (!read) return { say: 'The release feeds did not answer.', line: 'feeds did not answer', ok: false };
    await setState(env, 'radar', [...seen, ...fresh.map((f) => C.hash(f.url))].slice(-300), now);
    if (!fresh.length) return { say: 'Read ' + read + ' release notes (Chrome, WebKit): nothing new since my last pass.', line: 'read ' + read + ' release notes, nothing new' };
    const say = 'New in the browsers (' + fresh.length + ' of ' + read + ' read):\n' + fresh.map((f) => '- ' + f.n + ': ' + f.title + ' ' + f.url + (f.fit ? '\n  Fits: ' + f.fit : '')).join('\n');
    return { say, line: 'posted ' + fresh.length + ' new browser features for Verse', lane: say };
  },
};
const TITLES = { 'status-watch': 'probe the key pages and the hourly guards', 'site-operator': 'walk the next window of internal links', 'tower-scout': 'map a rival\'s whole site for a short floor',
  'exam-coach': 'read the outcome exam and file the weakest domain', 'merge-train': 'report the pull-request train', 'broadcast-builder': 'pick the TV and radio idea worth building',
  'growth': 'draft promos from measured wins', 'tech-radar': 'read the browser release notes' };

/** one run of the crew. -> { at, crew, filed, met, reopened, jobs, ms } */
export async function crewTick(env, now = Date.now()) {
  if (!env || !env.DB) return { ok: false, say: 'no database bound' };
  const t0 = Date.now();
  await crewReady(env, now);
  for (const t of TABLES) await env.DB.prepare(t).run();
  const bots = await seat(env, now), run = ((await getState(env, 'run')) || 0) + 1;
  await setState(env, 'run', run, now);
  const next = (await getState(env, 'next')) || {}, due = bots.filter((b) => !(next[b.slug] > now));
  const isDue = (slug) => due.some((b) => b.slug === slug);
  // the evidence, read together
  const { results: openPages } = await env.DB.prepare("SELECT metric FROM void_team_wants WHERE state = 'open' AND (metric LIKE 'page:%' OR metric LIKE 'link:%')").all();
  const extra = openPages.map((r) => r.metric.replace(/^(page|link):/, '')).filter((p) => p.startsWith('/'));
  const [ex, tw, st, pr, walk, misses7, sales30, idl] = await Promise.all([
    readExam(env), get(env, ORIGIN + '/tower.evidence.json', { max: 8e6, ms: 12000 }), readStatus(env, now).catch(() => null),
    probe(env, [...C.KEY_PAGES, ...extra]), isDue('site-operator') ? linkWalk(env, run) : null,
    count(env, 'SELECT COUNT(*) AS n FROM void_misses WHERE last >= ?', new Date(now - 7 * 864e5).toISOString()),
    count(env, 'SELECT COUNT(*) AS n FROM void_sales WHERE verified = 1 AND at >= ?', new Date(now - 30 * 864e5).toISOString()),
    ideas(env, now),
  ]);
  const ev = { at: new Date(now).toISOString(), exam: ex.exam, examSrc: ex.src, tower: tw.status === 200 ? json(tw.text) : null, guards: st && st.guards ? st.guards : [], probe: pr,
    links: walk ? walk.links : [], walk, misses7, sales30, ideas: idl };
  // Verse's brain: measure, close, file
  const m = await measureOpen(env, ev, bots, now);
  const filed = await fileWants(env, C.wantsOf(ev), bots, now);
  // each due member's own job
  // the turn is taken before the work, so a run cut short does not repeat a job; the members work side by side
  for (const b of due) next[b.slug] = now + b.every * 60e3 - 60e3; // a minute early, so the 15-minute clock does not slip a turn
  await setState(env, 'next', next, now);
  const jobs = await Promise.all(due.filter((b) => duties[b.slug]).map((b) => job(env, b, run, TITLES[b.slug], duties[b.slug](env, ev, run, now), now)));
  const prio = await prioritizeRun(env, ev, now, { force: !!(await getState(env, 'override-new')) }).catch(() => null);
  await env.DB.prepare("DELETE FROM void_team_crew WHERE k = 'override-new'").run().catch(() => null);
  const out = { at: ev.at, run, crew: bots.map((b) => b.name), filed, met: m.met, reopened: m.reopened, jobs, priorities: prio, ms: Date.now() - t0 };
  await setState(env, 'last', out, now);
  return out;
}

// ---- Priorities (lib/team-priorities.js): Verse ranks its own queue; daily, each Monday, and whenever the evidence moves ----
const dayKey = (now) => new Date(now).toISOString().slice(0, 10);
export async function prioritizeRun(env, ev, now, { force = false } = {}) {
  let jobs = [], wants = [];
  try { jobs = ((await env.DB.prepare("SELECT id, ask, target, state, note, at FROM void_queue WHERE state IN ('queued', 'building') ORDER BY at ASC LIMIT 400").all()).results || []).filter((j) => TEAM_KINDS.includes(kindOf(j.target))); } catch (_) { jobs = []; }
  try { wants = (await env.DB.prepare("SELECT * FROM void_team_wants WHERE state = 'open'").all()).results || []; } catch (_) { wants = []; }
  const override = await getState(env, 'override'), last = await getState(env, 'priorities');
  const p = P.prioritize(jobs, wants, ev, override, now), week = 'the week of ' + C.weekOf(new Date(now).toISOString()), monday = new Date(now).getUTCDay() === 1;
  const why = !last ? 'first ranking' : force ? 'the owner overrode' : monday && last.week !== week ? 'Monday: the new week\'s bets' : last.day !== dayKey(now) ? 'the daily ranking' : last.sig !== p.sig ? 'the evidence moved' : '';
  if (!why) return { changed: false, bets: last.bets.map((b) => b.id) };
  const betsMoved = !last || last.bets.map((b) => b.id).join(' ') !== p.bets.map((b) => b.id).join(' ');
  let brief = last ? last.brief : null;
  if (betsMoved || (monday && last && last.week !== week) || force) brief = await crewWrite(env, { c: 'work', by: 'verse', body: P.briefText(p, week, why), now }); // the pinned brief: posted again only when the bets change
  const lanes = Object.fromEntries(p.ranked.map((r) => [r.id, r.lane]));
  await setState(env, 'priorities', { at: now, day: dayKey(now), week, why, sig: p.sig, order: p.order.slice(0, 300), lanes, bets: p.bets, ranked: p.ranked.slice(0, 15), brief, wip: P.WIP }, now);
  return { changed: true, why, bets: p.bets.map((b) => b.id), brief };
}

/** the public read (GET /api/crew): the crew, what each last did, and Verse's wants */
export async function crewView(env, now = Date.now()) {
  if (!env || !env.DB) return { ok: false, say: 'no database bound' };
  let wants = [], crew = [], last = null;
  try { wants = (await env.DB.prepare("SELECT * FROM void_team_wants ORDER BY CASE state WHEN 'open' THEN 0 WHEN 'met' THEN 1 ELSE 2 END, filed DESC LIMIT 60").all()).results || []; } catch (_) { wants = []; }
  const turnMap = (await getState(env, 'next').catch(() => null)) || {}, turns = Object.fromEntries(C.CREW.filter((b) => typeof turnMap[b.slug] === 'number').map((b) => [b.id, turnMap[b.slug]]));
  try {
    const ids = C.CREW.map((b) => b.id);
    crew = ((await env.DB.prepare(`SELECT id, name, about, seen, did, did_at, done, off FROM void_team_agents WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all()).results || []) // void-review: ok (placeholders only)
      .filter((a) => !a.off).map((a) => ({ name: a.name, about: a.about, here: now - (a.seen || 0) < C.CREW_AWAY_MS, did: a.did || '', didAt: a.did_at || null, done: a.done || 0, next: turns[a.id] || null }));
  } catch (_) { crew = []; }
  try { const r = await env.DB.prepare("SELECT v FROM void_team_crew WHERE k = 'last'").first(); last = r ? json(r.v) : null; } catch (_) { last = null; }
  const pub = wants.map(C.publicWant);
  let pr = null; try { const r = await env.DB.prepare("SELECT v FROM void_team_crew WHERE k = 'priorities'").first(); pr = r ? json(r.v) : null; } catch (_) { pr = null; }
  let ov = null; try { const r = await env.DB.prepare("SELECT v FROM void_team_crew WHERE k = 'override'").first(); ov = r ? json(r.v) : null; } catch (_) { ov = null; }
  const priv = new Set(wants.filter((w) => w.private).map((w) => w.job)), show = (b) => ({ id: b.id, ask: priv.has(b.id) ? 'a private want (owner only)' : b.ask, lane: b.lane, kind: b.kind, state: b.state, score: b.score, impact: b.impact, effort: b.effort, confidence: b.confidence, drivers: priv.has(b.id) ? ['kept private'] : b.drivers, evidence: priv.has(b.id) ? [] : b.evidence, override: b.override || null });
  const priorities = pr ? { at: pr.at, week: pr.week, why: pr.why, brief: pr.brief, wip: pr.wip, bets: pr.bets.map(show), next: pr.ranked.filter((r) => !pr.bets.some((b) => b.id === r.id)).slice(0, 8).map(show), override: ov && now - (ov.at || 0) < P.OVERRIDE_MS ? { pin: ov.pin, drop: ov.drop, at: ov.at } : null } : null;
  return { ok: true, at: new Date(now).toISOString(), crew, priorities, wants: pub, open: pub.filter((w) => w.state === 'open').length, met: pub.filter((w) => w.state === 'met').length,
    lastRun: last ? { at: last.at, run: last.run, filed: (last.filed || []).length, met: (last.met || []).length, jobs: (last.jobs || []).length } : null };
}
