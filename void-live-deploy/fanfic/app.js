// /fanfic/'s module (owner, 2026-10-29: "build the page"; the same night: "a clean, dedicated fanfiction archive view that matches legacy layouts
// (like Sycophant Hex)", "without raw board form fields", "zero seeded or fake stories"). The archive has no endpoint of its own: it reads GET
// /api/boards and posts through POST /api/boards, so every story, chapter, review and fandom passes the boards' bot check and rates. A fandom is a
// board, a story is a thread (lib/fanfic.js says how chapters and reviews are told apart). Nothing is written into the page: an empty archive
// shows the empty state, and every row is a real post. What this device keeps: drafts, read marks, the pen name and its signing secret.
import * as F from '/lib/fanfic.js';
import { doWork, excerpt } from '/lib/boards.js';
import { mountRelated } from '/lib/toolkit.js';
import { connectBrain } from '/lib/brain-bridge.js';

const $ = (id) => document.getElementById(id), API = '/api/boards', KEY = 'a2m.void.fanfic.v1', BOARDS_KEY = 'a2m.void.boards.v1';
// Verse Brain (lib/brain-bridge.js, owner 2026-10-29: "all the pages are supposed to be able to work together"): the fandom a reader opens and
// the words they search go to the brain when one is open in this browser (BroadcastChannel, never a server); the footer says what it is
// thinking about then, and nothing at all when no brain is open
const brain = connectBrain();
brain.on((m) => { const p = $('brainSay'); if (!p) return; const t = m.thinking || (m.words && m.words[m.words.length - 1]); p.hidden = !t; if (t) p.textContent = 'Verse Brain, open in another tab, is thinking about "' + t + '"' + (m.related && m.related.length ? ', near ' + m.related.map((r) => r.word).join(', ') : '') + '.'; });
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch (_) { return { ...d }; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } };
const api = async (qs, body) => {
  try {
    const r = await fetch(API + qs, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    const j = await r.json().catch(() => ({})); return { status: r.status, ...j };
  } catch (_) { return { ok: false, say: 'the archive could not be reached; check the connection and try again' }; }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const date = (t) => new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' h ago' : s < 30 * 86400 ? Math.floor(s / 86400) + ' d ago' : date(t); };
const timeEl = (t) => { const x = el('time', '', ago(t)); x.dateTime = new Date(t).toISOString(); x.title = new Date(t).toLocaleString(); return x; };
const href = (o) => { const u = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v != null && v !== '') u.set(k, v); const s = u.toString(); return '/fanfic/' + (s ? '?' + s : ''); };
const link = (text, to, cls) => { const a = el('a', cls, text); a.href = to; a.dataset.go = ''; return a; };
const boardLink = (b, t, no) => '/boards/?b=' + b + (t ? '&t=' + t : '') + (no ? '#p' + no : '');
const say = (node, text, tone) => { node.textContent = text || ''; node.classList.toggle('bad', tone === 'bad'); node.classList.toggle('good', tone === 'good'); };
const words = (n) => n.toLocaleString() + (n === 1 ? ' word' : ' words');

// ---- what this device keeps ----
let me = load(KEY, { drafts: [], cur: '', days: {}, read: { all: 0, seen: {} }, period: 'all', pen: '', secret: '', pw: '', mine: {} });
me.read = { all: 0, seen: {}, ...(me.read || {}) }; me.mine = me.mine || {}; me.days = me.days || {}; me.drafts = Array.isArray(me.drafts) ? me.drafts : [];
if (!me.secret) me.secret = F.newSecret();
if (!me.pw) me.pw = F.newSecret();
const keep = () => save(KEY, me);
keep();
const adultOk = () => !!load(BOARDS_KEY, {}).adult; // the same 18+ answer the boards keep
const setAdult = () => { const b = load(BOARDS_KEY, {}); b.adult = true; save(BOARDS_KEY, b); };

// ---- the sky: a still starfield on a canvas, drawn once per size ----
(function stars() {
  const c = $('stars'), g = c.getContext && c.getContext('2d'); if (!g) return;
  const draw = () => {
    const dpr = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
    c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px'; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0, n = Math.round((w * h) / 5200); i < n; i++) {
      const x = r() * w, y = r() * h, big = r() < 0.06, rad = big ? 1.1 + r() * 0.6 : 0.3 + r() * 0.6, a = 0.18 + r() * 0.55, tint = r();
      g.fillStyle = tint < 0.12 ? 'rgba(255,170,214,' + a + ')' : tint < 0.3 ? 'rgba(158,178,255,' + a + ')' : 'rgba(242,244,251,' + a + ')';
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
  };
  let t = 0; draw(); addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 200); });
})();

