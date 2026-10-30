// a-to-mind.com/boards/t/<board>/<no>: a thread's share link, with a preview (owner, 2026-10-25: "everything they do and more", share links with
// previews). A chat app or a search engine reading the link gets the thread's subject and first words as its title and description, rendered here,
// and a person is sent on to /boards/?b=<board>&t=<thread>#p<no>. The preview never carries a posted picture (a stranger's upload is not put in
// anyone's chat unasked) and an 18+ board's thread says only that it is on an 18+ board. Read only; a hidden or deleted post previews as gone.
import { excerpt } from '../../../lib/boards.js';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** the share page for one post (row: the post and its board, or null). Pure. */
export function sharePage(code, no, row, origin = 'https://a-to-mind.com') {
  const to = row ? '/boards/?b=' + code + '&t=' + row.thread + '#p' + no : '/boards/?b=' + code;
  const title = row ? (row.nsfw ? '/' + code + '/ (18+) · No. ' + no : '/' + code + '/ · ' + (row.sub || excerpt(row.body, 60) || 'No. ' + no)) : '/' + code + '/ · Verse boards';
  const said = row ? (row.nsfw ? 'A thread on an 18+ board. Open it to see it.' : excerpt(row.body, 200) || 'A post on /' + code + '/.') : 'This post is gone, or it never was.';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + ' · Verse</title>'
    + '<meta name="robots" content="noindex"><meta name="description" content="' + esc(said) + '"><meta property="og:type" content="article"><meta property="og:site_name" content="Verse boards">'
    + '<meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(said) + '"><meta property="og:url" content="' + esc(origin + '/boards/t/' + code + '/' + no) + '">'
    + '<meta property="og:image" content="' + esc(origin) + '/og.png"><meta name="twitter:card" content="summary"><meta http-equiv="refresh" content="0;url=' + esc(to) + '">'
    + '<style>body{font:16px/1.5 system-ui,sans-serif;max-width:600px;margin:40px auto;padding:0 16px}</style></head><body><p><a href="' + esc(to) + '">' + esc(title) + '</a></p><p>' + esc(said) + '</p></body></html>';
}
export async function onRequestGet({ request, env, params }) {
  const [code = '', n = ''] = [].concat((params && params.path) || []);
  if (!/^[a-z0-9]{1,10}$/.test(code) || !/^\d{1,9}$/.test(n)) return new Response('Not found', { status: 404 });
  let row = null;
  try {
    if (env.DB) row = await env.DB.prepare('SELECT p.thread, p.sub, p.body, p.hidden, p.deleted, b.nsfw FROM void_board_posts p JOIN void_boards b ON b.code = p.board WHERE p.board = ? AND p.no = ?').bind(code, +n).first();
    if (row && (row.hidden || row.deleted)) row = null;
  } catch (_) { row = null; }
  return new Response(sharePage(code, +n, row, new URL(request.url).origin), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60', 'x-content-type-options': 'nosniff' } });
}
