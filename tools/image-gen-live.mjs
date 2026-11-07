// The /image/ painter against the live site, end to end: once a day, from GitHub's network, this does what a visitor does on a-to-mind.com/image/.
// It reads GET /api/image (pictures left today) and the page and its script, paints one fixed picture (POST /api/image), shrinks that picture to
// the page's own edit size (lib/image-gen.js editSizeOf, the copy the page's "Change it" sends; ImageMagick or ffmpeg on the runner), changes it
// with one fixed line (POST { act: 'change' }), then asks the same change again, which must come from the edge cache for free.
// Cost: at most 2 Workers AI pictures a day of the page's AI_SHARE (the paint, when the bench picks Workers AI, and the change); the repeat is free.
// Nothing a person typed is sent, no key is used, and no picture bytes are kept: the artifact holds states, sizes, painters and SHA-256 hashes.
// The answer is kept as an artifact (findings/image-gen/<date>T<hhmm>.json, attempt "live", the occasion number) and as one `finding` line in the
// growth ledger pointing at it. checksPass: every read answered a known state in the route's own words (a picture of the right size and a
// 64-hex ref, or a resting reason from SAYS), and a changed picture came back changed, then cached. `ok` is checksPass AND a real change made.
//   node tools/image-gen-live.mjs              check, write the artifact, append the ledger line (the workflow commits both)
//   node tools/image-gen-live.mjs --dry        check and print the record, write nothing
// Exit 0 when the checks pass, 1 when the site answered but something is wrong, 3 when the site could not be reached.
import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { SAYS, SHAPES, EDIT_BYTES, editSizeOf, imageSizeOf, fitsEdit } from '../void-live-deploy/lib/image-gen.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DIR = join(root, 'findings', 'image-gen');
export const SITE = (process.env.SITE || 'https://a-to-mind.com').replace(/\/$/, '');
export const SERVICE = 'a-to-mind.com /api/image and /image/ (FLUX.2 klein-4b on Workers AI, or the free painter, behind them)';
export const ASK = Object.freeze({ prompt: 'a red lighthouse on a small rock in a calm sea at dusk', style: 'none', shape: 'square', seed: 4242, lang: 'en' });
export const CHANGE = 'make the sky purple';

