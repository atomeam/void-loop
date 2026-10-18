/**
 * health-habits skill — small daily trackers on one stage card: "water tracker" (cups), "stretch timer", "mood tracker" (one tap),
 * "sleep hours log", "step note", "meds checklist: vitamin D, iron" (a checkbox day), "weekly habit grid for read, run, stretch"
 * (rows of days with a streak), "fasting timer 16:8" and "posture nudge every 30 minutes" (opt-in). Asked for by the owner
 * (2026-10-18, items 131 to 140; item 137 "habit streak" is the streak column here and the streak on each ring of skills/habit-ring.js).
 * Everything is kept in this browser with the stage; nothing is sent anywhere, and none of it is medical advice. The timers and the
 * nudge run while the page is open (no notifications, no background work).
 */
import { addThing, cardEl, keepOut, localDay } from '../lib/stage-pack.js';
import { TYPE_LABEL, MOODS, POSTURE_TIP, parseHealthAsk, lastDays, weekdayOf, prune, tapCup, streakOf, toggleDay, weekAverage, clampNum, clock, fastState, stretchPlan, stretchAt, nudgeDue } from '../lib/health-habits.js';

const btnCss = 'font:inherit;font-size:12px;padding:3px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer';
const inCss = 'font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:2px 6px;min-width:0';

