/**
 * spectators skill - open the stage to spectators (owner, 2026-10-18, the Opposite Era; made with tools/new-skill.mjs).
 * "open the stage to spectators" makes a link that opens a read-only snapshot of what is on this device's stage now: each
 * thing's kind, place and words (what lib/bridges.js entryFor hands a list; a kept card's words through plainOf), packed into
 * the link itself (?spectate=...), so nothing is published, posted or stored anywhere; whoever opens it sees the snapshot in a
 * spectator layer over their own Verse and can leave it with one tap. It never writes to the viewer's stage. "close the stage"
 * closes the stage here (links already sent still open the snapshot they carry; they never show what was added later).
 * Built beside the two existing ways to share: a published /@name page (needs a paid, signed-in Verse) and "invite someone"
 * (a live room for a signed-in member). Spectator reactions that reach the owner are not here: they would need a new
 * unauthenticated POST endpoint or a new message type in the invite room, which is a decision for the owner (AGENTS.md).
 * The owner's card (owner, 2026-10-18: "make sure its perfect i dont like it at all") is a plain share card: headline, what the snapshot holds,
 * the link in a copyable field, a QR code (lib/qr.js), open / refresh / close; see "the share card" below. The link format is unchanged.
 * The pure parts (spectateOf, snapshotOf, pack, unpack, linkOf, codeFromUrl, middle, thingName, summaryOf) are tested in tools/stage-pack-f.test.mjs.
 */
import { entryFor, plainOf } from '../lib/bridges.js';
import { qrMatrix, qrSvg } from '../lib/qr.js';

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
  const title = document.createElement('span'); title.textContent = 'a spectator\'s view · ' + snap.things.length + ' thing' + (snap.things.length === 1 ? '' : 's') + ' · read-only · a snapshot' + (when ? ' from ' + when : '') + ' · nothing here touches your own Verse';
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
// a link with ?spectate= opens the spectator layer over this Verse: the viewer's own stage is read, never written
if (typeof document !== 'undefined' && typeof location !== 'undefined' && !globalThis.__voidSpectate) {
  globalThis.__voidSpectate = true;
  const code = codeFromUrl(location.href), snap = code && unpack(code);
  if (snap) { const show = () => layer(snap); if (document.body) show(); else document.addEventListener('DOMContentLoaded', show, { once: true }); }
}

// ---- the share card (owner, 2026-10-18: "make sure its perfect i dont like it at all") ------------------------------------------------
// Built as the best share sheets are (Google Docs and Figma "share", Excalidraw's live collaboration): one headline, one line of what the other
// person will see, the link in a copyable field with one big Copy button, a QR code for phones, and a clear way to stop sharing. A utility
// card: no collectible frame, rarity, art or stats (data-card-plain, lib/card-frame.js). Reactions are not mentioned: the closed-list bar
// (lib/reactions.js) counts reactions to ledger steps only, never to a snapshot, so nothing from a spectator reaches the owner.

