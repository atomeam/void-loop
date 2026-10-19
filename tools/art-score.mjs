// The card art, measured (owner, 2026-10-19: "we should have a step added to improve the card art each time"; chosen: a measured quality ratchet).
// lib/card-art.js draws every card's art as a pure, deterministic SVG, so its quality can be scored without a browser: a fixed corpus of cards
// (every kind x six keys x three rarities) is drawn and six properties are measured. The floor in tools/art-floor.json can only rise: a change that
// lowers the score fails `node tools/checks.mjs`, a change that raises it raises the floor (`--write`), like tools/bench-floor.mjs does for the benchmark.
//
//   contrast   the lightest and darkest colour a card uses, as a WCAG contrast ratio; 7:1 or more is full marks
//   hues       how many of the twelve 30-degree hue bands the corpus uses (a deck that is all one colour is a weaker deck)
//   unique     no two cards of the corpus draw the same picture
//   weight     bytes per card: full marks at 12 KB or less, none at 60 KB or more (a stage can hold dozens of cards on a phone)
//   motif      every subject word the art knows (moon, key, sword ...) really changes the picture, instead of the generic plate
//   ladder     a higher rarity draws more than a lower one (mythic > rare > common), for every kind and key
//
//   node tools/art-score.mjs              print the scores and the weakest kinds
//   node tools/art-score.mjs --check      exit 1 when the composite drops below the floor, or any property by more than 5 points
//   node tools/art-score.mjs --write      raise the floor to the current score (never lowers it)      --json   machine-readable
// The words of a card are a builder's; this keeps the picture from getting worse and says which kind is weakest at which property.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { artSvg, KINDS } from '../void-live-deploy/lib/card-art.js';
import { MOTIF_HUE, motifsFor } from '../void-live-deploy/lib/card-subject.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FLOOR_FILE = resolve(root, 'tools/art-floor.json');
export const KEYS = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta'], RARITIES = ['common', 'rare', 'mythic'];
export const METRICS = ['contrast', 'hues', 'unique', 'weight', 'motif', 'ladder'];
export const SLACK = 5; // points a single property may drop while the composite still holds (a trade between two properties is allowed, a collapse is not)

const clamp = (n, a = 0, b = 100) => Math.max(a, Math.min(b, n));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** a CSS hsl() to relative luminance (WCAG). Pure. */
export function luminance(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
}
const hexLum = (hex) => {
  let h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16); if (!Number.isFinite(n)) return null;
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};

