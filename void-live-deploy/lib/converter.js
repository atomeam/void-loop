// The file and unit converter (/converter/, 2026-10-29, assimilates onlineconverter.com). Pure parts, the same in the browser and in node tests:
// the 106 tools that onlineconverter.com lists (read from its home page), each with Verse's honest status; the search ("mp4 to mp3"); the file
// format read from the first bytes, not only from the name; the encoders Verse writes itself (WAV, AIFF, BMP, TIFF, GIF; FLAC and Ogg in audio-write.js); the sound edits (cut,
// speed, volume, fades, silence, merge, mix, crossfade); the change of a GIF's speed; MP4, MOV, WEBM and MKV video and the video edits (run by /lib/video-write.js, written by /lib/video-mux.js); the words of TXT, HTML, RTF, DOCX, EPUB and PDF files read
// and written; an EPUB's cover (changed by /lib/epub-edit.js). Nothing here uploads a file: the page decodes pictures, sounds and PDFs with the browser and pdf.js, and writes with this file and
// pdf-lib (vendored). Statuses: 'here' this page does it, 'verse' another Verse page does it, 'part' part of it (the note says which part),
// 'no' not on Verse yet. A tool is never shown as done when it is not.
import { unzip, paragraphsOf, OFFICE, docxOf, xml, unxml, pdfParagraphs } from './translate-docs.js';
import { zip as storeZip } from './pdf-tools.js';

const te = new TextEncoder();
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---- the catalog -------------------------------------------------------------------------------------------------------------------------
export const CATS = Object.freeze(['Video', 'Audio', 'Image', 'Ebook', 'Document', 'Unit']);
const NO = 'Not on Verse yet.';
// the video formats Verse does not write, each with the reason
const VIDEO_WHY = { '3GP': 'Not on Verse yet: Verse writes MP4, MOV, WEBM and MKV, not 3GP (a phone format whose usual sound codec, AMR, no browser can code).', AVI: 'Not on Verse yet: Verse writes MP4, MOV, WEBM and MKV. It has no AVI writer, and no browser plays AVI back to check one.', FLV: 'Not on Verse yet: Verse writes MP4, MOV, WEBM and MKV, not FLV (Flash video, which no browser plays now).', WMV: 'Not on Verse yet: WMV needs Windows Media video, which no browser can code.' };
const VIDEO_OUT_NOTE = { MP4: 'Any video your browser can play becomes an MP4 (H.264 video; AAC sound, or Opus where the browser has no AAC encoder), on this device. It takes as long as the video plays.', MOV: 'Any video your browser can play becomes a MOV (H.264 video; AAC sound, or Opus where the browser has no AAC encoder, which QuickTime Player does not play), on this device. It takes as long as the video plays.', WEBM: 'Any video your browser can play becomes a WEBM (VP9 video, Opus sound), on this device. It takes as long as the video plays.', MKV: 'Any video your browser can play becomes an MKV (VP9 video, Opus sound), on this device. It takes as long as the video plays.' };
// a video tool: run 'video' with the edit (vop); each plays the video once, so it takes as long as the video plays
const vid = (cat, name, vop, note, extra = {}) => tool(cat, name, 'here', { run: 'video', vop, from: 'video', note, ...extra });
// the sounds Verse writes: WAV and AIFF and FLAC with its own encoders; OGG and OPUS with the browser's Opus encoder in Verse's own Ogg pages
const SOUND_OUT_NOTE = { WAV: 'WAV (16-bit PCM)', AIFF: 'AIFF (16-bit PCM)', FLAC: 'FLAC (16-bit and lossless: the same sound as a WAV, in less space)', OGG: 'an OGG with Opus sound at 128 kbps (no browser can code Vorbis, the older OGG sound)', OPUS: 'OPUS (Ogg Opus at 128 kbps)' };
const noAudio = (f) => 'Not on Verse yet: Verse opens ' + f + ' files and makes WAV, AIFF, FLAC, OGG or OPUS, but cannot write ' + f + '.';
const WORDS = 'The words and paragraphs only: pictures, tables and the page layout are left out.';
const conv = (cat, f, status, extra = {}) => ({ id: slug(cat === 'Document' ? 'doc' : cat) + '-' + slug(f), cat, kind: 'converter', name: f, status, ...extra });
const tool = (cat, name, status, extra = {}) => ({ id: slug(name), cat, kind: 'tool', name, status, ...extra });
const UNIT = (name, href) => tool('Unit', name, 'verse', { href, note: 'On the Verse unit converter.' });

