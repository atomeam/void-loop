/**
 * video-releases skill — browser video recordings pipeline status to GitHub release assets.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite() }
 * "video recordings pipeline", "release assets for films", "browser videos on github".
 * Reads public GitHub releases API (no token). Shows recent release assets that look like videos. Empty surface stays empty.
 */
export function releasesOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:show|list|check)\s+)?(?:browser\s+)?(?:video\s+)?(?:recordings?\s+)?(?:pipeline\s+)?(?:to\s+)?(?:github\s+)?(?:release\s+)?assets?$/.test(t)
    || /video\s+recordings\s+pipeline/.test(t);
}

async function run(text, api) {
  const { showPage, esc, _pageStill } = api;
  if (!releasesOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Video release assets</h2><div class="sub">checking GitHub…</div>'; });
  try {
    const r = await fetch('https://api.github.com/repos/atomeam/void-loop/releases?per_page=5');
    if (_pageStill && !_pageStill(el)) return 'video-releases';
    const rels = await r.json();
    const assets = [];
    for (const rel of rels || []) {
      for (const a of rel.assets || []) {
        if (/\.(mp4|webm|mov|mkv)$/i.test(a.name)) assets.push({ name: a.name, url: a.browser_download_url, release: rel.tag_name, size: a.size });
      }
    }
    const html = assets.length
      ? assets.slice(0, 8).map((a) => '<div style="margin:8px 0"><b>' + esc(a.name) + '</b><div class="sub">' + esc(a.release) + ' · ' + Math.round(a.size / 1e6) + ' MB</div><a href="' + esc(a.url) + '" target="_blank" rel="noopener">download</a></div>').join('')
      : '<p>No video assets in recent releases yet. The pipeline is ready for browser recordings to land as release assets.</p>';
    el.innerHTML = '<h2>Browser video recordings · GitHub releases</h2><div class="sub">Public releases, no token used</div>' + html + '<div class="src">Source: <a href="https://github.com/atomeam/void-loop/releases" target="_blank" rel="noopener">GitHub releases</a></div>';
    return 'video-releases';
  } catch (_) {
    if (_pageStill && !_pageStill(el)) return 'none';
    el.innerHTML = '<h2>Video release assets</h2><p>Could not read releases just now.</p>';
    return 'none';
  }
}

export default {
  name: 'video-releases',
  examples: ['video recordings pipeline', 'browser video recordings to github', 'release assets for films', 'show video release assets'],
  nearMisses: ['films', 'video', 'play a video', 'github'],
  match(lower, text) { return releasesOf(text); },
  run,
  suite() {
    return { ok: releasesOf('video recordings pipeline') && !releasesOf('hello') };
  },
};
