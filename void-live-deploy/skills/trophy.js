export const name = 'trophy';
export const examples = [
  'show my trophies',
  'what have I completed',
  'beat all the games',
  'mark this game clear',
  'easiest trophy next',
  'completion progress'
];

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

export function markClear(game, tier = 'bronze', notes = '') {
  const data = load();
  if (!data[game]) data[game] = { tiers: [], notes: [], lastUpdated: null };
  if (!data[game].tiers.includes(tier)) {
    data[game].tiers.push(tier);
  }
  if (notes) data[game].notes.push({ tier, notes, at: new Date().toISOString() });
  data[game].lastUpdated = new Date().toISOString();
  save(data);
  return data[game];
}

export function onGameComplete(game, details = {}) {
  return markClear(game, details.tier || 'gold', details.notes || 'Game completed');
}

export async function handle(ask, ctx) {
  const data = load();
  const lower = ask.toLowerCase();

  // Auto-detect current game context if available
  const currentGame = ctx?.currentGame || 'Earth Defense Force: World Brothers 2';

  if (lower.includes('easiest') || lower.includes('next trophy') || lower.includes('what next')) {
    return {
      type: 'advice',
      text: `For ${currentGame}: keep rescuing every downed Brother/Sister and clear missions on the lowest difficulty that still feels good. Character collection and story progress unlock the easiest trophies first. Switch teams often — the game rewards experimentation.`
    };
  }

  if (lower.includes('progress') || lower.includes('what have i') || lower.includes('show')) {
    const games = Object.keys(data);
    if (games.length === 0) {
      return { type: 'status', text: 'No completion data yet. Mark games as you clear them and I will track everything.' };
    }
    const summary = games.map(g => {
      const t = data[g];
      return `${g}: ${t.tiers.join(', ') || 'in progress'}`;
    }).join('\n');
    return { type: 'status', text: `Completion progress:\n${summary}` };
  }

  if (lower.includes('mark') || lower.includes('clear') || lower.includes('beat') || lower.includes('finished')) {
    const tier = lower.includes('platinum') ? 'platinum' : lower.includes('gold') ? 'gold' : lower.includes('silver') ? 'silver' : 'bronze';
    const result = markClear(currentGame, tier);
    return { type: 'success', text: `Marked ${currentGame} as ${tier}. Current tiers: ${result.tiers.join(', ')}` };
  }

  return {
    type: 'help',
    text: 'I track completion across games. Say things like "easiest trophy next", "mark this clear", or "show my progress". I will keep the guides and incentives updated automatically.'
  };
}
