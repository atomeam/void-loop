/**
 * inventory skill — assimilate row 6 (Inventory orchestrator → Void)
 * Feeds agents and anyone who asks with "already built" rows so they reuse before rebuilding.
 * Skill ids come from skills/index.json so the list cannot drift from the registry.
 * No network. Tessl / BoardKit exist outside Void; this is Void's own form.
 */
import skillNames from './index.json' with { type: 'json' };

const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

export const SKILL_NAMES = skillNames;

/** Words for a skill id. Unknown ids still show, under their registry name. */
const WHAT = {
  part: 'named printable parts (Linemote-1 and the like)',
  figure: 'summoned figures on the stage',
  make: 'make an app from stage parts',
  weather: 'weather and forecasts',
  air: 'air quality',
  uv: 'UV index',
  quake: 'recent earthquakes',
  pollen: 'pollen',
  spanish: 'answers in Spanish',
  translate: 'translation',
  'rebuild-map': 'assimilation map (what is being rebuilt as Void)',
  place: 'street maps and places',
  worldtime: 'world clock, time zones, sunrise/sunset',
  define: 'definitions',
  news: 'headlines (incl. tech via Hacker News)',
  words: 'word maths and word play',
  country: 'countries',
  distance: 'distances',
  joke: 'jokes',
  recipe: 'recipes',
  crypto: 'crypto prices',
  loan: 'loan payments',
  fuel: 'fuel cost',
  tip: 'tips and splits',
  util: 'passwords, QR, colours, moon, lorem',
  remind: 'a reminder held on the confirm line',
  calendar: 'calendar / agenda on this device',
  today: "what Void did today (this device's loop log)",
  book: 'books (Open Library)',
  show: 'TV shows (TVMaze)',
  sport: 'teams (TheSportsDB)',
  holidays: 'public holidays',
  work: 'remote jobs (Remotive)',
  share: 'share this card',
  recent: 'recent asks on an empty box',
  magnetize: 'the post-print magnetize step',
  inventory: 'this list — already built rows',
};

export const SKILLS_BUILT = SKILL_NAMES.map((id) => ({ id, what: WHAT[id] || id }));

export const TOOLS_BUILT = [
  { id: 'existing-tools.md', what: 'registry of tools to check before building anything' },
  { id: 'confirm line', what: 'yes before any send, book or spend' },
  { id: 'Workers AI + router', what: 'Gemma answers; bge-m3 routes; paid model only from earnings' },
  { id: 'passkeys', what: 'your Void follows you across devices' },
  { id: 'WebMCP tools.json', what: 'Void tools declared for browser agents' },
  { id: 'Gumroad catalog', what: 'live store products when asked' },
  { id: 'defences middleware', what: 'limits, secret masking, CSP, no cross-site writes' },
  { id: 'growth inbox', what: 'unfinished features written down before they are built' },
];

export const ASSIMILATE_LIVE = [
  { id: 'board (misses)', what: 'show the board — what people asked that Void cannot answer yet' },
  { id: 'skill files', what: 'edit engine step 1 — skills as files Void loads' },
  { id: 'today', what: 'what did you do today' },
  { id: 'work', what: 'find me work as a …' },
  { id: 'inventory', what: 'already built rows (this skill + board section)' },
  { id: 'ops log', what: 'void.agents.log.md' },
  { id: 'open sources', what: 'Wikipedia / Wiktionary / Open-Meteo' },
  { id: 'calc', what: 'percentages, units, dates, currency' },
  { id: 'your void', what: 'silent entry + personal look per browser' },
];

