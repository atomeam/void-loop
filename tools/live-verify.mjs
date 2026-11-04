// After a deploy: every changed page returns 200. When tools/agent-probe.mjs is on the commit, the workflow runs it too.
//   node tools/live-verify.mjs --base https://a-to-mind.com --names names.txt
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** repo paths of changed pages -> site paths. Pure. */
export function pagesIn(names) {
  const out = [];
  for (const f of names || []) {
    if (!/^void-live-deploy\/(?:[^/]+\/)*index\.html$/.test(f)) continue;
    const path = '/' + f.slice('void-live-deploy/'.length).replace(/index\.html$/, '');
    if (!out.includes(path)) out.push(path);
  }
  return out;
}

/** fetch each path. Retries the whole list once when a try is left and one page missed. */
export async function checkPages(base, paths, fetchImpl = fetch, { tries = 1, pause = async () => {} } = {}) {
  const root = String(base || '').replace(/\/$/, '');
  let out = [];
  for (let t = 0; t < tries; t++) {
    out = [];
    for (const path of paths || []) {
      try {
        const r = await fetchImpl(root + path);
        out.push({ path, status: r && r.status, ok: !!(r && r.status === 200) });
      } catch (_) { out.push({ path, status: 0, ok: false }); }
    }
    if (out.every((x) => x.ok) || t === tries - 1) break;
    await pause();
  }
  return out;
}

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : ''; }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const names = existsSync(arg('--names')) ? readFileSync(arg('--names'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean) : [];
  const paths = pagesIn(names);
  if (!paths.length) { console.log('no changed page'); process.exit(0); }
  const out = await checkPages(arg('--base') || 'https://a-to-mind.com', paths, fetch, { tries: 2, pause: () => new Promise((r) => setTimeout(r, 20000)) });
  for (const row of out) console.log((row.ok ? 'ok  ' : 'FAIL') + ' ' + row.status + ' ' + row.path);
  process.exit(out.every((x) => x.ok) ? 0 : 1);
}
