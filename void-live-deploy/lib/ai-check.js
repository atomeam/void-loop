// Is this photo or video AI-made or edited? What the file says about itself (built from what Verse watched: WFTV, ABC, 2026-10-30, "a tool to
// help law enforcement verify if video evidence has been synthetically altered"; tools/watch-build.mjs, domains/tv-built/). It reads the
// provenance a file carries: Content Credentials (C2PA), the IPTC "digital source type" that generators and editors write, a generator's
// own fields (Stable Diffusion's parameters, ComfyUI's workflow), the software that last saved it, and the camera that made it. It does not
// judge pixels, and says so: metadata can be stripped or faked, so "no signs" is never proof. Runs on the device; nothing is uploaded. Pure.
import { readMeta } from './photo-edit.js';

// generators and the words they leave behind (claim generators, Software tags, PNG text keys)
export const GENERATORS = [
  ['Adobe Firefly', /adobe firefly|firefly/i], ['OpenAI (DALL·E, ChatGPT, Sora)', /dall[·\-\s]?e|openai|chatgpt|\bsora\b/i], ['Midjourney', /midjourney/i],
  ['Stable Diffusion', /stable[\s_-]?diffusion|automatic1111|sd[_-]?xl|sdxl/i], ['ComfyUI', /comfyui/i], ['Google (Imagen, Gemini, Veo, SynthID)', /\bimagen\b|\bgemini\b|google veo|\bveo ?\d|synthid/i],
  ['Microsoft Designer / Bing Image Creator', /microsoft designer|bing image creator/i], ['Runway', /runwayml|runway gen/i], ['Pika', /pika labs|pika\.art/i],
  ['Kling', /\bkling ?(ai|\d)/i], ['Leonardo.Ai', /leonardo\.ai/i], ['Ideogram', /ideogram/i], ['NovelAI', /novelai/i], ['Flux', /black forest labs|flux\.1/i],
  ['InvokeAI', /invokeai|sd-metadata/i], ['Meta AI', /imagine with meta|meta ai/i], ['Grok / Aurora', /\bgrok\b|xai aurora/i],
];
// editors and encoders: the file was opened and saved again after it was made
export const EDITORS = [
  ['Adobe Photoshop', /photoshop/i], ['Adobe Lightroom', /lightroom/i], ['GIMP', /\bgimp\b/i], ['Snapseed', /snapseed/i], ['Picsart', /picsart/i], ['Canva', /\bcanva\b/i],
  ['Affinity Photo', /affinity/i], ['Pixelmator', /pixelmator/i], ['FaceApp', /faceapp/i], ['Facetune', /facetune/i], ['CapCut', /capcut/i],
  ['Adobe Premiere', /premiere pro/i], ['After Effects', /after effects/i], ['DaVinci Resolve', /davinci/i], ['Final Cut', /final cut/i], ['iMovie', /imovie/i],
  ['FFmpeg (re-encoded)', /\blavf\d|\blavc\d|ffmpeg/i], ['HandBrake', /handbrake/i],
];

const latin = (b, a, z) => { let s = ''; for (let i = a; i < z; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, Math.min(z, i + 32768))); return s; };
/** the text a scan reads: the file's metadata only, never its picture or sound data (random bytes there would spell a generator's name by
 *  chance). JPEG: the segments before the image data; PNG: every chunk but IDAT; WebP: every chunk but the picture; MP4/MOV/HEIC: every box
 *  but mdat; anything else: the first and last 256 KB. As latin1. Pure. */