export function inventoryOf(text) {
  const t = CLEAN(text);
  if (!t) return null;
  if (/^(?:what\s+(?:can|could)\s+(?:you|i|void|the\s+forge)\s+(?:3d[\s-]?)?(?:print|make)(?:\s+for\s+me)?|show\s+(?:me\s+)?what\s+you\s+can\s+(?:3d[\s-]?)?print|list\s+(?:the\s+)?printable\s+things|what\s+physical\s+things\s+can\s+you\s+make|what\s+(?:things\s+)?(?:are|is)\s+printable)$/i.test(t)
    && !/^what\s+can\s+(?:you|i|void)\s+make$/i.test(t)) return { kind: 'printable' };
  let m = t.match(/^(?:have\s+we\s+built|did\s+we\s+build|is\s+there\s+already|do\s+we\s+already\s+have|already\s+built)\s+(.+)$/i);
  if (m) {
    const q = m[1].replace(/^(?:a|an|the)\s+/i, '').trim();
    if (q && q.length >= 2 && !/^(?:it|that|this|me|you)$/i.test(q)) return { kind: 'query', q };
  }
  if (/^(?:what(?:'s|\s+is|\s+are)\s+(?:already\s+)?(?:built|here)|what(?:'s|\s+is)\s+(?:in\s+)?(?:the\s+)?inventory|show\s+(?:me\s+)?(?:the\s+)?inventory|already\s+built|show\s+(?:me\s+)?what(?:'s|\s+is)\s+already\s+built|list\s+(?:what(?:'s|\s+is)\s+)?already\s+built|what\s+can\s+i\s+reuse)$/i.test(t)) {
    return { kind: 'all' };
  }
  return null;
}

/** What Void can make in the world right now: every forge thing whose file passes the same check "print it" runs
 *  (forge-rules.js verifyStl, the file read back and held to its model), with its size and solid-PLA weight; one that
 *  fails is held back with the reason. Computed from the recipes on each ask: nothing about anyone is kept. */
export async function printable(verify) {
  const F = await import('./forge-rules.js');
  const check = verify || F.verifyStl, ready = [], held = [];
  for (const key of Object.keys(F.THINGS)) {
    const m = F.build(key), v = check(F.stl(m), m);
    if (!v.ok) { held.push({ key, label: m.label, why: v.problems.join(' · ') }); continue; }
    const pc = F.printCheck(m);
    ready.push({ key, label: m.label, size: m.size.map((x) => Math.round(x)).join(' × ') + ' mm', grams: pc.grams, supports: pc.supports, ask: 'make me a ' + m.label.toLowerCase() });
  }
  return { ready, held, total: ready.length + held.length, bed: F.BED_MM };
}
export function printableHtml(esc, p) {
  const rows = p.ready.map((r) => '<li><b>' + esc(r.label) + '</b> — ' + esc(r.size) + ', about ' + r.grams + ' g in solid PLA' + (r.supports ? ', with supports' : '') + ' · say “' + esc(r.ask) + '”</li>').join('');
  const held = p.held.map((r) => '<li><b>' + esc(r.label) + '</b> — ' + esc(r.why) + '</li>').join('');
  return '<h2>What I can print</h2>'
    + '<div class="sub">Printable now · ' + p.ready.length + ' of ' + p.total + ' checked · each file read back and held to its model (watertight, facing out, inside a ' + p.bed + ' mm bed) before it is listed</div>'
    + '<ul>' + rows + '</ul>'
    + (held.length ? '<div class="sub">Held back (their files did not pass)</div><ul>' + held + '</ul>' : '')
    + '<div class="sub">And the stage itself</div><ul><li><b>The stage</b> — every 3D figure on it as one 3MF · say “export a print file”</li></ul>'
    + '<div class="src">Source: the forge recipes (skills/forge-rules.js), checked on this ask · nothing about you is kept</div>';
}

function hay(row) {
  return (row.id + ' ' + row.what).toLowerCase();
}

