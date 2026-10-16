/**
 * recordings-pipeline skill — browser video recordings pipeline to GitHub release assets.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "browser video recordings pipeline", "pipeline to GitHub release assets", "recordings to releases".
 * Shows status from the existing pipeline (/api/films from draft releases). Empty surface stays empty. No secrets.
 */
export function recordingsOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /browser\s+video\s+recordings?\s+pipeline|pipeline\s+to\s+github\s+release\s+assets|recordings?\s+to\s+(?:github\s+)?releases?/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!recordingsOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Browser recordings pipeline</h2><div class="sub">checking films…</div>'; });
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    if (!api._pageStill(el)) return 'recordings-pipeline';
    const count = (j.films || []).length;
    el.innerHTML = '<h2>Browser video recordings pipeline</h2><div class="sub">' + esc(String(count)) + ' films from the pipeline</div><p>record.yml films experiments in a real browser, converts to MP4, and posts as draft GitHub release assets. They appear on the site via /api/films. Nothing new is uploaded here.</p><div class="src">Existing: .github/workflows/record.yml, tools/record.mjs, tools/film-post.mjs</div>';
    return 'recordings-pipeline';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Browser recordings pipeline</h2><p>Could not check just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'recordings-pipeline',
  examples: ['browser video recordings pipeline', 'pipeline to GitHub release assets', 'recordings to releases'],
  nearMisses: ['record a video', 'github releases', 'browser history'],
  match(lower, text) { return recordingsOf(text); },
  run,
  suite() {
    return { ok: recordingsOf('browser video recordings pipeline') === true && recordingsOf('hello') === false };
  },
};
