// Where the free model fell short (Atom, 2026-09-28): until Void has earned money, it stays on free models and writes down each
// time it would have used a stronger one. That is the evidence the will weighs when the budget can pay for an upgrade; any
// real spend still needs a yes on the confirm line. One row per day, place and reason, counted up. No ask text is kept.
// place: 'answer' | 'fix' | 'review' | 'will'.  reason: 'free limit' (daily free allocation used up) | 'busy' | 'empty' | 'error'.
const CREATE = 'CREATE TABLE IF NOT EXISTS void_shortfalls (day TEXT NOT NULL, place TEXT NOT NULL, reason TEXT NOT NULL, n INTEGER NOT NULL, last TEXT NOT NULL, PRIMARY KEY (day, place, reason))';
const BUMP = 'INSERT INTO void_shortfalls (day, place, reason, n, last) VALUES (?, ?, ?, 1, ?) ON CONFLICT(day, place, reason) DO UPDATE SET n = n + 1, last = excluded.last';
const READ = 'SELECT place, reason, SUM(n) AS n FROM void_shortfalls WHERE day >= ? GROUP BY place, reason';

export function reasonOf(err) {
  const m = String((err && (err.message || err)) || '');
  if (/\b4006\b|daily free|free allocation|neurons?|quota|exceeded/i.test(m)) return 'free limit';
  if (/\b429\b|capacity|overloaded|busy|too many|time(d)? ?out/i.test(m)) return 'busy';
  return 'error';
}

export async function recordShortfall(env, place, reason) {
  if (!env || !env.DB) return;
  const at = new Date().toISOString();
  const bump = () => env.DB.prepare(BUMP).bind(at.slice(0, 10), String(place).slice(0, 20), String(reason).slice(0, 20), at).run();
  try { await bump(); } catch (e) {
    if (!/no such table/i.test(String(e && e.message))) return;
    try { await env.DB.prepare(CREATE).run(); await bump(); } catch (_) {}
  }
}

// { total, by: [{ place, reason, n }] } for the last `days` days (today included); empty when nothing was recorded.
export async function readShortfalls(env, days = 7) {
  const since = new Date(Date.now() - (days - 1) * 864e5).toISOString().slice(0, 10);
  try {
    const r = await env.DB.prepare(READ).bind(since).all();
    const by = ((r && r.results) || []).map((x) => ({ place: x.place, reason: x.reason, n: +x.n || 0 })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
    return { total: by.reduce((s, x) => s + x.n, 0), by };
  } catch (_) { return { total: 0, by: [] }; }
}

export function shortfallLine(s, days = 7) {
  return 'the free model fell short ' + s.total + ' time' + (s.total === 1 ? '' : 's') + ' in ' + days + ' days (' + s.by.map((x) => x.n + ' ' + x.place + ' ' + x.reason).join(', ') + ')';
}