// ---- the bot check, the boards' own: Turnstile when the site has it, else a proof of work done on this device ----
const cfgP = api('?config');
let tsLoad = null;
const turnstile = () => tsLoad || (tsLoad = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = () => res(window.turnstile); s.onerror = () => { tsLoad = null; rej(new Error('the person check did not load; reload the page')); }; document.head.append(s); }));
function botFor(box) { // { start(), proof(): Promise<proof>, reset() }; nothing runs until a form is opened
  let cfg = null, token = '', wid = null, work = null, ready = null, waiters = [];
  const startWork = () => work || (work = (async () => {
    const c = await api('?challenge'); if (!c.ok) throw new Error(c.say || 'the person check could not start');
    box.textContent = 'Checking on this device that you are a person…'; const n = await doWork(c.c, c.bits); box.textContent = 'Checked: you can post.'; return { c: c.c, sig: c.sig, n };
  })().catch((e) => { work = null; box.textContent = 'The person check did not finish. It tries again when you post.'; throw e; }));
  const start = () => ready || (ready = cfgP.then(async (c) => {
    cfg = c || {};
    if (cfg.turnstile) {
      const ts = await turnstile();
      wid = ts.render(box, { sitekey: cfg.turnstile, theme: 'dark', callback: (t) => { token = t; waiters.splice(0).forEach((f) => f()); }, 'expired-callback': () => { token = ''; } });
    } else { box.textContent = 'A short check that you are a person runs on this device while you write.'; startWork().catch(() => {}); }
  }));
  return {
    start,
    async proof() {
      await start();
      if (cfg.turnstile) {
        if (!token) { box.scrollIntoView({ block: 'center', behavior: 'smooth' }); await Promise.race([new Promise((r) => waiters.push(r)), sleep(90000)]); }
        if (!token) throw new Error('finish the person check first');
        const t = token; token = ''; return { turnstile: t };
      }
      const p = await startWork(); work = null; return p;
    },
    reset() { if (cfg && cfg.turnstile) { token = ''; try { window.turnstile.reset(wid); } catch (_) {} } else if (cfg) startWork().catch(() => {}); },
  };
}

// ---- reading the archive: every fandom board and its catalog ----
let loaded = null;
async function readArchive() {
  const r = await api('');
  if (!r.ok) throw new Error(r.say || 'the archive could not be read');
  const boards = (r.boards || []).filter(F.isFicBoard).sort((a, b) => (b.last || b.created || 0) - (a.last || a.created || 0));
  const lists = await Promise.all(boards.slice(0, 40).map((b) => api('?b=' + encodeURIComponent(b.code)).then((c) => (c.ok ? c.threads || [] : []))));
  const topics = [];
  boards.slice(0, 40).forEach((b, i) => { for (const t of lists[i]) if (!t.hidden) topics.push(F.topicOf(t, b)); });
  topics.sort((a, b) => b.bumped - a.bumped);
  return { boards, topics };
}
const archive = (fresh) => (!fresh && loaded) || (loaded = readArchive().catch((e) => { loaded = null; throw e; }));
const shown = (topics) => topics.filter((t) => !t.nsfw || adultOk()); // adult fandoms' stories stay off the shared lists until this device said 18+

