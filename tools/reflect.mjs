// Void's voice from the command line (the site side is functions/api/reflect.js and lib/voice.js).
//   node tools/reflect.mjs                      print Void's current asks and its latest words (read this before a run)
//   node tools/reflect.mjs --build "<shipped>"  ask Void what it thinks of what just shipped (owner token)
//   node tools/reflect.mjs --daily              ask Void where it should go next, what feels weakest, which game is next
//   node tools/reflect.mjs --write              mirror every reflection the site holds into domains/void.voice.md
//     The current asks are rewritten on every run, minus any a growth-ledger entry answers (its `asked` field, set with
//     tools/grow.mjs --asked), and stamped with the day they were read from the site. When the site can't be reached the
//     old list is filtered against the ledger again and keeps its old stamp, with the day of the failed try beside it.
//   add --json to print the raw entry (the daily workflow reads `striking` from it)
// The owner token is VOID_OWNER_TOKEN (or VOID_MISSES_TOKEN: both are the Pages READ_TOKEN). Exit 3 when the site can't be
// reached or Void couldn't answer, so a deploy never fails because Void was busy. Void's words are copied as it said them.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOG = resolve(root, 'domains/void.voice.md');
const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';
const MARK = (at) => `<!-- voice:${at} -->`;
const LEDGER = resolve(root, 'void-live-deploy/void.growth.json');
const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** the asks no growth-ledger entry answers yet: an entry answers an ask when its `asked` is the ask's id (ask-…, stable
 * however the words change) or, for entries written before ids, the ask word for word */
export function openAsks(asks, ledger) {
  const done = new Set((ledger || []).filter((e) => e && e.asked).map((e) => norm(e.asked)));
  return (asks || []).filter((a) => a && !(a.id && done.has(norm(a.id))) && !done.has(norm(a.ask)));
}
const readLedger = () => { try { return JSON.parse(readFileSync(LEDGER, 'utf8')); } catch (_) { return []; } };
const ASK_LINE = /^- (.+?)( \*\(small\)\*)? \((daily|after a build), (\d{4}-\d\d-\d\d)\)(?: `(ask-[0-9-]+)`)?$/;
/** the asks as the file has them now (for a run that can't reach the site) */
export function asksInLog(text) {
  const m = /## Void's current asks\n\n([\s\S]*?)\n\n## /.exec(String(text || ''));
  if (!m) return [];
  return m[1].split('\n').map((l) => ASK_LINE.exec(l)).filter(Boolean).map((x) => ({ ...(x[5] ? { id: x[5] } : {}), ask: x[1], small: !!x[2], kind: x[3] === 'daily' ? 'daily' : 'build', at: x[4] }));
}
const stampOf = (text) => (/^_Read from \/api\/reflect on (\d{4}-\d\d-\d\d)/m.exec(String(text || '')) || [])[1] || null;

const HEAD = `# Void's voice: what Void thinks of itself, in its own words

Void has a real say in its own direction. It is input, not a gate. After anything ships, Void is asked what it thinks
of it and how it would make it better; every day at 2:09 PM New York time it is asked where it should go next, what feels
weakest about it and which game to learn next. Its words below are copied as it said them (secrets redacted, nothing else
changed). Builders read "Void's current asks" before starting work and weigh them heavily: a concrete ask gets built
next and credited to Void ("asked by Void" in the agent log and the commit). Anyone can ask Void "what do you think of
yourself?" on a-to-mind.com. This file is written by \`node tools/reflect.mjs --write\` (the daily workflow); don't edit
it by hand, edit the code instead.
`;

export function entryBlock(e) {
  const q = (t) => String(t || '').split('\n').map((l) => '> ' + l).join('\n');
  const lines = [MARK(e.at), `### ${e.at.slice(0, 16).replace('T', ' ')} UTC · ${e.kind === 'daily' ? 'daily' : 'after a build'}`, '', `**Asked:** ${e.question}`, '', q(e.thoughts)];
  if (e.better) lines.push('>', q('**How I would make it better:** ' + e.better));
  if (e.weakest) lines.push('>', q('**Weakest right now:** ' + e.weakest));
  if (e.next_game) lines.push('>', q('**Next game:** ' + e.next_game));
  if (e.asks && e.asks.length) lines.push('', 'Asks: ' + e.asks.map((a) => `"${a.ask}"${a.small ? ' (small)' : ''}`).join('; '));
  if (e.striking) lines.push('', '*Void flagged this one for Adam.*');
  return lines.join('\n') + '\n';
}

