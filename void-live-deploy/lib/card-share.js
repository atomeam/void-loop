// A V01D card is easy to copy, save and paste back (owner, 2026-10-16: "each card should be easily copyable and saved and pasted").
// Copy gives readable text that ends in one code line; save downloads the same text as a file; pasting that text (or only the code line)
// into V01D reopens the card. The code carries what the card shows (title, kind, body, source links) and nothing about who made it.
// Numbers never ride in it: a reopened card earns its stats again from evidence, so a pasted code cannot claim any. Pure except bar().
export const MARK = 'V01D-CARD:';
const CODE_RE = /V01D-CARD:([A-Za-z0-9_-]{8,12000})/;
const clip = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, n);
const httpsOnly = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u).slice(0, 300) : '');

const b64 = (s) => { const bytes = new TextEncoder().encode(s); let bin = ''; for (const b of bytes) bin += String.fromCharCode(b); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (c) => { const bin = atob(String(c).replace(/-/g, '+').replace(/_/g, '/')); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new TextDecoder().decode(bytes); };

/** the facts a card carries, cleaned and capped: { v, t, k, b, src: [{ t, u }] }. Pure. */
export function dataOf({ title, kind, body, sources } = {}) {
  return { v: 1, t: clip(title, 120), k: clip(kind, 80), b: clip(body, 2400), src: (sources || []).slice(0, 8).map((s) => ({ t: clip(s.title || s.t, 100), u: httpsOnly(s.url || s.u) })).filter((s) => s.t || s.u) };
}
/** the code line for a card. Pure. */
export const codeOf = (d) => MARK + b64(JSON.stringify(dataOf({ title: d.t, kind: d.k, body: d.b, sources: d.src })));
/** the text a person copies or saves: readable, then the code. Pure. */
export function shareText(d) {
  const x = dataOf({ title: d.t, kind: d.k, body: d.b, sources: d.src });
  return [x.t, x.k, '', x.b, x.src.length ? '\nSources:\n' + x.src.map((s, i) => '[' + (i + 1) + '] ' + s.t + (s.u ? ' ' + s.u : '')).join('\n') : '', '\nV01D card from a-to-mind.com', codeOf(x)].filter((l, i) => i !== 2 || l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** the card inside a pasted text, or null: any text holding a code line, or a bare code. Pure. */
export function parse(text) {
  const m = CODE_RE.exec(String(text || '')); if (!m) return null;
  try { const j = JSON.parse(unb64(m[1])); if (!j || j.v !== 1 || !clip(j.t, 120)) return null; return dataOf({ title: j.t, kind: j.k, body: j.b, sources: j.src }); } catch (_) { return null; }
}
/** a file name for a saved card. Pure. */
export const fileName = (d) => (String(d.t || 'card').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'card') + '.v01d-card.txt';

/** what a card on the page holds, from its elements (the frame's own chrome and buttons left out). */
export function readCard(el) {
  const c = el.cloneNode(true);
  c.querySelectorAll('button, .src, .vc-art, .vc-type, .vc-adds, .vc-foot, .vc-arrows, .vc-share, style, .vtell, .sub.page-sent').forEach((x) => x.remove());
  const h2 = c.querySelector('h2'), title = h2 ? h2.textContent : '';
  if (h2) h2.remove();
  const body = Array.from(c.children).map((x) => (x.innerText || x.textContent || '').trim()).filter(Boolean).join('\n\n');
  const kind = (el.querySelector(':scope > .vc-type') || {}).textContent || '';
  const sources = [...el.querySelectorAll('.src a')].map((a) => ({ title: a.textContent.replace(/^\[\d+\]\s*/, ''), url: a.href }));
  return dataOf({ title, kind: kind.replace(/\s+/g, ' ').trim(), body, sources });
}
/** the two buttons on a card: copy card, save card. Idempotent. */
export function bar(el) {
  if (!el || el.querySelector(':scope > .vc-share') || el.classList.contains('skyc')) return;
  const w = document.createElement('div'); w.className = 'vc-share';
  const mk = (label, run) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', async (e) => { e.stopPropagation(); const done = await run(); b.textContent = done; setTimeout(() => { b.textContent = label; }, 1600); }); w.appendChild(b); };
  mk('copy card', async () => { try { await navigator.clipboard.writeText(shareText(readCard(el))); return 'copied'; } catch (_) { return 'select and copy'; } });
  mk('save card', async () => { try { const d = readCard(el), u = URL.createObjectURL(new Blob([shareText(d)], { type: 'text/plain' })), a = document.createElement('a'); a.href = u; a.download = fileName({ t: d.t }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000); return 'saved'; } catch (_) { return 'could not save'; } });
  const foot = el.querySelector(':scope > .vc-foot'); if (foot) el.insertBefore(w, foot); else el.appendChild(w);
}
export const SHARE_CSS = '.vcard .vc-share{display:flex;gap:8px;margin:8px 12px 0}.vcard .vc-share button{font:inherit;font-size:11px;letter-spacing:.1em;text-transform:uppercase;padding:4px 10px;border-radius:6px;border:1px solid var(--edge);background:rgba(255,255,255,.04);color:hsl(var(--h) 40% 78%);cursor:pointer}.vcard .vc-share button:hover,.vcard .vc-share button:focus-visible{background:rgba(255,255,255,.12);outline:none}@media (max-width:520px){.vcard .vc-share{margin:6px 6px 0}}';