// ---- topic lists: pinned notices, then the stories, with the period filter, paging and read marks ----
const NOTICES = [['format', 'How to format chapters'], ['report', 'Report spam or abuse here'], ['rules', 'Writing rules & guidelines']];
function dot(kind, label) { const d = el('i', 'dot' + (kind ? ' ' + kind : '')); d.setAttribute('role', 'img'); d.setAttribute('aria-label', label); return d; }
function noticeRow([id, title]) {
  const tr = el('tr', 'pin'), ic = el('td', 'ic'), main = el('td', 'm'), rep = el('td', 'num hide-s', '0'), who = el('td', 'who hide-s', 'Verse'), when = el('td', 'when', 'Pinned');
  ic.append(dot('pin', 'Announcement'));
  main.append(link(title, href({ notice: id }), 't'), el('span', 'in', 'Announcement by Verse'));
  rep.dataset.l = 'Replies'; when.dataset.l = '';
  tr.append(ic, main, rep, who, when); return tr;
}
function topicRow(t, { inFandom } = {}) {
  const tr = el('tr'), ic = el('td', 'ic'), main = el('td', 'm'), rep = el('td', 'num hide-s', String(t.replies)), who = el('td', 'who hide-s', t.author), when = el('td', 'when');
  ic.append(t.locked ? dot('lock', 'Locked') : F.unread(t, me.read) ? dot('new', 'New posts') : dot('', 'No new posts'));
  const a = link(t.title, href({ f: t.board, s: t.no }), 't'); main.append(a);
  if (t.nsfw) main.append(el('span', 'tag adult', '18+'));
  const by = el('span', 'in', 'by ' + t.author); if (!inFandom) by.append(' in ', link(t.fandom, href({ f: t.board })));
  main.append(by);
  rep.dataset.l = 'Replies'; when.dataset.l = 'Last post'; when.append(timeEl(t.bumped));
  tr.append(ic, main, rep, who, when); return tr;
}
function quietRow(text, cols = 5) { const tr = el('tr'), td = el('td', 'quiet', text); td.colSpan = cols; td.style.gridColumn = '1 / -1'; tr.append(td); return tr; }
function drawList(view, list, { inFandom, emptySay } = {}) {
  const box = $(view), rows = box.querySelector('[data-rows]'), tools = box.querySelector('[data-tools]'), pages = box.querySelector('[data-pages]');
  const period = F.PERIODS[me.period] ? me.period : 'all', inP = F.inPeriod(list, period), page = F.pageOf(inP, new URLSearchParams(location.search).get('page'));
  rows.replaceChildren(...NOTICES.map(noticeRow));
  if (page.items.length) rows.append(...page.items.map((t) => topicRow(t, { inFandom })));
  else rows.append(quietRow(list.length ? (period === 'today' ? 'Nothing was posted today.' : 'Nothing was posted this week.') + ' Choose All topics to see every story.' : emptySay || 'No stories yet. The first one posted shows here.'));
  // tools: the period and Mark all read
  const lab = el('label', 'vh', 'Show'), sel = el('select'), mark = el('button', '', 'Mark all read'), sid = view + 'Period';
  lab.htmlFor = sid; sel.id = sid;
  for (const [k, v] of Object.entries(F.PERIODS)) { const o = el('option', '', v); o.value = k; sel.append(o); }
  sel.value = period; sel.onchange = () => { me.period = sel.value; keep(); setPage(1, false); };
  mark.type = 'button'; mark.disabled = !list.some((t) => F.unread(t, me.read));
  mark.onclick = () => { me.read = { all: Date.now(), seen: {} }; keep(); route(); };
  tools.replaceChildren(lab, sel, mark);
  // pages
  pages.hidden = page.pages < 2; pages.replaceChildren();
  if (page.pages > 1) {
    pages.append(el('span', '', 'Page ' + page.page + ' of ' + page.pages));
    const btn = (text, n, cur) => { const b = el('button', '', text); b.type = 'button'; if (cur) b.setAttribute('aria-current', 'page'); b.onclick = () => setPage(n, true); return b; };
    if (page.page > 1) pages.append(btn('Previous', page.page - 1));
    let last = 0;
    for (let n = 1; n <= page.pages; n++) {
      if (n !== 1 && n !== page.pages && Math.abs(n - page.page) > 2) continue;
      if (last && n - last > 1) pages.append(el('span', '', '…'));
      pages.append(btn(String(n), n, n === page.page)); last = n;
    }
    if (page.page < page.pages) pages.append(btn('Next', page.page + 1));
  }
}
function setPage(n, push) {
  const u = new URLSearchParams(location.search); if (n > 1) u.set('page', n); else u.delete('page');
  const to = location.pathname + (u.toString() ? '?' + u : '');
  history[push ? 'pushState' : 'replaceState'](null, '', to); route(); if (push) scrollTo(0, 0);
}

