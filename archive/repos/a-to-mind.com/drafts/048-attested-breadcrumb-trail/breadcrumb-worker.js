// Draft only. Do not deploy. emit is false; this Worker must not inject a trail.
export default {
  async fetch(request) {
    const method = request.method;
    if (method !== "GET" && method !== "HEAD") {
      return new Response("method not allowed", {
        status: 405,
        headers: { "allow": "GET, HEAD", "content-type": "text/plain; charset=utf-8" }
      });
    }
    const emit = false;
    if (!emit) {
      return new Response("breadcrumb emit is false\n", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "x-atm-breadcrumb": "withheld",
          "cache-control": "no-store"
        }
      });
    }
    return new Response("unreachable until a human seal sets emit true\n", { status: 404 });
  }
};
