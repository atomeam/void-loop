// The correction channel (asked by Void: "the routing handler for the 'open the self card' intent so I can ingest user corrections ... a strict
// meta-data channel"). A person opens the self card ("open the self card", "tell void what it got wrong") and says which answer was wrong and
// what they wanted. That goes here, into a store of its own in the `self` family (CORRECTIONS.key), and nowhere else: it shares no key and no
// code with the look skill's state (the look store in lib/state.js), so a correction can never restyle the stage and a restyle can never overwrite a
// correction. Each record is metadata only: when, the ask as typed, which skill answered it, what was wanted, and the person's words, all clipped.
// The router examples that send "tell void what it got wrong" to the self skill, not look, were already tightened in #988; this is the store behind them.
// Device-local by design (no unauthenticated endpoint takes a stranger's text). Pure over the storage handed in; the text is untrusted and is
// stored as plain text (the card shows it with textContent/esc, never as markup).
export const CORRECTIONS = { family: 'self', key: 'a2m.void.corrections.v1', max: 100, askMax: 160, textMax: 300 };

/** plain text: control characters out, spaces collapsed, clipped. Pure. */
export function clean(t, n) {
  return String(t == null ? '' : t).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
}

/** a skill name as the router writes it ('skill:clock' or 'clock'), or ''. Pure. */
export function skillName(s) { const m = /^(?:skill:)?([a-z0-9][a-z0-9_-]{0,40})$/i.exec(String(s || '').trim()); return m ? m[1].toLowerCase() : ''; }

/** one correction record, or null when the person said nothing. Pure. */
export function makeCorrection(input, now = Date.now()) {
  const i = input || {}, text = clean(i.text, CORRECTIONS.textMax);
  if (!text) return null;
  const at = new Date(Number.isFinite(+now) ? +now : Date.now()).toISOString();
  return { at, ask: clean(i.ask, CORRECTIONS.askMax), skill: skillName(i.skill), wanted: clean(i.wanted, 60), text };
}

const store = (s) => { try { return s || globalThis.localStorage || null; } catch (_) { return null; } };

/** every kept correction, oldest first; [] when there are none or the store cannot be read. Pure over the storage. */
export function readCorrections(s) {
  const st = store(s); if (!st) return [];
  try {
    const v = JSON.parse(st.getItem(CORRECTIONS.key) || '[]');
    return Array.isArray(v) ? v.filter((c) => c && typeof c.text === 'string' && c.text).slice(-CORRECTIONS.max) : [];
  } catch (_) { return []; }
}

/** keep a correction on this device: { ok, list }. ok is false when it was empty or could not be kept. Writes only CORRECTIONS.key. */
export function addCorrection(input, s, now = Date.now()) {
  const c = makeCorrection(input, now), st = store(s);
  if (!c || !st) return { ok: false, list: readCorrections(s) };
  const list = readCorrections(s).concat(c).slice(-CORRECTIONS.max);
  try { st.setItem(CORRECTIONS.key, JSON.stringify(list)); } catch (_) { return { ok: false, list: readCorrections(s) }; }
  return { ok: true, list };
}

/** the asks a skill answered lately, newest first, one per ask, from the loop log ([{ ask, note: 'skill:x' }]). Pure. */
export function recentAnswered(log, limit = 8) {
  const out = [], seen = new Set();
  for (const e of Array.isArray(log) ? [...log].reverse() : []) {
    const skill = e && typeof e.note === 'string' && e.note.startsWith('skill:') ? skillName(e.note) : '', ask = clean(e && e.ask, CORRECTIONS.askMax);
    if (!skill || !ask || seen.has(ask.toLowerCase())) continue;
    seen.add(ask.toLowerCase()); out.push({ ask, skill }); if (out.length >= limit) break;
  }
  return out;
}

/** "tell void what it got wrong", "correct void ...", "void got this wrong", "I want to correct you": a correction, not a look or a page. Pure. */
export function wantsCorrection(lower) {
  return /\b(?:got\s+(?:this|that|it|something|one)\s+wrong|what\s+it\s+got\s+wrong|(?:correct|fix)\s+(?:void|v01d|you)\b|(?:want|need)\s+to\s+(?:correct|fix)\s+(?:void|v01d|you)\b|made\s+a\s+mistake|self[- ]?card\b.*\b(?:correct|fix)\s+(?:it|that|this)\b)/.test(String(lower || '').toLowerCase());
}

/** the answer a select value names: null for the empty placeholder, a non-number or an index out of range. Pure. */
export function chosenAnswer(recent, value) {
  if (value === '' || value == null) return null;
  const i = Number(value);
  return Number.isInteger(i) && i >= 0 && Array.isArray(recent) && recent[i] ? recent[i] : null;
}

