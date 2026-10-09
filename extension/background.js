// Toolbar icon opens the side panel. "void <ask>" in the address bar opens Void.
// In the browser only (B1, B2): Alt+Shift+V, or right-click "Void: read this tab", reads the tab you are on into Void
// (title, address, selection, the box you were in: extension/page.js); Void can then draft into that box. Nothing leaves the browser.
// Sent to Void (#134): right-click "Ask Void about this page" / "Help me with this draft" read the page you are on and send it to
// Void's answer engine as the material for that one answer (title, address, selection, the focused field, the visible text, capped).
// Both are activeTab only: Chrome lets the extension into a tab when you press the shortcut or use the menu there, and only that tab.
importScripts('page.js');
const VOID = 'https://a-to-mind.com/';
const TEXT_MAX = 8000;
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.runtime.onInstalled.addListener(() => chrome.contextMenus.removeAll(() => { // an update keeps the old menus: start clean
  chrome.contextMenus.create({ id: 'read-tab', title: 'Void: read this tab (stays in your browser)', contexts: ['page', 'selection', 'editable'] });
  chrome.contextMenus.create({ id: 'void-page', title: 'Ask Void about this page (sends it to Void)', contexts: ['page', 'frame', 'link', 'image', 'selection'] });
  chrome.contextMenus.create({ id: 'void-draft', title: 'Help me with this draft (sends it to Void)', contexts: ['editable'] });
}));

// B1: the panel must be opened inside the user's gesture (Chrome refuses it after an await), so it opens first and the read follows.
async function readTab(tab) {
  if (!tab || tab.id == null) return { ok: false, why: 'no-tab' };
  let ctx;
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: voidReadTab });
    ctx = r && r.result;
  } catch (e) { ctx = null; }
  // a page Chrome keeps extensions out of (chrome://, the Web Store) still gives its title and address, which the tab itself tells us
  const tabCtx = ctx ? { ...ctx, readable: true } : { title: (tab.title || '').slice(0, 200), url: (tab.url || '').slice(0, 500), selection: '', field: null, readable: false };
  await chrome.storage.session.set({ tab: { ...tabCtx, tabId: tab.id, at: Date.now() } });
  return { ok: true, readable: tabCtx.readable };
}
chrome.commands.onCommand.addListener((cmd, tab) => {
  if (cmd !== 'read-tab' || !tab) return;
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  readTab(tab);
});

// #134: runs inside the page (chrome.scripting): only reads, never changes anything. What it returns goes to Void's answer engine.
function readPage(max) {
  const clip = (s, n) => String(s || '').replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, n);
  const a = document.activeElement;
  let field = '';
  if (a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && /^(text|search|email|url)?$/i.test(a.type || '')))) field = a.value;
  else if (a && a.isContentEditable) field = a.innerText;
  return {
    title: clip(document.title, 200),
    url: location.href.slice(0, 500),
    selection: clip(String(getSelection() || ''), 2000),
    field: clip(field, 4000),
    text: clip(document.body ? document.body.innerText : '', max),
  };
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab) return;
  // open first: the side panel only opens inside the click itself, before any await
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  if (info.menuItemId === 'read-tab') { readTab(tab); return; }
  if (info.menuItemId !== 'void-page' && info.menuItemId !== 'void-draft') return;
  const draft = info.menuItemId === 'void-draft';
  let page = null;
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [info.frameId || 0] }, func: readPage, args: [TEXT_MAX] });
    page = res && res.result;
  } catch (_) {} // chrome:// pages, the Web Store and PDFs can't be read; Void says so instead
  const q = draft ? 'Help me improve this draft' : (info.selectionText ? 'Explain this from the page: ' + info.selectionText.trim().slice(0, 200) : 'What is this page about?');
  chrome.storage.session.set({ ask: { q, page: page || { title: tab.title || '', url: tab.url || '', unreadable: true }, at: Date.now() } });
});

// B2: a draft from Void (through the panel) goes only into the tab that was last read, and only while Chrome still lets us in there.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (sender.id !== chrome.runtime.id || !msg || msg.type !== 'draft' || typeof msg.text !== 'string') return;
  (async () => {
    const { tab } = await chrome.storage.session.get('tab');
    if (!tab || tab.tabId == null) return reply({ ok: false, why: 'no-tab' });
    try {
      const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.tabId }, func: voidPutDraft, args: [msg.text.slice(0, 20000)] });
      reply((r && r.result) || { ok: false, why: 'no-result' });
    } catch (e) { reply({ ok: false, why: 'no-access' }); }
  })();
  return true;
});

chrome.omnibox.setDefaultSuggestion({ description: 'Ask Void: %s' });
chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  const url = VOID + '?q=' + encodeURIComponent(text.trim());
  if (disposition === 'currentTab') chrome.tabs.update({ url });
  else chrome.tabs.create({ url, active: disposition === 'newForegroundTab' });
});
