/**
 * games-hub skill - one launcher card for the broad game asks ("games", "game", "board games", "arcade", "play", "rpg",
 * "adventure", "play something", "what games", "all games"). It does not keep a game list of its own: the members come from
 * the generated games family (skills/families.json) and each entry's title, line and launch ask come from the generated book
 * (skills/guide.json), so a new game appears here when it is added to the family. One click asks that game into the stage.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const ASKS = new Set(['games', 'game', 'board games', 'board game', 'arcade', 'play', 'rpg', 'adventure', 'play something', 'what games', 'all games']);
const PREFIX = /^(?:(?:open|show(?: me)?|list|give me|i want|let's|lets)\s+)+/i;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** true for a broad games ask, false for a named game or anything else. Pure. */
export function hubOf(text) {
  const t = String(text || '').toLowerCase().trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').replace(PREFIX, '');
  return ASKS.has(t);
}

/** the games family's members from families.json, with title, line and launch ask from the book. Pure given the two files. */
export function gamesOf(fam, book) {
  const family = (fam && fam.families || []).find((f) => f && f.id === 'games');
  const names = (family && family.skills || []).map((s) => s && s.name).filter(Boolean);
  const pages = (book && book.pages) || [];
  return names.map((name) => {
    const p = pages.find((x) => x && x.name === name && (x.kind === 'game' || x.chapter === 'games'));
    const examples = (p && Array.isArray(p.examples) ? p.examples : []).filter((e) => typeof e === 'string');
    const say = examples.find((e) => /\b(play|start|open|make)\b/i.test(e)) || examples[0] || String(p && p.title || name).toLowerCase();
    return { name, title: (p && p.title) || name, line: (p && p.line) || '', say };
  });
}

const loadJSON = (path, get) => Promise.resolve((get || fetch)(path)).then((r) => r && r.ok ? r.json() : null).catch(() => null);
const games = (get) => Promise.all([loadJSON('/skills/families.json', get), loadJSON('/skills/guide.json', get)]).then(([fam, book]) => gamesOf(fam, book));

const CSS = '.ghub{font:inherit;color:#ece8dc}.ghub h2{margin:0 0 4px;font-size:18px}.ghub p.lead{margin:0 0 10px;font-size:13px;line-height:1.5;color:#c4bfb0}'
  + '.ghub .gh-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px;max-height:420px;overflow:auto}'
  + '.ghub .gh-game{display:block;text-align:left;width:100%;padding:8px 10px;border:1px solid rgba(255,255,255,.16);border-radius:10px;background:rgba(255,255,255,.04);color:#ece8dc;cursor:pointer}'
  + '.ghub .gh-game:hover,.ghub .gh-game:focus-visible{border-color:#ffd27a;outline:none;background:rgba(255,255,255,.08)}'
  + '.ghub .gh-game b{display:block;font-size:14px}.ghub .gh-game small{display:block;font-size:12px;color:#c4bfb0;line-height:1.35;margin-top:2px;overflow-wrap:anywhere}'
  + '.ghub .gh-empty{font-size:13px;color:#c4bfb0}';

function mount(el, api, list) {
  if (!document.getElementById('ghub-style')) { const s = document.createElement('style'); s.id = 'ghub-style'; s.textContent = CSS; document.head.appendChild(s); }
  el.classList.add('ghub'); el.dataset.cardPlain = '';
  el.innerHTML = '<h2>Games</h2><p class="lead">Every playable game on one card. Choose one to open it.</p>'
    + '<div class="gh-list">' + (list.length ? list.map((g, i) => '<button type="button" class="gh-game" data-i="' + i + '" data-ask="' + esc(g.say) + '"><b>' + esc(g.title) + '</b><small>' + esc(g.line) + '</small></button>').join('') : '<span class="gh-empty">The games list could not be read just now; ask again.</span>') + '</div>';
  el.querySelectorAll('button[data-ask]').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    const g = list[Number(b.dataset.i)];
    if (g && api.stage && api.stage.ask) api.stage.ask(g.say);
  }));
}

async function run(text, api) {
  if (!hubOf(text)) return 'none';
  const list = await games(api.fetch);
  api.showPage((el) => mount(el, api, list));
  return 'games-hub';
}

export default {
  name: 'games-hub',
  examples: ['game', 'board game', 'arcade', 'play', 'rpg', 'adventure', 'what games'],
  nearMisses: ['games on tv tonight', 'olympic games', 'box office', 'connect 4', 'debris field', 'the chrono signal', 'play chess'],
  hubOf,
  gamesOf,
  match(lower, text) { return hubOf(text || lower); },
  run,
};
