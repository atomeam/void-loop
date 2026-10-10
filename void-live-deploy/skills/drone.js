// Sound (frontier #21, sky part 3): an opt-in ambient drone that follows the real sky and the cursor. Nothing here makes a sound by itself:
// the page builds an AudioContext only after a visitor taps the sound button (browsers require that anyway), and the same button mutes it.
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// what the drone should be right now. sky: { daylight 0..1, season?: { k -1..1 } } (window.__voidSky), pointer: { x, y } each 0..1.
// Night sits low and dark (A1 55 Hz); full day lifts the root to E2 (82.4 Hz) and opens the filter; the cursor sweeps the filter left to right
// and detunes the upper voices a little as it moves down. Volume is capped well below what would startle anyone.
export function droneFor(sky, pointer) {
  const d = clamp(Number(sky && sky.daylight) || 0, 0, 1), px = clamp(Number(pointer && pointer.x), 0, 1) || 0, py = clamp(Number(pointer && pointer.y), 0, 1) || 0;
  const season = clamp(Number(sky && sky.season && sky.season.k) || 0, -1, 1);
  const root = 55 * Math.pow(82.4 / 55, d);
  return {
    root,
    voices: [{ ratio: 1, gain: 1, detune: 0 }, { ratio: 1.5, gain: 0.45 + 0.1 * season, detune: (py - 0.5) * 16 }, { ratio: 2, gain: 0.3, detune: (0.5 - py) * 10 }, { ratio: 3, gain: 0.14 + 0.1 * d, detune: (py - 0.5) * 24 }],
    cutoff: 220 + 900 * d + 700 * px,
    gain: 0.05,
  };
}

// the Web Audio side, given an AudioContext (or anything shaped like one, so a test can pass a fake). Parameters glide; nothing steps.
export function createDrone(ctx) {
  const master = ctx.createGain(), filter = ctx.createBiquadFilter(), voices = [];
  master.gain.value = 0; filter.type = 'lowpass'; filter.Q.value = 0.7;
  filter.connect(master); master.connect(ctx.destination);
  const want = droneFor({ daylight: 0 }, { x: 0.5, y: 0.5 });
  for (const v of want.voices) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = want.root * v.ratio; g.gain.value = v.gain; osc.connect(g); g.connect(filter); osc.start(); voices.push({ osc, g, v });
  }
  let muted = false, last = want;
  const glide = (param, to, s = 1.8) => { try { param.setTargetAtTime(to, ctx.currentTime, s); } catch (_) { param.value = to; } };
  const api = {
    update(sky, pointer) {
      const w = last = droneFor(sky, pointer);
      voices.forEach((o, i) => { glide(o.osc.frequency, w.root * w.voices[i].ratio); glide(o.g.gain, w.voices[i].gain); try { o.osc.detune.value = w.voices[i].detune; } catch (_) {} });
      glide(filter.frequency, w.cutoff, 0.6);
      if (!muted) glide(master.gain, w.gain);
    },
    mute() { muted = true; glide(master.gain, 0, 0.25); },
    unmute() { muted = false; glide(master.gain, last.gain, 0.5); },
    get muted() { return muted; },
    stop() { glide(master.gain, 0, 0.1); setTimeout(() => { for (const o of voices) { try { o.osc.stop(); } catch (_) {} } try { ctx.close(); } catch (_) {} }, 600); },
  };
  api.unmute(); // starts audible: the tap that made it was the ask
  return api;
}
