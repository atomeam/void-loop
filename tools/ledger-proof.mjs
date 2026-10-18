#!/usr/bin/env node
// A verifiable growth ledger (the frontier's "absorb and connect every repo": a hash per line and a root hash, an Atom feed).
// The deploy runs this on its own copy, right after tools/public-ledger.mjs and tools/public-quotes.mjs, so it hashes exactly the ledger the site serves:
//   /growth.proof.json   a hash chain over the served /void.growth.json: line i's hash is sha256(previous hash + "\n" + the entry in canonical JSON),
//                        the first line's previous hash is empty, the root is the last line's hash. Anyone can recompute it from the served ledger.
//   /growth.atom         an Atom feed of the newest 50 entries, each carrying its line hash, so a reader or a feed reader sees what Verse grew and can check it
// Append-only becomes checkable: change, reorder or drop an old line and every hash after it changes; a newer proof that does not carry an older proof's
// hashes as its first lines is not an append (--extends). Nothing is signed: this shows the ledger was not altered after the proof, not who wrote it.
//   node tools/ledger-proof.mjs [--out dir]          write growth.proof.json and growth.atom next to the served ledger (default void-live-deploy/)
//   node tools/ledger-proof.mjs --verify [ledger] [proof]    exit 1 unless the proof matches the ledger (defaults: the two served files)
//   node tools/ledger-proof.mjs --extends older.json [newer.json]   exit 1 unless newer is older plus appended lines
//   node tools/ledger-proof.mjs --dry                print the count and root hash only
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ALGORITHM = 'line hash = sha256(previous line hash + "\\n" + the entry as JSON with its keys sorted); the first previous hash is empty; root = the last line hash (sha256 of the empty text for an empty ledger)';
export const FEED_LIMIT = 50;

const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
/** an entry as JSON with its keys sorted at every level, so the same entry always hashes the same. Pure. */
export const canon = (e) => JSON.stringify(sortKeys(e));
const sha = (s) => createHash('sha256').update(s).digest('hex');

/** the hash of every line, chained: [hash of line 0, hash of line 1, ...]. Pure. */
export function chainOf(list) { let h = ''; return (Array.isArray(list) ? list : []).map((e) => (h = sha(h + '\n' + canon(e)))); }

/** the proof of a ledger: its count, root hash and each line's time and hash. `now` is only when it was made; it is not hashed. Pure. */
export function proofOf(list, now = new Date()) {
  const hashes = chainOf(list), l = Array.isArray(list) ? list : [];
  return { v: 1, algorithm: ALGORITHM, count: l.length, root: hashes.length ? hashes[hashes.length - 1] : sha(''), generated: now.toISOString(), lines: l.map((e, i) => ({ at: e && e.at ? String(e.at) : '', hash: hashes[i] })) };
}

/** does this ledger match this proof? { ok, why }. Pure. */
export function verify(list, proof) {
  if (!proof || proof.v !== 1 || !Array.isArray(proof.lines)) return { ok: false, why: 'not a proof this tool wrote' };
  const hashes = chainOf(list), n = hashes.length;
  if (proof.count !== n || proof.lines.length !== n) return { ok: false, why: 'the ledger has ' + n + ' lines and the proof counts ' + proof.count };
  for (let i = 0; i < n; i++) if (proof.lines[i].hash !== hashes[i]) return { ok: false, why: 'line ' + (i + 1) + (list[i] && list[i].at ? ' (' + list[i].at + ')' : '') + ' does not match: it, or a line before it, was changed' };
  const rootNow = n ? hashes[n - 1] : sha('');
  return proof.root === rootNow ? { ok: true, why: n + ' lines, root ' + rootNow.slice(0, 12) } : { ok: false, why: 'the root hash does not match the last line' };
}