export const CATALOG = Object.freeze([
  ...['MP4', '3GP', 'AVI', 'FLV', 'MKV', 'MOV', 'WEBM', 'WMV'].map((f) => (VIDEO_OUT_NOTE[f]
    ? conv('Video', f, 'here', { to: f.toLowerCase(), from: 'video', note: VIDEO_OUT_NOTE[f] })
    : conv('Video', f, 'no', { note: VIDEO_WHY[f] }))),
  vid('Video', 'Add Audio to Video', 'add-sound', 'Puts a sound on a video, in place of its own sound or mixed with it. Pick one video and one sound.', { from: 'video+sound' }),
  vid('Video', 'Add Background to Video', 'background', 'Puts the video on a square, tall (9:16) or wide (16:9) background: a colour, the video itself blurred, or a picture you add.', { from: 'video+picture?' }),
  vid('Video', 'Add Image to Video', 'image', 'Puts a picture on the video, at the place, size and see-through level you pick, for all of it or from one second to another. Pick one video and one picture.', { from: 'video+picture' }),
  vid('Video', 'Add Text to Video', 'text', 'Puts your words on the video, at the place, size and colour you pick, for all of it or from one second to another.'),
  tool('Video', 'Add Transition to Video', 'no', { note: 'Not on Verse yet: Verse joins videos one after another (Merge Video), but does not fade one into the next yet.' }),
  vid('Video', 'Blur Video', 'blur', 'Blurs every picture of the video by the amount you set.'),
  vid('Video', 'Brighten Video', 'bright', 'Makes every picture of the video brighter or darker by the percent you set.'),
  vid('Video', 'Change Video Speed', 'speed', 'Faster or slower (0.25 to 4 times). The sound changes speed too, so its pitch moves, as a tape does.'),
  vid('Video', 'Compress Video', 'compress', 'A smaller file: a lower bit rate and, if you pick it, fewer pixels. It says how much smaller the file became.'),
  vid('Video', 'Cut Video', 'cut', 'Keeps the video from one second to another, with its sound.'),
  vid('Video', 'Increase Video Volume', 'gain', 'Makes the sound of a video louder or quieter by a number of decibels, with a count of clipped samples.'),
  tool('Video', 'Make Split Screen Video', 'no', { note: 'Not on Verse yet: Verse plays and codes one video at a time, so it does not put two side by side yet.' }),
  vid('Video', 'Merge Video', 'merge', 'Plays 2 or more videos one after another, in the order you pick them, as one video the size of the first.', { many: true }),
  tool('Video', 'Repair MP4', 'no', { note: 'Not on Verse yet: Verse reads a video through the browser, which cannot open a broken MP4; a repair rebuilds the index from the raw data, which Verse does not do.' }),
  vid('Video', 'Resize Video', 'resize', 'Makes the video the width you set; the height follows, so the shape stays.'),
  vid('Video', 'Rotate Video', 'rotate', 'Turns the video 90, 180 or 270 degrees.'),
  tool('Video', 'Stabilize Video', 'no', { note: 'Not on Verse yet: stabilizing needs motion tracking across the pictures, which Verse does not do.' }),
  vid('Video', 'Sync Audio and Video', 'shift', 'Moves the sound earlier or later against the pictures, by the seconds you set.'),
  vid('Video', 'Watermark Video', 'watermark', 'Puts your words or a picture you add in a corner of the video, see-through by the amount you set.', { from: 'video+picture?' }),
  ...['MP3', 'AIFF', 'ALAC', 'AMR', 'FLAC', 'M4A', 'M4R', 'OGG', 'OPUS', 'WAV', 'WMA'].map((f) => (SOUND_OUT_NOTE[f]
    ? conv('Audio', f, 'here', { to: f.toLowerCase(), from: 'sound', note: 'Any sound or video your browser can play becomes ' + SOUND_OUT_NOTE[f] + ', on this device.' })
    : conv('Audio', f, 'no', { note: ['ALAC', 'AMR', 'WMA'].includes(f) ? NO : noAudio(f) }))),
  tool('Audio', 'Add Image to MP3', 'here', { run: 'mp3-image', from: 'mp3+picture', note: 'Puts a picture in the MP3 as its cover (the ID3 tag, as music players show it). The sound is not coded again, so it stays exactly as it was; title, artist and the other tag fields stay too.' }),
  tool('Audio', 'Add Transition to Audio', 'here', { run: 'crossfade', from: 'sound', many: true, note: 'Joins 2 or more sounds with a crossfade between each, as one WAV.' }),
  vid('Audio', 'Audio to Video', 'sound-video', 'A sound becomes a video: the picture you add (or a colour) shown for as long as the sound plays.', { from: 'sound+picture?' }),
  tool('Audio', 'Change Audio Speed', 'here', { run: 'speed', from: 'sound', note: 'Faster or slower, as a tape plays it: the pitch moves with the speed. The result is a WAV.' }),
  tool('Audio', 'Compress MP3', 'no', { note: NO }),
  tool('Audio', 'Cut MP3', 'here', { run: 'cut', from: 'sound', note: 'Keeps an MP3 from one second to another, and the result is an MP3. The sound is not coded again, so it loses nothing; with the LAME tag most MP3s have, the cut is exact to the sample, and with none it is on the frame lines, 26 ms apart. The tag (title, artist, cover) stays. Any other sound is cut too, and saved as the format you pick.' }),
  tool('Audio', 'Extract Audio from Video', 'here', { run: 'extract-audio', from: 'video', note: 'The sound of a video your browser can play, as a WAV.' }),
  tool('Audio', 'Increase MP3 Volume', 'here', { run: 'gain', from: 'sound', note: 'Makes an MP3 louder or quieter, and the result is an MP3. The sound is not coded again, so it loses nothing: each piece of the MP3 keeps its data and gets a new level number, in steps of 1.5 dB, as MP3Gain does. Verse counts the samples that go past the top. The tag (title, artist, cover) stays. Any other sound is changed too, and saved as the format you pick.' }),
  tool('Audio', 'Merge Audio', 'here', { run: 'merge', from: 'sound', many: true, note: 'Plays 2 or more sounds one after another, in the order you pick them, as one WAV.' }),
  tool('Audio', 'Mix Audio', 'here', { run: 'mix', from: 'sound', many: true, note: 'Plays 2 or more sounds at the same time, as one WAV; it turns the mix down if it would clip, and says so.' }),
  vid('Audio', 'Remove Audio from Video', 'mute', 'The same video with no sound.'),
  tool('Audio', 'Remove Noise from Audio', 'here', { run: 'denoise', from: 'sound', note: 'Takes a steady noise (hiss, hum, a fan, room tone) out of a sound, on your device. Verse learns the noise from the quietest part, or from the seconds you mark, then takes down each frequency band that is not above it (spectral gating). It says how far the noise went down. A noise that changes like the sound (voices, traffic) stays.' }),
  tool('Audio', 'Remove Silence from Audio', 'here', { run: 'silence', from: 'sound', note: 'Takes out every quiet stretch longer than you set, as a WAV, and says how much it took out.' }),
  tool('Audio', 'Repair M4A', 'no', { note: NO }),
  ...['JPG', 'BMP', 'DNG', 'GIF', 'PDF', 'PNG', 'TIFF', 'WEBP'].map((f) => (f === 'DNG'
    ? conv('Image', f, 'no', { note: 'Not on Verse yet: Verse cannot write camera raw files.' })
    : conv('Image', f, 'here', { to: f.toLowerCase(), from: 'picture', note: { JPG: 'With a quality you set.', BMP: '24-bit colour; see-through parts become white.', GIF: '256 colours with error diffusion; see-through parts stay see-through.', PDF: 'One picture to a page, the page the size of the picture.', PNG: 'Lossless, see-through parts kept.', TIFF: 'Uncompressed 8-bit colour, see-through parts kept.', WEBP: 'With a quality you set.' }[f] }))),
  tool('Image', 'Blur Image', 'verse', { href: '/photos/?tab=adj', note: 'On Verse photo tools: Adjust, Blur.' }),
  tool('Image', 'Brighten Image', 'verse', { href: '/photos/?tab=adj', note: 'On Verse photo tools: Adjust, Brightness.' }),
  tool('Image', 'Change GIF Speed', 'here', { run: 'gif-speed', from: 'gif', note: 'Every frame of an animated GIF shown faster or slower; the pictures are not touched.' }),
  tool('Image', 'Change Image Background', 'no', { note: NO }),
  tool('Image', 'Compress Image', 'verse', { href: '/photos/?tab=out', note: 'On Verse photo tools, with a before and after slider and the size saved.' }),
  tool('Image', 'Cut Image', 'verse', { href: '/photos/?tab=crop', note: 'On Verse photo tools: Crop and rotate.' }),
  tool('Image', 'Extract Image from Video', 'here', { run: 'frame', from: 'video', note: 'The picture at the second you set, as a PNG.' }),
  vid('Image', 'GIF to Video', 'gif-video', 'Every frame of an animated GIF, for its own time, as a video; see-through parts become the colour you pick.', { from: 'gif' }),
  vid('Image', 'Image to Video', 'pictures-video', 'Shows 1 or more pictures one after another, for the seconds you set each, as a video; you can add a sound.', { from: 'picture+sound?' }),
  tool('Image', 'Merge Images', 'here', { run: 'merge-images', from: 'picture', many: true, note: 'Puts 2 or more pictures side by side or one above the other, as one PNG.' }),
  tool('Image', 'Remove Image Background', 'no', { note: NO }),
  tool('Image', 'Resize Image', 'verse', { href: '/resize-image/', note: 'On Verse: resize by pixels or by percent.' }),
  tool('Image', 'Rotate Image', 'verse', { href: '/photos/?tab=crop', note: 'On Verse photo tools: Crop and rotate.' }),
  tool('Image', 'Watermark Image', 'part', { href: '/photos/?tab=text', note: 'On Verse photo tools: Text. A text watermark only, not a picture.' }),
  ...['EPUB', 'AZW', 'DOCX', 'HTML', 'MOBI', 'PDF', 'RTF', 'TXT'].map((f) => (['AZW', 'MOBI'].includes(f)
    ? conv('Ebook', f, 'no', { note: 'Not on Verse yet: Verse cannot write Kindle files.' })
    : conv('Ebook', f, f === 'TXT' ? 'here' : 'part', { to: f.toLowerCase(), from: 'text', note: f === 'TXT' ? 'Every word of an EPUB, DOCX, PDF, RTF or HTML file as plain text.' : WORDS }))),
  tool('Ebook', 'Change EPUB Cover', 'here', { run: 'epub-cover', from: 'epub+picture', note: 'Puts a picture on an EPUB as its cover, the one readers show in the library and on the first page. An old cover keeps its file, so every page that showed it shows the new one; a book with no cover gets a cover page first. The text, the chapters and the other files stay byte for byte as they were.' }),
  ...['Compress AZW3', 'Compress CBZ/CBR', 'Compress EPUB', 'Merge EPUB'].map((n) => tool('Ebook', n, 'no', { note: NO })),
  ...['PDF', 'DOCX', 'HTML', 'TXT'].map((f) => conv('Document', f, f === 'TXT' ? 'here' : 'part', { to: f.toLowerCase(), from: 'text', note: f === 'TXT' ? 'Every word of a PDF, DOCX, EPUB, RTF or HTML file as plain text.' : WORDS })),
  tool('Document', 'Add Image to PDF', 'here', { run: 'pdf-image', from: 'pdf+picture', note: 'Puts a picture on a page of a PDF, at the place and size you pick; the rest of the PDF stays as it was.' }),
  tool('Document', 'Compress PDF', 'verse', { href: '/pdf/?tool=compress', note: 'On Verse PDF tools.' }),
  tool('Document', 'Merge PDF', 'verse', { href: '/pdf/?tool=merge', note: 'On Verse PDF tools.' }),
  vid('Document', 'PDF to Video', 'pdf-video', 'Shows each page of a PDF for the seconds you set, as a video.', { from: 'pdf' }),
  tool('Document', 'PPTX to Video', 'no', { note: 'Not on Verse yet: Verse cannot draw PowerPoint slides, so it cannot show them in a video.' }),
  tool('Document', 'Split PDF', 'verse', { href: '/pdf/?tool=split', note: 'On Verse PDF tools.' }),
  UNIT('Area', '/convert/?k=area'), tool('Unit', 'Currency', 'verse', { href: '/markets/?s=EURUSD', note: 'On Verse markets, at the European Central Bank rates.' }),
  UNIT('Length / Distance', '/convert/?k=length'), UNIT('Speed', '/convert/?k=speed'), UNIT('Temperature', '/convert/?k=temperature'), UNIT('Time', '/convert/?k=time'), // void-review: ok (k= names a unit kind on /convert/, not a key)
  tool('Unit', 'Time Zone', 'verse', { href: '/time/', note: 'On the Verse time zone converter.' }),
  UNIT('Volume / Capacity', '/convert/?k=volume'), UNIT('Weight / Mass', '/convert/?k=mass'), // void-review: ok (k= names a unit kind on /convert/, not a key)
].map(Object.freeze));

