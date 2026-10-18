// V01D's own components by name (owner, 2026-10-18: "Show me the Site Test card" fetched a Visa test card). One table: each part of
// V01D, the words people use for it, the skill that shows it, and the ask that skill already answers. skills/own-parts.js is
// ranked first and takes any ask that names a part inside the "show me / open / where is / the ... card" frame, so V01D's own
// anatomy beats generic web trivia and any generic skill. A new part is one row here, plus its asks in tools/own-parts.test.mjs.
// "names" are the part's words (regex source, matched whole, lowercase); "skill" answers; "ask" is what that skill takes.
// "owned": "my site test" alone counts (a possessive and the name); only for names no other sense uses.
// The self card ("what I think of myself") is a page handler (void.html wantsVoice), not a skill, and already takes its own frame.
export const PARTS = [
  { id: 'site-test', skill: 'growth', owned: true, ask: 'site test', names: ['site[ -]?test(?:er)?(?: (?:log|results?|runs?))?', 'stability (?:trend|sparklines?|chart|graph)', 'heat ?map', 'weathered heat ?map'] },
  { id: 'growth', skill: 'growth', ask: 'growth', names: ['growth(?: (?:ledger|log|history|inbox))?', '(?:void|v01d|verse)(?:\'s)? growth', 'owner (?:view|inbox)'] },
  { id: 'status', skill: 'status', ask: 'void status', names: ['(?:void |v01d |system )?status', 'health check', 'sources? status'] },
  { id: 'book', skill: 'guide', ask: 'open the book', names: ['book', 'tome', 'guide', 'leather tome', 'illuminated tome'] },
  { id: 'rule-registry', skill: 'guide', ask: 'rule registry', names: ['rules? registry', 'router rules?'] },
  { id: 'merges', skill: 'merges', ask: 'merge log', names: ['merge(?:s| log)', 'merged (?:prs|pull requests)'] },
];
const LEAD = '(?:(?:can|could) you )?(?:please )?(?:(?:show|open|pull up|bring up|display|summon|give|take|go to|see|find|get|load|read|flip to|turn to|jump to)(?: me)?(?: to)?|let me see|i want to see|i would like to see|where(?: is|\'s| can i find| do i find)|take me to)';
const OWNER = '(?:the |my |your |our |this |that |void\'s |v01d\'s |void |v01d )*';
const CARD = '(?:card|page|view|chapter|section|screen|panel|tab|window)';
const clean = (s) => String(s || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const rows = PARTS.map((p) => {
  const n = '(?:' + p.names.join('|') + ')';
  return { p,
    framed: new RegExp('^' + LEAD + ' ' + OWNER + n + '(?: ' + CARD + ')?$'),  // "show me the site test", "open the book"
    carded: new RegExp('^' + OWNER + n + ' ' + CARD + '$'),
    owned: p.owned ? new RegExp('^(?:my|your|void\'s|v01d\'s) ' + n + '$') : null };                   // "the site test card", "status page"
});
/** the part an ask names inside the frame, or null. Pure. */
export function partOf(text) {
  const t = clean(text);
  if (!t || t.length > 90) return null;
  for (const r of rows) if (r.framed.test(t) || r.carded.test(t) || (r.owned && r.owned.test(t))) return r.p;
  return null;
}
