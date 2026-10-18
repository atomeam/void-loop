/**
 * v01d-fixes skill — the owner previews the fixes Verse's own model opened (owner, 2026-10-16: "confidence > 0.8 might auto-merge,
 * < 0.8 diff-preview for Adam"; lib/v01d-fixes.js). The card lists the open pull requests labelled "made by Verse", the ones that
 * wait for the owner first: Verse's confidence, the file and lines it changes, its reason, and the changed lines themselves; Approve
 * (owner only, /api/v01d-fixes) lets a waiting one merge once Verse's review is clean. Read from GitHub's public API; owner-only:
 * without the owner's key the card says so and fetches nothing.
 * "Verse's fixes", "show Verse's fixes", "fixes waiting for me", "what fixes did Verse propose".
 */
import { REPO, fixesOf, diffLines } from '../lib/v01d-fixes.js';

const OWNER_KEY = 'a2m.void.owner.v1';
const ownerToken = () => { try { return localStorage.getItem(OWNER_KEY) || ''; } catch (_) { return ''; } };
const GH = 'https://api.github.com/repos/' + REPO;

export function fixesAsk(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:show|list|open)\s+(?:me\s+)?)?(?:v01d'?s|void'?s|verse'?s|your)\s+(?:own\s+)?(?:fixes|proposed fixes|fix proposals|pull requests)$/.test(t)
    || /^(?:what|which)\s+fixes\s+(?:did|has)\s+(?:v01d|void|verse|you)\s+propos(?:e|ed)$/.test(t)
    || /^(?:(?:v01d|verse)\s+)?fixes\s+(?:waiting|that wait)\s+(?:for|on)\s+me$/.test(t);
}

// the changed files of one pull request, from GitHub's public API
const readFiles = (n) => fetch(GH + '/pulls/' + n + '/files', { headers: { accept: 'application/vnd.github+json' } });

async function run(text, api) {
  if (!fixesAsk(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Verse\'s fixes</h2><div class="sub">…</div>'; });
  const tok = ownerToken();
  if (!tok) { el.innerHTML = '<h2>Verse\'s fixes</h2><p>Only my owner reviews the fixes I propose.</p>'; return 'v01d-fixes'; }
  let prs = null;
  try { const r = await fetch(GH + '/pulls?state=open&per_page=30', { headers: { accept: 'application/vnd.github+json' } }); prs = r.ok ? await r.json() : null; } catch (_) {}
  if (!el.isConnected) return 'v01d-fixes';
  if (!Array.isArray(prs)) { el.innerHTML = '<h2>Verse\'s fixes</h2><p>GitHub did not answer just now. Ask again in a moment.</p>'; return 'v01d-fixes'; }
  const fixes = fixesOf(prs);
  const pct = (c) => (c === null ? 'no confidence given' : 'confidence ' + c.toFixed(2));
  el.innerHTML = '<h2>Verse\'s fixes</h2><div class="sub">' + (fixes.length ? fixes.length + ' open · ' + fixes.filter((f) => f.waits).length + ' waiting for you (Verse was under 0.8 sure)' : 'None open: every fix I proposed has merged or been closed.') + '</div>'
    + fixes.map((f) => '<div class="vfix" data-pr="' + esc(f.number) + '" style="margin:12px 0;padding-top:10px;border-top:1px solid rgba(255,255,255,.1)">'
      + '<div><a href="' + esc(f.url) + '" target="_blank" rel="noopener">#' + esc(f.number) + '</a> ' + esc(f.title) + '</div>'
      + '<div class="sub">' + esc(pct(f.confidence)) + (f.where ? ' · ' + esc(f.where) : '') + ' · ' + (f.draft ? 'a draft on the board, not asking to merge' : f.waits ? 'waits for you' : f.merges ? 'merges itself on review' : 'open') + '</div>'
      + (f.risk ? '<div class="sub vfix-risk" data-risk="' + esc(f.risk) + '"' + (f.risk === 'high' ? ' style="color:#ffb347"' : '') + '>' + (f.risk === 'high' ? 'High-impact change: ' : 'Risk ' + esc(f.risk) + ': ') + esc(f.riskWhy || '') + '</div>' : '')
      + (f.why ? '<p style="margin:6px 0">' + esc(f.why) + '</p>' : '')
      + '<pre class="vfix-diff" style="white-space:pre-wrap;word-break:break-word;background:rgba(255,255,255,.06);padding:8px 10px;border-radius:8px;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace">…</pre>'
      + (f.waits ? '<p><button type="button" class="tr-copy" data-approve="' + esc(f.number) + '">Approve</button> <span class="vfix-said sub"></span></p>' : '')
      + '</div>').join('');
  // the changed lines, one pull request at a time (GitHub's public API; at most the first five)
  for (const f of fixes.slice(0, 5)) {
    const box = el.querySelector('.vfix[data-pr="' + f.number + '"] .vfix-diff'); if (!box) continue;
    try { const r = await readFiles(f.number); const files = r.ok ? await r.json() : null; // void-review: ok: a GitHub API read for each of at most five pull requests, not a database query
      box.textContent = files ? diffLines(files).join('\n') || '(no changed lines)' : 'the diff did not load'; }
    catch (_) { box.textContent = 'the diff did not load'; }
  }
  for (const f of fixes.slice(5)) { const box = el.querySelector('.vfix[data-pr="' + f.number + '"] .vfix-diff'); if (box) box.textContent = 'open it on GitHub to see the diff'; }
  el.addEventListener('click', async (e) => {
    const b = e.target.closest && e.target.closest('button[data-approve]'); if (!b || b.disabled) return;
    const n = Number(b.dataset.approve), said = b.parentElement.querySelector('.vfix-said');
    b.disabled = true; b.textContent = '…';
    try {
      const r = await fetch('/api/v01d-fixes', { method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify({ pr: n, op: 'approve' }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { b.textContent = 'Approved'; said.textContent = 'it merges once Void\'s review is clean'; }
      else { b.textContent = 'Approve'; b.disabled = false; said.textContent = r.status === 503 ? 'approve it on GitHub: this site has no GitHub key' : (j.error || 'that did not work just now'); }
    } catch (_) { b.textContent = 'Approve'; b.disabled = false; said.textContent = 'that did not work just now'; }
  });
  return 'v01d-fixes';
}

export default {
  name: 'v01d-fixes',
  fixesAsk,
  examples: ["Verse's fixes", "show Verse's fixes", 'fixes waiting for me', 'what fixes did Verse propose'],
  nearMisses: ['fix my code', 'fix this', 'my fixes', 'quick fixes for a leaky tap', 'show my pull requests', 'how do I fix a webhook'],
  match(lower, text) { return fixesAsk(text); },
  run,
};
