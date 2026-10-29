// /fanfic/'s module (owner, 2026-10-29: "build the page"): reads the boards with GET /api/boards only, never writes to the server. A fandom is a
// board someone made (lib/fanfic.js isFicBoard), a story is a thread. "Post to board" leaves the story on this device (lib/fanfic.js HANDOFF)
// and opens the board's own new-thread form, filled in (boards/app.js), so every post still passes the boards' bot check and rates.
import { isFicBoard, words, readLabel, splitParts, dayOf, streak, trimDays, inPeriod, pageOf, unread, shareHash, readShare, SHARE_MAX, fileName, HANDOFF, handoff } from '/lib/fanfic.js';
import { excerpt } from '/lib/boards.js';

const $ = (id) => document.getElementById(id), API = '/api/boards', KEY = 'a2m.void.fanfic.v1', BOARDS_KEY = 'a2m.void.boards.v1';
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch (_) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } };
const api = async (qs) => { try { const r = await fetch(API + qs); const j = await r.json().catch(() => ({})); return { status: r.status, ...j }; } catch (_) { return { ok: false, say: 'the boards could not be reached' }; } };
const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' h ago' : Math.floor(s / 86400) + ' d ago'; };
const when = (t) => new Date(t).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const link = (b, t) => '/boards/?b=' + b + (t ? '&t=' + t : '');
const q = new URLSearchParams(location.search);

// what this device keeps: drafts, the day-by-day words written, what was read, the chosen fandom
let me = load(KEY, { drafts: [], cur: '', days: {}, read: { all: 0, seen: {} }, fandom: '', period: 'all' });
me.read = { all: 0, seen: {}, ...(me.read || {}) };
const keep = () => save(KEY, me);
const adultOk = () => !!load(BOARDS_KEY, {}).adult; // the same 18+ answer the boards keep, asked once for both

