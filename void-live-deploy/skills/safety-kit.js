/**
 * safety-kit skill — ten small safety and trust tools, all opt-in and all on this device (asked for by the owner, 2026-10-18):
 * "unverified: <claim>" puts a claim on the stage with an Unverified badge you can turn to Checked; "hide numbers" turns every
 * digit on the stage into a dot until "show numbers"; "redact selection" blacks out the text you selected; "panic" (or "hide the
 * stage") covers the whole page with a blank screen until a tap or Esc; "set a pin" puts a PIN-lock card on the stage and
 * "lock now" locks behind it; "auto lock after 5 minutes" locks when you have been idle; "clear my clipboard" empties it;
 * "ephemeral mode" makes this tab forget what you do in it; "confirm before mass delete" asks before clearing the stage or
 * removing several things at once. Nothing shows until asked and nothing is sent anywhere.
 * The PIN lock is a casual lock: the PIN is kept hashed (PBKDF2) in this browser, so it keeps a passer-by from reading the
 * stage and does nothing against someone with the browser's tools. It is not encryption, and the card says so.
 * Pure logic: lib/safety.js (tests: tools/tools-pack-8.test.mjs). The mass-delete question itself is asked by void.html (massOk).
 */
import { escHtml, addThing, firstOf, cardEl, keepOut } from '../lib/stage-pack.js';
import { safetyIntent, maskDigits, redactText, claimState, pinOk, makeSalt, hashPin, checkPin, idleDue } from '../lib/safety.js';

const KEY = 'a2m.void.safety.v1', EPH = 'a2m.void.eph.v1', STATE_KEY = 'a2m.void.state.v1', UNDO_KEY = 'a2m.void.undo.v1';
const doc = typeof document !== 'undefined' ? document : null;

function read() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; } }
function write(patch) { const s = { ...read(), ...patch }; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} return s; }
const stageEl = () => (doc ? doc.getElementById('stage') : null);

// ---------- hide numbers ----------
const maskedNodes = []; const origText = new WeakMap(); let numObs = null, numBusy = false, numFocus = false;
const editing = (n) => { const a = doc.activeElement; return !!(a && a !== doc.body && a.isContentEditable && a.contains(n)); }; // a note being typed in keeps its real digits: the page saves what the note shows
function maskNode(n) {
  if (editing(n)) return;
  const v = n.nodeValue;
  if (!/\d/.test(v)) return;
  if (!origText.has(n)) maskedNodes.push(n);
  origText.set(n, v); n.nodeValue = maskDigits(v);
}
function maskTree(root) {
  const w = doc.createTreeWalker(root, 4 /* SHOW_TEXT */);
  let n; const list = [];
  while ((n = w.nextNode())) { const p = n.parentNode; if (p && /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName)) continue; list.push(n); }
  numBusy = true; try { for (const t of list) { if (origText.has(t) && t.nodeValue === maskDigits(origText.get(t))) continue; maskNode(t); } } finally { numBusy = false; }
}
function numbersOn(on) {
  const st = stageEl(); if (!st) return;
  doc.body.classList.toggle('sf-nums', !!on);
  let chip = doc.getElementById('sf-nums-chip');
  if (!on) {
    if (numObs) { numObs.disconnect(); numObs = null; }
    numBusy = true; try { for (const n of maskedNodes.splice(0)) if (origText.has(n)) { if (n.nodeValue === maskDigits(origText.get(n))) n.nodeValue = origText.get(n); origText.delete(n); } } finally { numBusy = false; }
    if (chip) chip.remove();
    return;
  }
  if (!doc.getElementById('sf-style')) { const s = doc.createElement('style'); s.id = 'sf-style'; s.textContent = 'body.sf-nums #stage input,body.sf-nums #stage textarea{-webkit-text-security:disc}.sf-redact{background:#000;color:#000;border-radius:2px;box-shadow:0 0 0 1px #000}'; doc.head.appendChild(s); }
  maskTree(st);
  numObs = new MutationObserver((muts) => {
    if (numBusy) return;
    for (const m of muts) {
      if (m.type === 'characterData') { if (!(origText.has(m.target) && m.target.nodeValue === maskDigits(origText.get(m.target)))) { numBusy = true; try { maskNode(m.target); } finally { numBusy = false; } } }
      else for (const a of m.addedNodes) { if (a.nodeType === 3) { numBusy = true; try { maskNode(a); } finally { numBusy = false; } } else if (a.nodeType === 1) maskTree(a); }
    }
  });
  numObs.observe(st, { subtree: true, childList: true, characterData: true });
  if (!numFocus) {
    numFocus = true;
    st.addEventListener('focusin', (e) => { // typing into a masked note: give that note its digits back first
      if (!numObs) return;
      const t = e.target; numBusy = true;
      try { for (const n of maskedNodes) if (t.contains && t.contains(n) && origText.has(n) && n.nodeValue === maskDigits(origText.get(n))) n.nodeValue = origText.get(n); } finally { numBusy = false; }
    });
    st.addEventListener('focusout', () => setTimeout(() => { if (numObs) { numBusy = true; try { for (const n of maskedNodes) if (n.isConnected && origText.has(n) && n.nodeValue !== maskDigits(n.nodeValue)) { origText.set(n, n.nodeValue); n.nodeValue = maskDigits(n.nodeValue); } } finally { numBusy = false; } } }, 0));
  }
  if (!chip) {
    chip = doc.createElement('button'); chip.type = 'button'; chip.id = 'sf-nums-chip'; chip.textContent = 'numbers hidden · show';
    chip.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:60;font:12px system-ui,sans-serif;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(10,10,16,.85);color:#ddd;cursor:pointer';
    chip.addEventListener('click', () => { write({ numbers: false }); numbersOn(false); });
    doc.body.appendChild(chip);
  }
}

