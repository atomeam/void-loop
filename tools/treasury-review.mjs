#!/usr/bin/env node
// Verse's weekly treasury review (.github/workflows/treasury.yml, Mondays). Asks the live treasury to review itself (POST /api/treasury
// { action: 'review' }: learn from measured returns, move unspent bucket money toward what worked), reads Gumroad's sales API into the
// ledger when the site has a token, then applies Verse's own rule for Atom's cut (lib/treasury.js reviseCut) and, when it changes,
// writes the new share and its public reason into void-live-deploy/treasury/policy.json's history.
//   node tools/treasury-review.mjs         (VOID_OWNER_TOKEN for the review; without it only the cut rule runs, on the public ledger)
//   node tools/treasury-review.mjs --dry   print, write nothing
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reviseCut } from '../void-live-deploy/lib/treasury.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(root, 'void-live-deploy/treasury/policy.json');

/** the realized revenue of the last 30 days from the weekly snapshots (oldest one at least 30 days old, else the oldest). Pure. */
export function trailing30(snapshots, nowCents, now = Date.now()) {
  const old = (snapshots || []).filter((s) => now - Date.parse(s.at) >= 30 * 864e5).pop() || (snapshots || [])[0];
  return old ? Math.max(0, nowCents - old.realized_cents) : nowCents;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dry = process.argv.includes('--dry'), site = process.env.VOID_SITE || 'https://a-to-mind.com', token = process.env.VOID_OWNER_TOKEN;
  const post = async (body) => { try { const r = await fetch(site + '/api/treasury', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) }); return await r.json(); } catch (e) { return { error: String(e) }; } };
  if (token && !dry) {
    console.log('reconcile:', JSON.stringify(await post({ action: 'reconcile' })));
    const rv = await post({ action: 'review' });
    console.log('review:', rv.reason || JSON.stringify(rv));
  } else console.log('review: no VOID_OWNER_TOKEN (or --dry): the live review is skipped');
  const t = await (await fetch(site + '/api/treasury', { signal: AbortSignal.timeout(60000) })).json();
  const policy = JSON.parse(readFileSync(FILE, 'utf8'));
  const now = new Date().toISOString();
  const running30 = (t.entries || []).filter((e) => e.kind === 'spend' && e.status === 'executed' && Date.now() - Date.parse(e.at) < 30 * 864e5).reduce((n, e) => n + e.cents, 0);
  const realized30 = trailing30(policy.snapshots, t.revenue.realized_cents);
  const change = reviseCut(policy, { realized30, running30, reserve: t.pots.reserve });
  policy.snapshots = [...(policy.snapshots || []), { at: now.slice(0, 10), realized_cents: t.revenue.realized_cents }].slice(-8);
  if (change) {
    policy.history.push({ at: now.slice(0, 10), change: "Atom's cut " + Math.round(policy.owner_cut.share * 100) + '% -> ' + Math.round(change.share * 100) + '%', why: change.reason });
    policy.owner_cut.share = change.share; policy.version += 1; policy.updated = now.slice(0, 10);
  }
  console.log("Atom's cut: " + Math.round(policy.owner_cut.share * 100) + '%' + (change ? ' (changed: ' + change.reason + ')' : ' (unchanged)') + '; realized, last 30 days: $' + (realized30 / 100).toFixed(2));
  if (!dry) writeFileSync(FILE, JSON.stringify(policy, null, 2) + '\n');
}
