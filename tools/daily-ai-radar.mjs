#!/usr/bin/env node
// Dry-run discovery scanner. Reads primary AI feeds, dedupes, diffs against Verse's skill inventory, and prints
// up to three `job:` specs. IT WRITES NOTHING AND ENQUEUES NOTHING: no #work, no auto-build, no PR. Auto-enqueue
// is a separate decision (grow-self.yml carries the owner's rule against scheduled self-hardening).
//   node tools/daily-ai-radar.mjs --dry-run     fetch and print specs (no writes)
//   node tools/daily-ai-radar.mjs --self-test   offline test of the pure parsers and diff
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..');
const SEEN = resolve(root, 'data/ai-radar-seen.json');
const INDEX = resolve(root, 'void-live-deploy/skills/index.json');
const TIMEOUT_MS = 8000;
const UA = { 'user-agent': 'VerseRadar/1.0 (https://a-to-mind.com; read-only discovery)', accept: 'application/json, application/atom+xml, text/html' };
const STOP = new Set('with from that this the and for are but you can its our your into use using based more new tool tools model models ai ml data open source free enable makes made help build makes about into over under'.split(' '));

/** a fair title or description line from mixed markup. Pure. */
export function plain(s) { return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim(); }
/** Hugging Face daily papers response -> candidates. Pure. */
export function hfDaily(json) {
  const rows = Array.isArray(json) ? json : ((json || {}).dailyPapers || (json || {}).papers || []);
  return rows.map((r) => r && (r.paper || r)).filter(Boolean).map((p) => ({ id: String(p.id || p.paperId || p.title || ''), title: plain(p.title), url: String(p.url || (p.id ? 'https://huggingface.co/papers/' + p.id : '')), summary: plain(p.summary || p.ai_keyword || '').slice(0, 240), source: 'daily papers' })).filter((x) => x.title && x.url);
}
/** arXiv Atom response -> candidates. Pure. */
export function arxivFeed(xml) {
  const out = [];
  for (const m of String(xml || '').matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1], tag = (n) => plain((e.match(new RegExp('<' + n + '[^>]*>([\\s\\S]*?)</' + n + '>')) || [])[1]);
    const link = (e.match(/<id>([\s\S]*?)<\/id>/) || [])[1] || (e.match(/href="([^"]+)"/) || [])[1] || '';
    if (tag('title')) out.push({ id: plain(link) || tag('title'), title: tag('title'), url: plain(link), summary: tag('summary').slice(0, 240), source: 'research paper' });
  }
  return out;
}
/** GitHub repository search response -> candidates. Pure. */
export function githubRepos(json) {
  return (((json || {}).items) || []).map((r) => ({ id: 'repo:' + String(r.id || r.full_name || ''), title: String(r.name || ''), url: String(r.html_url || ''), summary: plain(r.description).slice(0, 240), source: 'open-source repository' })).filter((x) => x.url && x.title);
}
/** significant comparison tokens. Pure. */
export function tokens(s) { return plain(s).toLowerCase().split(/[^a-z0-9+]+/).filter((w) => w.length >= 4 && !STOP.has(w)); }
/** a candidate is novel when no existing skill shares two or more significant tokens with it. Pure. */
export function isNovel(item, skills) {
  const want = new Set(tokens(item.title));
  if (want.size < 2) return false;
  return !skills.some((skill) => { const have = tokens(skill); let shared = 0; for (const w of want) if (have.includes(w) && ++shared >= 2) return true; return false; });
}
export const seenKey = (x) => x.source + ':' + x.id.toLowerCase();
/** a plain, bounded job spec: a request for a builder, never an enqueue. Pure. */
export function jobSpec(x) {
  return 'job: build a native Verse skill for ' + x.title + '\n'
    + 'SOURCE: ' + x.source + ' — ' + x.url + '\n'
    + 'WHAT: ' + (x.summary || 'A concrete capability this source describes.') + '\n'
    + 'SPEC (follow strictly — change only what this asks):\n'
    + '1. Confirm the capability is real and runnable without a key the repo cannot hold.\n'
    + '2. Build the smallest useful skill that does the job on a-to-mind.com; reuse existing tools before writing new code.\n'
    + '3. Add a targeted test, run node tools/pre-pr.mjs and VOID_SKIP_BENCH=1 node tools/checks.mjs --changed, and open one PR to main with label automerge.\n';
}
export function readJson(p, fallback) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (_) { return fallback; } }

async function get(url, fetchImpl) {
  const r = await fetchImpl(url, { headers: UA, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!r.ok) throw new Error(url + ' answered ' + r.status);
  return r.json ? (url.includes('arxiv') ? r.text() : r.json()) : r.text();
}

/** the three primary feeds, each independent: one failing source never hides the others. */
export async function collect(fetchImpl = fetch, now = new Date()) {
  const day = now.toISOString().slice(0, 10), out = [], warnings = [];
  const feeds = [
    ['daily papers', 'https://huggingface.co/api/daily_papers?limit=20', hfDaily],
    ['research paper', 'https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=20', arxivFeed],
    ['open-source repository', 'https://api.github.com/search/repositories?q=created:>' + day + '+topic:artificial-intelligence&sort=stars&order=desc&per_page=10', githubRepos],
  ];
  for (const [name, url, parse] of feeds) {
    try { out.push(...parse(await get(url, fetchImpl))); }
    catch (e) { warnings.push(name + ': ' + String(e.message || e).slice(0, 100)); }
  }
  return { items: out, warnings };
}

function selfTest() {
  const papers = hfDaily([{ id: '2401.1', title: 'A new speech-to-SDF program synthesizer', summary: 'Speech in, 3D shapes out.' }]);
  const papers2 = arxivFeed('<feed><entry><id>http://arxiv.org/abs/2401.2</id><title>Weather nowcasting from radar</title><summary>Rain next hour.</summary></entry></feed>');
  const repos = githubRepos({ items: [{ id: 7, name: 'tiny-vector-store', html_url: 'https://github.com/x/tiny-vector-store', description: 'A small local vector index' }] });
  const all = [...papers, ...papers2, ...repos];
  if (all.length !== 3) throw new Error('parsers: expected 3 candidates, got ' + all.length);
  if (!isNovel(all[0], ['notes', 'weather'])) throw new Error('novelty: a new capability should pass');
  if (isNovel({ title: 'Weather nowcasting from radar' }, ['weather-nowcasting-radar', 'notes'])) throw new Error('novelty: a covered capability should be dropped');
  const spec = jobSpec(all[0]);
  if (!/^job: /.test(spec) || !/automerge/.test(spec)) throw new Error('spec: missing required lines');
  console.log('ok daily-ai-radar: parsers, dedupe key, inventory diff and job spec (offline)');
  return 0;
}

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest();
  const { items, warnings } = await collect();
  const seen = new Set((readJson(SEEN, []) || []).map((x) => String(x)));
  const skills = readJson(INDEX, []) || [];
  const fresh = items.filter((x) => !seen.has(seenKey(x))).filter((x) => isNovel(x, skills)).slice(0, 3);
  for (const w of warnings) console.error('warn daily-ai-radar: ' + w);
  if (!fresh.length) { console.log('ok daily-ai-radar: no net-new concrete capabilities today (nothing queued, nothing written)'); return 0; }
  console.log('# daily AI radar — dry run, ' + fresh.length + ' of ' + items.length + ' candidates; nothing queued or written\n');
  for (const x of fresh) console.log(jobSpec(x).trim() + '\n');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).then((code) => process.exit(code)).catch((e) => { console.error('daily-ai-radar: ' + (e.message || e)); process.exit(1); });
