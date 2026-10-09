/**
 * status skill — "void status" / "system status" / "is void working": each part of Void checked on the spot, in this
 * browser (domains/void.assimilate.md, ask "status": each component). Skills: the page's own load check run again
 * (index entries whose module is missing or misshapen are named). This browser: storage (a throwaway value written and
 * removed), 3D (WebGL), the offline layer (service worker), online or not. Outside sources: the open services Void reads,
 * pinged once each, only now, in parallel, with a 6 s limit, showing up / down and how long each took. The translation
 * service is not pinged: a ping would spend its small daily quota. Nothing is sent about you; nothing is kept.
 */
export const SOURCES = [
  { name: 'Open-Meteo weather', for: 'weather, air quality, UV', url: 'https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m' },
  { name: 'Open-Meteo places', for: 'maps, places, local time', url: 'https://geocoding-api.open-meteo.com/v1/search?count=1&name=Paris' },
  { name: 'Wikipedia', for: 'articles', url: 'https://en.wikipedia.org/api/rest_v1/page/summary/Earth' },
  { name: 'Wiktionary', for: 'definitions', url: 'https://en.wiktionary.org/api/rest_v1/page/definition/void' },
  { name: 'Frankfurter', for: 'currency', url: 'https://api.frankfurter.dev/v1/latest' },
  { name: 'USGS', for: 'earthquakes', url: 'https://earthquake.usgs.gov/fdsnws/event/1/version' },
  { name: 'Nager.Date', for: 'public holidays', url: 'https://date.nager.at/api/v3/AvailableCountries' },
  { name: 'CoinGecko', for: 'crypto prices', url: 'https://api.coingecko.com/api/v3/ping' },
  { name: 'ClinicalTrials.gov', for: 'the longevity trial watch', url: 'https://clinicaltrials.gov/api/v2/version' },
];

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ASK_RE = /^(?:(?:show(?:\s+me)?|check|run|what(?:'s|\s+is))\s+(?:the\s+)?)?(?:void(?:'s)?\s+(?:status|health|health\s+check)|(?:system|service)\s+status|status(?:\s+(?:page|check|of\s+void))?|health\s+check|self[\s-]?check|diagnostics)$|^(?:is\s+void\s+(?:working|up|down|ok|okay|broken)|are\s+(?:the\s+)?(?:skills|sources)\s+(?:working|up|down)|check\s+(?:void|yourself|the\s+sources))$/;
export function statusOf(text) { return ASK_RE.test(CLEAN(text)); }

/** Ping one source: { name, for, ok, ms, note }. A CORS block, a timeout and a network error all read as unreachable. */
export async function ping(src, fetchFn = (u, o) => fetch(u, o), ms = 6000, now = () => performance.now()) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ctl && setTimeout(() => ctl.abort(), ms), t0 = now();
  try {
    const r = await fetchFn(src.url, ctl ? { signal: ctl.signal, cache: 'no-store' } : { cache: 'no-store' });
    return { name: src.name, for: src.for, ok: !!r.ok, ms: Math.round(now() - t0), note: r.ok ? '' : 'answered HTTP ' + r.status };
  } catch (e) {
    const timedOut = e && e.name === 'AbortError';
    return { name: src.name, for: src.for, ok: false, ms: Math.round(now() - t0), note: timedOut ? 'no answer in ' + ms / 1000 + ' s' : 'could not be reached from this browser' };
  } finally { if (t) clearTimeout(t); }
}

/** The skills: the index, each module imported again (the browser hands back the loaded copy) and its shape checked. */
export async function checkSkills(fetchFn = (u) => fetch(u), importFn = (n) => import('/skills/' + n + '.js')) {
  let index;
  try { const r = await fetchFn('/skills/index.json'); if (!r.ok) throw new Error('HTTP ' + r.status); index = await r.json(); if (!Array.isArray(index)) throw new Error('not a list'); }
  catch (e) { return { total: 0, ok: 0, missing: [], error: 'the skills index could not be read (' + ((e && e.message) || e) + ')' }; }
  const mods = await Promise.all(index.map((n) => importFn(n).catch(() => null)));
  const missing = index.filter((n, i) => { const s = mods[i] && mods[i].default; return !(s && s.name && s.match && s.run); });
  return { total: index.length, ok: index.length - missing.length, missing, error: null };
}

