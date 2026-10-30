// Write void-live-deploy/autopilot/snapshot.json just before a deploy uploads (.github/workflows/deploy.yml), with the workflow's own token.
// The live /api/autopilot reads GitHub from Cloudflare's shared addresses, which GitHub answers 403 without a token (live 2026-10-30), so the
// GitHub parts of a-to-mind.com/autopilot/ (Verse's own commits on main, deploy runs) come from this file, read at deploy time: the same
// records readAutopilot reads live, for the 24 h and 7 day windows, never committed (the deploy is several times an hour).
//   GITHUB_TOKEN=... node tools/autopilot-snapshot.mjs     writes the file; a source that does not answer is recorded as such, never filled in
import { writeFileSync } from 'node:fs';
import { status as keyStatus } from './key-keeper.mjs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAutopilot } from '../void-live-deploy/functions/api/autopilot.js';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'autopilot', 'snapshot.json');

export async function snapshot(env, fetchFn = fetch, now = Date.now()) {
  const windows = {};
  for (const days of [1, 7]) {
    const w = await readAutopilot(env, days, fetchFn, now);
    delete w.conductor; delete w.sources.conductor; // the conductor's record is read live (raw.githubusercontent answers Cloudflare)
    windows[days] = w;
  }
  // Verse's own keys (tools/key-keeper.mjs): can the keymaster mint each job's key? names and yes/no only, never a value
  let keys = null; try { const k = await keyStatus(env, fetchFn); keys = { keymaster: k.keymaster, jobs: k.jobs.map((j) => ({ job: j.job, ok: j.ok })) }; } catch (_) { /* no answer: the page says so */ }
  return { at: new Date(now).toISOString(), windows, keys };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  const snap = await snapshot({ GITHUB_TOKEN: token, CF_KEYMASTER_TOKEN: process.env.CF_KEYMASTER_TOKEN, CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID });
  writeFileSync(OUT, JSON.stringify(snap) + '\n');
  const w = snap.windows[1];
  console.log('autopilot snapshot: ' + (w.sources.commits === 'ok' ? w.ownCount + ' own commits' : 'commits: ' + w.sources.commits) + ', ' + (w.sources.deploys === 'ok' ? w.deploys + ' deploys' : 'deploys: ' + w.sources.deploys) + ' in 24 h');
}
