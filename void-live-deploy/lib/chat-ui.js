// /chat/: the screen of Verse's chat (lib/chat-core.js the sealing, functions/api/chat.js the relay). Chats by invite link, end to end encrypted in the
// browser, groups, pictures, read receipts, voice and video calls peer to peer (WebRTC), search across the chats kept here, English and German.
// Kept on this device (localStorage a2m.void.chat.v1): your name, a random id for this browser, and each chat's key, name and last messages.
import { LIMITS, newKey, roomOf, seal, open, fromHash, linkOf, newId, readers, members, titleOf, searchChats } from './chat-core.js';

const STORE = 'a2m.void.chat.v1', API = '/api/chat';
// free public STUN servers (Google's and Cloudflare's): enough for most home and phone networks; a strict network needs a TURN relay, which costs money
export const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
const S = {
  en: { h1: 'Chat', intro: 'Private chats by invite link, end to end encrypted in your browser: groups, pictures, read receipts, and voice and video calls straight between browsers. No account, no phone number.',
    name: 'Your name', namePh: 'How others see you', newChat: 'New chat', newGroup: 'Name of the chat (optional)', create: 'Start the chat', join: 'Join with a link', joinPh: 'Paste an invite link', joinGo: 'Join', chats: 'Your chats',
    none: 'No chats yet. Start one and send the invite link to the people you want in it: whoever has the link can read and write.', search: 'Search your chats', searchPh: 'Words from any message kept here', found: (n) => n + ' found',
    back: 'Chats', invite: 'Invite', copy: 'Copy link', copied: 'Link copied', share: 'Share', rename: 'Rename', leave: 'Leave this chat', leaveQ: 'Remove this chat and its messages from this device?', exportTxt: 'Save as text',
    call: 'Voice call', video: 'Video call', write: 'Write a message', send: 'Send', pic: 'Send a picture', reply: 'Reply', replying: 'Replying to', cancel: 'Cancel', you: 'You',
    people: (n) => n + (n === 1 ? ' person' : ' people'), read: (who) => 'Read by ' + who, sent: 'Sent', waiting: 'Waiting to send', notKept: 'picture not kept on this device',
    linkNote: 'Whoever has this link can read and write in this chat. Send it only to the people you want in it.',
    e2e: 'End to end encrypted: the key is in the link after #, which a browser never sends to a server. The relay keeps sealed messages for 7 days (pictures 3) so the others can fetch them, and cannot read them.',
    calls: 'Calls go straight between browsers (WebRTC) through free public STUN servers. Behind some strict office or mobile networks a call cannot connect: that needs a TURN relay, which costs money, and Verse has none yet. Calls are one to one.',
    off: 'The relay cannot be reached right now: your messages wait here and go when it answers.', calling: 'Calling…', ringing: (n, v) => n + (v ? ' is video calling' : ' is calling'), answer: 'Answer', decline: 'Decline', hang: 'Hang up', mute: 'Mute', unmute: 'Unmute',
    camOff: 'Camera off', camOn: 'Camera on', inCall: 'In a call', noAnswer: 'No answer', ended: 'Call ended', failed: 'The call could not connect (a strict network needs a TURN relay)', called: (n, v) => n + (v ? ' started a video call' : ' started a call'),
    joined: (n) => n + ' joined', titled: (n, t) => n + ' named the chat “' + t + '”', today: 'Today', picTooBig: 'That picture could not be made small enough to send', noMedia: 'The microphone or camera was not allowed',
    stored: 'Stored on this device only: your name, a random id for this browser, and each chat’s key, name and last 400 messages. Nothing else.' },
  de: { h1: 'Chat', intro: 'Private Chats per Einladungslink, Ende-zu-Ende-verschlüsselt in Ihrem Browser: Gruppen, Bilder, Lesebestätigungen und Sprach- und Videoanrufe direkt zwischen Browsern. Kein Konto, keine Telefonnummer.',
    name: 'Ihr Name', namePh: 'So sehen Sie die anderen', newChat: 'Neuer Chat', newGroup: 'Name des Chats (freiwillig)', create: 'Chat starten', join: 'Mit einem Link beitreten', joinPh: 'Einladungslink einfügen', joinGo: 'Beitreten', chats: 'Ihre Chats',
    none: 'Noch keine Chats. Starten Sie einen und schicken Sie den Einladungslink an die Menschen, die dabei sein sollen: Wer den Link hat, kann lesen und schreiben.', search: 'Ihre Chats durchsuchen', searchPh: 'Wörter aus einer Nachricht, die hier gespeichert ist', found: (n) => n + ' gefunden',
    back: 'Chats', invite: 'Einladen', copy: 'Link kopieren', copied: 'Link kopiert', share: 'Teilen', rename: 'Umbenennen', leave: 'Chat verlassen', leaveQ: 'Diesen Chat und seine Nachrichten von diesem Gerät entfernen?', exportTxt: 'Als Text speichern',
    call: 'Sprachanruf', video: 'Videoanruf', write: 'Nachricht schreiben', send: 'Senden', pic: 'Ein Bild senden', reply: 'Antworten', replying: 'Antwort auf', cancel: 'Abbrechen', you: 'Sie',
    people: (n) => n + (n === 1 ? ' Person' : ' Personen'), read: (who) => 'Gelesen von ' + who, sent: 'Gesendet', waiting: 'Wartet auf das Senden', notKept: 'Bild ist auf diesem Gerät nicht mehr gespeichert',
    linkNote: 'Wer diesen Link hat, kann in diesem Chat lesen und schreiben. Schicken Sie ihn nur an die Menschen, die dabei sein sollen.',
    e2e: 'Ende-zu-Ende-verschlüsselt: Der Schlüssel steht im Link nach dem #, den ein Browser nie an einen Server schickt. Das Relais hält versiegelte Nachrichten 7 Tage (Bilder 3), damit die anderen sie abholen können, und kann sie nicht lesen.',
    calls: 'Anrufe gehen direkt zwischen Browsern (WebRTC) über freie öffentliche STUN-Server. In manchen strengen Firmen- oder Mobilnetzen kommt ein Anruf nicht zustande: Dafür braucht es ein TURN-Relais, das Geld kostet, und Verse hat noch keines. Anrufe sind zu zweit.',
    off: 'Das Relais ist gerade nicht erreichbar: Ihre Nachrichten warten hier und gehen raus, sobald es antwortet.', calling: 'Wählt…', ringing: (n, v) => n + (v ? ' ruft per Video an' : ' ruft an'), answer: 'Annehmen', decline: 'Ablehnen', hang: 'Auflegen', mute: 'Stumm', unmute: 'Ton an',
    camOff: 'Kamera aus', camOn: 'Kamera an', inCall: 'Im Gespräch', noAnswer: 'Keine Antwort', ended: 'Anruf beendet', failed: 'Der Anruf kam nicht zustande (ein strenges Netz braucht ein TURN-Relais)', called: (n, v) => n + (v ? ' hat einen Videoanruf gestartet' : ' hat angerufen'),
    joined: (n) => n + ' ist beigetreten', titled: (n, t) => n + ' hat den Chat „' + t + '“ genannt', today: 'Heute', picTooBig: 'Das Bild ließ sich nicht klein genug zum Senden machen', noMedia: 'Mikrofon oder Kamera wurden nicht erlaubt',
    stored: 'Nur auf diesem Gerät gespeichert: Ihr Name, eine zufällige Kennung für diesen Browser und von jedem Chat der Schlüssel, der Name und die letzten 400 Nachrichten. Sonst nichts.' },
};
export const langOf = () => { try { const q = new URLSearchParams(location.search).get('lang'); if (q === 'de' || q === 'en') return q; return /^de\b/i.test(navigator.language || '') ? 'de' : 'en'; } catch (_) { return 'en'; } };

