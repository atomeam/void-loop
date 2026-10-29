// a-to-mind.com/converter (2026-10-29): the page script. Every file is opened and written on this device: nothing is uploaded, and no file
// is ever put in a link. The tools and their honest status come from /lib/converter.js; this file only reads files, runs a tool, and shows
// the results.
import { CATS, CATALOG, toolOf, counts, STATUS_TEXT, formatOf, kindOf, targetsOf, search, decodePcm, wav, aiff, seconds, cut, speed, gain, removeSilence, merge, mix, bmp, tiff, gif, gifSpeed, textParas, htmlParas, rtfParas, docxParas, epubParas, pdfParas, txtOf, htmlOf, rtfOf, docxBytesOf, epubOf, pdfOf, outName, MIME } from '/lib/converter.js';
import { loadJs, loadLib, zip, sizeText } from '/lib/pdf-tools.js';

const $ = (id) => document.getElementById(id);
const make = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k in e) e[k] = v; else e.setAttribute(k, v); } for (const c of kids) if (c != null) e.append(c); return e; };
const base = (name) => String(name || 'file').replace(/\.[a-z0-9]{1,5}$/i, '');
const runnable = (t) => !!(t && (t.run || t.to));
const ACCEPT = { sound: 'audio/*,video/*,.wav,.aiff,.aif,.mp3,.flac,.ogg,.opus,.m4a,.m4r', video: 'video/*,.mp4,.mov,.webm,.mkv', picture: 'image/*', gif: 'image/gif,.gif', text: '.pdf,.docx,.epub,.rtf,.html,.htm,.txt,application/pdf,text/plain,text/html', 'pdf+picture': 'application/pdf,.pdf,image/*' };
const PICTURE_OUT = ['jpg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'pdf'], SOUND_OUT = ['wav', 'aiff'], TEXT_OUT = ['txt', 'html', 'docx', 'rtf', 'epub', 'pdf'];
const SHOWN = new Set(['jpg', 'png', 'webp', 'gif', 'bmp']);

let cur = null, files = [], heads = [], lastQ = '', results = [], urls = [];

// ---- the catalog: all 106 tools, each with what Verse does today --------------------------------------------------------------------------
function rowOf(t, why = '') {
  const li = make('li', { class: 'row' }, make('span', { class: 'nm' }, t.name + (t.kind === 'converter' ? ' (' + t.cat.toLowerCase() + ')' : '')), make('span', { class: 'badge b-' + t.status }, STATUS_TEXT[t.status]));
  if (why) li.append(make('span', { class: 'why' }, why));
  li.append(make('span', { class: 'nt' }, String(t.note || '').replace(STATUS_TEXT[t.status] + ': ', ''))); // the badge already says it
  if (runnable(t)) li.append(make('button', { type: 'button', textContent: 'Use', onclick: () => { openTool(t); $('panel').scrollIntoView({ block: 'start' }); } }));
  else if (t.href) li.append(make('a', { class: 'go', href: t.href, textContent: 'Open' }));
  return li;
}
function catalog() {
  const c = counts();
  $('counts').textContent = c.all + ' tools: ' + c.here + ' on this page, ' + c.verse + ' on another Verse page, ' + c.part + ' in part, ' + c.no + ' not on Verse yet.';
  const box = $('catalog'); box.replaceChildren();
  for (const cat of CATS) {
    const list = CATALOG.filter((t) => t.cat === cat), k = counts(list);
    box.append(make('h3', {}, cat + ' (' + list.length + ')'), make('p', { class: 'lead' }, [k.here && k.here + ' on this page', k.verse && k.verse + ' on another Verse page', k.part && k.part + ' in part', k.no && k.no + ' not on Verse yet'].filter(Boolean).join(', ') + '.'), make('ul', {}, ...list.map((t) => rowOf(t))));
  }
}

// ---- search -------------------------------------------------------------------------------------------------------------------------------
function find(q, open = false) {
  lastQ = String(q || '').trim(); $('q').value = lastQ;
  const found = search(lastQ), ul = $('found'); ul.replaceChildren();
  if (!lastQ) return;
  if (!found.length) { ul.append(make('li', { class: 'row' }, make('span', { class: 'nt' }, 'No tool matches "' + lastQ + '". Every tool is in the list below.'))); return; }
  for (const r of found) ul.append(rowOf(r.tool, r.why));
  history.replaceState(null, '', '/converter/?q=' + encodeURIComponent(lastQ));
  const first = found.map((r) => r.tool).find(runnable); if (open && first) openTool(first, false);
}
$('find').onsubmit = (e) => { e.preventDefault(); find($('q').value, true); };

// ---- the tool panel -----------------------------------------------------------------------------------------------------------------------
function field(label, input) { return make('label', {}, label, input); }
const num = (id, value, step = 'any', min = '', max = '') => make('input', { id, type: 'number', value: String(value), step, ...(min !== '' ? { min } : {}), ...(max !== '' ? { max } : {}), inputMode: 'decimal' });
const pick = (id, options, value) => { const s = make('select', { id }); for (const [v, t] of options) s.append(make('option', { value: v, textContent: t })); if (value) s.value = value; return s; };
const val = (id, d = 0) => { const e = $(id); const n = e ? parseFloat(e.value) : NaN; return isFinite(n) ? n : d; };
const SOUND_AS = () => field('Save as', pick('as', [['wav', 'WAV'], ['aiff', 'AIFF']], 'wav'));

function opts() {
  const t = cur, run = t && t.run, to = t ? t.to : ($('to') && $('to').value) || '', o = $('opts'); o.replaceChildren();
  if (!t) {
    const fmt = heads[0] || '', can = fmt ? targetsOf(fmt) : [];
    if (fmt && !can.length) o.append(make('p', { class: 'lead' }, 'Verse cannot convert a ' + fmt.toUpperCase() + ' file yet. Search above for the tool you need: the list says what Verse has.'));
    if (can.length) o.append(field('Make it', pick('to', can.map((x) => [x, x.toUpperCase()]), can.includes(to) ? to : can[0])));
    const s = $('to'); if (s) s.onchange = () => { qual(); ready(); };
    qual(); ready(); return;
  }
  if (run === 'cut') o.append(field('From (seconds)', num('from', 0, 'any', 0)), field('To (seconds, empty: the end)', make('input', { id: 'upto', type: 'number', step: 'any', min: '0', inputMode: 'decimal' })), SOUND_AS());
  if (run === 'speed') o.append(field('Times as fast', num('factor', 1.5, 'any', 0.25, 4)), SOUND_AS());
  if (run === 'gain') o.append(field('Louder by (dB, minus: quieter)', num('db', 6, 'any', -40, 40)), SOUND_AS());
  if (run === 'silence') o.append(field('Quiet under (dB)', num('thr', -45, 'any', -90, -10)), field('Longer than (ms)', num('minms', 400, '50', 50)), SOUND_AS());
  if (run === 'crossfade') o.append(field('Crossfade (seconds)', num('xfade', 2, 'any', 0, 30)), SOUND_AS());
  if (run === 'merge' || run === 'mix' || run === 'extract-audio') o.append(SOUND_AS());
  if (run === 'gif-speed') o.append(field('Times as fast', num('factor', 2, 'any', 0.1, 10)));
  if (run === 'frame') o.append(field('At second', num('at', 1, 'any', 0)));
  if (run === 'merge-images') o.append(field('Put them', pick('dir', [['row', 'side by side'], ['column', 'one above the other']], 'row')));
  if (run === 'pdf-image') o.append(field('Page', num('page', 1, '1', 1)), field('From the left (%)', num('px', 5, 'any', 0, 100)), field('From the top (%)', num('py', 5, 'any', 0, 100)), field('Width (% of the page)', num('pw', 30, 'any', 1, 100)));
  qual(); ready();
}
// a quality slider for JPG and WebP only
function qual() {
  const to = cur ? cur.to : ($('to') && $('to').value), old = $('qwrap');
  if (to === 'jpg' || to === 'webp') { if (!old) $('opts').append(make('span', { id: 'qwrap' }, field('Quality (10-100)', num('qual', 90, '1', 10, 100)))); }
  else if (old) old.remove();
}
function openTool(t, push = true) {
  if (!runnable(t)) return;
  cur = t; $('tName').textContent = t.kind === 'converter' ? (t.cat === 'Document' || t.cat === 'Ebook' ? t.cat + ' to ' : 'To ') + t.name : t.name;
  $('tNote').textContent = t.note + (t.many ? ' Pick 2 or more files.' : t.run === 'pdf-image' ? ' Pick one PDF and one picture.' : '');
  $('files').accept = ACCEPT[t.from] || '';
  if (push) history.replaceState(null, '', '/converter/?t=' + t.id);
  opts(); clearOut();
}
function anyFile(push = true) {
  cur = null; $('tName').textContent = 'Convert any file';
  $('tNote').textContent = 'Pick one or more files: Verse reads what each file is from its first bytes and lists what it can become.';
  $('files').accept = ''; if (push) history.replaceState(null, '', '/converter/'); opts(); clearOut();
}
$('any').onclick = () => anyFile();

// ---- picked files -------------------------------------------------------------------------------------------------------------------------
async function setFiles(list) {
  files = [...list]; heads = await Promise.all(files.map(async (f) => formatOf(new Uint8Array(await f.slice(0, 4096).arrayBuffer()), f.name)));
  $('picked').replaceChildren(...files.map((f, i) => make('li', {}, f.name + ' · ' + sizeText(f.size) + (heads[i] ? ' · ' + heads[i].toUpperCase() : ' · not a format Verse knows'))));
  if (!cur) opts(); else ready();
  clearOut();
}
function ready() {
  const need = cur && (cur.many || cur.run === 'pdf-image') ? 2 : 1, auto = !cur && !($('to') && $('to').value);
  $('go').disabled = files.length < need || auto;
  $('status').textContent = files.length && files.length < need ? 'Pick ' + need + ' or more files for this tool.' : '';
}
$('files').onchange = (e) => setFiles(e.target.files);
const drop = $('drop');
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer && e.dataTransfer.files.length) setFiles(e.dataTransfer.files); });

