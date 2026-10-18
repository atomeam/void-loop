/**
 * night-ritual - "begin the night ritual" dims the stage and moves the page to a deep-void palette (a <style> that only overrides the page's CSS
 * variables, so "end the ritual" removes it and everything is as it was), starts a very quiet low drone ONLY if the browser lets Web Audio run
 * from your own typed ask (a user gesture; if it refuses, the ritual is silent and says so), and lays down one night card: tonight's moon phase,
 * worked out here from the date (lib/astro.js, no network), and one quiet line. "end the ritual" fades the drone, removes the card and the
 * palette. Asked by the owner, 2026-10-18 (stage pack D). Nothing is sent anywhere and nothing starts by itself.
 * "night mode" and "my morning ritual" stay where they go now; "moon tonight" (skills/moontonight.js) is the full almanac, this is one line of it.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import * as A from '../lib/astro.js';
import { moonSvg } from '../lib/skyask.js';

const clean = (s) => String(s || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const BEGIN = /^(?:please\s+)?(?:begin|start|enter|open|light|do)\s+(?:the\s+|my\s+|a\s+)?night ritual$/;
const END = /^(?:please\s+)?(?:end|finish|close|stop|leave|quit)\s+(?:the\s+|my\s+)?(?:night\s+)?ritual$/;
/** 'begin' | 'end' | null. Pure. */
export function ritualAsk(text) { const t = clean(text); return BEGIN.test(t) ? 'begin' : END.test(t) ? 'end' : null; }

export const STYLE_ID = 'void-night-ritual';
/** the deep-void palette: only variables the page already defines, plus a dim veil that lets every tap through. Pure. */
export const NIGHT_CSS = ':root{--bg:#02020a;--fg:#b9bdd0;--muted:#7d8296;--ink:#b9bdd0;--ink-2:#8e93a8;--ink-3:#6c7188;--card-line:rgba(150,160,220,.14);--neb-a:40 34 110;--neb-b:20 60 90}'
  + 'body.void-night{background:var(--bg)}body.void-night::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:2147482000;background:rgba(0,0,12,.38)}';

export const LINES = [
  'Nothing needs you until morning.',
  'The quiet is not empty; it is just not asking.',
  'Whatever is unfinished will keep.',
  'Let the dark do some of the work.',
  'You can put the day down now.',
  'The stage will hold everything until you come back.',
  'Slow is a fine speed at night.',
];
/** one quiet line, the same all day: chosen by the date. Pure. */
export function lineFor(date) { const d = Math.floor(date.getTime() / 86400000); return LINES[((d % LINES.length) + LINES.length) % LINES.length]; }

/** tonight's moon, worked out from the date alone. Pure. */
export function moonLine(date) {
  const ph = A.moonPhase(date), pct = Math.round(ph.illumination * 100);
  return { ph, text: ph.name[0].toUpperCase() + ph.name.slice(1) + ' · ' + pct + '% lit · day ' + Math.round(ph.ageDays) + ' of the cycle' };
}

/** the night card as a kept stage thing; every value escaped. Pure but for esc. */
export function nightCard(esc, date, id, x, y) {
  const { ph, text } = moonLine(date);
  return { id, kind: 'kept', nightRitual: true, x, y, w: 280, name: 'Night card', ask: 'begin the night ritual',
    html: moonSvg(ph.illumination, ph.waxing, false, 56) + '<h2>' + esc('Night card') + '</h2><p>' + esc(text) + '</p><p>' + esc(lineFor(date)) + '</p>' };
}

/** the drone's three voices: frequency (Hz) and gain, all very low. Pure. */
export const DRONE = [{ f: 55, g: 0.016 }, { f: 82.41, g: 0.009 }, { f: 110.0, g: 0.005 }];
/** sound may start only when the context is running after the gesture; anything else stays silent. Pure. */
export const mayPlay = (state) => state === 'running';

let audio = null;
async function startDrone() {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext); if (!AC) return false;
  let ctx; try { ctx = new AC(); if (ctx.state === 'suspended' && ctx.resume) await ctx.resume(); } catch (_) { return false; }
  if (!mayPlay(ctx.state)) { try { ctx.close(); } catch (_) {} return false; }
  const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  const oscs = DRONE.map((v) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = v.f; g.gain.value = v.g; o.connect(g); g.connect(master); o.start(); return o; });
  master.gain.linearRampToValueAtTime(1, ctx.currentTime + 4);
  audio = { ctx, master, oscs };
  return true;
}
function stopDrone() {
  if (!audio) return; const { ctx, master, oscs } = audio; audio = null;
  try { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2); } catch (_) {}
  setTimeout(() => { try { oscs.forEach((o) => o.stop()); ctx.close(); } catch (_) {} }, 1400);
}

export function palette(on) {
  const had = document.getElementById(STYLE_ID);
  if (on && !had) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = NIGHT_CSS; document.head.appendChild(s); document.body.classList.add('void-night'); }
  if (!on) { if (had) had.remove(); document.body.classList.remove('void-night'); }
}

async function run(text, api) {
  const what = ritualAsk(text); if (!what) return 'none';
  const st = api.stage, things = st.things();
  const cards = () => Object.values(things).filter((t) => t && t.nightRitual);
  if (what === 'end') {
    const was = !!document.getElementById(STYLE_ID);
    palette(false); stopDrone();
    const gone = cards(); gone.forEach((t) => { delete things[t.id]; }); if (gone.length) { st.save(); st.render(); }
    api.say(was ? 'the ritual is over · the stage is as it was' : 'no ritual was running');
    return 'night-ritual';
  }
  palette(true);
  const sound = audio ? true : await startDrone();
  if (!cards().length) {
    const w = st.stage.clientWidth || 800, id = 'night' + Date.now().toString(36);
    things[id] = nightCard(api.esc, new Date(), id, Math.max(16, Math.round(w / 2 - 140)), 60);
    st.select(id); st.save(); st.render();
  }
  api.say('the night ritual has begun · ' + (sound ? 'a quiet drone is on' : 'silent (the browser did not allow sound)') + ' · "end the ritual" puts it all back');
  return 'night-ritual';
}

export default {
  name: 'night-ritual',
  examples: ['begin the night ritual', 'start the night ritual', 'end the ritual', 'end the night ritual'],
  nearMisses: ['night mode', 'my morning ritual', 'what is a ritual', 'ritual dance meaning', 'night sky tonight', 'end the call'],
  ritualAsk, lineFor, moonLine, nightCard, mayPlay,
  match(lower, text) { return !!ritualAsk(text || lower); },
  run,
};