// ---- views ----
const VIEWS = ['index', 'forum', 'recent', 'story', 'post', 'fandom', 'search', 'room', 'glossary', 'notice', 'gate', 'gone'];
const NAV = { index: 'index', forum: 'index', story: 'index', post: 'index', fandom: 'index', recent: 'recent', search: 'search', room: 'room', glossary: 'glossary', notice: 'notice' };
// what the view on screen hands to the other pages (owner, 2026-10-29: "all the pages are supposed to be able to work together"): the chapter
// being read, or the draft in the Writing Room; the index and the lists hand nothing. A link carries at most LINK_MAX encoded characters (a longer
// address is refused by the edge), so the translator gets the opening of a long chapter (it takes 5,000 characters) and the word counter opens
// only when the whole text fits; the story page and the room already count the words of a long one.
const LINK_MAX = 12000;
const fitted = (text) => { let t = String(text || '').slice(0, 5000); while (t && encodeURIComponent(t).length > LINK_MAX) t = t.slice(0, Math.floor(t.length * 0.8)); return t; };
let handing = null;
function drawRelated() {
  const h = handing, hand = !h ? [] : [{ label: 'Translate it', href: () => (h().trim() ? '/translate/?q=' + encodeURIComponent(fitted(h())) : null) },
    { label: 'Count the words', href: () => (h().trim() && encodeURIComponent(h()).length <= LINK_MAX ? '/word-count/?t=' + encodeURIComponent(h()) : null) }];
  mountRelated($('related'), '/fanfic/', hand);
}
function show(id, title) {
  for (const v of VIEWS) $(v).classList.toggle('on', v === id);
  for (const a of document.querySelectorAll('.nav a')) { if (a.dataset.v === NAV[id]) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  document.title = (title ? title + ' · ' : '') + 'Fan fiction · Verse';
  handing = id === 'room' ? () => draft().text : null; drawRelated();
}
const fail = (node, e) => say(node, e && e.message ? e.message.replace(/^./, (c) => c.toUpperCase()) + '.' : 'Something went wrong. Try again.', 'bad');

async function viewIndex() {
  show('index', 'Archive Descriptions & Stories');
  const s = $('indexSay'); s.hidden = false; say(s, 'Opening the archive…');
  let a; try { a = await archive(); } catch (e) { fail(s, e); return; }
  s.hidden = true;
  const { boards, topics } = a, body = $('fandoms');
  body.replaceChildren(...boards.map((b) => {
    const tr = el('tr'), ic = el('td', 'ic'), main = el('td', 'm'), n = el('td', 'num'), p = el('td', 'num'), when = el('td', 'when');
    const mine = topics.filter((t) => t.board === b.code);
    ic.append(mine.some((t) => F.unread(t, me.read)) ? dot('new', 'New posts') : dot('', 'No new posts'));
    main.append(link(b.title, href({ f: b.code }), 't'));
    if (b.nsfw) main.append(el('span', 'tag adult', '18+'));
    if (b.about && !/^Fan fiction: /.test(b.about)) main.append(el('span', 'about', b.about));
    n.textContent = String(mine.length); n.dataset.l = 'Stories'; p.textContent = String(b.posts || 0); p.dataset.l = 'Posts';
    when.dataset.l = 'Last post'; if (b.last) when.append(timeEl(b.last)); else when.textContent = 'No posts yet';
    tr.append(ic, main, n, p, when); return tr;
  }));
  $('fandomList').hidden = !boards.length; $('emptyArchive').hidden = !!boards.length;
  drawList('index', shown(topics), { emptySay: boards.length ? 'No stories yet. Open a fandom and post the first one.' : 'No stories yet. The first one posted shows here.' });
  const st = F.statsOf(boards, topics);
  $('nFandoms').textContent = st.fandoms.toLocaleString(); $('nStories').textContent = st.stories.toLocaleString();
  $('nPosts').textContent = st.posts.toLocaleString(); $('nAuthors').textContent = st.authors.toLocaleString();
}

async function viewForum(code) {
  let a; try { a = await archive(); } catch (e) { gone(e.message); return; }
  const b = a.boards.find((x) => x.code === code);
  if (!b) { gone('There is no fandom at that link. It may have been removed, or the link is not complete.'); return; }
  if (b.nsfw && !adultOk()) { gate(); return; }
  show('forum', b.title);
  brain.tell(b.title);
  $('forumCrumb').textContent = b.title; $('forumH').textContent = b.title;
  $('forumAbout').textContent = b.about && !/^Fan fiction: /.test(b.about) ? b.about : 'Stories in ' + b.title + '.';
  $('forumPost').href = href({ new: 'story', f: code });
  drawList('forum', a.topics.filter((t) => t.board === code), { inFandom: true, emptySay: 'No stories in ' + b.title + ' yet. Post the first one.' });
}

async function viewRecent() {
  show('recent', 'Most recent');
  const rows = $('recent').querySelector('[data-rows]');
  let a; try { a = await archive(); } catch (e) { rows.replaceChildren(quietRow(e.message)); return; }
  drawList('recent', shown(a.topics));
}

/** a chapter's text as paragraphs: a blank line starts a new one, a line opening with > is a quote. textContent only, so nothing is markup. */
function paras(text, host) {
  for (const block of String(text || '').replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const t = block.replace(/^\n+|\n+$/g, ''); if (!t.trim()) continue;
    const lines = t.split('\n'), quote = lines.every((l) => /^>/.test(l)), node = el(quote ? 'blockquote' : 'p');
    lines.forEach((l, i) => { if (i) node.append(el('br')); node.append(quote ? l.replace(/^>\s?/, '') : l); });
    host.append(node);
  }
}

async function viewStory(code, no, chap) {
  const r = await api('?b=' + encodeURIComponent(code) + '&t=' + no);
  if (r.status === 404 || r.status === 410 || !r.ok) { gone(r.status === 410 ? 'That story is hidden while it is looked at.' : r.say ? r.say.replace(/^./, (c) => c.toUpperCase()) + '.' : 'That story is not here.'); return; }
  const b = r.board, op = r.thread;
  if (!F.isFicBoard(b)) { location.replace(boardLink(code, no)); return; }
  if (b.nsfw && !adultOk()) { gate(); return; }
  const s = F.storyOf(op, r.posts || []), key = code + '/' + no;
  me.read.seen[key] = Math.max(op.bumped || 0, ...(r.posts || []).map((p) => p.at || 0)); keep();
  show('story', s.title);
  const crumb = $('storyCrumb'); crumb.textContent = b.title; crumb.href = href({ f: code });
  $('storyH').textContent = s.title;
  const by = $('storyBy'); by.replaceChildren('by ', el('b', '', s.author));
  if (b.nsfw) by.append(el('span', 'tag adult', '18+'));
  $('storySum').textContent = s.summary; $('storySum').hidden = !s.summary;
  const facts = [['Rated', b.nsfw ? '18+' : 'All ages'], ['Fandom', b.title], ['Chapters', String(s.chapters.length)], ['Words', s.words.toLocaleString()],
    ['Reading time', F.readLabel(s.words)], ['Reviews', String(s.reviews.length)], ['Published', date(s.published)], ['Updated', date(s.updated)]];
  $('storyInfo').replaceChildren(...facts.map(([k, v]) => { const d = el('div'); d.append(el('dt', '', k), el('dd', '', v)); return d; }));
  // the chapter shown, and the chapter list
  const n = Math.max(1, Math.min(s.chapters.length, +chap || 1)), c = s.chapters[n - 1], sel = $('tocSel');
  handing = () => (c ? c.text : ''); drawRelated();
  $('toc').hidden = s.chapters.length < 2;
  sel.replaceChildren(...s.chapters.map((x) => { const o = el('option', '', 'Chapter ' + x.n + (x.title ? ': ' + x.title : '')); o.value = x.n; return o; }));
  sel.value = n; sel.onchange = () => go(href({ f: code, s: no, c: sel.value > 1 ? sel.value : '' }), true);
  $('tocSay').textContent = 'Chapter ' + n + ' of ' + s.chapters.length;
  const box = el('section', 'chapter'), prose = el('div', 'prose');
  box.append(el('h3', '', s.chapters.length > 1 ? 'Chapter ' + c.n + (c.title ? ': ' + c.title : '') : s.title));
  paras(c.text, prose); box.append(prose);
  const acts = el('div', 'acts');
  if (n > 1) acts.append(link('Previous chapter', href({ f: code, s: no, c: n - 1 > 1 ? n - 1 : '' }), 'btn'));
  if (n < s.chapters.length) acts.append(link('Next chapter', href({ f: code, s: no, c: n + 1 }), 'btn go'));
  const rep = el('a', 'btn', 'Report this'); rep.href = boardLink(code, no, c.nos[0]); acts.append(rep);
  box.append(acts); $('chapters').replaceChildren(box);
  // reviews
  $('reviewsH').textContent = s.reviews.length ? 'Reviews (' + s.reviews.length + ')' : 'Reviews';
  $('reviews').replaceChildren(...(s.reviews.length ? s.reviews.map((p) => {
    const d = el('div', 'review'), meta = el('p', 'meta'); meta.append(el('b', '', p.name || 'Anonymous'), ' · ', timeEl(p.at)); d.append(meta);
    const body = el('div'); paras(p.body, body); d.append(body); return d;
  }) : [el('p', 'quiet', 'No reviews yet. Be the first to say what you thought.')]));
  wireReview(code, no, op.locked || op.archived);
  // the next chapter: only for the device that posted the story, while the thread is open
  const own = !!me.mine[key] && !!s.trip && !op.locked && !op.archived;
  $('addChapter').hidden = !own;
  if (own) wireChapter(code, no, s.chapters.length + 1);
}

function gate() { show('gate', 'For adults'); }
function gone(text) { show('gone', 'Not here'); $('goneSay').textContent = text || 'It may have been removed, or the link is not complete.'; }

// ---- posting: one story, chapter or review, cut into the posts the boards take, sent one by one through the bot check ----
const bots = new Map();
const botOf = (form) => { if (!bots.has(form)) bots.set(form, botFor(form.querySelector('[data-bot]'))); const b = bots.get(form); b.start(); return b; };
/** sends job.parts from job.i on; job = { b, t, sub, parts, name, i }. Sets job.t to the new thread after the first post. Returns the reply of the
 *  last post. Stops at the first refusal and leaves job.i at the part that did not go up, so a second press sends the rest. */
async function sendParts(form, job) {
  const bot = botOf(form), note = form.querySelector('[data-say]');
  while (job.i < job.parts.length) {
    if (job.i > 0) for (let w = 16; w > 0; w--) { say(note, 'Posted part ' + job.i + ' of ' + job.parts.length + '. The next part goes up in ' + w + ' s, so the boards take it.'); await sleep(1000); }
    say(note, job.parts.length > 1 ? 'Posting part ' + (job.i + 1) + ' of ' + job.parts.length + '…' : 'Posting…');
    let r = null;
    for (let tries = 0; tries < 3; tries++) {
      const proof = await bot.proof();
      r = await api('', { do: 'post', b: job.b, t: job.t || undefined, sub: job.t ? '' : job.sub, body: job.parts[job.i], name: job.name, password: me.pw, proof });
      bot.reset();
      if (!(r.status === 429 && r.kind === 'limited' && job.i > 0)) break;
      for (let w = 16; w > 0; w--) { say(note, 'The boards asked for a short pause. Trying again in ' + w + ' s.'); await sleep(1000); }
    }
    if (!r.ok) throw new Error((r.say || 'that did not post') + (job.i > 0 ? '. Parts 1 to ' + job.i + ' are up; press the button again to send the rest' : ''));
    if (!job.t) { job.t = r.thread; job.trip = r.trip || ''; if (job.onThread) job.onThread(job.t, job.trip); }
    job.i++;
  }
  return job;
}
/** a form's text, word count and how many posts it will go up in. */
function counter(form, field, n = () => 1) {
  const out = form.querySelector('[data-count]'), area = form.elements[field];
  const draw = () => { const w = F.words(area.value), k = area.value.trim() ? n() : 0; out.textContent = w ? words(w) + ', ' + F.readLabel(w) + (k > 1 ? ', posted in ' + k + ' parts' : '') : ''; };
  area.oninput = draw; draw(); return draw;
}
function busy(form, on) { for (const b of form.querySelectorAll('button')) b.disabled = on; }
const sig = (...a) => JSON.stringify(a);

function fandomOptions(sel, boards, pick) {
  sel.replaceChildren(el('option', '', 'Choose a fandom')); sel.firstChild.value = '';
  for (const b of boards) { const o = el('option', '', b.title + (b.nsfw ? ' (18+)' : '')); o.value = b.code; sel.append(o); }
  if (pick && boards.some((b) => b.code === pick)) sel.value = pick;
}

async function viewPost(pick) {
  show('post', 'Post a story');
  const form = $('stForm'), note = form.querySelector('[data-say]'), sel = $('stFandom');
  botOf(form);
  if (sessionStorage.getItem('fanfic.fromRoom') === '1') {
    sessionStorage.removeItem('fanfic.fromRoom');
    const d = draft(); if (d) { form.elements.title.value = d.title; form.elements.text.value = d.text; }
  }
  if (!form.elements.pen.value) form.elements.pen.value = me.pen || '';
  const parts = () => F.chapterPosts(1, '', form.elements.text.value, form.elements.summary.value).length;
  counter(form, 'text', parts);
  let a; try { a = await archive(); } catch (e) { fail(note, e); return; }
  fandomOptions(sel, a.boards, pick || sel.value);
  if (!a.boards.length) say(note, 'There is no fandom yet. Start one first, then post your story in it.');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const b = sel.value, title = form.elements.title.value.trim(), text = form.elements.text.value, summary = form.elements.summary.value;
    if (!b) { say(note, 'Choose a fandom first.', 'bad'); sel.focus(); return; }
    if (!title) { say(note, 'Give the story a title.', 'bad'); form.elements.title.focus(); return; }
    if (!F.words(text)) { say(note, 'Write or paste chapter 1 first.', 'bad'); form.elements.text.focus(); return; }
    me.pen = F.penName(form.elements.pen.value); keep();
    const s = sig(b, title, text, summary, me.pen);
    if (!form._job || form._job.sig !== s) form._job = { sig: s, b, t: 0, sub: title, parts: F.chapterPosts(1, '', text, summary), name: F.signedName(me.pen, me.secret), i: 0, onThread: (t, trip) => { me.mine[b + '/' + t] = trip || 1; keep(); } };
    busy(form, true);
    try {
      const job = await sendParts(form, form._job); form._job = null; form.reset(); loaded = null;
      say(note, 'Posted.', 'good'); go(href({ f: job.b, s: job.t }));
    } catch (e) { fail(note, e); } finally { busy(form, false); }
  };
}

