/**
 * know skill - Verse's self-knowledge, readable (asked by Void, 2026-10-16: "Give me readable self-knowledge: the motto,
 * VoidQuest, the minis, the games"). "what is voidquest", "which games do you know", "which miniatures do you have",
 * "show me your canon" open one card read from /self.json (built from domains/void.canon.md, skills/index.json and
 * skills/mini/ by tools/self-context.mjs): the motto and VoidQuest as Adam wrote them, the games with a link to play each,
 * the 3D miniatures. A field the canon has not written yet is said to be unknown, never made up. No model, no web search.
 * "what is a motto", "play voidquest" and "which games are popular" are not this.
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const YOU = '(?:you|void|v01d|verse)';
const TOPICS = [
  ['motto', new RegExp('^(?:(?:tell|read)\\s+me\\s+(?:' + YOU + '(?:\'s)?|your)\\s+motto|' + YOU + '(?:\'s)?\\s+motto)$')],
  ['voidquest', /^(?:what(?:'s| is)\s+(?:the\s+)?void\s?quest|(?:tell|read)\s+me\s+about\s+void\s?quest|(?:what|how)\s+(?:does|do)\s+void\s?quest\s+(?:work|mean)|explain\s+void\s?quest|void\s?quest\s+(?:rules|story|text))$/],
  ['games', new RegExp('^(?:(?:which|what)\\s+(?:board\\s+|table\\s+)?games\\s+(?:do|can)\\s+' + YOU + '\\s+know|list\\s+(?:all\\s+)?(?:your|the)\\s+games|(?:your|the)\\s+games\\s+list)$')],
  ['minis', new RegExp('^(?:(?:which|what)\\s+(?:3d\\s+)?(?:miniatures|minis)\\s+(?:do|can)\\s+' + YOU + '\\s+(?:have|show|know|make)|list\\s+(?:all\\s+)?(?:your|the)\\s+(?:3d\\s+)?(?:miniatures|minis)|(?:your|the)\\s+(?:3d\\s+)?(?:miniatures|minis)\\s+list)$')],
  ['canon', new RegExp('^(?:read\\s+me\\s+(?:your|the)\\s+canon|(?:what(?:\'s| is)\\s+)?(?:your|the)\\s+canon|what\\s+do\\s+' + YOU + '\\s+know\\s+about\\s+(?:yourself|' + YOU + 'rself)|show\\s+(?:me\\s+)?(?:your|the)\\s+canon)$')],
];
/** which part of its own knowledge the ask wants ('motto', 'voidquest', 'games', 'minis', 'canon') or ''. Pure. */
export function knowOf(text) {
  const t = CLEAN(text);
  for (const [k, re] of TOPICS) if (re.test(t)) return k;
  return '';
}

const TITLES = { connect4: 'Four in a Row', tictactoe: 'Tic-tac-toe', othello: 'Reversi', mancala: 'Mancala', monopoly: "The Landlord's Game", battleship: 'Sea Battle', fireworks: 'Fireworks', aggravation: 'Aggravation' };
const titleOf = (n) => TITLES[n] || String(n).replace(/(^|-)([a-z])/g, (_, a, c) => (a ? ' ' : '') + c.toUpperCase());
const UNKNOWN = 'not written yet, so I do not know it';

/** the card's sections for a topic, from self.json: [{ h, p, links? }]. Pure. */
export function sectionsOf(self, topic) {
  const c = (self && self.canon) || {}, out = [];
  const want = (k) => topic === k || topic === 'canon';
  if (want('motto')) out.push({ h: 'My motto', p: c.motto || UNKNOWN });
  if (want('voidquest')) out.push({ h: 'VoidQuest', p: c.voidquest || UNKNOWN, links: [['play voidquest', 'play voidquest']] });
  if (want('games') || topic === 'canon') { const g = Array.isArray(self && self.games) ? self.games : []; out.push({ h: 'My games (' + g.length + ')', p: g.length ? 'Tap one to play it.' : 'I have no games listed yet.', links: g.map((n) => [titleOf(n), 'play ' + n]) }); }
  if (want('minis')) { const m = Array.isArray(self && self.minis) ? self.minis : []; out.push({ h: 'My 3D miniatures (' + m.length + ')', p: m.length ? m.map(titleOf).join(' · ') : 'I have no miniatures listed yet.' }); }
  return out;
}

async function run(text, api) {
  const topic = knowOf(text);
  if (!topic) return 'none';
  const { showPage, esc } = api;
  let self = null;
  try { const r = await fetch('/self.json', { cache: 'no-cache' }); if (r.ok) self = await r.json(); } catch (_) {}
  const rows = sectionsOf(self, topic), v = self && self.canon && self.canon.version;
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(topic === 'canon' ? 'What I know about myself' : rows[0] ? rows[0].h : 'Myself') + '</h2>'
      + (rows.length ? rows.map((s) => (topic === 'canon' ? '<h3>' + esc(s.h) + '</h3>' : '') + '<p>' + esc(s.p) + '</p>'
        + (s.links && s.links.length ? '<p>' + s.links.map(([label, ask]) => '<a href="#" data-ask="' + esc(ask) + '">' + esc(label) + '</a>').join(' · ') + '</p>' : '')).join('')
        : '<p>I could not read my own notes just now, so I will not guess.</p>')
      + '<div class="src">Source: my canon' + (v ? ', version ' + esc(String(v)) : '') + ' (domains/void.canon.md), my games and miniatures read from my code (/self.json)</div>';
  });
  return 'know';
}

export default {
  name: 'know',
  examples: ['what is voidquest', 'which games do you know', 'which miniatures do you have', 'show me your canon', 'tell me your motto'],
  nearMisses: ['what is a motto', 'play voidquest', 'which games are popular', 'what is the quest for the holy grail'],
  match(lower, text) { return !!knowOf(text || lower); },
  run,
  knowOf, sectionsOf,
};
