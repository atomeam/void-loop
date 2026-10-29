// The word sweep (owner, 2026-10-19: "not just every card put a random word generator to cycle every possible card"). The owner found the worst
// cards by typing random words ("anxiety" came back as "nxiety", "tile" carried the model's own working, "bike" said "Closest match"). This does
// the same every day: it types random words into the live site the way a person does, reads each card that comes back, and flags what is wrong.
// Half the words are Verse's own (the words on the book's cards, so every card's subject gets asked), half are random Wikipedia titles (so words
// nobody planned for get asked too). The same day gives the same words, so a run can be repeated.
//   node tools/word-sweep.mjs [--n 20] [--site https://a-to-mind.com] [--words "a,b"] [--out sweep.json]   needs a browser (CHROME_PATH or Playwright's)
// Each flag is a fault a person would point at; the report lists the words with flags first. Read-only: it asks what any visitor can ask, nothing more.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanTake } from '../void-live-deploy/skills/take.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** a seeded generator (mulberry32) so a day's words repeat. Pure. */
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const seedOf = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

/** the words on the book's cards: their titles, one-liners and example asks, as single plain words of 4 to 12 letters, once each. Pure. */
export function vocabulary(guide) {
  const stop = new Set(['this', 'that', 'with', 'from', 'your', 'what', 'when', 'where', 'which', 'there', 'their', 'them', 'they', 'then', 'than', 'have', 'into', 'each', 'only', 'also', 'make', 'show', 'open', 'play', 'verse', 'void', 'card', 'cards', 'stage', 'skill', 'asks', 'says', 'like', 'just', 'more', 'some', 'every', 'about']);
  const out = new Set();
  for (const p of (guide && guide.pages) || []) for (const t of [p.title, p.line, ...(p.examples || [])]) for (const w of String(t || '').toLowerCase().match(/[a-z]{4,12}/g) || []) if (!stop.has(w)) out.add(w);
  return [...out].sort();
}
/** n words drawn without repeats. Pure given the generator. */
export function pick(list, n, rand) { const a = list.slice(), out = []; while (a.length && out.length < n) out.push(a.splice(Math.floor(rand() * a.length), 1)[0]); return out; }

