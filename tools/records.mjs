// The records many runs append to at once, in one place: tools/merge-main.mjs keeps both sides' new entries when a branch
// meets main, and tools/revert-records.mjs settles them when verify.yml takes a commit back off main.
export const APPEND_JSON = ['tools/bench.json', 'tools/grown.json', 'tools/flakes.json', 'void-live-deploy/void.growth.json', 'void-live-deploy/exam/history.json'];
export const APPEND_TEXT = ['domains/void.agents.log.md', 'domains/handoff.md', 'domains/growth-inbox.md'];
// tools/families.mjs and void-live-deploy/skills/families.json conflict when two branches each add a skill: merge-main.mjs
// settles the source by the append-only text rule and regenerates the json from the merged tree, so neither needs a person
export const INDEX = 'void-live-deploy/skills/index.json';
// history: what happened stays written, even when the change it describes is taken back (AGENTS.md "Never")
export const HISTORY = ['void-live-deploy/void.growth.json', 'domains/void.agents.log.md'];
// the asks are keyed by their text; a growth ledger entry by when, who and what; a flake by its check and commit
export const keyOf = (f, x) => (f.endsWith('void.growth.json') ? [x.at, x.by, x.what].join('|') : f.endsWith('flakes.json') ? [x.check, x.sha].join('|') : f.endsWith('exam/history.json') ? String(x.at) : String(x.ask)).toLowerCase();
