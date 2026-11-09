// Keeps a-to-mind.com serving a whole Verse (incident 2026-11-09, 2:34-2:39 and 2:51-3:18 AM New York): Cloudflare Pages' own Git
// integration built pushes to main from the repo root, with no build step, so the deployment had no index.html, no Functions bundle and
// none of the generated files (tools.json, build.json, skills/index.json). Every page, /tools.json, /api/answer and /api/mcp answered an
// empty 404 until the wrangler deploy (deploy.yml: void-live-deploy after tools/refresh.mjs) went out again. Only deploy.yml deploys.
//   node tools/pages-guard.mjs pause-git        turn off the Pages Git integration's automatic builds (production and preview)
//   node tools/pages-guard.mjs check <url>      exit 1 unless <url> serves the page, /tools.json (100+ tools) and a /api/answer answer
//   node tools/pages-guard.mjs heal [--bad <deployment url>]
//                                               when a-to-mind.com fails the check, roll production back to the newest production
//                                               deployment that passes it (never <deployment url>); exit 1 if none could be restored
//   node tools/pages-guard.mjs guard            pause-git, then heal (pages-guard.yml: after every push to main and every 15 minutes)
// Needs CLOUDFLARE_API_TOKEN (Account > Cloudflare Pages > Edit) and CLOUDFLARE_ACCOUNT_ID in the environment, never in a file.
const PROJECT = 'a-to-mind', LIVE = 'https://a-to-mind.com', MIN_TOOLS = 100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('pages-guard:', ...a);