// ---------- redact the selection ----------
let lastSel = null;
if (doc) doc.addEventListener('selectionchange', () => {
  try {
    const s = doc.getSelection(), st = stageEl();
    if (s && s.rangeCount && !s.isCollapsed && st && st.contains(s.anchorNode) && st.contains(s.focusNode) && String(s).trim()) lastSel = s.getRangeAt(0).cloneRange();
  } catch (_) {}
});
const redactions = [];
function redactRange(range) {
  const root = range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer;
  const nodes = [];
  if (range.commonAncestorContainer.nodeType === 3) nodes.push(range.commonAncestorContainer);
  else { const w = doc.createTreeWalker(root, 4); let n; while ((n = w.nextNode())) if (range.intersectsNode(n) && n.nodeValue.trim() && !(n.parentNode.closest && n.parentNode.closest('.sf-redact'))) nodes.push(n); }
  let count = 0;
  for (const n of nodes) {
    let a = n === range.startContainer ? range.startOffset : 0, b = n === range.endContainer ? range.endOffset : n.nodeValue.length;
    if (b <= a) continue;
    const mid = n.splitText(a); if (b - a < mid.nodeValue.length) mid.splitText(b - a);
    const span = doc.createElement('span'); span.className = 'sf-redact'; span.dataset.redacted = '1';
    span.title = 'redacted · not saved: it clears when the card is redrawn';
    redactions.push({ span, text: mid.nodeValue });
    span.textContent = redactText(mid.nodeValue);
    mid.parentNode.replaceChild(span, mid); count++;
  }
  return count;
}
// a note you click into to type shows its real words again first, so what the page saves is never the blocks
if (doc) doc.addEventListener('focusin', (e) => {
  for (let i = redactions.length - 1; i >= 0; i--) { const r = redactions[i]; if (r.span.isConnected && e.target && e.target.contains && e.target.contains(r.span)) { r.span.replaceWith(doc.createTextNode(r.text)); redactions.splice(i, 1); } }
});
function unredact() { let n = 0; for (const r of redactions.splice(0)) if (r.span.isConnected) { r.span.replaceWith(doc.createTextNode(r.text)); n++; } return n; }

// ---------- panic ----------
function panic(on) {
  let o = doc.getElementById('sf-panic');
  if (!on) { if (o) o.remove(); return; }
  if (o) return;
  o = doc.createElement('div'); o.id = 'sf-panic'; o.setAttribute('role', 'button'); o.setAttribute('aria-label', 'Show the stage again'); o.tabIndex = 0;
  o.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#0a0a0d;cursor:pointer';
  const back = () => { panic(false); doc.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); back(); } };
  o.addEventListener('click', back); doc.addEventListener('keydown', onKey, true);
  doc.body.appendChild(o); o.focus();
}

