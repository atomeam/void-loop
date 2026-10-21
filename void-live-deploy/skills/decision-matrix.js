/**
 * decision-matrix skill — "decision matrix for whether to move to Berlin" / "decision matrix for pasta vs pizza": a stage card
 * with option columns and criteria rows, a weight for each criterion, scores 0 to 5, and live weighted totals. Everything is
 * editable in place and persists with the stage on this device. Asked for by the owner (2026-10-18). Nothing is sent anywhere.
 */
import { escHtml, addThing, cardEl, keepOut, tidy } from '../lib/stage-pack.js';

const MAXOPT = 6, MAXCRIT = 8;

/** the title and options an ask names, or null when it is not a decision-matrix ask. Pure. */
// a bare "france vs spain", "show the grid" or "2x2 matrix" belong to country, stage-arrange and decide-cards: the ask names a
// decision matrix (or a decision grid) to be ours (lists run 2, 2026-10-21, the overlap check)
export function parseDecision(text) {
  const t = tidy(text);
  const m = /^(?:please\s+)?(?:(?:make|build|create|show|start|give|open|set\s+up)\s+(?:me\s+)?(?:a\s+|an\s+|my\s+|the\s+)?)?(?:(?:weighted\s+)?(?:decision\s+)?matrix|(?:weighted\s+)?decision\s+grid)(?:\s+(?:for|about|on|of)\s+(.+?))?(?:\s+please)?$/i.exec(t);
  if (!m) return null;
  const topic = (m[1] || '').trim().slice(0, 80);
  const vs = topic.split(/\s+(?:vs\.?|versus)\s+/i).map((s) => s.trim()).filter(Boolean);
  const options = vs.length >= 2 ? vs.slice(0, MAXOPT).map((s) => s.slice(0, 30)) : ['Do it', "Don't"];
  return { title: topic || 'My decision', options };
}

export const DEFAULT_CRITERIA = [{ name: 'Cost', weight: 3 }, { name: 'Effort', weight: 2 }, { name: 'Joy', weight: 3 }];

const num = (v, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : 0; };
export const keyOf = (oi, ci) => oi + '|' + ci;

/** weighted total of each option: sum of weight * score. Pure. th: { options, criteria:[{weight}], scores:{'o|c':n} } */
export function totals(th) {
  return (th.options || []).map((_, oi) => Math.round((th.criteria || []).reduce((s, c, ci) => s + num(c.weight, 0, 10) * num((th.scores || {})[keyOf(oi, ci)], 0, 5), 0) * 100) / 100);
}

/** index of the best option, or -1 when nothing is scored or the top is tied. Pure. */
export function bestOf(tot) {
  const top = Math.max(...tot, 0);
  if (top <= 0) return -1;
  return tot.filter((v) => v === top).length === 1 ? tot.indexOf(top) : -1;
}

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'decision-matrix');
  const { save, render } = stageApi;
  th.options = th.options || ['Do it', "Don't"]; th.criteria = th.criteria || DEFAULT_CRITERIA.map((c) => ({ ...c })); th.scores = th.scores || {};
  const head = document.createElement('div');
  head.innerHTML = '<b>Decision matrix</b> · ' + escHtml(th.title || '');
  head.style.marginBottom = '6px';
  el.appendChild(head);
  const table = document.createElement('table');
  table.style.cssText = 'border-collapse:collapse;font-size:13px';
  const totCells = [];
  const paintTotals = () => {
    const tot = totals(th), best = bestOf(tot);
    totCells.forEach((c, oi) => { c.textContent = String(tot[oi]); c.style.fontWeight = oi === best ? '700' : '400'; c.style.color = oi === best ? '#ffd166' : 'inherit'; c.dataset.best = oi === best ? '1' : ''; });
  };
  const input = (value, onChange, w, max) => {
    const i = document.createElement('input'); i.value = value; i.style.cssText = 'width:' + w + 'px;font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:2px 4px';
    if (max) { i.type = 'number'; i.min = '0'; i.max = String(max); i.step = '0.5'; }
    i.addEventListener('input', () => { onChange(i.value); save(); paintTotals(); });
    keepOut(i); return i;
  };
  const trh = document.createElement('tr');
  trh.appendChild(document.createElement('th')).textContent = 'criterion';
  trh.appendChild(document.createElement('th')).textContent = 'weight';
  th.options.forEach((o, oi) => { const c = document.createElement('th'); c.appendChild(input(o, (v) => { th.options[oi] = v.slice(0, 30); }, 84)); trh.appendChild(c); });
  table.appendChild(trh);
  th.criteria.forEach((cr, ci) => {
    const tr = document.createElement('tr');
    const n = document.createElement('td'); n.appendChild(input(cr.name, (v) => { cr.name = v.slice(0, 30); }, 96)); tr.appendChild(n);
    const w = document.createElement('td'); const wi = input(cr.weight, (v) => { cr.weight = num(v, 0, 10); }, 44, 10); wi.setAttribute('aria-label', 'weight of ' + cr.name); w.appendChild(wi); tr.appendChild(w);
    th.options.forEach((_, oi) => { const c = document.createElement('td'); const i = input(th.scores[keyOf(oi, ci)] ?? '', (v) => { th.scores[keyOf(oi, ci)] = num(v, 0, 5); }, 52, 5); i.setAttribute('aria-label', 'score of ' + th.options[oi] + ' on ' + cr.name); c.appendChild(i); tr.appendChild(c); });
    table.appendChild(tr);
  });
  const tt = document.createElement('tr'); tt.style.borderTop = '1px solid rgba(255,255,255,.2)';
  tt.appendChild(document.createElement('td')).textContent = 'total'; tt.appendChild(document.createElement('td'));
  th.options.forEach(() => { const c = document.createElement('td'); c.className = 'dm-total'; c.style.textAlign = 'center'; totCells.push(c); tt.appendChild(c); });
  table.appendChild(tt);
  el.appendChild(table);
  const bar = document.createElement('div'); bar.style.cssText = 'margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;font-size:12px;opacity:.85';
  const btn = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = 'font:inherit;padding:2px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer'; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); save(); render(); }); keepOut(b); bar.appendChild(b); };
  if (th.criteria.length < MAXCRIT) btn('+ criterion', () => th.criteria.push({ name: 'New criterion', weight: 1 }));
  if (th.options.length < MAXOPT) btn('+ option', () => th.options.push('Option ' + (th.options.length + 1)));
  const hint = document.createElement('span'); hint.textContent = 'score 0 to 5, higher is better · weight 0 to 10'; bar.appendChild(hint);
  el.appendChild(bar);
  paintTotals();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

export function ask(lower, text, stageApi) {
  const p = parseDecision(text);
  if (!p) return '';
  addThing(stageApi, 'decision', { title: p.title, options: p.options, criteria: DEFAULT_CRITERIA.map((c) => ({ ...c })), scores: {} });
  stageApi.save(); stageApi.render();
  return 'decision-matrix';
}

export default {
  name: 'decision-matrix',
  examples: ['decision matrix for whether to move to Berlin', 'decision matrix for pasta vs pizza', 'make a decision matrix', 'decision matrix for iphone vs samsung', 'weighted matrix for choosing a college', 'weighted matrix for hiring a designer'],
  nearMisses: ['what is a decision matrix', 'how do I make a decision', 'add milk to my list'],
  parseDecision,
  match(lower, text) { return !!parseDecision(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'decision-matrix' : 'none'; },
  stageKinds: { decision: { mount, ask } },
};