const sha = (b) => createHash('sha256').update(b).digest('hex');
/** a data URL's bytes and type, or null. Pure. */
export function bytesOf(img) {
  const m = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(img || ''));
  return m ? { type: m[1], bytes: Buffer.from(m[2], 'base64') } : null;
}
/** one POST answer, reduced to what the artifact keeps (no picture bytes). Pure. */
export function answerOf(status, body) {
  const b = body || {}, pic = bytesOf(b.img), dims = pic ? imageSizeOf(new Uint8Array(pic.bytes)) : null;
  return { status, state: typeof b.state === 'string' ? b.state.slice(0, 12) : null, why: typeof b.why === 'string' ? b.why.slice(0, 12) : null,
    sayKnown: typeof b.why === 'string' && Object.hasOwn(SAYS, b.why) && SAYS[b.why][0] === b.say,
    painter: typeof b.painter === 'string' ? b.painter.slice(0, 24) : null, w: Number.isInteger(b.w) ? b.w : null, h: Number.isInteger(b.h) ? b.h : null,
    ref: typeof b.ref === 'string' && /^[0-9a-f]{64}$/.test(b.ref) ? b.ref : null, cached: b.cached === true,
    change: typeof b.change === 'string' ? b.change.slice(0, 60) : null,
    img: pic ? { type: pic.type, bytes: pic.bytes.length, w: dims ? dims.w : null, h: dims ? dims.h : null, sha256: sha(pic.bytes) } : null };
}
/** what one answer says is wrong ('' when it is a known state). Pure. */
export function answerProblem(a, what, size) {
  if (!a || !a.status) return what + ': no answer';
  if (a.state === 'resting') return a.sayKnown ? '' : what + ': resting with words that are not the route\'s own (' + (a.why || '?') + ')';
  if (a.state !== 'art') return what + ': answered ' + a.status + ' ' + (a.state || 'no state') + (a.why ? ' (' + a.why + ')' : '');
  if (!a.img) return what + ': a picture state with no jpeg or png';
  if (!a.ref) return what + ': no 64-hex ref (the page cannot change this picture)';
  if (size && (a.w !== size[0] || a.h !== size[1])) return what + ': ' + a.w + 'x' + a.h + ', not ' + size.join('x');
  return '';
}
export const pageOf = (status, html) => ({ status, make: html.includes('id="make"'), pics: html.includes('id="pics"'), app: /<script[^>]+src="[^"]*app\.js/.test(html), handoff: /<meta name="verse-handoff"/.test(html) });
export const scriptOf = (status, js) => ({ status, changeIt: /function changeIt\(/.test(js), sendsChange: /act: 'change'/.test(js), shrinks: /const smallOf = /.test(js) });
export function pageProblem(p, s) {
  if (!p || p.status !== 200) return 'GET /image/ answered ' + ((p && p.status) || 'nothing');
  const missing = ['make', 'pics', 'app'].filter((k) => !p[k]);
  if (missing.length) return '/image/ has no ' + missing.join(', ');
  if (!s || s.status !== 200) return 'GET /image/app.js answered ' + ((s && s.status) || 'nothing');
  const gone = ['changeIt', 'sendsChange', 'shrinks'].filter((k) => !s[k]);
  return gone.length ? '/image/app.js has no ' + gone.join(', ') : '';
}

/** The record of one live check. Pure: the reads go in, the artifact comes out. */
export function recordOf({ left = null, page = null, script = null, paint = null, copy = null, change = null, again = null, ms = 0, error = '', at = new Date().toISOString(), occasion = 1 }) {
  const size = SHAPES[ASK.shape];
  let problem = error || pageProblem(page, script) || answerProblem(paint, 'the paint', size);
  if (!problem && paint.state === 'art') {
    if (copy && copy.ok) problem = answerProblem(change, 'the change', size);
    if (!problem && change && change.state === 'art') {
      if (change.change !== CHANGE) problem = 'the change: it does not name the typed line';
      else if (change.img.sha256 === paint.img.sha256) problem = 'the change: the same picture came back';
      else if (change.painter !== 'workers-ai') problem = 'the change: painted by ' + change.painter + ', not Workers AI';
      else if (!again || again.state !== 'art' || !again.cached || !again.img || again.img.sha256 !== change.img.sha256) problem = 'the same change again did not come from the cache';
    }
    if (!problem && change && change.state === 'resting' && !['cap', 'busy', 'mine', 'slow'].includes(change.why)) problem = 'the change: resting for ' + change.why;
  }
  const changed = !problem && !!(change && change.state === 'art');
  return {
    attempt: 'live', occasion, at, family: 'make', skill: 'image-gen', service: SERVICE,
    ask: 'can a visitor paint a picture on a-to-mind.com/image/ and change it with one typed line',
    request: [SITE + '/api/image', SITE + '/image/', SITE + '/image/app.js'], status: (paint && paint.status) || 0, ms: Math.round(ms),
    checksPass: !problem, ok: changed, left: Number.isInteger(left) ? left : null,
    page: page ? { status: page.status, make: !!page.make, pics: !!page.pics, app: !!page.app, handoff: !!page.handoff } : null,
    script: script ? { status: script.status, changeIt: !!script.changeIt, sendsChange: !!script.sendsChange, shrinks: !!script.shrinks } : null,
    paint, copy: copy ? { ok: !!copy.ok, tool: copy.tool || null, type: copy.type || null, w: copy.w || null, h: copy.h || null, bytes: copy.bytes || null, why: copy.why || '' } : null,
    change, again: again ? { state: again.state, cached: again.cached, same: !!(again.img && change && change.img && again.img.sha256 === change.img.sha256) } : null,
    error: problem ? String(problem).replace(/\s+/g, ' ').slice(0, 200) : '',
  };
}

export const artifactName = (rec) => rec.at.slice(0, 13) + rec.at.slice(14, 16) + '.json';
/** The ledger line for a record: one plain sentence, what happened and where the artifact is. */
export function ledgerWhat(rec) {
  const where = ' (artifact findings/image-gen/' + artifactName(rec) + ')', first = rec.occasion > 1 ? ', occasion ' + rec.occasion : ' for the first time';
  if (!rec.checksPass) return 'image-gen live check found a problem on a-to-mind.com: ' + rec.error + '; attempt live, occasion ' + rec.occasion + where;
  const p = rec.paint || {};
  if (p.state !== 'art') return 'image-gen checked against the live site' + first + ': the painter is resting (' + p.why + '), in its own words, and /image/ is served' + where;
  const painted = 'a ' + p.w + 'x' + p.h + ' picture painted by ' + p.painter + (p.cached ? ' (from the cache)' : '');
  if (rec.ok) return 'image-gen checked against the live site' + first + ': ' + painted + ', changed with one typed line at its own size by Workers AI, and the same change again came from the cache' + where;
  if (rec.copy && !rec.copy.ok) return 'image-gen checked against the live site' + first + ': ' + painted + '; the change was not tested (' + rec.copy.why + ')' + where;
  return 'image-gen checked against the live site' + first + ': ' + painted + '; the change is resting (' + ((rec.change && rec.change.why) || '?') + '), in its own words' + where;
}

/** The occasion number: one more than the artifacts already kept. */
export const nextOccasion = (dir = DIR) => (existsSync(dir) ? readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\dT\d{4}\.json$/.test(f)).length : 0) + 1;

