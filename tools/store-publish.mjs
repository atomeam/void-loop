#!/usr/bin/env node
// Verse self-publishing (owner, 2026-10-15: "Verse can make a new product every time it needs in our store"). docs/store.md.
// Verse's routines and the builders call this with a shipped thing; it packages the files, checks them, stores the zip in R2,
// writes the product row into domains/store.products.json (the one catalog the /store page, /api/store and the store card
// read, via the generated void-live-deploy/lib/store-products.js), logs it in the public changelog and queues an ad clip.
//
//   node tools/store-publish.mjs sync                       regenerate lib/store-products.js + the changelogs from the JSON
//   node tools/store-publish.mjs forge-pack [--id x]         every forge printable as a checked STL pack (watertight, fits a 180 mm bed)
//   node tools/store-publish.mjs clips-pack [--n 10]         the newest Verse FILMS as a free clips pack
//   node tools/store-publish.mjs publish --kind <k> --id <id> --name "<n>" --blurb "<b>" --files a,b [--preview x.glb] [--paid] [--cents n]
//        [--share --cents n [--gumroad perma]]  pay what you want with an appraised price: pay p% get the first ceil(p% x N) items
//        (lib/pay-share.js); every item also goes to R2 as store/<id>/items/<name> so the server zips each buyer's share
//   node tools/store-publish.mjs auto-forge                  a new forge model re-packs the printables, appraises them, queues a rotation clip
//   node tools/store-publish.mjs check [--site URL]          live download check of every file product; a failure unpublishes it
//   common flags: --dry (no R2 upload, nothing written)  --no-upload (write the row, skip R2)  --no-clip
//
// Guardrails (low-risk checks, not approval gates): price inside PRICE_RANGE; no trademarked names (TRADEMARKS) in the title,
// blurb or file names; every file made by Verse or under an allowed licence (ORIGINS); every STL closed and finite and inside the
// bed; a public changelog row for every new product; and `check` unpublishes a product whose download fails.
// Until Stripe is on, new products are free / pay-what-you-want (the tip jar). A paid item that can only sell on Gumroad gets
// status needs-gumroad and a line in domains/store.queue.jsonl: there is no Gumroad API key, so no listing is faked.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..');
export const DATA = path.join(root, 'domains/store.products.json');
const GEN = path.join(root, 'void-live-deploy/lib/store-products.js');
const PUBLIC_LOG = path.join(root, 'void-live-deploy/store/changelog.json');
const DOC_LOG = path.join(root, 'docs/store-changelog.md');
const QUEUE = path.join(root, 'domains/store.queue.jsonl');
const CLIP_QUEUE = path.join(root, 'domains/store.clips.jsonl');
const BUCKET = 'void-films'; // the FILMS binding (wrangler.toml); store files live under store/
export const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';

