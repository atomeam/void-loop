/**
 * memory-graph skill - "What I've noticed" (asked by Verse, 2026-10-18: "an upgrade that lets me keep a persistent, personal knowledge
 * graph across conversations—so I could remember details you've shared before, notice patterns in your interests, and build on them
 * over time without you having to repeat anything"). The page notes which skill answered each ask and a few object words of it in a
 * small graph on this device (lib/memory-graph.js, the `graph` store in lib/state.js); this card reads it back: your top interests as
 * chips (a tap asks that skill's own example), the skills you ask for together, when you usually visit, what you have not come back to,
 * and "Next, maybe": at most three asks taken only from skills' own examples. Nothing here leaves the device; the card says so.
 * "what do you know about me", "what are my interests", "what do I usually ask for", "my patterns"; "forget my patterns" clears it,
 * "stop remembering" turns the noting off, "start remembering" turns it on. "remember that I like tea" and "what do you remember about
 * the parser" are the memory skill's; "export my memory", "download my graph", "back up what you know about me", "export my patterns as json" download the graph
 * as one JSON file (schema void.memory.v1, made here, never uploaded), and for whoever holds the key or a member session the card adds
 * "Download what Verse keeps" (the "remember that …" lines kept on the server, GET /api/memory?view=export) and "import my memory" reads one back beside what is kept (one undo); each interest and each
 * fact shows how sure the graph is (lib/memory-graph.js confidence), and a fact has a "still true" button; "who am I" is the sign-in line; "what is a knowledge graph" is a question for the web.
 */
import { sessionToken } from '../lib/state.js';
import { readGraph, writeGraph, patterns, suggest, clearGraph, setOn, GRAPH_KEY, exportOf, previewOf, importInto, noteFactStored, pct, IMPORT_MAX } from '../lib/memory-graph.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const SHOW_RE = /^(?:what do you know about me|what (?:are|do you think are) my interests|what do i usually ask (?:for|about)|what do i ask (?:for|about) most|(?:show (?:me )?)?my patterns|what have you noticed(?: about me)?|what do you know about my interests|what patterns have you (?:seen|noticed))$/;
const FORGET_RE = /^(?:forget|clear|reset|wipe) my patterns$/;
const STOP_RE = /^stop remembering(?: me| my asks| my patterns| what i ask(?: for)?)?$/;
const START_RE = /^(?:start|resume) remembering(?: me| my asks| my patterns| what i ask(?: for)?)?$/;
// export and import (asked by Verse: "download their graph as a structured JSON file for backup"): "export my memory", "download my graph", "back up what you know about me", "export my patterns as json"
const EXPORT_RE = /^(?:(?:export|download|save|back ?up) (?:my |the )?(?:memory|memory graph|graph|patterns|knowledge graph)(?: (?:as|to|in|into) (?:a )?(?:json|file|json file|backup))?|back ?up what you (?:know|keep|remember) about me|(?:export|download) what you (?:know|keep|remember) about me(?: as json)?)$/;
const IMPORT_RE = /^(?:import|restore|load) (?:my |a |the )?(?:memory|memory graph|graph|patterns|memory backup|graph backup)(?: (?:from|of) (?:a |my )?(?:json |memory )?(?:file|backup))?$/;
// a look before the download (asked by Verse, "memory-preview", 6 wordings): "preview my memory", "what's in my memory export", "peek at my backup"
const PREVIEW_RE = /^(?:preview|peek at|look inside|show me what'?s in|what'?s in|what is in) (?:my |the )?(?:memory(?: graph)?(?: export| backup| file)?|memory export|export|backup|memory backup)(?: before (?:i |the )?download(?:ing)?(?: it)?)?$/;
const UNDO_RE = /^undo (?:my |the )?(?:memory |graph )import$/;
/** what the ask wants: 'show', 'forget', 'stop', 'start', 'export', 'preview', 'import', 'undo-import' or ''. Pure. */
export function graphAskOf(text) {
  const t = CLEAN(text);
  return SHOW_RE.test(t) ? 'show' : FORGET_RE.test(t) ? 'forget' : STOP_RE.test(t) ? 'stop' : START_RE.test(t) ? 'start' : EXPORT_RE.test(t) ? 'export' : PREVIEW_RE.test(t) ? 'preview' : IMPORT_RE.test(t) ? 'import' : UNDO_RE.test(t) ? 'undo-import' : '';
}

