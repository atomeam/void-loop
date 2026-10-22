/**
 * The terminal card's commands (asked by the owner, 2026-10-19: a command line for Verse that does most things without a model).
 * Pure: a line and the data files go in, lines to print and at most one thing to hand the page come out. Nothing here fetches,
 * touches the page or calls a model, so every command is the same on every run and tools/terminal.test.mjs can hold it.
 *
 * The command list is closed. A word that is not on it prints "unknown command" and the closest names; it is never sent
 * anywhere. Four commands hand the page an ask that goes through the normal skills (ask, status, note, timer); one,
 * `ask --model`, is the only way a model is reached, and every line it prints starts with the marker MODEL so nobody mistakes
 * a drafted answer for a rule's. Side effects (a note, a timer) only ever happen through the page's own skills, with their own
 * confirm lines; the terminal adds none of its own.
 */

export const MODEL_MARK = '[model] ';

/** the closed command list: name, usage, one line. The order is the order `help` prints. */
export const COMMANDS = [
  { name: 'help', usage: 'help [command]', info: 'list the commands, or say what one does' },
  { name: 'ask', usage: 'ask <text>', info: 'answer an ask with the skills; ask --model <text> uses the model, marked [model]' },
  { name: 'skills', usage: 'skills [word]', info: 'list the skills, or only those whose name or line has the word' },
  { name: 'skill', usage: 'skill <name>', info: 'what one skill does, how far it is checked, and what to ask it' },
  { name: 'examples', usage: 'examples <skill>', info: 'asks that skill answers' },
  { name: 'families', usage: 'families', info: 'the skill families and how far each is checked' },
  { name: 'growth', usage: 'growth [n]', info: 'the newest lines of the growth ledger (default 5)' },
  { name: 'incidents', usage: 'incidents [n]', info: 'the newest failed runs on main (default 5)' },
  { name: 'asks', usage: 'asks [n]', info: 'the asks you made on this device, newest first (default 10)' },
  { name: 'status', usage: 'status', info: "Verse's health check card" },
  { name: 'note', usage: 'note <text>', info: 'put a note on the stage' },
  { name: 'timer', usage: 'timer <time>', info: 'start a timer: 90s, 5m, 1h, or "5 minutes"' },
  { name: 'history', usage: 'history', info: 'the commands typed in this card' },
  { name: 'clear', usage: 'clear', info: 'empty this card' },
];

const NAMES = COMMANDS.map((c) => c.name);
const out = (t, k = 'out') => ({ t: String(t), k });
const clip = (s, n) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; }; // ellipsis-ok: drawn picture or short label, the full text is on the card
const asCount = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n >= 1 ? Math.min(n, 50) : d; };

/** split a typed line into the command word and the rest. Pure. */
export function parse(line) {
  const s = String(line == null ? '' : line).trim();
  const m = /^(\S+)(?:\s+([\s\S]*))?$/.exec(s);
  if (!m) return { cmd: '', rest: '', args: [] };
  const rest = (m[2] || '').trim();
  return { cmd: m[1].toLowerCase(), rest, args: rest ? rest.split(/\s+/) : [] };
}

/** a time as the words the timer skill takes: "90s" -> "90 seconds", "5m" -> "5 minutes", "1h" -> "1 hour", "5 minutes" stays. null when it is not a time. Pure. */
export function timeWords(rest) {
  const t = String(rest || '').trim().toLowerCase();
  let m = /^(\d{1,4})\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?)$/.exec(t);
  if (!m) return null;
  const n = Number(m[1]); if (!(n >= 1)) return null;
  const u = m[2][0] === 's' ? 'second' : m[2][0] === 'h' ? 'hour' : 'minute';
  return n + ' ' + u + (n === 1 ? '' : 's');
}

/** edit distance, for "did you mean". Pure. */
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** the command names that start with the typed prefix, or else those within two edits. Pure. */
export function complete(prefix) {
  const p = String(prefix || '').toLowerCase();
  if (!p) return NAMES.slice();
  const starts = NAMES.filter((n) => n.startsWith(p));
  return starts.length ? starts : NAMES.filter((n) => distance(p, n) <= 2);
}

/** the skills the guide lists, as { name, title, line, examples, tier, why }. Pure. */
export function skillsOf(guide) {
  const pages = guide && Array.isArray(guide.pages) ? guide.pages : [];
  return pages.filter((p) => p && p.kind === 'skill' && typeof p.name === 'string').map((p) => ({ name: p.name, title: p.title || p.name, line: p.line || '', examples: Array.isArray(p.examples) ? p.examples : [], tier: p.tier || '', why: p.why || '' }));
}

