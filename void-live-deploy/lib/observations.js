/**
 * observations — the shared contract every explainer gives on its `observations` port and every taker (quiz, challenge,
 * notebook) reads: schema void.observations.v1 (domains/void.learning.md). One checker, so a taker never parses one
 * explainer differently from another.
 *   validateObservations(payload) -> { ok, errors: [text] }
 */
export const SCHEMA = 'void.observations.v1';

export function validateObservations(p) {
  const errors = [], bad = (m) => errors.push(m);
  if (!p || typeof p !== 'object') return { ok: false, errors: ['not an object'] };
  if (p.schema !== SCHEMA) bad('schema is not ' + SCHEMA);
  if (!p.source || typeof p.source.cardId !== 'string' || !p.source.cardId) bad('source.cardId missing');
  if (!p.source || !Number.isInteger(p.source.revision) || p.source.revision < 0) bad('source.revision is not a whole number');
  if (!Array.isArray(p.items)) return { ok: false, errors: errors.concat('items is not a list') };
  const ids = new Set();
  p.items.forEach((it, i) => {
    const at = 'item ' + (it && it.id ? it.id : i);
    if (!it || typeof it.id !== 'string' || !it.id) return bad(at + ': id missing');
    if (ids.has(it.id)) bad(at + ': duplicate id'); ids.add(it.id);
    if (typeof it.label !== 'string' || !it.label) bad(at + ': label missing');
    if (typeof it.meaning !== 'string' || !it.meaning) bad(at + ': meaning missing');
    if (it.valueType === 'number') {
      if (typeof it.value !== 'number' || !Number.isFinite(it.value)) bad(at + ': value is not a finite number');
      if (typeof it.unit !== 'string' || !it.unit) bad(at + ': a number needs its unit');
    } else if (it.valueType === 'text') {
      if (typeof it.value !== 'string') bad(at + ': value is not text');
    } else bad(at + ': valueType is not number or text');
    const a = it.assessment;
    if (!a || !a.enabled) return;
    if (typeof a.prompt !== 'string' || !a.prompt) bad(at + ': an assessed item needs its prompt');
    if (it.valueType === 'number') {
      if (typeof a.tolerance !== 'number' || !(a.tolerance >= 0)) bad(at + ': an assessed number needs a tolerance in its unit');
    } else {
      // free-text grading is out of version 1: an assessed text item is a choice from the source's own options
      if (!Array.isArray(a.options) || a.options.length < 2) bad(at + ': an assessed text item needs at least two options');
      else {
        const oid = new Set();
        for (const o of a.options) { if (!o || typeof o.id !== 'string' || !o.id || typeof o.label !== 'string') bad(at + ': option without id and label'); else if (oid.has(o.id)) bad(at + ': duplicate option ' + o.id); else oid.add(o.id); }
        if (!oid.has(a.answerId)) bad(at + ': answerId is not one of the options');
      }
    }
  });
  return { ok: errors.length === 0, errors };
}