/** This browser: storage, WebGL, the offline layer, online. Each { name, ok, note }. */
export function checkBrowser(w = typeof window !== 'undefined' ? window : {}) {
  const out = [];
  let store = false; try { const k = 'a2m.void.status.probe'; w.localStorage.setItem(k, '1'); store = w.localStorage.getItem(k) === '1'; w.localStorage.removeItem(k); } catch (_) {}
  out.push({ name: 'Storage in this browser', ok: store, note: store ? 'kept things, logs and drafts can be saved here' : 'blocked or full: kept things and logs will not survive a reload' });
  let gl = false; try { const c = w.document.createElement('canvas'), x = c.getContext('webgl2') || c.getContext('webgl'); gl = !!x; if (x && x.getExtension('WEBGL_lose_context')) x.getExtension('WEBGL_lose_context').loseContext(); } catch (_) {}
  out.push({ name: '3D', ok: gl, note: gl ? 'WebGL is available for the 3D miniatures and figures' : 'no WebGL: cards show their flat look instead' });
  const sw = !!(w.navigator && w.navigator.serviceWorker && w.navigator.serviceWorker.controller);
  out.push({ name: 'Works offline', ok: sw, note: sw ? 'the offline layer is active' : 'not yet: it starts after the first full visit over https' });
  const online = !(w.navigator && w.navigator.onLine === false);
  out.push({ name: 'Online', ok: online, note: online ? 'this browser reports a connection' : 'this browser reports no connection' });
  return out;
}

const dot = (ok) => '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:' + (ok ? '#3fbf6a' : '#e0584a') + '"></span>';
export function statusHtml(esc, skills, browser, sources, at) {
  const row = (ok, name, note, ms) => '<tr><td style="padding:3px 10px 3px 0;white-space:nowrap">' + dot(ok) + esc(name) + '</td><td style="color:#8a8a92;padding:3px 0">' + esc(note) + (ms != null ? ' · ' + ms + ' ms' : '') + '</td></tr>';
  const up = sources ? sources.filter((s) => s.ok).length : 0;
  return '<h2>Void status</h2><div class="sub">checked just now, from this browser' + (at ? ' · ' + esc(at) : '') + '</div>'
    + '<table style="border-collapse:collapse;margin:8px 0">'
    + row(!skills.error && !skills.missing.length, 'Skills', skills.error || (skills.ok + ' of ' + skills.total + ' load' + (skills.missing.length ? '; not loading: ' + skills.missing.join(', ') : '')))
    + browser.map((b) => row(b.ok, b.name, b.note)).join('') + '</table>'
    + '<h3 style="margin:12px 0 4px;font-size:15px">Outside sources' + (sources ? ' · ' + up + ' of ' + sources.length + ' answering' : '') + '</h3>'
    + (sources ? '<table style="border-collapse:collapse">' + sources.map((s) => row(s.ok, s.name, 'for ' + s.for + (s.note ? ' · ' + s.note : ''), s.ok ? s.ms : null)).join('') + '</table>'
      : '<p style="color:#8a8a92">Not checked: this browser is offline.</p>')
    + '<div class="src">Each source was asked once, now, because you asked; the translation service is not pinged, to save its daily quota. Nothing about you is sent or kept.</div>';
}

async function run(text, api) {
  if (!statusOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Void status</h2><div class="sub">checking…</div>'; });
  const browser = checkBrowser(), online = browser.find((b) => b.name === 'Online').ok;
  const [skills, sources] = await Promise.all([checkSkills(), online ? Promise.all(SOURCES.map((s) => ping(s))) : Promise.resolve(null)]);
  const at = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  el.innerHTML = statusHtml(esc, skills, browser, sources, at);
  return 'status';
}

export default {
  name: 'status',
  examples: ['void status', 'system status', 'is void working', 'status', 'health check', 'are the sources up'],
  nearMisses: ['what is my status', 'status of my order', 'relationship status', 'flight status', 'status quo', 'check the weather'],
  statusOf,
  match(lower, text) { return statusOf(text); },
  run,
};
