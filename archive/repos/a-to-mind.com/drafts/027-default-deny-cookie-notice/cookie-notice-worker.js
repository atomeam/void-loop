/**
 * Draft Worker — run 027 candidate default-deny-cookie-notice
 * Read-only. Not deployed. Never Set-Cookie. Never proxies a CMP.
 *
 * Bind this only after a human seal. Until then the file is a sketch.
 */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const gpcHeader = request.headers.get("Sec-GPC") === "1";

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("writes denied", {
        status: 405,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    if (url.pathname === "/.well-known/gpc.json") {
      const body = JSON.stringify({
        gpc: true,
        lastUpdate: null,
        attested: false,
        hold: true,
        secGpcSeen: gpcHeader,
      });
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-a2m-set-cookie": "deny",
        },
      });
    }

    if (url.pathname === "/drafts/027-default-deny-cookie-notice/gpc-echo") {
      const body = JSON.stringify({
        kind: "gpc-echo",
        secGpc: gpcHeader,
        sale: false,
        share: false,
        setCookie: false,
        note: "Echo only. Not a grant. Not a CMP.",
      });
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    return new Response("not this worker", { status: 404 });
  },
};
