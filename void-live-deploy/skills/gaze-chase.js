/**
 * gaze-chase skill — Tilt Arena's Gaze Chase mode: in VR the agents chase where you look, and without VR the pointer or tilt steers.
 * Combined from frontier draft F-226 (owner, 2026-10-21).
 * without VR the pointer or tilt steers, so it always plays.
 * The law is lib/tilt-arena.js (pure, tested); the card is lib/tilt-arena-idea.js on lib/field-stage.js, with the Tilt Arena Mode switcher.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { fieldSkill } from '../lib/field-stage.js';
import { arenaIdea } from '../lib/tilt-arena-idea.js';

export default fieldSkill({
  name: 'gaze-chase',
  words: '(?:gaze chase|gaze arena|look to steer|steer (?:it )?with (?:my )?(?:eyes|gaze|head))',
  examples: ['gaze chase', 'look to steer', 'steer with my gaze'],
  nearMisses: ['gaze at the stars tonight', 'chase bank hours', 'look up a word'],
  idea: arenaIdea('gaze-chase'), say: 'Tilt Arena, Gaze Chase: tap Enter VR (gaze) and the agents chase where you look; without VR, point or tilt'
});