/** the skill whose name is exactly the word, or else the only one that starts with it. Pure. */
export function findSkill(list, word) {
  const w = String(word || '').trim().toLowerCase();
  if (!w) return null;
  const exact = list.find((s) => s.name.toLowerCase() === w);
  if (exact) return exact;
  const some = list.filter((s) => s.name.toLowerCase().startsWith(w));
  return some.length === 1 ? some[0] : null;
}

const unknown = (cmd) => {
  const near = complete(cmd);
  return [out('unknown command: ' + clip(cmd, 40), 'err'), out(near.length && near.length < NAMES.length ? 'did you mean: ' + near.slice(0, 4).join(', ') + '?' : "type 'help' for the list", 'err')];
};

/**
 * Run one typed line. data = { guide, families, growth, incidents, loop, history }, any of them missing (the card passes what it has read).
 * Returns { lines: [{ t, k }], route: null | { ask }, model: null | { ask }, clear: boolean }.
 * `route` is an ask for the page's own skills; `model` is an ask for the model, only from `ask --model`. Pure.
 */
export function run(line, data = {}) {
  const { cmd, rest, args } = parse(line);
  const res = { lines: [], route: null, model: null, clear: false };
  if (!cmd) return res;
  if (!NAMES.includes(cmd)) { res.lines = unknown(cmd); return res; }
  const use = (c) => 'usage: ' + COMMANDS.find((x) => x.name === c).usage;
  switch (cmd) {
    case 'help': {
      if (args[0]) {
        const c = COMMANDS.find((x) => x.name === args[0].toLowerCase());
        res.lines = c ? [out(c.usage), out('  ' + c.info)] : unknown(args[0]);
      } else res.lines = [out('commands (every one works without a model):')].concat(COMMANDS.map((c) => out('  ' + c.usage.padEnd(22) + c.info)));
      return res;
    }
    case 'ask': {
      const m = /^--model(?:\s+([\s\S]*))?$/.exec(rest);
      if (m) { const q = (m[1] || '').trim(); if (!q) { res.lines = [out(use('ask'), 'err')]; return res; } res.model = { ask: q.slice(0, 500) }; res.lines = [out('asking the model; its answer is marked ' + MODEL_MARK.trim(), 'dim')]; return res; }
      if (!rest) { res.lines = [out(use('ask'), 'err')]; return res; }
      res.route = { ask: rest.slice(0, 500) }; res.lines = [out('→ ' + clip(rest, 120), 'dim')]; return res;
    }
    case 'status': res.route = { ask: 'verse status' }; res.lines = [out('→ verse status', 'dim')]; return res;
    case 'note': if (!rest) { res.lines = [out(use('note'), 'err')]; return res; } res.route = { ask: 'note: ' + rest.slice(0, 300) }; res.lines = [out('→ note: ' + clip(rest, 100), 'dim')]; return res;
    case 'timer': {
      const w = timeWords(rest);
      if (!w) { res.lines = [out(use('timer'), 'err')]; return res; }
      res.route = { ask: 'set a timer for ' + w }; res.lines = [out('→ set a timer for ' + w, 'dim')]; return res;
    }
    case 'skills': {
      const list = skillsOf(data.guide);
      if (!list.length) { res.lines = [out('the skills list has not loaded yet; try again in a moment', 'err')]; return res; }
      const w = rest.toLowerCase();
      const hit = w ? list.filter((s) => s.name.toLowerCase().includes(w) || s.line.toLowerCase().includes(w)) : list;
      if (!hit.length) { res.lines = [out('no skill matches "' + clip(rest, 40) + '"')]; return res; }
      const shown = hit.slice(0, 40);
      res.lines = [out(hit.length + ' skill' + (hit.length === 1 ? '' : 's') + (w ? ' matching "' + clip(rest, 40) + '"' : '') + ':')].concat(shown.map((s) => out('  ' + s.name.padEnd(20) + clip(s.line, 90))));
      if (hit.length > shown.length) res.lines.push(out('  … and ' + (hit.length - shown.length) + ' more; add a word to narrow it', 'dim'));
      return res;
    }
    case 'skill': case 'examples': {
      if (!rest) { res.lines = [out(use(cmd), 'err')]; return res; }
      const list = skillsOf(data.guide);
      if (!list.length) { res.lines = [out('the skills list has not loaded yet; try again in a moment', 'err')]; return res; }
      const s = findSkill(list, args[0]);
      if (!s) { const near = list.filter((x) => distance(args[0].toLowerCase(), x.name.toLowerCase()) <= 2).slice(0, 4).map((x) => x.name); res.lines = [out('no skill called "' + clip(args[0], 40) + '"', 'err')].concat(near.length ? [out('did you mean: ' + near.join(', ') + '?', 'err')] : []); return res; }
      if (cmd === 'examples') { res.lines = s.examples.length ? [out(s.name + ' answers:')].concat(s.examples.map((e) => out('  ' + e))) : [out(s.name + ' lists no example asks yet')]; return res; }
      res.lines = [out(s.title + ' (' + s.name + ')'), out('  ' + clip(s.line, 220))];
      if (s.tier) res.lines.push(out('  checked: ' + s.tier + (s.why ? ' · ' + clip(s.why, 90) : '')));
      if (s.examples.length) res.lines.push(out('  try: ' + s.examples.slice(0, 3).map((e) => '"' + clip(e, 50) + '"').join(', ')));
      return res;
    }
    case 'families': {
      const fam = data.families && Array.isArray(data.families.families) ? data.families.families : [];
      if (!fam.length) { res.lines = [out('the families list has not loaded yet; try again in a moment', 'err')]; return res; }
      res.lines = fam.map((f) => { const c = f.count || {}; const n = (f.skills || []).length; return out('  ' + String(f.name || f.id).padEnd(22) + String(n).padStart(3) + ' skills · proven ' + (c.proven || 0) + ' · tested ' + (c.tested || 0) + ' · checked ' + (c.checked || 0) + ' · experiment ' + (c.experiment || 0)); });
      return res;
    }
    case 'growth': {
      const rows = Array.isArray(data.growth) ? data.growth : [];
      if (!rows.length) { res.lines = [out('the growth ledger has not loaded yet; try again in a moment', 'err')]; return res; }
      const n = asCount(args[0], 5);
      res.lines = rows.slice(-n).reverse().map((r) => out('  ' + String(r.at || '').slice(0, 16).replace('T', ' ') + '  ' + clip(r.what || r.show || '', 140)));
      return res;
    }
    case 'incidents': {
      const rows = data.incidents && Array.isArray(data.incidents.incidents) ? data.incidents.incidents : [];
      if (!rows.length) { res.lines = [out('no incidents on record, or the file has not loaded yet')]; return res; }
      const n = asCount(args[0], 5);
      res.lines = rows.slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, n).map((r) => out('  ' + String(r.at || '').slice(0, 16).replace('T', ' ') + '  ' + String(r.sha || '').slice(0, 8) + '  ' + clip((r.checks || []).join(' · ') || r.suite || '', 120)));
      return res;
    }
    case 'asks': {
      const rows = Array.isArray(data.loop) ? data.loop : [];
      if (!rows.length) { res.lines = [out('nothing asked on this device yet')]; return res; }
      const n = asCount(args[0], 10);
      res.lines = rows.slice(-n).reverse().map((r) => out('  ' + clip(r.ask, 90) + (r.note ? '   ← ' + clip(r.note, 30) : '')));
      return res;
    }
    case 'history': {
      const h = Array.isArray(data.history) ? data.history : [];
      res.lines = h.length ? h.slice(-20).map((x, i) => out('  ' + String(i + 1).padStart(2) + '  ' + clip(x, 100))) : [out('nothing typed yet')];
      return res;
    }
    case 'clear': res.clear = true; return res;
  }
  return res;
}

/** step through the typed commands with the arrow keys: dir -1 is older, +1 newer; index === history.length is the empty line. Pure. */
export function step(history, index, dir) {
  const h = Array.isArray(history) ? history : [];
  const i = Math.max(0, Math.min(h.length, (Number.isInteger(index) ? index : h.length) + dir));
  return { index: i, text: i < h.length ? h[i] : '' };
}

/** what a drafted answer is printed as: every line starts with the marker. Pure. */
export function modelLines(answer) {
  const t = String(answer == null ? '' : answer).trim();
  if (!t) return [{ t: MODEL_MARK + '(no answer)', k: 'model' }];
  return t.split(/\n+/).slice(0, 12).map((l) => ({ t: MODEL_MARK + l.slice(0, 400), k: 'model' }));
}

/** the asks the page logged, kept to the fields the terminal prints. Pure. */
export function loopOf(raw) {
  let l; try { l = JSON.parse(raw || '[]'); } catch (_) { l = []; }
  return (Array.isArray(l) ? l : []).filter((x) => x && typeof x.ask === 'string').map((x) => ({ ask: x.ask, note: typeof x.note === 'string' ? x.note : '' }));
}
