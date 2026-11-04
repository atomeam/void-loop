/**
 * Skills built from skills (Atom, 2026-11-03: "it should learn to use its skills it builds to build more skills").
 * The builder searches the skills Verse already has, calls at least one of them (the same runSkill path MCP uses,
 * then that skill's own pure maths when the card itself does not take the ask), and records which ones answered.
 * Pure: no files, no network. tools/skill-compose.mjs reads the catalog and the will, the conductor and the
 * new-skill lane call it. A skill file keeps `export const builtWith = ["calc","convert"]`; tools/skills-index.mjs
 * copies that into skills/lineage.json. Do not hand-edit the generated file.
 */
import { runSkill } from './mcp-run.js';

export const SAY = { calc: 'the calculator', convert: 'the unit converter' };
const NAME = /^[a-z0-9-]+$/;
const STOP = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'for', 'and', 'or', 'between', 'with', 'that', 'this', 'from', 'into', 'per', 'my', 'your', 'you', 'is', 'are', 'it', 'me', 'please', 'what', 'how', 'can', 'its', 'was']);

/** names from `export const builtWith = [...]` in a skill file, in order, duplicates dropped. Pure. */
export function builtWithOf(src) {
  const m = /export const builtWith = (\[[\s\S]*?\]);/.exec(String(src || ''));
  if (!m) return [];
  let arr;
  try { arr = JSON.parse(m[1].replace(/'/g, '"')); } catch (_) { return []; }
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const n of arr) if (typeof n === 'string' && NAME.test(n) && !out.includes(n)) out.push(n);
  return out;
}

/** "Built with the calculator and the unit converter." Titles fall back to the skill id. Pure. */
export function withLine(parts, titles = SAY) {
  const words = (parts || []).map((id) => titles[id] || String(id).replace(/-/g, ' '));
  if (!words.length) return '';
  if (words.length === 1) return 'Built with ' + words[0] + '.';
  return 'Built with ' + words.slice(0, -1).join(', ') + ' and ' + words[words.length - 1] + '.';
}

const tokens = (s) => [...new Set(String(s || '').toLowerCase().match(/[a-z][a-z0-9]*/g) || [])].filter((w) => w.length > 2 && !STOP.has(w));

/**
 * skills whose words overlap the ask, best first. A catalog row is { name, about, examples, tests, tools }.
 * `tools` is 'sum' (a calculator), 'units' (a converter) or 'fetch'. Pure.
 */
export function searchSkills(ask, catalog, { limit = 4 } = {}) {
  const words = tokens(ask), text = String(ask || '');
  const money = /\b(split|share|between|among|each|cost|costs|costing|dollar|dollars|divide|percent)\b/i.test(text);
  const distance = /\b(mile|miles|km|kilometer|kilometre|feet|foot|inch|inches|pound|pounds|kg|celsius|fahrenheit)\b/i.test(text);
  const fetchy = /\b(fetch|url|http|https|look\s+up)\b/i.test(text);
  const scored = [];
  for (const s of catalog || []) {
    if (!s || !NAME.test(String(s.name || ''))) continue;
    const bag = tokens([s.name, s.about, ...(s.examples || []), ...(s.tests || []), ...(s.tools || [])].join(' '));
    let score = 0;
    for (const w of words) {
      if (bag.includes(w)) score += 3;
      else if (bag.some((b) => b.startsWith(w) || w.startsWith(b))) score += 2;
    }
    const tools = s.tools || [];
    if (money && tools.includes('sum')) score += 8;
    if (distance && tools.includes('units')) score += 8;
    if (fetchy && tools.includes('fetch')) score += 8;
    if (score > 0) scored.push({ ...s, score });
  }
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return scored.slice(0, limit);
}

/** asks to copy onto the new skill: the old skill's tests first, then its examples. Pure. */
export function examplesFrom(skill) {
  const keep = (s) => {
    const t = String(s || '').trim();
    return t.length >= 3 && t.length <= 100 && (/[a-z]/i.test(t) || /\d/.test(t)) && !/^(ok|true|false|null|none)$/i.test(t);
  };
  return [...new Set([...(skill && skill.tests || []), ...(skill && skill.examples || [])].filter(keep))].slice(0, 6);
}

/**
 * the ask to hand an existing skill: a sum or a conversion pulled out of the new ask when that skill can do it,
 * otherwise one of its own tests, otherwise its first example. Pure.
 */
export function probeFor(skill, ask) {
  const t = String(ask || '');
  const tools = (skill && skill.tools) || [];
  if (tools.includes('sum')) {
    const money = t.match(/(\d+(?:\.\d+)?)\s*dollars?\b|\$\s*(\d+(?:\.\d+)?)/i);
    const people = t.match(/\b(?:between|among)\s+(\d{1,3})\s+people\b|\b(\d{1,3})\s+ways\b|\b(\d{1,3})\s+people\b/i);
    if (money && people) return (money[1] || money[2]) + ' / ' + (people[1] || people[2] || people[3]);
  }
  if (tools.includes('units')) {
    const d = t.match(/(\d+(?:\.\d+)?)\s*(miles?|mi|kilometers?|kilometres?|kms?|km)\b/i);
    if (d) {
      const miles = /^mi/i.test(d[2]);
      return d[1] + (miles ? ' miles in km' : ' km in miles');
    }
  }
  const reused = examplesFrom(skill);
  return reused[0] || t;
}

/**
 * call one existing skill the way MCP does (runSkill), then its pure maths when the card does not take this ask.
 * mod is the module namespace (named exports plus default). Returns { ok, name, via, text }.
 */
export async function invokeModule(mod, ask, { run = runSkill } = {}) {
  const skill = mod && mod.default && mod.default.match ? mod.default : mod;
  const name = (skill && skill.name) || (mod && mod.default && mod.default.name) || '';
  let via = { ok: false, why: 'no-run', text: '' };
  if (skill && typeof skill.match === 'function' && typeof skill.run === 'function' && typeof run === 'function') {
    via = await run(skill, ask);
    if (via && via.ok && via.text) return { ok: true, name, via: 'skill', text: String(via.text) };
  }
  if (mod && typeof mod.evaluate === 'function') {
    const expr = typeof mod.expressionOf === 'function' ? mod.expressionOf(ask) : null;
    const r = mod.evaluate(expr != null ? expr : ask);
    if (r && r.ok && Number.isFinite(r.value)) {
      const text = typeof mod.formatResult === 'function' ? mod.formatResult(r.value) : String(r.value);
      return { ok: true, name: name || 'calc', via: 'evaluate', text };
    }
  }
  if (mod && typeof mod.pairOf === 'function' && typeof mod.convert === 'function') {
    const m = String(ask || '').match(/([\d.]+)\s*([a-zA-Z]+)\s+(?:in|to|into)\s+([a-zA-Z]+)/);
    if (m) {
      const p = mod.pairOf(m[2], m[3]);
      if (p) {
        const v = mod.convert(p.kind, p.from, p.to, +m[1]);
        if (Number.isFinite(v)) return { ok: true, name: name || 'convert', via: 'convert', text: typeof mod.fmt === 'function' ? mod.fmt(v) : String(v) };
      }
    }
  }
  return { ok: false, name, via: (via && via.why) || 'none', text: (via && via.text) || '' };
}

/**
 * search, then call invoke once per hit. `parts` are the skills that answered. invoke is required to run:
 * a build with hits and no call is not a composition. Pure apart from invoke.
 */
export async function compose(ask, { catalog = [], invoke, limit = 3 } = {}) {
  const found = searchSkills(ask, catalog, { limit });
  const calls = [];
  for (const s of found) {
    const r = await invoke(s, ask);
    calls.push({ name: s.name, score: s.score, ...(r || {}) });
  }
  const parts = [];
  for (const c of calls) if (c.ok && c.name && !parts.includes(c.name)) parts.push(c.name);
  const examples = [];
  for (const s of found) for (const e of examplesFrom(s)) if (!examples.includes(e)) examples.push(e);
  return { ask: String(ask || ''), found: found.map((s) => s.name), parts, calls, examples: examples.slice(0, 8) };
}

/** insert `export const builtWith` just before `export default`, leaving WHEN, ANSWER, examples and Source where they are. Pure. */
export function stampBuiltWith(src, parts) {
  const names = (parts || []).filter((n) => NAME.test(String(n)));
  if (!names.length) return String(src || '');
  const line = 'export const builtWith = ' + JSON.stringify(names) + ';\n';
  const text = String(src || '');
  if (/export const builtWith = \[[\s\S]*?\];\n/.test(text)) return text.replace(/export const builtWith = \[[\s\S]*?\];\n/, line);
  const at = text.indexOf('export default {');
  if (at < 0) return text;
  return text.slice(0, at) + line + text.slice(at);
}
