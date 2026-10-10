/**
 * memory skill — Void answers from what it remembers, on the page (Ouroboros pushes a digest of each project to
 * /api/memory; GET /api/memory?ask=<question> answers in plain words from them, no model). The card shows the answer as
 * the API wrote it: each match with its tech, summary, last change, and whether a copy exists elsewhere, or the
 * "nothing matches" sentence as is. It keeps itself live (skills/live.js, every 5 minutes) so a project pushed while the
 * card is open shows up by itself. Owner-only, the way the actions card is: without the owner's key or session it says
 * so and fetches nothing.
 * "remember that <fact>" keeps one plain line in your own memory (an explicit ask: nothing is remembered otherwise) and "forget that <fact>" removes it.
 * "what did I build with react", "what do you remember about the parser", "remember anything about rust", "ask my memory
 * about python". "remember me", "memory game" and "how much memory does chrome use" are not this.
 */
import { keepLive } from './live.js';

const OWNER_KEY = 'a2m.void.owner.v1', ME_KEY = 'a2m.void.me.v1';
export const EVERY = 5 * 60e3;
// the owner's key, else this device's member session (a signed-in paid member reads only their own memory; the server decides which)
const ownerToken = () => { try { return localStorage.getItem(OWNER_KEY) || (JSON.parse(localStorage.getItem(ME_KEY) || 'null') || {}).token || ''; } catch (_) { return ''; } };
// a topic that is a person or a pronoun is not a project ("what do you remember about me")
const NO_KEY = 'What Void remembers is for the owner and paid members. Unlock Void first (unlock <key>, or sign in with your passkey), then ask again.';
const failText = (status) => (status === 401 ? 'Only the owner can use memory.' : status === 403 ? 'What Void remembers is for paid members.' : status === 503 ? 'There is no database behind this copy of Void.' : 'Memory answered ' + status + '.');
const NOT_TOPIC = /^(?:me|you|us|it|that|this|them|him|her|everything|anything|nothing|myself|yourself)$/;

/** what the ask means: null, or { q } where q is what goes to /api/memory?ask= ("" asks for the prompt sentence) */
export function memoryOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = /^(?:what|which)\s+(?:projects?|apps?|tools?|things?)\s+(?:did|have)\s+i\s+(?:build|built|make|made|write|wrote|create|created|start|started)(?:\s+(?:with|in|using|on)\s+(.+))?$/.exec(t)
    || /^what\s+did\s+i\s+(?:build|make|write|create|start)(?:\s+(?:with|in|using|on)\s+(.+))?$/.exec(t);
  if (m) return m[1] && NOT_TOPIC.test(m[1]) ? null : { q: m[1] || '' };
  // "remember that <fact>" / "forget that <fact>": a whole sentence (at least three words), so "remember the titans", "remember that song",
  // "remember to call mom" and "forget it" are not this
  const o = String(text || '').trim().replace(/[’]/g, "'"); // the fact keeps its own capitals
  m = /^(?:(?:please|void),?\s+)?remember\s*(?:that|:)\s*(.+)$/i.exec(o);
  if (m) return fact(m[1]) ? { remember: fact(m[1]) } : null;
  m = /^(?:(?:please|void),?\s+)?forget\s+that\s+(.+)$/i.exec(o);
  if (m) return fact(m[1]) ? { forget: fact(m[1]) } : null;
  m = /^what\s+do\s+you\s+remember\s+(?:about|of|on)\s+(.+)$/.exec(t)
    || /^(?:do\s+you\s+)?remember\s+anything\s+(?:about|on|of)\s+(.+)$/.exec(t)
    || /^(?:ask|search|check|query)\s+(?:my|your|void'?s)\s+memory(?:\s+(?:for|about|on|of))?\s+(.+)$/.exec(t);
  if (m) return NOT_TOPIC.test(m[1]) ? null : { q: m[1] };
  return null;
}

/** the fact in a "remember that …" ask: plain words, at least three, short enough for one line; '' when it is not a sentence to keep */
const fact = (x) => { const f = String(x || '').trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, ''); return f.split(' ').length >= 3 && f.length <= 280 ? f : ''; };
/** a note's id: the same fact (any case, spacing, final dot) is the same note, so saying it twice keeps one and "forget that …" finds it */
export async function noteId(text) {
  const norm = String(text || '').toLowerCase().replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm)));
  return 'note-' + [...d.slice(0, 6)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
/** the record POSTed for "remember that <fact>" */
export async function noteRecord(text) {
  const f = String(text).trim();
  return { id: await noteId(f), kind: 'note', name: f.slice(0, 100), summary: f.slice(0, 280), links: [], state: '', remote: '', last_commit: '' };
}

export const askUrl = (q) => '/api/memory?ask=' + encodeURIComponent(String(q || '').slice(0, 200));
/** the API's answer as card rows: a heading line, then one row per bullet; a plain sentence is one row */
export function rowsOf(answer) {
  return String(answer || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => ({ bullet: l.startsWith('•'), text: l.replace(/^•\s*/, '') }));
}

const el = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; };
const MUTED = 'color:var(--muted,#9a9aa2)';
const PRESS_CSS = '.memory-card .g-btn:active:not(:disabled){transform:none;background:rgba(255,255,255,.16)}';
function pressStyle() { if (document.getElementById('memory-press')) return; const st = document.createElement('style'); st.id = 'memory-press'; st.textContent = PRESS_CSS; document.head.append(st); }

