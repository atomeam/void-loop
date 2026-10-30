/**
 * mind-field skill — Mind Field (owner, 2026-10-21: "always combine anything that can be without taking away", "make them all easier to
 * find"): Verse's ten field minds as one skill with modes. Doodle Mind (doodle-mind: F-224, F-225, F-229), Echo Field (echo-field: the
 * acoustic F-225, a sound mode), Resonant Membrane (resonant-membrane: F-232's membrane, pluck it and hear it), Swarm, Flow (vector field), Listen
 * (resonance), Grow (NCA lattice), Attention, Living cards and Memory orbs (agent-fluid-memory-orbs: F-321, added 2026-10-29). Each member keeps its own file, words, examples, near misses and tests, and
 * asks reach them in their old order (lib/skill-family.js); mind-field-mode adds "mind field <mode>", "listen field", "mind field modes"
 * and "save this mind". The family sits where vector-field-mind sat (1400), the first of them. Every card carries the Mode switcher
 * (lib/field-stage.js, lib/mind-field-modes.js).
 * parts: ['mind-field-mode', 'doodle-mind', 'echo-field', 'resonant-membrane', 'vector-field-mind', 'living-cards-mind', 'attention-field-mind', 'nca-mind', 'resonance-mind', 'swarm-mind', 'agent-fluid-memory-orbs']
 */
import { family } from '../lib/skill-family.js';
import mode from './mind-field-mode.js';
import doodle from './doodle-mind.js';
import echo from './echo-field.js';
import membrane from './resonant-membrane.js';
import vectorField from './vector-field-mind.js';
import livingCards from './living-cards-mind.js';
import attention from './attention-field-mind.js';
import nca from './nca-mind.js';
import resonance from './resonance-mind.js';
import swarmMind from './swarm-mind.js';
import fluidOrbs from './agent-fluid-memory-orbs.js';

export default family('mind-field', [mode, doodle, echo, membrane, vectorField, livingCards, attention, nca, resonance, swarmMind, fluidOrbs]);
