// One way to ask Gemini for text (owner, 2026-11-20: a retired Gemini name sat in three judges and every one of them answered 404).
// Models come from void-live-deploy/lib/models.js (GEMINI_MODELS); a model that is gone or refused (404, 403, any non-OK) falls to the next. Never holds a key in a result.
import { GEMINI_MODELS, geminiUrl } from '../void-live-deploy/lib/models.js';

/** `parts` is the Gemini parts array ([{ text }, { inline_data }]). Returns { text, model } for the first model that answered OK, else { text: '', why: 'HTTP 404 (model)' }. `fetchFn` is injectable. */
export async function geminiText(parts, env = process.env, fetchFn = fetch) {
  let why = env.GEMINI_API_KEY ? 'no answer' : 'no key';
  if (!env.GEMINI_API_KEY) return { text: '', why };
  for (const model of GEMINI_MODELS) {
    const r = await fetchFn(geminiUrl(model), { method: 'POST', headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0 } }), signal: AbortSignal.timeout(40000) });
    if (r.ok) { const j = await r.json().catch(() => ({})), t = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0] && j.candidates[0].content.parts[0].text; return { text: String(t || ''), model, ...(t ? {} : { why: 'answer unreadable' }) }; }
    why = 'HTTP ' + r.status + ' (' + model + ')';
  }
  return { text: '', why };
}
