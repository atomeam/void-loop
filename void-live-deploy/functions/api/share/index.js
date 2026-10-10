// POST /api/share (Bearer session) -> { room, link, live }: an invite into your Void (frontier #11). Signed-in members only:
// a stranger can't make rooms. The room is a random name signed with SALT (lib/share.js), so nothing is stored to make one.
// live = the relay (the SHARE Durable Object, share-worker/) is bound; without it, tabs in one browser still share.
import { mintRoom, inviteLink } from '../../../lib/share.js';
import { session } from '../../../lib/void-me.js';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function onRequestPost({ request, env }) {
  const me = env.DB ? await session(request, env).catch(() => null) : null;
  if (!me) return json(401, { error: 'sign in first: say remember me' });
  if (!env.SALT) return json(503, { error: 'invites are not set up on this site' });
  const room = await mintRoom(env.SALT);
  return json(200, { room, link: inviteLink(new URL(request.url).origin, room), live: !!env.SHARE });
}
