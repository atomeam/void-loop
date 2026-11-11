#!/usr/bin/env node
// OCR every painted card for readable writing (image models garble letters). Flags subjects whose art shows words,
// and can ask /api/card-art again for each one under the route's daily cap.
//   node tools/art-text-scan.mjs                 list painted cards that show writing
//   node tools/art-text-scan.mjs --status        counts only
//   node tools/art-text-scan.mjs --redo [--max 10]  repaint flagged ones (again:true), stop at the cap
//   VOID_URL=...  another origin (default https://a-to-mind.com)
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { known, plan } from './prepaint-art.mjs';
import { readableTextOf, subjectKey } from '../void-live-deploy/lib/art-rules.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = () => process.env.VOID_URL || 'https://a-to-mind.com';
const outDir = resolve(root, 'tools/.art-text-scan');
/** a void_art subject row -> { subject, kind } for /api/card-art (prefixes cartoonN/posterN/backdropN). Pure. */
export function partsOf(stored) {
  const s = String(stored || '').trim();
  let m;
  if ((m = /^(cartoon\d*)\s+(.+)$/i.exec(s))) return { subject: m[2], kind: 'cartoon', key: s };
  if ((m = /^(poster\d*)\s+(.+)$/i.exec(s))) return { subject: m[2], kind: 'poster', key: s };
  if ((m = /^(backdrop\d*)\s+(.+)$/i.exec(s))) return { subject: m[2], kind: 'backdrop', key: s };
  return { subject: s, kind: 'skill', key: s };
}

/** OCR a jpeg/png buffer via tools/art-text-ocr.py (RapidOCR). */
function ocrWords(buf) {
  mkdirSync(outDir, { recursive: true });
  const tmp = resolve(outDir, 'one.jpg');
  writeFileSync(tmp, buf);
  const py = resolve(root, 'tools/art-text-ocr.py');
  const r = spawnSync('python3', [py, tmp], { encoding: 'utf8', timeout: 120000, maxBuffer: 2 * 1024 * 1024 });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'ocr failed').slice(0, 200));
  return readableTextOf((r.stdout || '').split(/\n/));
}

async function fetchArt(stored) {
  const { subject, kind } = partsOf(stored);
  // rows already carry cartoon/poster/backdrop prefixes: ask with kind=skill and the stored key so the route looks up that exact row
  const key = kind === 'skill' ? stored : subject;
  const knd = kind === 'skill' ? 'skill' : kind;
  const r = await fetch(base() + '/api/card-art?key=' + encodeURIComponent(key) + '&kind=' + encodeURIComponent(knd), {
    headers: { 'user-agent': 'VerseArtTextScan/1.0' },
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) return { state: 'error', status: r.status };
  return r.json();
}

function imgBuf(img) {
  const m = /^data:image\/(?:jpeg|png);base64,(.+)$/i.exec(String(img || ''));
  if (!m) return null;
  return Buffer.from(m[1], 'base64');
}

export async function scanOne(k) {
  const j = await fetchArt(k);
  if (j.state !== 'art' || !j.img) return { key: k, state: j.state || 'none', words: [] };
  const buf = imgBuf(j.img);
  if (!buf) return { key: k, state: 'bad-img', words: [] };
  const words = ocrWords(buf);
  return { key: k, state: 'art', day: j.day || '', words, flagged: words.length > 0 };
}

async function main() {
  const a = process.argv.slice(2), has = (f) => a.includes(f), mi = a.indexOf('--max');
  const max = mi >= 0 ? Math.max(1, +a[mi + 1] || 10) : 10;
  const { out } = plan(known());
  const file = a.includes('--file') ? a[a.indexOf('--file') + 1] : '';
  // --file is exact void_art subject keys (one per line). Without it, walk the skill index (many may still be unpainted).
  const list = file ? readFileSync(file, 'utf8').split(/\n/).map((l) => l.trim()).filter(Boolean) : out;
  console.log('scanning ' + list.length + ' cards at ' + base());
  const flagged = [], clean = [], missing = [];
  for (const k of list) {
    try {
      const r = await scanOne(k);
      if (r.state !== 'art') { missing.push(k); process.stdout.write('.'); continue; }
      if (r.flagged) { flagged.push(r); console.log('\nFLAG  ' + k + '  [' + r.words.join(' ') + ']'); }
      else { clean.push(k); process.stdout.write(r.words.length ? '!' : '+'); }
    } catch (e) {
      missing.push(k);
      process.stdout.write('x');
      console.error('\nerr   ' + k + '  ' + (e && e.message || e));
    }
  }
  console.log('\n' + clean.length + ' clean, ' + flagged.length + ' with writing, ' + missing.length + ' unpainted or unread');
  mkdirSync(outDir, { recursive: true });
  const report = { at: new Date().toISOString(), base: base(), clean: clean.length, flagged: flagged.map((f) => ({ key: f.key, words: f.words, day: f.day })), missing };
  writeFileSync(resolve(outDir, 'report.json'), JSON.stringify(report, null, 2));
  if (has('--status') || !has('--redo')) {
    if (flagged.length) console.log(flagged.map((f) => f.key + '\t' + f.words.join(' ')).join('\n'));
    return;
  }
  let n = 0;
  for (const f of flagged) {
    if (n >= max) break;
    for (let tries = 0; tries < 4; tries++) {
      const p = partsOf(f.key);
      // one paint per flagged card, then up to four tries of that same card: the route has no batch, answers slow at 3 a minute, and the run stops on the daily cap
      const r = await fetch(base() + '/api/card-art', { // void-review: ok (one POST per flagged card to /api/card-art, which paints one subject and has no batch form; the inner loop only retries that card after the route says slow)
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'VerseArtTextScan/1.0' },
        body: JSON.stringify({ subject: p.subject, kind: p.kind, rarity: 'common', again: true }),
        signal: AbortSignal.timeout(60000),
      }).catch(() => null);
      if (!r) { console.log('skip  ' + f.key + ' (no answer)'); break; }
      const j = await r.json().catch(() => ({}));
      if (j.state === 'art' && j.again) { n++; console.log('redo  ' + f.key); break; }
      if (j.why === 'again-today') { console.log('wait  ' + f.key + ' (already redone today)'); break; }
      if (j.why === 'slow') { await new Promise((ok) => setTimeout(ok, 21000)); continue; }
      if (j.why === 'cap' || j.why === 'off' || j.why === 'text') { console.log('stop: ' + j.why + ' (' + n + ' redone)'); return; }
      console.log('skip  ' + f.key + ' (' + (j.why || j.state || r.status) + ')'); break;
    }
  }
  console.log('done: ' + n + ' redone this run');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