// ---- the boards and their topics ----
let boards = [], topics = [], page = Math.max(1, +q.get('page') || 1);
async function readBoards() {
  const r = await api('');
  if (!r.ok) { $('tNote').textContent = r.say || 'The boards could not be read just now.'; $('tNote').classList.add('bad'); boards = []; return; }
  boards = (r.boards || []).filter(isFicBoard).sort((a, b) => b.last - a.last);
  const shown = boards.filter((b) => adultOk() || !b.nsfw).slice(0, 24); // at most 24 catalogs read at once
  const cats = await Promise.all(shown.map((b) => api('?b=' + b.code).then((c) => (c.ok ? c.threads.map((t) => ({ ...t, board: b.code, bTitle: b.title, nsfw: b.nsfw })) : []))));
  topics = cats.flat().filter((t) => !t.hidden).sort((a, b) => (b.bumped || b.at) - (a.bumped || a.at));
}
function drawFandoms() {
  const host = $('fandoms'); host.replaceChildren();
  const hidden = boards.filter((b) => b.nsfw && !adultOk());
  const visible = boards.filter((b) => !b.nsfw || adultOk());
  if (me.fandom && !visible.some((b) => b.code === me.fandom)) me.fandom = '';
  const chip = (code, label, n) => { const b = el('button', '', label); b.type = 'button'; if (n != null) b.append(' ', el('small', '', n)); b.setAttribute('aria-pressed', String(me.fandom === code)); b.onclick = () => { me.fandom = code; keep(); page = 1; drawFandoms(); drawTopics(); }; host.append(b); };
  if (visible.length) chip('', 'All fandoms', topics.length);
  for (const b of visible) chip(b.code, '/' + b.code + '/ ' + b.title + (b.nsfw ? ' (18+)' : ''), topics.filter((t) => t.board === b.code).length);
  $('adultGate').hidden = !hidden.length;
  $('adultSay').textContent = hidden.length === 1 ? 'One board here is marked 18+ by the person who made it.' : hidden.length + ' boards here are marked 18+ by the people who made them.';
  // the Writing Room's board list follows the same boards
  const sel = $('dBoard'), was = sel.value || (draft() && draft().board) || '';
  sel.replaceChildren(el('option', '', visible.length ? 'Choose a fandom board' : 'No fandom board yet: start one first'));
  sel.firstChild.value = '';
  for (const b of visible) { const o = el('option', '', '/' + b.code + '/ ' + b.title + (b.nsfw ? ' (18+)' : '')); o.value = b.code; sel.append(o); }
  sel.value = visible.some((b) => b.code === was) ? was : '';
}
function drawTopics() {
  const list = inPeriod(topics.filter((t) => !me.fandom || t.board === me.fandom), me.period);
  const { items, page: p, pages } = pageOf(list, page); page = p;
  const tb = $('tbody'); tb.replaceChildren();
  for (const t of items) {
    const tr = el('tr', unread(t, me.read) ? 'unread' : ''), td = el('td', 'c-topic');
    const a = el('a', 't', t.sub || excerpt(t.body, 80) || 'No. ' + t.no); a.href = link(t.board, t.no);
    a.addEventListener('click', () => { me.read.seen[t.board + '/' + t.no] = t.bumped || t.at; keep(); });
    td.append(a); if (unread(t, me.read)) td.append(el('span', 'badge new', 'new')); if (t.nsfw) td.append(el('span', 'badge adult', '18+')); if (t.locked) td.append(el('span', 'badge', 'locked'));
    if (t.sub && t.body) td.append(el('span', 'ex', excerpt(t.body, 140)));
    const bd = el('a', 'bd', '/' + t.board + '/ ' + t.bTitle); bd.href = link(t.board); td.append(' ', bd);
    const au = el('td', 'c-author'), nm = el('span', 'au', t.name || 'Anonymous'); if (t.trip) nm.append(' ', el('span', 'trip', t.trip)); au.append(nm);
    const lp = el('td', 'when'), tm = el('time', '', ago(t.bumped || t.at)); tm.dateTime = new Date(t.bumped || t.at).toISOString(); tm.title = when(t.bumped || t.at); lp.append(tm);
    tr.append(td, el('td', 'num c-replies', String(t.replies || 0)), au, lp); tb.append(tr);
  }
  const vis = boards.filter((b) => !b.nsfw || adultOk());
  $('topics').hidden = !items.length;
  $('topicTools').hidden = !topics.length; // nothing to filter or mark read until a story is posted
  $('empty').hidden = !!items.length;
  $('emptyMore').textContent = !vis.length ? 'Start a board for your fandom or genre, then post a story to it. You can write it in the Writing Room first.'
    : list.length || !topics.length ? 'The fandom boards are open and waiting. Write in the Writing Room, then post it to a board.' : 'Nothing was posted ' + (me.period === 'today' ? 'today' : 'this week') + '. Choose All topics to see older stories.';
  $('emptyGo').textContent = vis.length ? 'Write a story' : 'Start a fandom board'; $('emptyGo').href = vis.length ? '#room' : '/boards/?new=1&fic=1#new';
  const fresh = list.filter((t) => unread(t, me.read)).length;
  $('tNote').classList.remove('bad');
  $('tNote').textContent = topics.length ? list.length + ' topic' + (list.length === 1 ? '' : 's') + (fresh ? ', ' + fresh + ' with new posts' : '') + (pages > 1 ? ' · page ' + p + ' of ' + pages : '') : vis.length ? vis.length + ' fandom board' + (vis.length === 1 ? '' : 's') + ', no stories yet' : '';
  const nav = $('pages'); nav.replaceChildren(); nav.hidden = pages < 2;
  const go = (n, label) => { const b = el('button', '', label || String(n)); b.type = 'button'; if (n === p && !label) b.setAttribute('aria-current', 'page'); b.disabled = n < 1 || n > pages || (label && n === p); b.onclick = () => { page = n; const u = new URL(location.href); u.searchParams.set('page', n); history.replaceState(null, '', u); drawTopics(); $('topicsH').scrollIntoView({ block: 'start' }); }; nav.append(b); };
  if (pages > 1) { go(p - 1, 'Previous'); for (let n = 1; n <= pages; n++) if (n === 1 || n === pages || Math.abs(n - p) <= 2) go(n); go(p + 1, 'Next'); }
}
$('period').value = me.period in { all: 1, today: 1, week: 1 } ? me.period : 'all';
$('period').onchange = () => { me.period = $('period').value; keep(); page = 1; drawTopics(); };
$('markRead').onclick = () => { me.read = { all: Date.now(), seen: {} }; keep(); drawTopics(); $('tNote').textContent += ' · all marked read on this device'; };
$('adultYes').onclick = async () => { const b = load(BOARDS_KEY, {}); b.adult = true; save(BOARDS_KEY, b); $('tNote').textContent = 'Reading the boards…'; await readBoards(); drawFandoms(); drawTopics(); };