// ---- readers ------------------------------------------------------------------------------------------------------------------------------
const bytesOf = async (f) => new Uint8Array(await f.arrayBuffer());
async function soundOf(f) {
  const b = await bytesOf(f), pcm = decodePcm(b); if (pcm) return pcm;
  const C = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!C) throw new Error('this browser cannot open sound files.');
  let buf; try { buf = await new C(1, 1, 44100).decodeAudioData(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); } catch (_) { throw new Error('this browser cannot play this file, so Verse cannot read its sound (a video with no sound has none to read).'); }
  return { rate: buf.sampleRate, channels: Array.from({ length: buf.numberOfChannels }, (_, k) => buf.getChannelData(k).slice()) };
}
async function canvasOf(f) {
  let bm; try { bm = await createImageBitmap(f); } catch (_) { throw new Error('this browser cannot open this picture.'); }
  const c = make('canvas', { width: bm.width, height: bm.height }); c.getContext('2d').drawImage(bm, 0, 0); if (bm.close) bm.close(); return c;
}
const pixels = (c) => ({ width: c.width, height: c.height, data: c.getContext('2d').getImageData(0, 0, c.width, c.height).data });
const blobOf = (c, type, q) => new Promise((res) => c.toBlob(res, type, q));
async function frameOf(f, at) {
  const v = make('video', { muted: true, preload: 'auto', playsInline: true }), url = URL.createObjectURL(f);
  const wait = (ev) => new Promise((res, rej) => { const tm = setTimeout(() => rej(new Error('the video did not open in time.')), 20000); v.addEventListener(ev, () => { clearTimeout(tm); res(); }, { once: true }); v.addEventListener('error', () => { clearTimeout(tm); rej(new Error('this browser cannot play this video.')); }, { once: true }); });
  try {
    v.src = url; await wait('loadeddata');
    const t = Math.max(0.01, Math.min(+at || 0, Math.max(0.01, (v.duration || 0) - 0.05))); const s = wait('seeked'); v.currentTime = t; await s;
    if (!v.videoWidth) throw new Error('this file has no picture to take.');
    const c = make('canvas', { width: v.videoWidth, height: v.videoHeight }); c.getContext('2d').drawImage(v, 0, 0); return { canvas: c, t, duration: v.duration };
  } finally { URL.revokeObjectURL(url); }
}
async function docOf(f) {
  const b = await bytesOf(f), fmt = formatOf(b, f.name), text = () => new TextDecoder().decode(b); let d;
  if (fmt === 'pdf') { try { d = await pdfParas(await loadJs(), b); } catch (e) { throw new Error(/password|encrypt/i.test(String(e && e.message)) ? 'this PDF is protected with a password, so no one can read it without that.' : 'this PDF did not open: ' + ((e && e.message) || e)); } }
  else if (fmt === 'docx') d = await docxParas(b);
  else if (fmt === 'epub') d = await epubParas(b);
  else if (fmt === 'rtf') d = rtfParas(text());
  else if (fmt === 'html') d = htmlParas(text());
  else if (fmt === 'txt') d = { title: '', paras: textParas(text()) };
  else throw new Error('Verse cannot read the words of ' + (fmt ? 'a ' + fmt.toUpperCase() + ' file' : 'this file') + ' yet.');
  if (!d.paras.length) throw new Error(fmt === 'pdf' ? 'no words found: a scanned PDF holds pictures of words, not words.' : 'no words found in this file.');
  return { fmt, doc: d };
}

