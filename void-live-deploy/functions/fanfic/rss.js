// /fanfic/'s feed (sycophanthex.com lists its most recent stories and offers them by feed): /fanfic/rss, the newest stories in every fandom,
// read from the open boards the same way the page reads them (lib/fanfic.js isFicBoard, topicOf), written by lib/fanfic.js storiesRss.
// An empty archive is a feed with no items: nothing is seeded.
import { onRequestGet as boards } from '../api/boards/[[path]].js';
import { isFicBoard, topicOf, readChallenge, storiesRss } from '../../lib/fanfic.js';
const SITE = 'https://a-to-mind.com';
const read = async (ctx, qs) => {
  try { const r = await boards({ ...ctx, params: { path: [] }, request: new Request(SITE + '/api/boards' + qs) }); return await r.json(); } catch (_) { return {}; }
};
export async function onRequestGet(ctx) {
  const all = await read(ctx, ''), fic = (all.boards || []).filter((b) => isFicBoard(b) && !b.nsfw).sort((a, b) => (b.last || b.created || 0) - (a.last || a.created || 0)).slice(0, 40);
  const lists = await Promise.all(fic.map((b) => read(ctx, '?b=' + encodeURIComponent(b.code))));
  const topics = [];
  fic.forEach((b, i) => { for (const t of lists[i].threads || []) if (!t.hidden && !readChallenge(t.body)) topics.push(topicOf(t, b)); }); // a writing challenge is not a story
  return new Response(storiesRss(topics, SITE), { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'public, max-age=600' } });
}
