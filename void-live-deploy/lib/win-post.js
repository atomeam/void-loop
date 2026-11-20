// The showcase step: a big, verified-live before/after win from the quality board becomes one short post on Verse's X account (@addumm).
// Pure helpers only (no network, no files), so tests can run them. tools/win-post.mjs does the posting.
import crypto from 'node:crypto';

export const ACCOUNT = 'addumm';
export const MIN_GAIN = 8;            // points on the 100 scale, measured live before and after
export const MAX_PER_DAY = 1;
export const MAX_PER_WEEK = 3;
export const MIN_GAP_MS = 12 * 3600e3;

const enc = (s) => encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());

/** OAuth 1.0a header for a request whose body is JSON (so only the oauth_* values and the query are signed). */
export function oauth1Header(method, url, creds, { nonce = crypto.randomBytes(12).toString('hex'), ts = Math.floor(Date.now() / 1000), query = {} } = {}) {
  const o = { oauth_consumer_key: creds.key, oauth_nonce: nonce, oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: String(ts), oauth_token: creds.token, oauth_version: '1.0' };
  const all = { ...query, ...o };
  const base = [method.toUpperCase(), enc(url.split('?')[0]), enc(Object.keys(all).sort().map((k) => enc(k) + '=' + enc(all[k])).join('&'))].join('&');
  o.oauth_signature = crypto.createHmac('sha1', enc(creds.secret) + '&' + enc(creds.tokenSecret)).update(base).digest('base64');
  return 'OAuth ' + Object.keys(o).sort().map((k) => enc(k) + '="' + enc(o[k]) + '"').join(', ');
}

/** names a public post must never carry: every name the owner-only Tower holds, as brand words. Pure: takes the raw Tower objects. */
export function rivalWords(towers) {
  const out = new Set(); const walk = (v, d) => {
    if (d > 6 || v == null) return;
    if (typeof v === 'string') { const m = /^(?:https?:\/\/)?(?:www\.)?([a-z0-9-]{3,})\.[a-z.]{2,}(?:\/|$)/i.exec(v.trim()); if (m) out.add(m[1].toLowerCase()); return; }
    if (Array.isArray(v)) { v.slice(0, 400).forEach((x) => walk(x, d + 1)); return; }
    if (typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (/^(site|host|domain|url|name|rival|target)s?$/i.test(k) || Array.isArray(x) || typeof x === 'object') walk(x, d + 1); }
  };
  towers.forEach((t) => walk(t, 0));
  ['verse', 'void', 'addumm', 'github', 'cloudflare', 'pages', 'workers', 'localhost'].forEach((w) => out.delete(w));
  return [...out];
}
const norm = (s) => ' ' + String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
export const namesRival = (text, words) => words.find((w) => norm(w).trim() && norm(text).includes(norm(w))) || null;

/** a cycle is worth a post only when it was kept, measured live, and the jump is big */
export function worthy(cycle) {
  if (!cycle || !cycle.kept || !(cycle.gain >= MIN_GAIN)) return false;
  const r = (cycle.results || []).filter((x) => x.kept && x.after > x.before);
  return r.length > 0 && r.every((x) => Number.isFinite(x.before) && Number.isFinite(x.after));
}

// blub, the blobfish of the account (bio "ugly fish", the profile picture is a blobfish): a light, funny sign-off, rotated so it never reads as a template. Facts come first.
export const SIGN_OFFS = Object.freeze(['blub.', 'blub blub.', 'ugly fish, better every day. blub.', 'the blobfish approves. blub.']);
export const signOff = (cycle) => SIGN_OFFS[Math.abs(String(cycle && cycle.at || '').split('').reduce((n, c) => n + c.charCodeAt(0), 0)) % SIGN_OFFS.length];

/** plain caption: numbers and a link, no page names, no rivals; ends with blub's sign-off */
export function caption(cycle, link = 'https://a-to-mind.com/blub/') {
  if (!/a-to-mind\.com/.test(link)) link = 'https://a-to-mind.com/';
  const r = (cycle.results || []).filter((x) => x.kept).sort((a, b) => (b.after - b.before) - (a.after - a.before))[0];
  const n = (cycle.results || []).filter((x) => x.kept).length;
  return 'A-to-Mind Verse made ' + (n > 1 ? n + ' of its own pages' : 'one of its own pages') + ' better, and measured it live: ' + r.before + ' to ' + r.after + ' out of 100. It checks the result, keeps what helped and undoes what did not.\n' + signOff(cycle) + ' ' + link;  // the blobfish is the messenger: the post names A-to-Mind Verse and links to a-to-mind.com
}

/** one at a time, few: false with the reason when a post would be too soon or too many */
export function allowed(posts, now = Date.now()) {
  const t = posts.map((p) => Date.parse(p.at)).filter(Number.isFinite);
  if (t.some((x) => now - x < MIN_GAP_MS)) return { ok: false, why: 'the last post was under 12 hours ago' };
  if (t.filter((x) => now - x < 86400e3).length >= MAX_PER_DAY) return { ok: false, why: 'one post a day is the limit' };
  if (t.filter((x) => now - x < 7 * 86400e3).length >= MAX_PER_WEEK) return { ok: false, why: 'three posts a week is the limit' };
  return { ok: true };
}

/** the next cycle to post: newest worthy one not yet posted */
export function nextPost(cycles, posts) {
  const done = new Set(posts.map((p) => p.cycle));
  return [...cycles].reverse().find((c) => worthy(c) && !done.has(c.at)) || null;
}

/** how people responded, so what Verse builds can follow it: totals over the posts' stored numbers */
export function reachTotals(posts) {
  const t = { posts: posts.length, views: 0, likes: 0, reposts: 0, replies: 0 };
  for (const p of posts) { const m = p.reach || {}; t.views += m.impression_count || 0; t.likes += m.like_count || 0; t.reposts += m.retweet_count || 0; t.replies += m.reply_count || 0; }
  return t;
}
