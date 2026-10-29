// The AI model and assistant pages (lib/hub-core.js, lib/assistant-core.js, lib/assistant-chat.js, lib/tool-sites.js AI_SITES, functions/api/answer.js mode
// 'assistant'): the Hub's answers read into rows, the safe card reader, the licence and memory sums, the leaderboard, price and arena maths, chats and
// their export and share codes, the text tools, the messages a model is asked with, and the route with a fake model and a fake D1. The fixtures are the
// shapes each public API documents (written by hand: the builder's network was closed). secret-scan: ok (no keys here)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as H from '../void-live-deploy/lib/hub-core.js';
import * as A from '../void-live-deploy/lib/assistant-core.js';
import { assistantMessages, modelKey, TURNS, STYLES } from '../void-live-deploy/lib/assistant-chat.js';
import { AI_SITES, aiAskOf, TRY, tryOf } from '../void-live-deploy/lib/ai-sites.js';
import { TRY_MODELS } from '../void-live-deploy/lib/models.js';
import { LANE_PAGES, LANE_EXTRAS, LANES } from '../void-live-deploy/lib/tower.js';
import { build } from './ai-pages.mjs';

test('the Hub list address carries search, task, licence, sort, size of page and the fields it needs', () => {
  const u = new URL(H.hubListUrl({ q: 'llama 3', task: 'text-generation', licence: 'apache-2.0', sort: 'likes', limit: 500 }));
  assert.equal(u.origin + u.pathname, 'https://huggingface.co/api/models');
  assert.equal(u.searchParams.get('search'), 'llama 3'); assert.equal(u.searchParams.get('pipeline_tag'), 'text-generation'); assert.equal(u.searchParams.get('filter'), 'license:apache-2.0');
  assert.equal(u.searchParams.get('sort'), 'likes'); assert.equal(u.searchParams.get('limit'), '200'); assert.ok(u.searchParams.getAll('expand[]').includes('safetensors'));
  const d = new URL(H.hubListUrl({ kind: 'datasets', task: 'translation' })); assert.equal(d.pathname, '/api/datasets'); assert.equal(d.searchParams.get('filter'), 'task_categories:translation');
  assert.ok(H.hubListUrl({ gguf: true }).includes('filter=gguf'));
  assert.equal(H.hubPage('meta-llama/Llama-3.1-8B'), 'https://huggingface.co/meta-llama/Llama-3.1-8B'); assert.equal(H.cardUrl('a/b', 'datasets'), 'https://huggingface.co/datasets/a/b/raw/main/README.md');
});

test('a model from the Hub becomes a plain row; a missing field is null, never a guess', () => {
  const r = H.normModel({ id: 'mistralai/Mistral-7B-Instruct-v0.3', downloads: 1234567, likes: 2100, pipeline_tag: 'text-generation', tags: ['transformers', 'license:apache-2.0'], lastModified: '2024-08-21T10:00:00.000Z', safetensors: { total: 7248023552 }, library_name: 'transformers', gated: false });
  assert.deepEqual([r.author, r.name, r.task, r.licence, r.params, r.downloads, r.updated, r.gated], ['mistralai', 'Mistral-7B-Instruct-v0.3', 'text-generation', 'apache-2.0', 7248023552, 1234567, '2024-08-21', false]);
  const bare = H.normModel({ id: 'x/tiny-model' }); assert.equal(bare.downloads, null); assert.equal(bare.licence, null); assert.equal(bare.params, null);
  const named = H.normModel({ id: 'Qwen/Qwen2.5-0.5B-Instruct' }); assert.equal(named.params, 0.5e9); assert.equal(named.sizeFromName, true);
  assert.equal(H.paramsFromName('mistralai/Mixtral-8x7B-v0.1'), 56e9); assert.equal(H.paramsFromName('openai/whisper-large-v3'), null);
  assert.equal(H.normModel({ id: 'a/b', gated: 'auto' }).gated, true);
  assert.equal(H.sizeLabel(8.03e9), '8B'); assert.equal(H.sizeLabel(22.7e6), '22.7M'); assert.equal(H.sizeLabel(671e9), '671B'); assert.equal(H.sizeLabel(null), 'size not stated');
  assert.equal(H.fmtCount(1234567), '1.2M'); assert.equal(H.fmtCount(15300), '15.3K'); assert.equal(H.fmtCount(null), '–');
  assert.deepEqual(H.filterRows([{ params: 3e9, downloads: 10 }, { params: 8e9, downloads: 5000 }], { size: 'm', minDownloads: 1000 }).length, 1);
});

