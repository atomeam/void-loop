/**
 * tilt-mode skill — Tilt Arena's Tilt mode: tilt your phone or move the pointer and a dozen tiny learning agents race to the spot, the weakest copying the leader.
 * Combined from frontier drafts F-205, F-206, F-208, F-228 and F-230 (owner, 2026-10-21: "combine anything that can be without
 * taking away"): each agent is a 3-6-2 network turned into force, chasing where
 * you tilt your phone or point; every few seconds the weakest becomes a mutated copy of the leader, and Seal keeps the leader's genome.
 * The law is lib/tilt-arena.js (pure, tested); the card is lib/tilt-arena-idea.js on lib/field-stage.js, with the Tilt Arena Mode switcher.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { fieldSkill } from '../lib/field-stage.js';
import { arenaIdea } from '../lib/tilt-arena-idea.js';

export default fieldSkill({
  name: 'tilt-mode',
  words: '(?:tilt arena|tilt ?arena game|tilt game|tilt (?:to steer|and chase)|genome arena|orientation (?:genome )?arena|agent arena|show me a .*deg tilt|tilt to .*deg)',
  examples: ['tilt arena', 'genome arena', 'tilt game', 'agent arena', 'show me a 45deg tilt'],
  nearMisses: ['what is the tilt of the earth', 'arena football scores', 'tilt shift photo', 'tilt my head'],
  idea: arenaIdea('tilt-mode'), say: 'Tilt Arena: tilt your phone or move the pointer, and twelve little learning agents chase it; Mode for Gaze Chase, GPU Swarm and Hand Arena'
});