// ---------- the casual lock ----------
let idleTimer = null, lastActive = Date.now(), locked = false;
const inertSaved = [];
async function lockNow() {
  if (!doc || locked || doc.getElementById('sf-lock')) return;
  locked = true; write({ locked: true });
  const rec = read().pin;
  const o = doc.createElement('div'); o.id = 'sf-lock'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Locked');
  o.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#0a0a0d;color:#e8e8e8;display:flex;align-items:center;justify-content:center;font:16px system-ui,sans-serif';
  o.innerHTML = '<form style="display:flex;flex-direction:column;gap:10px;align-items:center"><div>Locked</div>'
    + (rec ? '<input type="password" inputmode="numeric" autocomplete="off" aria-label="PIN" style="font:inherit;padding:8px 10px;border-radius:8px;border:1px solid #666;background:#15151c;color:#fff;text-align:center">' : '')
    + '<button type="submit" style="font:inherit;padding:8px 16px;border-radius:8px;border:1px solid #666;background:#1d1d27;color:#fff;cursor:pointer">Unlock</button><div class="sf-err" role="alert" style="min-height:1.2em;color:#ff9a9a;font-size:13px"></div></form>';
  for (const el of Array.from(doc.body.children)) if (!el.inert) { el.inert = true; inertSaved.push(el); }
  doc.body.appendChild(o);
  const inp = o.querySelector('input'); (inp || o.querySelector('button')).focus();
  o.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (rec) {
      let ok = false; try { ok = await checkPin(inp.value, rec, crypto); } catch (_) {}
      if (!ok) { o.querySelector('.sf-err').textContent = 'That is not the PIN.'; inp.value = ''; inp.focus(); return; }
    }
    unlock();
  });
}
function unlock() {
  const o = doc.getElementById('sf-lock'); if (o) o.remove();
  for (const el of inertSaved.splice(0)) el.inert = false;
  locked = false; write({ locked: false }); lastActive = Date.now();
}
function armAutolock(minutes) {
  if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
  if (!minutes || !doc) return;
  lastActive = Date.now();
  idleTimer = setInterval(() => { if (!locked && idleDue(lastActive, Date.now(), read().autolock)) lockNow(); }, 5000);
}
if (doc) for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel']) doc.addEventListener(ev, () => { if (!locked) lastActive = Date.now(); }, { passive: true, capture: true });

// ---------- ephemeral session ----------
let ephArmed = false;
function ephOn() {
  try { if (!sessionStorage.getItem(EPH)) sessionStorage.setItem(EPH, JSON.stringify({ state: localStorage.getItem(STATE_KEY), undo: localStorage.getItem(UNDO_KEY) })); } catch (_) {}
  armEph();
}
// Leaving the tab fires pagehide and then a hidden visibilitychange; the page saves the stage on that second one, so the
// snapshot goes back at both (and only when the tab is really going away, not on a switch to another tab)
let leaving = false;
const onHide = () => { leaving = true; ephRestore(); };
const onVis = () => { if (leaving && doc.visibilityState === 'hidden') ephRestore(); };
const onShow = () => { leaving = false; };
function armEph() { if (ephArmed || !doc) return; ephArmed = true; addEventListener('pagehide', onHide); doc.addEventListener('visibilitychange', onVis); addEventListener('pageshow', onShow); }
function ephRestore() {
  try {
    const snap = JSON.parse(sessionStorage.getItem(EPH) || 'null'); if (!snap) return;
    for (const [k, v] of [[STATE_KEY, snap.state], [UNDO_KEY, snap.undo]]) { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); }
  } catch (_) {}
}
function ephOff() { try { sessionStorage.removeItem(EPH); } catch (_) {} if (ephArmed) { removeEventListener('pagehide', onHide); doc.removeEventListener('visibilitychange', onVis); removeEventListener('pageshow', onShow); ephArmed = false; leaving = false; } }

