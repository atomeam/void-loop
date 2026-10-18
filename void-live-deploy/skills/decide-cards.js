/**
 * decide-cards skill — seven small decision cards on the stage (tools pack 3, owner 2026-10-18, list items 51, 52, 56 to 60):
 *   "ranked list of my movies" / "rank pizza, tacos, sushi"      a numbered list you move up and down
 *   "weighted pros and cons for moving"                          pros against cons, each row weighted 1 to 5, a running verdict
 *   "vote marks for pizza, tacos, sushi" / "vote on tea or coffee" tally marks (four strokes and a strike) per option
 *   "eliminate until one: a, b, c, d"                            tap to knock one out; the last one standing wins
 *   "pairwise compare a, b, c"                                   two at a time, every pair once, a ranking by wins
 *   "2x2 matrix for impact vs effort"                            a score matrix with four quadrants; tap an item, tap a quadrant
 *   "must should could for the launch"                           three buckets to sort things into
 * Copied from the best: Eisenhower and impact/effort boards, MoSCoW boards, ranked-choice and pairwise tools; one notch past
 * them: each is a card on the stage that keeps its state with the stage on this device. Nothing is sent anywhere. The pure
 * logic and the ask parsing are in lib/decide-cards.js (tests: tools/tools-pack3.test.mjs). Coin flip, pick-at-random and
 * shuffle already live in the page's chance answers, so they are not here.
 */
import { addThing, cardEl, keepOut } from '../lib/stage-pack.js';
import { parseCardAsk, moveItem, tallyView, leaders, sideTotals, survivors, toggleOut, pairsOf, nextPair, standings, bucketNames, placeItem, removeAt, MAX_ITEMS, MAX_LEN } from '../lib/decide-cards.js';

const KIND = { rank: 'dc-rank', proscons: 'dc-proscons', votes: 'dc-votes', knockout: 'dc-knockout', pairwise: 'dc-pairwise', buckets: 'dc-buckets' };
const TITLES = { rank: 'Ranked list', proscons: 'Pros and cons', votes: 'Vote marks', knockout: 'Eliminate until one', pairwise: 'Pairwise compare', buckets: 'Score matrix' };

const mk = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; };
const BTN = 'font:inherit;padding:1px 9px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer';
const INP = 'font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:2px 6px';

function shell(th, stageApi, cls, label) {
  const el = cardEl(th, stageApi, cls);
  const head = mk('div', 'margin-bottom:8px');
  head.appendChild(mk('b', '', label));
  if (th.title) head.appendChild(document.createTextNode(' · ' + th.title));
  el.appendChild(head);
  const done = () => { stageApi.save(); stageApi.render(); };
  const btn = (label2, fn, aria) => { const b = mk('button', BTN, label2); b.type = 'button'; if (aria) b.setAttribute('aria-label', aria); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); keepOut(b); return b; };
  const adder = (placeholder, onAdd) => { // a text box that adds on Enter
    const i = mk('input', INP + ';width:150px'); i.placeholder = placeholder; i.maxLength = MAX_LEN; i.setAttribute('aria-label', placeholder);
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter' && i.value.trim()) { e.preventDefault(); onAdd(i.value.trim().slice(0, MAX_LEN)); } });
    keepOut(i); return i;
  };
  const addItem = (name) => { th.items = th.items || []; if (th.items.length >= MAX_ITEMS) return; th.items.push(name); if (th.counts) th.counts.push(0); th.wins = {}; done(); };
  const dropItem = (i) => { Object.assign(th, removeAt(th, i)); done(); };
  return { el, done, btn, adder, addItem, dropItem };
}

function mountRank(th, stageApi) {
  const { el, done, btn, adder, addItem, dropItem } = shell(th, stageApi, 'dc-card dc-rank', TITLES.rank);
  th.items = th.items || [];
  const ol = mk('ol', 'margin:0 0 8px;padding-left:24px');
  th.items.forEach((name, i) => {
    const li = mk('li', 'margin:3px 0'); li.appendChild(mk('span', 'margin-right:8px', name));
    li.appendChild(btn('▲', () => { th.items = moveItem(th.items, i, -1); done(); }, 'move ' + name + ' up'));
    li.appendChild(document.createTextNode(' '));
    li.appendChild(btn('▼', () => { th.items = moveItem(th.items, i, 1); done(); }, 'move ' + name + ' down'));
    li.appendChild(document.createTextNode(' '));
    li.appendChild(btn('×', () => dropItem(i), 'remove ' + name));
    ol.appendChild(li);
  });
  el.appendChild(ol);
  el.appendChild(adder(th.items.length ? 'add another' : 'add the first', addItem));
  finish(th, stageApi, el);
}