// ---- guardrails (pure) ----
export const PRICE_RANGE = { min: 100, max: 5000 }; // a paid V01D-made product is $1 to $50; 0 = free / pay what you want
// the pricing rule: what each kind would cost once paid checkout is on (Stripe), from comparable packs on Gumroad/Cults3D/itch.io
export const PRICE_RULE = { 'minis-stl': 900, 'print-set': 700, clips: 0, comics: 500, 'game-print': 700, sdk: 1900, templates: 900, download: 0 };
export const priceFor = (kind, extra = 0) => Math.min(PRICE_RANGE.max, Math.max(0, (PRICE_RULE[kind] ?? 0) + extra));
export const priceOk = (cents) => cents === 0 || (Number.isInteger(cents) && cents >= PRICE_RANGE.min && cents <= PRICE_RANGE.max);
export const TRADEMARKS = ['monopoly', 'solarquest', 'solar quest', 'scrabble', 'risk', 'clue', 'cluedo', 'catan', 'pokemon', 'pokémon', 'nintendo', 'mario', 'zelda', 'minecraft', 'fortnite', 'roblox', 'lego', 'warhammer', 'dungeons & dragons', 'd&d', 'star wars', 'marvel', 'disney', 'pixar', 'hasbro', 'mattel', 'tetris', 'pac-man', 'pacman', 'sonic', 'youtube', 'tiktok', 'gumroad', 'stripe', 'harry potter', 'batman', 'superman', 'transformers', 'barbie', 'hot wheels'];
export function trademarkHits(...texts) {
  const t = ' ' + texts.join(' ').toLowerCase().replace(/[_./-]+/g, ' ') + ' ';
  return TRADEMARKS.filter((w) => new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\&]/g, (c) => '\\' + c) + '($|[^a-z0-9])').test(t));
}
// where a file may come from: made by Verse's own code, or a licence that allows resale
export const ORIGINS = { v01d: 'Made by Verse (a-to-mind.com)', 'v01d-films': 'Verse FILMS, made and filmed by Verse', 'poly-haven-cc0': 'CC0 (Poly Haven)', cc0: 'CC0 1.0' };
export const originOk = (o) => Object.prototype.hasOwnProperty.call(ORIGINS, o);
// a binary STL a slicer takes as it is: header count matches the length, every number finite, every edge shared by exactly two
// facets in opposite directions (closed and consistently wound = watertight), and inside the bed. Pure, from the bytes alone.
export function checkStl(bytes, bedMm = 180) {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), problems = [];
  if (buf.byteLength < 84) return { ok: false, problems: ['the file is empty'], triangles: 0 };
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), n = dv.getUint32(80, true);
  if (buf.byteLength !== 84 + n * 50) return { ok: false, problems: ['the header says ' + n + ' facets, the file holds ' + Math.floor((buf.byteLength - 84) / 50)], triangles: 0 };
  const ids = new Map(), edges = new Map(), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  let nan = 0;
  const vid = (o) => { const p = [0, 1, 2].map((k) => dv.getFloat32(o + k * 4, true)); if (p.some((x) => !Number.isFinite(x))) { nan++; return -1; } p.forEach((x, a) => { if (x < lo[a]) lo[a] = x; if (x > hi[a]) hi[a] = x; }); const k = p.map((x) => Math.round(x * 1e4)).join(','); if (!ids.has(k)) ids.set(k, ids.size); return ids.get(k); };
  for (let t = 0; t < n; t++) {
    const o = 84 + t * 50 + 12, v = [vid(o), vid(o + 12), vid(o + 24)];
    if (v.includes(-1)) continue;
    for (let i = 0; i < 3; i++) { const a = v[i], b = v[(i + 1) % 3]; if (a === b) continue; const k = a + ':' + b; edges.set(k, (edges.get(k) || 0) + 1); }
  }
  // pinch edges (four facets meeting at one edge, two each way) are still closed; slicers repair them, so they are a note, not a fault
  let open = 0, flipped = 0, pinch = 0;
  for (const [k, c] of edges) { const [a, b] = k.split(':'); const back = edges.get(b + ':' + a) || 0; if (!back) { if (c > 1) flipped++; else open++; } else if (c !== back) flipped++; else if (c > 1) pinch++; }
  if (nan) problems.push(nan + ' corners are not a number');
  if (open) problems.push(open + ' open edges (not watertight)');
  if (flipped) problems.push(flipped + ' edges shared the wrong way (facets wound inconsistently)');
  const size = [0, 1, 2].map((a) => hi[a] - lo[a]);
  if (size.some((s) => s > bedMm + 0.01)) problems.push('it is ' + size.map((s) => Math.round(s)).join(' × ') + ' mm, past a ' + bedMm + ' mm bed');
  return { ok: !problems.length, problems, pinch, triangles: n, size: size.map((s) => Math.round(s * 10) / 10) };
}
/** every guardrail on one product row and its files: { ok, problems } */
export function guard(row, files = []) {
  const problems = [];
  if (!/^[a-z0-9][a-z0-9-]{2,60}$/.test(row.id || '')) problems.push('id must be lower-case words with dashes');
  if (!priceOk(row.cents)) problems.push('price ' + row.cents + '¢ is outside ' + PRICE_RANGE.min + '–' + PRICE_RANGE.max + '¢ (or 0)');
  const tm = trademarkHits(row.name || '', row.blurb || '', ...files.map((f) => f.name));
  if (tm.length) problems.push('trademarked names: ' + tm.join(', '));
  for (const f of files) {
    if (!originOk(f.origin)) problems.push(f.name + ': unknown origin "' + f.origin + '" (third-party assets are not sold)');
    if (/\.stl$/i.test(f.name)) { const c = checkStl(f.data); if (!c.ok) problems.push(f.name + ': ' + c.problems.join('; ')); }
  }
  if (!files.length && row.kind !== 'service') problems.push('no files');
  return { ok: !problems.length, problems };
}