export function textOf(bytes, kind = kindOf(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []))) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []), parts = [], n = b.length;
  const u32 = (i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  if (kind === 'jpeg') {
    let i = 2; while (i + 4 <= n && b[i] === 0xff) { const m = b[i + 1]; if (m === 0xff) { i++; continue; } if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; }
      if (m === 0xda || m === 0xd9) break; const len = (b[i + 2] << 8) | b[i + 3]; if (len < 2) break; parts.push(latin(b, i + 4, Math.min(n, i + 2 + len))); i += 2 + len; }
  } else if (kind === 'png') {
    let i = 8; while (i + 12 <= n) { const len = u32(i), type = latin(b, i + 4, i + 8); if (type !== 'IDAT') parts.push(type + '\n' + latin(b, i + 8, Math.min(n, i + 8 + len))); if (type === 'IEND') break; i += 12 + len; }
  } else if (kind === 'webp') {
    let i = 12; while (i + 8 <= n) { const type = latin(b, i, i + 4), len = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24); if (!/^(VP8 |VP8L|ALPH|ANMF)$/.test(type)) parts.push(latin(b, i + 8, Math.min(n, i + 8 + len))); i += 8 + len + (len & 1); }
  } else if (kind === 'mp4' || kind === 'mov' || kind === 'heic') {
    let i = 0; while (i + 8 <= n) { let len = u32(i); const type = latin(b, i + 4, i + 8); if (len === 1 && i + 16 <= n) len = u32(i + 8) * 4294967296 + u32(i + 12); else if (len === 0) len = n - i;
      if (len < 8) break; if (type !== 'mdat' && type !== 'free' && type !== 'skip') parts.push(latin(b, i, Math.min(n, i + len, i + 8 * 1024 * 1024))); i += len; }
  } else { const e = 256 * 1024; parts.push(n <= 2 * e ? latin(b, 0, n) : latin(b, 0, e) + '\n' + latin(b, n - e, n)); }
  return parts.join('\n');
}

/** what kind of file: jpeg, png, webp, heic, mp4/mov, webm, gif, or ''. Pure. */
export function kindOf(b) {
  const s = String.fromCharCode(...b.subarray(0, 16));
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg'; if (s.startsWith('\x89PNG')) return 'png'; if (s.startsWith('RIFF') && s.slice(8, 12) === 'WEBP') return 'webp';
  if (s.startsWith('GIF8')) return 'gif'; if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm';
  if (s.slice(4, 8) === 'ftyp') return /heic|heix|mif1|avif/.test(s.slice(8, 12)) ? 'heic' : /qt {2}/.test(s.slice(8, 12)) ? 'mov' : 'mp4';
  return '';
}

const near = (t, i, n = 160) => t.slice(Math.max(0, i - 20), i + n).replace(/[^\x20-\x7e]+/g, ' ').replace(/\s+/g, ' ').trim();

const u32s = (t, i) => ((t.charCodeAt(i) << 24) | (t.charCodeAt(i + 1) << 16) | (t.charCodeAt(i + 2) << 8) | t.charCodeAt(i + 3)) >>> 0;
const printable = (s) => String(s || '').replace(/[^\x20-\x7e]+/g, ' ').replace(/\s+/g, ' ').trim();
/** QuickTime metadata keys and their values (com.apple.quicktime.make and the like): { key: value }, from the keys and ilst boxes. Pure. */
export function quicktimeKeys(t) {
  const out = {};
  for (let k = t.indexOf('keys'); k >= 4; k = t.indexOf('keys', k + 4)) {
    const names = [], count = u32s(t, k + 8); let i = k + 12;
    if (count < 1 || count > 64) continue;
    for (let j = 0; j < count && i + 8 <= t.length; j++) { const size = u32s(t, i); if (size < 8 || size > 512 || t.slice(i + 4, i + 8) !== 'mdta') break; names.push(t.slice(i + 8, i + size)); i += size; }
    if (names.length !== count || t.slice(i + 4, i + 8) !== 'ilst') continue;
    const end = i + u32s(t, i); let p = i + 8;
    while (p + 24 <= Math.min(end, t.length)) { const size = u32s(t, p), idx = u32s(t, p + 4); if (size < 24) break;
      if (t.slice(p + 12, p + 16) === 'data' && names[idx - 1] && !out[names[idx - 1]]) out[names[idx - 1]] = printable(t.slice(p + 24, p + size)).slice(0, 80);
      p += size; }
  }
  return out;
}
/** the software a file names as its maker or editor, each { where, value }: XMP CreatorTool, an edit history's softwareAgent, a C2PA
 *  action's softwareAgent or claim generator, a PNG Software text, an MP4 encoder. Pure. */
