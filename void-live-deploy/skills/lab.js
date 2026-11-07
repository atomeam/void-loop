/**
 * lab skill: "verse lab", "vers lab", "the lab", "open the lab" (owner, 2026-11-06: "verse lab", "i cant find the lab anywhere"): the lab at
 * /lab/ as one card on the stage, its count read live from /lab/catalog.json (the file tools/lab-sync.mjs writes each night), the newest
 * experiments as links, and the card itself links to /lab/. Being a skill also puts the lab in the book (skills/guide.json), which is the
 * menu. Nothing goes on the home page (owner, 2026-11-06: "nothing is added to the homepage ever"). Made with tools/new-skill.mjs.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
// the self-name Verse answers to ("verse", "vers", "verses", "verse's", the old "void") is optional; so is an opening verb, "the", "your", and a
// closing "page", "experiments" or "on verse". A bare "lab" counts. "lab results", "lab coat", "labrador", "chemistry lab" do not.
const SELF = "(?:verse|vers|verses|verse's|void|void's|a-to-mind)";
const WHEN = new RegExp('^(?:(?:open|show(?: me)?|go to|take me to|where is|where\'s|find|see)\\s+)?(?:(?:the|your|my)\\s+)?(?:' + SELF + '\\s+)?(?:labs?|laboratory)'
  + '(?:\\s+(?:page|experiments|experiment list))?(?:\\s+(?:on|in|of)\\s+' + SELF + ')?$', 'i');
const FALLBACK = 'Small experiments to play with, each a page of its own.';

/** the catalog -> { live, total, newest: [{ slug, title, num }] }: live is every entry that is not broken. Pure. */
export function summary(catalog, n = 8) {
  const list = Array.isArray(catalog) ? catalog : [];
  const live = list.filter((e) => e && e.slug && e.status !== 'broken');
  const newest = live.slice().sort((a, b) => (Number(b.num) || 0) - (Number(a.num) || 0)).slice(0, n).map((e) => ({ slug: e.slug, title: e.title || e.slug, num: e.num }));
  return { live: live.length, total: list.length, newest };
}

function card(el, esc, s) {
  el.dataset.page = '/lab/';
  const links = s && s.newest.length ? '<p style="display:flex;flex-wrap:wrap;gap:6px">' + s.newest.map((e) => '<a href="/lab/' + esc(e.slug) + '/" style="display:inline-block;padding:5px 12px;border:1px solid #8884;border-radius:999px;text-decoration:none">' + esc(e.title) + '</a>').join('') + '</p>' : '';
  el.innerHTML = '<h2><a href="/lab/">The Verse lab</a></h2>' // void-review: ok (titles and slugs pass through esc; the rest is fixed text)
    + '<p class="lead">' + (s ? esc(s.live + ' experiments live, newest first.') : esc(FALLBACK)) + '</p>'
    + links
    + '<div class="src">From Verse itself: <a href="/lab/">a-to-mind.com/lab/</a>' + (s && s.total > s.live ? esc(', ' + (s.total - s.live) + ' more waiting for a fix') : '') + '</div>';
}

function run(text, api) {
  const { showPage, esc } = api;
  showPage((el) => {
    card(el, esc, null);
    fetch('/lab/catalog.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((c) => { if (c && el.isConnected !== false) card(el, esc, summary(c)); }).catch((e) => console.debug('lab card:', e));
  });
  return 'lab';
}

export const builtWith = ['toolkit'];
export default {
  name: 'lab',
  examples: ['verse lab', 'vers lab', 'the lab', 'open the lab', 'show me the lab', 'lab experiments', "verse's lab", 'where is the lab', 'lab'],
  nearMisses: ['lab results', 'lab coat', 'labrador puppies', 'chemistry lab safety', 'what is a lab', 'blood lab work'],
  match(lower) { return WHEN.test(String(lower).trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ')); },
  run,
  summary
};