// ---------- cards: the unverified claim and the PIN-lock settings ----------
function mountClaim(th, stageApi) {
  const el = cardEl(th, stageApi, 'claim-card');
  const s = claimState(th);
  el.dataset.checked = s.checked ? '1' : '0';
  const badge = '<span class="claim-badge" style="display:inline-block;font:700 11px system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:999px;'
    + (s.checked ? 'background:#1f4d2e;color:#bff0cc' : 'background:#5a4300;color:#ffd978') + '">' + s.label + '</span>';
  el.innerHTML = '<div style="margin-bottom:6px">' + badge + '</div><div class="claim-text" style="font-size:15px">' + escHtml(th.text) + '</div>'
    + '<div style="display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap"><input class="claim-note" aria-label="where did you check it" placeholder="where I checked it (optional)" maxlength="200" style="flex:1;min-width:140px;font:inherit;font-size:13px;padding:5px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.3);color:#e8e8e8">'
    + '<button type="button" class="claim-toggle" style="font:inherit;font-size:13px;padding:5px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#e8e8e8;cursor:pointer">' + (s.checked ? 'Mark unverified again' : 'Mark as checked') + '</button></div>';
  const note = el.querySelector('.claim-note'); note.value = s.note;
  note.addEventListener('change', () => { th.note = note.value.slice(0, 200); stageApi.save(); });
  el.querySelector('.claim-toggle').addEventListener('click', (e) => { e.stopPropagation(); th.note = note.value.slice(0, 200); th.checked = !th.checked; stageApi.save(); stageApi.render(); });
  keepOut(note); keepOut(el.querySelector('.claim-toggle'));
  stageApi.bindDrag(el, th); stageApi.stage.appendChild(el);
}

const AUTO = [0, 1, 5, 15, 30, 60];
function mountPin(th, stageApi) {
  const el = cardEl(th, stageApi, 'pin-card');
  const has = !!read().pin, cur = read().autolock || 0;
  const btn = 'font:inherit;font-size:13px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#e8e8e8;cursor:pointer';
  el.innerHTML = '<div style="font-weight:600;margin-bottom:6px">PIN lock</div>'
    + '<div class="pin-state" style="font-size:13px;opacity:.85;margin-bottom:8px">' + (has ? 'A PIN is set on this device.' : 'No PIN yet: lock now only needs a tap.') + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><input class="pin-new" type="password" inputmode="numeric" autocomplete="off" maxlength="12" placeholder="new PIN, 4 to 12" aria-label="new PIN" style="width:150px;font:inherit;font-size:13px;padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.3);color:#e8e8e8">'
    + '<button type="button" class="pin-set" style="' + btn + '">Set PIN</button>' + (has ? '<button type="button" class="pin-clear" style="' + btn + '">Remove PIN</button>' : '') + '</div>'
    + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px"><label style="font-size:13px">Lock when idle <select class="pin-auto" style="font:inherit;font-size:13px;margin-left:4px">'
    + AUTO.map((m) => '<option value="' + m + '"' + (m === cur ? ' selected' : '') + '>' + (m ? m + ' min' : 'never') + '</option>').join('') + '</select></label>'
    + '<button type="button" class="pin-lock" style="' + btn + '">Lock now</button><button type="button" class="pin-clip" style="' + btn + '">Clear clipboard</button></div>'
    + '<div class="pin-msg" role="status" style="min-height:1.2em;font-size:12px;margin-top:8px;color:#9fd0ff"></div>'
    + '<div style="font-size:11px;opacity:.65;margin-top:6px;max-width:340px">A casual lock: it keeps a passer-by from reading the stage. The PIN is kept hashed on this device only, and anyone using the browser’s own tools can get past it. It is not encryption.</div>';
  const msg = (t) => { el.querySelector('.pin-msg').textContent = t; };
  const inp = el.querySelector('.pin-new');
  el.querySelector('.pin-set').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!pinOk(inp.value)) { msg('A PIN is 4 to 12 characters.'); return; }
    const salt = makeSalt(crypto); write({ pin: { salt, hash: await hashPin(inp.value, salt, crypto) } }); inp.value = '';
    stageApi.render(); const c = stageApi.stage.querySelector('.pin-card .pin-msg'); if (c) c.textContent = 'PIN set.';
  });
  const clr = el.querySelector('.pin-clear'); if (clr) clr.addEventListener('click', (e) => { e.stopPropagation(); write({ pin: null }); stageApi.render(); });
  el.querySelector('.pin-auto').addEventListener('change', (e) => { const m = +e.target.value; write({ autolock: m }); armAutolock(m); msg(m ? 'Will lock after ' + m + ' idle minute' + (m === 1 ? '' : 's') + '.' : 'Auto-lock is off.'); });
  el.querySelector('.pin-lock').addEventListener('click', (e) => { e.stopPropagation(); lockNow(); });
  el.querySelector('.pin-clip').addEventListener('click', async (e) => { e.stopPropagation(); msg(await clearClipboard()); });
  for (const n of el.querySelectorAll('input,select,button')) keepOut(n);
  stageApi.bindDrag(el, th); stageApi.stage.appendChild(el);
}

