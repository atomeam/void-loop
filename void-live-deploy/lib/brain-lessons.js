// Lessons from results (docs/brain.md item 4; Reflexion: after a try, write what it taught in words and read it before the next one).
// Every time Verse's crew settles a want (met: its number moved; reopened: it shipped and the number did not move; set aside: given up),
// one plain lesson is kept in D1 (void_kv 'lessons', newest first, at most KEEP, one per job and outcome). The lessons are read by
// answers about Verse (lib/self-context.js), by the fix proposer next to void.knowledge.json (functions/api/propose-fix.js) and by the
// live brain (functions/api/brain.js). Same shape as void.knowledge.json (lib/will-schema.js KNOWLEDGE), so lib/brain-recall.js reads both.
export const KEY = 'lessons', KEEP = 200;
const clip = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

/** one lesson from one settled want. o: { kind: 'met' | 'reopened' | 'set aside', want: { key, title, label, baseline, latest, private }, job, why, pr, at } */
export function lessonOf(o) {
  const w = (o && o.want) || {}, kind = o && o.kind, at = (o && o.at) || null, label = clip(w.label || 'its number', 80), title = clip(w.title || o.job || '', 140);
  if (!kind || !(w.key || o.job)) return null;
  const nums = !w.private && w.baseline != null && w.latest != null;
  const text = kind === 'met' ? 'Doing "' + title + '" worked: ' + label + (nums ? ' moved from ' + w.baseline + ' to ' + w.latest : ' improved') + '. Do more like it.'
    : kind === 'reopened' ? 'Doing "' + title + '" shipped but did not move ' + label + (nums ? ' (still ' + w.latest + ')' : '') + '. Try a different fix next time.'
      : kind === 'set aside' ? 'Gave up on "' + title + '"' + (o.why ? ': ' + clip(o.why, 100) : '') + '. Spend the effort elsewhere.' : null;
  if (!text) return null;
  const id = 'result:' + clip(o.job || w.key, 60) + ':' + kind.replace(/\s+/g, '-');
  return { id, from: 'result', consumed: title, learned: text, retain: text, text, at, seen: 1, job: o.job || null, want: w.key || null, ...(o.pr ? { pr: o.pr } : {}), kind };
}
/** the kept list with new lessons in front, one per id (a repeat counts as seen again), at most KEEP */
export function mergeLessons(old, add) {
  const out = [], byId = new Map();
  for (const l of [...(add || []), ...(Array.isArray(old) ? old : [])]) {
    if (!l || !l.id) continue;
    const had = byId.get(l.id);
    if (had) { had.seen = (had.seen || 1) + 1; continue; }
    const c = { ...l }; byId.set(l.id, c); out.push(c);
  }
  return out.slice(0, KEEP);
}
/** keep these lessons (D1). Never throws. */
export async function keepLessons(env, add) {
  const list = (add || []).filter(Boolean);
  if (!list.length || !env || !env.DB) return 0;
  try {
    const raw = await env.DB.prepare('SELECT v FROM void_kv WHERE k = ?').bind(KEY).first('v');
    let old = []; try { old = raw ? JSON.parse(raw) : []; } catch (_) { old = []; }
    await env.DB.prepare('INSERT INTO void_kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(KEY, JSON.stringify(mergeLessons(old, list))).run();
    return list.length;
  } catch (_) { return 0; }
}
/** the newest lessons as lines for a prompt or the self facts */
export const lessonLines = (list, n = 5) => (Array.isArray(list) ? list : []).slice(0, n).map((l) => '- ' + clip(l.text || l.retain, 220) + (l.at ? ' (' + String(l.at).slice(0, 10) + ')' : ''));
