// Verse's social page (/social/, the Reddit floor), the pure half. /social/ is a front page on Verse's own boards (functions/api/boards/, the
// void_boards and void_board_posts tables): a board is a community, a thread is a post, its replies are the comments. Added here: votes (one per
// post per connection, functions/api/social.js), hot, new and top, comments as a tree (a reply hangs under the first earlier post it quotes with >>n),
// and an RSS feed per community. Shared by lib/social-ui.js and functions/api/social.js; tests in tools/social.test.mjs.
import { quotesIn } from './boards.js';
export const SORTS = Object.freeze(['hot', 'new', 'top']), SPANS = Object.freeze({ day: 864e5, week: 7 * 864e5, month: 30 * 864e5, all: 0 });
export const COMMENT_SORTS = Object.freeze(['best', 'new', 'old']);
const EPOCH = Date.UTC(2026, 0, 1);
/** a post's score: one for being posted, plus up votes, minus down votes. Pure. */
export const scoreOf = (p) => 1 + (Number(p.votes) || 0);
/** Reddit's published hot rank: the order of magnitude of the score, plus the age (12.5 hours lift a post as much as a tenfold score). Pure. */
export function hot(p) { const s = scoreOf(p), o = Math.log10(Math.max(Math.abs(s), 1)), sign = s > 0 ? 1 : s < 0 ? -1 : 0; return Math.round((sign * o + ((p.at || 0) - EPOCH) / 45000e3) * 1e7) / 1e7; }
/** posts in a feed's order: hot, new, or top (score, within a span: day, week, month or all). Pure. */
export function sortPosts(posts, sort = 'hot', span = 'all', now = Date.now()) {
  const list = SPANS[span] && sort === 'top' ? posts.filter((p) => now - (p.at || 0) <= SPANS[span]) : [...posts];
  if (sort === 'new') return list.sort((a, b) => b.at - a.at || b.no - a.no);
  if (sort === 'top') return list.sort((a, b) => scoreOf(b) - scoreOf(a) || (b.replies || 0) - (a.replies || 0) || b.at - a.at);
  return list.sort((a, b) => hot(b) - hot(a) || b.at - a.at);
}
/** a thread's comments as a tree: [{ post, kids: [...] }]. A reply hangs under the first post it quotes (>>n) that came before it in the thread;
 *  one that quotes nothing, or only the post, is a top-level comment. Siblings in the comment order: best (score, then replies under it), new, old. Pure. */
export function tree(op, posts, sort = 'best') {
  const nodes = new Map(), top = [];
  for (const p of posts) if (p.no !== op.no) nodes.set(p.no, { post: p, kids: [] });
  for (const p of posts) {
    if (p.no === op.no) continue;
    const parent = quotesIn(p.body).find((n) => n !== op.no && n < p.no && nodes.has(n));
    (parent ? nodes.get(parent).kids : top).push(nodes.get(p.no));
  }
  const size = (n) => n.kids.reduce((a, k) => a + 1 + size(k), 0);
  const cmp = sort === 'new' ? (a, b) => b.post.no - a.post.no : sort === 'old' ? (a, b) => a.post.no - b.post.no : (a, b) => scoreOf(b.post) - scoreOf(a.post) || size(b) - size(a) || a.post.no - b.post.no;
  const order = (list) => { list.sort(cmp); for (const n of list) order(n.kids); return list; };
  return order(top);
}
/** a post's body without the >>n quote that only says where it hangs in the tree (its first line, when that line is only the quote). Pure. */
export const withoutLead = (body) => String(body || '').replace(/^>>\d{1,9}[ \t]*\n?/, '');
/** a vote in a request: +1, -1 or 0 (taking a vote back), else null. Pure. */
export const voteOf = (v) => (v === 1 || v === -1 || v === 0 ? v : null);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
/** an RSS 2.0 feed of a community's newest posts (or every community's: board null): titles, links to /social/, the words cut. Pure. */
export function rss(origin, board, posts) {
  const link = origin + '/social/' + (board ? '?b=' + board.code : '');
  const item = (p) => '<item><title>' + esc(p.sub || String(p.body || '').slice(0, 80) || 'Post ' + p.no) + '</title><link>' + esc(origin + '/social/?b=' + p.board + '&t=' + p.no) + '</link><guid isPermaLink="false">verse-' + esc(p.board) + '-' + p.no + '</guid><pubDate>' + new Date(p.at).toUTCString() + '</pubDate><description>' + esc(String(p.body || '').slice(0, 600)) + '</description></item>';
  return '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>' + esc(board ? board.title + ' · Verse social' : 'Verse social') + '</title><link>' + esc(link) + '</link><description>' + esc(board ? board.about || board.title : 'Every community on Verse') + '</description>' + posts.map(item).join('') + '</channel></rss>\n';
}
/** "open on Reddit": Reddit's own public search for the same words (communities, or posts), a plain link, nothing fetched from Reddit. Pure. */
export const redditSearch = (q, type = 'posts') => 'https://www.reddit.com/search/?q=' + encodeURIComponent(String(q || '').slice(0, 120)) + (type === 'communities' ? '&type=communities' : '');
/** Reddit's public share-to-Reddit link (its submit page with the address and title filled in). Pure. */
export const redditSubmit = (url, title) => 'https://www.reddit.com/submit?url=' + encodeURIComponent(url) + '&title=' + encodeURIComponent(String(title || '').slice(0, 300));
/** "3 h ago" in English or German. Pure. */
export function ago(t, lang = 'en', now = Date.now()) {
  const s = Math.max(0, (now - t) / 1000), de = lang === 'de';
  if (s < 60) return de ? 'gerade eben' : 'just now';
  const [n, u] = s < 3600 ? [Math.floor(s / 60), de ? 'Min.' : 'min'] : s < 86400 ? [Math.floor(s / 3600), de ? 'Std.' : 'h'] : [Math.floor(s / 86400), de ? 'T.' : 'd'];
  return de ? 'vor ' + n + ' ' + u : n + ' ' + u + ' ago';
}