function wireChapter(code, no, n) {
  const form = $('chForm'), note = form.querySelector('[data-say]');
  $('addChapter').querySelector('h2').textContent = 'Add chapter ' + n;
  botOf(form);
  counter(form, 'text', () => F.chapterPosts(n, form.elements.title.value, form.elements.text.value).length);
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const title = form.elements.title.value, text = form.elements.text.value;
    if (!F.words(text)) { say(note, 'Write or paste the chapter first.', 'bad'); form.elements.text.focus(); return; }
    const s = sig(code, no, n, title, text);
    if (!form._job || form._job.sig !== s) form._job = { sig: s, b: code, t: no, sub: '', parts: F.chapterPosts(n, title, text), name: F.signedName(me.pen, me.secret), i: 0 };
    busy(form, true);
    try { await sendParts(form, form._job); form._job = null; form.reset(); loaded = null; say(note, 'Chapter ' + n + ' is up.', 'good'); go(href({ f: code, s: no, c: n }), true); }
    catch (e) { fail(note, e); } finally { busy(form, false); }
  };
}

function wireReview(code, no, closed) {
  const form = $('rvForm'), note = form.querySelector('[data-say]');
  say(note, closed ? 'This story is closed to new reviews.' : '');
  busy(form, !!closed); if (closed) return;
  if (!form.elements.pen.value) form.elements.pen.value = me.pen || '';
  botOf(form);
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const text = form.elements.text.value.trim();
    if (!text) { say(note, 'Write the review first.', 'bad'); form.elements.text.focus(); return; }
    me.pen = F.penName(form.elements.pen.value); keep();
    busy(form, true);
    try {
      // a review is never signed, so it can never be read as a chapter
      await sendParts(form, { b: code, t: no, sub: '', parts: [text], name: me.pen || 'Anonymous', i: 0 });
      form.elements.text.value = ''; loaded = null; say(note, 'Thank you. Your review is up.', 'good'); viewStory(code, no, new URLSearchParams(location.search).get('c'));
    } catch (e) { fail(note, e); } finally { busy(form, false); }
  };
}

