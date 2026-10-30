// Verse proposes the fix (frontier #28, step 3 of the probe-and-fix playbook): for an ask it missed in its own probe, Verse's
// model reads the owning skill's matcher and proposes the narrowest change, as a few exact line replacements, never a rewrite.
// Pure: the job's ask and skill (lib/learn.js jobs, tools/probe-asks.mjs jobs), the question for the model, and the reply read
// back into edits that pass the gate: each `find` is one exact line that occurs once in the file, each replacement is short and
// carries no fetch, import, eval, HTML sink, storage, URL, key or instruction. The tests and the benchmark then decide
// (tools/propose-fix.mjs); nothing here writes a file. The route is functions/api/propose-fix.js (owner only).
import { PERSONA } from './persona.js';
import { INJECTION_RULE } from './automation-fix.js';

export const MAX_EDITS = 4; // line replacements in one proposal
export const MAX_REPLACE = 700; // characters in one replacement
export const MAX_SOURCE = 30000; // characters of the skill file the model is shown
export const MAX_TRIED = 700; // characters of feedback on the last try that the model is shown
const KEYLIKE = /(?=[A-Za-z0-9_-]{16,})(?=[A-Za-z_-]*\d)(?=[\d_-]*[A-Za-z])[A-Za-z0-9_-]{16,}/;
// what a matcher change never needs: anything that runs, loads, stores, or reaches out
const FORBIDDEN = /\b(fetch|import|require|eval|Function|setTimeout|setInterval|XMLHttpRequest|WebSocket|navigator|location|document|window|globalThis|process|localStorage|sessionStorage|indexedDB|cookie|innerHTML|outerHTML|insertAdjacentHTML|postMessage|atob|btoa|crypto)\b|https?:|www\.|\$\{|`|<\/?script/i;

export const FIX_SYSTEM = 'You are Verse, said "void", the face of A-to-Mind. ' + PERSONA + ' '
  + 'You are fixing one of your own skills: a short ask that this skill should answer did not reach it, because its matcher (the match() function and the patterns it uses) does not recognise that wording. '
  + 'Propose the narrowest change that makes the matcher accept the ask and asks like it, without accepting asks that belong to other skills, and add the ask to the examples list. '
  + 'An example only counts when match() takes it: adding the ask to the examples without changing the pattern match() uses always fails the collision check. '
  + 'Change only the matcher and the examples: never run(), never anything that fetches, imports, stores or draws. Keep every pattern anchored and specific; prefer adding one alternative to loosening an existing one. '
  + 'Reply with JSON only: {"why":"<one or two sentences: what did not match and what you changed>","confidence":<0.0-1.0: how sure you are this change makes the ask reach the skill without stealing another skill\'s asks>","edits":[{"find":"<one existing line, copied exactly, whole>","replace":"<that line as it should read; several lines joined with \\n are allowed>"}]} with at most ' + MAX_EDITS + ' edits. '
  + 'An edit whose find is not an exact existing line is thrown away, so copy lines whole. ' + INJECTION_RULE;

// The other way round (owner, 2026-10-16: a card reply said "I am quoting a conversation about your memory, not fixing a webhook"):
// an ask a skill took that belongs elsewhere. Verse proposes the narrowest change that makes this skill let go of it.
export const NARROW_SYSTEM = 'You are Verse, said "void", the face of A-to-Mind. ' + PERSONA + ' '
  + 'You are fixing one of your own skills: it answered a short ask that is not its job (your owner told you so), because its matcher (the match() function and the patterns it uses) is too loose for that wording. '
  + 'Propose the narrowest change that makes the matcher reject the ask and asks like it, while still accepting every example the skill lists, and add the ask to the nearMisses list. '
  + 'Change only the matcher and the nearMisses: never run(), never anything that fetches, imports, stores or draws. Prefer tightening one pattern or adding one exclusion to rewriting a pattern. '
  + 'Reply with JSON only: {"why":"<one or two sentences: what matched wrongly and what you changed>","confidence":<0.0-1.0: how sure you are this change lets the ask go without losing any ask the skill should keep>","edits":[{"find":"<one existing line, copied exactly, whole>","replace":"<that line as it should read; several lines joined with \\n are allowed>"}]} with at most ' + MAX_EDITS + ' edits. '
  + 'An edit whose find is not an exact existing line is thrown away, so copy lines whole. ' + INJECTION_RULE;

/** The ask and the skill a job is about. A probe or miss job: 'learn to handle "<ask>"' with a note that says (wanted skill:<name>),
 * mode 'learn'. A routing job from a correction: 'stop answering "<ask>"' with a note that says (wrong skill:<name>) and
 * (wanted <route>), mode 'narrow': the skill to change is the one that wrongly answered. */
export function jobAsk(job) {
  if (!job) return null;
  const n = /^stop answering "(.+)"$/.exec(String(job.ask || '').trim());
  if (n) {
    const wrong = /\(wrong skill:([a-z][a-z0-9-]{1,40})\)/.exec(String(job.note || '')), w = /\(wanted ([^)]+)\)/.exec(String(job.note || ''));
    return wrong ? { ask: n[1], skill: wrong[1], want: w ? w[1] : 'answer', mode: 'narrow' } : null;
  }
  const m = /^learn to handle "(.+)"$/.exec(String(job.ask || '').trim());
  if (!m) return null;
  const w = /\(wanted ([^)]+)\)/.exec(String(job.note || ''));
  const skill = w ? skillOf(w[1]) : null;
  if (skill) return { ask: m[1], skill, want: w[1], mode: 'learn' };
  // a missed ask (lib/learn.js, target miss:<slug>) that the router says a skill should have caught: "router skill:rides 0.78" in its note
  // is a propose-fix job too (asked by Verse: the missed asks are a structured queue that creates the propose-fix job by itself)
  const r = /\brouter skill:([a-z][a-z0-9_-]{1,24})\b/.exec(String(job.note || ''));
  return r && /^miss:/.test(String(job.target || '')) ? { ask: m[1], skill: r[1], want: 'skill:' + r[1], mode: 'learn' } : null;
}

/** The skill file a want names: the first alternative that is a skill (skill:<name>), else a bare word that is one. */
export function skillOf(want) {
  for (const p of String(want || '').split('|').map((s) => s.trim())) {
    const n = p.startsWith('skill:') ? p.slice(6) : /^[a-z][a-z0-9-]*$/.test(p) && !/^(answer|said|chance|list|timer|review)$/.test(p) ? p : '';
    if (/^[a-z][a-z0-9-]{1,40}$/.test(n)) return n;
  }
  return null;
}

/** The question: the ask, the skill and its file (clipped to MAX_SOURCE), with the contract reminder. In 'narrow' mode the ask is
 * one the skill took wrongly, with the owner's words on why when there are any. tried: what the collision check said about the last
 * proposal (settleNote), so a second try fixes what the first broke instead of guessing again. */
export function fixPrompt(ask, skill, source, mode = 'learn', said = '', tried = '') {
  const src = String(source || ''), clip = src.length > MAX_SOURCE ? src.slice(0, MAX_SOURCE) + '\n// … (clipped)' : src;
  const shown = (tried ? 'Your last try did not pass. ' + String(tried).replace(/\s+/g, ' ').slice(0, MAX_TRIED) + '\n\n' : '') + clip;
  if (mode === 'narrow') return 'Skill: ' + skill + ' (void-live-deploy/skills/' + skill + '.js).\nThe ask it answered but should not have: "' + ask + '"\n'
    + (said ? 'What your owner said about it: "' + String(said).replace(/\s+/g, ' ').slice(0, 300) + '"\n' : '')
    + 'Its contract: { name, examples, nearMisses, match(lower, text), run(text, api) }; match() decides whether the skill answers.\n\n' + shown;
  return 'Skill: ' + skill + ' (void-live-deploy/skills/' + skill + '.js).\nThe ask that did not reach it: "' + ask + '"\n'
    + 'Its contract: { name, examples, nearMisses, match(lower, text), run(text, api) }; match() decides whether the skill answers.\n\n' + shown;
}

/** what to tell the model after a try that did not settle (2026-10-30: 95 of 136 probe fixes died at "collisions", most of them an
 * example added while match() still rejected the ask, the rest a pattern loosened into another skill's asks). t: { applied, loadError,
 * takes, by, lines }: whether the edits applied, the error when the edited file did not load, whether its match() takes the ask, the
 * skill that reaches the ask first in the routing order, and the collision check's own lines. One short paragraph. Pure. */
export function settleNote(skill, ask, t = {}) {
  let out;
  if (t.applied === false) out = 'Your edits did not apply: each find must be one existing line, copied whole.';
  else if (t.loadError) out = 'The edited file did not load (' + String(t.loadError).replace(/\s+/g, ' ').slice(0, 160) + '). Keep every pattern a valid JavaScript regular expression.';
  else if (!t.takes) out = 'match() still does not take "' + ask + '": change the pattern match() uses (not only the examples) so it does.';
  else if (t.by && t.by !== skill) out = 'match() takes "' + ask + '" now, but the ' + t.by + ' skill comes earlier in the routing order and takes it first; that cannot be changed from this file.';
  else {
    const lines = (t.lines || []).filter((l) => !String(l).includes(ask)).slice(0, 6);
    out = lines.length ? 'Your change also broke these, from the collision check (skill: "example" -> the skill it reaches now): ' + lines.join(' | ') + '. Make the pattern narrower: words only this skill uses, anchored, so other skills keep their asks.'
      : 'The collision check failed; make the pattern narrower, so other skills keep their asks.';
  }
  return out.slice(0, MAX_TRIED);
}

/** One replacement that a matcher change could need: short, plain, nothing that runs or reaches out. */
export function safeReplacement(text) {
  const t = String(text || '');
  if (!t.trim() || t.length > MAX_REPLACE) return false;
  if (FORBIDDEN.test(t) || KEYLIKE.test(t)) return false;
  return true;
}

/** The model's reply as edits that pass the gate against the source they will be applied to; [] when nothing does. */
export function parseEdits(text, source) {
  const raw = String(text || ''), src = String(source || '');
  let j = null;
  for (const cand of [raw.trim(), (raw.match(/\{[\s\S]*\}/) || [])[0]]) { if (!cand) continue; try { j = JSON.parse(cand); break; } catch (_) { j = null; } }
  const list = j && Array.isArray(j.edits) ? j.edits : [];
  const out = [], seen = new Set();
  for (const e of list) {
    if (!e || typeof e !== 'object') continue;
    const find = String(e.find || '').replace(/\r/g, ''), replace = String(e.replace || '').replace(/\r/g, '');
    if (!find.trim() || find.includes('\n') || find === replace || seen.has(find)) continue;
    if (occurrences(src, find) !== 1 || !safeReplacement(replace)) continue;
    seen.add(find); out.push({ find, replace });
    if (out.length >= MAX_EDITS) break;
  }
  const why = String((j && j.why) || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  return { edits: out, why, confidence: confidenceOf(j && j.confidence) };
}

/** the model's own confidence in its proposal (asked by Verse), 0 to 1 with two decimals, or null when it gave none. Pure. */
export const confidenceOf = (v) => { const n = typeof v === 'string' ? parseFloat(v) : v; return typeof n === 'number' && Number.isFinite(n) ? Math.round(Math.min(1, Math.max(0, n)) * 100) / 100 : null; };

/** the evidence for a proposal (asked by Verse: "a specific file/line reference that justifies why ... translates to that specific code
 * change"): for each edit, the file and the line number it changes, and that line as it stood. Pure. */
export function evidenceOf(source, edits, skill) {
  const lines = String(source || '').split('\n'), file = 'void-live-deploy/skills/' + skill + '.js';
  return (edits || []).map((e) => { const i = lines.findIndex((l) => l.includes(e.find)); return i < 0 ? null : { file, line: i + 1, was: lines[i].trim().slice(0, 160) }; }).filter(Boolean);
}
/** the evidence in a few words: "void-live-deploy/skills/rides.js lines 42, 57". Pure. */
export const whereOf = (ev) => (ev && ev.length ? ev[0].file + (ev.length > 1 ? ' lines ' : ' line ') + ev.map((e) => e.line).join(', ') : '');

/** how much a proposal changes (asked by Verse: "Implement a 'risk-level' metadata field in the automation fix proposal schema to warn users of
 * high-impact structural changes"): { level: 'low'|'medium'|'high', why }. Worked out here from the edits and the source, never from what the
 * model says about itself. low: only the examples or nearMisses lists, or one short addition to a pattern. medium: several pattern edits, a long
 * one, or one that removes more than it keeps. high: an edit on a structural line (an export, import, function, run(), stageKinds, the skill's
 * name, or a bare closing bracket), which is more than a matcher change and wants the owner's eyes. Pure. */
export const RISK_LEVELS = ['low', 'medium', 'high'];
const STRUCTURAL = /^\s*(?:export\b|import\b|async\s+function\b|function\b|class\b|run\s*[(:]|async\s+run\b|stageKinds\b|name\s*:|[\]})]+[,;)]*\s*$)/;
const LISTY = /\b(?:examples|nearMisses)\s*:/;
export function riskOf(edits) {
  const list = Array.isArray(edits) ? edits : [];
  if (!list.length) return { level: 'low', why: 'no line changes' };
  const hit = list.find((e) => STRUCTURAL.test(String(e.find || '')));
  if (hit) return { level: 'high', why: 'it changes a structural line (' + String(hit.find).trim().slice(0, 40) + '), not only the matcher' };
  const pat = list.filter((e) => !LISTY.test(String(e.find || '')));
  if (!pat.length) return { level: 'low', why: 'only the examples or nearMisses lists change' };
  const long = pat.some((e) => String(e.replace || '').length > 240), shrinks = pat.some((e) => String(e.replace || '').length < String(e.find || '').length * 0.6);
  if (pat.length > 1 || long || shrinks) return { level: 'medium', why: pat.length > 1 ? pat.length + ' pattern lines change' : long ? 'a long pattern replacement' : 'a pattern line loses more than it keeps' };
  return { level: 'low', why: 'one short change to one pattern line' };
}

const occurrences = (s, sub) => { let n = 0, i = 0; while ((i = s.indexOf(sub, i)) >= 0) { n++; i += sub.length; if (n > 1) break; } return n; };

/** The source with the edits applied, each find still occurring exactly once at apply time; null when one does not. */
export function applyEdits(source, edits) {
  let s = String(source || '');
  for (const e of edits || []) {
    if (occurrences(s, e.find) !== 1) return null;
    s = s.replace(e.find, () => e.replace);
  }
  return s === String(source || '') ? null : s;
}
