// A FAKE D1 (node:sqlite) with Verse's boards tables, made by functions/api/boards/ itself, and a few communities and posts: for
// tools/social-page.test.mjs and the /social/ play-through (tools/social-page.mjs).
import { DatabaseSync } from 'node:sqlite';
import * as boards from '../void-live-deploy/functions/api/boards/[[path]].js';
import * as social from '../void-live-deploy/functions/api/social.js';
import { resetGuard } from '../void-live-deploy/lib/guard.js';

export function fakeDb() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), raw: db };
}
const H = 3600e3;
/** a world with three communities (tech, cooking, and an 18+ one) and posts in them */
export async function seeded(now = Date.now()) {
  boards.resetReady(); social.resetReady(); resetGuard();
  const env = { DB: fakeDb(), SALT: 'test-salt' };
  await boards.onRequestGet({ request: new Request('https://a-to-mind.com/api/boards'), env, params: {} });
  const r = env.DB.raw;
  const board = (code, title, about, nsfw, next) => r.prepare('INSERT INTO void_boards (code, title, about, nsfw, text_only, next, posts, last, created, ip) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)').run(code, title, about, nsfw, next, next, now, now, 'x');
  board('tech', 'Technology', 'Computers and gadgets', 0, 5); board('cooking', 'Cooking', 'Food and recipes', 0, 1); board('late', 'Late night', '18+ talk', 1, 1);
  const post = (b, no, thread, at, sub, body, extra = {}) => r.prepare('INSERT INTO void_board_posts (board, no, thread, at, bumped, name, trip, sub, body, ip, replies, hidden, deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)').run(b, no, thread, at, at, 'Anonymous', '', sub, body, 'iphash', extra.replies || 0, extra.hidden || 0);
  post('tech', 1, 1, now - 5 * H, 'Which home server?', 'I want a quiet one for photos and backups.', { replies: 3 });
  post('tech', 2, 1, now - 4 * H, '', 'A mini PC.');
  post('tech', 3, 1, now - 3 * H, '', '>>2\nWhich one?');
  post('tech', 4, 1, now - 2 * H, '', '>>3\nAny with an N100.');
  post('tech', 5, 5, now - 1 * H, 'Hidden one', 'reported', { hidden: 1 });
  post('cooking', 1, 1, now - 30 * H, 'Best pancakes', 'Buttermilk, and let the batter rest.');
  post('late', 1, 1, now - 1 * H, 'After dark', 'adult words');
  return env;
}
