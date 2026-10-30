// /team/: Verse's team chat (lib/team.js, functions/api/team.js). Anyone sees the workspace: its channels, its agents and who is on a job.
// The owner (the key or owner session the stage keeps, a2m.void.owner.v1) and agents the owner invited (a key kept here, a2m.team.key.v1)
// read and write: channels, threads, @mentions with an Activity list, reactions, search, a jump-to switcher and unread marks kept on this device.
import * as T from '/lib/team.js';
import { mountRelated } from '/lib/toolkit.js';
import { connectBrain } from '/lib/brain-bridge.js';
import { ownerLink } from '/lib/owner-link.js';

const $ = (id) => document.getElementById(id);
const OWNER_KEY = 'a2m.void.owner.v1', AGENT_KEY = 'a2m.team.key.v1', READ = 'a2m.team.read.v1', ME_KEY = 'a2m.void.me.v1';
const store = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } }, set: (k, v) => { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (_) { /* private mode */ } } };
// the signed-in account (the stage's passkey session, a2m.void.me.v1): the owner's account is the owner here too (functions/api/team.js whoIs)
const memberToken = () => { try { return (JSON.parse(store.get(ME_KEY) || 'null') || {}).token || ''; } catch (_) { return ''; } };
// who this device can be, best first; start() keeps the first one the server knows, so a lapsed owner session falls back to the account
const tokens = () => [store.get(AGENT_KEY), store.get(OWNER_KEY), memberToken()].filter((t, i, a) => t && a.indexOf(t) === i);
let chosen = '';
const token = () => chosen || tokens()[0] || '';
const brain = connectBrain();
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function api(q = '', body) {
  const headers = { 'content-type': 'application/json' }, t = token(); if (t) headers.authorization = 'Bearer ' + t;
  try {
    const r = await fetch('/api/team' + q, body ? { method: 'POST', headers, body: JSON.stringify(body), cache: 'no-store' } : { headers, cache: 'no-store' });
    const j = await r.json().catch(() => ({})); return { status: r.status, ...j };
  } catch (_) { return { status: 0, ok: false, say: 'the team chat did not answer; check the connection' }; }
}

// ---- the sky, the same still starfield /fanfic/ draws ----
(function stars() {
  const c = $('stars'), g = c.getContext && c.getContext('2d'); if (!g) return;
  const draw = () => {
    const dpr = Math.min(2, devicePixelRatio || 1), w = innerWidth, h = innerHeight;
    c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px'; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0, n = Math.round((w * h) / 5200); i < n; i++) {
      const x = r() * w, y = r() * h, big = r() < 0.06, rad = big ? 1.1 + r() * 0.6 : 0.3 + r() * 0.6, a = 0.18 + r() * 0.55, tint = r();
      g.fillStyle = tint < 0.12 ? 'rgba(255,170,214,' + a + ')' : tint < 0.3 ? 'rgba(158,178,255,' + a + ')' : 'rgba(242,244,251,' + a + ')';
      g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
    }
  };
  let t = 0; draw(); addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 200); });
})();

// ---- state ----
const S = { shell: null, me: null, view: { kind: 'channel', c: 'work' }, msgs: [], last: 0, thread: null, names: [], read: {}, pollT: 0 };
try { S.read = JSON.parse(store.get(READ) || '{}') || {}; } catch (_) { S.read = {}; }
const saveRead = () => store.set(READ, JSON.stringify(S.read));
const chanCodes = () => (S.shell ? S.shell.channels.map((c) => c.code) : []);
const rendered = (body) => T.render(body, { names: S.names, channels: chanCodes() });

// ---- small helpers ----
const hue = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.codePointAt(0)) % 360; return h; };
const avatar = (m) => m.kind === 'verse' ? '<div class="av" aria-hidden="true" style="background:linear-gradient(160deg,#fff,rgb(158 178 255) 45%,rgb(92 70 190))">V</div>'
  : '<div class="av" aria-hidden="true" style="background:hsl(' + hue(m.by) + ' 70% 72%)">' + esc(String(m.by).slice(0, 1).toUpperCase()) + '</div>';
const clock = (t) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dayOf = (t) => { const d = new Date(t), today = new Date(); const y = new Date(); y.setDate(today.getDate() - 1);
  return d.toDateString() === today.toDateString() ? 'Today' : d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }); };
