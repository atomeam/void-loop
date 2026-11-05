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
// a short name or a phrase people actually say, to the wall's exact name. "emoji keyboard" is not here, so it stays a miss.
const ALIAS = {
  heart: 'red heart', feu: 'fire', fuego: 'fire',
  'thank you': 'folded hands', thanks: 'folded hands', 'thank-you': 'folded hands',
};
/** the words after "emoji" or before "emoji", with a leading "for" dropped ("emoji for thank you"). '' when it is not that shape. Pure. */
export function emojiPhrase(text) {
  const m = /^(?:the\s+)?emoji\s+([a-z][a-z' -]{1,40})$/i.exec(clean(text)) || /^(?:the\s+)?([a-z][a-z' -]{1,40}?)\s+emoji$/i.exec(clean(text));
  return m ? m[1].trim().toLowerCase().replace(/^for\s+/, '') : '';
}
/** the wall's emoji named in "emoji <name>", "<name> emoji", or "emoji for <phrase>", or null. Pure. */
export function namedEmoji(text) {
  const phrase = emojiPhrase(text);
  if (!phrase) return null;
  const name = ALIAS[phrase] || phrase;
  return EMOJI.find((e) => e.n === name) || null;
}
export const isCounts = (text) => /^(?:the\s+)?(?:emoji\s+(?:counts?|tracker|leaderboard)|most\s+copied\s+emojis?|top\s+emojis?)$/i.test(clean(text));
// how one emoji looks everywhere (owner, 2026-11-03: a rival's grid of one emoji on Apple, Google, Samsung, Microsoft and more: "stuff like this is
// what we need to stop overlooking"): "grinning emoji on all phones", "how does the fire emoji look on iphone and android", "😀 on every platform"
const PLACES = '(?:all|every|each|different|other|most|any)\\s+(?:the\\s+)?(?:phones?|platforms?|devices?|vendors?|apps?|systems?|os(?:es)?|keyboards?)|iphones?(?:\\s+(?:and|vs\\.?|or)\\s+androids?)?|androids?(?:\\s+(?:and|vs\\.?|or)\\s+iphones?)?|everywhere|apple\\s+and\\s+(?:google|android|samsung)';
const LOOKS = [
  new RegExp('^(?:show\\s+(?:me\\s+)?|see\\s+)?(?:the\\s+|an?\\s+)?(.+?)\\s+emoji\\s+(?:on|across|in|for)\\s+(?:' + PLACES + ')$', 'i'),
  new RegExp('^how\\s+(?:does|do|will)\\s+(?:the\\s+|an?\\s+)?(.+?)(?:\\s+emoji)?\\s+look(?:s)?(?:\\s+like)?\\s+(?:on|across|in)\\s+(?:' + PLACES + ')$', 'i'),
  new RegExp('^(?:the\\s+)?(.+?)\\s+emoji\\s+(?:on\\s+)?(?:every|all)\\s+platforms?\\s+(?:compared|side by side)$', 'i'),
  new RegExp('^(.+?)\\s+(?:on|across)\\s+(?:' + PLACES + ')$', 'i'),
];
/** the emoji an ask wants to see on every platform: the words naming it ('grinning'), or the emoji itself, or null. Pure. */
export function looksOf(text) {
  const t = clean(text).replace(/\s+/g, ' ');
  for (let i = 0; i < LOOKS.length; i++) {
    const m = LOOKS[i].exec(t); if (!m) continue;
    const w = m[1].trim();
    if ((i === 3 || (i === 1 && !/\bemoji\b/i.test(t))) && !/^\p{Extended_Pictographic}/u.test(w)) continue; // a bare "<x> on all phones" only for an emoji itself, never "games on all phones"
    if (!w || w.length > 50) continue;
    return w;
  }
  return null;
}
const cp = (c) => [...c].map((x) => 'U+' + x.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');

function runLooks(want, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>How it looks everywhere</h2><div data-lk-out class="sub">Finding ' + esc(want) + '…</div>'; }); // void-review: ok (escaped)
  const out = el && el.querySelector ? el.querySelector('[data-lk-out]') : null;
  import('../lib/emoji-looks.js').then(async (m) => {
    const list = await m.loadData(), rec = m.findEmoji(list, want);
    if (!out || (api._pageStill && !api._pageStill(el))) return;
    if (!rec) { out.textContent = 'No emoji called "' + want + '". Try its name, like "grinning", "red heart" or "thumbs up".'; return; }
    const c = rec.c, name = rec.n || '';
    if (!document.getElementById('lk-css')) { const st = document.createElement('style'); st.id = 'lk-css'; st.textContent = m.LOOKS_CSS; document.head.appendChild(st); }
    const h = el.querySelector('h2'); if (h) h.textContent = c + ' ' + name + ' on ' + (m.VENDORS.length + 1) + ' platforms';
    out.className = '';
    out.innerHTML = '<div class="sub">' + esc(m.codepointOf(c)) + (m.shortcodeOf(rec) ? ' · ' + esc(m.shortcodeOf(rec)) : '') + ' · tap one to copy it</div>' + m.gridHtml(c, { name, compact: true }) // void-review: ok (escaped; gridHtml escapes every value)
      + '<div class="sub"><a href="/emojis/everywhere/?e=' + esc(encodeURIComponent(c)) + '">Open the full view</a>: every vendor\'s name and where it shows up, light or dark, and a link to share</div>';
    m.wireGrid(out);
  }).catch(() => { if (out) out.textContent = 'The pictures could not be loaded just now.'; });
  return 'emoji';
}

function run(text, api) {
  const { showPage, esc } = api;
  const want = looksOf(text);
  if (want) return runLooks(want, api);
  const named = namedEmoji(text);
  if (named) {
    const phrase = emojiPhrase(text);
    // "heart" is several emoji. Show the red heart, and say which, so a bare "heart emoji" is a heart and not an article about Unicode.
    const which = phrase === 'heart'
      ? '<p>Which did you mean? The red heart is the one above. <a href="#" data-ask="heart eyes emoji">Heart eyes</a> is the face.</p>'
      : '';
    showPage((p) => {
      p.innerHTML = '<h2>' + esc(named.n) + '</h2><p style="font-size:64px;text-align:center;margin:8px 0">' + esc(named.c) + '</p>' + which + '<div class="sub">' + esc(cp(named.c)) + ' · copy it from the wall to count it</div>'; // void-review: ok (which is fixed text; every value escaped)
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
  examples: ['random emoji', 'give me an emoji', 'another emoji', '3 emojis', 'emoji fire', 'rocket emoji', 'heart emoji', 'emoji feu', 'emoji for thank you', 'emoji counts', 'grinning emoji on all phones', 'how does the fire emoji look on iphone and android'],
  nearMisses: ['what is an emoji', 'emoji keyboard', 'send emoji', 'emoji for my keyboard', 'games on all phones', 'how does it look on iphone'],
  match(lower, text) { return isEmoji(text) || !!namedEmoji(text) || isCounts(text) || !!looksOf(text); },
  run,
  suite() {
    const ok = isEmoji('random emoji') && isEmoji('3 emojis') && !isEmoji('what is an emoji') && namedEmoji('emoji fire').c === '🔥'
      && namedEmoji('heart emoji').c === '❤️' && namedEmoji('emoji feu').c === '🔥' && namedEmoji('emoji for thank you').c === '🙏'
      && namedEmoji('emoji for fire').c === '🔥' && !namedEmoji('emoji keyboard') && !namedEmoji('emoji for my keyboard')
      && isCounts('emoji counts') && looksOf('grinning emoji on all phones') === 'grinning'
      && looksOf('how does the fire emoji look on iphone and android') === 'fire' && looksOf('😀 on every platform') === '😀' && !looksOf('games on all phones');
    return { ok, got: 'match works' };
  }
};