function mountProsCons(th, stageApi) {
  const { el, done, btn } = shell(th, stageApi, 'dc-card dc-proscons', TITLES.proscons);
  th.pros = th.pros || []; th.cons = th.cons || [];
  const verdict = mk('div', 'margin-top:8px;font-weight:600');
  const paint = () => {
    const s = sideTotals(th.pros, th.cons);
    verdict.dataset.verdict = s.verdict;
    verdict.textContent = s.verdict === 'empty' ? 'add a pro or a con' : 'Pros ' + s.pro + ' · Cons ' + s.con + ' · ' + (s.verdict === 'even' ? 'dead even' : s.verdict === 'pros' ? 'pros lead by ' + s.net : 'cons lead by ' + (-s.net));
  };
  const col = (label, rows, key) => {
    const c = mk('div', 'flex:1;min-width:150px');
    c.appendChild(mk('div', 'opacity:.8;margin-bottom:4px', label + ' (weight 1 to 5)'));
    rows.forEach((r, i) => {
      const row = mk('div', 'display:flex;gap:4px;margin:3px 0;align-items:center');
      const t = mk('input', INP + ';flex:1;min-width:0'); t.value = r.text || ''; t.maxLength = 60; t.setAttribute('aria-label', label + ' ' + (i + 1));
      t.addEventListener('input', () => { r.text = t.value; stageApi.save(); paint(); }); keepOut(t);
      const w = mk('input', INP + ';width:42px'); w.type = 'number'; w.min = '1'; w.max = '5'; w.step = '1'; w.value = r.w || 1; w.setAttribute('aria-label', 'weight of ' + label + ' ' + (i + 1));
      w.addEventListener('input', () => { r.w = Math.min(5, Math.max(1, Math.round(Number(w.value) || 1))); stageApi.save(); paint(); }); keepOut(w);
      row.append(t, w, btn('×', () => { th[key].splice(i, 1); done(); }, 'remove ' + label + ' ' + (i + 1)));
      c.appendChild(row);
    });
    if (rows.length < 8) c.appendChild(btn('+ ' + label.toLowerCase(), () => { th[key].push({ text: '', w: 3 }); done(); }));
    return c;
  };
  const cols = mk('div', 'display:flex;gap:14px;flex-wrap:wrap');
  cols.append(col('Pros', th.pros, 'pros'), col('Cons', th.cons, 'cons'));
  el.append(cols, verdict);
  paint();
  finish(th, stageApi, el);
}

function mountVotes(th, stageApi) {
  const { el, done, btn, adder, addItem, dropItem } = shell(th, stageApi, 'dc-card dc-votes', TITLES.votes);
  th.items = th.items || []; th.counts = th.items.map((_, i) => Number((th.counts || [])[i]) || 0);
  const lead = leaders(th.counts);
  th.items.forEach((name, i) => {
    const row = mk('div', 'display:flex;gap:8px;align-items:center;margin:4px 0');
    const nm = mk('span', 'min-width:84px;' + (lead.includes(i) ? 'font-weight:700;color:#ffd166' : ''), name); nm.dataset.lead = lead.includes(i) ? '1' : '';
    const v = tallyView(th.counts[i]);
    const marks = mk('span', 'min-width:70px;font-family:monospace;letter-spacing:1px');
    marks.dataset.count = String(v.count);
    for (let k = 0; k < v.fives; k++) marks.appendChild(mk('span', 'text-decoration:line-through;margin-right:6px', '||||')); // four strokes and the strike
    if (v.rest) marks.appendChild(mk('span', '', '|'.repeat(v.rest)));
    row.append(nm, marks, btn('+', () => { th.counts[i] = Math.min(999, th.counts[i] + 1); done(); }, 'one vote for ' + name),
      btn('−', () => { th.counts[i] = Math.max(0, th.counts[i] - 1); done(); }, 'take a vote off ' + name), mk('span', 'opacity:.7', String(v.count)), btn('×', () => dropItem(i), 'remove ' + name));
    el.appendChild(row);
  });
  el.appendChild(adder(th.items.length ? 'add an option' : 'add the first option', addItem));
  if (th.items.length) el.appendChild(btn('clear votes', () => { th.counts = th.items.map(() => 0); done(); }));
  finish(th, stageApi, el);
}

