// The video maker's voice, off the page's thread so the page stays responsive: Kokoro (open weights, Apache-2.0) on this device.
// In: { lines, voice }. Out: { progress } messages, then { clips: [{ audio, rate }] } or { error }.
import { KokoroTTS, env } from '/vendor/kokoro-js-1.2.1/kokoro.web.js';

env.wasmPaths = { mjs: new URL('/vendor/kokoro-js-1.2.1/ort-wasm-simd-threaded.jsep.mjs', self.location.href).href, wasm: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1/dist/ort-wasm-simd-threaded.jsep.wasm' };
let tts = null;

async function load() {
  if (tts) return tts;
  const gpu = !!(self.navigator && navigator.gpu) && (await navigator.gpu.requestAdapter().catch(() => null));
  tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: gpu ? 'fp32' : 'q8', device: gpu ? 'webgpu' : 'wasm' });
  return tts;
}

self.onmessage = async ({ data }) => {
  try {
    postMessage({ progress: 'The quick voice is resting, so this device makes the voice: loading it (about 90 MB, once)…' });
    const t = await load();
    // one line at a time: the model runs one job at once
    const clips = await data.lines.reduce((p, line, i) => p.then((acc) => {
      postMessage({ progress: 'Recording the voice on this device: line ' + (i + 1) + ' of ' + data.lines.length + ' (this can take a few minutes)…' });
      return t.generate(line, { voice: data.voice }).then((c) => [...acc, { audio: c.audio, rate: c.sampling_rate }]);
    }), Promise.resolve([]));
    postMessage({ clips }, clips.map((c) => c.audio.buffer));
  } catch (e) {
    postMessage({ error: 'The voice could not run in this browser: ' + String((e && e.message) || e).slice(0, 160) });
  }
};