test('a model card is read safely: no raw HTML, no script links, images only as links', () => {
  const c = H.splitCard('---\nlicense: apache-2.0\ntags:\n- text\n- chat\n---\n# Title\nHello');
  assert.equal(c.licence, 'apache-2.0'); assert.deepEqual(c.tags, ['text', 'chat']); assert.equal(c.body, '# Title\nHello');
  const html = H.mdToHtml('# Hi\n<script>alert(1)</script>\n[x](javascript:alert(1)) [ok](https://a.b/c?d=1&e=2) ![pic](https://img/x.png) **b** `<i>`\n\n```js\nconst a = "<b>";\n```\n| a | b |\n|---|---|\n| 1 | <img src=x onerror=alert(1)> |\n- one\n- two');
  assert.doesNotMatch(html, /<script|<img|javascript:|onerror=alert\(1\)>/i);
  assert.match(html, /<h2>Hi<\/h2>/); assert.match(html, /&lt;script&gt;/); assert.match(html, /<a href="https:\/\/a\.b\/c\?d=1&amp;e=2" rel="noopener nofollow" target="_blank">ok<\/a>/);
  assert.match(html, /\[image: pic\]/); assert.match(html, /<strong>b<\/strong>/); assert.match(html, /<code>&lt;i&gt;<\/code>/); assert.match(html, /<pre><code data-lang="js">const a = &quot;&lt;b&gt;&quot;;<\/code><\/pre>/);
  assert.match(html, /<table>/); assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  assert.doesNotMatch(H.mdToHtml('[a](https://x" onmouseover="alert(1))'), /" onmouseover="/);
});

test('licences say what they allow; memory to run a model; GGUF file names', () => {
  assert.equal(H.licenceOf('cc-by-nc-4.0')[2], 'no'); assert.match(H.licenceOf('llama3.1')[4], /700 million monthly active users/); assert.equal(H.licenceOf('nope'), null);
  assert.equal(H.weightsGB(8e9, 4.85), 4.9); assert.equal(H.runGB(8e9, 4.85), 5.9); assert.equal(H.runGB(8e9, 16), 19.2);
  assert.deepEqual(H.fits(8e9, 8).map((x) => x[0]), ['Q6_K', 'Q5_K_M', 'Q4_K_M', 'Q3_K_M', 'Q2_K']);
  assert.equal(H.quantOfFile('Llama-3.2-3B-Instruct-Q4_K_M.gguf'), 'Q4_K_M'); assert.equal(H.quantOfFile('model.Q8_0.gguf'), 'Q8_0'); assert.equal(H.quantOfFile('model-IQ2_XS.gguf'), 'IQ2_XS'); assert.equal(H.quantOfFile('model-f16.gguf'), 'F16'); assert.equal(H.quantOfFile('readme.md'), null);
  assert.deepEqual(H.runCommands('bartowski/Llama-3.2-3B-Instruct-GGUF', 'Q4_K_M'), { ollama: 'ollama run hf.co/bartowski/Llama-3.2-3B-Instruct-GGUF:Q4_K_M', llamacpp: 'llama-server -hf bartowski/Llama-3.2-3B-Instruct-GGUF:Q4_K_M' });
});

