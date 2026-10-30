/**
 * studios skill: the studios the tower floors built (/paint/, /cpan/, /books/, /identity/, /hosting/, /tournaments/, /prizes/) and /obituaries/
 * answer on the stage with a card that opens the studio (owner, 2026-10-30: "connect it all to work seemlessly"). Each studio page has a
 * "See it on the stage" link (/?ask=cpan%20testers ...); before this skill those asks fell through to a web answer about the topic, not the studio.
 * The words, the label, what it does and the site it carries forward come from lib/tower.js FLOORS (one place); only the short stage-link asks
 * and /obituaries/, which is not a floor, are written here. Made with tools/new-skill.mjs (docs/UPGRADING.md).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { FLOORS } from '../lib/tower.js?v=ladder-67';

// the studios, by page; `say` is the ask each page's own stage link sends, `also` other short names people use
export const STUDIOS = Object.freeze([
  { page: '/paint/', say: ['paint by numbers', 'paint by number'] },
  { page: '/cpan/', say: ['cpan testers', 'cpan studio', 'cpan testers results', 'cpan test results'] },
  { page: '/books/', say: ['ai book writer studio', 'verse bookshelf', 'bookshelf studio'] },
  { page: '/identity/', say: ['identity sso profile', 'identity studio'] },
  { page: '/hosting/', say: ['web hosting sizing', 'hosting sizer', 'hosting and domain studio'] },
  { page: '/tournaments/', say: ['tournament scorer', 'tournament scoring', 'score my tournament', 'score a tournament'] },
  { page: '/prizes/', say: ['prize wheel odds', 'prize wheel odds and payout calculator'] },
  { page: '/obituaries/', say: ['obituaries', 'obituaries and lineage'], label: 'Obituaries & Lineage', what: 'a respectful archive of every tool Verse has surpassed: their history, their contribution, and the studio that carries their work forward' },
]);

const norm = (s) => String(s || '').toLowerCase().replace(/[?!.]+$/, '').replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
const OPEN = /^(?:(?:open|show(?: me)?|go to|take me to)\s+)?(?:the\s+)?(?:verse(?:'s)?\s+)?/;

/** each studio with its floors: { page, label, what, sites[], asks[] }. Pure. */
export function studios(floors = FLOORS) {
  return STUDIOS.map((s) => {
    const fl = floors.filter((f) => f && f.page === s.page);
    const asks = new Set([...s.say, ...fl.map((f) => f.ask), ...fl.map((f) => f.label)].map(norm).filter(Boolean));
    return { page: s.page, label: s.label || (fl[0] && fl[0].label) || s.page, what: s.what || (fl[0] && fl[0].fatality) || '', sites: [...new Set(fl.map((f) => f.site).filter(Boolean))], asks: [...asks] };
  });
}
const LIST = studios();

/** the studio an ask names, or null. Pure. */
export function studioOf(text, list = LIST) {
  const t = norm(text), bare = t.replace(OPEN, ''), lead = t.replace(/^(?:(?:open|show(?: me)?|go to|take me to)\s+)?(?:the\s+)?/, ''); // "verse bookshelf" is a name, "open verse bookshelf" too
  const tail = (x) => x.replace(/\s+(?:studio|page)$/, ''); // "paint by numbers studio" names the same studio (2026-10-30: on a-to-mind.com it gave a web article)
  return list.find((s) => s.asks.includes(bare) || s.asks.includes(lead)) || list.find((s) => s.asks.includes(tail(bare)) || s.asks.includes(tail(lead))) || null;
}

function run(text, api) {
  const { showPage, esc } = api, s = studioOf(text);
  if (!s) return '';
  showPage((el) => {
    el.dataset.page = s.page;
    el.innerHTML = '<h2>' + esc(s.label) + '</h2>' // void-review: ok: every value is escaped, the page is a fixed path from STUDIOS
      + (s.what ? '<p>' + esc(s.what.charAt(0).toUpperCase() + s.what.slice(1)) + '.</p>' : '')
      + '<p><a href="' + esc(s.page) + '" style="display:inline-block;padding:8px 16px;border:1px solid #8884;border-radius:999px;text-decoration:none">Open ' + esc(s.label) + '</a></p>'
      + (s.sites.length ? '<div class="src">Verse’s studio for what ' + esc(s.sites.join(', ')) + ' did; it runs on this device.</div>' : '<div class="src">A Verse page; it runs on this device.</div>');
  });
  return 'studios';
}

export default {
  name: 'studios',
  examples: ['cpan testers', 'paint by numbers', 'tournament scorer', 'web hosting sizing', 'identity sso profile', 'obituaries', 'ai book writer studio', 'prize wheel odds and payout calculator', 'open the cpan testers studio', 'verse bookshelf'],
  nearMisses: ['paint', 'verse book', 'web hosting', 'cpan', 'obituary of queen elizabeth'],
  match(lower) { return !!studioOf(lower); },
  run
};
