// The one frame of every share picture (1200 x 630), in Verse's look (void-live-deploy/verse.css, owner 2026-10-30: "a moder professional sleek
// look for everything"): deep space, Verse's mark and name, the page's name, one line, its features as chips, a foot line and the address.
// Text and colour only, no logos but Verse's own. tools/og-tool-sites.mjs and tools/og-sports.mjs draw with it. Pure: strings in, html out.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const MARK = '<svg width="44" height="44" viewBox="0 0 100 100"><defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141726"/><stop offset="1" stop-color="#050505"/></linearGradient><linearGradient id="v" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2f4fb"/><stop offset="1" stop-color="#9eb2ff"/></linearGradient></defs>'
  + '<rect width="100" height="100" rx="23" fill="url(#t)"/><rect x=".5" y=".5" width="99" height="99" rx="22.5" fill="none" stroke="#fff" stroke-opacity=".12"/><path d="M30 34.4 50 69.5 70 34.4" fill="none" stroke="url(#v)" stroke-width="9.4" stroke-linecap="round" stroke-linejoin="round"/>'
  + '<path d="M75 18c.6 3.3 1.6 4.3 4.9 4.9-3.3.6-4.3 1.6-4.9 4.9-.6-3.3-1.6-4.3-4.9-4.9 3.3-.6 4.3-1.6 4.9-4.9z" fill="#fff"/></svg>';
/** the picture's page: { title, line, chips, foot, size } (size: the title's px, by its length when left out) */
export function ogPage({ title, line = '', chips = [], foot = '', size = 0 }) {
  const px = size || (title.length > 22 ? 84 : 108);
  return `<html><body style="margin:0;width:1200px;height:630px;background:#050505;color:#f2f4fb;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;position:relative;overflow:hidden;-webkit-font-smoothing:antialiased">
<div style="position:absolute;inset:0;background:radial-gradient(900px 520px at 88% -10%,rgba(158,178,255,.20),transparent 70%),radial-gradient(700px 420px at -10% 110%,rgba(92,192,255,.08),transparent 70%)"></div>
<div style="position:absolute;left:64px;top:52px;display:flex;align-items:center;gap:14px">${MARK}<span style="font-size:30px;font-weight:650;letter-spacing:-.01em">Verse</span></div>
<div style="position:absolute;left:64px;top:132px;width:1070px;font-size:${px}px;font-weight:650;letter-spacing:-.03em;line-height:1.02">${esc(title)}</div>
<div style="position:absolute;left:64px;top:${px > 100 ? 268 : 250}px;width:1070px;font-size:36px;line-height:1.25;color:#c3c8d8">${esc(line)}</div>
<div style="position:absolute;left:64px;top:400px;width:1080px;display:flex;flex-wrap:wrap;gap:10px">${chips.map((x) => `<span style="background:#151822;border:1px solid #2d3244;border-radius:999px;padding:8px 20px;font-size:24px;color:#f2f4fb">${esc(x)}</span>`).join('')}</div>
<div style="position:absolute;left:64px;bottom:40px;width:800px;font-size:22px;color:#8e94a8">${esc(foot)}</div>
<div style="position:absolute;right:64px;bottom:40px;font-size:24px;color:#9eb2ff;font-weight:600">a-to-mind.com</div></body></html>`;
}
