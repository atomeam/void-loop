/**
 * timer skill — countdowns on the stage: "set a timer for 5 minutes" (starts at once, like a phone's), "make a timer"
 * (waits), "another timer for 2 minutes", "pause / start / reset the timer", "make the timer bigger", "remove the timer",
 * "set an alarm for 7am", "remind me to stretch in 20 minutes", "days until christmas". A 3D hourglass stands beside it
 * (skills/mini/timer.js); at 0:00 it says "timer done" and hands that down its arrows (stageApi.emit, frontier #24).
 * Moved out of void.html in cleanup step 6. The page asks its three hooks where its timer code always ran (`askAt`):
 * `ask` (create), `askAction` (start, pause, reset; before the early skill loop, so a bare "reset" reaches a timer first)
 * and `askRemove` (after it). Its face (ring, m:ss, a state word) stays the page's shared timerFace, which the five-minute
 * challenge draws with too.
 */

const NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, half: 0.5,
};

function durationNumber(value) {
  const token = String(value || '').toLowerCase();
  if (/^\d+(?:\.\d+)?$/.test(token)) return Number(token);
  return Object.prototype.hasOwnProperty.call(NUMBER_WORDS, token) ? NUMBER_WORDS[token] : 0;
}

/** "set an alarm for 7am", "wake me up at 6:30": ms until the next such time (no am/pm: the next of the two), or 0. Pure. */
export function alarmMs(lower, now = new Date()) {
  const m = String(lower || '').trim().replace(/[?.!]+$/, '').match(/^(?:please\s+)?(?:(?:set|make|start)\s+(?:an?\s+|my\s+)?alarm|alarm|wake\s+me(?:\s+up)?)\s+(?:for|at)\s+(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?(?:\s+(?:tomorrow|tonight|today))?(?:\s+please)?$/);
  if (!m) return 0;
  let h = +m[1]; const min = +(m[2] || 0), ap = (m[3] || '').replace(/\./g, '');
  if (h > 23 || min > 59 || (ap && (h < 1 || h > 12))) return 0;
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  const at = new Date(now); at.setSeconds(0, 0); at.setHours(h, min);
  const step = ap || h > 12 || h === 0 ? 24 : 12;
  while (at <= now) at.setHours(at.getHours() + step);
  if (/\btomorrow\b/.test(lower) && at.getDate() === now.getDate()) at.setDate(at.getDate() + 1);
  return at - now;
}

/** "christmas", "december 25", "25 dec": the next such day (ms since the epoch), or null. */
export function parseTargetDate(text) {
  const lower = text.toLowerCase().trim();
  const now = new Date();
  const year = now.getFullYear();
  const monthMap = {
    january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6,
    august: 7, aug: 7, september: 8, sep: 8, sept: 8, october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
  };
  const fixedDates = {
    christmas: new Date(year, 11, 25),
    xmas: new Date(year, 11, 25),
    'new year': new Date(year + 1, 0, 1),
    'new years': new Date(year + 1, 0, 1),
    halloween: new Date(year, 9, 31),
    thanksgiving: (() => { const d = new Date(year, 10, 1); while (d.getDay() !== 4) d.setDate(d.getDate() + 1); d.setDate(d.getDate() + 21); return d; })(),
  };
  if (fixedDates[lower]) return fixedDates[lower].getTime();
  const m = lower.match(/^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*$/i)
    || lower.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})$/i);
  if (m) {
    const day = parseInt(m[1].match(/\d+/) ? m[1] : m[2], 10);
    const month = monthMap[m[1].match(/\d+/) ? m[2].toLowerCase() : m[1].toLowerCase()];
    if (month !== undefined) {
      const target = new Date(year, month, day);
      if (target < now) target.setFullYear(year + 1);
      return target.getTime();
    }
  }
  return null;
}

/** the length an ask names, in ms: an alarm, "days until …", "1 hour 30 minutes", "half an hour", a bare number of
 *  minutes; 0 when none. */
