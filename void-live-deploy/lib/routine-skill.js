// One-click forge for an approved routine (asked by Verse: "implement a 'one-click forge' for proposed routines that allows the owner
// to instantly commit a new skill.js file to the codebase"). A routine is only asks Verse already answers (lib/shared-routines.js),
// so the skill made from one does nothing typing them could not: its source holds the asks as JSON string literals (never as code),
// answers one exact phrase ("run <author>'s <name>") and sends each ask through the same path as typing it. The owner reviews the
// offer first (/api/routines); this turns the approved one into a file. Pure: tools/routine-skill.mjs writes and registers it.
import { cleanOffer } from './shared-routines.js';

/** the skill's name from a routine: lowercase letters, digits and dashes, starting with a letter. Pure. */
export const skillNameOf = (o) => ('routine-' + String(o.author) + '-' + String(o.name)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');

/** { name, phrase, source } for an offered routine { name, author, asks }, or { error }. Pure. */
export function skillOf(offer) {
  const c = cleanOffer(offer);
  if (c.error) return { error: c.error };
  const name = skillNameOf(c), phrase = "run " + c.author.toLowerCase() + "'s " + c.name;
  if (!/^[a-z][a-z0-9-]{1,30}$/.test(name)) return { error: 'the routine and its author do not make a skill name' };
  const lit = (s) => JSON.stringify(String(s));
  const source = `/**
 * ${name} — ${c.author}'s routine "${c.name}", forged into a skill by the owner (tools/routine-skill.mjs, asked by Verse).
 * Say ${lit(phrase)}: its asks go through the same path as typing them, in this order. It can do nothing typing them could not.
 */
const ASKS = ${JSON.stringify(c.asks)};
const PHRASE = ${lit(phrase)};
let running = false; // a routine never runs inside itself

export default {
  name: ${lit(name)},
  examples: [PHRASE],
  nearMisses: [${lit('run ' + c.author.toLowerCase() + ' ' + c.name + ' please now')}],
  match(lower) { return lower.trim().replace(/[.!]+$/, '') === PHRASE; },
  async run(text, api) {
    if (running) return 'none';
    running = true;
    try { for (const a of ASKS) await api.stage.ask(a); } finally { running = false; }
    api.say(${lit(c.author + "'s " + c.name)} + ': ' + ASKS.length + ' ask' + (ASKS.length === 1 ? '' : 's'));
    return ${lit(name)};
  }
};
`;
  return { name, phrase, source, asks: c.asks };
}
