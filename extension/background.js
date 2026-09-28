// Toolbar icon opens the side panel; right-click "Ask Void about ..." sends the selection; "void <ask>" in the address bar opens Void.
const VOID = 'https://a-to-mind.com/';
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'ask-void', title: 'Ask Void about “%s”', contexts: ['selection'] });
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'ask-void' || !info.selectionText) return;
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  chrome.storage.session.set({ ask: { q: info.selectionText.trim().slice(0, 500), at: Date.now() } });
});
chrome.omnibox.setDefaultSuggestion({ description: 'Ask Void: %s' });
chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  const url = VOID + '?q=' + encodeURIComponent(text.trim());
  if (disposition === 'currentTab') chrome.tabs.update({ url });
  else chrome.tabs.create({ url, active: disposition === 'newForegroundTab' });
});
