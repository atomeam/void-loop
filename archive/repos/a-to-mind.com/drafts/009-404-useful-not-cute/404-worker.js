// Draft Worker sketch — run 009. Hold-gate. Do not attach until a human seals.
//
// Preferred host: Cloudflare Pages with a root 404.html. Pages already
// returns that file with HTTP 404. This Worker is only for a later
// custom domain that serves assets through ASSETS and would otherwise
// collapse a miss to 200 or to the homepage.
//
// Rules this file must not break:
// - Missing paths stay 404. Never 200. Never 301 to /.
// - No countdown. No cookie. No email capture. No model call.
// - The requested URL is not forwarded to a generator.
// - X-Robots-Tag stays noindex on the miss body.

const ROBOTS = "noindex, nofollow";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) return asset;

      const miss = await env.ASSETS.fetch(new URL("/404.html", url.origin));
      const body = miss.ok ? miss.body : "This path is not in the sealed catalog.\n";
      const type = miss.ok ? "text/html; charset=utf-8" : "text/plain; charset=utf-8";
      return new Response(body, {
        status: 404,
        headers: {
          "content-type": type,
          "x-robots-tag": ROBOTS,
          "cache-control": "public, max-age=60",
          "x-a-to-mind-miss": "catalog"
        }
      });
    }

    return new Response("This path is not in the sealed catalog.\n", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-robots-tag": ROBOTS
      }
    });
  }
};
