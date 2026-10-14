/**
 * quote-card skill — persistent quote of the day on the stage.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "quote card", "daily quote", "open a quote". Fetches from zenquotes.io (no key). Empty surface stays empty.
 */
export function wantsQuoteCard(lower) {
  const t = String(lower || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:open|show|make|add|give\s+me)?\s*(?:a\s+|the\s+)?(?:quote\s+card|daily\s+quote|quote\s+of\s+the\s+day)(?:\s+please)?$/.test(t);
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing quote-card';
  el.dataset.id = th.id;
  el.style.cssText = `left:${th.x}px;top:${th.y}px;min-width:260px;max-width:320px;padding:16px;background:rgba(20,20,30,.92);border:1px solid rgba(255,255,255,.12);border-radius:14px;color:#fff;font:15px/1.4 system-ui`;
  el.innerHTML = '<div class="q-text" style="font-style:italic;margin-bottom:8px">' + (th.text || '…') + '</div><div class="q-author" style="font-size:13px;opacity:.7">' + (th.author || '') + '</div>';
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  if (!th.text) {
    fetch('https://zenquotes.io/api/random').then(r => r.json()).then(d => {
      if (d && d[0]) { th.text = d[0].q; th.author = '— ' + d[0].a; stageApi.save(); stageApi.render(); }
    }).catch(() => {});
  }
}

function ensure(stageApi) {
  let card = Object.values(stageApi.things()).find(t => t && t.kind === 'quote') || null;
  if (!card) {
    const st = stageApi.stage;
    card = { id: 'quote_' + Math.random().toString(36).slice(2, 9), kind: 'quote',
      x: Math.max(40, (st.clientWidth || 800) / 2 - 130), y: Math.max(40, (st.clientHeight || 600) / 2 - 50),
      text: '', author: '' };
    stageApi.things()[card.id] = card;
  }
  stageApi.select(card.id);
  return card;
}

function ask(lower, text, stageApi) {
  if (wantsQuoteCard(lower)) { ensure(stageApi); stageApi.save(); stageApi.render(); return 'quote-card'; }
  return '';
}

export default {
  name: 'quote-card',
  examples: ['quote card', 'daily quote', 'quote of the day'],
  nearMisses: ['quote this', 'stock quote', 'what is a quote'],
  match(lower) { return wantsQuoteCard(lower); },
  async run(text, api) {
    const d = ask(String(text || '').toLowerCase(), text, api.stage);
    return d ? 'quote-card' : 'none';
  },
  stageKinds: { quote: { mount, ensure, ask } },
  suite() {
    return { ok: wantsQuoteCard('quote card') && !wantsQuoteCard('hello') };
  },
};
