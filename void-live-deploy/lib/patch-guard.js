// The patch guard: model-written code is checked before Verse saves it, queues it or shows it as a fix. A model that runs out
// of room writes "rest of the code unchanged" or "...existing code..." where the code should be; one that loses its place
// drops half a file or a function; one that guesses writes code that does not parse; a find-and-replace patch whose anchor
// matches twice (or never) lands in the wrong place. Each of those is rejected here, with the reason in plain words, and the
// caller does not use the draft. Learned from the owner's homebase mini (validatePatched / applyPatches), without its habit
// of holding model keys in the browser: this file holds no key and calls nothing. Pure, so it runs the same in Node and in
// Workers (where `new Function` is refused: the JavaScript check then falls back to a bracket-and-string scan, and says so).
//   guardPatch({ before, after, kind: 'js'|'html'|'json'|'text', patch? }) -> { ok, reasons: [...], after, syntax }
//   guardAnswer(text, { before }) -> the same, for every fenced code block in a model's answer (and its prose)
// Tests: tools/patch-guard.test.mjs.

export const SHRINK = 0.7; // the result may not fall below 70% of the original: shrinking by more than 30% is a lost half
const SHRINK_MIN = 200;    // originals shorter than this are too small to judge by length

// Stub text: where a model wrote about code instead of writing it. Only a marker the new text has more often than the
// original counts, so code that already says "truncated" (a variable, a log line) is not a stub.
// `prose: true` marks the ones that are a stub in plain text too; the rest count only inside code ("the rest of your config is
// fine" is a fair sentence in an answer, and a stub in a corrected config).
const STUBS = [
  { re: /\bfor (the sake of )?brevity\b/gi, prose: true, why: 'it says "for brevity", so something was left out' },
  { re: /\.\.\.\s*(?:existing|previous|original|other|remaining|unchanged|same)(?: [a-z]+){0,2}\s*\.\.\./gi, prose: true, why: 'it has a "...existing code..." placeholder' },
  { re: /[[(<{][ \t]*(?:\.\.\.[ \t]*)?(?:code |output |content |file |answer |rest )?truncated\b|\btruncated (?:for|here)\b/gi, prose: true, why: 'it says part of it was truncated' },
  { re: /\b(?:code|output|response|answer|file|content|rest|remainder)(?: is| was| has been)? truncated\b/gi, why: 'it says part of it was truncated' },
  { re: /\b(?:rest|remainder) of (?:the |your )?(?:code|file|function|implementation|script|component|class|config)\b/gi, why: 'it says "rest of the code" instead of writing it' },
  { re: /(?:\/\/|\/\*|#|<!--)[ \t]*\.\.\.[ \t]*(?:\*\/|-->)?[ \t]*$|(?:\/\/|\/\*|#|<!--)[ \t]*\.\.\.?[ \t]*(?:existing|rest|more|other|same|unchanged|remaining)\b/gim, why: 'it has a "// ..." line where code was left out' },
  { re: /\b(?:code|implementation|logic|function body|rest) (?:remains|stays) (?:the same|unchanged)\b|\b(?:unchanged|same as before)[ \t]*(?:code|below|above)?[ \t]*(?:\*\/|-->|\))/gi, why: 'it says "unchanged" where the code should be' },
];

const count = (re, s) => (String(s || '').match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []).length; // void-review: ok (re is one of this module's own constant patterns, never user text)

/** the plain-words reasons the new text carries stub markers the original did not; `prose` checks only the plain-text ones */
export function stubReasons(after, before = '', { prose = false } = {}) {
  const out = [];
  for (const { re, why, prose: p } of STUBS) if ((p || !prose) && count(re, after) > count(re, before) && !out.includes(why)) out.push(why);
  return out;
}

/** the code inside every <script> without a src, in order (a JSON or template script type is not JavaScript) */
export function scriptsOf(html) {
  const out = [], re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const attrs = m[1] || '', type = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue;
    if (type && !/^(?:text\/javascript|application\/javascript|module)$/i.test(type)) continue;
    out.push({ code: m[2], module: /^module$/i.test(type) });
  }
  return out;
}

// ES module syntax that a Function body cannot hold: imports dropped, exports unwrapped (the rest of the line is still checked)
function unmodule(code) {
  return String(code)
    .replace(/^[ \t]*import\s+(?:[\w*{}\s,$]+\s+from\s+)?(['"])[^'"\n]*\1[ \t]*;?/gm, '')
    .replace(/^[ \t]*import\s*\(/gm, '(')
    .replace(/^[ \t]*export\s+\{[^}]*\}(?:\s*from\s*(['"])[^'"\n]*\1)?[ \t]*;?/gm, '')
    .replace(/^[ \t]*export\s+\*\s+(?:as\s+\w+\s+)?from\s*(['"])[^'"\n]*\1[ \t]*;?/gm, '')
    .replace(/^([ \t]*)export\s+default\s+(?=(?:async\s+)?function\b|class\b)/gm, '$1')
    .replace(/^([ \t]*)export\s+default\s+/gm, '$1void ')
    .replace(/^([ \t]*)export\s+(?=(?:async\s+)?function\b|class\b|const\b|let\b|var\b)/gm, '$1')
    .replace(/\bimport\.meta\b/g, '({})');
}

let codegen = null; // can this runtime compile a string? Workers cannot; Node can
function canCompile() {
  if (codegen === null) { try { new Function('return 1'); codegen = true; } catch (_) { codegen = false; } } // void-review: ok (a constant string: it only asks whether this runtime can compile)
  return codegen;
}

// Without `new Function`: brackets must balance and close in order, strings, templates and comments must end. A slash after
// a value is division; anywhere else it opens a regular expression (the usual rule, good enough for a guard).
function scan(code) {
  const s = String(code), stack = [], pairs = { ')': '(', ']': '[', '}': '{' };
  let i = 0, line = 1, last = '';
  const fail = (what) => 'line ' + line + ': ' + what;
  while (i < s.length) {
    const c = s[i];
    if (c === '\n') { line++; i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); if (e < 0) return fail('a /* comment never ends'); line += (s.slice(i, e).match(/\n/g) || []).length; i = e + 2; continue; }
    if (c === '"' || c === "'") {
      i++;
      while (i < s.length && s[i] !== c) { if (s[i] === '\\') i++; else if (s[i] === '\n') return fail('a string never ends'); i++; }
      if (i >= s.length) return fail('a string never ends');
      i++; last = 'v'; continue;
    }
    if (c === '`') { stack.push('`'); i++; i = template(); if (i < 0) return fail('a template string never ends'); last = 'v'; continue; }
    if (c === '/') {
      if (last === 'v') { i++; last = 'o'; continue; }
      i++; let cls = false;
      while (i < s.length && (cls || s[i] !== '/')) { if (s[i] === '\n') return fail('a regular expression never ends'); if (s[i] === '\\') i++; else if (s[i] === '[') cls = true; else if (s[i] === ']') cls = false; i++; }
      i++; while (/[a-z]/i.test(s[i] || '')) i++;
      last = 'v'; continue;
    }
    if ('([{'.includes(c)) { stack.push(c); i++; last = 'o'; continue; }
    if (')]}'.includes(c)) {
      const top = stack.pop();
      if (top === '${') { stack.push('`'); i++; i = template(); if (i < 0) return fail('a template string never ends'); last = 'v'; continue; }
      if (top !== pairs[c]) return fail(top ? 'a "' + c + '" closes a "' + top + '"' : 'a "' + c + '" closes nothing');
      i++; last = c === '}' ? 'o' : 'v'; continue;
    }
    if (/[\w$]/.test(c)) {
      let w = ''; while (i < s.length && /[\w$]/.test(s[i])) w += s[i++];
      last = /^(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/.test(w) ? 'o' : 'v'; continue;
    }
    i++; last = 'o';
  }
  if (stack.length) return fail('a "' + stack[stack.length - 1] + '" is never closed');
  return null;
  // inside a template (its "`" already on the stack): returns the index after its closing "`", or after a "${" it entered
  function template() {
    while (i < s.length) {
      if (s[i] === '\\') { i += 2; continue; }
      if (s[i] === '\n') line++;
      if (s[i] === '`') { stack.pop(); return i + 1; }
      if (s[i] === '$' && s[i + 1] === '{') { stack.pop(); stack.push('${'); return i + 2; }
      i++;
    }
    return -1;
  }
}

/** { error: null } when the JavaScript parses, else the error in plain words; `how` says which check ran */
export function syntaxError(code, { module = false, fragment = false } = {}) {
  const body = module || /^[ \t]*(?:import|export)\b/m.test(code) ? unmodule(code) : String(code);
  if (fragment) { // a snippet in an answer may be an object's insides or one expression: any reading that parses will do
    const first = syntaxError(body);
    if (!first.error || first.how !== 'parsed') return first;
    for (const w of ['(' + body + '\n)', '({' + body + '\n})']) if (!syntaxError(w).error) return { error: null, how: 'parsed' };
    return first;
  }
  if (canCompile()) {
    // compiled to see whether it parses, never called: nothing in it runs
    try { const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor; new AsyncFunction(body); return { error: null, how: 'parsed' }; } // void-review: ok
    catch (e) { return { error: String((e && e.message) || e), how: 'parsed' }; }
  }
  return { error: scan(body), how: 'brackets' };
}

// The names a piece of code defines: function declarations, functions and arrows bound to a name, class methods are left
// out (too many false names); used to see which ones a rewrite lost.
export function functionNames(code) {
  const names = new Set(), s = String(code || '');
  for (const m of s.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g)) names.add(m[1]);
  for (const m of s.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\b|\([^()]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g)) names.add(m[1]);
  return names;
}

/** apply find/replace patches in order; each anchor must match exactly once in the text as it stands */
export function applyPatch(text, patch) {
  const list = Array.isArray(patch) ? patch : [patch], reasons = [];
  let out = String(text || '');
  if (!list.length) return { after: out, reasons: ['the patch has no changes in it'] };
  list.forEach((p, n) => {
    const k = 'change ' + (n + 1) + ' of ' + list.length;
    if (!p || typeof p.find !== 'string' || typeof p.replace !== 'string') { reasons.push(k + ' has no find or no replace text'); return; }
    if (!p.find.length) { reasons.push(k + ' has an empty anchor'); return; }
    const at = out.indexOf(p.find);
    if (at < 0) { reasons.push(k + ' points at text that is not there: "' + p.find.slice(0, 60) + '"'); return; }
    if (out.indexOf(p.find, at + 1) >= 0) { reasons.push(k + ' is ambiguous: its anchor "' + p.find.slice(0, 60) + '" matches more than once'); return; }
    out = out.slice(0, at) + p.replace + out.slice(at + p.find.length);
  });
  return { after: out, reasons };
}

/**
 * Check one piece of model-written code against what it replaces. `before` is the original ('' when there is none: then
 * only stub text and syntax are checked); `after` is the new text, or `patch` ({ find, replace } or a list of them) is
 * applied to `before` to make it. `base` (default `before`) is text whose stub markers are not the model's; `fragment`
 * lets a snippet pass as an object's insides or one expression (an answer's code block, not a whole file).
 * Returns { ok, reasons, after, syntax }: reasons in plain words, empty when ok.
 */
export function guardPatch({ before = '', after, kind = 'text', patch, base, fragment = false } = {}) {
  const reasons = [];
  let out = after;
  before = String(before || '');
  if (patch !== undefined && patch !== null) {
    const p = applyPatch(before, patch);
    reasons.push(...p.reasons);
    if (out === undefined || out === null) out = p.after;
    for (const x of (Array.isArray(patch) ? patch : [patch])) if (x && typeof x.replace === 'string') reasons.push(...stubReasons(x.replace, x.find || ''));
  }
  out = String(out === undefined || out === null ? '' : out);
  if (!out.trim()) return { ok: false, reasons: reasons.concat('it is empty'), after: out, syntax: null };
  reasons.push(...stubReasons(out, base === undefined ? before : String(base || '')));
  if (before.length >= SHRINK_MIN && out.length < before.length * SHRINK) {
    reasons.push('it is ' + Math.round((1 - out.length / before.length) * 100) + '% shorter than the original (more than ' + Math.round((1 - SHRINK) * 100) + '% means part of it was lost)');
  }
  let syntax = null;
  const code = (s) => kind === 'html' ? scriptsOf(s) : kind === 'js' ? [{ code: s, module: false }] : [];
  if (kind === 'js' || kind === 'html') {
    code(out).forEach((sc, n, all) => {
      const r = syntaxError(sc.code, { module: sc.module, fragment });
      syntax = r.how;
      if (r.error) reasons.push('its JavaScript' + (kind === 'html' && all.length > 1 ? ' (script ' + (n + 1) + ')' : '') + ' does not parse: ' + r.error);
    });
    if (before) {
      const had = new Set(), now = new Set();
      for (const sc of code(before)) for (const f of functionNames(sc.code)) had.add(f);
      for (const sc of code(out)) for (const f of functionNames(sc.code)) now.add(f);
      const gone = [...had].filter((f) => !now.has(f) && !new RegExp('\\b' + f.replace(/\$/g, '\\$') + '\\b').test(out));
      if (gone.length) reasons.push('it lost ' + (gone.length === 1 ? 'a function' : gone.length + ' functions') + ': ' + gone.slice(0, 6).join(', ') + (gone.length > 6 ? ', ...' : ''));
    }
  } else if (kind === 'json') {
    syntax = 'parsed';
    const tries = fragment ? [out, '{' + out + '}', '[' + out + ']'] : [out];
    const errs = tries.map((t) => { try { JSON.parse(t); return null; } catch (e) { return String((e && e.message) || e); } });
    if (errs.every(Boolean)) reasons.push('its JSON does not parse: ' + errs[0]);
  }
  return { ok: !reasons.length, reasons: [...new Set(reasons)], after: out, syntax };
}

/** the kind of a fenced block from its label (```js, ```html, ```json); anything else is checked as text */
export function kindOf(label) {
  const l = String(label || '').trim().toLowerCase();
  if (/^(?:js|javascript|mjs|cjs|node)$/.test(l)) return 'js'; // jsx and ts are not plain JavaScript: checked as text
  if (/^(?:html|htm|xhtml)$/.test(l)) return 'html';
  if (/^(?:json)$/.test(l)) return 'json';
  return 'text';
}

/**
 * Check a model's whole answer: its prose for stub text, and each fenced code block by its label. `before` is what the
 * person pasted (stub markers already in it do not count). A code block is new code, not a rewrite of the paste, so the
 * shrink and lost-function checks need a `before` of the same code: pass `original` for that.
 */
export function guardAnswer(text, { before = '', original = '' } = {}) {
  const s = String(text || ''), reasons = [], blocks = [];
  const prose = s.replace(/```([^\n`]*)\n([\s\S]*?)(?:```|$)/g, (_, label, body) => { blocks.push({ kind: kindOf(label), body }); return '\n'; });
  reasons.push(...stubReasons(prose, before, { prose: true }));
  blocks.forEach((b, n) => {
    const r = guardPatch({ before: original || '', after: b.body, kind: b.kind, base: before + '\n' + (original || ''), fragment: !original });
    for (const why of r.reasons) reasons.push((blocks.length > 1 ? 'code block ' + (n + 1) + ': ' : 'the code block: ') + why);
  });
  return { ok: !reasons.length, reasons: [...new Set(reasons)], blocks: blocks.length };
}

/** one plain line for a person: why a draft was not used */
export function heldBack(reasons, what = 'the draft') {
  const r = (reasons || []).slice(0, 3);
  return what + ' was not used: ' + (r.length ? r.join('; ') : 'it failed the patch guard');
}
