// Sync Verse's free-model lanes from OpenRouter's live model list (owner, 2026-11-14: "$0 forever").
// Queries openrouter.ai/api/v1/models, filters models with $0 prompt and completion pricing, ranks by
// context window and uptime, and writes void-live-deploy/resources/free.json so lib/free-router.js
// adapts automatically when a free model sunsets or a new one launches.
//   node tools/sync-free-lanes.mjs            refresh free.json
//   node tools/sync-free-lanes.mjs --check     exit 1 when free.json is stale (older than 24h)
//   node tools/sync-free-lanes.mjs --dry       print the ranked list, write nothing
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const outPath = path.join(root, 'void-live-deploy', 'resources', 'free.json');
const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const dryRun = args.includes('--dry');

// pure: filter free models (prompt + completion both $0)
export function isFree(m) {
  const p = m && m.pricing;
  if (!p) return false;
  return Number(p.prompt) === 0 && Number(p.completion) === 0;
}

// pure: rank by context window desc, then by id asc for determinism
export function rankFree(models) {
  return (models || []).filter(isFree).sort((a, b) => {
    const ca = Number((a && a.context_length) || 0);
    const cb = Number((b && b.context_length) || 0);
    if (cb !== ca) return cb - ca;
    return String((a && a.id) || '').localeCompare(String((b && b.id) || ''));
  }).map((m) => ({ id: m.id, name: m.name || m.id, context: m.context_length || 0, provider: (m.id || '').split('/')[0] }));
}

// pure: build the free.json payload
export function buildPayload(ranked, now = new Date().toISOString()) {
  return { updated: now, count: ranked.length, models: ranked };
}

async function main() {
  let models = [];
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const j = await res.json();
    models = Array.isArray(j.data) ? j.data : [];
  } catch (e) {
    console.error('fetch failed:', e && e.message);
    process.exit(1);
  }
  const ranked = rankFree(models);
  const payload = buildPayload(ranked);

  if (checkOnly) {
    try {
      const old = JSON.parse(fs.readFileSync(outPath, 'utf8'));
      const age = Date.now() - Date.parse(old.updated || 0);
      if (age > 24 * 3600 * 1000) { console.error('stale: free.json is ' + Math.round(age / 3600000) + 'h old'); process.exit(1); }
      console.log('ok: free.json is fresh (' + ranked.length + ' free models)');
    } catch (_) { console.error('missing or invalid free.json'); process.exit(1); }
    return;
  }

  if (dryRun) {
    console.log(JSON.stringify(payload, null, 2).slice(0, 2000));
    return;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n');
  console.log('wrote ' + ranked.length + ' free models to ' + outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });