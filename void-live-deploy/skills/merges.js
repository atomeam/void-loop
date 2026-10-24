/**
 * merges skill — the merge log (asked by Verse, ask-20261015-1610-2: "a 'merge-log' card on the stage that shows a live feed of what
 * the bot just merged and why"). "what did you merge", "merge log", "what merged lately": the newest pull requests merged into
 * atomeam/void-loop, read from GitHub's public API (the repo is public, so anyone may look): number, title, when, and how it got
 * in (automerge, made by Verse, or by hand). The card keeps itself live (skills/live.js, every 5 minutes) while it is up.
 * Nothing about the visitor is sent; GitHub sees one anonymous request.
 */
import { keepLive } from './live.js';
import { hardenedLine } from './showcase.js';

export const REPO = 'atomeam/void-loop', EVERY = 5 * 60e3, SHOW = 10;
const ASK = /^(?:(?:show|open)\s+(?:me\s+)?)?(?:the\s+)?(?:merge\s+log|merge\s+feed|recent\s+merges|latest\s+merges)$|^what\s+(?:did\s+(?:you|the\s+bot|(?:verse|v01d))|got|has\s+been|was)\s+merged?(?:\s+(?:today|lately|recently|this\s+week))?$|^what\s+merged(?:\s+(?:today|lately|recently|this\s+week))?$/;

export function mergesAsk(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return ASK.test(t);
}

/** GitHub's closed pull requests -> the merged ones, newest first, with how each got in. Pure. */
/** a pull request's title as the log shows it: Verse's own upgrades say what got better, never "hardens itself", and a cycle that added nothing
 *  is not shown at all (owner, 2026-10-24: "there should be no self hardening, it needs to say exactly what upgrades"; "nothing should be
 *  empty"). Titles from before grow-self named the upgrade read "Verse hardens itself: ...". null for one to leave out. Pure. */
export function plainTitle(title) {
  const t = String(title || '').replace(/\s+/g, ' ').trim(), m = /^(?:Verse|V01D) hardens itself:\s*(.+)$/i.exec(t);
  if (!m) return t;
  if (/^nothing to add\b/i.test(m[1])) return null;
  const line = hardenedLine('Verse hardened itself: ' + m[1]);
  return line ? line.replace(/\b1 more ways\b/, '1 more way') : t;
}

export function mergedOf(prs, n = SHOW) {
  return (Array.isArray(prs) ? prs : []).filter((p) => p && p.merged_at && typeof p.number === 'number' && plainTitle(p.title) !== null)
    .sort((a, b) => String(b.merged_at).localeCompare(String(a.merged_at))).slice(0, n)
    .map((p) => { const labels = (p.labels || []).map((l) => (l && l.name) || '');
      return { number: p.number, title: plainTitle(p.title).slice(0, 200), at: String(p.merged_at).slice(0, 16).replace('T', ' '), url: /^https:\/\/github\.com\//.test(String(p.html_url || '')) ? p.html_url : 'https://github.com/' + REPO + '/pull/' + p.number,
        how: labels.includes('made by Verse') ? 'made by Verse' + (labels.includes('automerge') ? ', merged itself' : ', approved by the owner') : labels.includes('automerge') ? 'merged itself on Verse\'s review' : 'merged by hand' }; });
}

/** the card's list. Pure. */
export const mergesHtml = (esc, rows) => (rows.length ? '<ul style="padding-left:18px">' + rows.map((r) => '<li><a href="' + esc(r.url) + '" target="_blank" rel="noopener">#' + esc(r.number) + '</a> ' + esc(r.title) + ' <span class="sub">· ' + esc(r.at) + ' UTC · ' + esc(r.how) + '</span></li>').join('') + '</ul>' : '<p>Nothing merged lately.</p>');

async function run(text, api) {
  if (!mergesAsk(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Merge log</h2><div class="sub">reading GitHub…</div>'; });
  const body = document.createElement('div'); el.appendChild(body);
  const read = async () => {
    try {
      const r = await fetch('https://api.github.com/repos/' + REPO + '/pulls?state=closed&sort=updated&direction=desc&per_page=30', { headers: { accept: 'application/vnd.github+json' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const rows = mergedOf(await r.json());
      if (!el.isConnected) return;
      el.querySelector('.sub').textContent = 'the newest pull requests merged into ' + REPO + ', and how each got in';
      body.innerHTML = mergesHtml(esc, rows) + '<div class="src">Source: <a href="https://github.com/' + REPO + '/pulls?q=is%3Apr+is%3Amerged" target="_blank" rel="noopener">GitHub</a> · a bot merges a labelled pull request once the suite and Verse\'s review pass; verify.yml takes back what breaks main.</div>';
    } catch (_) { if (el.isConnected) body.innerHTML = '<p>GitHub did not answer just now. Ask again in a moment.</p>'; }
  };
  await read();
  keepLive({}, el, { name: 'merges', every: EVERY, refresh: read, present: () => el.isConnected });
  return 'merges';
}

export default {
  name: 'merges',
  mergesAsk,
  examples: ['what did you merge', 'merge log', 'what merged lately', 'recent merges'],
  nearMisses: ['merge these cells', 'git merge conflict', 'merge two pdfs', 'how do I merge branches', 'merge sort', 'mail merge'],
  match(lower, text) { return mergesAsk(text); },
  run,
};
