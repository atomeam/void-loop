// /social/: the screen of Verse's social page, a front page on Verse's own boards (lib/social-core.js; posts, replies, reports and communities go
// through /api/boards with its bot check, rates and bans; votes, the feed and RSS through /api/social). Kept on this device (localStorage
// a2m.void.social.v1): the communities you follow, posts you saved or hid, your own votes (to show them), the 18+ choice and the last feed seen.
import { render, doWork, TYPES, LIMITS as BL, REPORT_WHY } from './boards.js';
import { sortPosts, tree, withoutLead, scoreOf, redditSearch, redditSubmit, ago, SORTS, COMMENT_SORTS } from './social-core.js';

const STORE = 'a2m.void.social.v1', BAPI = '/api/boards', SAPI = '/api/social';
const S = {
  en: { home: 'Home', popular: 'Popular', communities: 'Communities', saved: 'Saved', search: 'Search', create: 'Create post', hot: 'Hot', new: 'New', top: 'Top', day: 'Today', week: 'This week', month: 'This month', all: 'All time',
    homeEmpty: 'Your home feed shows the communities you follow. Follow some under Communities; until then, here is everything.', follow: 'Follow', following: 'Following', comments: (n) => n + (n === 1 ? ' comment' : ' comments'), up: 'Upvote', down: 'Downvote',
    save: 'Save', unsave: 'Saved', hide: 'Hide', share: 'Share', copied: 'Link copied', onReddit: 'Find this on Reddit', toReddit: 'Share on Reddit', report: 'Report', reply: 'Reply', addComment: 'Add a comment', sortBy: 'Sort comments', best: 'Best', old: 'Old',
    collapse: 'Hide replies', expand: (n) => 'Show ' + n + (n === 1 ? ' reply' : ' replies'), rss: 'RSS feed', title: 'Title', text: 'Text', picture: 'Picture', community: 'Community', post: 'Post', posting: 'Posting…', why: 'Why?', send: 'Send report', cancel: 'Cancel',
    picNeeded: 'A new post in this community starts with a picture.', textOnly: 'Text posts only here.', noPosts: 'No posts here yet. Be the first.', offline: 'The communities cannot be reached right now: this is the last feed this device saw.',
    start: 'Start a community', code: 'Short name (a to z, 0 to 9)', ctitle: 'Name', about: 'What it is about', adult: '18+ community', textOnlyC: 'Text posts only', makeIt: 'Start it', showAdult: 'Show 18+ communities',
    searchPh: 'Words in a title or post', results: (n) => n + ' found', posts: (n) => n + ' posts', back: 'Back', votesNote: 'One vote per post per connection. Votes order the feed: hot (score and age), new, top.',
    rules: 'Rules', check: 'A short check that you are a person runs on this device while you write.', checked: 'Checked: you can post.', checking: 'Checking you are a person on this device…', reported: 'Reported.', nothingSaved: 'Nothing saved yet: tap Save on a post.',
    about2: 'Communities, a feed sorted hot, new or top, posts and threaded comments, votes, following and RSS, on Verse’s own boards. No account; the communities you follow stay on this device.', op: 'Original post', anon: 'Anonymous', hidden: 'hidden while it is looked at (reported)', deleted: 'deleted' },
  de: { home: 'Start', popular: 'Beliebt', communities: 'Communities', saved: 'Gespeichert', search: 'Suche', create: 'Beitrag erstellen', hot: 'Angesagt', new: 'Neu', top: 'Top', day: 'Heute', week: 'Diese Woche', month: 'Diesen Monat', all: 'Alle Zeiten',
    homeEmpty: 'Ihr Start-Feed zeigt die Communities, denen Sie folgen. Folgen Sie welchen unter Communities; bis dahin sehen Sie hier alles.', follow: 'Folgen', following: 'Gefolgt', comments: (n) => n + (n === 1 ? ' Kommentar' : ' Kommentare'), up: 'Hochstimmen', down: 'Runterstimmen',
    save: 'Speichern', unsave: 'Gespeichert', hide: 'Ausblenden', share: 'Teilen', copied: 'Link kopiert', onReddit: 'Auf Reddit finden', toReddit: 'Auf Reddit teilen', report: 'Melden', reply: 'Antworten', addComment: 'Einen Kommentar schreiben', sortBy: 'Kommentare sortieren', best: 'Beste', old: 'Alt',
    collapse: 'Antworten ausblenden', expand: (n) => n + (n === 1 ? ' Antwort zeigen' : ' Antworten zeigen'), rss: 'RSS-Feed', title: 'Titel', text: 'Text', picture: 'Bild', community: 'Community', post: 'Posten', posting: 'Wird gepostet…', why: 'Warum?', send: 'Meldung senden', cancel: 'Abbrechen',
    picNeeded: 'Ein neuer Beitrag in dieser Community beginnt mit einem Bild.', textOnly: 'Hier nur Textbeiträge.', noPosts: 'Hier gibt es noch keine Beiträge. Seien Sie die oder der Erste.', offline: 'Die Communities sind gerade nicht erreichbar: Das ist der letzte Feed, den dieses Gerät gesehen hat.',
    start: 'Eine Community gründen', code: 'Kurzname (a bis z, 0 bis 9)', ctitle: 'Name', about: 'Worum es geht', adult: 'Community ab 18', textOnlyC: 'Nur Textbeiträge', makeIt: 'Gründen', showAdult: 'Communities ab 18 zeigen',
    searchPh: 'Wörter in einem Titel oder Beitrag', results: (n) => n + ' gefunden', posts: (n) => n + ' Beiträge', back: 'Zurück', votesNote: 'Eine Stimme pro Beitrag und Verbindung. Die Stimmen ordnen den Feed: angesagt (Punkte und Alter), neu, top.',
    rules: 'Regeln', check: 'Eine kurze Prüfung, dass Sie ein Mensch sind, läuft auf diesem Gerät, während Sie schreiben.', checked: 'Geprüft: Sie können posten.', checking: 'Prüfung auf diesem Gerät läuft…', reported: 'Gemeldet.', nothingSaved: 'Noch nichts gespeichert: Tippen Sie bei einem Beitrag auf Speichern.',
    about2: 'Communities, ein Feed nach angesagt, neu oder top, Beiträge und Kommentare als Baum, Stimmen, Folgen und RSS, auf den eigenen Boards von Verse. Kein Konto; denen Sie folgen, bleibt auf diesem Gerät.', op: 'Ursprünglicher Beitrag', anon: 'Anonym', hidden: 'ausgeblendet, solange es geprüft wird (gemeldet)', deleted: 'gelöscht' },
};
const load = () => { try { const j = JSON.parse(localStorage.getItem(STORE) || 'null'); if (j && typeof j === 'object') return { follow: [], saved: [], hidden: [], votes: {}, adult: false, feed: null, ...j }; } catch (_) { /* blocked storage */ } return { follow: [], saved: [], hidden: [], votes: {}, adult: false, feed: null }; };
// h(): `html` is only ever lib/boards.js render() output, which escapes every character first (tools/boards.test.mjs). void-review: ok
const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v === true ? '' : v); } for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : String(k)); return e; };

