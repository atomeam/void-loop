/**
 * photos skill - "my photos", "add photos", "my photos from june": Verse Photos, a photo library that lives on this device (owner, 2026-10-19:
 * "Verse should become good at storing pictures ... better than facebook eventually"). Step 1 of 3: the pictures are kept in this browser
 * (IndexedDB), never sent anywhere, full size and untouched; the same picture added twice is kept once. The card groups them by the day they were
 * taken (from the photo's own EXIF date), finds them by year, month, album or caption, opens one large with previous / next (arrows, swipe, Esc),
 * and saves a copy without its hidden location (lib/safety.js stripMeta) for sharing. Pure part: lib/photo-library.js. Step 2 (sync across
 * devices, which costs storage money) waits for the owner.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { readExif, whenOf, byDay, search, albums, summary, dayLabel, placeKey } from '../lib/photo-library.js';
import { stripMeta } from '../lib/safety.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const PICS = '(?:photos?|pictures?|pics|photo library|picture library)';
const VERB = '(?:(?:show|open|see|view|browse|find|search)(?: me)? )?';
const MINE = new RegExp('^' + VERB + '(?:my|our)(?: (?:void|verse))? ' + PICS + '(?: (?:from|in|of|taken in|taken on|on|at|with) (.+))?$');
const FROM = new RegExp('^' + VERB + '(?:the )?' + PICS + ' (?:from|taken in|taken on) (.+)$');
const ADD = new RegExp('^(?:add|upload|import|store|save|keep|back up|backup)(?: (?:my|some|a few|these|new))? ' + PICS + '(?: (?:to|in|on|into) (?:my |the )?(?:(?:void|verse)|library|photo library|photos))?$');
/** what a photos ask wants: { add: true } to add pictures, { query } to show the library (query '' for all of it), or null for any other ask.
 *  Without "my", only "photos from …" is the library: "photo of a cat" and "take a photo" are not. Pure. */
export function photosAsk(text) {
  const t = CLEAN(text);
  if (ADD.test(t)) return { add: true, query: '' };
  if (/^(?:open )?(?:verse|void) photos$|^(?:open )?(?:the |my )?photo library$/.test(t)) return { query: '' };
  const m = MINE.exec(t) || FROM.exec(t);
  return m ? { query: m[1] ? m[1].trim() : '' } : null;
}
/** a thumbnail's size: the long side at most max, never larger than the photo. Pure. */
export function thumbSize(w, h, max = 320) {
  if (!(w > 0 && h > 0)) return { w: 0, h: 0 };
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
/** "photo.jpg" -> "photo-no-location.jpg". Pure. */
export const sharedName = (name) => { const n = String(name || 'photo.jpg'); const i = n.lastIndexOf('.'); return i > 0 ? n.slice(0, i) + '-no-location' + n.slice(i) : n + '-no-location'; };

// ---- where the pictures are kept: IndexedDB on this device (two stores: the small records for the grid, the full pictures by id) ----
const DB = 'a2m.void.photos', META = 'photos', BLOBS = 'blobs';
let mem = null; // this tab only, when IndexedDB is not allowed (a private window)
function openDb() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains(META)) d.createObjectStore(META, { keyPath: 'id' }); if (!d.objectStoreNames.contains(BLOBS)) d.createObjectStore(BLOBS, { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(new Error('blocked'));
    } catch (e) { rej(e); }
  });
}
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function store() {
  if (mem) return mem;
  try {
    const db = await openDb();
    const tx = (names, mode) => db.transaction(names, mode);
    return {
      where: 'this device',
      all: () => req(tx(META, 'readonly').objectStore(META).getAll()),
      blob: async (id) => { const r = await req(tx(BLOBS, 'readonly').objectStore(BLOBS).get(id)); return r && r.blob; },
      has: async (id) => (await req(tx(META, 'readonly').objectStore(META).getKey(id))) !== undefined,
      put: (rec, blob) => new Promise((res, rej) => { const t = tx([META, BLOBS], 'readwrite'); t.objectStore(META).put(rec); if (blob) t.objectStore(BLOBS).put({ id: rec.id, blob }); t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('abort')); }),
      del: (id) => new Promise((res, rej) => { const t = tx([META, BLOBS], 'readwrite'); t.objectStore(META).delete(id); t.objectStore(BLOBS).delete(id); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }),
    };
  } catch (_) {
    const recs = new Map(), blobs = new Map();
    mem = { where: 'this tab only', all: async () => [...recs.values()], blob: async (id) => blobs.get(id), has: async (id) => recs.has(id), put: async (r, b) => { recs.set(r.id, r); if (b) blobs.set(r.id, b); }, del: async (id) => { recs.delete(id); blobs.delete(id); } };
    return mem;
  }
}

