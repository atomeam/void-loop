/**
 * take — Verse's own input on top of an article page (Adam, 2026-10-09: "Verse should have input on everything on top of
 * the wikipedia article"). Not a skill: void.html's article page imports it.
 *   relatedAsks(card)  what Verse can do about this subject, at once, from the summary alone: [{ ask, label }]
 *   takeHtml(esc, take, asks)  the block shown above the summary ("Verse's take"), or '' when there is nothing to add
 * The take itself comes from the answer engine (/api/answer, mode 'take'), which reads the summary and says what the
 * encyclopedia doesn't: a sharper point, a practical angle, a common mistake, what to look at next.
 */

// games Verse plays, and the family each belongs to: an article about a cousin offers Verse's own game
const GAMES = [
  { re: /^sorry!?(?: \(game\))?$/i, ask: 'play sorry', label: () => 'Play Back to Start with Verse (plays like Sorry!)' },
  { re: /\b(?:ludo|parcheesi|pachisi|chaupar|trouble \(board game\)|frustration|mensch ärgere dich nicht|uckers|aggravation)\b/i, ask: 'play aggravation', label: (t) => /aggravation/i.test(t) ? 'Play Star Marbles with Verse (plays like Aggravation)' : 'Play Star Marbles with Verse (same family: race your marbles home, send others back)' },
  { re: /\bchess\b/i, ask: 'play chess', label: () => 'Play chess with Verse' },
  { re: /\b(?:checkers|draughts)\b/i, ask: 'play checkers', label: () => 'Play checkers with Verse' },
  { re: /\bgo \(game\)|\bweiqi\b|\bbaduk\b/i, ask: 'play go', label: () => 'Play Go with Verse' },
  { re: /\b(?:othello|reversi)\b/i, ask: 'play othello', label: () => 'Play Reversi with Verse' },
  { re: /\bconnect four\b|\bconnect 4\b/i, ask: 'connect 4', label: () => 'Play Four in a Row with Verse (plays like Connect Four)' },
  { re: /\btic[- ]tac[- ]toe\b|\bnoughts and crosses\b/i, ask: 'tic tac toe', label: () => 'Play tic-tac-toe with Verse' },
  { re: /\bmonopoly\b/i, ask: 'play monopoly', label: () => 'Play The Landlord’s Game with Verse (plays like Monopoly)' },
  { re: /\bbattleship\b/i, ask: 'play battleship', label: () => 'Play Sea Battle with Verse (plays like Battleship)' },
  { re: /\b(?:poker|texas hold ?'?em)\b/i, ask: 'play poker', label: () => "Play heads-up Hold'em with Verse" },
  { re: /\b(?:mancala|kalah|oware|bao)\b/i, ask: 'play mancala', label: () => 'Play mancala with Verse' },
  { re: /\bhanabi\b/i, ask: 'play fireworks', label: () => 'Play Fireworks (Hanabi) with Verse' },
];

/** What Verse can do about the subject, from the title and the one-line description (the summary's first words help). */
export function relatedAsks(card) {
  const title = String((card && card.title) || '').trim(), desc = String((card && card.description) || '').trim();
  const lead = String((card && card.extract) || '').slice(0, 160), out = [];
  if (!title) return out;
  const add = (ask, label) => { if (!out.some((x) => x.ask === ask)) out.push({ ask, label }); };
  for (const g of GAMES) if (g.re.test(title) || (g.re.test(lead) && /\bgame\b/i.test(desc + ' ' + lead))) add(g.ask, g.label(title));
  // a place: its weather, a map, the time there
  if (/\b(?:city|town|capital|village|municipality|country|island|state of|province|metropolis|borough)\b/i.test(desc) && !/\bfictional\b/i.test(desc)) {
    const place = title.replace(/\s*\(.*\)$/, '');
    add('weather in ' + place, 'Weather in ' + place + ' now');
    add('map of ' + place, 'Map of ' + place);
    add('time in ' + place, 'Time in ' + place);
  }
  // a dish or a food: a recipe
  if (/\b(?:dish|food|cuisine|dessert|soup|bread|sauce|pastry|cake|stew|salad|beverage|cocktail)\b/i.test(desc)) add('recipe for ' + title.replace(/\s*\(.*\)$/, '').toLowerCase(), 'A recipe for ' + title.replace(/\s*\(.*\)$/, ''));
  return out.slice(0, 4);
}

/** a take worth showing, or '': never the model's own working ("analysis The user wants a summary…", the Tile card, 2026-10-19), never a reply that
 *  loops on itself, never the model's "NONE" (it had nothing solid to add). Pure; the answer engine runs it before caching and the page again on a cached one. */
export function cleanTake(take) {
  const t = String(take || '').replace(/\s+/g, ' ').trim();
  if (!t || /^none\.?$/i.test(t)) return '';
  if (/^(?:analysis|thinking|reasoning)\b|\bthe user (?:wants|asks|is asking|asked|would like)\b|\bwe (?:need|should) to (?:answer|respond|summari[sz]e)\b/i.test(t)) return '';
  const w = t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean), seen = new Map();
  for (let i = 0; i + 5 <= w.length; i++) { const k = w.slice(i, i + 5).join(' '); const n = (seen.get(k) || 0) + 1; if (n >= 3) return ''; seen.set(k, n); }
  return t;
}

// the grounding gate (owner, 2026-11-06, the Treasury card: its take was generic filler about "liquidity and risk mitigation" that no fact on the
// card held): a take is shown only when it stands on something real the card or Verse holds, and the page passes that ground in
const STOP = new Set('a an and are as at be been but by can for from has have he her his in into is it its may more most not of on one or other our over she so such than that the their them then these they this those to under was were what when where which while who will with within would also used use'.split(' '));
/** the plain words of a text, lower case, accents off. Pure. */
export const words = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/g) || [];
/** one word without a simple plural ending: treasuries -> treasury, boxes -> box, pages -> page, glass stays glass. Pure. */
export const singular = (w) => { const s = String(w || '').toLowerCase(); if (s.length > 4 && /ies$/.test(s)) return s.slice(0, -3) + 'y'; if (s.length > 4 && /(?:s|x|z|ch|sh)es$/.test(s)) return s.slice(0, -2); if (s.length > 3 && /[^s]s$/.test(s)) return s.slice(0, -1); return s; };
const content = (s, skip) => new Set(words(s).filter((w) => w.length >= 4 && !STOP.has(w)).map(singular).filter((w) => !skip.has(w)));
/** how many content words (four letters or more, not a stop word, not the subject's own name) a take shares with a ground text. Pure. */
export function sharedWords(take, ground, title = '') {
  const skip = new Set(words(title).map(singular)), g = content(ground, skip); let n = 0;
  for (const w of content(take, skip)) if (g.has(w)) n++;
  return n;
}
/** the take when it is grounded in the text it is checked against (two content words or more in common), else ''. Pure. */
export const groundedTake = (take, ground, title = '') => { const t = cleanTake(take); return t && sharedWords(t, ground, title) >= 2 ? t : ''; };

/** The block under the summary: Verse's take (a few sentences, plain text, labelled as a model's reading) and what Verse can do about it.
 *  opts.ground: the card's own source text (and Verse's own page, when the term has one); given, a take that stands on none of it is left out. */
export function takeHtml(esc, take, asks, opts = {}) {
  const t = opts && typeof opts.ground === 'string' ? groundedTake(take, opts.ground, opts.title) : cleanTake(take), a = Array.isArray(asks) ? asks : [];
  if (!t && !a.length) return '';
  return '<div class="take" style="border-left:2px solid var(--accent, #8ea2ff);padding:2px 0 2px 10px;margin:10px 0 12px">'
    + '<div class="take-label" style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#c7d2ff;margin-bottom:3px">Verse’s take <span style="font-weight:400;letter-spacing:0;text-transform:none;color:#8a8fa8">· a model’s reading, not from the source</span></div>'
    + (t ? '<p style="margin:0 0 4px">' + esc(t) + '</p>' : '')
    + (a.length ? '<div>' + a.map((x) => '<a href="#" data-ask="' + esc(x.ask) + '" style="display:inline-block;margin:2px 10px 2px 0">' + esc(x.label) + ' →</a>').join('') + '</div>' : '')
    + '</div>';
}
