/**
 * hub-core: the pure half of Verse's AI model pages (/models/ and its lane pages; lib/ai-sites.js). What the pages read and how they read it:
 *   - the Hugging Face Hub's public API (https://huggingface.co/api/models and /api/datasets): keyless, CORS open, read by the visitor's own browser, so its
 *     anonymous rate limit is per visitor; the pages keep a result for ten minutes on the device and link every model to its page on the Hub;
 *   - the archived Open LLM Leaderboard's table (its dataset read through the Hub's dataset viewer API), for /models/leaderboard/;
 *   - a public model router's model list (https://openrouter.ai/api/v1/models, keyless) for /models/prices/.
 * Here: the addresses, the readers that turn any of those answers into plain rows (a missing field is null, never a guess), the licence and task
 * tables, the memory a model needs, a small safe Markdown reader for model cards, the cost sum and the Elo rating. Tests: tools/ai-pages.test.mjs.
 */
export const HUB = 'https://huggingface.co';
export const ROUTER_API = 'https://openrouter.ai/api/v1/models';
export const BOARD_API = 'https://datasets-server.huggingface.co';
export const BOARD_SET = 'open-llm-leaderboard/contents';

// the tasks a person filters by (the Hub's pipeline tags), most asked first
export const TASKS = Object.freeze([
  ['text-generation', 'Text generation'], ['image-text-to-text', 'Images and text to text'], ['text-to-image', 'Text to image'], ['automatic-speech-recognition', 'Speech to text'],
  ['text-to-speech', 'Text to speech'], ['feature-extraction', 'Embeddings (feature extraction)'], ['sentence-similarity', 'Sentence similarity'], ['translation', 'Translation'],
  ['summarization', 'Summarization'], ['text-classification', 'Text classification'], ['token-classification', 'Named entities (token classification)'], ['question-answering', 'Question answering'],
  ['fill-mask', 'Fill in the blank'], ['zero-shot-classification', 'Zero-shot classification'], ['image-classification', 'Image classification'], ['object-detection', 'Object detection'],
  ['image-segmentation', 'Image segmentation'], ['image-to-text', 'Image to text (captions)'], ['depth-estimation', 'Depth estimation'], ['text-to-video', 'Text to video'], ['audio-classification', 'Audio classification'],
]);
export const taskName = (tag) => (TASKS.find(([k]) => k === tag) || [null, tag ? String(tag).replace(/-/g, ' ') : 'Not stated'])[1];

// What a licence lets you do, in plain words: [tag, name, commercial use, what you must do, what to watch]. Facts from each licence's own text.
export const LICENCES = Object.freeze([
  ['apache-2.0', 'Apache 2.0', 'yes', 'Keep the licence and notices; say what you changed.', 'Gives a patent licence too; no trademark rights.'],
  ['mit', 'MIT', 'yes', 'Keep the copyright notice and licence text.', 'No warranty; nothing else asked.'],
  ['bsd-3-clause', 'BSD 3-Clause', 'yes', 'Keep the copyright notice; do not use the authors\' names to promote.', 'Close to MIT.'],
  ['cc-by-4.0', 'CC BY 4.0', 'yes', 'Credit the authors and link the licence.', 'Made for content; common for datasets.'],
  ['cc-by-sa-4.0', 'CC BY-SA 4.0', 'yes', 'Credit the authors; share what you make from it under the same licence.', 'Share-alike carries over to derived work.'],
  ['cc-by-nc-4.0', 'CC BY-NC 4.0', 'no', 'Credit the authors.', 'Non-commercial only.'],
  ['openrail', 'OpenRAIL', 'yes', 'Pass the use restrictions on to anyone you share it with.', 'Lists uses that are not allowed (harm, misinformation and more).'],
  ['creativeml-openrail-m', 'CreativeML OpenRAIL-M', 'yes', 'Pass the use restrictions on; you own what you generate.', 'The licence of early image models.'],
  ['llama3.1', 'Llama 3.1 Community Licence', 'yes, below a size', 'Show "Built with Llama"; follow Meta\'s acceptable use policy.', 'A company with more than 700 million monthly active users needs a separate licence from Meta.'],
  ['llama3.2', 'Llama 3.2 Community Licence', 'yes, below a size', 'Show "Built with Llama"; follow the acceptable use policy.', 'The same 700 million monthly active users line; the vision models were not licensed to people in the EU.'],
  ['gemma', 'Gemma Terms of Use', 'yes', 'Pass the terms and the prohibited use policy on.', 'Google may restrict use that breaks the policy.'],
  ['gpl-3.0', 'GPL 3.0', 'yes', 'Share the source of what you distribute, under the GPL.', 'Copyleft.'],
  ['other', 'Other', 'read it', 'Open the model card and read the licence file.', 'Often a custom licence with conditions.'],
]);
export const licenceOf = (tag) => LICENCES.find(([k]) => k === tag) || null;

