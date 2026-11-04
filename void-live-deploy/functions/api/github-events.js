// POST /api/github-events: GitHub's webhooks start the owner's automations with when.on 'github' (lib/automations.js githubEvent,
// lib/automations-run.js fire; owner, 2026-11-03: GitHub events as an automation trigger, our own Zapier). Point a repository or
// organisation webhook (content type application/json) at https://a-to-mind.com/api/github-events with the secret in the
// GITHUB_WEBHOOK_SECRET env var.
// WHAT A STRANGER COULD MAKE THIS DO: nothing without the secret. Every delivery must carry X-Hub-Signature-256, the HMAC-SHA256 of
// the exact body under GITHUB_WEBHOOK_SECRET, checked in constant time before the body is parsed; no secret set = 503. A signed
// delivery runs only the owner's enabled 'github' rules, each under the day cap a webhook has (RUN_CAP_DAY), and the event they
// see is trimmed to the usual fields. A ping (GitHub's test delivery) answers pong and runs nothing.
import { fire } from '../../lib/automations-run.js';
import { githubEvent } from '../../lib/automations.js';

const reply = (status, body) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

/** GitHub's signature check: 'sha256=' + HMAC-SHA256(secret, body) in hex, compared in constant time. -> true when it matches */
export async function signedOk(secret, raw, given) {
  if (!secret || typeof given !== 'string' || !/^sha256=[0-9a-f]{64}$/.test(given)) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const want = 'sha256=' + hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  let diff = want.length ^ given.length;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ given.charCodeAt(i % given.length);
  return diff === 0;
}

export async function onRequestPost({ request, env, waitUntil, fireFn = fire }) {
  if (!env || !env.GITHUB_WEBHOOK_SECRET) return reply(503, { ok: false, error: 'GitHub events are not set up yet (GITHUB_WEBHOOK_SECRET)' });
  const raw = await request.text();
  if (!(await signedOk(env.GITHUB_WEBHOOK_SECRET, raw, request.headers.get('x-hub-signature-256') || ''))) return reply(401, { ok: false, error: 'bad signature' });
  const name = String(request.headers.get('x-github-event') || '').slice(0, 40), delivery = request.headers.get('x-github-delivery') || '';
  if (!/^[a-z_]{2,40}$/.test(name)) return reply(400, { ok: false, error: 'no X-GitHub-Event' });
  if (name === 'ping') return reply(200, { ok: true, pong: true });
  let body;
  try { body = JSON.parse(raw); } catch (_) { return reply(400, { ok: false, error: 'send the webhook as application/json' }); }
  const fired = fireFn(env, 'github', githubEvent(name, delivery, body));
  if (typeof waitUntil === 'function') { try { waitUntil(fired); } catch (_) {} return reply(202, { ok: true, event: name }); }
  return reply(200, { ok: true, event: name, ran: await fired });
}

export const onRequestGet = () => reply(405, { ok: false, error: 'GitHub sends events here by POST, signed; see the automations card' });
