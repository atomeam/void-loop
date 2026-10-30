# F-217 Audible Synapse Forager

Open `index.html` from any static server (AudioWorklet and OPFS need http(s) or localhost). Press "Wake the forager".

- `brain-worklet.js` holds the whole brain and world. In the page it is both the AudioWorklet module (`registerProcessor('synapse-forager')`) and a plain script for the main-thread fallback; in Node it is a CommonJS module for tuning (`node tune.cjs on 900 1`).
- Brain: 32 Poisson input neurons (16 smell the left antenna, 16 the right) project all-to-all onto 32 Izhikevich regular-spiking motor neurons (16 turn left, 16 turn right). Learning is reward-modulated STDP: pre/post traces (20 ms) feed per-synapse eligibility traces (200 ms), and dopamine (smell gained this millisecond, plus a small burst on eating, minus a slow baseline) gates the weight change. Homeostatic synaptic scaling keeps each motor neuron's total input fixed every 10 ms, so dopamine can only move weight between left and right inputs.
- Clock: the brain steps `speed` milliseconds per 128-sample audio block (3 by default, about 1.1 times real time at 48 kHz; Dream is 60). Left motor spikes ring a 440 Hz partial in the left channel, right motor spikes 660 Hz in the right, input spikes a soft 185 Hz bed, and eating a 1320 Hz chime.
- UI: the canvas shows food and the forager, clicking drops food, and the synapse wall is 1024 DOM cells (same-side synapses blue, cross-side pink) whose opacity is each weight; the wall skews and the panel glows as wiring improves.
- Memory: weights are written to OPFS (`f217-synapses.bin`, 4096 bytes) every 10 s and restored on the next visit. "Forget" deletes the file.
- Test hooks: `window.__f217.offline(simSec, learn, seed, W?)` renders the brain in an `OfflineAudioContext` with 4 channels, where channels 2 and 3 carry telemetry (food eaten / 1000, wiring index), so it can be measured headless far faster than real time. `bench.cjs` runs the whole benchmark with Playwright.
- Query params: `auto=1`, `speed=N`, `learn=0`, `mute=1`, `seed=N`, `fresh=1` (ignore stored synapses).
