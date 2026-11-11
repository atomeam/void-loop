/**
 * reuse-tools skill: the "reuse what exists before building" family (convergence, lists run 16, 2026-11-11). reuse-pack (a business process
 * mapped to existing tools Verse can own or connect) and connect-pack (the existing tools to reuse first, so Verse owns the connections) both
 * took "reuse pack for client onboarding", so tools/skill-overlap.mjs listed them as a merge candidate; both read void.existing-tools.md.
 * One routing entry at 9900, where reuse-pack sat (connect-pack was right after it at 9910, nothing between); reuse-pack is asked first as
 * before, so every ask of either lands on the same member (tools/reuse-tools-family.test.mjs). Each member keeps its file, examples,
 * near misses and tests, and the page still logs skill:reuse-pack / skill:connect-pack (lib/skill-family.js).
 * parts: ['reuse-pack', 'connect-pack']
 */
import { family } from '../lib/skill-family.js';
import reusePack from './reuse-pack.js';
import connectPack from './connect-pack.js';

export default family('reuse-tools', [reusePack, connectPack]);
