// Void's growth record: everything it has absorbed, as one visible progression (Adam, 2026-09-30: clear progress, obvious upgrades,
// fun and easy; Void absorbs from everything it meets). Nothing here is new machinery. It is the one place that names what
// the existing pieces already did: intake takes things in, the will chooses, the queue builds, skills go live, the board
// shows what is still out of reach.
//   mass   what each absorbed thing weighs (an ability 3, a source 2, something that makes everything easier 4, a link 5)
//   level  from total mass; every level says what changed
//   orbit  what is near and not absorbed yet: links a person can connect (one step, the payoff named), the will's wants,
//          the board's top misses
// A skill file shipped without an entry here fails the tests, so nothing Void gains goes unrecorded.
export const WEIGHT = { skill: 3, source: 2, passive: 4, link: 5 };

// `at`: the day it went live as the docs record it (stage, Wikipedia, Wiktionary, board, calculation, currency, your own look:
// 2026-09-25 in STANDING.md and void.assimilate.md), otherwise the day it first appears in this repo's history (which starts 2026-09-27)
export const ABSORBED = [
  { id: 'stage', kind: 'skill', name: 'The stage', at: '2026-09-25', gives: 'clocks, timers, notes, lists, calculators, counters, shapes, images and links appear when asked' },
  { id: 'wikipedia', kind: 'source', name: 'Wikipedia', at: '2026-09-25', gives: 'a sourced page about anything, dated', from: 'wikipedia.org' },
  { id: 'wiktionary', kind: 'source', name: 'Wiktionary', at: '2026-09-25', gives: 'words it has never seen', from: 'wiktionary.org' },
  { id: 'calc', kind: 'skill', name: 'Calculation', at: '2026-09-25', gives: 'percentages, units, dates and countdowns' },
  { id: 'ecb', kind: 'source', name: 'European Central Bank rates', at: '2026-09-25', gives: '31 currencies, with the rate\'s date', from: 'frankfurter.dev' },
  { id: 'board', kind: 'passive', name: 'The board', at: '2026-09-25', gives: 'every question it could not answer becomes the next thing to learn', eases: 'nothing asked is lost' },
  { id: 'look', kind: 'skill', name: 'Your own Void', at: '2026-09-25', gives: 'a colour, stars and depth that stay yours' },
  { id: 'weather', kind: 'skill', name: 'Weather', at: '2026-09-27', gives: 'weather anywhere', from: 'open-meteo.com' },
  { id: 'place', kind: 'skill', name: 'Maps', at: '2026-09-27', gives: 'a map of anywhere, and directions', from: 'openstreetmap.org' },
  { id: 'translate', kind: 'skill', name: 'Translation', at: '2026-09-27', gives: 'any phrase in another language, copyable', from: 'Google Translate, MyMemory' },
  { id: 'rebuild-map', kind: 'skill', name: 'Map rebuild', at: '2026-09-27', gives: 'redraws a kept map when asked' },
  { id: 'skill-slots', kind: 'passive', name: 'Skill slots', at: '2026-09-27', gives: 'a new ability is one file', eases: 'cost of a new skill: one file plus one line' },
  { id: 'answers', kind: 'skill', name: 'Answers', at: '2026-09-27', gives: 'a short sourced answer to a question no skill covers', from: 'Workers AI' },
  { id: 'will', kind: 'passive', name: 'The will', at: '2026-09-27', gives: 'Void chooses what to become next from everything it has seen', eases: 'nobody has to decide the next build' },
  { id: 'intake', kind: 'passive', name: 'Intake', at: '2026-09-27', gives: 'everything that passes through Void is kept as input, never lost', eases: 'ideas from anywhere become candidates' },
  { id: 'queue', kind: 'passive', name: 'Build queue', at: '2026-09-27', gives: '"update yourself" queues a build the builders pick up', eases: 'one line to start a build' },
  { id: 'tests', kind: 'passive', name: 'Armor (the test suite)', at: '2026-09-27', gives: 'about 190 checks run before anything ships', eases: 'nothing new can quietly break something old' },
  { id: 'confirm', kind: 'passive', name: 'The confirm line', at: '2026-09-28', gives: 'nothing that sends, books or spends runs without a yes', eases: 'safe to let it act' },
  { id: 'passkeys', kind: 'link', name: 'Passkeys', at: '2026-09-28', gives: 'your Void on every device, no password or email' },
  { id: 'worldtime', kind: 'skill', name: 'World time', at: '2026-09-28', gives: 'the time anywhere, sunrise and sunset, a world clock, the gap between two places' },
  { id: 'calendar', kind: 'skill', name: 'Calendar', at: '2026-09-28', gives: 'dates and plans kept in your own Void' },
  { id: 'define', kind: 'skill', name: 'Definitions', at: '2026-09-29', gives: 'what a word means, from Wiktionary' },
  { id: 'publish', kind: 'skill', name: 'Your page', at: '2026-09-28', gives: 'publish your Void at a-to-mind.com/@name' },
  { id: 'deploy-key', kind: 'link', name: 'Auto-deploy', at: '2026-09-29', gives: 'every merge goes live by itself', eases: 'human steps to ship: 1 → 0' },
  { id: 'rewordings', kind: 'passive', name: 'One ask, many words', at: '2026-09-29', gives: 'the board counts a question once however it is worded', eases: 'the real top asks are obvious' },
  { id: 'handoff', kind: 'passive', name: 'Handoff', at: '2026-09-29', gives: 'agents and people pass files by link at /handoff', eases: 'no more copy-paste between chats' },
  { id: 'growth', kind: 'passive', name: 'Level and orbit', at: '2026-09-30', gives: 'everything absorbed, the level, and what is in orbit, on one page', eases: 'progress is visible at a glance' },
];

