/**
 * tilt-arena skill — Tilt Arena (owner, 2026-10-21: "always combine anything that can be without taking away", "make them all easier to
 * find"): one arena of tiny learning agents with four ways to steer: Tilt (tilt-mode: F-205, F-206, F-208, F-228, F-230), Gaze Chase
 * (gaze-chase: F-226), GPU Swarm (gpu-swarm: F-223, with an automatic processor fallback) and Hand Arena (hand-arena: F-232). Each mode
 * keeps its own file, words, examples, near misses and tests (lib/skill-family.js); tilt-arena-mode adds "tilt arena <mode>",
 * "tilt arena modes" and "save the arena". Every card carries the Mode switcher (lib/field-stage.js, lib/tilt-arena-modes.js).
 * parts: ['tilt-arena-mode', 'tilt-mode', 'gaze-chase', 'gpu-swarm', 'hand-arena']
 */
import { family } from '../lib/skill-family.js';
import mode from './tilt-arena-mode.js';
import tilt from './tilt-mode.js';
import gaze from './gaze-chase.js';
import gpuSwarm from './gpu-swarm.js';
import hand from './hand-arena.js';

export default family('tilt-arena', [mode, tilt, gaze, gpuSwarm, hand]);
