// The baggage card against the live airline pages (asked by the coordinator, 2026-10-30: "give baggage real live checks"). Once a
// day, from GitHub's network, this reads the pages the card cites (skills/baggage.js SOURCES) and checks that every figure the card
// states (skills/baggage.js ROWS) is still written on the page it came from. The result is kept as an artifact
// (findings/baggage/<date>T<hhmm>.json: each page's status, each figure found or not, attempt "live" and the occasion number) and
// as one `finding` line in the growth ledger pointing at it, the way tools/rides-live.mjs records its live call. Success is every
// page answering and every figure found. A figure that is gone is a real finding: the card says something the airline no longer
// says, and the job goes red until the card is corrected. No key, no account, no person in the loop; nothing a visitor typed is sent.
//   node tools/baggage-live.mjs              read the pages, write the artifact, append the ledger line (the workflow commits both)
//   node tools/baggage-live.mjs --dry        read the pages and print the record, write nothing
// Exit 0 when every figure was found, 1 when a page answered without one, 3 when no page could be reached.
import { writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { ROWS, SOURCES } from '../void-live-deploy/skills/baggage.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DIR = join(root, 'findings', 'baggage');
const page = (name) => { const s = SOURCES.find(([n]) => n === name); if (!s) throw new Error('no source named ' + name); return s[1]; };
// each row of the card, the page it comes from and how the page writes the figure (as read on 2026-10-30)
export const CHECKS = [
  { row: 'Checked bag, economy', source: 'American: checked bags', figure: '50 lbs / 23 kgs', re: /50\s*lbs?\s*\/\s*23\s*kgs?/i },
  { row: 'Checked bag, economy', source: 'British Airways: baggage', figure: '23kg (50lb)', re: /23\s*kg\s*\(\s*50\s*lbs?\s*\)/i },
  { row: 'Checked bag, business or first', source: 'American: checked bags', figure: '70 lbs / 32 kgs', re: /70\s*lbs?\s*\/\s*32\s*kgs?/i },
  { row: 'Checked bag, business or first', source: 'British Airways: baggage', figure: '32kg (70lb)', re: /32\s*kg\s*\(\s*70\s*lbs?\s*\)/i },
  { row: 'Heaviest bag American takes', source: 'American: heavy bags', figure: '100 lbs / 45 kgs', re: /100\s*lbs?\s*\/\s*45\s*kgs?/i },
  { row: 'Heaviest bag American takes', source: 'American: heavy bags', figure: 'over 53 lbs / 24 kgs to 70 lbs / 32 kgs', re: /53\s*lbs?\s*\/\s*24\s*kgs?\s*\S{1,3}\s*70\s*lbs?\s*\/\s*32\s*kgs?/i },
  { row: 'Checked bag size', source: 'American: checked bags', figure: '62 in / 158 cm', re: /62\s*in(?:ches)?\s*\/\s*158\s*cm/i },
  { row: 'Carry-on size', source: 'American: carry-on bags', figure: '22 x 14 x 9 inches (56 x 36 x 23 cm)', re: /22\s*x\s*14\s*x\s*9\s*in(?:ches)?\s*\(\s*56\s*x\s*36\s*x\s*23\s*cm\s*\)/i },
  { row: 'Carry-on size', source: 'British Airways: baggage', figure: '56 x 45 x 25cm', re: /56\s*x\s*45\s*x\s*25\s*cm/i },
  { row: 'Personal item size', source: 'American: carry-on bags', figure: '18 x 14 x 8 inches (45 x 35 x 20 cm)', re: /18\s*x\s*14\s*x\s*8\s*in(?:ches)?\s*\(\s*45\s*x\s*35\s*x\s*20\s*cm\s*\)/i },
];

/** A page's words: tags, scripts and styles out, entities and spaces made plain. Pure. */
export function textOf(html) {
  return String(html || '')
    .replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;| /gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&ndash;|&#8211;/gi, '–').replace(/&times;|&#215;|×/gi, 'x')
    .replace(/\s+/g, ' ');
}

/** The record of one day's reading. Pure: what each page answered goes in, the artifact comes out. */
export function recordOf({ pages, at = new Date().toISOString(), occasion = 1 }) {
  const pageOut = SOURCES.map(([name, url]) => { const p = pages[name] || {}; return { name, url, status: p.status || 0, ms: Math.round(p.ms || 0), ...(p.error ? { error: String(p.error).slice(0, 120) } : {}) }; });
  const checks = CHECKS.map((c) => { const p = pages[c.source] || {}; const ok = p.status === 200 && c.re.test(textOf(p.body)); return { row: c.row, source: c.source, figure: c.figure, found: ok }; });
  const missing = checks.filter((c) => !c.found);
  const reached = pageOut.filter((p) => p.status === 200).length;
  const ok = reached === pageOut.length && missing.length === 0;
  return {
    attempt: 'live', occasion, at, family: 'sky', skill: 'baggage', service: 'the airline pages the baggage card cites (aa.com, britishairways.com)',
    ask: 'are the baggage card\'s figures still on the airlines\' own pages',
    pages: pageOut, checks, found: checks.length - missing.length, of: checks.length, ok,
    error: ok ? '' : (reached < pageOut.length ? pageOut.filter((p) => p.status !== 200).map((p) => p.name + ': ' + (p.error || 'HTTP ' + p.status)).join('; ') + (missing.length ? '; ' : '') : '')
      + (missing.length ? 'not found: ' + missing.map((c) => c.figure + ' (' + c.source + ')').join(', ') : ''),
  };
}

export const artifactName = (rec) => rec.at.slice(0, 13) + rec.at.slice(14, 16) + '.json';
export const ledgerWhat = (rec) => rec.ok
  ? `baggage checked against the live airline pages${rec.occasion > 1 ? ', occasion ' + rec.occasion : ' for the first time'}: all ${rec.of} figures the card states are still on the pages it cites (${rec.pages.length} pages); attempt live, no key, no person in the loop (artifact findings/baggage/${artifactName(rec)})`
  : `baggage checked against the live airline pages and found ${rec.found} of ${rec.of} figures (${rec.error.slice(0, 160)}); attempt live, occasion ${rec.occasion} (artifact findings/baggage/${artifactName(rec)})`;

export const nextOccasion = (dir = DIR) => (existsSync(dir) ? readdirSync(dir).filter((f) => /^\d{4}-\d\d-\d\dT\d{4}\.json$/.test(f)).length : 0) + 1;

/** Read every cited page once. */
export async function readPages(fetchFn = fetch) {
  const out = {};
  for (const [name, url] of SOURCES) {
    const t0 = Date.now();
    try {
      const res = await fetchFn(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; a2m-baggage-live/1.0; +https://a-to-mind.com)', accept: 'text/html' }, signal: AbortSignal.timeout(20000) });
      out[name] = { status: res.status, body: res.status === 200 ? await res.text() : '', ms: Date.now() - t0 };
    } catch (e) { out[name] = { status: 0, body: '', ms: Date.now() - t0, error: (e && (e.cause && e.cause.code || e.name || e.message)) || 'unreachable' }; }
  }
  return out;
}

export { page };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dry = process.argv.includes('--dry');
  const pages = await readPages();
  const rec = recordOf({ pages, occasion: nextOccasion() });
  console.log(JSON.stringify(rec, null, 1));
  const anyReached = rec.pages.some((p) => p.status > 0);
  if (!dry && anyReached) {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(join(DIR, artifactName(rec)), JSON.stringify(rec, null, 1) + '\n');
    const ref = 'https://github.com/atomeam/void-loop/blob/main/findings/baggage/' + artifactName(rec);
    const g = spawnSync(process.execPath, [join(root, 'tools', 'grow.mjs'), 'finding', ledgerWhat(rec), '--by', 'baggage-live', '--ref', ref], { encoding: 'utf8' });
    if (g.status !== 0) { console.error('baggage-live: the ledger line was not written: ' + (g.stderr || g.stdout).slice(0, 200)); process.exit(1); }
    console.log('### baggage, live\n\n| What | |\n|:--|:--|\n| pages answered | ' + rec.pages.filter((p) => p.status === 200).length + ' of ' + rec.pages.length + ' |\n| figures found | ' + rec.found + ' of ' + rec.of + ' |\n| occasion | ' + rec.occasion + ' |' + (rec.ok ? '' : '\n| missing | ' + rec.error + ' |'));
  }
  process.exit(!anyReached ? 3 : rec.ok ? 0 : 1);
}