async function idOf(bytes) {
  try { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)); return [...h.subarray(0, 12)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
  catch (_) { let h = 2166136261; for (let i = 0; i < bytes.length; i += 97) h = Math.imul(h ^ bytes[i], 16777619); return 'f' + (h >>> 0).toString(16) + bytes.length.toString(16); }
}
async function thumbOf(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const s = thumbSize(bmp.width, bmp.height), c = document.createElement('canvas');
    c.width = s.w; c.height = s.h; c.getContext('2d').drawImage(bmp, 0, 0, s.w, s.h);
    const w = bmp.width, h = bmp.height; if (bmp.close) bmp.close();
    const blob = await new Promise((res) => c.toBlob(res, 'image/webp', 0.8)) || await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.8));
    return { thumb: blob, w, h };
  } catch (_) { return { thumb: null, w: 0, h: 0 }; } // a kind of picture this browser cannot draw (HEIC outside Safari): kept, shown by name
}
/** add files to the library: { added, same, skipped }. The same picture twice is kept once. */
async function addFiles(files, st, onEach) {
  let added = 0, same = 0, skipped = 0;
  for (const f of files) {
    if (!/^image\//.test(f.type || '') && !/\.(?:jpe?g|png|webp|gif|avif|heic|heif)$/i.test(f.name || '')) { skipped++; continue; }
    const bytes = new Uint8Array(await f.arrayBuffer());
    const id = await idOf(bytes);
    if (await st.has(id)) { same++; continue; }
    const ex = readExif(bytes), t = await thumbOf(f);
    await st.put({ id, name: String(f.name || 'photo').slice(0, 160), type: f.type || '', size: f.size, fileTime: f.lastModified, taken: ex.taken, lat: ex.lat, lon: ex.lon, orientation: ex.orientation, w: t.w, h: t.h, thumb: t.thumb, album: '', caption: '', added: Date.now() }, f);
    added++; if (onEach) onEach(added + same + skipped);
  }
  return { added, same, skipped };
}

const CSS = '.ph-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}.ph-bar input[type=search]{flex:1;min-width:140px}'
  + '.ph-day{margin:14px 0 6px;font-weight:600}.ph-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:4px}'
  + '.ph-tile{all:unset;cursor:pointer;display:block;aspect-ratio:1;overflow:hidden;border-radius:6px;background:rgba(255,255,255,.06);font-size:11px;word-break:break-all}'
  + '.ph-tile:focus-visible{outline:2px solid var(--accent)}.ph-tile img{display:block;width:100%;height:100%;object-fit:cover}.ph-tile span{display:block;padding:6px}'
  + '.ph-chips{display:flex;flex-wrap:wrap;gap:6px}.ph-chip{all:unset;cursor:pointer;padding:3px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.2);font-size:13px}'
  + '.ph-view{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.94);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;touch-action:pan-y}'
  + '.ph-view img{max-width:100%;max-height:78vh;object-fit:contain}.ph-view .ph-info{color:#ddd;margin:8px 0;text-align:center;font-size:14px}.ph-view .ph-info a{color:#9cf}'
  + '.ph-view .ph-nav{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}';

async function run(text, api) {
  const ask = photosAsk(text);
  if (!ask) return 'none';
  const { showPage, esc } = api;
  const st = await store();
  let all = [], query = ask.query, urls = [], shown = [];
  const load = async () => { try { all = await st.all(); } catch (_) { all = []; } };
  await load();
  showPage((el) => {
    el.classList.add('photos-card');
    const free = () => { for (const u of urls) URL.revokeObjectURL(u); urls = []; };
    const url = (b) => { const u = URL.createObjectURL(b); urls.push(u); return u; };
    const draw = (note) => {
      free();
      shown = search(all, query).sort((a, b) => whenOf(b).localeCompare(whenOf(a)));
      const days = byDay(shown), al = albums(all);
      shown = days.flatMap((d) => d.photos); // the viewer walks the photos in the order the grid shows them
      el.innerHTML = '<style>' + CSS + '</style><h2>My photos</h2>'
        + '<div class="sub" data-ph-summary>' + esc(all.length ? summary(all) + ' · kept on ' + st.where : 'Nothing here yet. Your photos stay on ' + st.where + ', full size, and are never uploaded.') + '</div>'
        + '<div class="ph-bar"><label class="tr-copy" style="cursor:pointer">Add photos<input type="file" accept="image/*" multiple data-ph-add hidden></label>'
        + '<input type="search" placeholder="june 2024, last year, an album…" value="' + esc(query) + '" data-ph-find aria-label="Find photos"></div>'
        + (al.length ? '<div class="ph-chips">' + al.map((a) => '<button type="button" class="ph-chip" data-ph-album="' + esc(a.name) + '">' + esc(a.name + ' · ' + a.count) + '</button>').join('') + '</div>' : '')
        + (note ? '<p data-ph-note>' + esc(note) + '</p>' : '')
        + (all.length && !shown.length ? '<p>No photos match "' + esc(query) + '".</p>' : '')
        + days.map((d) => '<div class="ph-day">' + esc(d.label) + ' <span class="sub">' + esc(String(d.photos.length)) + '</span></div><div class="ph-grid">'
          + d.photos.map((p) => '<button type="button" class="ph-tile" data-ph-open="' + esc(p.id) + '">' + (p.thumb ? '<img alt="' + esc(p.caption || p.name) + '" src="' + url(p.thumb) + '">' : '<span>' + esc(p.name) + '</span>') + '</button>').join('') + '</div>').join('')
        + '<div class="src">Verse Photos, step 1: kept in this browser only. Clearing this site\'s data removes them; sync across devices comes next.</div>';
    };
    draw(ask.add ? 'Tap "Add photos" to pick pictures from this device.' : '');

    el.addEventListener('change', async (e) => {
      if (!e.target.matches('[data-ph-add]')) return;
      const files = [...e.target.files];
      if (!files.length) return;
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (_) {}
      const n = el.querySelector('[data-ph-summary]');
      const r = await addFiles(files, st, (k) => { if (n) n.textContent = 'Keeping ' + k + ' of ' + files.length + '…'; }); // ellipsis-ok: progress text, not a cut
      await load();
      draw(['Added ' + r.added + (r.added === 1 ? ' photo' : ' photos'), r.same ? r.same + ' already here' : '', r.skipped ? r.skipped + ' not pictures' : ''].filter(Boolean).join(' · ') + '.');
    });
    let timer = 0;
    el.addEventListener('input', (e) => {
      if (!e.target.matches('[data-ph-find]')) return;
      clearTimeout(timer);
      timer = setTimeout(() => { query = e.target.value; draw(''); const f = el.querySelector('[data-ph-find]'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }, 250);
    });
    el.addEventListener('click', (e) => {
      const t = e.target.closest && e.target.closest('[data-ph-open], [data-ph-album]');
      if (!t) return;
      if (t.hasAttribute('data-ph-album')) { query = t.getAttribute('data-ph-album'); draw(''); return; }
      view(shown.findIndex((p) => p.id === t.getAttribute('data-ph-open')));
    });

    function view(i) {
      if (i < 0 || !shown.length) return;
      const box = document.createElement('div'); box.className = 'ph-view'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Photo');
      let at = i, big = '', x0 = null, changed = false;
      const close = () => { if (big) URL.revokeObjectURL(big); document.removeEventListener('keydown', key); box.remove(); if (changed) draw(''); };
      const go = (d) => show((at + d + shown.length) % shown.length);
      const key = (e) => { if (!box.isConnected) return; if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); };
      async function show(k) {
        at = k; const p = shown[k], b = await st.blob(p.id);
        if (big) URL.revokeObjectURL(big);
        big = b ? URL.createObjectURL(b) : '';
        const ll = placeKey(p) ? p.lat.toFixed(4) + '/' + p.lon.toFixed(4) : '';
        const where = ll ? ' · <a href="https://www.openstreetmap.org/?mlat=' + p.lat.toFixed(4) + '&amp;mlon=' + p.lon.toFixed(4) + '#map=14/' + ll + '" target="_blank" rel="noopener">where it was taken</a>' : '';
        box.innerHTML = '<style>' + CSS + '</style>' + (big ? '<img src="' + big + '" alt="' + esc(p.caption || p.name) + '">' : '<p>This picture could not be opened.</p>')
          + '<div class="ph-info" data-ph-info>' + esc((p.taken ? dayLabel(p.taken) + ', ' + p.taken.slice(11, 16) : 'Date unknown') + (p.album ? ' · ' + p.album : '') + (p.caption ? ' · ' + p.caption : '')) + where + ' · ' + esc((k + 1) + ' of ' + shown.length) + '</div>'
          + '<div class="ph-nav">' + (shown.length > 1 ? '<button type="button" class="tr-copy" data-v="prev">Previous</button><button type="button" class="tr-copy" data-v="next">Next</button>' : '')
          + '<button type="button" class="tr-copy" data-v="album">Album…</button><button type="button" class="tr-copy" data-v="caption">Caption…</button>'
          + '<button type="button" class="tr-copy" data-v="share">Save a copy without location</button><button type="button" class="tr-copy" data-v="del">Delete</button><button type="button" class="tr-copy" data-v="close">Close</button></div>';
      }
      box.addEventListener('click', async (e) => {
        const b = e.target.closest && e.target.closest('[data-v]'); const p = shown[at];
        if (!b) { if (e.target === box) close(); return; }
        const v = b.getAttribute('data-v');
        if (v === 'close') close();
        else if (v === 'prev') go(-1);
        else if (v === 'next') go(1);
        else if (v === 'album' || v === 'caption') {
          const said = prompt(v === 'album' ? 'Album name (empty to take it out of its album)' : 'Caption', p[v] || '');
          if (said == null) return;
          p[v] = said.replace(/\s+/g, ' ').trim().slice(0, v === 'album' ? 60 : 300);
          await st.put(p); await load(); changed = true; show(at);
        } else if (v === 'share') {
          const blob = await st.blob(p.id); if (!blob) return;
          const out = stripMeta(new Uint8Array(await blob.arrayBuffer()));
          const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out.bytes], { type: blob.type || p.type || 'image/jpeg' })); a.download = sharedName(p.name);
          document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        } else if (v === 'del') {
          if (!confirm('Delete this photo from this device? This cannot be undone.')) return;
          await st.del(p.id); await load(); changed = true; shown.splice(at, 1);
          if (!shown.length) { close(); return; }
          show(at % shown.length);
        }
      });
      box.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
      box.addEventListener('pointerup', (e) => { if (x0 != null && Math.abs(e.clientX - x0) > 60) go(e.clientX < x0 ? 1 : -1); x0 = null; });
      document.addEventListener('keydown', key);
      document.body.appendChild(box);
      show(at);
    }
  });
  return 'photos';
}

export default {
  name: 'photos',
  about: 'Verse Photos: a photo library kept on this device, grouped by the day each was taken, searchable by date, album or caption, shared without its location.',
  examples: ['my photos', 'show my photos', 'add photos', 'my photos from june', 'photos from last year', 'upload photos to verse', 'my pictures'],
  nearMisses: ['strip the exif from a photo', 'show me the gallery', 'photo of a cat', 'take a photo', 'what is photosynthesis'],
  match(lower, text) { return !!photosAsk(text || lower); },
  run,
  photosAsk, thumbSize, sharedName,
};
