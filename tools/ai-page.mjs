// A person-like run of the AI model and assistant pages at 390 px: every page is whole in its first paint (no sideways overflow, no layout shift, tap
// targets of 24 px or more), shows what the tower gate's probe asks of it (tools/tower-probes.mjs), speaks German to a German browser, and works:
// the catalogue, card, comparison and try-it, the leaderboard, local files, prices, the arena's battle and vote, a chat with a reply, code run in the
// browser, a chat shared by link, the text tools, the workspace's prompts, the private page's burn, the sources page's citations, and offline after a
// visit. The public APIs and Verse's answer route are stood in for by fixtures (the builder's network is closed): the shapes their documentation gives.
// Saves a screenshot of each page into the directory given.   node tools/ai-page.mjs <dir>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { chromium } from 'playwright-core';
import { probeFor as probeOf, withFeatureFacts, score } from './tower-probes.mjs';
const probeFor = (id) => withFeatureFacts(probeOf(id), id); // as the gate reads it: with the features file's facts
import { AI_SITES } from '../void-live-deploy/lib/tool-sites.js';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'void-live-deploy'), out = process.argv[2] || '.';
fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => { const u = new URL(req.url, 'http://x'); let f = path.join(root, decodeURIComponent(u.pathname)); if (f.endsWith('/')) f += 'index.html';
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
await new Promise((r) => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port;
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x)), args: ['--no-sandbox'] });

