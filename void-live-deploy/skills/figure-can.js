/**
 * figure-can skill — "what can this figure do".
 * Stays on the brand already written for Motelet in figure.js.
 * Does not summon a new figure. Empty surface stays empty.
 */
import { MOTELET } from './figure.js';

const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();

export function canDoOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?what can this figure do$/.test(t)) return { who: 'motelet' };
  if (/^(?:please\s+)?what can motelet do$/.test(t)) return { who: 'motelet' };
  if (/^(?:please\s+)?what does this figure do$/.test(t)) return { who: 'motelet' };
  if (/^(?:please\s+)?figure abilities$/.test(t)) return { who: 'motelet' };
  return null;
}

export function brandLine() {
  return { name: MOTELET.name, line: MOTELET.personality, html: '', published: false };
}

async function run(text, api) {
  const hit = canDoOf(text);
  if (!hit) return 'none';
  const b = brandLine();
  if (api.say) api.say(b.name + ': ' + b.line);
  return 'figure-can';
}

export default {
  name: 'figure-can',
  examples: ['what can this figure do', 'what can motelet do', 'what does this figure do', 'figure abilities'],
  nearMisses: ['summon a figure', 'spin the figure', 'what can you do', 'what is a figure'],
  canDoOf,
  brandLine,
  match(lower, text) { return !!canDoOf(text); },
  run,
  suite() {
    const b = brandLine();
    const ok = !!canDoOf('what can this figure do') && b.name === 'Motelet' && /sits whenever it finds a chair/.test(b.line) && b.published === false && b.html === '' && canDoOf('summon a figure') === null;
    return { ok, got: b.line };
  }
};
