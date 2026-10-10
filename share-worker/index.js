// void-share: the Durable Object behind "invite someone" (frontier #11). One ShareRoom per invite; every tab on the
// invite holds a WebSocket to it, and the room (void-live-deploy/lib/share.js) passes cursors and summons between them.
// Nothing is stored: when the last tab closes, the room is gone. The Pages project reaches it through the SHARE binding
// (functions/api/share/[room].js), which only forwards rooms the site itself signed.
//   deploy once:  cd share-worker && npx wrangler deploy      (then the binding in void-live-deploy/wrangler.toml)
import { Room } from '../void-live-deploy/lib/share.js';

export class ShareRoom {
  constructor(state, env) { this.state = state; this.room = new Room(); }
  // one tab's socket into the room; null (and the socket closed with 4001) when the room is full
  accept(server) {
    server.accept();
    const id = this.room.join((m) => server.send(JSON.stringify(m)));
    if (!id) { try { server.close(4001, 'this Void is full'); } catch (_) {} return null; }
    const bye = () => this.room.leave(id);
    server.addEventListener('message', (e) => this.room.message(id, e.data));
    server.addEventListener('close', bye);
    server.addEventListener('error', bye);
    return id;
  }
  async fetch(request) {
    if ((request.headers.get('upgrade') || '').toLowerCase() !== 'websocket') return new Response('a WebSocket only', { status: 426 });
    const [client, server] = Object.values(new WebSocketPair());
    this.accept(server);
    return new Response(null, { status: 101, webSocket: client });
  }
}

export default {
  fetch: () => new Response('void-share: rooms are reached through a-to-mind.com/api/share', { status: 404 }),
};