// size bands for the filter: [key, label, from, to) in parameters
export const SIZES = Object.freeze([['xs', 'Under 1B', 0, 1e9], ['s', '1B to 4B', 1e9, 4e9], ['m', '4B to 10B', 4e9, 10e9], ['l', '10B to 40B', 10e9, 40e9], ['xl', '40B and up', 40e9, Infinity]]);
export const sizeBand = (params) => (Number(params) > 0 ? (SIZES.find(([, , a, b]) => params >= a && params < b) || [null])[0] : null);
/** 8030000000 -> "8.0B", 22700000 -> "22.7M"; null -> "size not stated". Pure. */
export function sizeLabel(params) {
  const n = Number(params); if (!(n > 0)) return 'size not stated';
  if (n >= 1e9) return (n >= 1e11 ? Math.round(n / 1e9) : Math.round(n / 1e8) / 10) + 'B';
  if (n >= 1e6) return (n >= 1e8 ? Math.round(n / 1e6) : Math.round(n / 1e5) / 10) + 'M';
  return Math.round(n / 1e3) + 'K';
}
/** 1234567 -> "1.2M", 15300 -> "15.3K", 999 -> "999". Pure. */
export function fmtCount(n) {
  const v = n == null || n === '' ? NaN : Number(n); if (!Number.isFinite(v)) return '–';
  if (v >= 1e9) return (Math.round(v / 1e8) / 10) + 'B'; if (v >= 1e6) return (Math.round(v / 1e5) / 10) + 'M'; if (v >= 1e3) return (Math.round(v / 100) / 10) + 'K';
  return String(Math.round(v));
}

