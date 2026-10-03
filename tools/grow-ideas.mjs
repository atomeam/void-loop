// Add several new Void asks to the growth inbox. Does not delete rows.
// Ideas are plain asks a visitor might type. Already-listed asks are skipped.
import { readFileSync, writeFileSync } from 'node:fs';

const inboxPath = new URL('../domains/growth-inbox.md', import.meta.url);

export const IDEA_BANK = [
  ['throw it off the screen', 'figures-first dismiss'],
  ['export a print file', 'void-stage, slicer 3MF'],
  ['summon a figure', 'figures-first, living 3D'],
  ['spin the figure', 'figures-first, see the back'],
  ['days until new year', 'board later, date countdown'],
  ['read it aloud', 'plan item 4, voice'],
  ['make my void light', 'board later, light look'],
  ['what did you do today', 'plan item 8, ledger as a skill'],
  ['dismiss this', 'figures-first, send it away'],
  ['a figure that sits on the chair', 'figures-first, use what is already there'],
  ['download the print file', 'export-to-print, file stays valid offline'],
  ['cartoon version of a hard subject', 'two-part summons, funny not grim'],
  ['zoom in on the figure', 'collector detail, progressive'],
  ['what can this figure do', 'figure stays on brand'],
  ['show the countdown', 'days until a date'],
];

export function asksIn(text) {
  return text.split('\n').filter((line) => line.startsWith('|')).map((line) => {
    const cells = line.split('|').map((c) => c.trim());
    return (cells[3] || '').toLowerCase();
  }).filter(Boolean);
}

export function ideasToAdd(text, bank = IDEA_BANK, limit = 5) {
  const have = new Set(asksIn(text));
  return bank.filter(([ask]) => !have.has(ask.toLowerCase())).slice(0, limit);
}

export function appendIdeas(text, ideas, date) {
  const rows = ideas.map(([ask, source]) => `| open | ${date} | ${ask} | ${source} |`);
  const base = text.endsWith('\n') ? text : text + '\n';
  return base + rows.join('\n') + (rows.length ? '\n' : '');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function main() {
  const text = readFileSync(inboxPath, 'utf8');
  const ideas = ideasToAdd(text);
  if (!ideas.length) {
    console.log('none');
    return;
  }
  writeFileSync(inboxPath, appendIdeas(text, ideas, today()));
  for (const [ask] of ideas) console.log(ask);
}

if (process.argv[1] && process.argv[1].endsWith('grow-ideas.mjs')) main();
