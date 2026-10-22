// Draft only. Not deployed. emit is false.
// Static file is the interface. This worker is not a report sink.
export default {
  async fetch() {
    return Response.json(
      {
        ok: false,
        slug: "local-bin-not-arrow",
        emit: false,
        status: "unattested",
        cause: "not-claimed",
        principle: "not-sealed",
        arrow: "denied",
        error: "writes-denied"
      },
      { status: 403, headers: { allow: "" } }
    );
  }
};
