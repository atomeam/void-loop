// a-to-mind.com/emoji/<emoji or name>: a short link to how that emoji looks on every platform (/emojis/everywhere/?e=...). Cloudflare Pages does not
// fill :splat inside a query string in _redirects (live 2026-11-03: /emoji/🔥 went to ?e=%3Asplat), so the hop is made here. /emoji and /emoji/ go to
// /emojis/. Nothing is stored; read only.
/** where /emoji/<rest> should go. Pure. */
export function targetOf(pathname) {
  let rest = String(pathname || '').replace(/^\/emoji\/?/, '').replace(/\/+$/, '');
  try { rest = decodeURIComponent(rest); } catch (_) { /* keep it as typed */ }
  if (!rest) return '/emojis/';
  return '/emojis/everywhere/?e=' + encodeURIComponent(rest.slice(0, 64));
}
export const onRequest = ({ request }) => {
  const u = new URL(request.url);
  return new Response(null, { status: 302, headers: { location: new URL(targetOf(u.pathname), u.origin).href, 'cache-control': 'public, max-age=3600' } });
};