async function viewFandom() {
  show('fandom', 'Start a fandom');
  const form = $('fdForm'), note = form.querySelector('[data-say]');
  botOf(form);
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    const title = F.penName(form.elements.title.value), about = form.elements.about.value.trim(), adult = form.elements.rate.value === 'adult';
    if (!title) { say(note, 'Give the fandom a name.', 'bad'); form.elements.title.focus(); return; }
    let a; try { a = await archive(true); } catch (e) { fail(note, e); return; }
    const all = await api(''), taken = new Set((all.boards || []).map((b) => b.code));
    const same = a.boards.find((b) => b.title.toLowerCase() === title.toLowerCase());
    if (same) { say(note, title + ' is here already.'); go(href({ f: same.code })); return; }
    const code = F.ficCode(title, taken);
    if (!code) { say(note, 'That name cannot make a fandom. Try another.', 'bad'); return; }
    busy(form, true); say(note, 'Starting the fandom…');
    try {
      const bot = botOf(form), proof = await bot.proof();
      const r = await api('', { do: 'board', code, title, about: about || 'Fan fiction: ' + title, nsfw: adult, textOnly: true, ids: false, proof });
      bot.reset();
      if (!r.ok) throw new Error(r.say || 'the fandom did not start');
      form.reset(); loaded = null; say(note, title + ' is open.', 'good'); go(href({ f: code }));
    } catch (e) { fail(note, e); } finally { busy(form, false); }
  };
}

