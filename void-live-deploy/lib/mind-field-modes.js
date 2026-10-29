// mind-field-modes — Mind Field's modes (owner, 2026-10-21: "always combine anything that can be without taking away" and "make them all
// easier to find"): the ten field minds are one skill (skills/mind-field.js), each old skill a mode that keeps its own file, words and
// tests. This table is the switcher on every mode's card, the "mind field <mode>" words, and the list the book and "what's similar" show.
// Pure: no DOM.
export const MODES = [
  { id: 'doodle-mind', name: 'Doodle Mind', title: 'Doodle Mind (draw)', ask: 'draw with a mind', words: ['draw', 'doodle', 'sketch', 'thought trace', 'trace', 'doodle mind'], about: 'draw and it guesses your next stroke; orbs, tilt and sound feed it' },
  { id: 'echo-field', name: 'Echo Field', title: 'Echo Field (sound)', ask: 'echo field', words: ['echo', 'echoes', 'echo field', 'voice', 'acoustic', 'mic', 'microphone'], about: 'your voice and the sound around you move the field, and its word orbs drift to the loudest spots (the microphone only after you press Listen)' },
  { id: 'resonant-membrane', name: 'Membrane', title: 'Resonant Membrane (pluck)', ask: 'resonant membrane', words: ['membrane', 'resonant membrane', 'pluck', 'pluck it', 'singing'], about: 'pluck the field and hear it ring, its pitch following the energy where you touched (sound only from your tap, no microphone)' },
  { id: 'swarm-mind', name: 'Swarm', title: 'Swarm', ask: 'swarm mind', words: ['swarm', 'swarms', 'tribes', 'gravity'], about: 'two tribes of agents remember your pointer and compete' },
  { id: 'vector-field-mind', name: 'Flow', title: 'Flow (vector field)', ask: 'vector field mind', words: ['flow', 'vector', 'vectors', 'arrows'], about: 'particles ride a flow that keeps evolving' },
  { id: 'resonance-mind', name: 'Listen', title: 'Listen (resonance)', ask: 'resonance mind', words: ['listen', 'listening', 'sound', 'resonance', 'spectral', 'audio'], about: 'a lattice that rings with sound' },
  { id: 'nca-mind', name: 'Grow', title: 'Grow (living lattice)', ask: 'nca mind', words: ['grow', 'growing', 'lattice', 'nca', 'cells', 'cellular'], about: 'a self-growing pattern with tappable hotspots' },
  { id: 'attention-field-mind', name: 'Attention', title: 'Attention (probes)', ask: 'attention field mind', words: ['attention', 'attend', 'focus', 'probes', 'probe', 'attention probes'], about: 'a field steered by a small attention model (the attention probes), with the pointing-arrow focus test beside it', link: { href: '/fringe/attention-7.html', text: 'Try the pointing-arrow focus test' } },
  { id: 'living-cards-mind', name: 'Cards', title: 'Living cards', ask: 'living cards mind', words: ['cards', 'card', 'living cards'], about: 'the cards move like a living field' },
  { id: 'agent-fluid-memory-orbs', name: 'Orbs', title: 'Memory orbs (fluid)', ask: 'memory orbs', words: ['orbs', 'memory orbs', 'fluid', 'fluid orbs', 'memory'], about: 'small agents push a fluid; where it pools a memory orb is born, and you can seal one and recall it (F-321)' }
];
/** Verse Brain, where every mode joins as one mind (skills/verse-brain.js; owner, 2026-10-29: "combine all the builds into one entity").
 *  Not a mode of the family (it keeps its own skill): it is the last choice on every mode's switcher, and its own card opens any mode beside
 *  it. Each open mode is felt by the brain through the shared field (lib/mode-field.js). */
export const BRAIN = { id: 'verse-brain', name: 'Brain', title: 'Verse Brain (all of them as one)', ask: 'verse brain', about: 'every open mode felt in one workspace, with the memory orbs' };
export const MODE_IDS = MODES.map((m) => m.id);
export const isMode = (id) => MODE_IDS.includes(String(id || ''));

const CLEAN = (t) => String(t || '').toLowerCase().trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
/** "mind field swarm", "mind field in flow mode", "switch the mind field to listen", "listen field", "swarm field": the mode it names, or null. Pure. */
export function modeAsk(text) {
  const t = CLEAN(text);
  let m = /^(?:(?:show|open|start|run|give|let me see|switch|set|change|put)\s+(?:me\s+)?)?(?:the\s+|a\s+|my\s+)?mind ?field(?:'s)?\s+(?:to\s+|in(?:to)?\s+|on\s+)?(?:the\s+)?([a-z ]+?)(?:\s+mode)?$/.exec(t);
  if (!m) m = /^(?:(?:show|open|start|give)\s+(?:me\s+)?)?(?:the\s+|a\s+)?([a-z]+?) (?:mode )?(?:mind ?field|field)$/.exec(t);
  if (!m) m = /^(?:(?:show|open|start|give|use)\s+(?:me\s+)?)?(?:the\s+)?([a-z]+?) mode(?: of| in| on)? (?:the\s+)?mind ?field$/.exec(t);
  if (!m) return null;
  const w = m[1].trim();
  return MODES.find((x) => x.name.toLowerCase() === w || x.words.includes(w)) || null;
}
/** "mind field modes", "list the mind field modes", "what modes does mind field have": true. Pure. */
export const listAsk = (text) => /^(?:(?:show|list|what are)\s+(?:me\s+)?)?(?:the\s+|all\s+)?(?:mind ?field|mind) modes$|^what modes does (?:the )?mind ?field have$/.test(CLEAN(text));
/** "save this mind", "save the mind field", "seal this mind": true. Pure. */
export const saveAsk = (text) => /^(?:save|seal|keep) (?:this|my|the) mind(?: ?field)?$/.test(CLEAN(text));
