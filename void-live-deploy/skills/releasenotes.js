/**
 * releasenotes skill — write release notes from your own commits (domains/void.assimilate.md, ask "write release notes
 * for my repo": drafts notes; posting anywhere waits for the confirm line, so this card only drafts and copies).
 * "write release notes for v1.4.0" then paste `git log --oneline` output, commit messages or PR titles (or paste them
 * after the ask). Each line is sorted under Keep a Changelog 1.1.0 headings (Added, Changed, Deprecated, Removed,
 * Fixed, Security), read from Conventional Commits 1.0.0 prefixes (feat, fix, perf, refactor, docs …, "!" or
 * BREAKING CHANGE for breaking) and, when a line has no prefix, from its first word (add, fix, remove, deprecate …).
 * Breaking changes go first; merge commits and version bumps are left out. Live Markdown to copy; nothing is sent.
 */
const CLEAN = (s) => String(s || '').trim().replace(/\s+/g, ' ');
const ASK_RE = /^(?:please\s+)?(?:(?:help\s+me\s+)?(?:write|draft|make|create|generate|do)\s+(?:me\s+)?(?:the\s+|some\s+|a\s+)?)?(?:release\s+notes?|change\s?log|changelog\s+entry|what'?s\s+new\s+notes)(?:\s+(?:for|from)\s+(?:my\s+|our\s+|the\s+|this\s+|these\s+)?(?:(v?\d+(?:\.\d+){1,3}(?:-[\w.]+)?)|repo(?:sitory)?|project|commits|release|prs?|pull\s+requests))?(?:\s+(?:for|from)\s+(?:my\s+|our\s+|the\s+|these\s+)?(?:repo(?:sitory)?|commits|prs?))?\s*(?::\s*)?$/i;

/** { version, lines } for a release-notes ask (lines pasted after it, split on newlines or ⏎), else null. */
export function releaseNotesOf(text) {
  const parts = String(text || '').split(/\n|\s*⏎\s*/), head = CLEAN(parts[0]).replace(/[?!.]+$/, '');
  const colon = head.indexOf(':'), first = colon > 0 && !ASK_RE.test(head) ? head.slice(0, colon) : head, rest = colon > 0 && !ASK_RE.test(head) ? head.slice(colon + 1) : '';
  const m = ASK_RE.exec(first);
  if (!m) return null;
  const lines = [rest].concat(parts.slice(1)).map((l) => l.trim()).filter(Boolean);
  return { version: m[1] || '', lines };
}

export const SECTIONS = ['Breaking changes', 'Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security'];
const TYPE = { feat: 'Added', feature: 'Added', fix: 'Fixed', bugfix: 'Fixed', hotfix: 'Fixed', perf: 'Changed', refactor: 'Changed', revert: 'Changed', docs: 'Changed', style: 'Changed', build: 'Changed', ci: 'Changed', chore: 'Changed', test: 'Changed', security: 'Security', deprecate: 'Deprecated', remove: 'Removed' };
const SKIP = /^(?:merge\s+(?:pull\s+request|branch|remote-tracking|tag)\b|bump\s+(?:version|to\s+v?\d)|(?:chore(?:\([^)]*\))?:\s*)?release\s+v?\d|v?\d+\.\d+\.\d+$|initial\s+commit$)/i;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** One line of history to { section, text, scope, breaking } (or null for a line release notes leave out). */
export function classify(line) {
  let s = CLEAN(line).replace(/^[-*•]\s+/, '').replace(/^[0-9a-f]{7,40}\s+/i, '').replace(/^\(([^)]*)\)\s+/, ''); // bullets, short hashes, "(HEAD -> main)" decorations
  if (!s || SKIP.test(s)) return null;
  let section = null, scope = '', breaking = /\bBREAKING[ -]CHANGE\b/.test(s);
  const cc = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/.exec(s);
  if (cc && (TYPE[cc[1].toLowerCase()] || /^[a-z]+$/.test(cc[1]))) {
    section = TYPE[cc[1].toLowerCase()] || 'Changed'; scope = cc[2] || ''; breaking = breaking || !!cc[3]; s = cc[4];
  }
  s = s.replace(/\s*BREAKING[ -]CHANGE:?\s*/g, ' ').trim();
  if (!s || /^v?\d+(?:\.\d+){1,3}(?:-[\w.]+)?$/.test(s) || (cc && /^release$/i.test(scope) && /^v?\d/.test(s))) return null; // "chore(release): v1.4.0"
  if (!section) { // no prefix: read the first word, the way people write commit subjects
    const w = s.toLowerCase();
    if (/\b(?:security|vulnerab\w*|cve-\d{4}-\d+|xss|csrf|injection)\b/.test(w)) section = 'Security';
    else if (/^(?:add|adds|added|new|introduce|introduces|support|supports|allow|allows|enable|enables|implement|implements|create|creates)\b/.test(w)) section = 'Added';
    else if (/^(?:fix|fixes|fixed|resolve|resolves|resolved|correct|corrects|patch|repair|handle)\b/.test(w)) section = 'Fixed';
    else if (/^(?:remove|removes|removed|drop|drops|dropped|delete|deletes|deleted)\b/.test(w)) section = 'Removed';
    else if (/^(?:deprecate|deprecates|deprecated)\b/.test(w)) section = 'Deprecated';
    else section = 'Changed';
  }
  return { section: breaking ? 'Breaking changes' : section, text: cap(s.replace(/\.$/, '')), scope, breaking };
}

