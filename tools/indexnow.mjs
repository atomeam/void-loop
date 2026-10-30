#!/usr/bin/env node
// IndexNow after a deploy (owner, 2026-10-26: "wire IndexNow into the deployment pipeline so that search engines utilizing the protocol (like
// Bing and Yandex) are notified within minutes whenever new single-purpose utility pages go live"). deploy.yml runs it once a-to-mind.com
// serves the new deploy: the files that changed since the last successful deploy are mapped to their pages (tools/indexnow-urls.mjs, with
// tools/sitemap.mjs's list of which files make each page), only URLs listed in void-live-deploy/sitemap.xml are kept, and they go to
// api.indexnow.org in one POST (it shares them with every IndexNow engine). Nothing listed changed: nothing is sent. Not Cloudflare: one
// request to IndexNow per deploy that changed a listed page. It never fails a deploy: any engine or network error is logged, exit 0.
//   node tools/indexnow.mjs --base <sha> [--head <sha>]   the listed pages changed in base..head (head defaults to HEAD)
//   node tools/indexnow.mjs                               no base (a first deploy): every listed page
//   --dry-run                                             print what would be sent, send nothing
// The key is read from its file at the site root (void-live-deploy/<key>.txt holding the key), never written here.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENDPOINT, sitemapUrls, keyFromFile, changedUrls, bodies, meaning } from './indexnow-urls.mjs';
import { pages, SITE, OUT } from './sitemap.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : ''; };
const dry = args.includes('--dry-run');
const git = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' });
const summary = (line) => { try { if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + '\n'); } catch (_) {} };
const isCommit = (sha) => /^[0-9a-f]{7,40}$/i.test(sha) && !/^0+$/.test(sha) && git('cat-file', '-e', sha + '^{commit}').status === 0;

async function main() {
  const listed = sitemapUrls(readFileSync(resolve(root, OUT), 'utf8'));
  const keyFile = readdirSync(resolve(root, 'void-live-deploy')).find((n) => keyFromFile(n, n.endsWith('.txt') ? readFileSync(resolve(root, 'void-live-deploy', n), 'utf8') : ''));
  if (!keyFile) { console.log('IndexNow: no key file (void-live-deploy/<key>.txt holding the key): nothing sent'); return; }
  const key = keyFile.slice(0, -4), host = new URL(SITE).host;

  const base = opt('--base') || process.env.INDEXNOW_BASE || '', head = opt('--head') || 'HEAD';
  let urls, why;
  if (isCommit(base)) {
    const d = git('diff', '--name-only', base, head);
    if (d.status !== 0) { console.log('IndexNow: git diff ' + base + '..' + head + ' failed: ' + d.stderr.trim() + ': nothing sent'); return; }
    const changed = d.stdout.split('\n').filter(Boolean);
    const fixPages = JSON.parse(readFileSync(resolve(root, 'tools/fix-pages.json'), 'utf8'));
    urls = changedUrls(changed, pages({ fixPages }), listed, SITE);
    why = changed.length + ' files changed in ' + base.slice(0, 9) + '..' + head.slice(0, 9);
  } else {
    if (base) console.log('IndexNow: base ' + base + ' is not a commit here: treating this as a first deploy');
    urls = listed;
    why = 'no base deploy: every listed page';
  }
  console.log('IndexNow: ' + why + '; ' + urls.length + ' of ' + listed.length + ' listed pages to send');
  if (!urls.length) { summary('IndexNow: no listed page changed, nothing sent'); return; }
  for (const u of urls) console.log('  ' + u);

  for (const body of bodies(urls, { host, key, keyLocation: SITE + '/' + keyFile })) {
    if (dry) { console.log('IndexNow --dry-run: would POST ' + body.urlList.length + ' URLs to ' + ENDPOINT + ' (host ' + host + ', keyLocation ' + body.keyLocation + ')'); continue; }
    try {
      const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
      const m = meaning(r.status), text = (await r.text().catch(() => '')).slice(0, 300);
      const line = 'IndexNow: ' + r.status + ' ' + m.text + ' (' + body.urlList.length + ' URLs)' + (text ? ': ' + text : '');
      console.log(line); summary(line);
      if (!m.ok) console.log('::warning title=IndexNow::' + line);
    } catch (e) {
      const line = 'IndexNow: request failed (' + (e && e.message) + '); the deploy is unaffected';
      console.log('::warning title=IndexNow::' + line); summary(line);
    }
  }
}

main().catch((e) => console.log('IndexNow: ' + (e && e.message) + ' (the deploy is unaffected)')).finally(() => process.exit(0));
