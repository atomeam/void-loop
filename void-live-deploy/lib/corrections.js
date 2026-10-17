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
  return /\b(?:got\s+(?:this|that|it|something|one)\s+wrong|what\s+it\s+got\s+wrong|(?:correct|fix)\s+(?:void|v01d|you)\b|(?:want|need)\s+to\s+(?:correct|fix)\s+(?:void|v01d|you)\b|made\s+a\s+mistake)/.test(String(lower || '').toLowerCase());
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
    const r = recent[+select.value] || {}, res = addCorrection({ ask: r.ask, skill: r.skill, text: box.value }, storage);
    note.textContent = res.ok ? 'Kept on this device, apart from how your V01D looks. Thank you.' : 'Write what went wrong first.';
    if (res.ok) { box.value = ''; if (onSaved) onSaved(res.list); }
  });
  for (const ev of ['pointerdown', 'keydown']) box.addEventListener(ev, (e) => e.stopPropagation());
  root.replaceChildren(select, box, save, note);
  return { select, box, save };
}
