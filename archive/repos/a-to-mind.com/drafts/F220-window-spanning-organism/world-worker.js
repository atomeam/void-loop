// SharedWorker: ONE world and ONE creature for every open window of this page.
importScripts('core.js');
const world = new F220.World({ seed: (Date.now() % 100000) + 1 });
const ports = new Map(); // id -> {port, seen}
let n = 0;
onconnect = (e) => {
  const port = e.ports[0]; const id = 'w' + (++n);
  ports.set(id, { port, seen: Date.now() });
  port.onmessage = (m) => {
    const d = m.data, p = ports.get(id); if (!p) return; p.seen = Date.now();
    if (d.type === 'rect') world.setRoom(id, d.rect);
    else if (d.type === 'bye') { ports.delete(id); world.removeRoom(id); }
    else if (d.type === 'mode') world.mode = d.mode;
    else if (d.type === 'feed' && d.x != null) { world.food = { room: id, x: d.x, y: d.y, born: world.tick }; world.plan = []; world.waypoint = null; }
  };
  port.postMessage({ type: 'hello', id });
  port.start();
};
setInterval(() => {
  const now = Date.now();
  for (const [id, p] of ports) if (now - p.seen > 3000) { ports.delete(id); world.removeRoom(id); } // tab closed without saying bye
  for (let i = 0; i < 2; i++) world.step();
  const snap = world.snapshot();
  for (const [id, p] of ports) p.port.postMessage({ type: 'state', snap, belief: world.belief(id), events: world.events.slice(-6) });
}, 33);
