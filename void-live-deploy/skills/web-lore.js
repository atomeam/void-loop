/**
 * web-lore skill: ask Verse about any site it has met, and it answers from that site's record in Web Lore (a-to-mind.com/lore/<site>),
 * every fact with its source (owner, 2026-11-06: ask Verse about any page it took on, the way an assistant answers about posts on its own
 * network). "history of 4chan", "4chan history", "tell me about theguardian.com", "web lore". A bare name answers only for a site with a
 * cited history (lib/lore-names.js, built by tools/lore.mjs), so "history of rome" stays a history question; a domain always answers.
 * Made with tools/new-skill.mjs (docs/UPGRADING.md).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { LORE_NAMES } from '../lib/lore-names.js';

const slugOf = (s) => String(s || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
const DOMAIN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/;
const SITE = '(?:\\s+(?:website|web\\s+site|site))?';
const HIST = new RegExp('^(?:(?:what(?:[\'’]?s|\\s+is)|tell\\s+me|show\\s+me|give\\s+me)\\s+the\\s+)?(?:history|lore|story|backstory|origins?)\\s+(?:of|behind)\\s+(?:the\\s+)?(?:(?:web)?site\\s+)?(.+?)' + SITE + '$');
const AFTER = new RegExp('^(.+?)' + SITE + '[\'’]?s?\\s+(?:history|lore|backstory|origin\\s+story)$');
const ABOUT = new RegExp('^(?:tell\\s+me\\s+about|what(?:[\'’]?s|\\s+is)|who\\s+(?:made|makes|runs|owns|founded|started)|ask\\s+verse\\s+about)\\s+(?:the\\s+)?(.+?)(' + SITE + ')$');
const LIST = /^(?:(?:open|show(?:\s+me)?|go\s+to)\s+)?(?:the\s+)?(?:verse(?:['’]s)?\s+)?web\s+lore(?:\s+page)?$/;

/** { list: true } for the Web Lore page, { q } for one site's record, or null. Pure. */
export function loreAsk(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  if (LIST.test(t)) return { list: true };
  // a domain counts only said as one word ("in github.com" is a sentence about a page, not a site); a known name may have spaces ("hugging face")
  const domainOf = (x) => { const k = slugOf(x); return !/\s/.test(x.trim()) && DOMAIN.test(k) ? k : ''; };
  const known = (x) => { const k = slugOf(x); return k && (domainOf(x) || LORE_NAMES.has(k)) ? k : ''; };
  let m = t.match(HIST) || t.match(AFTER);
  if (m) { const q = known(m[1]); return q ? { q } : null; }
  m = t.match(ABOUT); // "what is reddit" is a general question; a domain, or a known site said as a site, opens its record
  if (m && !/^https?:\/\/[^/]+\/[^/\s]|^[^/\s]+\/[^/\s]/.test(m[1].trim())) { const k = slugOf(m[1]); if (k && (domainOf(m[1]) || (m[2] && LORE_NAMES.has(k)))) return { q: k }; } // a path is a page, not the site
  return null;
}

const https = (u) => (/^https:\/\/[^\s"<>]+$/.test(String(u || '')) ? String(u) : '');
const BTN = 'display:inline-block;padding:6px 14px;margin:4px 6px 0 0;border:1px solid #8884;border-radius:999px;text-decoration:none';

async function run(text, api) {
  const a = loreAsk(text); if (!a) return 'none';
  const { showPage, esc } = api;
  if (a.list) {
    showPage((el) => { el.dataset.page = '/lore/'; el.innerHTML = '<h2>Web Lore</h2><p>Every site Verse has come across, sorted by what it does, each with its history and the source of every fact.</p><p><a href="/lore/" style="' + BTN + '">Open Web Lore</a></p><div class="src">Also as plain text and JSON: curl a-to-mind.com/lore</div>'; });
    return 'web-lore';
  }
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(a.q) + '</h2><p class="sub">Reading its record in Web Lore…</p>'; });
  let r = null, status = 0;
  try { const res = await fetch('/lore/' + encodeURIComponent(a.q) + '?format=json', { headers: { accept: 'application/json' } }); status = res.status; r = await res.json().catch(() => null); } catch (_) { status = 0; }
  if (!el || !el.isConnected) return 'web-lore';
  if (!r || !r.ok) {
    el.innerHTML = '<h2>' + esc(a.q) + '</h2><p>' + (status === 404 ? 'Verse has not met ' + esc(a.q) + ' yet, so it has no record of it.' : 'Web Lore did not answer just now. Try again in a moment.') + '</p>'
      + '<p><a href="/lore/" style="' + BTN + '">Every site in Web Lore</a></p>';
    return 'web-lore';
  }
  const facts = (r.facts || []).filter((f) => https(f.source)), shown = facts.slice(0, 6);
  el.dataset.page = '/lore/' + r.slug;
  el.innerHTML = '<h2>' + esc(r.site) + '</h2>' // void-review: ok: every value is escaped and every link is https or a fixed Verse path
    + '<p class="sub">' + esc(r.category) + ' · on the Versus tower: ' + esc(r.onTheTower) + '</p>'
    + (shown.length ? '<ul>' + shown.map((f) => '<li><b>' + esc(f.section) + ':</b> ' + esc(f.text) + ' <a href="' + esc(f.source) + '" rel="noopener noreferrer">(source)</a></li>').join('') + '</ul>'
      : '<p>No cited history yet. It is on the queue for the next history run.</p>')
    + (facts.length > shown.length ? '<p class="sub">' + esc(facts.length - shown.length) + ' more facts on its record.</p>' : '')
    + '<p><a href="/lore/' + esc(encodeURIComponent(r.slug)) + '" style="' + BTN + '">Full record</a>'
    + (r.versePage && /^\/[a-z0-9/_-]*$/i.test(r.versePage) ? '<a href="' + esc(r.versePage) + '" style="' + BTN + '">Verse’s version</a>' : '') + '</p>'
    + '<div class="src">Web Lore: every fact links its source; nothing is guessed.</div>';
  return 'web-lore';
}

export default {
  name: 'web-lore',
  examples: [
    'history of 4chan',
    'history of icanhazip.com',
    'web lore',
    'tell me about theguardian.com',
    '4chan history',
    'what is the history of reddit',
    'who runs wizchan.org',
    'open web lore',
  ],
  nearMisses: [
    'history of rome',
    'history of the internet',
    'what is love',
    'history of amazon',
    'what is reddit',
    'tell me about yourself',
  ],
  loreAsk,
  match(lower, text) { return !!loreAsk(text || lower); },
  run,
};