// ---- search: the boards' own search, kept to the fandom boards ----
$('sf').addEventListener('submit', async (e) => {
  e.preventDefault(); const w = $('sq').value.trim(), ul = $('sres'); ul.replaceChildren(); ul.hidden = true;
  if (!w) { $('sNote').textContent = 'Type a word to look for.'; return; }
  $('sNote').textContent = 'Searching…';
  const r = await api('?q=' + encodeURIComponent(w)), ok = new Map(boards.filter((b) => !b.nsfw || adultOk()).map((b) => [b.code, b]));
  if (!r.ok) { $('sNote').textContent = r.say || 'Search did not answer just now.'; return; }
  const hits = (r.results || []).filter((x) => ok.has(x.board) && !x.hidden);
  $('sNote').textContent = hits.length ? hits.length + ' post' + (hits.length === 1 ? '' : 's') + ' on the fandom boards match "' + w + '"' : 'Nothing on the fandom boards matches "' + w + '" yet.';
  for (const x of hits) { const li = el('li'), a = el('a', '', x.sub || excerpt(x.body, 80) || 'No. ' + x.no); a.href = link(x.board, x.thread) + '#p' + x.no; li.append(a, el('small', '', '/' + x.board + '/ ' + ok.get(x.board).title + ' · ' + (x.name || 'Anonymous') + ' · ' + ago(x.at))); if (x.body && x.sub) li.append(el('small', '', excerpt(x.body, 160))); ul.append(li); }
  ul.hidden = !hits.length;
});

