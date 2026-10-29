// A note about one of Verse's own answer cards, answered by code where the model kept getting it wrong (owner, 2026-10-29, three live cards):
// card 1 took blame for sycophanthex.com turning its checker away and called the site's scores "my own numbers"; card 2 denied the blame card 1
// had taken and defended the gemma date nobody questioned; card 3 restated the gemma date again. None of them said whether the fixes the note
// named were live, and all three put the 2026-10-25 gemma row after the 2026-10-22 rows.
// So the model writes only the lead (one or two sentences), and code: drops a lead sentence that denies, apologises, takes blame for another
// site's choice, or answers a point the note did not raise; puts "my own X" right when the note says the X were the site's; checks a quoted line
// against my earlier cards and owns it when it is there; gives each fix the note names a status (live, pending in PR #N, or not started) from
// my deployed commits and the repo's pull requests; and sorts the Fixed list newest first. Pure, except fetchPulls (takes the fetch to use).
import { clean } from './repo-look.js';

export const REPO = 'atomeam/void-loop';
const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

const sentences = (t) => String(t || '').replace(/⏎/g, '\n').split(/\n+/).flatMap((l) => l.split(/(?<=[.!?]["”']?)\s+(?=["“']?[A-Z0-9])/)).map((s) => s.trim()).filter(Boolean);

/** the items a note opens with ordinals (First, Second, ...), and the number of fixes it states, else the number of items. Pure. */
export function namedFixes(note) {
  const items = [];
  for (const s of sentences(note)) {
    const m = /^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b[,:]?\s*(.*)$/i.exec(s);
    if (m && m[2]) items.push({ n: ORD.indexOf(m[1].toLowerCase()) + 1, text: m[2] });
    else if (items.length) items[items.length - 1].text += ' ' + s;
  }
  const c = /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+fix(?:es)?\b/i.exec(String(note || ''));
  const count = c ? (NUM[c[1].toLowerCase()] || Number(c[1])) : items.length;
  return { count, items };
}

// words that say nothing about which fix this is: they are in nearly every title of this repo
const PLAIN = new Set(('the and for are was has had not but can that this with from into your their them they then than when what which will would '
  + 'verse void card cards answer answers note notes site sites page pages make makes made gets new now still its it\'s fix fixes fixed thread threads line lines '
  + 'there these those been being does done each more most only over show shows shown keep keeps working work first second third about after before').split(' '));
export const wordsOf = (t) => new Set((String(t || '').toLowerCase().replace(/https?:\/\/\S+/g, ' ').match(/[a-z0-9][a-z0-9.'-]{2,}/g) || []).map((w) => w.replace(/'s$/, '').replace(/^['.-]+|['.-]+$/g, '')).filter((w) => w.length > 3 && !PLAIN.has(w)));
const shared = (a, b) => { let n = 0; for (const w of a) if (b.has(w)) n++; return n; };

/** the repo's pull requests (same repo only, never a fork's), newest first, from GitHub's public API with a short timeout; null when it cannot be read. */
export async function fetchPulls(fetchFn, { ms = 1500 } = {}) {
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    const r = await fetchFn('https://api.github.com/repos/' + REPO + '/pulls?state=all&per_page=60&sort=updated&direction=desc', { headers: { accept: 'application/vnd.github+json', 'user-agent': 'verse-own-card' }, signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const list = await r.json();
    if (!Array.isArray(list)) return null;
    return list.filter((p) => p && p.head && p.head.repo && p.head.repo.full_name === REPO).map((p) => ({ number: p.number, title: clean(p.title, 160), state: p.merged_at ? 'merged' : p.state === 'open' ? 'open' : 'closed', merged_at: p.merged_at || null, updated_at: p.updated_at || '', draft: !!p.draft }));
  } catch (_) { return null; }
}

/** one fix's status: live (in my deployed commits, or merged before them), pending (an open PR, or merged and not yet deployed), or not started. Pure. */
export function fixStatus(text, { commits = [], pulls = null } = {}) {
  const w = wordsOf(text), need = (t) => { const o = wordsOf(t), k = shared(w, o); return k >= 2 && k / Math.min(w.size, o.size) >= 0.34; }; // two shared words are not enough when one side is long
  const live = (Array.isArray(commits) ? commits : []).find((c) => need(c.subject));
  const newest = (Array.isArray(commits) && commits[0] && commits[0].at) || '';
  const pr = (pulls || []).filter((p) => p.state !== 'closed' && need(p.title)).sort((a, b) => shared(w, wordsOf(b.title)) - shared(w, wordsOf(a.title)))[0];
  if (pr && pr.state === 'merged' && (live || (newest && pr.merged_at <= newest) || (commits || []).some((c) => c.subject === pr.title))) return { state: 'live', pr: pr.number };
  if (live) return { state: 'live', pr: pr ? pr.number : null };
  if (pr) return { state: 'pending', pr: pr.number, merged: pr.state === 'merged' };
  return { state: pulls ? 'not started' : 'unknown' };
}

const short = (t, n = 110) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); if (s.length <= n) return s.replace(/[.]$/, ''); const cut = s.slice(0, n), at = Math.max(cut.lastIndexOf(', '), cut.lastIndexOf('. '), cut.lastIndexOf('; ')); return (at > 30 ? cut.slice(0, at) : cut.slice(0, cut.lastIndexOf(' '))).replace(/[.,;]$/, '').trim(); };
const said = (s) => s.state === 'live' ? 'live' + (s.pr ? ' (#' + s.pr + ')' : '') : s.state === 'pending' ? (s.merged ? 'merged in #' + s.pr + ', not yet deployed' : 'pending in PR #' + s.pr) : s.state === 'not started' ? 'not started: no commit or pull request in my repo holds it' : 'not in my deployed code; I could not read the pull requests just now';

// a pull request that is about my answer cards (its title says so), for a note that counts fixes without naming them
const CARD_WORK = /\b(?:answer\s+cards?|own\s+card|card\s+notes?|notes?\s+about\s+my\s+own\s+card)\b/i;
const statusOfPull = (p, commits) => {
  const newest = (Array.isArray(commits) && commits[0] && commits[0].at) || '';
  if (p.state === 'merged') return (commits || []).some((c) => c.subject === p.title) || (newest && p.merged_at <= newest) ? 'live (#' + p.number + ')' : 'merged in #' + p.number + ', not yet deployed';
  return 'pending in PR #' + p.number;
};

/** the "Fixes you named:" lines for a note: its own items, or the items of my visitor's note before it when the count matches, or, for a
 * count with no names, the pull requests about my answer cards and where each stands. Pure. */
export function fixLines(note, { commits = [], pulls = null, prior = [] } = {}) {
  let { count, items } = namedFixes(note);
  if (!items.length) for (const p of prior) { const f = namedFixes(p.note); if (f.items.length && (!count || f.items.length === count)) { items = f.items; break; } }
  if (!items.length && !count) return [];
  if (!items.length) {
    if (!pulls) return ['Your note counts ' + count + ' fixes but does not name them, and I could not read my pull requests just now, so I cannot say which are live.'];
    const work = pulls.filter((p) => p.state !== 'closed' && CARD_WORK.test(p.title)).slice(0, count);
    if (!work.length) return ['Your note counts ' + count + ' fixes but does not name them, and no pull request about my answer cards is open or merged, so none of them is started in my repo.'];
    return ['Your note counts ' + count + ' fixes but does not name them. The pull requests about my answer cards:', ...work.map((p) => short(p.title) + ': ' + statusOfPull(p, commits) + '.')];
  }
  return items.map((it) => ORD[it.n - 1].replace(/^./, (c) => c.toUpperCase()) + ' (' + short(it.text) + '): ' + said(fixStatus(it.text, { commits, pulls })) + '.');
}

// a lead sentence that the note gives no reason for: a denial, an apology, blame for what another site did, or the gemma date when the note
// does not question it (card 2: "I did not take blame for the site's block"; card 3: "My record shows the gemma move was 2026-10-25")
const DENY = /^(?:but\s+)?i\s+(?:did\s+not|didn't|do\s+not|don't|never|have\s+not|haven't|was\s+not|wasn't)\b/i;
const SORRY = /\b(?:sorry|apologi[sz]e|apologies|my\s+fault|my\s+mistake)\b|\bI\s+(?:own|take|accept)\s+(?:the\s+|full\s+)?(?:fault|blame|responsibility)\b/i;
const OUTSIDE = /\b(?:turned|turns|turn)\b[^.]*\baway\b|\bblock(?:ed|s)?\b|\brefus\w+\b|\brate[- ]limit\w*\b|\bcaptcha\b/i;
const GEMMA = /\bgemma\b|\bgpt-oss\b|\bmodel\s+move\b|\b630e666/i;
const DATE = /\b\d{4}-\d\d-\d\d\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}\b/i;
const META = /\b(?:old\s+code|does\s+not\s+yet|cannot\s+yet|can't\s+yet|is\s+not\s+yet\s+live|not\s+live\s+yet)\b/i;

/** the model's lead with the sentences the note gave no reason for taken out, and "my own X" put right when the X were the site's. Pure. */
export function guardLead(lead, note) {
  const n = String(note || '');
  const site = (/\b([a-z0-9-]+\.(?:com|net|org|io|co|app|dev|ai))\b/i.exec(n) || [])[1] || '';
  const sitesOwn = /\b(?:its|the\s+site'?s|site'?s)\s+(?:own\s+)?(numbers|scores|data|figures|measures)\b|\bnot\s+(?:my|verse'?s)\s+own\b/i.exec(n);
  const asksGemma = GEMMA.test(n) || DATE.test(n);
  const keep = [];
  for (let s of sentences(String(lead || '').split(/\n\s*(?:Fixed|Still open|Fixes you named):/i)[0])) {
    if (DENY.test(s) && !(asksGemma && DATE.test(s))) continue;
    if (SORRY.test(s)) continue;
    if (/\b(?:fault|blame)\b/i.test(s) && OUTSIDE.test(s)) continue;
    if ((GEMMA.test(s) || /\bmy record shows\b/i.test(s) && DATE.test(s)) && !asksGemma) continue;
    if (META.test(s)) continue; // the card cannot see which code it runs on; that is for the thread to report
    if (site && sitesOwn) s = s.replace(/\b(?:my|verse'?s)\s+own\s+(numbers|scores|data|figures|measures)\b/gi, site + "'s own $1");
    keep.push(s);
  }
  return keep.join(' ').trim();
}

/** what the note quotes or says my earlier card said, checked against my stored earlier cards: owned when it is there, never denied. Pure. */
export function quoteLines(note, prior = []) {
  const cards = (prior || []).map((p) => String(p.card || '')).filter(Boolean);
  if (!cards.length) return [];
  const n = String(note || ''), out = [], seen = new Set();
  for (const m of n.matchAll(/["“]([^"“”]{3,140})["”]/g)) {
    const q = m[1].trim(), k = q.toLowerCase();
    if (seen.has(k)) continue; seen.add(k);
    if (cards.some((c) => c.toLowerCase().includes(k))) out.push('My earlier card did say "' + q + '", and that was wrong.');
  }
  if (/\bblame\b|\bowned?\s+the\s+fault\b/i.test(n)) { // "took blame", "denies the blame its previous card took"
    const c = cards.find((x) => SORRY.test(x) && OUTSIDE.test(x));
    if (c) { const site = (/\b([a-z0-9-]+\.(?:com|net|org|io|co|app|dev|ai))\b/i.exec(c) || [])[1]; out.push('My earlier card did take blame for ' + (site ? site + "'s" : 'the site\'s') + ' block. That block was ' + (site || 'the site') + "'s choice, not a fault of mine, and I do not try to get past it."); }
  }
  return out;
}

/** a Fixed list sorted newest first by its leading date (the gemma row is no longer last). Pure. */
export const newestFirst = (rows) => rows.map((r, i) => ({ r, i, d: (/^(\d{4}-\d\d-\d\d)/.exec(r) || [])[1] || '' })).sort((a, b) => (a.d === b.d ? a.i - b.i : a.d < b.d ? 1 : -1)).map((x) => x.r);

/** the whole card body for a note about my own card: the guarded lead, quote checks, the fix statuses, then Fixed (when the note names no fixes) and Still open. Pure. */
export function ownCardAnswer(lead, note, { lists = { fixed: [], open: [] }, commits = [], pulls = null, prior = [] } = {}) {
  const quotes = quoteLines(note, prior), fixes = fixLines(note, { commits, pulls, prior });
  let top = guardLead(lead, note);
  if (!top) top = fixes.length ? 'Here is where each fix from your note stands.' : 'You are right about my last card.';
  const parts = [top];
  if (quotes.length) parts.push(quotes.join(' '));
  if (fixes.length) parts.push('Fixes you named:\n' + fixes.join('\n'));
  else if (lists.fixed.length) parts.push('Fixed:\n' + newestFirst(lists.fixed).join('\n'));
  if (lists.open.length) parts.push('Still open:\n' + lists.open.join('\n'));
  return parts.join('\n\n');
}

/** the card a note was answered with, kept so the next note can be checked against it: newest first, at most 8. Pure. */
export const keptCards = (old, note, card, at) => [{ at, note: String(note || '').slice(0, 2000), card: String(card || '').slice(0, 4000) }, ...(Array.isArray(old) ? old : [])].slice(0, 8);
