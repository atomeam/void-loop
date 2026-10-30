/**
 * fakeuser skill: "random user generator", "fake name generator", "generate 5 fake german women" (owner, 2026-10-24: "find the site to
 * conquer and get to work now"; the tower's frontier ranked randomuser.me). The card shows the first few made-up people the ask described and
 * links to /random-user/ with the same settings and seed (lib/fakeuser.js): JSON, CSV, YAML, XML or SQL, emails at example.com, no real faces.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { askFake, people } from '../lib/fakeuser.js';

function run(text, api) {
  const { showPage, esc } = api, q = askFake(text); if (!q) return null;
  // the page's card names its seed, so the stage shows the page's own people; any other ask gets new ones
  const seed = q.seed || Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(36).padStart(2, '0')).join('');
  const shown = people({ seed, n: Math.min(q.n, 3), nats: q.nats, gender: q.gender });
  const href = '/random-user/?' + new URLSearchParams({ n: String(q.n), nat: q.nats.join(','), ...(q.gender ? { g: q.gender } : {}), seed });
  showPage((el) => {
    el.dataset.cardKind = 'Made-up people'; el.dataset.page = href; // the card's page link opens these same people
    el.innerHTML = '<h2>' + esc(q.n + ' made-up ' + (q.n === 1 ? 'person' : 'people')) + '</h2>' // void-review: ok (escaped)
      + shown.map((p) => '<p style="display:flex;gap:10px;align-items:center;margin-top:6px;margin-bottom:6px"><img src="' + esc(p.picture) + '" alt="" width="40" height="40" style="float:none;margin:0"><span><b>' + esc(p.name) + '</b><br><span style="color:#8a8a8a">' + esc(p.email) + ' · ' + esc(p.city) + ', ' + esc(p.country) + ' · ' + p.age + '</span></span></p>').join('')
      + '<p><a class="fu-open" href="' + esc(href) + '" style="display:inline-block;padding:8px 18px;border-radius:999px;background:#6d4aff;color:#fff;text-decoration:none;font-weight:600">' + esc(q.n > 3 ? 'All ' + q.n + ', as JSON, CSV or SQL' : 'As JSON, CSV or SQL') + '</a></p>'
      + '<div class="src">Made on this device from a seed, so the link gives the same people again. Emails are at example.com; US, UK and French phone numbers are in ranges reserved for fiction; pictures are initials, never faces.</div>';
  });
  return 'fakeuser';
}

export default {
  name: 'fakeuser',
  examples: ['random user generator', 'fake name generator', 'generate 5 fake german women', '20 random users from japan and brazil', 'fake identity', 'can u make a fake user profile'],
  nearMisses: ['pick a random name from alice, bob', 'fake news', 'my users', 'random number', 'spin the wheel', 'name a random country'],
  match(lower, text) { return !!askFake(text || lower); },
  run
};
