export default {
  async fetch() {
    return new Response(
      "lift-not-confirm draft refuses every method. The body is not read. A pointer lift is not a confirm.",
      {
        status: 403,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store"
        }
      }
    );
  }
};