const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60e3)); return m < 1 ? 'just now' : m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' d'; };
const stateWord = (m) => m.state === 'busy' ? 'on a job' + (m.since ? ' · ' + ago(m.since) : '') : m.state === 'idle' ? 'idle' : 'away';

function msgHtml(m, prev, { inThread = false } = {}) {
  const cont = prev && prev.by === m.by && m.at - prev.at < 5 * 60e3 && !(m.replies && !inThread) && new Date(prev.at).toDateString() === new Date(m.at).toDateString();
  const tag = m.kind === 'verse' ? '<span class="tag">Verse</span>' : m.kind === 'owner' ? '<span class="tag">owner</span>' : '<span class="tag">agent</span>';
  const reacts = (m.reacts || []).map((r) => '<button type="button" data-react="' + esc(r.e) + '" data-id="' + m.id + '" aria-pressed="' + (r.me ? 'true' : 'false') + '" title="' + esc(r.who.join(', ')) + '">' + esc(r.e) + ' ' + r.n + '</button>').join('');
  const thread = !inThread && m.replies ? '<div class="tlink"><button type="button" data-thread="' + m.id + '">' + m.replies + (m.replies === 1 ? ' reply' : ' replies') + '</button> <span class="muted">last ' + (m.lastReply ? ago(m.lastReply) : '') + '</span></div>' : '';
  const acts = S.me ? '<div class="acts" role="group" aria-label="Message actions">' + T.EMOJI.slice(0, 4).map((e) => '<button type="button" data-react="' + e + '" data-id="' + m.id + '" aria-label="React ' + e + '">' + e + '</button>').join('')
    + (!inThread ? '<button type="button" data-thread="' + m.id + '" aria-label="Reply in thread">💬</button>' : '') + '</div>' : '';
  return '<article class="msg' + (cont ? ' cont' : '') + '" id="m' + m.id + '" data-id="' + m.id + '">' + avatar(m)
    + '<div class="meta"><b>' + esc(m.by) + '</b>' + tag + '<time datetime="' + new Date(m.at).toISOString() + '">' + clock(m.at) + '</time></div>'
    + '<div class="body">' + rendered(m.body) + (m.job ? '<div><span class="job">job ' + esc(m.job) + '</span></div>' : '') + '</div>'
    + (reacts ? '<div class="reacts">' + reacts + '</div>' : '') + thread + acts + '</article>';
}
function listHtml(list, { inThread = false, unreadFrom = 0 } = {}) {
  let out = '', prev = null, day = '';
  for (const m of list) {
    const d = dayOf(m.at); if (d !== day) { out += '<div class="day">' + esc(d) + '</div>'; day = d; prev = null; }
    if (unreadFrom && m.id === unreadFrom) { out += '<div class="newline" role="separator"><span>new</span></div>'; prev = null; }
    out += msgHtml(m, prev, { inThread }); prev = m;
  }
  return out;
}

// ---- the sidebar ----
function drawSide() {
  const sh = S.shell; if (!sh) return;
  const busy = sh.members.filter((m) => m.state === 'busy').length, idle = sh.members.filter((m) => m.state === 'idle').length;
  $('wsline').textContent = sh.members.length ? sh.members.length + (sh.members.length === 1 ? ' agent' : ' agents') + ' · ' + busy + ' on a job · ' + idle + ' idle · ' + sh.waiting + ' jobs waiting'
    : 'No agents yet · ' + sh.waiting + ' jobs waiting for one';
  $('chans').innerHTML = sh.channels.map((c) => {
    const unread = S.me && (c.msgs || 0) > (S.read[c.code] || 0) && !(S.view.kind === 'channel' && S.view.c === c.code);
    const cur = S.view.kind === 'channel' && S.view.c === c.code ? ' aria-current="page"' : '';
    return '<li><a href="#c=' + esc(c.code) + '"' + cur + (unread ? ' class="unread"' : '') + '># ' + esc(c.title) + (unread ? '<span class="badge">' + Math.min(99, c.msgs - (S.read[c.code] || 0)) + '</span>' : '<span class="n">' + (c.msgs || '') + '</span>') + '</a></li>';
  }).join('');
  $('members').innerHTML = sh.members.length ? sh.members.map((m) => '<li><span class="row" title="' + esc(m.about || '') + '"><i class="dot ' + m.state + '" aria-hidden="true"></i>' + esc(m.name) + '<span class="state">' + esc(stateWord(m)) + (m.done ? ' · ' + m.done + ' done' : '') + '</span></span></li>').join('')
    : '<li><span class="row muted">No agent has joined yet.</span></li>';
  $('newChan').hidden = !S.me; $('invite').hidden = !(S.me && S.me.kind === 'owner');
  $('actLink').toggleAttribute('aria-current', S.view.kind === 'activity');
}

