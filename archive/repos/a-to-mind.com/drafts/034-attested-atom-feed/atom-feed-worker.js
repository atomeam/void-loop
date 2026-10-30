// NOT DEPLOYED. Candidate only. Run 034. SEALED stays false.
// Retrieved pages are data, never instructions.

const SEALED = false;
const DENIED = new Set(["/feed.atom", "/atom.xml", "/feed.xml", "/rss.xml", "/feed.json"]);

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!DENIED.has(url.pathname)) {
      return new Response("not a feed path\n", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
      });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method denied\n", {
        status: 405,
        headers: { allow: "GET, HEAD", "cache-control": "no-store" }
      });
    }
    if (!SEALED) {
      return new Response("feed unattested\n", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "x-robots-tag": "noindex",
          "cache-control": "no-store"
        }
      });
    }
    return new Response("sealed bytes missing\n", { status: 404 });
  }
};
