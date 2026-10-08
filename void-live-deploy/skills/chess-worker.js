// Void's chess thinking runs here so the 3D board keeps gliding while it searches (skills/chess.js posts positions).
import { bestMove } from './chess-rules.js';
self.onmessage = (e) => { const { id, s, opts } = e.data; let m = null; try { m = bestMove(s, opts); } catch (_) {} self.postMessage({ id, m }); };