// ---- catalog files ----
export const readCatalog = () => JSON.parse(fs.readFileSync(DATA, 'utf8'));
export function changelog(cat) {
  return cat.products.filter((p) => p.log).flatMap((p) => p.log.map((l) => ({ at: l.at, id: p.id, name: p.name, what: l.what, price: p.pwyw ? 'Free · pay what you want' : p.cents ? '$' + (p.cents / 100).toFixed(2).replace(/\.00$/, '') : 'Free', status: p.status })))
    .sort((a, b) => (a.at < b.at ? 1 : -1));
}
export function sync(cat = readCatalog(), write = true) {
  const gen = '// GENERATED by tools/store-publish.mjs from domains/store.products.json. Edit the JSON (or run the tool), not this file.\nexport default ' + JSON.stringify(cat.products.map(({ log, ...p }) => p), null, 1) + ';\n';
  const log = changelog(cat);
  const doc = '# Verse store changelog\n\nEvery product Verse publishes, unpublishes or changes, newest first. Written by `tools/store-publish.mjs`; public at\nhttps://a-to-mind.com/store/ ("New from Verse") and https://a-to-mind.com/store/changelog.json.\n\n| When (UTC) | Product | What | Price | Status |\n| --- | --- | --- | --- | --- |\n' +
    log.map((l) => `| ${l.at.slice(0, 16).replace('T', ' ')} | ${l.name} (\`${l.id}\`) | ${l.what} | ${l.price} | ${l.status} |`).join('\n') + '\n';
  if (write) { fs.writeFileSync(DATA, JSON.stringify(cat, null, 1) + '\n'); fs.writeFileSync(GEN, gen); fs.mkdirSync(path.dirname(PUBLIC_LOG), { recursive: true }); fs.writeFileSync(PUBLIC_LOG, JSON.stringify({ changelog: log }, null, 1) + '\n'); fs.writeFileSync(DOC_LOG, doc); }
  return { gen, log, doc };
}