// ---- the views ----
function head(title, count, about) { $('cname').textContent = title; $('ccount').textContent = count || ''; $('cabout').textContent = about || ''; }
function gate() {
  const sh = S.shell, ch = sh && sh.channels.find((c) => c.code === S.view.c);
  $('compose').hidden = true; $('gate').hidden = false;
  const n = ch ? ch.msgs : 0, ag = sh ? sh.members.length : 0;
  $('msgs').innerHTML = '<div class="empty"><div class="orb" aria-hidden="true"></div><p><b>' + (n ? n + (n === 1 ? ' message' : ' messages') + ' in #' + esc(S.view.c) : '#' + esc(S.view.c) + ' has no messages yet') + '</b></p>'
    + '<p>' + (ag ? ag + (ag === 1 ? ' agent works' : ' agents work') + ' here. ' : 'No agent has joined yet. ') + 'Verse hands each idle agent its next job from the build queue (' + (sh ? sh.waiting : 0) + ' waiting now) and gives the next one the moment it closes one.</p></div>';
}
async function openChannel(c, { keep = false, scroll = null } = {}) {
  S.view = { kind: 'channel', c }; drawSide();
  const ch = S.shell && S.shell.channels.find((x) => x.code === c);
  head('#' + c, ch && ch.msgs ? ch.msgs + (ch.msgs === 1 ? ' message' : ' messages') : '', ch ? ch.about : '');
  $('text').placeholder = c === 'work' && S.me && S.me.kind === 'owner' ? 'Ask for work: a post here goes on the build queue' : 'Message #' + c;
  if (!S.me) return gate();
  $('gate').hidden = true; $('compose').hidden = false;
  if (!keep) $('msgs').innerHTML = '<p class="empty muted">Reading #' + esc(c) + '…</p>';
  const r = await api('?c=' + encodeURIComponent(c)); if (S.view.c !== c || S.view.kind !== 'channel') return;
  if (!r.ok) { $('msgs').innerHTML = '<p class="empty">' + esc(r.say || 'that channel could not be read') + '</p>'; return; }
  S.names = (r.names || []).map((n) => n.toLowerCase()); S.msgs = r.messages; S.last = r.messages.length ? r.messages.at(-1).id : 0;
  const seen = S.read[c] || 0, firstNew = ch && ch.msgs > seen && seen && ch.msgs - seen <= r.messages.length ? (r.messages[r.messages.length - (ch.msgs - seen)] || {}).id : 0;
  $('msgs').innerHTML = r.messages.length ? listHtml(r.messages, { unreadFrom: firstNew })
    : '<div class="empty"><div class="orb" aria-hidden="true"></div><p><b>#' + esc(c) + ' is empty</b></p><p>' + (c === 'work' ? 'When an agent joins and asks for work, Verse posts its job here as a thread.' : 'Say the first thing.') + '</p></div>';
  $('msgs').scrollTop = scroll == null ? $('msgs').scrollHeight : scroll;
  markRead(c, ch ? ch.msgs : 0);
  if (r.messages.length) brain.tell('#' + c + ' ' + r.messages.at(-1).body.slice(0, 200));
  drawRelated();
}
function markRead(c, n) { if (n && (S.read[c] || 0) < n) { S.read[c] = n; saveRead(); } }
async function openList(kind, q) {
  S.view = { kind, q, c: S.view.c }; drawSide();
  $('gate').hidden = true; $('compose').hidden = true;
  if (!S.me) { head(kind === 'activity' ? 'Activity' : 'Search', '', 'Only members read the messages.'); return gate(); }
  head(kind === 'activity' ? 'Activity' : 'Search: ' + q, '', kind === 'activity' ? 'Messages that mention you or @here.' : 'Every channel, newest first.');
  $('msgs').innerHTML = '<p class="empty muted">Reading…</p>';
  const r = await api(kind === 'activity' ? '?activity' : '?q=' + encodeURIComponent(q));
  if (!r.ok) { $('msgs').innerHTML = '<p class="empty">' + esc(r.say || 'no answer') + '</p>'; return; }
  S.names = (r.names || []).map((n) => n.toLowerCase());
  $('msgs').innerHTML = r.hits.length ? r.hits.map((m) => '<p class="muted" style="margin:10px 12px 0;font-size:12px"><a href="#c=' + esc(m.c) + (m.thread ? '&t=' + m.thread : '') + '">#' + esc(m.c) + (m.thread ? ' · in a thread' : '') + '</a></p>' + msgHtml(m, null, { inThread: true })).join('')
    : '<div class="empty"><p><b>' + (kind === 'activity' ? 'Nothing mentions you yet' : 'Nothing matched') + '</b></p></div>';
}

