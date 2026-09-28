// Asks sent from the right-click menu arrive through session storage and open in Void as ?q=<ask>.
const VOID = 'https://a-to-mind.com/';
const frame = document.getElementById('void');
function ask(q) { if (q) frame.src = VOID + '?q=' + encodeURIComponent(q); }
chrome.storage.session.get('ask').then(({ ask: a }) => { if (a) { chrome.storage.session.remove('ask'); ask(a.q); } });
chrome.storage.session.onChanged.addListener((c) => { if (c.ask && c.ask.newValue) { chrome.storage.session.remove('ask'); ask(c.ask.newValue.q); } });
