/**
 * social skill - Verse's social feed card: public posts from X, Bluesky and Mastodon by link or handle, through each
 * network's official embed or open public API (no login, no keys, nothing stored). X: the official blockquote embed with
 * platform.twitter.com/widgets.js (posts by link). Bluesky: embed.bsky.app for a post link; the public AppView
 * (public.api.bsky.app, app.bsky.feed.getAuthorFeed) for a handle. Mastodon: the server's own /embed for a post link;
 * /api/v1/accounts/lookup + statuses for @user@server. Contract: { name, examples, nearMisses, match, run }.
 */
import { ensure as stickyNote } from './sticky.js';
/** what to show: { net, kind: 'post'|'handle', ... } | { open: true } | null. Pure. */
export function socialAsk(text) {
  const raw = String(text || '').trim().replace(/[?!.]+$/, ''), t = raw.toLowerCase();
  let m = raw.match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})\S*$/);
  if (m) return { net: 'x', kind: 'post', user: m[1], id: m[2], url: 'https://twitter.com/' + m[1] + '/status/' + m[2] };
  m = raw.match(/^https?:\/\/bsky\.app\/profile\/([A-Za-z0-9.:-]{3,253})\/post\/([a-z0-9]{5,20})$/);
  if (m) return { net: 'bsky', kind: 'post', actor: m[1], rkey: m[2] };
  m = raw.match(/^https?:\/\/([a-z0-9.-]+\.[a-z]{2,})\/@([A-Za-z0-9_]{1,30})\/(\d{5,25})$/);
  if (m) return { net: 'mastodon', kind: 'post', server: m[1], user: m[2], id: m[3] };
  m = raw.match(/^(?:(?:show|open|follow)\s+)?@([A-Za-z0-9_]{1,30})@([a-z0-9.-]+\.[a-z]{2,})(?:\s+(?:feed|posts))?$/i);
  if (m) return { net: 'mastodon', kind: 'handle', user: m[1], server: m[2].toLowerCase() };
  m = t.match(/^(?:(?:show|open|follow)\s+)?(?:(?:the\s+)?(?:bluesky|bsky)\s+(?:feed|posts)\s+(?:of|for|from)\s+@?([a-z0-9.-]{3,60})|@?([a-z0-9-]+(?:\.[a-z0-9-]+)*\.bsky\.(?:social|app|team))(?:\s+(?:feed|posts))?)$/);
  if (m) { const h = m[1] || m[2]; return { net: 'bsky', kind: 'handle', actor: h.includes('.') ? h : h + '.bsky.social' }; }
  if (/^(?:(?:open|show)\s+)?(?:the\s+|my\s+)?(?:social\s+(?:feed|card|media\s+feed)|feed\s+card)$/.test(t)|/^how\s+to\s+.*\s+(?:instagram|x|twitter|bluesky|bsky|mastodon).*/.test(t)) return { open: true };
  return null;
}
const ago = (d) => { const s = (Date.now() - new Date(d)) / 1000; return s < 3600 ? Math.max(1, Math.round(s / 60)) + 'm' : s < 86400 ? Math.round(s / 3600) + 'h' : Math.round(s / 86400) + 'd'; };
export const strip = (h) => String(h || '').replace(/<br\s*\/?>/g, '\n').replace(/<\/p>/g, '\n\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const post = (esc, who, when, body, link) => '<div class="sc-post" data-text="' + esc(String(body || '').slice(0, 280)) + '" style="border-top:1px solid rgba(255,255,255,.1);padding:8px 0;white-space:pre-line"><b>' + esc(who) + '</b> <span class="g-sub">' + esc(when) + '</span><br>' + esc(String(body || '').slice(0, 600)) + (link ? ' <a href="' + esc(link) + '" target="_blank" rel="noopener">open ↗</a>' : '') + ' <button type="button" class="g-btn sc-keep" style="font-size:11px;padding:2px 8px">keep on stage</button></div>';
/** a Bluesky author feed as rows (owner, 2026-10-21: a handle's feed mixed in other people's posts it had reposted): each post with who
 *  wrote it, and a repost labelled with who reposted it, never passed off as the handle's own. { who, handle, at, text, link, repost, by }. Pure. */
export function bskyRows(feed) {
  return (Array.isArray(feed) ? feed : []).filter((f) => f && f.post && f.post.author && f.post.record).map((f) => {
    const p = f.post, rp = f.reason && /reasonRepost/.test(String(f.reason.$type || '')) && f.reason.by;
    return { who: p.author.displayName || p.author.handle, handle: p.author.handle, at: p.indexedAt || '', text: String(p.record.text || ''), link: 'https://bsky.app/profile/' + p.author.handle + '/post/' + String(p.uri || '').split('/').pop(), repost: !!rp, by: rp ? rp.handle : '' };
  });
}
/** a Mastodon account's statuses as the same rows: a boost is labelled with who boosted it and keeps the original author. Pure. */
export function mastoRows(statuses, acct) {
  return (Array.isArray(statuses) ? statuses : []).filter(Boolean).map((st) => { const o = st.reblog || st, a = o.account || acct || {};
    return { who: a.display_name || a.username || '', handle: a.acct || a.username || '', at: o.created_at || '', text: strip(o.content), link: o.url || st.url || '', repost: !!st.reblog, by: st.reblog ? (acct && (acct.acct || acct.username)) || '' : '' }; });
}
/** the rows on the card: a repost says so above the post; the same rows ride along as JSON for other agents (data-feed, and a copy button). */
const rowsHtml = (esc, rows, net) => rows.map((r) => (r.repost ? '<div class="g-sub sc-repost" data-repost="1" style="font-size:11px;margin-top:6px">↻ reposted by @' + esc(r.by) + '</div>' : '') + post(esc, r.who, r.at ? ago(r.at) : '', r.text, r.link)).join('')
  + '<details class="sc-json" data-share-skip="1" style="margin-top:8px;font-size:12px"><summary>Feed data (JSON, for agents)</summary><button type="button" class="g-btn sc-copy-json" style="font-size:11px;padding:2px 8px">copy JSON</button><pre data-feed="' + esc(net) + '" style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto">' + esc(JSON.stringify({ network: net, posts: rows }, null, 1)) + '</pre></details>';
/** the sticky-note text for a kept post: who, the words, the link. Pure. */
export const keptText = (who, body, link) => (String(who || '') + ': ' + String(body || '').replace(/\s+/g, ' ').trim()).slice(0, 280) + (link ? '\n' + link : '');
async function run(text, api) {
  const { showPage, esc } = api; const q = socialAsk(text);
  if (!q) return 'none';
  const el = showPage((p) => { p.className += ' social-card'; p.innerHTML = '<h2>Social</h2><div class="sc-body"><p class="g-sub">loading…</p></div>'; });
  // asked by Verse (2026-10-22): a post becomes a stage thing, kept as a sticky note you can drag, link or turn into a task
  el.addEventListener('click', (e) => { const c = e.target.closest && e.target.closest('.sc-copy-json'); if (c) { const pre = el.querySelector('pre[data-feed]'); try { navigator.clipboard.writeText(pre.textContent); c.textContent = 'copied ✓'; } catch (_) {} } });
  el.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.sc-keep'); if (!b || !api.stage) return; e.stopPropagation();
    const row = b.closest('.sc-post'), a = row.querySelector('a[href]');
    stickyNote(api.stage, keptText(row.querySelector('b').textContent, row.dataset.text || '', a && a.href), true); api.stage.save(); api.stage.render(); b.textContent = 'kept ✓'; b.disabled = true; });
  const body = el.querySelector('.sc-body'), src = (s) => el.insertAdjacentHTML('beforeend', '<div class="src">' + s + ' · public posts only · nothing stored</div>');
  try {
    if (q.open) { body.innerHTML = '<p>Paste a post link from X, Bluesky or Mastodon, or ask for a handle:</p><ul><li><a data-ask="bsky.app.bsky.social feed" href="#">bsky.app on Bluesky</a></li><li><a data-ask="@Mastodon@mastodon.social" href="#">@Mastodon@mastodon.social</a></li></ul><p class="g-sub" style="font-size:12px">The start of Verse social: read-only public feeds. Posting, DMs and your own timeline need sign-in to each network (docs/everything-app.md).</p>'; return 'social'; }
    if (q.net === 'x') {
      body.innerHTML = '<blockquote class="twitter-tweet" data-theme="dark"><a href="' + esc(q.url) + '">Post by @' + esc(q.user) + ' on X</a></blockquote>';
      const s = document.createElement('script'); s.async = true; s.src = 'https://platform.twitter.com/widgets.js'; body.appendChild(s);
      src('Official X embed'); return 'social';
    }
    if (q.net === 'bsky') {
      const did = q.actor.startsWith('did:') ? q.actor : (await fetch('https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=' + encodeURIComponent(q.actor)).then((r) => r.json())).did;
      if (!did) throw 0;
      if (q.kind === 'post') { body.innerHTML = '<iframe title="Bluesky post" src="https://embed.bsky.app/embed/' + esc(did) + '/app.bsky.feed.post/' + esc(q.rkey) + '" style="width:100%;height:420px;border:0;border-radius:10px;background:#fff"></iframe>'; src('Official Bluesky embed'); return 'social'; }
      const j = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?limit=8&filter=posts_no_replies&actor=' + encodeURIComponent(did)).then((r) => r.json());
      body.innerHTML = '<p><b>@' + esc(q.actor) + '</b> on Bluesky</p>' + rowsHtml(esc, bskyRows(j.feed), 'bluesky');
      src('Source: Bluesky public API'); return 'social';
    }
    if (q.kind === 'post') { body.innerHTML = '<iframe title="Mastodon post" src="https://' + esc(q.server) + '/@' + esc(q.user) + '/' + esc(q.id) + '/embed" style="width:100%;height:420px;border:0;border-radius:10px"></iframe>'; src('Official Mastodon embed from ' + esc(q.server)); return 'social'; }
    const acct = await fetch('https://' + q.server + '/api/v1/accounts/lookup?acct=' + encodeURIComponent(q.user)).then((r) => { if (!r.ok) throw 0; return r.json(); });
    const sts = await fetch('https://' + q.server + '/api/v1/accounts/' + encodeURIComponent(acct.id) + '/statuses?limit=8&exclude_replies=true').then((r) => r.json());
    body.innerHTML = '<p><b>@' + esc(q.user) + '@' + esc(q.server) + '</b></p>' + rowsHtml(esc, mastoRows(sts, acct), 'mastodon');
    src('Source: ' + esc(q.server) + ' public API'); return 'social';
  } catch (_) { body.innerHTML = '<p>That network didn\'t answer, or the handle wasn\'t found.</p>'; return 'social'; }
}
export default {
  name: 'social',
  examples: ['social feed', 'bsky.app.bsky.social feed', 'bluesky feed of jay.bsky.team', '@Mastodon@mastodon.social', 'https://x.com/XDevelopers/status/1861111969639481848', 'https://bsky.app/profile/bsky.app/post/3l6oveex3ii2l'],
  nearMisses: ['what is bluesky', 'social security', 'my email', 'twitter stock'],
  match(lower, text) { return !!socialAsk(text || lower); },
  run,
};
