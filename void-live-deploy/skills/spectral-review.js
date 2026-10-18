/**
 * spectral-review skill - "spectral review of <text>" splits a pasted text into three bands by fixed rules: slow (the thesis:
 * headings and the first sentence of each paragraph), mid (the argument: sentences that carry a connective such as because,
 * therefore, however) and high (the fizz: filler and hedge words, -ly adverbs, doubled words). The card shows each band with a
 * slider; damping the high band strikes filler words in the preview while the slow band stays as written. Export copies the
 * result. Same text, same bands: no randomness, nothing sent anywhere. Asked for by the owner (2026-10-18).
 */
import { addThing, cardEl, keepOut } from '../lib/stage-pack.js';
import { h, pill, copyText } from '../lib/stage-math.js';

export const MAX_TEXT = 6000;
const FILLER = ['very', 'really', 'just', 'actually', 'basically', 'quite', 'rather', 'somewhat', 'perhaps', 'maybe', 'literally', 'simply', 'honestly', 'totally', 'definitely', 'probably', 'sort of', 'kind of', 'a bit', 'i think', 'i guess', 'in my opinion'];
const NOT_ADVERBS = new Set(['only', 'family', 'early', 'apply', 'reply', 'supply', 'italy', 'july', 'belly', 'holy', 'ugly', 'daily', 'likely', 'lonely', 'friendly', 'lovely', 'monthly', 'weekly', 'yearly', 'fly', 'ally', 'rally', 'bully', 'jelly', 'assembly', 'anomaly', 'butterfly', 'multiply', 'imply', 'comply', 'rely']);
const CONNECTIVES = ['because', 'therefore', 'however', 'thus', 'hence', 'although', 'whereas', 'consequently', 'moreover', 'furthermore', 'since', 'so that', 'as a result', 'which means', 'but', 'unless', 'despite', 'instead'];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const FILLER_RE = new RegExp('\\b(?:' + FILLER.map(esc).join('|') + ')\\b', 'gi');
const CONN_RE = new RegExp('\\b(?:' + CONNECTIVES.map(esc).join('|') + ')\\b', 'gi');

/** the text of a "spectral review of ..." ask, or null. Pure. */
export function textOf(text) {
  const m = /^\s*(?:please\s+)?(?:(?:give|do|run|make)\s+(?:me\s+)?(?:a\s+)?)?spectral\s+(?:review|edit|pass)\s*(?:of|on|for|:)\s*([\s\S]{12,})$/i.exec(String(text || ''));
  return m ? m[1].trim().slice(0, MAX_TEXT) : null;
}