// Links a person can connect. Each is one step, and says exactly what it unlocks. `has(env)` reads bindings only (never values).
export const LINKS = [
  { id: 'memory', name: 'Memory (D1)', has: (env) => !!env.DB, gives: 'the board, passkeys, pages and the queue remember', step: 'bind a D1 database as DB on the Pages project a-to-mind' },
  { id: 'mind', name: 'A mind (Workers AI)', has: (env) => !!env.AI, gives: 'sourced answers to anything no skill covers', step: 'bind Workers AI as AI on the Pages project a-to-mind' },
  { id: 'owner-key', name: 'Owner key', has: (env) => !!env.READ_TOKEN, gives: 'your board, queue and earnings open for you alone', step: 'add READ_TOKEN under Pages a-to-mind → Settings → Variables and Secrets' },
  { id: 'handoff-key', name: 'Handoff key', has: (env) => !!env.HANDOFF_TOKEN, gives: 'drop files at /handoff and get a link back', step: 'add HANDOFF_TOKEN (any long random string) under Pages a-to-mind → Settings → Variables and Secrets' },
  { id: 'gumroad', name: 'Gumroad sales', has: (env) => !!env.GUMROAD_ACCESS_TOKEN, gives: 'every sale becomes budget Void can grow with', step: 'add GUMROAD_ACCESS_TOKEN under Pages a-to-mind → Settings → Variables and Secrets' },
  { id: 'builder', name: 'Instant builds', has: (env) => !!env.BUILDER_WEBHOOK_URL, gives: '"update yourself" starts a build at once instead of waiting for the laptop', step: 'add BUILDER_WEBHOOK_URL under Pages a-to-mind → Settings → Variables and Secrets' },
];

// level L starts at 5·L·(L-1)/2 mass: 0, 5, 15, 30, 50, 75, 105, 140, ...
export const levelStart = (L) => (5 * L * (L - 1)) / 2;
export function levelOf(mass) {
  let L = 1;
  while (levelStart(L + 1) <= mass) L += 1;
  return { level: L, from: levelStart(L), next: levelStart(L + 1) };
}
export function massOf(items) { return items.reduce((s, x) => s + (WEIGHT[x.kind] || 0), 0); }

// public: the level and everything absorbed. owner: also which links are connected and the one step for each that is not.
export function growth(env, { owner = false } = {}) {
  const links = LINKS.map((l) => ({ id: l.id, name: l.name, gives: l.gives, on: !!l.has(env || {}), step: l.step }));
  const linked = links.filter((l) => l.on).map((l) => ({ id: 'link:' + l.id, kind: 'link', name: l.name, gives: l.gives }));
  const seq = ABSORBED.slice().sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0)); // oldest first, stable
  const absorbed = seq.concat(linked);
  const mass = massOf(absorbed);
  const lv = levelOf(mass);
  // the level each absorption reached, so the page can say "level 6 reached with Handoff"
  let run = 0; const ups = [];
  for (const x of absorbed) { const before = levelOf(run).level; run += WEIGHT[x.kind] || 0; const after = levelOf(run).level; if (after > before) ups.push({ level: after, with: x.name, at: x.at || null }); }
  const out = { level: lv.level, mass, from: lv.from, next: lv.next, absorbed: seq, levelUps: ups, counts: {} };
  for (const k of Object.keys(WEIGHT)) out.counts[k] = absorbed.filter((x) => x.kind === k).length;
  if (owner) out.links = links; else out.orbitLinks = links.filter((l) => !l.on).length;
  return out;
}
