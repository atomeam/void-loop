// tilt-arena-modes — Tilt Arena's modes (owner, 2026-10-21: "combine anything that can be without taking away" and "make them all easier
// to find"): one arena of small learning agents chasing what you steer, four ways to steer it. This table is the Mode switcher on every
// arena card, the "tilt arena <mode>" words and the list "tilt arena modes" and the book show. Pure: no DOM.
export const MODES = [
  { id: 'tilt-mode', name: 'Tilt', title: 'Tilt (or pointer)', ask: 'tilt arena', words: ['tilt', 'tilting', 'pointer', 'classic', 'orientation'], about: 'tilt your phone or move the pointer and a dozen tiny learning agents race to the spot; the weakest copies the leader' },
  { id: 'gaze-chase', name: 'Gaze Chase', title: 'Gaze Chase (look to steer)', ask: 'gaze chase', words: ['gaze', 'gaze chase', 'look', 'eyes', 'vr', 'head'], about: 'in VR, where you look is what they chase; without VR the pointer or tilt steers' },
  { id: 'gpu-swarm', name: 'GPU Swarm', title: 'GPU Swarm (256 agents)', ask: 'gpu swarm', words: ['gpu', 'gpu swarm', 'fast', 'big', 'swarm', 'many'], about: "256 agents whose networks run on your graphics card; where that isn't available it switches to the processor by itself" },
  { id: 'hand-arena', name: 'Hand Arena', title: 'Hand Arena (steer with your hand)', ask: 'hand arena', words: ['hand', 'hands', 'hand arena', 'finger', 'fingers'], about: 'in VR with hand tracking, your fingertip is the target; otherwise the pointer or tilt steers' }
];
export const MODE_IDS = MODES.map((m) => m.id);
export const isMode = (id) => MODE_IDS.includes(String(id || ''));
const CLEAN = (t) => String(t || '').toLowerCase().trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
/** "tilt arena gaze", "tilt arena in hand mode", "switch tilt arena to gpu swarm", "gaze arena": the mode it names, or null. Pure. */
export function modeAsk(text) {
  const t = CLEAN(text);
  let m = /^(?:(?:show|open|start|run|play|give|let me see|switch|set|change|put)\s+(?:me\s+)?)?(?:the\s+|a\s+|my\s+)?tilt ?arena(?:'s)?\s+(?:to\s+|in(?:to)?\s+|on\s+)?(?:the\s+)?([a-z ]+?)(?:\s+mode)?$/.exec(t);
  if (!m) m = /^(?:(?:show|open|start|play|give)\s+(?:me\s+)?)?(?:the\s+|a\s+)?([a-z]+?) (?:mode )?arena$/.exec(t);
  if (!m) return null;
  const w = m[1].trim();
  return MODES.find((x) => x.name.toLowerCase() === w || x.words.includes(w)) || null;
}
/** "tilt arena modes", "what modes does tilt arena have": true. Pure. */
export const listAsk = (text) => /^(?:(?:show|list|what are)\s+(?:me\s+)?)?(?:the\s+|all\s+)?(?:tilt ?arena|arena) modes$|^what modes does (?:the )?tilt ?arena have$/.test(CLEAN(text));
/** "save the arena", "seal the arena leader", "save this arena": true. Pure. */
export const saveAsk = (text) => /^(?:save|seal|keep) (?:this|my|the) (?:tilt )?arena(?: leader)?$/.test(CLEAN(text));
