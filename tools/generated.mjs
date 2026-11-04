// Files the deploy writes from something else (an order file, a ledger entry, a measurement). A pull request
// does not edit them: two branches that each rewrite the same aggregate always conflict, and the deploy
// (deploy.yml, tools/refresh.mjs) writes the copy the site serves. tools/pre-pr.mjs refuses a branch that
// committed one. tools/merge-main.mjs settles a conflict in one by regenerating it.
export const BUILD_OUTPUTS = [
  'void-live-deploy/skills/index.json',
  'void-live-deploy/skills/deps.json',
  'void-live-deploy/skills/families.json',
  'void-live-deploy/skills/guide.json',
  'void-live-deploy/skills/what.json',
  'void-live-deploy/skills/bench-alarms.json',
  'void-live-deploy/self.json',
  'void-live-deploy/void.asks.json',
  'void-live-deploy/churn.json',
  'void-live-deploy/assimilated.json',
  'void-live-deploy/sitemap.xml',
  'void-live-deploy/parity.json',
  'void-live-deploy/incidents.json',
  'void-live-deploy/tower.evidence.json',
  'void-live-deploy/lib/similar-index.js',
];

/** paths in `files` that are build outputs. Pure. */
export function generatedTouched(files, list = BUILD_OUTPUTS) {
  const set = new Set(list);
  return [...new Set(files || [])].filter((f) => set.has(f));
}