/** s shortened in the middle to at most max characters (head, "…", tail), as Finder and VS Code shorten a path. Pure. */
export function middle(s, max) {
  const t = String(s == null ? '' : s), n = Math.max(5, Math.floor(+max) || 0);
  if (t.length <= n) return t;
  const head = Math.ceil((n - 1) * 0.62), tail = n - 1 - head;
  return t.slice(0, head) + '…' + t.slice(t.length - tail); // ellipsis-ok: drawn picture or short label, the full text is on the card
}
/** a link as people read it: no https://. Pure. */
export const shownLink = (link) => String(link || '').replace(/^https?:\/\//, '');
export const LINK_MAX = 48; // the field never shows more of the link than this, so the saved text holds it once, short
/** one thing of a snapshot as a short name: { name, words } ("Note", "buy milk and eggs"). Pure. */
export function thingName(s) {
  const k = String((s && s.k) || 'thing'), label = LABEL[k] || k.replace(/-/g, ' '), name = label.charAt(0).toUpperCase() + label.slice(1);
  let words = squeeze(s && s.t);
  if (words.toLowerCase().startsWith(label + ' ')) words = words.slice(label.length + 1).replace(/^[:\s-]+/, '');
  else if (words.toLowerCase() === label || words.toLowerCase() === k) words = '';
  return { name, words };
}
/** what the snapshot holds, in the card's words: { n, line, names: [{ name, words }], more }. Pure. */
export function summaryOf(snap, show = 8) {
  const things = Array.isArray(snap) ? snap : [], n = things.length;
  const line = n ? 'Anyone with this link sees a read-only snapshot of ' + n + ' thing' + (n === 1 ? '' : 's') + ' on your stage.'
    : 'Anyone with this link sees a read-only snapshot of your stage. It is empty right now.';
  return { n, line, names: things.slice(0, show).map(thingName), more: Math.max(0, n - show) };
}

const CSS = '.spx-card{--spx-ink:#eef0f7;--spx-ink2:#c3c8d8;--spx-ink3:#a7adc0;color:var(--spx-ink)}'
  + 'html body .vpage.spx-card{background:linear-gradient(160deg,rgba(26,30,48,.97),rgba(14,16,28,.97));border:1px solid rgba(255,255,255,.12)}'
  + '.spx-card h2{display:flex;align-items:center;gap:10px;font-size:22px;font-weight:600;margin:0 40px 6px 0;color:var(--spx-ink)}'
  + '.spx-card .spx-dot{width:10px;height:10px;border-radius:50%;background:#4ade80;box-shadow:0 0 0 4px rgba(74,222,128,.18);flex:none}.spx-card[data-spectate=closed] .spx-dot{background:#8b90a0;box-shadow:none}'
  + '.spx-card .spx-lede{margin:0 0 10px;color:var(--spx-ink2);font-size:15px;line-height:1.45}'
  + '.spx-card .spx-things{display:flex;flex-wrap:wrap;gap:6px;list-style:none;margin:0 0 16px;padding:0}.spx-card .spx-things li{max-width:100%;padding:3px 10px;border-radius:999px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);font-size:13px;color:var(--spx-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.spx-card .spx-things li span{color:var(--spx-ink3)}' // ellipsis-ok: drawn picture or short label, the full text is on the card
  + '.spx-card .spx-grid{display:grid;grid-template-columns:auto minmax(0,1fr);gap:16px 20px;align-items:start;margin-top:16px}'
  + '.spx-card .spx-label{display:block;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--spx-ink3);margin:0 0 6px}'
  + '.spx-card .spx-row{display:flex;gap:8px;min-width:0}'
  + '.spx-card .spx-field{flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font:13px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding:13px 12px;border-radius:10px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.16);color:var(--spx-ink);cursor:text;user-select:all;-webkit-user-select:all}' // ellipsis-ok: drawn picture or short label, the full text is on the card
  + '.spx-card .spx-field:focus-visible,.spx-card button:focus-visible,.spx-card a:focus-visible{outline:2px solid #9db8ff;outline-offset:2px}'
  + '.spx-card .spx-body button,.spx-card .spx-open{font:inherit;font-size:14px;border-radius:10px;cursor:pointer;min-height:40px;padding:0 14px;display:inline-flex;align-items:center;gap:6px;text-decoration:none;white-space:nowrap}'
  + '.spx-card .spx-copy{flex:none;font-weight:600;background:#a9c1ff;color:#0b1020;border:1px solid #a9c1ff}.spx-card .spx-copy:hover{background:#c3d4ff}.spx-card .spx-copy[data-done]{background:#86efac;border-color:#86efac}'
  + '.spx-card .spx-actions{display:flex;flex-direction:column;align-items:stretch;gap:8px;min-width:0}.spx-card .spx-actions>*{justify-content:center}'
  + '.spx-card .spx-open,.spx-card .spx-refresh{background:transparent;color:var(--spx-ink);border:1px solid rgba(255,255,255,.22)}.spx-card .spx-open:hover,.spx-card .spx-refresh:hover{background:rgba(255,255,255,.08)}'
  + '.spx-card .spx-close{background:transparent;color:#ffc2c2;border:1px solid rgba(255,140,140,.45)}.spx-card .spx-close:hover{background:rgba(255,120,120,.12)}'
  + '.spx-card .spx-qr{margin:0;display:flex;flex-direction:column;align-items:center;gap:6px}.spx-card .spx-qr svg{display:block;width:var(--qr,140px);height:var(--qr,140px);border-radius:8px;background:#fff}'
  + '.spx-card .spx-qr figcaption{font-size:12px;color:var(--spx-ink3);text-align:center;max-width:160px}'
  + '.spx-card .spx-note{margin:14px 0 0;font-size:13px;color:var(--spx-ink3)}'
  + '.spx-card .spx-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}'
  + '@media (max-width:520px){.spx-card .spx-grid{grid-template-columns:minmax(0,1fr)}.spx-card .spx-qr{order:2}}';
function style() { if (document.getElementById('spx-css')) return; const s = document.createElement('style'); s.id = 'spx-css'; s.textContent = CSS; document.head.appendChild(s); }

const node = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const plural = (n) => n + ' thing' + (n === 1 ? '' : 's');
const CLOSED_LINE = 'the stage is closed to spectators · a link already sent still opens the snapshot it carries, never anything newer';
/** fits the link into the field: the most characters its width holds (monospace), at most LINK_MAX, shortened in the middle */
function fitField(f) {
  const link = f._link || ''; let cols = LINK_MAX;
  try { const w = f.clientWidth - 24, cs = getComputedStyle(f), c = document.createElement('canvas').getContext('2d'); c.font = cs.fontSize + ' ' + cs.fontFamily; const cw = c.measureText('0').width || 7.8; if (w > 0) cols = Math.min(LINK_MAX, Math.floor(w / cw)); } catch (_) {}
  const t = middle(shownLink(link), cols); if (f.textContent !== t) f.textContent = t;
}
/** the card's body for a state: open (a link and its snapshot) or closed */
function draw(el, st) {
  const body = el.querySelector(':scope > .spx-body'), h2 = el.querySelector(':scope > h2'), status = el.querySelector(':scope > .spx-sr');
  el.dataset.spectate = st.open ? 'open' : 'closed';
  h2.textContent = ''; h2.append(node('span', 'spx-dot'), document.createTextNode(st.open ? 'Your stage is open' : 'Your stage is closed'));
  body.textContent = ''; el._qr = null;
  if (!st.open) {
    body.append(node('p', 'spx-lede', 'Spectators can no longer get a new link from here. A link you already sent still opens the snapshot it carries, never anything newer.'));
    const again = node('button', 'spx-copy spx-reopen', 'Open it again'); again.type = 'button'; again.addEventListener('click', () => st.reopen());
    const row = node('div', 'spx-actions'); row.append(again); body.append(row);
    if (status) status.textContent = 'The stage is closed to spectators';
    return;
  }
  const sum = summaryOf(st.snap);
  body.append(node('p', 'spx-lede', sum.line));
  if (sum.names.length) {
    const ul = node('ul', 'spx-things'); ul.setAttribute('aria-label', 'What the snapshot holds');
    for (const t of sum.names) { const li = node('li', '', t.name); if (t.words) li.append(node('span', '', ' · ' + t.words)); ul.append(li); }
    if (sum.more) ul.append(node('li', '', '+' + sum.more + ' more'));
    body.append(ul);
  }
  const grid = node('div', 'spx-grid');
  const id = 'spx-f-' + Math.random().toString(36).slice(2, 8), label = node('div', 'spx-label', 'Spectator link'); label.id = id + '-l'; label.dataset.nosave = '';
  const f = node('div', 'spx-field'); f.id = id; f.tabIndex = 0; f.setAttribute('role', 'textbox'); f.setAttribute('aria-readonly', 'true'); f.setAttribute('aria-labelledby', id + '-l'); f._link = st.link;
  f.addEventListener('copy', (e) => { try { e.clipboardData.setData('text/plain', st.link); e.preventDefault(); } catch (_) {} }); // the whole link, never the shortened one
  f.addEventListener('focus', () => { try { getSelection().selectAllChildren(f); } catch (_) {} });
  const copy = node('button', 'spx-copy', 'Copy link'); copy.type = 'button';
  copy.addEventListener('click', async () => {
    let ok = false; try { await navigator.clipboard.writeText(st.link); ok = true; } catch (_) {}
    if (!ok) { try { f.focus(); getSelection().selectAllChildren(f); ok = document.execCommand('copy'); } catch (_) {} } // the field's copy handler puts the whole link
    copy.textContent = ok ? '✓ Copied' : 'Press Ctrl+C'; if (ok) copy.dataset.done = ''; if (status) status.textContent = ok ? 'Link copied' : 'Select the link and copy it';
    clearTimeout(copy._t); copy._t = setTimeout(() => { copy.textContent = 'Copy link'; delete copy.dataset.done; }, 2000);
  });
  const row = node('div', 'spx-row'); row.append(f, copy);
  const open = node('a', 'spx-open spectate-link', 'Open in a new tab ↗'); open.href = st.link; open.target = '_blank'; open.rel = 'noopener noreferrer'; open.dataset.nosave = ''; // void-review: ok (rel is set to noopener noreferrer as a property on this line)
  const refresh = node('button', 'spx-refresh', 'Refresh snapshot'); refresh.type = 'button'; refresh.title = 'Make a new link with what is on your stage now'; refresh.addEventListener('click', () => st.refresh());
  const close = node('button', 'spx-close', 'Close the stage'); close.type = 'button'; close.addEventListener('click', () => st.close());
  const actions = node('div', 'spx-actions'); actions.append(open, refresh, close);
  body.append(label, row);
  const fig = node('figure', 'spx-qr'); fig.dataset.nosave = '';
  const q = qrMatrix(st.link, { ecl: 'L' }); el._qr = q;
  if (q) {
    const t = document.createElement('template'); t.innerHTML = qrSvg(q, { margin: 3, label: 'QR code of the spectator link' }); // void-review: ok (qrSvg is built from numbers and a fixed label only)
    const n = q.size + 6, k = Math.max(2, Math.min(4, Math.floor(208 / n))); // whole CSS pixels per module, so a camera reads it off any screen
    fig.append(t.content); fig.style.setProperty('--qr', (k * n) + 'px'); fig.dataset.version = String(q.version);
    fig.append(node('figcaption', '', 'Scan with a phone camera'));
  } else fig.append(node('figcaption', '', 'Too long for a QR code: copy the link instead'));
  grid.append(fig, actions); body.append(grid);
  body.append(node('p', 'spx-note', 'The snapshot lives in the link itself; nothing is published or stored.'));
  fitField(f);
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => fitField(f)).observe(f);
}

