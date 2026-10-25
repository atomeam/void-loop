// POST /api/translate { text, from?, to, image? } -> { text, from, to, detected, via }. The tower's Google Translate floor (/translate/).
// The words go to Meta's many-to-many model on the site's own Workers AI binding (lib/models.js path 'translate': 100 languages, two-letter
// codes); when it is not bound or does not answer, MyMemory's free machine translation answers instead (via: 'mymemory'). `from` left out or
// 'auto' is detected from the text (lib/translate-langs.js). An `image` (a data URL, as /api/appraise takes) is read first by the vision
// model, which transcribes the text in it, and that text is translated: camera text, the way Google's camera tab reads a sign. The text is
// read for this answer and dropped: nothing is stored or logged. 400 for no text or an unknown language, 429 past the per-minute cap, 502
// when neither translator answers.
import { models } from '../../lib/models.js';
import { LANGS, codeOf, detect, MAX_CHARS } from '../../lib/translate-langs.js';
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

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch (_) { return json({ error: 'send JSON: { text, from, to }' }, 400); }
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
  try { const r = await translate(env, text, from, to); return json({ text: r.text, from, to, detected, via: r.via, read }); }
  catch (e) { return json({ error: 'the translator did not answer; try again in a moment', reason: String((e && e.message) || e).slice(0, 120) }, 502); }
}
