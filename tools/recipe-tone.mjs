// A judge for the tone of a recipe card (owner, 2026-11-19: every recipe is sensitive and respectful toward every animal and every vegetable). It reads
// the card's words the way a thoughtful cook would and marks how gentle, warm, accurate and un-preachy they are, and whether anything says plants feel
// pain. It judges tone, not a list of banned words: a model reads the card against the charter's recipe line. A run it could not judge is reported as
// not judged, never passed. The cards guard (tools/guards/cards.mjs) runs it on the recipe cards it asks for on the live site.
import { charterPrompt } from './charter.mjs';
import { models } from '../void-live-deploy/lib/models.js';
import { GUIDE } from '../void-live-deploy/lib/recipe-respect.js';

export const MIN_GENTLE = 7, MIN_ACCURATE = 7, MAX_PREACHY = 5;

/** the prompt the judge gets: the charter, the recipe guide, the card's words, and the marks to give. Pure. */
export function tonePrompt(text, charter = charterPrompt()) {
  return [
    charter,
    'You are a kind, careful cook judging the TONE of one recipe card on Verse. Guide: ' + GUIDE,
    'Mark out of 10: "gentle" (every word about an animal, a vegetable, a herb or a fruit is kind and respectful; 10 is gentle all through, 4 or less if a step talks about killing, butchering, slaughter, torture or beating food up), "warm" (a short thank-you or a caring touch for the ingredients), "preachy" (10 is a sermon or a lecture, 0 is none; one short thank-you line is not preachy), and "accurate" (the cooking steps are still correct, clear and complete: quantities, times, temperatures and order). Then "falseScience": true only if the card says plants feel pain or have feelings as a fact.',
    'Calibration. "Turn off the heat and take the heads off the prawns" with a one-line thank-you: gentle 9, warm 8, preachy 1, accurate 9. "Kill the heat, then slaughter and butcher the bird": gentle 2. A recipe that lectures about cruelty for three paragraphs: preachy 9. "The carrots scream when you peel them": falseScience true. Steps that no longer say how long to cook: accurate 3.',
    'Card text:\n"""\n' + String(text || '').slice(0, 4000) + '\n"""',
    'Reply with only JSON: {"gentle":n,"warm":n,"preachy":n,"accurate":n,"falseScience":false,"harsh":["the exact words that are too harsh, if any"]}.',
  ].join('\n');
}
/** the judge's reply as marks, or null when it is not a well-formed answer. Pure. */
export function readTone(reply) {
  const m = /\{[\s\S]*\}/.exec(String(reply || ''));
  if (!m) return null;
  let j; try { j = JSON.parse(m[0]); } catch { return null; }
  const out = {};
  for (const k of ['gentle', 'warm', 'preachy', 'accurate']) { const v = +j[k]; if (!Number.isFinite(v) || v < 0 || v > 10) return null; out[k] = v; }
  out.falseScience = j.falseScience === true;
  out.harsh = Array.isArray(j.harsh) ? j.harsh.map((s) => String(s).slice(0, 80)).slice(0, 5) : [];
  return out;
}
/** the plain-words causes in a set of marks; [] when the card reads well. Pure. */
export function toneCauses(v) {
  if (!v) return [];
  const out = [];
  if (v.gentle < MIN_GENTLE) out.push('recipe wording is not gentle enough' + (v.harsh && v.harsh.length ? ' (' + v.harsh.join(', ') + ')' : ''));
  if (v.preachy > MAX_PREACHY) out.push('recipe sounds preachy');
  if (v.falseScience) out.push('recipe claims plants feel pain');
  if (v.accurate < MIN_ACCURATE) out.push('recipe steps lost their clarity');
  return out;
}
/** ask a model to judge a card's tone: marks, or null when no judge could answer (then nothing is passed or failed). `fetchFn` is injectable. */
export async function toneJudge(text, env = process.env, fetchFn = fetch) {
  const prompt = tonePrompt(text), cf = env.CLOUDFLARE_AI_TOKEN || env.CLOUDFLARE_API_TOKEN;
  try {
    if (cf && env.CLOUDFLARE_ACCOUNT_ID) {
      const r = await fetchFn('https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID) + '/ai/run/' + models('answer'), { method: 'POST', headers: { authorization: 'Bearer ' + cf, 'content-type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], max_tokens: 300, temperature: 0 }), signal: AbortSignal.timeout(40000) });
      const j = await r.json().catch(() => ({})), t = (j.result && (j.result.response || j.result)) || (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      const v = readTone(typeof t === 'string' ? t : JSON.stringify(t)); if (v) return { ...v, by: 'workers-ai' };
    }
    if (env.GEMINI_API_KEY) {
      const r = await fetchFn('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', { method: 'POST', headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0 } }), signal: AbortSignal.timeout(40000) });
      const j = await r.json().catch(() => ({})), v = readTone(j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0].text);
      if (v) return { ...v, by: 'gemini' };
    }
  } catch (_) { /* an unjudged run is reported as not judged, never passed */ }
  return null;
}
