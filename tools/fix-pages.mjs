// The fix pages: one page per common automation error (Zapier, Make, n8n, Power Automate, GitHub Actions), each answering it properly, with Verse's free
// diagnosis one tap away and the One-Time Fix for when it should just be done. People search the exact error text;
// these pages are where they land. Data: tools/fix-pages.json (claims paraphrased from each platform's own help
// center, linked on the page). Writes void-live-deploy/fix/index.html and fix/<slug>/index.html.
//   node tools/fix-pages.mjs           write the pages
//   node tools/fix-pages.mjs --check   exit 1 if a page or the sitemap is out of date (checks.mjs runs this)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isFixAsk } from '../void-live-deploy/lib/automation-fix.js';
import { productById } from '../void-live-deploy/lib/products.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://a-to-mind.com';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fix = productById('one-time-fix');
const BUY = 'https://moonbeam846.gumroad.com/l/' + fix.gumroad.slug;

/** what a person would type into Verse about this error; must be something Verse's fixer takes. Pure. */
export function askOf(p) {
  if (p.ask) return p.ask;
  const err = p.error.split(' · ').filter((x) => !/^(Zap |run on hold|Zapier has)/.test(x)).join(' ');
  const lead = { Make: 'my make scenario is failing with ', n8n: 'my n8n workflow is failing with ', 'Power Automate': 'my power automate flow is failing with ', 'GitHub Actions': 'my github actions workflow is failing with ' };
  return (lead[p.platform] || 'my zap is failing with ') + (err || p.error);
}

const STYLE = `:root { --bg: #0a0a0a; --ink: #ededed; --muted: #9a9a9a; --line: #262626; --card: #141414; --accent: #7aa7ff; }
    :root { color-scheme: dark; } /* deep space in every colour scheme (owner, 2026-10-29: never a stark-white page) */
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 system-ui, -apple-system, sans-serif; }
    main { max-width: 760px; margin: 0 auto; padding: 24px 16px 64px; }
    a { color: var(--accent); }
    h1 { font-size: clamp(26px, 5.5vw, 38px); line-height: 1.15; margin: 18px 0 10px; }
    h2 { font-size: 21px; margin: 34px 0 8px; }
    .lead { font-size: 18px; color: var(--muted); }
    code { font: 14px ui-monospace, Menlo, Consolas, monospace; background: var(--card); border: 1px solid var(--line); border-radius: 6px; padding: 1px 6px; overflow-wrap: anywhere; }
    ol, ul { padding-left: 22px; } li { margin: 8px 0; }
    .help { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin: 34px 0 8px; }
    .box { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; }
    .box h2 { margin: 0 0 4px; font-size: 18px; }
    .box p { margin: 0 0 12px; color: var(--muted); font-size: 15px; }
    .btn { font: 600 15px system-ui, sans-serif; border-radius: 8px; border: 1px solid var(--accent); padding: 9px 16px; text-decoration: none; display: inline-block; }
    .btn.solid { background: var(--accent); color: #fff; }
    .muted { color: var(--muted); font-size: 14px; }`;

const PRICE_JS = `<script>
(function () {
  'use strict';
  const SLUG = ${JSON.stringify(fix.gumroad.slug)};
  function money(x) { return '$' + (x.price_cents / 100).toFixed(x.price_cents % 100 ? 2 : 0); }
  fetch('/api/catalog').then(function (r) { return r.json(); }).then(function (j) {
    const row = (j.products || []).find(function (x) { return x.slug === SLUG || String(x.url || '').split('/l/')[1] === SLUG; });
    if (!row) return; // the page's own price and link stand
    const price = document.getElementById('fix-price'), buy = document.getElementById('fix-buy');
    if (row.price_cents && price) price.textContent = money(row);
    if (row.available === false && buy) { buy.href = '/one-time-fix/'; return; }
    if (/^https:\\/\\//.test(row.url || '') && buy) buy.href = row.url;
  }).catch(function (e) { console.warn('[fix] the live price could not load; the page\\'s own price and link stand', e); });
})();
</script>`;

function head(title, desc, path, ld) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${SITE}${path}">
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${SITE}${path}">
  <meta property="og:image" content="${SITE}/og.png">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
  </script>
  <style>
    ${STYLE}
  </style>
  <script src="/visit.js" defer></script>
</head>
<body>
<main>
  <p><a href="/">&larr; Verse &middot; A-to-Mind</a> &middot; <a href="/fix/">Fix an automation</a></p>
