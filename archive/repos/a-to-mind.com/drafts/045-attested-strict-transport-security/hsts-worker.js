/**
 * Draft 045 worker sketch. Not deployed.
 * GET/HEAD only. emit is false, so this 404 does not set Strict-Transport-Security.
 * A 404 that sends HSTS would still teach the browser the policy. Do not do that.
 */
export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", {
        status: 405,
        headers: { "cache-control": "no-store", "x-atm-hsts": "absent-until-seal" }
      });
    }
    const emit = false;
    if (!emit) {
      return new Response("strict-transport-security unpublished", {
        status: 404,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-atm-hsts": "absent-until-seal"
        }
      });
    }
    return new Response("sealed emit is not in this draft", { status: 501 });
  }
};
