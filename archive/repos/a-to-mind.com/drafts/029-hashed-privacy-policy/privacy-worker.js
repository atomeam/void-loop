/**
 * Draft Worker — run 029 candidate hashed-privacy-policy
 * Read-only. Not deployed. Never Set-Cookie. Never POSTs a DSAR.
 *
 * Bind this only after a human seal. Until then /privacy must not exist
 * as a live marketing route.
 */
const SEALED = false;
const SEALED_HTML = null;
const SEALED_SHA256 = null;

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("writes denied\n", {
        status: 405,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          allow: "GET, HEAD",
        },
      });
    }

    if (url.pathname === "/privacy" || url.pathname === "/privacy/" || url.pathname === "/privacy-policy") {
      if (!SEALED || !SEALED_HTML) {
        return new Response(
          "unattested. no live privacy policy route. do not invent processors.\n",
          {
            status: 404,
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "cache-control": "no-store",
              "x-a2m-privacy": "hold",
            },
          }
        );
      }

      return new Response(SEALED_HTML, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "public, max-age=86400",
          "x-a2m-privacy-sha256": SEALED_SHA256,
        },
      });
    }

    if (url.pathname === "/drafts/029-hashed-privacy-policy/meta") {
      const body = JSON.stringify({
        kind: "hashed-privacy-policy",
        sealed: SEALED,
        live_route: false,
        sale: false,
        share: false,
        third_party_pixels: false,
        generator: false,
        note: "Echo only. Not a grant. Not legal advice.",
      });
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    return new Response("not this worker\n", { status: 404 });
  },
};
