// HTTP functions exposed at https://<site-domain>/_functions/<functionName>
// Added by the autonomous ops council (Aether). ADDITIVE ONLY — no page code touched.
// Docs: https://dev.wix.com/docs/velo/apis/wix-http-functions/introduction

import { ok } from 'wix-http-functions';

// GET /_functions/health — proves the GitHub -> Velo publish lane end-to-end.
// A 200 JSON response from the live site means: git push to main = site publish,
// with no human in the loop.
export function get_health(request) {
	return ok({
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			status: 'ok',
			channel: 'github-velo-publish',
			version: 1,
			publishedAt: '2026-06-12T05:15:00Z',
		}),
	});
}
