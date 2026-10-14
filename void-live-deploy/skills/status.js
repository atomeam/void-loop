/**
 * status skill — "void status" / "system status" / "is void working": each part of Void checked on the spot, in this
 * browser (domains/void.assimilate.md, ask "status": each component). Skills: the page's own load check run again
 * (index entries whose module is missing or misshapen are named). This browser: storage (a throwaway value written and
 * removed), 3D (WebGL), the offline layer (service worker), online or not. Outside sources: the open services Void reads,
 * pinged once each, only now, in parallel, with a 6 s limit, showing up / down and how long each took. The translation
 * service is not pinged: a ping would spend its small daily quota. Void's own build: the newest checks and deploy on main (GitHub's
 * public API). For the owner, the card opens by itself when one of those failed (autoOpen). Nothing is sent about you; nothing is kept.
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

// Void's own build (Void asked, 2026-10-11/12, five times: "a system where a blocked deployment or failed action generates a 'status'
// card automatically"; "make the results of verify-main visible to me as a status card"): the newest run on main of the checks and
// of the deploy, from GitHub's public API (the repository is public; no key, 60 reads an hour per address). The owner chose
// (2026-10-13) that the card opens by itself only for the owner: visitors keep the blank stage (autoOpen below).
export const REPO = 'atomeam/void-loop';
export const BUILD = [{ name: 'Checks on main', file: 'verify.yml' }, { name: 'Deploy', file: 'deploy.yml' }];
export async function buildRun(wf, fetchFn = (u, o) => fetch(u, o)) {
  try {
    const r = await fetchFn('https://api.github.com/repos/' + REPO + '/actions/workflows/' + wf.file + '/runs?branch=main&per_page=1&exclude_pull_requests=true', { headers: { accept: 'application/vnd.github+json' } });
    if (!r.ok) return { ...wf, state: 'unknown', note: 'GitHub answered HTTP ' + r.status };
    const run = ((await r.json()).workflow_runs || [])[0];
    if (!run) return { ...wf, state: 'unknown', note: 'no run on main yet' };
    const state = run.status !== 'completed' ? 'running' : run.conclusion === 'success' ? 'passed' : run.conclusion === 'skipped' || run.conclusion === 'cancelled' ? 'unknown' : 'failed';
    return { ...wf, state, note: (state === 'failed' ? 'failed (' + run.conclusion + ')' : state === 'running' ? 'running now' : state === 'passed' ? 'passed' : run.conclusion) + ' on ' + String(run.head_sha || '').slice(0, 7) + ' · ' + String(run.created_at || '').slice(0, 16).replace('T', ' ') + ' UTC', url: /^https:\/\/github\.com\//.test(run.html_url || '') ? run.html_url : null };
  } catch (_) { return { ...wf, state: 'unknown', note: 'GitHub could not be reached from this browser' }; }
}
export const buildState = (fetchFn) => Promise.all(BUILD.map((w) => buildRun(w, fetchFn)));
export const buildFailed = (rows) => Array.isArray(rows) && rows.some((r) => r.state === 'failed');
// once a page load, for the owner only: the build is read, and the status card opens when a run on main failed. Read at most once
// in ten minutes per tab (sessionStorage), so reloads don't spend the public API's hourly allowance.
const SEEN = 'a2m.void.status.build.v1';
export async function autoOpen(open, { fetchFn, store = typeof sessionStorage !== 'undefined' ? sessionStorage : null, now = Date.now() } = {}) {
  let rows = null;
  try { const c = JSON.parse((store && store.getItem(SEEN)) || 'null'); if (c && now - c.at < 600000) rows = c.rows; } catch (_) {}
  if (!rows) { rows = await buildState(fetchFn); try { store && store.setItem(SEEN, JSON.stringify({ at: now, rows })); } catch (_) {} }
  if (buildFailed(rows)) { await open(); return true; }
  const sup = await supportState(fetchFn); // a paying user waiting on an answer opens the card too
  if (sup && sup.open) { await open(); return true; }
  return false;
}

// Paying users who said "it broke" (functions/api/support.js): the open reports, read with the owner's key. A visitor has no key and
// sees nothing; the owner sees each report and answers it from the card's link (POST /api/support { action: 'answer' }).
const OWNER_KEY = 'a2m.void.owner.v1';
const ownerKey = () => { try { return localStorage.getItem(OWNER_KEY) || ''; } catch (_) { return ''; } };
export async function supportState(fetchFn = (u, o) => fetch(u, o), key = ownerKey()) {
  if (!key) return null;
  try { const r = await fetchFn('/api/support', { headers: { authorization: 'Bearer ' + key } }); if (!r.ok) return null; const j = await r.json(); return { open: Number(j.open) || 0, tickets: (j.tickets || []).filter((t) => t.status === 'open').slice(0, 5) }; } catch (_) { return null; }
}

const dot = (ok) => '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:' + (ok ? '#3fbf6a' : '#e0584a') + '"></span>';
export function statusHtml(esc, skills, browser, sources, at, build, support) {
  const row = (ok, name, note, ms) => '<tr><td style="padding:3px 10px 3px 0;white-space:nowrap">' + dot(ok) + esc(name) + '</td><td style="color:#8a8a92;padding:3px 0">' + esc(note) + (ms != null ? ' · ' + ms + ' ms' : '') + '</td></tr>';
  const up = sources ? sources.filter((s) => s.ok).length : 0;
  return '<h2>V01D status</h2><div class="sub">checked just now, from this browser' + (at ? ' · ' + esc(at) : '') + '</div>'
    + '<table style="border-collapse:collapse;margin:8px 0">'
    + row(!skills.error && !skills.missing.length, 'Skills', skills.error || (skills.ok + ' of ' + skills.total + ' load' + (skills.missing.length ? '; not loading: ' + skills.missing.join(', ') : '')))
    + browser.map((b) => row(b.ok, b.name, b.note)).join('') + '</table>'
    + '<h3 style="margin:12px 0 4px;font-size:15px">Outside sources' + (sources ? ' · ' + up + ' of ' + sources.length + ' answering' : '') + '</h3>'
    + (sources ? '<table style="border-collapse:collapse">' + sources.map((s) => row(s.ok, s.name, 'for ' + s.for + (s.note ? ' · ' + s.note : ''), s.ok ? s.ms : null)).join('') + '</table>'
      : '<p style="color:#8a8a92">Not checked: this browser is offline.</p>')
    + (build ? '<h3 style="margin:12px 0 4px;font-size:15px">V01D’s own build' + (buildFailed(build) ? ' · <span style="color:#e0584a">something on main failed</span>' : '') + '</h3><table style="border-collapse:collapse">'
      + build.map((b) => '<tr><td style="padding:3px 10px 3px 0;white-space:nowrap">' + (b.state === 'running' || b.state === 'unknown' ? '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:#8a8a92"></span>' : dot(b.state === 'passed')) + esc(b.name) + '</td><td style="color:#8a8a92;padding:3px 0">' + esc(b.note) + (b.url ? ' · <a href="' + esc(b.url) + '" target="_blank" rel="noopener">the run</a>' : '') + '</td></tr>').join('') + '</table>' : '')
    + (support ? '<h3 style="margin:12px 0 4px;font-size:15px">Paying users who said it broke · ' + (support.open ? '<span style="color:#e0584a">' + support.open + ' waiting on you</span>' : 'none waiting') + '</h3>'
      + support.tickets.map((t) => '<p style="margin:4px 0"><b>' + esc(t.id) + '</b> · ' + esc(t.where) + ' · ' + esc(String(t.at).slice(0, 16).replace('T', ' ')) + '<br>' + esc(t.what) + '</p>').join('')
      + (support.open ? '<p style="color:#8a8a92;margin:4px 0">Answer one: POST /api/support { action: "answer", id, answer } with your key; the reporter reads it with theirs.</p>' : '') : '')
    + '<div class="src">Each source was asked once, now, because you asked; the translation service is not pinged, to save its daily quota. Nothing about you is sent or kept.</div>';
}

async function run(text, api) {
  if (!statusOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>V01D status</h2><div class="sub">checking…</div>'; });
  const browser = checkBrowser(), online = browser.find((b) => b.name === 'Online').ok;
  const [skills, sources, build, support] = await Promise.all([checkSkills(), online ? Promise.all(SOURCES.map((s) => ping(s))) : Promise.resolve(null), online ? buildState() : Promise.resolve(null), online ? supportState() : Promise.resolve(null)]);
  const at = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  el.innerHTML = statusHtml(esc, skills, browser, sources, at, build, support);
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
