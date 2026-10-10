// GET /api/share/<room> (WebSocket) -> the invite's room, one Durable Object per invite (share-worker/, binding SHARE).
// Only a room this site signed (lib/share.js roomOk) wakes a Durable Object, only Void's own pages may open one (another
// site's page can't put a tab into your Void), and without the binding the page is told the relay is not switched on.
import { roomOk } from '../../../lib/share.js';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function onRequestGet({ request, env, params }) {
  if ((request.headers.get('upgrade') || '').toLowerCase() !== 'websocket') return json(426, { error: 'a WebSocket only' });
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json(403, { error: 'cross-site' });
  const room = String((params && params.room) || '');
  if (!(await roomOk(room, env.SALT))) return json(404, { error: 'no such invite' });
  if (!env.SHARE) return json(503, { error: 'the live relay is not switched on yet' });
  return env.SHARE.get(env.SHARE.idFromName(room)).fetch(request);
}
