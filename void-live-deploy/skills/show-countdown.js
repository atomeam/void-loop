/**
 * show-countdown skill — "show the countdown", "show the countdown to christmas". Evolved 2026-10-22 into one countdown with
 * skills/countdown.js: the asks are parsed by countdownOf there and the card is countdown's own (live, one per named day, never
 * stacked), so "show the countdown to christmas" now counts to Christmas instead of always New Year. New Year when no day is named.
 * Does not publish a page. An unmatched ask stays empty.
 */
import C, { countdownOf, showAskOf, daysUntil, newYearDate, daysLine } from './countdown.js';
import { clean } from '../lib/ask-text.js';

/** the countdown a "show the countdown…" ask wants, or null. Pure. */
export function showCountdownOf(text) {
  const ask = showAskOf(clean(text));
  return ask ? countdownOf(ask) : null;
}

export function countdownCard(now = new Date()) {
  const target = newYearDate(now);
  const days = daysUntil(target, now);
  return { kind: 'countdown', label: 'New Year', days, line: daysLine(days), html: '', published: false };
}

async function run(text, api) {
  if (!showCountdownOf(text)) return 'none';
  if (api.stage && api.summon) { const r = await C.run(showAskOf(clean(text)), api); if (r !== 'none') return 'show-countdown'; }
  const card = countdownCard();
  if (api.summon) api.summon('countdown', { label: card.label, days: card.days, dateText: card.line, x: 40, y: 60 });
  if (api.say) api.say(card.line + ' until ' + card.label);
  return 'show-countdown';
}

export default {
  name: 'show-countdown',
  examples: ['show the countdown', 'show countdown', 'show the days until a date', 'show the countdown to christmas'],
  nearMisses: ['days until new year', 'countdown to christmas', 'what is a countdown', 'make a clock'],
  showCountdownOf,
  countdownCard,
  match(lower, text) { return !!showCountdownOf(text || lower); },
  run,
  suite() {
    const card = countdownCard(new Date(2026, 9, 3));
    const xmas = showCountdownOf('show the countdown to christmas');
    const ok = !!showCountdownOf('show the countdown') && card.days === 90 && card.published === false && card.html === ''
      && showCountdownOf('days until new year') === null && !!xmas && xmas.label === 'Christmas';
    return { ok, got: String(card.days) + (xmas ? ' ' + xmas.label : '') };
  }
};
