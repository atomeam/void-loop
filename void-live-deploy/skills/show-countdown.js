/**
 * show-countdown skill — "show the countdown".
 * Reuses countdown.js day math. Shows days until a date (new year when none
 * is named). Does not publish a page. An unmatched ask stays empty.
 */
import { countdownOf, daysUntil, newYearDate, daysLine } from './countdown.js';

const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

export function showCountdownOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?show the countdown$/.test(t)) return { kind: 'newyear' };
  if (/^(?:please\s+)?show countdown$/.test(t)) return { kind: 'newyear' };
  if (/^(?:please\s+)?show the days until a date$/.test(t)) return { kind: 'newyear' };
  const m = t.match(/^(?:please\s+)?show the countdown to (.+)$/i);
  if (m) return { kind: 'named', label: m[1] };
  return null;
}

export function countdownCard(now = new Date()) {
  const target = newYearDate(now);
  const days = daysUntil(target, now);
  return { kind: 'countdown', label: 'New Year', days, line: daysLine(days), html: '', published: false };
}

async function run(text, api) {
  const hit = showCountdownOf(text);
  if (!hit) return 'none';
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
  match(lower, text) { return !!showCountdownOf(text); },
  run,
  suite() {
    const card = countdownCard(new Date(2026, 9, 3));
    const ok = !!showCountdownOf('show the countdown') && countdownOf('show the countdown') === null
      && card.days === 90 && card.published === false && card.html === '' && showCountdownOf('days until new year') === null;
    return { ok, got: String(card.days) };
  }
};
