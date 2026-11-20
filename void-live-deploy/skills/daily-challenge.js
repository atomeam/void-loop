/**
 * daily-challenge skill — "daily challenge", "today's challenge", "beat 1200 on the daily challenge".
 * One scored run a day of today's Debris Field round (the same round for everyone on a UTC day), free for every visitor. After the run the card
 * shows today's score, the streak of days in a row and a link that sends a friend the same round to beat. The game itself is skills/debris-field-rules.js,
 * read as it is; the record is lib/daily-challenge.js, on this device only.
 */
import * as G from './debris-field-rules.js';
import { arcadeCard } from './arcade-card.js';
import { finish } from '../lib/ladder.js';
import { drive, daySeed } from '../lib/studio-play.js';
import * as D from '../lib/daily-challenge.js';

const btn = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn'; b.textContent = label; b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', (e) => { e.stopPropagation(); fn(b); }); return b; };
const line = (text, css) => { const d = document.createElement('div'); d.textContent = text; if (css) d.style.cssText = css; return d; };

/** the finished day's card: score, streak, the share link, and what to play next. */
function result(el, stageApi, friend) {
  const day = D.dayKey(), s = D.load(), score = D.todayScore(s, day), streak = D.streakOn(s, day);
  for (const n of [...el.children]) if (!n.classList.contains('g-head')) n.remove();
  const box = document.createElement('div'); box.className = 'daily-result'; box.style.cssText = 'display:grid;gap:8px;padding:6px 2px 2px';
  box.append(line('Today: ' + score + ' points', 'font-size:26px;font-weight:700'));
  box.append(line(streak > 1 ? '🔥 ' + streak + ' days in a row' : '🔥 Day 1 of your streak. Come back tomorrow to keep it going.', 'font-size:15px'));
  if (friend != null) box.append(line(score > friend ? 'You beat your friend’s ' + friend + '.' : score === friend ? 'A tie with your friend’s ' + friend + '.' : 'Your friend’s ' + friend + ' still stands. Tomorrow is a new round.', 'font-size:14px'));
  if (s.best > score) box.append(line('Your best day: ' + s.best, 'font-size:13px;color:var(--muted,#8a8a8a)'));
  const sh = D.shareOf(score, streak, location.origin);
  const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px';
  row.append(btn('Send a friend this round', async (b) => {
    try { if (navigator.share) { await navigator.share({ text: sh.text, url: sh.url }); return; } } catch (_) { return; }
    try { await navigator.clipboard.writeText(sh.text + ' ' + sh.url); b.textContent = 'Link copied'; } catch (_) { b.textContent = sh.url; }
  }));
  for (const [label, ask] of [['Play chess', 'play chess'], ['Play snake', 'play snake']]) row.append(btn(label, () => { try { stageApi.ask ? stageApi.ask(ask) : document.dispatchEvent(new CustomEvent('void:summon', { detail: ask })); } catch (_) {} }));
  box.append(row);
  box.append(line('A new round in ' + D.hoursLeft() + ' h. One scored run a day.', 'font-size:12px;color:var(--muted,#8a8a8a)'));
  el.append(box);
}

function mount(th, stageApi) {
  const friend = Number.isFinite(+th.friend) && th.friend !== null && th.friend !== '' ? +th.friend : null;
  const sub = friend != null ? 'A friend scored ' + friend + ' today. Beat it.' : 'Today’s round, the same for everyone. One run counts.';
  const c = arcadeCard(th, stageApi, { cls: 'daily-challenge', title: 'Daily challenge', sub, w: G.W, h: G.H });
  if (D.todayScore(D.load(), D.dayKey()) != null) { result(c.el, stageApi, friend); return; }
  let last = null;
  const game = { ...G, tick(s, input) { last = s; return G.tick(s, input); } };
  drive(c, game, { fly: true, canvasHud: true, seed: daySeed(), onDone: (over) => {
    try { finish(G.id, over); } catch (_) {}
    const score = last && last.score ? last.score.you : 0;
    D.save(D.record(D.load(), D.dayKey(), score));
    setTimeout(() => { if (c.el.isConnected) result(c.el, stageApi, friend); }, 1800);
  } });
}

function run(text, api) {
  const a = D.askOf(text);
  if (!a) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'daily-challenge');
  if (existing) { if (existing.friend !== a.friend) { existing.friend = a.friend; api.stage.render(); } if (api.stage.center) api.stage.center(existing.id); }
  else api.summon('daily-challenge', { x: Math.max(10, Math.round(innerWidth / 2 - 160)), y: 40, friend: a.friend });
  const done = D.todayScore(D.load(), D.dayKey()) != null;
  api.say(done ? 'You played today’s round · a new one in ' + D.hoursLeft() + ' h' : a.friend != null ? 'Daily challenge · beat ' + a.friend : 'Daily challenge · one run counts, steer with the mouse, a finger or the arrow keys');
  return 'daily-challenge';
}

export default {
  name: 'daily-challenge',
  examples: ['daily challenge', "today's challenge", 'play the daily challenge', 'beat 1200 on the daily challenge'],
  nearMisses: ['daily card challenge', 'daily note', 'daily water intake', 'debris field'],
  match(lower, text) { return !!D.askOf(text || lower); },
  run,
  stageKinds: { 'daily-challenge': { mount } },
};
