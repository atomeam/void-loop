// Verse's rapping voice (owner, 2026-10-30: "improve verse spoken voice so it sound good rapping"). The browser's own speech voice cannot be
// timed to a beat (it says a line at its own pace, and every browser has a different one), so /rap/ and the stage's rap card ask here for one
// bar at a time, spoken by a real text-to-speech model, and lib/rap-voice.js cuts it into syllables and puts each one on the beat's grid.
// GET ?t=<one bar>  -> audio/mpeg (MeloTTS on the site's own Workers AI binding, models('voice')); edge-cached a week for everyone, so a bar
//                      said once costs nothing again. The bar is cleaned first (lib/rap.js voiceText): a bar the clean rule refuses is never said.
// 400 { note } for an empty or refused bar; 429 past 120 new bars a minute from one connection; 503 { note } with models off, past the day's
// allowance (VOICE_PER_DAY new bars in all, one D1 counter for every edge location, lib/daily-cap.js, fail closed) or when the model fails.
// Nothing is written but the shared count and the edge cache; the bar is the rap's own text, never anything about the visitor.
import { models } from '../../lib/models.js';
import { voiceText } from '../../lib/rap.js';
import { cap } from '../../lib/daily-cap.js';
import { recordShortfall, reasonOf } from '../../lib/shortfall.js';
import { rateLimited } from './answer.js';

export const VOICE_PER_DAY = 2500, VOICE_PER_MINUTE = 120, VOICE_TTL = 604800;
const say = (status, note) => Response.json({ note }, { status, headers: { 'cache-control': 'no-store' } });
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32); }

/** the MP3 bytes in whatever shape the binding answers with: { audio: base64 }, a stream, bytes, or a Response. null when there are none. */
export async function audioOf(r) {
  if (!r) return null;
  if (typeof r === 'object' && typeof r.audio === 'string') { const bin = atob(r.audio), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out.length ? out : null; }
  if (r instanceof Uint8Array) return r.length ? r : null;
  if (r instanceof ArrayBuffer) return r.byteLength ? new Uint8Array(r) : null;
  if (typeof ReadableStream !== 'undefined' && r instanceof ReadableStream) { const b = new Uint8Array(await new Response(r).arrayBuffer()); return b.length ? b : null; }
  if (typeof Response !== 'undefined' && r instanceof Response) { const b = new Uint8Array(await r.arrayBuffer()); return b.length ? b : null; }
  return null;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url), text = voiceText(url.searchParams.get('t'));
  if (!text) return say(400, 'no bar to say');
  const key = new Request(url.origin + '/__void-voice/' + await sha('melotts|en|' + text));
  try { const hit = await caches.default.match(key); if (hit) return new Response(hit.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=' + VOICE_TTL, 'x-verse-voice': 'cached' } }); } catch (_) {}
  if (!env || !env.AI || String(env.VOID_ANSWER_MODELS || '').trim().toLowerCase() === 'off') return say(503, 'voice off');
  if (await rateLimited(request, env, 'rapvoice', VOICE_PER_MINUTE)) return say(429, 'slow down');
  if (!(await cap(env, 'rapvoice', VOICE_PER_DAY)).ok) return say(503, 'voice resting');
  let bytes = null;
  try { bytes = await audioOf(await env.AI.run(models('voice'), { prompt: text, lang: 'en' })); } catch (e) { await recordShortfall(env, 'rapvoice', reasonOf(e)); return say(503, 'voice busy'); }
  if (!bytes) { await recordShortfall(env, 'rapvoice', 'empty'); return say(503, 'voice busy'); }
  const headers = { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=' + VOICE_TTL };
  try { await caches.default.put(key, new Response(bytes, { headers })); } catch (_) {}
  return new Response(bytes, { headers });
}
