// Which real sites are the easiest to beat (owner, 2026-10-24: "find the real life actual easiest site, this is findable"). No guessing: the Tranco list
// (tranco-list.eu, the research ranking of the most visited sites) gives the real sites, in the order people really visit them; each home page is
// loaded once and measured for how much it does: the controls on it (inputs, buttons, menus), the words, the links, the scripts and the bytes. A site
// that is a tool (something to type into or press) with the least on it is the easiest: smallest first, the fewest controls (links, inputs, buttons,
// selects) and then the fewest bytes (owner, 2026-10-29). The order comes from these numbers, so it only changes when the numbers do. Passive: one plain GET of each home page, no sign-in, no forms, a visible User-Agent, a small number at a time.
//   node tools/easiest-sites.mjs [how many of the top of the list] [out.json]      (.github/workflows/easiest-sites.yml runs it where the network is open)
import fs from 'node:fs'; import { execFileSync } from 'node:child_process'; import path from 'node:path'; import os from 'node:os';
import { controlsOf } from '../void-live-deploy/lib/tower-weight.js';

const TRANCO = 'https://tranco-list.eu/top-1m.csv.zip';
const strip = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->|<noscript[\s\S]*?<\/noscript>/gi, ' ');
const count = (h, re) => (h.match(re) || []).length;

