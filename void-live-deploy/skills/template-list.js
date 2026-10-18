/**
 * template-list skill — one stage card for the lists a home runs on, each with its own shape: "packing list for a beach trip",
 * "travel checklist for Tokyo", "meal idea slots", "chore wheel for dishes, trash with Sam and Alex", "bill due list: rent 2026-11-01",
 * "warranty expiry note: laptop 2027-03-01", "plant watering: fern every 7 days", "package tracking note: headphones arriving friday",
 * "guest list for the party: Sam, Alex, Jo". Asked for by the owner (2026-10-18, items 141 to 150; "shopping list" was already
 * skills/list.js). Manual notes kept on this device with the stage: nothing is sent, no money moves, no carrier is called.
 */
import { addThing, cardEl, keepOut, localDay } from '../lib/stage-pack.js';
import { TPL_LABEL, DATED, MAX_ITEMS, parseTemplateAsk, mealIdea, daysUntil, dueLabel, sortDated, plantDue, assignee, rsvpNext, rsvpCounts, isDay, MEAL_SLOTS } from '../lib/template-list.js';

const btnCss = 'font:inherit;font-size:12px;padding:2px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer';
const inCss = 'font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:2px 6px;min-width:0';
const uid = () => Math.random().toString(36).slice(2, 9);

function el(tag, css, text, attrs) {
  const n = document.createElement(tag);
  if (css) n.style.cssText = css;
  if (text != null) n.textContent = text;
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
  return n;
}
const button = (label, fn, aria) => { const b = el('button', btnCss, label, { type: 'button' }); if (aria) b.setAttribute('aria-label', aria); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return keepOut(b); };
const row = () => el('div', 'display:flex;align-items:center;gap:8px;padding:3px 0;flex-wrap:wrap');

