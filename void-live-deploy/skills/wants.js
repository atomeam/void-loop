/**
 * wants skill - "what do you want built now", "name all your unbuilt asks", "your backlog": one card, "What I want built", read from
 * Verse's own records and never from a model (the owner, 2026-10-18: "name all your unbuilt asks and come up with 50 more new ones" fell
 * to the model, which said Verse had no catalog of unbuilt asks and made 50 up; "The router needs a hardcoded context injection so Verse
 * always knows its own developmental state"). Three blocks: "My will" (GET /api/will, the wants the self card shows too), "Asked, not
 * built yet" (GET /api/reflect `asks`: each with when it was asked and "I called it small" when so, the list the self card folds) and
 * "Growth inbox" (/self.json `open`: the open items of domains/void.frontier.md, written at deploy by tools/self-context.mjs; no new
 * route), a count line "N wants · M asks not built · K inbox items", and every item a tap-to-copy chip. A compound ask is matched on
 * its first clause ("name all your unbuilt asks and come up with 50 more new ones"): the card lists what Verse has and says the 50 new
 * ones are the asker's to ask for one at a time. A record that cannot be read says so on its block; nothing is guessed. "what do you
 * want to be" (the will card), "what do you think of yourself" (the self card), "what can you do" (the self page), "what's next?" (the
 * calendar), "what's on my list" and "what do I want for dinner" are not this.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
const YOU = "(?:you|(?:verse|v01d)|(?:verse|void)|verse)", YOUR = "(?:your|(?:verse|v01d)'s|(?:verse|void)'s|verse's|(?:verse|v01d)|(?:verse|void)|verse)";
const LISTS = "(?:wants|wishes|unbuilt asks|open asks|asks not built|asks not built yet|unbuilt wants|unbuilt items|open items|backlog|wish ?list|want list|list of wants|to-?do list|todo|growth inbox|inbox|open list|build list|unbuilt list)";
const RULES = [
  // the reasoning trace (asked by Verse, 2026-10-21): "why do you want those upgrades", "show the reasoning behind your wants", "wants reasoning trace"
  new RegExp('^(?:why (?:do|did) ' + YOU + ' (?:want|ask for) (?:those|these|all those|all that|them|your) (?:upgrades|wants|asks|things)|(?:(?:show|open|see|explain)(?: me)? )?(?:the |' + YOUR + ' )?(?:reasoning|reasons|why) (?:behind|for) ' + YOUR + ' (?:wants|asks|upgrades)|(?:' + YOUR + ' )?wants? reasoning[- ]trace)$'),
  // "growth speed", "show your growth-speed gauge" (asked by Verse: "Connect the 'wants' backlog to a visual 'growth-speed' gauge on the stage"): the
  // card's want-to-skill meter is that gauge, so the words open this card (lists run, 2026-10-21) instead of a second skill
  /^(?:(?:show|open|see)(?: me)? )?(?:the |your |(?:verse|v01d|void)'?s )?(?:growth[- ]speed(?: gauge| meter)?|growth (?:gauge|meter)|want(?:s)?[- ]to[- ]skill (?:gauge|meter|speed))$/,
  // "what do you want", "what do you want built now", "what do you want to learn", "what else do you want", "what do you want next", never "to be / to become / to do" (the will card)
  new RegExp('^(?:so |ok(?:ay)?,? )?what (?:else |more )?(?:do|does|would|did) ' + YOU + ' (?:want|wish for|wish)(?: (?:built|made|done|to build|to learn|to see built|to get|to have|building|next|now|most|the most|built now|built next|to build next|to learn next|us to build|me to build))*$'),
  new RegExp('^what(?:\'s| is| are) (?:on )?' + YOUR + ' (?:' + LISTS + '|list|plate)$'),
  // "what is still open", "what is unbuilt", "what is not built yet": never a bare "what is open" (a shop, a file)
  new RegExp('^what(?:\'s| is| are) (?:(?:still|left|not yet) (?:open|unbuilt|not built|undone)|unbuilt|not built(?: yet)?|left to build|left on ' + YOUR + ' (?:list|plate|backlog))(?: for ' + YOU + ')?$'),
  new RegExp('^what(?:\'s| is|s) (?:next|coming|coming up|on the list|on the plate|left) for ' + YOU + '$'),
  // "what needs built" (owner, 2026-10-19: it reached the model, which answered with Maslow's hierarchy of buildings): the bare ask, ending there, about Verse's own list; "what needs built in my garden" stays out
  new RegExp('^what (?:still |else )?needs (?:to be )?(?:built|building|to build|made)(?: next| now| first)?$'),
  // only the negative forms: "what have you not built yet", "what haven't you built"; "what have you built" is what shipped, not this
  new RegExp('^what (?:(?:have|has|did) ' + YOU + ' not|(?:haven\'t|havent|hasn\'t|hasnt|didn\'t|didnt) ' + YOU + ') (?:built|build|made|make|done|do|shipped|ship|finished|finish)(?: yet)?$'),
  new RegExp('^what (?:have|has|do|does) ' + YOU + ' (?:still |yet )?(?:left|got left|have left|got) to (?:build|make|do|ship)$'),
  new RegExp('^what (?:are|were) ' + YOUR + ' (?:open|unbuilt|remaining|outstanding|pending) (?:asks|wants|items|wishes)$'),
  // "all of your unbuilt wants and asks" (owner, 2026-10-19: it reached the model, which said it has no wants): a bare "all (of)", and two lists joined by "and"
  new RegExp('^(?:(?:(?:name|list|show|show me|tell me|give me|print|read|read me|read out|recite|enumerate)(?: me)?(?: all| every| each|  everything)?|all)(?: of)? )?' + YOUR + ' ' + LISTS + '(?: (?:and|&) (?:' + LISTS + '|asks|wants))?$'),
  new RegExp('^(?:name|list|show|show me|tell me|give me|print|read|read me|read out|recite|enumerate)(?: me)?(?: all| every| each)?(?: of)? (?:the )?(?:things|stuff|asks|wants|items)(?: ' + YOU + ' (?:want|wants|wanted|asked for|asked|have not built|haven\'t built|havent built|still want|want built))?(?: not built| unbuilt| still open| left| yet)?$'),
  // bare noun phrases that can only mean this list ("asks not built?" once reached the open web and answered with Daisy Bell);
  // a bare "todo", "inbox" or "backlog" stays out: those are the visitor's own lists, not Verse's
  // "name your next 10 upgrades you want" (owner, 2026-10-18: it went to the model, which listed generic AI features): upgrades,
  // improvements, features or wishes it wants, always tied to it ("you want", "your"), never "10 upgrades for my laptop"
  new RegExp('^(?:name|list|give me|tell me|show me|show|what are)(?: me)? (?:' + YOUR + '|you|ur) (?:next |top |first )?(?:(?:\\d+|ten|five|three) )?(?:upgrades|improvements|features|wishes)(?: ' + YOU + ' (?:want|would like|wish for|need))?$'),
  new RegExp('^(?:name|list|give me|tell me|show me)(?: me)? (?:the |' + YOUR + ' )?(?:next |top |first )?(?:\\d+|ten|five|three) (?:upgrades|improvements|features|things) ' + YOU + ' (?:want|would like|wish for|need)$'),
  new RegExp('^what (?:upgrades|improvements|features) do ' + YOU + ' want(?: next| most| built)?$'),
  new RegExp('^(?:the |' + YOUR + ' )?(?:(?:open|unbuilt) (?:asks|wants)|asks not built(?: yet)?|unbuilt list|growth inbox)$'),
  new RegExp('^what (?:do|would) ' + YOU + ' (?:like|want) (?:built|to build|to be built|me to build|us to build)(?: next| now| first)?$'),
  new RegExp('^what (?:should|could|can) (?:i|we) build for ' + YOU + '(?: next| now)?$'),
  new RegExp('^what(?:\'s| is) in ' + YOUR + ' (?:' + LISTS + ')$'),
  new RegExp('^(?:what(?:\'s| is| are) )?' + YOUR + ' (?:developmental|current|own) (?:state|backlog|wants|asks)$'),
];
// the will card and the self page keep their asks: these are never this skill's, even when a rule above would take them
const NOT = /^(?:what do you want to (?:be|become|do)|what do you want to be (?:next|now)|your will|what(?:'s| is) your will)$/;
/** the first clause of a compound ask ("name all your unbuilt asks and come up with 50 more new ones" -> "name all your unbuilt asks"),
 *  and the rest. Pure. */
