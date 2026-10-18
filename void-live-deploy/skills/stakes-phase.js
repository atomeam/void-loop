/**
 * stakes-phase skill - "set the stakes" / "set the stakes: money and people": a stage card where the person names what is at
 * stake (money, people, irreversible). The card has three phases and nothing between them: open (none named: read, edit and
 * confirm), careful (one named: a written dissent line and a cooling-off timer before Confirm unlocks) and frozen (two or more:
 * reading only, Confirm never unlocks). No sliders. This card never moves money or touches a key: it only gates its own
 * Confirm button, and the decision to move money stays with the owner. Asked for by the owner (2026-10-18). Device-local.
 */
import { addThing, cardEl, keepOut } from '../lib/stage-pack.js';

export const STAKES = ['money', 'people', 'irreversible'];
export const COOL_MS = 30000;
export const MIN_DISSENT_WORDS = 3;

/** the stakes an ask names, or null when it is not a set-the-stakes ask. Pure. */
export function parseStakes(text) {
  const m = /^(?:please\s+)?set\s+the\s+stakes(?:\s*(?:[:\-]|for|on|of|to)\s*([\s\S]+))?$/i.exec(String(text || '').trim().replace(/[.!]+$/, ''));
  if (!m) return null;
  const t = (m[1] || '').toLowerCase(), out = [];
  if (/\b(?:money|cash|price|pay|paid|payment|dollars?|funds?|budget)\b|\$/.test(t)) out.push('money');
  if (/\b(?:people|person|team|family|users?|customers?|staff|kids?|children)\b/.test(t)) out.push('people');
  if (/\b(?:irreversible|permanent|forever|can'?t undo|cannot be undone|no undo|delet\w*)\b/.test(t)) out.push('irreversible');
  return out;
}

/** the phase for the stakes named: open (none), careful (one), frozen (two or more). A jump, not a slope. Pure. */
export function phaseOf(stakes) {
  const n = new Set((stakes || []).filter((s) => STAKES.includes(s))).size;
  return n === 0 ? 'open' : n === 1 ? 'careful' : 'frozen';
}

export const ACTS = { open: ['read', 'edit', 'confirm'], careful: ['read', 'dissent', 'confirm'], frozen: ['read'] };

/** has the dissent line enough in it to count (a few real words)? Pure. */
export function dissentOk(text) {
  return String(text || '').trim().split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length >= MIN_DISSENT_WORDS;
}

/** what the card allows right now. s = { stakes, dissent, coolStart }, now in ms. Pure; it only answers about the Confirm button. */
export function gate(s, now, coolMs = COOL_MS) {
  const phase = phaseOf(s && s.stakes), acts = ACTS[phase], reasons = [];
  let remaining = 0;
  if (phase === 'frozen') reasons.push('frozen: reading only');
  if (phase === 'careful') {
    if (!dissentOk(s.dissent)) reasons.push('write a dissent line (what could be wrong with this)');
    remaining = s.coolStart == null ? coolMs : Math.max(0, coolMs - (now - s.coolStart));
    if (remaining > 0) reasons.push('cooling off: ' + Math.ceil(remaining / 1000) + 's');
  }
  return { phase, acts, canConfirm: phase === 'open' || (phase === 'careful' && reasons.length === 0), canEdit: phase !== 'frozen', remaining, reasons };
}

/** the stakes after one is toggled, and the cooling clock: it restarts whenever the phase changes. Pure. */
export function toggle(s, kind, now) {
  const set = new Set(s.stakes || []);
  if (set.has(kind)) set.delete(kind); else if (STAKES.includes(kind)) set.add(kind);
  const stakes = STAKES.filter((k) => set.has(k));
  return { ...s, stakes, coolStart: phaseOf(stakes) === phaseOf(s.stakes) ? (s.coolStart ?? now) : now, confirmedAt: null };
}

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'stakes-phase');
  th.stakes = th.stakes || []; th.dissent = th.dissent || '';
  if (th.coolStart == null) th.coolStart = Date.now();
  el.innerHTML = '<b>Set the stakes</b> <span class="sp-phase" style="font-weight:700;margin-left:6px"></span>';
  const note = document.createElement('div'); note.style.cssText = 'font-size:11px;opacity:.65;margin:4px 0 8px';
  note.textContent = 'This card never moves money. It only gates its own Confirm button; moving money stays with the owner.';
  const chips = document.createElement('div'); chips.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px';
  const dis = document.createElement('input');
  dis.className = 'sp-dissent'; dis.value = th.dissent; dis.setAttribute('aria-label', 'dissent line'); dis.placeholder = 'Dissent: what could be wrong with this?';
  dis.style.cssText = 'display:block;width:100%;box-sizing:border-box;margin:6px 0;font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:4px 6px';
  const status = document.createElement('div'); status.className = 'sp-status'; status.style.cssText = 'font-size:12px;opacity:.85;margin:4px 0';
  const go = document.createElement('button');
  go.type = 'button'; go.className = 'sp-confirm'; go.textContent = 'Confirm'; go.style.cssText = 'font:inherit;padding:3px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit';
  const buttons = STAKES.map((k) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sp-chip'; b.dataset.stake = k; b.textContent = k;
    b.style.cssText = 'font:inherit;padding:3px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.3);color:inherit;cursor:pointer';
    b.addEventListener('click', (e) => { e.stopPropagation(); Object.assign(th, toggle(th, k, Date.now())); stageApi.save(); paint(); });
    keepOut(b); chips.appendChild(b); return b;
  });
  const paint = () => {
    const g = gate(th, Date.now());
    el.dataset.phase = g.phase;
    el.querySelector('.sp-phase').textContent = g.phase.toUpperCase();
    buttons.forEach((b) => { const on = th.stakes.includes(b.dataset.stake); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.style.background = on ? 'rgba(255,255,255,.2)' : 'transparent'; });
    dis.style.display = g.phase === 'careful' ? 'block' : 'none';
    dis.disabled = g.phase !== 'careful';
    go.style.display = g.phase === 'frozen' ? 'none' : 'inline-block';
    go.disabled = !g.canConfirm; go.style.opacity = g.canConfirm ? '1' : '.4'; go.style.cursor = g.canConfirm ? 'pointer' : 'not-allowed';
    status.textContent = th.confirmedAt ? 'Confirmed. Nothing was sent or paid; this card only records the click.' : g.reasons.join(' · ') || (g.phase === 'open' ? 'Open: nothing at stake named.' : '');
  };
  dis.addEventListener('input', () => { th.dissent = dis.value; stageApi.save(); paint(); });
  go.addEventListener('click', (e) => { e.stopPropagation(); if (!gate(th, Date.now()).canConfirm) return; th.confirmedAt = Date.now(); stageApi.save(); paint(); });
  keepOut(dis); keepOut(go);
  el.append(note, chips, dis, status, go);
  paint();
  const tick = setInterval(() => { if (!el.isConnected) { clearInterval(tick); return; } paint(); }, 1000);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the stage kind's ask hook: put the card on the stage with any stakes the ask named, or '' */
export function ask(lower, text, stageApi) {
  const named = parseStakes(text);
  if (named === null) return '';
  addThing(stageApi, 'stakes', { stakes: named, dissent: '', coolStart: Date.now(), confirmedAt: null });
  stageApi.save(); stageApi.render();
  return 'stakes-phase';
}

export default {
  name: 'stakes-phase',
  examples: ['set the stakes', 'set the stakes: money and people', 'set the stakes for this decision'],
  nearMisses: ['set the table for four', 'what are the stakes in poker', 'raise the stakes in my game', 'set the timer for ten minutes'],
  parseStakes,
  match(lower, text) { return parseStakes(text || lower) !== null; },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'stakes-phase' : 'none'; },
  stageKinds: { stakes: { mount, ask } },
};