function mount(th, stageApi) {
  pressStyle();
  const card = el('div');
  card.className = 'thing kept-card game-card memory-card';
  card.dataset.id = th.id;
  card.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(460px, calc(100vw - 20px))';
  const head = el('div'); head.className = 'g-head';
  const title = el('span', null, 'Memory'); title.className = 'g-title';
  const sub = el('span', null, th.q ? 'asked: ' + th.q : 'what Void remembers'); sub.className = 'g-sub';
  head.append(title, sub);
  const status = el('div', 'margin-top:6px;' + MUTED); status.className = 'memory-status g-status'; status.setAttribute('aria-live', 'polite');
  const list = el('div', 'display:grid;gap:6px;margin-top:10px;font-size:13px'); list.className = 'memory-list';
  card.append(head, status, list);
  const tok = ownerToken();
  stageApi.bindDrag(card, th);
  stageApi.stage.appendChild(card);
  if (!tok) { status.textContent = NO_KEY; return; }

  const paint = (answer) => {
    list.textContent = '';
    for (const r of rowsOf(answer)) { const d = el('div', r.bullet ? '' : MUTED, r.text); d.className = r.bullet ? 'memory-row' : 'memory-line'; list.append(d); }
  };
  const load = async () => {
    status.textContent = 'asking…';
    try {
      const r = await fetch(askUrl(th.q), { headers: { authorization: 'Bearer ' + tok } });
      if (!r.ok) throw new Error(r.status === 401 ? 'only the owner can read what Void remembers' : r.status === 403 ? 'what Void remembers is for paid members' : r.status === 503 ? 'no database behind this copy of Void' : 'memory answered ' + r.status);
      const data = await r.json().catch(() => ({}));
      paint(data.answer); status.textContent = '';
    } catch (e) { status.textContent = e.message; throw e; }
  };
  const bar = el('div', 'display:flex;gap:6px;flex-wrap:wrap;margin-top:10px');
  const refresh = el('button', null, 'Refresh'); refresh.type = 'button'; refresh.className = 'g-btn memory-refresh';
  refresh.addEventListener('pointerdown', (e) => e.stopPropagation());
  refresh.addEventListener('click', (e) => { e.stopPropagation(); Promise.resolve(card._live ? card._live.now() : load()).catch(() => {}); });
  bar.append(refresh); card.append(bar);
  load().then(() => { if (card.isConnected) keepLive({}, card, { name: 'memory', every: EVERY, refresh: load, present: () => card.isConnected }); }).catch(() => {});
}

async function run(text, api) {
  const q = memoryOf(text);
  if (!q) return 'none';
  if (q.remember || q.forget) return keepOrDrop(q, api);
  api.summon('memory', { q: q.q, center: true });
  api.say('Memory · what Void remembers about your projects');
  return 'memory';
}

// "remember that <fact>" saves one plain line in your own memory; "forget that <fact>" removes it. Same key and scope as the card.
async function keepOrDrop(q, api) {
  const tok = ownerToken();
  if (!tok) { api.say(NO_KEY); return 'memory'; }
  const headers = { authorization: 'Bearer ' + tok };
  try {
    if (q.remember) {
      const r = await fetch('/api/memory', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ source: 'remember', records: [await noteRecord(q.remember)] }) });
      if (r.status === 413) api.say('Your memory is full. Forget something first.');
      else if (!r.ok) api.say(failText(r.status));
      else { const d = await r.json().catch(() => ({})); api.say(d.saved ? 'Remembered: ' + q.remember : 'I couldn’t keep that one.'); }
    } else {
      const r = await fetch('/api/memory?id=' + encodeURIComponent(await noteId(q.forget)), { method: 'DELETE', headers });
      if (!r.ok) api.say(failText(r.status));
      else { const d = await r.json().catch(() => ({})); api.say(d.removed ? 'Forgotten: ' + q.forget : 'I wasn’t holding that.'); }
    }
  } catch (_) { api.say('Memory is out of reach right now.'); }
  return 'memory';
}

export default {
  name: 'memory',
  memoryOf,
  examples: ['what did I build with react', 'what do you remember about the parser', 'remember anything about rust', 'ask my memory about python', 'remember that I prefer tabs over spaces', 'forget that I prefer tabs over spaces'],
  nearMisses: ['remember me', 'memory game', 'how much memory does chrome use', 'what do you remember about me', 'do you remember me', 'remember the titans', 'i can\'t remember', 'remember to call mom', 'remember that song', 'do you remember that', 'forget it', 'forget about it', 'forget that', 'what did I do today', 'what do you remember'],
  match(lower, text) { return !!memoryOf(text); },
  run,
  stageKinds: { memory: { mount } },
};
