/**
 * video-gen skill: "animate a cat chasing yarn", "animate waves on a beach" (owner, 2026-10-30: "same with image and video ... we should have
 * the best of everything"). The stage card for the AI video generator: it names the clip, says whether video is on right now (GET /api/clip,
 * the page's own state line), and links to /video/ with the words filled in. No clip is made here; a clip is made only on the page's Make
 * press. "animate a picture" opens /video/ itself (lib/toolkit.js), so it is a near miss here. Made with tools/new-skill.mjs (docs/UPGRADING.md).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { PROMPT_MAX, ASPECTS, PROBE_SECONDS, PROBE_DAILY_USD, promptCheck, afterProbe, noCredits, sayOf } from '../lib/video-gen.js';
import { videoAskOf, videoInputOf, videoUrlOf } from '../lib/studio.js'; // the request /api/clip sends the model (functions/api/studio.js makeVideo), for suite()

const WHEN = /^animate (?!(?:a |my |this |the )?(?:picture|image|photo)s?$)(.{3,})$/i;

/** the clip's words from the ask, or '' (pure) */
export function clipWords(text) {
  const m = String(text || '').trim().replace(/[?!.]+$/, '').match(WHEN);
  return m ? m[1].trim().slice(0, PROMPT_MAX) : '';
}

/** how long ago an ISO time was, in plain words, or '' (pure) */
export function agoWords(iso, now = Date.now()) {
  const t = Date.parse(iso || ''), m = Math.round((now - t) / 60000);
  if (!Number.isFinite(t) || m < 0) return '';
  return m < 2 ? 'just now' : m < 90 ? m + ' minutes ago' : Math.round(m / 60) + ' hours ago';
}
/** the card's state line from GET /api/clip: on or off in the route's own words, then when Verse last tested the video model.
 *  That test runs at most every 6 hours, and tools/video-live.mjs reads this route from GitHub every 6 hours so it never goes stale. (pure) */
export function stateLine(j, now = Date.now()) {
  const state = j && j.on ? 'Video is on. ' + (Number(j.clipsLeft) || 0) + ' short clips left today for everyone.' : String((j && j.say) || 'Video is off right now.');
  const ago = agoWords(j && j.checkedAt, now);
  return state + (ago ? ' Verse last tested the video model ' + ago + '.' : '');
}

/** the /video/ link with the clip's words filled in: %20, not +, and !'()* escaped too, since lib/card-frame.js pageOfCard links only a plain query (pure) */
export const hrefOf = (words) => '/video/?prompt=' + encodeURIComponent(String(words || '')).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
/** the card's markup before the state line arrives: the words as the heading, a waiting state line, the link to /video/ (pure) */
export const cardHtml = (words, esc) => '<h2>' + esc('Animate: ' + words) + '</h2>' // void-review: ok: every piece escaped
  + '<p class="vg-state">Checking whether video is on…</p>'
  + '<p><a href="' + esc(hrefOf(words)) + '">Open the AI video generator with these words</a></p>'
  + '<div class="src">A short clip (2, 3 or 5 seconds) from a partner video model on Workers AI, made only when you press Make on the page.</div>';

function run(text, api) {
  const { showPage, esc } = api, words = clipWords(text), href = hrefOf(words);
  showPage((el) => {
    el.dataset.page = href;
    el.innerHTML = cardHtml(words, esc); // void-review: ok: cardHtml escapes every piece with esc
    const line = el.querySelector('.vg-state');
    fetch('/api/clip', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      if (!line) return;
      line.textContent = stateLine(j);
    }).catch(() => { if (line) line.textContent = 'Could not check video just now; the page says whether it is on.'; });
  });
  return 'video-gen';
}

// the daily smoke test runs this (tools/skills-check.mjs; asked by Verse, 2026-10-31: "Address the least-checked skills: video-gen and baggage").
// No clip can be made while the video model's account has no AI Gateway credits (adding them is the owner's step), so this proves what Verse
// controls, and never a generation: the request /api/clip sends the model for a card's words and for the self-check clip, the credits error
// read as off with the plain words, a reply that is not a real clip never turning video on, and the fallback card a visitor gets (pure)
export function suite() {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const now = Date.parse('2026-11-06T12:00:00Z'), words = clipWords('animate a <b>cat</b> & a dog!'), h = cardHtml(words, esc);
  const ask = videoAskOf('p-video', { seconds: 5, draft: true, aspect: ASPECTS.portrait }), input = videoInputOf(ask, words + ', safe for work');
  const probe = videoAskOf('p-video', { seconds: PROBE_SECONDS, draft: true, aspect: ASPECTS.landscape }), off = afterProbe({ state: 'failed', why: '2021: Insufficient AI Gateway credits' }, now);
  const checks = [
    ['words', clipWords('Animate waves on a beach at sunset.') === 'waves on a beach at sunset' && clipWords('animate a picture') === '' && promptCheck('a paper boat on a pond').prompt === 'a paper boat on a pond' && promptCheck('').why === 'empty'],
    ['request', input.prompt === words + ', safe for work' && input.duration === 5 && input.aspect_ratio === '9:16' && input.draft === true && input.resolution === '720p' && input.disable_safety_filter === false && !('image' in input)
      && videoAskOf('p-video', { seconds: 60 }).seconds === 10 && videoAskOf('nope', {}).model === 'p-video'],
    ['self-check clip', probe.seconds === 1 && probe.draft === true && probe.usd <= PROBE_DAILY_USD],
    ['credits error', noCredits('2021: Insufficient AI Gateway credits') && !noCredits('timed out') && off.on === 0 && off.why === 'credits' && /credits are added/.test(sayOf('credits'))],
    ['no fake clip', afterProbe({ state: 'video', url: 'https://clips.example/a.mp4' }, now).on === 0 && videoUrlOf({ result: { video: 'http://x/a.mp4' } }) === '' && videoUrlOf({ result: { video: 'https://x/a.mp4' } }) === 'https://x/a.mp4'],
    ['fallback card', h.includes('Animate: a &lt;b&gt;cat&lt;/b&gt; &amp; a dog') && !h.includes('<b>cat') && h.includes('href="/video/?prompt=a%20%3Cb%3Ecat%3C%2Fb%3E%20%26%20a%20dog"') && h.includes('Checking whether video is on')
      && stateLine({ on: false, say: sayOf('credits'), checkedAt: '2026-11-06T09:00:00Z' }, now) === sayOf('credits') + ' Verse last tested the video model 3 hours ago.'
      && stateLine({ on: true, clipsLeft: 2 }, now) === 'Video is on. 2 short clips left today for everyone.' && stateLine(null, now) === 'Video is off right now.'],
  ];
  const bad = checks.filter(([, ok]) => !ok).map(([n]) => n);
  return { ok: !bad.length, got: bad.join(', ') };
}

export default {
  name: 'video-gen',
  examples: ['animate a cat chasing yarn', 'animate waves on a beach at sunset'],
  nearMisses: ['animate a picture', 'play a video of a cat'],
  suite,
  match(lower) { return !!clipWords(lower); },
  run
};