/** how much one home page does, from its HTML. Pure. */
export function features(html, bytes = html.length) {
  const body = strip(html), text = body.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const inputs = count(body, /<input\b(?![^>]*type=["']?(?:hidden|submit|image)\b)/gi) + count(body, /<textarea\b/gi), selects = count(body, /<select\b/gi), buttons = count(body, /<button\b|<input\b[^>]*type=["']?(?:submit|button)\b|role=["']button/gi);
  return { bytes, controls: controlsOf(html).total, scripts: count(html, /<script\b/gi), links: count(body, /<a\s[^>]*href=/gi), inputs, selects, buttons, words: text ? text.split(' ').length : 0,
    password: /<input\b[^>]*type=["']?password/i.test(body), title: ((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '').replace(/\s+/g, ' ').trim().slice(0, 90),
    login: /\b(?:sign in|log in|login|create an account|sign up)\b/i.test(text), search: /<input\b[^>]*type=["']?search|\bname=["']?q["'\s>]/i.test(body) };
}
/** how hard a page is to beat: every control counts most, then the words, links and scripts; lower is easier. A page with nothing to type into or press is not a tool: null. Pure. */
export function hardness(f) {
  const controls = f.inputs + f.selects + f.buttons;
  if (!controls || f.password || f.words < 3) return null;                  // nothing to use, or an account wall: not a one-tool site
  return Math.round(controls * 10 + f.words / 25 + f.links / 4 + f.scripts + f.bytes / 20000);
}

/** smallest first (owner, 2026-10-29: "all sites ever made smallest first"): the fewest interactive elements on the home page (controls: links,
 *  inputs, buttons, selects, lib/tower-weight.js controlsOf), the fewer bytes on a tie, then the least visited. Pure. */
export const smallestFirst = (a, b) => a.controls - b.controls || a.bytes - b.bytes || b.rank - a.rank;

// the sites that are one tool (owner, 2026-10-24: back to the easy sites): the first scan read the top of the list and found DNS services, parked
// domains, adult sites and login walls, because most of the top is not a tool. A one-tool site says what it is in its name, so the scan takes
// every host in the whole list (a million) whose name says a tool, in the order people visit them, and measures only those.
export const TOOL_HOST = /(calc|convert|generator|counter|timer|stopwatch|coinflip|flipacoin|dice|random|picker|wheel|qrcode|colou?r|hex|base64|json|minif|formatter|validator|compress|resize|speedtest|whatismy|checker|tester|ruler|clock|lorem|uuid|password|diff|regex|epoch|timestamp|unit|metronome|tuner|spinner|scoreboard|tally|notepad|sketch|draw|emoji|fonts?\.|translat|dictionar|deepl|linguee|reverso|lingvanex|papago|thesaurus)/i; // translators and dictionaries (owner, 2026-10-25: other translate sites were skipped because no word for them was here)
export const ADULT = /(porn|xxx|sex|adult|nude|cam(?:s|girl)|escort|fuck|hentai|onlyfans|bet|casino|crack|torrent|warez)/i;
/** true for a host whose name says a tool and that is not adult or illegal. Pure. */
export const isToolHost = (host) => TOOL_HOST.test(String(host)) && !ADULT.test(String(host));
/** a page that is not worth measuring: parked or for sale, adult by its title, or almost no words and no links (a shell). Pure. */
export function junk(f) {
  // accents off first ("casinò" is a casino), and a consent or ad-preference screen is not the tool behind it
  const t = (f.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return ADULT.test(t) || /\b(?:domain (?:is )?for sale|buy this domain|this domain|parked|coming soon|under construction|account suspended|default web page|ad preferences?|preferencias de anuncio|for sale|advertisement network|ad network|cookie (?:settings|consent|preferences)|privacy (?:settings|choices)|consent)\b/.test(t) || (f.words < 6 && f.links < 2);
}

async function get(host, ms = 7000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch('https://' + host + '/', { signal: ctl.signal, redirect: 'follow', headers: { 'user-agent': 'VerseScout/1 (+https://a-to-mind.com; reads a home page once)', accept: 'text/html' } });
    if (!r.ok || !/text\/html/.test(r.headers.get('content-type') || '')) return null;
    const buf = Buffer.from(await r.arrayBuffer()).subarray(0, 600000);
    return { final: new URL(r.url).hostname, html: buf.toString('utf8'), bytes: buf.length };
  } catch (_) { return null; } finally { clearTimeout(t); }
}

// --rank a.com,b.org: where named sites stand in the Tranco ranking (1 = most visited), smallest last; a site outside the top million says so
// (owner, 2026-10-24: "find the smallest github first": the code hosts, from least used to most)
async function rankMode(list) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tranco-'));
  execFileSync('curl', ['-sSL', '--max-time', '120', '-o', path.join(dir, 't.zip'), TRANCO]); execFileSync('unzip', ['-o', '-q', path.join(dir, 't.zip'), '-d', dir]);
  const want = new Set(list.map((h) => h.trim().toLowerCase()).filter(Boolean)), found = new Map();
  for (const l of fs.readFileSync(path.join(dir, 'top-1m.csv'), 'utf8').split('\n')) { const [r, h] = l.split(','); if (h && want.has(h.trim())) found.set(h.trim(), +r); }
  const rows = [...want].map((h) => ({ host: h, rank: found.get(h) || null })).sort((a, b) => (b.rank || 2e6) - (a.rank || 2e6));
  console.log('Tranco ranks, smallest (least visited) first; "-" is outside the top million:');
  for (const r of rows) console.log(String(r.rank || '-').padStart(8), r.host);
  return rows;
}
if (process.argv[1] === new URL(import.meta.url).pathname && process.argv[2] === '--rank') { await rankMode(String(process.argv[3] || '').split(',')); process.exit(0); }
// --tools [limit]: scan only the tool-named hosts of the whole list (a million), at most `limit` of them (default 3000), most visited first
if (process.argv[1] === new URL(import.meta.url).pathname && process.argv[2] === '--tools') {
  const limit = Math.min(8000, Math.max(100, +process.argv[3] || 3000)), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tranco-'));
  execFileSync('curl', ['-sSL', '--max-time', '120', '-o', path.join(dir, 't.zip'), TRANCO]); execFileSync('unzip', ['-o', '-q', path.join(dir, 't.zip'), '-d', dir]);
  const rows = fs.readFileSync(path.join(dir, 'top-1m.csv'), 'utf8').split('\n').map((l) => l.split(',')).filter((r) => r[1] && isToolHost(r[1].trim())).slice(0, limit).map((r) => ({ rank: +r[0], host: r[1].trim() }));
  console.log('tool-named hosts to scan: ' + rows.length + ' of the top million');
  const out = []; let i = 0, done = 0;
  await Promise.all(Array.from({ length: 40 }, async () => { while (i < rows.length) { const row = rows[i++], page = await get(row.host); done++; if (done % 500 === 0) console.error('scanned ' + done + ' of ' + rows.length); if (!page) continue;
    const f = features(page.html, page.bytes), h = hardness(f); if (h !== null && !junk(f)) out.push({ ...row, final: page.final, hardness: h, ...f }); } }));
  out.sort(smallestFirst);
  fs.writeFileSync('easiest-sites.json', JSON.stringify({ source: TRANCO, mode: 'tool-named hosts', scanned: rows.length, at: new Date().toISOString(), easiest: out.slice(0, 300) }, null, 1) + '\n');
  // the tower's frontier (owner, 2026-10-24: the tower has no top, every site is on it): every real tool found, easiest first, minus the floors
  // already on the tower; the tower card counts them as the climb still ahead and grows as the scan grows
  if (process.env.FRONTIER) { const { FLOORS } = await import('../void-live-deploy/lib/tower.js'), on = new Set(FLOORS.map((f) => f.site.toLowerCase().replace(/^www\./, '')));
    fs.writeFileSync(process.env.FRONTIER, JSON.stringify({ about: 'The tower has no top: every site is on it. These are the real one-tool sites ranked so far from the top million (Tranco), smallest first (the fewest controls on the home page, then the fewest bytes), not yet floors; the scan (easiest-sites.mjs --tools) adds more.', source: TRANCO, scanned: rows.length, of: 1000000, at: new Date().toISOString().slice(0, 10), sites: out.filter((x) => !on.has(x.host.replace(/^www\./, ''))).map((x) => ({ site: x.host, rank: x.rank, controls: x.controls, bytes: x.bytes, hardness: x.hardness, title: String(x.title || '').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) })) }, null, 1) + '\n'); }
  console.log('scanned ' + rows.length + ', ' + out.length + ' real tools; the 70 smallest (controls, bytes, Tranco rank, host, words, links, title):');
  for (const s of out.slice(0, 70)) console.log(String(s.controls).padStart(4) + 'c', String(s.bytes).padStart(8) + 'B', String(s.rank).padStart(7), s.host.padEnd(30), s.words + 'w', s.links + 'l', '|', s.title);
  process.exit(0);
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const n = Math.min(100000, Math.max(100, +process.argv[2] || 5000)), outFile = process.argv[3] || 'easiest-sites.json', dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tranco-'));
  execFileSync('curl', ['-sSL', '--max-time', '120', '-o', path.join(dir, 't.zip'), TRANCO]); execFileSync('unzip', ['-o', '-q', path.join(dir, 't.zip'), '-d', dir]);
  const rows = fs.readFileSync(path.join(dir, 'top-1m.csv'), 'utf8').split('\n').slice(0, n).map((l) => l.split(',')).filter((r) => r[1]).map((r) => ({ rank: +r[0], host: r[1].trim() }));
  const out = []; let i = 0, done = 0;
  await Promise.all(Array.from({ length: 40 }, async () => {
    while (i < rows.length) {
      const row = rows[i++], page = await get(row.host); done++;
      if (done % 500 === 0) console.error('scanned ' + done + ' of ' + rows.length);
      if (!page) continue;
      const f = features(page.html, page.bytes), h = hardness(f);
      if (h !== null) out.push({ ...row, final: page.final, hardness: h, ...f });
    }
  }));
  out.sort(smallestFirst);
  fs.writeFileSync(outFile, JSON.stringify({ source: TRANCO, scanned: rows.length, at: new Date().toISOString(), easiest: out.slice(0, 300) }, null, 1) + '\n');
  console.log('scanned ' + rows.length + ', ' + out.length + ' with something to use; the 60 smallest (controls, bytes, Tranco rank, host, words, links, title):');
  for (const s of out.slice(0, 60)) console.log(String(s.controls).padStart(4) + 'c', String(s.bytes).padStart(8) + 'B', String(s.rank).padStart(6), s.host.padEnd(28), s.words + 'w', s.links + 'l', '|', s.title);
}
