/**
 * dating skill - the beginning of Verse's dating track: a profile builder and an icebreaker coach that run entirely on
 * the page. Nothing is sent anywhere, no matching, no other people's data; adults only (an 18+ check before it opens).
 * The real dating service needs auth, verification, block/report and moderation first (docs/everything-app.md).
 * Contract: { name, examples, nearMisses, match, run }.
 */
/** { open } | { icebreaker: interest } | null. Pure. */
export function datingAsk(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:give\s+me\s+)?(?:some\s+)?(?:an?\s+)?(?:dating\s+)?(?:icebreakers?|opening\s+lines?|openers?|first\s+messages?)\s+(?:for\s+(?:someone|a\s+person|a\s+match)\s+(?:who\s+likes|into)\s+|about\s+)([a-z ,&'-]{2,40})$/);
  if (m) return { icebreaker: m[1].trim() };
  if (/^(?:(?:open|start|show|build|make|help\s+me\s+(?:write|build|make))\s+)?(?:a\s+|my\s+|the\s+)?(?:dating(?:\s+(?:profile(?:\s+builder)?|bio|card|coach|app))?|profile\s+builder|icebreaker\s+coach)$/.test(t)) return { open: true };
  return null;
}
const OPEN = [(i) => 'Okay, settle this: what is the most underrated thing about ' + i + '?', (i) => 'If we did ' + i + ' together this weekend, what would you want to try first?', (i) => 'What got you into ' + i + '? I want the real story, not the short version.', (i) => 'Rank these: ' + i + ', a good taco, and a sunset. Go.'];
/** three icebreakers for interests (comma list), deterministic. Pure. */
export function icebreakers(interests) {
  const list = String(interests || '').split(/,|\band\b|&/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
  const xs = list.length ? list : ['travel'];
  return [0, 1, 2].map((k) => OPEN[(k + xs[k % xs.length].length) % OPEN.length](xs[k % xs.length]));
}
/** a short bio from the builder's fields. Pure. */
export function bio({ name = '', vibe = '', interests = '', looking = '' }) {
  const ints = String(interests).split(',').map((s) => s.trim()).filter(Boolean);
  return [name && vibe ? name + ', ' + vibe + '.' : name ? name + '.' : '', ints.length ? 'Happiest when ' + (ints.length > 1 ? ints.slice(0, -1).join(', ') + ' or ' + ints[ints.length - 1] : ints[0]) + ' is involved.' : '', looking ? 'Looking for ' + looking + '.' : ''].filter(Boolean).join(' ');
}
const ADULT = 'void-dating-18';
function run(text, api) {
  const { showPage, esc } = api; const q = datingAsk(text);
  if (!q) return 'none';
  showPage((el) => {
    el.className += ' dating-card';
    const body = () => {
      el.innerHTML = '<h2>Dating · the beginning</h2><p class="g-sub" style="font-size:12px">Step one of Verse dating: build your profile and practise openers. All on this page; nothing is sent or saved anywhere.</p>' // void-review: ok (only constant strings: the field labels are fixed in this file)
        + ['name|First name', 'vibe|Your vibe (e.g. curious night owl)', 'interests|Interests, commas between', 'looking|Looking for'].map((f) => { const [k, l] = f.split('|'); return '<input class="dt-' + k + '" aria-label="' + l + '" placeholder="' + l + '" style="width:100%;margin:3px 0">'; }).join('')
        + '<p style="margin-top:10px"><b>Your bio</b></p><p class="dt-bio" aria-live="polite"></p><p><b>Openers</b></p><ul class="dt-ice"></ul>'
        + '<div class="src">Matching, chat, block and report come later, with sign-in and safety review · adults only</div>';
      const v = (k) => el.querySelector('.dt-' + k).value;
      const up = () => { el.querySelector('.dt-bio').textContent = bio({ name: v('name'), vibe: v('vibe'), interests: v('interests'), looking: v('looking') }) || 'Fill in a field to start.';
        el.querySelector('.dt-ice').innerHTML = icebreakers(v('interests') || q.icebreaker).map((s) => '<li>' + esc(s) + '</li>').join(''); };
      if (q.icebreaker) el.querySelector('.dt-interests').value = q.icebreaker;
      el.querySelectorAll('input').forEach((i) => { i.addEventListener('input', up); i.addEventListener('keydown', (e) => e.stopPropagation()); });
      up();
    };
    let ok = false; try { ok = sessionStorage.getItem(ADULT) === '1'; } catch (_) {}
    if (ok) return body();
    el.innerHTML = '<h2>Dating</h2><p>This part of Verse is for adults only.</p><button class="g-btn dt-18" type="button">I am 18 or older</button> <button class="g-btn dt-no" type="button">I am not</button>';
    el.querySelector('.dt-18').addEventListener('click', () => { try { sessionStorage.setItem(ADULT, '1'); } catch (_) {} body(); });
    el.querySelector('.dt-no').addEventListener('click', () => { el.innerHTML = '<h2>Dating</h2><p>Come back when you are 18. Plenty of other things to do here.</p>'; });
  });
  return 'dating';
}
export default {
  name: 'dating',
  examples: ['dating profile', 'dating profile builder', 'icebreaker coach', 'icebreakers about hiking', 'open dating'],
  nearMisses: ['date today', 'what is the date', 'carbon dating', 'update my profile'],
  match(lower, text) { return !!datingAsk(text || lower); },
  run,
};
