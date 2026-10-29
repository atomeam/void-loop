#!/usr/bin/env node
// Puts Verse's seeded automations (automations/*.json) on the site through its own door, POST /api/automations with the owner
// token, so every rule passes the same checks a rule made on the card does (lib/automations.js validate). The same id replaces
// a rule, so a second run changes nothing. Owner, 2026-10-14: "make sure Verse has 10 new automations hourly".
//   node tools/automations-seed.mjs --check            validate only (no network): what the fast checks run
//   node tools/automations-seed.mjs [file]             seed (VOID_OWNER_TOKEN, VOID_SITE overrides https://a-to-mind.com)
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { validate } from '../void-live-deploy/lib/automations.js';

export const SEED = new URL('../automations/hourly.json', import.meta.url);
export function load(file = SEED) { return JSON.parse(readFileSync(file, 'utf8')).rules || []; }
export function check(rules) {
  const errors = [], ids = new Set();
  for (const r of rules) {
    const v = validate(r, {});
    if (!v.ok) errors.push(r.id + ': ' + v.errors.join('; '));
    if (ids.has(r.id)) errors.push(r.id + ': the same id twice'); ids.add(r.id);
  }
  return errors;
}
export async function seed(rules, { site = 'https://a-to-mind.com', token, fetchImpl = fetch } = {}) {
  if (!token) throw new Error('VOID_OWNER_TOKEN is not set: only the owner makes automations');
  const out = [];
  for (const rule of rules) {
    const r = await fetchImpl(site.replace(/\/$/, '') + '/api/automations', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ rule }) });
    const j = await r.json().catch(() => ({}));
    out.push({ id: rule.id, ok: r.ok, said: r.ok ? 'saved' : (j.errors || [j.error || 'status ' + r.status]).join('; ') });
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const rules = load(file ? new URL(file, pathToFileURL(process.cwd() + '/')) : SEED), errors = check(rules);
  if (errors.length) { console.error('automations-seed: ' + errors.join('\n')); process.exit(1); }
  if (process.argv.includes('--check')) { console.log('automations-seed: ' + rules.length + ' rules valid'); process.exit(0); }
  seed(rules, { site: process.env.VOID_SITE || undefined, token: process.env.VOID_OWNER_TOKEN }).then((rows) => {
    for (const x of rows) console.log((x.ok ? 'ok   ' : 'FAIL ') + x.id + ' · ' + x.said);
    if (rows.some((x) => !x.ok)) process.exit(1);
  }).catch((e) => { console.error('automations-seed: ' + e.message); process.exit(1); });
}
