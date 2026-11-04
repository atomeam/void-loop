#!/usr/bin/env node
// Promote app ideas Verse learned from local TV/radio onto the site build path (owner, 2026-10-30:
// learning should make new apps; expand so idea notes become real work on Verse).
//
//   node tools/watch-ideas.mjs              # fetch live idea notes, append frontier + growth-inbox
//   node tools/watch-ideas.mjs --dry        # print what would be added, write nothing
//   node tools/watch-ideas.mjs --file n.json  # use a local notes dump instead of the live API
//
// Never stores stream material. Only Verse's own idea notes (kind=idea) become open build rows.
import { readFileSync, writeFileSync } from 'node:fs';
import { promoteIdeas } from '../void-live-deploy/lib/watch-along.js';
import { FRONTIER, openItems, addOpen } from './frontier.mjs';
import { asksIn } from './grow-ideas.mjs';

const SITE = process.env.VERSE_SITE || 'https://a-to-mind.com';
const inboxPath = new URL('../domains/growth-inbox.md', import.meta.url);

async function fetchIdeas(limit = 40) {
  const r = await fetch(SITE + '/api/watchalong?kind=idea&limit=' + limit, { headers: { accept: 'application/json' } });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) throw new Error('watchalong idea notes failed: ' + r.status);
  return Array.isArray(j.notes) ? j.notes : [];
}

function loadFile(path) {
  const j = JSON.parse(readFileSync(path, 'utf8'));
  return Array.isArray(j) ? j : (j.notes || []);
}

function appendInbox(text, ideas, date) {
  const rows = ideas.map((x) =>
    '| open | ' + date + ' | ' + x.ask.replace(/\|/g, '/') + ' | watch-along' +
    (x.station ? ' (' + x.station.replace(/\|/g, '/') + ')' : '') +
    (x.day ? ' ' + x.day : '') + ' |');
  const base = text.endsWith('\n') ? text : text + '\n';
  return base + rows.join('\n') + (rows.length ? '\n' : '');
}

async function main(argv) {
  // Retired 2026-11-03 (owner: "rather it takes what it learns from the tv and radio and build useful monetizable things right onto the
  // site"): idea lists are no longer the output. tools/watch.py now runs tools/watch-build.mjs queue, which picks the best idea and
  // queues it as a tv: build job that ships a page. verse-watch.yml's promote step reads 'none' and does nothing; --legacy still lists.
  if (!argv.includes('--legacy')) { console.log('none'); console.log('retired: ideas become built features through tools/watch-build.mjs (see /local/#tv-built)'); return 0; }
  const dry = argv.includes('--dry');
  const fileFlag = argv.indexOf('--file');
  const notes = fileFlag >= 0 && argv[fileFlag + 1]
    ? loadFile(argv[fileFlag + 1])
    : await fetchIdeas();

  const frontierText = readFileSync(FRONTIER, 'utf8');
  const inboxText = readFileSync(inboxPath, 'utf8');
  const have = [...openItems(frontierText).map((o) => o.title), ...asksIn(inboxText)];
  const ideas = promoteIdeas(notes, { limit: 5, have });

  if (!ideas.length) {
    console.log('none');
    return 0;
  }

  for (const x of ideas) {
    console.log(x.ask + (x.station ? '  ← ' + x.station : '') + (x.day ? ' (' + x.day + ')' : ''));
  }

  if (dry) return 0;

  const date = new Date().toISOString().slice(0, 10);
  let frontier = frontierText;
  for (const x of ideas) {
    frontier = addOpen(frontier, {
      title: x.ask,
      from: 'watch-along',
      why: 'learned from ' + (x.station || 'TV/radio') +
        (x.day ? ' on ' + x.day : '') + ': ' + x.note.slice(0, 140),
    });
  }
  writeFileSync(FRONTIER, frontier);
  writeFileSync(inboxPath, appendInbox(inboxText, ideas, date));
  console.log('wrote ' + ideas.length + ' idea(s) to frontier + growth-inbox');
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('watch-ideas.mjs')) {
  main(process.argv.slice(2)).then((c) => process.exit(c || 0)).catch((e) => {
    console.error(e.message || e);
    process.exit(1);
  });
}

export { fetchIdeas, promoteIdeas };