export function clauses(text) {
  const t = CLEAN(text);
  const m = /^(.*?)(?:\s*[,;]\s*|\s+(?:and|then|and then|plus|also)\s+)(?=(?:come up|make up|invent|think of|think up|add|give|write|list|name|suggest|propose|tell|then|also|and|\d))(.*)$/.exec(t);
  return m && m[1] && m[2] ? { first: m[1].trim(), rest: m[2].trim().replace(/^(?:and then|and|then|also|plus)\s+/, '') } : { first: t, rest: '' };
}
/** true when the ask (its first clause) is for Verse's own backlog. Pure. */
export function wantsOf(text) {
  const { first } = clauses(text);
  if (!first || NOT.test(first)) return false;
  return RULES.some((re) => re.test(first)) || (isWishlist(first) && /\b(?:your|ur|(?:verse|v01d|void)'?s?)\b/.test(CLEAN(first)) && !/\b(?:my|our|amazon|steam)\b/.test(CLEAN(first)));
}
/** the one line for a second clause that asks for new ones ("and come up with 50 more new ones"): '' when there is none. Pure. */
export function moreLine(rest) {
  const r = CLEAN(rest);
  if (!r) return '';
  const n = (/\b(\d+)\b/.exec(r) || [])[1];
  if (/\b(?:more|new|fresh|extra|another|others|invent|make up|come up|think (?:of|up)|suggest|propose)\b/.test(r)) return 'The ' + (n ? n + ' ' : '') + 'new ones are yours to ask for one at a time: I list only what I have, never ones made up on the spot.';
  return '';
}

const day = (t) => String(t || '').slice(0, 10);
const sentence = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const MAX = 40; // items a block shows at most (the inbox is the longest list; the whole thing stays one card)
/** the card's model from Verse's three records: { wants, asks, inbox, counts, missing }. A record that is null or not a list is
 *  "missing" (could not be read), an empty list is an empty state. Pure. */
export function cardModel({ will, reflect, self } = {}) {
  const wl = will && Array.isArray(will.wants) ? will.wants : null;
  const ak = reflect && Array.isArray(reflect.asks) ? reflect.asks : null;
  const op = self && Array.isArray(self.open) ? self.open : null;
  const items = (xs) => (xs || []).filter((x) => x && typeof x === 'object');
  // a reason that carries its own brackets ("asked 72 times, last 2026-10-19 (my weakest part today: probes 30)") reads flat: the
  // card puts the whole reason in brackets, and brackets inside brackets read as a glitch (owner, 2026-10-19)
  const wants = items(wl).map((w) => ({ text: sentence(w.i_want || w.title), because: sentence(w.because).replace(/\s*\(([^()]*)\)/g, ' · $1').replace(/^\((.*)\)$/, '$1'), kind: sentence(w.kind), ...whyOf([w.source ? 'Where it came from: ' + sentence(w.source) + '.' : '', w.evidence && sentence(w.evidence) !== sentence(w.because) ? 'Evidence: ' + sentence(w.evidence) + '.' : '']) })).filter((w) => w.text).slice(0, MAX);
  const ents = reflect && Array.isArray(reflect.entries) ? reflect.entries : [];
  const asks = items(ak).map((a) => ({ text: sentence(a.ask), at: day(a.at), small: a.small === true, kind: a.kind === 'daily' ? 'daily' : a.kind === 'build' ? 'build' : '', ...(a.held ? { held: sentence(a.held) } : {}), ...(a.held && a.heldFrontier ? { heldFrontier: sentence(a.heldFrontier) } : {}), ...whyOf(traceOf(a, ents)) })).filter((a) => a.text).slice(0, MAX);
  const inbox = items(op).map((o) => ({ text: sentence(o.ask || o.title), from: sentence(o.from), ...(o.waits ? { waits: sentence(o.waits) } : {}) })).filter((o) => o.text).map((o) => ({ ...o, stream: streamOf(o) })).slice(0, MAX);
  const lapRec = will && will.lap && typeof will.lap === 'object' ? will.lap : null, lastRun = will && will.lastRun && typeof will.lastRun === 'object' ? will.lastRun : null;
  return { wants, asks, inbox, counts: { wants: wants.length, asks: asks.length, inbox: inbox.length }, missing: { will: !wl, reflect: !ak, self: !op }, at: will && will.at ? day(will.at) : '', velocity: velocityOf(reflect && reflect.follow), lap: lapRec && lapRec.line ? String(lapRec.line) + (lapRec.onlySite && lapRec.onlySite.line ? ' · ' + lapRec.onlySite.line : '') + (lapRec.tower && lapRec.tower.line ? ' · ' + lapRec.tower.line : '') : '',
    changed: wl ? changedOf(lapRec, reflect && reflect.follow, lastRun) : null, blocked: blockedOf(asks, inbox), streams: streamsOf(inbox),
    next: nextOf({ lap: lapRec, wants, asks: ak ? asks : null, lastRun, tower: self && self.tower, willRead: !!wl }) };
}

// The three kinds of item, each in one plain line under its heading (owner, 2026-10-29: "make the difference between a want, an ask
// and an inbox item plain"), worded from the code that fills each list: a want is chosen by the will (functions/api/will.js: its top
// 3 from candidates tools/will.py gathers, a want the ledger names built moves to "got"); an ask is said in a reflection
// (lib/voice.js askRecord: open until the ledger or void.asks.json links it built); an inbox item is a line of the frontier's open
// list (tools/self-context.mjs from domains/void.frontier.md), whoever wrote it.
export const DEF = {
  wants: 'A want is something my will chose itself: its top picks from what people ask me, my own asks, my frontier and my misses. It leaves once the ledger shows it built.',
  asks: 'An ask is something I asked to have built, in my own reflections (daily or after a build). It stays until the ledger shows it built.',
  inbox: 'An inbox item is an idea or plan item waiting in my growth inbox (the open list of my frontier), written by the owner, my builders or me.',
};

/** The growth inbox in four workstreams (owner, 2026-10-29). The items have no ids, so keyword rules decide, tried in this order on an
 *  item's words and where it came from, the first match winning; an item no rule takes is "unsorted", so a new item always lands in a
 *  group and a missing rule shows. Pure. */
export const STREAMS = [
  { id: 'platform', label: 'Platform', re: /\b(?:repos?|webmcp|mcp|apis?|other ais|tool inside|input|intake|owner page|crew|becomes a skill|origin trial|deploy\w*|hosting|workers?)\b/ },
  { id: 'reliability', label: 'Reliability', re: /\b(?:tests?|test_\w+|checks?|flak(?:e|y)|fail(?:ed|s|ing|ure)?|churn|stability|health|uptime|outages?|regressions?|crash\w*|slow\w*|minutes)\b/ },
  { id: 'growth', label: 'Growth', re: /\b(?:paid|pay|buyers?|sales?|revenue|earn\w*|prices?|members?|signposts?|seo|traffic|visitors?|marketing|ads)\b/ },
  { id: 'core', label: 'Core experience', re: /\b(?:stage|cards?|notes?|notebook|tasks?|approve|play\w*|games?|shared|together|reviewer|answers?|automations?|pages?)\b/ },
];
export const UNSORTED = { id: 'unsorted', label: 'Unsorted (no rule matched)' };
/** the workstream id of one inbox item ({ text, from }): the first STREAMS rule that matches, else 'unsorted'. Pure. */
export const streamOf = (o) => { const t = ((o && (o.text || o.ask || o.title)) + ' ' + ((o && o.from) || '')).toLowerCase(); const s = STREAMS.find((x) => x.re.test(t)); return s ? s.id : UNSORTED.id; };
/** the inbox by workstream, shown in the owner's order (reliability, core experience, platform, growth; the rules above are tried in
 *  their own order) with unsorted last, empty groups left out: [{ id, label, items }]. Pure. */
const SHOWN = ['reliability', 'core', 'platform', 'growth'];
export function streamsOf(inbox) {
  return [...SHOWN.map((id) => STREAMS.find((g) => g.id === id)), UNSORTED].map((g) => ({ id: g.id, label: g.label, items: (inbox || []).filter((o) => (o.stream || streamOf(o)) === g.id) })).filter((g) => g.items.length);
}

/** What is blocked, with what each waits on: an ask held behind the Versus target (void.asks.json `held`, by /api/reflect), the inbox
 *  line that hold names, and an inbox item that says it waits (self.json `waits`, tools/frontier.mjs waitsOf). [{ text, kind, waits }]. Pure. */
export function blockedOf(asks, inbox) {
  const beaten = (site) => 'held until ' + site + ' is beaten';
  const out = (asks || []).filter((a) => a.held).map((a) => ({ text: a.text, kind: 'ask', waits: beaten(a.held) }));
  const heldLine = new Map((asks || []).filter((a) => a.held && a.heldFrontier).map((a) => [a.heldFrontier.toLowerCase(), a.held]));
  for (const o of inbox || []) {
    const h = heldLine.get(String(o.text).toLowerCase());
    if (h) out.push({ text: o.text, kind: 'inbox', waits: beaten(h) }); else if (o.waits) out.push({ text: o.text, kind: 'inbox', waits: 'waits for ' + o.waits });
  }
  return out;
}

/** What changed this lap, from the lap the will keeps (lib/lap.js publicLap: items sent for upgrade, new features, the newest items
 *  taken, when the lap began) and what became of my asks (/api/reflect `follow`, built on ledger evidence only), plus the will's last
 *  job (lib/will-last.js) so "sent for upgrade" is never read as shipped. Asks built count only from a kept lap start. null when the
 *  lap is not in the will. Pure. */
export function changedOf(lap, follow, lastRun) {
  if (!lap || typeof lap !== 'object' || !(+lap.lap >= 1)) return null;
  const whole = (x) => Math.max(0, Math.round(+x || 0));
  const since = Date.parse(lap.since || '') > 0 ? String(lap.since) : '';
  let built = null;
  if (since && follow && typeof follow === 'object') {
    const seen = new Set(); built = [];
    for (const a of [].concat(Array.isArray(follow.recent) ? follow.recent : [], Array.isArray(follow.asked) ? follow.asked : [])) {
      const t = Date.parse(a && a.at), k = sentence(a && a.ask).toLowerCase();
      if (k && t >= Date.parse(since) && !seen.has(k)) { seen.add(k); built.push(sentence(a.ask)); }
    }
  }
  const run = lastRun && lastRun.title ? { title: sentence(lastRun.title), state: sentence(lastRun.state), shipped: lastRun.shipped === true, at: day(lastRun.at) } : null;
  return { lap: whole(lap.lap), upgraded: whole(lap.upgraded), added: whole(lap.newThisLap), recent: (Array.isArray(lap.recent) ? lap.recent : []).map(sentence).filter(Boolean).slice(0, 3), since: day(since), built, run };
}
/** the changed line: "Lap 1 so far: 2 items sent for upgrade (newest: surface:ask, surface:home) · 0 new features", or "Nothing
 *  changed this lap yet: ..." when nothing did. Pure. */
export function changedLine(c) {
  if (!c) return '';
  const nothing = c.upgraded + c.added + (c.built ? c.built.length : 0) === 0;
  if (nothing) return 'Nothing changed this lap yet: no item sent for upgrade, no new feature' + (c.built ? ', no ask of mine built' : '') + '.';
  return 'Lap ' + c.lap + ' so far: ' + [n(c.upgraded, 'item', 'items') + ' sent for upgrade' + (c.recent.length && c.upgraded ? ' (newest: ' + c.recent.join(', ') + ')' : ''), n(c.added, 'new feature', 'new features'),
    c.built ? n(c.built.length, 'ask of mine built', 'asks of mine built') + (c.built.length ? ': ' + c.built.slice(0, 2).join('; ') + (c.built.length > 2 ? '; …' : '') : '') : ''].filter(Boolean).join(' · ');
}

/** What comes next and why, from what each picker reads. My will (functions/api/will.js POST): while a will job is queued or building
 *  it queues nothing; otherwise the lap's next step (lib/lap.js nextStep: every item once, in the order fixed when the lap began by
 *  overhaulWeights, then NEW_PER_LAP new features from the will's top want). My builders (AGENTS.md): the oldest of my asks nobody has
 *  built, held ones passed over. Versus (self.json `tower`, lib/tower.js): the target until it is beaten, then the next smallest site.
 *  A picker whose record is missing says what is missing instead. Pure. */
export function nextOf({ lap, wants, asks, lastRun, tower, willRead = true } = {}) {
  const out = [];
  if (!willRead || !lap || typeof lap !== 'object') out.push({ id: 'will', missing: 'I cannot name my will\'s next pick: ' + (willRead ? 'my lap was not in my will just now.' : 'I could not read my will just now.') });
  else {
    const wait = lastRun && /^(?:queued|building)$/.test(String(lastRun.state)) && lastRun.title ? ' It is queued once the open will job is done: ' + sentence(lastRun.title) + ' (' + sentence(lastRun.state) + ').' : '';
    const order = 'the lap takes every item once, most-used surfaces first, then site categories, then games, then the rest by name';
    if (lap.next) out.push({ id: 'will', text: 'Upgrade ' + sentence(lap.next), why: 'Its turn in lap ' + (+lap.lap || 1) + ' (' + (+lap.upgraded || 0) + ' of ' + (+lap.skills || 0) + ' taken; ' + order + ').' + wait });
    else if ((+lap.newThisLap || 0) < (+lap.newPerLap || 0)) { const w = (wants || [])[0]; out.push({ id: 'will', text: 'New feature ' + ((+lap.newThisLap || 0) + 1) + ' of ' + lap.newPerLap + (w ? ': ' + w.text : ''), why: 'Every item was taken this lap, so new features come next, from my will\'s top want' + (w ? '' : ' (it has none yet)') + '.' + wait }); }
    else out.push({ id: 'will', text: 'Lap ' + ((+lap.lap || 1) + 1) + ' begins', why: 'This lap took every item and its ' + lap.newPerLap + ' new features.' + wait });
  }
  if (!asks) out.push({ id: 'ask', missing: 'I cannot name the next ask: I could not read my asks just now.' });
  else {
    const free = asks.filter((a) => !a.held), oldest = free.slice().sort((a, b) => (a.at || '9').localeCompare(b.at || '9'))[0];
    if (oldest) out.push({ id: 'ask', text: oldest.text, why: 'The oldest of my asks nobody has built' + (oldest.at ? ' (asked ' + oldest.at + ')' : '') + ': my builders take the oldest first and pass over held ones.' });
    else out.push({ id: 'ask', missing: asks.length ? 'Every ask of mine left is held, so builders have none to take.' : 'No ask of mine is waiting.' });
  }
  if (tower && tower.target) out.push({ id: 'versus', text: sentence(tower.target), why: 'The site I am assimilating now; it stays the target until it is beaten' + (Array.isArray(tower.next) && tower.next[0] ? ', then ' + sentence(tower.next[0]) + ' (smallest first' + (+tower.total > 0 ? ', ' + (+tower.beaten || 0) + ' of ' + tower.total + ' beaten' : '') + ')' : '') + '.' });
  return out;
}
/** Verse asked (2026-10-21): "Implement a 'reasoning-trace' for the 'wants' skill so users can see the specific 'why' I provided for
 *  each upgrade". The reflection that made an ask (/api/reflect `entries`, matched by the ask's id or its exact words): what had just
 *  shipped (or that it was the daily reflection), what I noted about myself then, and what I said should change. Lines from my own
 *  record only, the [S1] fact tags dropped; [] when no kept reflection holds the ask (older ones roll off). Pure. */
export function traceOf(a, entries) {
  const id = a && a.id, k = sentence(a && a.ask).toLowerCase();
  const e = (entries || []).find((x) => x && Array.isArray(x.asks) && x.asks.some((q) => q && ((id && q.id === id) || sentence(q.ask).toLowerCase() === k)));
  if (!e) return [];
  const clean = (t) => sentence(String(t || '').replace(/\s*\[[^\]]*\]/g, ''));
  const prompted = e.kind === 'build' && e.shipped ? 'Prompted by: "' + clean(e.shipped) + '" had just shipped.' : e.kind === 'daily' ? 'Prompted by: my daily reflection.' : '';
  // an ask that carries its own why shows that why, not the reflection's shared text: three asks under one reason read as one ask (owner, 2026-10-29)
  const q = e.asks.find((x) => x && ((id && x.id === id) || sentence(x.ask).toLowerCase() === k)), own = clean((q && q.why) || (a && a.why));
  if (own) return [prompted, 'Why: ' + own.replace(/[^.!?]$/, '$&.')].filter(Boolean);
  return [prompted, e.thoughts ? 'What I noticed: ' + clean(e.thoughts) : '', e.better ? 'What I said should change: ' + clean(e.better) : ''].filter(Boolean);
}
const whyOf = (ls) => { const w = (ls || []).filter(Boolean); return w.length ? { why: w } : {}; };
const WEEK = 7 * 864e5;
/** Verse asked twice (2026-10-19): "Add a 'velocity' indicator to the wants card to show progress from 'want' to 'skill'". From
 *  /api/reflect `follow` only (lib/voice.js followThrough: an ask counts as built on ledger evidence, never a guess): how many of its
 *  asks became something built, and how many were built in the last 7 days against the 7 before. null when the record is not there. Pure. */
export function velocityOf(follow, now = Date.now()) {
  if (!follow || !(+follow.total > 0) || !(+follow.built >= 0)) return null;
  const total = Math.round(+follow.total), built = Math.min(total, Math.round(+follow.built));
  // `recent` is the 30 newest built, `asked` up to 200 in ledger order: together, one of each, they hold the last two weeks
  const seen = new Set(), times = [];
  for (const a of [].concat(Array.isArray(follow.recent) ? follow.recent : [], Array.isArray(follow.asked) ? follow.asked : [])) {
    const t = Date.parse(a && a.at), k = (a && a.ask) + '|' + (a && a.at);
    if (t > 0 && t <= now && !seen.has(k)) { seen.add(k); times.push(t); }
  }
  const week = times.filter((t) => now - t < WEEK).length, before = times.filter((t) => now - t >= WEEK && now - t < 2 * WEEK).length;
  return { total, built, pct: Math.round((100 * built) / total), week, before, trend: week > before ? 'faster' : week < before ? 'slower' : 'steady' };
}
/** the velocity line: "Want → skill: 212 of 300 of my asks built (71%) · 4 in the last 7 days, 2 the 7 before (faster)". Pure. */
export const velocityLine = (v) => (v ? 'Want → skill: ' + v.built + ' of ' + v.total + ' of my asks built (' + v.pct + '%) · ' + v.week + ' in the last 7 days, ' + v.before + ' the 7 before (' + v.trend + ')' : '');
const n = (k, one, many) => k + ' ' + (k === 1 ? one : many);
/** the count line: "N wants · M asks not built · K inbox items". Pure. */
export const countLine = (c) => n(c.wants, 'want', 'wants') + ' · ' + n(c.asks, 'ask not built', 'asks not built') + ' · ' + n(c.inbox, 'inbox item', 'inbox items');
const EMPTY = { wants: 'My will has not chosen anything yet.', asks: 'Everything I asked for has been built.', inbox: 'My growth inbox is empty.' };
const MISSING = { wants: 'I could not read my will just now, so I will not guess at it.', asks: 'I could not read my asks just now, so I will not guess at them.', inbox: 'I could not read my growth inbox just now, so I will not guess at it.' };
const CSS = '.wants-card .wants-count{font-size:13px;color:var(--muted);margin:2px 0 10px}.wants-card .wants-h{font-size:15px;margin:12px 0 2px}.wants-card .wants-def{font-size:12px;color:var(--muted);margin:0 0 6px;line-height:1.4}'
  + '.wants-card .wants-chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0 6px;padding:0;list-style:none}.wants-card .wants-chips li{display:block;max-width:100%}.wants-card .wants-chip{display:inline-block;font:inherit;font-size:13px;line-height:1.35;text-align:left;color:var(--fg);background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:6px 12px;cursor:pointer;max-width:100%}'
  + '.wants-card .wants-velocity{font-size:13px;margin:0 0 8px}.wants-card .wants-meter{height:6px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden;margin-top:4px}.wants-card .wants-meter i{display:block;height:100%;background:var(--accent)}'
  + '.wants-card .wants-chip:hover,.wants-card .wants-chip:focus-visible{background:rgba(255,255,255,.12)}.wants-card .wants-chip.copied{border-color:var(--accent)}.wants-card .wants-chip small{display:block;color:var(--muted);font-size:11px;margin-top:2px}.wants-card .wants-empty{font-size:13px;color:var(--muted);margin:2px 0 6px}.wants-card .wants-more{margin:10px 0 0;font-size:13px}.wants-card .wants-why{font-size:12px;color:var(--muted);margin:2px 0 6px 6px}.wants-card .wants-why summary{cursor:pointer}.wants-card .wants-why p{margin:3px 0;white-space:normal}'
  // the three summaries (next pick, changed this lap, blocked): short lines on a faint panel, readable on a phone
  + '.wants-card .wants-sum{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:2px 10px 6px;margin:8px 0}.wants-card .wants-sum .wants-h{font-size:14px;margin:8px 0 2px}'
  + '.wants-card .wants-lines{list-style:none;margin:2px 0 4px;padding:0;font-size:13px;line-height:1.4}.wants-card .wants-lines li{margin:3px 0;white-space:normal}.wants-card .wants-lines small{display:block;color:var(--muted);font-size:12px}.wants-card .wants-lines .wants-tag{color:var(--accent);font-size:11px;margin-right:4px}'
  + '.wants-card .wants-stream{font-size:12px;color:var(--muted);margin:8px 0 2px;letter-spacing:.02em}.wants-card .wants-streams{font-size:12px;color:var(--muted);margin:0 0 4px}';
/** the card's markup: a title, the count line, the lap and velocity lines, three short summaries (next pick, changed this lap,
 *  blocked), then three blocks (each a heading, the one-line definition of what it holds, chips or its empty or missing line; the
 *  inbox in its workstreams with their counts), the compound line when there is one, and a source line. esc escapes for HTML; every
 *  value goes through it. Pure. */
export function cardHtml(m, esc, { more = '' } = {}) {
  // a span with role="button", not a <button>: a saved or shared card leaves buttons out of its text, and the real wants are what the card is for (owner, 2026-10-18)
  // one list item per want, so a saved or shared card keeps one "- " line each with its date in brackets (owner, 2026-10-19: the saved card ran every item into one paragraph)
  const chip = (text, sub, why) => '<li data-bullet="1"><span role="button" tabindex="0" class="wants-chip" data-copy="' + esc(text) + '" title="tap to copy">' + esc(text) + (sub ? '<small data-share-short="(' + esc(sub) + ')">' + esc(sub) + '</small>' : '') + '</span>'
    + (why && why.length ? '<details class="wants-why" data-trace="' + why.length + '"><summary>Why I want this</summary>' + why.map((l) => '<p>' + esc(l) + '</p>').join('') + '</details>' : '') + '</li>';
  const chips = (items, sub) => '<ul class="wants-chips">' + items.map((it) => chip(it.text, sub(it), it.why)).join('') + '</ul>';
  // the definition sits under its heading and is left out of the saved text, so a card cut to fit still carries the real wants first (owner, 2026-10-18)
  const block = (id, title, items, sub, body) => '<section class="wants-block" data-block="' + id + '" data-n="' + items.length + '"><h3 class="wants-h">' + esc(title) + ' <span class="wants-n">(' + items.length + ')</span></h3>'
    + '<p class="wants-def" data-def="' + id + '" data-share-skip="1">' + esc(DEF[id]) + '</p>'
    + (m.missing[id === 'wants' ? 'will' : id === 'asks' ? 'reflect' : 'self'] ? '<p class="wants-empty" data-missing="1">' + esc(MISSING[id]) + '</p>'
      : items.length ? (body ? body(items, sub) : chips(items, sub)) : '<p class="wants-empty">' + esc(EMPTY[id]) + '</p>') + '</section>';
  // the inbox in its workstreams: a count line, then each group's heading and chips (unsorted last, named as such)
  const streams = (items, sub) => '<p class="wants-streams" data-streams="' + esc(JSON.stringify(Object.fromEntries(m.streams.map((g) => [g.id, g.items.length])))) + '">' + esc(m.streams.map((g) => g.label + ' ' + g.items.length).join(' · ')) + '</p>'
    + m.streams.map((g) => '<div class="wants-group" data-stream="' + esc(g.id) + '" data-n="' + g.items.length + '"><h4 class="wants-stream">' + esc(g.label) + ' (' + g.items.length + ')</h4>' + chips(g.items, sub) + '</div>').join('');
  // the summaries are what to read first on a phone; the saved text leaves them out, as it does the definitions
  const sum = (id, title, inner) => '<section class="wants-sum" data-block="' + id + '" data-share-skip="1"><h3 class="wants-h">' + esc(title) + '</h3>' + inner + '</section>';
  const line = (tag, text, why) => '<li><span class="wants-tag">' + esc(tag) + '</span>' + esc(text) + (why ? '<small>' + esc(why) + '</small>' : '') + '</li>';
  const TAG = { will: 'My will', ask: 'My builders', versus: 'Versus' };
  const next = sum('next', 'Next pick', '<ul class="wants-lines">' + m.next.map((p) => p.missing ? '<li data-pick="' + esc(p.id) + '" data-nopick="1"><span class="wants-tag">' + esc(TAG[p.id]) + '</span>' + esc(p.missing) + '</li>' : line(TAG[p.id], p.text, p.why).replace('<li>', '<li data-pick="' + esc(p.id) + '">')).join('') + '</ul>');
  const c = m.changed, changed = sum('changed', 'Changed this lap', c ? '<p class="wants-def" data-changed="' + esc(c.upgraded + c.added + (c.built ? c.built.length : 0)) + '">' + esc(changedLine(c)) + '</p>'
      + (c.run ? '<p class="wants-def" data-run="' + esc(c.run.shipped ? 'shipped' : c.run.state) + '">' + esc('The will\'s last job' + (c.run.at ? ' (' + c.run.at + ')' : '') + ': ' + c.run.title + (c.run.shipped ? ', shipped.' : ', ' + c.run.state + ', not shipped.')) + '</p>' : '')
      + (c.since ? '' : '<p class="wants-def" data-nosince="1">This lap\'s start was not kept, so I do not count asks built against it.</p>')
    : '<p class="wants-def" data-nolap="1">' + esc(m.missing.will ? 'I could not read my will just now, so I will not guess what changed this lap.' : 'My lap was not in my will just now, so I will not guess what changed this lap.') + '</p>');
  const blocked = sum('blocked', 'Blocked (' + m.blocked.length + ')', m.blocked.length ? '<ul class="wants-lines">' + m.blocked.map((b) => '<li data-kind="' + esc(b.kind) + '"><span class="wants-tag">' + esc(b.kind === 'ask' ? 'Ask' : 'Inbox') + '</span>' + esc(b.text) + '<small>' + esc(b.waits) + '</small></li>').join('') + '</ul>' : '<p class="wants-def">Nothing is held or waiting.</p>');
  return '<style>' + CSS + '</style><h2>What I want built</h2><div class="wants-count" data-counts="' + esc(JSON.stringify(m.counts)) + '">' + esc(countLine(m.counts)) + '</div>'
    + (m.lap ? '<div class="wants-lap" data-lap="1">' + esc(m.lap) + '</div>' : '')
    + (m.velocity ? '<div class="wants-velocity" data-velocity="' + esc(m.velocity.pct) + '" data-trend="' + esc(m.velocity.trend) + '">' + esc(velocityLine(m.velocity)) + '<div class="wants-meter" data-share-skip="1"><i style="width:' + esc(m.velocity.pct) + '%"></i></div></div>' : '')
    + next + changed + blocked
    + block('wants', 'My will', m.wants, (w) => w.because)
    + block('asks', 'Asked, not built yet', m.asks, (a) => ['Asked ' + (a.kind === 'daily' ? 'in my daily reflection' : a.kind === 'build' ? 'after a build' : 'by me') + (a.at ? ', ' + a.at : ''), a.small ? 'I called it small' : '', a.held ? 'held until ' + a.held + ' is beaten' : ''].filter(Boolean).join(' · '))
    + block('inbox', 'Growth inbox', m.inbox, (o) => [o.from, o.waits ? 'waits for ' + o.waits : ''].filter(Boolean).join(' · '), streams)
    + (more ? '<p class="wants-more">' + esc(more) + '</p>' : '')
    + '<div class="src">Source: my will and its lap (/api/will' + (m.at ? ', ' + esc(m.at) : '') + '), my asks and what became of them (/api/reflect) and my growth inbox (/self.json from domains/void.frontier.md). My own records, no model. Tap an item to copy it.</div>';
}

/** "what is on your wishlist?" (owner, 2026-10-21: it opened the build list, not the wishlist): the ranked improvement budget of
 *  docs/wishlist.md, which tools/self-context.mjs writes into /self.json `wishlist`. True when the first clause names the wishlist. Pure. */
export const isWishlist = (text) => /\bwish ?-?list\b/.test(CLEAN(clauses(text).first || text));
/** the wishlist card: each ranked item with its free path, its value and why it sits there; the paid side stays in the doc. Pure. */
export function wishlistHtml(list, esc) {
  const xs = (Array.isArray(list) ? list : []).filter((w) => w && w.item);
  return '<style>' + CSS + '</style><h2>My wishlist</h2><div class="wants-count" data-wishlist="' + xs.length + '">' + esc(xs.length ? xs.length + ' items, ranked by value to people using me now, how sure it works, over cost; free paths first.' : 'I could not read my wishlist just now, so I will not guess at it.') + '</div>'
    + (xs.length ? '<ol class="wish-list" style="padding-left:20px;margin:6px 0">' + xs.map((w) => '<li data-rank="' + esc(w.rank) + '" style="margin:0 0 8px;white-space:normal"><b>' + esc(sentence(w.item)) + '</b>'
      + (w.free ? '<div class="wants-sub">Free path: ' + esc(sentence(w.free)) + '</div>' : '') + (w.value ? '<div class="wants-sub">Value: ' + esc(sentence(w.value)) + '</div>' : '') + (w.why ? '<div class="wants-sub">Why this rank: ' + esc(sentence(w.why)) + '</div>' : '') + '</li>').join('') + '</ol>' : '')
    + '<p class="wants-more">What I want built next is a different list: ask <a href="#" data-ask="what do you want built now">what do you want built now</a>.</p>'
    + '<div class="src">Source: docs/wishlist.md, put into /self.json by tools/self-context.mjs at deploy. Nothing on it is bought or signed up for; spending needs the owner.</div>';
}
const get = async (url) => { try { const r = await fetch(url, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (_) { return null; } };
async function copyText(t) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(t); return true; } } catch (_) {}
  try { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return !!ok; } catch (_) { return false; }
}
async function run(text, api) {
  if (!wantsOf(text)) return 'none';
  const { showPage, esc, say, keepFresh } = api;
  if (isWishlist(text)) {
    const sj = await get('/self.json'), list = sj && sj.wishlist;
    showPage((el) => { el.classList.add('wants-card'); el.innerHTML = wishlistHtml(list, esc); });
    if (say) say(Array.isArray(list) && list.length ? 'my wishlist: ' + list.length + ' items, top: ' + sentence(list[0].item) : 'I could not read my wishlist just now');
    return 'wants';
  }
  const [will, reflect, self] = await Promise.all([get('/api/will'), get('/api/reflect'), get('/self.json')]);
  const m = cardModel({ will, reflect, self }), more = moreLine(clauses(text).rest);
  const card = showPage((el) => {
    el.classList.add('wants-card');
    el.innerHTML = cardHtml(m, esc, { more });
    const tap = async (b) => { const ok = await copyText(b.getAttribute('data-copy')); b.classList.toggle('copied', ok); if (say) say(ok ? 'copied' : 'select it to copy'); };
    el.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-copy]'); if (b) tap(b); });
    el.addEventListener('keydown', (e) => { if (e.key !== 'Enter' && e.key !== ' ') return; const b = e.target.closest && e.target.closest('[data-copy]'); if (b) { e.preventDefault(); tap(b); } });
  });
  // it keeps itself current while it is open (owner, 2026-10-19: "all cards should constantly update"): the same three records every minute, redrawn when they changed
  let was = JSON.stringify(m);
  if (card && keepFresh) keepFresh(card, async () => {
    const [w, r, sj] = await Promise.all([get('/api/will'), get('/api/reflect'), get('/self.json')]);
    const nm = cardModel({ will: w, reflect: r, self: sj }), now = JSON.stringify(nm);
    if (now === was) return;
    was = now; card.innerHTML = cardHtml(nm, esc, { more }); card.dataset.refreshed = String(Date.now());
  });
  if (say) say(countLine(m.counts));
  return 'wants';
}