/** The notes as Markdown: a heading with the version and date, then each non-empty section in Keep a Changelog order. */
export function notesMarkdown(lines, version, date) {
  const items = lines.map(classify).filter(Boolean), out = ['## ' + (version || 'Unreleased') + (date ? ' - ' + date : '')];
  for (const sec of SECTIONS) {
    const xs = items.filter((x) => x.section === sec); if (!xs.length) continue;
    out.push('', '### ' + sec); xs.forEach((x) => out.push('- ' + (x.scope ? '**' + x.scope + ':** ' : '') + x.text));
  }
  if (!items.length) out.push('', '_Paste commit messages or PR titles to fill this in._');
  return out.join('\n') + '\n';
}

const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const IN = 'font:inherit;color:inherit;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:5px 8px;box-sizing:border-box';

async function run(text, api) {
  const hit = releaseNotesOf(text);
  if (!hit) return 'none';
  const { showPage, esc } = api;
  showPage((p) => {
    p.innerHTML = '<h2>Release notes</h2><div class="sub">from your commits or PR titles · drafted here, posted nowhere</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0"><label style="display:flex;flex-direction:column;gap:2px;font-size:12px;color:#8a8a92">version<input data-v type="text" value="' + esc(hit.version) + '" placeholder="v1.4.0" style="' + IN + ';width:140px"></label>'
      + '<label style="display:flex;flex-direction:column;gap:2px;font-size:12px;color:#8a8a92">date<input data-d type="date" value="' + today() + '" style="' + IN + '"></label></div>'
      + '<label style="display:flex;flex-direction:column;gap:2px;font-size:12px;color:#8a8a92">commits or PR titles, one a line (git log --oneline works)<textarea data-l rows="6" spellcheck="false" style="' + IN + ';width:100%">' + esc(hit.lines.join('\n')) + '</textarea></label>'
      + '<div style="margin:12px 0 4px;display:flex;gap:8px;align-items:center"><b style="font-size:13px">Markdown</b><button type="button" data-copy>copy</button></div>'
      + '<pre class="rn-md" style="white-space:pre-wrap;font-size:12px;background:rgba(255,255,255,.03);border-radius:8px;padding:8px;margin:0"></pre>'
      + '<div class="src">Headings from <a href="https://keepachangelog.com/en/1.1.0/" target="_blank" rel="noopener">Keep a Changelog 1.1.0</a>; prefixes read as in <a href="https://www.conventionalcommits.org/en/v1.0.0/" target="_blank" rel="noopener">Conventional Commits 1.0.0</a>. Nothing here is sent or posted.</div>';
    const v = p.querySelector('[data-v]'), d = p.querySelector('[data-d]'), l = p.querySelector('[data-l]'), md = p.querySelector('.rn-md');
    const refresh = () => { md.textContent = notesMarkdown(l.value.split('\n'), v.value.trim(), d.value); };
    [v, d, l].forEach((x) => x.addEventListener('input', refresh));
    const c = p.querySelector('[data-copy]');
    c.addEventListener('click', async () => { let ok = false; try { await navigator.clipboard.writeText(md.textContent); ok = true; } catch (_) {} c.textContent = ok ? 'copied' : 'select it to copy'; setTimeout(() => { c.textContent = 'copy'; }, 1600); });
    refresh();
  });
  return 'releasenotes';
}

export default {
  name: 'releasenotes',
  examples: ['write release notes for my repo', 'release notes for v1.4.0', 'make a changelog', 'changelog from these commits', 'draft release notes'],
  nearMisses: ['what are release notes', 'iphone release notes', 'read the release notes', 'what is a changelog', 'notes'],
  releaseNotesOf,
  match(lower, text) { return !!releaseNotesOf(text); },
  run,
};