function mount(th, stageApi) {
  const card = cardEl(th, stageApi, 'template-list');
  th.items = Array.isArray(th.items) ? th.items : [];
  card.dataset.tpl = th.tpl;
  card.style.width = 'min(90vw,400px)';
  const today = localDay();
  const head = el('div', 'margin-bottom:6px');
  const title = el('b', '', TPL_LABEL[th.tpl] || 'List'); head.appendChild(title);
  if (th.title) head.appendChild(document.createTextNode(' · ' + th.title));
  const sum = el('div', 'font-size:12px;opacity:.75;margin-top:2px'); sum.className = 'tl-sum'; head.appendChild(sum);
  const body = el('div', '');
  card.append(head, body);
  const save = () => stageApi.save();
  const remove = (it) => { th.items = th.items.filter((x) => x !== it); save(); paint(); };
  const rm = (it) => button('×', () => remove(it), 'remove ' + it.text);

  function addForm(withDate, withEvery) {
    const f = row(); f.style.marginTop = '6px';
    const name = el('input', inCss + ';flex:1;width:120px', null, { type: 'text', 'aria-label': 'add item', placeholder: withEvery ? 'plant' : 'add item', maxlength: '80' });
    const date = withDate ? el('input', inCss, null, { type: 'date', 'aria-label': 'date' }) : null;
    const every = withEvery ? el('input', inCss + ';width:56px', null, { type: 'number', min: '1', max: '365', value: '7', 'aria-label': 'water every days' }) : null;
    const go = () => {
      const text = name.value.replace(/\s+/g, ' ').trim().slice(0, 80);
      if (!text || th.items.length >= MAX_ITEMS) return;
      const it = { id: uid(), text };
      if (th.tpl === 'plants') { it.every = Math.max(1, Math.min(365, +every.value || 7)); it.last = ''; }
      else if (th.tpl === 'guests') { it.rsvp = ''; it.plus = 0; }
      else { it.done = false; if (withDate) it.date = date.value && isDay(date.value) ? date.value : ''; }
      th.items.push(it); save(); paint();
      const again = body.querySelector('input[aria-label="add item"]'); if (again) again.focus();
    };
    name.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go(); });
    for (const n of [name, date, every]) if (n) keepOut(n);
    f.append(name); if (date) f.append(date); if (every) f.append(every, el('span', 'font-size:12px;opacity:.7', 'days'));
    f.append(button('Add', go));
    return f;
  }
  const tick = (it, label, onChange) => {
    const c = el('input', 'width:18px;height:18px;cursor:pointer', null, { type: 'checkbox', 'aria-label': label });
    c.checked = !!it.done; c.addEventListener('change', () => { it.done = c.checked; save(); onChange ? onChange() : paint(); }); return keepOut(c);
  };
  const label = (it, extra) => { const s = el('span', 'flex:1;min-width:80px;' + (it.done ? 'text-decoration:line-through;opacity:.6;' : '') + (extra || ''), it.text); return s; };

  function paint() {
    body.textContent = '';
    const items = th.items;
    if (th.tpl === 'packing' || th.tpl === 'travel') {
      const done = items.filter((i) => i.done).length;
      sum.textContent = done + ' of ' + items.length + (th.tpl === 'packing' ? ' packed' : ' done');
      for (const it of items) { const r = row(); r.append(tick(it, 'tick ' + it.text), label(it), rm(it)); body.appendChild(r); }
      body.appendChild(addForm(false, false));
      body.appendChild(button('Untick all', () => { items.forEach((i) => { i.done = false; }); save(); paint(); }));
    } else if (th.tpl === 'meal') {
      sum.textContent = items.filter((i) => i.idea).length + ' of ' + items.length + ' slots filled';
      for (const it of items) {
        const r = row();
        const inp = el('input', inCss + ';flex:1;width:120px', null, { type: 'text', 'aria-label': it.text + ' idea', placeholder: 'idea', maxlength: '80' });
        inp.value = it.idea || '';
        inp.addEventListener('input', () => { it.idea = inp.value.slice(0, 80); save(); sum.textContent = items.filter((i) => i.idea).length + ' of ' + items.length + ' slots filled'; });
        inp.addEventListener('keydown', (e) => e.stopPropagation());
        keepOut(inp);
        r.append(el('span', 'width:68px;font-size:13px;opacity:.85', it.text), inp, button('Idea', () => { it.idea = mealIdea(MEAL_SLOTS.includes(it.text) ? it.text : 'Dinner', Math.random(), it.idea); save(); paint(); }, 'idea for ' + it.text));
        body.appendChild(r);
      }
    } else if (th.tpl === 'chores') {
      const people = Array.isArray(th.people) && th.people.length ? th.people : ['Me'];
      const left = items.filter((i) => !i.done).length;
      sum.textContent = left ? left + ' left this turn' : 'all done this turn';
      items.forEach((it, i) => { const r = row(); const who = el('b', 'font-size:13px', assignee(people, th.offset || 0, i)); who.className = 'tl-who'; r.append(tick(it, 'tick ' + it.text), label(it), who, rm(it)); body.appendChild(r); });
      const bar = row(); bar.style.marginTop = '6px';
      bar.append(button('Rotate', () => { th.offset = ((th.offset || 0) + 1) % Math.max(1, people.length); items.forEach((i) => { i.done = false; }); save(); paint(); }));
      const ppl = el('input', inCss + ';flex:1;width:120px', null, { type: 'text', 'aria-label': 'people', placeholder: 'people, comma separated' });
      ppl.value = people.join(', ');
      ppl.addEventListener('input', () => { const p = ppl.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 12); th.people = p.length ? p : ['Me']; save(); });
      ppl.addEventListener('change', paint);
      ppl.addEventListener('keydown', (e) => e.stopPropagation()); keepOut(ppl);
      bar.append(ppl); body.appendChild(bar);
      body.appendChild(addForm(false, false));
    } else if (DATED.has(th.tpl)) {
      const hasTick = th.tpl !== 'warranty', past = th.tpl === 'warranty' ? 'expired' : 'overdue';
      const open = items.filter((i) => !i.done).length;
      sum.textContent = items.length ? (th.tpl === 'warranty' ? items.length + ' noted' : open + ' open of ' + items.length) : 'nothing yet: add one below';
      for (const it of sortDated(items)) {
        const r = row();
        const d = it.date && isDay(it.date) ? daysUntil(it.date, today) : null;
        const when = el('span', 'font-size:12px;' + (d !== null && d < 0 && !it.done ? 'color:#ff8a8a' : 'opacity:.8'), d === null ? 'no date' : it.date + ' · ' + dueLabel(d, past));
        when.className = 'tl-when';
        if (hasTick) r.append(tick(it, 'tick ' + it.text)); r.append(label(it), when, rm(it));
        body.appendChild(r);
      }
      body.appendChild(addForm(true, false));
    } else if (th.tpl === 'plants') {
      const due = items.filter((i) => plantDue(i, today).days <= 0).length;
      sum.textContent = items.length ? (due ? due + ' to water today' : 'all watered') : 'nothing yet: add one below';
      for (const it of items) {
        const { days } = plantDue(it, today);
        const r = row();
        const every = el('input', inCss + ';width:50px', null, { type: 'number', min: '1', max: '365', 'aria-label': 'water ' + it.text + ' every days' });
        every.value = String(it.every || 7);
        every.addEventListener('change', () => { it.every = Math.max(1, Math.min(365, +every.value || 7)); save(); paint(); });
        every.addEventListener('keydown', (e) => e.stopPropagation()); keepOut(every);
        const when = el('span', 'font-size:12px;' + (days <= 0 ? 'color:#ffd166' : 'opacity:.8'), days <= 0 ? (days === 0 ? 'water today' : 'water now · ' + dueLabel(days)) : 'next ' + dueLabel(days));
        when.className = 'tl-when';
        r.append(label(it), el('span', 'font-size:12px;opacity:.7', 'every'), every, el('span', 'font-size:12px;opacity:.7', 'd'), when, button('Watered', () => { it.last = today; save(); paint(); }, 'watered ' + it.text), rm(it));
        body.appendChild(r);
      }
      body.appendChild(addForm(false, true));
    } else if (th.tpl === 'guests') {
      const c = rsvpCounts(items);
      sum.textContent = c.yes + ' yes · ' + c.maybe + ' maybe · ' + c.no + ' no · ' + c.waiting + ' waiting · ' + c.heads + ' coming';
      for (const it of items) {
        const r = row();
        const rs = button(it.rsvp || '?', () => { it.rsvp = rsvpNext(it.rsvp); save(); paint(); }, 'rsvp of ' + it.text + ': ' + (it.rsvp || 'waiting'));
        rs.dataset.rsvp = it.rsvp || '';
        rs.style.minWidth = '52px'; rs.style.background = it.rsvp === 'yes' ? 'rgba(120,220,150,.25)' : it.rsvp === 'no' ? 'rgba(255,138,138,.2)' : it.rsvp === 'maybe' ? 'rgba(255,209,102,.2)' : 'transparent';
        const plus = el('input', inCss + ';width:44px', null, { type: 'number', min: '0', max: '9', 'aria-label': 'plus ones of ' + it.text });
        plus.value = String(it.plus || 0);
        plus.addEventListener('change', () => { it.plus = Math.max(0, Math.min(9, +plus.value || 0)); save(); paint(); });
        plus.addEventListener('keydown', (e) => e.stopPropagation()); keepOut(plus);
        r.append(label(it), el('span', 'font-size:12px;opacity:.7', '+'), plus, rs, rm(it));
        body.appendChild(r);
      }
      body.appendChild(addForm(false, false));
    }
  }
  paint();
  stageApi.bindDrag(card, th);
  stageApi.stage.appendChild(card);
}

/** the stage kind's ask hook: put the template list an ask names on the stage; the skill's name, or '' */
export function ask(lower, text, stageApi) {
  const p = parseTemplateAsk(text, localDay());
  if (!p) return '';
  addThing(stageApi, 'tlist', p);
  stageApi.save(); stageApi.render();
  return 'template-list';
}

export default {
  name: 'template-list',
  examples: ['packing list for a beach trip', 'packing list template', 'travel checklist for Tokyo', 'meal idea slots', 'chore wheel for dishes, trash, laundry with Sam and Alex',
    'bill due list: rent 2026-11-01, internet nov 15', 'warranty expiry note: laptop 2027-03-01', 'plant watering: fern every 7 days, cactus every 3 weeks',
    'package tracking note: headphones arriving friday', 'guest list for the party: Sam, Alex, Jo'],
  nearMisses: ['track my package', 'what is a warranty', 'how often should I water a cactus', 'add milk to my list', 'who should I invite to my wedding', 'packing tips for flying', 'pay my bills'],
  parseTemplateAsk,
  match(lower, text) { return !!parseTemplateAsk(text || lower, localDay()); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'template-list' : 'none'; },
  stageKinds: { tlist: { mount, ask } },
};
