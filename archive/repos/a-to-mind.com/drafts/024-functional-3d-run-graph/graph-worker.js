/**
 * Optional GET-only sketch for demo-024 graph.json.
 * Does not compile shaders, open WebGL, or upgrade GET into a stream.
 * Hold-gate: do not bind this Worker to a-to-mind.com until a human seals run 024.
 */
const SNAP_SHA = "ea3ada2dabc346981aa18194bda72f33a95a5a7aee60a2dcb369127a40f9d448";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET") {
      return new Response("deny", { status: 405, headers: { allow: "GET" } });
    }
    if (url.pathname !== "/drafts/024-functional-3d-run-graph/graph.json") {
      return new Response("not this worker", { status: 404 });
    }
    const origin = new URL(request.url).origin;
    const res = await fetch(new URL("/drafts/024-functional-3d-run-graph/graph.json", origin));
    const body = await res.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=300",
        "x-snapshot-sha256": SNAP_SHA,
        "x-engine": "css-3d",
        "x-webgl": "deny",
        "x-write": "deny",
      },
    });
  },
};