export function parseDuration(text) {
  const alarm = alarmMs(text);
  if (alarm) return alarm;
  const lower = (text || '').toLowerCase().replace(/[-‐‑‒–—]/g, ' ').replace(/\bhalf\s+an?\s+(?:hours?|hrs?|h)\b/g, '30 minutes');
  const daysUntil = lower.match(/(?:how\s+many\s+)?days?\s+until\s+(.+)$/i);
  if (daysUntil) {
    const target = parseTargetDate(daysUntil[1].trim());
    if (target) {
      const diff = target - Date.now();
      if (diff > 0) return diff;
    }
  }
  const pattern = /(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|half)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)(?=\b|\d)/g;
  let ms = 0, match;
  while ((match = pattern.exec(lower)) !== null) {
    const amount = durationNumber(match[1]), unit = match[2].charAt(0);
    if (unit === 'h') ms += amount * 3600000;
    else if (unit === 'm') ms += amount * 60000;
    else if (unit === 's') ms += amount * 1000;
  }
  if (ms === 0) {
    const bare = lower.match(/(\d+(?:\.\d+)?)\s*$/);
    if (bare) ms = Number(bare[1]) * 60000;
  }
  return ms;
}

/** the whole ask is a length ("5 minutes", "start 1 hour 30 min", "days until christmas"). Pure. */
export function isDurationRequest(lower) {
  const normalized = lower.replace(/[-‐‑‒–—]/g, ' ').replace(/\bhalf\s+an?\s+(?:hours?|hrs?|h)\b/g, '30 minutes');
  if (/(?:how\s+many\s+)?days?\s+until\s+.+/i.test(normalized)) return true;
  const number = '(?:\\d+(?:\\.\\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)';
  const unit = '(?:hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)';
  const duration = number + '\\s*' + unit + '(?:\\s*' + number + '\\s*' + unit + ')*';
  return new RegExp('^(?:please\\s+)?(?:(?:start|begin|go|run|set)\\s+)?(?:(?:a|an|the)\\s+)?(?:for\\s+)?' + duration + '(?:\\s+please)?[.!]?$').test(normalized);
}

