// Real genre references for Verse's songs (owner, 2026-10-30: "teach it to listen to other rap and compare for itself", music in every genre).
// Verse's ears (lib/rap-ears.js) already measure a track the way an engineer reads a record. This tool gives them real records to measure: for
// each kind of song Verse writes it searches the Internet Archive's netlabel collection for Creative Commons tracks tagged with that genre, takes
// the most downloaded ones (no NonCommercial licence, one track an item), decodes the middle minute with ffmpeg, measures it with listen() and
// writes the profiles and their average to void-live-deploy/data/genre-refs.json. Only the measurements and the credits are kept: no audio is
// stored or served. A song card holds its own render against the average for its kind (lib/genre-score.js).
//   node tools/genre-refs.mjs                  every genre, up to 8 tracks each
//   node tools/genre-refs.mjs --only heavy,beat --per 5
// Needs network access to archive.org and ffmpeg on the PATH, so it runs in .github/workflows/genre-refs.yml, which opens the pull request.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listen, windowOf, averageOf } from '../void-live-deploy/lib/rap-ears.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = path.join(root, 'void-live-deploy/data/genre-refs.json');
export const RATE = 44100;
const IA = 'https://archive.org';

// the kinds of song Verse writes (lib/compose.js moods and lib/arrange.js heavy songs) and the genre tags their real counterparts carry
export const GENRES = Object.freeze([
  { id: 'heavy', label: 'metal and hard rock', subjects: ['metal', 'heavy metal', 'thrash metal', 'hard rock', 'punk'] },
  { id: 'beat', label: 'hip hop', subjects: ['hip hop', 'hip-hop', 'rap', 'instrumental hip hop'] },
  { id: 'happy', label: 'dance and pop', subjects: ['dance', 'electropop', 'pop', 'house'] },
  { id: 'rainy', label: 'lo-fi and chill', subjects: ['lo-fi', 'lofi', 'chillout', 'downtempo'] },
  { id: 'dark', label: 'dark ambient', subjects: ['dark ambient', 'darkwave'] },
  { id: 'epic', label: 'cinematic and soundtrack', subjects: ['cinematic', 'soundtrack', 'orchestral'] },
  { id: 'lullaby', label: 'lullabies and gentle piano', subjects: ['lullaby', 'piano', 'solo piano'] },
]);

/** whether a licence URL allows Verse to measure and credit the track on a paid site: Creative Commons (or public domain), not NonCommercial. Pure. */
export function licenseOk(url) {
  const u = String(url || '').toLowerCase();
  if (/publicdomain/.test(u) && /creativecommons\.org/.test(u)) return true;
  return /creativecommons\.org\/licenses\//.test(u) && !/(^|[/-])nc([/-]|$)/.test(u.replace(/^.*\/licenses\//, '/'));
}

/** the Internet Archive search for one genre: netlabel audio with a Creative Commons licence, most downloaded first. Pure. */
export function searchUrl(g, rows = 60) {
  const subj = g.subjects.map((s) => 'subject:"' + s + '"').join(' OR ');
  const q = 'collection:netlabels AND mediatype:audio AND licenseurl:*creativecommons* AND (' + subj + ')';
  const p = new URLSearchParams({ q, rows: String(rows), output: 'json' });
  for (const f of ['identifier', 'title', 'creator', 'licenseurl', 'downloads']) p.append('fl[]', f);
  p.append('sort[]', 'downloads desc');
  return IA + '/advancedsearch.php?' + p.toString();
}

/** the one file of an item to measure: its first MP3 (the item's own order) between 0.5 and 25 MB, or null. Pure. */
export function pickFile(files) {
  const mp3 = (files || []).filter((f) => /\.mp3$/i.test(f.name || '') && /mp3/i.test(f.format || 'mp3') && !/sample|preview|_64kb/i.test(f.name));
  return mp3.find((f) => { const s = Number(f.size); return s >= 5e5 && s <= 25e6; }) || null;
}

/** a credit line for a track: { id, title, creator, license, page, file }. Pure. */
export function creditOf(doc, file) {
  const one = (v) => (Array.isArray(v) ? v[0] : v) || '';
  return { id: doc.identifier, title: String(file.title || one(doc.title) || doc.identifier).slice(0, 120), creator: String(file.artist || file.creator || one(doc.creator) || 'unknown').slice(0, 80),
    license: one(doc.licenseurl), page: IA + '/details/' + doc.identifier, file: file.name };
}

/** decode an MP3 file to interleaved 44.1 kHz stereo floats with ffmpeg: [L, R], or null. */
export function decode(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(RATE), '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0 || !r.stdout || !r.stdout.length) return null;
  const f = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 4)), n = f.length >> 1, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = f[2 * i]; R[i] = f[2 * i + 1]; }
  return [L, R];
}

/** the profile of one track: listen() over its middle minute. */
export function profileOf([L, R]) { return listen(L, R, RATE, windowOf(L.length / RATE)); }

async function json(url) { const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }

/** measure up to `per` tracks for genre `g`: { id, label, subjects, tracks: [credit + profile], average }. */
export async function measure(g, { per = 8, log = () => {} } = {}) {
  const docs = ((await json(searchUrl(g))).response || {}).docs || [], tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'genre-')), tracks = [], seen = new Set();
  for (const d of docs) {
    if (tracks.length >= per) break;
    const who = String((Array.isArray(d.creator) ? d.creator[0] : d.creator) || '').toLowerCase();
    if (!licenseOk(Array.isArray(d.licenseurl) ? d.licenseurl[0] : d.licenseurl) || (who && seen.has(who))) continue;
    try {
      const meta = await json(IA + '/metadata/' + encodeURIComponent(d.identifier)), f = pickFile(meta.files); if (!f) continue;
      const r = await fetch(IA + '/download/' + encodeURIComponent(d.identifier) + '/' + f.name.split('/').map(encodeURIComponent).join('/')); if (!r.ok) continue; // void-review: ok, one track at a time on purpose: it stops at per, and archive.org asks for polite, sequential downloads
      const file = path.join(tmp, 'track.mp3'); fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
      const pcm = decode(file); fs.rmSync(file, { force: true }); if (!pcm) continue;
      const profile = profileOf(pcm); if (!profile) continue; // a track with no steady beat keeps its other measures
      tracks.push({ ...creditOf(d, f), profile }); if (who) seen.add(who); log(g.id + ': ' + d.identifier + ' ' + profile.bpm + ' BPM ' + profile.lufs + ' LUFS');
    } catch (e) { log(g.id + ': ' + d.identifier + ' skipped (' + e.message + ')'); }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return { id: g.id, label: g.label, subjects: g.subjects, tracks, average: averageOf(tracks.map((t) => t.profile)) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const only = arg('--only') ? new Set(arg('--only').split(',')) : null, per = Number(arg('--per')) || 8;
  const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { genres: {} }, genres = { ...(old.genres || {}) };
  for (const g of GENRES.filter((x) => !only || only.has(x.id))) {
    const m = await measure(g, { per, log: (s) => console.log(s) });
    if (m.tracks.length) genres[g.id] = m; else console.log(g.id + ': no track could be measured; the old reference stays');
  }
  const out = { made: new Date().toISOString().slice(0, 10), source: 'Internet Archive netlabels (archive.org/details/netlabels), Creative Commons, no NonCommercial licence',
    tool: 'tools/genre-refs.mjs', genres };
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  for (const g of Object.values(genres)) console.log(g.id + ': ' + g.tracks.length + ' tracks, average ' + (g.average && g.average.bpm) + ' BPM, ' + (g.average && g.average.lufs) + ' LUFS');
}
