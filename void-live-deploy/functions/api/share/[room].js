// GET /api/share/<room> (WebSocket) -> the invite's room, one Durable Object per invite (share-worker/, binding SHARE).
// Only a room this site signed (lib/share.js roomOk) wakes a Durable Object, only Verse's own pages may open one (another
// site's page can't put a tab into your Verse), and without the binding the page is told the relay is not switched on.
// A public room (lib/share.js PUBLIC_ROOMS, e.g. /api/share/public-is-it for the is-it card's crowd) needs no signature: anyone on Verse's own
// pages may join. WHAT A STRANGER COULD MAKE IT DO: move a flag (a two-letter region code from a closed shape) across other visitors' is-it
// cards, make a ripple, stamp a flag; at most RATE messages a second per tab, at most the room's size at once (150), nothing stored, nothing
// typed ever passes (the room drops every other message kind), and the same-origin check above still holds. A guessed public name that is
// not on the list is a 404, so no stranger wakes a Durable Object for a name they made up.
import { roomOk, publicRoom } from '../../../lib/share.js';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function onRequestGet({ request, env, params }) {
  if ((request.headers.get('upgrade') || '').toLowerCase() !== 'websocket') return json(426, { error: 'a WebSocket only' });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json(403, { error: 'cross-site' });
  const room = String((params && params.room) || '');
  if (!publicRoom(room) && !(await roomOk(room, env.SALT))) return json(404, { error: 'no such invite' });
  if (!env.SHARE) return json(503, { error: 'the live relay is not switched on yet' });
  return env.SHARE.get(env.SHARE.idFromName(room)).fetch(request);
}
