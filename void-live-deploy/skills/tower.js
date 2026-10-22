/**
 * tower — the tower of real sites (100+ across categories). "show the tower", "sites in fashion",
 * "tower categories", "is Nike in the tower". Lap grows the list each cycle. Empty surface stays empty.
 */
import { CATEGORIES, allSites, counts, byCategory, findSite } from '../lib/tower-sites.js';

export function towerOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:show\s+)?(?:the\s+)?tower(?:\s+of\s+sites)?$|^(?:list\s+)?tower\s+categories$|^what\s+sites\s+are\s+in\s+the\s+tower$/.test(t))
    return { kind: 'all' };
  let m = t.match(/^(?:sites?|tower)\s+(?:in|for|under)\s+(.{2,40})$/) || t.match(/^(.{2,40})\s+sites?\s+in\s+the\s+tower$/);
  if (m) return { kind: 'cat', q: m[1].trim() };
  m = t.match(/^(?:is\s+)(.+?)\s+in\s+the\s+tower$/) || t.match(/^find\s+(.+?)\s+in\s+the\s+tower$/);
  if (m) return { kind: 'find', q: m[1].trim() };
  return null;
}

async function run(text, api) {
  const q = towerOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  const c = counts();
  if (q.kind === 'all') {
    showPage((p) => {
      p.innerHTML = '<h2>Tower of sites</h2><div class="sub">' + c.sites + ' sites · ' + c.categories + ' categories · lap grows this list</div><ul>'
        + CATEGORIES.map((cat) => '<li><b>' + esc(cat.label) + '</b> · ' + cat.sites.map((s) => esc(s.name)).join(', ') + '</li>').join('')
        + '</ul><div class="src">Say “sites in fashion” or “is Nike in the tower” · clothes, fashion and merch included</div>';
    });
    api.say(c.sites + ' sites in ' + c.categories + ' categories');
    return 'tower';
  }
  if (q.kind === 'find') {
    const s = findSite(q.q);
    showPage((p) => {
      if (!s) p.innerHTML = '<h2>Tower</h2><p>“' + esc(q.q) + '” is not in the tower yet. The lap adds sites each cycle.</p>';
      else p.innerHTML = '<h2>' + esc(s.name) + '</h2><div class="sub">' + esc(s.categoryLabel) + '</div>'
        + '<p><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.url) + '</a></p>';
    });
    api.say(s ? s.name + ' · ' + s.categoryLabel : 'not in the tower yet');
    return 'tower';
  }
  // category
  const cat = byCategory(q.q) || CATEGORIES.find((c) => c.label.toLowerCase().includes(q.q) || c.id.includes(q.q.replace(/\s+/g, '-')));
  // fashion aliases
  const fashion = /fashion|clothes|clothing|merch|apparel|wear/.test(q.q) ? byCategory('fashion-merch') : null;
  const hit = cat || fashion;
  showPage((p) => {
    if (!hit) p.innerHTML = '<h2>Tower</h2><p>No category matched “' + esc(q.q) + '”. Say “show the tower” for all.</p>';
    else p.innerHTML = '<h2>' + esc(hit.label) + '</h2><div class="sub">' + hit.sites.length + ' sites</div><ul>'
      + hit.sites.map((s) => '<li><a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a></li>').join('')
      + '</ul>';
  });
  api.say(hit ? hit.label + ' · ' + hit.sites.length + ' sites' : 'no match');
  return 'tower';
}

export default {
  name: 'tower',
  examples: ['show the tower', 'sites in fashion', 'tower categories', 'is Nike in the tower', 'sites in work'],
  nearMisses: ['eiffel tower', 'tower defence', 'cell tower', 'ivory tower'],
  match(lower, text) { return !!towerOf(text); },
  run,
  suite() {
    const a = towerOf('show the tower'), b = towerOf('sites in fashion'), c = towerOf('is Nike in the tower'), d = towerOf('eiffel tower');
    const f = findSite('Nike');
    return { ok: !!(a && a.kind === 'all' && b && b.kind === 'cat' && c && c.kind === 'find' && d === null && f && f.name === 'Nike') };
  },
};