/** every colour a picture uses: { hues: [..], lums: [..] } from its hsl() and #hex values. Pure. */
export function coloursOf(svg) {
  const hues = [], lums = [];
  for (const m of String(svg).matchAll(/hsl\(\s*(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/g)) { hues.push(((+m[1] % 360) + 360) % 360); lums.push(luminance(+m[1], +m[2], +m[3])); }
  for (const m of String(svg).matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) { const l = hexLum(m[0]); if (l != null) lums.push(l); }
  return { hues, lums };
}
/** the contrast ratio between the lightest and the darkest colour of a picture (1 when it has fewer than two). Pure. */
export function contrastOf(svg) { const { lums } = coloursOf(svg); if (lums.length < 2) return 1; return (Math.max(...lums) + 0.05) / (Math.min(...lums) + 0.05); }

/** the fixed corpus: [{ kind, key, rarity, svg }]. */
export function corpus(draw = artSvg, kinds = KINDS) {
  const out = [];
  for (const kind of kinds) for (const key of KEYS) for (const rarity of RARITIES) out.push({ kind, key, rarity, svg: draw({ key: key + ' ' + kind, name: key, kind, rarity }) });
  return out;
}

/** the six properties of a corpus, each 0..100, the composite (their mean, rounded) and the per-kind contrast. Pure given the corpus. */
export function score(cards, { draw = artSvg, motifNames = Object.keys(MOTIF_HUE) } = {}) {
  const contrast = mean(cards.map((c) => clamp(((contrastOf(c.svg) - 1) / 6) * 100)));
  const bands = new Set(); for (const c of cards) for (const h of coloursOf(c.svg).hues) bands.add(Math.floor(h / 30) % 12);
  const hues = (bands.size / 12) * 100;
  const unique = (new Set(cards.map((c) => c.svg)).size / Math.max(1, cards.length)) * 100;
  const weight = mean(cards.map((c) => clamp(100 - ((Buffer.byteLength(c.svg) - 12000) / 48000) * 100)));
  const words = motifNames.filter((m) => motifsFor([m]).length);
  const base = draw({ key: 'moon', name: 'moon', kind: 'Idea', rarity: 'rare' });
  const motif = motifNames.length ? (words.filter((m) => draw({ key: 'moon', name: 'moon', kind: 'Idea', rarity: 'rare', nouns: [m] }) !== base).length / motifNames.length) * 100 : 100;
  let ok = 0, n = 0;
  for (const kind of new Set(cards.map((c) => c.kind))) for (const key of KEYS) {
    const by = Object.fromEntries(cards.filter((c) => c.kind === kind && c.key === key).map((c) => [c.rarity, c.svg.length]));
    if (by.common == null || by.rare == null || by.mythic == null) continue;
    n++; if (by.mythic > by.rare && by.rare > by.common) ok++;
  }
  const ladder = n ? (ok / n) * 100 : 100;
  const metrics = Object.fromEntries(Object.entries({ contrast, hues, unique, weight, motif, ladder }).map(([k, v]) => [k, Math.round(v * 10) / 10]));
  const perKind = {}; for (const kind of new Set(cards.map((c) => c.kind))) perKind[kind] = Math.round(mean(cards.filter((c) => c.kind === kind).map((c) => clamp(((contrastOf(c.svg) - 1) / 6) * 100))) * 10) / 10;
  return { composite: Math.round(mean(Object.values(metrics))), metrics, perKind };
}

/** what the floor allows: the composite may not drop, and no property may drop by more than SLACK. Returns the list of problems. Pure. */
export function regressions(now, floor) {
  if (!floor) return [];
  const out = [];
  if (now.composite < floor.composite) out.push('composite ' + now.composite + ' is below the floor ' + floor.composite);
  for (const m of METRICS) if (floor.metrics && floor.metrics[m] != null && now.metrics[m] < floor.metrics[m] - SLACK) out.push(m + ' ' + now.metrics[m] + ' dropped more than ' + SLACK + ' below its floor ' + floor.metrics[m]);
  return out;
}
/** the floor after a run: each number the higher of the old floor and now, so it never falls. Pure. */
export function raised(now, floor) {
  const f = floor || { composite: 0, metrics: {} };
  return { composite: Math.max(f.composite || 0, now.composite), metrics: Object.fromEntries(METRICS.map((m) => [m, Math.max((f.metrics || {})[m] || 0, now.metrics[m])])) };
}
/** the floor file after a source-score update: the new composite and properties, and every other key (the pixel floor of tools/art-pixels.mjs) kept as it was. Pure. */
export const mergeFloor = (old, next) => ({ ...(old || {}), composite: next.composite, metrics: next.metrics });
/** just the part of a floor this tool owns, for comparing. Pure. */
export const ownPart = (f) => (f ? { composite: f.composite, metrics: f.metrics } : null);

/** the weakest few (property, kind) findings to show a builder: the kinds with the lowest contrast and the lowest property overall. Pure. */
export function weakest(now, n = 3) {
  const worst = Object.entries(now.metrics).sort((a, b) => a[1] - b[1])[0];
  const kinds = Object.entries(now.perKind).sort((a, b) => a[1] - b[1]).slice(0, n).map(([k, v]) => 'contrast of ' + k + ' cards is ' + v);
  return [worst[0] + ' is the weakest property (' + worst[1] + ')'].concat(kinds);
}

const readFloor = () => { try { return JSON.parse(readFileSync(FLOOR_FILE, 'utf8')); } catch (_) { return null; } };

function main(argv) {
  const now = score(corpus()), floor = readFloor();
  if (argv.includes('--json')) { console.log(JSON.stringify({ now, floor, weakest: weakest(now) }, null, 1)); return 0; }
  if (argv.includes('--write')) {
    const next = raised(now, floor), same = floor && JSON.stringify(ownPart(floor)) === JSON.stringify(next);
    if (!same) writeFileSync(FLOOR_FILE, JSON.stringify(mergeFloor(floor, next), null, 1) + '\n');
    console.log(same ? 'art floor unchanged: ' + next.composite : 'art floor raised to ' + next.composite + (floor ? ' (was ' + floor.composite + ')' : '')); return 0;
  }
  console.log('card art score ' + now.composite + (floor ? ' (floor ' + floor.composite + ')' : ' (no floor yet: run --write)') + '  ' + METRICS.map((m) => m + ' ' + now.metrics[m]).join('  '));
  for (const w of weakest(now)) console.log('  weakest: ' + w);
  if (argv.includes('--check')) {
    if (!floor) { console.error('art-floor.json is missing: run node tools/art-score.mjs --write'); return 1; }
    const bad = regressions(now, floor);
    if (bad.length) { console.error('the card art got worse: ' + bad.join('; ')); return 1; }
    const next = raised(now, floor); if (JSON.stringify(next) !== JSON.stringify(ownPart(floor))) console.log('the art improved: node tools/art-score.mjs --write raises the floor to ' + next.composite);
  }
  return 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
