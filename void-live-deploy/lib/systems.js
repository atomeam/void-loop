// Verse's system of systems (docs/systems.md): one flow, one owner per stage, and every loop in .github/workflows placed in exactly one
// stage. A workflow added without a place here is not hidden: the owner view lists it under "Not in the map yet" and tools/systems.test.mjs
// prints it, so the map is kept up with what runs (a hard failure would turn main red for a pull request that only added a loop). GET /api/loops (owner only) joins this with the loop census (tools/loop-census.mjs) and /progress/ draws it.
// Pure: no fetch, no clock.

/** the flow, in order. `owner` is the one piece that decides for the stage; the other pieces in it feed that owner or do its work. */
export const STAGES = Object.freeze([
  { id: 'signals', name: 'Signals', owner: 'the brain\'s senses (docs/brain.md)', job: 'what people ask and miss, what rivals offer, what the live site and the world show' },
  { id: 'ideas', name: 'Ideas', owner: 'the idea engine (the will, functions/api/will.js)', job: 'turn signals and Verse\'s own wants into candidate jobs, after checking what Verse already has' },
  { id: 'prioritize', name: 'Prioritize', owner: 'the conductor (tools/conductor-core.mjs)', job: 'one queue (/api/queue), ranked; the most valuable job goes to each idle builder' },
  { id: 'build', name: 'Build', owner: 'the conductor\'s builders', job: 'make the change on a branch and open a pull request' },
  { id: 'gate', name: 'Stranger test', owner: 'the stranger-test gate (void-review, then the merge gate)', job: 'nothing merges that a stranger would find broken, ugly, worse than the best rival, or untrue' },
  { id: 'ship', name: 'Ship', owner: 'automerge (tools/automerge.mjs) and deploy.yml', job: 'merge what passed and put it live' },
  { id: 'measure', name: 'Measure live', owner: 'the live checks after each deploy (verify, self-check, site-test, the exam)', job: 'check the live site the way a visitor uses it; red reverts' },
  { id: 'feedback', name: 'Feedback', owner: 'the brain\'s lessons (will-outcome, the nightly sleep)', job: 'settle each job by its measured result and keep the lesson for the next idea' },
]);
/** lanes beside the flow: they keep the product's data and the house running, and feed signals, but do not choose work. */
export const LANES = Object.freeze([
  { id: 'clock', name: 'Clock', owner: 'the conductor\'s chain (grow-clock.yml, placed under Prioritize)', job: 'start everything on time; GitHub\'s cron is only the backup' },
  { id: 'feeds', name: 'Data feeds', owner: 'each card\'s own snapshot', job: 'keep the cards\' data current (prices, jobs, reefs, trials)' },
  { id: 'house', name: 'Keys, money and copies', owner: 'the treasury and the key keeper', job: 'keys, secrets, money and the off-site copy' },
]);