function mountKnockout(th, stageApi) {
  const { el, done, btn, adder, addItem, dropItem } = shell(th, stageApi, 'dc-card dc-knockout', TITLES.knockout);
  th.items = th.items || []; th.out = th.out || [];
  const left = survivors(th.items.length, th.out);
  const status = mk('div', 'margin-bottom:6px;opacity:.85');
  status.textContent = th.items.length < 2 ? 'add two or more, then tap to knock them out' : left.length === 1 ? 'Last one standing: ' + th.items[left[0]] : left.length + ' left · tap one to knock it out';
  status.dataset.left = String(left.length);
  el.appendChild(status);
  const wrap = mk('div', 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px');
  th.items.forEach((name, i) => {
    const out = th.out.includes(i), win = th.items.length > 1 && left.length === 1 && left[0] === i;
    const b = btn(name, () => { th.out = toggleOut(th.items.length, th.out, i); done(); }, (out ? 'bring back ' : 'knock out ') + name);
    b.style.cssText += ';padding:4px 12px;' + (out ? 'text-decoration:line-through;opacity:.4' : win ? 'border-color:#ffd166;color:#ffd166;font-weight:700' : '');
    b.dataset.state = out ? 'out' : win ? 'win' : 'in';
    wrap.appendChild(b);
  });
  el.appendChild(wrap);
  const bar = mk('div', 'display:flex;gap:6px;flex-wrap:wrap;align-items:center');
  bar.appendChild(adder('add an option', addItem));
  if (left.length > 1) bar.appendChild(btn('knock one out for me', () => { const a = new Uint32Array(1); crypto.getRandomValues(a); th.out = toggleOut(th.items.length, th.out, left[a[0] % left.length]); done(); }));
  if (th.out.length) bar.appendChild(btn('reset', () => { th.out = []; done(); }));
  el.appendChild(bar);
  finish(th, stageApi, el);
}

function mountPairwise(th, stageApi) {
  const { el, done, btn, adder, addItem, dropItem } = shell(th, stageApi, 'dc-card dc-pairwise', TITLES.pairwise);
  th.items = th.items || []; th.wins = th.wins || {};
  const n = th.items.length, total = pairsOf(n).length, answered = Object.keys(th.wins).length;
  if (n < 2) el.appendChild(mk('div', 'margin-bottom:6px;opacity:.85', 'add two or more things to compare'));
  const pair = n >= 2 ? nextPair(n, th.wins) : null;
  if (pair) {
    el.appendChild(mk('div', 'margin-bottom:6px;opacity:.85', 'Which do you prefer? (' + (answered + 1) + ' of ' + total + ')'));
    const row = mk('div', 'display:flex;gap:10px;margin-bottom:8px');
    for (const k of pair) { const b = btn(th.items[k], () => { th.wins[pair[0] + '|' + pair[1]] = k; done(); }, 'prefer ' + th.items[k]); b.style.cssText += ';padding:8px 16px;font-size:15px'; b.dataset.pick = String(k); row.appendChild(b); }
    el.appendChild(row);
  } else if (n >= 2) {
    const st = standings(n, th.wins), ol = mk('ol', 'margin:0 0 8px;padding-left:24px');
    ol.dataset.done = '1';
    for (const r of st) ol.appendChild(mk('li', 'margin:2px 0', th.items[r.i] + ' · ' + r.wins + (r.wins === 1 ? ' win' : ' wins') + (r.tied ? ' (tied)' : '')));
    el.append(mk('div', 'margin-bottom:4px;opacity:.85', 'Your ranking'), ol);
  }
  const bar = mk('div', 'display:flex;gap:6px;flex-wrap:wrap;align-items:center');
  if (!answered && n < 8) bar.appendChild(adder('add a thing', addItem));
  if (answered) { bar.appendChild(btn('undo', () => { const last = Object.keys(th.wins).pop(); delete th.wins[last]; done(); })); bar.appendChild(btn('start over', () => { th.wins = {}; done(); })); }
  if (!answered && n) bar.appendChild(btn('× last', () => dropItem(n - 1), 'remove ' + th.items[n - 1]));
  el.appendChild(bar);
  finish(th, stageApi, el);
}

const picked = {}; // the tray item last tapped, per card (a tap in the tray, then a tap on the bucket)
function mountBuckets(th, stageApi) {
  const quad = th.mode === 'quad';
  const { el, done, btn, adder, addItem, dropItem } = shell(th, stageApi, 'dc-card dc-buckets', quad ? '2x2 score matrix' : 'Must / should / could');
  el.dataset.mode = th.mode;
  th.items = th.items || []; th.place = th.place || {};
  const names = bucketNames(th.mode, th.axes);
  const sel = picked[th.id];
  const chip = (i, inBucket) => {
    const b = btn(th.items[i], () => { if (inBucket) { th.place = placeItem(th.place, i, null, names.length); done(); } else { picked[th.id] = picked[th.id] === i ? undefined : i; stageApi.render(); } }, (inBucket ? 'take back ' : 'pick ') + th.items[i]);
    b.style.cssText += ';margin:2px;padding:2px 10px' + (!inBucket && sel === i ? ';border-color:#ffd166;color:#ffd166' : '');
    b.dataset.item = String(i); b.dataset.state = inBucket ? 'placed' : sel === i ? 'picked' : 'tray';
    return b;
  };
  const tray = mk('div', 'margin-bottom:8px;min-height:24px'); tray.dataset.tray = '1';
  th.items.forEach((_, i) => { if (!(i in th.place)) tray.appendChild(chip(i, false)); });
  if (!th.items.length) tray.appendChild(mk('span', 'opacity:.7', 'add things, tap one, then tap where it goes'));
  el.appendChild(tray);
  const grid = mk('div', quad ? 'display:grid;grid-template-columns:1fr 1fr;gap:6px' : 'display:grid;grid-template-columns:repeat(3,1fr);gap:6px');
  names.forEach((nm, b) => {
    const box = mk('div', 'border:1px solid rgba(255,255,255,.22);border-radius:10px;padding:6px 8px;min-height:64px;cursor:' + (sel !== undefined ? 'pointer' : 'default'));
    box.dataset.bucket = String(b);
    box.appendChild(mk('div', 'font-size:12px;opacity:.75;margin-bottom:3px', nm));
    th.items.forEach((_, i) => { if (th.place[i] === b) box.appendChild(chip(i, true)); });
    box.addEventListener('click', (e) => { e.stopPropagation(); if (sel === undefined) return; th.place = placeItem(th.place, sel, b, names.length); picked[th.id] = undefined; done(); });
    keepOut(box);
    grid.appendChild(box);
  });
  el.appendChild(grid);
  const bar = mk('div', 'margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center');
  bar.appendChild(adder('add a thing', addItem));
  if (sel !== undefined && th.items[sel] !== undefined) bar.appendChild(btn('delete ' + th.items[sel], () => { picked[th.id] = undefined; dropItem(sel); }));
  el.appendChild(bar);
  if (quad) el.appendChild(mk('div', 'margin-top:6px;font-size:12px;opacity:.6', 'axes: ' + (th.axes || ['Impact', 'Effort']).join(' vs ')));
  finish(th, stageApi, el);
}

function finish(th, stageApi, el) { stageApi.bindDrag(el, th); stageApi.stage.appendChild(el); }

/** put the card an ask names on the stage; returns its name or '' */
export function ask(lower, text, stageApi) {
  const p = parseCardAsk(text);
  if (!p) return '';
  const base = { title: p.title || '', items: p.items.slice() };
  if (p.kind === 'votes') base.counts = p.items.map(() => 0);
  if (p.kind === 'knockout') base.out = [];
  if (p.kind === 'pairwise') base.wins = {};
  if (p.kind === 'buckets') { base.mode = p.mode; base.place = {}; base.axes = p.axes; }
  if (p.kind === 'proscons') { base.pros = [{ text: '', w: 3 }]; base.cons = [{ text: '', w: 3 }]; delete base.items; }
  addThing(stageApi, KIND[p.kind], base);
  stageApi.save(); stageApi.render();
  return 'decide-cards';
}

export default {
  name: 'decide-cards',
  examples: [
    'ranked list of my movies', 'rank pizza, tacos, sushi', 'weighted pros and cons for moving to Berlin',
    'vote marks for pizza, tacos, sushi', 'vote on tea or coffee', 'eliminate until one: red, green, blue, pink',
    'pairwise compare pizza, tacos, sushi', '2x2 matrix for impact vs effort', 'must should could for the launch',
  ],
  nearMisses: [
    'ranked list of the best sci-fi movies', 'pros and cons of electric cars', 'who should I vote for', 'how to eliminate debt',
    'eliminate pests from my garden', 'what is a 2x2 matrix', 'what is moscow prioritisation', 'rank the planets by size',
    'compare iphone and pixel', 'flip a coin',
  ],
  parseCardAsk,
  match(lower, text) { return !!parseCardAsk(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'decide-cards' : 'none'; },
  stageKinds: {
    [KIND.rank]: { mount: mountRank }, [KIND.proscons]: { mount: mountProsCons }, [KIND.votes]: { mount: mountVotes },
    [KIND.knockout]: { mount: mountKnockout }, [KIND.pairwise]: { mount: mountPairwise }, [KIND.buckets]: { mount: mountBuckets },
  },
};
