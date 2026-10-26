// /chess/'s thinking runs here (lib/chess-engine.js), so the board answers taps while the computer searches. A message { id, fen, opts, before } (the FENs of the game's earlier positions, for repetition) is
// answered by { id, info } lines while it looks deeper and one { id, result }. Only inside a worker: in Node there is no `self` to listen on.
import { search, keyOf } from './chess-engine.js';
if (typeof self !== 'undefined' && typeof self.postMessage === 'function') self.onmessage = (e) => {
  const { id, fen, opts = {}, before = [] } = e.data || {}; let result = null;
  try { result = search(fen, { ...opts, prior: before.map(keyOf), onInfo: (info) => self.postMessage({ id, info }) }); } catch (err) { result = { move: null, error: String(err && err.message || err) }; }
  self.postMessage({ id, result });
};