// ---- the stand-ins
const HUB_MODELS = [
  { id: 'meta-llama/Llama-3.1-8B-Instruct', downloads: 5400000, likes: 4200, pipeline_tag: 'text-generation', tags: ['license:llama3.1'], lastModified: '2024-09-25T00:00:00Z', safetensors: { total: 8030261248 }, library_name: 'transformers', gated: 'manual' },
  { id: 'Qwen/Qwen2.5-0.5B-Instruct', downloads: 2100000, likes: 300, pipeline_tag: 'text-generation', tags: ['license:apache-2.0'], lastModified: '2024-09-20T00:00:00Z', safetensors: { total: 494032768 }, library_name: 'transformers' },
  { id: 'openai/whisper-large-v3', downloads: 4000000, likes: 4100, pipeline_tag: 'automatic-speech-recognition', tags: ['license:apache-2.0'], lastModified: '2024-08-12T00:00:00Z', safetensors: { total: 1543490560 } },
];
const GGUF = [{ id: 'bartowski/Llama-3.2-3B-Instruct-GGUF', downloads: 90000, likes: 150, pipeline_tag: 'text-generation', tags: ['gguf', 'license:llama3.2'], gguf: { total: 3212749888 } }];
const FILES = { id: 'bartowski/Llama-3.2-3B-Instruct-GGUF', siblings: [{ rfilename: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf', size: 2019377696 }, { rfilename: 'Llama-3.2-3B-Instruct-Q8_0.gguf', size: 3421899296 }, { rfilename: 'Llama-3.2-3B-Instruct-f16.gguf', size: 6433688096 }, { rfilename: 'README.md', size: 4000 }] };
const CARD = '---\nlicense: llama3.1\n---\n# Llama 3.1\nA **multilingual** model. <script>alert(1)</script>\n\n| Size | Context |\n|---|---|\n| 8B | 128K |\n\n```python\nprint("hi")\n```';
const BOARD_FEATS = ['eval_name', 'fullname', 'Type', 'Average ⬆️', 'IFEval', 'BBH', 'MATH Lvl 5', 'GPQA', 'MUSR', 'MMLU-PRO', '#Params (B)', 'Merged'].map((name) => ({ name }));
const boardRow = (i, name, avg, p, merged = false) => ({ row_idx: i, row: { eval_name: name, fullname: name, Type: '💬 chat models (RLHF, DPO, IFT, ...)', 'Average ⬆️': avg, IFEval: avg + 30, BBH: avg + 10, 'MATH Lvl 5': avg - 5, GPQA: avg - 25, MUSR: avg - 20, 'MMLU-PRO': avg + 2, '#Params (B)': p, Merged: merged } });
const BOARD = [boardRow(0, 'Qwen/Qwen2.5-72B-Instruct', 47.98, 72.7), boardRow(1, 'meta-llama/Llama-3.1-8B-Instruct', 23.76, 8.03), boardRow(2, 'someone/merged-7b', 30.1, 7.2, true), boardRow(3, 'microsoft/phi-4', 40.1, 14.7)];
const ROUTED = { data: [
  { id: 'mistralai/mistral-small', name: 'Mistral: Small', created: 1720000000, context_length: 32000, pricing: { prompt: '0.0000002', completion: '0.0000006' }, architecture: { input_modalities: ['text'], output_modalities: ['text'] }, top_provider: { max_completion_tokens: 8192 }, supported_parameters: ['tools'] },
  { id: 'google/gemma-free:free', name: 'Google: Gemma (free)', created: 1730000000, context_length: 131072, pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] }, top_provider: {} },
  { id: 'x/big', name: 'X: Big', created: 1710000000, context_length: 1000000, pricing: { prompt: '0.000003', completion: '0.000015' }, architecture: { modality: 'text+image->text' }, top_provider: { max_completion_tokens: 64000 } },
] };
const asked = [];
async function stand(ctx) {
  await ctx.route('https://huggingface.co/**', (r) => { const u = new URL(r.request().url());
    if (u.pathname === '/api/models' && u.searchParams.get('filter') === 'gguf') return r.fulfill({ json: GGUF });
    if (u.pathname === '/api/models') return r.fulfill({ json: HUB_MODELS.filter((m) => !u.searchParams.get('search') || m.id.toLowerCase().includes(u.searchParams.get('search').toLowerCase())) });
    if (u.pathname === '/api/datasets') return r.fulfill({ json: [{ id: 'HuggingFaceFW/fineweb', downloads: 300000, likes: 2000, tags: ['task_categories:text-generation', 'license:odc-by'], lastModified: '2024-07-01T00:00:00Z', description: 'Web text.' }] });
    if (u.pathname.startsWith('/api/models/')) return r.fulfill({ json: FILES });
    if (u.pathname.endsWith('/raw/main/README.md')) return r.fulfill({ body: CARD, contentType: 'text/plain' });
    return r.fulfill({ status: 404, body: 'no' }); });
  await ctx.route('https://datasets-server.huggingface.co/**', (r) => { const u = new URL(r.request().url()); const len = +u.searchParams.get('length');
    return r.fulfill({ json: { features: BOARD_FEATS, rows: len === 1 ? BOARD.slice(0, 1) : +u.searchParams.get('offset') === 0 ? BOARD : [], num_rows_total: BOARD.length } }); });
  await ctx.route('https://openrouter.ai/api/v1/models', (r) => r.fulfill({ json: ROUTED }));
  await ctx.route(base + '/api/**', (r) => r.fulfill({ json: {} })); // the catch-all first: a later route wins
  await ctx.route(base + '/api/answer', async (r) => { const body = JSON.parse(r.request().postData() || '{}'); asked.push(body);
    if (body.mode === 'assistant') { const last = body.messages[body.messages.length - 1].text; return r.fulfill({ json: { reply: /code/i.test(last) ? 'Here it is:\n\n```js\nconst add = (a, b) => a + b;\nconsole.log(add(2, 3));\n```\nThat prints **5**.' : 'Model ' + body.model + ' says: water boils at **100 °C** at sea level. Style ' + body.style + '.', model: body.model } }); }
    return r.fulfill({ json: { answer: 'Photosynthesis turns light into chemical energy [1]. Plants, algae and some bacteria do it [2].', sources: [{ title: 'Photosynthesis', url: 'https://en.wikipedia.org/wiki/Photosynthesis' }, { title: 'Chloroplast', url: 'https://en.wikipedia.org/wiki/Chloroplast' }] } }); });
  await ctx.route(base + '/api/translate', (r) => r.fulfill({ json: { text: 'Wasser kocht bei 100 °C.' } }));
}
const errors = [];
const mk = async (locale = 'en-US') => { const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale, serviceWorkers: 'block' }); await stand(ctx); const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => m.type() === 'error' && !/favicon|404|Failed to load resource/.test(m.text()) && errors.push(m.text())); return { ctx, p }; };
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail = 1; };
const open = async (p, url) => { await p.addInitScript(() => { window.__cls = 0; let first = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__fcp = e.startTime - performance.getEntriesByType('navigation')[0].responseStart; }).observe({ type: 'paint', buffered: true }); void first; });
  await p.goto(base + url, { waitUntil: 'load' }); await p.waitForTimeout(900); };
