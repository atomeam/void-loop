// Builder Uni pass for headless verification, CI/local only. The Uni gate already accepts a bearer token
// held in localStorage ("a2m.void.uni.v1"); this helper only seeds that existing key from an env var.
// No token is written to a tracked file, and the auth middleware is unchanged. With no token set,
// verification runs as an ordinary visitor.
const KEY = 'a2m.void.uni.v1';

/** A Playwright addInitScript string, or null when no builder token is configured. */
export function builderUniInitScript(token = process.env.VERSE_BUILDER_UNI_TOKEN || '') {
  if (!token) return null;
  return `try{localStorage.setItem(${JSON.stringify(KEY)},${JSON.stringify(token)})}catch(e){}`;
}

/** Seed the builder pass on a Playwright context when a token is configured. */
export async function applyBuilderUni(ctx, token) {
  const script = builderUniInitScript(token);
  if (script) await ctx.addInitScript(script);
  return Boolean(script);
}