/** the page's edit copy of a picture, made on the runner: shrunk to editSizeOf, as a JPEG under EDIT_BYTES. run: spawnSync's shape. */
export function shrinkWith(pic, size, run = spawnSync) {
  const [w, h] = editSizeOf(size), tools = [
    ['magick', (q) => ['-', '-resize', w + 'x' + h + '!', '-quality', String(q), 'jpg:-']],
    ['convert', (q) => ['-', '-resize', w + 'x' + h + '!', '-quality', String(q), 'jpg:-']],
    ['ffmpeg', (q) => ['-loglevel', 'error', '-i', 'pipe:0', '-vf', 'scale=' + w + ':' + h, '-q:v', String(q >= 85 ? 3 : 8), '-frames:v', '1', '-f', 'image2', '-c:v', 'mjpeg', 'pipe:1']]];
  let tried = [];
  for (const [tool, args] of tools) {
    for (const q of [90, 70]) {
      const r = run(tool, args(q), { input: pic.bytes, maxBuffer: 4e6 });
      if (r.error || r.status !== 0 || !r.stdout || !r.stdout.length) { tried.push(tool); break; }
      const out = Buffer.from(r.stdout), dims = imageSizeOf(new Uint8Array(out));
      if (out.length > EDIT_BYTES) continue;
      if (!fitsEdit(dims, size)) return { ok: false, tool, why: 'the shrunk copy is ' + (dims ? dims.w + 'x' + dims.h : 'unreadable') + ', not ' + w + 'x' + h };
      return { ok: true, tool, type: dims.type, w: dims.w, h: dims.h, bytes: out.length, src: 'data:' + dims.type + ';base64,' + out.toString('base64') };
    }
  }
  return { ok: false, tool: null, why: tried.length ? 'no image tool on the runner (' + [...new Set(tried)].join(', ') + ' missing or failed)' : 'the copy stayed over ' + EDIT_BYTES + ' bytes' };
}