// ---- writers ------------------------------------------------------------------------------------------------------------------------------
const soundFile = (s, as) => (as === 'aiff' ? aiff(s.channels, s.rate) : wav(s.channels, s.rate));
const soundNote = (s) => seconds(s).toFixed(2) + ' s, ' + s.rate + ' Hz, ' + (s.channels.length === 1 ? 'mono' : s.channels.length === 2 ? 'stereo' : s.channels.length + ' channels');
async function pictureFile(c, to, q) {
  if (to === 'bmp') return bmp(pixels(c));
  if (to === 'tiff') return tiff(pixels(c));
  if (to === 'gif') return gif(pixels(c));
  let src = c;
  if (to === 'jpg') { src = make('canvas', { width: c.width, height: c.height }); const x = src.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(c, 0, 0); }
  const type = MIME[to], b = await blobOf(src, type, q);
  if (!b || b.type !== type) throw new Error('this browser cannot write ' + to.toUpperCase() + ' pictures. Try PNG or JPG.');
  return new Uint8Array(await b.arrayBuffer());
}
// pictures as one PDF: a page each, the page the size of the picture (at 96 pixels an inch). JPG and PNG go in as they are.
async function picturesPdf(list) {
  const L = await loadLib(), pdf = await L.PDFDocument.create();
  for (const { f, fmt } of list) {
    const raw = await bytesOf(f); let img;
    if (fmt === 'jpg') img = await pdf.embedJpg(raw); else if (fmt === 'png') img = await pdf.embedPng(raw);
    else img = await pdf.embedPng(new Uint8Array(await (await blobOf(await canvasOf(f), 'image/png')).arrayBuffer()));
    const w = img.width * 0.75, h = img.height * 0.75; pdf.addPage([w, h]).drawImage(img, { x: 0, y: 0, width: w, height: h });
  }
  pdf.setProducer('Verse (a-to-mind.com/converter/)'); pdf.setCreator('Verse');
  return pdf.save();
}
async function docFile(d, to, name) {
  const titled = { ...d, title: d.title || base(name) };
  if (to === 'txt') return { bytes: txtOf(d) };
  if (to === 'html') return { bytes: htmlOf(titled) };
  if (to === 'rtf') return { bytes: rtfOf(d) };
  if (to === 'docx') return { bytes: await docxBytesOf(d) };
  if (to === 'epub') return { bytes: epubOf(titled) };
  if (to === 'pdf') { const r = await pdfOf(await loadLib(), d); return { bytes: r.bytes, notes: [r.pages + ' page' + (r.pages === 1 ? '' : 's')].concat(r.lost ? [r.lost + ' character' + (r.lost === 1 ? '' : 's') + ' the PDF font cannot draw became ?'] : []) }; }
  throw new Error('Verse cannot write ' + to.toUpperCase() + ' yet.');
}

