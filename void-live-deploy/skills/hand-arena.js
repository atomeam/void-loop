/**
 * hand-arena skill — Tilt Arena's Hand Arena mode: in VR with hand tracking your fingertip leads the agents, and otherwise the pointer or tilt steers.
 * Combined from frontier draft F-232 (owner, 2026-10-21).
 * otherwise the pointer or tilt steers.
 * The law is lib/tilt-arena.js (pure, tested); the card is lib/tilt-arena-idea.js on lib/field-stage.js, with the Tilt Arena Mode switcher.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { fieldSkill } from '../lib/field-stage.js';
import { arenaIdea } from '../lib/tilt-arena-idea.js';

export default fieldSkill({
  name: 'hand-arena',
  words: '(?:hand arena|hand tracking arena|steer (?:it )?with my hands?|hand chase)',
  examples: ['hand arena', 'steer with my hand', 'hand tracking arena'],
  nearMisses: ['hand me the salt', 'arena tickets', 'hand washing steps'],
  idea: arenaIdea('hand-arena'), say: 'Tilt Arena, Hand Arena: tap Enter VR (hands) and your fingertip leads; without VR, point or tilt'
});
