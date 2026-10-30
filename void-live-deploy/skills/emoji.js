/**
 * emoji skill — pick a random emoji or a few
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random emoji", "give me an emoji", "three random emojis". Also one emoji by its name on the /emojis/ wall ("emoji fire", the wall's
 * "See it on the stage" link) and the wall's counts ("emoji counts": the most copied, read from /api/tally, the same GET the wall makes).
 */
import { EMOJI } from '../lib/emoji.js';
const EMOJIS = ['😀','😂','😍','🤔','😎','🚀','🌈','🎉','🔥','💡','🐱','🐶','🍕','☕','⚽','🎵','🌟','❤️','👍','🙌','🦄','🌸','🍀','🍎','🎈'];

export function isEmoji(text) {
  return /^(?:please\s+)?(?:(?:give\s+me\s+)?(?:a\s+|an\s+|another\s+|some\s+|a\s+few\s+)?(?:random\s+)?emoji(?:s)?|(?:random|another)\s+emoji(?:s)?|emoji(?:s)?(?:\s+please)?|\d+\s+(?:random\s+)?emoji(?:s)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

const clean = (text) => String(text || '').trim().replace(/[?!.]+$/, '');
/** the wall's emoji named in "emoji <name>" or "<name> emoji" (its exact name in lib/emoji.js), or null. Pure. */
export function namedEmoji(text) {
  const m = /^(?:the\s+)?emoji\s+([a-z][a-z' -]{1,40})$/i.exec(clean(text)) || /^(?:the\s+)?([a-z][a-z' -]{1,40}?)\s+emoji$/i.exec(clean(text));
  return m ? EMOJI.find((e) => e.n === m[1].trim().toLowerCase()) || null : null;
}
export const isCounts = (text) => /^(?:the\s+)?(?:emoji\s+(?:counts?|tracker|leaderboard)|most\s+copied\s+emojis?|top\s+emojis?)$/i.test(clean(text));
const cp = (c) => [...c].map((x) => 'U+' + x.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');

function run(text, api) {
  const { showPage, esc } = api;
  const named = namedEmoji(text);
  if (named) {
    showPage((p) => {
      p.innerHTML = '<h2>' + esc(named.n) + '</h2><p style="font-size:64px;text-align:center;margin:8px 0">' + esc(named.c) + '</p><div class="sub">' + esc(cp(named.c)) + ' · copy it from the wall to count it</div>'; // void-review: ok (every value escaped)
    });
    return 'emoji';
  }
  if (isCounts(text)) {
    const el = showPage((p) => { p.innerHTML = '<h2>Most copied emoji</h2><div data-em-out class="sub">Reading the counts…</div>'; }); // void-review: ok (constant text)
    const out = el && el.querySelector ? el.querySelector('[data-em-out]') : null;
    fetch('/api/tally?of=emoji', { headers: { accept: 'application/json' } }).then((r) => r.json()).then((b) => {
      if (!out || (api._pageStill && !api._pageStill(el))) return;
      if (!b || !b.ok || !b.counts) throw new Error('no counts');
      const top = EMOJI.map((e) => ({ e, n: (b.counts.all || {})[e.c] || 0 })).filter((r) => r.n > 0).sort((a, z) => z.n - a.n).slice(0, 10);
      out.innerHTML = top.length ? '<ol style="font-size:18px">' + top.map((r) => '<li>' + esc(r.e.c) + ' ' + esc(r.e.n) + ': ' + esc(String(r.n)) + '</li>').join('') + '</ol><div class="sub">All time, counted only as they are copied on the wall</div>' // void-review: ok (every value escaped)
        : 'Nothing has been copied from the wall yet.';
    }).catch(() => { if (out) out.textContent = 'The counts could not be read just now.'; });
    return 'emoji';
  }
  const m = /(\d+)/.exec(String(text || ''));
  const n = m ? Math.min(10, Math.max(1, +m[1])) : 1;
  const picks = Array.from({ length: n }, () => EMOJIS[Math.floor(Math.random() * EMOJIS.length)]);
  showPage((p) => {
    p.innerHTML = '<h2>Random emoji</h2><p style="font-size:48px;text-align:center;letter-spacing:8px">' + esc(picks.join(' ')) + '</p><div class="sub">say “another emoji” or “3 emojis” for more</div>';
  });
  return 'emoji';
}

export default {
  name: 'emoji',
  examples: ['random emoji', 'give me an emoji', 'another emoji', '3 emojis', 'emoji fire', 'rocket emoji', 'emoji counts'],
  nearMisses: ['what is an emoji', 'emoji keyboard', 'send emoji', 'emoji for fire'],
  match(lower, text) { return isEmoji(text) || !!namedEmoji(text) || isCounts(text); },
  run,
  suite() {
    const ok = isEmoji('random emoji') && isEmoji('3 emojis') && !isEmoji('what is an emoji') && namedEmoji('emoji fire').c === '🔥'
      && !namedEmoji('emoji keyboard') && isCounts('emoji counts');
    return { ok, got: 'match works' };
  }
};