// A short list of well-known open models kept in the page, so it shows something at once and offline: id, task, licence and size as their own cards
// state them. No download counts: those come only from the live Hub.
export const SNAPSHOT = Object.freeze([
  ['meta-llama/Llama-3.1-8B-Instruct', 'text-generation', 'llama3.1', 8.03e9], ['mistralai/Mistral-7B-Instruct-v0.3', 'text-generation', 'apache-2.0', 7.25e9],
  ['Qwen/Qwen2.5-7B-Instruct', 'text-generation', 'apache-2.0', 7.62e9], ['google/gemma-2-9b-it', 'text-generation', 'gemma', 9.24e9],
  ['microsoft/Phi-3-mini-4k-instruct', 'text-generation', 'mit', 3.82e9], ['openai/gpt-oss-20b', 'text-generation', 'apache-2.0', 21e9],
  ['HuggingFaceTB/SmolLM2-1.7B-Instruct', 'text-generation', 'apache-2.0', 1.71e9], ['meta-llama/Llama-3.2-1B', 'text-generation', 'llama3.2', 1.24e9],
  ['Qwen/Qwen2.5-Coder-32B-Instruct', 'text-generation', 'apache-2.0', 32.8e9], ['deepseek-ai/DeepSeek-R1', 'text-generation', 'mit', 671e9],
  ['openai/whisper-large-v3', 'automatic-speech-recognition', 'apache-2.0', 1.54e9], ['sentence-transformers/all-MiniLM-L6-v2', 'sentence-similarity', 'apache-2.0', 22.7e6],
  ['google-bert/bert-base-uncased', 'fill-mask', 'apache-2.0', 110e6], ['FacebookAI/roberta-base', 'fill-mask', 'mit', 125e6],
  ['facebook/bart-large-cnn', 'summarization', 'mit', 406e6], ['Helsinki-NLP/opus-mt-en-de', 'translation', 'cc-by-4.0', null],
  ['distilbert/distilbert-base-uncased-finetuned-sst-2-english', 'text-classification', 'apache-2.0', 67e6], ['google/vit-base-patch16-224', 'image-classification', 'apache-2.0', 86.6e6],
  ['facebook/detr-resnet-50', 'object-detection', 'apache-2.0', 41.6e6], ['black-forest-labs/FLUX.1-schnell', 'text-to-image', 'apache-2.0', 12e9],
].map(([id, task, licence, params]) => ({ id, kind: 'models', author: id.split('/')[0], name: id.split('/').slice(1).join('/'), task, licence, params, sizeFromName: false, downloads: null, likes: null, updated: null, library: null, gated: false, gguf: false, description: null })));

const enc = encodeURIComponent;
const EXPAND = ['downloads', 'likes', 'pipeline_tag', 'tags', 'lastModified', 'library_name', 'gated', 'safetensors', 'gguf'];
/** the Hub's list address for models or datasets: { kind, q, task, licence, sort, limit, gguf }. Pure. */
export function hubListUrl(o = {}) {
  const ds = o.kind === 'datasets', p = [];
  if (o.q) p.push('search=' + enc(String(o.q).slice(0, 80)));
  if (o.task && !ds) p.push('pipeline_tag=' + enc(o.task));
  if (o.task && ds) p.push('filter=' + enc('task_categories:' + o.task));
  if (o.licence) p.push('filter=' + enc('license:' + o.licence));
  if (o.gguf) p.push('filter=gguf');
  const sort = { downloads: 'downloads', likes: 'likes', trending: 'trendingScore', updated: 'lastModified', new: 'createdAt' }[o.sort] || 'downloads';
  p.push('sort=' + sort, 'direction=-1', 'limit=' + Math.max(1, Math.min(200, Math.floor(o.limit) || 50)));
  if (!ds) for (const e of EXPAND) p.push('expand[]=' + e); else for (const e of ['downloads', 'likes', 'tags', 'lastModified', 'gated', 'description']) p.push('expand[]=' + e);
  return HUB + '/api/' + (ds ? 'datasets' : 'models') + '?' + p.join('&');
}
/** a repository's own page on the Hub, its raw card and its file list (with sizes). Pure. */
export const hubPage = (id, kind = 'models') => HUB + (kind === 'datasets' ? '/datasets/' : '/') + String(id).split('/').map(enc).join('/');
export const cardUrl = (id, kind = 'models') => hubPage(id, kind) + '/raw/main/README.md';
export const filesUrl = (id) => HUB + '/api/models/' + String(id).split('/').map(enc).join('/') + '?blobs=true';