export const toolOf = (id) => CATALOG.find((t) => t.id === id) || null;
/** how many of the tools are here, on another Verse page, in part, or not on Verse yet */
export function counts(list = CATALOG) { const c = { here: 0, verse: 0, part: 0, no: 0, all: list.length }; for (const t of list) c[t.status]++; return c; }
export const STATUS_TEXT = Object.freeze({ here: 'On this page', verse: 'On Verse', part: 'In part', no: 'Not on Verse yet' });

// ---- formats ------------------------------------------------------------------------------------------------------------------------------
const ALIAS = { jpeg: 'jpg', jpe: 'jpg', tif: 'tiff', htm: 'html', xhtml: 'html', word: 'docx', doc: 'docx', text: 'txt', aif: 'aiff', aifc: 'aiff', mpeg4: 'mp4', m4v: 'mp4', azw3: 'azw', kindle: 'azw', oga: 'ogg', weba: 'webm', qt: 'mov' };
export const normFormat = (s) => { const f = String(s || '').toLowerCase().replace(/^\./, ''); return ALIAS[f] || f; };
const KIND = { picture: ['jpg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'avif', 'heic', 'svg', 'dng', 'ico'], sound: ['wav', 'aiff', 'mp3', 'flac', 'ogg', 'opus', 'm4a', 'm4r', 'amr', 'wma', 'alac'], video: ['mp4', 'mov', '3gp', 'webm', 'mkv', 'avi', 'flv', 'wmv'], text: ['pdf', 'docx', 'rtf', 'html', 'txt', 'epub', 'azw', 'mobi', 'pptx', 'xlsx'] };
export const kindOf = (f) => Object.keys(KIND).find((k) => KIND[k].includes(normFormat(f))) || '';
const ascii = (b, at, n) => String.fromCharCode(...b.subarray(at, at + n));

/** a file's format from its first bytes (the name only breaks a tie, as for a .docx and a .pptx, which are both zips). Pure. */
export function formatOf(bytes, name = '') {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []), ext = normFormat((String(name).match(/\.([a-z0-9]+)$/i) || [])[1]);
  if (b.length < 4) return b.length ? (ext || 'txt') : '';
  const s4 = ascii(b, 0, 4), s12 = ascii(b, 8, 4);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b[0] === 0x89 && s4.slice(1) === 'PNG') return 'png';
  if (s4 === 'GIF8') return 'gif';
  if (s4 === 'RIFF') return s12 === 'WEBP' ? 'webp' : s12 === 'WAVE' ? 'wav' : s12 === 'AVI ' ? 'avi' : ext;
  if (s4 === 'FORM' && (s12 === 'AIFF' || s12 === 'AIFC')) return 'aiff';
  if (s4 === '%PDF') return 'pdf';
  if (s4 === 'fLaC') return 'flac';
  if (s4 === 'OggS') return b.length > 36 && ascii(b, 28, 8) === 'OpusHead' ? 'opus' : 'ogg';
  if (ascii(b, 0, 5) === '{\\rtf') return 'rtf';
  if (ascii(b, 0, 5) === '#!AMR') return 'amr';
  if (ascii(b, 0, 3) === 'FLV') return 'flv';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return ascii(b, 0, 64).includes('webm') ? 'webm' : 'mkv';
  if (b[0] === 0x30 && b[1] === 0x26 && b[2] === 0xb2 && b[3] === 0x75) return ext === 'wma' ? 'wma' : 'wmv';
  if ((s4 === 'II*\0' || s4 === 'MM\0*')) return ext === 'dng' ? 'dng' : 'tiff';
  if (ascii(b, 4, 4) === 'ftyp') { const brand = ascii(b, 8, 4); return /^(avif|avis)/.test(brand) ? 'avif' : /^(heic|heix|mif1|msf1)/.test(brand) ? 'heic' : /^M4A/.test(brand) ? (ext === 'm4r' ? 'm4r' : 'm4a') : brand === 'qt  ' ? 'mov' : /^3g/.test(brand) ? '3gp' : 'mp4'; }
  if (s4 === 'PK\x03\x04') { if (ascii(b, 30, 8) === 'mimetype' && ascii(b, 38, 20) === 'application/epub+zip') return 'epub'; return ['docx', 'pptx', 'xlsx', 'epub', 'zip'].includes(ext) ? ext : 'zip'; }
  if (b.length > 68 && ascii(b, 60, 8) === 'BOOKMOBI') return ext === 'azw' ? 'azw' : 'mobi';
  if (b[0] === 0x42 && b[1] === 0x4d && b.length > 26) return 'bmp';
  if (ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'mp3';
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'ico';
  // text: no NUL in the first 4 KB
  const head = b.subarray(0, 4096); if (head.includes(0)) return ext || '';
  const t = new TextDecoder().decode(head).replace(/^﻿/, '').trimStart().slice(0, 300).toLowerCase();
  if (/^<\?xml[\s\S]*<svg|^<svg/.test(t)) return 'svg';
  if (/^<!doctype html|^<html|^<head|^<body/.test(t)) return 'html';
  return ext === 'html' ? 'html' : 'txt';
}

/** what a format can become on this page */
export function targetsOf(f) {
  const k = kindOf(f), x = normFormat(f);
  if (k === 'picture') return ['jpg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'pdf'].filter((t) => t !== x);
  if (k === 'sound') return ['wav', 'aiff', 'flac', 'ogg', 'opus'].filter((t) => t !== x);
  if (k === 'video') return ['mp4', 'mov', 'webm', 'mkv', 'wav', 'aiff', 'flac', 'ogg', 'opus'].filter((t) => t !== x);
  if (['pdf', 'docx', 'rtf', 'html', 'txt', 'epub'].includes(x)) return ['txt', 'html', 'docx', 'rtf', 'epub', 'pdf'].filter((t) => t !== x);
  return [];
}

// ---- search -------------------------------------------------------------------------------------------------------------------------------
const FORMATS = new Set(Object.values(KIND).flat());
/** the tools for an ask: "mp4 to mp3", "cut mp3", "pdf". The exact tool first; where it is not on Verse, the nearest one that works. Pure. */
export function search(q) {
  const s = String(q || '').toLowerCase().replace(/[^a-z0-9/ .]+/g, ' ').replace(/\s+/g, ' ').trim(); if (!s) return [];
  const m = s.match(/^(?:convert |change |turn )?(?:an? )?(?:\.?([a-z0-9]+) (?:files? )?)?(?:to|2|into|in) \.?([a-z0-9]+)(?: files?| online| free)*$/);
  if (m && FORMATS.has(normFormat(m[2]))) {
    const from = normFormat(m[1] || ''), to = normFormat(m[2]), fk = kindOf(from), out = [];
    const cat = ['jpg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'dng'].includes(to) || (to === 'pdf' && fk === 'picture') ? 'Image' : kindOf(to) === 'sound' ? 'Audio' : kindOf(to) === 'video' ? 'Video' : ['epub', 'azw', 'mobi', 'rtf'].includes(to) || ['epub', 'azw', 'mobi'].includes(from) ? 'Ebook' : 'Document';
    const exact = CATALOG.find((t) => t.kind === 'converter' && t.cat === cat && normFormat(t.name) === to) || CATALOG.find((t) => t.kind === 'converter' && normFormat(t.name) === to);
    if (exact) out.push({ tool: exact, why: (from ? from.toUpperCase() + ' to ' : 'to ') + to.toUpperCase() });
    if (!exact || exact.status === 'no') {
      const near = kindOf(to) === 'video' && (fk === 'video' || fk === '') ? toolOf('video-mp4') : kindOf(to) === 'sound' ? toolOf('audio-wav') : kindOf(to) === 'video' && fk === 'picture' ? toolOf('image-gif') : fk === 'text' || kindOf(to) === 'text' ? toolOf('doc-txt') : null;
      if (near && near !== exact && (!from || fk === '' || near.from === 'sound' ? ['sound', 'video', ''].includes(fk) : true)) out.push({ tool: near, why: 'nearest on Verse: ' + near.name + (near.from === 'sound' ? ' (the sound, as a WAV)' : '') });
    }
    return out;
  }
  const words = s.split(' ').map(normFormat).filter((w) => w.length > 1 && !['to', 'a', 'an', 'the', 'my', 'online', 'free', 'file', 'files', 'converter', 'convert'].includes(w));
  if (!words.length) return [];
  const scored = CATALOG.map((t) => {
    const hay = (t.name + ' ' + t.cat + (t.kind === 'converter' ? ' ' + t.name + ' converter' : '')).toLowerCase().split(/[^a-z0-9]+/).map(normFormat);
    let n = 0; for (const w of words) if (hay.includes(w)) n += 2; else if (hay.some((h) => h.startsWith(w))) n += 1;
    return { tool: t, n };
  }).filter((x) => x.n >= Math.max(1, words.length));
  scored.sort((a, b) => b.n - a.n || (a.tool.status === 'no') - (b.tool.status === 'no'));
  return scored.slice(0, 12).map((x) => ({ tool: x.tool, why: '' }));
}

// ---- sound: decode PCM files, encode WAV and AIFF ------------------------------------------------------------------------------------------
/** a WAV or AIFF file's samples: { rate, channels: Float32Array[] }, or null if it is not uncompressed PCM. Pure. */
export function decodePcm(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), v = new DataView(b.buffer, b.byteOffset, b.byteLength), f = formatOf(b);
  if (f === 'wav') {
    let p = 12, fmt = null, data = null;
    while (p + 8 <= b.length) { const id = ascii(b, p, 4), size = v.getUint32(p + 4, true); if (id === 'fmt ') fmt = p + 8; if (id === 'data') { data = [p + 8, Math.min(size, b.length - p - 8)]; break; } p += 8 + size + (size & 1); }
    if (fmt == null || !data) return null;
    let code = v.getUint16(fmt, true); const ch = v.getUint16(fmt + 2, true), rate = v.getUint32(fmt + 4, true), bits = v.getUint16(fmt + 14, true);
    if (code === 0xfffe) code = v.getUint16(fmt + 24, true);
    if (!(code === 1 || (code === 3 && bits === 32)) || !ch) return null;
    return pcm(v, data[0], data[1], ch, rate, bits, code === 3, true, bits === 8);
  }
  if (f === 'aiff') {
    let p = 12, comm = null, ssnd = null; const aifc = ascii(b, 8, 4) === 'AIFC';
    while (p + 8 <= b.length) { const id = ascii(b, p, 4), size = v.getUint32(p + 4, false); if (id === 'COMM') comm = p + 8; if (id === 'SSND') ssnd = [p + 16 + v.getUint32(p + 8, false), size - 8]; p += 8 + size + (size & 1); }
    if (comm == null || !ssnd) return null;
    const ch = v.getUint16(comm, false), bits = v.getUint16(comm + 6, false), rate = ext80(v, comm + 8), cmp = aifc ? ascii(b, comm + 18, 4) : 'NONE';
    if (!(cmp === 'NONE' || cmp === 'sowt') || !ch) return null;
    return pcm(v, ssnd[0], Math.min(ssnd[1], b.length - ssnd[0]), ch, Math.round(rate), bits, false, cmp === 'sowt', false);
  }
  return null;
}
function pcm(v, at, len, ch, rate, bits, float, le, unsigned8) {
  const by = bits >> 3, frames = Math.floor(len / (by * ch)), out = Array.from({ length: ch }, () => new Float32Array(frames));
  for (let i = 0; i < frames; i++) for (let c = 0; c < ch; c++) {
    const p = at + (i * ch + c) * by; let x;
    if (float) x = v.getFloat32(p, le);
    else if (by === 1) x = unsigned8 ? (v.getUint8(p) - 128) / 128 : v.getInt8(p) / 128;
    else if (by === 2) x = v.getInt16(p, le) / 32768;
    else if (by === 3) { const a = le ? v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getInt8(p + 2) << 16) : v.getUint8(p + 2) | (v.getUint8(p + 1) << 8) | (v.getInt8(p) << 16); x = a / 8388608; }
    else x = v.getInt32(p, le) / 2147483648;
    out[c][i] = x;
  }
  return { rate, channels: out };
}
function ext80(v, p) { const e = v.getUint16(p, false) & 0x7fff, hi = v.getUint32(p + 2, false), lo = v.getUint32(p + 6, false); return e === 0 && hi === 0 ? 0 : hi * 2 ** (e - 16383 - 31) + lo * 2 ** (e - 16383 - 63); }
const s16 = (x) => { const y = Math.max(-1, Math.min(1, x)); return Math.round(y < 0 ? y * 32768 : y * 32767); };

/** samples -> a 16-bit PCM WAV file. Pure. */
export function wav(channels, rate) {
  const c = channels.length, n = c ? channels[0].length : 0, size = n * c * 2, b = new Uint8Array(44 + size), v = new DataView(b.buffer);
  b.set(te.encode('RIFF'), 0); v.setUint32(4, 36 + size, true); b.set(te.encode('WAVEfmt '), 8); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, c, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * c * 2, true); v.setUint16(32, c * 2, true); v.setUint16(34, 16, true); b.set(te.encode('data'), 36); v.setUint32(40, size, true);
  let p = 44; for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) { v.setInt16(p, s16(channels[k][i]), true); p += 2; }
  return b;
}
/** samples -> a 16-bit PCM AIFF file (big-endian, the sample rate as an 80-bit float). Pure. */
export function aiff(channels, rate) {
  const c = channels.length, n = c ? channels[0].length : 0, size = n * c * 2, b = new Uint8Array(54 + size), v = new DataView(b.buffer);
  b.set(te.encode('FORM'), 0); v.setUint32(4, 46 + size, false); b.set(te.encode('AIFFCOMM'), 8); v.setUint32(16, 18, false); v.setUint16(20, c, false); v.setUint32(22, n, false); v.setUint16(26, 16, false);
  const r = Math.round(rate), ex = r > 0 ? Math.floor(Math.log2(r)) : 0; v.setUint16(28, r > 0 ? 16383 + ex : 0, false); v.setUint32(30, r > 0 ? r * 2 ** (31 - ex) : 0, false); v.setUint32(34, 0, false);
  b.set(te.encode('SSND'), 38); v.setUint32(42, 8 + size, false); v.setUint32(46, 0, false); v.setUint32(50, 0, false);
  let p = 54; for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) { v.setInt16(p, s16(channels[k][i]), false); p += 2; }
  return b;
}

