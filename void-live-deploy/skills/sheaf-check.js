/**
 * sheaf-check skill - "do my notes agree: launch: friday; owner: ana | launch: monday" puts a card on the stage that checks
 * whether the notes glue. Each note is a list of "subject: value" claims (separated by ; or lines); notes are separated by |
 * or --- or a blank line. Where two notes share a subject and give different values, the card shows the obstruction (the
 * minimal conflicting pair) and says the gluing fails; when every overlap agrees it says the notes glue. Kept with the stage
 * on this device, nothing sent anywhere. Asked for by the owner (2026-10-18; a sheaf-gluing check for notes).
 */
import { addThing, cardEl, keepOut } from '../lib/stage-pack.js';
import { h, splitOn } from '../lib/stage-math.js';

export const MAX_NOTES = 6;
const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.!]+$/, '');

/** "a: x: 1; y: 2 | b: x: 2" -> [{ name, claims:[{ subject, value }] }]; notes are named "note 1", "note 2", ... Pure. */
export function parseNotes(body) {
  const parts = splitOn(body, /\s*\|\s*|\n\s*\n|\n?-{3,}\n?/);
  return parts.slice(0, MAX_NOTES).map((p, i) => {
    const claims = [];
    for (const line of splitOn(p, /;|\n/)) {
      const k = line.indexOf(':');
      if (k < 1) continue;
      const subject = norm(line.slice(0, k)), value = norm(line.slice(k + 1));
      if (subject && value) claims.push({ subject, value });
    }
    return { name: 'note ' + (i + 1), claims };
  });
}

/** the body of a sheaf-check ask (it must hold at least one "subject: value" claim), or null. Pure. */
export function bodyOf(text) {
  const m = /^\s*(?:please\s+)?(?:(?:run\s+|do\s+)?(?:a\s+)?sheaf[- ]check|do\s+my\s+(?:notes|threads)\s+agree|check\s+(?:if\s+|whether\s+)?my\s+(?:notes|threads)\s+agree)\s*(?:[:\-]|on|of)?\s*([\s\S]+)$/i.exec(String(text || ''));
  if (!m) return null;
  return parseNotes(m[1]).some((n) => n.claims.length) ? m[1].trim() : null;
}

const sameValue = (a, b) => a === b || (a !== '' && b !== '' && Number.isFinite(+a) && Number.isFinite(+b) && +a === +b);

/** the gluing: shared subjects, the obstructions (one minimal conflicting pair per subject) and the glued claims. Pure. */
export function glue(notes) {
  const by = new Map();
  notes.forEach((n, ni) => n.claims.forEach((c) => { if (!by.has(c.subject)) by.set(c.subject, []); by.get(c.subject).push({ note: n.name, ni, value: c.value }); }));
  const overlaps = [], obstructions = [], glued = [];
  for (const [subject, rows] of by) {
    if (new Set(rows.map((r) => r.ni)).size >= 2) overlaps.push(subject);
    let bad = null;
    for (let i = 0; i < rows.length && !bad; i++) for (let j = i + 1; j < rows.length; j++) if (rows[i].ni !== rows[j].ni && !sameValue(rows[i].value, rows[j].value)) { bad = [rows[i], rows[j]]; break; }
    if (bad) obstructions.push({ subject, a: { note: bad[0].note, value: bad[0].value }, b: { note: bad[1].note, value: bad[1].value } });
    else glued.push({ subject, value: rows[0].value });
  }
  return { glues: obstructions.length === 0 && notes.length >= 2, overlaps, obstructions, glued };
}

/** one plain sentence for the verdict. Pure. */
export function verdict(g, noteCount) {
  if (noteCount < 2) return 'Paste at least two notes (separate them with | ) to compare.';
  if (g.obstructions.length) return 'The notes do not glue: ' + g.obstructions.length + ' obstruction' + (g.obstructions.length === 1 ? '' : 's') + '.';
  return g.overlaps.length ? 'The notes glue: all ' + g.overlaps.length + ' shared subject' + (g.overlaps.length === 1 ? ' agrees.' : 's agree.') : 'The notes glue, but they share no subject, so nothing was really tested.';
}

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'sheaf-check');
  const notes = parseNotes(th.body || ''), g = glue(notes);
  el.append(h('b', {}, 'Do my notes agree?'), h('div', { className: 'sheaf-verdict', style: 'margin:6px 0;font-weight:600;color:' + (g.obstructions.length ? '#ff9b9b' : '#78dc96') }, verdict(g, notes.length)));
  for (const o of g.obstructions) el.append(h('div', { className: 'sheaf-obstruction', style: 'margin:4px 0;padding:6px 8px;border-left:3px solid #ff9b9b;background:rgba(255,155,155,.08);border-radius:4px' }, o.subject + ': ', h('b', {}, o.a.note), ' says "' + o.a.value + '" but ', h('b', {}, o.b.note), ' says "' + o.b.value + '"'));
  if (g.glued.length) el.append(h('div', { style: 'margin-top:6px;font-size:12px;opacity:.8' }, 'glued: ' + g.glued.map((c) => c.subject + ' = ' + c.value).join(' · ')));
  const ta = h('textarea', { value: th.body || '', rows: 3, 'aria-label': 'notes to compare', style: 'width:100%;margin-top:8px;font:inherit;font-size:12px;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px' });
  ta.addEventListener('change', () => { th.body = ta.value.slice(0, 4000); stageApi.save(); stageApi.render(); });
  keepOut(ta); el.append(ta);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

export function ask(lower, text, stageApi) {
  const body = bodyOf(text);
  if (!body) return '';
  addThing(stageApi, 'sheafcheck', { body: body.slice(0, 4000) });
  stageApi.save(); stageApi.render();
  return 'sheaf-check';
}

export default {
  name: 'sheaf-check',
  examples: ['do my notes agree: launch: friday; owner: ana | launch: monday', 'sheaf check: price: 5 | price: 5.0; color: red', 'check if my notes agree: a: 1 --- a: 2'],
  nearMisses: ['do my notes agree with the plan', 'sheaf cohomology explained', 'take a note: launch is friday'],
  bodyOf,
  match(lower, text) { return !!bodyOf(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'sheaf-check' : 'none'; },
  stageKinds: { sheafcheck: { mount, ask } },
};
