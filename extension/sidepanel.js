// The panel is the only door between Void (the frame, a-to-mind.com) and the extension. Both sides check who is talking:
// this page takes messages only from the Void frame's own window at a-to-mind.com, and Void (void.html) takes them only from this extension's pinned id.
const VOID = 'https://a-to-mind.com/';
const VOID_ORIGIN = new URL(VOID).origin;
const frame = document.getElementById('void');
const toVoid = (msg) => { try { frame.contentWindow.postMessage(msg, VOID_ORIGIN); } catch (_) {} };

// the tab you last pointed Void at (title, address, selection, the box you were in); the tab id stays here, Void doesn't need it
let tab = null;
const send = () => { if (tab) { const { tabId, ...shown } = tab; toVoid({ type: 'void-ext:tab', tab: shown }); } };
chrome.storage.session.get('tab').then(({ tab: t }) => { if (t) { tab = t; send(); } });
chrome.storage.session.onChanged.addListener((c) => { if (c.tab && c.tab.newValue) { tab = c.tab.newValue; send(); } });

window.addEventListener('message', (e) => {
  if (e.origin !== VOID_ORIGIN || e.source !== frame.contentWindow || !e.data || typeof e.data !== 'object') return;
  const m = e.data;
  if (m.type === 'void-ext:ready') { toVoid({ type: 'void-ext:hello', version: chrome.runtime.getManifest().version }); send(); }
  else if (m.type === 'void-ext:draft' && typeof m.text === 'string') {
    chrome.runtime.sendMessage({ type: 'draft', text: m.text }).then((r) => toVoid({ type: 'void-ext:drafted', id: m.id, ...(r || { ok: false, why: 'no-reply' }) }))
      .catch(() => toVoid({ type: 'void-ext:drafted', id: m.id, ok: false, why: 'no-reply' }));
  }
});