// ---- packaging ----
async function zip(files) {
  const { zipStore } = await import('../void-live-deploy/skills/print-file.js');
  return zipStore(files.map((f) => ({ name: f.name, data: f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data) })));
}
// WRANGLER_BIN: a wrangler 3 binary (on the box: /workspace/.wrangler3/node_modules/.bin/wrangler, since npx's copy cannot write
// its cache there); default npx wrangler@3.114.17, the deploy's own version. Wrangler 3 writes to the remote bucket by default.
function r2put(key, file) {
  const bin = process.env.WRANGLER_BIN, args = ['r2', 'object', 'put', BUCKET + '/' + key, '--file', file, '--content-type', 'application/zip'];
  const r = bin ? spawnSync(bin, args, { cwd: path.dirname(path.dirname(path.dirname(bin))), encoding: 'utf8' }) : spawnSync('npx', ['-y', 'wrangler@3.114.17', ...args], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0 || !/Upload complete/.test(r.stdout + r.stderr)) throw new Error('R2 upload failed: ' + (r.stderr || r.stdout).slice(-400));
}
/** a minimal GLB (positions + indices, one grey PBR material) for the store's spinning preview */
export function glb(model) {
  const pos = new Float32Array(model.positions), idx = new Uint32Array(model.indices);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i++) { const a = i % 3; if (pos[i] < lo[a]) lo[a] = pos[i]; if (pos[i] > hi[a]) hi[a] = pos[i]; }
  const bin = new Uint8Array(pos.byteLength + idx.byteLength); bin.set(new Uint8Array(pos.buffer), 0); bin.set(new Uint8Array(idx.buffer), pos.byteLength);
  const json = { asset: { version: '2.0', generator: 'Verse store-publish' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, scale: [0.01, 0.01, 0.01] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }], materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.55, 0.5, 1, 1], metallicFactor: 0.1, roughnessFactor: 0.45 } }],
    buffers: [{ byteLength: bin.byteLength }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength, target: 34962 }, { buffer: 0, byteOffset: pos.byteLength, byteLength: idx.byteLength, target: 34963 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: pos.length / 3, type: 'VEC3', min: lo, max: hi }, { bufferView: 1, componentType: 5125, count: idx.length, type: 'SCALAR' }] };
  const pad = (b, c) => { const n = (4 - (b.length % 4)) % 4; const o = new Uint8Array(b.length + n); o.set(b); o.fill(c, b.length); return o; };
  const J = pad(new TextEncoder().encode(JSON.stringify(json)), 0x20), B = pad(bin, 0), total = 12 + 8 + J.length + 8 + B.length;
  const out = new Uint8Array(total), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, J.length, true); dv.setUint32(16, 0x4e4f534a, true); out.set(J, 20);
  dv.setUint32(20 + J.length, B.length, true); dv.setUint32(24 + J.length, 0x004e4942, true); out.set(B, 28 + J.length);
  return out;
}

/** publish one shipped thing. files: [{ name, data (Uint8Array), origin }]. Returns the row. */
export async function publish(opts, files) {
  const now = new Date().toISOString(), cat = readCatalog();
  const share = !!opts.share, paid = !!opts.paid && !share, cents = paid ? (opts.cents ?? priceFor(opts.kind)) : share ? (opts.cents ?? (opts.appraisal && opts.appraisal.cents) ?? priceFor(opts.kind)) : 0;
  const version = opts.version || 'v1', key = 'store/' + opts.id + '-' + version + '.zip';
  const row = { id: opts.id, name: opts.name, cents, kind: 'download', pack: opts.kind, pwyw: !paid, files: [{ key }], blurb: opts.blurb,
    license: opts.license || 'Personal use; prints and clips may be shared with credit to Verse (a-to-mind.com)', tier: opts.tier || 'personal',
    origin: [...new Set(files.map((f) => f.origin))].join('+'), status: paid || (share && !opts.gumroad) ? 'needs-gumroad' : 'live', published: now.slice(0, 10), bytes: 0, contents: files.map((f) => f.name) };
  if (opts.preview) row.preview = opts.preview;
  if (share && opts.gumroad) row.gumroad = opts.gumroad; // a Gumroad pay-what-you-want listing ($0+), its ping amount decides the share
  if (share && opts.order) row.order = opts.order; // Verse's value order, starter items first
  if (opts.appraisal) row.appraisal = opts.appraisal; // Verse's appraiser note (lib/appraise.js)
  if (paid) row.wouldBe = '$' + (cents / 100).toFixed(2);
  const g = guard(row, files);
  if (!g.ok) throw new Error('guardrails stopped ' + opts.id + ':\n  - ' + g.problems.join('\n  - '));
  const z = await zip(files); row.bytes = z.length;
  const tmp = path.join(root, '.store-tmp'); fs.mkdirSync(tmp, { recursive: true });
  const zf = path.join(tmp, path.basename(key)); fs.writeFileSync(zf, z);
  if (opts.dry) return { row, zip: zf };
  if (!opts.noUpload) r2put(key, zf);
  if (share && !opts.noUpload) for (const f of files) { const fp = path.join(tmp, 'item-' + path.basename(f.name)); fs.writeFileSync(fp, f.data); r2put('store/' + opts.id + '/items/' + f.name, fp); }
  const old = cat.products.find((p) => p.id === row.id);
  row.log = [...((old && old.log) || []), { at: now, what: old ? 'updated: ' + files.length + ' files' : 'published by Verse: ' + files.length + ' files, ' + (z.length / 1048576).toFixed(1) + ' MB' + (paid ? ' (paid: needs a Gumroad listing, queued)' : '') }];
  if (old) Object.assign(old, row); else cat.products.push(row);
  sync(cat);
  if (paid) fs.appendFileSync(QUEUE, JSON.stringify({ at: now, id: row.id, need: 'needs Gumroad listing', price: row.wouldBe, file: key, note: 'No Gumroad API key: Adam lists it by hand (or Stripe checkout takes it once on).' }) + '\n');
  if (!opts.noClip) fs.appendFileSync(CLIP_QUEUE, JSON.stringify({ at: now, id: row.id, name: row.name, hook: opts.hook || 'I made this and put it in my store', caption: (opts.blurb || '').slice(0, 160), ...(opts.clipAsk ? { ask: opts.clipAsk } : {}) }) + '\n');
  if (!opts.noInbox) toInbox(row, files.length, readCatalog());
  return { row, zip: zf };
}

