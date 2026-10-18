/**
 * witness-claims skill — "proof-carrying claims: revenue grew 10% @ data: q3.csv; users stay @ assumes: price holds, no rival; launch is easy": a stage card
 * of claims. Each claim may carry a witness (a data pointer, a list of assumptions, or the word unverified). A claim without a
 * witness can be talked about but cannot be moved to the Committed region; committed claims show their witness. Kept with the
 * stage on this device; nothing is sent anywhere. Asked for by the owner (2026-10-18, "operating laws for serious thought with a machine").
 */
import { addThing, cardEl, keepOut, tidy } from '../lib/stage-pack.js';

const MAXC = 20;

/** a witness from text: { kind:'data'|'assumes'|'unverified', value } or null. "data: q3.csv", "assumes: a, b", "unverified". Pure. */
export function parseWitness(s) {
  const t = String(s || '').trim();
  if (/^unverified$/i.test(t)) return { kind: 'unverified', value: '' };
  const m = /^(data|source|assumes?|assumptions?)\s*:\s*(.+)$/i.exec(t);
  if (!m) return null;
  const value = m[2].trim().slice(0, 160);
  if (!value) return null;
  return /^(?:data|source)$/i.test(m[1]) ? { kind: 'data', value } : { kind: 'assumes', value };
}

/** claims from "claim @ witness; claim" (witness optional). Pure. */
export function parseClaims(s) {
  const out = [];
  for (const part of String(s || '').split(/\s*;\s*/)) {
    const [c, w] = part.split(/\s+@\s+/, 2);
    const text = (c || '').trim().slice(0, 160);
    if (!text) continue;
    out.push({ text, witness: w ? parseWitness(w) : null, state: 'draft' });
  }
  return out.slice(0, MAXC);
}

/** the ask: { claims } (empty for the bare ask) or null. Pure. */
export function parseWitnessAsk(text) {
  const m = /^(?:please\s+)?(?:(?:make|start|open|show|give)\s+(?:me\s+)?(?:a\s+|my\s+)?)?proof[\s-]carrying\s+claims?\s*(?:[:\-]\s*(.+))?$/i.exec(tidy(text));
  return m ? { claims: m[1] ? parseClaims(m[1]) : [] } : null;
}

/** may this claim be committed? A claim needs a witness; the word unverified counts, and is shown as such. Pure. */
export function canCommit(claim) {
  if (!claim || !claim.witness || !claim.witness.kind) return { ok: false, why: 'no witness: give it a data pointer, a list of assumptions, or the word unverified' };
  return { ok: true, why: '' };
}

/** commit a claim by index; returns a new list and whether it moved. Pure. */
export function commit(claims, i) {
  const c = claims[i], v = canCommit(c);
  if (!v.ok) return { claims, moved: false, why: v.why };
  return { claims: claims.map((x, j) => (j === i ? { ...x, state: 'committed' } : x)), moved: true, why: '' };
}

/** the line a witness shows. Pure. */
export function witnessLine(w) {
  if (!w) return 'no witness';
  return w.kind === 'unverified' ? 'unverified' : (w.kind === 'data' ? 'data: ' : 'assumes: ') + w.value;
}

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'witness-claims');
  th.claims = th.claims || [];
  const { save, render } = stageApi;
  const head = document.createElement('div'); head.innerHTML = '<b>Proof-carrying claims</b>'; head.style.marginBottom = '6px'; el.appendChild(head);
  const msg = document.createElement('div'); msg.className = 'wc-msg'; msg.style.cssText = 'font-size:12px;min-height:1em'; msg.setAttribute('aria-live', 'polite');
  const region = (title, state) => {
    const box = document.createElement('div'); box.className = 'wc-' + state; box.style.cssText = 'margin:6px 0;padding:6px 8px;border-radius:8px;border:1px ' + (state === 'draft' ? 'dashed' : 'solid') + ' rgba(255,255,255,.25)';
    const h = document.createElement('div'); h.textContent = title; h.style.cssText = 'font-size:12px;opacity:.8'; box.appendChild(h);
    th.claims.forEach((c, i) => {
      if (c.state !== state) return;
      const row = document.createElement('div'); row.className = 'wc-claim'; row.dataset.i = String(i); row.style.cssText = 'margin-top:4px';
      const t = document.createElement('span'); t.textContent = c.text; row.appendChild(t);
      const w = document.createElement('div'); w.className = 'wc-witness'; w.style.cssText = 'font-size:12px;opacity:.85'; w.textContent = '↳ ' + witnessLine(c.witness); row.appendChild(w);
      if (state === 'draft') {
        const wi = document.createElement('input'); wi.placeholder = 'data: … | assumes: … | unverified'; wi.setAttribute('aria-label', 'witness for ' + c.text); wi.value = c.witness ? witnessLine(c.witness) : '';
        wi.style.cssText = 'font:inherit;font-size:12px;width:60%;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:1px 4px';
        wi.addEventListener('change', () => { c.witness = parseWitness(wi.value); save(); render(); }); keepOut(wi); row.appendChild(wi);
        const b = document.createElement('button'); b.type = 'button'; b.className = 'wc-commit'; b.textContent = 'Commit'; b.setAttribute('aria-disabled', canCommit(c).ok ? 'false' : 'true');
        b.style.cssText = 'font:inherit;font-size:12px;margin-left:6px;padding:1px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer;opacity:' + (canCommit(c).ok ? 1 : 0.45);
        b.addEventListener('click', (e) => { e.stopPropagation(); const r = commit(th.claims, i); if (r.moved) { th.claims = r.claims; save(); render(); } else msg.textContent = 'Cannot commit "' + c.text + '": ' + r.why + '.'; }); keepOut(b); row.appendChild(b);
      }
      box.appendChild(row);
    });
    return box;
  };
  el.appendChild(region('Draft (can be discussed, not committed without a witness)', 'draft'));
  el.appendChild(region('Committed', 'committed'));
  el.appendChild(msg);
  const inp = document.createElement('input'); inp.placeholder = 'claim @ data: file; another claim; …'; inp.setAttribute('aria-label', 'add claims'); inp.className = 'wc-input';
  inp.style.cssText = 'margin-top:4px;width:100%;box-sizing:border-box;font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:3px 6px';
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { th.claims = th.claims.concat(parseClaims(inp.value)).slice(0, MAXC); save(); render(); } });
  keepOut(inp); el.appendChild(inp);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

export function ask(lower, text, stageApi) {
  const p = parseWitnessAsk(text);
  if (!p) return '';
  addThing(stageApi, 'witnessed', { claims: p.claims });
  stageApi.save(); stageApi.render();
  return 'witness-claims';
}

export default {
  name: 'witness-claims',
  examples: ['proof-carrying claims', 'make proof-carrying claims', 'proof-carrying claims: revenue grew 10% @ data: q3.csv; users stay @ assumes: price holds; launch is easy'],
  nearMisses: ['what is a claim', 'file an insurance claim', 'proof of purchase', 'what is proof carrying code'],
  parseWitnessAsk,
  match(lower, text) { return !!parseWitnessAsk(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'witness-claims' : 'none'; },
  stageKinds: { witnessed: { mount, ask } },
};