// ---- the thread pane ----
async function openThread(id, { keep = false } = {}) {
  S.thread = id; $('app').classList.add('threaded');
  if (!keep) $('tmsgs').innerHTML = '<p class="empty muted">Reading the thread…</p>';
  const r = await api('?t=' + id); if (S.thread !== id) return;
  if (!r.ok) { $('tmsgs').innerHTML = '<p class="empty">' + esc(r.say || 'that thread could not be read') + '</p>'; $('tcompose').hidden = true; return; }
  S.names = (r.names || []).map((n) => n.toLowerCase());
  $('tchan').textContent = '#' + r.root.c; $('tcompose').hidden = !S.me; $('tcompose').dataset.c = r.root.c;
  $('tmsgs').innerHTML = msgHtml(r.root, null, { inThread: true }) + '<div class="trule">' + r.replies.length + (r.replies.length === 1 ? ' reply' : ' replies') + '</div>' + listHtml(r.replies, { inThread: true });
  $('tmsgs').scrollTop = $('tmsgs').scrollHeight; S.threadData = r; drawRelated();
}
function closeThread() { S.thread = null; S.threadData = null; $('app').classList.remove('threaded'); if (location.hash.includes('t=')) history.replaceState(null, '', '#c=' + S.view.c); drawRelated(); }

// ---- routing: #c=work, #c=work&t=12, #activity, #q=words ----
function route() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (location.hash === '#activity') return openList('activity');
  if (h.get('q')) { $('q').value = h.get('q'); return openList('search', h.get('q')); }
  const c = h.get('c') && S.shell && S.shell.channels.some((x) => x.code === h.get('c')) ? h.get('c') : (S.view.c || 'work');
  openChannel(c);
  const t = parseInt(h.get('t'), 10); if (t > 0) openThread(t); else if (S.thread) closeThread();
  $('app').classList.remove('side'); $('menu').setAttribute('aria-expanded', 'false');
}
addEventListener('hashchange', route);

// ---- polling: the shell every 20 s, the open channel and thread every 5 s, only while the tab is seen ----
async function shell() {
  const r = await api(''); if (!r.ok) return r;
  S.shell = r;
  const open = S.me && S.view.kind === 'channel' && r.channels.find((c) => c.code === S.view.c); if (open) markRead(open.code, open.msgs); // replies count too: the open channel is read
  drawSide(); return r;
}
async function poll() {
  if (document.visibilityState !== 'visible') return;
  if (S.me && S.view.kind === 'channel') {
    const r = await api('?c=' + encodeURIComponent(S.view.c) + '&since=' + S.last);
    if (r.ok && S.view.kind === 'channel') {
      if (r.messages.length) {
        const atEnd = $('msgs').scrollHeight - $('msgs').scrollTop - $('msgs').clientHeight < 80;
        if (!S.msgs.length) $('msgs').innerHTML = '';
        S.msgs.push(...r.messages); S.last = r.messages.at(-1).id;
        $('msgs').insertAdjacentHTML('beforeend', listHtml(r.messages)); if (atEnd) $('msgs').scrollTop = $('msgs').scrollHeight;
        const ch = S.shell && S.shell.channels.find((x) => x.code === S.view.c); if (ch) { ch.msgs += r.messages.length; markRead(ch.code, ch.msgs); }
      }
      // a thread under a message moved: redraw only when a reply count really changed (keeps the reader's scroll otherwise)
      const changed = (r.moved || []).some((x) => { const m = S.msgs.find((y) => y.id === x.id); return m && m.replies !== x.replies; });
      if (changed) { const top = $('msgs').scrollTop; await openChannel(S.view.c, { keep: true, scroll: top }); }
    }
    if (S.thread) openThread(S.thread, { keep: true });
  }
}
setInterval(poll, 5000);
setInterval(() => { if (document.visibilityState === 'visible') shell(); }, 20000);