// rebuild the log: existing blocks are kept exactly, new entries are added, oldest first; the asks come from the newest
export function writeLog(text, entries, asks, stamp = {}) {
  const blocks = new Map();
  const old = String(text || '').split(/(?=<!-- voice:)/).filter((b) => b.startsWith('<!-- voice:'));
  for (const b of old) blocks.set(/<!-- voice:([^ ]+) -->/.exec(b)[1], b.trimEnd() + '\n');
  for (const e of entries || []) if (e && e.at && !blocks.has(e.at)) blocks.set(e.at, entryBlock(e));
  const ordered = [...blocks.keys()].sort().map((k) => blocks.get(k));
  const askLines = (asks || []).length ? asks.map((a) => `- ${a.ask}${a.small ? ' *(small)*' : ''} (${a.kind === 'daily' ? 'daily' : 'after a build'}, ${String(a.at).slice(0, 10)})${a.id ? ' `' + a.id + '`' : ''}`).join('\n') : '- (none open)';
  const read = stamp.read || stampOf(text), left = 'Asks a growth-ledger entry answers (its `asked` field) are left out.';
  const failed = stamp.failed ? `the site could not be reached on ${stamp.failed}, so this may be out of date` : '';
  const note = read ? `_Read from /api/reflect on ${read}${failed ? '; ' + failed : ''}. ${left}_\n\n` : failed ? `_Not read from /api/reflect by this writer yet: ${failed}. ${left}_\n\n` : '';
  return `${HEAD}\n## Void's current asks\n\n${note}${askLines}\n\n## Log, oldest first\n\n${ordered.join('\n')}`;
}

async function call(method, body) {
  const tok = process.env.VOID_OWNER_TOKEN || process.env.VOID_MISSES_TOKEN;
  if (method === 'POST' && !tok) throw new Error('VOID_OWNER_TOKEN is not set in this environment');
  const res = await fetch(SITE + '/api/reflect', {
    method, headers: { 'user-agent': 'a2m-reflect/1.0', ...(tok && method === 'POST' ? { authorization: 'Bearer ' + tok } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`${method} /api/reflect: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  return res.json();
}

function show(e) {
  console.log(`Void (${e.kind}${e.shipped ? ': ' + e.shipped : ''}, ${e.at}):`);
  for (const k of ['thoughts', 'better', 'weakest', 'next_game']) if (e[k]) console.log(`  ${k}: ${e[k]}`);
  for (const a of e.asks || []) console.log(`  asks: ${a.ask}${a.small ? ' (small)' : ''}`);
  if (e.queued) console.log(`  queued for the builders as ${e.queued}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const json = args.includes('--json');
  try {
    if (args.includes('--build') || args.includes('--daily')) {
      const kind = args.includes('--daily') ? 'daily' : 'build';
      const e = await call('POST', { kind, ...(kind === 'build' ? { shipped: opt('--build') || '' } : {}) });
      if (json) console.log(JSON.stringify(e)); else show(e);
    } else if (args.includes('--write')) {
      const old = existsSync(LOG) ? readFileSync(LOG, 'utf8') : '', today = new Date().toISOString().slice(0, 10), ledger = readLedger();
      let v = null; try { v = await call('GET'); } catch (err) { console.error('reflect: ' + err.message + ' (refiltering the asks already in the file)'); }
      const asks = openAsks(v ? v.asks : asksInLog(old), ledger);
      const text = writeLog(old, v ? v.entries : [], asks, v ? { read: today } : { failed: today });
      writeFileSync(LOG, text);
      console.log(`void.voice.md: ${(text.match(/<!-- voice:/g) || []).length} reflections, ${asks.length} current asks${v ? '' : ' (site not reached)'}`);
      if (!v) process.exit(3);
    } else {
      const v = await call('GET'), asks = openAsks(v.asks, readLedger());
      console.log("Void's current asks:");
      for (const a of asks) console.log(`  - ${a.ask}${a.small ? ' (small)' : ''}  [${a.kind}, ${String(a.at).slice(0, 10)}${a.id ? ', ' + a.id : ''}]`);
      if (!asks.length) console.log('  (none yet)');
      if (v.entries && v.entries[0]) show(v.entries[0]);
    }
  } catch (err) {
    console.error('reflect: ' + err.message);
    process.exit(3);
  }
}