function matchesQuery(rows, q) {
  const needle = String(q || '').toLowerCase().replace(/[^a-z0-9\s+-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!needle) return rows;
  const parts = needle.split(' ').filter(Boolean);
  return rows.filter((r) => {
    const h = hay(r);
    return parts.every((p) => h.includes(p)) || h.includes(needle);
  });
}

export function boardSectionHtml(esc) {
  const skills = SKILLS_BUILT.map((r) => '<li><b>' + esc(r.id) + '</b> — ' + esc(r.what) + '</li>').join('');
  const tools = TOOLS_BUILT.map((r) => '<li><b>' + esc(r.id) + '</b> — ' + esc(r.what) + '</li>').join('');
  return '<div class="sub" style="margin-top:18px">Already built · reuse these before queuing a rebuild</div>'
    + '<p style="color:#8a8a8a;font-size:13px;margin:4px 0 8px">Skills live on the stage; tools are in the repo. Say “what\'s already built” anytime.</p>'
    + '<div class="sub">Skills</div><ul>' + skills + '</ul>'
    + '<div class="sub">Tools &amp; features</div><ul>' + tools + '</ul>';
}

function pageHtml(esc, hit) {
  if (hit.kind === 'query') {
    const all = [...SKILLS_BUILT, ...TOOLS_BUILT, ...ASSIMILATE_LIVE];
    const found = matchesQuery(all, hit.q);
    if (!found.length) {
      return '<h2>Already built</h2><p>Nothing on the inventory matches “' + esc(hit.q) + '”. Check <span style="color:#8a8a8a">domains/void.existing-tools.md</span> before building.</p>'
        + '<div class="sub">Say “what\'s already built” for the full list.</div>';
    }
    const rows = found.map((r) => '<li><b>' + esc(r.id) + '</b> — ' + esc(r.what) + '</li>').join('');
    return '<h2>Already built · ' + esc(hit.q) + '</h2><div class="sub">Matches in skills, tools and live assimilate rows · reuse before rebuilding</div><ul>' + rows + '</ul>'
      + '<div class="src">Source: Void inventory · skills/index.json</div>';
  }
  const skills = SKILLS_BUILT.map((r) => '<li><b>' + esc(r.id) + '</b> — ' + esc(r.what) + '</li>').join('');
  const tools = TOOLS_BUILT.map((r) => '<li><b>' + esc(r.id) + '</b> — ' + esc(r.what) + '</li>').join('');
  const assim = ASSIMILATE_LIVE.map((r) => '<li><b>' + esc(r.id) + '</b> — ' + esc(r.what) + '</li>').join('');
  return '<h2>Already built</h2>'
    + '<div class="sub">Reuse these before building · Atom\'s rule · nothing thrown out</div>'
    + '<div class="sub" style="margin-top:12px">Skills</div><ul>' + skills + '</ul>'
    + '<div class="sub">Tools &amp; features</div><ul>' + tools + '</ul>'
    + '<div class="sub">Assimilate (live)</div><ul>' + assim + '</ul>'
    + '<div class="src">Source: Void inventory · skills/index.json, domains/void.existing-tools.md, domains/void.assimilate.md</div>';
}

async function run(text, api) {
  const { showPage, esc, loopLog } = api;
  const hit = inventoryOf(text);
  if (!hit) return 'none';
  const p = hit.kind === 'printable' ? await printable() : null;
  const el = showPage((page) => { page.innerHTML = p ? printableHtml(esc, p) : pageHtml(esc, hit); });
  if (loopLog) loopLog({ domain: 'void.inventory', ask: text, score: 'pass', note: hit.kind === 'query' ? 'query:' + hit.q : hit.kind });
  return el ? 'inventory' : 'inventory';
}

export default {
  name: 'inventory',
  examples: [
    "what's already built",
    'what is already built',
    'show inventory',
    'already built',
    'have we built passkeys',
    'did we build the confirm line',
    'what can i reuse',
    'what can you print',
    'what can the forge make',
  ],
  nearMisses: [
    'build inventory',
    'stock inventory',
    'inventory of my fridge',
    'show the board',
    'show the map',
    'what are you building',
    'make an inventory app',
    'print it',
    'what can you do',
  ],
  match(lower, text) { return !!inventoryOf(text); },
  run,
};
