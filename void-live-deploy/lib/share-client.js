// The page's side of "invite someone" (frontier #11): joins an invite's room and passes this tab's cursor and summons to
// the other tabs on it. Live = a WebSocket to /api/share/<room> (the ShareRoom Durable Object, share-worker/). When the relay
// isn't there (not switched on yet, or offline), a BroadcastChannel takes over, so tabs in this one browser still share,
// and the page says so. Whatever arrives is cleaned again here (lib/share.js clean) before it reaches the stage.
//   join(room, { summon(ask, k), move(key, x, y), presence(id, x, y), gone(id), note(text) }, env = globalThis)
//     -> { mode, cursor(x, y), summoned(ask, k), moved(key, x, y), leave() }
import { clean } from './share.js';

const peerId = (v) => typeof v === 'string' && /^[\w-]{1,24}$/.test(v);

export function join(room, hooks, env = globalThis) {
  const s = { mode: 'joining', cursor() {}, summoned() {}, moved() {}, leave() {} };
  const me = 't' + Math.random().toString(36).slice(2, 9), seen = new Set();
  const note = (t) => { try { hooks.note(t); } catch (_) {} };
  // one message from the room or another tab, checked again before the stage sees it
  function take(m) {
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') { if (Array.isArray(m.peers) && m.peers.length) note('in a shared Void with ' + m.peers.length + ' other' + (m.peers.length > 1 ? 's' : '')); return; }
    if (m.t === 'join') { note('someone came into your Void'); return; }
    if (m.t === 'left') { if (peerId(m.id)) { seen.delete(m.id); hooks.gone(m.id); note('they left'); } return; }
    if (!peerId(m.from) || m.from === me) return;
    const c = clean(JSON.stringify({ t: m.t, x: m.x, y: m.y, ask: m.ask, k: m.k, key: m.key }));
    if (!c) return;
    if (!seen.has(m.from) && s.mode === 'tabs') { seen.add(m.from); note('another tab came into this Void'); }
    if (c.t === 'cursor') hooks.presence(m.from, c.x, c.y);
    else if (c.t === 'move') { if (hooks.move) hooks.move(c.key, c.x, c.y); }
    else hooks.summon(c.ask, c.k);
  }
  function tabs() {
    if (s.mode === 'tabs' || s.mode === 'left') return;
    s.mode = 'tabs';
    if (!env.BroadcastChannel) { s.mode = 'off'; note('sharing needs a newer browser'); return; }
    const ch = new env.BroadcastChannel('void-share:' + room);
    ch.onmessage = (e) => take(e.data);
    const post = (m) => { try { ch.postMessage({ ...m, from: me }); } catch (_) {} };
    s.cursor = (x, y) => post({ t: 'cursor', x, y });
    s.summoned = (ask, k) => post(k ? { t: 'summon', ask, k } : { t: 'summon', ask });
    s.moved = (key, x, y) => post({ t: 'move', key, x, y });
    s.leave = () => { if (s.mode === 'left') return; try { ch.postMessage({ t: 'left', id: me }); } catch (_) {} ch.close(); s.mode = 'left'; };
    note('the live relay is not on yet: tabs in this browser share this Void');
  }
  if (!env.WebSocket) { tabs(); return s; }
  let ws; try { ws = new env.WebSocket((env.location.protocol === 'http:' ? 'ws:' : 'wss:') + '//' + env.location.host + '/api/share/' + room); } catch (_) { tabs(); return s; }
  let open = false;
  ws.onopen = () => {
    open = true; s.mode = 'live';
    const send = (m) => { try { ws.send(JSON.stringify(m)); } catch (_) {} };
    s.cursor = (x, y) => send({ t: 'cursor', x, y });
    s.summoned = (ask, k) => send(k ? { t: 'summon', ask, k } : { t: 'summon', ask });
    s.moved = (key, x, y) => send({ t: 'move', key, x, y });
    s.leave = () => { s.mode = 'left'; try { ws.close(); } catch (_) {} };
  };
  ws.onmessage = (e) => { let m = null; try { m = JSON.parse(e.data); } catch (_) {} take(m); };
  ws.onerror = () => { if (!open) tabs(); };
  ws.onclose = (e) => {
    if (!open) return tabs();
    if (s.mode !== 'left') { s.mode = 'ended'; note(e && e.code === 4001 ? 'this Void is full' : 'the share ended'); }
  };
  return s;
}
