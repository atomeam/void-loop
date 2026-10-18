/**
 * own-parts skill: V01D's own components by name (owner, 2026-10-18: "Show me the Site Test card" fetched a Visa test card).
 * "show me the site test card", "open the book", "where is the status page", "the rule registry view": the ask names a part of
 * V01D (lib/own-parts.js, one table), so it goes to the skill that shows that part, ranked ahead of every generic skill and the
 * article fallback. It draws nothing itself: it runs the part's skill on the ask that skill already answers and names that
 * skill as the one that answered (part), so the log and the benchmark read skill:growth, not skill:own-parts.
 * Contract: { name, examples, nearMisses, match(lower, text), part(lower, text), run(text, api) }
 */
import { partOf } from '../lib/own-parts.js';
import growth from './growth.js';
import guide from './guide.js';
import status from './status.js';
import merges from './merges.js';

// the skills a part is shown by; an ask the skill already takes on its own stays its (no overlap: skill-overlap.mjs), this skill takes the rest
const SHOWN_BY = { growth, guide, status, merges };

async function run(text, api) {
  const p = partOf(text);
  if (!p) return 'none';
  return SHOWN_BY[p.skill].run(p.ask, api);
}

export default {
  name: 'own-parts',
  examples: ['show me the site test card', 'the site test card', 'open the site test', 'pull up the status card', 'pull up the growth inbox', 'show me the tome', 'open the rule registry view', 'show me the stability trend', 'my site test card'],
  nearMisses: ['show me a visa test card', 'site test results for my website speed', 'test card numbers for stripe', 'what is the status of my order', 'the book thief', 'open a book about dogs', 'show me the weather card', 'growth chart for a toddler', 'status quo', 'inbox zero tips'],
  match(lower, text) { const p = partOf(text || lower); return !!p && !SHOWN_BY[p.skill].match(lower, text); },
  part(lower, text) { const p = partOf(text || lower); return p ? p.skill : null; },
  run,
};
