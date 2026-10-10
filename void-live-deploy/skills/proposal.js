/**
 * proposal skill — "turn this into a proposal" on a pasted customer request (frontier build order step 3, first piece).
 * Void drafts an editable proposal card: what they asked for, what we would do, scope, a price line left blank for the
 * owner (prices stay manual), timeline, next step. Every field is edited in place and kept with the card; Copy and
 * Download .md work; nothing is sent. Send asks the confirm line (one plain line, Yes / No) and records a stubbed
 * execution record, by design, until sending is connected. The draft comes from /api/answer mode 'proposal'
 * (lib/proposal.js: the model when it is on, the rules when it is not; the paste goes through redact first).
 * "turn this into a proposal", "make a proposal from this", "write a proposal for this request", "draft a proposal".
 */
import { proposalOf, prepareProposal, ruleProposal, toMarkdown, toPlain, fileNameOf, addressIn, FIELDS, PRICE_BLANK } from '../lib/proposal.js';

const OWNER_KEY = 'a2m.void.owner.v1';
const ownerToken = () => { try { return localStorage.getItem(OWNER_KEY) || ''; } catch (_) { return ''; } };
const el = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; };
const MUTED = 'color:var(--muted,#9a9aa2)';
const FIELD_CSS = 'width:100%;min-height:34px;margin-top:4px;font:inherit;background:rgba(0,0,0,.22);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px 8px;resize:vertical';
const PRESS_CSS = '.proposal-card .g-btn:active:not(:disabled){transform:none;background:rgba(255,255,255,.16)}';
function pressStyle() { if (document.getElementById('proposal-press')) return; const st = document.createElement('style'); st.id = 'proposal-press'; st.textContent = PRESS_CSS; document.head.append(st); }

/** ask the server for the draft; the rules draft when it cannot answer (offline, busy, an error) */
export async function draft(request, note = '') {
  const p = prepareProposal({ request, note });
  if (p.error) throw new Error(p.error);
  try {
    const r = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'proposal', request, note }) });
    const j = await r.json().catch(() => null);
    if (r.ok && j && j.fields && j.fields.title) return { fields: j.fields, model: j.model || 'model', note: j.note || '' };
    return { fields: ruleProposal(p), model: 'rules', note: (j && j.note) || 'the drafting service did not answer, drafted by rule' };
  } catch (_) { return { fields: ruleProposal(p), model: 'rules', note: 'offline, drafted by rule' }; }
}