const CSS = '.mg-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}.mg-chip{display:inline-block;padding:4px 10px;border:1px solid rgba(255,255,255,.18);border-radius:999px;color:var(--fg);text-decoration:none;font-size:13px}.mg-chip:hover{background:rgba(255,255,255,.08)}.mg-chip small{opacity:.6;margin-left:4px}.mg-h{margin:12px 0 2px;font-size:14px}.mg-btns{display:flex;gap:8px;margin-top:12px}.mg-conf{display:block;height:2px;margin-top:3px;border-radius:1px;background:rgba(255,255,255,.15)}.mg-conf i{display:block;height:100%;border-radius:1px;background:var(--accent,#7aa9ff)}.mg-facts li{margin:4px 0}.mg-facts .mg-conf{width:80px;display:inline-block;vertical-align:middle;margin:0 6px}.mg-still{font:inherit;font-size:12px;cursor:pointer;margin-left:6px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;border-radius:10px;padding:0 8px}';
function style() { if (document.getElementById('mg-style')) return; const st = document.createElement('style'); st.id = 'mg-style'; st.textContent = CSS; document.head.append(st); }

/** the examples of the skills the graph names, from their own modules (already loaded by the page): { skill: [ask] }. */
async function examplesFor(names) {
  const out = {};
  await Promise.all([...new Set(names)].filter(Boolean).slice(0, 12).map((n) => import('/skills/' + n + '.js').then((m) => { const ex = m && m.default && m.default.examples; if (Array.isArray(ex)) out[n] = ex.filter((e) => typeof e === 'string'); }).catch(() => {})));
  return out;
}

const day = (s) => String(s || '').slice(0, 10);
/** the card's markup from the patterns, the suggestions and the examples (for the chips' asks). Pure; every value is escaped. */
export function cardHtml(esc, p, sug, examples) {
  const ex = examples || {}, firstAsk = (skill) => (Array.isArray(ex[skill]) && ex[skill][0]) || '';
  const bar = (c) => '<span class="mg-conf" data-conf="' + esc(String(pct(c))) + '" aria-hidden="true"><i style="width:' + pct(c) + '%"></i></span>';
  const chip = (label, n, ask, c) => (ask ? '<a href="#" class="mg-chip" data-ask="' + esc(ask) + '" title="' + esc('ask: ' + ask + ' · ' + pct(c) + '% sure') + '">' : '<span class="mg-chip" title="' + esc(pct(c) + '% sure') + '">') + esc(label) + '<small>' + esc(String(n)) + '</small>' + bar(c) + (ask ? '</a>' : '</span>');
  let h = '<h2>What I\'ve noticed</h2>';
  if (!p.on) h += '<p class="sub">Off: I am not keeping what you ask about. "start remembering" turns it back on.</p>';
  if (!p.asks && !p.facts.length) {
    h += '<p>Nothing yet. Ask for a few things and come back: I will keep which skills you use and a few words of what for, here on this device.</p>';
  } else {
    h += '<div class="sub">from ' + esc(String(p.asks)) + ' ask' + (p.asks === 1 ? '' : 's') + ' on this device' + (p.first ? ' since ' + esc(day(p.first)) : '') + '</div>';
    if (p.interests.length) h += '<h3 class="mg-h">Your interests</h3><div class="mg-chips mg-interests">' + p.interests.map((t) => chip(t.label, t.n, firstAsk(t.skill), t.conf)).join('') + '</div>';
    if (p.pairs.length) h += '<h3 class="mg-h">Usually together</h3><ul class="mg-pairs">' + p.pairs.map((pr) => '<li>' + esc(pr.a) + ' and ' + esc(pr.b) + ', together ' + esc(String(pr.n)) + ' times</li>').join('') + '</ul>';
    if (p.when.words) h += '<h3 class="mg-h">When you visit</h3><p class="mg-when">' + esc(p.when.words) + '</p>';
    if (p.lapsed.length) h += '<h3 class="mg-h">Not come back to</h3><ul class="mg-lapsed">' + p.lapsed.map((t) => '<li>' + esc(t.label) + ' (asked ' + esc(String(t.n)) + ' times, last ' + esc(String(t.days)) + ' days ago)</li>').join('') + '</ul>';
    const items = Array.isArray(p.factItems) && p.factItems.length ? p.factItems : p.facts.map((f) => ({ label: f, conf: 0 }));
    if (items.length) h += '<h3 class="mg-h">You told me</h3><ul class="mg-facts">' + items.map((f) => '<li data-conf="' + esc(String(pct(f.conf))) + '" title="' + esc(pct(f.conf) + '% sure, from how often and on how many days you told me') + '">' + esc(f.label) + bar(f.conf) + '<small>' + esc(pct(f.conf) + '%') + '</small><button type="button" class="mg-still" data-fact="' + esc(f.label) + '" title="Tell me again: it is still true">still true</button></li>').join('') + '</ul>';
    if (sug.length) h += '<h3 class="mg-h">Next, maybe</h3><div class="mg-chips mg-next">' + sug.map((s) => '<a href="#" class="mg-chip" data-ask="' + esc(s.ask) + '" title="' + esc(s.why) + '">' + esc(s.ask) + '</a>').join('') + '</div>';
  }
  h += '<div class="mg-btns"><a href="#" class="btn mg-export" data-ask="export my memory">Export</a><a href="#" class="btn mg-import" data-ask="import my memory">Import</a><a href="#" class="btn mg-forget" data-ask="forget my patterns">Forget</a>' + (p.on ? '<a href="#" class="btn mg-stop" data-ask="stop remembering">Stop</a>' : '<a href="#" class="btn mg-start" data-ask="start remembering">Start</a>') + '</div>';
  h += '<div class="src">Kept only in this browser (' + esc(GRAPH_KEY) + '): skill names, a few words of what you asked for (never the sentence), and the day and hour. Nothing leaves this device. <a href="#" data-ask="privacy">Privacy</a></div>';
  return h;
}

