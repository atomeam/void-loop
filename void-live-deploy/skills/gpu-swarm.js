/**
 * gpu-swarm skill — Tilt Arena's GPU Swarm mode: 256 learning agents whose networks run on your graphics card, switching to the processor by itself where it can't.
 * Combined from frontier draft F-223 (owner, 2026-10-21).
 * graphics card; without WebGPU, or if it fails, the same networks run on the processor automatically.
 * The law is lib/tilt-arena.js (pure, tested); the card is lib/tilt-arena-idea.js on lib/field-stage.js, with the Tilt Arena Mode switcher.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { fieldSkill } from '../lib/field-stage.js';
import { arenaIdea } from '../lib/tilt-arena-idea.js';

export default fieldSkill({
  name: 'gpu-swarm',
  words: '(?:gpu swarm|webgpu swarm|graphics card swarm|gpu arena|swarm on (?:the|my) gpu)',
  examples: ['gpu swarm', 'show me the gpu swarm', 'webgpu swarm', 'gpu arena'],
  nearMisses: ['which gpu should i buy', 'swarm of bees', 'gpu prices'],
  idea: arenaIdea('gpu-swarm'), say: 'Tilt Arena, GPU Swarm: 256 agents on your graphics card (or the processor where it cannot), chasing your pointer or tilt'
});