// ---- writing ----
async function send(box, say, c, thread) {
  const body = box.value.trim(); if (!body) return;
  say.textContent = ''; say.className = 'say';
  const r = await api('', { do: 'post', c, body, ...(thread ? { thread } : {}) });
  if (!r.ok) { say.textContent = r.say || 'not sent'; say.className = 'say bad'; return; }
  box.value = ''; box.style.height = '';
  if (thread) openThread(thread, { keep: true }); else poll();
}
$('post').addEventListener('submit', (e) => { e.preventDefault(); send($('text'), $('postSay'), S.view.c); });
$('tpost').addEventListener('submit', (e) => { e.preventDefault(); send($('ttext'), $('tsay'), $('tcompose').dataset.c, S.thread); });
for (const [box, form] of [[$('text'), $('post')], [$('ttext'), $('tpost')]]) {
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !pickOpen()) { e.preventDefault(); form.requestSubmit(); } });
  box.addEventListener('input', () => { box.style.height = 'auto'; box.style.height = Math.min(220, box.scrollHeight) + 'px'; mentionPick(box); });
}

// @name: a small picker of the workspace's members as you type
let pick = null;
const pickOpen = () => !!pick;
function mentionPick(box) {
  if (pick) { pick.el.remove(); pick = null; }
  const before = box.value.slice(0, box.selectionStart), m = /(^|\s)@([A-Za-z0-9._-]{0,24})$/.exec(before); if (!m) return;
  const names = [...((S.shell && S.shell.members) || []).map((x) => x.name), 'here'].filter((n) => n.toLowerCase().startsWith(m[2].toLowerCase())).slice(0, 6); if (!names.length) return;
  const el = document.createElement('div'); el.className = 'pick'; el.setAttribute('role', 'listbox');
  el.innerHTML = names.map((n, i) => '<button type="button" role="option" aria-selected="' + (i === 0) + '">@' + esc(n) + '</button>').join('');
  box.parentNode.style.position = 'relative'; box.parentNode.append(el);
  const take = (n) => { const at = before.length - m[2].length; box.value = box.value.slice(0, at) + n + ' ' + box.value.slice(box.selectionStart); box.focus(); el.remove(); pick = null; };
  el.querySelectorAll('button').forEach((b, i) => b.addEventListener('mousedown', (e) => { e.preventDefault(); take(names[i]); }));
  let sel = 0; pick = { el, key: (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : names.length - 1)) % names.length; el.querySelectorAll('button').forEach((b, i) => b.setAttribute('aria-selected', String(i === sel))); }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); take(names[sel]); } else if (e.key === 'Escape') { el.remove(); pick = null; }
  } };
}
for (const box of [$('text'), $('ttext')]) box.addEventListener('keydown', (e) => { if (pick) pick.key(e); }, true);

// reactions and thread links, on any list
document.addEventListener('click', async (e) => {
  const r = e.target.closest('[data-react]'); if (r && S.me) {
    const res = await api('', { do: 'react', id: +r.dataset.id, emoji: r.dataset.react }); if (!res.ok) return;
    if (S.thread && r.closest('#tmsgs')) openThread(S.thread, { keep: true }); else if (S.view.kind === 'channel') openChannel(S.view.c, { keep: true });
    return;
  }
  const t = e.target.closest('[data-thread]'); if (t) { history.pushState(null, '', '#c=' + S.view.c + '&t=' + t.dataset.thread); openThread(+t.dataset.thread); }
});
$('tclose').addEventListener('click', closeThread);
$('menu').addEventListener('click', () => { const on = $('app').classList.toggle('side'); $('menu').setAttribute('aria-expanded', String(on)); });
$('find').addEventListener('submit', (e) => { e.preventDefault(); const q = $('q').value.trim(); if (q) location.hash = 'q=' + encodeURIComponent(q); });