// ---- Verse sees what it packaged (asked by Void, ask-20261015-0619-2): every publish adds a row to its growth inbox
// (domains/growth-inbox.md, read into self.json) naming what was packaged and the next product it could forge. Pure helpers.
const INBOX = path.join(root, 'domains/growth-inbox.md');
/** the next product to make: a pack kind with a price rule the catalog has no live product of yet, else the forge pack again */
export function suggestNext(cat) {
  const have = new Set((cat.products || []).filter((p) => p.status !== 'unpublished').map((p) => p.pack).filter(Boolean));
  const k = Object.keys(PRICE_RULE).find((x) => x !== 'download' && !have.has(x));
  return k ? 'a ' + k + ' pack (none in the store yet)' : 'a bigger forge pack once a new forge model ships';
}
export function inboxRow(row, nFiles, cat, date = new Date().toISOString().slice(0, 10)) {
  const cell = (t) => String(t).replace(/\|/g, '/').replace(/\s+/g, ' ').trim();
  return `| shipped (packaged) | ${date} | ${cell(row.name)} | store-publish: ${cell(row.pack || row.kind)}, ${nFiles} files, ${row.cents ? '$' + (row.cents / 100).toFixed(2) : 'free'}; next: ${cell(suggestNext(cat))} |`;
}
function toInbox(row, nFiles, cat) {
  try { const t = fs.readFileSync(INBOX, 'utf8'), line = inboxRow(row, nFiles, cat); if (!t.includes(line)) fs.writeFileSync(INBOX, t.replace(/\n*$/, '\n') + line + '\n'); } catch (_) {}
}

