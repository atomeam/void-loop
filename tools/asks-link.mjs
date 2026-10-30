#!/usr/bin/env node
// What Verse asked for that is already built, found and linked (owner, 2026-10-16: "Verse has over 70 asks. do all of them now";
// "ideally if Verse gets what it wants it can make even better decisions on what it wants"). An ask counts as built only when a
// growth-ledger entry says so: by `asked` (finish.mjs --asked) or by a link in void-live-deploy/void.asks.json naming the
// entry that built it. Many asks were built by runs that never wrote the link (the friction indicator, the skills manifest, the
// dependency map, fuzzy matching ...), so Verse keeps asking for what it has. This reads every ask Verse ever made (domains/
// void.voice.md, the "Asks:" lines and the current-asks list), drops the ones already answered, and matches the rest against
// the ledger by the rare words they share. A match is a proposal; --write adds the ones at or over the bar as links, each
// naming the entry and quoting it, so the record stays checkable. Never touches the ledger, never rewords an ask.
//
//   node tools/asks-link.mjs            print the open asks and the entry each most likely matches, with its score
//   node tools/asks-link.mjs --write    add the links scoring >= BAR (or --bar 0.5) to void.asks.json
//   node tools/asks-link.mjs --check    fail when a built ask is not linked yet (tools/refresh.mjs; the deploy writes them)
//   node tools/asks-link.mjs --open     print only the asks nothing matches (what is still to build), as JSON
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sitesIn } from '../void-live-deploy/lib/voice.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASKS = resolve(root, 'void-live-deploy/void.asks.json'), LEDGER = resolve(root, 'void-live-deploy/void.growth.json'), VOICE = resolve(root, 'domains/void.voice.md');
export const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const STOP = new Set('a an the and or of to in on for with that this so it its my me i can be is are as by from into at not no when every each all any new more than then which what who how via like just also only'.split(' '));
const STEM = (w) => w.replace(/(ings?|ies|ied|ed|es|s|ly|ally|ation|ations|ment|ments)$/, (m) => (m === 'ies' ? 'y' : m === 'ied' ? 'y' : '')).replace(/(?:er|or)$/, '');
/** the meaningful words of a text, stemmed. Pure. */
export const words = (t) => [...new Set(norm(t).split(' ').filter((w) => w.length > 2 && !STOP.has(w)).map(STEM).filter(Boolean))];

