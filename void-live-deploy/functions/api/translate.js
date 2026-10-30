// POST /api/translate { text, from?, to, image?, tone?, glossary? } -> { text, from, to, detected, via, tone }. The tower's Google Translate floor (/translate/).
// The words go to Meta's many-to-many model on the site's own Workers AI binding (lib/models.js path 'translate': 100 languages, two-letter
// codes); when it is not bound or does not answer, MyMemory's free machine translation answers instead (via: 'mymemory'). `from` left out or
// 'auto' is detected from the text (lib/translate-langs.js). An `image` (a data URL, as /api/appraise takes) is read first by the vision
// model, which transcribes the text in it, and that text is translated: camera text, the way Google's camera tab reads a sign. A `tone`
// (lib/translate-langs.js tonesFor: formal/informal, Korean's three speech levels) and a `glossary` ([[term, translation]]) are applied by
// the free chat model editing the translation (DeepL's formality and glossary); without the model the plain translation comes back with
// tone: '' and a note. The text is read for this answer and dropped: nothing is stored or logged. 400 for no text or an unknown language,
// 429 past the per-minute cap, 502 when neither translator answers.
// The same route has three more modes, so the page has one door (lib/translate-words.js, lib/translate-web.js):
//   { mode: 'word', text, from?, to }   the dictionary for one word: Wiktionary's meanings, the model's (or MyMemory's) other translations with how
//                                       common each is, examples, the word's forms; edge-cached 30 days per word and pair.
//   { mode: 'alts', word, sentence, source, from?, to }   other words for one word of a translation, each with the sentence rewritten around it.
//   { mode: 'page', url }               a public web page's words (title, headings, paragraphs, links) as plain text, for the page to translate.
//                                       What a stranger could make that do, and what stops it, is written at the top of lib/translate-web.js:
//                                       no private hosts, no proxying of bytes or scripts, 1.5 MB / 8 s per fetch, 10 a minute, a ten-minute edge copy.
import { models } from '../../lib/models.js';
import { LANGS, codeOf, detect, MAX_CHARS, tonesFor } from '../../lib/translate-langs.js';
import { said, jsonIn, wordPrompt, entryOf, wiktionary, memoryAlternatives, altsPrompt, altsOf, glossaryOf, tonePrompt, editedOf } from '../../lib/translate-words.js';
import { fetchPage, extract } from '../../lib/translate-web.js';
import { imageBytes, describe } from './appraise.js';
import { rateLimited } from './answer.js';

const json = (body, status = 200) => Response.json(body, { status });
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const READ_PROMPT = 'Transcribe exactly the text in this image, in its original language, line by line. Output only the text, nothing else. If there is no text, output NONE.';

/** the model's answer, whatever shape it comes in. Pure. */
export const translatedOf = (r) => clean(r && (r.translated_text || r.response || (r.result && (r.result.translated_text || r.result.response)) || ''));

/** MyMemory's answer for one pair, '' when it has none (a 200 with a translation, or its best-rated match). */
export async function viaMyMemory(text, from, to, fetchFn = fetch) {
  const r = await fetchFn('https://api.mymemory.translated.net/get?mt=1&q=' + encodeURIComponent(text) + '&langpair=' + from + '|' + to).then((x) => x.json());
  let out = r && r.responseStatus === 200 && r.responseData && clean(r.responseData.translatedText);
  if (!out && r && Array.isArray(r.matches)) {
    const best = r.matches.filter((x) => x && x.translation && clean(x.translation)).sort((a, b) => (+b.match || 0) - (+a.match || 0) || (+b.quality || 0) - (+a.quality || 0))[0];
    out = best ? clean(best.translation) : '';
  }
  return out && !/^MYMEMORY WARNING/i.test(out) ? out : '';
}