export function mountSocial(root, { lang = 'en', fetchFn = (...a) => fetch(...a) } = {}) {
  const T = S[lang] || S.en, st = load();
  const keep = () => { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (_) { /* full or blocked: kept for this visit only */ } };
  const pw = (() => { try { const b = JSON.parse(localStorage.getItem('a2m.void.boards.v1') || '{}'); if (b.pw) return b.pw; } catch (_) {} if (!st.pw) { const r = new Uint8Array(12); crypto.getRandomValues(r); st.pw = [...r].map((x) => x.toString(16).padStart(2, '0')).join(''); keep(); } return st.pw; })(); // the delete password the boards page uses on this device, if it made one
  const api = async (base, qs = '', init) => { try { const r = await fetchFn(base + qs, init); let j = {}; try { j = await r.json(); } catch (_) {} return { status: r.status, ...j }; } catch (_) { return { status: 0, ok: false }; } };
  const live = h('p', { class: 'live', role: 'status', 'aria-live': 'polite' }), body = h('div', { class: 'sbody' });
  const say = (t) => { live.textContent = t; clearTimeout(say.t); say.t = setTimeout(() => { live.textContent = ''; }, 4000); };
  root.replaceChildren(live, body);
  let boardsList = null; const boardsP = () => boardsList ? Promise.resolve(boardsList) : api(BAPI).then((j) => (boardsList = j.ok ? j.boards : []));
  const params = () => new URLSearchParams(location.search);
  const go = (qs, push = true) => { const u = '/social/' + (qs ? '?' + qs : ''); if (push) history.pushState(null, '', u); else history.replaceState(null, '', u); draw(); scrollTo(0, 0); };
  addEventListener('popstate', () => draw());

  // ---- the bot check (the boards' own: Turnstile when set up, else a proof of work done on this device) ----
  let cfg = null; const cfgP = api(BAPI, '?config').then((c) => (cfg = c));
  function botFor(box) {
    let work = null, token = '', wid = null;
    const startWork = () => work || (work = (async () => { const c = await api(BAPI, '?challenge'); if (!c.ok) throw new Error(c.say || 'no challenge'); box.textContent = T.checking; const n = await doWork(c.c, c.bits); box.textContent = T.checked; return { c: c.c, sig: c.sig, n }; })());
    const ready = cfgP.then(async () => {
      if (cfg && cfg.turnstile) { const ts = await new Promise((res, rej) => { if (window.turnstile) return res(window.turnstile); const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = () => res(window.turnstile); s.onerror = rej; document.head.append(s); }); wid = ts.render(box, { sitekey: cfg.turnstile, callback: (t) => { token = t; } }); }
      else { box.textContent = T.check; startWork().catch(() => {}); }
    });
    return { async proof() { await ready; if (cfg && cfg.turnstile) { if (!token) throw new Error('finish the check first'); return { turnstile: token }; } return startWork(); }, reset() { work = null; token = ''; try { window.turnstile && window.turnstile.reset(wid); } catch (_) {} } };
  }

  // ---- pieces ----
  const tabs = (on) => h('nav', { class: 'tabs', 'aria-label': 'Social' }, ...[['home', T.home], ['popular', T.popular], ['communities', T.communities], ['saved', T.saved], ['search', T.search]].map(([k, l]) => h('button', { 'aria-current': on === k ? 'page' : false, 'data-tab': k, on: { click: () => go(k === 'home' ? '' : 'tab=' + k) } }, l)),
    h('button', { class: 'go', id: 's-create', on: { click: () => go('tab=create' + (params().get('b') ? '&b=' + params().get('b') : '')) } }, T.create));
  const myVote = (b, no) => st.votes[b + '/' + no] || 0;
  function voteBox(p, b) {
    const box = h('div', { class: 'vote', role: 'group', 'aria-label': 'Score' });
    const paint = () => { box.replaceChildren(
      h('button', { class: 'vb' + (myVote(b, p.no) === 1 ? ' on' : ''), 'aria-label': T.up, 'aria-pressed': myVote(b, p.no) === 1 ? 'true' : 'false', on: { click: () => cast(1) } }, '▲'),
      h('span', { class: 'score', 'aria-label': 'score ' + scoreOf(p) }, String(scoreOf(p))),
      h('button', { class: 'vb' + (myVote(b, p.no) === -1 ? ' on' : ''), 'aria-label': T.down, 'aria-pressed': myVote(b, p.no) === -1 ? 'true' : 'false', on: { click: () => cast(-1) } }, '▼')); };
    async function cast(v) {
      const was = myVote(b, p.no), next = was === v ? 0 : v; st.votes[b + '/' + p.no] = next; p.votes = (p.votes || 0) - was + next; keep(); paint();
      const j = await api(SAPI, '', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ do: 'vote', b, no: p.no, v: next }) });
      if (j.ok) { p.votes = j.votes; paint(); } else { st.votes[b + '/' + p.no] = was; p.votes = (p.votes || 0) - next + was; keep(); paint(); say(j.say || 'not counted'); }
    }
    paint(); return box;
  }
  const linkTo = (b, t) => location.origin + '/social/?b=' + b + (t ? '&t=' + t : '');
  async function share(url, title) { try { if (navigator.share) { await navigator.share({ title, url }); return; } } catch (_) { return; } try { await navigator.clipboard.writeText(url); say(T.copied); } catch (_) { prompt(T.share, url); } }
  const isSaved = (b, no) => st.saved.some((s) => s.b === b && s.no === no);
  function actions(p, b, inThread) {
    const row = h('div', { class: 'acts' });
    if (!inThread) row.append(h('a', { class: 'btn', href: '/social/?b=' + b + '&t=' + p.no, on: { click: (e) => { e.preventDefault(); go('b=' + b + '&t=' + p.no); } } }, '💬 ' + T.comments(p.replies || 0)));
    row.append(h('button', { on: { click: () => share(linkTo(b, p.no), p.sub || 'Verse') } }, T.share));
    row.append(h('button', { 'aria-pressed': isSaved(b, p.no) ? 'true' : 'false', on: { click: (e) => { if (isSaved(b, p.no)) st.saved = st.saved.filter((s) => !(s.b === b && s.no === p.no)); else st.saved.unshift({ b, no: p.no, sub: p.sub || String(p.body || '').slice(0, 80), at: p.at, btitle: p.btitle || b }); keep(); e.target.textContent = isSaved(b, p.no) ? T.unsave : T.save; e.target.setAttribute('aria-pressed', isSaved(b, p.no) ? 'true' : 'false'); } } }, isSaved(b, p.no) ? T.unsave : T.save));
    if (!inThread) row.append(h('button', { on: { click: () => { st.hidden.push(b + '/' + p.no); keep(); draw(); } } }, T.hide));
    row.append(h('a', { class: 'btn', href: redditSubmit(linkTo(b, p.no), p.sub || ''), target: '_blank', rel: 'noopener noreferrer' }, T.toReddit));
    row.append(reportBtn(p, b));
    return row;
  }
  function reportBtn(p, b) {
    const wrap = h('span', { class: 'rep' });
    const btn = h('button', { on: { click: () => {
      const sel = h('select', { 'aria-label': T.why }, ...REPORT_WHY.map((w) => h('option', { value: w }, w))), box = h('div', { class: 'soft' }), bot = botFor(box), note = h('span', { class: 'soft' });
      const f = h('div', { class: 'panel' }, h('label', {}, T.why + ' ', sel), box, h('div', { class: 'row' }, h('button', { on: { click: async () => { try { const proof = await bot.proof(); const r = await api(BAPI, '', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ do: 'report', b, no: p.no, why: sel.value, proof }) }); note.textContent = r.say || (r.ok ? T.reported : 'not sent'); if (r.ok) setTimeout(() => f.remove(), 1500); else bot.reset(); } catch (e) { note.textContent = e.message; } } } }, T.send), h('button', { on: { click: () => f.remove() } }, T.cancel), note));
      wrap.after(f);
    } } }, T.report);
    wrap.append(btn); return wrap;
  }
  function card(p) {
    const b = p.board;
    const a = h('article', { class: 'card', 'data-b': b, 'data-no': String(p.no) });
    a.append(voteBox(p, b));
    const main = h('div', { class: 'cmain' },
      h('div', { class: 'meta' }, h('a', { href: '/social/?b=' + b, on: { click: (e) => { e.preventDefault(); go('b=' + b); } } }, 'v/' + b), ' · ' + ago(p.at, lang), p.nsfw ? h('span', { class: 'nsfw' }, ' 18+') : ''),
      h('h3', {}, h('a', { href: '/social/?b=' + b + '&t=' + p.no, on: { click: (e) => { e.preventDefault(); go('b=' + b + '&t=' + p.no); } } }, p.sub || String(p.body || '').slice(0, 90) || '…')),
      p.file ? h('img', { class: 'thumb', src: p.file.thumb, alt: p.sub || T.picture, width: String(p.file.tw || 120), height: String(p.file.th || 90), loading: 'lazy' }) : '',
      p.sub && p.body ? h('p', { class: 'excerpt' }, String(p.body).slice(0, 220)) : '',
      actions(p, b, false));
    a.append(main); return a;
  }
  const sortRow = (sort, span, base) => h('div', { class: 'row sorts', role: 'group', 'aria-label': 'Sort' },
    ...SORTS.map((s) => h('button', { class: 'chip', 'aria-pressed': sort === s ? 'true' : 'false', on: { click: () => go([base, 'sort=' + s].filter(Boolean).join('&')) } }, T[s])),
    sort === 'top' ? h('select', { 'aria-label': T.top, on: { change: (e) => go([base, 'sort=top', 'span=' + e.target.value].filter(Boolean).join('&')) } }, ...['day', 'week', 'month', 'all'].map((x) => h('option', { value: x, selected: span === x }, T[x]))) : '',
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 's-adult', checked: st.adult, on: { change: (e) => { st.adult = e.target.checked; keep(); draw(); } } }), T.showAdult));

  // ---- views ----
  async function feedView(tab, b) {
    const p = params(), sort = SORTS.includes(p.get('sort')) ? p.get('sort') : 'hot', span = p.get('span') || 'all';
    const out = h('div', {}), base = b ? 'b=' + b : tab === 'popular' ? 'tab=popular' : '';
    const codes = b ? [b] : tab === 'home' ? st.follow : [];
    if (b) {
      const bl = await boardsP(), bd = (bl || []).find((x) => x.code === b);
      const fol = st.follow.includes(b);
      out.append(h('div', { class: 'chead panel' }, h('h2', {}, bd ? bd.title : 'v/' + b), h('p', { class: 'soft' }, 'v/' + b + (bd ? ' · ' + T.posts(bd.posts) + (bd.about ? ' · ' + bd.about : '') : '')),
        h('div', { class: 'row' }, h('button', { id: 's-follow', class: fol ? '' : 'go', 'aria-pressed': fol ? 'true' : 'false', on: { click: () => { st.follow = fol ? st.follow.filter((x) => x !== b) : [...st.follow, b]; keep(); draw(); } } }, fol ? T.following : T.follow),
          h('a', { class: 'btn', href: '/api/social?rss=' + b }, T.rss), h('a', { class: 'btn', href: redditSearch(bd ? bd.title : b, 'communities'), target: '_blank', rel: 'noopener noreferrer' }, T.onReddit), h('a', { class: 'btn', href: '/boards/rules' }, T.rules))));
    } else if (tab === 'home' && !st.follow.length) out.append(h('p', { class: 'note' }, T.homeEmpty));
    out.append(sortRow(sort, span, base));
    const list = h('div', { class: 'feed', 'aria-busy': 'true' }); out.append(list);
    (async () => {
      let j = await api(SAPI, '?feed=' + sort + '&span=' + span + (codes.length ? '&b=' + codes.join(',') : '') + (st.adult ? '&adult=1' : ''));
      let posts = j.ok ? j.posts : null;
      if (!posts) { posts = (st.feed && st.feed.posts) || []; posts = sortPosts(codes.length ? posts.filter((x) => codes.includes(x.board)) : posts, sort, span); list.before(h('p', { class: 'notice' }, T.offline)); }
      else if (!b && tab !== 'home') { st.feed = { at: Date.now(), posts }; keep(); }
      else if (!codes.length) { st.feed = { at: Date.now(), posts }; keep(); }
      posts = posts.filter((x) => !st.hidden.includes(x.board + '/' + x.no));
      list.replaceChildren(...(posts.length ? posts.map(card) : [h('p', { class: 'soft' }, T.noPosts)])); list.setAttribute('aria-busy', 'false');
      document.documentElement.dataset.socialReady = '1';
    })();
    return out;
  }
  async function threadView(b, t) {
    const out = h('div', { class: 'thread' }, h('button', { id: 's-back', on: { click: () => (history.length > 1 ? history.back() : go('b=' + b)) } }, '← ' + T.back));
    const [j, v] = await Promise.all([api(BAPI, '?b=' + b + '&t=' + t), api(SAPI, '?votes=' + b + '&t=' + t)]);
    if (!j.ok) { out.append(h('p', { class: 'notice' }, j.say || T.offline)); return out; }
    const votes = (v && v.votes) || {}, all = [j.thread, ...j.posts.filter((x) => x.no !== j.thread.no)].map((x) => ({ ...x, votes: votes[x.no] || 0 })), op = all[0];
    document.title = (op.sub || 'v/' + b) + ' · Verse';
    const opEl = h('article', { class: 'card op', id: 'c' + op.no }, voteBox(op, b), h('div', { class: 'cmain' },
      h('div', { class: 'meta' }, h('a', { href: '/social/?b=' + b, on: { click: (e) => { e.preventDefault(); go('b=' + b); } } }, 'v/' + b), ' · ' + (op.name || T.anon) + (op.trip ? ' ' + op.trip : '') + ' · ' + ago(op.at, lang)),
      h('h2', {}, op.sub || ''), op.file ? h('a', { href: op.file.src, target: '_blank', rel: 'noopener' }, h('img', { class: 'full', src: op.file.thumb, alt: op.sub || T.picture, width: String(op.file.tw || 250), height: String(op.file.th || 200) })) : '',
      h('div', { class: 'pbody', html: render(op.body, { here: b, thread: op.no }) }), actions(op, b, true)));
    out.append(opEl);
    const csort = COMMENT_SORTS.includes(params().get('cs')) ? params().get('cs') : 'best';
    out.append(composer(b, t, null, j.board));
    out.append(h('div', { class: 'row' }, h('label', { for: 's-cs' }, T.sortBy), h('select', { id: 's-cs', on: { change: (e) => go('b=' + b + '&t=' + t + '&cs=' + e.target.value, false) } }, ...COMMENT_SORTS.map((s) => h('option', { value: s, selected: csort === s }, T[s] || s))), h('span', { class: 'soft' }, T.comments(all.length - 1))));
    const draw1 = (n, depth) => {
      const p = n.post, li = h('li', { class: 'cm', id: 'c' + p.no, 'data-no': String(p.no) });
      if (p.hidden) { li.append(h('p', { class: 'soft' }, '#' + p.no + ': ' + T.hidden)); return li; }
      const kids = h('ol', { class: 'kids' }, ...n.kids.map((k) => draw1(k, depth + 1)));
      const tog = n.kids.length ? h('button', { class: 'tog', 'aria-expanded': 'true', on: { click: (e) => { const open = e.target.getAttribute('aria-expanded') === 'true'; kids.hidden = open; e.target.setAttribute('aria-expanded', open ? 'false' : 'true'); e.target.textContent = open ? T.expand(n.kids.length) : T.collapse; } } }, T.collapse) : '';
      li.append(h('div', { class: 'crow' }, voteBox(p, b), h('div', { class: 'cmain' }, h('div', { class: 'meta' }, (p.name || T.anon) + (p.trip ? ' ' + p.trip : '') + ' · ' + ago(p.at, lang) + ' · #' + p.no),
        p.file ? h('a', { href: p.file.src, target: '_blank', rel: 'noopener' }, h('img', { class: 'thumb', src: p.file.thumb, alt: T.picture, width: String(p.file.tw || 120), height: String(p.file.th || 90), loading: 'lazy' })) : '',
        h('div', { class: 'pbody', html: render(withoutLead(p.body), { here: b, thread: t }) }),
        h('div', { class: 'acts' }, h('button', { class: 'replyb', on: { click: (e) => { const f = composer(b, t, p.no, j.board); e.target.closest('.cmain').append(f); const ta = f.querySelector('textarea'); if (ta) ta.focus(); } } }, T.reply), reportBtn(p, b), tog))));
      li.append(kids); return li;
    };
    out.append(h('ol', { class: 'comments', 'aria-label': T.comments(all.length - 1) }, ...tree(op, all, csort).map((n) => draw1(n, 0))));
    out.addEventListener('click', (e) => { const q = e.target.closest && e.target.closest('a.ql[data-q]'); if (q) { const el = document.getElementById('c' + q.dataset.q); if (el) { e.preventDefault(); el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); } } });
    document.documentElement.dataset.socialReady = '1';
    return out;
  }
  // a reply (under a comment: its first line quotes it, which is how it hangs in the tree) or a top-level comment
  function composer(b, t, to, board) {
    const ta = h('textarea', { rows: '3', maxlength: String(BL.body), placeholder: to ? T.reply + ' #' + to : T.addComment, 'aria-label': to ? T.reply : T.addComment, class: 'cbox' });
    const box = h('div', { class: 'soft botbox' }), note = h('span', { class: 'soft' }); let bot = null;
    ta.addEventListener('focus', () => { if (!bot) bot = botFor(box); }, { once: true });
    const send = h('button', { class: 'go', on: { click: async () => {
      const words = ta.value.trim(); if (!words) return; if (!bot) bot = botFor(box); send.disabled = true; note.textContent = T.posting;
      try { const proof = await bot.proof(); const r = await api(BAPI, '', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ do: 'post', b, t, password: pw, body: (to ? '>>' + to + '\n' : '') + words, proof }) });
        if (r.ok) { ta.value = ''; draw(); } else { note.textContent = r.say || 'not posted'; bot.reset(); } } catch (e) { note.textContent = e.message; } send.disabled = false; } } }, to ? T.reply : T.post);
    return h('div', { class: 'compose' }, ta, box, h('div', { class: 'row' }, send, note));
  }
  async function createView() {
    const bl = (await boardsP()) || [], pre = params().get('b');
    const opts = [...bl].sort((a, c) => (st.follow.includes(c.code) ? 1 : 0) - (st.follow.includes(a.code) ? 1 : 0) || c.posts - a.posts).filter((x) => st.adult || !x.nsfw);
    const sel = h('select', { id: 'p-b' }, ...opts.map((x) => h('option', { value: x.code, selected: x.code === pre }, 'v/' + x.code + ' · ' + x.title)));
    const title = h('input', { id: 'p-sub', type: 'text', maxlength: String(BL.sub) }), text = h('textarea', { id: 'p-body', rows: '6', maxlength: String(BL.body) });
    const file = h('input', { id: 'p-file', type: 'file', accept: Object.keys(TYPES).join(',') }), hint = h('p', { class: 'soft' }), box = h('div', { class: 'soft botbox' }), note = h('p', { class: 'soft', role: 'status' });
    const bot = botFor(box);
    const sync = () => { const bd = bl.find((x) => x.code === sel.value); hint.textContent = bd ? (bd.textOnly ? T.textOnly : T.picNeeded) : ''; file.closest('.field').hidden = !!(bd && bd.textOnly); };
    sel.addEventListener('change', sync);
    const btn = h('button', { class: 'go', id: 'p-go', on: { click: async () => {
      btn.disabled = true; note.textContent = T.posting;
      try {
        const data = { do: 'post', b: sel.value, t: 0, password: pw, sub: title.value, body: text.value, proof: await bot.proof() }, f = file.files && file.files[0];
        let init = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) };
        if (f) { const fd = new FormData(); fd.append('data', JSON.stringify(data)); fd.append('file', f, f.name); init = { method: 'POST', body: fd }; }
        const r = await api(BAPI, '', init);
        if (r.ok) go('b=' + r.board + '&t=' + r.thread); else { note.textContent = r.say || 'not posted'; bot.reset(); }
      } catch (e) { note.textContent = e.message; }
      btn.disabled = false;
    } } }, T.post);
    const out = h('div', { class: 'panel' }, h('h2', {}, T.create),
      h('div', { class: 'field' }, h('label', { for: 'p-b' }, T.community), sel), hint,
      h('div', { class: 'field' }, h('label', { for: 'p-sub' }, T.title), title), h('div', { class: 'field' }, h('label', { for: 'p-body' }, T.text), text),
      h('div', { class: 'field' }, h('label', { for: 'p-file' }, T.picture), file), box, h('div', { class: 'row' }, btn), note);
    setTimeout(sync, 0); document.documentElement.dataset.socialReady = '1';
    return out;
  }
  async function communitiesView() {
    const bl = (await boardsP()) || [];
    const ul = h('ul', { class: 'blist' }, ...bl.filter((x) => st.adult || !x.nsfw).map((x) => { const fol = st.follow.includes(x.code); return h('li', {},
      h('a', { href: '/social/?b=' + x.code, on: { click: (e) => { e.preventDefault(); go('b=' + x.code); } } }, h('strong', {}, x.title), ' v/' + x.code), h('span', { class: 'soft' }, ' · ' + T.posts(x.posts) + (x.nsfw ? ' · 18+' : '') + (x.about ? ' · ' + x.about : '')),
      h('button', { class: fol ? '' : 'go', 'data-follow': x.code, 'aria-pressed': fol ? 'true' : 'false', on: { click: () => { st.follow = fol ? st.follow.filter((c) => c !== x.code) : [...st.follow, x.code]; keep(); draw(); } } }, fol ? T.following : T.follow)); }));
    const code = h('input', { id: 'n-code', type: 'text', maxlength: '10', pattern: '[a-z0-9]{1,10}' }), title = h('input', { id: 'n-title', type: 'text', maxlength: String(BL.title) }), about = h('input', { id: 'n-about', type: 'text', maxlength: String(BL.about) });
    const adult = h('input', { type: 'checkbox', id: 'n-adult' }), textOnly = h('input', { type: 'checkbox', id: 'n-text', checked: true }), box = h('div', { class: 'soft botbox' }), note = h('p', { class: 'soft', role: 'status' }); let bot = null;
    code.addEventListener('focus', () => { if (!bot) bot = botFor(box); }, { once: true });
    const mk = h('button', { class: 'go', id: 'n-go', on: { click: async () => { if (!bot) bot = botFor(box); try { const r = await api(BAPI, '', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ do: 'board', code: code.value.trim().toLowerCase(), title: title.value, about: about.value, nsfw: adult.checked, textOnly: textOnly.checked, proof: await bot.proof() }) }); if (r.ok) { boardsList = null; st.follow = [...st.follow, r.code || code.value.trim().toLowerCase()]; keep(); go('b=' + (r.code || code.value.trim().toLowerCase())); } else { note.textContent = r.say || 'not made'; bot.reset(); } } catch (e) { note.textContent = e.message; } } } }, T.makeIt);
    document.documentElement.dataset.socialReady = '1';
    return h('div', {}, h('h2', {}, T.communities), bl.length ? ul : h('p', { class: 'soft' }, T.noPosts),
      h('details', { class: 'panel' }, h('summary', {}, T.start), h('div', { class: 'field' }, h('label', { for: 'n-code' }, T.code), code), h('div', { class: 'field' }, h('label', { for: 'n-title' }, T.ctitle), title), h('div', { class: 'field' }, h('label', { for: 'n-about' }, T.about), about),
        h('label', { class: 'chk' }, textOnly, T.textOnlyC), h('label', { class: 'chk' }, adult, T.adult), box, mk, note));
  }
  function savedView() {
    document.documentElement.dataset.socialReady = '1';
    return h('div', {}, h('h2', {}, T.saved), st.saved.length ? h('ul', { class: 'blist' }, ...st.saved.map((s) => h('li', {}, h('a', { href: '/social/?b=' + s.b + '&t=' + s.no, on: { click: (e) => { e.preventDefault(); go('b=' + s.b + '&t=' + s.no); } } }, s.sub || '#' + s.no), h('span', { class: 'soft' }, ' · v/' + s.b + ' · ' + ago(s.at, lang))))) : h('p', { class: 'soft' }, T.nothingSaved));
  }
  function searchView() {
    const q = params().get('q') || '', inp = h('input', { id: 's-q', type: 'search', value: q, placeholder: T.searchPh, 'aria-label': T.search }), res = h('div', {});
    const run = async () => { const v = inp.value.trim(); history.replaceState(null, '', '/social/?tab=search&q=' + encodeURIComponent(v)); if (!v) { res.replaceChildren(); return; } const j = await api(BAPI, '?q=' + encodeURIComponent(v)); const rows = (j.ok && (j.posts || j.results)) || [];
      res.replaceChildren(h('p', { class: 'soft' }, T.results(rows.length)), h('ul', { class: 'blist' }, ...rows.map((p) => h('li', {}, h('a', { href: '/social/?b=' + p.board + '&t=' + p.thread, on: { click: (e) => { e.preventDefault(); go('b=' + p.board + '&t=' + p.thread); } } }, p.sub || String(p.body || '').slice(0, 90)), h('span', { class: 'soft' }, ' · v/' + p.board + ' · ' + ago(p.at, lang))))),
        h('p', {}, h('a', { class: 'btn', href: redditSearch(v), target: '_blank', rel: 'noopener noreferrer' }, T.onReddit))); };
    const form = h('form', { class: 'row', role: 'search', on: { submit: (e) => { e.preventDefault(); run(); } } }, inp, h('button', { class: 'go', type: 'submit' }, T.search));
    if (q) run(); document.documentElement.dataset.socialReady = '1';
    return h('div', {}, form, res);
  }
  let drawing = 0;
  async function draw() {
    const n = ++drawing, p = params(), b = (p.get('b') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10), t = +(p.get('t') || 0) || 0, tab = p.get('tab') || (b ? '' : 'home');
    document.title = 'Social · Verse';
    const view = t && b ? await threadView(b, t) : tab === 'create' ? await createView() : tab === 'communities' ? await communitiesView() : tab === 'saved' ? savedView() : tab === 'search' ? searchView() : await feedView(tab || 'home', b);
    if (n !== drawing) return;
    body.replaceChildren(tabs(t ? '' : b ? '' : tab), view, h('p', { class: 'note' }, T.votesNote), h('p', { class: 'note' }, T.about2));
  }
  draw();
  return { state: st, draw };
}
