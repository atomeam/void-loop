/**
 * fanfic skill: "fan fiction", "fanfic archive", "fan fiction site", "post a fanfic" (owner, 2026-10-29: "all the pages are supposed to be
 * able to work together"): the /fanfic/ archive as a card on the stage, the card its page's stage link asks for. It lists the fandoms people
 * have started, most recently active first (an 18+ fandom is named with its mark and nothing of it is shown), says there are none yet when
 * there are none (no seeded stories, ever), and links to /fanfic/, its post form and the writing room. Read only: the card posts nothing.
 * Made with tools/new-skill.mjs (docs/UPGRADING.md).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { isFicBoard } from '../lib/fanfic.js';

const WHEN = /^(?:(?:the |a |open (?:the )?|show (?:me )?(?:the )?)?(?:fan ?fics?|fan ?fiction)(?: archive| stories| site)?|(?:post|publish|share) (?:a |my )?(?:fan ?fic|fan ?fiction))$/i;

/** the card's fandom lines from the boards API's list: only fan-fiction boards, at most 8, most active first. Pure. */
export function fandomLines(boards) {
  return (Array.isArray(boards) ? boards : []).filter(isFicBoard).sort((a, b) => (b.last || 0) - (a.last || 0)).slice(0, 8)
    .map((b) => ({ href: '/fanfic/?f=' + encodeURIComponent(b.code), text: b.title + (b.nsfw ? ' (18+)' : '') }));
}

function run(text, api) {
  const { showPage, esc } = api, post = /^(?:post|publish|share)\b/i.test(String(text || '').trim());
  showPage((el) => {
    el.dataset.page = '/fanfic/';
    el.innerHTML = '<h2>Fan fiction</h2><p>A story archive anyone can post to: fandoms, chapters, reviews, ratings and word counts, and a private writing room for drafts. No account.</p>' // void-review: ok: fixed text
      + '<ul class="fl" style="padding-left:18px;margin:6px 0"><li>Looking for fandoms…</li></ul>'
      + '<p><a href="/fanfic/?new=story" style="font-weight:600">' + esc(post ? 'Post your story →' : 'Post a story →') + '</a> · <a href="/fanfic/?v=room">Writing room →</a> · <a href="/fanfic/">Open the archive →</a></p>'
      + '<div class="src">From Verse’s own fan-fiction archive; every story is posted by a reader</div>';
    const ul = el.querySelector('.fl');
    fetch('/api/boards').then((r) => r.json()).then((j) => {
      const lines = fandomLines(j && j.boards); ul.replaceChildren();
      if (!lines.length) { const li = document.createElement('li'); li.textContent = 'No stories yet: the first one is yours to post.'; ul.append(li); return; }
      for (const l of lines) { const li = document.createElement('li'), a = document.createElement('a'); a.href = l.href; a.textContent = l.text; li.append(a); ul.append(li); }
    }).catch(() => { ul.replaceChildren(); const li = document.createElement('li'); li.textContent = 'The archive did not answer just now.'; ul.append(li); });
  });
  return 'fanfic';
}

export default {
  name: 'fanfic',
  examples: ['fan fiction', 'fanfic', 'fan fiction archive', 'fanfic archive', 'post a fanfic'],
  nearMisses: ['write a story about a dragon', 'image boards'],
  match(lower) { return WHEN.test(lower.trim()); },
  run
};
