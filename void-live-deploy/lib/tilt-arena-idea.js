// tilt-arena-idea — one Tilt Arena mode as a field-stage idea (lib/field-stage.js runs the card: the loop, pause when hidden, reduced
// motion, Tilt, Seal, Reset, the frame timer). arenaIdea(mode) adds the steering source of that mode (tilt or pointer, VR gaze, VR hand,
// GPU batch) and the DOM agent cards (the top three, F-205/F-228). Every VR or GPU path is optional: no support, the button says so and
// the pointer or tilt steers, so the arena always plays. Nothing about where you looked, pointed or held your hand is kept or sent.
import * as T from './tilt-arena.js';
import { MODES } from './tilt-arena-modes.js';

const MT = { list: MODES, label: 'Tilt Arena mode', ask: (m) => m.ask };

/** where the agents should go this frame: VR (s.ext, fresh) first, then tilt, then the pointer, else a slow wandering lure. Pure. */
export function targetOf(s, input) {
  if (s.ext && s.t - s.ext.t < 0.5) return s.ext;
  if (input.tilting) return { x: 0.5 + input.tiltX * 0.45, y: 0.5 + input.tiltY * 0.45 };
  if (input.over) return { x: input.x, y: input.y };
  return { x: 0.5 + 0.32 * Math.cos(s.t * 0.37), y: 0.5 + 0.26 * Math.sin(s.t * 0.53) };
}

function button(q, label, title) { const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn'; b.textContent = label; b.title = title; b.addEventListener('pointerdown', (e) => e.stopPropagation()); q('.ff-btns').insertBefore(b, q('.ff-reset')); b.style.maxWidth = '100%'; return b; }

/** an immersive-vr session that writes s.ext from the viewer's gaze (hands=false) or the index fingertip (hands=true). */
function xrButton(ctx, hands) {
  const { q, th, el } = ctx, b = button(q, hands ? 'Enter VR (hands)' : 'Enter VR (gaze)', hands ? 'steer with your index fingertip in VR (needs hand tracking)' : 'steer with where you look in VR');
  const off = (why) => { b.disabled = true; b.textContent = why; el.dataset.xr = 'none'; };
  if (!navigator.xr || !navigator.xr.isSessionSupported) off('VR not available here: pointer or tilt steers');
  else navigator.xr.isSessionSupported('immersive-vr').then((ok) => { if (!ok) off('VR not available here: pointer or tilt steers'); else el.dataset.xr = 'ready'; }).catch(() => off('VR not available here: pointer or tilt steers'));
  let session = null;
  b.addEventListener('click', async () => {
    if (session) { session.end(); return; }
    try {
      session = await navigator.xr.requestSession('immersive-vr', hands ? { optionalFeatures: ['hand-tracking'] } : {});
      const gl = document.createElement('canvas').getContext('webgl', { xrCompatible: true }); await gl.makeXRCompatible();
      session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
      const ref = await session.requestReferenceSpace('local'); b.textContent = 'Exit VR'; el.dataset.xr = 'on';
      const frame = (_, f) => {
        if (!session) return; session.requestAnimationFrame(frame);
        const layer = session.renderState.baseLayer; gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer); gl.clearColor(0.02, 0.02, 0.05, 1); gl.clear(gl.COLOR_BUFFER_BIT);
        const s = th.state;
        if (hands) {
          for (const src of session.inputSources) { const j = src.hand && src.hand.get('index-finger-tip'), p = j && f.getJointPose && f.getJointPose(j, ref); if (p) { const v = p.transform.position; s.ext = { x: 0.5 + v.x / 0.6, y: 0.5 - (v.y - 1.2) / 0.5, t: s.t }; break; } }
        } else {
          const vp = f.getViewerPose(ref); if (vp) { const o = vp.transform.orientation, yaw = Math.atan2(2 * (o.w * o.y + o.x * o.z), 1 - 2 * (o.y * o.y + o.x * o.x)), pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (o.w * o.x - o.y * o.z)))); s.ext = { x: 0.5 - yaw / (Math.PI / 3), y: 0.5 - pitch / (Math.PI / 4), t: s.t }; }
        }
        ctx.tick(1);
      };
      session.requestAnimationFrame(frame);
      session.addEventListener('end', () => { session = null; th.state.ext = null; b.textContent = hands ? 'Enter VR (hands)' : 'Enter VR (gaze)'; el.dataset.xr = 'ready'; });
    } catch (_) { session = null; b.textContent = 'VR could not start: pointer or tilt steers'; }
  });
  return () => { try { session && session.end(); } catch (_) { /* gone */ } };
}

