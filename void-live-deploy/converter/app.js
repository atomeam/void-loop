// a-to-mind.com/converter (2026-10-29): the page script. Every file is opened and written on this device: nothing is uploaded, and no file
// is ever put in a link. The tools and their honest status come from /lib/converter.js; this file only reads files, runs a tool, and shows
// the results.
import { CATS, CATALOG, toolOf, counts, STATUS_TEXT, formatOf, kindOf, targetsOf, search, decodePcm, wav, aiff, seconds, cut, speed, gain, removeSilence, merge, mix, bmp, tiff, gif, gifSpeed, textParas, htmlParas, rtfParas, docxParas, epubParas, pdfParas, txtOf, htmlOf, rtfOf, docxBytesOf, epubOf, pdfOf, outName, MIME } from '/lib/converter.js';
import { loadJs, loadLib, zip, sizeText } from '/lib/pdf-tools.js';
import { writeVideo, writeStill, soundOf48, encodeSound, drawOver } from '/lib/video-write.js';
import { flac, alacFile, opusFile, m4aFile } from '/lib/audio-write.js';
import { addCover, cutMp3, gainMp3 } from '/lib/mp3-edit.js';
import { denoise } from '/lib/denoise.js';
import { TRANSITIONS } from '/lib/transition.js';
import { changeCover, mergeBooks, compressBook, compressComic } from '/lib/epub-edit.js';

