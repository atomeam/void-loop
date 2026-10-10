// The two functions the extension runs inside a tab, and only after you point Void at it (Alt+Shift+V or the right-click menu).
// Each runs alone in the page (chrome.scripting.executeScript copies the function, not this file), so neither uses anything outside itself.

// B1: what Void may see of the tab: its title, address, the text you selected, and which box you were typing in. Nothing else of the page.
function voidReadTab() {
  const el = document.activeElement;
  const fieldOf = (e) => {
    if (!e || e === document.body || e === document.documentElement) return null;
    const tag = e.tagName.toLowerCase();
    const textInput = tag === 'input' && /^(?:text|search|email|url|tel|)$/.test((e.getAttribute('type') || '').toLowerCase());
    if (!(tag === 'textarea' || textInput || e.isContentEditable)) return null;
    const name = e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.getAttribute('name') || e.id || '';
    return { tag: e.isContentEditable ? 'editable' : tag, name: String(name).slice(0, 80) };
  };
  let selection = '';
  if (el && typeof el.selectionStart === 'number' && typeof el.value === 'string' && el.selectionEnd > el.selectionStart) selection = el.value.slice(el.selectionStart, el.selectionEnd);
  else selection = String(window.getSelection ? window.getSelection() : '');
  const field = fieldOf(el);
  // remembered in the extension's own world in this page (pages can't see it), so a draft goes to the box you were in
  window.__voidField = field ? el : null;
  return { title: document.title.slice(0, 200), url: location.href.slice(0, 500), selection: selection.trim().slice(0, 5000), field };
}

// "draft for me: proposal" (sends it to Void): the text of the thread you are reading, once, when you press it. Gmail keeps the
// open thread in its main region; any other page gives its body. The box you are writing in is left out (that is your reply).
function voidReadThread() {
  const root = document.querySelector('[role="main"]') || document.body;
  if (!root) return { ok: false, why: 'no-text' };
  const mine = window.__voidField && root.contains(window.__voidField) ? window.__voidField : null;
  let text = root.innerText || '';
  if (mine) { const typed = mine.value != null ? mine.value : mine.innerText || ''; if (typed) text = text.replace(typed, ''); }
  text = text.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim().slice(0, 8000);
  return text ? { ok: true, text } : { ok: false, why: 'no-text' };
}

// B2: put Void's draft into the box you were typing in, the way typing would. It never presses send, submits a form or clicks anything.
function voidPutDraft(text) {
  const live = (e) => e && e.isConnected && (e.isContentEditable || (/^(?:textarea|input)$/i.test(e.tagName) && !e.disabled && !e.readOnly));
  const el = live(document.activeElement) ? document.activeElement : live(window.__voidField) ? window.__voidField : null;
  if (!el) return { ok: false, why: 'no-field' };
  el.focus();
  let done = false;
  try { done = document.execCommand('insertText', false, String(text)); } catch (_) {}
  if (!done || (!el.isContentEditable && !String(el.value).includes(String(text)))) {
    if (el.isContentEditable) el.textContent += String(text);
    else {
      const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? el.value.length;
      el.value = el.value.slice(0, s) + String(text) + el.value.slice(e);
    }
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: String(text) }));
  }
  return { ok: true, field: el.isContentEditable ? 'editable' : el.tagName.toLowerCase() };
}

// B3: one step you said yes to, on a site you allowed: fill a field with text, or click a button, each named by its visible
// label. It never submits a form or presses Enter: a field is filled the way typing would fill it, and a button that would
// submit its form is refused (you press it yourself). Two elements matching the label is a refusal too: it acts on one thing.
function voidAct(step) {
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const want = norm(step && step.label);
  if (!want || !step || (step.action !== 'fill' && step.action !== 'click')) return { ok: false, why: 'bad-step' };
  const shown = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length) && getComputedStyle(e).visibility !== 'hidden';
  const labelOf = (e) => {
    const names = [e.getAttribute('aria-label'), e.getAttribute('placeholder'), e.getAttribute('title'), e.getAttribute('name'), e.id]; // the id last: voidReadTab names a box by it when nothing else does
    if (e.id) { const l = document.querySelector('label[for="' + CSS.escape(e.id) + '"]'); if (l) names.push(l.textContent); }
    const wrap = e.closest('label'); if (wrap) names.push(wrap.textContent);
    if (step.action === 'click') names.push(e.textContent, e.value);
    return names.map(norm).filter(Boolean);
  };
  const pool = step.action === 'fill'
    ? [...document.querySelectorAll('textarea, input, [contenteditable=""], [contenteditable="true"]')].filter((e) => e.isContentEditable || e.tagName === 'TEXTAREA' || /^(?:text|search|email|url|tel|)$/i.test(e.getAttribute('type') || ''))
    : [...document.querySelectorAll('button, [role="button"], input[type="button"]')];
  const usable = pool.filter((e) => shown(e) && !e.disabled && !e.readOnly);
  let hits = usable.filter((e) => labelOf(e).includes(want));
  if (!hits.length) hits = usable.filter((e) => labelOf(e).some((n) => n.includes(want)));
  if (!hits.length) return { ok: false, why: 'not-found' };
  if (hits.length > 1) return { ok: false, why: 'ambiguous', count: hits.length };
  const el = hits[0];
  if (step.action === 'click') {
    const submits = el.tagName === 'BUTTON' ? (el.getAttribute('type') || 'submit').toLowerCase() === 'submit' && !!el.form : false;
    if (submits) return { ok: false, why: 'submits' };
    el.click();
    return { ok: true, did: 'clicked' };
  }
  const text = String(step.text == null ? '' : step.text).slice(0, 20000);
  el.focus();
  // typing's own path first (it fires the input events a page listens for); setting the value is the fallback, with the event typing would send
  if (el.isContentEditable) { const r = document.createRange(); r.selectNodeContents(el); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  else if (el.select) el.select();
  let typed = false; try { typed = document.execCommand('insertText', false, text); } catch (_) {}
  const now = () => (el.isContentEditable ? el.textContent : el.value);
  if (!typed || now() !== text) {
    if (el.isContentEditable) el.textContent = text; else el.value = text;
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true, did: 'filled' };
}
