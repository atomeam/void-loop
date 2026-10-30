// The fantasy page's start: after the load event it brings in the page's code (fantasy/app.js) and registers the worker that keeps the page for offline. An external file, not an inline
// script, so the page needs no content-security rule of its own (tools/csp-hashes.mjs makes one for every page with an inline script, and the rule list has a budget).
addEventListener('load', () => { import('/fantasy/app.js').catch(() => {}); });
if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
