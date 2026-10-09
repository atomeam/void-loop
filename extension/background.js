// Toolbar icon opens the side panel. Alt+Shift+V, or right-click "Void: read this tab", reads the tab you are on into Void
// (title, address, selection: extension/page.js); Void can then draft into the box you were typing in. "void <ask>" in the address bar opens Void.
// Only activeTab: Chrome lets the extension into a tab when you press the shortcut or use the menu there, and only that tab, until it navigates.
importScripts('page.js');
const VOID = 'https://a-to-mind.com/';
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: 'read-tab', title: 'Void: read this tab', contexts: ['page', 'selection', 'editable'] });
  });
});

// The panel must be opened inside the user's gesture (Chrome refuses it after an await), so it opens first and the read follows.
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
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'read-tab' || !tab) return;
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  readTab(tab);
});

// A draft from Void (through the panel) goes only into the tab that was last read, and only while Chrome still lets us in there.
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
