/**
 * noun-heat skill — "how hot are my nouns": reads the notes on this stage (sticky notes, notepads, list items) and the asks kept
 * on this device, counts how often each term is handled and how long ago it was last touched, and sorts them by heat. Burning =
 * contested (the word is in both a "yes" note and a "no" note), warm = handled often and lately, cold = neglected (last handled
 * long ago). Read-only: nothing is stored beyond the card, nothing is sent anywhere. Asked for by the owner (2026-10-18).
 */
import { escHtml, addThing, cardEl, firstOf, tidy } from '../lib/stage-pack.js';
import { words } from '../lib/stage-words.js';

const ASKS_KEY = 'a2m.void.asks.v1';
const ASK = /^(?:please\s+)?(?:how\s+hot\s+are\s+my\s+(?:nouns|terms|words)|(?:show|open|give)\s+(?:me\s+)?(?:my\s+|the\s+)?(?:noun|term)\s+heat(?:\s*map)?|noun\s+heat|temperature\s+of\s+my\s+(?:nouns|terms))(?:\s+please)?$/i;
const GENERIC = new Set('make show add open give get set put new note ask thing want need use list sticky stage'.split(' '));
const YES = /^\s*(?:yes|yep|yeah|do|keep|\+|✓|✔)\b\s*[:\-]?/i;
const NO = /^\s*(?:no|nope|don'?t|never|drop|skip|-|✗|✘)(?=\s|:|$)\s*[:\-]?/i;

/** is this an ask for the heat card? Pure. */
export function heatIntent(text) { return ASK.test(tidy(text)); }

/** 'yes' | 'no' | '' by how a note begins. Pure. */
export function polarity(text) {
  const t = String(text || '');
  if (YES.test(t)) return 'yes';
  if (NO.test(t)) return 'no';
  return '';
}

/** the entries to read, oldest first: the notes on the stage (in stage order), then the kept asks (stored newest first). Pure. */
export function entriesFrom(things, asks) {
  const out = [];
  for (const t of Object.values(things || {})) {
    if (!t) continue;
    if ((t.kind === 'sticky' || t.kind === 'notepad') && typeof t.text === 'string' && t.text.trim()) out.push({ text: t.text, src: 'note' });
    if (t.kind === 'list' && Array.isArray(t.items)) for (const it of t.items) { const s = typeof it === 'string' ? it : it && it.text; if (s && String(s).trim()) out.push({ text: String(s), src: 'note' }); }
  }
  for (const a of (asks || []).slice().reverse()) if (typeof a === 'string' && a.trim() && !heatIntent(a)) out.push({ text: a, src: 'ask' });
  return out;
}

/** terms ranked by heat. rows: { term, count, ago (entries since last handled, 0 = the newest), yes, no, label, heat }. Pure. */
export function heatOf(entries) {
  const N = (entries || []).length, by = new Map();
  (entries || []).forEach((e, i) => {
    const pol = e.pol !== undefined ? e.pol : polarity(e.text);
    for (const w of words(e.text)) {
      if (GENERIC.has(w) || w.length < 3) continue;
      const r = by.get(w) || { term: w, count: 0, last: -1, yes: 0, no: 0 };
      r.count++; r.last = i; if (pol === 'yes') r.yes++; else if (pol === 'no') r.no++;
      by.set(w, r);
    }
  });
  const rows = [];
  for (const r of by.values()) {
    const ago = N - 1 - r.last;
    const contested = r.yes > 0 && r.no > 0;
    const recent = N <= 1 ? 1 : 1 - ago / N;
    const heat = Math.round((r.count * (0.4 + recent) + (contested ? r.count + 2 : 0)) * 100) / 100;
    const label = contested ? 'burning' : (r.count >= 2 && recent > 0.5 ? 'warm' : 'cold');
    rows.push({ term: r.term, count: r.count, ago, yes: r.yes, no: r.no, label, heat });
  }
  return rows.sort((a, b) => b.heat - a.heat || b.count - a.count || a.term.localeCompare(b.term));
}

const COLOR = { burning: '#ff7a59', warm: '#ffb347', cold: '#8fb4ff' };

function readAsks() {
  try { const raw = JSON.parse(localStorage.getItem(ASKS_KEY) || '[]'); return Array.isArray(raw) ? raw : []; } catch (_) { return []; }
}

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'noun-heat');
  el.style.minWidth = '250px';
  const rows = th.rows || [];
  const head = document.createElement('div');
  head.innerHTML = '<b>Noun heat</b> · ' + escHtml(rows.length ? rows.length + ' terms, hottest first' : 'nothing on the stage to read yet: write a few notes, then ask again');
  head.style.marginBottom = '6px';
  el.appendChild(head);
  for (const r of rows.slice(0, 12)) {
    const row = document.createElement('div');
    row.className = 'nh-row'; row.dataset.term = r.term; row.dataset.label = r.label;
    row.style.cssText = 'display:flex;gap:8px;align-items:center;margin:3px 0;font-size:13px';
    row.innerHTML = '<span style="width:9px;height:9px;border-radius:50%;background:' + COLOR[r.label] + '"></span><b style="min-width:90px">' + escHtml(r.term) + '</b><span>' + escHtml(r.label) + '</span><span style="opacity:.65;font-size:11px">×' + r.count + ' · ' + (r.ago === 0 ? 'in the latest' : r.ago + ' back') + (r.label === 'burning' ? ' · yes ' + r.yes + ' / no ' + r.no : '') + '</span>';
    el.appendChild(row);
  }
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the stage kind's ask hook; the name of what happened, or '' */
export function ask(lower, text, stageApi) {
  if (!heatIntent(text)) return '';
  const rows = heatOf(entriesFrom(stageApi.things(), readAsks()));
  const old = firstOf(stageApi, 'nounheat');
  if (old) old.rows = rows; else addThing(stageApi, 'nounheat', { rows });
  const th = firstOf(stageApi, 'nounheat');
  stageApi.select(th.id); stageApi.save(); stageApi.render();
  return 'noun-heat';
}

export default {
  name: 'noun-heat',
  examples: ['how hot are my nouns', 'noun heat'],
  nearMisses: ['how hot is it today', 'what is a noun', 'how hot should the oven be'],
  heatIntent,
  match(lower, text) { return heatIntent(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'noun-heat' : 'none'; },
  stageKinds: { nounheat: { mount, ask } },
};
