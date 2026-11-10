#!/usr/bin/env node
// One live read of Verse's free-model brain. Prints status and a short reason. Never prints a token, an account id, or a response body over 180 characters.
const site = 'https://a-to-mind.com';
const owner = process.env.VOID_OWNER_TOKEN || '';
const account = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const token = process.env.CLOUDFLARE_AI_TOKEN || process.env.CLOUDFLARE_API_TOKEN || '';
const model = '@cf/google/gemma-4-26b-a4b-it';
const clip = (s, n = 180) => String(s || '').replace(/[A-Za-z0-9_\-]{24,}/g, '[masked]').replace(/\s+/g, ' ').trim().slice(0, n);
const say = (line) => console.log(line);

async function call(name, url, opts) {
  try {
    const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(45000) });
    const t = await r.text();
    let code = '', msg = '';
    try { const j = JSON.parse(t); const e = j && j.errors && j.errors[0]; if (e) { code = e.code || ''; msg = e.message || ''; } } catch (_) { /* not json */ }
    say(name + ' ' + r.status + (code ? ' code ' + code : '') + (msg ? ' ' + clip(msg, 120) : '') + ' body ' + clip(t));
    return { status: r.status, text: t };
  } catch (e) { say(name + ' error ' + clip(e && e.message || e, 120)); return { status: 0, text: '' }; }
}

say('owner token set: ' + (owner ? 'yes len ' + owner.length : 'no'));
say('account id set: ' + (account ? 'yes len ' + account.length + ' hex32 ' + /^[0-9a-f]{32}$/i.test(account) : 'no'));
say('cf token set: ' + (token ? 'yes len ' + token.length + ' from ' + (process.env.CLOUDFLARE_AI_TOKEN ? 'CLOUDFLARE_AI_TOKEN' : 'CLOUDFLARE_API_TOKEN') : 'no'));
say('keymaster set: ' + (process.env.CF_KEYMASTER_TOKEN ? 'yes' : 'no'));

await call('coder-get', site + '/api/coder');
if (owner) {
  await call('coder-post', site + '/api/coder', { method: 'POST', headers: { authorization: 'Bearer ' + owner, 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with the single word pong.' }], max_tokens: 32 }) });
  await call('bench', site + '/api/bench', { method: 'POST', headers: { authorization: 'Bearer ' + owner, 'content-type': 'application/json' }, body: JSON.stringify({ model, from: 0, to: 1 }) });
}
if (token && account) {
  const auth = { authorization: 'Bearer ' + token, 'content-type': 'application/json' };
  const base = 'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(account);
  await call('ai-run', base + '/ai/run/' + model, { method: 'POST', headers: auth, body: JSON.stringify({ messages: [{ role: 'user', content: 'Reply with the single word pong.' }], max_tokens: 16 }) });
  await call('ai-chat', base + '/ai/v1/chat/completions', { method: 'POST', headers: auth, body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with the single word pong.' }], max_tokens: 16 }) });
  await call('ai-models', base + '/ai/models/search?per_page=1', { headers: { authorization: 'Bearer ' + token } });
}
