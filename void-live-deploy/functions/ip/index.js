// a-to-mind.com/ip: your public address, assimilated from icanhazip.com (owner, 2026-11-06: the smallest site first; its home page has 0
// interactive elements and is about 14 bytes of plain text). The same address answers three ways: plain text with a newline for curl and scripts,
// exactly like icanhazip.com, a page for a person (the address large, whether it is IPv4 or IPv6, how to fetch it from a terminal; no script,
// nothing to press), and JSON (?format=json or Accept: application/json). The address is Cloudflare's cf-connecting-ip for this request only:
// never stored, never cached (private, no-store), so one visitor's address is never served to another.
//   curl a-to-mind.com/ip     a-to-mind.com/ip (a browser)     a-to-mind.com/ip?format=json
export const ipOf = (request) => { const ip = String((request && request.headers && request.headers.get('cf-connecting-ip')) || '').slice(0, 64); return /^[0-9a-f.:]+$/i.test(ip) ? ip : null; };
/** which answer the request wants: 'json', 'html' or 'text'. A browser asks for text/html first; curl asks for anything. Pure. */
export function formatOf(url, accept = '') {
  const f = String(new URL(url).searchParams.get('format') || '').toLowerCase();
  if (f === 'json' || f === 'text' || f === 'html') return f;
  const a = String(accept || '').toLowerCase();
  return /^application\/json/.test(a) ? 'json' : /text\/html/.test(a) ? 'html' : 'text';
}
/** the page a person sees: the address, its family, the one line to get it from a terminal. No script, no control. Pure. */
export function page(ip) {
  const fam = !ip ? '' : ip.includes(':') ? 'IPv6' : 'IPv4';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + (ip ? 'Your IP: ' + ip : 'Your IP address') + '</title>'
    + '<meta name="description" content="Your public IP address, as plain text for scripts (curl a-to-mind.com/ip) and as a page."><meta property="og:title" content="What is my IP address"><meta name="color-scheme" content="dark">'
    + '<style>html{background:#05060a;color:#e8e6ff;font:16px/1.4 system-ui,sans-serif}body{margin:0;min-height:100vh;display:grid;place-content:center;text-align:center;padding:16px}'
    + 'h1{font-size:14px;font-weight:500;color:#9a98c0;margin:0 0 8px}output{display:block;font:700 clamp(28px,9vw,88px)/1.1 ui-monospace,monospace;word-break:break-all;user-select:all}'
    + 'p{color:#9a98c0;margin:12px 0 0}code{color:#c9b8ff}</style></head><body><main><h1>Your public IP address</h1><output>' + (ip || 'not available') + '</output>'
    + '<p>' + fam + (fam ? ' · ' : '') + 'from a terminal: <code>curl a-to-mind.com/ip</code></p></main></body></html>';
}
export function onRequestGet({ request }) {
  const ip = ipOf(request), fmt = formatOf(request.url, request.headers.get('accept')), headers = { 'cache-control': 'private, no-store', 'access-control-allow-origin': '*', vary: 'accept' };
  if (fmt === 'json') return Response.json({ ok: !!ip, ip, v6: !!ip && ip.includes(':') }, { headers });
  if (fmt === 'html') return new Response(page(ip), { headers: { ...headers, 'content-type': 'text/html; charset=utf-8' } });
  return new Response((ip || 'unknown') + '\n', { status: ip ? 200 : 503, headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' } });
}
