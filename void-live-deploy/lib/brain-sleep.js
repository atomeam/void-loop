// Sleep (docs/brain.md item 6; complementary learning systems: fast memories by day, consolidated offline). Once a night Verse turns the
// last day's real events into one note: what it asked and answered (counts), which wants were met, reopened or set aside, what it said and
// thought, what it learned, and tomorrow's focus (the top bet, or the weakest exam area). It merges duplicate lessons and drops lessons older
// than LESSON_DAYS past the newest LESSON_MIN. The note is kept in void_kv 'sleep' (the last one) and 'sleep-log' (the last LOG_KEEP).
// GET /api/brain sleeps when the last note is older than SLEEP_GAP_MS (a compare-and-set claim, so one viewer sleeps it for everyone), and
// the hourly will run (POST /api/will) wakes the same check, so it happens every night even with no viewer. No model: every number is a count.
import { mergeLessons } from './brain-lessons.js';
export const KEY = 'sleep', LOG = 'sleep-log', LOG_KEEP = 30, SLEEP_GAP_MS = 20 * 36e5, LESSON_DAYS = 30, LESSON_MIN = 60;
const day = 864e5;
const ms = (t) => { const d = typeof t === 'number' ? t : Date.parse(t); return Number.isFinite(d) ? d : 0; };
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

/** is it time to sleep? last: the kept note or null */
export const due = (last, now) => !last || now - ms(last.at) >= SLEEP_GAP_MS;

/** the lessons after consolidation: duplicates merged, the old tail dropped past the newest LESSON_MIN */
export function consolidate(lessons, now) {
  const merged = mergeLessons([], Array.isArray(lessons) ? lessons : []);
  const keep = merged.filter((l, i) => i < LESSON_MIN || now - ms(l.at) < LESSON_DAYS * day);
  return { lessons: keep, merged: (Array.isArray(lessons) ? lessons.length : 0) - merged.length, dropped: merged.length - keep.length };
}

/** one night's note from the last day. S: { now, crew, routes, voice, unbidden, lessons, exam } (what functions/api/brain.js read) */
export function sleepNote(S) {
  const now = S.now, since = now - day, recent = (t) => ms(t) >= since;
  const wants = S.crew && Array.isArray(S.crew.wants) ? S.crew.wants : [];
  const met = wants.filter((w) => w.state === 'met' && recent(w.met)), aside = wants.filter((w) => w.state === 'set aside');
  const lessons = (S.lessons || []).filter((l) => recent(l.at)), voice = (S.voice || []).filter((v) => recent(v.at)), said = (S.unbidden || []).filter((l) => recent(l.at));
  const reopened = lessons.filter((l) => l.kind === 'reopened').length;
  const r = S.routes, bets = S.crew && S.crew.priorities && Array.isArray(S.crew.priorities.bets) ? S.crew.priorities.bets : [];
  const doms = S.exam && S.exam.domains ? Object.entries(S.exam.domains).filter(([, v]) => v && Number.isFinite(Number(v.score))).sort((a, b) => a[1].score - b[1].score) : [];
  const focus = bets[0] ? 'Bet 1: ' + bets[0].title : doms[0] ? 'Raise the ' + doms[0][0] + ' exam area from ' + doms[0][1].score : 'Choose fresh wants: nothing is ranked yet';
  const parts = [
    r ? plural(r.today, 'ask') + ' routed (' + (r.close || 0) + ' close calls)' : null,
    plural(met.length, 'want') + ' met', plural(reopened, 'want') + ' reopened', plural(aside.length, 'want') + ' set aside in all',
    plural(voice.length, 'reflection'), plural(said.length, 'line') + ' said on its own', plural(lessons.length, 'new lesson'),
  ].filter(Boolean);
  return {
    at: new Date(now).toISOString(), summary: 'In the last day: ' + parts.join(', ') + '.', focus,
    met: met.slice(0, 5).map((w) => w.title), learned: lessons.slice(0, 5).map((l) => l.text || l.retain),
    counts: { asks: r ? r.today : null, close: r ? r.close || 0 : null, met: met.length, reopened, aside: aside.length, reflections: voice.length, said: said.length, lessons: lessons.length },
  };
}

const UPSERT = 'INSERT INTO void_kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v';
/** sleep if due: claim the night with a compare-and-set on the last note's time, then keep the log and the consolidated lessons in one
 *  batch. Returns the new note, or null (not due, someone else slept, or no DB). S as for sleepNote, plus last (the kept note) and log. */
export async function sleepIfDue(env, S) {
  if (!env.DB || !due(S.last, S.now)) return null;
  const note = sleepNote(S), c = consolidate(S.lessons, S.now);
  note.consolidated = { merged: c.merged, dropped: c.dropped, kept: c.lessons.length };
  const claim = await env.DB.prepare("INSERT INTO void_kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v WHERE json_extract(void_kv.v, '$.at') IS ?")
    .bind(KEY, JSON.stringify(note), S.last ? S.last.at : null).run();
  if (!claim.meta || claim.meta.changes !== 1) return null; // another viewer slept this night
  const log = [note, ...(Array.isArray(S.log) ? S.log : [])].slice(0, LOG_KEEP);
  await env.DB.batch([env.DB.prepare(UPSERT).bind(LOG, JSON.stringify(log)), env.DB.prepare(UPSERT).bind('lessons', JSON.stringify(c.lessons))]);
  return note;
}