async function viewSearch(q) {
  show('search', 'Search');
  const list = $('sres'), note = $('sSay'); $('sq').value = q || '';
  list.replaceChildren();
  if (!q) { note.hidden = false; say(note, 'Type a word to search.'); return; }
  brain.tell(q);
  note.hidden = false; say(note, 'Searching…');
  let a; try { a = await archive(); } catch (e) { fail(note, e); return; }
  const fic = new Map(a.boards.map((b) => [b.code, b])), r = await api('?q=' + encodeURIComponent(q));
  if (!r.ok) { fail(note, new Error(r.say || 'the search did not run')); return; }
  const hits = (r.results || []).filter((x) => fic.has(x.board) && (!x.nsfw || adultOk()));
  list.replaceChildren(...hits.map((x) => {
    const li = el('li'), b = fic.get(x.board), to = href({ f: x.board, s: x.thread });
    li.append(link(x.sub || excerpt(x.body, 70) || 'Untitled', to, 't'));
    const sm = el('small'); sm.append(b.title + ' · ' + (x.name || 'Anonymous') + ' · ', timeEl(x.at)); li.append(sm);
    li.append(el('p', 'muted', excerpt(x.body, 200))); return li;
  }));
  note.hidden = !!hits.length; if (!hits.length) say(note, 'Nothing matches "' + q + '". Try another word.');
}
$('sf').onsubmit = (ev) => { ev.preventDefault(); const q = $('sq').value.trim(); go(href({ v: 'search', q })); };

