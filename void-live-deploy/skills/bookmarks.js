/**
 * bookmarks skill — favorites and bookmarked asks (tools pack 5, owner 2026-10-18; numbers 95 and 100).
 * "favorite this" stars the picked card (a gold star on its corner, kept with the stage); "unfavorite this" takes it off.
 * "bookmark this ask" keeps the last thing you asked, "bookmark: make a clock" keeps those words; "my bookmarks" / "my favorites" is one card
 * with the starred cards (go) and the bookmarked asks (run, asked again as if typed). "remove bookmark 2" drops one.
 * Bookmarks are kept in this browser only (30 at most); nothing leaves it. Asks that look like a key are not kept.
 */
import { bookmarkIntent, addBookmark, thingLabel, BOOKMARKS_MAX } from '../lib/stage-find.js';
import { readJson, writeJson, BOOKMARKS_KEY } from '../lib/stage-watch.js';
import { listPage, goTo } from '../lib/pack5-ui.js';
import { clipboardAsks } from './ask-clipboard.js';
import { recentAsks } from './recent.js';

const STAR_CLASS = 'fav-star';

/** paint a star on every starred card (a redraw rebuilds the cards, so this runs on each one). */
function decorate(stageApi) {
  const things = stageApi.things();
  for (const el of stageApi.stage.querySelectorAll(':scope > [data-id]')) {
    const th = things[el.dataset.id], has = el.querySelector(':scope > .' + STAR_CLASS);
    if (th && th.fav) {
      if (!has) { const s = document.createElement('span'); s.className = STAR_CLASS; s.textContent = '★'; s.setAttribute('aria-label', 'favorite'); s.style.cssText = 'position:absolute;top:-8px;right:-6px;color:#ffd166;font-size:18px;line-height:1;pointer-events:none;text-shadow:0 0 4px rgba(0,0,0,.6)'; el.appendChild(s); }
    } else if (has) has.remove();
  }
}

/** the last real ask: the newest that is not itself a bookmark command. */
const lastAsk = () => clipboardAsks(recentAsks(undefined, 12)).filter((a) => !bookmarkIntent(a))[0] || '';

function showAll(api) {
  const favs = Object.values(api.stage.things()).filter((t) => t && t.fav);
  const marks = readJson(BOOKMARKS_KEY, []);
  const rows = favs.map((t) => ({ kind: 'thing', id: t.id, text: thingLabel(t), sub: t.kind + ' · favorite', action: 'go' }))
    .concat(marks.map((a, i) => ({ kind: 'ask', ask: a, text: a, sub: 'bookmark ' + (i + 1), action: 'run' })));
  listPage(api, 'Favorites and bookmarks', rows, { empty: 'Nothing yet. Say "favorite this" on a card, or "bookmark this ask".', foot: 'Kept only in this browser',
    onPick: (r) => { if (r.kind === 'thing') goTo(api.stage, r.id); else { try { api.stage.closePage && api.stage.closePage(); } catch (_) { /* none open */ } api.stage.ask(r.ask); } } });
}

async function run(text, api) {
  const it = bookmarkIntent(text);
  if (!it) return 'none';
  const st = api.stage;
  if (it.op === 'favorite' || it.op === 'unfavorite') {
    const th = st.selected() && st.things()[st.selected()];
    if (!th) { api.say('pick a card first'); return 'bookmarks'; }
    if (it.op === 'favorite') th.fav = true; else delete th.fav;
    st.save(); st.render();
    api.say(it.op === 'favorite' ? 'starred: ' + thingLabel(th) : 'star taken off');
    return 'bookmarks';
  }
  if (it.op === 'add-ask') {
    const ask = it.ask || lastAsk();
    if (!ask) { api.say('no ask to bookmark yet'); return 'bookmarks'; }
    const before = readJson(BOOKMARKS_KEY, []), next = addBookmark(before, ask);
    writeJson(BOOKMARKS_KEY, next);
    api.say(next.length === before.length && next[0] !== ask ? 'not kept' : 'bookmarked: ' + ask.slice(0, 40));
    return 'bookmarks';
  }
  if (it.op === 'show') { showAll(api); return 'bookmarks'; }
  const marks = readJson(BOOKMARKS_KEY, []), target = marks[it.n - 1];
  if (!target) { api.say(marks.length ? 'only ' + marks.length + ' bookmark' + (marks.length === 1 ? '' : 's') : 'no bookmarks yet'); return 'bookmarks'; }
  if (it.op === 'run') { st.ask(target); return 'bookmarks'; }
  marks.splice(it.n - 1, 1); writeJson(BOOKMARKS_KEY, marks);
  api.say('bookmark removed');
  return 'bookmarks';
}

export default {
  name: 'bookmarks',
  examples: ['favorite this', 'unfavorite this', 'bookmark this ask', 'bookmark: make a clock', 'my bookmarks', 'my favorites', 'run my second bookmark', 'remove bookmark 2'],
  nearMisses: ['bookmark this page in chrome', 'what is a bookmark', 'my favorite color is blue', 'add milk to my list', 'favorite songs of the 80s'],
  MAX: BOOKMARKS_MAX,
  bookmarkIntent,
  match(lower, text) { return !!bookmarkIntent(text || lower); },
  run,
  decorate,
};