export async function probe(base, fetcher = fetch) {
  base = String(base).replace(/\/+$/, '');
  const bust = 'guard=' + Date.now(), fails = [];
  try {
    const r = await fetcher(base + '/?' + bust, { redirect: 'follow' });
    const t = await r.text();
    if (r.status !== 200 || !/<title>[^<]+<\/title>/i.test(t)) fails.push('/ HTTP ' + r.status + ', ' + t.length + ' bytes');
  } catch (e) { fails.push('/ ' + e.message); }
  try {
    const r = await fetcher(base + '/tools.json?' + bust);
    const t = await r.text();
    let n = -1; try { n = (JSON.parse(t).tools || []).length; } catch (_) {}
    if (r.status !== 200 || n < MIN_TOOLS) fails.push('/tools.json HTTP ' + r.status + ', ' + t.length + ' bytes, ' + Math.max(n, 0) + ' tools');
  } catch (e) { fails.push('/tools.json ' + e.message); }
  try {
    const r = await fetcher(base + '/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: 'what is 2 plus 2' }) });
    const t = await r.text();
    let ok = false; try { ok = typeof JSON.parse(t).answer === 'string'; } catch (_) {}
    if (r.status !== 200 || !ok) fails.push('/api/answer HTTP ' + r.status + ', ' + t.length + ' bytes');
  } catch (e) { fails.push('/api/answer ' + e.message); }
  return fails;
}

// three looks 10 s apart: one slow answer is not a broken site
export async function healthy(base, { tries = 3, wait = 10000, fetcher = fetch } = {}) {
  let fails = [];
  for (let i = 0; i < tries; i++) {
    fails = await probe(base, fetcher);
    if (!fails.length) return { ok: true, fails };
    log(base, 'attempt ' + (i + 1) + ':', fails.join('; '));
    if (i < tries - 1) await sleep(wait);
  }
  return { ok: false, fails };
}

function cf() {
  const token = process.env.CLOUDFLARE_API_TOKEN, account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account) { console.error('pages-guard: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set'); process.exit(2); }
  const base = 'https://api.cloudflare.com/client/v4/accounts/' + account + '/pages/projects/' + PROJECT;
  return async (path, init = {}) => {
    const r = await fetch(base + path, { ...init, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', ...(init.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.success === false) throw new Error((init.method || 'GET') + ' ' + path + ': HTTP ' + r.status + ' ' + JSON.stringify(j.errors || []));
    return j.result;
  };
}

export function pausedConfig(config = {}) {
  return { ...config, deployments_enabled: false, production_deployments_enabled: false, preview_deployment_setting: 'none' };
}

export async function pauseGit(api = cf()) {
  const p = await api('');
  const src = p.source;
  if (!src || !src.type) { log('no Git integration on the project: only wrangler deploys it'); return false; }
  const c = src.config || {};
  log('Git integration:', src.type, (c.owner || '?') + '/' + (c.repo_name || '?'), 'auto deploys', c.deployments_enabled !== false ? 'on' : 'off',
    '· production', c.production_deployments_enabled !== false ? 'on' : 'off', '· previews', c.preview_deployment_setting || '?',
    '· build', JSON.stringify(p.build_config || {}));
  if (c.deployments_enabled === false && c.production_deployments_enabled === false && c.preview_deployment_setting === 'none') { log('Git builds already off'); return false; }
  await api('', { method: 'PATCH', body: JSON.stringify({ source: { type: src.type, config: pausedConfig(c) } }) });
  log('Git builds turned off: only deploy.yml (wrangler, void-live-deploy) deploys a-to-mind now');
  return true;
}

export function candidates(deployments, bad = '') {
  const norm = (u) => String(u || '').replace(/\/+$/, '');
  return (deployments || [])
    .filter((d) => d && d.environment === 'production' && norm(d.url) !== norm(bad))
    .filter((d) => !d.latest_stage || d.latest_stage.status === 'success')
    .sort((a, b) => String(b.created_on).localeCompare(String(a.created_on)));
}

export async function heal({ bad = '', api = cf(), live = LIVE } = {}) {
  const now = await healthy(live);
  if (now.ok) { log(live, 'is healthy'); return true; }
  log(live, 'is broken:', now.fails.join('; '));
  const list = await api('/deployments?env=production&per_page=25');
  for (const d of candidates(list, bad)) {
    const trig = (d.deployment_trigger || {}), sha = ((trig.metadata || {}).commit_hash || '').slice(0, 7);
    const h = await healthy(d.url, { tries: 1 });
    log('candidate', d.url, trig.type || '?', sha, d.created_on, h.ok ? 'healthy' : 'broken: ' + h.fails.join('; '));
    if (!h.ok) continue;
    await api('/deployments/' + d.id + '/rollback', { method: 'POST' });
    log('rolled production back to', d.url, '(' + sha + ', ' + d.created_on + ')');
    await sleep(15000);
    const after = await healthy(live, { tries: 6 });
    if (after.ok) { log(live, 'healthy again'); return true; }
    log(live, 'still failing after the rollback:', after.fails.join('; '));
  }
  console.error('::error::pages-guard: a-to-mind.com is broken and no healthy production deployment could be restored');
  return false;
}

const main = async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  const opt = (k) => { const i = rest.indexOf(k); return i > -1 ? rest[i + 1] : ''; };
  if (cmd === 'check') { const h = await healthy(rest[0] || LIVE); if (!h.ok) { console.error('::error::' + (rest[0] || LIVE) + ' failed: ' + h.fails.join('; ')); process.exit(1); } log(rest[0] || LIVE, 'healthy'); return; }
  if (cmd === 'pause-git') { await pauseGit(); return; }
  if (cmd === 'heal') { process.exit((await heal({ bad: opt('--bad') })) ? 0 : 1); }
  if (cmd === 'guard') {
    let paused = true;
    try { await pauseGit(); } catch (e) { paused = false; console.error('::warning::pages-guard: could not turn off Git builds: ' + e.message); }
    const ok = await heal();
    process.exit(ok && paused ? 0 : 1);
  }
  console.error('usage: node tools/pages-guard.mjs pause-git | check <url> | heal [--bad <url>] | guard'); process.exit(2);
};
if (import.meta.url === 'file://' + process.argv[1]) main().catch((e) => { console.error('pages-guard:', e.message); process.exit(1); });
