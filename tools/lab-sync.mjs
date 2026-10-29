// The lab sync (owner, 2026-10-29: "get all these live and working too"): new experiments from the lab repo become live pages, tested first.
//   node tools/lab-sync.mjs                         clone github atomeam/a-to-mind.com (depth 1), import and test what is new or changed, publish
//   node tools/lab-sync.mjs --drafts <drafts dir>   use a drafts folder you already have (no clone)
//   node tools/lab-sync.mjs --all                   re-import and re-test every draft (after the wrapper in lab-import.mjs changed)
//   node tools/lab-sync.mjs --only slug,slug        just these drafts
// Steps: import the new or changed drafts into a temp folder, open each in headless Chromium (tools/lab-probe.mjs), publish the ones that run into
// void-live-deploy/lab/ (the ones that need WebGPU or WebXR get the honest notice), write catalog.json, the /lab/ gallery and domains/lab.broken.md,
// then refresh the sitemap. A broken draft is not published; it gets a queue-ready line in domains/lab.broken.md. Nothing is ever deleted.
// docs/playbooks/lab.md has the whole story. Run it under node tools/heavy.mjs when another browser job might be running.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LAB_DIR, readDrafts, metaOf, hashOf, importDrafts, readCatalog, writeCatalog, brokenMd, needsOf } from './lab-import.mjs';
import { probe, classify, hasFallback, sourceOf } from './lab-probe.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = 'https://github.com/atomeam/a-to-mind.com';

/** which drafts to test: new ones, ones whose page or SPEC changed since the catalog, or all / the named ones. Pure. */
export function pending(drafts, catalog, { all = false, only = null } = {}) {
  const have = new Map(catalog.map((e) => [e.slug, e]));
  return drafts.map((d) => ({ d, meta: metaOf(d.dir, d.html, d.spec), hash: hashOf(d) }))
    .filter(({ meta, hash }) => (only ? only.has(meta.slug) : all || !have.has(meta.slug) || have.get(meta.slug).hash !== hash));
}
/** the catalog with the new results merged in by slug (an old entry stays unless replaced). Pure. */
export function merge(catalog, entries) {
  const by = new Map(catalog.map((e) => [e.slug, e])); for (const e of entries) by.set(e.slug, e);
  return [...by.values()].sort((a, b) => (b.num - a.num) || (a.slug < b.slug ? -1 : 1));
}

export async function sync({ drafts, all = false, only = null, lab = LAB_DIR, log = console.log }) {
  const catalog = readCatalog(lab), todo = pending(readDrafts(drafts), catalog, { all, only });
  if (!todo.length) { log('lab-sync: nothing new or changed'); return { entries: [], catalog }; }
  const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-stage-')), slugs = new Set(todo.map((t) => t.meta.slug));
  const cut = new Map(importDrafts({ drafts, out: stage, only: slugs }).filter((r) => r.error).map((r) => [r.slug, r.error])); // a file cut off mid-write is never opened
  const rows = await probe({ labDir: stage, slugs: [...slugs].filter((x) => !cut.has(x)), log: () => process.stderr.write('.') });
  const entries = todo.map(({ meta, hash }) => {
    if (cut.has(meta.slug)) return { slug: meta.slug, num: meta.num, title: meta.title, blurb: meta.blurb, status: 'broken', error: cut.get(meta.slug), source: meta.source, hash };
    const row = rows.find((r) => r.slug === meta.slug), src = sourceOf(stage, meta.slug), needs = needsOf(src);
    const v = classify({ needs, fallback: hasFallback(src) }, row);
    return { slug: meta.slug, num: meta.num, title: meta.title, blurb: meta.blurb, status: v.status, ...(needs.length ? { needs } : {}), ...(v.error ? { error: v.error } : {}), source: meta.source, hash };
  });
  const now = merge(catalog, entries), publish = new Set(entries.filter((e) => e.status !== 'broken').map((e) => e.slug));
  const notice = new Set(now.filter((e) => e.status.startsWith('needs-')).map((e) => e.slug));
  importDrafts({ drafts, out: lab, only: publish, noticeFor: notice });
  writeCatalog(now, lab);
  fs.writeFileSync(path.join(root, 'domains', 'lab.broken.md'), brokenMd(now));
  fs.rmSync(stage, { recursive: true, force: true });
  const by = {}; for (const e of entries) by[e.status] = (by[e.status] || 0) + 1;
  log('\nlab-sync: ' + entries.length + ' tested ' + JSON.stringify(by) + '; ' + now.length + ' in the catalog');
  for (const e of entries.filter((x) => x.status === 'broken')) log('  broken ' + e.slug + ': ' + e.error);
  const stale = entries.filter((e) => e.status === 'broken' && fs.existsSync(path.join(lab, e.slug, 'index.html')));
  for (const e of stale) log('  note: ' + e.slug + ' is published from an earlier import but now fails; remove its folder by hand if it should go');
  return { entries, catalog: now };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  let drafts = arg('--drafts'), tmp = null;
  if (!drafts) {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lab-src-'));
    const r = spawnSync('git', ['clone', '--depth', '1', REPO, tmp], { stdio: 'inherit' });
    if (r.status !== 0) { console.error('lab-sync: could not clone ' + REPO + ' (is it private now? then pass --drafts <a clone\'s drafts folder>)'); process.exit(1); }
    drafts = path.join(tmp, 'drafts');
  }
  const { entries } = await sync({ drafts: path.resolve(drafts), all: argv.includes('--all'), only: arg('--only') ? new Set(arg('--only').split(',')) : null });
  if (entries.length) { const r = spawnSync(process.execPath, [path.join(root, 'tools', 'sitemap.mjs')], { cwd: root, stdio: 'inherit' }); if (r.status !== 0) process.exit(r.status || 1); }
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
}
