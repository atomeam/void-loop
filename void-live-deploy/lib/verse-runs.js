// Verse's own copies of the fifteen automations. They run on Verse's clock, on the free model path,
// and never on Grok. At most four are taken at once. A model call counts against the daily cap.
// Owner-personal runs (stamina, fuel, the daily plan, weekend strategy, the weekly review) return a
// note and are dropped before anything is written to a public page.
import { blocksOf, publicBlocks } from './inbox-blocks.js';

export const MAX_AT_ONCE = 4;
export const DAILY_CAP = 20;

const dayKey = (d) => d.toISOString().slice(0, 10);
const hourKey = (d) => d.toISOString().slice(0, 13);
const weekKey = (d) => dayKey(d).slice(0, 7) + '-' + (d.getUTCDay() === 0 ? 'sun' : 'wk');

export const RUNS = Object.freeze([
  { id: 'capability-scout', name: 'Capability and platform scout', every: 'daily', ask: (e) => 'Name the ' + (e.skills || 'current') + ' skills Verse can run with no key, on one card' },
  { id: 'idea-extractor', name: 'Idea and action extractor', every: 'daily', ask: (e) => 'Build the oldest open frontier item: ' + (e.open || 'the oldest open item') },
  { id: 'calendar-pulse', name: 'Business calendar pulse', every: 'weekly', ask: () => 'A weekly pulse of the dated items on the frontier, with the next three only' },
  { id: 'opportunity-risk', name: 'Opportunity and risk scan', every: 'daily', ask: () => 'Name the weakest proven skill family before adding another skill' },
  { id: 'research-ships', name: 'Research that ships systems', every: 'weekly', ask: () => 'Turn one open research line into a system that has a test' },
  { id: 'weekend-strategy', name: 'Weekend strategy deep dive', every: 'weekly', private: true, ask: () => 'Three Sunday blocks: a 25 minute focus, one system to hand off, then lift the shield' },
  { id: 'stamina', name: 'Execution stamina plan', every: 'daily', private: true, ask: () => 'A work block, a rest block, and a stop. Nothing is sent.' },
  { id: 'fuel', name: 'Fuel for heavy lifting', every: 'weekly', private: true, ask: () => 'What to eat and when to stop, for the owner only' },
  { id: 'client-discovery', name: 'Client discovery practice', every: 'daily', ask: () => 'Practice one client discovery question on the handoff card' },
  { id: 'heavy-day', name: 'Heavy-lifting daily plan', every: 'daily', private: true, ask: () => 'The owner daily plan: one system to move, then stop' },
  { id: 'competitor-watch', name: 'Competitor and alternative watch', every: 'weekly', ask: (e) => 'Study ' + (e.floor || 'the next unbeaten floor') + ' with robots.txt first, then its sitemap' },
  { id: 'demand-radar', name: 'Demand and idea radar', every: 'daily', ask: (e) => 'A demand line from the miss count (' + (e.misses ?? 'the count') + '), never the words people typed' },
  { id: 'growth-delivery', name: 'Verse growth for business delivery', every: 'hourly', ask: () => 'Keep the delivery pack and the handoff cards as the path a business idea takes' },
  { id: 'weekly-review', name: 'Weekly business review', every: 'weekly', private: true, ask: () => 'The owner weekly review. It does not go on a public page.' },
  { id: 'ai-news', name: 'AI and automation news for delivery', every: 'daily', ask: (e) => actionableNews(e.news) },
]);

/** a headline becomes a delivery ask only when it names work. A backlash headline is news and is skipped. Pure. */
export function actionableNews(title) {
  const t = String(title || '').replace(/\s+/g, ' ').trim();
  if (!t || t.length < 12) return null;
  if (/\b(?:backlash|midterm|election|opinion)\b/i.test(t) && !/\b(?:build|ship|fix|skill|api|outage)\b/i.test(t)) return null;
  return 'One delivery note from public news: ' + t.slice(0, 140);
}

function stamp(run, now) {
  if (run.every === 'hourly') return hourKey(now);
  if (run.every === 'weekly') return weekKey(now);
  return dayKey(now);
}

/** true when this run should go, on this clock. Pure. */
export function isDue(run, state, now) {
  const last = state && state.last && state.last[run.id];
  if (run.every === 'hourly' && (now.getUTCDay() === 0 || now.getUTCDay() === 6)) return false;
  if (run.every === 'weekly' && now.getUTCDay() !== 0) return false;
  return last !== stamp(run, now);
}

/** at most four due runs. A run that would call the model waits once the daily cap is spent. Pure. */
export function select(runs, state, now) {
  const out = [];
  let calls = (state && state.day === dayKey(now) ? state.calls : 0) || 0;
  for (const run of runs || []) {
    if (out.length >= MAX_AT_ONCE) break;
    if (!isDue(run, state, now)) continue;
    if (run.model && calls >= DAILY_CAP) continue;
    out.push(run);
    if (run.model) calls += 1;
  }
  return out;
}

/** one run's distilled item. A private run has a note and no ask. An empty ask is skipped. Pure. */
export function distill(run, evidence) {
  const said = run.ask(evidence || {});
  if (run.private) return { id: run.id, name: run.name, private: true, note: said || '' };
  if (!said) return { id: run.id, name: run.name, private: false, skipped: 'not actionable' };
  return { id: run.id, name: run.name, private: false, ask: said, source: run.name };
}

export const publicItems = (rows) => (rows || []).filter((r) => r && !r.private && r.ask);

/** the state after these runs, with private notes left out. Pure. */
export function checkpoint(state, ran, now) {
  const last = { ...((state && state.last) || {}) };
  for (const run of ran || []) last[run.id] = stamp(run, now);
  const calls = (state && state.day === dayKey(now) ? state.calls : 0) || 0;
  return { day: dayKey(now), calls: calls + (ran || []).filter((r) => r.model).length, last };
}

/** the text form the inbox parser reads back. Private runs are marked private. Pure. */
export function asBlocks(rows, date) {
  return (rows || []).filter((r) => r && (r.ask || r.note)).map((r) => ['Growth inbox item', 'status: ' + (r.private ? 'private' : 'open'), 'date: ' + date, 'ask: ' + (r.ask || r.note), 'source: ' + r.name, 'private: ' + (r.private ? 'yes' : 'no')].join('\n')).join('\n\n');
}

/** what the existing 15-minute clock can attach: the public asks that are due. Pure. */
export function dueReport(now = new Date(), evidence) {
  const picked = select(RUNS, {}, now);
  const rows = picked.map((r) => distill(r, evidence));
  return { taken: picked.map((r) => r.id), public: publicItems(rows).map((r) => r.ask), held: rows.filter((r) => r.private).length };
}

export function roundTrip(text) {
  return publicBlocks(blocksOf(text)).map((b) => b.ask);
}