/**
 * Put the form into `root` (a DOM element) with the document `doc`. Everything typed or read goes in with textContent. `onSaved(list)` runs
 * after a correction is kept. Returns { select, box, save }. The only thing it writes is CORRECTIONS.key.
 */
export function mountForm(root, doc, { storage, log, onSaved } = {}) {
  const el = (tag, props = {}, kids = []) => { const n = doc.createElement(tag); Object.assign(n, props); for (const k of kids) n.append(k); return n; };
  const recent = recentAnswered(log);
  const select = el('select', { ariaLabel: 'Which answer was wrong' }, [el('option', { value: '', textContent: recent.length ? 'Which answer was wrong?' : 'Nothing answered on this device yet' })]);
  recent.forEach((r, i) => select.append(el('option', { value: String(i), textContent: r.ask + ' (answered by ' + r.skill + ')' })));
  const box = el('textarea', { maxLength: CORRECTIONS.textMax, rows: 2, placeholder: 'What I got wrong, or what you wanted', ariaLabel: 'What V01D got wrong' });
  const note = el('div', { className: 'sub' });
  const save = el('button', { type: 'button', className: 'tr-copy', textContent: 'Tell V01D' });
  save.addEventListener('click', () => {
    const r = chosenAnswer(recent, select.value);
    if (recent.length && !r) { note.textContent = 'Pick which answer was wrong first.'; return; } // the placeholder is not an answer: save nothing
    const res = addCorrection({ ask: r && r.ask, skill: r && r.skill, text: box.value }, storage);
    note.textContent = res.ok ? 'Kept on this device, apart from how your V01D looks. Thank you.' : 'Write what went wrong first.';
    if (res.ok) { box.value = ''; if (onSaved) onSaved(res.list); }
  });
  for (const ev of ['pointerdown', 'keydown']) box.addEventListener(ev, (e) => e.stopPropagation());
  root.replaceChildren(select, box, save, note);
  return { select, box, save };
}

/** skill name -> { id, name } of its family, read off skills/families.json ({ families: [{ id, name, skills: [{ name }] }] }). Pure. */
export function familyMap(fam) {
  const m = new Map();
  for (const f of (fam && fam.families) || []) for (const s of (f && f.skills) || []) if (s && s.name && f.id && !m.has(s.name)) m.set(s.name, { id: String(f.id), name: String(f.name || f.id) });
  return m;
}

/**
 * The correction log: the kept corrections grouped by the family of the skill that answered, biggest group first (ties by name), each group's
 * newest correction first. A correction whose skill is unknown (or not in the families file) goes to the group "unplaced". Counts are counts of
 * what is kept; nothing is estimated. Pure.
 */
export function groupByFamily(list, fam) {
  const map = familyMap(fam), groups = new Map();
  for (const c of Array.isArray(list) ? list : []) {
    if (!c || typeof c.text !== 'string' || !c.text) continue;
    const f = c.skill && map.get(c.skill) || { id: 'unplaced', name: 'Not placed in a family' };
    if (!groups.has(f.id)) groups.set(f.id, { id: f.id, name: f.name, items: [] });
    groups.get(f.id).items.unshift(c);
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
}

const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
/** the log's markup; every kept word goes through esc (it is untrusted). An empty log says so and shows no number. A "Suggest fix" button (lib/correction-fix.js) is drawn only when `owner` is true. Pure. */
export function logHtml(list, fam, esc = escHtml, { owner = false } = {}) {
  const groups = groupByFamily(list, fam), total = groups.reduce((n, g) => n + g.items.length, 0);
  if (!total) return '<div class="vh">Correction log</div><div class="sub" data-corr-empty="1">No corrections yet. When you tell me what I got wrong, it is listed here by family.</div>';
  return '<div class="vh">Correction log</div><div class="sub">' + esc(total) + ' kept on this device, by the family of the skill that answered.</div>'
    + '<ul class="v-asks" data-corr-log="1">' + groups.map((g) => '<li><details><summary>' + esc(g.name) + ' <span style="color:var(--ink-3)">(' + esc(g.items.length) + ')</span></summary><div class="v-meta">'
      + g.items.map((c) => '<p>' + (c.ask ? esc(c.ask) + (c.skill ? ' <span style="color:var(--ink-3)">(' + esc(c.skill) + ')</span>' : '') + ': ' : '') + esc(c.text) + (owner && c.skill && c.ask ? ' <button type="button" class="tr-copy" data-suggest-fix="' + esc(list.indexOf(c)) + '">Suggest fix</button><span data-fix-out></span>' : '') + '</p>').join('') + '</div></details></li>').join('') + '</ul>';
}
