// /ai-authenticity-checker/: the page around lib/ai-check.js. Files are read on the device; nothing is uploaded.
import { checkFile, reportOf } from '/lib/ai-check.js';

const $ = (id) => document.getElementById(id), out = $('out'), drop = $('drop');
const LEVEL = { ai: 'AI', 'ai-edit': 'AI edit', edit: 'Edited', camera: 'Camera', info: 'Info' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function card(r) {
  const el = document.createElement('section'); el.className = 'card'; el.dataset.verdict = r.verdict;
  el.innerHTML = '<p class="verdict v-' + r.verdict + '">' + esc(r.headline) + '</p>' +
    '<p class="meta">' + esc(r.name) + ' · ' + esc(r.kind.toUpperCase()) + ' · ' + (r.bytes / 1024 / 1024).toFixed(2) + ' MB</p>' +
    '<ul class="sig">' + (r.signals.length ? r.signals.map((s) => '<li><span class="tag l-' + s.level + '">' + LEVEL[s.level] + '</span>' + esc(s.label) + (s.detail ? '<span class="detail">' + esc(s.detail) + '</span>' : '') + '</li>').join('') : '<li class="note">The file carries no metadata about how it was made.</li>') + '</ul>' +
    '<div class="row"><button type="button" class="dl">Download report</button><button type="button" class="cp">Copy report</button></div>';
  const text = reportOf(r);
  el.querySelector('.dl').addEventListener('click', () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    a.download = (r.name || 'file').replace(/\.[^.]+$/, '') + '-ai-check.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  el.querySelector('.cp').addEventListener('click', async (e) => { try { await navigator.clipboard.writeText(text); e.target.textContent = 'Copied'; } catch (_) { e.target.textContent = 'Copy failed'; } });
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
  out.textContent = '';
  for (const f of [...files].slice(0, 20)) out.append(card(checkFile(await bytesOf(f), f.name)));
  document.documentElement.dataset.checked = String(out.children.length);
}

$('file').addEventListener('change', (e) => check(e.target.files));
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files.length) check(e.dataTransfer.files); });
document.documentElement.dataset.aicheck = 'ready';