// ---- the Writing Room: drafts on this device ----
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const draft = () => me.drafts.find((d) => d.id === me.cur);
const total = () => me.drafts.reduce((n, d) => n + words(d.text), 0);
let counted = total(), saveT = 0;
function newDraft(title = '', text = '') { const d = { id: id(), title, text, board: '', at: Date.now() }; me.drafts.unshift(d); me.cur = d.id; counted = total(); keep(); return d; }
function drawDrafts() {
  const sel = $('drafts'); sel.replaceChildren();
  for (const d of me.drafts) { const o = el('option', '', (d.title || 'Untitled story') + ' · ' + words(d.text) + ' words'); o.value = d.id; sel.append(o); }
  sel.value = me.cur; const d = draft();
  $('dTitle').value = d.title; $('dText').value = d.text; if (d.board && [...$('dBoard').options].some((o) => o.value === d.board)) $('dBoard').value = d.board;
  $('delDraft').disabled = me.drafts.length < 2 && !d.text && !d.title;
  drawStats();
}
function drawStats() {
  const d = draft(), n = words(d.text), parts = splitParts(d.text).length;
  $('sWords').textContent = n.toLocaleString(); $('sRead').textContent = readLabel(n); $('sChars').textContent = Array.from(d.text).length.toLocaleString();
  $('sParts').textContent = parts > 1 ? 'posts as ' + parts + ' parts' : parts ? 'fits in one post' : '';
  $('sStreak').textContent = String(streak(me.days)); $('sToday').textContent = String(me.days[dayOf()] || 0);
}
function edited() {
  const d = draft(); d.title = $('dTitle').value; d.text = $('dText').value; d.at = Date.now();
  const now = total(); if (now > counted) { const k = dayOf(); me.days[k] = (me.days[k] || 0) + (now - counted); me.days = trimDays(me.days); } counted = now; // only words added count toward the streak
  drawStats(); clearTimeout(saveT); saveT = setTimeout(() => { if (!keep()) $('rNote').textContent = 'This browser would not keep the draft (storage is full or blocked). Export it to keep it.'; const o = $('drafts').selectedOptions[0]; if (o) o.textContent = (d.title || 'Untitled story') + ' · ' + words(d.text) + ' words'; }, 400);
}
$('dTitle').addEventListener('input', edited); $('dText').addEventListener('input', edited);
$('dBoard').onchange = () => { draft().board = $('dBoard').value; keep(); };
$('drafts').onchange = () => { me.cur = $('drafts').value; keep(); drawDrafts(); };
$('newDraft').onclick = () => { newDraft(); drawDrafts(); $('dTitle').focus(); $('rNote').textContent = 'A new draft.'; };
$('delDraft').onclick = () => {
  const d = draft(); if ((d.text || d.title) && !confirm('Delete "' + (d.title || 'Untitled story') + '" from this device? It cannot be brought back.')) return;
  me.drafts = me.drafts.filter((x) => x.id !== d.id); if (!me.drafts.length) newDraft(); me.cur = me.drafts[0].id; counted = total(); keep(); drawDrafts(); $('rNote').textContent = 'Draft deleted.';
};
$('export').onclick = () => {
  const d = draft(); if (!d.text.trim()) { $('rNote').textContent = 'Write something first.'; return; }
  const a = el('a'); a.href = URL.createObjectURL(new Blob([(d.title ? d.title + '\n\n' : '') + d.text + '\n'], { type: 'text/plain;charset=utf-8' })); a.download = fileName(d.title);
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); $('rNote').textContent = 'Saved as ' + a.download + '.';
};
$('copy').onclick = async () => { const d = draft(); try { await navigator.clipboard.writeText((d.title ? d.title + '\n\n' : '') + d.text); $('rNote').textContent = 'Copied.'; } catch (_) { $('dText').select(); $('rNote').textContent = 'Select all is on: copy it with your keyboard or menu.'; } };
$('share').onclick = async () => {
  const d = draft(); if (!d.text.trim()) { $('rNote').textContent = 'Write something first.'; return; }
  const url = location.origin + '/fanfic/#' + shareHash(d);
  if (url.length > SHARE_MAX) { $('rNote').textContent = 'This draft is too long for a link. Export it as a file and send that instead.'; return; }
  $('rNote').textContent = 'The link holds the draft itself; nothing is uploaded. Anyone you send it to can keep a copy.';
  if (navigator.share) { try { await navigator.share({ title: d.title || 'A story', url }); return; } catch (_) {} }
  try { await navigator.clipboard.writeText(url); $('rNote').textContent = 'Link copied. It holds the draft itself; nothing is uploaded.'; } catch (_) { prompt('The link to this draft', url); }
};
$('post').onclick = () => {
  const d = draft(), b = $('dBoard').value;
  if (!d.text.trim()) { $('rNote').textContent = 'Write something first.'; return; }
  if (!b) { $('rNote').textContent = boards.length ? 'Choose the board to post to.' : 'There is no fandom board yet. Start one, then post to it.'; $('dBoard').focus(); return; }
  const h = handoff(b, d.title, d.text);
  if (!save(HANDOFF, h)) { $('rNote').textContent = 'This browser would not hold the story for the board. Copy it and paste it on the board.'; return; }
  location.href = link(b) + '&compose=1'; // the board's own form, filled in; the visitor reads it over and posts it through the bot check
};

// a draft someone shared as a link: offered, never kept without asking
const shared = readShare(location.hash);
if (shared) {
  $('shared').hidden = false; $('sharedSay').textContent = 'Someone shared a draft with you: "' + (shared.title || 'Untitled story') + '", ' + words(shared.text).toLocaleString() + ' words.';
  const clear = () => { $('shared').hidden = true; history.replaceState(null, '', location.pathname + location.search); };
  $('sharedKeep').onclick = () => { newDraft(shared.title, shared.text); counted = total(); keep(); drawDrafts(); clear(); $('rNote').textContent = 'The shared draft is in your Writing Room.'; $('room').scrollIntoView({ block: 'start' }); };
  $('sharedNo').onclick = clear;
  setTimeout(() => $('shared').scrollIntoView({ block: 'center' }), 50);
}

if (!me.drafts.length) newDraft();
if (!draft()) me.cur = me.drafts[0].id;
drawDrafts();
await readBoards();
drawFandoms(); drawTopics(); drawDrafts();
