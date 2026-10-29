// The growth ledger as the site serves it: what Verse studies stays off the site (the owner, 2026-10-13; lib/private.js).
// The deploy runs this on its own copy just before upload, so /void.growth.json, the growth card, "look what I made" and
// Verse's reflections never name a product Verse measures itself against. The ledger in the repo stays append-only: this
// never runs on a commit, only in the deploy's workspace.
//   node tools/public-ledger.mjs          rewrite void-live-deploy/void.growth.json for upload (deploy.yml)
//   node tools/public-ledger.mjs --dry    print how many lines it would change
import { readFileSync, writeFileSync } from 'node:fs';
import { privateFree, isPrivate, quoteFree, quotesOwner } from './private.mjs';

/** ledger entries -> the ones the site may show, each with its private asides left out. Pure. */
export function publicLedger(list) {
  return (Array.isArray(list) ? list : []).map((e) => {
    if (!e || typeof e.what !== 'string') return e;
    const what = quoteFree(privateFree(e.what)); // nor the owner's quoted words (the owner, 2026-10-18: only Verse's)
    if (!what) return null;
    const out = { ...e, what };
    for (const k of ['show', 'try', 'asked']) if (isPrivate(out[k])) delete out[k];
    for (const k of ['show', 'try']) if (typeof out[k] === 'string') out[k] = quoteFree(out[k]);
    return out;
  }).filter(Boolean);
}

if (process.argv[1] && new URL(import.meta.url).pathname === new URL('file://' + process.argv[1]).pathname) {
  const path = new URL('../void-live-deploy/void.growth.json', import.meta.url);
  const list = JSON.parse(readFileSync(path, 'utf8')), pub = publicLedger(list);
  const changed = list.filter((e) => e && (isPrivate(e.what) || quotesOwner(e.what))).length;
  if (process.argv.includes('--dry')) { console.log(`${changed} of ${list.length} ledger lines name what Verse studies or quote the owner; the site would show ${pub.length}`); process.exit(0); }
  writeFileSync(path, JSON.stringify(pub, null, 1) + '\n');
  console.log(`public ledger: ${changed} lines filtered, ${pub.length} shown`);
}
