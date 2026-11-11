/**
 * proposals skill: the proposal family (convergence, lists run 17, 2026-11-11). proposal-pack (a client proposal that packages what Verse
 * owns and what the client keeps) and proposal (turn a request or an email into a proposal) both took proposal's own asks, and
 * proposal-pack at 1025 answered them first, so tools/skill-overlap.mjs listed proposal~proposal-pack. One routing entry at 1025, where
 * proposal-pack sat (proposal was right after it at 1030, nothing between); proposal-pack is asked first as before, so every ask of either
 * lands on the same member (tools/proposals-family.test.mjs). Each member keeps its file, examples, near misses and tests, and the page
 * still logs skill:proposal-pack / skill:proposal (lib/skill-family.js).
 * parts: ['proposal-pack', 'proposal']
 */
import { family } from '../lib/skill-family.js';
import proposalPack from './proposal-pack.js';
import proposal from './proposal.js';

export default family('proposals', [proposalPack, proposal]);
