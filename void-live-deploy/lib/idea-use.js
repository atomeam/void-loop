// The use counter the idea engine's wants name. A page calls ideaUsed(slug) when someone actually uses the thing
// the idea became. The count is days, not raw asks. Nothing typed is stored here.
export function ideaUsed(slug, days = 1) {
  const id = 'idea-' + String(slug || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
  return { id, days: Math.max(0, Math.floor(+days || 0)) };
}