// ---- sound edits: { rate, channels } in, { rate, channels, notes } out. Pure. --------------------------------------------------------------
const sound = (rate, channels, notes = []) => ({ rate, channels, notes });
export const seconds = (s) => (s.channels[0] ? s.channels[0].length / s.rate : 0);
/** the part from one second to another */
export function cut(s, from, to) {
  const n = s.channels[0].length, a = Math.max(0, Math.min(n, Math.round(+from * s.rate))), z = Math.max(a, Math.min(n, Math.round((to === '' || to == null || !isFinite(+to) ? n / s.rate : +to) * s.rate)));
  return sound(s.rate, s.channels.map((c) => c.slice(a, z)), ['kept ' + (a / s.rate).toFixed(2) + ' s to ' + (z / s.rate).toFixed(2) + ' s (' + ((z - a) / s.rate).toFixed(2) + ' s)']);
}
/** one rate to another, by straight lines between samples */
export function resample(s, rate) {
  if (rate === s.rate) return s;
  const n = s.channels[0].length, m = Math.max(1, Math.round(n * rate / s.rate)), k = s.rate / rate;
  return sound(rate, s.channels.map((c) => { const o = new Float32Array(m); for (let i = 0; i < m; i++) { const x = i * k, j = Math.floor(x), f = x - j; o[i] = j + 1 < n ? c[j] * (1 - f) + c[j + 1] * f : c[Math.min(n - 1, j)]; } return o; }), s.notes);
}
/** played faster (factor > 1) or slower, as a tape: the pitch moves too */
export function speed(s, factor) {
  const f = Math.max(0.25, Math.min(4, +factor || 1)), r = resample({ rate: s.rate * f, channels: s.channels }, s.rate);
  return sound(s.rate, r.channels, [(f === 1 ? 'the same speed' : f + ' times as fast') + ': ' + seconds(s).toFixed(2) + ' s becomes ' + seconds(r).toFixed(2) + ' s']);
}
/** louder or quieter by dB, with a count of the samples that hit the top and were clipped */
export function gain(s, db) {
  const g = 10 ** ((+db || 0) / 20); let clipped = 0;
  const ch = s.channels.map((c) => { const o = new Float32Array(c.length); for (let i = 0; i < c.length; i++) { let y = c[i] * g; if (y > 1) { y = 1; clipped++; } else if (y < -1) { y = -1; clipped++; } o[i] = y; } return o; });
  return sound(s.rate, ch, [(db >= 0 ? '+' : '') + (+db || 0) + ' dB (' + g.toFixed(3) + ' times the level)', clipped ? clipped + ' samples clipped: try fewer dB' : 'no sample clipped']);
}
/** a fade in and a fade out, in seconds, on a straight line */
export function fade(s, inS = 0, outS = 0) {
  const n = s.channels[0].length, a = Math.min(n, Math.round(inS * s.rate)), z = Math.min(n, Math.round(outS * s.rate));
  return sound(s.rate, s.channels.map((c) => { const o = c.slice(); for (let i = 0; i < a; i++) o[i] *= i / a; for (let i = 0; i < z; i++) o[n - 1 - i] *= i / z; return o; }), s.notes);
}
/** every quiet stretch (the loudest sample under thresholdDb) longer than minMs taken out, keeping keepMs of it so the joins are not hard */
export function removeSilence(s, thresholdDb = -45, minMs = 400, keepMs = 120) {
  const n = s.channels[0].length, win = Math.max(1, Math.round(s.rate / 100)), lim = 10 ** (thresholdDb / 20), quiet = [];
  for (let i = 0; i < n; i += win) { let peak = 0; for (const c of s.channels) for (let j = i; j < Math.min(n, i + win); j++) { const a = Math.abs(c[j]); if (a > peak) peak = a; } quiet.push(peak < lim); }
  const keep = new Uint8Array(n).fill(1), minW = Math.ceil(minMs / 10), keepW = Math.floor(keepMs / 10); let cut = 0, runs = 0;
  for (let w = 0; w < quiet.length;) {
    if (!quiet[w]) { w++; continue; }
    let e = w; while (e < quiet.length && quiet[e]) e++;
    if (e - w >= minW) { const a = (w + keepW) * win, z = Math.min(n, (e - keepW) * win); if (z > a) { keep.fill(0, a, z); cut += z - a; runs++; } }
    w = e;
  }
  const m = n - cut;
  return sound(s.rate, s.channels.map((c) => { const o = new Float32Array(m); let k = 0; for (let i = 0; i < n; i++) if (keep[i]) o[k++] = c[i]; return o; }), [runs ? runs + ' quiet stretch' + (runs === 1 ? '' : 'es') + ' taken out: ' + (cut / s.rate).toFixed(2) + ' s shorter' : 'no quiet stretch as long as ' + minMs + ' ms under ' + thresholdDb + ' dB']);
}
// sounds made the same: the first one's rate, the most channels any of them has (mono copied to every channel)
function alike(list) {
  const rate = list[0].rate, ch = Math.max(...list.map((s) => s.channels.length));
  return list.map((s) => { const r = resample(s, rate); return Array.from({ length: ch }, (_, k) => r.channels[Math.min(k, r.channels.length - 1)]); }).map((channels) => ({ rate, channels }));
}
/** one after another, with a crossfade of xS seconds between each (0: straight on) */
export function merge(list, xS = 0) {
  if (!list.length) throw new Error('no sound to join');
  const all = alike(list), rate = all[0].rate, ch = all[0].channels.length, x = Math.round(Math.max(0, +xS || 0) * rate);
  const lens = all.map((s) => s.channels[0].length), total = lens.reduce((a, l, i) => a + l - (i ? Math.min(x, l, lens[i - 1]) : 0), 0);
  const out = Array.from({ length: ch }, () => new Float32Array(total)); let at = 0;
  all.forEach((s, i) => {
    const l = lens[i], ov = i ? Math.min(x, l, lens[i - 1]) : 0; at -= ov;
    for (let k = 0; k < ch; k++) { const o = out[k], c = s.channels[k]; for (let j = 0; j < l; j++) { if (j < ov) { const t = (j + 0.5) / ov; o[at + j] = o[at + j] * (1 - t) + c[j] * t; } else o[at + j] = c[j]; } }
    at += l;
  });
  return sound(rate, out, [list.length + ' sounds joined' + (x ? ' with a ' + (+xS) + ' s crossfade' : '') + ': ' + (total / rate).toFixed(2) + ' s']);
}
/** at the same time; turned down to just under the top if the sum would clip, and said so */
export function mix(list) {
  if (!list.length) throw new Error('no sound to mix');
  const all = alike(list), rate = all[0].rate, ch = all[0].channels.length, n = Math.max(...all.map((s) => s.channels[0].length));
  const out = Array.from({ length: ch }, () => new Float32Array(n)); let peak = 0;
  for (const s of all) for (let k = 0; k < ch; k++) { const c = s.channels[k], o = out[k]; for (let j = 0; j < c.length; j++) o[j] += c[j]; }
  for (const o of out) for (let j = 0; j < n; j++) peak = Math.max(peak, Math.abs(o[j]));
  const g = peak > 0.98 ? 0.98 / peak : 1; if (g < 1) for (const o of out) for (let j = 0; j < n; j++) o[j] *= g;
  return sound(rate, out, [list.length + ' sounds mixed: ' + (n / rate).toFixed(2) + ' s', g < 1 ? 'turned down ' + (20 * Math.log10(g)).toFixed(1) + ' dB so it does not clip' : 'no change of level needed']);
}

