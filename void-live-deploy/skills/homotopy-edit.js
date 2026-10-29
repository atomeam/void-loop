/**
 * homotopy-edit skill - "check my edit": the person types the old and the new version of an argument as numbered claims
 * ("3: so we should ship <- 1,2": claim 3 rests on premises 1 and 2). A claim in both versions whose premises changed by
 * more than one premise, with no intermediate step between, is a TEAR. The card lists the tears and accepts an explicit path
 * of intermediate premise sets ("3: 1,2 > 1,2,4 > 1,4") that walks old to new one premise at a time; a tear with no valid
 * path stays flagged. Asked for by the owner (2026-10-18). Kept on this device with the stage; nothing is sent anywhere.
 */
import { addThing, cardEl, keepOut, tidy, escHtml } from '../lib/stage-pack.js';

/** true for "check my edit", "check my argument edits", "please check my edit" and nothing wider. Pure. */
export function isEditAsk(text) {
  return /^(?:please\s+)?check\s+my\s+(?:argument\s+)?edits?(?:\s+please)?$/i.test(tidy(text));
}

const ids = (s) => [...new Set(String(s || '').split(/[,\s]+/).map((x) => x.trim()).filter((x) => /^\d+$/.test(x)).map(Number))].sort((a, b) => a - b);

/** claims from lines "N: text <- 1,2" (premises optional); returns { [N]: { text, prem:[numbers] } }. Pure. */
export function parseClaims(src) {
  const out = {};
  for (const line of String(src || '').split(/\r?\n/)) {
    const m = /^\s*(\d+)\s*[:.)]\s*(.*?)\s*(?:<-\s*([\d,\s]*))?\s*$/.exec(line);
    if (m) out[Number(m[1])] = { text: m[2].slice(0, 120), prem: ids(m[3]) };
  }
  return out;
}

/** paths from lines "N: 1,2 > 1,2,4 > 1,4": { [N]: [[premises], ...] }. Pure. */
export function parsePaths(src) {
  const out = {};
  for (const line of String(src || '').split(/\r?\n/)) {
    const m = /^\s*(\d+)\s*:\s*(.+)$/.exec(line);
    if (m && m[2].includes('>')) out[Number(m[1])] = m[2].split('>').map(ids);
  }
  return out;
}

const key = (a) => a.join(',');
const symDiff = (a, b) => a.filter((x) => !b.includes(x)).length + b.filter((x) => !a.includes(x)).length;

/** does the path run from `from` to `to` with every hop adding or dropping exactly one premise? Pure. */
export function pathConnects(path, from, to) {
  if (!Array.isArray(path) || path.length < 2) return false;
  if (key(path[0]) !== key(from) || key(path[path.length - 1]) !== key(to)) return false;
  for (let i = 1; i < path.length; i++) if (symDiff(path[i - 1], path[i]) !== 1) return false;
  return true;
}

/** the claims whose premises changed from old to new: { id, from, to, jump, path } - `jump` is a tear (more than one premise
 *  moved and no valid path). A claim only in one version is an addition or a removal, not a tear. Pure. */
export function checkEdit(oldSrc, newSrc, pathSrc) {
  const a = parseClaims(oldSrc), b = parseClaims(newSrc), paths = parsePaths(pathSrc), changes = [];
  for (const id of Object.keys(a).map(Number).sort((x, y) => x - y)) {
    if (!b[id]) continue;
    const from = a[id].prem, to = b[id].prem;
    if (key(from) === key(to)) continue;
    const unit = symDiff(from, to) === 1, walked = pathConnects(paths[id], from, to);
    changes.push({ id, from, to, jump: !unit && !walked, path: walked ? 'path' : unit ? 'one step' : (paths[id] ? 'bad path' : 'none') });
  }
  return { changes, tears: changes.filter((c) => c.jump), added: Object.keys(b).map(Number).filter((id) => !a[id]), removed: Object.keys(a).map(Number).filter((id) => !b[id]) };
}

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'homotopy-edit');
  const head = document.createElement('div'); head.innerHTML = '<b>Edit check</b> · old argument to new'; head.style.marginBottom = '6px'; el.appendChild(head);
  const area = (field, label, ph) => {
    const l = document.createElement('label'); l.style.cssText = 'display:block;font-size:12px;margin-top:4px'; l.textContent = label;
    const t = document.createElement('textarea'); t.rows = 3; t.value = th[field] || ''; t.placeholder = ph; t.setAttribute('aria-label', label); t.dataset.field = field;
    t.style.cssText = 'width:100%;box-sizing:border-box;font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px';
    t.addEventListener('input', () => { th[field] = t.value; stageApi.save(); paint(); });
    keepOut(t); l.appendChild(t); el.appendChild(l);
  };
  area('oldSrc', 'Old version', '1: the premise\n2: another premise\n3: so we should ship <- 1,2');
  area('newSrc', 'New version', '1: the premise\n2: another premise\n3: so we should ship <- 1,4');
  area('pathSrc', 'Path of intermediate steps (optional)', '3: 1,2 > 1,2,4 > 1,4');
  const out = document.createElement('div'); out.className = 'he-out'; out.setAttribute('aria-live', 'polite'); out.style.cssText = 'margin-top:8px;font-size:13px'; el.appendChild(out);
  function paint() {
    const r = checkEdit(th.oldSrc, th.newSrc, th.pathSrc);
    out.innerHTML = '';
    const line = (txt, cls) => { const d = document.createElement('div'); d.className = cls; d.textContent = txt; out.appendChild(d); return d; };
    if (!r.changes.length) line('No claim changed its premises.', 'he-clear');
    for (const c of r.changes) line((c.jump ? 'Tear' : 'Joined') + ' at claim ' + c.id + ': premises {' + key(c.from) + '} to {' + key(c.to) + '} (' + c.path + ')', c.jump ? 'he-tear' : 'he-ok').style.color = c.jump ? '#ff8a8a' : '#78dc96';
    if (r.added.length) line('Added claims: ' + r.added.join(', '), 'he-note');
    if (r.removed.length) line('Removed claims: ' + r.removed.join(', '), 'he-note');
    if (r.changes.length) line(r.tears.length ? r.tears.length + ' tear' + (r.tears.length === 1 ? '' : 's') + ' left: add a path of intermediate steps.' : 'Every change is joined.', 'he-sum');
  }
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

export function ask(lower, text, stageApi) {
  if (!isEditAsk(text)) return '';
  addThing(stageApi, 'homotopy', { oldSrc: '', newSrc: '', pathSrc: '' });
  stageApi.save(); stageApi.render();
  return 'homotopy-edit';
}

export default {
  name: 'homotopy-edit',
  examples: ['check my edit', 'check my argument edit'],
  nearMisses: ['check my spelling', 'edit my photo', 'check my edit history on github'],
  isEditAsk,
  match(lower, text) { return isEditAsk(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'homotopy-edit' : 'none'; },
  stageKinds: { homotopy: { mount, ask } },
};
void escHtml;