/** is `newer` the `older` proof plus appended lines: every old line's hash is still its hash, nothing dropped. { ok, why }. Pure. */
export function extendsProof(older, newer) {
  if (!older || !newer || !Array.isArray(older.lines) || !Array.isArray(newer.lines)) return { ok: false, why: 'not proofs' };
  if (newer.lines.length < older.lines.length) return { ok: false, why: 'the newer proof has fewer lines (' + newer.lines.length + ' against ' + older.lines.length + '): lines were dropped' };
  for (let i = 0; i < older.lines.length; i++) if (newer.lines[i].hash !== older.lines[i].hash) return { ok: false, why: 'line ' + (i + 1) + ' differs: the older ledger was changed, not appended to' };
  return { ok: true, why: (newer.lines.length - older.lines.length) + ' lines appended' };
}

const xml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const clip = (t, n) => { const x = String(t || '').replace(/\s+/g, ' ').trim(); return x.length <= n ? x : x.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };

/** an Atom 1.0 feed of the newest `limit` entries, newest first, each with its line hash. Pure. */
export function atomOf(list, { site = 'https://a-to-mind.com', limit = FEED_LIMIT, now = new Date() } = {}) {
  const l = (Array.isArray(list) ? list : []), hashes = chainOf(l);
  const newest = l.map((e, i) => ({ e, h: hashes[i] })).filter((x) => x.e && x.e.at && Number.isFinite(Date.parse(x.e.at))).slice(-limit).reverse();
  const updated = newest.length ? new Date(Date.parse(newest[0].e.at)).toISOString() : now.toISOString();
  const entries = newest.map(({ e, h }) => '  <entry>\n'
    + '    <id>tag:a-to-mind.com,' + xml(String(e.at).slice(0, 10)) + ':growth:' + h.slice(0, 16) + '</id>\n'
    + '    <title>' + xml(clip((e.kind ? e.kind + ': ' : '') + (e.what || ''), 110)) + '</title>\n'
    + '    <updated>' + new Date(Date.parse(e.at)).toISOString() + '</updated>\n'
    + '    <link rel="alternate" href="' + xml(site) + '/"/>\n'
    + '    <content type="text">' + xml(String(e.what || '') + (e.show ? '\nShow: ' + e.show : '') + (e.try ? '\nTry: ' + e.try : '') + '\nline hash: ' + h) + '</content>\n'
    + '  </entry>').join('\n');
  return '<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n'
    + '  <id>tag:a-to-mind.com,2026:growth</id>\n  <title>What Verse grew</title>\n  <subtitle>Verse\'s growth ledger, newest first. Each entry carries its line hash; /growth.proof.json holds the chain and its root.</subtitle>\n'
    + '  <updated>' + updated + '</updated>\n  <link rel="self" href="' + xml(site) + '/growth.atom"/>\n  <link rel="alternate" href="' + xml(site) + '/"/>\n  <author><name>Verse</name></author>\n'
    + entries + (entries ? '\n' : '') + '</feed>\n';
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

function main(argv) {
  const opt = (f) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : ''; };
  const dir = resolve(root, opt('--out') || 'void-live-deploy'), ledgerPath = resolve(dir, 'void.growth.json'), proofPath = resolve(dir, 'growth.proof.json');
  const pos = argv.filter((a, i) => !a.startsWith('--') && !['--out'].includes(argv[i - 1]));
  if (argv.includes('--verify')) {
    const r = verify(readJson(pos[0] || ledgerPath), readJson(pos[1] || proofPath));
    console.log((r.ok ? 'ok: ' : 'FAIL: ') + r.why); return r.ok ? 0 : 1;
  }
  if (argv.includes('--extends')) {
    const r = extendsProof(readJson(opt('--extends')), readJson(pos.find((p) => p !== opt('--extends')) || proofPath));
    console.log((r.ok ? 'ok: ' : 'FAIL: ') + r.why); return r.ok ? 0 : 1;
  }
  const list = readJson(ledgerPath), proof = proofOf(list);
  if (argv.includes('--dry')) { console.log(proof.count + ' lines, root ' + proof.root); return 0; }
  writeFileSync(proofPath, JSON.stringify(proof) + '\n'); writeFileSync(resolve(dir, 'growth.atom'), atomOf(list));
  console.log('growth proof: ' + proof.count + ' lines, root ' + proof.root + '; growth.atom has the newest ' + Math.min(FEED_LIMIT, proof.count));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
