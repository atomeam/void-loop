// V01D proposes the fix (frontier #28, step 3 of the probe-and-fix playbook): for an ask it missed in its own probe, V01D's
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
const KEYLIKE = /(?=[A-Za-z0-9_-]{16,})(?=[A-Za-z_-]*\d)(?=[\d_-]*[A-Za-z])[A-Za-z0-9_-]{16,}/;
// what a matcher change never needs: anything that runs, loads, stores, or reaches out
const FORBIDDEN = /\b(fetch|import|require|eval|Function|setTimeout|setInterval|XMLHttpRequest|WebSocket|navigator|location|document|window|globalThis|process|localStorage|sessionStorage|indexedDB|cookie|innerHTML|outerHTML|insertAdjacentHTML|postMessage|atob|btoa|crypto)\b|https?:|www\.|\$\{|`|<\/?script/i;

export const FIX_SYSTEM = 'You are V01D, said "void", the face of A-to-Mind. ' + PERSONA + ' '
  + 'You are fixing one of your own skills: a short ask that this skill should answer did not reach it, because its matcher (the match() function and the patterns it uses) does not recognise that wording. '
  + 'Propose the narrowest change that makes the matcher accept the ask and asks like it, without accepting asks that belong to other skills, and add the ask to the examples list. '
  + 'Change only the matcher and the examples: never run(), never anything that fetches, imports, stores or draws. Keep every pattern anchored and specific; prefer adding one alternative to loosening an existing one. '
  + 'Reply with JSON only: {"why":"<one or two sentences: what did not match and what you changed>","edits":[{"find":"<one existing line, copied exactly, whole>","replace":"<that line as it should read; several lines joined with \\n are allowed>"}]} with at most ' + MAX_EDITS + ' edits. '
  + 'An edit whose find is not an exact existing line is thrown away, so copy lines whole. ' + INJECTION_RULE;

/** The ask and the skill a probe or miss job is about: 'learn to handle "<ask>"' and a note that says (wanted skill:<name>). */
export function jobAsk(job) {
  if (!job) return null;
  const m = /^learn to handle "(.+)"$/.exec(String(job.ask || '').trim());
  if (!m) return null;
  const w = /\(wanted ([^)]+)\)/.exec(String(job.note || ''));
  const skill = w ? skillOf(w[1]) : null;
  return skill ? { ask: m[1], skill, want: w[1] } : null;
}

/** The skill file a want names: the first alternative that is a skill (skill:<name>), else a bare word that is one. */
export function skillOf(want) {
  for (const p of String(want || '').split('|').map((s) => s.trim())) {
    const n = p.startsWith('skill:') ? p.slice(6) : /^[a-z][a-z0-9-]*$/.test(p) && !/^(answer|said|chance|list|timer|review)$/.test(p) ? p : '';
    if (/^[a-z][a-z0-9-]{1,40}$/.test(n)) return n;
  }
  return null;
}

/** The question: the ask, the skill and its file (clipped to MAX_SOURCE), with the contract reminder. */
export function fixPrompt(ask, skill, source) {
  const src = String(source || ''), shown = src.length > MAX_SOURCE ? src.slice(0, MAX_SOURCE) + '\n// … (clipped)' : src;
  return 'Skill: ' + skill + ' (void-live-deploy/skills/' + skill + '.js).\nThe ask that did not reach it: "' + ask + '"\n'
    + 'Its contract: { name, examples, nearMisses, match(lower, text), run(text, api) }; match() decides whether the skill answers.\n\n' + shown;
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
  return { edits: out, why };
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
