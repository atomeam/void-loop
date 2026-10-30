// Verse's boards (/boards/, lib/boards.js): anonymous image and text boards anyone can make (owner, 2026-10-25: "Let's go after the chans next",
// "anything legal, just like the existing boards", "leave the categories blank but user creatable").
//   GET  /api/boards                       the boards, most active first
//   GET  /api/boards?config                the bot check the page must pass (Turnstile's site key, or proof of work) and the limits
//   GET  /api/boards?challenge             a proof-of-work challenge (only when Turnstile is not set up)
//   GET  /api/boards?b=<code>              a board and its catalog (live threads in bump order); &page=N one index page with each thread's last replies
//   GET  /api/boards?b=<code>&archive      the archive: threads pushed off the last page, read only
//   GET  /api/boards?b=<code>&t=<no>       a thread; &since=<no> only the posts after it (the page's auto-update)
//   GET  /api/boards?b=<code>&p=<no>       the thread a post is in (for >>123 and >>>/b/123 links)
//   GET  /api/boards?overboard[&sfw=1]       every board's live threads in one feed
//   GET  /api/boards?q=<words>[&b=<code>]  search, across every board or one
//   GET  /api/boards?review                the owner: reported and hidden posts
//   GET  /api/boards/i/<name>              an uploaded picture or its thumbnail
//   POST /api/boards {do: 'board'|'post'|'report'|'mod', ...}   JSON, or multipart with `data` (JSON) and `file` and `thumb`
//
// WHAT A STRANGER COULD MAKE EACH ENDPOINT DO, AND WHY IT IS BOUNDED (AGENTS.md "Never": an unauthenticated POST is thought through first).
//   - GET anything: read posts that are public already. Hidden (reported) and deleted posts are never sent to anyone but the owner. No address,
//     hashed or not, is ever sent. A search is at most 6 words of 40 characters each, LIKE-escaped, 50 rows. The guard (lib/guard.js) caps requests
//     a connection makes in a minute.
//   - GET a picture: only a name of the form <24 hex>[s].<jpg|png|gif|webp> under the boards/ prefix of the bucket: no other object, no listing.
//     Served with its sniffed type, nosniff, a sandboxing CSP and inline disposition, so a file cannot run as a page.
//   - POST do=board (make a board): one bot check (Turnstile, or a signed one-use proof of work), then 1 board per 10 minutes and 3 a day per
//     hashed address, 500 boards in all; the code is 1-10 of [a-z0-9], not reserved, not taken; the title and line are cut and cleaned. A board
//     cannot be made "official": it carries its maker's words only and the owner can rename, lock or delete it.
//   - POST do=post: one bot check per post; a new thread 1 per 3 minutes, a reply 1 per 15 seconds and 40 an hour per hashed address; a banned
//     address is refused. Text is cleaned and cut (4,000 characters, 120 lines); it is rendered on the page with every character escaped. A file
//     is taken only on an image board, only as JPEG, PNG, GIF or WebP read from its own bytes (never its name), up to 4 MB and 10,000 px, with
//     its EXIF/XMP/GPS/comments stripped here whatever the browser did; the thumbnail is checked the same way (200 KB, 250 px). Stored in R2 under
//     a random name. Worst case: a script that solves the check posts within those rates, and three people's reports hide it.
//   - POST do=report: one bot check; one report per post per hashed address, 20 an hour; three different addresses hide the post until the owner
//     restores or deletes it. Worst case: three addresses hide a legal post for a while; the owner's review list shows it to restore.
//   - POST do=delete-own: a post's own delete password (its keyed hash is compared); a wrong one is 403 and counted by the guard's wrong-key brake.
//   - POST do=mod: the owner key (or an owner session) only; otherwise 403 and the guard's wrong-key brake counts it.
// What is kept about a poster: a keyed hash of the address (HMAC with the server's SALT; never the address) for rates, reports and bans, and the
// tripcode's output (never its password). Owner action: the Cloudflare CSAM Scanning Tool (docs/MAP.md, Boards).
import { ownerOk } from '../../../lib/guard.js';
import { LIMITS, TYPES, REPORT_WHY, POW_BITS, limitsOf, codeProblem, cleanText, cleanLine, parseName, tripcode, isSage, excerpt, checkImage, workOk } from '../../../lib/boards.js';

const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const bad = (status, say, extra = {}) => json({ ok: false, say, ...extra }, status);
const enc = new TextEncoder();
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const MIN = 60e3, HOUR = 3600e3, DAY = 864e5;
export const RATES = Object.freeze({ thread: 3 * MIN, reply: 15e3, repliesHour: 40, board: 10 * MIN, boardsDay: 3, boardsAll: 500, reportsHour: 20 });
export const FILE_NAME = /^[0-9a-f]{24}s?\.(?:jpg|png|gif|webp)$/;
const PREFIX = 'boards/', HELD = 'boards-held/';

