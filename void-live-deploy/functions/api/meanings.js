// GET /api/meanings?word= -> { word, found, senses, source }.
// A stranger can only make this server ask en.wiktionary.org for one cleaned word (letters, at most
// three words, 60 characters). The host and path are fixed. Repeats come from the edge cache. 30 misses
// a minute. Nothing is stored and nothing is written back. A failure is not cached.
import { cleanWord, sensesFrom } from '../../lib/meanings.js';
import { rateLimited } from './answer.js';
import { json } from '../../lib/http.js';

export const UA = 'Verse/1.0 (https://a-to-mind.com; contact)';
const MISS = 'The dictionary did not answer just now. Try again in a moment.';
const wikiUrl = (word) => 'https://en.wiktionary.org/api/rest_v1/page/definition/' + encodeURIComponent(word.replace(/ /g, '_')) + '?redirect=true';
const sourceUrl = (word) => 'https://en.wiktionary.org/wiki/' + encodeURIComponent(word.replace(/ /g, '_'));

/** clean JSON for one word. 404 from the dictionary is a real miss, not an error. */
export async function defineWord(word, fetchImpl = fetch) {
  const clean = cleanWord(word);
  if (!clean) return { status: 400, body: { error: 'Type a word.' } };
  let r;
  try { r = await fetchImpl(wikiUrl(clean), { headers: { accept: 'application/json', 'user-agent': UA }, signal: AbortSignal.timeout(8000) }); }
  catch (_) { return { status: 502, body: { error: MISS } }; }
  if (r.status === 404) return { status: 200, body: { word: clean, found: false, senses: [], source: sourceUrl(clean) }, keep: true };
  if (!r.ok) return { status: 502, body: { error: MISS } };
  let data; try { data = await r.json(); } catch (_) { return { status: 502, body: { error: MISS } }; }
  const senses = sensesFrom(data);
  return { status: 200, body: { word: clean, found: senses.length > 0, senses, source: sourceUrl(clean) }, keep: true };
}

/** the response for /api/meanings. The no-JS page calls this with the same URL. */
export async function answer(request, env) {
  const clean = cleanWord(new URL(request.url).searchParams.get('word') || '');
  if (!clean) return json({ error: 'Type a word.' }, 400);
  if (await rateLimited(request, env, 'meanings', 30)) return json({ error: 'slow down' }, 429);
  let cache = null, key = null, hit = null;
  try {
    cache = caches.default;
    key = new Request(new URL(request.url).origin + '/__meanings/' + encodeURIComponent(clean.toLowerCase()));
    const found = await cache.match(key);
    if (found) hit = { ...(await found.json()), cached: true };
  } catch (_) { cache = null; }
  if (hit) return json(hit);
  const made = await defineWord(clean);
  if (cache && made.keep) { try { await cache.put(key, json(made.body, 200, { 'cache-control': 'max-age=' + (made.body.found ? 86400 : 3600) })); } catch (_) {} }
  return json(made.body, made.status);
}

export function onRequestGet(context) { return answer(context.request, context.env); }
