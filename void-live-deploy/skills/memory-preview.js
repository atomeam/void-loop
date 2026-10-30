/**
 * memory-preview skill — a snippets card of what Verse keeps about you, in both stores at once: the local memory graph
 * (interests and "you told me" lines, this browser only) and the server's remembered records. Asked by Verse:
 * "Implement a 'memory-preview' UI component to allow users to see memory snippets" (ask-20261020-2131-2).
 * "memory preview", "show my memory snippets", "what memories do I have", "show what you remember about me", "peek at my memories".
 * Not this: "preview my memory" / "what's in my memory export" is the export's own look (skills/memory-graph.js, asked by Verse 2026-10-18),
 * and "what did I build with react" is the answer (skills/memory.js). A store that will not open is said plainly, never thrown.
 */
import { sessionToken } from '../lib/state.js';
import { readGraph, patterns, GRAPH_KEY } from '../lib/memory-graph.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
/** snippet-flavoured wordings only: "preview my memory" belongs to memory-graph's export look (kept out, so the two never race). */
const PREVIEW_RE = /^(?:memory\s+preview|show\s+(?:my|the)\s+memory\s+snippets?|what\s+(?:memories|memory)\s+(?:do\s+)?(?:i\s+)?have|show\s+(?:what|everything)\s+(?:you|verse)\s+remembers?\s+about\s+me|peek\s+at\s+(?:my|the)\s+memories?)$/;
const NO_KEY = 'What Verse remembers is for the owner and paid members. Unlock Verse first (unlock <key>, or sign in with your passkey), then ask again.';

export function previewAskOf(text) {
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

const day = (s) => String(s || '').slice(0, 10);
const pct = (c) => (c == null ? '?' : Math.round(c * 100));

/** /api/memory?view=export answers { records: [...] }; a record is one remembered project. Pure given the parsed body. */
export function serverRecords(data) {
  const rows = (data && (data.records || data.items)) || [];
  return Array.isArray(rows) ? rows : [];
}

async function fetchServerMemory(tok) {
  if (!tok) return { records: [], error: NO_KEY };
  try {
    const r = await fetch('/api/memory?view=export', { headers: { authorization: 'Bearer ' + tok } });
    if (!r.ok) return { records: [], error: r.status === 401 ? 'Only the owner can read this.' : r.status === 403 ? 'Server memory is for paid members.' : r.status === 503 ? 'No database behind this copy of Verse.' : 'Memory answered ' + r.status + '.' };
    return { records: serverRecords(await r.json()), error: null };
  } catch (_) {
    return { records: [], error: 'Memory is out of reach right now.' };
  }
}

function localHtml(esc, p) {
  if (!p.on) return '<div class="mp-section"><h4 class="mp-title">Local patterns</h4><div class="mp-empty">Off. Say "start remembering" to keep them on this device.</div></div>';
  if (!p.asks && !p.facts.length) return '<div class="mp-section"><h4 class="mp-title">Local patterns</h4><div class="mp-empty">Nothing yet on this device. Ask a few things and come back.</div></div>';
  let h = '<div class="mp-section"><h4 class="mp-title">Local patterns <span class="mp-count">' + esc(String(p.asks)) + ' ask' + (p.asks === 1 ? '' : 's') + (p.first ? ' since ' + esc(day(p.first)) : '') + '</span></h4>';
  if (p.interests.length) {
    h += '<div class="mp-list">' + p.interests.slice(0, 8).map((t) => '<div class="mp-item"><div class="mp-fact">' + esc(t.label) + '</div><div class="mp-meta">' + esc(String(t.n)) + ' times · ' + esc(String(pct(t.conf))) + '% · skill: ' + esc(t.skill) + '</div></div>').join('') + '</div>';
  }
  if (p.facts.length) {
    h += '<h4 class="mp-title" style="margin-top:10px">You told me <span class="mp-count">' + p.facts.length + '</span></h4><div class="mp-list">' + p.facts.slice(0, 6).map((f) => '<div class="mp-item"><div class="mp-fact">' + esc(f) + '</div></div>').join('') + '</div>';
  }
  return h + '</div>';
}

function serverHtml(esc, records, error) {
  if (error) return '<div class="mp-section"><h4 class="mp-title">Server memory</h4><div class="mp-empty">' + esc(error) + '</div></div>';
  if (!records.length) return '<div class="mp-section"><h4 class="mp-title">Server memory</h4><div class="mp-empty">Nothing kept on the server yet. Say "remember that ..." to add a line.</div></div>';
  let h = '<div class="mp-section"><h4 class="mp-title">Server memory <span class="mp-count">' + records.length + '</span></h4><div class="mp-list">';
  for (const rec of records.slice(0, 8)) {
    const head = rec.name || rec.summary || 'a record';
    h += '<div class="mp-item"><div class="mp-fact">' + esc(head) + '</div><div class="mp-meta">'
      + (rec.kind ? esc(rec.kind) + ' · ' : '') + (rec.updated ? 'updated ' + esc(day(rec.updated)) : '') + '</div></div>';
  }
  return h + '</div></div>';
}

/** the whole card's markup, given what each store answered. Pure; every value is escaped. */
export function previewHtml(esc, local, server) {
  return '<h2>Memory preview</h2>'
    + '<p class="sub">Snippets from both stores. Local = this browser only; Server = your key on Verse.</p>'
    + localHtml(esc, local)
    + serverHtml(esc, server.records, server.error)
    + '<div class="mp-refresh"><button type="button" class="g-btn" data-action="refresh">Refresh</button></div>'
    + '<div class="src">Local: ' + esc(GRAPH_KEY) + ' (this browser only) · Server: /api/memory?view=export</div>';
}

async function mount(api) {
  const { showPage, say, esc } = api;
  ensureStyle();
  const local = patterns(readGraph(), Date.now());
  const server = await fetchServerMemory(sessionToken());
  const el = showPage((p) => { p.innerHTML = previewHtml(esc || ((s) => String(s || '')), local, server); });
  if (el) {
    const btn = el.querySelector('[data-action="refresh"]');
    if (btn) btn.addEventListener('click', () => { mount(api); });
  }
  say('Memory preview · ' + local.asks + ' local asks, ' + server.records.length + ' server records' + (server.error ? ' (server locked)' : ''));
  return 'memory-preview';
}

export default {
  name: 'memory-preview',
  previewAskOf,
  examples: ['memory preview', 'show my memory snippets', 'what memories do I have', 'show what you remember about me'],
  nearMisses: ['preview my memory', "what's in my memory export", 'what do you know about me', 'my patterns', 'remember that I like tea', 'export my memory', 'what did I build with react'],
  match(lower, text) { return previewAskOf(text || lower); },
  run(text, api) { return mount(api); },
  stageKinds: { 'memory-preview': { mount } },
};