const $ = (id) => document.getElementById(id);
const make = (tag, props = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'class') e.className = v; else if (k in e) e[k] = v; else e.setAttribute(k, v); } for (const c of kids) if (c != null) e.append(c); return e; };
const base = (name) => String(name || 'file').replace(/\.[a-z0-9]{1,5}$/i, '');
const runnable = (t) => !!(t && (t.run || t.to));
const SND = 'audio/*,.wav,.aiff,.aif,.mp3,.flac,.ogg,.opus,.m4a,.m4r', VID = 'video/*,.mp4,.mov,.webm,.mkv';
const ACCEPT = { sound: SND + ',video/*', video: VID, picture: 'image/*', gif: 'image/gif,.gif', text: '.pdf,.docx,.epub,.rtf,.html,.htm,.txt,application/pdf,text/plain,text/html', 'pdf+picture': 'application/pdf,.pdf,image/*', pdf: 'application/pdf,.pdf', 'video+sound': VID + ',' + SND, 'video+picture': VID + ',image/*', 'video+picture?': VID + ',image/*', 'sound+picture?': SND + ',video/*,image/*', 'picture+sound?': 'image/*,' + SND, 'mp3+picture': 'audio/mpeg,.mp3,image/*', 'epub+picture': 'application/epub+zip,.epub,image/*', 'picture+picture?': 'image/*', epub: 'application/epub+zip,.epub', cbz: '.cbz,.cbr,application/vnd.comicbook+zip,application/zip' };
// how many files a tool needs, and what to say about them
const NEED = { 'video+sound': [2, ' Pick one video and one sound (a video\'s sound works too).'], 'video+picture': [2, ' Pick one video and one picture.'], 'video+picture?': [1, ' Pick a video; add a picture if you want one.'], 'sound+picture?': [1, ' Pick a sound; add a picture if you want one.'], 'picture+sound?': [1, ' Pick 1 or more pictures, in the order to show them; add a sound if you want one.'], 'mp3+picture': [2, ' Pick one MP3 and one picture.'], 'epub+picture': [2, ' Pick one EPUB and one picture.'], 'picture+picture?': [1, ' Pick 1 or more pictures; for a picture mark, pick the mark too.'] };
const PICTURE_OUT = ['jpg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'pdf'], SOUND_OUT = ['wav', 'aiff', 'flac', 'alac', 'm4a', 'm4r', 'ogg', 'opus'], TEXT_OUT = ['txt', 'html', 'docx', 'rtf', 'epub', 'pdf'], VIDEO_OUT = ['mp4', 'mov', '3gp', 'webm', 'mkv', 'avi', 'flv'];
const SHOWN = new Set(['jpg', 'png', 'webp', 'gif', 'bmp']);

let cur = null, files = [], heads = [], lastQ = '', results = [], urls = [];

// ---- the catalog: all 106 tools, each with what Verse does today --------------------------------------------------------------------------
function rowOf(t, why = '') {
  const li = make('li', { class: 'row' }, make('span', { class: 'nm' }, t.name + (t.kind === 'converter' ? ' (' + t.cat.toLowerCase() + ')' : '')), make('span', { class: 'badge b-' + t.status }, STATUS_TEXT[t.status]));
  if (why) li.append(make('span', { class: 'why' }, why));
  li.append(make('span', { class: 'nt' }, noteOf(t))); // the badge already says the status
  if (runnable(t)) li.append(make('button', { type: 'button', textContent: 'Use', onclick: () => { openTool(t); $('panel').scrollIntoView({ block: 'start' }); } }));
  else if (t.href) li.append(make('a', { class: 'go', href: t.href, textContent: 'Open' }));
  return li;
}
// a tool's note without the status the badge already shows, starting with a capital
function noteOf(t) { const s = String(t.note || '').replace(STATUS_TEXT[t.status] + ': ', ''); return s.charAt(0).toUpperCase() + s.slice(1); }
function catalog() {
  const c = counts();
  $('counts').textContent = c.all + ' tools: ' + c.here + ' on this page, ' + c.verse + ' on another Verse page, ' + c.part + ' in part, ' + c.no + ' not on Verse yet.';
  const box = $('catalog'); box.replaceChildren();
  for (const cat of CATS) {
    const list = CATALOG.filter((t) => t.cat === cat), k = counts(list);
    box.append(make('h3', {}, cat + ' (' + list.length + ')'), make('p', { class: 'lead' }, [k.here && k.here + ' on this page', k.verse && k.verse + ' on another Verse page', k.part && k.part + ' in part', k.no && k.no + ' not on Verse yet'].filter(Boolean).join(', ') + '.'), make('ul', {}, ...list.map((t) => rowOf(t))));
  }
  // what Verse cannot do yet: made from the same list, so it changes when a tool lands
  const no = CATALOG.filter((t) => t.status === 'no'), cant = $('cannot'); cant.replaceChildren();
  $('cannotLead').textContent = no.length ? no.length + ' of the ' + c.all + ' tools are not on Verse yet. Each one says why in the list above.' : 'Every tool is on Verse.';
  for (const cat of CATS) { const list = no.filter((t) => t.cat === cat); if (list.length) cant.append(make('li', {}, make('strong', {}, cat + ': '), list.map((t) => (t.kind === 'converter' ? 'to ' : '') + t.name).join(', ') + '.')); }
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
const SOUND_AS = (label = 'Save as') => field(label, pick('as', [['wav', 'WAV'], ['aiff', 'AIFF'], ['flac', 'FLAC (lossless, smaller)'], ['alac', 'ALAC (Apple Lossless, .m4a)'], ['m4a', 'M4A (AAC where this browser codes it)'], ['m4r', 'M4R (iPhone ringtone, AAC, 40 s)'], ['ogg', 'OGG (Opus)'], ['opus', 'OPUS']], 'wav'));

function opts() {
  const t = cur, run = t && t.run, to = t ? t.to : ($('to') && $('to').value) || '', o = $('opts'); o.replaceChildren();
  if (!t) {
    const fmt = heads[0] || '', can = fmt ? targetsOf(fmt) : [];
    if (fmt && !can.length) o.append(make('p', { class: 'lead' }, 'Verse cannot convert a ' + fmt.toUpperCase() + ' file yet. Search above for the tool you need: the list says what Verse has.'));
    if (can.length) o.append(field('Make it', pick('to', can.map((x) => [x, x.toUpperCase()]), can.includes(to) ? to : can[0])));
    if (VIDEO_OUT.includes(($('to') && $('to').value) || '')) o.append(QUALITY());
    const s = $('to'); if (s) s.onchange = () => opts();
    qual(); ready(); return;
  }
  if (VIDEO_OUT.includes(to)) o.append(QUALITY());
  if (run === 'cut') o.append(field('From (seconds)', num('from', 0, 'any', 0)), field('To (seconds, empty: the end)', make('input', { id: 'upto', type: 'number', step: 'any', min: '0', inputMode: 'decimal' })), SOUND_AS('Save as (an MP3 stays an MP3)'));
  if (run === 'speed') o.append(field('Times as fast', num('factor', 1.5, 'any', 0.25, 4)), SOUND_AS());
  if (run === 'gain') o.append(field('Louder by (dB, minus: quieter)', num('db', 6, 'any', -40, 40)), SOUND_AS('Save as (an MP3 stays an MP3)'));
  if (run === 'denoise') o.append(field('Take the noise down by (dB)', num('red', 12, 'any', 3, 40)), field('Noise only from second (empty: Verse finds the quietest part)', make('input', { id: 'nfrom', type: 'number', step: 'any', min: '0', inputMode: 'decimal' })), field('to second', make('input', { id: 'nto', type: 'number', step: 'any', min: '0', inputMode: 'decimal' })), SOUND_AS());
  if (run === 'silence') o.append(field('Quiet under (dB)', num('thr', -45, 'any', -90, -10)), field('Longer than (ms)', num('minms', 400, '50', 50)), SOUND_AS());
  if (run === 'crossfade') o.append(field('Crossfade (seconds)', num('xfade', 2, 'any', 0, 30)), SOUND_AS());
  if (run === 'merge' || run === 'mix' || run === 'extract-audio') o.append(SOUND_AS());
  if (run === 'epub-merge') o.append(field('Title of the new book (empty: the first book\'s title and how many more)', make('input', { id: 'btitle', type: 'text', maxLength: 300 })));
  if (run === 'epub-compress' || run === 'cbz-compress') o.append(field('Picture quality (10-100)', num('equal', 75, '1', 10, 100)), field('Largest picture side (pixels, 0: keep the size)', num('emax', 1600, '1', 0)));
  if (run === 'gif-speed') o.append(field('Times as fast', num('factor', 2, 'any', 0.1, 10)));
  if (run === 'frame') o.append(field('At second', num('at', 1, 'any', 0)));
  if (run === 'watermark-image') o.append(field('Mark', pick('wmk', [['words', 'Your words'], ['picture', 'The smallest picture you pick']], 'words')), field('Words', txt('words', '', 'Your name')), field('Corner', pick('corner', [['br', 'Bottom right'], ['bl', 'Bottom left'], ['tr', 'Top right'], ['tl', 'Top left']], 'br')), field('Size (% of the width)', num('pw', 15, 'any', 1, 60)), field('Seen (%: 100 is solid)', num('alpha', 60, '1', 5, 100)), field('JPG and WebP quality (10-100)', num('qual', 90, '1', 10, 100)));
  if (run === 'merge-images') o.append(field('Put them', pick('dir', [['row', 'side by side'], ['column', 'one above the other']], 'row')));
  if (run === 'video') videoOpts(t.vop, o);
  if (run === 'pdf-image') o.append(field('Page', num('page', 1, '1', 1)), field('From the left (%)', num('px', 5, 'any', 0, 100)), field('From the top (%)', num('py', 5, 'any', 0, 100)), field('Width (% of the page)', num('pw', 30, 'any', 1, 100)));
  qual(); ready();
}
const QUALITY = (v = 'medium') => field('Quality', pick('vq', [['high', 'High (larger file)'], ['medium', 'Medium'], ['small', 'Small file']], v));
const txt = (id, value = '', ph = '') => make('input', { id, type: 'text', value, placeholder: ph });
const colour = (id, value) => make('input', { id, type: 'color', value });
const WHEN = () => [field('From second (empty: the start)', make('input', { id: 'ofrom', type: 'number', step: 'any', min: '0', inputMode: 'decimal' })), field('To second (empty: the end)', make('input', { id: 'oto', type: 'number', step: 'any', min: '0', inputMode: 'decimal' }))];
// the options of each video tool; every one also has Save as and Quality
function videoOpts(vop, o) {
  const f = {
    cut: () => [field('From (seconds)', num('from', 0, 'any', 0)), field('To (seconds, empty: the end)', make('input', { id: 'upto', type: 'number', step: 'any', min: '0', inputMode: 'decimal' }))],
    speed: () => [field('Times as fast', num('factor', 1.5, 'any', 0.25, 4))],
    gain: () => [field('Louder by (dB, minus: quieter)', num('db', 6, 'any', -40, 40))],
    shift: () => [field('Move the sound by (seconds; minus: earlier)', num('shift', 0.2, 'any', -10, 10))],
    resize: () => [field('Width (pixels)', num('vw', 1280, '2', 16, 3840))],
    rotate: () => [field('Turn', pick('rot', [['90', '90 degrees to the right'], ['180', '180 degrees'], ['270', '90 degrees to the left']], '90'))],
    blur: () => [field('Blur (1-20)', num('blur', 6, 'any', 1, 20))],
    bright: () => [field('Brightness (%: 100 is as it is)', num('bright', 130, '1', 10, 300))],
    compress: () => [field('Size', pick('vmax', [['0', 'As it is'], ['1080', '1080p'], ['720', '720p'], ['480', '480p']], '720'))],
    text: () => [field('Words', txt('words', '', 'Your words')), field('Where', pick('wpos', [['12', 'At the top'], ['50', 'In the middle'], ['88', 'At the bottom']], '88')), field('Size (% of the width)', num('wsize', 6, 'any', 1, 30)), field('Colour', colour('wcol', '#ffffff')), ...WHEN()],
    image: () => [field('From the left (%, its centre)', num('px', 50, 'any', 0, 100)), field('From the top (%, its centre)', num('py', 50, 'any', 0, 100)), field('Width (% of the video)', num('pw', 25, 'any', 1, 100)), field('Seen (%: 100 is solid)', num('alpha', 100, '1', 5, 100)), ...WHEN()],
    watermark: () => [field('Words (if you add no picture)', txt('words', '', 'Your name')), field('Corner', pick('corner', [['br', 'Bottom right'], ['bl', 'Bottom left'], ['tr', 'Top right'], ['tl', 'Top left']], 'br')), field('Size (% of the width)', num('pw', 15, 'any', 1, 60)), field('Seen (%: 100 is solid)', num('alpha', 60, '1', 5, 100))],
    background: () => [field('Shape', pick('shape', [['1:1', 'Square (1:1)'], ['9:16', 'Tall (9:16)'], ['16:9', 'Wide (16:9)']], '1:1')), field('Background', pick('backdrop', [['blur', 'The video, blurred'], ['color', 'A colour'], ['picture', 'The picture you add']], 'blur')), field('Colour', colour('bcol', '#000000'))],
    'add-sound': () => [field('The new sound', pick('amode', [['replace', 'In place of the video\'s sound'], ['mix', 'Mixed with the video\'s sound']], 'replace'))],
    'sound-video': () => [field('Colour (if you add no picture)', colour('bcol', '#101425'))],
    'gif-video': () => [field('See-through parts become', colour('bcol', '#ffffff'))],
    'pictures-video': () => [field('Seconds for each picture', num('each', 2, 'any', 0.1, 600))],
    'pdf-video': () => [field('Seconds for each page', num('each', 3, 'any', 0.1, 600))],
    transition: () => [field('Options', pick('tmode', [['join', '2 Files'], ['start', '1 File (Start)'], ['end', '1 File (End)'], ['both', '1 File (Start & End)']], 'join')), field('Transition', pick('tkind', TRANSITIONS.map((x) => [...x]), 'fade')), field('Duration (seconds, 1-10)', num('tsec', 3, 'any', 1, 10))],
  }[vop];
  o.append(...(f ? f() : []), field('Save as', pick('vfmt', VIDEO_OUT.map((x) => [x, x.toUpperCase()]), 'mp4')), QUALITY(vop === 'compress' ? 'small' : 'medium'));
  if (vop === 'transition') $('tmode').onchange = ready; // 2 files, or 1
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
  $('tNote').textContent = t.note.replace(/ Pick one video and one (sound|picture)\.$/, '') + (t.many ? ' Pick 2 or more files.' : t.run === 'pdf-image' ? ' Pick one PDF and one picture.' : NEED[t.from] ? NEED[t.from][1] : '');
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
  const need = cur && cur.vop === 'transition' ? ($('tmode') && $('tmode').value !== 'join' ? 1 : 2) : cur && (cur.many || cur.run === 'pdf-image') ? 2 : cur && NEED[cur.from] ? NEED[cur.from][0] : 1, auto = !cur && !($('to') && $('to').value);
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
// a sound as the file asked for; { bytes, notes }. Opus needs the browser's encoder, so this waits
async function soundFile(s, as) {
  if (as === 'ogg' || as === 'opus') return opusFile(s, encodeSound);
  if (as === 'm4a' || as === 'm4r') return m4aFile(s, encodeSound, { ringtone: as === 'm4r' });
  return { bytes: as === 'aiff' ? aiff(s.channels, s.rate) : as === 'flac' ? flac(s.channels, s.rate) : as === 'alac' ? alacFile(s.channels, s.rate) : wav(s.channels, s.rate), notes: [] };
}
// the file name ending of a sound choice: ALAC goes in an .m4a
const extOf = (as) => (as === 'alac' ? 'm4a' : as);
const soundNote = (s) => seconds(s).toFixed(2) + ' s, ' + s.rate + ' Hz, ' + (s.channels.length === 1 ? 'mono' : s.channels.length === 2 ? 'stereo' : s.channels.length + ' channels');
// the picture quality and largest side picked, and a picture made again in its own type, scaled down to that side when it is larger
function shrinker() {
  const q = Math.max(10, Math.min(100, val('equal', 75))) / 100, max = Math.max(0, Math.round(val('emax', 1600)));
  const shrink = async (data, type, side) => {
    const bm = await createImageBitmap(new Blob([data], { type })), k = side && Math.max(bm.width, bm.height) > side ? side / Math.max(bm.width, bm.height) : 1;
    const c = make('canvas', { width: Math.max(1, Math.round(bm.width * k)), height: Math.max(1, Math.round(bm.height * k)) }), x = c.getContext('2d');
    if (type === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
    x.drawImage(bm, 0, 0, c.width, c.height); if (bm.close) bm.close();
    const b = await blobOf(c, type, type === 'image/png' ? undefined : q); return b && b.type === type ? new Uint8Array(await b.arrayBuffer()) : null;
  };
  return { shrink, max };
}
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
async function convertTo(f, fmt, to, taken, say = () => {}) {
  const k = kindOf(fmt);
  if (VIDEO_OUT.includes(to)) {
    if (k !== 'video') throw new Error('this is not a video.');
    const r = await writeVideo(f, { container: to, quality: ($('vq') && $('vq').value) || 'medium', onProgress: (x) => say(Math.round(x * 100) + '%') });
    return { name: outName(f.name, to, taken), ext: to, bytes: r.bytes, notes: r.notes };
  }
  if (SOUND_OUT.includes(to)) { if (k && k !== 'sound' && k !== 'video') throw new Error('this is not a sound or a video.'); const s = await soundOf(f), o = await soundFile(s, to); return { name: outName(f.name, extOf(to), taken), ext: extOf(to), codec: o.codec, bytes: o.bytes, notes: [soundNote(s), ...o.notes] }; }
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
    else if (to) { for (let i = 0; i < list.length; i++) { const w = 'Working on ' + (i + 1) + ' of ' + list.length + ': ' + list[i].f.name; say(w); try { add(await convertTo(list[i].f, list[i].fmt, to, taken, (p) => say(w + ' (' + p + ', the video plays through once)'))); } catch (e) { fail(list[i].f, e); } } }
    else if (['cut', 'speed', 'gain', 'silence', 'denoise', 'extract-audio'].includes(t.run)) {
      for (let i = 0; i < list.length; i++) {
        const { f } = list[i]; say('Working on ' + (i + 1) + ' of ' + list.length + ': ' + f.name);
        try {
          if (t.run === 'cut' && list[i].fmt === 'mp3') { const r = cutMp3(await bytesOf(f), val('from', 0), $('upto').value); add({ name: outName(f.name, 'mp3', taken), ext: 'mp3', bytes: r.bytes, notes: r.notes }); continue; }
          if (t.run === 'gain' && list[i].fmt === 'mp3') {
            const r = gainMp3(await bytesOf(f), val('db', 6)); let over = 0;
            // the same sound, decoded, times the new level: the samples past the top are the ones a player clips
            if (r.factor > 1) for (const c of (await soundOf(f)).channels) for (let k = 0; k < c.length; k++) if (Math.abs(c[k]) * r.factor > 1) over++;
            add({ name: outName(f.name, 'mp3', taken), ext: 'mp3', bytes: r.bytes, notes: [...r.notes, r.factor > 1 ? (over ? over + ' samples go past the top, and a player clips them: try fewer dB' : 'no sample goes past the top') : 'quieter, so nothing clips'] }); continue;
          }
          const s = await soundOf(f), r = t.run === 'cut' ? cut(s, val('from', 0), $('upto').value) : t.run === 'speed' ? speed(s, val('factor', 1.5)) : t.run === 'gain' ? gain(s, val('db', 6)) : t.run === 'denoise' ? denoise(s, val('red', 12), 1.5, $('nfrom').value, $('nto').value) : t.run === 'silence' ? removeSilence(s, val('thr', -45), val('minms', 400)) : { ...s, notes: [] };
          const o = await soundFile(r, as); add({ name: outName(f.name, extOf(as), taken), ext: extOf(as), codec: o.codec, bytes: o.bytes, notes: [...r.notes, soundNote(r), ...o.notes] });
        } catch (e) { fail(f, e); }
      }
    } else if (['merge', 'mix', 'crossfade'].includes(t.run)) {
      say('Reading ' + list.length + ' sounds'); const all = []; for (const { f } of list) all.push(await soundOf(f).catch((e) => { throw new Error(f.name + ': ' + e.message); }));
      const r = t.run === 'mix' ? mix(all) : merge(all, t.run === 'crossfade' ? val('xfade', 2) : 0), o = await soundFile(r, as);
      add({ name: outName(base(list[0].f.name) + (t.run === 'mix' ? ' mix' : ' joined') + '.' + extOf(as), extOf(as), taken), ext: extOf(as), codec: o.codec, bytes: o.bytes, notes: [...r.notes, soundNote(r), ...o.notes] });
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
    } else if (t.run === 'watermark-image') {
      const useP = $('wmk').value === 'picture', words = $('words').value.trim(), pics = [];
      for (const x of list) if (kindOf(x.fmt) === 'picture') pics.push(x); else fail(x.f, new Error('this is not a picture.'));
      if (!useP && !words) throw new Error('write the words of the watermark, or set Mark to the smallest picture you pick.');
      if (useP && pics.length < 2) throw new Error('pick the pictures to mark and the mark itself: 2 pictures or more.');
      say('Reading ' + pics.length + ' picture' + (pics.length === 1 ? '' : 's')); const cs = []; for (const x of pics) cs.push({ ...x, c: await canvasOf(x.f).catch((e) => { throw new Error(x.f.name + ': ' + e.message); }) });
      const mark = useP ? cs.reduce((a, b) => (b.c.width * b.c.height < a.c.width * a.c.height ? b : a)) : null;
      const size = Math.max(1, Math.min(60, val('pw', 15))), alpha = Math.max(5, Math.min(100, val('alpha', 60))), corner = $('corner').value, q = Math.max(10, Math.min(100, val('qual', 90))) / 100;
      const where = { br: 'bottom right', bl: 'bottom left', tr: 'top right', tl: 'top left' }[corner];
      for (const p of cs) {
        if (p === mark) continue;
        try {
          if (p.fmt === 'gif' && gifSpeed(await bytesOf(p.f), 1).frames > 1) throw new Error('an animated GIF: Verse puts a mark on still pictures only.');
          const to = PICTURE_OUT.includes(p.fmt) && p.fmt !== 'pdf' ? p.fmt : 'png', out = make('canvas', { width: p.c.width, height: p.c.height }), x = out.getContext('2d');
          x.drawImage(p.c, 0, 0);
          drawOver(x, out.width, out.height, mark ? { pic: mark.c, corner, size, alpha: alpha / 100 } : { text: words, corner, size: size / 4, alpha: alpha / 100 }, 0);
          add({ name: outName(base(p.f.name) + ' watermarked.' + to, to, taken), ext: to, bytes: await pictureFile(out, to, q), notes: [(mark ? mark.f.name + ' as the mark, ' + size + '% of the width' : 'the words "' + words + '"') + ', ' + where + ', ' + alpha + '% seen', out.width + ' x ' + out.height + ' pixels' + (to === p.fmt ? '' : ', written as a PNG')] });
        } catch (e) { fail(p.f, e); }
      }
    } else if (t.run === 'video') { await runVideo(t, list, taken, add, fail, say);
    } else if (t.run === 'mp3-image') {
      const m = list.find((x) => x.fmt === 'mp3'), pic = list.find((x) => kindOf(x.fmt) === 'picture');
      if (!m || !pic) throw new Error('pick one MP3 and one picture.');
      say('Putting ' + pic.f.name + ' in ' + m.f.name);
      const raw = await bytesOf(pic.f), jpgOrPng = pic.fmt === 'jpg' || pic.fmt === 'png', cover = jpgOrPng ? raw : await pictureFile(await canvasOf(pic.f), 'jpg', 0.92);
      const r = addCover(await bytesOf(m.f), cover, pic.fmt === 'png' ? 'image/png' : 'image/jpeg');
      add({ name: outName(m.f.name, 'mp3', taken), ext: 'mp3', bytes: r.bytes, notes: (jpgOrPng ? [] : [pic.fmt.toUpperCase() + ' picture made a JPEG, the format players read']).concat(r.notes) });
    } else if (t.run === 'epub-merge') {
      const bad = list.find((x) => x.fmt !== 'epub'); if (bad) throw new Error(bad.f.name + ' is not an EPUB file. Pick only EPUB books to merge.');
      say('Merging ' + list.length + ' books');
      const r = await mergeBooks(await Promise.all(list.map(async (x) => ({ name: x.f.name, bytes: await bytesOf(x.f) }))), $('btitle').value);
      add({ name: outName(r.title.slice(0, 80) + '.epub', 'epub', taken), ext: 'epub', bytes: r.bytes, notes: r.notes });
    } else if (t.run === 'epub-compress') {
      const books = list.filter((x) => x.fmt === 'epub'); if (!books.length || books.length < list.length) throw new Error('pick only EPUB books to compress.');
      const { shrink, max } = shrinker();
      for (const e of books) { say('Compressing ' + e.f.name); const r = await compressBook(await bytesOf(e.f), shrink, { maxSide: max }); add({ name: outName(e.f.name, 'epub', taken), ext: 'epub', bytes: r.bytes, notes: r.notes }); }
    } else if (t.run === 'cbz-compress') {
      for (const x of list) if (x.fmt !== 'zip') throw new Error(x.f.name + (/\.cbr$/i.test(x.f.name) ? ': a CBR is a RAR archive, which Verse cannot open yet. A CBZ (a zip) works.' : ' is not a CBZ (a zip of pages).'));
      const { shrink, max } = shrinker();
      for (const x of list) { say('Compressing ' + x.f.name); const r = await compressComic(await bytesOf(x.f), shrink, { maxSide: max }); add({ name: outName(x.f.name, 'cbz', taken), ext: 'cbz', bytes: r.bytes, notes: r.notes }); }
    } else if (t.run === 'epub-cover') {
      const e = list.find((x) => x.fmt === 'epub'), pic = list.find((x) => kindOf(x.fmt) === 'picture');
      if (!e || !pic) throw new Error('pick one EPUB and one picture.');
      say('Putting ' + pic.f.name + ' on ' + e.f.name); const raw = await bytesOf(pic.f); let made = '', size = '';
      const encode = async (type) => { const want = type === 'image/png' ? 'png' : 'jpg'; if (pic.fmt === want) return raw; made = pic.fmt.toUpperCase() + ' picture made a ' + (want === 'png' ? 'PNG' : 'JPEG') + ' for the cover'; return pictureFile(await canvasOf(pic.f), want, 0.92); };
      try { const bm = await createImageBitmap(pic.f); size = 'the picture is ' + bm.width + ' x ' + bm.height + ' pixels'; if (bm.close) bm.close(); } catch (_) {}
      const r = await changeCover(await bytesOf(e.f), encode);
      add({ name: outName(e.f.name, 'epub', taken), ext: 'epub', bytes: r.bytes, notes: [...r.notes, made, size].filter(Boolean) });
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

// ---- the video tools: each plays the video once (or draws the pictures) and codes it on this device ----------------------------------------
const opt = (id) => { const e = $(id); return e && e.value !== '' && isFinite(+e.value) ? +e.value : null; };
const bitmapOf = async (f) => { try { return await createImageBitmap(f); } catch (_) { throw new Error(f.name + ': this browser cannot open this picture.'); } };
const plain = (W, H, color) => { const c = new OffscreenCanvas(W, H), x = c.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, W, H); return c; };
// the frames of an animated GIF, each with its time, read by the browser's ImageDecoder
async function gifFrames(f) {
  if (typeof ImageDecoder !== 'function') throw new Error('this browser cannot read the frames of a GIF (it has no ImageDecoder). Chrome and Edge can.');
  const dec = new ImageDecoder({ data: await f.arrayBuffer(), type: 'image/gif' }); await dec.tracks.ready;
  const n = dec.tracks.selectedTrack.frameCount, out = [];
  for (let i = 0; i < n; i++) { const { image } = await dec.decode({ frameIndex: i }); out.push({ pic: await createImageBitmap(image), d: image.duration ? image.duration / 1e6 : 0.1 }); image.close(); }
  dec.close(); return out;
}
// the pages of a PDF as pictures 1280 pixels wide (pdf.js)
async function pdfPages(f, say) {
  const js = await loadJs(); let doc;
  try { doc = await js.getDocument({ data: await bytesOf(f) }).promise; } catch (e) { throw new Error(/password|encrypt/i.test(String(e && e.message)) ? 'this PDF is protected with a password.' : 'this PDF did not open.'); }
  if (doc.numPages > 300) throw new Error('this PDF has ' + doc.numPages + ' pages; Verse makes a video of 300 pages at most.');
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    say('Drawing page ' + i + ' of ' + doc.numPages); const pg = await doc.getPage(i), v0 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: 1280 / v0.width });
    const c = make('canvas', { width: Math.round(vp.width), height: Math.round(vp.height) }), x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: x, viewport: vp }).promise; out.push(c);
  }
  return out;
}
async function runVideo(t, list, taken, add, fail, say) {
  const ext = ($('vfmt') && $('vfmt').value) || 'mp4', q = ($('vq') && $('vq').value) || 'medium', v = t.vop;
  const vids = list.filter((x) => kindOf(x.fmt) === 'video'), pics = list.filter((x) => kindOf(x.fmt) === 'picture'), snds = list.filter((x) => kindOf(x.fmt) === 'sound');
  const when = () => ({ from: opt('ofrom'), to: opt('oto') }), alpha = () => Math.max(0.05, Math.min(1, val('alpha', 100) / 100));
  const result = (name, suffix, r, extra = []) => ({ name: outName(base(name) + ' ' + suffix + '.' + ext, ext, taken), ext, bytes: r.bytes, notes: [...r.notes, ...extra] });
  const progress = (w, plays = true) => (x) => say(w + ' (' + Math.round(x * 100) + '%' + (plays ? ', the video plays through once' : '') + ')');
  const still = async (pictures, o, name, suffix, w) => { say(w); add(result(name, suffix, await writeStill(pictures, { container: ext, quality: q, ...o, onProgress: progress(w, false) }))); };
  if (v === 'sound-video') {
    const s = snds[0] || vids[0]; if (!s) throw new Error('pick a sound.');
    const sound = await soundOf48(s.f); if (!sound) throw new Error(s.f.name + ': this browser cannot play this sound.');
    const pic = pics[0] ? await bitmapOf(pics[0].f) : plain(1280, 720, $('bcol').value);
    return still([{ pic, d: sound.channels[0].length / sound.rate }], { sound, fitSound: 'sound', fps: 10, color: $('bcol').value }, s.f.name, 'video', 'Making a video of ' + s.f.name);
  }
  if (v === 'pictures-video') {
    if (!pics.length) throw new Error('pick 1 or more pictures.');
    const each = Math.max(0.1, val('each', 2)), all = []; for (const p of pics) all.push({ pic: await bitmapOf(p.f), d: each });
    const sound = snds[0] ? await soundOf48(snds[0].f) : null; if (snds[0] && !sound) throw new Error(snds[0].f.name + ': this browser cannot play this sound.');
    return still(all, { sound, fitSound: 'pictures' }, pics[0].f.name, 'video', 'Making a video of ' + pics.length + ' picture' + (pics.length === 1 ? '' : 's'));
  }
  if (v === 'gif-video') { for (const { f, fmt } of list) { try { if (fmt !== 'gif') throw new Error('this is not a GIF.'); const fr = await gifFrames(f); await still(fr, { color: $('bcol').value }, f.name, 'video', 'Making a video of ' + f.name + ' (' + fr.length + ' frames)'); } catch (e) { fail(f, e); } } return; }
  if (v === 'pdf-video') { for (const { f, fmt } of list) { try { if (fmt !== 'pdf') throw new Error('this is not a PDF.'); const pages = await pdfPages(f, say), each = Math.max(0.1, val('each', 3)); await still(pages.map((pic) => ({ pic, d: each })), { color: '#fff' }, f.name, 'video', 'Making a video of ' + pages.length + ' page' + (pages.length === 1 ? '' : 's')); } catch (e) { fail(f, e); } } return; }
  if (!vids.length) throw new Error('pick a video.');
  if (v === 'transition') {
    const mode = $('tmode').value, kind = $('tkind').value, seconds = Math.max(1, Math.min(10, val('tsec', 3))), name = TRANSITIONS.find((x) => x[0] === kind)[1];
    if (mode === 'join') {
      if (vids.length < 2) throw new Error('pick 2 or more videos to join with a transition, or pick a 1 File option.');
      const w = 'Joining ' + vids.length + ' videos with ' + name; say(w);
      add(result(vids[0].f.name, 'with transitions', await writeVideo(vids.map((x) => x.f), { container: ext, quality: q, transition: { kind, seconds, mode }, onProgress: progress(w) }), [vids.length + ' videos one after another'])); return;
    }
    for (const { f } of vids) { const w = 'Adding ' + name + ' to ' + f.name; say(w); try { add(result(f.name, 'with transition', await writeVideo(f, { container: ext, quality: q, transition: { kind, seconds, mode }, onProgress: progress(w) }))); } catch (e) { fail(f, e); } }
    return;
  }
  if (v === 'merge') { const w = 'Joining ' + vids.length + ' videos'; say(w); add(result(vids[0].f.name, 'joined', await writeVideo(vids.map((x) => x.f), { container: ext, quality: q, onProgress: progress(w) }), [vids.length + ' videos one after another'])); return; }
  // one video with a second file: a sound, or a picture
  if (v === 'add-sound') {
    const s = snds[0] || vids[1]; if (!s) throw new Error('pick a sound too (a video\'s sound works).');
    const addSound = await soundOf48(s.f); if (!addSound) throw new Error(s.f.name + ': this browser cannot play this sound.');
    const w = 'Putting ' + s.f.name + ' on ' + vids[0].f.name; say(w);
    add(result(vids[0].f.name, 'with sound', await writeVideo(vids[0].f, { container: ext, quality: q, addSound, addMode: $('amode').value, sound: $('amode').value === 'mix' ? 'keep' : 'none', onProgress: progress(w) }))); return;
  }
  const pic = pics[0] ? await bitmapOf(pics[0].f) : null;
  if (v === 'image' && !pic) throw new Error('pick a picture too.');
  if (v === 'watermark' && !pic && !$('words').value.trim()) throw new Error('write the words of the watermark, or add a picture.');
  if (v === 'text' && !$('words').value.trim()) throw new Error('write the words to put on the video.');
  if (v === 'background' && $('backdrop').value === 'picture' && !pic) throw new Error('add a picture for the background, or pick another background.');
  const edit = {
    cut: () => ({ from: val('from', 0), to: opt('upto') }), speed: () => ({ speed: val('factor', 1.5) }), gain: () => ({ gainDb: val('db', 6) }), shift: () => ({ shift: val('shift', 0.2) }),
    resize: () => ({ width: Math.round(val('vw', 1280)) }), rotate: () => ({ rotate: +$('rot').value }), blur: () => ({ blur: val('blur', 6) }), bright: () => ({ bright: val('bright', 130) }),
    compress: () => ({ short: +$('vmax').value || 0 }), mute: () => ({ sound: 'none' }),
    text: () => ({ over: [{ text: $('words').value, x: 50, y: +$('wpos').value, size: val('wsize', 6), color: $('wcol').value, ...when() }] }),
    image: () => ({ over: [{ pic, x: val('px', 50), y: val('py', 50), size: val('pw', 25), alpha: alpha(), ...when() }] }),
    watermark: () => ({ over: [pic ? { pic, corner: $('corner').value, size: val('pw', 15), alpha: alpha() } : { text: $('words').value, corner: $('corner').value, size: val('pw', 15) / 4, alpha: alpha() }] }),
    background: () => ({ shape: $('shape').value.split(':').map(Number), backdrop: $('backdrop').value, backdropPic: pic, color: $('bcol').value }),
  }[v];
  if (!edit) throw new Error('Verse does not know this video tool.');
  const SUFFIX = { cut: 'cut', speed: val('factor', 1.5) + 'x', gain: 'louder', shift: 'synced', resize: 'resized', rotate: 'turned', blur: 'blurred', bright: 'brighter', compress: 'smaller', mute: 'no sound', text: 'with text', image: 'with picture', watermark: 'watermarked', background: 'on background' };
  for (const { f } of vids) {
    const w = 'Working on ' + f.name; say(w);
    try {
      const r = await writeVideo(f, { container: ext, quality: q, ...edit(), onProgress: progress(w) }), extra = [];
      if (v === 'compress') extra.push(sizeText(f.size) + ' became ' + sizeText(r.bytes.length) + (r.bytes.length < f.size ? ' (' + Math.round(100 - 100 * r.bytes.length / f.size) + '% smaller)' : ': no smaller, the video was already small for its size; try Small file and fewer pixels'));
      add(result(f.name, SUFFIX[v], r, extra));
    } catch (e) { fail(f, e); }
  }
}
function show() {
  const ok = results.filter((r) => r.bytes), bad = results.length - ok.length, ul = $('out'); ul.replaceChildren();
  for (const r of results) {
    if (r.error) { ul.append(make('li', {}, make('strong', {}, r.name + ': '), r.error)); continue; }
    const url = URL.createObjectURL(new Blob([r.bytes], { type: MIME[r.ext] || 'application/octet-stream' })); urls.push(url);
    const li = make('li', {}, make('a', { class: 'dl', href: url, download: r.name, textContent: 'Download ' + r.name }), make('span', { class: 'sz' }, sizeText(r.bytes.length)));
    if (r.notes && r.notes.length) li.append(make('p', { class: 'notes' }, r.notes.join(' · ')));
    if (SHOWN.has(r.ext)) li.append(make('img', { src: url, alt: 'The new picture: ' + r.name }));
    if (['wav', 'flac', 'ogg', 'opus', 'mp3'].includes(r.ext) || ((r.ext === 'm4a' || r.ext === 'm4r') && document.createElement('audio').canPlayType('audio/mp4; codecs="' + (r.codec === 'aac' ? 'mp4a.40.2' : 'alac') + '"'))) li.append(make('audio', { controls: true, src: url, preload: 'metadata' }));
    if (VIDEO_OUT.includes(r.ext) && !['avi', 'flv', '3gp'].includes(r.ext)) li.append(make('video', { controls: true, src: url, preload: 'metadata', playsInline: true }));
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