/** every workflow file, by stage or lane. A workflow is in exactly one. */
export const PLACE = Object.freeze({
  signals: ['misses-snapshot.yml', 'traffic.yml', 'verse-watch.yml', 'gaps.yml', 'feature-scan.yml', 'site-re.yml', 'site-scout.yml', 'site-history.yml',
    'easiest-sites.yml', 'tower-rank.yml', 'tower-size.yml', 'rea-study.yml', 'actions-failures.yml', 'genre-refs.yml', 'site-icons.yml', 'free-pics-probe.yml'],
  ideas: ['will.yml', 'brain-dream.yml', 'bot-factory.yml', 'recruit.yml', 'house-loops.yml', 'learn.yml', 'void-voice.yml', 'probe-asks.yml',
    'review-main.yml', 'grow-self.yml', 'dispatcher.yml', 'think-tank.yml'],
  prioritize: ['grow-clock.yml'],
  build: ['propose-fix.yml', 'build-miss.yml', 'store-gap.yml', 'verse-job.yml', 'verse-engineer.yml', 'verse-loop.yml', 'pr-fix.yml', 'design-loop.yml',
    'word-sweep.yml', 'upkeep.yml', 'autosalvage.yml', 'lab-sync.yml', 'arena.yml', 'shorts.yml', 'verse-podcast.yml', 'modal-sing.yml', 'helper-pr.yml',
    'clips.yml', 'record.yml', 'assemble-growth.yml'],
  gate: ['void-review.yml', 'loop-critic.yml', 'merge-gate.yml', 'suite-gate.yml', 'collide.yml', 'floor-live.yml', 'touch-webkit.yml', 'workflow-lint.yml',
    'bench.yml', 'team-gate.yml'],
  ship: ['automerge.yml', 'deploy.yml', 'deploy-workers.yml', 'mcp-registry.yml', 'pages-ai-keys.yml', 'github-webhook-secret.yml', 'automations-seed.yml',
    'growth-fold.yml'],
  measure: ['verify.yml', 'self-check.yml', 'site-test.yml', 'exam.yml', 'tower-gate.yml', 'live-revert.yml', 'pages-guard.yml', 'watchdog.yml', 'x402-live.yml',
    'mcp-live.yml', 'team-live.yml', 'video-gen-live.yml', 'image-gen-live.yml', 'rides-live.yml', 'baggage-live.yml', 'films-live.yml', 'appraise-live.yml',
    'edge-cache-live.yml', 'trading-bots-live.yml', 'store-check.yml', 'visual.yml', 'subject-eval.yml', 'review-bench.yml', 'model-bench.yml',
    'route-bench.yml', 'clef-probe.yml', 'studio-look.yml', 'art-look.yml', 'ask-void.yml', 'better.yml', 'rehearsal.yml', 'ouroboros.yml',
    'perf-budget.yml', 'tower-compound.yml'],
  feedback: ['will-outcome.yml'],
  clock: ['void-tick.yml'],
  feeds: ['arb-record.yml', 'coins-snapshot.yml', 'jobs-snapshot.yml', 'trading-bots-data.yml', 'reefwatch.yml', 'trialwatch.yml'],
  house: ['treasury.yml', 'reinvest.yml', 'key-keeper.yml', 'mirror.yml', 'cf-scope.yml'],
});

/** the stage or lane a workflow file is in, or null. Pure. */
export function placeOf(wf) {
  for (const [id, list] of Object.entries(PLACE)) if (list.includes(wf)) return id;
  return null;
}

const PROBLEM = new Set(['failing', 'last run failed', 'behind', 'never ran', 'idle', 'unread']);
/** the owner's systems view: each stage and lane with its owner, its loops from the census and how many need a look. census: the
 *  loop census ({ rows: [{ wf, name, status, ran24, minutesPerDay }] }) or null. Pure. */
export function systemsOf(census) {
  const rows = (census && Array.isArray(census.rows)) ? census.rows : [];
  const byWf = new Map(rows.map((r) => [r.wf, r]));
  const one = (s, kind) => {
    const loops = (PLACE[s.id] || []).map((wf) => {
      const r = byWf.get(wf);
      return { wf, name: r ? r.name : wf, status: r ? r.status : 'not counted yet', ran24: r ? r.ran24 : null };
    });
    return { ...s, kind, loops: loops.length, working: loops.filter((l) => l.status === 'working' || l.status === 'on pull requests').length,
      look: loops.filter((l) => PROBLEM.has(l.status)).map((l) => ({ wf: l.wf, name: l.name, status: l.status })), runs24: loops.reduce((n, l) => n + (l.ran24 || 0), 0) };
  };
  const placed = new Set(Object.values(PLACE).flat());
  return { stages: STAGES.map((s) => one(s, 'stage')), lanes: LANES.map((s) => one(s, 'lane')), unplaced: rows.map((r) => r.wf).filter((wf) => !placed.has(wf)) };
}
