/**
 * terminal skill (asked by the owner, 2026-10-19: "a CLI is easy to add, and better than an LLM mostly means not using one for most things").
 * "terminal", "open the command line", "verse cli": a command-line card on the stage with history (arrow keys), tab-complete and a
 * closed list of commands (lib/terminal.js). Every command is a rule, not a model: skills, skill <name>, examples <skill>, families,
 * growth, incidents and asks read the files the cards read; ask, status, note and timer hand the page an ask that goes through the
 * normal skills (with their own confirm lines). `ask --model <text>` is the one door to the model, and every line it prints is marked
 * [model]. The commands typed are kept on this device only (a2m.void.terminal.v1, the last 50), never sent.
 */
import { run as runLine, complete, step, modelLines, loopOf, COMMANDS } from '../lib/terminal.js';
import { keepOut } from '../lib/stage-pack.js';

export const KEY = 'a2m.void.terminal.v1', KEEP = 50;
const ASK = /^(?:please\s+)?(?:(?:open|show|start|launch|give\s+me|bring\s+up)\s+)?(?:a\s+|the\s+|my\s+|your\s+|(?:verse|void|v01d)(?:'s)?\s+)?(?:terminal|command[\s-]?line|cli)(?:\s+(?:card|window|for\s+(?:verse|void)))?$/;

export function terminalAsk(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return ASK.test(t);
}

const readHistory = () => { try { const h = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(h) ? h.filter((x) => typeof x === 'string').slice(-KEEP) : []; } catch (_) { return []; } };
const saveHistory = (h) => { try { localStorage.setItem(KEY, JSON.stringify(h.slice(-KEEP))); } catch (_) { /* private mode: the history lives in the card only */ } };

async function readJson(url) { try { const r = await fetch(url, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (_) { return null; } }

async function run(text, api) {
  if (!terminalAsk(text)) return 'none';
  const { showPage } = api, st = api.stage;
  const data = { guide: null, families: null, growth: null, incidents: null, loop: [], history: readHistory() };
  const el = showPage((p) => { p.innerHTML = '<h2>Terminal</h2><div class="sub">Verse from the command line · every command is a rule, not a model · kept on this device only</div>'; });
  const log = document.createElement('div'); log.className = 'term-log'; log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite');
  log.style.cssText = 'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:8px 10px;margin:8px 0;max-height:28vh;overflow:auto;white-space:pre-wrap;word-break:break-word';
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;align-items:center';
  const mark = document.createElement('span'); mark.textContent = '›'; mark.setAttribute('aria-hidden', 'true'); mark.style.cssText = 'font:14px ui-monospace,monospace;opacity:.7';
  const input = document.createElement('input'); input.className = 'term-in'; input.type = 'text'; input.autocomplete = 'off'; input.spellcheck = false; input.autocapitalize = 'off'; input.maxLength = 500;
  input.setAttribute('aria-label', 'terminal command'); input.placeholder = "type help";
  input.style.cssText = 'flex:1;min-width:0;font:13px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:6px 8px;min-height:32px;box-sizing:border-box';
  row.append(mark, input); el.append(row, log); // the prompt sits above the output: the card has a tall art header and the prompt must stay in view
  keepOut(input); keepOut(log);
  const colours = { err: '#ff9a8a', dim: 'rgba(255,255,255,.55)', model: '#9ec5ff', cmd: '#ffffff', out: 'inherit' };
  const print = (t, k) => { const d = document.createElement('div'); d.className = 'term-' + (k || 'out'); d.textContent = t; d.style.color = colours[k] || colours.out; log.appendChild(d); log.scrollTop = log.scrollHeight; };
  print('Verse terminal. help lists the commands; Tab completes; ↑ ↓ walk the history.', 'dim');

  // the data the commands read loads once, in the background; a command typed before it arrives says so
  Promise.all([readJson('/skills/guide.json'), readJson('/skills/families.json'), readJson('/void.growth.json'), readJson('/incidents.json')]).then(([g, f, gr, inc]) => {
    data.guide = g; data.families = f; data.growth = Array.isArray(gr) ? gr : null; data.incidents = inc;
  });
  let at = data.history.length;
  const submit = async () => {
    const line = input.value.trim(); input.value = '';
    if (!line) return;
    print('› ' + line, 'cmd');
    if (data.history[data.history.length - 1] !== line) { data.history.push(line); data.history = data.history.slice(-KEEP); saveHistory(data.history); }
    at = data.history.length;
    try { data.loop = loopOf(localStorage.getItem('a2m.void.loop.v1')); } catch (_) { data.loop = []; }
    const r = runLine(line, data);
    if (r.clear) { log.textContent = ''; return; }
    for (const l of r.lines) print(l.t, l.k);
    if (r.model) {
      try {
        const res = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: r.model.ask }) });
        const j = res.ok ? await res.json() : null;
        for (const l of modelLines(j && j.answer)) print(l.t, l.k);
      } catch (_) { print('the model did not answer just now', 'err'); }
    }
    if (r.route && st && typeof st.ask === 'function') { print('(the answer opens as a card; type terminal to come back)', 'dim'); st.ask(r.route.ask); }
  };
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); const s = step(data.history, at, e.key === 'ArrowUp' ? -1 : 1); at = s.index; input.value = s.text; }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const v = input.value;
      if (/\s/.test(v.trimStart())) return;
      const hit = complete(v.trim());
      if (hit.length === 1) input.value = hit[0] + ' ';
      else if (hit.length > 1) print(hit.join('  '), 'dim');
    } else if (e.key === 'Escape') { input.blur(); }
  });
  setTimeout(() => { try { input.focus({ preventScroll: true }); } catch (_) { /* none */ } }, 50);
  return 'terminal';
}

// checked by tools/skills-check.mjs on every run: what the commands do to made-up data (the card only draws it)
export function suite() {
  const guide = { pages: [{ kind: 'skill', name: 'timer', title: 'Timer', line: 'a countdown', examples: ['set a timer for 5 minutes'], tier: 'proven', why: 'a self-test' }] };
  const a = runLine('skill timer', { guide }), b = runLine('timer 5m'), c = runLine('rm -rf /'), d = runLine('ask --model what is a tree');
  const ok = a.lines.some((l) => /Timer \(timer\)/.test(l.t)) && b.route && b.route.ask === 'set a timer for 5 minutes' && !b.model
    && c.lines[0].k === 'err' && !c.route && !c.model && d.model && d.model.ask === 'what is a tree' && !d.route
    && terminalAsk('open the terminal') && !terminalAsk('airport terminal map') && COMMANDS.length >= 10;
  return { ok, got: ok ? '' : JSON.stringify({ a, b, c, d }) };
}

export default {
  name: 'terminal',
  terminalAsk,
  suite,
  examples: ['terminal', 'open the command line', 'verse cli', 'open a terminal'],
  nearMisses: ['airport terminal map', 'terminal illness', 'terminal velocity', 'how do I use the command line in linux', 'bus terminal near me', 'cli tool for git', 'command line arguments in python', 'terminal cancer symptoms'],
  match(lower, text) { return terminalAsk(text || lower); },
  run,
};
