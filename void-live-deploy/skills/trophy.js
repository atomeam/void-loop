// Trophy / Completionist + Strategy Guide trainer
// Teaches Verse to write Brady/Prima-style guides while rewarding full clears
// Dropped in to make games feel worth finishing again

export const name = 'trophy';
export const examples = [
  'show my trophies',
  'what have I completed',
  'beat all the games',
  'completionist progress',
  'generate strategy guide for [game]',
  'make a prima guide for othello',
  'how do I 100% monopoly',
  'verse conqueror status',
  'trophy progress',
  'my platinum games'
];

export const nearMisses = [
  'achievements',
  'trophies',
  'platinum',
  '100%',
  'strategy guide',
  'walkthrough',
  'prima',
  'brady',
  'completionist'
];

// Simple browser-local tracker for now.
// Later: persist per signed-in Verse identity or cloud.
const STORAGE_KEY = 'a2m.void.trophies.v1';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getProgress() {
  return load();
}

export function markClear(game, tier = 'bronze') {
  const data = load();
  if (!data[game]) data[game] = {};
  data[game][tier] = true;
  data[game].updated = new Date().toISOString();
  save(data);
  return data;
}

// Hook this into game end states later (chess, othello, etc.)
export function onGameComplete(game, details = {}) {
  markClear(game, 'bronze');
  if (details.hard || details.difficulty === 'hard') markClear(game, 'gold');
  if (details.full || details.platinum) markClear(game, 'platinum');
  if (details.collectibles) markClear(game, 'silver');
  return { status: 'recorded', game, tiers: load()[game] };
}

// Main entry – used by the router
export async function handle(ask, ctx) {
  const lower = (ask || '').toLowerCase();

  if (/progress|trophies|completed|conqueror|clearer|my (platinum|trophies|completion)/.test(lower)) {
    const progress = getProgress();
    const games = Object.keys(progress);
    const platinumCount = games.filter(g => progress[g].platinum).length;
    const totalKnown = 12; // update as more games land

    return {
      type: 'card',
      title: 'Verse Completionist',
      body: {
        summary: `${platinumCount} Platinum · ${games.length} games tracked`,
        progress,
        status: platinumCount >= totalKnown ? 'Verse Conqueror' :
                platinumCount >= Math.ceil(totalKnown / 2) ? 'Verse Clearer' : 'In progress',
        next: 'Play more games and mark them clear, or ask for a Prima-style strategy guide.'
      }
    };
  }

  if (/guide|walkthrough|strategy|prima|brady|how (do i|to) (100%|beat|clear)/.test(lower)) {
    // Hand off to or enhance the existing guide / book skill.
    // This is where the training happens: every Platinum improves future guides.
    return {
      type: 'guide',
      style: 'prima',
      note: 'Generating / improving Brady-Prima style guide. Completion data from trophy system feeds quality.'
    };
  }

  return null; // let other skills try
}