test('the leaderboard reads its rows whatever the columns are called, sorts and exports', () => {
  const row = { row_idx: 0, row: { eval_name: 'x', Precision: 'bfloat16', Type: '💬 chat models (RLHF, DPO, IFT, ...)', fullname: 'Qwen/Qwen2.5-72B-Instruct', 'Average ⬆️': 47.98, 'IFEval': 86.38, 'IFEval Raw': 0.86, 'BBH': 61.87, 'MATH Lvl 5': 59.82, 'GPQA': 16.67, 'MUSR': 17.17, 'MMLU-PRO': 51.4, '#Params (B)': 72.71, 'Hub License': 'other', Merged: false } };
  const r = H.normBoardRow(row);
  assert.equal(r.name, 'Qwen/Qwen2.5-72B-Instruct'); assert.equal(r.scores.average, 47.98); assert.equal(r.scores.ifeval, 86.38); assert.equal(r.scores.math, 59.82); assert.equal(r.scores.musr, 17.17); assert.equal(r.scores.mmlupro, 51.4);
  assert.equal(Math.round(r.params / 1e9), 73); assert.match(r.type, /chat models/); assert.equal(r.merged, false); assert.equal(H.normBoardRow({ row: {} }), null);
  const rows = [r, { ...r, name: 'b', scores: { ...r.scores, average: 60 } }, { ...r, name: 'c', scores: { ...r.scores, average: null } }];
  assert.deepEqual(H.sortBoard(rows).map((x) => x.name), ['b', 'Qwen/Qwen2.5-72B-Instruct', 'c']); assert.deepEqual(H.sortBoard(rows, 'name', true).map((x) => x.name), ['b', 'c', 'Qwen/Qwen2.5-72B-Instruct']);
  const csv = H.boardCsv([r]).split('\n'); assert.equal(csv[0], 'model,params_B,type,average,ifeval,bbh,math,gpqa,musr,mmlupro'); assert.match(csv[1], /^Qwen\/Qwen2\.5-72B-Instruct,72\.71,/);
  assert.match(H.boardUrl(100, 500), /offset=100&length=100$/);
});

test('prices: a router model as dollars per million tokens, and what a month costs', () => {
  const r = H.normRouted({ id: 'mistralai/mistral-small', name: 'Mistral: Small', created: 1700000000, context_length: 32000, pricing: { prompt: '0.0000002', completion: '0.0000006' }, architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] }, top_provider: { max_completion_tokens: 8192 }, supported_parameters: ['tools', 'temperature'] });
  assert.deepEqual([r.provider, r.inPrice, r.outPrice, r.context, r.maxOut, r.free, r.tools], ['mistralai', 0.2, 0.6, 32000, 8192, false, true]); assert.deepEqual(r.inputs, ['text', 'image']);
  const free = H.normRouted({ id: 'x/y:free', pricing: { prompt: '0', completion: '0' }, architecture: { modality: 'text->text' } }); assert.equal(free.free, true); assert.deepEqual(free.outputs, ['text']);
  assert.deepEqual(H.normRouted({ id: 'z/w' }).inputs, ['text']);
  assert.deepEqual(H.costOf(1, 2, 1000, 500, 1000), { day: 2, month: 60 }); assert.equal(H.money(2), '$2.00'); assert.equal(H.money(0.0004), '$0.0004');
});

test('the arena: Elo from votes, by category, and two different models for a battle', () => {
  assert.deepEqual(H.elo(1000, 1000, 1), [1016, 984]); assert.deepEqual(H.elo(1000, 1000, 0.5), [1000, 1000]);
  const v = [{ a: 'x', b: 'y', win: 'a', cat: 'coding' }, { a: 'x', b: 'z', win: 'b', cat: 'writing' }, { a: 'y', b: 'z', win: 'tie', cat: 'coding' }];
  const all = H.ratings(v); assert.equal(all.length, 3); const x = all.find((r) => r.key === 'x'); assert.deepEqual([x.wins, x.losses, x.ties, x.n, x.rating], [1, 1, 0, 2, 999]);
  assert.deepEqual(H.ratings(v, 'coding').map((r) => r.key + r.rating), ['x1016', 'z999', 'y985']);
  for (let i = 0; i < 50; i++) { const p = H.pickPair(['a', 'b', 'c']); assert.notEqual(p[0], p[1]); } assert.equal(H.pickPair(['a']), null);
});