/** what is wrong with the card a word brought back, as short flags. card: { title, text, thin, take, said, errors, ms }. Pure. */
export function flagsOf(word, card) {
  const f = [], w = String(word).toLowerCase(), title = String(card.title || '').toLowerCase(), text = String(card.text || '');
  if (!card.title && !card.said) f.push('nothing came back');
  if (/couldn'?t look this up|none of my sources answered|could not plan|no answer/i.test(text + ' ' + (card.said || ''))) f.push('no answer');
  // letters lost on the way: the card is about the word with its first letters cut ("nxiety" for "anxiety")
  if (title && !title.includes(w) && w.length > 3 && (title.includes(w.slice(1)) || title.includes(w.slice(2)))) f.push('letters dropped: "' + card.title + '"');
  // the card says what it looked up: a different word than the one typed means the ask was changed on the way ("nxiety" for "anxiety")
  const looked = /closest match i found for [“"]([^”"]+)[”"]/i.exec(card.thin || '');
  if (looked && looked[1].toLowerCase() !== w && w.includes(looked[1].toLowerCase())) f.push('looked up "' + looked[1] + '", not "' + word + '"');
  if (/closest match i found/i.test(card.thin || '') && (title.includes(w) || text.toLowerCase().slice(0, 400).includes(w))) f.push('a false "closest match" (the card is about the word)');
  if (card.take && !cleanTake(card.take)) f.push('a take that is the model\'s working or a loop');
  if (/what most people (?:overlook|miss|don'?t)/i.test(card.take || '')) f.push('a take that claims what "most people" think');
  if ((card.errors || []).length) f.push('page error: ' + String(card.errors[0]).slice(0, 80));
  if (card.ms > 12000) f.push('slow: ' + Math.round(card.ms / 1000) + ' s');
  return f;
}

/** the report: words with flags first, then a count. Pure. */
export function report(rows) {
  const bad = rows.filter((r) => r.flags.length);
  return ['Word sweep: ' + rows.length + ' words, ' + bad.length + ' with something wrong', '']
    .concat(bad.map((r) => '- **' + r.word + '** (' + r.source + ') → ' + (r.title || '(no card)') + ': ' + r.flags.join('; ')))
    .concat(bad.length ? [] : ['Every card read clean.']).join('\n');
}

async function randomTitles(n) {
  try {
    const r = await fetch('https://en.wikipedia.org/w/api.php?action=query&list=random&rnnamespace=0&rnlimit=' + n + '&format=json&origin=*', { headers: { 'user-agent': 'a2m-word-sweep/1.0 (a-to-mind.com)' } });
    const j = await r.json(); return ((j.query && j.query.random) || []).map((x) => x.title).filter((t) => t.length <= 40 && !/[:(]/.test(t));
  } catch (_) { return []; }
}

async function main(argv) {
  const opt = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
  const n = Math.max(2, Math.min(60, parseInt(opt('--n', '20'), 10) || 20)), site = opt('--site', 'https://a-to-mind.com');
  const day = new Date().toISOString().slice(0, 10), rand = rng(seedOf(day));
  let words;
  if (opt('--words')) words = opt('--words').split(',').map((w) => ({ word: w.trim(), source: 'given' })).filter((w) => w.word);
  else {
    const guide = JSON.parse(fs.readFileSync(path.join(here, '..', 'void-live-deploy/skills/guide.json'), 'utf8'));
    const own = pick(vocabulary(guide), Math.ceil(n / 2), rand).map((w) => ({ word: w, source: 'a card' }));
    const wild = (await randomTitles(n - own.length)).map((w) => ({ word: w.toLowerCase(), source: 'random' }));
    words = own.concat(wild);
  }
  const { chromium } = await import('playwright-core');
  const exe = process.env.CHROME_PATH || process.env.VOID_TEST_BROWSER || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({ executablePath: exe, headless: true });
  const rows = [];
  // the site itself first: if it cannot be reached, say that once instead of failing every word
  try { const p = await browser.newPage(); await p.goto(site + '/', { waitUntil: 'domcontentloaded', timeout: 30000 }); await p.close(); }
  catch (e) { await browser.close(); console.log('Word sweep: ' + site + ' could not be reached from here (' + String(e.message || e).split('\n')[0] + '); nothing was asked.'); return 2; }
  for (const { word, source } of words) {
    const page = await browser.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
    const t0 = Date.now(); let card = {};
    try {
      await page.goto(site + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForFunction(() => document.documentElement.dataset.skills === 'ready', null, { timeout: 20000 }).catch(() => {});
      await page.fill('#input', word); await page.keyboard.press('Enter');
      // settled: a card whose sub line is no longer "…" / "thinking…", or a whisper with no card
      await page.waitForFunction(() => { const v = document.querySelector('.vpage.on'); const s = v && v.querySelector('.sub'); return v ? !(s && /^(?:…|thinking…|looking up…?)$/.test(s.textContent.trim())) : !!(document.getElementById('whisper') || {}).textContent; }, null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2500); // the take and the picture come a moment after the card
      card = await page.evaluate(() => { const v = document.querySelector('.vpage.on'); const q = (s) => (v && v.querySelector(s) ? v.querySelector(s).textContent.trim() : '');
        return { title: q('h2'), text: v ? v.innerText.slice(0, 1500) : '', thin: q('.thin'), take: q('.take p'), said: ((document.getElementById('whisper') || {}).textContent || '').trim() }; });
    } catch (e) { errors.push(String(e.message || e)); }
    card.errors = errors; card.ms = Date.now() - t0;
    rows.push({ word, source, title: card.title, flags: flagsOf(word, card) });
    await page.close();
  }
  await browser.close();
  const rep = report(rows); console.log(rep);
  if (opt('--out')) fs.writeFileSync(opt('--out'), JSON.stringify({ day, site, rows }, null, 1));
  return 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
