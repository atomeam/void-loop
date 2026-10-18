/**
 * spectators skill - open the stage to spectators (owner, 2026-10-18, the Opposite Era; made with tools/new-skill.mjs).
 * "open the stage to spectators" makes a link that opens a read-only snapshot of what is on this device's stage now: each
 * thing's kind, place and words (what lib/bridges.js entryFor hands a list; a kept card's words through plainOf), packed into
 * the link itself (?spectate=...), so nothing is published, posted or stored anywhere; whoever opens it sees the snapshot in a
 * spectator layer over their own V01D and can leave it with one tap. It never writes to the viewer's stage. "close the stage"
 * closes the stage here (links already sent still open the snapshot they carry; they never show what was added later).
 * Built beside the two existing ways to share: a published /@name page (needs a paid, signed-in V01D) and "invite someone"
 * (a live room for a signed-in member). Spectator reactions that reach the owner are not here: they would need a new
 * unauthenticated POST endpoint or a new message type in the invite room, which is a decision for the owner (AGENTS.md).
 * The pure parts (spectateOf, snapshotOf, pack, unpack, linkOf, codeFromUrl) are tested in tools/stage-pack-f.test.mjs.
 */
import { entryFor, plainOf } from '../lib/bridges.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
/** 'open' | 'close' | null. Pure. */
export function spectateOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?open\s+(?:the\s+|my\s+)?stage\s+(?:to|for)\s+(?:the\s+)?spectators$/.test(t) || /^(?:please\s+)?let\s+(?:the\s+)?spectators\s+in$/.test(t) || /^(?:please\s+)?(?:invite|allow)\s+spectators$/.test(t)) return 'open';
  if (/^(?:please\s+)?close\s+(?:the\s+|my\s+)?stage(?:\s+to\s+(?:the\s+)?spectators)?$/.test(t) || /^(?:please\s+)?(?:no\s+more|dismiss|shut\s+out)\s+(?:the\s+)?spectators$/.test(t)) return 'close';
  return null;
}
export const MAX_THINGS = 24, MAX_TEXT = 160, MAX_CODE = 6000, SKIP = ['unkeepable', 'feud', 'challenge', 'goal', 'quiz']; // the unkeepable is never copied; the rest are ephemeral play
const KIND = /^[a-z][a-z0-9-]{0,23}$/;
const squeeze = (s) => String(s || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
/** a thing's words for the snapshot: a list's entries, else what entryFor gives, else its name. Pure given plain. */
export function wordsOf(th, plain = '') {
  if (!th) return '';
  if (th.kind === 'list') return squeeze((th.items || []).map((i) => (Array.isArray(i) ? i[0] : i && i.text) || '').filter(Boolean).join(' · '));
  return squeeze(entryFor(th, plain) || th.name || th.title || '');
}
/** the stage as spectators see it: [{ k, x, y, t }], at most MAX_THINGS, words capped, the ephemeral and the unkeepable left out. Pure given plain. */
export function snapshotOf(things, plain = () => '') {
  return Object.values(things || {}).filter((t) => t && t.kind && KIND.test(t.kind) && !SKIP.includes(t.kind)).slice(-MAX_THINGS)
    .map((t) => ({ k: t.kind, x: Math.round(+t.x || 0), y: Math.round(+t.y || 0), t: wordsOf(t, t.kind === 'kept' ? plain(t.html) : '').slice(0, MAX_TEXT) }));
}
const b64 = (s) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (c) => { const bin = atob(String(c).replace(/-/g, '+').replace(/_/g, '/')); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); };
/** the snapshot as a link code (base64url JSON), shortened until it fits MAX_CODE: words cut to 60, then dropped. Pure. */
export function pack(snapshot, at = Date.now()) {
  let things = (snapshot || []).map((s) => ({ ...s }));
  for (const trim of [null, 60, 0]) {
    if (trim !== null) things = things.map((s) => ({ ...s, t: String(s.t || '').slice(0, trim) }));
    const code = b64(JSON.stringify({ v: 1, at: Math.floor(at), things }));
    if (code.length <= MAX_CODE) return code;
  }
  return b64(JSON.stringify({ v: 1, at: Math.floor(at), things: things.slice(0, 8).map((s) => ({ ...s, t: '' })) }));
}
/** { at, things } from a code, or null when it is not a snapshot made here. Pure. */
export function unpack(code) {
  try {
    const j = JSON.parse(unb64(String(code || '').replace(/[^A-Za-z0-9_-]/g, '')));
    if (!j || j.v !== 1 || !Array.isArray(j.things) || j.things.length > 40) return null;
    const things = j.things.map((s) => s && typeof s === 'object' && KIND.test(String(s.k)) && Number.isFinite(+s.x) && Number.isFinite(+s.y)
      ? { k: String(s.k), x: Math.max(0, Math.min(4000, Math.round(+s.x))), y: Math.max(0, Math.min(4000, Math.round(+s.y))), t: squeeze(typeof s.t === 'string' ? s.t : '').slice(0, 400) } : null);
    return things.every(Boolean) ? { at: Number.isFinite(+j.at) ? +j.at : 0, things } : null;
  } catch (_) { return null; }
}
export const linkOf = (origin, code) => String(origin).replace(/\/$/, '') + '/?spectate=' + code;
/** the code in a link, or null. Pure. */
export function codeFromUrl(href) { try { const c = new URL(href).searchParams.get('spectate'); return c && /^[A-Za-z0-9_-]{8,}$/.test(c) ? c : null; } catch (_) { return null; } }