/** the text translated: the model first, MyMemory when it fails; the model is asked paragraph by paragraph so line breaks survive. */
export async function translate(env, text, from, to, fetchFn = fetch) {
  const paras = String(text).split(/\n{2,}/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (env && env.AI) {
    try {
      const outs = [];
      for (const p of paras) { const r = await env.AI.run(models('translate'), { text: p, source_lang: from, target_lang: to }); const t = translatedOf(r); if (!t) throw new Error('said nothing'); outs.push(t); }
      return { text: outs.join('\n\n'), via: 'verse' };
    } catch (_) {}
  }
  const outs = [];
  for (const p of paras) { const t = await viaMyMemory(p, from, to, fetchFn); if (!t) throw new Error('no translation'); outs.push(t); }
  return { text: outs.join('\n\n'), via: 'mymemory' };
}

const modelsOn = (env) => !!(env && env.AI) && String(env.VOID_ANSWER_MODELS || '').trim().toLowerCase() !== 'off';
const MODEL_MS = 9000, WORD_RL = 30, PAGE_RL = 10;
/** the free chat model asked once, with a time limit; '' when it is off or fails. */
export async function chat(env, messages, max_tokens = 700) {
  if (!modelsOn(env)) return '';
  let timer;
  try { return said(await Promise.race([env.AI.run(models('answer'), { messages, max_tokens }), new Promise((_, no) => { timer = setTimeout(() => no(new Error('slow')), MODEL_MS); })])); }
  catch (_) { return ''; } finally { clearTimeout(timer); }
}
/** an answer kept at the edge (the Cache API: free, no KV writes) under key for maxAge seconds; make() runs on a miss, and only a
 *  good answer ({ keep: true }) is kept. */
async function edge(request, key, maxAge, make) {
  let c = null, k = '';
  try { c = caches.default; k = new URL(request.url).origin + '/__translate/' + key; const hit = await c.match(k); if (hit) return { ...(await hit.json()), cached: true }; } catch (_) { c = null; }
  const v = await make();
  if (c && v && v.keep) { try { await c.put(k, new Response(JSON.stringify(v), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=' + maxAge } })); } catch (_) {} }
  return v;
}
const out = (v) => { const { keep, ...rest } = v; return json(rest); };

/** the dictionary for one word: Wiktionary's meanings beside the model's alternatives and examples (or MyMemory's alternatives). */
export async function dictionary(env, word, from, to, ui = 'en', fetchFn = fetch) {
  const [wk, raw] = await Promise.all([wiktionary(word, from, fetchFn), chat(env, wordPrompt(word, from, to, ui))]);
  const m = entryOf(jsonIn(raw));
  const alternatives = m.alternatives.length ? m.alternatives : await memoryAlternatives(word, from, to, fetchFn);
  const examples = m.pos.flatMap((p) => p.senses).filter((x) => x.example && x.example_tr).slice(0, 3).map((x) => ({ src: x.example, tgt: x.example_tr }));
  const pos = wk.length ? wk : m.pos.map((p) => ({ pos: p.pos, senses: p.senses.map((x) => ({ def: x.def, example: x.example, example_tr: x.example_tr })) }));
  const sources = [wk.length ? 'Wiktionary' : '', m.alternatives.length || (!wk.length && m.pos.length) ? 'Verse' : '', !m.alternatives.length && alternatives.length ? 'MyMemory' : ''].filter(Boolean);
  return { word, from, to, pos, alternatives, examples, forms: m.forms, sources, keep: !!(pos.length || alternatives.length) };
}

/** other words for one word of a translation: the model's, each with its sentence; without it, MyMemory's translations of the word's back-translation. */
export async function alternativesFor(env, word, sentence, source, from, to, fetchFn = fetch) {
  const m = altsOf(jsonIn(await chat(env, altsPrompt(word, sentence, source, from, to), 600)), word);
  if (m.length) return { word, alternatives: m, via: 'verse', keep: true };
  let back = ''; try { back = from ? await viaMyMemory(word, to, from, fetchFn) : ''; } catch (_) {}
  const mem = back ? (await memoryAlternatives(back, from, to, fetchFn)).filter((a) => a.text.toLowerCase() !== word.toLowerCase()).map((a) => ({ text: a.text, sentence: '' })) : [];
  return { word, alternatives: mem, via: mem.length ? 'mymemory' : 'none', keep: mem.length > 0 };
}

async function modes(request, env, body) {
  const mode = body.mode;
  if (mode === 'page') {
    if (await rateLimited(request, env, 'translate-page', PAGE_RL)) return json({ error: 'slow down: ' + PAGE_RL + ' pages a minute' }, 429);
    let url; try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(String(body.url || '').trim()) ? String(body.url).trim() : 'https://' + String(body.url || '').trim()).href; } catch (_) { return json({ error: 'that is not a web address' }, 400); }
    try {
      return out(await edge(request, 'page/' + encodeURIComponent(url).slice(0, 900), 600, async () => { const p = await fetchPage(url); return { url: p.url, ...extract(p.html, p.url), keep: true }; }));
    } catch (e) { return json({ error: String((e && e.message) || e).slice(0, 160) }, 400); }
  }
  const to = codeOf(body.to);
  if (!to) return json({ error: 'to: one of the ' + Object.keys(LANGS).length + ' languages, as a code like es' }, 400);
  if (mode === 'word') {
    const word = String(body.text || body.word || '').replace(/\s+/g, ' ').trim();
    if (!word || word.length > 60 || word.split(' ').length > 3) return json({ error: 'one word (or up to three) to look up' }, 400);
    const from = codeOf(body.from) || detect(word) || 'en', ui = body.ui === 'de' ? 'de' : 'en';
    if (from === to) return json({ word, from, to, pos: [], alternatives: [], examples: [], forms: [], sources: [] });
    if (await rateLimited(request, env, 'translate-word', WORD_RL)) return json({ error: 'slow down' }, 429);
    return out(await edge(request, ['word', from, to, ui, encodeURIComponent(word.toLowerCase())].join('/'), 2592000, () => dictionary(env, word, from, to, ui)));
  }
  if (mode === 'alts') {
    const word = String(body.word || '').replace(/\s+/g, ' ').trim().slice(0, 60), sentence = String(body.sentence || '').trim().slice(0, 1200), source = String(body.source || '').trim().slice(0, 1200);
    if (!word || !sentence || !source) return json({ error: 'word, sentence and source' }, 400);
    const from = codeOf(body.from) || detect(source) || '';
    if (await rateLimited(request, env, 'translate-word', WORD_RL)) return json({ error: 'slow down' }, 429);
    const key = ['alts', from, to, (await sha(word + '\u241e' + sentence + '\u241e' + source)).slice(0, 32)].join('/');
    return out(await edge(request, key, 604800, () => alternativesFor(env, word, sentence, source, from, to)));
  }
  return json({ error: 'mode: word, alts or page' }, 400);
}
const sha = async (s) => { try { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''); } catch (_) { return encodeURIComponent(s).slice(0, 64); } };

/** the translation put in a tone and/or a glossary's terms by the free chat model: { text, tone, note }. */
export async function toned(env, text, source, to, toneId, glossary) {
  const tone = tonesFor(to).find((t) => t.id === toneId) || null;
  if (!tone && !glossary.length) return { text, tone: '', note: '' };
  if (!modelsOn(env)) return { text, tone: '', note: 'the tone and glossary need Verse\'s model, which is not on just now: this is the plain translation' };
  const ed = editedOf(await chat(env, tonePrompt(text, source, to, tone && tone.how, glossary), Math.min(3000, Math.ceil(text.length / 2) + 300)), text);
  return ed ? { text: ed, tone: tone ? tone.id : '', note: '' } : { text, tone: '', note: 'the tone could not be applied just now: this is the plain translation' };
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'send JSON: { text, from, to }' }, 400); }
  if (body && body.mode) return modes(request, env, body);
  const to = codeOf(body && body.to);
  if (!to) return json({ error: 'to: one of the ' + Object.keys(LANGS).length + ' languages, as a code like es' }, 400);
  if (await rateLimited(request, env, 'translate', 40)) return json({ error: 'slow down', note: 'slow down' }, 429);
  let text = String((body && body.text) || '').trim(), read = '';
  if (!text && body && body.image) {
    const bytes = imageBytes(body.image);
    if (!bytes) return json({ error: 'a PNG, JPEG or WebP picture, under 800 KB' }, 400);
    if (!env || !env.AI) return json({ error: 'Verse cannot read pictures from this deploy yet (no vision model bound)' }, 503);
    try { read = await describe({ AI: { run: (m, a) => env.AI.run(m, a.messages ? { ...a, messages: [{ role: 'user', content: [{ type: 'text', text: READ_PROMPT }, a.messages[0].content[1]] }] } : { ...a, prompt: READ_PROMPT }) } }, bytes, String(body.image).trim()); }
    catch (e) { return json({ error: 'the picture could not be read; try again in a moment', reason: String((e && e.message) || e).slice(0, 200) }, 502); }
    read = /^NONE\b/i.test(read) ? '' : read;
    if (!read) return json({ error: 'no text could be read in the picture', read: '' }, 400);
    text = read;
  }
  if (!text) return json({ error: 'text: what to translate' }, 400);
  if (text.length > MAX_CHARS) return json({ error: 'at most ' + MAX_CHARS + ' characters at a time' }, 400);
  let from = codeOf(body && body.from), detected = '';
  if (!from) { detected = detect(text) || 'en'; from = detected; }
  if (from === to) return json({ text, from, to, detected, via: 'same' , read});
  try {
    const r = await translate(env, text, from, to), t = await toned(env, r.text, text, to, String((body && body.tone) || ''), glossaryOf(body && body.glossary, text));
    return json({ text: t.text, from, to, detected, via: r.via, read, tone: t.tone, ...(t.note ? { note: t.note } : {}) });
  }
  catch (e) { return json({ error: 'the translator did not answer; try again in a moment', reason: String((e && e.message) || e).slice(0, 120) }, 502); }
}
