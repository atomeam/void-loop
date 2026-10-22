/**
 * Draft only. Not deployed. emit is false.
 * Default deny. Does not read a body. Does not decode. Does not store a gloss.
 */
export default {
  async fetch() {
    return new Response(
      JSON.stringify({
        error: "denied",
        status: "unattested",
        gloss: "withheld",
        sentence: "discarded",
        emit: false
      }),
      {
        status: 403,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          "x-void-emit": "false"
        }
      }
    );
  }
};
