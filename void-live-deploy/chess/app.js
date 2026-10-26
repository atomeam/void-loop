// /chess/app.js: written by tools/game-pages.mjs; edit the generator, not this file. The game is /chess/game.js, loaded after the load event.
const keep = () => { for (const u of new Set([...performance.getEntriesByType('resource').map((e) => new URL(e.name)).filter((u) => u.origin === location.origin && /\.(?:js|json)$/.test(u.pathname)).map((u) => u.pathname), ...["/lib/chess-worker.js","/lib/chess-engine.js","/chess/puzzles.json"]])) fetch(u).catch(() => {}); };
const go = () => import('/chess/game.js').then(() => { const sw = navigator.serviceWorker; if (!sw) return; if (sw.controller) keep(); else sw.addEventListener('controllerchange', keep, { once: true }); });
if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