/** the ask makes a timer. */
export function wantsCreate(lower) {
  const mentionsTimer = /\b(timers?|countdowns?|pomodoros?)\b/.test(lower);
  const duration = parseDuration(lower);
  if (mentionsTimer && /\b(remove|delete|get\s+rid\s+of|hide|clear|cancel|dismiss)\b/.test(lower)) return false;
  if (mentionsTimer && /\b(pause|stop|hold|wait|freeze|suspend)\b/.test(lower)) return false;
  if (mentionsTimer && duration === 0 && (/\b(start|begin|go|resume|continue|run|launch|activate|reset|restart|redo)\b/.test(lower) || /\bstart\s+over\b/.test(lower))) return false;
  if (duration > 0 && (mentionsTimer || isDurationRequest(lower))) return true;
  if (alarmMs(lower)) return true;
  if (duration > 0 && /^(?:please\s+)?(?:remind|wake|ping|alert|buzz)\s+me\b.*\bin\s+\S+\s*(?:minutes?|mins?|hours?|hrs?|seconds?|secs?)\b/.test(lower)) return true; // "remind me to stretch in 20 minutes"
  if (/^(?:an?\s+)?(?:timer|countdown)(?:\s+please)?\s*[.!]?\s*$/.test(lower)) return true;
  if (/\b(make|add|create|set|start|spawn|put|place|drop|show|open|give\s+me|i\s+need|i'?d\s+like)\b.*\b(timer|countdown)\b/.test(lower)) return true;
  if (/\b(timer|countdown)\b.*\b(please|for|here|on\s+(the\s+)?(stage|screen|page))\b/.test(lower)) return true;
  if (/(?:how\s+many\s+)?days?\s+until\s+/.test(lower)) return true;
  return false;
}

/** "another timer", "a new countdown": a second one rather than the picked one. Pure. */
export const wantsFresh = (lower) => /\b(add|make|create|put|start|set|give\s+me|new|another)\b[^.]*?\b(a|an|another|new|one\s+more|second)\s+(?:\w+\s+){0,3}?(sticky|stickies|note|timer|countdown)\b/.test(lower)
  || /\b(another|one\s+more|second|new)\s+(sticky|note|timer|countdown)\b/.test(lower);

const timers = (stageApi) => Object.values(stageApi.things()).filter((t) => t && t.kind === 'timer');
const pickedTimer = (stageApi) => { const sel = stageApi.things()[stageApi.selected()]; return sel && sel.kind === 'timer' ? sel : null; };

/** 'start' | 'pause' | 'reset' when the ask works a timer (named, or a bare verb while one is picked or the only thing), or null */
export function wantsAction(lower, stageApi) {
  const selected = stageApi.things()[stageApi.selected()];
  const timerSelected = selected && selected.kind === 'timer';
  const hasTimer = timers(stageApi).length > 0;
  const mentionsTimer = /\b(timers?|countdowns?)\b/.test(lower);
  let action = null;
  if (/\b(reset|restart|redo)\b/.test(lower) || /\bstart\s+over\b/.test(lower)) action = 'reset';
  else if (/\b(pause|stop|hold|wait|freeze|suspend)\b/.test(lower)) action = 'pause';
  else if (/\b(start|go|resume|continue|run|launch|activate)\b/.test(lower)) action = 'start';
  if (mentionsTimer && action) return action;
  if (!timerSelected && (selected || !hasTimer)) return null;
  const command = lower.replace(/^\s*(?:please\s+)?(?:can\s+you|could\s+you|would\s+you)\s+/, '').replace(/\s+please\s*$/, '').trim();
  const verbs = action === 'start' ? 'start|go|resume|continue|run|launch|activate' : action === 'pause' ? 'pause|stop|hold|wait|freeze|suspend' : 'reset|restart|redo|start\\s+over';
  if (action && new RegExp('^(?:' + verbs + ')(?:\\s+(?:it|this))?[.!]?$').test(command)) return action;
  return null;
}

export function wantsRemove(lower, stageApi) {
  const selected = stageApi.things()[stageApi.selected()];
  const timerSelected = selected && selected.kind === 'timer';
  const hasTimer = timers(stageApi).length > 0;
  if (/\b(remove|delete|get\s+rid\s+of|hide|clear|cancel|dismiss)\b/.test(lower) && /\b(timers?|countdowns?)\b/.test(lower)) return true;
  if (/\b(timers?|countdowns?)\b.*\b(away|gone)\b/.test(lower)) return true;
  return !!((timerSelected || (!selected && hasTimer)) && /^(remove|delete|get\s+rid\s+of|hide|clear|cancel|dismiss)(\s+(it|this))?\s*[.!]?\s*$/.test(lower));
}

const DUR = '(?:\\d+(?:\\.\\d+)?|one|two|three|four|five|ten|fifteen|twenty|thirty|forty|forty\\s+five|sixty)\\s*(?:-\\s*)?(?:seconds?|secs?|minutes?|mins?|hours?|hrs?)';
/** the plain asks the skill takes before the page's own parser: a timer by itself or with a length ("set a timer for 5
 *  minutes", "a 2 second timer", "start a 10 minute countdown"). Anything else (alarms, reminders, "days until …", pausing,
 *  moving, connecting) goes on to the page and the other skills, as before. Pure. */
export const plainTimer = (lower) => new RegExp('^(?:please\\s+)?(?:(?:set|start|make|give\\s+me)\\s+)?(?:me\\s+)?(?:an?\\s+)?(?:new\\s+)?(?:(?:' + DUR + ')\\s+)?(?:timer|countdown)(?:\\s+for\\s+' + DUR + ')?(?:\\s+please)?\\s*[.!]?$').test(lower);

/** the picked timer, or the first one, or a new one (fresh: always a new one), set to durationMs and stopped; it is picked */
export function ensure(stageApi, durationMs = 60000, fresh = false) {
  let t = fresh ? null : (pickedTimer(stageApi) || timers(stageApi)[0] || null);
  if (!t) {
    const st = stageApi.stage, n = timers(stageApi).length, bx = Math.max(40, (st.clientWidth || 800) / 2 - 60), by = Math.max(40, (st.clientHeight || 600) / 2 - 40);
    t = { id: 'timer_' + Math.random().toString(36).slice(2, 9), kind: 'timer',
      x: Math.min(Math.max(20, (st.clientWidth || 800) - 220), bx + n * 28), y: Math.min(Math.max(20, (st.clientHeight || 600) - 120), by + n * 28),
      size: 40, color: '#e8e8e8', duration: durationMs, remaining: durationMs, running: false, startedAt: 0 };
    stageApi.things()[t.id] = t;
  } else {
    t.duration = durationMs; t.remaining = durationMs; t.running = false; t.startedAt = 0;
  }
  stageApi.select(t.id);
  return t;
}

/** its own size words ("make the timer bigger", "tiny"), asked by the page's shared targeting */
export function alter(th, lower) {
  let ok = false;
  if (/\b(bigger|larger|increase|grow|enlarge)\b/.test(lower)) { th.size = Math.min(200, (th.size || 40) + 16); ok = true; }
  if (/\b(smaller|tinier|decrease|shrink)\b/.test(lower)) { th.size = Math.max(16, (th.size || 40) - 16); ok = true; }
  if (/\b(huge|giant|enormous|massive)\b/.test(lower)) { th.size = 80; ok = true; }
  if (/\b(tiny|mini|petite)\b/.test(lower)) { th.size = 20; ok = true; }
  if (/\b(big|large)\b/.test(lower) && !/\bbigger\b|\blarger\b/.test(lower)) { th.size = Math.max(th.size || 40, 64); ok = true; }
  if (/\b(small|little)\b/.test(lower) && !/\bsmaller\b/.test(lower)) { th.size = Math.min(th.size || 40, 24); ok = true; }
  return ok;
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing timer';
  el.dataset.id = th.id;
  el.style.left = th.x + 'px';
  el.style.top = th.y + 'px';
  el.style.fontSize = (th.size || 40) + 'px';
  el.style.color = th.color || '#e8e8e8';
  el.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';

  const remaining = th.running ? Math.max(0, th.remaining - (Date.now() - th.startedAt)) : th.remaining;
  const total = th.duration;
  const face = stageApi.timerFace(el);
  face(remaining, total, th.running ? 'running' : (remaining <= 0 ? 'done' : 'paused'));

  if (th.running) { // tick while running
    el._tickInterval = setInterval(() => {
      const rem = Math.max(0, th.remaining - (Date.now() - th.startedAt));
      face(rem, total, rem > 0 ? 'running' : 'done');
      if (rem <= 0) {
        clearInterval(el._tickInterval);
        th.running = false; th.remaining = 0; th.startedAt = 0;
        stageApi.save();
        stageApi.say(th.goal && !th.answered ? 'timer done · did this session meet the goal "' + th.goal + '"? tap yes or not yet' : 'timer done');
        stageApi.emit(th, { event: 'done', text: (th.label ? th.label : 'the timer') + ' is done' }); // to whatever its arrows point at
      }
    }, 250);
  }

  // the 3D hourglass beside the timer (skills/mini/timer.js): its sand follows remaining/startedAt, a fresh run turns it over
  stageApi.miniature(el, 'timer', { duration: th.duration, remaining: th.remaining, running: !!th.running, startedAt: th.startedAt || 0 }, { key: th.id, place: 'beside', width: 120, height: 160, label: '3D hourglass' }).catch(() => {});

  // a practice timer from a plan (lib/practice.js, asked by Verse): at 0:00 it asks whether the session met the goal, logs the
  // answer as that goal's success_rate and last_tested, and says how the goal is going
  const askMet = () => {
    if (!th.goal || th.answered || th.running || th.remaining > 0) return;
    const practice = import('../lib/practice.js'); practice.catch(() => {}); // the practice log loads when a practice timer asks, not with the routing order (owner 2026-10-30)
    const box = document.createElement('div');
    box.className = 'practice-met';
    box.dataset.goal = th.goal;
    box.style.cssText = 'position:absolute;left:0;top:100%;margin-top:4px;white-space:nowrap;font:13px/1.2 system-ui,sans-serif;display:flex;gap:6px;align-items:center;padding:4px 8px;border-radius:10px;background:rgba(20,20,28,.92)';
    el.style.zIndex = '30'; // above what the plan laid out next to it, so the answer can be tapped
    const q = document.createElement('span'); q.textContent = 'Met the goal?'; q.style.opacity = '.7'; box.appendChild(q);
    for (const [label, met] of [['yes', true], ['not yet', false]]) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label; b.dataset.met = met ? 'yes' : 'no';
      b.style.cssText = 'font:inherit;padding:2px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer';
      b.addEventListener('click', async (e) => {
        e.stopPropagation();
        let words = '';
        try { const { record, readLog, writeLog, entryOf, rateWords } = await practice; const log = record(readLog(localStorage), th.goal, met); writeLog(localStorage, log); words = rateWords(entryOf(log, th.goal)); } catch (_) {}
        th.answered = met ? 'met' : 'not yet'; stageApi.save();
        box.textContent = words ? 'Logged: ' + words : 'Logged here only';
        stageApi.say('"' + th.goal + '": ' + (met ? 'met' : 'not yet') + (words ? ' · ' + words : ''));
      });
      box.appendChild(b);
    }
    for (const ev of ['pointerdown', 'mousedown', 'touchstart']) box.addEventListener(ev, (e) => e.stopPropagation()); // a tap on a button is not a drag of the timer
    el.appendChild(box);
  };
  askMet();
  if (th.running) { const w = setInterval(() => { if (!el.isConnected) return clearInterval(w); if (!th.running && th.remaining <= 0) { clearInterval(w); askMet(); } }, 500); }

  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** create, at the place the timer code ran: 'timer-start' (it runs: it was asked with a length, or "start …", or "remind
 *  me …") or 'timer' (it waits: "make a timer", "… paused"), or '' */
export function ask(lower, text, stageApi) {
  if (!wantsCreate(lower)) return '';
  const dur = parseDuration(lower) || 60000; // default 1 min
  const t = ensure(stageApi, dur, wantsFresh(lower) && timers(stageApi).length > 0);
  // a timer asked for with a length ("set a timer for 5 minutes") starts at once, like every phone's; "make a timer" or "…paused" waits
  const startNow = /\b(start|begin|go)\b|^(?:please\s+)?(?:remind|wake|ping|alert|buzz)\s+me\b/.test(lower) || (parseDuration(lower) > 0 && !/\b(paused?|don'?t\s+start|not\s+yet|later)\b/.test(lower));
  if (startNow && !t.running) { t.running = true; t.startedAt = Date.now(); }
  stageApi.save(); stageApi.render();
  return t.running ? 'timer-start' : 'timer';
}

/** start / pause / reset (the first timer, as it always was): what it did, 'no timer' when one was named and there is none,
 *  or '' */
export function askAction(lower, text, stageApi) {
  const action = wantsAction(lower, stageApi);
  if (!action) return '';
  const timerMentioned = /\b(timer|countdown)\b/.test(lower) || !!pickedTimer(stageApi);
  const t = timers(stageApi)[0];
  if (t) {
    if (action === 'start') {
      if (!t.running) { if (t.remaining <= 0) t.remaining = t.duration; t.running = true; t.startedAt = Date.now(); }
    } else if (action === 'pause') {
      if (t.running) { t.remaining = Math.max(0, t.remaining - (Date.now() - t.startedAt)); t.running = false; t.startedAt = 0; }
    } else {
      t.remaining = t.duration; t.running = false; t.startedAt = 0;
    }
    stageApi.save(); stageApi.render();
    return 'timer-' + action;
  }
  if (timerMentioned) { stageApi.say('no timer to ' + action); return 'no timer'; }
  return '';
}

/** remove (the first timer, as it always was): 'timer-removed', 'no timer' when there is none, or '' */
export function askRemove(lower, text, stageApi) {
  if (!wantsRemove(lower, stageApi)) return '';
  const t = timers(stageApi)[0];
  if (!t) { stageApi.say(''); return 'no timer'; }
  delete stageApi.things()[t.id];
  if (stageApi.selected() === t.id) stageApi.select(null);
  stageApi.save(); stageApi.render();
  return 'timer-removed';
}

export default {
  name: 'timer',
  examples: ['set a timer for 5 minutes', 'a 2 second timer', 'timer'],
  nearMisses: ['set an alarm for 7am', 'how many days until christmas', 'pause the timer'],
  match(lower) { return plainTimer(lower); },
  async run(text, api) { const d = ask(String(text || '').toLowerCase(), text, api.stage); return d ? 'timer' : 'none'; },
  // askAt: the page asks this kind's ask, askAction and askRemove at its own places, not in the early loop
  stageKinds: { timer: { mount, ensure: (stageApi) => ensure(stageApi, 60000), alter, ask, askAction, askRemove, askAt: 'timer' } },
};
