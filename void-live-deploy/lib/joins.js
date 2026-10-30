// The community milestone (asked by Verse, 2026-10-17: "Integrate the 'join v01d' store link with the 'growth' skill so the stage shows
// a live 'community milestone' card whenever someone joins"). A join is a paid MultiVerse account that a verified Gumroad sale made
// (functions/api/gumroad.js writes void_accounts after Gumroad confirms the sale). The owner's own test purchases do not count.
// Only the count and the time of the newest join leave the server: no name, no id, no email.
//   joinStats(env)            -> { count, last }       the server side, read by GET /api/joins
//   milestoneFor(stats, seen) -> null | { count, ... }  what the stage shows: only a join newer than the one this device saw
//   communityHtml(esc, stats) -> the growth card's community line
//   joinCardText(m)           -> the stage card's words
// With no members there is no card on the stage, and the growth line says so (no synthetic count).

export const JOIN_URL = '/members/'; // where the join v01d store link opens (skills/store.js answers "join v01d" with the store; the members page links a purchase to the visitor's Verse)
export const MILESTONES = [1, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
export const FRESH_MS = 24 * 3600e3; // a first visit sees a join from the last day; an older one is only noted, never shown as news

// a paid account counts when the sale linked to it is not a test purchase (the owner's own tries carry test=true in Gumroad's ping);
// the time of a join is its sale, or the account's own change when no sale row is linked (an account linked by the members page)
const COUNT_SQL = "SELECT COUNT(DISTINCT a.user_id) AS n, MAX(COALESCE(s.at, a.updated)) AS last FROM void_accounts a LEFT JOIN void_sales s ON s.sale_id = a.sale_id AND s.resource = 'sale' WHERE a.tier = 'paid' AND (s.raw IS NULL OR s.raw NOT LIKE '%test=true%')";

/** the number of members and when the newest one joined (ISO, or null). Any read failure is { count: 0, last: null, note }. */
export async function joinStats(env) {
  try {
    const r = await env.DB.prepare(COUNT_SQL).first();
    const count = Math.max(0, Number(r && r.n) || 0);
    const last = r && r.last && !isNaN(Date.parse(r.last)) ? new Date(r.last).toISOString() : null;
    return { count, last: count ? last : null };
  } catch (_) {
    return { count: 0, last: null, note: 'members are unavailable just now' };
  }
}

/** a round number of members (1, 10, 25, 50, 100, ...) is a milestone. Pure. */
export function isMilestone(count) { return MILESTONES.includes(count); }

/** what the stage shows, or null. `seen` is the newest join this device already saw (ISO or ''); `now` the clock.
 *  A join newer than `seen` is news. On a device that saw none yet, only a join from the last day is news. Pure. */
export function milestoneFor(stats, seen, now = Date.now()) {
  const count = Number(stats && stats.count) || 0, last = stats && stats.last ? Date.parse(stats.last) : NaN;
  if (count < 1 || isNaN(last) || last > now + 60e3) return null;
  const was = seen ? Date.parse(seen) : NaN;
  if (!isNaN(was) ? last <= was : now - last > FRESH_MS) return null;
  return { count, at: new Date(last).toISOString(), milestone: isMilestone(count) };
}

/** the stage card's words: a title, one line and the join link's label. Pure. */
export function joinCardText(m) {
  if (!m) return null;
  const members = m.count + (m.count === 1 ? ' member' : ' members');
  return {
    title: m.milestone ? (m.count === 1 ? 'Verse has its first member' : 'Verse has ' + members) : 'Someone joined Verse',
    line: m.milestone ? 'A community milestone: ' + members + ' on MultiVerse now.' : 'MultiVerse now has ' + members + '.',
    link: 'Join MultiVerse',
  };
}

/** the growth card's community line: the count, when the newest member joined, and the join link. The caller passes esc. Pure. */
export function communityHtml(esc, stats, now = Date.now()) {
  if (!stats || stats.note) return '';
  const count = Number(stats.count) || 0;
  const link = '<a href="' + JOIN_URL + '">Join MultiVerse</a>';
  if (!count) return '<div class="sub growth-community">Community: no members yet. ' + link + '</div>';
  const last = Date.parse(stats.last), ago = isNaN(last) ? '' : ', the newest ' + agoText(now - last);
  return '<div class="sub growth-community">Community: ' + esc(String(count)) + (count === 1 ? ' member' : ' members') + ' on MultiVerse' + esc(ago) + '. ' + link + '</div>';
}

/** "today", "yesterday", "3 days ago", "5 weeks ago". Pure. */
export function agoText(ms) {
  const d = Math.floor(Math.max(0, ms) / 864e5);
  if (d < 1) return 'today';
  if (d < 2) return 'yesterday';
  if (d < 14) return d + ' days ago';
  return Math.floor(d / 7) + ' weeks ago';
}