function closeHere(api) {
  const L = document.getElementById('void-spectate'); if (L) L.remove();
  const was = openHere; openHere = false;
  const card = document.querySelector('.vpage.spx-card[data-spectate="open"]'); if (card && card._spx) draw(card, { ...card._spx, open: false });
  api.say(was ? CLOSED_LINE : 'the stage was not open to spectators');
}
async function run(text, api) {
  const q = spectateOf(text);
  if (!q) return 'none';
  if (q === 'close') { closeHere(api); return 'spectators'; }
  style();
  let el = null;
  const show = (again) => {
    const snap = snapshotOf(api.stage.things(), plainOf), code = pack(snap), st = { snap, code, link: linkOf(location.origin, code), open: true };
    openHere = true;
    st.refresh = () => { show(true); api.say('a fresh link: ' + plural(el._spx.snap.length) + ' in it'); };
    st.close = () => closeHere(api);
    st.reopen = () => { show(true); api.say('open again: ' + plural(el._spx.snap.length) + ' in the link'); };
    el._spx = st; el.dataset.spectateCode = code;
    draw(el, st);
    if (again) { const c = el.querySelector('.spx-body .spx-copy'); if (c) c.focus(); }
  };
  el = api.showPage((p) => {
    p.classList.add('spx-card'); p.dataset.cardPlain = '';
    const sr = node('div', 'spx-sr'); sr.setAttribute('role', 'status'); sr.setAttribute('aria-live', 'polite'); sr.dataset.nosave = '';
    p.append(document.createElement('h2'), node('div', 'spx-body'), sr);
  });
  show(false);
  api.say('open: ' + plural(el._spx.snap.length) + ' in the link');
  return 'spectators';
}

export default {
  name: 'spectators',
  examples: ['open the stage to spectators', 'close the stage', 'let spectators in', 'close the stage to spectators'],
  nearMisses: ['spectator sport', 'invite someone', 'share this card', 'open the book', 'close'],
  match(lower, text) { return !!spectateOf(text); },
  run
};