/** GPU Swarm: the agents' networks as one WebGPU compute pass; until it answers, or without WebGPU, forwardAll on the processor. */
function gpu(ctx) {
  const { th, el, q } = ctx, note = document.createElement('div'); note.className = 'ta-gpu'; note.style.cssText = 'font-size:11.5px;color:var(--muted,#8a8a8a)'; q('.ff-why').after(note);
  const cpu = (why) => { el.dataset.gpu = 'cpu'; note.textContent = why + ': the networks run on the processor instead, same agents, same rules.'; };
  let dead = false, dev = null;
  if (!navigator.gpu) { cpu('No WebGPU in this browser'); return () => {}; }
  el.dataset.gpu = 'starting'; note.textContent = 'Starting the graphics card…';
  (async () => {
    try {
      const ad = await navigator.gpu.requestAdapter(); if (!ad) throw new Error('no adapter');
      dev = await ad.requestDevice(); const s0 = th.state, n = s0.n;
      const mk = (size, usage) => dev.createBuffer({ size, usage });
      const SU = GPUBufferUsage, wB = mk(n * T.GENES * 4, SU.STORAGE | SU.COPY_DST), xB = mk(n * T.IN * 4, SU.STORAGE | SU.COPY_DST), yB = mk(n * T.OUT * 4, SU.STORAGE | SU.COPY_SRC), rB = mk(n * T.OUT * 4, SU.MAP_READ | SU.COPY_DST), uB = mk(16, SU.UNIFORM | SU.COPY_DST);
      dev.queue.writeBuffer(uB, 0, new Uint32Array([n, 0, 0, 0]));
      const pipe = dev.createComputePipeline({ layout: 'auto', compute: { module: dev.createShaderModule({ code: T.WGSL }), entryPoint: 'main' } });
      const bind = dev.createBindGroup({ layout: pipe.getBindGroupLayout(0), entries: [wB, xB, yB, uB].map((buffer, binding) => ({ binding, resource: { buffer } })) });
      el.dataset.gpu = 'on'; note.textContent = 'Running ' + n + ' agent networks on your graphics card.';
      while (!dead && el.isConnected) {
        const s = th.state; if (s.n !== n) break;
        dev.queue.writeBuffer(wB, 0, s.W); dev.queue.writeBuffer(xB, 0, T.inputs(s));
        const enc = dev.createCommandEncoder(), p = enc.beginComputePass(); p.setPipeline(pipe); p.setBindGroup(0, bind); p.dispatchWorkgroups(Math.ceil(n / 64)); p.end();
        enc.copyBufferToBuffer(yB, 0, rB, 0, n * T.OUT * 4); dev.queue.submit([enc.finish()]);
        await rB.mapAsync(GPUMapMode.READ); s.gpuOut = new Float32Array(rB.getMappedRange().slice(0)); rB.unmap(); s.gpuPasses = (s.gpuPasses || 0) + 1; el.dataset.gpuPasses = String(s.gpuPasses);
        await new Promise((r) => requestAnimationFrame(r));
      }
    } catch (_) { th.state.gpuOut = null; cpu('The graphics card could not start'); }
  })();
  return () => { dead = true; try { dev && dev.destroy(); } catch (_) { /* gone */ } };
}

/** the DOM agent cards: the top three, their closeness and wins (F-205, F-228). */
function board(ctx) {
  const { q, th, el } = ctx, ol = document.createElement('ol'); ol.className = 'ta-board'; ol.setAttribute('aria-label', 'leaders');
  ol.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;list-style:none;margin:6px 0 0;padding:0;font-size:12px';
  q('.ff-hud').before(ol);
  const lis = [0, 1, 2].map(() => { const li = document.createElement('li'); li.style.cssText = 'flex:1 1 90px;min-width:0;padding:4px 7px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);overflow-wrap:anywhere'; ol.appendChild(li); return li; });
  const id = setInterval(() => { if (!el.isConnected) return; T.ranked(th.state).slice(0, 3).forEach((a, i) => { lis[i].textContent = ['1st', '2nd', '3rd'][i] + ' ' + a.name + ' · ' + Math.round(a.fit * 100) + '% close · ' + a.wins + ' wins'; }); el.dataset.gen = String(th.state.gen); }, 300);
  return () => clearInterval(id);
}

/** the idea for one mode: 'tilt-mode' | 'gaze-chase' | 'gpu-swarm' | 'hand-arena'. */
export function arenaIdea(id) {
  const m = MODES.find((x) => x.id === id), big = id === 'gpu-swarm';
  return {
    id, title: 'Tilt Arena', sub: m.name + ' · ' + (big ? '256 agents' : '12 agents learn to chase'), W: 360, H: 240, warm: 0, modes: MT,
    how: m.about.replace(/^./, (c) => c.toUpperCase()) + '. Every few seconds the weakest agent becomes a mutated copy of the leader. Seal keeps the leader\'s genome (numbers only).',
    create: (seed) => T.create(seed, big ? 256 : 12),
    step(s, dt, input) { const out = s.gpuOut && s.gpuOut.length === s.n * T.OUT ? s.gpuOut : null; T.step(s, dt, targetOf(s, input), out); },
    metrics: (s) => T.metrics(s),
    params: (s) => T.params(s),
    status: (s) => 'generation ' + s.gen + ' · leader ' + T.ranked(s)[0].name + (s.lastSwap ? ' · ' + s.lastSwap : ''),
    mount(ctx) {
      const ends = [board(ctx)];
      if (id === 'gaze-chase') ends.push(xrButton(ctx, false));
      if (id === 'hand-arena') ends.push(xrButton(ctx, true));
      if (id === 'gpu-swarm') ends.push(gpu(ctx));
      return { dispose() { ends.forEach((f) => { try { f(); } catch (_) { /* gone */ } }); } };
    },
    draw(g, s, W, H) {
      g.fillStyle = '#05060c'; g.fillRect(0, 0, W, H);
      const tx = s.target.x * W, ty = s.target.y * H; g.strokeStyle = 'rgba(255,220,120,.9)'; g.lineWidth = 2; g.beginPath(); g.arc(tx, ty, 10, 0, 6.283); g.stroke(); g.beginPath(); g.arc(tx, ty, 3, 0, 6.283); g.fillStyle = '#ffd878'; g.fill();
      const lead = T.ranked(s)[0], r = big ? 2 : 5;
      for (const a of s.agents) { g.fillStyle = 'hsl(' + Math.round(200 - a.fit * 160) + ',85%,' + Math.round(45 + a.fit * 25) + '%)'; g.beginPath(); g.arc(a.x * W, a.y * H, r, 0, 6.283); g.fill(); }
      g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(lead.x * W, lead.y * H, r + 4, 0, 6.283); g.stroke();
    }
  };
}
