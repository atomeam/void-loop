/**
 * dev-tools skill — one card with seven small developer tools, each its own mode (tools pack 7, owner 2026-10-18: items 161, 162,
 * 164, 168, 167, 169, 170): "format json {...}", "base64 encode hello", "regex tester /\d+/g on abc 123", "explain cron 0 9 * * 1-5",
 * "http status 404", "generate 5 rows of dummy data with name email age", "polish my commit message: fixed the login bug".
 * The text you type stays on this device in the stage's own storage and is never sent anywhere. (The hex/rgb converter is the colour
 * card in skills/util.js; UUID and lorem ipsum were already there.) All the logic is lib/dev-tools.js (tests: tools/tools-pack-7.test.mjs).
 * Every value goes in by textContent.
 */
import { addThing, cardEl, keepOut } from '../lib/stage-pack.js';
import * as D from '../lib/dev-tools.js';

export const { devOf } = D;

const BTN = 'font:inherit;padding:3px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer;min-height:28px';
const FIELD = 'font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px 8px;color-scheme:dark;box-sizing:border-box;min-width:0';
const TITLES = { json: 'JSON formatter', base64: 'Base64', regex: 'Regex test box', cron: 'Cron explainer', http: 'HTTP status cheat card', dummy: 'Dummy data rows', commit: 'Commit message polish' };
const HINTS = { json: 'paste JSON here', base64: 'text to encode, or Base64 to decode', cron: 'e.g. 0 9 * * 1-5', http: 'a code like 404, or leave empty for the whole card', dummy: 'columns: name, email, city, age ...', commit: 'your commit message, e.g. fixed the login bug.' };

