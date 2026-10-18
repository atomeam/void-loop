/**
 * repo skill - Verse can see a public GitHub repository (owner, 2026-10-17: "make v01d able to see repos"). "look at atomeam/void-loop",
 * "what is in github.com/x/y", a pasted repo link: a Verse card of what is really there (description, language mix, recent commits, top-level
 * files, README opening, open issue and PR counts) read live by /api/repo (functions/api/repo.js, lib/repo-look.js). Public repos only, no
 * token; a private or missing one says "I can only see public repos". Everything from the repo is untrusted text: the server cleans it, this
 * page escapes it, and no model ever reads it. Copy / save come with the card frame (lib/card-share.js).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { repoAsk, NAME_RE } from '../lib/repo-look.js';

const CSS = '.rp-sub{margin:2px 0 8px;opacity:.9}.rp-facts{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px;margin:6px 0}.rp-facts b{color:#f3efe2}'
  + '.rp-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;margin:8px 0 4px;background:rgba(255,255,255,.08)}.rp-bar i{display:block;height:100%}'
  + '.rp-leg{display:flex;flex-wrap:wrap;gap:2px 12px;font-size:12px;opacity:.85}.rp-leg span::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;background:var(--c)}'
  + '.rp-h{font-size:11px;letter-spacing:.1em;text-transform:uppercase;margin:12px 0 4px;opacity:.7}.rp-read{margin:4px 0;font-style:italic}'
  + '.rp-com{list-style:none;padding:0;margin:0;font-size:13px}.rp-com li{padding:2px 0;overflow-wrap:anywhere}.rp-com code{opacity:.7;margin-right:2px}'
  + '.rp-tree{display:flex;flex-wrap:wrap;gap:4px 6px}.rp-tree span{font-size:12px;padding:1px 7px;border:1px solid rgba(255,255,255,.18);border-radius:10px;overflow-wrap:anywhere}';
const HUES = ['#e8b04a', '#5fb3b3', '#c678dd', '#7fbf6a', '#e06c75', '#6aa0e8', '#8a8f9a'];

/** the card's inside from the server's facts. Items are joined with a space (a newline between commits) that the flex rows do not draw, so
 * the copied and saved card reads "JavaScript 0 stars 0 forks", not "JavaScript0 stars0 forks" (owner's pasted card, 2026-10-17). Everything typed by a stranger goes through esc. Pure but for esc. */
export function repoHtml(esc, r) {
  const n = (v, w) => (v == null ? '' : '<span><b>' + esc(v) + '</b> ' + w + '</span>');
  const safe = NAME_RE.test(String(r.name || '')) ? 'https://github.com/' + r.name : '';
  return (r.description ? '<p class="rp-sub">' + esc(r.description) + '</p>' : '')
    + '\n' + '<div class="rp-facts">' + [r.language && '<span>' + esc(r.language) + '</span>', n(r.stars, 'stars'), n(r.forks, 'forks'), n(r.openIssues, 'open issues'), n(r.openPulls, 'open PRs'), r.license && '<span>' + esc(r.license) + '</span>', r.pushed && '<span>pushed ' + esc(r.pushed) + '</span>', r.archived && '<span>archived</span>'].filter(Boolean).join(' ') + '</div>'
    + '\n' + (r.langs && r.langs.length ? '<div class="rp-bar" role="img" aria-label="language mix">' + r.langs.map((l, i) => '<i style="width:' + Math.max(1, +l.pct || 0) + '%;background:' + HUES[i % HUES.length] + '"></i>').join('') + '</div>\n<div class="rp-leg">' + r.langs.map((l, i) => '<span style="--c:' + HUES[i % HUES.length] + '">' + esc(l.name) + ' ' + esc(l.pct) + '%</span>').join(' ') + '</div>' : '')
    + '\n' + (r.readme ? '<div class="rp-h">README</div>\n<p class="rp-read">' + esc(r.readme) + '</p>' : '')
    + '\n' + (r.commits && r.commits.length ? '<div class="rp-h">Recent commits</div>\n<ul class="rp-com">' + r.commits.map((c) => '<li><code>' + esc(c.sha) + '</code> ' + esc(c.msg) + (c.who ? ' <small>' + esc(c.who) + (c.date ? ', ' + esc(c.date) : '') + '</small>' : '') + '</li>').join('\n') + '</ul>' : '')
    + '\n' + (r.tree && r.tree.length ? '<div class="rp-h">Top level</div>\n<div class="rp-tree">' + r.tree.map((f) => '<span>' + esc(f.name + (f.dir ? '/' : '')) + '</span>').join(' ') + (r.treeTotal > r.tree.length ? '<span>…</span>' : '') + '</div>' : '')
    + '\n' + '<div class="src">Source: ' + (safe ? '<a href="' + esc(safe) + '" target="_blank" rel="noopener noreferrer">' + esc(r.name) + ' on GitHub</a>' : 'GitHub') + ' · public repos only · read live from the GitHub API, no sign-in</div>';
}

const ownOf = (r) => ({ chapter: 'code', typeLine: 'Repository — ' + (r.language || 'GitHub'), cost: 0, power: (r.langs || []).length, resistance: r.treeTotal || 0, income: 0, adds: 'What is really in a public GitHub repo, read live.', name: String(r.name || '').split('/')[1] || r.name });

async function run(text, api) {
  const full = repoAsk(text); if (!full) return 'none';
  const { showPage, esc } = api;
  let body;
  const el = showPage((p) => {
    p.dataset.cardOwn = JSON.stringify({ chapter: 'code', typeLine: 'Repository — looking', adds: 'What is really in a public GitHub repo, read live.', name: full.split('/')[1] });
    p.innerHTML = '<style>' + CSS + '</style><h2></h2><div class="rp-body"><p>Looking at ' + esc(full) + '…</p></div>';
    p.querySelector('h2').textContent = full; body = p.querySelector('.rp-body');
  });
  let got = null;
  const ctl = typeof AbortController === 'function' ? new AbortController() : null, timer = ctl ? setTimeout(() => ctl.abort(), 25000) : 0;
  try { const res = await fetch('/api/repo?r=' + encodeURIComponent(full), { signal: ctl ? ctl.signal : undefined }); got = await res.json(); } catch (_) { got = null; } finally { clearTimeout(timer); }
  if (!el.isConnected) return 'repo';
  if (got && got.ok && got.repo) {
    el.dataset.cardOwn = JSON.stringify(ownOf(got.repo)); el.querySelector('h2').textContent = got.repo.name; body.innerHTML = repoHtml(esc, got.repo);
  } else {
    el.dataset.cardOwn = JSON.stringify({ chapter: 'code', typeLine: 'Repository — not seen', adds: 'I can only see public repos.', name: full.split('/')[1] });
    body.innerHTML = '<p>' + esc((got && got.say) || 'I could not reach GitHub just now. Try again in a minute.') + '</p>';
  }
  return 'repo';
}

export default {
  name: 'repo',
  repoAsk,
  examples: [
    'look at atomeam/void-loop',
    'what is in github.com/atomeam/void-loop',
    'https://github.com/atomeam/void-loop',
    'show me the repo torvalds/linux',
  ],
  nearMisses: [
    'add a link https://github.com/atomeam',
    'look at the sky',
    'look at and/or',
    'what is in 24/7',
    'look at report/final.pdf',
  ],
  match(lower, text) { return !!repoAsk(text || lower); },
  run,
};
