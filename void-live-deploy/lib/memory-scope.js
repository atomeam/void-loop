// Whose memory a request is allowed to reach: the owner (READ_TOKEN or an owner session) -> { scope: '' }; a paid member -> { scope: <their account id> },
// by their passkey session (a browser) or their Verse key vr1.… (a machine: tools/ouroboros.py push; the same key paid Verse mints for code review,
// lib/review-api.js, one key for both); a free account, a key of a free account or a key Verse does not know -> { free: true, why }; anyone else -> null.
// Shared by /api/memory and the answer path (/api/answer), so a note is reachable the same way in both and by no one else.
import { ownerOk } from './guard.js';
import { ensureTables, session, tierOf } from './void-me.js';
import { KEY_RE, keyHash } from './review-api.js';

export const KEY_HELP = 'Make one at https://a-to-mind.com/code-review/#pro (signed in, on MultiVerse).';
export async function scopeOf({ request, env }) {
  if (await ownerOk(request, env)) return { scope: '' };
  if (!env.DB) return null;
  try {
    await ensureTables(env);
    const t = (/^Bearer (\S+)$/.exec(request.headers.get('authorization') || '') || [])[1] || '';
    if (KEY_RE.test(t)) { // a Verse key: its account must be paid right now
      const row = await env.DB.prepare('SELECT user_id FROM void_review_keys WHERE hash = ?').bind(await keyHash(t)).first();
      if (!row) return { free: true, why: 'Verse does not know this key. ' + KEY_HELP };
      return (await tierOf(env, row.user_id)) === 'paid' ? { scope: row.user_id } : { free: true, why: 'this key belongs to an account that is not on MultiVerse. ' + KEY_HELP };
    }
    const me = await session(request, env);
    if (!me) return null;
    return (await tierOf(env, me.userId)) === 'paid' ? { scope: me.userId } : { free: true, why: 'this account is not on MultiVerse.' };
  } catch (_) { return null; }
}
