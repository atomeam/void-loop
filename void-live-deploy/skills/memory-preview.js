/**
 * memory-preview skill — shows memory snippets from both server-side memory (remember that...)
 * and local memory graph (patterns, interests). Asked by Verse: "a 'memory-preview' UI component
 * to show memory snippets". "memory preview", "show my memory snippets", "what memories do I have",
 * "preview my memory". Summons a card with two sections: server facts and local patterns.
 */
import { sessionToken } from '../lib/state.js';
import { readGraph, patterns, GRAPH_KEY } from '../lib/memory-graph.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const PREVIEW_RE = /^(?:memory\s+preview|show\s+(?:my|the)\s+memory\s+(?:snippets?|preview)|what\s+(?:memories|memory)\s+(?:do\s+)?(?:i\s+)?have|preview\s+my\s+memory)$/;
const NO_KEY = 'What Verse remembers is for the owner and paid members. Unlock Verse first (unlock <key>, or sign in with your passkey), then ask again.';

function previewAskOf(text) {
  return PREVIEW_RE.test(CLEAN(text));
}

const CSS = `
.mp-card{font-size:13px}
.mp-section{margin-bottom:14px}
.mp-title{font-weight:700;margin:0 0 6px;display:flex;align-items:center;gap:8px}
.mp-count{font-weight:400;opacity:.6;font-size:12px}
.mp-list{display:grid;gap:4px}
.mp-item{padding:6px 8px;border:1px solid rgba(255,255,255,.1);border-radius:6px;background:rgba(255,255,255,.02)}
.mp-item:hover{background:rgba(255,255,255,.05)}
.mp-item .mp-fact{color:var(--fg)}
.mp-item .mp-meta{font-size:11px;opacity:.6;margin-top:2px}
.mp-empty{opacity:.5;font-size:12px;padding:8px}
.mp-refresh{margin-top:10px}
`;
function ensureStyle() { if (document.getElementById('mp-style')) return; const st = document.createElement('style'); st.id = 'mp-style'; st.textContent = CSS; document.head.append(st); }

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const day = (s) => String(s || '').slice(0, 10);

async function fetchServerMemory(tok) {
  if (!tok) return { facts: [], error: NO_KEY };
  try {
    const r = await fetch('/api/memory?view=export', { headers: { authorization: 'Bearer ' + tok } });
    if (!r.ok) return { facts: [], error: r.status === 401 ? 'Only the owner can read this.' : r.status === 403 ? 'Server memory is for paid members.' : r.status === 503 ? 'No database behind this copy of Verse.' : 'Memory answered ' + r.status + '.' };
    const data = await r.json();
    return { facts: data.items || [], error: null };
  } catch (e) {
    return { facts: [], error: 'Memory is out of reach right now.' };
  }
}

function localPatternsHtml(esc, p) {
  if (!p.on) return '<div class="mp-empty">Local patterns: off ("start remembering" to enable)</div>';
  if (!p.asks && !p.facts.length) return '<div class="mp-empty">Local patterns: nothing yet. Ask a few things and come back.</div>';
  let h = '<div class="mp-section"><h4 class="mp-title">Local patterns <span class="mp-count">' + esc(String(p.asks)) + ' ask' + (p.asks === 1 ? '' : 's') + (p.first ? ' since ' + esc(day(p.first)) : '') + '</span></h4>';
  if (p.interests.length) {
    h += '<div class="mp-list">' + p.interests.slice(0, 8).map((t) => '<div class="mp-item"><div class="mp-fact">' + esc(t.label) + '</div><div class="mp-meta">' + esc(t.n) + ' times · ' + esc(pct(t.conf)) + '% · skill: ' + esc(t.skill) + '</div></div>').join('') + '</div>';
  }
  if (p.facts.length) {
    h += '<h4 class="mp-title" style="margin-top:10px">You told me <span class="mp-count">' + p.facts.length + '</span></h4><div class="mp-list">' + p.facts.slice(0, 6).map((f) => '<div class="mp-item"><div class="mp-fact">' + esc(f) + '</div></div>').join('') + '</div>';
  }
  h += '</div>';
  return h;
}

function serverMemoryHtml(esc, facts, error) {
  if (error) return '<div class="mp-section"><h4 class="mp-title">Server memory</h4><div class="mp-empty">' + esc(error) + '</div></div>';
  if (!facts.length) return '<div class="mp-section"><h4 class="mp-title">Server memory</h4><div class="mp-empty">No remembered facts yet. Say "remember that ..." to add one.</div></div>';
  let h = '<div class="mp-section"><h4 class="mp-title">Server memory <span class="mp-count">' + facts.length + '</span></h4><div class="mp-list">';
  for (const f of facts.slice(0, 8)) {
    const name = f.name || f.summary || 'fact';
    h += '<div class="mp-item"><div class="mp-fact">' + esc(name) + '</div><div class="mp-meta">id: ' + esc(f.id || '') + '</div></div>';
  }
  h += '</div></div>';
  return h;
}

const pct = (c) => c == null ? '?' : Math.round(c * 100);

async function mount(api) {
  const { showPage, say } = api;
  ensureStyle();
  const tok = sessionToken();
  const local = patterns(readGraph(), Date.now());
  const { facts: serverFacts, error } = await fetchServerMemory(tok);
  const html = '<h2>Memory preview</h2>'
    + '<p class="sub">Snippets from both memory systems. Local = this browser; Server = your key on V01D.</p>'
    + localPatternsHtml(esc, local)
    + serverMemoryHtml(esc, serverFacts, error)
    + '<div class="mp-refresh"><button type="button" class="g-btn" data-action="refresh">Refresh</button></div>'
    + '<div class="src">Local: ' + esc(GRAPH_KEY) + ' (this browser only) · Server: your V01D memory</div>';
  const el = showPage((p) => { p.innerHTML = html; });
  if (!el) return 'memory-preview';
  const btn = el.querySelector('[data-action="refresh"]');
  if (btn) btn.addEventListener('click', () => mount(api));
  say('Memory preview · ' + local.asks + ' local asks, ' + serverFacts.length + ' server facts' + (error ? ' (server locked)' : ''));
  return 'memory-preview';
}

export function match(text) { return previewAskOf(text); }

export async function run(text, api) {
  return mount(api);
}

export default {
  name: 'memory-preview',
  examples: ['memory preview', 'show my memory snippets', 'what memories do I have', 'preview my memory'],
  nearMisses: ['what do you know about me', 'my patterns', 'what do you remember about the parser', 'remember that I like tea', 'export my memory'],
  match(lower, text) { return previewAskOf(text || lower); },
  run,
};