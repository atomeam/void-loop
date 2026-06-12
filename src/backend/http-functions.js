// HTTP functions exposed at https://<site-domain>/_functions/<functionName>
// Added by the autonomous ops council (Aether). ADDITIVE ONLY — no page code touched.
// Docs: https://dev.wix.com/docs/velo/apis/wix-http-functions/introduction

import { ok, badRequest } from 'wix-http-functions';
import { fetch } from 'wix-fetch';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// GET /_functions/health — proves the GitHub -> Velo publish lane end-to-end.
// A 200 JSON response from the live site means: git push to main = site publish,
// with no human in the loop.
export function get_health(request) {
	return ok({
		headers: JSON_HEADERS,
		body: JSON.stringify({
			status: 'ok',
			channel: 'github-velo-publish',
			version: 2,
			endpoints: ['get_health', 'get_offer', 'post_lead'],
		}),
	});
}

// GET /_functions/offer — machine-readable offer surface. Any frontend (apex SPA,
// aether pages, emails) can read this to render the current checkout path.
export function get_offer(request) {
	return ok({
		headers: JSON_HEADERS,
		body: JSON.stringify({
			offer: 'AI operations automation',
			rail: 'wix-storefront',
			status: 'live',
			note: 'Purchase via the Wix storefront. Lead capture: POST /_functions/lead {email, note}.',
		}),
	});
}

// POST /_functions/lead — forwards {email, note} to the bridge lead store (D1).
// Gives the storefront zero-infrastructure lead capture wired into the existing
// pipeline at https://bridge.a-to-mind.com/api/leads.
export async function post_lead(request) {
	let data;
	try {
		const text = await request.body.text();
		data = JSON.parse(text || '{}');
	} catch (e) {
		return badRequest({
			headers: JSON_HEADERS,
			body: JSON.stringify({ error: 'invalid JSON payload' }),
		});
	}
	if (!data || typeof data.email !== 'string' || !data.email.includes('@')) {
		return badRequest({
			headers: JSON_HEADERS,
			body: JSON.stringify({ error: 'email (string) is required' }),
		});
	}
	const upstream = await fetch('https://bridge.a-to-mind.com/api/leads', {
		method: 'post',
		headers: JSON_HEADERS,
		body: JSON.stringify({
			email: data.email,
			note: typeof data.note === 'string' ? data.note : '',
			source: 'wix-storefront',
		}),
	});
	return ok({
		headers: JSON_HEADERS,
		body: JSON.stringify({ forwarded: upstream.ok, upstreamStatus: upstream.status }),
	});
}
