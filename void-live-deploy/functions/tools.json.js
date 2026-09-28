// GET /tools.json — Void's callable tools, built live from /skills so it never drifts.
// Each tool is called by opening https://a-to-mind.com/?q=<ask>.
const CORE = [
  { name: 'stage', description: 'Put a thing on the stage: clock, timer, counter, sticky note, notepad, list, calculator, shape, image or link card.', examples: ['make a clock', 'make a 5 minute timer', 'add a sticky that says hi', 'make a list', 'draw a circle'] },
  { name: 'page', description: 'A short sourced page about almost any topic (Wikipedia, Wiktionary).', examples: ['what is a black hole', 'who was Ada Lovelace', 'define serendipity'] },
  { name: 'calculate', description: 'Arithmetic, percentages, unit and currency conversion.', examples: ['15% of 80', '5 miles in km', '100 usd in eur'] },
  { name: 'look', description: "Change the person's own Void (kept in their browser).", examples: ['make my void deep blue', 'add stars', 'quieter font', 'reset my void'] },
  { name: 'keep', description: 'Keep, name, remove or re-run what is on screen.', examples: ['keep this', 'call this trip', 'take this off', 'same again', 'undo'] },
];
const HIDDEN = new Set(['rebuild-map']);

export async function onRequestGet({ request, env }) {
  const origin = new URL(request.url).origin;
  const get = async (p) => { const r = await env.ASSETS.fetch(new Request(origin + p)); return r.ok ? r.text() : ''; };
  const tools = CORE.map((t) => ({ ...t }));
  try {
    const index = JSON.parse(await get('/skills/index.json'));
    for (const name of index) {
      if (HIDDEN.has(name)) continue;
      const src = await get('/skills/' + name + '.js');
      const m = src.match(/examples\s*:\s*\[([^\]]*)\]/);
      const examples = m ? Array.from(m[1].matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)).map((x) => (x[1] ?? x[2]).replace(/\\'/g, "'")) : [];
      const d = src.match(/^\s*\*\s*\w[\w-]*\s+skill\s+[—-]\s+(.+)$/m);
      tools.push({ name: name === 'place' ? 'map' : name, description: d ? d[1].trim() : name, examples });
    }
  } catch (_) {}
  const out = {
    name: 'Void by A-to-Mind',
    call: { method: 'GET', url: origin + '/?q={ask}', note: 'Opens Void in a browser and runs the ask in plain words. Results render in the page.' },
    tools: tools.map((t) => ({ ...t, try: t.examples.slice(0, 3).map((e) => origin + '/?q=' + encodeURIComponent(e)) })),
  };
  return new Response(JSON.stringify(out, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'public, max-age=300' } });
}
