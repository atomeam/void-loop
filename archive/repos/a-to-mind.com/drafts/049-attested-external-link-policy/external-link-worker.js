// Draft only. Do not deploy. emit is hard-coded false.
// GET/HEAD while unpublished returns 404. This worker does not rewrite HTML
// and does not fetch destination URLs.
export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", {
        status: 405,
        headers: { allow: "GET, HEAD", "cache-control": "no-store" }
      });
    }
    const emit = false;
    if (!emit) {
      return new Response("external link catalog unpublished\n", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-atm-emit": "false"
        }
      });
    }
    return new Response("unreachable\n", { status: 500 });
  }
};