async function show(api, said) {
  const { showPage, esc, say } = api;
  const p = patterns(readGraph(), Date.now());
  const names = [...p.interests.map((t) => t.skill), ...p.lapsed.map((t) => t.skill), ...p.pairs.flatMap((pr) => [pr.a, pr.b])];
  const examples = await examplesFor(names);
  const sug = suggest(readGraph(), Date.now(), examples);
  style();
  const el = showPage((e) => { e.innerHTML = cardHtml(esc, p, sug, examples); });
  // "still true": the fact told again today, so it is surer (the same as saying "remember that …" again); the card is drawn again
  if (el && el.querySelectorAll) el.querySelectorAll('button.mg-still').forEach((b) => b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); noteFactStored(null, b.getAttribute('data-fact'), Date.now()); show(api, 'still true: noted'); }));
  if (said) say(said);
  return 'memory-graph';
}

// ---- export and import. The file is the person's: made and read in this browser, never uploaded.
let undoText = null; // the graph as it was before the last import (one undo, this visit)
const stamp = (t) => new Date(t).toISOString().slice(0, 10);
/** hand the browser a file to save, made on demand. */
export function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
const fileName = (t) => 'void-memory-' + stamp(t) + '.json';
const BTN = 'font:inherit;cursor:pointer;margin:0 .5em .4em 0;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;padding:2px 11px';

