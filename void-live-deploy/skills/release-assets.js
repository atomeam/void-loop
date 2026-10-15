/**
 * release-assets skill — browser video recordings pipeline to GitHub release assets.
 * Helps prepare and link recorded experiment videos as release assets.
 * "pipeline video recordings to github releases", "upload browser recordings as release assets".
 * Empty surface stays empty. No secrets; shows the path and existing films as examples.
 */
export function releaseOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:browser\s+)?video\s+recordings?\s+pipeline\s+to\s+github\s+release\s+assets|pipeline\s+(?:the\s+)?(?:browser\s+)?(?:video\s+)?recordings?\s+(?:to|as)\s+(?:github\s+)?releases?|upload\s+(?:browser\s+)?recordings?\s+as\s+release\s+assets)$/i.test(t);
}

async function run(text, api) {
  if (!releaseOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Browser video recordings → GitHub release assets</h2><div class="sub">preparing the pipeline…</div>'; });
  let films = [];
  try {
    const j = await fetch('/api/films').then((r) => r.json());
    films = (j.films || []).slice(0, 3);
  } catch (_) {}
  if (api._pageStill && !api._pageStill(el)) return 'release-assets';
  const list = films.map((f) => '<li>' + esc(f.title || f.id) + ' · ' + esc((f.at || '').slice(0, 10)) + '</li>').join('') || '<li>No films listed just now</li>';
  el.innerHTML = '<h2>Browser video recordings → GitHub release assets</h2>'
    + '<p>Recordings from the browser experiments (V01D FILMS) can be attached as release assets on atomeam/void-loop.</p>'
    + '<ol><li>Record the experiment in a real browser (the films pipeline already does this).</li>'
    + '<li>Download the video from the films page.</li>'
    + '<li>Create or edit a GitHub Release and upload the file as an asset (no token needed for public download).</li>'
    + '<li>Link it from the film metadata or the films page.</li></ol>'
    + '<h3>Recent films (examples)</h3><ul>' + list + '</ul>'
    + '<div class="src">Public releases: <a href="https://github.com/atomeam/void-loop/releases" target="_blank" rel="noopener">github.com/atomeam/void-loop/releases</a></div>';
  return 'release-assets';
}

export default {
  name: 'release-assets',
  examples: ['pipeline video recordings to github releases', 'browser video recordings pipeline to GitHub release assets', 'upload browser recordings as release assets'],
  nearMisses: ['films', 'video play', 'github'],
  match(lower, text) { return releaseOf(text); },
  run,
  suite() {
    return { ok: releaseOf('browser video recordings pipeline to GitHub release assets') && !releaseOf('hello') };
  },
};
