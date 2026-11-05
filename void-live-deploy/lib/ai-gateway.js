// Free models through AI Gateway aliases (Cloudflare, 2026-08-07: env.AI.run(model, input, { gateway: { id } })).
// An alias is used only when it names a Workers AI model on the free allowance. A paid-plan model, the paid
// answer model, and a catalog model (Unified Billing) never get a gateway call from here. With no AI_GATEWAY_ID
// the call is the binding alone, the same two-argument run as before, so nothing new is spent.
import { FREE_MODEL, PAID_MODEL, PAID_PLAN_MODELS, GATEWAY_ALIASES, VIDEO_MODELS } from './models.js';

const VIDEO = new Set(Object.values(VIDEO_MODELS));
const PAID_PLAN = new Set(PAID_PLAN_MODELS);

/** a Workers AI id that still runs on the free neuron allowance. Pure. */
export function isFreeAllowance(id) {
  return typeof id === 'string' && id.startsWith('@cf/') && id !== PAID_MODEL && !PAID_PLAN.has(id) && !VIDEO.has(id);
}

/** alias or raw id, or null when it is not a free-allowance model. Pure. */
export function resolveFree(name) {
  const id = Object.prototype.hasOwnProperty.call(GATEWAY_ALIASES, name) ? GATEWAY_ALIASES[name] : name;
  return isFreeAllowance(id) ? id : null;
}

/**
 * Models Grok named on 2026-11-05, judged against Cloudflare's catalog (read 2026-11-05).
 * Neither is a free alias. Kimi K3.1 has no Workers AI id. The Kimi models that do exist
 * (K2.6, K2.7 Code) require the Workers Paid plan. Gemini Office tools are catalog models
 * billed through AI Gateway Unified Billing, which spends credits.
 */
export const EVALUATED = Object.freeze([
  { name: 'Kimi K3.1', free: false, why: 'No Workers AI id. Kimi K2.6 and K2.7 Code require the Workers Paid plan (changelog 2026-07-28).' },
  { name: 'Gemini Office tools', free: false, why: 'Catalog Gemini models bill through AI Gateway Unified Billing. They are not on the free neuron allowance.' },
]);

const GATEWAY_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** the third argument for a free model, or null when the gateway is unset or the model is not free. Pure. */
export function gatewayOptions(env, id) {
  if (!isFreeAllowance(id)) return null;
  const raw = env && (env.AI_GATEWAY_ID || env.AI_GATEWAY);
  if (typeof raw !== 'string' || !GATEWAY_ID.test(raw.trim())) return null;
  return { gateway: { id: raw.trim() } };
}

/** run a free alias or a free model. Refuses anything that would spend. */
export async function runFree(env, name, input) {
  const id = resolveFree(name);
  if (!id) throw new Error('not a free model');
  const ai = env && env.AI;
  if (!ai || typeof ai.run !== 'function') throw new Error('no AI binding');
  const opts = gatewayOptions(env, id);
  return opts ? ai.run(id, input, opts) : ai.run(id, input);
}

export { FREE_MODEL };