// ---- run ----------------------------------------------------------------------------------------------------------------------------------
function clearOut() { for (const u of urls) URL.revokeObjectURL(u); urls = []; results = []; $('out').replaceChildren(); $('zip').hidden = true; }
async function convertTo(f, fmt, to, taken) {
  const k = kindOf(fmt);
  if (SOUND_OUT.includes(to)) { if (k && k !== 'sound' && k !== 'video') throw new Error('this is not a sound or a video.'); const s = await soundOf(f); return { name: outName(f.name, to, taken), ext: to, bytes: soundFile(s, to), notes: [soundNote(s)] }; }
  if (TEXT_OUT.includes(to) && k !== 'picture') { const { doc } = await docOf(f); if (fmt === to) throw new Error('this is already a ' + to.toUpperCase() + ' file.'); const r = await docFile(doc, to, f.name); return { name: outName(f.name, to, taken), ext: to, bytes: r.bytes, notes: [doc.paras.length + ' paragraph' + (doc.paras.length === 1 ? '' : 's')].concat(r.notes || []) }; }
  if (PICTURE_OUT.includes(to)) { if (k !== 'picture') throw new Error('this is not a picture.'); if (fmt === to) throw new Error('this is already a ' + to.toUpperCase() + ' picture.'); if (to === 'pdf') return { name: outName(f.name, 'pdf', taken), ext: 'pdf', bytes: await picturesPdf([{ f, fmt }]), notes: ['1 page'] }; const c = await canvasOf(f), bytes = await pictureFile(c, to, val('qual', 90) / 100); return { name: outName(f.name, to, taken), ext: to, bytes, notes: [c.width + ' x ' + c.height + ' pixels'] }; }
  throw new Error('Verse cannot make ' + to.toUpperCase() + ' from this file.');
}
async function go() {
  clearOut(); const t = cur, list = files.map((f, i) => ({ f, fmt: heads[i] })), taken = new Set(), add = (r) => results.push(r), fail = (f, e) => results.push({ name: f.name, error: (e && e.message) || String(e) });
  const as = ($('as') && $('as').value) || 'wav', say = (s) => { $('status').textContent = s; };
  $('go').disabled = true;
  try {
    const to = t ? t.to : $('to') && $('to').value;
    if (to === 'pdf' && list.every((x) => kindOf(x.fmt) === 'picture')) { say('Working: ' + list.length + ' picture' + (list.length === 1 ? '' : 's') + ' into one PDF'); add({ name: outName(list[0].f.name, 'pdf', taken), ext: 'pdf', bytes: await picturesPdf(list), notes: [list.length + ' page' + (list.length === 1 ? '' : 's') + ', a picture to a page'] }); }
    else if (to) { for (let i = 0; i < list.length; i++) { say('Working on ' + (i + 1) + ' of ' + list.length + ': ' + list[i].f.name); try { add(await convertTo(list[i].f, list[i].fmt, to, taken)); } catch (e) { fail(list[i].f, e); } } }
    else if (['cut', 'speed', 'gain', 'silence', 'extract-audio'].includes(t.run)) {
      for (let i = 0; i < list.length; i++) {
        const { f } = list[i]; say('Working on ' + (i + 1) + ' of ' + list.length + ': ' + f.name);
        try {
          const s = await soundOf(f), r = t.run === 'cut' ? cut(s, val('from', 0), $('upto').value) : t.run === 'speed' ? speed(s, val('factor', 1.5)) : t.run === 'gain' ? gain(s, val('db', 6)) : t.run === 'silence' ? removeSilence(s, val('thr', -45), val('minms', 400)) : { ...s, notes: [] };
          add({ name: outName(f.name, as, taken), ext: as, bytes: soundFile(r, as), notes: [...r.notes, soundNote(r)] });
        } catch (e) { fail(f, e); }
      }
    } else if (['merge', 'mix', 'crossfade'].includes(t.run)) {
      say('Reading ' + list.length + ' sounds'); const all = []; for (const { f } of list) all.push(await soundOf(f).catch((e) => { throw new Error(f.name + ': ' + e.message); }));
      const r = t.run === 'mix' ? mix(all) : merge(all, t.run === 'crossfade' ? val('xfade', 2) : 0);
      add({ name: outName(base(list[0].f.name) + (t.run === 'mix' ? ' mix' : ' joined') + '.' + as, as, taken), ext: as, bytes: soundFile(r, as), notes: [...r.notes, soundNote(r)] });
    } else if (t.run === 'gif-speed') {
      for (const { f, fmt } of list) { try { if (fmt !== 'gif') throw new Error('this is not a GIF.'); const r = gifSpeed(await bytesOf(f), val('factor', 2)); add({ name: outName(f.name, 'gif', taken), ext: 'gif', bytes: r.bytes, notes: r.notes }); } catch (e) { fail(f, e); } }
    } else if (t.run === 'frame') {
      for (const { f } of list) { try { say('Opening ' + f.name); const r = await frameOf(f, val('at', 1)); add({ name: outName(base(f.name) + ' at ' + r.t.toFixed(2) + ' s.png', 'png', taken), ext: 'png', bytes: new Uint8Array(await (await blobOf(r.canvas, 'image/png')).arrayBuffer()), notes: ['the picture at ' + r.t.toFixed(2) + ' s of ' + (r.duration || 0).toFixed(2) + ' s', r.canvas.width + ' x ' + r.canvas.height + ' pixels'] }); } catch (e) { fail(f, e); } }
    } else if (t.run === 'merge-images') {
      say('Reading ' + list.length + ' pictures'); const cs = []; for (const { f } of list) cs.push(await canvasOf(f).catch((e) => { throw new Error(f.name + ': ' + e.message); }));
      const row = $('dir').value === 'row', W = row ? cs.reduce((a, c) => a + c.width, 0) : Math.max(...cs.map((c) => c.width)), H = row ? Math.max(...cs.map((c) => c.height)) : cs.reduce((a, c) => a + c.height, 0);
      if (W > 16384 || H > 16384 || W * H > 120e6) throw new Error('the joined picture would be ' + W + ' x ' + H + ' pixels, more than a browser can draw. Resize the pictures first.');
      const out = make('canvas', { width: W, height: H }), x = out.getContext('2d'); let at = 0;
      for (const c of cs) { if (row) { x.drawImage(c, at, Math.round((H - c.height) / 2)); at += c.width; } else { x.drawImage(c, Math.round((W - c.width) / 2), at); at += c.height; } }
      add({ name: outName(base(list[0].f.name) + ' joined.png', 'png', taken), ext: 'png', bytes: new Uint8Array(await (await blobOf(out, 'image/png')).arrayBuffer()), notes: [cs.length + ' pictures ' + (row ? 'side by side' : 'one above the other'), W + ' x ' + H + ' pixels'] });
    } else if (t.run === 'pdf-image') {
      const p = list.find((x) => x.fmt === 'pdf'), pic = list.find((x) => kindOf(x.fmt) === 'picture');
      if (!p || !pic) throw new Error('pick one PDF and one picture.');
      say('Putting ' + pic.f.name + ' on ' + p.f.name); const L = await loadLib(); let doc;
      try { doc = await L.PDFDocument.load(await bytesOf(p.f)); } catch (e) { throw new Error(p.f.name + ': ' + (/encrypt/i.test(String(e && e.message)) ? 'this PDF is encrypted or protected, so Verse cannot change it.' : 'this PDF did not open.')); }
      const n = doc.getPageCount(), pg = Math.max(1, Math.min(n, Math.round(val('page', 1)))), page = doc.getPage(pg - 1), { width, height } = page.getSize();
      const raw = await bytesOf(pic.f), img = pic.fmt === 'jpg' ? await doc.embedJpg(raw) : pic.fmt === 'png' ? await doc.embedPng(raw) : await doc.embedPng(new Uint8Array(await (await blobOf(await canvasOf(pic.f), 'image/png')).arrayBuffer()));
      const w = width * Math.max(1, Math.min(100, val('pw', 30))) / 100, h = w * img.height / img.width, x = width * Math.max(0, Math.min(100, val('px', 5))) / 100, y = height - height * Math.max(0, Math.min(100, val('py', 5))) / 100 - h;
      page.drawImage(img, { x, y, width: w, height: h });
      add({ name: outName(p.f.name, 'pdf', taken), ext: 'pdf', bytes: await doc.save(), notes: ['the picture on page ' + pg + ' of ' + n + ', ' + Math.round(w) + ' x ' + Math.round(h) + ' points', y < 0 ? 'part of the picture runs off the bottom of the page' : 'the rest of the PDF is as it was'] });
    }
  } catch (e) { results.push({ name: t ? t.name : 'Convert', error: (e && e.message) || String(e) }); }
  show(); $('go').disabled = false;
}
$('go').onclick = go;
function show() {
  const ok = results.filter((r) => r.bytes), bad = results.length - ok.length, ul = $('out'); ul.replaceChildren();
  for (const r of results) {
    if (r.error) { ul.append(make('li', {}, make('strong', {}, r.name + ': '), r.error)); continue; }
    const url = URL.createObjectURL(new Blob([r.bytes], { type: MIME[r.ext] || 'application/octet-stream' })); urls.push(url);
    const li = make('li', {}, make('a', { class: 'dl', href: url, download: r.name, textContent: 'Download ' + r.name }), make('span', { class: 'sz' }, sizeText(r.bytes.length)));
    if (r.notes && r.notes.length) li.append(make('p', { class: 'notes' }, r.notes.join(' · ')));
    if (SHOWN.has(r.ext)) li.append(make('img', { src: url, alt: 'The new picture: ' + r.name }));
    if (r.ext === 'wav') li.append(make('audio', { controls: true, src: url, preload: 'metadata' }));
    ul.append(li);
  }
  $('zip').hidden = ok.length < 2;
  $('status').textContent = (ok.length ? ok.length + ' file' + (ok.length === 1 ? '' : 's') + ' made on this device' : 'No file made') + (bad ? ', ' + bad + ' could not be done (the reason is below)' : '') + '.';
}
$('zip').onclick = () => { const ok = results.filter((r) => r.bytes), u = URL.createObjectURL(new Blob([zip(ok.map((r) => ({ name: r.name, bytes: r.bytes })))], { type: MIME.zip })); urls.push(u); make('a', { href: u, download: 'verse-converted.zip' }).click(); };

