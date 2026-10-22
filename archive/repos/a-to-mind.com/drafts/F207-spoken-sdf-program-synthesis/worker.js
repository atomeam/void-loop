importScripts('core.js');
var S = null, running = false;
function loop() {
  if (!S || !running) return;
  var t0 = Date.now(), r;
  while (Date.now() - t0 < 120) r = S.step(32);
  postMessage(r);
  if (S.gen < 4000) setTimeout(loop, 10); else running = false;
}
onmessage = function (e) {
  var m = e.data;
  if (m.type === 'intent') { S = new F207.Searcher(m.intent, m.seeds); running = true; loop(); }
  if (m.type === 'pause') running = false;
  if (m.type === 'resume' && S) { running = true; loop(); }
};
