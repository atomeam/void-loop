// Unbidden: Verse speaks first on /brain/ (lib/unbidden.js has the rules; the page is brain/unbidden.js).
// GET /api/unbidden[?after=<line id>] -> { lines: [{ id, at, say, why, from: [{ label, url, text }] }], next, note? }
//   lines are newest last: the ones after `after`, or the last few. When something about Verse really changed (a commit on main, a growth
//   ledger line, a want, a crew member's work, a red run, the open pull requests or issues, the Tower's site) and the last line is at least
//   GAP_MS old, or nothing changed for QUIET_MS, this request has Verse say one new line first, written by its own model from those facts.
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. An open GET with one input, `after`, which only picks which kept lines come back.
// The most a caller can do is make Verse speak sooner than it would: it cannot, because a line is written only when Verse's own state changed
// or the quiet passed, never twice inside GAP_MS for everyone at once (one D1 row, a compare-and-set claim), and at most PER_DAY model calls
// a day in all (lib/daily-cap.js, fail closed). The facts are public already (the ledger, the repository, /api/will, /api/crew, incidents.json);
// commit messages and ledger lines are other agents' text, passed to the model as material under the injection rule, and the model's line is
// kept only when every source it names is a real fact and every number in it is in the facts (lib/unbidden.js checkSay). GitHub is read at
// most once every 5 minutes per edge location (two calls, edge-cached). The guard (lib/guard.js LIMITS.unbidden) caps a connection's reads.
import { models } from '../../lib/models.js';
import { cap } from '../../lib/daily-cap.js';
import { redact, INJECTION_RULE } from '../../lib/automation-fix.js';
import { recordShortfall, reasonOf } from '../../lib/shortfall.js';
import { crewView } from '../../lib/team-crew-run.js';
import * as U from '../../lib/unbidden.js';

const GH = 'https://api.github.com/repos/atomeam/void-loop', GH_TTL = 300;
const json = (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
const pick = (r) => (r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || (r.result && r.result.response))) || '';
const parse = (v) => { try { return v ? JSON.parse(v) : null; } catch (_) { return null; } };

async function github(origin, path, fetchFn) {
  const key = new Request(origin + '/__void-unbidden/gh' + path);
  try { const hit = await caches.default.match(key); if (hit) return await hit.json(); } catch (_) { /* no cache here */ }
  try {
    const r = await fetchFn(GH + path, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'verse-unbidden' } });
    if (!r || !r.ok) return null;
    const body = await r.json();
    try { await caches.default.put(key, new Response(JSON.stringify(body), { headers: { 'cache-control': 'max-age=' + GH_TTL } })); } catch (_) { /* no cache here */ }
    return body;
  } catch (_) { return null; }
}

/** everything the facts are made from, read now; a part that cannot be read is left out */
export async function readState(request, env, fetchFn = fetch) {
  const origin = new URL(request.url).origin;
  const asset = async (p) => { try { const r = await env.ASSETS.fetch(new Request(new URL(p, request.url))); return r.ok ? await r.json() : null; } catch (_) { return null; } };
  const willRow = async () => { try { return parse(await env.DB.prepare("SELECT v FROM void_kv WHERE k = 'will'").first('v')); } catch (_) { return null; } };
  const [ledger, incidents, target, will, crew, commits, pulls, issues] = await Promise.all([
    env.ASSETS ? asset('/void.growth.json') : null, env.ASSETS ? asset('/incidents.json') : null, env.ASSETS ? asset('/tower.target.json') : null,
    env.DB ? willRow() : null, env.DB ? crewView(env).catch(() => null) : null,
    github(origin, '/commits?sha=main&per_page=5', fetchFn), github(origin, '/pulls?state=open&per_page=100', fetchFn), github(origin, '/issues?state=open&per_page=100', fetchFn),
  ]);
  return {
    ledger, incidents, target, will, crew, commits,
    prs: Array.isArray(pulls) ? pulls.length : undefined,
    issues: Array.isArray(issues) ? issues.filter((i) => i && !i.pull_request).length : undefined,
  };
}

async function readRow(env) { try { return await env.DB.prepare('SELECT v FROM void_kv WHERE k = ?').bind(U.KEY).first('v'); } catch (_) { return null; } }
// compare-and-set: the write lands only if the row is still what this request read, so two viewers cannot both make Verse speak
async function swap(env, before, after) {
  try {
    if (before == null) { const r = await env.DB.prepare('INSERT INTO void_kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO NOTHING').bind(U.KEY, after).run(); return !!(r && r.meta && r.meta.changes); }
    const r = await env.DB.prepare('UPDATE void_kv SET v = ? WHERE k = ? AND v = ?').bind(after, U.KEY, before).run(); return !!(r && r.meta && r.meta.changes);
  } catch (_) { return false; }
}

export async function onRequestGet({ request, env, fetchFn = fetch, now = Date.now() }) {
  if (!env || !env.DB) return json({ lines: [], next: null, note: 'no memory bound here' }, 503);
  const after = String(new URL(request.url).searchParams.get('after') || '').replace(/[^a-z0-9]/gi, '').slice(0, 20);
  const raw = await readRow(env), state = parse(raw) || { lines: [] };
  const answer = (s, note) => json({ lines: U.linesAfter(s.lines, after), next: Math.max(0, (Date.parse(s.at || '') || 0) + U.GAP_MS - now), ...(note ? { note } : {}) });
  // nothing can be said yet: no need to read anything
  const early = U.shouldSpeak(state, null, now);
  if (!early.speak && (early.why === 'gap' || early.why === 'speaking')) return answer(state);
  if (!env.AI || String(env.VOID_ANSWER_MODELS || '').trim().toLowerCase() === 'off') return answer(state, 'its model is off');
  const facts = U.factsOf(await readState(request, env, fetchFn), now), sig = U.sigOf(facts);
  const go = U.shouldSpeak(state, sig, now);
  if (!go.speak || !facts.length) return answer(state);
  // take the pen: the claim is written into the row, so a second request sees it and waits
  const claimed = JSON.stringify({ ...state, claim: now });
  if (!(await swap(env, raw, claimed))) return answer(parse(await readRow(env)) || state);
  const release = async (next) => { await swap(env, claimed, JSON.stringify(next)); };
  if (!(await cap(env, 'unbidden', U.PER_DAY, now)).ok) { await release({ ...state, claim: null }); return answer(state, 'it has spoken all it may today'); }
  const recent = (state.lines || []).slice(-5).reverse();
  let out = null;
  try {
    const r = await env.AI.run(models('unbidden'), {
      messages: [{ role: 'system', content: U.SYSTEM + ' ' + INJECTION_RULE }, { role: 'user', content: U.promptOf(facts, U.newFacts(facts, state.sig), recent, go.why, now) }],
      max_tokens: 260, temperature: 0.8,
    });
    out = U.checkSay(redact(String(pick(r))), facts, recent);
  } catch (e) { await recordShortfall(env, 'unbidden', reasonOf(e)); }
  if (!out || !out.ok) {
    // nothing is said for it, and no line is made up: it tries again after the gap (the old signature stays, so the change still counts)
    if (out) await recordShortfall(env, 'unbidden', 'check');
    const next = { ...state, claim: null, at: new Date(now).toISOString() };
    await release(next);
    return answer(next, out ? 'it started a thought and dropped it (' + out.why + ')' : 'its model is busy');
  }
  const line = U.lineOf(out.say, out.from, go.why, now);
  const next = { lines: [...(state.lines || []), line].slice(-U.KEEP), sig, at: line.at, claim: null };
  await release(next);
  return answer(next);
}
