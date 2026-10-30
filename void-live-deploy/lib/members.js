// Paid Verse members add to Verse (owner, 2026-10-29: "non member visitors can use everything and look around but paid members should be
// brought in to be able to work on and improve verse but still not be able to take anything away only add positive improvements";
// "paid verse is live already 49 a month gumroad just needs the extra abilities added to it"). Shared by /api/members and /members/.
// A member writes an idea in plain words; it is checked here (length, links, keys, spam, and that it adds rather than takes away),
// counted against a daily and monthly limit, and queued on the build queue as a member:<id> job. The conductor hands it to Verse's own
// coder (tools/verse-job.mjs, one lap of tools/verse-loop.mjs), whose lap refuses any change that removes a file, a registry entry, a
// test or a score (tools/add-only.mjs). Visitors keep everything free; nothing here is ever needed to use Verse.
import { redact } from './automation-fix.js';

// Off until the owner says go: the API answers 'opens soon' and the page shows the perks without the form. One line flips it.
export const LIVE = false;
export const DAILY = 3; // ideas a member may send a day
export const MONTHLY = 30; // and a month
export const MIN_CHARS = 20, MAX_CHARS = 1200, MAX_LINKS = 2;
export const BUY = 'https://moonbeam846.gumroad.com/l/yinmj'; // the paid Verse membership (lib/gumroad.js UNLOCKS)

// What paid Verse gives, in the order the page lists it. The member lab's rows (lab: true) are always listed, so the page says members
// help build Verse (owner, 2026-10-30: "also needs to mention the build feature that allows members to help build features to verse");
// until LIVE they say they open soon.
export const PERKS = Object.freeze([
  { id: 'build', title: 'Help build Verse', text: 'Send an idea for a feature and Verse\'s own agents build it into the site. Changes only ever add.', lab: true },
  { id: 'credit', title: 'Your name on what you add', text: 'Every idea of yours that ships is listed under Built by members, with your published Verse name if you have one.', lab: true },
  { id: 'publish', title: 'Publish your Verse', text: 'Your own page at a-to-mind.com/@name with your look and your cards.' },
  { id: 'follow', title: 'Your Verse follows you', text: 'Sign in with a passkey and your stage, memory and kept cards sync to every device.' },
  { id: 'watch', title: 'Watches', text: 'Ask Verse to keep an eye on something and tell you when it changes.' },
  { id: 'review', title: 'Code Review Pro', text: 'A Verse key for the AI closer read on your pull requests, with a daily allowance.' },
  { id: 'films', title: 'Review Verse\'s films', text: 'Rate each new Verse film on the films page and leave a note. The owner reads every one.' },
  { id: 'mark', title: 'The MultiVerse mark', text: 'Your stage and your published page show the MultiVerse mark in the corner. It opens this page.' },
]);
export const perks = (live = LIVE) => PERKS.map(({ id, title, text, lab }) => ({ id, title, text: lab && !live ? text + ' Opens soon.' : text }));

