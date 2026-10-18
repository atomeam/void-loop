/**
 * memory-graph skill - "What I've noticed" (asked by Void, 2026-10-18: "an upgrade that lets me keep a persistent, personal knowledge
 * graph across conversations—so I could remember details you've shared before, notice patterns in your interests, and build on them
 * over time without you having to repeat anything"). The page notes which skill answered each ask and a few object words of it in a
 * small graph on this device (lib/memory-graph.js, the `graph` store in lib/state.js); this card reads it back: your top interests as
 * chips (a tap asks that skill's own example), the skills you ask for together, when you usually visit, what you have not come back to,
 * and "Next, maybe": at most three asks taken only from skills' own examples. Nothing here leaves the device; the card says so.
 * "what do you know about me", "what are my interests", "what do I usually ask for", "my patterns"; "forget my patterns" clears it,
 * "stop remembering" turns the noting off, "start remembering" turns it on. "remember that I like tea" and "what do you remember about
 * the parser" are the memory skill's; "who am I" is the sign-in line; "what is a knowledge graph" is a question for the web.
 */
import { readGraph, patterns, suggest, clearGraph, setOn, GRAPH_KEY } from '../lib/memory-graph.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const SHOW_RE = /^(?:what do you know about me|what (?:are|do you think are) my interests|what do i usually ask (?:for|about)|what do i ask (?:for|about) most|(?:show (?:me )?)?my patterns|what have you noticed(?: about me)?|what do you know about my interests|what patterns have you (?:seen|noticed))$/;
const FORGET_RE = /^(?:forget|clear|reset|wipe) my patterns$/;
const STOP_RE = /^stop remembering(?: me| my asks| my patterns| what i ask(?: for)?)?$/;
const START_RE = /^(?:start|resume) remembering(?: me| my asks| my patterns| what i ask(?: for)?)?$/;
/** what the ask wants: 'show', 'forget', 'stop', 'start' or ''. Pure. */
export function graphAskOf(text) {
  const t = CLEAN(text);
  return SHOW_RE.test(t) ? 'show' : FORGET_RE.test(t) ? 'forget' : STOP_RE.test(t) ? 'stop' : START_RE.test(t) ? 'start' : '';
}

const CSS = '.mg-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}.mg-chip{display:inline-block;padding:4px 10px;border:1px solid rgba(255,255,255,.18);border-radius:999px;color:var(--fg);text-decoration:none;font-size:13px}.mg-chip:hover{background:rgba(255,255,255,.08)}.mg-chip small{opacity:.6;margin-left:4px}.mg-h{margin:12px 0 2px;font-size:14px}.mg-btns{display:flex;gap:8px;margin-top:12px}';
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
  const chip = (label, n, ask) => (ask ? '<a href="#" class="mg-chip" data-ask="' + esc(ask) + '" title="' + esc('ask: ' + ask) + '">' : '<span class="mg-chip">') + esc(label) + '<small>' + esc(String(n)) + '</small>' + (ask ? '</a>' : '</span>');
  let h = '<h2>What I\'ve noticed</h2>';
  if (!p.on) h += '<p class="sub">Off: I am not keeping what you ask about. "start remembering" turns it back on.</p>';
  if (!p.asks && !p.facts.length) {
    h += '<p>Nothing yet. Ask for a few things and come back: I will keep which skills you use and a few words of what for, here on this device.</p>';
  } else {
    h += '<div class="sub">from ' + esc(String(p.asks)) + ' ask' + (p.asks === 1 ? '' : 's') + ' on this device' + (p.first ? ' since ' + esc(day(p.first)) : '') + '</div>';
    if (p.interests.length) h += '<h3 class="mg-h">Your interests</h3><div class="mg-chips mg-interests">' + p.interests.map((t) => chip(t.label, t.n, firstAsk(t.skill))).join('') + '</div>';
    if (p.pairs.length) h += '<h3 class="mg-h">Usually together</h3><ul class="mg-pairs">' + p.pairs.map((pr) => '<li>' + esc(pr.a) + ' and ' + esc(pr.b) + ', together ' + esc(String(pr.n)) + ' times</li>').join('') + '</ul>';
    if (p.when.words) h += '<h3 class="mg-h">When you visit</h3><p class="mg-when">' + esc(p.when.words) + '</p>';
    if (p.lapsed.length) h += '<h3 class="mg-h">Not come back to</h3><ul class="mg-lapsed">' + p.lapsed.map((t) => '<li>' + esc(t.label) + ' (asked ' + esc(String(t.n)) + ' times, last ' + esc(String(t.days)) + ' days ago)</li>').join('') + '</ul>';
    if (p.facts.length) h += '<h3 class="mg-h">You told me</h3><ul class="mg-facts">' + p.facts.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul>';
    if (sug.length) h += '<h3 class="mg-h">Next, maybe</h3><div class="mg-chips mg-next">' + sug.map((s) => '<a href="#" class="mg-chip" data-ask="' + esc(s.ask) + '" title="' + esc(s.why) + '">' + esc(s.ask) + '</a>').join('') + '</div>';
  }
  h += '<div class="mg-btns"><a href="#" class="btn mg-forget" data-ask="forget my patterns">Forget</a>' + (p.on ? '<a href="#" class="btn mg-stop" data-ask="stop remembering">Stop</a>' : '<a href="#" class="btn mg-start" data-ask="start remembering">Start</a>') + '</div>';
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
  showPage((el) => { el.innerHTML = cardHtml(esc, p, sug, examples); });
  if (said) say(said);
  return 'memory-graph';
}

async function run(text, api) {
  const what = graphAskOf(text);
  if (!what) return 'none';
  if (what === 'forget') { clearGraph(); return show(api, 'forgotten: your patterns are gone from this device'); }
  if (what === 'stop') { setOn(null, false); return show(api, 'stopped: I keep nothing new you ask about'); }
  if (what === 'start') { setOn(null, true); return show(api, 'remembering again, on this device'); }
  return show(api, '');
}

export default {
  name: 'memory-graph',
  examples: ['what do you know about me', 'what are my interests', 'what do I usually ask for', 'my patterns', 'forget my patterns', 'stop remembering', 'start remembering'],
  nearMisses: ['remember that I like tea', 'what do you remember about the parser', 'what is a knowledge graph', 'who am I', 'remember me', 'what do you keep about me'],
  match(lower, text) { return !!graphAskOf(text || lower); },
  run,
  graphAskOf, cardHtml,
};
