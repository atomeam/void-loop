/**
 * mood-log skill — logs a feeling and shows a simple streak card.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "log my mood happy", "how do I feel", "mood log". Empty surface stays empty.
 * Stored in localStorage only.
 */
export function moodOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:log|record|set|mark)\s+(?:my\s+)?mood\s+(?:as\s+)?(.+)$/) || t.match(/^(?:i\s+feel|feeling)\s+(.+)$/);
  return m ? m[1].trim() : (/^(?:mood\s+log|show\s+(?:my\s+)?moods?)$/.test(t) ? 'show' : null);
}

function load() { try { return JSON.parse(localStorage.getItem('v01d.moods') || '[]'); } catch { return []; } }
function save(list) { try { localStorage.setItem('v01d.moods', JSON.stringify(list.slice(-30))); } catch {} }

async function run(text, api) {
  const what = moodOf(text);
  if (!what) return 'none';
  const { showPage, esc } = api;
  const list = load();
  if (what !== 'show') {
    list.push({ at: new Date().toISOString().slice(0, 10), mood: what });
    save(list);
  }
  showPage((p) => {
    const recent = list.slice(-7).map((x) => '<li>' + esc(x.at) + ': ' + esc(x.mood) + '</li>').join('');
    p.innerHTML = '<h2>Mood log</h2><div class="sub">' + (what === 'show' ? 'Recent entries' : 'Logged: ' + esc(what)) + '</div>' +
      '<ul>' + (recent || '<li>none yet</li>') + '</ul><div class="src">Kept in this browser only</div>';
  });
  return 'mood-log';
}

export default {
  name: 'mood-log',
  examples: ['log my mood happy', 'i feel calm', 'mood log', 'show my moods'],
  nearMisses: ['feelings', 'how are you', 'mood'],
  match(lower, text) { return !!moodOf(text); },
  run,
  suite() {
    return { ok: moodOf('log my mood happy') === 'happy' && moodOf('hello') === null };
  },
};