const num = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);
/** one model (or dataset) from the Hub's list answer as a plain row. Pure. */
export function normModel(raw, kind = 'models') {
  const r = raw && typeof raw === 'object' ? raw : {}, id = String(r.id || r.modelId || '').slice(0, 200), tags = Array.isArray(r.tags) ? r.tags.map(String) : [];
  const lic = (tags.find((t) => t.startsWith('license:')) || '').slice(8) || (r.cardData && r.cardData.license) || null;
  const st = r.safetensors && typeof r.safetensors === 'object' ? r.safetensors : null, gg = r.gguf && typeof r.gguf === 'object' ? r.gguf : null;
  const params = num(st && st.total) || num(gg && gg.total) || paramsFromName(id);
  const task = kind === 'datasets' ? (tags.find((t) => t.startsWith('task_categories:')) || '').slice(16) || null : r.pipeline_tag || null;
  return { id, kind, author: id.includes('/') ? id.split('/')[0] : '', name: id.includes('/') ? id.split('/').slice(1).join('/') : id, task, licence: lic ? String(lic) : null,
    params, sizeFromName: !num(st && st.total) && !num(gg && gg.total) && !!params, downloads: num(r.downloads), likes: num(r.likes), updated: r.lastModified ? String(r.lastModified).slice(0, 10) : null,
    library: r.library_name || null, gated: !!r.gated && r.gated !== 'false', gguf: tags.includes('gguf') || !!gg, description: r.description ? String(r.description).slice(0, 300) : null };
}
/** the size a repository's name says ("Llama-3.1-8B", "Qwen2.5-0.5B", "Mixtral-8x7B" -> 56e9), or null. Pure. */
export function paramsFromName(id) {
  const m = String(id || '').match(/(?:^|[-_/.])(?:(\d+)x)?(\d+(?:\.\d+)?)([bm])(?=$|[-_.])/i); if (!m) return null;
  const v = parseFloat(m[2]) * (m[3].toLowerCase() === 'b' ? 1e9 : 1e6) * (m[1] ? +m[1] : 1);
  return v > 0 ? v : null;
}
/** rows kept by the filters the API cannot do itself (size band, fewest downloads). Pure. */
export function filterRows(rows, o = {}) {
  return (rows || []).filter((r) => (!o.size || sizeBand(r.params) === o.size) && (!(o.minDownloads > 0) || (r.downloads || 0) >= o.minDownloads));
}

// Memory: a model's weights take params x bits / 8 bytes; running it adds the context's cache and the runtime, about a fifth more (a rule of thumb, said so)
export const QUANTS = Object.freeze([['Q2_K', 3.35, 'smallest, clearly worse'], ['Q3_K_M', 3.9, 'small, some loss'], ['Q4_K_M', 4.85, 'the usual choice: small, little loss'], ['Q5_K_M', 5.7, 'closer to the original'], ['Q6_K', 6.6, 'nearly the original'], ['Q8_0', 8.5, 'as good as the original, twice the size of Q4'], ['F16', 16, 'the original half-precision weights']]);
/** gigabytes to hold a model's weights at a number of bits per weight. Pure. */
export const weightsGB = (params, bits) => (Number(params) > 0 && bits > 0 ? Math.round((params * bits) / 8 / 1e8) / 10 : null);
/** gigabytes to run it (weights plus about 20% for the context and the runtime). Pure. */
export const runGB = (params, bits) => { const w = weightsGB(params, bits); return w == null ? null : Math.round(w * 12) / 10; };
/** the builds of a model that fit in `gb` of memory, best first: [[quant, bits, note, needGB]]. Pure. */
export const fits = (params, gb) => QUANTS.map(([q, b, n]) => [q, b, n, runGB(params, b)]).filter((x) => x[3] != null && x[3] <= gb).reverse();
/** the quantization a GGUF file's name carries ("model-Q4_K_M.gguf" -> "Q4_K_M"), or null. Pure. */
export const quantOfFile = (name) => { const m = String(name || '').match(/(?:^|[-_.])((?:I?Q\d(?:_[A-Z0-9]+)*)|F16|BF16|F32)(?=[-_.]|\.gguf$)/i); return m ? m[1].toUpperCase() : null; };
/** the commands that run a GGUF repository on a computer. Pure. */
export const runCommands = (id, quant) => { const tag = quant ? ':' + quant : ''; return { ollama: 'ollama run hf.co/' + id + tag, llamacpp: 'llama-server -hf ' + id + tag }; };

