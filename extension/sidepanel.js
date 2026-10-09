// Asks sent from the right-click menu arrive through session storage and open in Void as ?q=<ask>.
// An ask about the page you are on also carries the page: Void is opened with &ctx=1, says it is ready, and gets the page by
// postMessage (never in the address, which keeps only 300 characters and ends up in logs).
const VOID = 'https://a-to-mind.com/';
const ORIGIN = new URL(VOID).origin;
const frame = document.getElementById('void');
let pending = null;
function ask(a) {
  if (!a || !a.q) return;
  pending = a.page ? a : null;
  frame.src = VOID + '?q=' + encodeURIComponent(a.q) + (a.page ? '&ctx=1' : '');
}
addEventListener('message', (e) => {
  if (e.origin !== ORIGIN || e.source !== frame.contentWindow || !e.data || e.data.type !== 'void.ctx.ready' || !pending) return;
  frame.contentWindow.postMessage({ type: 'void.ctx', q: pending.q, page: pending.page }, ORIGIN);
  pending = null;
});
chrome.storage.session.get('ask').then(({ ask: a }) => { if (a) { chrome.storage.session.remove('ask'); ask(a); } });
chrome.storage.session.onChanged.addListener((c) => { if (c.ask && c.ask.newValue) { chrome.storage.session.remove('ask'); ask(c.ask.newValue); } });