// ---- share: the tool or the search, never a file ------------------------------------------------------------------------------------------
async function share() {
  const u = location.origin + '/converter/' + (cur ? '?t=' + cur.id : lastQ ? '?q=' + encodeURIComponent(lastQ) : '');
  history.replaceState(null, '', u);
  let ok = false; try { await navigator.clipboard.writeText(u); ok = true; } catch (_) {} // void-review: ok (the link is also in the address bar)
  $('shareNote').textContent = (ok ? 'Link copied: ' : 'The link is in the address bar: ') + 'it opens ' + (cur ? 'this tool' : lastQ ? 'this search' : 'the converter') + '. Your files are never in the link.';
}
$('share').onclick = share;

// ---- start --------------------------------------------------------------------------------------------------------------------------------
catalog();
{
  const q = new URLSearchParams(location.search), t = toolOf(q.get('t') || '');
  if (t && runnable(t)) openTool(t, false); else anyFile(false);
  if (t && !runnable(t)) { $('found').replaceChildren(rowOf(t)); }
  if (q.get('q')) find(q.get('q'), !t);
  if (q.get('t') || q.get('q')) requestAnimationFrame(() => $('panel').scrollIntoView({ block: 'start' }));
}
addEventListener('load', () => { import('/lib/toolkit.js').then((m) => m.mountRelated($('related'), '/converter/', [{ label: 'Share this tool', run: share }, { label: 'Edit a picture', href: () => '/photos/' }], { card: () => lastQ || (cur ? (cur.kind === 'converter' ? 'to ' + cur.name.toLowerCase() : cur.name.toLowerCase()) : '') })).catch(() => {}); });