export function toolsOf(t) {
  const out = [], push = (where, v) => { v = printable(v).slice(0, 100); if (v.length >= 2 && !out.some((o) => o.value === v)) out.push({ where, value: v }); };
  for (const m of t.matchAll(/xmp:CreatorTool(?:="([^"]{2,100})"|>([^<]{2,100})<)/g)) push('XMP creator tool', m[1] || m[2]);
  for (const m of t.matchAll(/stEvt:softwareAgent(?:="([^"]{2,100})"|>([^<]{2,100})<)/g)) push('XMP edit history', m[1] || m[2]);
  for (const m of t.matchAll(/softwareAgent[\x60-\x7f\xa0-\xbf\x78]?([\x20-\x7e]{3,80})/g)) push('Content Credentials action', m[1].replace(/[a-z]?parameters$|[a-z]?when$|[a-z]?digitalSourceType$/, ''));
  for (const m of t.matchAll(/claim_generator[\x60-\x7f\xa0-\xbf\x78]?([\x20-\x7e]{3,80})/g)) push('Content Credentials claim generator', m[1].replace(/[a-z]?(signature|assertions|dc:format|claim_generator_info|title|instanceID)$/i, ''));
  for (const m of t.matchAll(/(?:^|\n|\0)(?:tEXt|iTXt)?Software\0+([\x20-\x7e]{2,100})/g)) push('PNG Software text', m[1]);
  for (const m of t.matchAll(/\u00a9too[\s\S]{0,12}?data[\s\S]{8}([\x20-\x7e]{3,60})/g)) push('Video encoder', m[1]);
  return out;
}

// the generator names distinctive enough to count anywhere in the metadata; the rest only count when a tool field names them
const DISTINCT = /midjourney|dall|stable diffusion|comfyui|firefly|novelai|invokeai|leonardo|ideogram|synthid|bing image|black forest/i;

/** the signs in a file, and what they add up to: { kind, verdict: 'ai'|'ai-edited'|'edited'|'camera'|'unknown', headline, signals: [{ level:
 *  'ai'|'ai-edit'|'edit'|'camera'|'info', label, detail }], tools, meta }. Pure. */
export function checkFile(bytes, name = '') {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const kind = kindOf(b), t = textOf(b, kind), signals = [], tools = toolsOf(t);
  const add = (level, label, detail = '') => { if (!signals.some((s) => s.label === label)) signals.push({ level, label, detail: printable(detail).slice(0, 200) }); };
  // IPTC digital source type: the standard field generators and AI editors write (Google, Adobe, OpenAI and Meta use it)
  if (/compositeWithTrainedAlgorithmicMedia/i.test(t)) add('ai-edit', 'Made partly with AI', 'IPTC digital source type: compositeWithTrainedAlgorithmicMedia');
  else if (/trainedAlgorithmicMedia/i.test(t)) add('ai', 'Made by an AI generator', 'IPTC digital source type: trainedAlgorithmicMedia');
  else if (/digitalsourcetype\/algorithmicMedia/i.test(t)) add('info', 'Made by software, not a camera', 'IPTC digital source type: algorithmicMedia (drawn by a program, not trained AI)');
  if (/digitalsourcetype\/(digitalCapture|negativeFilm|positiveFilm)/i.test(t)) add('camera', 'Declared as captured by a camera', 'IPTC digital source type: ' + /digitalsourcetype\/(\w+)/i.exec(t)[1]);
  // Content Credentials (C2PA): a signed record of who made the file and what changed it
  if (/jumd[\s\S]{0,24}c2pa/.test(t)) add('info', 'Content Credentials (C2PA) inside', 'A signed provenance record. Check its signature at contentcredentials.org/verify.');
  else if (/provenance="[^"]*c2pa/.test(t)) add('edit', 'Content Credentials were removed', 'The file points to a C2PA record that is no longer inside it.');
  if (/c2pa\.(edited|filtered|color_adjustments|cropped|resized|drawing|placed|removed)/.test(t)) add('edit', 'Content Credentials record edits', printable(/c2pa\.(edited|filtered|color_adjustments|cropped|resized|drawing|placed|removed)/.exec(t)[0]));
  const toolText = tools.map((x) => x.value).join('\n');
  for (const [label, re] of GENERATORS) { const m = re.exec(toolText) || (DISTINCT.test(re.source) && re.exec(t)); if (m) add('ai', 'Names an AI generator: ' + label, (tools.find((x) => re.test(x.value)) || {}).value || near(t, m.index)); }
  // Stable Diffusion WebUI writes its settings into a PNG text chunk; ComfyUI writes its graph
  if (/parameters\0[\s\S]{0,4000}?(Steps:\s*\d+|Sampler:|CFG scale:)/.test(t)) add('ai', 'Stable Diffusion settings in the file', 'A "parameters" text chunk with steps, sampler and CFG scale.');
  if (/(prompt|workflow)\0\s*\{[\s\S]{0,400}"(class_type|nodes)"/.test(t)) add('ai', 'ComfyUI workflow in the file', 'A ComfyUI node graph is stored in a text chunk.');
  for (const [label, re] of EDITORS) { const x = tools.find((o) => re.test(o.value)); if (x) add('edit', 'Saved by ' + label, x.where + ': ' + x.value); }
  if (/stEvt:action="(saved|derived|converted)"/i.test(t)) add('edit', 'Edit history recorded', 'XMP history: the file was opened and saved again after it was made.');
  // the camera, from EXIF (photos) or QuickTime keys (phone videos)
  let meta = null;
  if (kind === 'jpeg' || kind === 'png' || kind === 'webp') {
    meta = readMeta(b);
    const get = (l) => (meta.items.find((it) => it.label === l) || {}).value;
    const make = get('Camera make'), model = get('Camera model'), soft = get('Software'), taken = get('Taken');
    if (make || model) add('camera', 'Camera: ' + [make, model].filter(Boolean).join(' ').replace(/^(\w+) \1\b/i, '$1'), taken ? 'Taken ' + taken : '');
    if (meta.has.gps) add('camera', 'GPS position recorded', 'A place is stored, as a phone or camera does.');
    if (soft) {
      const gen = GENERATORS.find(([, re]) => re.test(soft)), ed = EDITORS.find(([, re]) => re.test(soft));
      if (gen) add('ai', 'Names an AI generator: ' + gen[0], 'EXIF Software: ' + soft); else if (ed) add('edit', 'Saved by ' + ed[0], 'EXIF Software: ' + soft);
      else add('info', 'Software: ' + soft, 'The software that wrote the file last (EXIF).');
    }
  } else if (kind === 'mp4' || kind === 'mov' || kind === 'heic') {
    const q = quicktimeKeys(t), make = q['com.apple.quicktime.make'], model = q['com.apple.quicktime.model'];
    if (make || model) add('camera', 'Camera: ' + [make, model].filter(Boolean).join(' '), 'QuickTime keys written by the device that recorded it' + (q['com.apple.quicktime.creationdate'] ? ', ' + q['com.apple.quicktime.creationdate'] : '') + '.');
    if (q['com.apple.quicktime.location.ISO6709']) add('camera', 'GPS position recorded', 'A place is stored, as a phone does.');
    if (q['com.apple.quicktime.software']) add('info', 'Software: ' + q['com.apple.quicktime.software'], 'The device software that recorded it.');
    meta = { keys: Object.keys(q).length };
  }
  const has = (l) => signals.some((s) => s.level === l);
  const verdict = has('ai') ? 'ai' : has('ai-edit') ? 'ai-edited' : has('edit') ? 'edited' : has('camera') ? 'camera' : 'unknown';
  const HEAD = { ai: 'Signs of AI generation', 'ai-edited': 'Signs of AI editing', edited: 'Edited or re-saved after capture', camera: 'Looks camera-original: no signs of AI or editing in its metadata', unknown: signals.length ? 'No sign of AI, editing or a camera: the file does not say who made it' : 'No provenance at all: the metadata was removed or never written' };
  return { name: String(name || '').slice(0, 120), kind: kind || 'unknown', bytes: b.length, verdict, headline: HEAD[verdict], signals, tools, meta };
}

/** a plain-text report of a check, for the download and the clipboard. Pure. */
export function reportOf(r, when = new Date().toISOString()) {
  return ['Verse AI authenticity check · a-to-mind.com/ai-authenticity-checker/', 'File: ' + (r.name || '(unnamed)') + ' (' + r.kind + ', ' + r.bytes + ' bytes)', 'Checked: ' + when, '',
    'Result: ' + r.headline, '', ...(r.signals.length ? r.signals.map((s) => '- [' + s.level + '] ' + s.label + (s.detail ? ': ' + s.detail : '')) : ['- no provenance signals']), '',
    'This reads what the file says about itself (metadata and Content Credentials). It does not judge pixels. Metadata can be stripped or faked, so no signs is not proof.'].join('\n');
}
