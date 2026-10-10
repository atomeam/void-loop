// Whose memory a request is allowed to reach: the owner (READ_TOKEN or an owner session) -> { scope: '' }; a signed-in paid member (their passkey
// session, tier 'paid' as /api/gumroad recorded it) -> { scope: <their account id> }; a signed-in free account -> { free: true }; anyone else -> null.
// Shared by /api/memory and the answer path (/api/answer), so a note is reachable the same way in both and by no one else.
import { ownerOk } from './guard.js';
import { ensureTables, session, tierOf } from './void-me.js';

export async function scopeOf({ request, env }) {
  if (await ownerOk(request, env)) return { scope: '' };
  if (!env.DB) return null;
  try {
    await ensureTables(env);
    const me = await session(request, env);
    if (!me) return null;
    return (await tierOf(env, me.userId)) === 'paid' ? { scope: me.userId } : { free: true };
  } catch (_) { return null; }
}