// An idea that asks to take something away is refused before it is queued (the lap's add-only check is the second, binding wall).
const SUBTRACT = /\b(?:remove|removing|delete|deleting|take (?:away|down|out|off)|get rid of|disable|turn off|switch off|shut (?:down|off)|hide|wipe|erase|strip out|rip out|drop (?:the|a|all|every)|kill (?:the|a|all|every)|ban|block (?:all|every|users?|visitors?)|lock (?:out|visitors?)|paywall|charge (?:visitors?|for)|make (?:\w+ ){0,3}paid|members?[- ]only|for members only|revert|roll back|undo|downgrade|lower (?:the )?(?:score|limit))\b/i;
// gambling, crypto and adult asks are never built (the same refusals as the Versus ranking, #1470), nor anything aimed at people
const OFF_LIMITS = /\b(?:casino|gambl\w*|betting|sportsbook|slots? machine|crypto\w*|bitcoin|ethereum|nft|token sale|forex|porn\w*|nsfw|xxx|escort|viagra|cialis|backlinks?|seo services?|buy followers|dox\w*|stalk\w*|track (?:my|a|an) (?:ex|girlfriend|boyfriend|wife|husband|partner))\b/i;
const KEYISH = /\b(?:sk-[A-Za-z0-9_-]{16,}|sk_live_[A-Za-z0-9]{10,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{12,}|AIza[0-9A-Za-z_-]{30,}|xox[abp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
const LINK = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;

/** Check one idea. -> { ok: true, text } (cleaned, redacted) or { ok: false, why } (a sentence for the member). Pure. */
export function checkIdea(raw) {
  const text = String(raw == null ? '' : raw).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (text.length < MIN_CHARS) return { ok: false, why: 'Say a little more: what should Verse add, and where?' };
  if (text.length > MAX_CHARS) return { ok: false, why: 'Keep it under ' + MAX_CHARS + ' characters; one idea at a time builds best.' };
  if (KEYISH.test(text)) return { ok: false, why: 'That looks like a key or password. Never send one here; take it out and try again.' };
  if ((text.match(LINK) || []).length > MAX_LINKS) return { ok: false, why: 'Two links at most: name the site and say what you want from it.' };
  if (OFF_LIMITS.test(text)) return { ok: false, why: 'Verse does not build that kind of thing.' };
  if (SUBTRACT.test(text)) return { ok: false, why: 'Members add to Verse; nothing is ever taken away. Say what you would add instead.' };
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length < 12) return { ok: false, why: 'Write it in words, please.' };
  if (letters.length >= 30 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7) return { ok: false, why: 'No need to shout; plain words work best.' };
  if (/(.)\1{7,}/.test(text) || /\b(\w{2,})(?:\W+\1\b){5,}/i.test(text)) return { ok: false, why: 'That reads like spam. Say it once, in plain words.' };
  return { ok: true, text: redact(text) };
}

// One row per idea. The queue job (void_queue, target member:<id>) carries the work; this row carries who sent it, for the limits,
// the member's own list and the credit. user_id is the passkey account id, never shown publicly; credit is the published @name or nothing.
export const IDEA_TABLE = 'CREATE TABLE IF NOT EXISTS void_member_ideas (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, text TEXT NOT NULL, at TEXT NOT NULL, job TEXT)';
const made = new WeakMap();
export function ensureIdeas(env) {
  let p = made.get(env.DB);
  if (!p) { p = env.DB.prepare(IDEA_TABLE).run().then(() => env.DB.prepare('CREATE INDEX IF NOT EXISTS void_member_ideas_user ON void_member_ideas (user_id, at)').run()).catch((e) => { made.delete(env.DB); throw e; }); made.set(env.DB, p); }
  return p;
}

/** How many ideas the member sent today and this month (UTC). -> { day, month, left } */
export async function usage(env, userId, now = Date.now()) {
  const d = new Date(now).toISOString(), day = d.slice(0, 10), month = d.slice(0, 7);
  const row = await env.DB.prepare('SELECT SUM(CASE WHEN substr(at, 1, 10) = ? THEN 1 ELSE 0 END) AS day, COUNT(*) AS month FROM void_member_ideas WHERE user_id = ? AND substr(at, 1, 7) = ?').bind(day, userId, month).first();
  const used = { day: Number(row && row.day) || 0, month: Number(row && row.month) || 0 };
  return { ...used, left: Math.max(0, Math.min(DAILY - used.day, MONTHLY - used.month)) };
}

/** The job's words for Verse's coder: the member's idea, quoted as data, with the add-only rule. Pure. */
export const jobAsk = (text) => 'A paid member asked Verse to add this (their words, quoted; build what it asks only where it adds to Verse): "' + String(text).replace(/\s+/g, ' ').slice(0, MAX_CHARS) + '"';

/** Queue one checked idea. -> { id, job }, or null when the member is at a limit. The limit is checked inside the insert itself,
 * and the queue row is written only when the idea row was, in one batch (one transaction), so two sends at the same moment
 * cannot both pass a count read before either was written. */
export async function queueIdea(env, userId, text, now = Date.now()) {
  const at = new Date(now).toISOString(), id = 'm' + now.toString(36) + Math.random().toString(36).slice(2, 6), job = now.toString(36) + 'm';
  const r = await env.DB.batch([
    env.DB.prepare('INSERT INTO void_member_ideas (id, user_id, text, at, job) SELECT ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM void_member_ideas WHERE user_id = ? AND substr(at, 1, 10) = ?) < ? AND (SELECT COUNT(*) FROM void_member_ideas WHERE user_id = ? AND substr(at, 1, 7) = ?) < ?')
      .bind(id, userId, text, at, job, userId, at.slice(0, 10), DAILY, userId, at.slice(0, 7), MONTHLY),
    env.DB.prepare('INSERT INTO void_queue (id, ask, target, state, note, at, updated) SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM void_member_ideas WHERE id = ?)')
      .bind(job, jobAsk(text), 'member:' + id, 'queued', 'from a paid member', at, at, id),
  ]);
  return r && r[0] && r[0].meta && r[0].meta.changes ? { id, job } : null;
}

/** A queue state in a member's words. Pure. */
export function stateText(state, note) {
  const pr = /https:\/\/github\.com\/atomeam\/void-loop\/pull\/\d+/.exec(String(note || ''));
  if (state === 'done' || state === 'live') return { state: 'shipped', status: 'Built' + (pr ? ' in ' + pr[0].split('/').pop() : ''), pr: pr ? pr[0] : null };
  if (state === 'building') return { state: 'building', status: 'Verse is building it now', pr: null };
  if (state === 'set aside') return { state: 'set aside', status: 'Verse could not build this one without taking something away or breaking a test', pr: null };
  return { state: 'queued', status: 'In the queue', pr: null };
}

/** The member's own ideas, newest first, with where each stands. */
export async function mine(env, userId) {
  const { results } = await env.DB.prepare('SELECT i.id, i.text, i.at, q.state, q.note FROM void_member_ideas i LEFT JOIN void_queue q ON q.id = i.job WHERE i.user_id = ? ORDER BY i.at DESC LIMIT 50').bind(userId).all();
  return (results || []).map((r) => ({ id: r.id, text: r.text, at: r.at, ...stateText(r.state, r.note) }));
}

/** Built by members: shipped ideas, newest first, credited to the member's published @name when they have one. */
export async function wall(env, limit = 30) {
  let rows = [];
  try {
    ({ results: rows } = await env.DB.prepare("SELECT i.text, q.updated AS at, q.note, p.handle FROM void_member_ideas i JOIN void_queue q ON q.id = i.job LEFT JOIN void_pages p ON p.user_id = i.user_id WHERE q.state IN ('done','live') ORDER BY q.updated DESC LIMIT ?").bind(limit).all());
  } catch (_) { // no published pages table yet: credit without names
    ({ results: rows } = await env.DB.prepare("SELECT i.text, q.updated AS at, q.note FROM void_member_ideas i JOIN void_queue q ON q.id = i.job WHERE q.state IN ('done','live') ORDER BY q.updated DESC LIMIT ?").bind(limit).all());
  }
  return (rows || []).map((r) => ({ text: String(r.text).slice(0, 200), at: r.at, by: r.handle ? '@' + r.handle : 'a member', pr: stateText('done', r.note).pr }));
}