async function clearClipboard() {
  try { await navigator.clipboard.writeText(''); return 'Clipboard cleared.'; } catch (_) { return 'Your browser would not let me clear the clipboard from here. Press "Clear clipboard" on the PIN-lock card (say "set a pin" to open it).'; }
}

/** carry out one safety ask; returns the sentence to say, or '' when the ask is not one of ours */
export async function ask(text, stageApi) {
  const it = safetyIntent(text);
  if (!it) return '';
  switch (it.op) {
    case 'numbers': write({ numbers: it.on }); numbersOn(it.on); return it.on ? 'numbers hidden · say "show numbers" to bring them back' : 'numbers shown';
    case 'redact': {
      if (!lastSel) return 'Select some text on the stage first, then say "redact selection".';
      const n = redactRange(lastSel); lastSel = null;
      try { doc.getSelection().removeAllRanges(); } catch (_) {}
      return n ? 'redacted ' + n + ' piece' + (n === 1 ? '' : 's') + ' of text for this view · "unredact" brings it back, and it clears when the card is redrawn' : 'Nothing to redact there.';
    }
    case 'unredact': { const n = unredact(); return n ? 'redactions removed' : 'nothing redacted'; }
    case 'panic': panic(true); return '';
    case 'lock': lockNow(); return '';
    case 'pincard': { const th = firstOf(stageApi, 'pinlock') || addThing(stageApi, 'pinlock', {}); stageApi.select(th.id); stageApi.save(); stageApi.render(); return 'PIN lock card · a casual lock, not encryption'; }
    case 'autolock': write({ autolock: it.minutes }); armAutolock(it.minutes); return it.minutes ? 'will lock after ' + it.minutes + ' idle minute' + (it.minutes === 1 ? '' : 's') + (read().pin ? '' : ' · no PIN set, so a tap unlocks') : 'auto-lock off';
    case 'clipboard': return await clearClipboard();
    case 'ephemeral': if (it.on) { ephOn(); return 'ephemeral mode · closing or reloading this tab puts the stage back as it is now'; } ephOff(); return 'ephemeral mode off · this stage is kept again';
    case 'confirm': write({ confirmMass: it.on }); return it.on ? 'I will ask before clearing the stage or removing several things' : 'no more questions before clearing';
    case 'claim': { const th = addThing(stageApi, 'claim', { text: it.text, checked: false, note: '' }); stageApi.select(th.id); stageApi.save(); stageApi.render(); return 'unverified until you check it'; }
    default: return '';
  }
}

// settings kept on this device come back as the page loads
if (doc) {
  const apply = () => {
    const s = read();
    if (s.numbers) numbersOn(true);
    if (s.autolock) armAutolock(s.autolock);
    if (s.locked) lockNow();
    try { if (sessionStorage.getItem(EPH)) armEph(); } catch (_) {}
  };
  if (stageEl()) apply(); else doc.addEventListener('DOMContentLoaded', apply, { once: true });
}

export default {
  name: 'safety-kit',
  examples: ['hide numbers', 'redact selection', 'panic', 'set a pin', 'auto lock after 5 minutes', 'clear my clipboard', 'ephemeral mode', 'confirm before mass delete', 'unverified: the moon is made of cheese'],
  nearMisses: ['hide the numbers in my taxes', 'how do I lock a door', 'what is a pin number', 'show me how a key opens a lock', 'clear the stage', 'undo'],
  intent: safetyIntent,
  match(lower, text) { return !!safetyIntent(text || lower); },
  async run(text, api) {
    const said = await ask(text, api.stage);
    if (said && api.say) api.say(said);
    return safetyIntent(text) ? 'safety-kit' : 'none';
  },
  decorate(st) { if (read().numbers && doc && !numObs) numbersOn(true); },
  stageKinds: { claim: { mount: mountClaim }, pinlock: { mount: mountPin } },
};