// ---- pictures: RGBA pixels { width, height, data } -> BMP, TIFF, GIF. Pure. ----------------------------------------------------------------
/** 24-bit BMP; see-through pixels are put on white */
export function bmp(img) {
  const { width: w, height: h, data: d } = img, row = (w * 3 + 3) & ~3, size = 54 + row * h, b = new Uint8Array(size), v = new DataView(b.buffer);
  b[0] = 0x42; b[1] = 0x4d; v.setUint32(2, size, true); v.setUint32(10, 54, true); v.setUint32(14, 40, true); v.setInt32(18, w, true); v.setInt32(22, h, true);
  v.setUint16(26, 1, true); v.setUint16(28, 24, true); v.setUint32(34, row * h, true); v.setInt32(38, 2835, true); v.setInt32(42, 2835, true);
  for (let y = 0; y < h; y++) { let p = 54 + (h - 1 - y) * row; for (let x = 0; x < w; x++) { const q = (y * w + x) * 4, a = d[q + 3] / 255; b[p++] = Math.round(d[q + 2] * a + 255 * (1 - a)); b[p++] = Math.round(d[q + 1] * a + 255 * (1 - a)); b[p++] = Math.round(d[q] * a + 255 * (1 - a)); } }
  return b;
}
/** uncompressed 8-bit TIFF, one strip; RGB, or RGBA (unassociated alpha) when any pixel is see-through */
export function tiff(img) {
  const { width: w, height: h, data: d } = img; let alpha = false; for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) { alpha = true; break; }
  const spp = alpha ? 4 : 3, tags = 11 + (alpha ? 1 : 0), ifd = 8, extra = ifd + 2 + tags * 12 + 4, bpsAt = extra, resAt = bpsAt + spp * 2, pix = resAt + 16, size = pix + w * h * spp;
  const b = new Uint8Array(size), v = new DataView(b.buffer); b.set([0x49, 0x49, 42, 0]); v.setUint32(4, ifd, true); v.setUint16(ifd, tags, true);
  let t = ifd + 2; const tag = (id, type, count, value) => { v.setUint16(t, id, true); v.setUint16(t + 2, type, true); v.setUint32(t + 4, count, true); if (type === 3 && count === 1) v.setUint16(t + 8, value, true); else v.setUint32(t + 8, value, true); t += 12; };
  tag(256, 4, 1, w); tag(257, 4, 1, h); tag(258, 3, spp, bpsAt); tag(259, 3, 1, 1); tag(262, 3, 1, 2); tag(273, 4, 1, pix); tag(277, 3, 1, spp); tag(278, 4, 1, h); tag(279, 4, 1, w * h * spp);
  tag(282, 5, 1, resAt); tag(283, 5, 1, resAt + 8); if (alpha) tag(338, 3, 1, 2); v.setUint32(t, 0, true);
  for (let i = 0; i < spp; i++) v.setUint16(bpsAt + i * 2, 8, true); v.setUint32(resAt, 72, true); v.setUint32(resAt + 4, 1, true); v.setUint32(resAt + 8, 72, true); v.setUint32(resAt + 12, 1, true);
  if (alpha) b.set(d, pix); else for (let i = 0, p = pix; i < w * h; i++) { b[p++] = d[i * 4]; b[p++] = d[i * 4 + 1]; b[p++] = d[i * 4 + 2]; }
  return b;
}
// the GIF palette: 6 levels of red, 7 of green, 6 of blue (252 colours), 3 greys, and index 255 for see-through
const RL = [0, 51, 102, 153, 204, 255], GL = [0, 42, 85, 128, 170, 213, 255], BL = RL;
const near = (L, x) => { let k = 0; for (let i = 1; i < L.length; i++) if (Math.abs(L[i] - x) < Math.abs(L[k] - x)) k = i; return k; };
export const GIF_PALETTE = (() => { const p = new Uint8Array(768); let i = 0; for (const r of RL) for (const g of GL) for (const b of BL) { p[i * 3] = r; p[i * 3 + 1] = g; p[i * 3 + 2] = b; i++; } for (const y of [64, 128, 192]) { p[i * 3] = p[i * 3 + 1] = p[i * 3 + 2] = y; i++; } return p; })();
/** pixels -> palette indexes, with Floyd-Steinberg error diffusion so a gradient stays smooth */
export function quantize(img) {
  const { width: w, height: h, data: d } = img, idx = new Uint8Array(w * h), err = new Float32Array(w * h * 3); let clear = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (d[i * 4 + 3] < 128) { idx[i] = 255; clear = true; continue; }
    const c = [0, 1, 2].map((k) => Math.max(0, Math.min(255, d[i * 4 + k] + err[i * 3 + k]))), r = near(RL, c[0]), g = near(GL, c[1]), b = near(BL, c[2]);
    idx[i] = r * 42 + g * 6 + b; const e = [c[0] - RL[r], c[1] - GL[g], c[2] - BL[b]];
    const push = (dx, dy, f) => { const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= w || yy >= h) return; const j = (yy * w + xx) * 3; for (let k = 0; k < 3; k++) err[j + k] += e[k] * f; };
    push(1, 0, 7 / 16); push(-1, 1, 3 / 16); push(0, 1, 5 / 16); push(1, 1, 1 / 16);
  }
  return { idx, clear };
}
/** the LZW codes of a GIF image (min code size 8), packed in 255-byte blocks */
export function lzw(idx) {
  const out = []; let cur = 0, bits = 0, size = 9, next = 258; const dict = new Map();
  const emit = (code) => { cur |= code << bits; bits += size; while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; } };
  emit(256); if (!idx.length) { emit(257); if (bits) out.push(cur & 255); return blocks(out); }
  let prefix = idx[0];
  for (let i = 1; i < idx.length; i++) {
    const k = idx[i], key = prefix * 256 + k, hit = dict.get(key);
    if (hit !== undefined) { prefix = hit; continue; }
    emit(prefix);
    if (next < 4096) { if (next >= 1 << size) size++; dict.set(key, next++); } else { emit(256); dict.clear(); next = 258; size = 9; }
    prefix = k;
  }
  emit(prefix); emit(257); if (bits) out.push(cur & 255);
  return blocks(out);
}
function blocks(bytes) { const o = []; for (let i = 0; i < bytes.length; i += 255) { const part = bytes.slice(i, i + 255); o.push(part.length, ...part); } o.push(0); return o; }
/** a still GIF89a: the 256-colour palette above, see-through kept */
export function gif(img) {
  const { width: w, height: h } = img, { idx, clear } = quantize(img), head = [...te.encode('GIF89a'), w & 255, w >> 8, h & 255, h >> 8, 0xf7, 0, 0];
  const gce = clear ? [0x21, 0xf9, 4, 1, 0, 0, 255, 0] : [], desc = [0x2c, 0, 0, 0, 0, w & 255, w >> 8, h & 255, h >> 8, 0, 8], data = lzw(idx);
  const b = new Uint8Array(head.length + 768 + gce.length + desc.length + data.length + 1); let p = 0;
  for (const part of [head, GIF_PALETTE, gce, desc, data, [0x3b]]) { b.set(part, p); p += part.length; }
  return b;
}
/** an animated GIF shown factor times as fast: every frame's delay divided, the pictures untouched. A delay of 0 counts as 10 (browsers do). */
export function gifSpeed(bytes, factor) {
  const b = (bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).slice(), f = Math.max(0.1, Math.min(10, +factor || 1));
  if (ascii(b, 0, 4) !== 'GIF8') throw new Error('not a GIF file');
  let p = 13; if (b[10] & 0x80) p += 3 * (2 << (b[10] & 7));
  const skipBlocks = () => { while (p < b.length && b[p]) p += b[p] + 1; p++; };
  let frames = 0, before = 0, after = 0;
  while (p < b.length) {
    const t = b[p];
    if (t === 0x3b) break;
    if (t === 0x21) { if (b[p + 1] === 0xf9 && b[p + 2] === 4) { const d0 = b[p + 4] | (b[p + 5] << 8), d = d0 || 10, nd = Math.max(2, Math.min(65535, Math.round(d / f))); before += d; after += nd; b[p + 4] = nd & 255; b[p + 5] = nd >> 8; } p += 2; skipBlocks(); continue; }
    if (t === 0x2c) { frames++; const flags = b[p + 9]; p += 10; if (flags & 0x80) p += 3 * (2 << (flags & 7)); p++; skipBlocks(); continue; }
    throw new Error('a broken GIF file (an unknown block at byte ' + p + ')');
  }
  return { bytes: b, frames, notes: [frames + ' frame' + (frames === 1 ? '' : 's') + (before ? ', ' + (before / 100).toFixed(2) + ' s a loop becomes ' + (after / 100).toFixed(2) + ' s' : ', no frame delay to change: a still GIF')] };
}

