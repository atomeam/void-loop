// The page's side of "invite someone" (frontier #11): joins an invite's room and passes this tab's cursor and summons to
// the other tabs on it. Live = a WebSocket to /api/share/<room> (the ShareRoom Durable Object, share-worker/). When the relay
// isn't there (not switched on yet, or offline), a BroadcastChannel takes over, so tabs in this one browser still share,
// and the page says so. Whatever arrives is cleaned again here (lib/share.js clean) before it reaches the stage.
//   join(room, { summon(ask, k), move(key, x, y), text(key, text), drop(key), sync(key, data), presence(id, x, y, flag), gone(id), note(text),
//               ripple(id, x, y), stamp(id, x, y, flag), count(n) }, env = globalThis)
//     -> { mode, cursor(x, y, flag), ripple(x, y), stamp(x, y, flag), summoned(ask, k), moved(key, x, y), edited(key, text), leave() }
// A public room (lib/share.js PUBLIC_ROOMS, "public-is-it") is joined the same way; its hooks are the crowd's: presence with a flag, ripple,
// stamp and count (how many are here, from the room's hello and each join and leave).
import { clean } from './share.js';

const peerId = (v) => typeof v === 'string' && /^[\w-]{1,24}$/.test(v);

export function join(room, hooks, env = globalThis) {
  const s = { mode: 'joining', cursor() {}, ripple() {}, stamp() {}, summoned() {}, moved() {}, edited() {}, dropped() {}, synced() {}, leave() {} };
  let here = 0; const count = (n) => { here = Math.max(0, n); try { if (hooks.count) hooks.count(here + 1); } catch (_) {} }; // others here, plus this tab
  const me = 't' + Math.random().toString(36).slice(2, 9), seen = new Set();
  const note = (t) => { try { hooks.note(t); } catch (_) {} };
  // one message from the room or another tab, checked again before the stage sees it
  function take(m) {
    if (!m || typeof m !== 'object') return;
    const pub = /^public-/.test(room);
    if (m.t === 'hello') { count(Array.isArray(m.peers) ? m.peers.length : 0); if (!pub && Array.isArray(m.peers) && m.peers.length) note('in a shared Verse with ' + m.peers.length + ' other' + (m.peers.length > 1 ? 's' : '')); return; }
    // tabs in one browser announce themselves ('join' on opening, 'here' in answer), so the count is right without a relay
    if (m.t === 'join') { if (s.mode === 'tabs' && peerId(m.id) && m.id !== me) { seen.add(m.id); count(seen.size); if (s.hereBack) s.hereBack(); } else if (s.mode !== 'tabs') count(here + 1); if (!pub) note('someone came into your Verse'); return; }
    if (m.t === 'here') { if (s.mode === 'tabs' && peerId(m.id) && m.id !== me) { seen.add(m.id); count(seen.size); } return; }
    if (m.t === 'left') { if (peerId(m.id)) { seen.delete(m.id); count(s.mode === 'tabs' ? seen.size : here - 1); hooks.gone(m.id); if (!pub) note('they left'); } return; }
    if (!peerId(m.from) || m.from === me) return;
    const c = clean(JSON.stringify({ t: m.t, x: m.x, y: m.y, flag: m.flag, a: m.a, ask: m.ask, k: m.k, key: m.key, text: m.text, data: m.data }));
    if (!c) return;
    if (!seen.has(m.from) && s.mode === 'tabs') { seen.add(m.from); count(seen.size); if (!pub) note('another tab came into this Verse'); }
    if (c.t === 'cursor') hooks.presence(m.from, c.x, c.y, c.flag, c.a);
    else if (c.t === 'ripple') { if (hooks.ripple) hooks.ripple(m.from, c.x, c.y); }
    else if (c.t === 'stamp') { if (hooks.stamp) hooks.stamp(m.from, c.x, c.y, c.flag); }
    else if (c.t === 'move') { if (hooks.move) hooks.move(c.key, c.x, c.y); }
    else if (c.t === 'text') { if (hooks.text) hooks.text(c.key, c.text); }
    else if (c.t === 'drop') { if (hooks.drop) hooks.drop(c.key); }
    else if (c.t === 'sync') { if (hooks.sync) hooks.sync(c.key, c.data); }
    else hooks.summon(c.ask, c.k);
  }
  function tabs() {
    if (s.mode === 'tabs' || s.mode === 'left') return;
    s.mode = 'tabs';
    if (!env.BroadcastChannel) { s.mode = 'off'; note('sharing needs a newer browser'); return; }
    const ch = new env.BroadcastChannel('void-share:' + room);
    ch.onmessage = (e) => take(e.data);
    const post = (m) => { try { ch.postMessage({ ...m, from: me }); } catch (_) {} };
    s.hereBack = () => { try { ch.postMessage({ t: 'here', id: me }); } catch (_) {} };
    try { ch.postMessage({ t: 'join', id: me }); } catch (_) {}
    s.cursor = (x, y, flag, a) => post({ t: 'cursor', x, y, ...(flag ? { flag } : {}), ...(a ? { a } : {}) });
    s.ripple = (x, y) => post({ t: 'ripple', x, y });
    s.stamp = (x, y, flag) => post({ t: 'stamp', x, y, flag });
    s.summoned = (ask, k) => post(k ? { t: 'summon', ask, k } : { t: 'summon', ask });
    s.moved = (key, x, y) => post({ t: 'move', key, x, y });
    s.edited = (key, text) => post({ t: 'text', key, text });
    s.dropped = (key) => post({ t: 'drop', key });
    s.synced = (key, data) => post({ t: 'sync', key, data });
    s.leave = () => { if (s.mode === 'left') return; try { ch.postMessage({ t: 'left', id: me }); } catch (_) {} ch.close(); s.mode = 'left'; };
    note(/^public-/.test(room) ? 'the live crowd is not switched on yet: tabs in this browser share it' : 'the live relay is not on yet: tabs in this browser share this Verse');
  }
  if (!env.WebSocket) { tabs(); return s; }
  let ws; try { ws = new env.WebSocket((env.location.protocol === 'http:' ? 'ws:' : 'wss:') + '//' + env.location.host + '/api/share/' + room); } catch (_) { tabs(); return s; }
  let open = false;
  ws.onopen = () => {
    open = true; s.mode = 'live';
    const send = (m) => { try { ws.send(JSON.stringify(m)); } catch (_) {} };
    s.cursor = (x, y, flag, a) => send({ t: 'cursor', x, y, ...(flag ? { flag } : {}), ...(a ? { a } : {}) });
    s.ripple = (x, y) => send({ t: 'ripple', x, y });
    s.stamp = (x, y, flag) => send({ t: 'stamp', x, y, flag });
    s.summoned = (ask, k) => send(k ? { t: 'summon', ask, k } : { t: 'summon', ask });
    s.moved = (key, x, y) => send({ t: 'move', key, x, y });
    s.edited = (key, text) => send({ t: 'text', key, text });
    s.dropped = (key) => send({ t: 'drop', key });
    s.synced = (key, data) => send({ t: 'sync', key, data });
    s.leave = () => { s.mode = 'left'; try { ws.close(); } catch (_) {} };
  };
  ws.onmessage = (e) => { let m = null; try { m = JSON.parse(e.data); } catch (_) {} take(m); };
  ws.onerror = () => { if (!open) tabs(); };
  ws.onclose = (e) => {
    if (!open) return tabs();
    if (s.mode !== 'left') { s.mode = 'ended'; note(e && e.code === 4001 ? 'this Verse is full' : 'the share ended'); }
  };
  return s;
}
