/**
 * list-templates skill — starter lists (owner, 2026-10-18: "1000 more simple things", tools pack 10, items 332-340): ask for a
 * "shopping list template", "packing list template for a beach trip", "meeting agenda template", "groceries list template",
 * "reading list template", "bug list template", "ideas list template", "gratitude list template" or "contacts template" and the
 * stage gets a list (or, for bugs and contacts, a data table) already filled with a sensible start to edit. The word
 * "template" must be in the ask: "make a grocery list" is still the plain list in skills/list.js. Data is lib/list-templates.js.
 * Device-local; nothing is sent anywhere.
 */
import { addThing } from '../lib/stage-pack.js';
import { parseTemplate, cardFor } from '../lib/list-templates.js';

/** put the template an ask names on the stage; 'list-template' when it did, '' when the ask is not one. */
export function ask(lower, text, stageApi) {
  const p = parseTemplate(text);
  if (!p) return '';
  const card = cardFor(p.tpl, p.topic);
  if (stageApi.snapshot) stageApi.snapshot();
  addThing(stageApi, card.kind, card.props);
  stageApi.save(); stageApi.render();
  stageApi.say(p.tpl.title + ' is on the stage: tap anything to edit it');
  return 'list-template';
}

export default {
  name: 'list-templates',
  examples: ['shopping list template', 'meeting agenda template', 'bug list template', 'contacts template'],
  nearMisses: ['make a grocery list', 'what should I pack for a trip', 'email template for a meeting agenda', 'list my routines'],
  match(lower, text) { return !!parseTemplate(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'list-templates' : 'none'; },
};