// ---- the Writing Room: drafts on this device ----
const draft = () => me.drafts.find((d) => d.id === me.cur);
const total = () => me.drafts.reduce((n, d) => n + F.words(d.text), 0);
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
let counted = 0, saveT = 0, delArm = 0;
function newDraft(title = '', text = '') { const d = { id: rid(), title, text, at: Date.now() }; me.drafts.unshift(d); me.cur = d.id; counted = total(); keep(); return d; }
const label = (d) => (d.title || 'Untitled story') + ' · ' + words(F.words(d.text));
function drawDrafts() {
  const sel = $('drafts'); sel.replaceChildren(...me.drafts.map((d) => { const o = el('option', '', label(d)); o.value = d.id; return o; }));
  sel.value = me.cur; const d = draft();
  $('dTitle').value = d.title; $('dText').value = d.text;
  $('delDraft').disabled = me.drafts.length < 2 && !d.text && !d.title; $('delDraft').textContent = 'Delete draft'; delArm = 0;
  drawStats();
}
function drawStats() {
  const d = draft(), n = F.words(d.text);
  $('sWords').textContent = n.toLocaleString(); $('sRead').textContent = F.readLabel(n);
  $('sToday').textContent = (me.days[F.dayOf()] || 0).toLocaleString(); $('sStreak').textContent = String(F.streak(me.days));
}
const roomSay = (t, tone) => say($('roomSay'), t, tone);
function edited() {
  const d = draft(); d.title = $('dTitle').value; d.text = $('dText').value; d.at = Date.now();
  const now = total(); if (now > counted) { const k = F.dayOf(); me.days[k] = (me.days[k] || 0) + (now - counted); me.days = F.trimDays(me.days); } counted = now; // only words added count
  drawStats(); $('sSaved').textContent = 'Saving';
  clearTimeout(saveT); saveT = setTimeout(() => {
    if (keep()) $('sSaved').textContent = 'Saved'; else { $('sSaved').textContent = 'Not saved'; roomSay('This browser would not keep the draft (storage is full or blocked). Export it to keep it.', 'bad'); }
    const o = $('drafts').selectedOptions[0]; if (o) o.textContent = label(d);
  }, 400);
}
$('dTitle').addEventListener('input', edited); $('dText').addEventListener('input', edited);
$('drafts').onchange = () => { me.cur = $('drafts').value; keep(); drawDrafts(); };
$('newDraft').onclick = () => { newDraft(); drawDrafts(); $('dTitle').focus(); roomSay('A new draft.'); };
$('delDraft').onclick = () => {
  const d = draft();
  if ((d.text || d.title) && !delArm) { delArm = 1; $('delDraft').textContent = 'Press again to delete'; roomSay('Deleting "' + (d.title || 'Untitled story') + '" cannot be undone. Press again to delete it.', 'bad'); return; }
  me.drafts = me.drafts.filter((x) => x.id !== d.id); if (!me.drafts.length) newDraft(); me.cur = me.drafts[0].id; counted = total(); keep(); drawDrafts(); roomSay('Draft deleted.');
};
$('export').onclick = () => {
  const d = draft(); if (!d.text.trim()) { roomSay('Write something first.'); return; }
  const a = el('a'); a.href = URL.createObjectURL(new Blob([(d.title ? d.title + '\n\n' : '') + d.text + '\n'], { type: 'text/plain;charset=utf-8' })); a.download = F.fileName(d.title);
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); roomSay('Saved as ' + a.download + '.', 'good');
};
$('copy').onclick = async () => {
  const d = draft(); if (!d.text.trim()) { roomSay('Write something first.'); return; }
  try { await navigator.clipboard.writeText((d.title ? d.title + '\n\n' : '') + d.text); roomSay('Copied.', 'good'); } catch (_) { $('dText').focus(); $('dText').select(); roomSay('The text is selected: copy it with your keyboard or menu.'); }
};
let shareUrl = '';
$('share').onclick = async () => {
  const d = draft(); if (!d.text.trim()) { roomSay('Write something first.'); return; }
  shareUrl = location.origin + '/fanfic/?v=room#' + F.shareHash(d);
  if (shareUrl.length > F.SHARE_MAX) { roomSay('This draft is too long for a link. Export it as a file and send that instead.'); return; }
  if (navigator.share) { try { await navigator.share({ title: d.title || 'A story', url: shareUrl }); roomSay('Shared. The link holds the draft itself; nothing is uploaded.', 'good'); return; } catch (_) {} }
  try { await navigator.clipboard.writeText(shareUrl); roomSay('Link copied. It holds the draft itself; nothing is uploaded.', 'good'); }
  catch (_) { const n = $('roomSay'); n.replaceChildren('The link holds the draft itself; nothing is uploaded: '); const a = el('a', '', 'the link to this draft'); a.href = shareUrl; n.append(a, '.'); n.classList.remove('bad'); }
};
$('toPost').onclick = () => {
  const d = draft(); if (!d.text.trim()) { roomSay('Write something first.'); return; }
  sessionStorage.setItem('fanfic.fromRoom', '1'); go(href({ new: 'story' }));
};
function viewRoom() {
  show('room', 'Writing Room'); drawDrafts();
  const shared = F.readShare(location.hash);
  $('shared').hidden = !shared;
  if (!shared) return;
  const from = new URLSearchParams(location.search).get('from') === 'story' ? 'Your story from the story writer' : 'Someone shared a draft with you';
  $('sharedSay').textContent = from + ': "' + (shared.title || 'Untitled story') + '", ' + words(F.words(shared.text)) + '.';
  const clear = () => { $('shared').hidden = true; history.replaceState(null, '', location.pathname + location.search); };
  $('sharedKeep').onclick = () => { newDraft(shared.title, shared.text); counted = total(); keep(); drawDrafts(); clear(); roomSay('The shared draft is in your Writing Room.', 'good'); };
  $('sharedNo').onclick = clear;
}

function viewNotice(which) {
  const id = NOTICES.some(([k]) => k === which) ? which : 'rules';
  show('notice', NOTICES.find(([k]) => k === id)[1]);
  for (const [k] of NOTICES) $('n-' + k).hidden = k !== id;
}

// ---- the router: one page, the address says which view ----
async function route() {
  const q = new URLSearchParams(location.search), f = (q.get('f') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10), s = +(q.get('s') || 0) || 0, v = q.get('v');
  if (q.has('notice')) return viewNotice(q.get('notice'));
  if (q.get('new') === 'story') return viewPost(f);
  if (q.get('new') === 'fandom') return viewFandom();
  if (f && s) return viewStory(f, s, q.get('c'));
  if (f) return viewForum(f);
  if (v === 'recent') return viewRecent();
  if (v === 'search') return viewSearch((q.get('q') || '').slice(0, 200));
  if (v === 'room' || /^#room=/.test(location.hash)) return viewRoom();
  if (v === 'glossary') { show('glossary', 'Writing Glossary'); return; }
  return viewIndex();
}
function go(url, replace) { history[replace ? 'replaceState' : 'pushState'](null, '', url); scrollTo(0, 0); route(); }
document.addEventListener('click', (ev) => {
  const a = ev.target.closest && ev.target.closest('a[data-go]');
  if (!a || ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || a.target) return;
  ev.preventDefault(); go(a.getAttribute('href'));
});
addEventListener('popstate', route);
$('gateYes').onclick = () => { setAdult(); route(); };

if (!me.drafts.length) newDraft();
if (!draft()) me.cur = me.drafts[0].id;
counted = total();
route();