// ---- words: every text format in, as { title, paras } -------------------------------------------------------------------------------------
// Built from the code point so that no tool rewrites the dash characters in this file.
const EM = String.fromCharCode(0x2014);
const ENTITY = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", copy: '©', reg: '®', hellip: '…', mdash: EM, ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', middot: '·', eacute: 'é', egrave: 'è', aacute: 'á', agrave: 'à', ouml: 'ö', uuml: 'ü', auml: 'ä', szlig: 'ß', ccedil: 'ç', ntilde: 'ñ', euro: '€', pound: '£', deg: '°', times: '×', shy: '' };
const entities = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => { if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; } const k = ENTITY[e.toLowerCase()]; return k === undefined ? m : k; });
const tidy = (t) => t.replace(/[ \t\r\f\v ]+/g, ' ').replace(/ ?\n ?/g, '\n').trim();
/** plain text -> paragraphs (a blank line ends one; a text with no blank line has a paragraph a line) */
export function textParas(text) {
  const t = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const parts = /\n[ \t]*\n/.test(t) ? t.split(/\n[ \t]*\n+/) : t.split('\n');
  return parts.map((p) => tidy(p)).filter(Boolean);
}
/** HTML -> { title, paras }: the words of every block, scripts and styles left out */
export function htmlParas(html) {
  const h = String(html || ''), title = entities(((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/<[^>]+>/g, '')).trim();
  const body = (h.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, h])[1]
    .replace(/<(script|style|head|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(p|div|h[1-6]|li|ul|ol|tr|table|blockquote|section|article|header|footer|main|nav|aside|pre|figure|figcaption|dt|dd|dl|hr)\b[^>]*>/gi, '\n\n')
    .replace(/<\/?(td|th)\b[^>]*>/gi, '\t').replace(/<[^>]+>/g, '');
  return { title, paras: entities(body).split(/\n\s*\n+/).map(tidy).filter(Boolean) };
}
// Windows-1252 for bytes 0x80 to 0x9f (the rest is Latin-1)
const CP1252 = String.fromCharCode(0x20ac, 0x81, 0x201a, 0x192, 0x201e, 0x2026, 0x2020, 0x2021, 0x2c6, 0x2030, 0x160, 0x2039, 0x152, 0x8d, 0x17d, 0x8f, 0x90, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2dc, 0x2122, 0x161, 0x203a, 0x153, 0x9d, 0x17e, 0x178);
const cp = (n) => (n >= 0x80 && n < 0xa0 ? CP1252[n - 0x80] : String.fromCharCode(n));
const RTF_SKIP = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'header', 'footer', 'headerl', 'headerr', 'footerl', 'footerr', 'footnote', 'themedata', 'colorschememapping', 'datastore', 'latentstyles', 'listtable', 'listoverridetable', 'rsidtbl', 'generator', 'xmlnstbl', 'mmathPr', 'filetbl', 'revtbl', 'pgdsctbl', 'listtext', 'fldinst', 'bkmkstart', 'bkmkend']);
const RTF_CHAR = { par: '\n\n', line: '\n', tab: '\t', emdash: EM, endash: '–', lquote: '‘', rquote: '’', ldblquote: '“', rdblquote: '”', bullet: '•', emspace: ' ', enspace: ' ', sect: '\n\n', page: '\n\n', cell: '\t', row: '\n' };
/** RTF -> { title, paras }: the text of the document, its tables of fonts, colours, styles and pictures left out */
export function rtfParas(rtf) {
  const s = String(rtf || ''); let i = 0, out = '', st = { skip: false, uc: 1 }, skipN = 0; const stack = [];
  const put = (t) => { if (st.skip) return; if (skipN > 0) { skipN--; return; } out += t; };
  while (i < s.length) {
    const c = s[i];
    if (c === '{') { stack.push(st); st = { ...st }; i++; if (s.startsWith('\\*', i)) { st.skip = true; i += 2; } continue; }
    if (c === '}') { st = stack.pop() || st; i++; continue; }
    if (c === '\r' || c === '\n') { i++; continue; }
    if (c !== '\\') { put(c); i++; continue; }
    const d = s[i + 1];
    if (/[a-z]/i.test(d || '')) {
      const m = /^([a-z]+)(-?\d+)? ?/i.exec(s.slice(i + 1, i + 40)); i += 1 + m[0].length; const w = m[1], n = m[2] === undefined ? null : +m[2];
      if (RTF_SKIP.has(w)) { st.skip = true; continue; }
      if (w === 'uc') { st.uc = n == null ? 1 : n; continue; }
      if (w === 'u' && n != null) { if (!st.skip) { out += String.fromCharCode(n < 0 ? n + 65536 : n); skipN = st.uc; } continue; }
      if (RTF_CHAR[w] !== undefined) { if (!st.skip) out += RTF_CHAR[w]; skipN = 0; }
      continue;
    }
    if (d === "'") { put(cp(parseInt(s.substr(i + 2, 2), 16))); i += 4; continue; }
    if (d === '~') { put(' '); i += 2; continue; }
    if (d === '_') { put('-'); i += 2; continue; }
    if (d === '-' || d === '*') { i += 2; continue; }
    if (d === '\n' || d === '\r') { if (!st.skip) out += '\n\n'; i += 2; continue; }
    put(d || ''); i += 2;
  }
  return { title: '', paras: out.split(/\n\s*\n+/).map(tidy).filter(Boolean) };
}
/** a DOCX file -> { title, paras } (the document's own paragraphs, in order) */
export async function docxParas(bytes) {
  const files = await unzip(bytes), doc = files.find((f) => f.name === 'word/document.xml'); if (!doc) throw new Error('no Word document inside the file');
  const core = files.find((f) => f.name === 'docProps/core.xml'), title = core ? unxml((new TextDecoder().decode(core.data).match(/<dc:title>([\s\S]*?)<\/dc:title>/) || [])[1] || '').trim() : '';
  return { title, paras: paragraphsOf(new TextDecoder().decode(doc.data), OFFICE.docx[0]).map((p) => tidy(p.text)).filter(Boolean) };
}
/** an EPUB file -> { title, paras } (the chapters in reading order, from the spine) */
export async function epubParas(bytes) {
  const files = await unzip(bytes), get = (n) => files.find((f) => f.name === n), text = (f) => new TextDecoder().decode(f.data);
  const cont = get('META-INF/container.xml'); if (!cont) throw new Error('not an EPUB file (no META-INF/container.xml)');
  const opfPath = (text(cont).match(/full-path="([^"]+)"/) || [])[1], opfF = opfPath && get(opfPath); if (!opfF) throw new Error('the EPUB has no package file');
  const opf = text(opfF), base = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '', items = {};
  for (const m of opf.matchAll(/<item\b([^>]*)>/g)) { const id = (m[1].match(/\bid="([^"]+)"/) || [])[1], href = (m[1].match(/\bhref="([^"]+)"/) || [])[1]; if (id && href) items[id] = href; }
  const order = [...opf.matchAll(/<itemref\b[^>]*\bidref="([^"]+)"/g)].map((m) => items[m[1]]).filter(Boolean), paras = [];
  for (const href of order) { const f = get(base + decodeURIComponent(href.split('#')[0])); if (f) paras.push(...htmlParas(text(f)).paras); }
  return { title: unxml((opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/) || [])[1] || '').trim(), paras };
}
/** a PDF's words, page by page, read with pdf.js (the module passed in) -> { title, paras } */
export async function pdfParas(pdfjs, bytes) {
  const doc = await pdfjs.getDocument({ data: (bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).slice() }).promise, paras = []; let title = '';
  try { title = ((await doc.getMetadata()).info || {}).Title || ''; } catch (_) {}
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n); let out = '', y = null;
    for (const it of (await page.getTextContent()).items) { if (typeof it.str !== 'string') continue; const iy = it.transform ? it.transform[5] : null; if (y != null && iy != null && Math.abs(iy - y) > 2 && !out.endsWith('\n')) out += '\n'; out += it.str + (it.hasEOL ? '\n' : ''); if (iy != null) y = iy; }
    paras.push(...pdfParagraphs(out));
  }
  return { title: String(title).trim(), paras, pages: doc.numPages };
}

