/**
 * pulse skill - the live rhythm of the living arrows (asked by Verse, 2026-10-16: "a 'pulse' visualizer card that shows the live
 * rhythm of added living arrows on the stage", and "integrate the pulse recording data with the 'incident' skill so that irregular
 * pulses automatically generate a status report"). skills/label.js records each hand-over along an arrow the moment it happens
 * (lib/pulse.js); this card draws the last minute as twelve bars, says how many and whether the rhythm is steady, and when it
 * turns irregular (a stall, a burst, uneven gaps) drafts an incident brief from the pulses (skills/incident.js keepDraft) and links
 * it: "write an incident brief" opens the draft. "show the pulse", "pulse card", "pulse of my arrows". Nothing leaves the browser.
 */
import { record, bars, rhythm, irregular, reportOf } from '../lib/pulse.js';
import { keepDraft } from './incident.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
/** the ask wants the pulse card. Pure. */
export const pulseOf = (text) => /^(?:(?:show|open|make|add|give)\s+(?:me\s+)?(?:the\s+|a\s+|my\s+)?)?(?:pulse(?:\s+card)?|pulse\s+of\s+(?:my\s+|the\s+)?arrows|arrow\s+pulse|(?:the\s+)?rhythm\s+of\s+(?:my\s+|the\s+)?arrows)$/.test(CLEAN(text));

/** the card's inner markup for a pulse list at a time: bars as an svg, the count and the verdict. Pure; numbers and fixed words only. */
export function pulseHtml(esc, list, now) {
  const b = bars(list, now), top = Math.max(1, ...b), r = rhythm(list, now), irr = irregular(list, now);
  const svg = '<svg viewBox="0 0 120 40" width="100%" height="48" role="img" aria-label="pulses per 5 seconds over the last minute: ' + b.join(', ') + '">'
    + b.map((n, i) => '<rect x="' + (i * 10 + 1) + '" y="' + (40 - Math.round((n / top) * 38) - (n ? 0 : -1)) + '" width="8" height="' + (n ? Math.round((n / top) * 38) : 1) + '" rx="1" fill="currentColor" opacity="' + (n ? 0.9 : 0.25) + '"/>').join('') + '</svg>';
  const verdict = irr ? 'irregular (' + irr.kind + '): ' + irr.why : r.count < 5 ? 'too few to call the rhythm yet (needs 5)' : 'steady';
  return '<div class="pulse-head">pulse</div>' + svg + '<div class="pulse-line" data-pulse="' + (irr ? irr.kind : r.count < 5 ? 'few' : 'steady') + '">' + esc(String(r.perMin)) + ' in the last minute · ' + esc(verdict) + '</div>';
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing pulse-card'; el.dataset.id = th.id; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'pulse of the living arrows');
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:200px;padding:8px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(20,20,30,.75);font-size:12px';
  const body = document.createElement('div'); el.appendChild(body);
  const note = document.createElement('div'); note.className = 'pulse-report'; note.style.cssText = 'margin-top:4px;font-size:11px'; el.appendChild(note);
  let last = '', drafted = false, tick = 0;
  const draw = () => {
    if (!el.isConnected) { clearInterval(tick); document.removeEventListener('void:pulse', draw); return; }
    const now = Date.now(), list = record(), irr = irregular(list, now);
    body.innerHTML = pulseHtml((t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]), list, now); // void-review: ok: pulseHtml escapes its words and writes numbers
    const key = irr ? irr.kind : '';
    if (irr && key !== last && !drafted) { // a new irregular rhythm: the incident skill gets a status report drafted for it
      drafted = keepDraft(reportOf(irr, list, now));
      note.innerHTML = '';
      if (drafted) { const a = document.createElement('a'); a.href = '#'; a.dataset.ask = 'write an incident brief'; a.textContent = 'status report drafted: open the incident brief'; a.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (stageApi.ask) stageApi.ask('write an incident brief'); }); note.appendChild(a); }
    }
    if (!irr) drafted = false;
    last = key;
  };
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  tick = setInterval(draw, 2000);
  document.addEventListener('void:pulse', draw);
  draw();
}

async function run(text, api) {
  if (!pulseOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'pulse');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'pulse'; }
  api.summon('pulse', { x: 40, y: 80 });
  api.say('the pulse of your living arrows · it fills as things hand values along arrows');
  return 'pulse';
}

export default {
  name: 'pulse',
  examples: ['show the pulse', 'pulse card', 'pulse of my arrows'],
  nearMisses: ['take my pulse', 'what is a pulse', 'pulse oximeter', 'pulse width modulation'],
  match(lower, text) { return pulseOf(text || lower); },
  run,
  pulseOf, pulseHtml,
  stageKinds: { pulse: { mount } },
};
