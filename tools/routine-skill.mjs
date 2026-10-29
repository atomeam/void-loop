#!/usr/bin/env node
// One-click forge for an offered routine (asked by Verse): the owner approves an offer on the site ("offered routines"), then
//   node tools/routine-skill.mjs --list            the approved routines (GET /api/routines; no key needed)
//   node tools/routine-skill.mjs <id|name> [--ask-phrase]   write skills/<name>.js, its routing-order file and skills/index.json
//   node tools/routine-skill.mjs --file offer.json  the same from a { name, author, asks } file (offline)
// The skill is made by lib/routine-skill.js (the asks as data, one exact phrase, nothing a typed ask could not do), registered with
// the same pieces as tools/new-skill.mjs, and checked. Then `node tools/finish.mjs grow "..."` commits and opens the PR. No key is read or kept.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ranksOf, writeIndex, ORDER_DIR } from './skills-index.mjs';
import { nextRank } from './new-skill.mjs';
import { skillOf } from '../void-live-deploy/lib/routine-skill.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';

/** write the skill for an offer: { ok, name, file } or { ok: false, why }. */
export function forgeRoutine(offer, { dir = resolve(root, 'void-live-deploy/skills'), order = ORDER_DIR, ranks = ranksOf(), write = true } = {}) {
  const s = skillOf(offer);
  if (s.error) return { ok: false, why: s.error };
  if (s.name in ranks) return { ok: false, why: s.name + ' already exists' };
  const file = resolve(dir, s.name + '.js');
  if (existsSync(file)) return { ok: false, why: file + ' exists' };
  if (write) {
    writeFileSync(file, s.source);
    writeFileSync(resolve(order, String(nextRank(ranks)).padStart(4, '0') + '-' + s.name), '');
  }
  return { ok: true, name: s.name, file, phrase: s.phrase };
}

async function main(argv) {
  const a = argv.slice(2);
  let list = [];
  if (a[0] === '--file') { try { list = [JSON.parse(readFileSync(a[1], 'utf8'))]; } catch (e) { console.error('routine-skill: cannot read ' + a[1]); return 2; } }
  else {
    try { const r = await fetch(SITE + '/api/routines'); list = r.ok ? await r.json() : []; } catch (_) { console.error('routine-skill: could not reach ' + SITE); return 2; }
    if (a[0] === '--list' || !a[0]) { for (const r of list) console.log((r.id || '') + '  ' + r.author + "'s " + r.name + ': ' + r.asks.join(' | ')); if (!list.length) console.log('no approved routines'); return 0; }
    list = list.filter((r) => r.id === a[0] || r.name === a[0]);
    if (list.length !== 1) { console.error('routine-skill: ' + (list.length ? 'more than one match, use the id' : 'no approved routine named ' + a[0] + ' (the owner approves offers first)')); return 2; }
  }
  const r = forgeRoutine(list[0]);
  if (!r.ok) { console.error('routine-skill: ' + r.why); return 2; }
  writeIndex();
  const c = spawnSync(process.execPath, [resolve(root, 'tools', 'skills-check.mjs')], { encoding: 'utf8' });
  console.log(((c.stdout || '') + (c.stderr || '')).trim());
  console.log('wrote ' + r.file + '\nsay "' + r.phrase + '" to run it. next: node tools/finish.mjs grow "forged ' + r.name + ', asked by Verse" ...');
  return c.status === 0 ? 0 : 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv).then((c) => process.exit(c));