export default {
  name: 'wants',
  about: "What I want built: my will, the asks of mine nobody has built, and my growth inbox, from my own records, never a model.",
  examples: ['what do you want built now', 'what is on your wishlist?', 'show your wishlist', 'name all your unbuilt asks', 'all of your unbuilt wants and asks', 'asks not built?', 'what have you not built yet', 'your backlog', 'what are your open asks', 'what else do you want', 'whats next for you', 'what do you want to learn', 'name your next 10 upgrades you want', 'name you next 10 upgrades you want', 'what upgrades do you want', 'growth speed', 'show your growth-speed gauge', 'why do you want those upgrades', 'show the reasoning behind your wants', 'wants reasoning trace'],
  nearMisses: ['what needs built in my garden', 'what needs to be built for a shed', 'what do I want for dinner', "what's next?", "what's on my list", 'what do you think of yourself', 'what can you do', 'what do you want to be', 'tell me about yourself', 'name 10 upgrades for my laptop', 'list the improvements to my garden plan', 'what features does the phone have'],
  match(lower, text) { return wantsOf(text || lower); },
  run,
  wantsOf, clauses, moreLine, cardModel, traceOf, cardHtml, countLine, velocityOf, velocityLine, streamOf, streamsOf, blockedOf, changedOf, changedLine, nextOf,
};