// ---- auto-clip loop (asked by Void): a forge model not yet in the printables pack re-packs it, appraises it (lib/appraise.js,
// shown as a note; the pack stays free until paid checkout is on) and queues a rotation clip of the new model being forged.
export function newForgeModels(cat, keys) {
  const p = (cat.products || []).find((x) => x.id === 'v01d-forge-printables');
  const have = new Set(((p && p.contents) || []).map((n) => n.replace(/^v01d-|\.stl$/g, '')));
  return keys.filter((k) => !have.has(k));
}
export async function autoForge(opts = {}) {
  const F = await import('../void-live-deploy/skills/forge-rules.js'), cat = readCatalog();
  const fresh = newForgeModels(cat, Object.keys(F.THINGS));
  if (!fresh.length) return { fresh, row: null };
  const files = await forgeFiles();
  const { appraise } = await import('../void-live-deploy/lib/appraise.js');
  const comps = cat.products.filter((p) => p.pack === 'print-set' || p.pack === 'minis-stl').map((p) => ({ name: p.name, cents: p.cents || PRICE_RULE[p.pack] }));
  const a = appraise({ name: 'forge printables', kind: 'print-set', files: files.map((f) => ({ bytes: f.data.length })) }, { comps });
  const label = (k) => (F.THINGS[k].label || k).toLowerCase();
  const r = await publish({ ...opts, kind: 'print-set', id: 'v01d-forge-printables', name: 'Verse Forge Printables (' + files.length + ' STLs)',
    blurb: 'I forged these myself, now with a ' + fresh.map(label).join(', a ') + '. Every one is watertight and fits a 180 mm bed. Free. Tip if you print one.',
    hook: 'New from my forge: a ' + label(fresh[0]), appraisal: a.note, clipAsk: 'make me a ' + label(fresh[0]) }, files);
  return { fresh, row: r.row, appraisal: a };
}

// ---- builders for shipped things ----
export async function forgeFiles() {
  const F = await import('../void-live-deploy/skills/forge-rules.js'), out = [];
  for (const key of Object.keys(F.THINGS)) {
    const m = F.build(key), buf = F.stl(m), v = F.verifyStl(buf, m);
    if (!v.ok) { console.error('skipped ' + key + ': ' + v.problems.join('; ')); continue; }
    out.push({ name: 'v01d-' + key + '.stl', data: new Uint8Array(buf), origin: 'v01d', model: m });
  }
  return out;
}
async function clipsFiles(n) {
  const r = await fetch(SITE + '/api/films').then((r) => r.json()), seen = new Set(), out = [];
  for (const f of r.films || []) {
    const topic = f.id.replace(/^\d{8}-/, '').replace(/-r\d+$/, ''); if (seen.has(topic)) continue; seen.add(topic);
    const res = await fetch(new URL(f.src, SITE)); if (!res.ok) continue;
    out.push({ name: f.id + '.mp4', data: new Uint8Array(await res.arrayBuffer()), origin: 'v01d-films', title: f.title });
    if (out.length >= n) break;
  }
  const list = out.map((f) => '- ' + f.name + ': ' + f.title).join('\n');
  out.push({ name: 'README.txt', data: new TextEncoder().encode('Verse clips pack\n\nShort films Verse made and filmed itself at https://a-to-mind.com (Verse FILMS).\nShare and repost them with credit "Verse · a-to-mind.com".\n\n' + list + '\n'), origin: 'v01d' });
  return out;
}