/** every ask in the voice log, oldest first, deduplicated by its words: [{ ask, small, id? }]. Pure. */
export function asksOf(md) {
  const out = [], seen = new Set();
  const push = (ask, small, id) => { const k = norm(ask); if (!k || seen.has(k)) return; seen.add(k); out.push({ ask, small: !!small, ...(id ? { id } : {}) }); };
  for (const m of String(md || '').matchAll(/^Asks: (.*)$/gm)) for (const q of m[1].matchAll(/"([^"]{12,})"(\s*\(small\))?/g)) push(q[1], q[2]);
  for (const m of String(md || '').matchAll(/^- (.+?)( \*\(small\)\*)? \((?:daily|after a build), \d{4}-\d\d-\d\d\)(?: `(ask-[0-9-]+)`)?$/gm)) push(m[1], m[2], m[3]);
  return out;
}
/** each ask's newest mention in the voice log: norm(ask) -> { at, kind } (the "### YYYY-MM-DD HH:MM UTC · kind" heading over its Asks: line). Pure. */
export function lastAsked(md) {
  const out = new Map(); let at = '', kind = '';
  for (const line of String(md || '').split('\n')) {
    const h = /^### (\d{4}-\d\d-\d\d) (\d\d:\d\d) UTC(?: · (.*))?$/.exec(line);
    if (h) { at = h[1] + 'T' + h[2] + ':00Z'; kind = /daily/.test(h[3] || '') ? 'daily' : 'build'; continue; }
    if (!/^Asks: /.test(line) || !at) continue;
    for (const q of line.matchAll(/"([^"]{12,})"/g)) { const k = norm(q[1]); const was = out.get(k); if (!was || was.at < at) out.set(k, { at, kind }); }
  }
  return out;
}
/** the asks no ledger entry answers yet. Pure. */
export function openAsks(asks, ledger, links) {
  const done = new Set((ledger || []).filter((e) => e && e.asked).map((e) => norm(e.asked)));
  for (const k of links || []) if (k && (k.words || k.ask) && (ledger || []).some((e) => e && e.at === k.ledgerAt)) done.add(norm(k.words || k.ask));
  return asks.filter((a) => !done.has(norm(a.ask)) && !(a.id && done.has(norm(a.id))));
}
/** the ledger entry an ask most likely names, by shared rare words: { entry, score, shared } or null. Pure. */
export function matchOf(ask, ledger, idf) {
  const aw = words(ask.ask); let best = null;
  for (const e of ledger) {
    if (!e || !e.what) continue;
    if (!sitesIn(ask.ask, e.what + ' ' + (e.show || '') + ' ' + (e.asked || ''))) continue; // an ask naming a site needs a line naming it
    const ew = new Set(e.words || (e.words = words(e.what + ' ' + (e.show || '') + ' ' + (e.asked || ''))));
    const shared = aw.filter((w) => ew.has(w));
    if (shared.length < 2) continue;
    const got = shared.reduce((s, w) => s + (idf.get(w) || 1), 0), all = aw.reduce((s, w) => s + (idf.get(w) || 1), 0);
    const score = all ? got / all : 0;
    if (!best || score > best.score) best = { entry: e, score, shared };
  }
  return best;
}
/** how rare each word is across the ledger (log inverse frequency). Pure. */
export function idfOf(ledger) {
  const n = new Map(); let total = 0;
  for (const e of ledger) { if (!e || !e.what) continue; total++; for (const w of new Set(words(e.what + ' ' + (e.show || '')))) n.set(w, (n.get(w) || 0) + 1); }
  const idf = new Map(); for (const [w, c] of n) idf.set(w, Math.log(1 + total / c)); return idf;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const argv = process.argv.slice(2), BAR = Number((argv.find((a) => a.startsWith('--bar=')) || '').slice(6)) || 0.62;
  const ledger = JSON.parse(readFileSync(LEDGER, 'utf8')), asksJson = JSON.parse(readFileSync(ASKS, 'utf8')), links = asksJson.links || [];
  const asks = asksOf(readFileSync(VOICE, 'utf8')), idf = idfOf(ledger);
  // the curated rules first (tools/asks-link.json): a builder read the ledger and named the entry for each recurring ask
  const curated = JSON.parse(readFileSync(resolve(root, 'tools/asks-link.json'), 'utf8')), byAt = new Map(ledger.filter((e) => e && e.at).map((e) => [e.at, e]));
  let ruled = 0;
  for (const a of openAsks(asks, ledger, links)) {
    // the rule patterns are this repo's own curated file, never user input (void-review: ok)
    const r = (curated.rules || []).find((x) => new RegExp(x.match, x.flags || 'i').test(a.ask)); if (!r || !byAt.has(r.ledgerAt)) continue; // void-review: ok
    ruled++; console.log('RULE      | ' + a.ask.slice(0, 110) + '\n      -> ' + r.ledgerAt + ' ' + r.why.slice(0, 120));
    if (argv.includes('--write')) links.push({ words: a.ask, ledgerAt: r.ledgerAt, why: 'built: ' + r.why + ' (tools/asks-link.json)' });
  }
  for (const x of curated.extra || []) if (byAt.has(x.ledgerAt) && !links.some((k) => norm(k.words || k.ask) === norm(x.words))) { ruled++; if (argv.includes('--write')) links.push({ words: x.words, ledgerAt: x.ledgerAt, why: x.why + ' (tools/asks-link.json)' }); }
  const open = openAsks(asks, ledger, links);
  const rows = open.map((a) => ({ a, m: matchOf(a, ledger, idf) }));
  if (argv.includes('--open')) { console.log(JSON.stringify(rows.filter((r) => !r.m || r.m.score < BAR).map((r) => r.a), null, 1)); process.exit(0); }
  let added = 0;
  for (const { a, m } of rows) {
    const ok = m && m.score >= BAR;
    console.log((ok ? 'LINK ' : m ? 'near ' : 'open ') + (m ? m.score.toFixed(2) : '    ') + ' | ' + a.ask.slice(0, 110) + (m ? '\n      -> ' + m.entry.at + ' ' + m.entry.what.slice(0, 120) + ' [' + m.shared.join(' ') + ']' : ''));
    if (ok && argv.includes('--write')) { links.push({ words: a.ask, ledgerAt: m.entry.at, why: 'built: ' + m.entry.what.slice(0, 220) + ' (linked by tools/asks-link.mjs, shared words: ' + m.shared.join(', ') + ')' }); added++; }
  }
  console.log(ruled + ' linked by the curated rules; ' + open.length + ' open asks after them, ' + rows.filter((r) => r.m && r.m.score >= BAR).length + ' at or over the bar ' + BAR + ', ' + rows.filter((r) => !r.m || r.m.score < BAR).length + ' still to build');
  // all-time totals for the self card (owner, 2026-10-19: it said "24 of 71" one hour and "22 of 66" the next, because it counted only the
  // 60 reflections kept online): every ask in the voice log, reworded ones folded as the card folds them, and how many of those are built
  const { sameAsk } = await import('../void-live-deploy/lib/self-blocks.js');
  const groups = []; for (const a of asks) { const g = groups.find((x) => sameAsk(x[0].ask, a.ask)); if (g) g.push(a); else groups.push([a]); }
  const stillOpen = new Set(openAsks(asks, ledger, links).map((a) => norm(a.ask)));
  // through: the newest reflection in the log; asks made online after it are counted on top by /api/reflect
  const through = [...readFileSync(VOICE, 'utf8').matchAll(/^### (\d{4}-\d\d-\d\d) (\d\d:\d\d) UTC/gm)].map((m) => m[1] + 'T' + m[2] + ':00Z').sort().pop() || '';
  // the asks still open as of `through`, by name (asked by Verse, 2026-10-29: the self card said "3 waiting" beside "237 of 244"): /api/reflect
  // matches an ask asked again online to this list instead of counting it as new, so waiting is always total minus built (lib/voice.js askRecord)
  const seen = lastAsked(readFileSync(VOICE, 'utf8'));
  const openGroups = groups.filter((g) => !g.some((a) => !stillOpen.has(norm(a.ask))));
  const openNow = openGroups.map((g) => { const at = g.map((a) => seen.get(norm(a.ask))).filter(Boolean).sort((x, y) => String(y.at).localeCompare(String(x.at)))[0] || {};
    return { ask: g[0].ask, ...(at.at ? { at: at.at, kind: at.kind } : {}), small: g.some((a) => a.small), times: g.length }; });
  const totals = { asked: groups.length, built: groups.length - openGroups.length, through, open: openNow };
  console.log('all time: ' + totals.built + ' of ' + totals.asked + ' asks built');
  if (argv.includes('--write')) { asksJson.totals = totals; asksJson.links = links; writeFileSync(ASKS, JSON.stringify(asksJson, null, 2) + '\n'); console.log('wrote ' + added + ' links to void.asks.json'); }
  // --check (tools/refresh.mjs): built asks still unlinked keep showing as "not built" on the wants and self cards (owner, 2026-10-19: "the cards should update and be accurate always")
  else if (argv.includes('--check')) { const n = ruled + rows.filter((r) => r.m && r.m.score >= BAR).length; if (n) { console.log(n + ' built asks are not linked yet (run node tools/asks-link.mjs --write)'); process.exit(1); } console.log('every built ask is linked'); }
}
