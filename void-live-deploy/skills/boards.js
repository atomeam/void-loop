/**
 * boards skill: "image boards", "text boards", "the chans", "make a board" (owner, 2026-10-25: "Let's go after the chans next"): the boards page
 * as a card on the stage. It lists the boards people have made, most recently active first (an 18+ board is named with its mark and nothing of
 * it is shown), says there are none yet when there are none, and links to /boards/ (and to its make-a-board form). Read only: the card posts
 * nothing. Made with tools/new-skill.mjs (docs/UPGRADING.md).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const WHEN = /^(?:(?:the |open (?:the )?|show (?:me )?(?:the )?)?(?:image ?boards?|text ?boards?|imageboards?|chans?|chan boards?|anonymous boards?)|(?:make|create|start) (?:a |an |my own )?(?:image |text |anonymous )?board)$/i;
/** the boards card's lines from the API's list: at most 8, most active first. Pure. */
export function boardLines(boards) {
  return (Array.isArray(boards) ? boards : []).slice().sort((a, b) => (b.last || 0) - (a.last || 0)).slice(0, 8)
    .map((b) => ({ href: '/boards/?b=' + b.code, text: '/' + b.code + '/ · ' + b.title + (b.nsfw ? ' (18+)' : '') + (b.textOnly ? ' · text' : '') }));
}

function run(text, api) {
  const { showPage, esc } = api, make = /^(?:make|create|start)\b/i.test(String(text || '').trim());
  showPage((el) => {
    el.dataset.page = '/boards/';
    el.innerHTML = '<h2>Boards</h2><p>Anonymous image and text boards anyone can start: a catalog, threads with pictures, &gt;&gt;quotes and greentext, an archive, tripcodes, sage, spoilers and a thread watcher.</p>' // void-review: ok: fixed text
      + '<ul class="bl" style="padding-left:18px;margin:6px 0"><li>Looking for boards…</li></ul>'
      + '<p><a href="/boards/?new=1" style="font-weight:600">' + esc(make ? 'Make your board →' : 'Make a board →') + '</a> · <a href="/boards/">Open the boards →</a></p>'
      + '<div class="src">From Verse’s own boards; posts are anonymous, rules at /boards/rules/</div>';
    const ul = el.querySelector('.bl');
    fetch('/api/boards').then((r) => r.json()).then((j) => {
      const lines = boardLines(j && j.boards); ul.replaceChildren();
      if (!lines.length) { const li = document.createElement('li'); li.textContent = 'No boards yet: the first one is yours to make.'; ul.append(li); return; }
      for (const l of lines) { const li = document.createElement('li'), a = document.createElement('a'); a.href = l.href; a.textContent = l.text; li.append(a); ul.append(li); }
    }).catch(() => { ul.replaceChildren(); const li = document.createElement('li'); li.textContent = 'The boards did not answer just now.'; ul.append(li); });
  });
  return 'boards';
}

export default {
  name: 'boards',
  examples: ['image boards', 'text boards', 'open the image boards', 'chan boards', 'make a board', 'the chans'],
  nearMisses: ['show the board', 'chess board'],
  match(lower) { return WHEN.test(lower.trim()); },
  run,
};