/** the preview card's markup: what the file would hold, before anything downloads. Pure; every value is escaped. */
export function previewHtml(esc, pv) {
  const word = { skill: 'skill', topic: 'topic', fact: 'thing you told me', thing: 'thing' };
  const kinds = Object.keys(pv.kinds).map((k) => esc(String(pv.kinds[k])) + ' ' + esc(word[k] || k) + (pv.kinds[k] === 1 ? '' : 's')).join(', ');
  let h = '<h2>What my memory export holds</h2>';
  if (!pv.things) h += '<p class="mg-pv-empty">Nothing yet: the file would be an empty graph (' + esc(String(pv.kB)) + ' kB).</p>';
  else {
    h += '<p class="mg-pv-sum">' + esc(String(pv.things)) + ' thing' + (pv.things === 1 ? '' : 's') + ' (' + kinds + ') and ' + esc(String(pv.links)) + ' link' + (pv.links === 1 ? '' : 's') + ', about ' + esc(String(pv.kB)) + ' kB' + (pv.first ? ', from ' + esc(day(pv.first)) + ' to ' + esc(day(pv.last)) : '') + '.</p>';
    h += '<h3 class="mg-h">A few of them</h3><ul class="mg-pv">' + pv.sample.map((n) => '<li>' + esc(n.label) + ' <small>' + esc(word[n.kind] || n.kind) + ', ' + esc(String(n.n)) + '×</small></li>').join('') + '</ul>';
  }
  h += '<div class="mg-btns"><a href="#" class="btn mg-export" data-ask="export my memory">Download it</a><a href="#" class="btn" data-ask="what do you know about me">See it all</a></div>';
  h += '<div class="src">Read in this browser; nothing has downloaded and nothing leaves this device.</div>';
  return h;
}

function previewCard(api) {
  const { showPage, esc, say } = api, pv = previewOf(exportOf(readGraph(), Date.now()));
  style();
  showPage((e) => { e.innerHTML = previewHtml(esc, pv); });
  say(pv.things ? 'memory preview · ' + pv.things + ' things' : 'memory preview · nothing kept yet');
}

function exportCard(api) {
  const { showPage, esc, say } = api, now = Date.now(), g = readGraph(), body = JSON.stringify(exportOf(g, now), null, 2), n = Object.keys(g.nodes).length, links = Object.keys(g.edges).length;
  download(fileName(now), body);
  const el = showPage((e) => {
    e.innerHTML = '<h2>Memory exported</h2><p class="mg-exported">' + esc(fileName(now)) + ': ' + esc(String(n)) + ' thing' + (n === 1 ? '' : 's') + ' and ' + esc(String(links)) + ' link' + (links === 1 ? '' : 's') + ', ' + esc(String(Math.max(1, Math.round(body.length / 1024)))) + ' kB.</p>'
      + '<div><button type="button" class="mg-again" style="' + BTN + '">Download again</button><button type="button" class="mg-go-import" style="' + BTN + '">Import a file</button></div>'
      + '<div class="src">Made in this browser and saved by your browser. It is yours: it was never uploaded and goes nowhere. Nothing leaves this device. Say "import my memory" to bring a file back.</div>'
      // the other half of "my memory" (the owner, 2026-10-18): what "remember that …" kept on V01D's server, for whoever holds the key or a member session
      + (sessionToken() ? '<h3 style="margin:.8em 0 .2em">What Verse keeps for you</h3><p>The lines you asked me to remember ("remember that …") live with Verse, not in this browser.</p>'
        + '<div><button type="button" class="mg-kept" style="' + BTN + '">Download what Verse keeps</button></div><div class="mg-kept-out" role="status" aria-live="polite"></div>'
        + '<div class="src">Comes from Verse to you: only your own memory, read with your key. "forget that …" removes a line.</div>' : '');
  });
  if (el && el.querySelector) {
    el.querySelector('.mg-again').addEventListener('click', () => download(fileName(Date.now()), JSON.stringify(exportOf(readGraph(), Date.now()), null, 2)));
    el.querySelector('.mg-go-import').addEventListener('click', () => importCard(api));
    const kept = el.querySelector('.mg-kept');
    if (kept) kept.addEventListener('click', () => downloadKept(el.querySelector('.mg-kept-out')));
  }
  say(n ? 'memory exported · ' + n + ' things' : 'memory exported · nothing kept yet');
}