const load = () => { try { const j = JSON.parse(localStorage.getItem(STORE) || 'null'); if (j && j.me && j.chats) return j; } catch (_) { /* blocked storage: a fresh state for this visit */ } return { me: { id: newId(), name: '' }, chats: {} }; };
function save(st) {
  for (let tries = 0; tries < 4; tries++) {
    try { localStorage.setItem(STORE, JSON.stringify(st)); return true; } catch (_) {
      // full: drop the oldest pictures' data first (the message stays, saying the picture is not kept), then older messages
      let dropped = false;
      for (const c of Object.values(st.chats)) { const pics = c.log.filter((m) => m.t === 'img' && m.data); for (const m of pics.slice(0, Math.ceil(pics.length / 2))) { delete m.data; dropped = true; } }
      if (!dropped) for (const c of Object.values(st.chats)) c.log = c.log.slice(-Math.floor(c.log.length / 2));
    }
  }
  return false;
}
const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn); else if (k === 'text') e.textContent = v; else e.setAttribute(k, v === true ? '' : v); } for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : String(k)); return e; };
const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;
/** a message's words with its http(s) links made into links; everything else stays text. */
function linked(t) {
  const out = []; let i = 0;
  for (const m of t.matchAll(URL_RE)) { out.push(t.slice(i, m.index)); out.push(h('a', { href: m[0], target: '_blank', rel: 'noopener noreferrer nofollow' }, m[0])); i = m.index + m[0].length; }
  out.push(t.slice(i)); return out;
}
const hhmm = (t) => { try { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
const dayOf = (t) => { try { return new Date(t).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }); } catch (_) { return ''; } };

