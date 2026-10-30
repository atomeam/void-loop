// Draft Worker sketch. Not deployed. emit is false. Stores nothing.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const denied = ["/long", "/duration", "/ms", "/clock", "/stretch", "/elapsed"];
    if (denied.some((path) => url.pathname === path || url.pathname.startsWith(path + "/"))) {
      return new Response(
        JSON.stringify({
          status: "unattested",
          refusal: "long",
          stored: false,
          emit: false
        }),
        { status: 403, headers: { "content-type": "application/json; charset=utf-8" } }
      );
    }
    return new Response(
      JSON.stringify({
        slug: "local-before-not-long",
        status: "unattested",
        note: "draft sketch; no length stored"
      }),
      { status: 200, headers: { "content-type": "application/json; charset=utf-8" } }
    );
  }
};
