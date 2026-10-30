// Web4 (owner, 2026-10-16: "South Park did it, Ready Player One. Let's make the real Web 1, 2 and 3 version of it and let's call
// it: now Verse is Web4"). The four steps of the web as Verse tells them: one source for the skill (skills/web4.js), the tests
// (tools/web4.test.mjs) and the frontier (#37). Pure data, plain words, true statements only: every `where` is an ask that works
// on main today, and what is not built yet says so. "Web4" is the owner's name for Verse's layer, not an industry standard, and
// nothing here is about blockchain, tokens, coins or any crypto: money mechanics are the owner's call (STANDING.md).

/** the four steps, in order: { n, name, did, line, where, label }. `line` is two or three sentences, `where` is an ask that runs today. */
export const LAYERS = [
  { n: 1, name: 'Read', did: 'pages you read',
    line: 'Web 1 was pages you read: someone wrote them, you read them. In Verse that is the Book of Verse, one page for everything Verse can do, and answers that name where they came from.',
    where: 'open the book', label: 'open the book' },
  { n: 2, name: 'Write and share', did: 'places you post, and others see',
    line: 'Web 2 was where you write and share: you post, other people see it. In Verse that is the stage you fill with whatever you ask for, and a link to any card, so a friend can open what you made.',
    where: 'share this card', label: 'share this card' },
  { n: 3, name: 'Own', did: 'what you make is yours and travels with you',
    line: 'Web 3 was the idea that what you make is yours and can move with you. In Verse, in plain terms, your stage and the cards you keep live on your own Verse, and nothing is public unless you choose to publish it. Saving cards out as plain files you can copy and print is not built yet.',
    where: 'keep this', label: 'keep this card' },
  { n: 4, name: 'Ask, and it appears', did: 'you say what you want, it appears, and it keeps growing',
    line: 'Web 4 is you saying what you want and it appearing, then growing with you. Verse is the keeper: it knows every skill, game and card here, and what it makes keeps getting better. Your own lands, and doors between lands, are the next thing being built.',
    where: "what's new", label: 'see what it made lately' },
];

/** the one honest sentence, said on the card and kept in the tests */
export const HONEST = 'Web4 is our name for it; nobody has defined it.';
/** whose name it is, said plainly where it matters */
export const WHOSE = 'The name is the owner’s, for what Verse is building. It is not an industry standard.';

/** asks that run inside the page rather than as a skill (page.js CORE_HINTS), so the router test cannot find a skill for them */
export const PAGE_ASKS = ['keep this'];

/** every sentence the card prints, as one string; the tests read it for forbidden words. Pure. */
export function allText() {
  return [HONEST, WHOSE, ...LAYERS.flatMap((l) => [l.name, l.did, l.line, l.where, l.label])].join('\n');
}
