// referrer-worker.js — sketch only. Do not deploy.
// emit is false. This worker must not set Referrer-Policy.
// A 404 from this sketch is not an attestation that the live zone sends no-referrer.

const EMIT = false;
const WITHHELD = new Set([
  "/.well-known/referrer-policy.json",
  "/referrer-policy",
]);

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", {
        status: 405,
        headers: { allow: "GET, HEAD", "cache-control": "no-store" },
      });
    }
    const url = new URL(request.url);
    if (!EMIT || WITHHELD.has(url.pathname)) {
      return new Response("referrer policy withheld until human seal", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-atm-emit": "false",
        },
      });
    }
    return new Response("emit true is not reachable in this draft", { status: 404 });
  },
};