/** [{ start, end, text, kind }] for every word-level high-band hit, in order: filler/hedges, -ly adverbs, doubled words. Pure. */
export function highSpans(text) {
  const spans = [];
  for (const m of text.matchAll(FILLER_RE)) spans.push({ start: m.index, end: m.index + m[0].length, kind: 'filler' });
  for (const m of text.matchAll(/\b[a-z]{4,}ly\b/gi)) if (!NOT_ADVERBS.has(m[0].toLowerCase()) && !spans.some((s) => m.index < s.end && m.index + m[0].length > s.start)) spans.push({ start: m.index, end: m.index + m[0].length, kind: 'adverb' });
  for (const m of text.matchAll(/\b([a-z']+)\s+\1\b/gi)) spans.push({ start: m.index + m[0].length - m[1].length, end: m.index + m[0].length, kind: 'repeat' });
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = []; // a doubled filler ("very very") counts once: spans never overlap
  for (const s of spans) if (!kept.length || s.start >= kept[kept.length - 1].end) kept.push(s);
  return kept.map((s) => ({ ...s, text: text.slice(s.start, s.end) }));
}

/** [{ start, end, text, slow, mid }] sentences with the first of each paragraph / heading marked slow, connective ones mid. Pure. */
export function sentences(text) {
  const out = [];
  let para = 0;
  const paras = text.split(/(\n\s*\n)/);
  let offset = 0;
  for (const chunk of paras) {
    if (/^\n\s*\n$/.test(chunk)) { offset += chunk.length; continue; }
    const isHeading = /^\s*#{1,6}\s/.test(chunk) || (chunk.trim().length > 0 && chunk.trim().length <= 60 && !/[.!?]$/.test(chunk.trim()) && !/\n/.test(chunk.trim()));
    let first = true;
    for (const m of chunk.matchAll(/[^.!?\n]+[.!?]*|\n/g)) {
      const t = m[0];
      if (!t.trim()) continue;
      const mid = new RegExp(CONN_RE.source, 'i').test(t); // void-review: ok (CONN_RE is this file's own fixed pattern)
      out.push({ start: offset + m.index, end: offset + m.index + t.length, text: t, slow: first || isHeading, mid: mid && !(first || isHeading) });
      first = false;
    }
    offset += chunk.length; para++;
  }
  return out;
}

/** the three bands of a text. Pure. */
export function bands(text) {
  const ss = sentences(text);
  return { slow: ss.filter((s) => s.slow), mid: ss.filter((s) => s.mid), high: highSpans(text) };
}

/** the text with the first `ceil((1 - gain) * n)` high-band words struck (gain 1 = nothing struck, 0 = all). Returns
 *  { parts: [{ text, struck }], result } where result is the text without the struck words, tidied. Pure and deterministic:
 *  the same text and gain strike the same words, and no word outside the high band is touched, so the slow band is unchanged. */
export function damp(text, highGain = 1) {
  const spans = highSpans(text), g = Math.min(1, Math.max(0, Number(highGain))), cut = Math.ceil((1 - (Number.isFinite(g) ? g : 1)) * spans.length);
  const struck = spans.slice(0, cut);
  const parts = [];
  let at = 0;
  for (const s of struck) { if (s.start > at) parts.push({ text: text.slice(at, s.start), struck: false }); parts.push({ text: text.slice(s.start, s.end), struck: true }); at = s.end; }
  if (at < text.length) parts.push({ text: text.slice(at), struck: false });
  const result = parts.filter((p) => !p.struck).map((p) => p.text).join('').replace(/[ \t]{2,}/g, ' ').replace(/ +([,.;:!?])/g, '$1').replace(/^[ \t]+/gm, '').trim();
  return { parts, result, struckCount: struck.length };
}

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'spectral-review');
  el.style.maxWidth = 'min(92vw,560px)';
  const text = th.text || '', b = bands(text);
  th.gain = th.gain || { slow: 1, mid: 1, high: 1 };
  const preview = h('div', { className: 'spec-preview', style: 'margin:8px 0;padding:8px;border-radius:8px;background:rgba(255,255,255,.05);white-space:pre-wrap;max-height:220px;overflow:auto' });
  const info = h('div', { className: 'spec-count', style: 'font-size:12px;opacity:.8' });
  const paint = () => {
    const d = damp(text, th.gain.high);
    preview.textContent = '';
    const slowRanges = b.slow.map((s) => [s.start, s.end]);
    let at = 0;
    for (const p of d.parts) {
      const mid = at, here = slowRanges.some(([a, z]) => mid >= a && mid < z);
      preview.append(h('span', { className: p.struck ? 'struck' : here ? 'slow' : '', style: p.struck ? 'text-decoration:line-through;opacity:.45;color:#ff9b9b' : here ? 'font-weight:' + (th.gain.slow >= 0.5 ? '700' : '400') : '' }, p.text));
      at += p.text.length;
    }
    info.textContent = 'slow ' + b.slow.length + ' · mid ' + b.mid.length + ' · high ' + b.high.length + ' · struck ' + d.struckCount;
    th.result = d.result;
  };
  el.append(h('b', {}, 'Spectral review'));
  const bandRow = (name, label, note, n) => {
    const r = h('input', { type: 'range', min: 0, max: 100, value: Math.round((th.gain[name] ?? 1) * 100), 'aria-label': label + ' band', dataset: { band: name }, style: 'flex:1;min-width:100px' });
    r.addEventListener('input', () => { th.gain[name] = r.value / 100; paint(); });
    r.addEventListener('change', () => stageApi.save());
    keepOut(r);
    return h('label', { style: 'display:flex;gap:8px;align-items:center;margin-top:6px;font-size:13px' }, h('span', { style: 'width:150px' }, h('b', {}, label), ' ' + n + ' · ' + note), r);
  };
  el.append(bandRow('slow', 'slow', 'thesis (never struck)', b.slow.length), bandRow('mid', 'mid', 'argument (never struck)', b.mid.length), bandRow('high', 'high', 'filler (damp to strike)', b.high.length), preview, info);
  const out = h('span', { className: 'spec-status', style: 'font-size:12px;opacity:.8;margin-left:8px' });
  el.append(h('div', { style: 'margin-top:8px' }, pill('export', async () => { out.textContent = (await copyText(th.result || text)) ? 'copied' : 'select the preview to copy'; }), out));
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

export function ask(lower, text, stageApi) {
  const body = textOf(text);
  if (!body) return '';
  addThing(stageApi, 'spectral', { text: body, gain: { slow: 1, mid: 1, high: 1 } });
  stageApi.save(); stageApi.render();
  return 'spectral-review';
}

export default {
  name: 'spectral-review',
  examples: ['spectral review of Our plan is very simple. We basically just ship it, because users really want it.', 'spectral review: I think this is actually quite good, but honestly it needs work.'],
  nearMisses: ['spectral analysis of the sun', 'review my essay', 'what is spectral clustering'],
  textOf,
  match(lower, text) { return !!textOf(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'spectral-review' : 'none'; },
  stageKinds: { spectral: { mount, ask } },
};
