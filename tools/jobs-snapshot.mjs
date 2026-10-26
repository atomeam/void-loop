// The jobs snapshot (owner, 2026-10-26: the jobs pages answer offline and fast): the newest remote jobs from Remotive, Jobicy and Himalayas, fetched once a day from a
// runner (.github/workflows/jobs-snapshot.yml) and committed as void-live-deploy/jobs/snapshot.json. The pages draw it first, labelled "Snapshot of <date>, not live", and
// replace it with /api/jobs when that answers. Each source is read at most once a day here, within its terms (lib/jobs-core.js): Remotive one call, Jobicy one call,
// Himalayas ten pages of 20, a second apart. Every listing is normalised and scrubbed (emails, phone numbers, addresses and links out of the excerpt; no logo) by
// lib/jobs-core.js; the file is checked again with tools/site-re.mjs scrubPersonal before it is written. A source that does not answer keeps its jobs from the last file.
//   node tools/jobs-snapshot.mjs          fetch and write (exit 1 when no source answered)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES, normalise, merge, checkJob } from '../void-live-deploy/lib/jobs-core.js';
import { scrubPersonal } from './site-re.mjs';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'jobs', 'snapshot.json');
const UA = 'Verse (a-to-mind.com; daily jobs snapshot)';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (url) => { const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA }, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(url + ' -> ' + r.status); return r.json(); };
const CAP = { remotive: 300, jobicy: 200, himalayas: 200 };

/** the snapshot file from each source's jobs and the last file (a source with none keeps its old ones). Pure. */
export function buildSnapshot(got, old, at) {
  const sources = {}, lists = [];
  for (const id of Object.keys(SOURCES)) { const fresh = got[id]; const use = fresh && fresh.length ? fresh : ((old && old.jobs) || []).filter((j) => j.src === id); sources[id] = { ok: !!(fresh && fresh.length), count: use.length, at: fresh && fresh.length ? at : (old && old.sources && old.sources[id] && old.sources[id].at) || null }; lists.push(use.slice(0, CAP[id])); }
  const jobs = merge(...lists).map(checkJob).filter(Boolean).map((j) => ({ ...j, excerpt: scrubPersonal(j.excerpt), title: scrubPersonal(j.title) || j.title }));
  return { about: 'A snapshot of remote job listings, not live: Remotive (remotive.com), Jobicy (jobicy.com) and Himalayas (himalayas.app), each listing linking to its original posting. Written by tools/jobs-snapshot.mjs once a day.', at, sources, jobs };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const got = {}, at = new Date().toISOString();
  try { got.remotive = normalise('remotive', await get(SOURCES.remotive.api + '?limit=' + CAP.remotive)); } catch (e) { console.error('remotive: ' + e.message); }
  try { got.jobicy = normalise('jobicy', await get(SOURCES.jobicy.api + '?count=' + CAP.jobicy)); } catch (e) { console.error('jobicy: ' + e.message); }
  try { const all = []; for (let i = 0; i < 10; i++) { const page = await get(SOURCES.himalayas.api + '?limit=20&offset=' + i * 20); const l = normalise('himalayas', page); all.push(...l); if (l.length < 20) break; await wait(1000); } got.himalayas = all; } catch (e) { console.error('himalayas: ' + e.message); }
  if (!Object.values(got).some((l) => l && l.length)) { console.error('no source answered: the snapshot is left as it was'); process.exit(1); }
  let old = null; try { old = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (_) { old = null; }
  const snap = buildSnapshot(got, old, at); fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(snap) + '\n');
  console.log('wrote jobs/snapshot.json: ' + snap.jobs.length + ' jobs (' + Object.entries(snap.sources).map(([k, v]) => k + ' ' + v.count + (v.ok ? '' : ' kept')).join(', ') + ')');
}
