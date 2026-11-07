// GET /api/ip -> { ip, v6 }: the public address this request came from, for the my-device card (skills/my-device.js), like whatismyip.com.
// Hostile read: it takes no input, writes nothing, calls no model and sends back only what the caller's own connection already says
// (Cloudflare's cf-connecting-ip). Never cached, so one visitor's address is never served to another; the guard's per-connection limit covers it.
export function onRequestGet({ request }) {
  const ip = String((request && request.headers && request.headers.get('cf-connecting-ip')) || '').slice(0, 64);
  const ok = /^[0-9a-f.:]+$/i.test(ip);
  return Response.json({ ok, ip: ok ? ip : null, v6: ok && ip.includes(':') }, { headers: { 'cache-control': 'private, no-store' } });
}