const TABLES = [
  'CREATE TABLE IF NOT EXISTS void_boards (code TEXT PRIMARY KEY, title TEXT NOT NULL, about TEXT NOT NULL, nsfw INTEGER NOT NULL, text_only INTEGER NOT NULL, ids INTEGER NOT NULL DEFAULT 0, locked INTEGER NOT NULL DEFAULT 0, next INTEGER NOT NULL DEFAULT 0, posts INTEGER NOT NULL DEFAULT 0, last INTEGER NOT NULL, created INTEGER NOT NULL, ip TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS void_board_posts (board TEXT NOT NULL, no INTEGER NOT NULL, thread INTEGER NOT NULL, at INTEGER NOT NULL, bumped INTEGER NOT NULL, name TEXT NOT NULL, trip TEXT NOT NULL, sub TEXT NOT NULL, body TEXT NOT NULL, file TEXT, thumb TEXT, fname TEXT, fw INTEGER, fh INTEGER, fsize INTEGER, tw INTEGER, th INTEGER, spoiler INTEGER NOT NULL DEFAULT 0, sage INTEGER NOT NULL DEFAULT 0, ip TEXT NOT NULL, reports INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0, locked INTEGER NOT NULL DEFAULT 0, replies INTEGER NOT NULL DEFAULT 0, images INTEGER NOT NULL DEFAULT 0, delpass TEXT, uid TEXT, PRIMARY KEY (board, no))',
  'CREATE INDEX IF NOT EXISTS void_board_posts_thread ON void_board_posts (board, thread)',
  'CREATE INDEX IF NOT EXISTS void_board_posts_ip ON void_board_posts (ip, at)',
  'CREATE TABLE IF NOT EXISTS void_board_reports (board TEXT NOT NULL, no INTEGER NOT NULL, ip TEXT NOT NULL, why TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (board, no, ip))',
  'CREATE TABLE IF NOT EXISTS void_board_bans (ip TEXT PRIMARY KEY, until INTEGER NOT NULL, why TEXT NOT NULL, at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS void_board_spent (id TEXT PRIMARY KEY, at INTEGER NOT NULL)',
];
let ready = null;
async function tables(env) {
  if (!ready) ready = (async () => { for (const t of TABLES) await env.DB.prepare(t).run(); })().catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; }; // tests: a new fake database needs its tables made again
const q1 = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).first();
const qa = async (env, sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];
const run = (env, sql, ...a) => env.DB.prepare(sql).bind(...a).run();
const bucket = (env) => env.BOARDS_MEDIA || env.FILMS || null;