function h(tag, css, text, attrs) {
  const e = document.createElement(tag);
  if (css) e.style.cssText = css;
  if (text != null) e.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
function copyText(stageApi, text) {
  try { navigator.clipboard.writeText(text).then(() => stageApi.say('copied'), () => stageApi.say('copy did not work here')); } catch (_) { stageApi.say('copy did not work here'); }
}
function button(text, fn, cls, parent, pressed) {
  const b = h('button', BTN + (pressed ? ';background:rgba(143,180,255,.25)' : ''), text, { type: 'button' });
  if (cls) b.className = cls;
  if (pressed !== undefined) b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
  keepOut(b); parent.appendChild(b);
  return b;
}
const area = (th, stageApi, ph, rows, onChange) => {
  const t = h('textarea', FIELD + ';width:100%;resize:vertical', null, { rows: String(rows), placeholder: ph, 'aria-label': ph, spellcheck: 'false' });
  t.className = 'dt-in'; t.value = th.input || '';
  t.addEventListener('input', () => { th.input = t.value.slice(0, 6000); stageApi.save(); onChange(); });
  keepOut(t);
  return t;
};

/** the stage kind's mount: the card, its input, its live output */
function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'dev-tools');
  el.dataset.mode = th.mode; el.style.width = 'min(92vw,460px)';
  th.opts = th.opts || {};
  const { save, render } = stageApi;
  el.appendChild(h('div', 'margin-bottom:8px')).appendChild(h('b', '', TITLES[th.mode] || 'Dev tool'));
  const out = h('div', 'margin-top:8px;font-size:13px', null, { class: 'dt-out', 'aria-live': 'polite' });
  const pre = (text, cls) => { const p = h('pre', FIELD + ';margin:0;white-space:pre-wrap;word-break:break-word;max-height:260px;overflow:auto;user-select:text', text, { class: cls || 'dt-result', tabindex: '0' }); return p; };
  const err = (text) => h('div', 'color:var(--a11y-bad,#ffb4a8)', text, { class: 'dt-err', role: 'alert' });
  const copyBar = (text) => { const r = h('div', 'margin-top:6px'); button('Copy', () => copyText(stageApi, text), 'dt-copy', r); return r; };
  const set = (...nodes) => { out.replaceChildren(...nodes); };
  const mode = th.mode;

  if (mode === 'json') {
    const opt = h('div', 'display:flex;gap:6px;margin-bottom:6px');
    button('Format', () => { th.opts.minify = false; save(); render(); }, 'dt-format', opt, !th.opts.minify);
    button('Minify', () => { th.opts.minify = true; save(); render(); }, 'dt-minify', opt, !!th.opts.minify);
    const paint = () => { const r = D.formatJson(th.input, { minify: !!th.opts.minify }); set(...(r.ok ? (r.out ? [pre(r.out), copyBar(r.out)] : []) : [err(r.err)])); };
    el.append(opt, area(th, stageApi, HINTS.json, 6, paint), out); paint();
  } else if (mode === 'base64') {
    const opt = h('div', 'display:flex;gap:6px;margin-bottom:6px');
    button('Encode', () => { th.opts.dir = 'encode'; save(); render(); }, 'dt-encode', opt, th.opts.dir !== 'decode');
    button('Decode', () => { th.opts.dir = 'decode'; save(); render(); }, 'dt-decode', opt, th.opts.dir === 'decode');
    const paint = () => {
      if (!th.input) return set();
      const r = th.opts.dir === 'decode' ? D.b64Decode(th.input) : { ok: true, out: D.b64Encode(th.input) };
      set(...(r.ok ? [pre(r.out), copyBar(r.out)] : [err(r.err)]));
    };
    el.append(opt, area(th, stageApi, HINTS.base64, 4, paint), out); paint();
  } else if (mode === 'regex') {
    const row = h('div', 'display:flex;gap:6px;margin-bottom:6px');
    const pat = h('input', FIELD + ';flex:1', null, { placeholder: 'pattern, e.g. \\d+', 'aria-label': 'pattern', spellcheck: 'false' }); pat.className = 'dt-pat'; pat.value = th.opts.pattern || '';
    const fl = h('input', FIELD + ';width:56px', null, { placeholder: 'flags', 'aria-label': 'flags', spellcheck: 'false', maxlength: '6' }); fl.className = 'dt-flags'; fl.value = th.opts.flags || '';
    const paint = () => {
      th.opts.pattern = pat.value.slice(0, D.REGEX_LIMITS.pattern); th.opts.flags = fl.value; save();
      const r = D.regexTest(th.opts.pattern, th.opts.flags, th.input || '');
      if (!r.ok) return set(err(r.err));
      if (!th.opts.pattern) return set();
      const box = h('div', FIELD + ';white-space:pre-wrap;word-break:break-word;max-height:180px;overflow:auto', null, { class: 'dt-marked' });
      for (const p of D.regexPieces(th.input || '', r.matches)) box.appendChild(p.hit ? h('mark', 'background:#ffd166;color:#111;border-radius:3px', p.text) : document.createTextNode(p.text));
      const list = h('div', 'margin-top:6px;opacity:.85', r.matches.length + ' match' + (r.matches.length === 1 ? '' : 'es') + (r.matches.length >= D.REGEX_LIMITS.matches ? ' (first ' + D.REGEX_LIMITS.matches + ')' : ''), { class: 'dt-count' });
      const groups = r.matches.filter((m) => m.groups.length).slice(0, 8).map((m) => '#' + m.index + ': ' + m.groups.map((g, i) => '$' + (i + 1) + '=' + JSON.stringify(g)).join(' '));
      set(box, list, ...(groups.length ? [h('div', 'margin-top:4px;font-size:12px;opacity:.8;font-family:ui-monospace,monospace', groups.join('\n'))] : []));
    };
    for (const i of [pat, fl]) { i.addEventListener('input', paint); keepOut(i); }
    row.append(pat, fl);
    el.append(row, area(th, stageApi, 'text to test against', 4, paint), out); paint();
  } else if (mode === 'cron') {
    const inp = h('input', FIELD + ';width:100%', null, { placeholder: HINTS.cron, 'aria-label': 'cron expression', spellcheck: 'false' }); inp.className = 'dt-in'; inp.value = th.input || '';
    const paint = () => {
      th.input = inp.value.slice(0, 80); save();
      if (!th.input.trim()) return set();
      const r = D.explainCron(th.input);
      if (!r.ok) return set(err(r.err));
      const runs = D.nextRuns(th.input, new Date(), 3);
      set(h('div', 'font-size:15px', r.text, { class: 'dt-explain' }), ...(runs.length ? [h('div', 'margin-top:6px;opacity:.8;font-size:12px', 'Next: ' + runs.map((d) => d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })).join(' · '), { class: 'dt-next' })] : []));
    };
    inp.addEventListener('input', paint); keepOut(inp);
    el.append(inp, out); paint();
  } else if (mode === 'http') {
    const inp = h('input', FIELD + ';width:100%', null, { placeholder: HINTS.http, 'aria-label': 'status code', inputmode: 'numeric', maxlength: '3' }); inp.className = 'dt-in'; inp.value = th.input || '';
    const paint = () => {
      th.input = inp.value.replace(/\D/g, '').slice(0, 3); save();
      const hit = th.input.length === 3 ? D.httpInfo(th.input) : null;
      const list = h('div', 'max-height:240px;overflow:auto;margin-top:6px;display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:12px', null, { class: 'dt-list' });
      for (const x of D.HTTP) {
        const on = hit && hit.code === x.code;
        list.appendChild(h('b', on ? 'color:#ffd166' : '', String(x.code), on ? { 'data-hit': '1' } : null));
        list.appendChild(h('span', on ? 'color:#ffd166' : 'opacity:.85', x.name + ' — ' + x.means));
      }
      set(...(hit ? [h('div', 'font-size:15px', hit.code + ' ' + hit.name + ': ' + hit.means, { class: 'dt-hit' })] : []), list);
    };
    inp.addEventListener('input', paint); keepOut(inp);
    el.append(inp, out); paint();
  } else if (mode === 'dummy') {
    const cols = () => { const c = D.columnsIn(th.input); return c.length ? c : ['id', 'name', 'email', 'city']; };
    const opt = h('div', 'display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center');
    const n = h('input', FIELD + ';width:64px', null, { type: 'number', min: '1', max: String(D.DUMMY_MAX_ROWS), 'aria-label': 'rows' }); n.className = 'dt-rows'; n.value = String(th.opts.n || 5);
    const paint = () => {
      th.opts.n = Math.min(D.DUMMY_MAX_ROWS, Math.max(1, Math.floor(+n.value) || 5)); save();
      const c = cols(), rows = D.dummyRows(c, th.opts.n, th.opts.seed || 1), text = th.opts.json ? D.toJsonRows(rows) : D.toCsv(c, rows);
      set(pre(text), copyBar(text));
    };
    n.addEventListener('input', paint); keepOut(n);
    opt.append(h('span', 'font-size:12px;opacity:.8', 'rows'), n);
    button('New rows', () => { th.opts.seed = 1 + Math.floor(Math.random() * 1e9); save(); paint(); }, 'dt-again', opt);
    button(th.opts.json ? 'JSON' : 'CSV', () => { th.opts.json = !th.opts.json; save(); render(); }, 'dt-fmt', opt);
    const tip = h('div', 'font-size:11px;opacity:.65;margin-top:4px', 'Made-up people with example.com addresses and 555 numbers; the same rows until you ask for new ones. Columns: ' + D.DUMMY_COLUMNS.join(', ') + '.');
    el.append(area(th, stageApi, HINTS.dummy, 2, paint), opt, out, tip); paint();
  } else if (mode === 'commit') {
    const paint = () => {
      const r = D.polishCommit(th.input);
      if (!r) return set();
      const line = (label, text, cls) => { const d = h('div', 'margin-bottom:6px'); d.appendChild(h('div', 'font-size:11px;opacity:.65;text-transform:uppercase;letter-spacing:.05em', label)); d.appendChild(pre(text, cls)); const b = h('div', 'margin-top:4px'); button('Copy', () => copyText(stageApi, text + (r.body ? '\n\n' + r.body : '')), 'dt-copy', b); d.appendChild(b); return d; };
      set(line('Plain', r.plain, 'dt-plain'), ...(r.conventional ? [line('Conventional Commits', r.conventional, 'dt-conv')] : []), ...(r.notes.length ? [h('ul', 'margin:4px 0 0;padding-left:18px;opacity:.8;font-size:12px', null, { class: 'dt-notes' })] : []));
      const ul = out.querySelector('.dt-notes'); if (ul) for (const x of r.notes) ul.appendChild(h('li', '', x));
    };
    el.append(area(th, stageApi, HINTS.commit, 3, paint), out); paint();
  }
  if (th.mode === 'base64') { // the full Base64 page (files, URL-safe, every charset) is one tap away (owner, 2026-10-25: "why are you not linking the cards to the pages?")
    const full = h('a', 'display:inline-block;margin:8px 0 2px;font-size:13px;font-weight:600', 'Open the full Base64 page →', { class: 'vc-page', href: '/base64/' });
    full.addEventListener('pointerdown', (e) => e.stopPropagation()); el.append(full);
  }
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the kind's ask: put the tool on the stage with what the ask already holds; the name of what happened, or '' */
export function ask(lower, text, stageApi) {
  const p = D.devOf(text);
  if (!p) return '';
  const props = { mode: p.mode, input: p.input || '', opts: { ...(p.opts || {}) } };
  if (p.mode === 'dummy') props.opts.seed = 1 + Math.floor(Math.random() * 1e9);
  addThing(stageApi, 'devtool', props);
  stageApi.save(); stageApi.render();
  return 'dev-' + p.mode;
}

export default {
  name: 'dev-tools',
  examples: ['format json {"a":1,"b":[1,2]}', 'base64 encode hello world', 'regex tester /\\d+/g on call 555 or 911', 'explain cron 0 9 * * 1-5', 'http status 404',
    'generate 5 rows of dummy data with name email city', 'polish my commit message: fixed the login bug'],
  nearMisses: ['what is json', 'json vs xml', 'what is base64', 'what is a regex', 'regex for an email address', 'what is a cron job', 'http status of google.com', 'what is dummy data', 'how to write a good commit message', 'write a commit'],
  devOf: D.devOf,
  match(lower, text) { return !!D.devOf(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'dev-tools' : 'none'; },
  stageKinds: { devtool: { mount, ask } },
};
