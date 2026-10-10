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
