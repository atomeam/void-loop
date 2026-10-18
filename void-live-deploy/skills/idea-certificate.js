/**
 * idea-certificate skill — "keep this idea: <idea> | why: <one sentence> | parent: <ask> | rejected: <a>; <b>" issues a certificate
 * card: the time, the parent ask if given, the alternatives rejected, and the one sentence on why the idea deserved to live. No
 * "why" sentence, no certificate. A kept idea is buried only with a death note ("bury idea <words> | death note: <why>"); the
 * certificate stays on the card struck through with the note. Kept with the stage on this device; nothing is sent anywhere.
 * Asked for by the owner (2026-10-18).
 */
import { escHtml, addThing, cardEl, keepOut, firstOf, tidy } from '../lib/stage-pack.js';
import { words, sameThing } from '../lib/stage-words.js';

const MAX_CERTS = 30;
const KEEP = /^(?:please\s+)?keep\s+(?:this|my|that)\s+idea\s*[:\-]\s*(.+)$/i;
const BURY = /^(?:please\s+)?(?:bury|delete|drop|retire)\s+(?:my\s+|the\s+|that\s+)?(?:kept\s+)?idea\s*[:\-]?\s*(.+)$/i;
const SHOW = /^(?:please\s+)?(?:show|open|bring\s+up)\s+(?:me\s+)?(?:my\s+|the\s+)?(?:idea\s+certificates?|kept\s+ideas)(?:\s+please)?$/i;

const field = (parts, name) => { const re = new RegExp('^' + name + '\\s*[:=]\\s*(.+)$', 'i'); for (const p of parts) { const m = re.exec(p.trim()); if (m) return m[1].trim(); } return ''; };

/** what an ask wants: { act:'keep', idea, why, parent, rejected[] } | { act:'bury', about, note } | { act:'show' } | null. Pure. */
export function certIntent(text) {
  const t = tidy(text);
  let m;
  if ((m = KEEP.exec(t))) {
    const parts = m[1].split(/\s*\|\s*/), idea = parts[0].trim().slice(0, 200);
    if (!words(idea).length) return null;
    const rejected = field(parts, 'rejected').split(/\s*[;]\s*/).map((s) => s.trim().slice(0, 100)).filter(Boolean).slice(0, 6);
    return { act: 'keep', idea, why: field(parts, 'why').slice(0, 240), parent: field(parts, 'parent').slice(0, 160), rejected };
  }
  if ((m = BURY.exec(t))) {
    const parts = m[1].split(/\s*\|\s*/), about = parts[0].trim();
    return words(about).length || /^#?\d{1,3}$/.test(about) ?{ act: 'bury', about, note: field(parts, 'death note').slice(0, 240) } : null;
  }
  if (SHOW.test(t)) return { act: 'show' };
  return null;
}

/** issue a certificate, or refuse with the reason (no "why" sentence, or the same idea is already kept). Pure. */
export function issue(certs, req, now = Date.now()) {
  const list = (certs || []).map((c) => ({ ...c }));
  if (!req || !String(req.why || '').trim() || words(req.why).length < 3) return { ok: false, reason: 'a certificate needs one sentence on why this idea deserves to live: add "| why: ..."', certs: list };
  if (list.some((c) => !c.dead && sameThing(c.idea, req.idea))) return { ok: false, reason: 'that idea is already kept', certs: list };
  const cert = { n: (list.reduce((mx, c) => Math.max(mx, c.n || 0), 0)) + 1, idea: req.idea, why: req.why.trim(), parent: req.parent || '', rejected: req.rejected || [], at: now, dead: null };
  return { ok: true, cert, certs: list.concat(cert).slice(-MAX_CERTS) };
}

/** bury a kept idea (by number or by words). It needs a death note; without one nothing changes. Pure. */
export function bury(certs, about, note, now = Date.now()) {
  const list = (certs || []).map((c) => ({ ...c }));
  const n = /^#?(\d{1,3})$/.exec(String(about).trim());
  const i = n ? list.findIndex((c) => c.n === +n[1] && !c.dead) : list.findIndex((c) => !c.dead && sameThing(c.idea, about, 0.5));
  if (i < 0) return { ok: false, reason: 'no kept idea like that', certs: list };
  if (!String(note || '').trim() || words(note).length < 2) return { ok: false, reason: 'a kept idea is buried only with a death note: add "| death note: ..."', certs: list };
  list[i].dead = { note: String(note).trim(), at: now };
  return { ok: true, cert: list[i], certs: list };
}