// what V01D's server keeps for this key or member (GET /api/memory?view=export, lib/memory-core.js exportAll): fetched only on the tap
export async function downloadKept(out) {
  const tok = sessionToken(), say = (t) => { if (out) out.textContent = t; };
  if (!tok) { say('Unlock Verse first (unlock <key>, or sign in with your passkey).'); return; }
  say('gathering…');
  try {
    const r = await fetch('/api/memory?view=export', { headers: { authorization: 'Bearer ' + tok } });
    if (!r.ok) { say(r.status === 401 ? 'Only the owner can read this.' : r.status === 403 ? 'What Verse keeps is for paid members.' : r.status === 503 ? 'There is no database behind this copy of Verse.' : 'Memory answered ' + r.status + '.'); return; }
    const data = await r.json();
    download('v01d-kept-' + stamp(Date.now()) + '.json', JSON.stringify(data, null, 2));
    say(data.count ? 'saved: ' + data.count + ' line' + (data.count === 1 ? '' : 's') + (data.capped ? ' (the newest; there are more)' : '') : 'saved: Verse keeps nothing for you yet');
  } catch (_) { say('Memory is out of reach right now.'); }
}

function importCard(api) {
  const { showPage, say } = api;
  const el = showPage((e) => {
    e.innerHTML = '<h2>Import my memory</h2><p>Choose a JSON file made by "export my memory". It joins what I keep now (the larger count of each wins, so the same file twice changes nothing); "undo my memory import" takes it away again.</p>'
      + '<input type="file" class="mg-file" accept=".json,application/json" aria-label="memory JSON file" style="margin:.3em 0"><div class="mg-result" role="status" aria-live="polite" style="margin-top:.5em"></div>'
      + '<div class="src">The file is read in this browser and goes nowhere. Only what this page can keep comes in: labels are cleaned again, anything unknown is dropped. Nothing leaves this device.</div>';
  });
  if (!el || !el.querySelector) return;
  const out = el.querySelector('.mg-result');
  el.querySelector('input.mg-file').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.size > IMPORT_MAX) { out.textContent = 'Could not import: that file is over 2 MB.'; return; }
    let text = ''; try { text = await f.text(); } catch (_) { out.textContent = 'Could not import: that file could not be read.'; return; }
    const before = readGraph(), r = importInto(before, text);
    if (!r.ok) { out.textContent = 'Could not import: ' + r.why + '.'; return; }
    undoText = JSON.stringify(before);
    writeGraph(r.graph);
    out.textContent = 'Imported ' + r.added + ' new and ' + r.merged + ' known' + (r.skipped ? ' (' + r.skipped + ' left out)' : '') + '. ';
    const undo = document.createElement('button'); undo.type = 'button'; undo.className = 'mg-undo'; undo.textContent = 'Undo'; undo.style.cssText = BTN;
    undo.addEventListener('click', () => { undoImport(api); });
    out.append(undo);
    say('memory imported · ' + r.added + ' new');
  });
}

async function undoImport(api) {
  if (undoText == null) { api.say('nothing to undo: no memory import this visit'); return; }
  try { localStorage.setItem(GRAPH_KEY, undoText); } catch (_) { api.say('could not undo'); return; }
  undoText = null;
  return show(api, 'memory import undone');
}

async function run(text, api) {
  const what = graphAskOf(text);
  if (!what) return 'none';
  if (what === 'forget') { clearGraph(); return show(api, 'forgotten: your patterns are gone from this device'); }
  if (what === 'stop') { setOn(null, false); return show(api, 'stopped: I keep nothing new you ask about'); }
  if (what === 'start') { setOn(null, true); return show(api, 'remembering again, on this device'); }
  if (what === 'export') { exportCard(api); return 'memory-graph'; }
  if (what === 'preview') { previewCard(api); return 'memory-graph'; }
  if (what === 'import') { importCard(api); return 'memory-graph'; }
  if (what === 'undo-import') { await undoImport(api); return 'memory-graph'; }
  return show(api, '');
}

export default {
  name: 'memory-graph',
  examples: ['what do you know about me', 'what are my interests', 'what do I usually ask for', 'my patterns', 'forget my patterns', 'stop remembering', 'start remembering', 'export my memory', 'download my graph', 'back up what you know about me', 'export my patterns as json', 'preview my memory', "what's in my memory export", 'import my memory'],
  nearMisses: ['export my stage as json', 'import a stage from json', 'back up my files', 'download the report', 'import my contacts', 'remember that I like tea', 'what do you remember about the parser', 'what is a knowledge graph', 'who am I', 'remember me', 'what do you keep about me'],
  match(lower, text) { return !!graphAskOf(text || lower); },
  run,
  graphAskOf, cardHtml,
};
