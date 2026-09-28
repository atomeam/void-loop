/**
 * calendar skill — a quiet timeline on the stage, from the same input as everything else.
 * No date picker, no account, no third-party script. Events live in this browser only.
 * Contract: { name, examples, match(lower, text), run(text, api) }
 *
 * Gated asks ("add X to my calendar", "schedule a meeting with …") stay on the confirm line.
 * This file only shows the local agenda and adds events that are not those gated sentences.
 */
const KEY = 'a2m.void.agenda.v1';
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
};
const DAY = DAYS.join('|');
const MON = Object.keys(MONTHS).join('|');

const CLEAN = (s) => String(s || '').replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();

function gated(text) {
  const s = CLEAN(text).replace(/^(?:please\s+)/i, '');
  return /^(?:add|put)\s+.+