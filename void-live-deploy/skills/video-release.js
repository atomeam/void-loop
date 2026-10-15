/**
 * video-release skill - browser video recordings pipeline to GitHub release assets.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "record this for github release", "browser video recordings pipeline to github release assets".
 * Uses MediaRecorder / getDisplayMedia to capture, downloads the webm. Attaching as a release asset is an owner step on GitHub (no secrets or tokens written here). Empty surface stays empty.
 */
export function releaseOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:browser\s+)?video\s+recordings?\s+pipeline\s+to\s+github\s+release(?:\s+assets)?$/.test(t)
    || /^record\s+(?:this\s+)?(?:video\s+)?for\s+(?:a\s+)?github\s+release$/.test(t);
}

async function run(text, api) {
  const { showPage } = api;
  if (!releaseOf(text)) return 'none';
  const el = showPage((p) => {
    p.innerHTML = '<h2>Video recording for GitHub release</h2><p>Click record to capture the current tab or screen (browser support required). The webm downloads here. The owner attaches it as a GitHub release asset later; this skill writes no secrets.</p><button type="button" id="rec" class="g-btn">Start recording</button><div id="status" class="sub"></div>';
  });
  const btn = el.querySelector('#rec');
  const status = el.querySelector('#status');
  let rec = null, chunks = [];
  btn.addEventListener('click', async () => {
    if (rec) {
      rec.stop();
      btn.textContent = 'Start recording';
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      rec = new MediaRecorder(stream);
      chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'void-recording.webm'; document.body.appendChild(a); a.click(); a.remove();
        status.textContent = 'Downloaded void-recording.webm. Owner can attach it to a GitHub release.';
        stream.getTracks().forEach((t) => t.stop());
        rec = null;
      };
      rec.start();
      btn.textContent = 'Stop recording';
      status.textContent = 'Recording…';
    } catch (e) {
      status.textContent = 'Recording not available or permission denied.';
    }
  });
  return 'video-release';
}

export default {
  name: 'video-release',
  examples: ['browser video recordings pipeline to github release assets', 'record this for github release'],
  nearMisses: ['play a video', 'upload to youtube', 'record a film'],
  match(lower, text) { return releaseOf(text || lower); },
  run,
  suite() {
    return { ok: releaseOf('record this for github release') && !releaseOf('play video') };
  },
};