// joining with an agent key (kept on this device only, never in an address)
$('join').addEventListener('submit', async (e) => {
  e.preventDefault(); const k = $('key').value.trim();
  if (!T.KEY_RE.test(k)) { $('joinSay').textContent = 'An agent key looks like vt1. then two groups of letters and digits.'; $('joinSay').className = 'say bad'; return; }
  store.set(AGENT_KEY, k); $('key').value = ''; chosen = k;
  const r = await api('?me'); if (!r.me) { store.set(AGENT_KEY, ''); chosen = ''; $('joinSay').textContent = 'That key is not a member\'s. Ask the owner for one.'; $('joinSay').className = 'say bad'; return; }
  start();
});

// dialogs: a new channel (any member), an invite (the owner)
function dialog(html, bind) { $('dlgBody').innerHTML = html; // void-review: ok (html is this file's fixed text; every value in it goes through esc)
  bind($('dlgBody')); $('dlg').showModal(); }
$('newChan').addEventListener('click', () => dialog('<h3>Make a channel</h3><form id="fc"><label for="cc">Name</label><input id="cc" required pattern="[a-z0-9][a-z0-9-]{0,20}" placeholder="design"><label for="ca">What it is for</label><input id="ca" maxlength="160"><p class="say" id="cs" role="status"></p><div class="row"><button class="btn ghost" type="button" data-x>Cancel</button><button class="btn" type="submit">Make it</button></div></form>', (b) => {
  b.querySelector('[data-x]').onclick = () => $('dlg').close();
  b.querySelector('#fc').onsubmit = async (e) => { e.preventDefault(); const code = b.querySelector('#cc').value.trim().toLowerCase();
    const r = await api('', { do: 'channel', code, about: b.querySelector('#ca').value }); if (!r.ok) { b.querySelector('#cs').textContent = r.say; b.querySelector('#cs').className = 'say bad'; return; }
    $('dlg').close(); await shell(); location.hash = 'c=' + code; };
}));
$('invite').addEventListener('click', () => dialog('<h3>Invite an agent</h3><p class="muted">The agent gets a key, shown once. It joins, asks for work, and Verse hands it its next job.</p><form id="fi"><label for="iname">Name</label><input id="iname" required maxlength="24" placeholder="scout"><label for="iabout">What it does</label><input id="iabout" maxlength="160" placeholder="a coding agent"><p class="say" id="is" role="status"></p><div class="row"><button class="btn ghost" type="button" data-x>Cancel</button><button class="btn" type="submit">Invite</button></div></form>', (b) => {
  b.querySelector('[data-x]').onclick = () => $('dlg').close();
  b.querySelector('#fi').onsubmit = async (e) => { e.preventDefault();
    const r = await api('', { do: 'invite', name: b.querySelector('#iname').value.trim(), about: b.querySelector('#iabout').value }); if (!r.ok) { b.querySelector('#is').textContent = r.say; b.querySelector('#is').className = 'say bad'; return; }
    b.innerHTML = '<h3>' + esc(r.name) + ' is invited</h3><p>Its key, shown this once. Keep it secret:</p><pre id="ik">' + esc(r.key) + '</pre><p class="muted">Give it to the agent as VERSE_TEAM_KEY, then run:</p><pre>VERSE_TEAM_KEY=… node tools/team-agent.mjs work</pre><div class="row"><button class="btn ghost" type="button" id="icopy">Copy the key</button><button class="btn" type="button" data-x>Done</button></div>'; // void-review: ok (shows the key the server just made to the owner once, escaped; no key is in the code)
    b.querySelector('#icopy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(r.key).then(() => { b.querySelector('#icopy').textContent = 'Copied'; }); };
    b.querySelector('[data-x]').onclick = () => { $('dlg').close(); shell(); }; };
}));

// Ctrl+K: jump to a channel or an agent's threads
function switcher() {
  const items = () => { const q = $('swq').value.trim().toLowerCase(); return [...chanCodes().map((c) => ({ label: '# ' + c, go: '#c=' + c })), ...((S.shell && S.shell.members) || []).map((m) => ({ label: '@ ' + m.name + ' · ' + stateWord(m), go: '#q=' + encodeURIComponent('@' + m.name) }))].filter((x) => !q || x.label.toLowerCase().includes(q)).slice(0, 12); };
  let sel = 0; const draw = () => { const it = items(); sel = Math.min(sel, Math.max(0, it.length - 1)); $('swl').innerHTML = it.map((x, i) => '<li><button type="button" role="option" aria-selected="' + (i === sel) + '" data-go="' + esc(x.go) + '">' + esc(x.label) + '</button></li>').join(''); };
  $('swq').value = ''; draw(); $('switcher').showModal();
  $('swq').oninput = () => { sel = 0; draw(); };
  $('swq').onkeydown = (e) => { const it = items(); if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : it.length - 1)) % Math.max(1, it.length); draw(); } else if (e.key === 'Enter' && it[sel]) { e.preventDefault(); $('switcher').close(); location.hash = it[sel].go.slice(1); } };
  $('swl').onclick = (e) => { const b = e.target.closest('[data-go]'); if (b) { $('switcher').close(); location.hash = b.dataset.go.slice(1); } };
}
document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA)$/.test((e.target || {}).tagName || '');
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); switcher(); return; }
  if (e.key === 'Escape' && S.thread && !document.querySelector('dialog[open]')) { closeThread(); return; }
  if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { const cs = chanCodes(), i = cs.indexOf(S.view.c); if (cs.length) { e.preventDefault(); location.hash = 'c=' + cs[(i + (e.key === 'ArrowDown' ? 1 : cs.length - 1)) % cs.length]; } return; }
  if (!typing && e.key === '/') { e.preventDefault(); $('q').focus(); }
});

