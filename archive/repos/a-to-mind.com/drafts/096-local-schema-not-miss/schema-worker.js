export default {
  async fetch() {
    return new Response(
      "schema-not-miss draft refuses every method. The body is not read. A schema intrusion is not a collective miss.",
      {
        status: 403,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-void-emit": "false"
        }
      }
    );
  }
};