test('chats: made, cleaned, searched, exported, imported and packed into a link', () => {
  const c = A.newChat({ id: 'abcd1234', at: 5 }); c.messages.push({ role: 'user', text: 'What is the boiling point of water at sea level in Celsius?', at: 1 }, { role: 'assistant', text: 'It is **100 °C** at sea level.', at: 2, sources: [{ title: 'Water', url: 'https://en.wikipedia.org/wiki/Water' }, { title: 'bad', url: 'javascript:x' }] });
  const k = A.cleanChat(c); assert.equal(k.title, 'New chat'); assert.equal(k.messages[1].sources.length, 1);
  assert.equal(A.titleOf(c.messages), 'What is the boiling point of water at sea level in Celsius?'); assert.equal(A.titleOf([{ role: 'user', text: 'x'.repeat(100) }]).length <= 61, true);
  assert.equal(A.cleanChat({ messages: 'no' }), null); assert.equal(A.cleanChat({ id: '<x>', messages: [] }).id === '<x>', false);
  const s = A.searchChats([k], 'boiling celsius'); assert.equal(s.length, 1); assert.match(s[0].snippet, /boiling point/); assert.deepEqual(A.searchChats([k], 'tea'), []);
  assert.deepEqual(A.sortChats([{ at: 1, pinned: false }, { at: 2, pinned: false }, { at: 0, pinned: true }]).map((x) => x.at), [0, 2, 1]);
  const md = A.toMarkdown(k); assert.match(md, /^# New chat/); assert.match(md, /\*\*You:\*\*/); assert.match(md, /\[1\] Water https:\/\/en\.wikipedia\.org\/wiki\/Water/);
  const back = A.fromJson(A.toJson([k])); assert.equal(back.length, 1); assert.equal(back[0].messages.length, 2); assert.deepEqual(A.fromJson('nope'), []); assert.equal(A.fromJson(JSON.stringify(k)).length, 1);
  const code = A.shareCode(k); assert.match(code, /^[A-Za-z0-9_-]+$/); const shared = A.fromShareCode(code); assert.equal(shared.messages[1].text, 'It is **100 °C** at sea level.'); assert.equal(A.fromShareCode('!!!'), null);
  assert.equal(A.templateOf('email')[1], 'Write an email'); assert.equal(A.templateOf('x'), null);
});

test('text tools on the device: count, summarize, rewrite, code blocks, follow-ups', () => {
  const c = A.countText('The quick brown fox jumps over the lazy dog. It was not amused!'); assert.deepEqual([c.words, c.sentences, c.chars, c.readMin], [13, 2, 63, 1]);
  assert.deepEqual(A.countText(''), { words: 0, chars: 0, charsNoSpaces: 0, sentences: 0, paragraphs: 0, readMin: 0, speakMin: 0 });
  const text = 'Cats sleep a lot. Cats sleep up to sixteen hours a day because cats save energy for hunting. The weather was nice. Dogs bark. Cats hunt at dawn and dusk.';
  const sum = A.summarize(text, 2); assert.equal(A.sentencesOf(sum).length, 2); assert.match(sum, /sixteen hours/);
  assert.equal(A.rewrite('I really just want to go in order to rest.', 'shorter'), 'I want to go to rest.');
  assert.equal(A.rewrite('hello  world .how are you', 'tidy'), 'Hello world. How are you'); assert.equal(A.rewrite('the lord of the rings', 'title'), 'The Lord of the Rings');
  assert.equal(A.rewrite('ONE. TWO!', 'sentence'), 'One. Two!'); assert.equal(A.rewrite('A b. C d.', 'bullets'), '- A b.\n- C d.');
  assert.deepEqual(A.codeBlocks('x\n```js\nconsole.log(1)\n```\n'), [{ lang: 'js', code: 'console.log(1)\n' }]);
  assert.equal(A.followUps('What is photosynthesis?')[0], 'What is the history of photosynthesis?'); assert.deepEqual(A.followUps(''), []);
});

test('the messages a model is asked with: rules first, style and instructions as data, the newest turns kept under the limits', () => {
  const p = assistantMessages({ messages: [{ role: 'assistant', text: 'hi' }, { role: 'user', text: 'one' }, { role: 'assistant', text: 'two' }, { role: 'user', text: 'three' }], style: 'teacher', instructions: 'I am a nurse.', model: 'llama8', lang: 'de' });
  assert.equal(p.messages[0].role, 'system'); assert.match(p.messages[0].content, /never invent facts/); assert.match(p.messages[0].content, /Style: Teach/); assert.match(p.messages[0].content, /I am a nurse\./); assert.match(p.messages[0].content, /Deutsch/);
  assert.deepEqual(p.messages.slice(1).map((m) => m.role + ':' + m.content), ['user:one', 'assistant:two', 'user:three']); assert.equal(p.model, 'llama8'); assert.equal(p.last, 'three');
  assert.equal(assistantMessages({ messages: [{ role: 'user', text: 'a' }, { role: 'assistant', text: 'b' }] }).error, 'empty'); assert.equal(assistantMessages({}).error, 'empty');
  const many = Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', text: 'm' + i + ' ' + 'x'.repeat(3000) })); many.push({ role: 'user', text: 'last' });
  const q = assistantMessages({ messages: many }); assert.ok(q.messages.length - 1 <= TURNS); assert.equal(q.messages[1].role, 'user'); assert.ok(q.messages.reduce((a, m) => a + m.content.length, 0) < 16000 + 2000);
  assert.equal(modelKey('nope'), 'verse'); assert.equal(modelKey('oss20'), 'oss20'); assert.ok(STYLES.warm.includes('read aloud'));
});

test('every model a visitor can pick is named in lib/models.js, and the floors, lanes and pages agree', () => {
  assert.deepEqual(Object.keys(TRY_MODELS).sort(), TRY.map((x) => x.key).sort());
  for (const k of Object.values(TRY_MODELS)) assert.match(k, /^@cf\/[\w.-]+\/[\w.-]+$/);
  assert.equal(tryOf('META-LLAMA/Llama-3.1-8B-Instruct').key, 'llama8'); assert.equal(tryOf('x/y'), null);
  for (const r of AI_SITES) { assert.ok(fs.existsSync(new URL('../void-live-deploy' + r.path + 'index.html', import.meta.url)), r.path); assert.ok(r.asks.length >= 5 && r.asks.length <= 8, r.path); assert.ok(r.related.length, r.path); if (r.lane.includes(': ')) { assert.equal(LANE_PAGES[r.lane], r.path, r.lane); assert.ok(LANE_EXTRAS[r.lane], r.lane); } }
  assert.equal(LANES['ai models'].length, 4); assert.equal(LANES.assistant.length, 5);
});

test('the ask bar sends narrow asks to these pages and leaves ordinary questions alone', () => {
  assert.equal(aiAskOf('AI models'), '/models/'); assert.equal(aiAskOf('open source llm models'), '/models/'); assert.equal(aiAskOf('llm leaderboard'), '/models/leaderboard/'); assert.equal(aiAskOf('run llm locally'), '/models/local/');
  assert.equal(aiAskOf('llm prices'), '/models/prices/'); assert.equal(aiAskOf('chatbot arena'), '/models/arena/'); assert.equal(aiAskOf('ai chat'), '/assistant/'); assert.equal(aiAskOf('private ai chat'), '/assistant/private/');
  assert.equal(aiAskOf('talk to an ai'), '/assistant/voice/'); assert.equal(aiAskOf('answers with sources'), '/assistant/sources/');
  for (const q of ['what is an ai model', 'make a 3d model', 'who is the best chatbot', 'chat with my mom', 'model trains']) assert.equal(aiAskOf(q), null, q);
});

test('the pages are generated, whole in their first paint, in English and German, with a share picture each', () => {
  for (const f of build()) assert.equal(f.old, f.html, 'stale: node tools/ai-pages.mjs (' + f.file + ')');
  const { DE } = { DE: JSON.parse(fs.readFileSync(new URL('../void-live-deploy/lib/ai-de.js', import.meta.url), 'utf8').replace(/^[\s\S]*?Object\.freeze\(/, '').replace(/\);\s*$/, '')) };
  for (const r of AI_SITES) {
    const html = fs.readFileSync(new URL('../void-live-deploy' + r.path + 'index.html', import.meta.url), 'utf8');
    assert.match(html, new RegExp('<meta property="og:image" content="https://a-to-mind\\.com/og/' + r.path.replace(/^\/|\/$/g, '').replace(/\//g, '-') + '\\.png">'), r.path);
    assert.ok(fs.existsSync(new URL('../void-live-deploy/og/' + r.path.replace(/^\/|\/$/g, '').replace(/\//g, '-') + '.png', import.meta.url)), r.path + ' share picture');
    assert.ok(DE[r.h1] && DE[r.does], r.path + ' German'); assert.match(html, /id="shareBtn"/); assert.match(html, /mountRelated\(document\.getElementById\('related'\), '/);
    assert.doesNotMatch(html.replace(/<script[\s\S]*?<\/script>/g, ''), /@cf\//, r.path + ' names no Workers AI model');
  }
});
