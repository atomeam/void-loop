// Print Verse's due runs, or append the public ones to the growth inbox and the frontier.
//   node tools/verse-runs.mjs            print the public asks and the count of private notes
//   node tools/verse-runs.mjs --write    append public asks that are not already listed
// A private note is never written. Nothing is sent and nothing is spent.
import { readFileSync, writeFileSync } from 'node:fs';
import { RUNS, select, distill, publicItems, asBlocks } from '../void-live-deploy/lib/verse-runs.js';
import { blocksOf, publicBlocks, inboxRow } from '../void-live-deploy/lib/inbox-blocks.js';
import { addOpen, FRONTIER, openItems } from './frontier.mjs';
import { asksIn } from './grow-ideas.mjs';

const inboxPath = new URL('../domains/growth-inbox.md', import.meta.url);
const today = () => new Date().toISOString().slice(0, 10);

export function freshPublic(rows, inbox, frontier) {
  const have = new Set([...asksIn(inbox), ...openItems(frontier).map((o) => o.title.toLowerCase())]);
  return publicItems(rows).filter((r) => !have.has(r.ask.toLowerCase()));
}

function main() {
  const now = new Date();
  const rows = select(RUNS, {}, now).map((r) => distill(r, {}));
  const text = asBlocks(rows, today());
  const pub = publicBlocks(blocksOf(text));
  const held = rows.filter((r) => r.private).length;
  console.log(pub.length + ' public, ' + held + ' private (not written)');
  for (const b of pub) console.log('  ' + b.ask);
  if (!process.argv.includes('--write') || !pub.length) return;
  const inbox = readFileSync(inboxPath, 'utf8');
  let frontier = readFileSync(FRONTIER, 'utf8');
  const add = freshPublic(rows, inbox, frontier);
  if (!add.length) { console.log('none new'); return; }
  const block = add.map((r) => inboxRow({ ask: r.ask, source: r.source, status: 'open' }, today())).join('\n') + '\n';
  writeFileSync(inboxPath, (inbox.endsWith('\n') ? inbox : inbox + '\n') + block);
  for (const r of add) frontier = addOpen(frontier, { title: r.ask, from: r.source, why: 'verse run ' + today() });
  writeFileSync(FRONTIER, frontier);
  console.log('wrote ' + add.length);
}

if (process.argv[1] && process.argv[1].endsWith('verse-runs.mjs')) main();
