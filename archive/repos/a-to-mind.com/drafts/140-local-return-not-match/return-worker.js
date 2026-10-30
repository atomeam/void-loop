// Draft Worker sketch. Not deployed. emit is false. Stores nothing.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const denied = ["/match", "/dream", "/insight", "/scene", "/yield", "/cue", "/sleep", "/audio", "/score"];
    if (denied.some((path) => url.pathname === path || url.pathname.startsWith(path + "/"))) {
      return new Response(
        JSON.stringify({
          status: "unattested",
          refusal: "match",
          stored: false,
          emit: false
        }),
        { status: 403, headers: { "content-type": "application/json; charset=utf-8" } }
      );
    }
    return new Response(
      JSON.stringify({
        slug: "local-return-not-match",
        status: "unattested",
        note: "draft sketch; no match stored"
      }),
      { status: 200, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
};