function el(tag, css, text, attrs) {
  const n = document.createElement(tag);
  if (css) n.style.cssText = css;
  if (text != null) n.textContent = text;
  for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
  return n;
}
const button = (label, fn, aria) => { const b = el('button', btnCss, label, { type: 'button' }); if (aria) b.setAttribute('aria-label', aria); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return keepOut(b); };
const field = (css, attrs, onChange) => { const i = el('input', inCss + ';' + css, null, attrs); i.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter' && onChange) onChange(); }); return keepOut(i); };
const uid = () => Math.random().toString(36).slice(2, 8);

function mount(th, stageApi) {
  const card = cardEl(th, stageApi, 'health-habits');
  card.dataset.type = th.type;
  card.style.width = 'min(90vw,380px)';
  const today = localDay();
  const head = el('div', 'margin-bottom:6px'); head.append(el('b', '', TYPE_LABEL[th.type] || 'Tracker'));
  const sum = el('div', 'font-size:12px;opacity:.78;margin-top:2px'); sum.className = 'hh-sum'; head.appendChild(sum);
  const body = el('div', '');
  card.append(head, body);
  const save = () => stageApi.save();
  const week = lastDays(today, 7);

  const paints = {
    water() {
      th.goal = th.goal || 8; th.days = th.days || {};
      const count = Math.min(th.goal, +th.days[today] || 0);
      sum.textContent = count + ' of ' + th.goal + ' cups today' + (count >= th.goal ? ' · goal reached' : '');
      const cups = el('div', 'display:flex;flex-wrap:wrap;gap:6px;margin:6px 0');
      for (let i = 0; i < th.goal; i++) {
        const b = el('button', 'all:unset;cursor:pointer;width:30px;height:38px;border-radius:4px 4px 10px 10px;border:2px solid #8fb4ff;text-align:center;line-height:34px;font-size:14px;' + (i < count ? 'background:#8fb4ff;color:#102;' : ''), i < count ? '💧' : '', { type: 'button', 'data-cup': String(i + 1), 'aria-pressed': i < count ? 'true' : 'false', 'aria-label': 'cup ' + (i + 1) + (i < count ? ' filled' : ' empty') });
        b.addEventListener('click', (e) => { e.stopPropagation(); th.days[today] = tapCup(count, i, th.goal); th.days = prune(th.days); save(); paint(); });
        cups.appendChild(keepOut(b));
      }
      body.appendChild(cups);
      const strip = el('div', 'display:flex;gap:4px;font-size:11px;opacity:.8'); strip.className = 'hh-week';
      for (const d of week) strip.appendChild(el('span', 'flex:1;text-align:center', weekdayOf(d) + ' ' + (+th.days[d] || 0), { title: d }));
      body.appendChild(strip);
      const goal = el('div', 'margin-top:6px;font-size:12px;display:flex;gap:6px;align-items:center'); goal.append('goal', button('−', () => { th.goal = Math.max(1, th.goal - 1); save(); paint(); }, 'fewer cups in the goal'), String(th.goal), button('+', () => { th.goal = Math.min(16, th.goal + 1); save(); paint(); }, 'more cups in the goal'));
      body.appendChild(goal);
    },
    mood() {
      th.days = th.days || {};
      const cur = +th.days[today] || 0;
      sum.textContent = cur ? 'today: ' + MOODS[cur - 1].word : 'tap how you feel';
      const row = el('div', 'display:flex;gap:8px;margin:6px 0');
      MOODS.forEach((m, i) => {
        const b = el('button', 'all:unset;cursor:pointer;font-size:28px;padding:2px 4px;border-radius:10px;' + (cur === i + 1 ? 'background:rgba(143,180,255,.3);' : 'opacity:.75;'), m.face, { type: 'button', 'data-mood': String(i + 1), 'aria-pressed': cur === i + 1 ? 'true' : 'false', 'aria-label': m.word });
        b.addEventListener('click', (e) => { e.stopPropagation(); th.days[today] = cur === i + 1 ? 0 : i + 1; if (!th.days[today]) delete th.days[today]; th.days = prune(th.days); save(); paint(); });
        row.appendChild(keepOut(b));
      });
      body.appendChild(row);
      const strip = el('div', 'display:flex;gap:4px;font-size:11px'); strip.className = 'hh-week';
      for (const d of week) strip.appendChild(el('span', 'flex:1;text-align:center', weekdayOf(d) + ' ' + (th.days[d] ? MOODS[th.days[d] - 1].face : '–'), { title: d }));
      body.appendChild(strip);
    },
    sleep() {
      th.days = th.days || {};
      const avg = weekAverage(th.days, today);
      sum.textContent = (th.days[today] != null ? 'last night: ' + th.days[today] + ' h' : 'log last night') + (avg !== null ? ' · week average ' + avg + ' h' : '');
      const f = el('div', 'display:flex;gap:6px;margin:6px 0;align-items:center');
      const inp = field('width:70px', { type: 'number', min: '0', max: '24', step: '0.5', 'aria-label': 'hours slept last night', placeholder: 'hours' }, () => go());
      if (th.days[today] != null) inp.value = th.days[today];
      const go = () => { const v = clampNum(inp.value, 0, 24); if (v === null) return; th.days[today] = v; th.days = prune(th.days); save(); paint(); };
      f.append(inp, 'hours', button('Log', go));
      body.appendChild(f);
      for (const d of week.slice().reverse()) {
        const v = th.days[d];
        const r = el('div', 'display:flex;align-items:center;gap:6px;font-size:12px;padding:1px 0'); r.dataset.day = d;
        const bar = el('span', 'display:inline-block;height:8px;border-radius:4px;background:' + (v >= 7 ? '#78dc96' : '#8fb4ff') + ';width:' + (v ? Math.min(100, (v / 12) * 100) : 0) + '%');
        r.append(el('span', 'width:34px;opacity:.8', weekdayOf(d)), el('div', 'flex:1;background:rgba(255,255,255,.06);border-radius:4px', null), el('span', 'width:44px;text-align:right', v != null ? v + ' h' : '–'));
        r.children[1].appendChild(bar);
        body.appendChild(r);
      }
    },
    steps() {
      th.days = th.days || {};
      const t = th.days[today] || {};
      sum.textContent = t.n != null ? 'today: ' + t.n + ' steps' + (t.note ? ' · ' + t.note : '') : 'type what your phone or watch says';
      const f = el('div', 'display:flex;gap:6px;margin:6px 0;flex-wrap:wrap;align-items:center');
      const n = field('width:84px', { type: 'number', min: '0', max: '200000', 'aria-label': 'steps today', placeholder: 'steps' }, () => go());
      const note = field('flex:1;width:90px', { type: 'text', maxlength: '60', 'aria-label': 'step note', placeholder: 'note (walk to work)' }, () => go());
      if (t.n != null) n.value = t.n; if (t.note) note.value = t.note;
      const go = () => { const v = clampNum(n.value, 0, 200000); if (v === null) return; th.days[today] = { n: Math.round(v), note: note.value.slice(0, 60) }; th.days = prune(th.days); save(); paint(); };
      f.append(n, note, button('Save', go));
      body.appendChild(f);
      for (const d of week.slice().reverse()) {
        const v = th.days[d];
        const r = el('div', 'display:flex;gap:8px;font-size:12px;padding:1px 0'); r.dataset.day = d;
        r.append(el('span', 'width:34px;opacity:.8', weekdayOf(d)), el('span', 'width:60px', v ? String(v.n) : '–'), el('span', 'opacity:.75', v && v.note ? v.note : ''));
        body.appendChild(r);
      }
    },
    meds() {
      th.items = th.items || []; th.taken = th.taken || {};
      const got = new Set(th.taken[today] || []);
      sum.textContent = th.items.length ? got.size + ' of ' + th.items.length + ' taken today' : 'add what you take, then tick it off each day';
      for (const it of th.items) {
        const r = el('div', 'display:flex;align-items:center;gap:8px;padding:3px 0');
        const c = el('input', 'width:18px;height:18px;cursor:pointer', null, { type: 'checkbox', 'aria-label': 'taken ' + it.text }); c.checked = got.has(it.id);
        c.addEventListener('change', () => { const s = new Set(th.taken[today] || []); if (c.checked) s.add(it.id); else s.delete(it.id); th.taken[today] = [...s]; th.taken = prune(th.taken); save(); paint(); });
        r.append(keepOut(c), el('span', 'flex:1;' + (got.has(it.id) ? 'opacity:.6;text-decoration:line-through;' : ''), it.text), button('×', () => { th.items = th.items.filter((x) => x !== it); save(); paint(); }, 'remove ' + it.text));
        body.appendChild(r);
      }
      const f = el('div', 'display:flex;gap:6px;margin-top:6px');
      const add = () => { const v = name.value.replace(/\s+/g, ' ').trim().slice(0, 40); if (!v || th.items.length >= 12) return; th.items.push({ id: 'm' + uid(), text: v }); save(); paint(); const again = body.querySelector('input[aria-label="add med"]'); if (again) again.focus(); };
      const name = field('flex:1;width:100px', { type: 'text', maxlength: '40', 'aria-label': 'add med', placeholder: 'add one' }, add);
      f.append(name, button('Add', add)); body.appendChild(f);
      body.appendChild(el('div', 'font-size:11px;opacity:.6;margin-top:6px', 'A reminder sheet for you; it does not advise on doses.'));
    },
    habitgrid() {
      th.habits = th.habits || [];
      sum.textContent = th.habits.length ? 'the last 7 days · tap a day to mark it' : 'add a habit below';
      const tbl = el('table', 'border-collapse:collapse;font-size:12px;margin:4px 0');
      const hr = el('tr'); hr.appendChild(el('th', 'text-align:left;padding-right:8px', ''));
      for (const d of week) hr.appendChild(el('th', 'padding:0 2px;font-weight:400;opacity:.8', weekdayOf(d), { title: d }));
      hr.appendChild(el('th', 'padding-left:8px;font-weight:400;opacity:.8', 'streak')); tbl.appendChild(hr);
      for (const h of th.habits) {
        const tr = el('tr');
        tr.appendChild(el('td', 'padding:2px 8px 2px 0', h.name));
        for (const d of week) {
          const on = (h.days || []).includes(d);
          const td = el('td', 'padding:2px');
          const b = el('button', 'all:unset;cursor:pointer;display:block;width:24px;height:24px;border-radius:6px;text-align:center;line-height:24px;' + (on ? 'background:#78dc96;color:#102;' : 'border:1px solid rgba(255,255,255,.25);'), on ? '✓' : '', { type: 'button', 'data-habit': h.name, 'data-day': d, 'aria-pressed': on ? 'true' : 'false', 'aria-label': h.name + ' ' + d + (on ? ' done' : ' not done') });
          b.addEventListener('click', (e) => { e.stopPropagation(); h.days = toggleDay(h.days, d); save(); paint(); });
          td.appendChild(keepOut(b)); tr.appendChild(td);
        }
        const st = streakOf(h.days, today);
        const stc = el('td', 'padding-left:8px;white-space:nowrap', st + (st === 1 ? ' day' : ' days')); stc.className = 'hh-streak'; tr.appendChild(stc);
        tr.appendChild(el('td', 'padding-left:4px')).appendChild(button('×', () => { th.habits = th.habits.filter((x) => x !== h); save(); paint(); }, 'remove ' + h.name));
        tbl.appendChild(tr);
      }
      body.appendChild(tbl);
      const f = el('div', 'display:flex;gap:6px;margin-top:4px');
      const add = () => { const v = name.value.replace(/\s+/g, ' ').trim().slice(0, 30); if (!v || th.habits.length >= 10 || th.habits.some((x) => x.name.toLowerCase() === v.toLowerCase())) return; th.habits.push({ name: v, days: [] }); save(); paint(); const again = body.querySelector('input[aria-label="add habit"]'); if (again) again.focus(); };
      const name = field('flex:1;width:100px', { type: 'text', maxlength: '30', 'aria-label': 'add habit', placeholder: 'add a habit' }, add);
      f.append(name, button('Add', add)); body.appendChild(f);
    },
    stretch() {
      const plan = stretchPlan(th.secs);
      const total = plan.reduce((a, s) => a + s.secs, 0);
      let elapsed = 0, running = false, last = 0, timer = null;
      const name = el('div', 'font-size:15px;font-weight:600;margin:6px 0'); name.className = 'hh-now';
      const left = el('div', 'font-size:28px;font-variant-numeric:tabular-nums'); left.className = 'hh-left';
      const bar = el('div', 'height:6px;border-radius:3px;background:rgba(255,255,255,.1);margin:8px 0;overflow:hidden'); const fill = el('div', 'height:100%;width:0;background:#78dc96'); bar.appendChild(fill);
      const go = button('Start', () => toggle());
      const reset = button('Reset', () => { stop(); elapsed = 0; draw(); });
      const draw = () => {
        const at = stretchAt(plan, elapsed);
        name.textContent = at.done ? 'Done. Nice stretch.' : plan[at.index].name;
        left.textContent = at.done ? '0:00' : clock(at.left * 1000);
        sum.textContent = at.done ? plan.length + ' stretches · ' + clock(total * 1000) : 'stretch ' + (at.index + 1) + ' of ' + plan.length + ' · ' + th.secs + ' s each';
        fill.style.width = Math.min(100, (elapsed / total) * 100) + '%';
        go.textContent = running ? 'Pause' : at.done ? 'Again' : elapsed > 0 ? 'Resume' : 'Start';
        card.dataset.step = String(at.done ? plan.length : at.index);
      };
      const stop = () => { running = false; if (timer) clearInterval(timer); timer = null; };
      const toggle = () => {
        if (running) { stop(); draw(); return; }
        if (stretchAt(plan, elapsed).done) elapsed = 0;
        running = true; last = Date.now();
        timer = setInterval(() => {
          if (!card.isConnected) { stop(); return; }
          const now = Date.now(); elapsed += (now - last) / 1000; last = now;
          if (stretchAt(plan, elapsed).done) { elapsed = total; stop(); }
          draw();
        }, 250);
        draw();
      };
      body.append(name, left, bar, el('div', 'display:flex;gap:6px', null));
      body.lastChild.append(go, reset);
      draw();
    },
    fasting() {
      th.hours = th.hours || 16;
      const state = el('div', 'font-size:26px;font-variant-numeric:tabular-nums;margin:6px 0'); state.className = 'hh-left';
      const info = el('div', 'font-size:12px;opacity:.8'); info.className = 'hh-info';
      const bar = el('div', 'height:6px;border-radius:3px;background:rgba(255,255,255,.1);margin:8px 0;overflow:hidden'); const fill = el('div', 'height:100%;width:0;background:#8fb4ff'); bar.appendChild(fill);
      const f = el('div', 'display:flex;gap:6px;align-items:center;flex-wrap:wrap');
      const hours = field('width:56px', { type: 'number', min: '1', max: '48', 'aria-label': 'fasting window hours', value: String(th.hours) });
      hours.addEventListener('change', () => { th.hours = Math.max(1, Math.min(48, Math.round(+hours.value) || 16)); hours.value = th.hours; save(); draw(); });
      const toggle = button(th.start ? 'End fast' : 'Start fast', () => { th.start = th.start ? 0 : Date.now(); save(); paint(); });
      f.append('window', hours, 'hours', toggle);
      let timer = null;
      const draw = () => {
        const s = fastState(th.start, Date.now(), th.hours);
        if (!s) { state.textContent = th.hours + ':00'; info.textContent = 'not started · a simple timer, not medical advice'; fill.style.width = '0'; sum.textContent = th.hours + ' hour window'; card.dataset.fast = 'idle'; return; }
        state.textContent = s.done ? 'Window complete' : clock(s.remaining) + ' left';
        info.textContent = 'fasting for ' + clock(s.elapsed) + ' · ends ' + new Date(s.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        fill.style.width = s.pct + '%'; sum.textContent = s.pct + '% of ' + th.hours + ' hours'; card.dataset.fast = s.done ? 'done' : 'running';
      };
      body.append(state, bar, info, el('div', 'height:6px'), f);
      draw();
      timer = setInterval(() => { if (!card.isConnected) { clearInterval(timer); return; } draw(); }, 1000);
    },
    posture() {
      th.everySec = th.everySec || 1800;
      let nextAt = 0, timer = null, due = false;
      const msg = el('div', 'font-size:14px;margin:6px 0;min-height:2.6em'); msg.className = 'hh-msg';
      const f = el('div', 'display:flex;gap:6px;align-items:center;flex-wrap:wrap');
      const every = field('width:56px', { type: 'number', min: '1', max: '240', 'aria-label': 'nudge every minutes', value: String(Math.round(th.everySec / 60)) });
      every.addEventListener('change', () => { th.everySec = Math.max(1, Math.min(240, Math.round(+every.value) || 30)) * 60; save(); });
      const toggle = button(th.on ? 'Turn off' : 'Turn on', () => { th.on = !th.on; save(); paint(); });
      const done = button('Done, sat tall', () => { due = false; nextAt = Date.now() + th.everySec * 1000; draw(); });
      f.append('every', every, 'min', toggle, done);
      const draw = () => {
        card.dataset.nudge = !th.on ? 'off' : due ? 'due' : 'waiting';
        card.style.outline = due ? '2px solid #ffd166' : '';
        done.style.display = due ? '' : 'none';
        if (!th.on) { msg.textContent = 'Off. Turn it on for a nudge while this page is open.'; sum.textContent = 'opt-in · nothing runs until you turn it on'; return; }
        sum.textContent = due ? 'time for a posture break' : 'next nudge in ' + clock(Math.max(0, nextAt - Date.now()));
        msg.textContent = due ? POSTURE_TIP : 'Working. I will nudge you here.';
      };
      body.append(msg, f);
      if (th.on) {
        nextAt = Date.now() + th.everySec * 1000;
        timer = setInterval(() => { if (!card.isConnected) { clearInterval(timer); return; } if (!due && nudgeDue(nextAt, Date.now())) due = true; draw(); }, 1000);
      }
      draw();
    },
  };

  function paint() {
    body.textContent = '';
    (paints[th.type] || (() => { sum.textContent = 'unknown tracker'; }))();
  }
  paint();
  stageApi.bindDrag(card, th);
  stageApi.stage.appendChild(card);
}

/** the stage kind's ask hook: put the tracker an ask names on the stage; the skill's name, or '' */
export function ask(lower, text, stageApi) {
  const p = parseHealthAsk(text);
  if (!p) return '';
  addThing(stageApi, 'health', p);
  stageApi.save(); stageApi.render();
  return 'health-habits';
}

export default {
  name: 'health-habits',
  examples: ['water tracker', 'water cups tracker 10 cups', 'stretch timer', 'mood tracker', 'sleep hours log', 'step note', 'meds checklist: vitamin D, iron',
    'weekly habit grid for read, run, stretch', 'fasting timer 16:8', 'posture nudge every 30 minutes'],
  nearMisses: ['water the plants', 'what is the water cycle', 'sleep calculator', 'how much sleep do I need', 'what is a mood board', 'habit ring for write, walk, sleep', 'how to start fasting', 'stretch goals for my team', 'set a timer for 5 minutes'],
  parseHealthAsk,
  match(lower, text) { return !!parseHealthAsk(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'health-habits' : 'none'; },
  stageKinds: { health: { mount, ask } },
};