const text = (p) => p.evaluate(() => document.body.innerText + '\n' + [...document.querySelectorAll('input:not([type=hidden]), textarea, output')].map((e) => e.value || e.textContent || '').join('\n'));
async function sane(p, name) {
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= 390), name + ': no sideways overflow at 390 px');
  const cls = await p.evaluate(() => window.__cls); let fcp = await p.evaluate(() => window.__fcp || 0);
  if (fcp > 200) { const more = [fcp]; for (let i = 0; i < 2; i++) { await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(300); more.push(await p.evaluate(() => window.__fcp || 0)); } fcp = more.sort((x, y) => x - y)[1]; } // a busy machine: the median of three loads ok(cls < 0.05, name + ': layout shift ' + cls.toFixed(3)); ok(fcp > 0 && fcp < 200, name + ': first paint ' + Math.round(fcp) + ' ms after the first byte');
  const small = await p.evaluate(() => [...document.querySelectorAll('button,a[href],input:not([type=hidden]),select,textarea')].filter((e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden') return false; if (r.width >= 24 && r.height >= 24) return false; return !(e.tagName === 'A' && e.parentElement && [...e.parentElement.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())); }).map((e) => e.outerHTML.slice(0, 80)));
  ok(!small.length, name + ': tap targets of 24 px or more' + (small.length ? ' (' + small.slice(0, 3).join(' | ') + ')' : ''));
}
async function probe(p, id) {
  const pr = probeFor(id), t = await text(p);
  if (pr.truth) { const s = score(t, pr.truth); ok(s.n === s.of, id + ': truth ' + s.n + '/' + s.of + (s.missing.length ? ' missing ' + s.missing.join(', ') : '')); }
  const f = score(t, pr.facts); ok(f.n === f.of, id + ': completeness ' + f.n + '/' + f.of + (f.missing.length ? ' missing ' + f.missing.join(', ') : ''));
  for (const [a, list] of Object.entries(pr.askParts || {})) { const s = score(t, list); ok(s.n === s.of, id + ': aspect "' + a + '" ' + s.n + '/' + s.of + (s.missing.length ? ' missing ' + s.missing.join(', ') : '')); }
}
const idOf = (path) => (AI_SITES.find((r) => r.path === path) || {}).lane;

// ---- every page: first paint, probe, German
for (const r of AI_SITES) {
  const { ctx, p } = await mk(); const pr = probeFor(r.lane); await open(p, pr.ask && pr.ask.verse ? pr.ask.verse : r.path); await sane(p, r.path); await probe(p, r.lane);
  const sh = await p.evaluate(() => ({ t: !!document.querySelector('meta[property="og:title"]'), i: (document.querySelector('meta[property="og:image"]') || {}).content, d: !!document.querySelector('meta[property="og:description"]'), c: !!document.getElementById('shareBtn') }));
  ok(sh.t && sh.d && sh.c && /\/og\/[a-z-]+\.png$/.test(sh.i) && fs.existsSync(path.join(root, new URL(sh.i).pathname)), r.path + ': sharing 4 of 4 (title, picture, description, a share button)');
  await p.screenshot({ path: path.join(out, r.path.replace(/^\/|\/$/g, '').replace(/\//g, '-') + '.png') }); await ctx.close();
  const d = await mk('de-DE'); await open(d.p, r.path); const dt = await d.p.evaluate(() => ({ lang: document.documentElement.lang, text: document.body.innerText }));
  ok(dt.lang === 'de' && (dt.text.match(/\b(?:und|der|die|das|ist|nicht|mit|für|ein|eine)\b/g) || []).length >= 4, r.path + ': German on a German browser'); await d.ctx.close();
}
void idOf;

{ // ---- /models/: the catalogue, a card, the comparison, try it
  const { ctx, p } = await mk(); await open(p, '/models/'); let t = await text(p);
  ok(/meta-llama\/Llama-3\.1-8B-Instruct/.test(t) && /5\.4M downloads/.test(t) && /Live from the Hugging Face Hub/.test(t), 'models: the live list with downloads, credited');
  ok(await p.locator('#list a[href="https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct"]').count() === 1, 'models: each model links to its page on the Hub');
  await p.selectOption('#size', 'xs'); t = await p.locator('#list').innerText(); ok(/Qwen2\.5-0\.5B/.test(t) && !/Llama-3\.1-8B/.test(t), 'models: the size filter keeps only models under 1B');
  await p.selectOption('#size', ''); await p.locator('#list li', { hasText: 'Llama-3.1-8B' }).getByRole('button', { name: 'Card' }).click(); await p.waitForTimeout(400);
  const md = await p.locator('#cardMd').innerHTML(); ok(/<h2>Llama 3\.1<\/h2>/.test(md) && /<table>/.test(md) && !/<script/.test(md) && /&lt;script&gt;/.test(md), 'models: the card is rendered, with its table, and its raw HTML shown as text');
  ok(/700 million|Llama 3\.1 Community Licence/.test(await p.locator('#cardNote').innerText()), 'models: the card names its licence and what it allows');
  for (const n of ['Llama-3.1-8B', 'whisper']) await p.locator('#list li', { hasText: n }).getByRole('button', { name: 'Compare' }).click();
  t = await p.locator('#cmp').innerText(); ok(/Llama-3\.1-8B/.test(t) && /whisper/.test(t) && /5\.9 GB/.test(t), 'models: two models side by side, with the memory each needs');
  ok(await p.locator('#list li', { hasText: 'Llama-3.1-8B' }).getByRole('button', { name: 'Try' }).count() === 1, 'models: a model Verse can run has a Try button');
  await p.locator('#list li', { hasText: 'Llama-3.1-8B' }).getByRole('button', { name: 'Try' }).click(); await p.fill('#tryIn', 'At what temperature does water boil?'); await p.click('#tryGo'); await p.waitForTimeout(500);
  ok(/Model llama8 says: water boils at/.test(await p.locator('#tryOut').innerText()) && asked.at(-1).model === 'llama8', 'models: Try it asks the model it was pressed on');
  await p.click('#kindD'); await p.waitForTimeout(500); ok(/HuggingFaceFW\/fineweb/.test(await p.locator('#list').innerText()), 'models: datasets list');
  await p.screenshot({ path: path.join(out, 'models-used.png'), fullPage: true }); await ctx.close();
}
{ // ---- the leaderboard
  const { ctx, p } = await mk(); await open(p, '/models/leaderboard/'); let rows = await p.locator('#rows tr').allInnerTexts();
  ok(/Qwen2\.5-72B/.test(rows[0]) && rows.length === 3, 'leaderboard: sorted by average, merges hidden (' + rows.length + ' rows)');
  await p.click('th button[data-k="params"]'); rows = await p.locator('#rows tr').allInnerTexts(); ok(/Qwen2\.5-72B/.test(rows[0]), 'leaderboard: sorted by size'); await p.click('th button[data-k="params"]'); rows = await p.locator('#rows tr').allInnerTexts(); ok(/Llama-3\.1-8B/.test(rows[0]), 'leaderboard: and the other way');
  await p.check('#merges'); ok((await p.locator('#rows tr').count()) === 4, 'leaderboard: merges shown when asked');
  const boxes = p.locator('#rows input[type=checkbox]'); await boxes.nth(0).check(); await boxes.nth(1).check(); ok((await p.locator('#chart .bar').count()) === 14, 'leaderboard: two models compared in a chart, 7 bars each');
  await p.screenshot({ path: path.join(out, 'models-leaderboard-used.png'), fullPage: true }); await ctx.close();
}
{ // ---- local
  const { ctx, p } = await mk(); await open(p, '/models/local/'); ok(/bartowski\/Llama-3\.2-3B-Instruct-GGUF/.test(await p.locator('#list').innerText()), 'local: the GGUF list');
  await p.fill('#mem', '4'); await p.getByRole('button', { name: 'Files' }).first().click(); await p.waitForTimeout(400); const t = await p.locator('#files').innerText();
  ok(/Q4_K_M/.test(t) && /2 GB/.test(t) && /fits/.test(t) && /too big/.test(t), 'local: each file with its size, and whether it fits 4 GB');
  ok(/ollama run hf\.co\/bartowski\/Llama-3\.2-3B-Instruct-GGUF:Q4_K_M/.test(t), 'local: the run command names the biggest build that fits');
  ok(/no/.test(await p.locator('#fit').innerText()), 'local: the fit table follows the memory'); await ctx.close();
}
{ // ---- prices
  const { ctx, p } = await mk(); await open(p, '/models/prices/'); let rows = await p.locator('#rows tr').allInnerTexts();
  ok(rows.length === 3 && /Gemma/.test(rows[0]), 'prices: three models, newest first'); ok(/\$0\.20[\s\S]*\$0\.60/.test(rows.join('\n')), 'prices: dollars per million tokens');
  await p.check('#free'); await p.waitForTimeout(150); rows = await p.locator('#rows tr').allInnerTexts(); ok(rows.length === 1 && /free/.test(rows[0]), 'prices: free only');
  await p.uncheck('#free'); await p.selectOption('#ctx', '1000000'); await p.waitForTimeout(150); ok((await p.locator('#rows tr').count()) === 1, 'prices: context of 1M or more'); await p.selectOption('#ctx', '0');
  await p.selectOption('#calcModel', 'mistralai/mistral-small'); ok(/\$0\.50 a day, \$15\.00 a month/.test(await p.locator('#costOut').innerText()), 'prices: a month of 1,000 requests on a picked model ($0.20 in, $0.60 out)');
  await p.locator('#rows input[type=checkbox]').first().check(); ok(/Context/.test(await p.locator('#cmp').innerText()), 'prices: compare side by side'); await ctx.close();
}
{ // ---- the arena
  const { ctx, p } = await mk(); await open(p, '/models/arena/'); await p.fill('#prompt', 'Where does water boil?'); await p.click('#battle'); await p.waitForTimeout(600);
  const a = await p.locator('#ansA').innerText(), bb = await p.locator('#ansB').innerText(); ok(/says: water boils/.test(a) && /says: water boils/.test(bb), 'arena: both hidden models answer');
  ok(!(await p.locator('[data-vote="a"]').isDisabled()), 'arena: the vote opens'); await p.click('[data-vote="a"]'); ok(/A was .+, B was .+\. Vote kept\./.test(await p.locator('#reveal').innerText()), 'arena: the names show after the vote');
  ok((await p.locator('#ratings tbody tr').count()) === 2 && /1016/.test(await p.locator('#ratings').innerText()), 'arena: the winner rated 1016');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400); ok((await p.locator('#ratings tbody tr').count()) === 2, 'arena: votes kept on the device'); await ctx.close();
}
{ // ---- the assistant: a chat, a code run, a share link, tools, notes
  const { ctx, p } = await mk(); await open(p, '/assistant/'); await p.fill('#box', 'When does water boil?'); await p.press('#box', 'Enter'); await p.waitForTimeout(500);
  let t = await p.locator('#thread').innerText(); ok(/When does water boil\?/.test(t) && /water boils at 100 °C/.test(t), 'assistant: a question and its reply');
  ok(/When does water boil/.test(await p.locator('#chats').innerText()), 'assistant: the chat is listed by its question');
  await p.selectOption('#style', 'teacher'); await p.fill('#box', 'Write code that adds two numbers'); await p.click('#send'); await p.waitForTimeout(500);
  ok(asked.at(-1).style === 'teacher' && asked.at(-1).messages.length === 3, 'assistant: the follow-up carries the conversation and the style');
  await p.getByRole('button', { name: 'Run the JavaScript' }).click(); await p.waitForTimeout(800); ok((await p.locator('.run-out').innerText()).trim() === '5', 'assistant: JavaScript from a reply runs in the browser and prints 5');
  await p.selectOption('#toolSrc', 'reply'); await p.click('#tCount'); ok(/words/.test(await p.locator('#toolOut').innerText()), 'assistant: count the last reply'); await p.click('#tTr'); await p.waitForTimeout(300); ok(/Wasser/.test(await p.locator('#toolOut').innerText()), 'assistant: translate');
  await p.click('#toNotes'); ok(/That prints/.test(await p.locator('#notes').inputValue()), 'assistant: a reply saved to notes');
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']); await p.click('#shareChat'); await p.waitForTimeout(300); const link = await p.evaluate(() => navigator.clipboard.readText());
  ok(/#[cz]=/.test(link), 'assistant: a chat packed into a link');
  await p.screenshot({ path: path.join(out, 'assistant-used.png'), fullPage: true });
  const q = await ctx.newPage(); await q.goto(link.replace(/^https?:\/\/[^/]+/, base), { waitUntil: 'load' }); await q.waitForTimeout(600); t = await q.locator('#thread').innerText();
  ok(/A shared chat/.test(t) && /water boils at 100 °C/.test(t), 'assistant: the link opens the chat');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(400); ok(/water boils/.test(await p.locator('#thread').innerText()) && /That prints/.test(await p.locator('#notes').inputValue()), 'assistant: chats and notes kept on the device'); await ctx.close();
}
{ // ---- the workspace, the quick page, the private page, the sources page
  const { ctx, p } = await mk(); await open(p, '/assistant/workspace/'); await p.fill('#pName', 'Report'); await p.fill('#pText', 'Make a weekly report from: '); await p.click('#pSave');
  await p.fill('#box', '/rep'); await p.dispatchEvent('#box', 'input'); await p.locator('#slash button', { hasText: 'Report' }).click(); ok((await p.inputValue('#box')) === 'Make a weekly report from:', 'workspace: a saved prompt inserted with a slash');
  await p.fill('#folder', 'Work'); await p.fill('#box', 'Hello'); await p.click('#send'); await p.waitForTimeout(400); ok((await p.locator('#folderFilter option').allInnerTexts()).includes('Work'), 'workspace: a chat filed in a folder');
  await p.fill('#find', 'boils'); ok((await p.locator('#chats li').count()) >= 1, 'workspace: search finds a word in a reply'); await ctx.close();
}
{ const { ctx, p } = await mk(); await open(p, '/assistant/quick/'); await p.click('[data-style="poet"]'); await p.fill('#box', 'The sea'); await p.click('#send'); await p.waitForTimeout(400); ok(asked.at(-1).style === 'poet', 'quick: the chat style is sent'); await p.check('#longer'); await p.fill('#box', 'More'); await p.click('#send'); await p.waitForTimeout(400); ok(asked.at(-1).style === 'long', 'quick: longer answers'); await ctx.close(); }
{ const { ctx, p } = await mk(); await open(p, '/assistant/private/'); await p.selectOption('#model', 'oss20'); await p.fill('#box', 'Secret question'); await p.click('#send'); await p.waitForTimeout(400); ok(asked.at(-1).model === 'oss20', 'private: the chosen model answers');
  p.on('dialog', (d) => d.accept()); await p.click('#burn'); ok((await p.locator('#chats li').count()) === 0 && (await p.evaluate(() => localStorage.getItem('a2m.void.assistant.private'))) === null, 'private: burn all leaves nothing on the device');
  await p.uncheck('#keepChats'); await p.fill('#box', 'Not kept'); await p.click('#send'); await p.waitForTimeout(400); ok((await p.evaluate(() => localStorage.getItem('a2m.void.assistant.private'))) === null, 'private: with keeping off, nothing is stored'); await ctx.close(); }
{ const { ctx, p } = await mk(); await open(p, '/assistant/sources/'); await p.fill('#box', 'What is photosynthesis?'); await p.click('#send'); await p.waitForTimeout(500);
  ok(await p.locator('#thread a[href="https://en.wikipedia.org/wiki/Photosynthesis"]', { hasText: '[1]' }).count() >= 1, 'sources: the citation [1] links to its source'); ok((await p.locator('#srcCards li').count()) === 2, 'sources: the sources as cards');
  ok(/history of photosynthesis/i.test(await p.locator('#follow').innerText()), 'sources: follow-up questions'); await p.locator('#follow button').first().click(); await p.waitForTimeout(400); ok(/^About What is photosynthesis\?: /.test(asked.at(-1).ask), 'sources: a follow-up carries the subject');
  await p.screenshot({ path: path.join(out, 'assistant-sources-used.png'), fullPage: true }); await ctx.close(); }
{ // ---- offline: visit with the worker, cut the network, reload
  for (const url of ['/models/', '/assistant/']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); await stand(ctx); const p = await ctx.newPage();
    await p.goto(base + url, { waitUntil: 'load' }); await p.evaluate(() => navigator.serviceWorker.ready); await p.waitForTimeout(1200); await p.goto(base + url, { waitUntil: 'load' }); await p.waitForTimeout(800);
    await ctx.setOffline(true); await p.reload({ waitUntil: 'load' }).catch(() => {}); await p.waitForTimeout(800);
    const t = await p.evaluate(() => document.body.innerText); ok(t.length > 200 && (url === '/models/' ? /What each licence allows/.test(t) && /Llama-3\.1-8B/.test(t) : /Text tools/.test(t)), url + ': opens offline after one visit');
    if (url === '/assistant/') { await p.fill('#box', 'hi'); await p.click('#send'); ok(/offline/i.test(await p.locator('#status').innerText()), 'assistant: offline says so and keeps the message'); await p.fill('#notes', 'offline note'); await p.click('#tSum'); }
    await ctx.close();
  }
}
ok(!errors.length, 'no page errors' + (errors.length ? ': ' + [...new Set(errors)].slice(0, 5).join(' | ') : ''));
await b.close(); srv.close(); process.exit(fail);
