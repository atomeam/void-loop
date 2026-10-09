/**
 * take — Void's own input on top of an article page (Adam, 2026-10-09: "Void should have input on everything on top of
 * the wikipedia article"). Not a skill: void.html's article page imports it.
 *   relatedAsks(card)  what Void can do about this subject, at once, from the summary alone: [{ ask, label }]
 *   takeHtml(esc, take, asks)  the block shown above the summary ("Void's take"), or '' when there is nothing to add
 * The take itself comes from the answer engine (/api/answer, mode 'take'), which reads the summary and says what the
 * encyclopedia doesn't: a sharper point, a practical angle, a common mistake, what to look at next.
 */

// games Void plays, and the family each belongs to: an article about a cousin offers Void's own game
const GAMES = [
  { re: /^sorry!?(?: \(game\))?$/i, ask: 'play sorry', label: () => 'Play Sorry! with Void' },
  { re: /\b(?:ludo|parcheesi|pachisi|chaupar|trouble \(board game\)|frustration|mensch ärgere dich nicht|uckers|aggravation)\b/i, ask: 'play aggravation', label: (t) => /aggravation/i.test(t) ? 'Play Aggravation with Void' : 'Play Aggravation with Void (same family: race your marbles home, send others back)' },
  { re: /\bchess\b/i, ask: 'play chess', label: () => 'Play chess with Void' },
  { re: /\b(?:checkers|draughts)\b/i, ask: 'play checkers', label: () => 'Play checkers with Void' },
  { re: /\bgo \(game\)|\bweiqi\b|\bbaduk\b/i, ask: 'play go', label: () => 'Play Go with Void' },
  { re: /\b(?:othello|reversi)\b/i, ask: 'play othello', label: () => 'Play Othello with Void' },
  { re: /\bconnect four\b|\bconnect 4\b/i, ask: 'connect 4', label: () => 'Play Connect Four with Void' },
  { re: /\btic[- ]tac[- ]toe\b|\bnoughts and crosses\b/i, ask: 'tic tac toe', label: () => 'Play tic-tac-toe with Void' },
  { re: /\bmonopoly\b/i, ask: 'play monopoly', label: () => 'Play Monopoly with Void' },
  { re: /\bbattleship\b/i, ask: 'play battleship', label: () => 'Play Battleship with Void' },
  { re: /\b(?:poker|texas hold ?'?em)\b/i, ask: 'play poker', label: () => "Play heads-up Hold'em with Void" },
  { re: /\b(?:mancala|kalah|oware|bao)\b/i, ask: 'play mancala', label: () => 'Play mancala with Void' },
  { re: /\bhanabi\b/i, ask: 'play fireworks', label: () => 'Play Fireworks (Hanabi) with Void' },
];

/** What Void can do about the subject, from the title and the one-line description (the summary's first words help). */
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

/** The block above the summary: Void's take (a few sentences, plain text) and what Void can do about it. */
export function takeHtml(esc, take, asks) {
  const t = String(take || '').trim(), a = Array.isArray(asks) ? asks : [];
  if (!t && !a.length) return '';
  return '<div class="take" style="border-left:2px solid var(--accent, #8ea2ff);padding:2px 0 2px 10px;margin:4px 0 12px">'
    + '<div style="font-size:12px;color:var(--muted, #8a8a92);margin-bottom:2px">Void’s take</div>'
    + (t ? '<p style="margin:0 0 4px">' + esc(t) + '</p>' : '')
    + (a.length ? '<div>' + a.map((x) => '<a href="#" data-ask="' + esc(x.ask) + '" style="display:inline-block;margin:2px 10px 2px 0">' + esc(x.label) + ' →</a>').join('') + '</div>' : '')
    + '</div>';
}
