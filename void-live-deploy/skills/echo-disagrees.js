/**
 * echo-disagrees skill - "what would the echo say <question>", "echo this", "keep the echo" (owner, 2026-10-18).
 * Answers the question once as usual (stage.ask), then a few seconds later, and only on this explicit ask (it spends the free model),
 * asks the same question through the existing /api/answer path framed as "the strongest honest counter-view, 3 sentences" and shows it as a
 * quieter card: "echo: a second view, not a correction", with Keep (keeps the echo, dismisses the first) and Keep first.
 * No new endpoint: the answer path keeps its own rate limit and kill switches; if it is unavailable the card says so.
 */
import { echoOf, echoPrompt, echoUsable, lastRealAsk, ECHO_LABEL, ECHO_DELAY_MS, softCard } from '../lib/stage-pack-h.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const delay = () => { try { const d = Number(window.__a2mEchoDelay); return d >= 0 && d <= 10000 ? d : ECHO_DELAY_MS; } catch (_) { return ECHO_DELAY_MS; } };
const lastAsks = () => { try { const a = JSON.parse(localStorage.getItem('a2m.void.asks.v1') || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } };

async function fetchEcho(question) {
  try {
    const r = await fetch('/api/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ask: echoPrompt(question) }) });
    let j = null; try { j = await r.json(); } catch (_) {}
    return echoUsable(r.status, r.ok || r.status === 429 ? j : null);
  } catch (_) { return echoUsable(0, null); }
}

function showEcho(api, question, r) {
  const { esc } = api;
  const head = '<div style="opacity:.7;font-size:12px;letter-spacing:.04em">' + esc(ECHO_LABEL) + '</div>';
  if (!r.ok) {
    const el = softCard('echo', head + '<p style="margin:6px 0 8px">' + esc(r.why) + '</p><button type="button" class="g-btn ec-x">ok</button>'); // void-review: ok (escaped)
    el.querySelector('.ec-x').addEventListener('click', () => el.remove());
    return el;
  }
  const el = softCard('echo', head + '<p style="margin:6px 0 4px;opacity:.92"><em>' + esc(question) + '</em></p><p class="ec-text" style="margin:4px 0 10px">' + esc(r.text) + '</p>' // void-review: ok (escaped)
    + '<div style="display:flex;gap:8px"><button type="button" class="g-btn ec-keep">Keep</button><button type="button" class="g-btn ec-first">Keep first</button></div>');
  el.dataset.echoKept = '0';
  const keep = () => { try { api.stage.closePage(); } catch (_) {} el.dataset.echoKept = '1'; el.querySelector('div:last-child').innerHTML = '<button type="button" class="g-btn ec-x">dismiss</button>'; el.querySelector('.ec-x').addEventListener('click', () => el.remove()); };
  el.querySelector('.ec-keep').addEventListener('click', keep);
  el.querySelector('.ec-first').addEventListener('click', () => el.remove());
  return el;
}

async function run(text, api) {
  const e = echoOf(text);
  if (!e) return 'none';
  if (e.kind === 'keep') {
    const card = document.querySelector('.sph-card[data-sph="echo"] .ec-keep');
    if (card) card.click();
    else showEcho(api, '', { ok: false, why: 'There is no echo to keep. Ask "echo this" or "what would the echo say ..." first.' });
    return 'echo-disagrees';
  }
  let question = e.question;
  if (e.kind === 'this') {
    question = lastRealAsk(lastAsks());
    if (!question) { showEcho(api, '', { ok: false, why: 'Ask a question first, then say "echo this".' }); return 'echo-disagrees'; }
  } else {
    await api.stage.ask(question); // the first answer, as usual
    await wait(delay());
  }
  showEcho(api, question, await fetchEcho(question));
  return 'echo-disagrees';
}

export default {
  name: 'echo-disagrees',
  examples: [
    'echo this',
    'keep the echo',
    'what would the echo say should i learn to code'
  ],
  nearMisses: [
    'echo chamber acoustics',
    'echo dot setup'
  ],
  match(lower, text) { return !!echoOf(text || lower); },
  run
};
