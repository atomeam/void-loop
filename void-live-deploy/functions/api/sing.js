// Verse sings a whole song (lib/sing.js has the why). ACE-Step 1.5 runs on the owner's own Modal account (modal/verse_sing.py); this asks it.
// GET                         -> { on, signedIn, member, left, perDay }   whether the music card offers "Sing it" to this visitor
// POST (Bearer session) { ask, lyrics?, seconds? } -> audio/mpeg, the sung song; header x-verse-lyrics has the words sung (URI-encoded)
//   503 { error } singing is not switched on (no VERSE_SING_URL / VERSE_SING_KEY Pages secrets yet) or Modal failed
//   401 not signed in | 402 not a member (MultiVerse) | 400 nothing to sing about, or lyrics that are not lyrics | 429 past a limit
// Only the owner and paid members sing, because every song spends the owner's Modal credit: SING_PER_MEMBER a day each, SING_PER_DAY in all
// (lib/daily-cap.js, one D1 counter, fail closed). The same ask sung again comes from the edge cache and costs nothing. Without lyrics, the
// free chat model writes the words first. The shared key (VERSE_SING_KEY) goes only to Modal, in a header; nothing about the visitor does.
import { ensureTables, bad, good, session, tierOf, brake } from '../../lib/void-me.js';
import { BUY } from '../../lib/members.js';
import { capAll, peek } from '../../lib/daily-cap.js';
import { recordShortfall, reasonOf } from '../../lib/shortfall.js';
import { chat } from './translate.js';
import { captionOf, lyricsOf, lyricsMessages, secondsOf, singOn, cacheTextOf, SING_PER_MEMBER, SING_PER_DAY, SING_TTL } from '../../lib/sing.js';

export const SING_WAIT_MS = 290000; // the first song after a quiet spell starts the GPU, which can take minutes
const userKey = (id) => 'sing-u-' + String(id).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50);
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 40); }
const cacheOf = () => { try { return caches.default; } catch (_) { return null; } };

async function who(request, env) {
  await ensureTables(env);
  const me = await session(request, env);
  return me ? { me, member: (await tierOf(env, me.userId)) === 'paid' } : { me: null, member: false };
}

export async function onRequestGet({ request, env }) {
  const on = singOn(env);
  try {
    const { me, member } = await who(request, env);
    if (!me) return good({ on, signedIn: false, member: false, perDay: SING_PER_MEMBER });
    const used = member ? await peek(env, userKey(me.userId)) : 0;
    return good({ on, signedIn: true, member, perDay: SING_PER_MEMBER, ...(member ? { left: Math.max(0, SING_PER_MEMBER - (used || 0)) } : {}) });
  } catch (_) { return good({ on, signedIn: false, member: false, perDay: SING_PER_MEMBER }); }
}

export async function onRequestPost({ request, env, fetchFn = fetch }) {
  if (brake(request, 6)) return bad(429, 'too many tries; wait a minute');
  let b; try { b = JSON.parse((await request.text()).slice(0, 6000)); } catch (_) { return bad(400, 'bad json'); }
  if (!singOn(env)) return bad(503, 'Verse cannot sing yet: its singing voice is not switched on');
  let me, member;
  try { ({ me, member } = await who(request, env)); } catch (_) { return bad(503, 'try again in a moment'); }
  if (!me) return bad(401, 'sign in with your passkey first');
  if (!member) return bad(402, 'a sung song is part of MultiVerse', { buy: BUY });
  const caption = captionOf(b && b.ask);
  if (!caption) return bad(400, 'say what the song is about');
  const given = b && b.lyrics != null && String(b.lyrics).trim() ? lyricsOf(b.lyrics) : '';
  if (given === null) return bad(400, 'those words need at least 4 lines to sing');
  const seconds = secondsOf(b && b.seconds);

  const c = cacheOf(), key = new URL(request.url).origin + '/__verse-sing/' + await sha(cacheTextOf(caption, given, seconds));
  if (c) { try { const hit = await c.match(key); if (hit) return new Response(hit.body, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=0', 'x-verse-lyrics': hit.headers.get('x-verse-lyrics') || '', 'x-verse-sing': 'cached' } }); } catch (_) {} }

  const took = await capAll(env, [[userKey(me.userId), SING_PER_MEMBER], ['sing', SING_PER_DAY]]);
  if (!took.ok) return bad(429, took.key === 'sing' ? 'Verse has sung all it can today; try tomorrow' : 'that is ' + SING_PER_MEMBER + ' songs today; sing more tomorrow');

  const lyrics = given || lyricsOf(await chat(env, lyricsMessages(b.ask), 500)) || '[Instrumental]';
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(new Error('timed out')), SING_WAIT_MS);
  let bytes = null;
  try {
    const r = await fetchFn(String(env.VERSE_SING_URL).trim(), { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-verse-key': String(env.VERSE_SING_KEY).trim() }, body: JSON.stringify({ caption, lyrics, seconds }) });
    if (!r.ok) throw new Error('modal ' + r.status);
    if (!/audio\//i.test(r.headers.get('content-type') || '')) throw new Error('not audio');
    bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.length < 1000) throw new Error('empty');
  } catch (e) { await recordShortfall(env, 'sing', reasonOf(e)); return bad(503, 'Verse could not sing just now; try again in a minute'); }
  finally { clearTimeout(timer); }

  const words = encodeURIComponent(lyrics);
  if (c) { try { await c.put(key, new Response(bytes, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'public, max-age=' + SING_TTL, 'x-verse-lyrics': words } })); } catch (_) {} }
  return new Response(bytes, { headers: { 'content-type': 'audio/mpeg', 'cache-control': 'private, max-age=0', 'x-verse-lyrics': words, 'x-verse-sing': 'new' } });
}