`;
}

function helpBoxes(ask) {
  return `  <div class="help">
    <div class="box">
      <h2>Still stuck? Ask Verse, free</h2>
      <p>Paste the error and what the automation does. Verse names the likely cause and the fix, in seconds, no account.</p>
      <a class="btn" data-fix="ask" href="/?q=${encodeURIComponent(ask)}">Ask Verse about this error</a>
    </div>
    <div class="box">
      <h2>Or have it fixed: <span id="fix-price">${esc(fix.price)}</span></h2>
      <p>One broken automation, diagnosed and repaired, with proof it runs again. Reply to the receipt with what stopped.</p>
      <a class="btn solid" id="fix-buy" data-fix="buy" href="${BUY}" rel="noopener">Get the One-Time Fix</a>
    </div>
  </div>
  <p class="muted">The One-Time Fix covers one workflow. <a href="/one-time-fix/">What you send and what you get back</a>. Several workflows breaking? The <a href="/full-stack-audit/">Full Stack Audit</a> reviews them all. Want them watched so this does not happen again? The <a href="/keep-it-running/">Keep-It-Running Plan</a>.</p>
`;
}

export function pageOf(p) {
  const path = '/fix/' + p.slug + '/';
  const desc = p.means.split('. ')[0] + '. What it means and the steps to fix it.';
  const ld = { '@context': 'https://schema.org', '@type': 'TechArticle', headline: p.title, description: desc, url: SITE + path,
    about: p.platform, publisher: { '@type': 'Organization', name: 'A-to-Mind', url: SITE + '/' } };
  return head(p.title, desc, path, ld) + `  <h1>${esc(p.title)}</h1>
  <p class="lead">You see: <code>${esc(p.error)}</code></p>

  <h2>What it means</h2>
  <p>${esc(p.means)}</p>

  <h2>How to fix it</h2>
  <ol>
${p.steps.map((s) => '    <li>' + esc(s) + '</li>').join('\n')}
  </ol>

  <h2>If it keeps coming back</h2>
  <p>${esc(p.again)}</p>

${helpBoxes(askOf(p))}
  <h2>Sources</h2>
  <ul class="muted">
${p.sources.map(([t, u]) => '    <li><a href="' + esc(u) + '" rel="noopener">' + esc(t) + '</a></li>').join('\n')}
  </ul>
</main>
${PRICE_JS}
</body>
</html>
`;
}

export function hubOf(pages) {
  const platforms = [...new Set(pages.map((p) => p.platform))]; // in the order the data lists them
  const named = platforms.length > 1 ? platforms.slice(0, -1).join(', ') + ' and ' + platforms[platforms.length - 1] : platforms.join('');
  const title = 'Fix a broken automation: ' + named + ' errors, explained';
  const desc = 'The errors that stop ' + named + ' automations, each with what it means and the steps to fix it. Ask Verse free, or have it fixed.';
  const ld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description: desc, url: SITE + '/fix/',
    hasPart: pages.map((p) => ({ '@type': 'TechArticle', headline: p.title, url: SITE + '/fix/' + p.slug + '/' })) };
  const group = (name) => pages.filter((p) => p.platform === name)
    .map((p) => `    <li><a href="/fix/${p.slug}/">${esc(p.short)}</a> <span class="muted">${esc(p.error)}</span></li>`).join('\n');
  return head(title, desc, '/fix/', ld) + `  <h1>Fix a broken automation</h1>
  <p class="lead">The errors that stop ${esc(named)} automations, each with what it means and the steps that fix it.</p>
${platforms.map((name) => `
  <h2>${esc(name)}</h2>
  <ul>
${group(name)}
  </ul>
`).join('')}
${helpBoxes('my automation stopped working, here is the error:')}
</main>
${PRICE_JS}
</body>
</html>
`;
}

export function build() {
  const pages = JSON.parse(readFileSync(resolve(root, 'tools/fix-pages.json'), 'utf8'));
  const out = new Map([['void-live-deploy/fix/index.html', hubOf(pages)]]);
  for (const p of pages) {
    if (!isFixAsk(askOf(p))) throw new Error('Verse would not take the ask for ' + p.slug + ': ' + askOf(p));
    out.set('void-live-deploy/fix/' + p.slug + '/index.html', pageOf(p));
  }
  return { pages, out };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { pages, out } = build();
  const sitemap = readFileSync(resolve(root, 'void-live-deploy/sitemap.xml'), 'utf8');
  const bad = [];
  for (const [rel, html] of out) {
    const file = resolve(root, rel);
    if (check) { if (!existsSync(file) || readFileSync(file, 'utf8') !== html) bad.push(rel + ' is out of date (node tools/fix-pages.mjs)'); }
    else { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, html); }
  }
  for (const loc of ['/fix/', ...pages.map((p) => '/fix/' + p.slug + '/')]) if (!sitemap.includes('<loc>' + SITE + loc + '</loc>')) bad.push('sitemap.xml has no ' + loc);
  if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
  console.log((check ? 'ok: ' : 'wrote ') + out.size + ' fix pages');
}