const HEAD = { 'user-agent': 'a2m-image-gen-live/1.0 (https://a-to-mind.com)' };
async function post(fetchFn, site, body) {
  const res = await fetchFn(site + '/api/image', { method: 'POST', headers: { ...HEAD, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(70000) });
  let j = null; try { j = await res.json(); } catch (_) { j = null; }
  return { answer: answerOf(res.status, j), img: j && j.img };
}
/** one live check: the count, the page and its script, the paint, the copy, the change and the change again. */
export async function checkOnce(fetchFn = fetch, shrink = shrinkWith, site = SITE) {
  const t0 = Date.now();
  try {
    const l = await fetchFn(site + '/api/image', { headers: { ...HEAD, accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(20000) });
    let left = null; try { const j = await l.json(); left = Number.isInteger(j && j.left) ? j.left : null; } catch (_) {}
    const p = await fetchFn(site + '/image/', { headers: HEAD, cache: 'no-store', signal: AbortSignal.timeout(20000) });
    const page = pageOf(p.status, await p.text());
    const s = await fetchFn(site + '/image/app.js', { headers: HEAD, cache: 'no-store', signal: AbortSignal.timeout(20000) });
    const script = scriptOf(s.status, await s.text());
    const painted = await post(fetchFn, site, ASK), paint = painted.answer;
    let copy = null, change = null, again = null;
    if (paint.state === 'art' && paint.ref && paint.img) {
      copy = shrink(bytesOf(painted.img), [paint.w, paint.h]);
      if (copy.ok) {
        const body = { act: 'change', ref: paint.ref, change: CHANGE, src: copy.src, lang: 'en' };
        change = (await post(fetchFn, site, body)).answer;
        if (change.state === 'art') again = (await post(fetchFn, site, body)).answer;
      }
    }
    return { left, page, script, paint, copy, change, again, ms: Date.now() - t0 };
  } catch (e) { return { ms: Date.now() - t0, error: 'unreachable: ' + ((e && (e.cause && e.cause.code || e.name || e.message)) || 'error') }; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dry = process.argv.includes('--dry');
  const res = await checkOnce();
  const rec = recordOf({ ...res, occasion: nextOccasion() });
  console.log(JSON.stringify(rec, null, 1));
  if (!dry && rec.status) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(join(DIR, artifactName(rec)), JSON.stringify(rec, null, 1) + '\n');
    const ref = 'https://github.com/atomeam/void-loop/blob/main/findings/image-gen/' + artifactName(rec);
    const g = spawnSync(process.execPath, [join(root, 'tools', 'grow.mjs'), 'finding', ledgerWhat(rec), '--by', 'image-gen-live', '--ref', ref], { encoding: 'utf8' });
    if (g.status !== 0) { console.error('image-gen-live: the ledger line was not written: ' + (g.stderr || g.stdout).slice(0, 200)); process.exit(1); }
    const p = rec.paint || {}, c = rec.change || {};
    console.log('### image-gen, live\n\n| What | |\n|:--|:--|\n| checks pass | ' + (rec.checksPass ? 'yes' : 'no: ' + rec.error) + ' |\n| pictures left today | ' + (rec.left ?? 'unknown') + ' |\n| paint | ' + (p.state === 'art' ? p.w + 'x' + p.h + ' by ' + p.painter + (p.cached ? ' (cached)' : '') : (p.state || 'none') + (p.why ? ' (' + p.why + ')' : '')) + ' |\n| edit copy | ' + (rec.copy ? (rec.copy.ok ? rec.copy.w + 'x' + rec.copy.h + ' ' + rec.copy.type + ', ' + rec.copy.bytes + ' bytes, ' + rec.copy.tool : 'not made: ' + rec.copy.why) : 'not made') + ' |\n| change | ' + (c.state === 'art' ? c.w + 'x' + c.h + ' by ' + c.painter : (c.state || 'not tried') + (c.why ? ' (' + c.why + ')' : '')) + ' |\n| same change again | ' + (rec.again ? (rec.again.cached && rec.again.same ? 'from the cache' : 'not from the cache') : 'not tried') + ' |\n| time | ' + rec.ms + ' ms |\n');
  }
  process.exit(!rec.status ? 3 : rec.checksPass ? 0 : 1);
}