// ---- the stage and the spectator layer -----------------------------------------------------------------------------------------
const LABEL = { sticky: 'note', kept: 'card', calc: 'calculator', convert: 'converter', image: 'picture' };
let openHere = false;
function layer(snap) {
  const old = document.getElementById('void-spectate'); if (old) old.remove();
  const L = document.createElement('div'); L.id = 'void-spectate'; L.setAttribute('role', 'region'); L.setAttribute('aria-label', 'a spectator view of someone else\'s stage');
  L.style.cssText = 'position:fixed;inset:0;z-index:30;background:rgba(6,8,16,.92);color:#e6ecff;overflow:auto;font-size:13px';
  const head = document.createElement('div'); head.className = 'spectate-head'; head.style.cssText = 'position:sticky;top:0;display:flex;gap:12px;align-items:center;padding:10px 16px;background:rgba(6,8,16,.9);border-bottom:1px solid rgba(255,255,255,.12)';
  const when = snap.at ? new Date(snap.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  const title = document.createElement('span'); title.textContent = 'a spectator\'s view · ' + snap.things.length + ' thing' + (snap.things.length === 1 ? '' : 's') + ' · read-only · a snapshot' + (when ? ' from ' + when : '') + ' · nothing here touches your own V01D';
  const leave = document.createElement('button'); leave.type = 'button'; leave.className = 'spectate-leave'; leave.textContent = 'leave';
  leave.style.cssText = 'margin-left:auto;font:inherit;font-size:12px;padding:4px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:inherit;cursor:pointer';
  leave.addEventListener('click', () => { L.remove(); try { const u = new URL(location.href); u.searchParams.delete('spectate'); history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); } catch (_) {} });
  head.append(title, leave); L.appendChild(head);
  const field = document.createElement('div'); field.className = 'spectate-field'; field.style.cssText = 'position:relative;min-height:calc(100vh - 48px)';
  const sx = Math.min(1, (innerWidth - 40) / 1200), sy = Math.min(1, (innerHeight - 100) / 800); // the owner's stage, fitted to this screen
  for (const t of snap.things) {
    const c = document.createElement('div'); c.className = 'spectate-thing'; c.dataset.kind = t.k;
    c.style.cssText = 'position:absolute;left:' + Math.round(20 + t.x * sx) + 'px;top:' + Math.round(20 + t.y * sy) + 'px;max-width:240px;padding:8px 11px;border-radius:10px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18)';
    const k = document.createElement('div'); k.style.cssText = 'font-size:10px;letter-spacing:.12em;text-transform:uppercase;opacity:.7'; k.textContent = LABEL[t.k] || t.k.replace(/-/g, ' ');
    const w = document.createElement('div'); w.textContent = t.t || ''; if (!t.t) w.style.opacity = '.5';
    c.append(k, w); field.appendChild(c);
  }
  if (!snap.things.length) { const e = document.createElement('p'); e.style.cssText = 'padding:40px 16px;opacity:.7'; e.textContent = 'an empty stage'; field.appendChild(e); }
  L.appendChild(field); document.body.appendChild(L);
  return L;
}
// a link with ?spectate= opens the spectator layer over this V01D: the viewer's own stage is read, never written
if (typeof document !== 'undefined' && typeof location !== 'undefined' && !globalThis.__voidSpectate) {
  globalThis.__voidSpectate = true;
  const code = codeFromUrl(location.href), snap = code && unpack(code);
  if (snap) { const show = () => layer(snap); if (document.body) show(); else document.addEventListener('DOMContentLoaded', show, { once: true }); }
}

async function run(text, api) {
  const q = spectateOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  if (q === 'close') {
    const L = document.getElementById('void-spectate'); if (L) L.remove();
    api.say(openHere ? 'the stage is closed to spectators · a link already sent still opens the snapshot it carries, never anything newer' : 'the stage was not open to spectators');
    openHere = false;
    return 'spectators';
  }
  const snap = snapshotOf(api.stage.things(), plainOf), code = pack(snap), link = linkOf(location.origin, code);
  openHere = true;
  const el = showPage((p) => {
    p.innerHTML = '<h2>The stage is open to spectators</h2><p>Anyone with this link sees a read-only copy of what is on your stage now: ' + snap.length + ' thing' + (snap.length === 1 ? '' : 's') + ', as words. The copy lives in the link itself; nothing is published or stored anywhere.</p>'
      + '<p><a class="spectate-link" target="_blank" rel="noopener"></a></p><button type="button" class="spectate-copy g-btn" style="font:inherit;font-size:12px;padding:5px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:inherit;cursor:pointer">copy link</button>'
      + '<p class="sub">Spectators see this moment, not what you add later: say it again for a fresh link. Reactions from spectators do not reach you yet. "close the stage" closes it here.</p>'
      + '<div class="src">a snapshot of this device\'s stage, packed into the link · not a published page, not a live room (those are "publish my void as @name" and "invite someone")</div>';
  });
  const a = el.querySelector('.spectate-link'); a.href = link; a.textContent = link.length > 90 ? link.slice(0, 88) + '…' : link;
  const b = el.querySelector('.spectate-copy'); b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(link); b.textContent = 'copied'; } catch (_) { b.textContent = 'select and copy'; } setTimeout(() => { b.textContent = 'copy link'; }, 1600); });
  el.dataset.spectateCode = code;
  api.say('open: ' + snap.length + ' thing' + (snap.length === 1 ? '' : 's') + ' in the link');
  return 'spectators';
}

export default {
  name: 'spectators',
  examples: ['open the stage to spectators', 'close the stage', 'let spectators in', 'close the stage to spectators'],
  nearMisses: ['spectator sport', 'invite someone', 'share this card', 'open the book', 'close'],
  match(lower, text) { return !!spectateOf(text); },
  run
};
