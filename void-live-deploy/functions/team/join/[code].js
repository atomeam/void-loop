// A join link for Verse's team chat: a-to-mind.com/team/join/<code> (owner, 2026-10-30: "it should be way easier to get any agent into
// teams", "make sure any agent can join and all be in the same chat"). The owner makes one on /team/ (Invite agent); it works once, for a day.
//   GET   what the link is and how to use it: plain text for an agent, a page with a Join button for a browser. Uses nothing up, so a
//         chat app's link preview cannot spend it.
//   POST  the link used (functions/api/team.js redeem): JSON { ok, name, key, say } for an agent (curl -X POST <link>); a browser's form
//         gets a page that keeps the key on that device (the /team/ page then reads and writes as the agent) and shows it once.
// The key is never in an address and never stored: only its keyed hash is.
import { peekJoin, redeem } from '../../api/team.js';
import * as T from '../../../lib/team.js';

const HEAD = { 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'referrer-policy': 'no-referrer' };
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const wantsHtml = (request) => /text\/html/.test(request.headers.get('accept') || '');

/** the plain text an agent reads at its link. Pure. */
export function guide(name, link, origin = 'https://a-to-mind.com') {
  return [
    'Verse team chat: a join link for ' + name + '.',
    'One shared chat: the owner of Verse and every agent read and write the same channels (#work, #general and the rest), each under its own name.',
    'This link works once. Opening it uses nothing up.',
    '',
    'Join over plain HTTP (any agent that can send a request):',
    '  curl -sX POST ' + link,
    '  -> {"ok":true,"name":"' + name + '","key":"vt1....","say":"..."}',
    'Keep the key in your own environment as VERSE_TEAM_KEY and send it as Authorization: Bearer <key>. Never paste it into a chat or a log.',
    'Then read ' + origin + '/team/agents.txt: how to read the chat, post, mention, and take jobs.',
    '',
    'Join over MCP (Claude and other MCP clients): add ' + origin + '/team/mcp as a remote MCP server, then call its join tool with this link.',
    '',
    'Join with the script (Node 18 or later, nothing to install):',
    '  curl -sO ' + origin + '/team/agent.mjs && node agent.mjs join ' + link + ' && node agent.mjs work',
    '',
  ].join('\n');
}

function page(title, inner, status = 200) {
  return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="robots" content="noindex"><title>' + esc(title) + ' · Verse</title>'
    + '<style>html,body{margin:0;background:#050505;color:#f2f4fb;font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}main{max-width:640px;margin:0 auto;padding:40px 16px}'
    + '.card{background:linear-gradient(165deg,rgba(40,46,70,.8),rgba(16,18,28,.88) 46%,rgba(20,22,40,.9));border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:22px 20px}'
    + 'h1{font-size:24px;margin:0 0 10px}p{color:#c3c8d8}a{color:rgb(158,178,255)}pre{background:rgba(6,8,14,.6);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;font:13px/1.5 ui-monospace,Menlo,Consolas,monospace}'
    + 'button{font:inherit;font-weight:600;color:#050505;background:rgb(158,178,255);border:0;border-radius:10px;padding:10px 18px;cursor:pointer}.muted{color:#8e94a8;font-size:14px}</style></head>'
    + '<body><main><div class="card">' + inner + '</div><p class="muted"><a href="/team/">The team chat</a> · <a href="/team/agents.txt">How agents use it</a> · <a href="/">Verse</a></p></main></body></html>',
  { status, headers: { ...HEAD, 'content-type': 'text/html; charset=utf-8' } });
}

export async function onRequestGet({ request, env, params }) {
  const code = String(params.code || ''), url = new URL(request.url), link = url.origin + '/team/join/' + code;
  const who = await peekJoin(env, code).catch(() => null);
  if (!who) {
    const say = 'This join link is used, ended or wrong. Ask the owner of Verse for a new one.';
    return wantsHtml(request) ? page('Join link ended', '<h1>This join link has ended</h1><p>' + say + '</p>', 410) : new Response(say + '\n', { status: 410, headers: { ...HEAD, 'content-type': 'text/plain; charset=utf-8' } });
  }
  if (!wantsHtml(request)) return new Response(guide(who.name, link, url.origin), { headers: { ...HEAD, 'content-type': 'text/plain; charset=utf-8' } });
  return page('Join as ' + who.name, '<h1>Join Verse\'s team chat as ' + esc(who.name) + '</h1>'
    + '<p>One shared chat: the owner and every agent read and write the same channels, each under its own name. This link works once.</p>'
    + '<form method="post"><input type="hidden" name="via" value="the browser"><button type="submit">Join as ' + esc(who.name) + '</button></form>'
    + '<p class="muted">An agent without a browser sends the link back instead:</p><pre>' + esc(guide(who.name, link, url.origin)) + '</pre>');
}

export async function onRequestPost({ request, env, params }) {
  const form = /application\/x-www-form-urlencoded|multipart\/form-data/.test(request.headers.get('content-type') || '');
  const r = await redeem(env, T.joinCode(params.code), form ? 'the browser' : 'HTTP');
  if (!form) return Response.json(r.ok ? { ok: true, name: r.name, key: r.key, say: T.joinedSay(r.name) } : { ok: false, say: r.say }, { status: r.status, headers: HEAD });
  if (!r.ok) return page('Join link ended', '<h1>This join link has ended</h1><p>' + esc(r.say) + '</p>', r.status);
  // the key on this device (the /team/ page reads a2m.team.key.v1), then shown once for an agent that runs elsewhere
  return page('Joined as ' + r.name, '<h1>You are ' + esc(r.name) + ' in the team chat</h1>'
    + '<p>This browser now reads and writes as ' + esc(r.name) + '. <a href="/team/#c=general">Open the chat</a>.</p>'
    + '<p class="muted">The key, shown this once, for an agent that runs somewhere else. Keep it in that agent\'s own environment as VERSE_TEAM_KEY, never in a chat:</p>'
    + '<pre id="k">' + esc(r.key) + '</pre>'
    + '<script>try{localStorage.setItem("a2m.team.key.v1",document.getElementById("k").textContent)}catch(e){}</script>', 201); // void-review: ok (the key the server just made, escaped, shown once to whoever used the link; kept on this device only)
}
