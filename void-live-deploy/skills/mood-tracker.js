/**
 * mood-tracker skill — daily mood log with a one-line trend.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "log my mood", "mood tracker", "how has my mood been".
 * Keeps the last few moods in this browser only (localStorage). Empty surface stays empty.
 */
export function moodOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:log|track|record|show|open)\s+(?:my\s+)?)?mood(?:\s+tracker|\s+log|\s+today)?$/.test(t)
    || /^how\s+has\s+my\s+mood\s+been$/.test(t);
}

function loadMoods() {
  try { return JSON.parse(localStorage.getItem('v01d.moods') || '[]'); } catch (_) { return []; }
}
function saveMoods(ms) {
  try { localStorage.setItem('v01d.moods', JSON.stringify(ms.slice(-14))); } catch (_) {}
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!moodOf(text)) return 'none';
  const moods = loadMoods();
  const el = showPage((p) => {
    const recent = moods.slice(-5).map((m) => esc(m.day) + ': ' + esc(m.mood)).join('<br>') || 'none yet';
    const trend = moods.length < 2 ? 'not enough yet' : moods[moods.length-1].score > moods[0].score ? 'up' : 'steady';
    p.innerHTML = '<h2>Mood tracker</h2><div class="sub" data-trend="' + esc(trend) + '">Recent: ' + recent + '</div><p>Say "log mood happy" or tap a mood. Kept only in this browser.</p>'
      + '<div class="moods">'
      + ['great', 'good', 'ok', 'low', 'bad'].map((m) => '<button type="button" data-mood="' + m + '">' + m + '</button>').join(' ')
      + '</div>';
    p.querySelector('.moods').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-mood]');
      if (!b) return;
      const score = { great: 5, good: 4, ok: 3, low: 2, bad: 1 }[b.dataset.mood];
      moods.push({ day: new Date().toISOString().slice(0, 10), mood: b.dataset.mood, score });
      saveMoods(moods);
      run(text, api); // redraw
    });
  });
  return 'mood-tracker';
}

export default {
  name: 'mood-tracker',
  examples: ['mood tracker', 'log my mood', 'show mood tracker', 'how has my mood been'],
  nearMisses: ['how are you', 'feelings', 'what is mood'],
  match(lower, text) { return moodOf(text); },
  run,
  suite() {
    return { ok: moodOf('mood tracker') && moodOf('log my mood') && !moodOf('hello') };
  },
};
