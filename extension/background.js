// Toolbar icon opens the side panel; right-click "Ask Void about ..." sends the selection; "void <ask>" in the address bar opens Void.
// Right-click "Ask Void about this page" / "Help me with this draft" read the page you are on (activeTab: only that tab, only on that
// click) and hand it to Void as context: title, address, selection, the focused text field and the visible text, capped.
const VOID = 'https://a-to-mind.com/';
const TEXT_MAX = 8000;
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.runtime.onInstalled.addListener(() => chrome.contextMenus.removeAll(() => { // an update keeps the old menus: start clean
  chrome.contextMenus.create({ id: 'ask-void', title: 'Ask Void about “%s”', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'void-page', title: 'Ask Void about this page', contexts: ['page', 'frame', 'link', 'image'] });
  chrome.contextMenus.create({ id: 'void-draft', title: 'Help me with this draft', contexts: ['editable'] });
}));

// Runs inside the page (chrome.scripting): only reads, never changes anything.
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
  // open first: the side panel only opens inside the click itself, before any await
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  if (info.menuItemId === 'ask-void') {
    if (info.selectionText) chrome.storage.session.set({ ask: { q: info.selectionText.trim().slice(0, 500), at: Date.now() } });
    return;
  }
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

chrome.omnibox.setDefaultSuggestion({ description: 'Ask Void: %s' });
chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  const url = VOID + '?q=' + encodeURIComponent(text.trim());
  if (disposition === 'currentTab') chrome.tabs.update({ url });
  else chrome.tabs.create({ url, active: disposition === 'newForegroundTab' });
});
