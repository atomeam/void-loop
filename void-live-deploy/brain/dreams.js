// What Verse Brain dreams up on /brain/ (owner, 2026-10-30: "Verse can use its brain to come up with ideas and jobs and fixes ... it can
// dream and think coherently"; "dont fake it"). When you leave the page alone for 20 seconds, the brain turns what it holds into dreams
// (lib/brain-dream.js dreamsOf): the breaks its watch saw (lib/brain-host.js breaks), what Verse's will decided (decision), its own organs'
// counts (lib/brain.js selfOf) and the frontier drafts it left out (lib/brain-drafts.json, read from this site). Each dream says where it came
// from and has a whole brief to copy. Nothing is sent from here: the team's copy is made by tools/brain-dream.mjs on the server side.
import * as B from '/lib/brain.js';
import * as D from '/lib/brain-dream.js';

const $ = (s) => document.querySelector(s);
const list = $('#dreams'), note = $('#dreamsNote');
const host = window.verseBrainHost || null;
const brain = () => (window.verseBrainField && window.verseBrainField.state && window.verseBrainField.state.b) || null;
const IDLE_MS = 20000;
let drafts = [], quietSince = Date.now(), dreamtAt = 0;
const KIND = { fix: 'Fix', job: 'Job', idea: 'Idea' };
const node = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
const gh = (u) => /^https:\/\/github\.com\/atomeam\/void-loop\//.test(u || '');

for (const e of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(e, () => { quietSince = Date.now(); }, { passive: true });
// the drafts map is a file of this site (the same one the card reads); only the brain's own lines go into a dream
fetch('/lib/brain-drafts.json').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && Array.isArray(j.drafts)) drafts = j.drafts; }).catch(() => {});

/** what the brain holds now, as dreamsOf takes it. */
function memory() {
  const b = brain();
  return { breaks: host && host.breaks ? host.breaks() : [], decision: host && host.decision ? host.decision() : null, drafts, self: b ? B.selfOf(b) : null, at: Date.now() };
}

function show(dreams) {
  const sig = JSON.stringify(dreams.map((d) => d.key)); if (list.dataset.sig === sig) return; list.dataset.sig = sig; list.dataset.n = String(dreams.length);
  if (!dreams.length) { list.replaceChildren(node('li', 'Nothing to dream from yet: no break stands, Verse\'s will has not been read, and no left-out draft is here.')); return; }
  list.replaceChildren(...dreams.map((d) => {
    const li = node('li'); li.dataset.kind = d.kind;
    li.append(node('b', KIND[d.kind] + ': '), node('span', d.title + '. '), node('span', d.why + ' ', 'why'));
    const src = node('span', 'From: ', 'src');
    d.sources.forEach((x, i) => { if (i) src.append('; '); if (gh(x.url)) { const a = node('a', x.what); a.href = x.url; a.rel = 'noopener'; a.target = '_blank'; src.append(a); } else src.append(x.what); });
    li.append(src);
    const copy = node('button', 'Copy the brief', 'undo'); copy.type = 'button'; copy.setAttribute('aria-label', 'Copy the brief: ' + d.title);
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(D.briefOf(d)); copy.textContent = 'Copied'; } catch (_) { copy.textContent = 'Copy failed'; } setTimeout(() => { copy.textContent = 'Copy the brief'; }, 1600); });
    li.append(copy);
    return li;
  }));
}

function tick() {
  if (!list) return;
  const idle = Date.now() - quietSince >= IDLE_MS;
  if (!dreamtAt || (idle && Date.now() - dreamtAt >= 5000)) {
    show(D.dreamsOf(memory())); dreamtAt = Date.now();
    if (note) note.textContent = 'It dreamt ' + (idle ? 'while you left it alone' : 'when the page opened') + ', at ' + new Date(dreamtAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '. It dreams again after 20 seconds with no move or key.';
  }
}
setTimeout(tick, 3000); setInterval(tick, 1000);
