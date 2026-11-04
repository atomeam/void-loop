// /photos/exif/'s AI check mode (owner, 2026-11-03: fold new features into the one page for their category as a mode). Verse heard it on TV
// (WFTV (ABC), 30 Oct 2026: a tool to verify whether video evidence was synthetically altered; domains/tv-built/). The photo details page
// already reads what a file records, so this mode reads what it says about who made it: Content Credentials (C2PA), the IPTC AI source
// type, Stable Diffusion and ComfyUI settings, generator and editor names and the camera (lib/ai-check.js). Photos and videos are read on
// the device; nothing is uploaded. It runs on its own input (videos too) and on every photo dropped into the page's editor.
import { checkFile, reportOf } from '/lib/ai-check.js';

const $ = (id) => document.getElementById(id), out = $('aiout'), box = $('ai');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const LEVEL = { ai: 'AI', 'ai-edit': 'AI edit', edit: 'Edited', camera: 'Camera', info: 'Info' };

function card(r) {
  const el = document.createElement('section'); el.className = 'aicard'; el.dataset.verdict = r.verdict;
  el.innerHTML = '<p class="aiv v-' + r.verdict + '">' + esc(r.headline) + '</p>' +
    '<p class="meta">' + esc(r.name) + ' · ' + esc(r.kind.toUpperCase()) + ' · ' + (r.bytes / 1024 / 1024).toFixed(2) + ' MB</p>' +
    '<ul class="sig">' + (r.signals.length ? r.signals.map((s) => '<li><span class="tag l-' + s.level + '">' + LEVEL[s.level] + '</span>' + esc(s.label) + (s.detail ? '<span class="detail">' + esc(s.detail) + '</span>' : '') + '</li>').join('') : '<li class="note">The file carries no metadata about how it was made.</li>') + '</ul>' +
    '<div class="airow"><button type="button" class="aidl">Download report</button><button type="button" class="aicp">Copy report</button></div>';
  const text = reportOf(r);
  el.querySelector('.aidl').addEventListener('click', () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = (r.name || 'file').replace(/\.[^.]+$/, '') + '-ai-check.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  el.querySelector('.aicp').addEventListener('click', async (e) => { try { await navigator.clipboard.writeText(text); e.target.textContent = 'Copied'; } catch (_) { e.target.textContent = 'Copy failed'; } });
  return el;
}

/** the bytes to check: a small file whole; a big MP4/MOV/HEIC as its boxes without the picture and sound data (mdat), read box by box, so a
 *  phone video of a few gigabytes is checked in a moment; any other big file as its first 32 MB. */
export async function bytesOf(f, LIMIT = 32 * 1024 * 1024) {
  if (f.size <= LIMIT) return new Uint8Array(await f.arrayBuffer());
  const head = new Uint8Array(await f.slice(0, 16).arrayBuffer()), tag = String.fromCharCode(...head.subarray(4, 8));
  if (tag !== 'ftyp') return new Uint8Array(await f.slice(0, LIMIT).arrayBuffer());
  const parts = []; let at = 0, total = 0;
  while (at + 8 <= f.size && parts.length < 64) {
    const h = new DataView(await f.slice(at, at + 16).arrayBuffer()); let len = h.getUint32(0); const type = String.fromCharCode(h.getUint8(4), h.getUint8(5), h.getUint8(6), h.getUint8(7));
    if (len === 1) len = h.getUint32(8) * 4294967296 + h.getUint32(12); else if (len === 0) len = f.size - at;
    if (len < 8) break;
    if (type !== 'mdat' && type !== 'free' && type !== 'skip' && total + len <= LIMIT) { const b = new Uint8Array(await f.slice(at, at + len).arrayBuffer()); parts.push(b); total += b.length; }
    at += len;
  }
  const out = new Uint8Array(total); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function check(files) {
  if (!out || !files || !files.length) return;
  out.textContent = '';
  for (const f of [...files].slice(0, 20)) out.append(card(checkFile(await bytesOf(f), f.name)));
  document.documentElement.dataset.checked = String(out.children.length);
}

if (box && out) {
  $('aifile').addEventListener('change', (e) => check(e.target.files));
  const main = $('file'); if (main) main.addEventListener('change', (e) => check(e.target.files)); // a photo opened in the editor is checked too
  box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('over'); });
  box.addEventListener('dragleave', () => box.classList.remove('over'));
  box.addEventListener('drop', (e) => { e.preventDefault(); box.classList.remove('over'); if (e.dataTransfer.files.length) check(e.dataTransfer.files); });
  if (new URLSearchParams(location.search).get('mode') === 'ai' || location.hash === '#ai') { box.open = true; box.scrollIntoView(); }
  document.documentElement.dataset.aicheck = 'ready';
}