const when = (t) => { try { return new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'; } catch (_) { return ''; } };

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'idea-certificate');
  el.style.border = '2px double rgba(255,209,102,.6)'; el.style.minWidth = '280px';
  const live = th.certs.filter((c) => !c.dead);
  const head = document.createElement('div');
  head.innerHTML = '<b>Idea certificates</b> · ' + escHtml(live.length + ' kept' + (th.certs.length > live.length ? ', ' + (th.certs.length - live.length) + ' buried' : ''));
  head.style.marginBottom = '6px';
  el.appendChild(head);
  for (const c of th.certs) {
    const box = document.createElement('div');
    box.className = 'ic-cert'; box.dataset.n = String(c.n); box.dataset.dead = c.dead ? '1' : '';
    box.style.cssText = 'margin:6px 0;padding:8px;border-radius:8px;background:rgba(255,255,255,.05)' + (c.dead ? ';opacity:.6' : '');
    box.innerHTML = '<div style="' + (c.dead ? 'text-decoration:line-through;' : '') + 'font-weight:600">#' + c.n + ' ' + escHtml(c.idea) + '</div>'
      + '<div style="font-size:11px;opacity:.7">issued ' + escHtml(when(c.at)) + (c.parent ? ' · from: ' + escHtml(c.parent) : '') + '</div>'
      + '<div style="font-size:13px">why it lives: ' + escHtml(c.why) + '</div>'
      + (c.rejected && c.rejected.length ? '<div style="font-size:12px;opacity:.8">rejected: ' + c.rejected.map(escHtml).join(' · ') + '</div>' : '')
      + (c.dead ? '<div class="ic-death" style="font-size:12px;color:#ff9b9b">death note (' + escHtml(when(c.dead.at)) + '): ' + escHtml(c.dead.note) + '</div>' : '');
    if (!c.dead) {
      const inp = document.createElement('input'); inp.placeholder = 'death note, then Enter to bury'; inp.setAttribute('aria-label', 'death note for idea ' + c.n);
      inp.style.cssText = 'margin-top:4px;width:100%;box-sizing:border-box;font:12px system-ui;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:2px 4px';
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { const r = bury(th.certs, '#' + c.n, inp.value); if (r.ok) { th.certs = r.certs; stageApi.save(); stageApi.render(); } else stageApi.say(r.reason); } });
      keepOut(inp); box.appendChild(inp);
    }
    el.appendChild(box);
  }
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the stage kind's ask hook; the name of what happened, or '' */
export function ask(lower, text, stageApi) {
  const it = certIntent(text);
  if (!it) return '';
  let th = firstOf(stageApi, 'ideacert');
  if (it.act === 'keep') {
    const r = issue(th ? th.certs : [], it);
    if (!r.ok) { stageApi.say(r.reason); return 'idea-certificate-refused'; }
    if (!th) th = addThing(stageApi, 'ideacert', { certs: [] });
    th.certs = r.certs; stageApi.say('certificate #' + r.cert.n + ' issued');
  } else if (it.act === 'bury') {
    const r = bury(th ? th.certs : [], it.about, it.note);
    if (!r.ok) { if (!/death note/.test(r.reason)) return ''; stageApi.say(r.reason); return 'idea-certificate-refused'; }
    th.certs = r.certs; stageApi.say('idea buried with its death note');
  } else if (!th) {
    th = addThing(stageApi, 'ideacert', { certs: [] });
  }
  stageApi.select(th.id); stageApi.save(); stageApi.render();
  return 'idea-certificate';
}

/** a bury ask is ours only when a certificate is saved on this device's stage ("drop idea of a trip" is left alone otherwise). */
export function hasSavedCerts(store) {
  try {
    const bag = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    const saved = JSON.parse((bag && bag.getItem('a2m.void.state.v1')) || '{}');
    return Object.values(saved || {}).some((t) => t && t.kind === 'ideacert' && (t.certs || []).some((c) => !c.dead));
  } catch (_) { return false; }
}

export default {
  name: 'idea-certificate',
  examples: ['keep this idea: a stage that remembers | why: it makes coming back feel like home', 'show my idea certificates'],
  nearMisses: ['what is a certificate', 'keep this note', 'bury the lede'],
  certIntent,
  match(lower, text) { const it = certIntent(text || lower); return !!it && (it.act !== 'bury' || hasSavedCerts()); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'idea-certificate' : 'none'; },
  stageKinds: { ideacert: { mount, ask } },
};
