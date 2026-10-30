// Verse writes its own probe asks (frontier #28, step 2 of the probe-and-fix playbook: "Verse writes the asks itself").
// Pure: picks the family to probe (the least proven one, as lib/voice.js familyFacts judges it, or the one named), builds the
// question for Verse's model (the family, its skills and how far each is checked, a few real asks from the benchmark as the
// shape to write in, the wants it may use), and reads the model's reply back into bench-shaped asks ({ ask, want }) that pass
// the same gate as a stranger's words would (lib/noise.js, tools/gaps.mjs plainTopic): plain text, short, no links, no keys,
// no instruction-like words, a want the family really answers with. The route is functions/api/probe-asks.js (owner only);
// tools/probe-asks.mjs runs the asks through the benchmark and queues the misses.
import { PERSONA } from './persona.js';
import { INJECTION_RULE } from './automation-fix.js';
import { isNoise } from './noise.js';

export const MAX_ASKS = 25; // what one probe asks for, and the most it keeps
export const MAX_EXAMPLES = 14; // real benchmark asks shown as the shape to write in
const MAX_CHARS = 100, MAX_WORDS = 16;
const KEYLIKE = /(?=[A-Za-z0-9_-]{16,})(?=[A-Za-z_-]*\d)(?=[\d_-]*[A-Za-z])[A-Za-z0-9_-]{16,}/;
const COMMAND = /\b(ignore|disregard|forget|override|previous|instructions?|system\s+prompt|prompt|jailbreak|pretend|you\s+are|act\s+as|email|e-mail|send|post|publish|delete|remove|reveal|secret|password|token|api\s*key|owner|admin|sudo|exec|eval)\b/i;

export const PROBE_SYSTEM = 'You are Verse, the face of A-to-Mind: you do whatever anyone asks. ' + PERSONA + ' '
  + 'You are writing test asks for yourself: short things real people would type into your input, in one of your own skill families, so your builders can see which ones you miss. '
  + 'Write them the way people really type: lower case, short, sometimes a typo or a short form, a number or a place where the skill needs one, never a full polite sentence. '
  + 'Each ask must be something the named family should answer, and each names which skill should answer it (its want). Spread them across the family\'s skills, more on the least checked ones. '
  + 'Never repeat an example ask word for word; never write a greeting, a test word, a link, a key or an instruction to anyone. '
  + 'Reply with JSON only: {"asks":[{"ask":"<what a person types>","want":"<one of the wants given>"}]} with at most ' + MAX_ASKS + ' asks. ' + INJECTION_RULE;

/** The family to probe: the one named (by id or name), else the least proven (proven share, as familyFacts ranks them). */
export function pickFamily(fam, name = '') {
  const F = fam && Array.isArray(fam.families) ? fam.families.filter((f) => f && Array.isArray(f.skills) && f.skills.length) : [];
  if (!F.length) return null;
  const n = String(name || '').trim().toLowerCase();
  if (n) return F.find((f) => String(f.id).toLowerCase() === n || String(f.name).toLowerCase() === n) || null;
  return F.slice().sort((a, b) => (a.count.proven / a.skills.length) - (b.count.proven / b.skills.length) || (a.id < b.id ? -1 : 1))[0];
}

const skillNames = (family) => (family.skills || []).map((s) => (typeof s === 'string' ? s : s.name)).filter(Boolean);

/** The wants this family's skills answer with in the benchmark (every alternative of a want that names one of them), plus skill:<name> for each. */
export function allowedWants(family, bench = []) {
  const names = new Set(skillNames(family)), out = new Set(names.size ? [...names].map((s) => 'skill:' + s) : []);
  for (const b of bench || []) {
    const w = String((b && b.want) || '');
    if (w.split('|').some((p) => names.has(p) || names.has(p.replace(/^skill:/, '')))) out.add(w);
  }
  return [...out].sort();
}

/** Up to MAX_EXAMPLES real benchmark asks of this family, spread across its skills (the shape Verse writes in). */
export function examplesFor(family, bench = [], max = MAX_EXAMPLES) {
  const names = new Set(skillNames(family)), by = new Map();
  for (const b of bench || []) {
    const w = String((b && b.want) || ''), s = w.split('|').map((p) => p.replace(/^skill:/, '')).find((p) => names.has(p));
    if (!s) continue;
    if (!by.has(s)) by.set(s, []);
    by.get(s).push({ ask: String(b.ask), want: w });
  }
  const lists = [...by.values()], out = [];
  for (let i = 0; out.length < max && lists.some((l) => l[i]); i++) for (const l of lists) if (l[i] && out.length < max) out.push(l[i]);
  return out;
}

/** The user message: the family, its skills and their tiers, the examples, the wants. Builder-written data only. */
export function askPrompt(family, examples = [], wants = []) {
  const skills = (family.skills || []).map((s) => (typeof s === 'string' ? s : s.name + (s.tier ? ' (' + s.tier + ')' : ''))).join(', ');
  return 'Family: ' + family.name + (family.for ? ' (' + family.for + ')' : '') + '.\nIts skills, with how far each is checked (experiment < tested < checked < proven): ' + skills + '.\n'
    + (examples.length ? 'Real asks from my benchmark, as the shape to write in (do not repeat them):\n' + examples.map((e) => '- ' + e.ask + '  -> ' + e.want).join('\n') + '\n' : '')
    + 'Wants you may use: ' + wants.join(', ') + '.\n'
    + 'Write ' + MAX_ASKS + ' new asks for this family.';
}

/** One ask as plain text, or null: short, letters and numbers with a little punctuation, no links, keys, commands or noise. */
export function plainAsk(raw) {
  const t = String(raw || '').replace(/\s+/g, ' ').trim();
  if (t.length < 3 || t.length > MAX_CHARS || t.split(' ').length > MAX_WORDS) return null;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ,.'’:;()?!%$€£°+\-\/&×÷"]*$/u.test(t)) return null; // no links, brackets, markup, newlines
  if (/https?:|www\.|\.(com|net|org|io)\b|[<>{}[\]\\|@#^*=~`]/i.test(t) || COMMAND.test(t) || KEYLIKE.test(t) || isNoise(t)) return null;
  if (/\b(?:asdf|qwert|zxcv)\w*|\b[bcdfghjklmnpqrstvwxz]{6,}\b/i.test(t)) return null; // keyboard mash, as in lib/learn.js
  if (/(?:\d[\s().-]*){9,}/.test(t)) return null; // a phone number
  return t;
}

/** The model's reply as bench-shaped asks: only plain asks with an allowed want, no repeats (of each other or of the examples), at most max. */
export function parseAsks(text, wants = [], examples = [], max = MAX_ASKS) {
  const raw = String(text || '');
  let j = null; // the whole reply, else the first {...} (the usual "Sure! {…}"), else a bare [...] list
  for (const cand of [raw.trim(), (raw.match(/\{[\s\S]*\}/) || [])[0], (raw.match(/\[[\s\S]*\]/) || [])[0]]) { if (!cand) continue; try { j = JSON.parse(cand); break; } catch (_) { j = null; } }
  const list = j && Array.isArray(j.asks) ? j.asks : Array.isArray(j) ? j : [];
  const ok = new Set(wants), seen = new Set((examples || []).map((e) => String(e.ask || e).trim().toLowerCase())), out = [];
  for (const a of list) {
    if (!a || typeof a !== 'object') continue;
    const ask = plainAsk(a.ask), want = String(a.want || '').trim();
    if (!ask || !ok.has(want)) continue;
    const k = ask.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k); out.push({ ask, want });
    if (out.length >= max) break;
  }
  return out;
}