/** a picture made small enough to send: a JPEG data URL of at most LIMITS.img characters, longest side at most LIMITS.imgPx. */
export async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    let scale = Math.min(1, LIMITS.imgPx / Math.max(img.naturalWidth, img.naturalHeight));
    for (let round = 0; round < 5; round++) {
      const w = Math.max(1, Math.round(img.naturalWidth * scale)), hh = Math.max(1, Math.round(img.naturalHeight * scale)), cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
      const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, hh); g.drawImage(img, 0, 0, w, hh);
      for (const q of [0.82, 0.7, 0.58, 0.46]) { const d = cv.toDataURL('image/jpeg', q); if (d.length <= LIMITS.img) return { data: d, w, h: hh }; }
      scale *= 0.7;
    }
    return null;
  } finally { URL.revokeObjectURL(url); }
}

export function mountChat(root, opts = {}) {
  const lang = opts.lang || langOf(), T = S[lang];
  document.documentElement.lang = lang;
  const st = load(); save(st);
  let view = { room: null }, replyTo = null, offline = false, timer = 0, call = null, rooms = {}; // rooms: room -> key (in memory)
  const ring = new Set(); // call offers already shown or answered
  const fetchFn = opts.fetch || ((...a) => fetch(...a));
  const keyOf = (room) => st.chats[room] && st.chats[room].key;

  async function addChat(key, title = '', made = false) {
    const room = await roomOf(key);
    if (!st.chats[room]) { st.chats[room] = { key, title, last: 0, log: [], unread: 0, readSent: 0, added: Date.now() }; save(st); await send(room, { t: 'join' }); if (title && made) await send(room, { t: 'title', title }); }
    return room;
  }
  // sending: the message goes into the log at once (waiting), then to the relay; anything that did not go is retried on the next poll
  async function send(room, body) {
    const c = st.chats[room]; if (!c) return;
    const m = { ...body, from: st.me.id, name: st.me.name || T.you, at: Date.now(), id: body.id || newId() };
    if (m.t !== 'read' && m.t !== 'call') { c.log.push({ ...m, pending: 1 }); trim(c); save(st); }
    m.sealed = await seal(c.key, Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'sealed')));
    (c.outbox = c.outbox || []).push({ id: m.id, sealed: m.sealed, t: m.t });
    if (m.t === 'read' || m.t === 'call') save(st);
    draw(); await flush(room);
  }
  async function flush(room) {
    const c = st.chats[room]; if (!c || !c.outbox || !c.outbox.length) return;
    while (c.outbox.length) {
      const o = c.outbox[0];
      try {
        const r = await fetchFn(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ r: room, c: o.sealed }) });
        const j = await r.json().catch(() => ({}));
        if (r.status === 429 || r.status >= 500 || !j.ok) { if (r.status === 400 || r.status === 413) c.outbox.shift(); else { offline = r.status >= 500; break; } continue; }
        offline = false; c.outbox.shift();
        if (o.id) { const m = c.log.find((x) => x.id === o.id); if (m) { delete m.pending; m.s = j.s; m.at = j.at; } }
        if (j.s <= c.last - 1 && c.last - j.s > 5) c.last = j.s - 1; // the relay started the room's numbers again (60 days quiet): fetch from here
      } catch (_) { offline = true; break; }
    }
    save(st); draw();
  }
  const trim = (c) => { if (c.log.length > LIMITS.keep) c.log = c.log.slice(-LIMITS.keep); const pics = c.log.filter((m) => m.t === 'img' && m.data); for (const m of pics.slice(0, Math.max(0, pics.length - 30))) delete m.data; };
  // receiving: the sealed rows after the last number, opened with the key; what does not open is dropped unread
  async function poll(room) {
    const c = st.chats[room]; if (!c) return 0;
    if (c.outbox && c.outbox.length) await flush(room);
    let got = 0;
    for (let page = 0; page < 10; page++) {
      let j; try { const r = await fetchFn(API + '?r=' + room + '&after=' + c.last); j = await r.json(); if (!r.ok || !j.ok) { offline = r.status >= 500; break; } offline = false; } catch (_) { offline = true; break; }
      for (const row of j.msgs) {
        c.last = Math.max(c.last, row.s);
        const m = await open(c.key, row.c); if (!m) continue;
        m.s = row.s; m.at = row.at;
        if (m.id) { const mine = c.log.find((x) => x.id === m.id); if (mine) { delete mine.pending; mine.s = row.s; mine.at = row.at; continue; } }
        if (m.t === 'call') { onCall(room, m); if (m.kind !== 'offer') continue; }
        if (m.t === 'read') c.log = c.log.filter((x) => !(x.t === 'read' && x.from === m.from && x.upTo <= m.upTo)); // only each member's latest receipt is kept
        c.log.push(m); got++;
        if (m.from !== st.me.id && (m.t === 'msg' || m.t === 'img') && !(view.room === room && document.visibilityState === 'visible')) c.unread = (c.unread || 0) + 1;
      }
      if (!j.more) break;
    }
    trim(c); save(st);
    return got;
  }
  // reading: a receipt up to the newest message from someone else, at most one every 3 seconds per chat
  let readAt = 0;
  async function markRead(room) {
    const c = st.chats[room]; if (!c) return; c.unread = 0;
    const top = c.log.filter((m) => m.from !== st.me.id && m.s && (m.t === 'msg' || m.t === 'img')).reduce((a, m) => Math.max(a, m.s), 0);
    if (top > (c.readSent || 0) && Date.now() - readAt > 3000 && document.visibilityState === 'visible') { readAt = Date.now(); c.readSent = top; await send(room, { t: 'read', upTo: top }); }
  }
  // the poll loop: the open chat every 3 s while the page is seen (every second while a call rings), the others every 30 s, nothing while hidden
  let otherAt = 0, otherIx = 0;
  async function tick() {
    clearTimeout(timer);
    if (document.visibilityState === 'visible' || call) {
      if (view.room) { await poll(view.room); await markRead(view.room); }
      if (Date.now() - otherAt > 30000) { otherAt = Date.now(); const list = Object.keys(st.chats).filter((r) => r !== view.room); for (const r of list.slice(otherIx, otherIx + 3)) await poll(r); otherIx = list.length ? (otherIx + 3) % list.length : 0; }
      draw();
    }
    timer = setTimeout(tick, call && call.state !== 'live' ? 1000 : view.room ? 3000 : 10000);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
  addEventListener('online', () => tick());

  // ---- calls (WebRTC, offer and answer sealed in the chat; the browsers then talk directly) ----
  const waitIce = (pc) => new Promise((res) => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, 2500); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); });
  function newPc(room) {
    const pc = new RTCPeerConnection({ iceServers: ICE });
    pc.ontrack = (e) => { if (call) { call.remote = e.streams[0]; draw(); } };
    pc.onconnectionstatechange = () => { if (!call) return; if (pc.connectionState === 'connected') { call.state = 'live'; draw(); } if (pc.connectionState === 'failed') { endCall(room, T.failed); } };
    return pc;
  }
  async function media(video) { try { return await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { width: 640, height: 480 } : false }); } catch (_) { flash(T.noMedia); return null; } }
  async function startCall(room, video) {
    if (call) return; const local = await media(video); if (!local) return;
    const pc = newPc(room); local.getTracks().forEach((t) => pc.addTrack(t, local));
    call = { room, cid: newId(), video, pc, local, state: 'calling', out: true, since: Date.now() }; ring.add(call.cid); draw();
    await pc.setLocalDescription(await pc.createOffer()); await waitIce(pc);
    await send(room, { t: 'call', kind: 'offer', cid: call.cid, sdp: pc.localDescription.sdp, video });
    const cid = call.cid; setTimeout(() => { if (call && call.cid === cid && call.state === 'calling') endCall(room, T.noAnswer); }, 45000);
    tick();
  }
  async function answerCall() {
    if (!call || call.state !== 'ringing') return; const { room, offer } = call;
    const local = await media(call.video); if (!local) return declineCall();
    const pc = newPc(room); local.getTracks().forEach((t) => pc.addTrack(t, local)); Object.assign(call, { pc, local, state: 'connecting' }); draw();
    await pc.setRemoteDescription({ type: 'offer', sdp: offer.sdp }); await pc.setLocalDescription(await pc.createAnswer()); await waitIce(pc);
    await send(room, { t: 'call', kind: 'answer', cid: call.cid, sdp: pc.localDescription.sdp, to: offer.from, video: call.video });
  }
  async function declineCall() { if (!call) return; const { room, cid } = call; stopMedia(); call = null; draw(); await send(room, { t: 'call', kind: 'end', cid }); }
  function stopMedia() { if (!call) return; try { call.pc && call.pc.close(); } catch (_) {} for (const t of (call.local && call.local.getTracks()) || []) t.stop(); }
  async function endCall(room, why) { if (!call) return; const cid = call.cid; stopMedia(); call = null; flash(why || T.ended); draw(); await send(room, { t: 'call', kind: 'end', cid }); }
  function onCall(room, m) {
    if (m.from === st.me.id) return;
    if (m.kind === 'offer' && !ring.has(m.cid)) {
      ring.add(m.cid); if (Date.now() - m.at > 60000) return; // an old offer from the history never rings
      if (call) { send(room, { t: 'call', kind: 'busy', cid: m.cid }); return; }
      call = { room, cid: m.cid, video: m.video, state: 'ringing', offer: m, since: Date.now() }; flash(T.ringing(m.name, m.video));
      const cid = m.cid; setTimeout(() => { if (call && call.cid === cid && call.state === 'ringing') { call = null; draw(); } }, 45000);
    } else if (m.kind === 'answer' && call && call.cid === m.cid && call.out && call.state === 'calling' && (!m.to || m.to === st.me.id)) {
      call.state = 'connecting'; call.pc.setRemoteDescription({ type: 'answer', sdp: m.sdp }).catch(() => endCall(room, T.failed));
    } else if ((m.kind === 'end' || m.kind === 'busy') && call && call.cid === m.cid) { stopMedia(); call = null; flash(m.kind === 'busy' ? T.noAnswer : T.ended); }
    draw();
  }

  // ---- drawing ----
  let flashMsg = '', flashT = 0;
  const flash = (t) => { flashMsg = t; clearTimeout(flashT); flashT = setTimeout(() => { flashMsg = ''; draw(); }, 4000); draw(); };
  const live = h('p', { class: 'live', role: 'status', 'aria-live': 'polite' });
  const body = h('div', { class: 'chatbody' });
  root.replaceChildren(live, body);
  let drawn = '';
  function draw() {
    live.textContent = flashMsg || (offline ? T.off : '');
    const key = JSON.stringify([view.room, view.room && st.chats[view.room] && st.chats[view.room].log.length, call && call.state, offline, replyTo && replyTo.id, view.q, view.invite, Object.values(st.chats).map((c) => [c.log.length, c.unread, (c.log[c.log.length - 1] || {}).s, (c.log[c.log.length - 1] || {}).pending])]);
    const focused = document.activeElement && document.activeElement.id;
    const keepDraft = document.getElementById('c-text'), draft = keepDraft ? keepDraft.value : '';
    if (key === drawn && !(call && call.state === 'live')) return; drawn = key;
    body.replaceChildren(callBar(), view.room && st.chats[view.room] ? chatView(view.room) : listView());
    const t = document.getElementById('c-text'); if (t && draft) t.value = draft;
    if (focused) { const f = document.getElementById(focused); if (f && f !== document.activeElement) try { f.focus({ preventScroll: true }); } catch (_) {} }
    const list = document.getElementById('c-msgs'); if (list) list.scrollTop = list.scrollHeight;
    const unread = Object.values(st.chats).reduce((a, c) => a + (c.unread || 0), 0); document.title = (unread ? '(' + unread + ') ' : '') + T.h1 + ' · Verse';
  }
  function callBar() {
    if (!call) return '';
    const who = st.chats[call.room] ? titleOf(st.chats[call.room], st.me.id) || T.h1 : T.h1;
    if (call.state === 'ringing') return h('div', { class: 'callbar', role: 'alertdialog', 'aria-label': T.ringing(call.offer.name, call.video) }, h('strong', {}, T.ringing(call.offer.name, call.video)), h('span', { class: 'soft' }, who),
      h('div', { class: 'row' }, h('button', { class: 'go', id: 'c-answer', on: { click: answerCall } }, T.answer), h('button', { id: 'c-decline', on: { click: declineCall } }, T.decline)));
    const box = h('div', { class: 'callbar' }, h('strong', {}, call.state === 'live' ? T.inCall : T.calling), h('span', { class: 'soft' }, who));
    if (call.video) {
      const vids = h('div', { class: 'vids' });
      if (call.remote) { const v = h('video', { autoplay: true, playsinline: true, 'aria-label': who }); v.srcObject = call.remote; vids.append(v); }
      if (call.local && call.video) { const v = h('video', { autoplay: true, playsinline: true, muted: true, class: 'me', 'aria-label': T.you }); v.muted = true; v.srcObject = call.local; vids.append(v); }
      box.append(vids);
    } else if (call.remote) { const a = h('audio', { autoplay: true }); a.srcObject = call.remote; box.append(a); }
    const at = (call.local && call.local.getAudioTracks()[0]) || null, vt = (call.local && call.local.getVideoTracks()[0]) || null;
    box.append(h('div', { class: 'row' },
      at ? h('button', { on: { click: () => { at.enabled = !at.enabled; drawn = ''; draw(); } } }, at.enabled ? T.mute : T.unmute) : '',
      vt ? h('button', { on: { click: () => { vt.enabled = !vt.enabled; drawn = ''; draw(); } } }, vt.enabled ? T.camOff : T.camOn) : '',
      h('button', { class: 'bad-b', id: 'c-hang', on: { click: () => endCall(call.room) } }, T.hang)));
    return box;
  }
  function listView() {
    const wrap = h('div', { class: 'list' });
    const nm = h('input', { id: 'c-name', type: 'text', maxlength: String(LIMITS.name), placeholder: T.namePh, value: st.me.name, autocomplete: 'nickname', on: { change: (e) => { st.me.name = e.target.value.trim().slice(0, LIMITS.name); save(st); } } });
    wrap.append(h('div', { class: 'field' }, h('label', { for: 'c-name' }, T.name), nm));
    const gname = h('input', { id: 'c-gname', type: 'text', maxlength: String(LIMITS.title), placeholder: T.newGroup });
    wrap.append(h('div', { class: 'panel' }, h('h2', {}, T.newChat), h('div', { class: 'field' }, h('label', { for: 'c-gname' }, T.newGroup), gname),
      h('button', { class: 'go', id: 'c-new', on: { click: async () => { if (!st.me.name) { st.me.name = nm.value.trim().slice(0, LIMITS.name); save(st); } const room = await addChat(newKey(), gname.value.trim(), true); view = { room, invite: true }; history.replaceState(null, '', '/chat/' + location.search); drawn = ''; draw(); tick(); } } }, T.create)));
    const jl = h('input', { id: 'c-join', type: 'url', placeholder: T.joinPh, autocomplete: 'off' });
    wrap.append(h('div', { class: 'panel' }, h('h2', {}, T.join), h('div', { class: 'row' }, jl, h('button', { id: 'c-joingo', on: { click: async () => { const f = fromHash((jl.value.split('#')[1] || '')); if (!f) { flash(T.joinPh); return; } const room = await addChat(f.key, f.title); view = { room }; drawn = ''; draw(); tick(); } } }, T.joinGo))));
    const q = h('input', { id: 'c-q', type: 'search', placeholder: T.searchPh, value: view.q || '', on: { input: (e) => { view.q = e.target.value; draw(); } } });
    const chats = Object.entries(st.chats).sort((a, b) => ((b[1].log[b[1].log.length - 1] || {}).at || b[1].added || 0) - ((a[1].log[a[1].log.length - 1] || {}).at || a[1].added || 0));
    const ul = h('ul', { class: 'chats', 'aria-label': T.chats });
    if (view.q) { const hits = searchChats(st.chats, view.q); ul.append(h('li', { class: 'soft' }, T.found(hits.length))); for (const { room, m } of hits) ul.append(h('li', {}, h('button', { class: 'chatrow', on: { click: () => { view = { room }; drawn = ''; draw(); tick(); } } }, h('span', { class: 'ct' }, titleOf(st.chats[room], st.me.id) || T.h1), h('span', { class: 'cp' }, (m.name ? m.name + ': ' : '') + (m.text || m.cap)), h('span', { class: 'cm' }, dayOf(m.at))))); }
    else for (const [room, c] of chats) {
      const last = [...c.log].reverse().find((m) => m.t === 'msg' || m.t === 'img');
      ul.append(h('li', {}, h('button', { class: 'chatrow', 'data-room': room, on: { click: () => { view = { room }; drawn = ''; draw(); tick(); } } },
        h('span', { class: 'ct' }, titleOf(c, st.me.id) || T.newChat), h('span', { class: 'cp' }, last ? (last.from === st.me.id ? T.you : last.name) + ': ' + (last.t === 'img' ? '📷 ' + (last.cap || '') : last.text) : ''),
        h('span', { class: 'cm' }, last ? hhmm(last.at) : ''), c.unread ? h('span', { class: 'badge', 'aria-label': c.unread + ' unread' }, String(c.unread)) : '')));
    }
    wrap.append(h('h2', {}, T.chats), h('div', { class: 'field' }, h('label', { for: 'c-q' }, T.search), q), chats.length ? ul : h('p', { class: 'soft' }, T.none));
    wrap.append(h('p', { class: 'note' }, T.e2e), h('p', { class: 'note' }, T.calls), h('p', { class: 'note' }, T.stored));
    return wrap;
  }
  function chatView(room) {
    const c = st.chats[room], me = st.me.id, title = titleOf(c, me) || T.newChat, ppl = members(c.log), rd = readers(c.log, me), link = linkOf(location.origin, c.key, c.title || '');
    const head = h('div', { class: 'chead' },
      h('button', { class: 'backb', id: 'c-back', 'aria-label': T.back, on: { click: () => { view = { room: null }; drawn = ''; draw(); } } }, '← ' + T.back),
      h('div', { class: 'ctitle' }, h('h2', { id: 'c-title' }, title), h('span', { class: 'soft' }, T.people(Math.max(1, ppl.length)) + ' · ' + ppl.map((p) => (p.id === me ? T.you : p.name)).join(', '))),
      h('div', { class: 'row tight' },
        h('button', { id: 'c-call', 'aria-label': T.call, title: T.call, on: { click: () => startCall(room, false) } }, '📞'),
        h('button', { id: 'c-video', 'aria-label': T.video, title: T.video, on: { click: () => startCall(room, true) } }, '🎥'),
        h('button', { id: 'c-invite', 'aria-expanded': view.invite ? 'true' : 'false', on: { click: () => { view.invite = !view.invite; drawn = ''; draw(); } } }, T.invite)));
    const out = h('div', { class: 'chat' }, head);
    if (view.invite) {
      out.append(h('div', { class: 'panel invite' }, h('p', { class: 'note' }, T.linkNote), h('input', { id: 'c-link', type: 'text', readonly: true, value: link, 'aria-label': T.invite, on: { focus: (e) => e.target.select() } }),
        h('div', { class: 'row' }, h('button', { id: 'c-copy', on: { click: async () => { try { await navigator.clipboard.writeText(link); flash(T.copied); } catch (_) { document.getElementById('c-link').select(); } } } }, T.copy),
          navigator.share ? h('button', { on: { click: () => navigator.share({ title: title + ' · Verse', url: link }).catch(() => {}) } }, T.share) : '',
          h('button', { id: 'c-rename', on: { click: async () => { const t = (prompt(T.rename, title) || '').trim().slice(0, LIMITS.title); if (t) await send(room, { t: 'title', title: t }); } } }, T.rename),
          h('button', { id: 'c-export', on: { click: () => { const txt = c.log.filter((m) => m.t === 'msg' || m.t === 'img').map((m) => new Date(m.at).toISOString().slice(0, 16).replace('T', ' ') + ' ' + m.name + ': ' + (m.t === 'img' ? '[picture] ' + (m.cap || '') : m.text)).join('\n'); const a = h('a', { href: URL.createObjectURL(new Blob([txt], { type: 'text/plain' })), download: (title || 'chat').replace(/[^\w-]+/g, '-') + '.txt' }); document.body.append(a); a.click(); a.remove(); } } }, T.exportTxt),
          h('button', { id: 'c-leave', on: { click: () => { if (confirm(T.leaveQ)) { delete st.chats[room]; save(st); view = { room: null }; drawn = ''; draw(); } } } }, T.leave))));
    }
    const ul = h('ol', { class: 'msgs', id: 'c-msgs', 'aria-label': title, 'aria-live': 'polite' });
    let lastDay = '';
    const byId = new Map(c.log.filter((m) => m.id).map((m) => [m.id, m]));
    for (const m of c.log) {
      const day = dayOf(m.at); if (day && day !== lastDay) { lastDay = day; ul.append(h('li', { class: 'day' }, day)); }
      if (m.t === 'join') { ul.append(h('li', { class: 'sys' }, T.joined(m.from === me ? T.you : m.name))); continue; }
      if (m.t === 'title') { ul.append(h('li', { class: 'sys' }, T.titled(m.from === me ? T.you : m.name, m.title))); continue; }
      if (m.t === 'call') { ul.append(h('li', { class: 'sys' }, (m.video ? '🎥 ' : '📞 ') + T.called(m.from === me ? T.you : m.name, m.video) + ' · ' + hhmm(m.at))); continue; }
      if (m.t !== 'msg' && m.t !== 'img') continue;
      const mine = m.from === me, li = h('li', { class: 'msg' + (mine ? ' mine' : ''), 'data-s': m.s || '' });
      if (!mine) li.append(h('span', { class: 'who' }, m.name));
      if (m.re && byId.get(m.re)) { const q = byId.get(m.re); li.append(h('span', { class: 'quote' }, (q.from === me ? T.you : q.name) + ': ' + (q.text || q.cap || '📷').slice(0, 120))); }
      if (m.t === 'img') li.append(m.data ? h('img', { src: m.data, alt: m.cap || T.pic, width: String(Math.min(260, m.w || 260)), height: String(Math.round(Math.min(260, m.w || 260) * ((m.h || 1) / (m.w || 1)))), loading: 'lazy' }) : h('span', { class: 'soft' }, '📷 ' + T.notKept), m.cap ? h('span', { class: 'txt' }, m.cap) : '');
      else li.append(h('span', { class: 'txt' }, linked(m.text)));
      const r = rd[m.s];
      li.append(h('span', { class: 'meta' }, hhmm(m.at), mine ? h('span', { class: 'tick' + (r && r.length ? ' read' : ''), title: m.pending ? T.waiting : r && r.length ? T.read(r.join(', ')) : T.sent, 'aria-label': m.pending ? T.waiting : r && r.length ? T.read(r.join(', ')) : T.sent }, m.pending ? '🕓' : r && r.length ? '✓✓' : '✓') : '',
        h('button', { class: 'rep', 'aria-label': T.reply, on: { click: () => { replyTo = m; drawn = ''; draw(); const t = document.getElementById('c-text'); if (t) t.focus(); } } }, '↩')));
      ul.append(li);
    }
    out.append(ul);
    const ta = h('textarea', { id: 'c-text', rows: '1', maxlength: String(LIMITS.text), placeholder: T.write, 'aria-label': T.write, on: { keydown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); } } } });
    const pick = h('input', { id: 'c-file', type: 'file', accept: 'image/*', class: 'pick', 'aria-label': T.pic, on: { change: async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return; const p = await shrink(f).catch(() => null); if (!p) { flash(T.picTooBig); return; } await send(room, { t: 'img', data: p.data, w: p.w, h: p.h, cap: ta.value.trim().slice(0, 200) }); ta.value = ''; } } });
    async function go() { const t = ta.value.trim(); if (!t) return; ta.value = ''; const re = replyTo && replyTo.id; replyTo = null; await send(room, { t: 'msg', text: t.slice(0, LIMITS.text), ...(re ? { re } : {}) }); document.getElementById('c-text') && document.getElementById('c-text').focus(); }
    const comp = h('div', { class: 'compose' });
    if (replyTo) comp.append(h('div', { class: 'replying' }, h('span', {}, T.replying + ' ' + (replyTo.from === me ? T.you : replyTo.name) + ': ' + (replyTo.text || replyTo.cap || '📷').slice(0, 80)), h('button', { on: { click: () => { replyTo = null; drawn = ''; draw(); } } }, T.cancel)));
    comp.append(h('div', { class: 'row tight' }, h('label', { for: 'c-file', class: 'btn', title: T.pic, 'aria-label': T.pic }, '📎'), pick, ta, h('button', { class: 'go', id: 'c-send', on: { click: go } }, T.send)));
    out.append(comp);
    return out;
  }

  // open an invite link: the key comes from the fragment, then the fragment is cleared from the address bar
  (async () => {
    const f = fromHash(location.hash);
    if (f) { const room = await addChat(f.key, f.title); view = { room }; history.replaceState(null, '', location.pathname + location.search); }
    draw(); tick();
    document.documentElement.dataset.chatReady = '1';
  })();
  addEventListener('hashchange', async () => { const f = fromHash(location.hash); if (f) { view = { room: await addChat(f.key, f.title) }; history.replaceState(null, '', location.pathname + location.search); drawn = ''; draw(); tick(); } });
  return { state: st, open: (room) => { view = { room }; drawn = ''; draw(); } };
}
