// A throwaway Worker for tools/model-eval.mjs (run with `wrangler dev --remote`, never deployed): POST {model, input} runs
// env.AI.run(model, input) on the real Workers AI and returns the raw result, so the eval sees exactly what a Pages Function would.
export default { async fetch(req, env) {
  if (req.method !== 'POST') return new Response('POST {model, input}', { status: 405 });
  const { model, input } = await req.json();
  const t = Date.now();
  try { return Response.json({ ok: true, ms: Date.now() - t, result: await env.AI.run(model, input) }); }
  catch (e) { return Response.json({ ok: false, ms: Date.now() - t, error: String(e).slice(0, 300) }); }
} };