/** live download check: free products get a signed link and the first bytes are fetched. A failure unpublishes the product. */
export async function check(site = SITE, write = true) {
  const cat = readCatalog(), now = new Date().toISOString(), failed = [];
  for (const p of cat.products) {
    if (p.status !== 'live' || !p.files || p.cents) continue;
    let why = '';
    try {
      const r = await fetch(site + '/api/store/free', { method: 'POST', body: JSON.stringify({ id: p.id }) }).then((r) => r.json());
      const url = r.items && r.items[0] && r.items[0].downloads[0] && r.items[0].downloads[0].url;
      if (!url) why = 'no signed link (' + (r.error || 'unknown') + ')';
      else { const d = await fetch(url, { headers: { range: 'bytes=0-3' } }); if (!d.ok) why = 'download answered ' + d.status; else { const b = new Uint8Array(await d.arrayBuffer()); if (!b.length) why = 'download was empty'; } }
    } catch (e) { why = 'unreachable: ' + e.message; }
    console.log((why ? '✗ ' : '✓ ') + p.id + (why ? ': ' + why : ''));
    if (why && p.published && p.log) { p.status = 'unpublished'; p.log.push({ at: now, what: 'unpublished automatically: ' + why }); failed.push(p.id); }
  }
  if (failed.length && write) sync(cat);
  return failed;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d), flag = (k) => a.includes(k);
  const common = { dry: flag('--dry'), noUpload: flag('--no-upload'), noClip: flag('--no-clip') };
  const cmd = a[0];
  if (cmd === 'sync') { sync(); console.log('synced'); }
  else if (cmd === 'forge-pack') {
    const files = await forgeFiles(), id = opt('--id', 'v01d-forge-printables');
    const pdir = path.join(root, 'void-live-deploy/models/store'); fs.mkdirSync(pdir, { recursive: true });
    const rocket = files.find((f) => f.name.includes('rocket')) || files[0];
    if (!common.dry) fs.writeFileSync(path.join(pdir, id + '-preview.glb'), glb(rocket.model));
    const sizes = files.map((f) => f.name.replace(/^v01d-|\.stl$/g, '') + ' ' + checkStl(f.data).size.map(Math.round).join('×') + ' mm').join(', ');
    files.push({ name: 'README.txt', data: new TextEncoder().encode('Verse Forge Printables\n\nEvery model was generated by Verse\'s forge (a-to-mind.com, "make me a rocket") and checked before packing:\nwatertight, facets wound outward, flat base, inside a 180 mm cube. Millimetres, Z up. Print in PLA, 0.2 mm layers.\n\n' + sizes.split(', ').join('\n') + '\n\nPersonal use. Share prints and photos with credit to Verse · a-to-mind.com.\n'), origin: 'v01d' });
    const r = await publish({ ...common, kind: 'print-set', id, name: 'Verse Forge Printables (' + (files.length - 1) + ' STLs)', preview: '/models/store/' + id + '-preview.glb',
      blurb: 'I forged these myself: a rocket, a lighthouse, a teapot and more. Every one is watertight and fits a 180 mm bed. Free. Tip if you print one.', hook: 'I forged ten things you can 3D print' }, files.map(({ model, ...f }) => f));
    console.log(JSON.stringify({ ...r.row, log: undefined }, null, 1));
  } else if (cmd === 'clips-pack') {
    const files = await clipsFiles(+opt('--n', 10)), id = opt('--id', 'v01d-clips-pack');
    const r = await publish({ ...common, kind: 'clips', id, name: 'Verse Clips Pack (' + (files.length - 1) + ' shorts)', license: 'Free to share and repost with credit: Verse · a-to-mind.com',
      blurb: 'Ten shorts I built, tested and filmed myself. Vertical, ready to post. Free to share with credit. Tip if you like them.', hook: 'Ten shorts I filmed myself. Free.' }, files);
    console.log(JSON.stringify({ ...r.row, log: undefined }, null, 1));
  } else if (cmd === 'publish') {
    const files = String(opt('--files', '')).split(',').filter(Boolean).map((f) => ({ name: path.basename(f), data: new Uint8Array(fs.readFileSync(f)), origin: opt('--origin', 'v01d') }));
    const r = await publish({ ...common, kind: opt('--kind', 'download'), id: opt('--id'), name: opt('--name'), blurb: opt('--blurb'), preview: opt('--preview'), paid: flag('--paid'), share: flag('--share'), gumroad: opt('--gumroad'), cents: opt('--cents') ? +opt('--cents') : undefined, hook: opt('--hook') }, files);
    console.log(JSON.stringify({ ...r.row, log: undefined }, null, 1));
  } else if (cmd === 'check') { const f = await check(opt('--site', SITE), !common.dry); process.exit(f.length ? 2 : 0); }
  else { console.log('usage: sync | forge-pack | clips-pack | publish ... | check'); process.exit(1); }
}