// ---- hand-off: what is open goes on to the other pages, and text from them arrives in the message box ----
function openText() {
  if (S.threadData) return [S.threadData.root, ...S.threadData.replies].map((m) => m.by + ': ' + m.body).join('\n');
  return (S.msgs || []).slice(-20).map((m) => m.by + ': ' + m.body).join('\n');
}
function drawRelated() {
  const where = S.thread ? 'Thread in #' + S.view.c : '#' + S.view.c, fit = (t) => { let s = t.slice(0, 5000); while (s && encodeURIComponent(s).length > 12000) s = s.slice(0, Math.floor(s.length * 0.8)); return s; };
  mountRelated($('related'), '/team/', S.me ? [
    { label: 'Keep it in Notes', href: () => (openText() ? '/notes/?q=' + encodeURIComponent(fit('note: ' + where + ' - ' + openText())) : null) },
    { label: 'Translate it', href: () => (openText() ? '/translate/?q=' + encodeURIComponent(fit(openText())) : null) },
  ] : []);
}
// this browser's Verse account id (shown when the account is signed in but not the owner's, so the owner can name it: lib/owner-accounts.js)
const myId = () => { try { const u = (JSON.parse(localStorage.getItem(ME_KEY) || 'null') || {}).userId; return /^[A-Za-z0-9_-]{16,64}$/.test(u || '') ? u : ''; } catch (_) { return ''; } };
const incoming = new URLSearchParams(location.search).get('q'); // text another page handed over (/team/?q=...) waits in the message box

// ---- start ----
async function start() {
  await ownerLink(); // the owner's signed-in account brings an owner session first (lib/owner-link.js)
  const sh = await shell();
  let me = null, signedIn = false; chosen = '';
  for (const t of tokens()) { // the first one the server knows wins
    chosen = t; const r = await api('?me');
    if (r && r.me) { me = r.me; break; }
    if (r && r.signedIn) signedIn = true;
    if (t === store.get(AGENT_KEY)) store.set(AGENT_KEY, ''); // a removed agent's key is let go
    chosen = '';
  }
  S.me = me;
  $('who').textContent = S.me ? (S.me.kind === 'owner' ? 'Signed in as the owner' : 'Signed in as ' + S.me.name)
    : signedIn ? 'Signed in, but this account is not the owner\'s. On the home page, sign in with the owner passkey, or type unlock and the owner key once' + (myId() ? '. This account\'s Verse id: ' + myId() : '') : (sh.ok ? 'Reading as a visitor' : 'The team chat did not answer');
  $('q').disabled = !S.me;
  if (incoming && S.me) { $('text').value = incoming.slice(0, T.LIMITS.body); }
  route(); drawRelated();
}
start();
