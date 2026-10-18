// Starter lists for skills/list-templates.js (owner, 2026-10-18, tools pack 10, items 332-340). Plain data and one parser; pure.
// Each template is a list (items, optional `style`) or a data table (rows, `header`). Nothing here is a price or an account.

export const TEMPLATES = [
  { n: 332, key: 'shopping', words: ['shopping'], title: 'Shopping', items: ['Shirts', 'Socks and underwear', 'Shoes', 'Batteries', 'Light bulbs', 'Cleaning spray', 'Gift for someone', 'Return the thing'] },
  { n: 333, key: 'packing', words: ['packing', 'travel'], title: 'Packing', items: ['Passport or ID', 'Phone and charger', 'Wallet', 'Keys', 'Toothbrush', 'Medication', 'Clothes for each day', 'Pyjamas', 'Jacket', 'Headphones', 'Water bottle', 'Snacks'] },
  { n: 334, key: 'agenda', words: ['agenda', 'meeting'], title: 'Meeting agenda', style: 'numbers', items: ['Welcome and goal of the meeting', 'Updates since last time', 'Main topic', 'Decisions to make', 'Who does what by when', 'Next meeting'] },
  { n: 335, key: 'groceries', words: ['groceries', 'grocery'], title: 'Groceries', items: ['Fruit', 'Vegetables', 'Bread', 'Milk', 'Eggs', 'Cheese', 'Rice or pasta', 'Meat or beans', 'Coffee or tea', 'Something sweet'] },
  { n: 336, key: 'reading', words: ['reading', 'book', 'books'], title: 'Reading list', items: ['A book I keep meaning to read', 'A classic', 'A short one', 'One a friend recommended', 'Something about a place I want to visit'] },
  { n: 337, key: 'bugs', words: ['bug', 'bugs', 'issue', 'issues'], title: 'Bugs', header: true, rows: [['#', 'What is wrong', 'Severity', 'Status'], ['1', '', 'high', 'open'], ['2', '', 'medium', 'open'], ['3', '', 'low', 'open']] },
  { n: 338, key: 'ideas', words: ['ideas', 'idea', 'brainstorm'], title: 'Ideas', items: ['The wild one', 'The cheap one', 'The one that takes a weekend', 'The one nobody asked for', 'The one to try first'] },
  { n: 339, key: 'gratitude', words: ['gratitude', 'thankful', 'grateful'], title: 'Gratitude', style: 'numbers', items: ['Someone who helped me', 'Something small that went well', 'Something I can see right now', 'Something I get to do today'] },
  { n: 340, key: 'contacts', words: ['contacts', 'contact', 'address'], title: 'Contacts', header: true, rows: [['Name', 'Phone', 'Email', 'Notes'], ['', '', '', ''], ['', '', '', '']] },
];

const WORDS = TEMPLATES.flatMap((t) => t.words).join('|');
const KIND = '(?:list|agenda|tracker|log|book)';
const VERB = '(?:(?:make|build|create|give|show|start|open|add|get)\\s+(?:me\\s+)?)?';
const ART = '(?:(?:a|an|my|the|some)\\s+)?(?:(?:new|simple|basic|starter)\\s+)?';
// "<word> [list] template [for topic]"  and  "template for a <word> [list] [for topic]"
const FORWARD = new RegExp('^(?:please\\s+)?' + VERB + ART + '(' + WORDS + ')(?:\\s+' + KIND + ')?\\s+(?:template|starter)(?:\\s+(?:for|about|on)\\s+(.+))?$', 'i');
const BACKWARD = new RegExp('^(?:please\\s+)?' + VERB + ART + '(?:list\\s+)?(?:template|starter)\\s+(?:for|of)\\s+(?:(?:a|an|my|the)\\s+)?(' + WORDS + ')(?:\\s+' + KIND + ')?(?:\\s+(?:for|about|on)\\s+(.+))?$', 'i');

/** the template an ask names ("grocery list template", "packing list template for a beach trip", "template for a meeting agenda") and
 *  the topic after "for", or null. The word "template" (or "starter") must be there, so "make a grocery list" stays with the plain
 *  list. "meeting agenda template" is the agenda; "email template for a meeting agenda" is not a list at all. Pure. */
export function parseTemplate(text) {
  const t = String(text || '').trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
  const m = FORWARD.exec(t) || BACKWARD.exec(t);
  if (!m) return null;
  const w = m[1].toLowerCase();
  const tpl = TEMPLATES.find((x) => x.words.includes(w));
  return tpl ? { tpl, topic: (m[2] || '').trim().slice(0, 60) } : null;
}

/** the card to put on the stage for a template: { kind: 'list' | 'datatable', props }. Pure. */
export function cardFor(tpl, topic = '', mk = (t) => ({ id: 'item_' + Math.random().toString(36).slice(2, 9), text: t, done: false })) {
  const title = tpl.title + (topic ? ': ' + topic : '');
  if (tpl.rows) return { kind: 'datatable', props: { title, header: !!tpl.header, rows: tpl.rows.map((r) => r.slice()) } };
  return { kind: 'list', props: { title, ...(tpl.style ? { style: tpl.style } : {}), items: tpl.items.map(mk) } };
}
