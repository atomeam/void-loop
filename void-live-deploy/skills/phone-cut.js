/**
 * phone-cut skill — auto-generates promotional posters for phone-cut films.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "phone-cut poster", "generate promo poster for phone cut film", "phone cut film poster".
 * Empty surface stays empty. Uses existing poster drawing ideas.
 */
export function phoneCutOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:generate|make|create|auto)?\s*(?:promo(?:tional)?\s+)?poster\s+(?:for\s+)?(?:the\s+)?phone[- ]cut(?:\s+film)?$|^(?:phone[- ]cut)\s+(?:film\s+)?poster$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!phoneCutOf(text)) return 'none';
  const el = showPage((p) => {
    p.innerHTML = '<h2>Phone-cut film poster</h2><div class="sub">Generating promotional poster…</div>'
      + '<canvas id="pc-poster" width="540" height="960" style="max-width:100%;border-radius:8px;display:block;margin:12px auto"></canvas>'
      + '<p class="src">Drawn in this browser. Nothing uploaded. For V01D phone-cut films.</p>';
  });
  // simple canvas draw
  setTimeout(() => {
    const c = el.querySelector('#pc-poster');
    if (!c || !el.isConnected) return;
    const g = c.getContext('2d');
    g.fillStyle = '#0a0a12'; g.fillRect(0, 0, 540, 960);
    g.fillStyle = '#ff3d7f'; g.font = 'bold 48px sans-serif'; g.fillText('V01D', 40, 200);
    g.fillStyle = '#fff'; g.font = '32px sans-serif'; g.fillText('Phone-cut', 40, 280);
    g.font = '24px sans-serif'; g.fillText('Now showing', 40, 360);
    g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '18px sans-serif'; g.fillText('a-to-mind.com/films', 40, 900);
  }, 100);
  return 'phone-cut';
}

export default {
  name: 'phone-cut',
  examples: ['phone-cut poster', 'generate promo poster for phone cut film', 'phone cut film poster'],
  nearMisses: ['poster', 'film poster', 'make a poster'],
  match(lower, text) { return phoneCutOf(text); },
  run,
  suite() {
    return { ok: phoneCutOf('phone-cut poster') && !phoneCutOf('hello') };
  },
};