function mount(th, stageApi) {
  pressStyle();
  const card = el('div');
  card.className = 'thing kept-card game-card proposal-card';
  card.dataset.id = th.id;
  card.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(520px, calc(100vw - 20px))';
  const head = el('div'); head.className = 'g-head';
  const title = el('span', null, 'Proposal'); title.className = 'g-title';
  const sub = el('span', null, 'from the customer\'s request · yours to edit · nothing is sent'); sub.className = 'g-sub';
  head.append(title, sub);
  const status = el('div', 'margin-top:6px;' + MUTED); status.className = 'proposal-status g-status'; status.setAttribute('aria-live', 'polite');
  card.append(head, status);
  const stop = (b) => { b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('keydown', (e) => e.stopPropagation()); return b; };
  const btn = (label, cls, fn) => { const b = stop(el('button', null, label)); b.type = 'button'; b.className = 'g-btn ' + cls; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  stageApi.bindDrag(card, th);
  stageApi.stage.appendChild(card);

  // the request to draft from: pasted with the ask, or into this box
  const paste = el('div', 'margin-top:8px'); paste.className = 'proposal-paste';
  const area = stop(el('textarea', FIELD_CSS + ';min-height:90px')); area.className = 'proposal-request'; area.placeholder = 'Paste the customer\'s request here (an email or a few lines)'; area.value = th.request || '';
  const draftBtn = btn('Draft the proposal', 'g-primary proposal-draft', () => go(area.value));
  paste.append(area, draftBtn); card.append(paste);

  const form = el('div', 'margin-top:8px;display:none'); form.className = 'proposal-fields';
  const inputs = {};
  const toRow = el('label', 'display:block;margin-top:8px;font-size:12px;' + MUTED, 'To (the customer\'s address)');
  const to = stop(el('input', FIELD_CSS + ';min-height:0')); to.className = 'proposal-to'; to.placeholder = 'name@their-company.com'; to.value = th.to || '';
  to.addEventListener('input', () => { th.to = to.value; stageApi.save(); });
  toRow.append(to); form.append(toRow);
  for (const [k, label] of FIELDS) {
    const row = el('label', 'display:block;margin-top:8px;font-size:12px;' + MUTED, label);
    const f = stop(el(k === 'title' ? 'input' : 'textarea', FIELD_CSS + (k === 'title' ? ';min-height:0;font-weight:700' : k === 'price' ? ';min-height:0' : '')));
    f.className = 'proposal-field'; f.dataset.field = k;
    f.addEventListener('input', () => { th.fields = th.fields || {}; th.fields[k] = f.value; stageApi.save(); });
    row.append(f); form.append(row); inputs[k] = f;
  }
  const bar = el('div', 'display:flex;gap:6px;flex-wrap:wrap;margin-top:10px');
  const md = () => toMarkdown(th.fields || {}, to.value);
  bar.append(
    btn('Copy', 'proposal-copy', async () => { let ok = false; try { await navigator.clipboard.writeText(md()); ok = true; } catch (_) {} status.textContent = ok ? 'copied as Markdown' : 'select the text and copy'; }),
    btn('Download .md', 'proposal-download', () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([md()], { type: 'text/markdown' })); a.download = fileNameOf(th.fields); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); status.textContent = 'downloaded ' + a.download; }),
    btn('Send to the customer', 'proposal-send', () => {
      if (!ownerToken()) { status.textContent = 'Sending is the owner\'s, and it stops on the confirm line. Unlock Void first.'; return; }
      if (!addressIn(to.value).to) { status.textContent = 'Add the customer\'s address first.'; to.focus(); return; }
      status.textContent = 'asking the confirm line…';
      // the exact draft rides the ask: the fingerprint covers it, so the yes is on this text and no other
      stageApi.ask('send this proposal "' + String((th.fields && th.fields.title) || 'Proposal').replace(/"/g, '”').slice(0, 80) + '" to ' + addressIn(to.value).to, { body: toPlain(th.fields) });
    }),
    btn('Draft again', 'proposal-redraft', () => { form.style.display = 'none'; paste.style.display = ''; }),
  );
  form.append(bar);
  card.append(form);

  const paint = () => {
    for (const [k] of FIELDS) inputs[k].value = (th.fields && th.fields[k]) || (k === 'price' ? PRICE_BLANK : '');
    paste.style.display = 'none'; form.style.display = '';
  };
  const go = async (request) => {
    th.request = request; stageApi.save();
    status.textContent = 'drafting…'; draftBtn.disabled = true;
    try {
      const d = await draft(request);
      th.fields = d.fields; th.model = d.model;
      if (!th.to) th.to = addressIn(request).to; to.value = th.to || '';
      stageApi.save(); paint();
      status.textContent = (d.model === 'rules' ? 'Drafted by rule' + (d.note ? ' (' + d.note + ')' : '') : 'Drafted') + ' · every field is yours to edit · the price is left for you';
    } catch (e) { status.textContent = e.message; }
    draftBtn.disabled = false;
  };
  if (th.fields && th.fields.title) paint();
  else if (th.request && !th.drafted) { th.drafted = true; go(th.request); }
}

async function run(text, api) {
  const p = proposalOf(text);
  if (!p) return 'none';
  api.summon('proposal', { center: true, request: p.request });
  api.say(p.request ? 'Proposal · drafting from the request · yours to edit, nothing is sent' : 'Proposal · paste the customer\'s request into the card');
  return 'proposal';
}

export default {
  name: 'proposal',
  proposalOf,
  examples: ['turn this into a proposal', 'make a proposal from this', 'write a proposal for this request', 'draft a proposal', 'turn this email into a proposal: we need our order flow fixed by June'],
  nearMisses: ['what is a proposal', 'propose a toast', 'marriage proposal ideas', 'research proposal format', 'proposal writing tips', 'how do I write a proposal'],
  match(lower, text) { return !!proposalOf(text); },
  run,
  stageKinds: { proposal: { mount } },
};