// ---- model cards: a small Markdown reader that writes only safe HTML (every text escaped, links only http(s), images as links, no raw HTML) ----
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const safeUrl = (u) => (/^https?:\/\//i.test(String(u).trim()) ? esc(String(u).trim()) : null);
function inline(s) {
  const codes = []; let t = String(s).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  t = esc(t);
  t = t.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, alt, u) => { const h = safeUrl(u.replace(/&amp;/g, '&')); return h ? '<a href="' + h + '" rel="noopener nofollow" target="_blank">[image: ' + (alt || 'picture') + ']</a>' : alt; });
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, txt, u) => { const h = safeUrl(u.replace(/&amp;/g, '&')); return h ? '<a href="' + h + '" rel="noopener nofollow" target="_blank">' + txt + '</a>' : txt; });
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>').replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  return t.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + esc(codes[+i]) + '</code>');
}
/** a model card's front matter (the YAML between --- lines) as { licence, tags, body }. Pure. */
export function splitCard(md) {
  const t = String(md || '').replace(/\r\n?/g, '\n'), m = t.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { licence: null, tags: [], body: t };
  const y = m[1], lic = (y.match(/^license:\s*["']?([^"'\n]+)/m) || [])[1] || null;
  const tags = [...y.matchAll(/^\s*-\s*["']?([^"'\n]+)/gm)].map((x) => x[1].trim()).slice(0, 30);
  return { licence: lic ? lic.trim() : null, tags, body: t.slice(m[0].length) };
}
/** Markdown to safe HTML: headings, paragraphs, lists, quotes, code blocks, tables, links, bold, italic, inline code. Raw HTML is shown as text. Pure. */
export function mdToHtml(md, maxChars = 60000) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').slice(0, maxChars).split('\n'), out = [];
  let i = 0, para = [];
  const flush = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  while (i < lines.length) {
    const l = lines[i];
    const fence = l.match(/^\s*(```|~~~)\s*([\w+-]*)/);
    if (fence) { flush(); const body = []; i++; while (i < lines.length && !lines[i].trim().startsWith(fence[1])) body.push(lines[i++]); i++; out.push('<pre><code' + (fence[2] ? ' data-lang="' + esc(fence[2]) + '"' : '') + '>' + esc(body.join('\n')) + '</code></pre>'); continue; }
    const h = l.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) { flush(); const n = Math.min(6, h[1].length + 1); out.push('<h' + n + '>' + inline(h[2]) + '</h' + n + '>'); i++; continue; }
    if (/^\s*\|.*\|\s*$/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush(); const cells = (s) => s.trim().replace(/^\||\|$/g, '').split('|').map((c) => inline(c.trim()));
      const head = cells(l); i += 2; const rows = []; while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push('<div class="tw"><table><thead><tr>' + head.map((c) => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c) => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>'); continue;
    }
    if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
      flush(); const ordered = /^\s*\d/.test(l), items = [];
      while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, '')); i++; }
      out.push((ordered ? '<ol>' : '<ul>') + items.map((x) => '<li>' + inline(x) + '</li>').join('') + (ordered ? '</ol>' : '</ul>')); continue;
    }
    if (/^\s*>/.test(l)) { flush(); const q = []; while (i < lines.length && /^\s*>/.test(lines[i])) q.push(lines[i++].replace(/^\s*>\s?/, '')); out.push('<blockquote>' + inline(q.join(' ')) + '</blockquote>'); continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { flush(); out.push('<hr>'); i++; continue; }
    if (!l.trim()) { flush(); i++; continue; }
    para.push(l.trim()); i++;
  }
  flush();
  return out.join('\n');
}

// ---- the leaderboard: the archived Open LLM Leaderboard's rows, read whatever its columns are called ----
export const BENCHES = Object.freeze([
  ['average', 'Average', /^average/i, 'The mean of the six scores below.'],
  ['ifeval', 'IFEval', /^ifeval/i, 'Instruction following: does the answer obey checkable instructions such as "write in under 100 words" or "use no commas".'],
  ['bbh', 'BBH', /^bbh/i, 'BIG-Bench Hard: 23 hard reasoning tasks from BIG-Bench, such as logic puzzles and date understanding.'],
  ['math', 'MATH Lvl 5', /^math/i, 'The hardest level (5) of the MATH competition problems.'],
  ['gpqa', 'GPQA', /^gpqa/i, 'Graduate-level, Google-proof questions in biology, physics and chemistry, written by experts.'],
  ['musr', 'MuSR', /^musr/i, 'Multistep soft reasoning: long stories (murder mysteries, object placement, team allocation) to reason through.'],
  ['mmlupro', 'MMLU-PRO', /^mmlu/i, 'MMLU made harder: 10 answer choices instead of 4 and more reasoning questions across 14 subjects.'],
]);
/** a row of the leaderboard's table as { name, params, type, licence, merged, scores: {average, ifeval, ...} }; null when it has no name. Pure. */
export function normBoardRow(row) {
  const r = row && row.row ? row.row : row; if (!r || typeof r !== 'object') return null;
  const keys = Object.keys(r), find = (re) => keys.find((k) => re.test(k.replace(/[^\w\s#-]/g, '').trim()));
  const nameK = find(/^fullname$/i) || find(/^(model|eval_name)$/i); const name = nameK ? String(r[nameK]).replace(/<[^>]*>/g, '').trim() : '';
  if (!name) return null;
  const scores = {}; for (const [k, , re] of BENCHES) { const kk = keys.find((x) => re.test(x.replace(/[^\w\s-]/g, '').trim()) && !/raw/i.test(x)); const v = kk == null ? null : num(r[kk]); scores[k] = v == null ? null : Math.round(v * 100) / 100; }
  const pk = find(/params/i), tk = find(/^type$/i), lk = find(/license/i), mk = find(/merged/i) || find(/merge/i);
  const p = pk ? num(r[pk]) : null;
  return { name: name.slice(0, 160), params: p == null ? null : p * 1e9, type: tk ? String(r[tk]).replace(/[^\w\s-]/g, '').trim().slice(0, 40) : null, licence: lk ? String(r[lk]).slice(0, 40) : null, merged: mk ? r[mk] === true || r[mk] === 'true' : /merge/i.test(name), scores };
}
/** the leaderboard's address on the dataset viewer: the rows ordered by a score, `length` at a time from `offset`. Pure. */
export const boardUrl = (offset = 0, length = 100) => BOARD_API + '/rows?dataset=' + enc(BOARD_SET) + '&config=default&split=train&offset=' + Math.max(0, offset | 0) + '&length=' + Math.max(1, Math.min(100, length | 0));
/** rows sorted by a score (or name/size), highest first; nulls last. Pure. */
export function sortBoard(rows, key = 'average', asc = false) {
  const v = (r) => (key === 'name' ? r.name.toLowerCase() : key === 'params' ? r.params : r.scores[key]);
  return [...(rows || [])].sort((a, b) => { const x = v(a), y = v(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1); });
}
/** the board as CSV. Pure. */
export function boardCsv(rows) {
  const q = (s) => (/[",\n]/.test(String(s)) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s));
  return ['model,params_B,type,' + BENCHES.map(([k]) => k).join(','), ...(rows || []).map((r) => [q(r.name), r.params == null ? '' : Math.round(r.params / 1e7) / 100, q(r.type || ''), ...BENCHES.map(([k]) => (r.scores[k] == null ? '' : r.scores[k]))].join(','))].join('\n');
}

// ---- prices: a model router's list, per model: dollars per million tokens in and out, context, what goes in and out ----
/** one model from the router's list as a plain row; prices in US dollars per million tokens (null when not listed). Pure. */
export function normRouted(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}, p = r.pricing || {}, a = r.architecture || {};
  const perM = (v) => { const x = num(v); return x == null || x < 0 ? null : Math.round(x * 1e6 * 10000) / 10000; };
  const mod = String(a.modality || 'text->text').split('->');
  const ins = Array.isArray(a.input_modalities) ? a.input_modalities : mod[0].split('+');
  const outs = Array.isArray(a.output_modalities) ? a.output_modalities : (mod[1] || 'text').split('+');
  const id = String(r.id || '').slice(0, 160);
  return { id, name: String(r.name || id).slice(0, 160), provider: id.split('/')[0] || '', inPrice: perM(p.prompt), outPrice: perM(p.completion), context: num(r.context_length) || num(r.top_provider && r.top_provider.context_length),
    maxOut: num(r.top_provider && r.top_provider.max_completion_tokens), inputs: ins.map(String), outputs: outs.map(String), created: num(r.created), free: perM(p.prompt) === 0 && perM(p.completion) === 0, tools: Array.isArray(r.supported_parameters) && r.supported_parameters.includes('tools'), description: r.description ? String(r.description).slice(0, 400) : '' };
}
/** what `requests` a day of `inTok` tokens in and `outTok` out cost at those prices: { day, month } in dollars (a month is 30 days). Pure. */
export function costOf(inPrice, outPrice, inTok, outTok, requests = 1) {
  const day = ((Number(inPrice) || 0) * (Number(inTok) || 0) + (Number(outPrice) || 0) * (Number(outTok) || 0)) / 1e6 * (Number(requests) || 0);
  return { day: Math.round(day * 100) / 100, month: Math.round(day * 30 * 100) / 100 };
}
/** a dollar amount as "$2.00" (and "$0.0004" below a cent). Pure. */
export const money = (v) => (v == null ? '–' : '$' + (v > 0 && v < 0.01 ? Number(v.toPrecision(2)) : Number(v).toFixed(2)));

// ---- the arena: Elo ratings from your own votes ----
export const ELO_START = 1000, ELO_K = 32;
/** new ratings after a vote: score 1 when a won, 0 when b won, 0.5 a tie. Pure. */
export function elo(ra, rb, score, k = ELO_K) {
  const ea = 1 / (1 + 10 ** ((rb - ra) / 400));
  return [Math.round(ra + k * (score - ea)), Math.round(rb + k * ((1 - score) - (1 - ea)))];
}
/** the rating table from a list of votes { a, b, win: 'a'|'b'|'tie'|'bad', cat }: [{ key, rating, wins, losses, ties, n }], best first. Pure. */
export function ratings(votes, cat = '') {
  const t = {}; const row = (k) => (t[k] = t[k] || { key: k, rating: ELO_START, wins: 0, losses: 0, ties: 0, n: 0 });
  for (const v of votes || []) {
    if (!v || !v.a || !v.b || (cat && v.cat !== cat)) continue;
    const A = row(v.a), B = row(v.b); A.n++; B.n++;
    const s = v.win === 'a' ? 1 : v.win === 'b' ? 0 : 0.5;
    if (v.win === 'a') { A.wins++; B.losses++; } else if (v.win === 'b') { B.wins++; A.losses++; } else { A.ties++; B.ties++; }
    [A.rating, B.rating] = elo(A.rating, B.rating, s);
  }
  return Object.values(t).sort((x, y) => y.rating - x.rating || y.n - x.n);
}
/** two different models for a battle, from `keys`, by `rand` (0..1). Pure. */
export function pickPair(keys, rand = Math.random) {
  const k = [...keys]; if (k.length < 2) return null;
  const i = Math.floor(rand() * k.length) % k.length, a = k.splice(i, 1)[0], b = k[Math.floor(rand() * k.length) % k.length];
  return [a, b];
}