// ---- words out --------------------------------------------------------------------------------------------------------------------------
export const txtOf = (doc) => te.encode((doc.title ? doc.title + '\n\n' : '') + doc.paras.join('\n\n') + '\n');
export function htmlOf(doc) {
  const t = xml(doc.title || 'Converted with Verse');
  return te.encode('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>' + t + '</title>\n<style>body{max-width:42em;margin:2em auto;padding:0 1em;font:17px/1.6 Georgia,serif}</style>\n</head>\n<body>\n' + (doc.title ? '<h1>' + t + '</h1>\n' : '') + doc.paras.map((p) => '<p>' + xml(p).replace(/\n/g, '<br>') + '</p>').join('\n') + '\n</body>\n</html>\n');
}
const rtfEsc = (s) => [...s].map((ch) => { const n = ch.codePointAt(0); if (ch === '\\' || ch === '{' || ch === '}') return '\\' + ch; if (ch === '\n') return '\\line '; if (ch === '\t') return '\\tab '; if (n < 128) return ch; if (n > 0xffff) { const u = String.fromCodePoint(n); return [0, 1].map((k) => '\\u' + ((u.charCodeAt(k) << 16) >> 16) + '?').join(''); } return '\\u' + ((n << 16) >> 16) + '?'; }).join('');
export const rtfOf = (doc) => te.encode('{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1{\\fonttbl{\\f0\\froman Times New Roman;}}\\f0\\fs24\n' + (doc.title ? '{\\b\\fs32 ' + rtfEsc(doc.title) + '}\\par\\par\n' : '') + doc.paras.map((p) => rtfEsc(p) + '\\par\\par\n').join('') + '}');
export const docxBytesOf = (doc) => docxOf([doc.title ? [doc.title, ...doc.paras] : doc.paras]);
/** an EPUB 3 book (with an EPUB 2 table of contents too, for old readers): one chapter, the paragraphs in order. `id` makes the book's identity. */
export function epubOf(doc, now = new Date()) {
  const title = xml(doc.title || 'Converted with Verse'), id = 'urn:verse:' + crcHex(doc.paras.join('\n')), when = now.toISOString().replace(/\.\d+Z$/, 'Z');
  const chapter = '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">\n<head><title>' + title + '</title></head>\n<body>\n<h1>' + title + '</h1>\n' + doc.paras.map((p) => '<p>' + xml(p).replace(/\n/g, '<br/>') + '</p>').join('\n') + '\n</body>\n</html>\n';
  const opf = '<?xml version="1.0" encoding="utf-8"?>\n<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">\n<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n<dc:identifier id="id">' + id + '</dc:identifier>\n<dc:title>' + title + '</dc:title>\n<dc:language>en</dc:language>\n<meta property="dcterms:modified">' + when + '</meta>\n</metadata>\n<manifest>\n<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>\n<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>\n<item id="text" href="text.xhtml" media-type="application/xhtml+xml"/>\n</manifest>\n<spine toc="ncx">\n<itemref idref="text"/>\n</spine>\n</package>\n';
  const nav = '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">\n<head><title>' + title + '</title></head>\n<body><nav epub:type="toc"><ol><li><a href="text.xhtml">' + title + '</a></li></ol></nav></body>\n</html>\n';
  const ncx = '<?xml version="1.0" encoding="utf-8"?>\n<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">\n<head><meta name="dtb:uid" content="' + id + '"/></head>\n<docTitle><text>' + title + '</text></docTitle>\n<navMap><navPoint id="p1" playOrder="1"><navLabel><text>' + title + '</text></navLabel><content src="text.xhtml"/></navPoint></navMap>\n</ncx>\n';
  const container = '<?xml version="1.0" encoding="utf-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>\n</container>\n';
  return storeZip([['mimetype', 'application/epub+zip'], ['META-INF/container.xml', container], ['OEBPS/content.opf', opf], ['OEBPS/nav.xhtml', nav], ['OEBPS/toc.ncx', ncx], ['OEBPS/text.xhtml', chapter]].map(([name, s]) => ({ name, bytes: te.encode(s) })));
}
function crcHex(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
// the characters the PDF standard fonts can draw (Windows-1252); any other becomes ? and is counted
const WINANSI = new Set([...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)), ...Array.from({ length: 96 }, (_, i) => String.fromCharCode(160 + i)), ...CP1252.split('').filter((c) => c.charCodeAt(0) > 0x9f)]);
export function winAnsi(s) { let lost = 0; const t = [...String(s)].map((c) => (c === '\t' ? '    ' : WINANSI.has(c) ? c : (lost++, '?'))).join(''); return { text: t, lost }; }
/** a plain A4 PDF of the words, with pdf-lib (the namespace passed in): the title in bold, then the paragraphs, wrapped to the page */
export async function pdfOf(L, doc) {
  const pdf = await L.PDFDocument.create(), font = await pdf.embedFont(L.StandardFonts.TimesRoman), bold = await pdf.embedFont(L.StandardFonts.TimesRomanBold);
  const W = 595.28, H = 841.89, M = 64, size = 12, lead = 16.5; let page = null, y = 0, lost = 0;
  const newPage = () => { page = pdf.addPage([W, H]); y = H - M; };
  const lines = (t, f, s) => { const out = []; for (const part of t.split('\n')) { let line = ''; for (const word of part.split(/ +/)) { const tryL = line ? line + ' ' + word : word; if (f.widthOfTextAtSize(tryL, s) <= W - 2 * M || !line) line = tryL; else { out.push(line); line = word; } } out.push(line); } return out; };
  const draw = (t, f, s, gap) => { const w = winAnsi(t); lost += w.lost; for (const l of lines(w.text, f, s)) { if (!page || y < M + s) newPage(); page.drawText(l, { x: M, y: y - s, size: s, font: f }); y -= s * lead / size; } y -= gap; };
  newPage(); if (doc.title) draw(doc.title, bold, 18, 10); for (const p of doc.paras) draw(p, font, size, 7);
  pdf.setTitle(doc.title || 'Converted with Verse'); pdf.setProducer('Verse (a-to-mind.com/converter/)'); pdf.setCreator('Verse');
  return { bytes: await pdf.save(), pages: pdf.getPageCount(), lost };
}

// ---- names ------------------------------------------------------------------------------------------------------------------------------
/** a download name: the file's own name with the new ending, unique among `taken` */
export function outName(name, ext, taken = new Set()) {
  const base = String(name || 'file').replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').slice(0, 120) || 'file';
  let n = base + '.' + ext, k = 2; while (taken.has(n)) n = base + ' (' + k++ + ').' + ext; taken.add(n); return n;
}
export const MIME = Object.freeze({ mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', wav: 'audio/wav', aiff: 'audio/aiff', flac: 'audio/flac', ogg: 'audio/ogg', opus: 'audio/ogg', mp3: 'audio/mpeg', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', tiff: 'image/tiff', pdf: 'application/pdf', txt: 'text/plain;charset=utf-8', html: 'text/html;charset=utf-8', rtf: 'application/rtf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', epub: 'application/epub+zip', zip: 'application/zip' });
