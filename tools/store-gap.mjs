#!/usr/bin/env node
// store-gap jobs become store products (lib/product-gap.js queues `store-gap:<topic>` after 3 asks for something Verse doesn't sell).
// For each topic Verse writes a practical guide pack in its own words (asked of Verse itself at /api/answer, so it is Verse's
// content, no third-party text), checks the files (non-trivial, no trademarks, no secrets, made by Verse), prices it with
// lib/appraise.js against comparable store items, demand and effort, and publishes it through tools/store-publish.mjs:
// live in /store with a public changelog row that carries the "why this price" note (Adam 2026-10-15: Verse is the appraiser).
// Until a paid checkout exists for new products (Stripe off, no Gumroad API key), a gap product is live as pay-what-you-want
// with the appraised price shown as the suggested amount; the moment paid checkout is on, `suggested` becomes its price.
//   node tools/store-gap.mjs --topic "logo design" [--asks 3] [--dry] [--no-upload]
//   node tools/store-gap.mjs queue [--dry]      pulls queued store-gap jobs from /api/queue (VOID_OWNER_TOKEN), one per run
import { publish, readCatalog, trademarkHits, guard, SITE, sync } from './store-publish.mjs';
import { appraise } from '../void-live-deploy/lib/appraise.js';
import { secretsIn } from './secret-scan.mjs';

export const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
export const title = (t) => 'Verse ' + String(t).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) + ' Starter Kit';
const enc = (s) => new TextEncoder().encode(s);

/** the pack's files from Verse's own answers. ask(q) -> text */
export async function gapFiles(topic, ask) {
  const t = topic.replace(/-/g, ' ');
  const parts = [
    ['guide.md', `Write a practical, step-by-step starter guide to ${t} for a beginner: what to do first, the tools (free ones first), common mistakes, and a one-week plan.`],
    ['checklist.md', `Give a short printable checklist for doing ${t} well, as markdown checkboxes.`],
    ['templates.md', `Give three fill-in-the-blank templates someone could reuse for ${t}.`],
  ];
  const out = [];
  for (const [name, q] of parts) { const body = String((await ask(q)) || '').trim(); out.push({ name, data: enc('# ' + title(topic) + ': ' + name.replace('.md', '') + '\n\n' + body + '\n'), origin: 'v01d', text: body }); }
  out.push({ name: 'README.txt', data: enc(title(topic) + '\n\nWritten by Verse (a-to-mind.com) because people kept asking for it. Personal use; share with credit "Verse · a-to-mind.com".\n'), origin: 'v01d', text: 'readme' });
  return out;
}
/** file tests beyond store-publish's guard: real content, no trademarks, no secrets */
export function testFiles(files) {
  const problems = [];
  for (const f of files) {
    const s = new TextDecoder().decode(f.data);
    if (f.name !== 'README.txt' && (f.text || '').length < 200) problems.push(f.name + ': too short to sell (' + (f.text || '').length + ' chars)');
    const tm = trademarkHits(s); if (tm.length) problems.push(f.name + ': trademarked names ' + tm.join(', '));
    if (s.split('\n').some((l) => secretsIn(l).length)) problems.push(f.name + ': looks like it contains a key');
  }
  return { ok: !problems.length, problems };
}
export async function buildGap(topic, { asks = 3, ask, dry = false, noUpload = false, catalog = readCatalog() } = {}) {
  const id = 'v01d-' + slug(topic) + '-kit';
  if (catalog.products.some((p) => p.id === id)) return { skipped: 'already in the store', id };
  const files = await gapFiles(topic, ask);
  const t = testFiles(files); if (!t.ok) throw new Error('file tests stopped ' + id + ':\n  - ' + t.problems.join('\n  - '));
  const comps = catalog.products.filter((p) => p.cents > 0 || p.suggested).map((p) => ({ name: p.name, cents: p.cents || p.suggested }));
  const bytes = files.reduce((s, f) => s + f.data.length, 0);
  const a = appraise({ name: title(topic), effortHours: 2, files: files.map((f) => ({ bytes: f.data.length })) }, { comps, demand: asks, sales: 0 });
  const blurb = `A starter kit for ${topic.replace(/-/g, ' ')}: a step-by-step guide, a checklist and reusable templates, written by Verse. Pay what you want (suggested ${'$' + a.cents / 100}).`;
  const r = await publish({ kind: 'templates', id, name: title(topic), blurb, dry, noUpload, noClip: false, hook: 'You kept asking, so I made it' }, files);
  if (dry) return { id, appraisal: a, bytes, row: r.row };
  const cat = readCatalog(), row = cat.products.find((p) => p.id === id);
  row.suggested = a.cents; row.appraisal = a.note + (a.flags.length ? ' [' + a.flags.join(', ') + ']' : '');
  row.log.push({ at: new Date().toISOString(), what: 'priced by Verse: ' + a.note });
  sync(cat);
  return { id, appraisal: a, row };
}
const v01dAsk = async (q) => { const r = await fetch(SITE + '/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: q }) }); const j = await r.json().catch(() => ({})); return j.answer || ''; };

if (process.argv[1] && process.argv[1].endsWith('store-gap.mjs')) {
  const a = process.argv.slice(2), opt = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d), flag = (k) => a.includes(k);
  const common = { dry: flag('--dry'), noUpload: flag('--no-upload'), ask: v01dAsk };
  if (a[0] === 'queue') {
    const tok = process.env.VOID_OWNER_TOKEN; if (!tok) { console.log('no VOID_OWNER_TOKEN: nothing to read'); process.exit(0); }
    const H = { authorization: 'Bearer ' + tok, 'content-type': 'application/json' };
    const q = await fetch(SITE + '/api/queue', { headers: H }).then((r) => r.json());
    const job = (q.items || []).find((j) => /^store-gap:/.test(j.target) && j.state === 'queued');
    if (!job) { console.log('no queued store-gap jobs'); process.exit(0); }
    const topic = job.target.slice('store-gap:'.length);
    const r = await buildGap(topic, common); console.log(JSON.stringify(r.appraisal || r));
    if (!common.dry) await fetch(SITE + '/api/queue', { method: 'PATCH', headers: H, body: JSON.stringify({ id: job.id, state: 'done', note: 'published ' + r.id }) });
  } else {
    const r = await buildGap(opt('--topic'), { ...common, asks: +opt('--asks', 3) });
    console.log(JSON.stringify({ id: r.id, skipped: r.skipped, price: r.appraisal && r.appraisal.note }));
  }
}