/** the keyed hash of a connection's address: what rates, reports and bans use; the address itself is never kept. */
export async function ipHash(request, env) {
  const k = await crypto.subtle.importKey('raw', enc.encode('verse-boards-ip:' + env.SALT), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(request.headers.get('cf-connecting-ip') || 'local'))).slice(0, 32);
}
async function hmac(env, s) {
  const k = await crypto.subtle.importKey('raw', enc.encode('verse-boards-pow:' + env.SALT + '|' + (env.READ_TOKEN || '')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', k, enc.encode(s)));
}
/** a proof-of-work challenge: { c, sig, bits }; c carries its expiry, sig is keyed by the server's secrets so no one makes their own. */
export async function challenge(env, now = Date.now()) {
  const r = new Uint8Array(12); crypto.getRandomValues(r);
  const c = (now + 10 * MIN).toString(36) + '.' + hex(r);
  return { c, sig: await hmac(env, 'pow:' + c), bits: POW_BITS };
}
/** the bot check on one write: Turnstile when its secret is set, else a signed, unexpired, unused proof of work. '' when it passes, else why. */
export async function botCheck(proof, request, env, fetchFn = fetch, now = Date.now()) {
  const p = proof && typeof proof === 'object' ? proof : {};
  if (env.TURNSTILE_SECRET) {
    if (typeof p.turnstile !== 'string' || !p.turnstile || p.turnstile.length > 2048) return 'the bot check is missing';
    try {
      const form = new FormData(); form.append('secret', env.TURNSTILE_SECRET); form.append('response', p.turnstile);
      const ip = request.headers.get('cf-connecting-ip'); if (ip) form.append('remoteip', ip);
      const r = await fetchFn('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
      const j = await r.json(); return j && j.success === true ? '' : 'the bot check did not pass; try again';
    } catch (_) { return 'the bot check could not be reached; try again'; }
  }
  const c = String(p.c || ''), m = /^([0-9a-z]{1,12})\.[0-9a-f]{24}$/.exec(c);
  if (!m || typeof p.sig !== 'string' || !/^\d{1,12}$/.test(String(p.n))) return 'the bot check is missing';
  if (parseInt(m[1], 36) < now) return 'the bot check ran out of time; try again';
  const want = await hmac(env, 'pow:' + c); let d = want.length === p.sig.length ? 0 : 1; for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ (p.sig.charCodeAt(i) || 0);
  if (d) return 'the bot check is not ours';
  if (!(await workOk(c, String(p.n), POW_BITS))) return 'the bot check did not pass';
  const used = await run(env, 'INSERT OR IGNORE INTO void_board_spent (id, at) VALUES (?, ?)', c, now);
  if (!used.meta || !used.meta.changes) return 'that bot check was used already';
  if (Math.random() < 0.05) await run(env, 'DELETE FROM void_board_spent WHERE at < ?', now - DAY).catch(() => {});
  return '';
}

const mediaBase = (env) => (env.BOARDS_MEDIA_URL && /^https:\/\/[a-z0-9.-]+(?:\/[\w./-]*)?$/i.test(env.BOARDS_MEDIA_URL) ? env.BOARDS_MEDIA_URL.replace(/\/$/, '') : '/api/boards/i');
/** a post as the public sees it: no address hash, no report count; a hidden post shows only that it is hidden (the owner sees it all). Pure. */
export function shape(r, env = {}, owner = false) {
  if (r.hidden && !owner) return { no: r.no, thread: r.thread, at: r.at, hidden: true };
  const base = mediaBase(env), op = r.thread === r.no;
  const o = { no: r.no, thread: r.thread, at: r.at, name: r.name, trip: r.trip || '', ...(r.uid ? { id: r.uid } : {}), sub: r.sub || '', body: r.body || '', spoiler: !!r.spoiler,
    file: r.file ? { src: base + '/' + r.file, thumb: base + '/' + (r.thumb || r.file), w: r.fw, h: r.fh, tw: r.tw, th: r.th, size: r.fsize, name: r.fname || r.file } : null };
  if (op) Object.assign(o, { op: true, replies: r.replies, images: r.images, bumped: r.bumped, locked: !!r.locked, archived: !!r.archived });
  if (owner) Object.assign(o, { reports: r.reports, hidden: !!r.hidden });
  return o;
}
const boardOut = (b) => ({ code: b.code, title: b.title, about: b.about, nsfw: !!b.nsfw, textOnly: !!b.text_only, ids: !!b.ids, locked: !!b.locked, posts: b.posts, last: b.last, created: b.created });
const LIVE = LIMITS.perPage * LIMITS.pages;

async function getBoard(env, code) { return CODECHECK.test(code) ? q1(env, 'SELECT * FROM void_boards WHERE code = ?', code) : null; }
const CODECHECK = /^[a-z0-9]{1,10}$/;
const intOf = (x) => (/^\d{1,9}$/.test(String(x || '')) ? +x : 0);

export async function onRequestGet({ request, env, params }) {
  const u = new URL(request.url), sp = u.searchParams, path = [].concat((params && params.path) || []);
  if (path[0] === 'i') return image(env, path[1] || '');
  if (path.length) return bad(404, 'no such page');
  if (sp.has('config')) return json({ ok: true, turnstile: env.TURNSTILE_SECRET && env.TURNSTILE_SITE_KEY ? env.TURNSTILE_SITE_KEY : null, pow: env.TURNSTILE_SECRET ? null : POW_BITS, limits: LIMITS, why: REPORT_WHY, rates: RATES });
  if (!env.DB) return bad(503, 'the boards are not set up here');
  await tables(env);
  if (sp.has('challenge')) { if (!env.SALT) return bad(503, 'the boards are not set up here'); return json({ ok: true, ...(await challenge(env)) }); }
  const owner = await ownerOk(request, env);
  if (sp.has('review')) {
    if (!owner) return bad(403, 'the owner only');
    const rows = await qa(env, 'SELECT * FROM void_board_posts WHERE (hidden = 1 OR reports > 0) AND deleted = 0 ORDER BY hidden DESC, reports DESC, at DESC LIMIT 200');
    const why = await qa(env, 'SELECT board, no, why, COUNT(*) AS n FROM void_board_reports GROUP BY board, no, why');
    return json({ ok: true, posts: rows.map((r) => ({ board: r.board, ...shape(r, env, true), why: why.filter((w) => w.board === r.board && w.no === r.no).map((w) => w.why + ' (' + w.n + ')') })) });
  }
  const code = String(sp.get('b') || '').toLowerCase();
  if (sp.has('q')) return search(env, sp.get('q'), code, owner);
  if (sp.has('overboard')) { // every board's live threads in one feed, newest bump first; each says its board and whether it is 18+
    const rows = await qa(env, 'SELECT p.*, b.nsfw AS bnsfw FROM void_board_posts p JOIN void_boards b ON b.code = p.board WHERE p.thread = p.no AND p.archived = 0 AND p.deleted = 0' + (owner ? '' : ' AND p.hidden = 0') + (sp.get('sfw') === '1' ? ' AND b.nsfw = 0' : '') + ' ORDER BY p.bumped DESC LIMIT 60');
    return json({ ok: true, threads: rows.map((r) => ({ board: r.board, nsfw: !!r.bnsfw, ...shape(r, env, owner), body: excerpt(r.body, 300) })) });
  }
  if (!code) {
    const rows = await qa(env, 'SELECT * FROM void_boards ORDER BY last DESC LIMIT 500');
    return json({ ok: true, boards: rows.map(boardOut) });
  }
  const b = await getBoard(env, code); if (!b) return bad(404, 'there is no /' + code.slice(0, 10) + '/ yet: make it on the boards page', { kind: 'no-board' });
  const board = boardOut(b), seen = owner ? '' : ' AND hidden = 0';
  if (sp.has('p')) {
    const r = await q1(env, 'SELECT board, no, thread, hidden, deleted FROM void_board_posts WHERE board = ? AND no = ?', code, intOf(sp.get('p')));
    return r && !r.deleted && (owner || !r.hidden) ? json({ ok: true, board: code, thread: r.thread, no: r.no }) : bad(404, 'that post is not here');
  }
  if (sp.has('t')) {
    const t = intOf(sp.get('t')), op = await q1(env, 'SELECT * FROM void_board_posts WHERE board = ? AND no = ? AND thread = no', code, t);
    if (!op || op.deleted) return bad(404, 'that thread is not here (deleted, or it never was)', { board });
    if (op.hidden && !owner) return bad(410, 'that thread is hidden while it is looked at', { board });
    const since = intOf(sp.get('since'));
    const rows = await qa(env, 'SELECT * FROM void_board_posts WHERE board = ? AND thread = ? AND deleted = 0 AND no > ? ORDER BY no LIMIT 600', code, t, since);
    const n = await q1(env, 'SELECT COUNT(*) AS n FROM void_board_posts WHERE board = ? AND thread = ? AND deleted = 0', code, t);
    return json({ ok: true, board, thread: shape(op, env, owner), posts: rows.map((r) => shape(r, env, owner)), count: n ? n.n : 0 });
  }
  if (sp.has('archive')) {
    const rows = await qa(env, 'SELECT * FROM void_board_posts WHERE board = ? AND thread = no AND archived = 1 AND deleted = 0' + seen + ' ORDER BY bumped DESC LIMIT 3000', code);
    return json({ ok: true, board, threads: rows.map((r) => ({ no: r.no, at: r.at, sub: r.sub, excerpt: excerpt(r.body, 120), replies: r.replies })) });
  }
  const live = await qa(env, 'SELECT * FROM void_board_posts WHERE board = ? AND thread = no AND archived = 0 AND deleted = 0' + seen + ' ORDER BY bumped DESC LIMIT ' + LIVE, code);
  if (sp.has('page')) { // the index: one page of threads, each with its last three replies
    const page = Math.max(1, Math.min(LIMITS.pages, intOf(sp.get('page')) || 1)), slice = live.slice((page - 1) * LIMITS.perPage, page * LIMITS.perPage), threads = [];
    for (const op of slice) {
      const last = await qa(env, 'SELECT * FROM void_board_posts WHERE board = ? AND thread = ? AND no != thread AND deleted = 0' + seen + ' ORDER BY no DESC LIMIT 3', code, op.no);
      threads.push({ ...shape(op, env, owner), last: last.reverse().map((r) => shape(r, env, owner)) });
    }
    return json({ ok: true, board, page, pages: Math.max(1, Math.ceil(live.length / LIMITS.perPage)), threads });
  }
  return json({ ok: true, board, threads: live.map((r, i) => ({ ...shape(r, env, owner), body: excerpt(r.body, 300), page: Math.floor(i / LIMITS.perPage) + 1 })) });
}

async function search(env, raw, code, owner) {
  const words = String(raw || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6).map((w) => w.slice(0, 40));
  if (!words.length) return bad(400, 'search for a word');
  const like = (w) => '%' + w.replace(/[\\%_]/g, (c) => '\\' + c) + '%', where = words.map(() => "(lower(p.sub) LIKE ? ESCAPE '\\' OR lower(p.body) LIKE ? ESCAPE '\\')").join(' AND ');
  const args = words.flatMap((w) => [like(w), like(w)]);
  const rows = await qa(env, 'SELECT p.*, b.nsfw AS bnsfw FROM void_board_posts p JOIN void_boards b ON b.code = p.board WHERE p.deleted = 0' + (owner ? '' : ' AND p.hidden = 0') + (code ? ' AND p.board = ?' : '') + ' AND ' + where + ' ORDER BY p.at DESC LIMIT 50', ...(code ? [code] : []), ...args);
  return json({ ok: true, q: words.join(' '), results: rows.map((r) => ({ board: r.board, nsfw: !!r.bnsfw, ...shape(r, env, owner), body: excerpt(r.body, 240) })) });
}

async function image(env, name) {
  const r2 = bucket(env); if (!FILE_NAME.test(name)) return bad(404, 'no such picture');
  if (!r2) return bad(503, 'pictures are not set up here');
  const obj = await r2.get(PREFIX + name); if (!obj) return bad(404, 'no such picture (it may have been taken down)');
  const type = (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream';
  return new Response(obj.body, { headers: { 'content-type': Object.keys(TYPES).includes(type) ? type : 'application/octet-stream', 'cache-control': 'public, max-age=600',
    'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox", 'content-disposition': 'inline', 'cross-origin-resource-policy': 'same-origin' } });
}

/** the body of a POST: { data, file, thumb } from JSON or multipart, or null when it is neither. */
async function bodyOf(request) {
  const type = request.headers.get('content-type') || '';
  try {
    if (/^multipart\/form-data/i.test(type)) {
      const f = await request.formData(), data = JSON.parse(String(f.get('data') || '{}')), file = f.get('file'), thumb = f.get('thumb');
      const bytes = async (x) => (x && typeof x === 'object' && typeof x.arrayBuffer === 'function' ? { bytes: new Uint8Array(await x.arrayBuffer()), name: String(x.name || '') } : null);
      return { data, file: await bytes(file), thumb: await bytes(thumb) };
    }
    if (/^application\/json/i.test(type)) return { data: await request.json(), file: null, thumb: null };
  } catch (_) {}
  return null;
}
const randName = () => { const r = new Uint8Array(12); crypto.getRandomValues(r); return hex(r); };

export async function onRequestPost({ request, env, fetchFn = fetch, now = Date.now() }) {
  if (!env.DB || !env.SALT) return bad(503, 'the boards are not set up here');
  await tables(env);
  const body = await bodyOf(request); if (!body || !body.data || typeof body.data !== 'object') return bad(400, 'send JSON, or a form with data and a picture');
  const d = body.data;
  if (d.do === 'mod') return mod(request, env, d);
  if (d.do === 'delete-own') return deleteOwn(env, d);
  const ip = await ipHash(request, env);
  const ban = await q1(env, 'SELECT until, why FROM void_board_bans WHERE ip = ? AND until > ?', ip, now);
  if (ban) return bad(403, 'you are banned from posting until ' + new Date(ban.until).toUTCString() + (ban.why ? ': ' + ban.why : ''), { kind: 'banned' });
  if (d.do === 'board') return makeBoard(request, env, d, ip, fetchFn, now);
  if (d.do === 'post') return makePost(request, env, d, body, ip, fetchFn, now);
  if (d.do === 'report') return report(request, env, d, ip, fetchFn, now);
  return bad(400, 'do is board, post, report or mod');
}

async function makeBoard(request, env, d, ip, fetchFn, now) {
  const code = String(d.code || '').trim().toLowerCase(), title = cleanLine(d.title, LIMITS.title), about = cleanLine(d.about, LIMITS.about);
  const taken = await q1(env, 'SELECT code FROM void_boards WHERE code = ?', code);
  const why = codeProblem(code, new Set(taken ? [code] : [])); if (why) return bad(400, why, { field: 'code' });
  if (!title) return bad(400, 'a board needs a title', { field: 'title' });
  if (typeof d.nsfw !== 'boolean') return bad(400, 'say whether the board is 18+ (nsfw: true or false)', { field: 'nsfw' });
  const all = await q1(env, 'SELECT COUNT(*) AS n FROM void_boards'); if (all && all.n >= RATES.boardsAll) return bad(429, 'there are as many boards as there can be for now');
  const mine = await q1(env, 'SELECT COUNT(*) AS n, MAX(created) AS last FROM void_boards WHERE ip = ? AND created > ?', ip, now - DAY);
  if (mine && mine.n >= RATES.boardsDay) return bad(429, 'three boards a day from one place; try tomorrow', { kind: 'limited' });
  if (mine && mine.last && now - mine.last < RATES.board) return bad(429, 'one board every ten minutes; try again soon', { kind: 'limited' });
  const bot = await botCheck(d.proof, request, env, fetchFn, now); if (bot) return bad(403, bot, { kind: 'bot' });
  const r = await run(env, 'INSERT OR IGNORE INTO void_boards (code, title, about, nsfw, text_only, ids, last, created, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', code, title, about, d.nsfw ? 1 : 0, d.textOnly ? 1 : 0, d.ids ? 1 : 0, now, now, ip);
  if (!r.meta || !r.meta.changes) return bad(409, '/' + code + '/ is taken', { field: 'code' });
  return json({ ok: true, board: boardOut(await getBoard(env, code)) }, 201);
}

async function makePost(request, env, d, body, ip, fetchFn, now) {
  const code = String(d.b || '').toLowerCase(), b = await getBoard(env, code); if (!b) return bad(404, 'there is no such board');
  if (b.locked) return bad(403, '/' + code + '/ is locked');
  const t = intOf(d.t), text = cleanText(d.body, LIMITS.body, LIMITS.lines), sub = t ? '' : cleanLine(d.sub, LIMITS.sub), { name, secret } = parseName(d.name);
  let op = null;
  if (t) {
    op = await q1(env, 'SELECT * FROM void_board_posts WHERE board = ? AND no = ? AND thread = no AND deleted = 0', code, t);
    if (!op || op.hidden) return bad(404, 'that thread is not here');
    if (op.archived) return bad(403, 'that thread is in the archive: it is read only');
    if (op.locked || op.replies >= limitsOf(b).replies) return bad(403, 'that thread is full or locked: start a new one' + (b.text_only ? ' (a part 2)' : ''));
  }
  const file = body.file && body.file.bytes && body.file.bytes.length ? body.file : null;
  if (file && b.text_only) return bad(400, '/' + code + '/ is a text board: no pictures');
  if (file && op && op.images >= limitsOf(b).images) return bad(400, 'that thread has all the pictures it can take (' + LIMITS.images + '); reply without one');
  if (!t && !b.text_only && !file) return bad(400, 'a new thread here starts with a picture', { field: 'file' });
  if (!t && b.text_only && !text) return bad(400, 'a new thread needs some words', { field: 'body' });
  if (!text && !file) return bad(400, 'say something, or add a picture', { field: 'body' });
  // the rates, per hashed address, across every board
  const last = await q1(env, 'SELECT MAX(at) AS at, SUM(CASE WHEN at > ? THEN 1 ELSE 0 END) AS hour, MAX(CASE WHEN thread = no THEN at END) AS tat FROM void_board_posts WHERE ip = ? AND at > ?', now - HOUR, ip, now - HOUR);
  if (last && last.at && now - last.at < RATES.reply) return bad(429, 'one post every 15 seconds; wait a moment', { kind: 'limited' });
  if (last && last.hour >= RATES.repliesHour) return bad(429, RATES.repliesHour + ' posts an hour from one place; take a break', { kind: 'limited' });
  if (!t && last && last.tat && now - last.tat < RATES.thread) return bad(429, 'one new thread every 3 minutes; reply to one meanwhile', { kind: 'limited' });
  let img = null, th = null;
  if (file) {
    img = checkImage(file.bytes); if (!img.ok) return bad(400, img.why, { field: 'file' });
    th = body.thumb && body.thumb.bytes && body.thumb.bytes.length ? checkImage(body.thumb.bytes, { max: LIMITS.thumb, px: LIMITS.thumbPx, thumb: true }) : null;
    if (th && !th.ok) return bad(400, 'the thumbnail: ' + th.why, { field: 'file' });
    if (!bucket(env)) return bad(503, 'pictures are not set up here yet');
  }
  const bot = await botCheck(d.proof, request, env, fetchFn, now); if (bot) return bad(403, bot, { kind: 'bot' });
  const pw = typeof d.password === 'string' && d.password.length >= 8 && d.password.length <= 64 ? await hmac(env, 'del:' + d.password) : null;
  const trip = await tripcode(secret, env.SALT), sage = isSage(d.options) && !!t, spoiler = !!(file && d.spoiler);
  let fileName = null, thumbName = null;
  if (img) {
    const id = randName(); fileName = id + '.' + img.ext; thumbName = th ? id + 's.' + th.ext : null;
    await bucket(env).put(PREFIX + fileName, img.bytes, { httpMetadata: { contentType: img.type } });
    if (th) await bucket(env).put(PREFIX + thumbName, th.bytes, { httpMetadata: { contentType: th.type } });
  }
  const n = await q1(env, 'UPDATE void_boards SET next = next + 1, posts = posts + 1, last = ? WHERE code = ? RETURNING next', now, code);
  const no = n.next, uid = b.ids ? (await hmac(env, 'uid:' + ip + '|' + code + '|' + (t || no) + '|' + new Date(now).toISOString().slice(0, 10))).slice(0, 8) : null; // a poster ID: the same in one thread for one day, never the address
  const fname = file ? cleanLine(String(file.name || '').replace(/[/\\]/g, '_'), 60) || fileName : null;
  await run(env, 'INSERT INTO void_board_posts (board, no, thread, at, bumped, name, trip, sub, body, file, thumb, fname, fw, fh, fsize, tw, th, spoiler, sage, ip, images, delpass, uid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    code, no, t || no, now, now, name, trip, sub, text, fileName, thumbName, fname, img ? img.w : null, img ? img.h : null, img ? img.bytes.length : null, th ? th.w : null, th ? th.h : null, spoiler ? 1 : 0, sage ? 1 : 0, ip, !t && img ? 1 : 0, pw, uid);
  if (t) {
    const bump = !sage && op.replies < limitsOf(b).bump;
    await run(env, 'UPDATE void_board_posts SET replies = replies + 1, images = images + ?' + (bump ? ', bumped = ?' : '') + ' WHERE board = ? AND no = ?', ...(bump ? [img ? 1 : 0, now, code, t] : [img ? 1 : 0, code, t]));
  }
  // the page limit: threads past the last page go to the archive, read only
  await run(env, 'UPDATE void_board_posts SET archived = 1 WHERE board = ? AND no IN (SELECT no FROM void_board_posts WHERE board = ? AND thread = no AND archived = 0 AND deleted = 0 ORDER BY bumped DESC LIMIT -1 OFFSET ' + LIVE + ')', code, code);
  return json({ ok: true, board: code, no, thread: t || no, trip }, 201);
}

async function report(request, env, d, ip, fetchFn, now) {
  const code = String(d.b || '').toLowerCase(), no = intOf(d.no), why = REPORT_WHY.includes(d.why) ? d.why : '';
  if (!why) return bad(400, 'say why: ' + REPORT_WHY.join('; '));
  const p = await q1(env, 'SELECT board, no, thread, hidden, deleted FROM void_board_posts WHERE board = ? AND no = ?', code, no);
  if (!p || p.deleted) return bad(404, 'that post is not here');
  const mine = await q1(env, 'SELECT COUNT(*) AS n FROM void_board_reports WHERE ip = ? AND at > ?', ip, now - HOUR);
  if (mine && mine.n >= RATES.reportsHour) return bad(429, RATES.reportsHour + ' reports an hour from one place', { kind: 'limited' });
  const bot = await botCheck(d.proof, request, env, fetchFn, now); if (bot) return bad(403, bot, { kind: 'bot' });
  const r = await run(env, 'INSERT OR IGNORE INTO void_board_reports (board, no, ip, why, at) VALUES (?, ?, ?, ?, ?)', code, no, ip, why, now);
  if (!r.meta || !r.meta.changes) return json({ ok: true, already: true, say: 'you reported this post already' });
  const c = await q1(env, 'UPDATE void_board_posts SET reports = reports + 1, hidden = CASE WHEN reports + 1 >= ? THEN 1 ELSE hidden END WHERE board = ? AND no = ? RETURNING reports, hidden', LIMITS.hideAt, code, no);
  return json({ ok: true, hidden: !!(c && c.hidden), say: c && c.hidden ? 'Reported. It is hidden until it is looked at.' : 'Reported. Thank you.' });
}

// the owner's tools: a post (delete it, or only its picture; restore a hidden one; ban its poster's hashed address; lock a thread), a board
// (rename, lock, unlock, delete). A deleted picture is moved out of public reach (boards-held/), not erased: a report to the NCMEC needs it kept;
// `purge` erases it for good once nothing needs it
/** a post taken down (a first post takes its whole thread): its pictures moved out of public reach by `hide`, its words emptied, its thread's counts fixed */
async function removePost(env, p, hide) {
  const code = p.board, posts = p.thread === p.no ? await qa(env, 'SELECT * FROM void_board_posts WHERE board = ? AND thread = ?', code, p.no) : [p];
  for (const x of posts) { await hide(x.file); await hide(x.thumb); }
  await run(env, "UPDATE void_board_posts SET deleted = 1, body = '', sub = '', file = NULL, thumb = NULL WHERE board = ? AND (no = ? OR thread = ?)", code, p.no, p.thread === p.no ? p.no : -1);
  if (p.thread !== p.no) await run(env, 'UPDATE void_board_posts SET replies = MAX(0, replies - 1), images = MAX(0, images - ?) WHERE board = ? AND no = ?', p.file ? 1 : 0, code, p.thread);
}
const holder = (env, purge) => async (name) => { const r2 = bucket(env); if (!r2 || !name) return; const o = await r2.get(PREFIX + name); if (o && !purge) await r2.put(HELD + name, await o.arrayBuffer(), { httpMetadata: o.httpMetadata }); await r2.delete(PREFIX + name); if (purge) await r2.delete(HELD + name); };
// a poster takes back their own post with the delete password their device sent with it (kept here only as a keyed hash); a post that was
// reported keeps its picture held all the same, so taking it back never hides it from a report
async function deleteOwn(env, d) {
  const code = String(d.b || '').toLowerCase(), no = intOf(d.no), pw = typeof d.password === 'string' && d.password.length >= 8 && d.password.length <= 64 ? d.password : '';
  const p = pw ? await q1(env, 'SELECT * FROM void_board_posts WHERE board = ? AND no = ?', code, no) : null;
  if (!p || p.deleted || !p.delpass) return bad(404, 'that post is not here, or it was not posted with a delete password');
  const want = await hmac(env, 'del:' + pw); let x = want.length === p.delpass.length ? 0 : 1; for (let i = 0; i < want.length; i++) x |= want.charCodeAt(i) ^ (p.delpass.charCodeAt(i) || 0);
  if (x) return bad(403, 'that is not the password this post was made with');
  await removePost(env, p, holder(env, false));
  return json({ ok: true, deleted: no });
}
async function mod(request, env, d) {
  if (!(await ownerOk(request, env))) return bad(403, 'the owner only');
  const code = String(d.b || '').toLowerCase(), no = intOf(d.no), act = String(d.act || '');
  const hide = holder(env, !!d.purge);
  if (/^board-/.test(act)) {
    const b = await getBoard(env, code); if (!b) return bad(404, 'no such board');
    if (act === 'board-rename') { const title = cleanLine(d.title, LIMITS.title) || b.title, about = d.about == null ? b.about : cleanLine(d.about, LIMITS.about); await run(env, 'UPDATE void_boards SET title = ?, about = ?, nsfw = ? WHERE code = ?', title, about, typeof d.nsfw === 'boolean' ? (d.nsfw ? 1 : 0) : b.nsfw, code); }
    else if (act === 'board-lock' || act === 'board-unlock') await run(env, 'UPDATE void_boards SET locked = ? WHERE code = ?', act === 'board-lock' ? 1 : 0, code);
    else if (act === 'board-delete') {
      for (const p of await qa(env, 'SELECT file, thumb FROM void_board_posts WHERE board = ? AND file IS NOT NULL', code)) { await hide(p.file); await hide(p.thumb); }
      await run(env, 'DELETE FROM void_board_posts WHERE board = ?', code); await run(env, 'DELETE FROM void_board_reports WHERE board = ?', code); await run(env, 'DELETE FROM void_boards WHERE code = ?', code);
    } else return bad(400, 'act is board-rename, board-lock, board-unlock or board-delete');
    return json({ ok: true, act, board: code });
  }
  const p = await q1(env, 'SELECT * FROM void_board_posts WHERE board = ? AND no = ?', code, no); if (!p) return bad(404, 'no such post');
  if (act === 'delete') await removePost(env, p, hide);
  else if (act === 'delete-file') { await hide(p.file); await hide(p.thumb); await run(env, 'UPDATE void_board_posts SET file = NULL, thumb = NULL WHERE board = ? AND no = ?', code, no); }
  else if (act === 'restore') { await run(env, 'UPDATE void_board_posts SET hidden = 0, reports = 0 WHERE board = ? AND no = ?', code, no); await run(env, 'DELETE FROM void_board_reports WHERE board = ? AND no = ?', code, no); }
  else if (act === 'ban') { const days = Math.max(1, Math.min(3650, intOf(d.days) || 3)); await run(env, 'INSERT OR REPLACE INTO void_board_bans (ip, until, why, at) VALUES (?, ?, ?, ?)', p.ip, Date.now() + days * DAY, cleanLine(d.why, LIMITS.why), Date.now()); }
  else if (act === 'lock' || act === 'unlock') { if (p.thread !== p.no) return bad(400, 'lock a thread by its first post'); await run(env, 'UPDATE void_board_posts SET locked = ? WHERE board = ? AND no = ?', act === 'lock' ? 1 : 0, code, no); }
  else return bad(400, 'act is delete, delete-file, restore, ban, lock or unlock');
  return json({ ok: true, act, board: code, no });
}
