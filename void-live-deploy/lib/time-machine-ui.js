// Timeline scrubber + export/branch UI (ADR-001 v1 MVP).
// Mounts a bottom bar; expects a runtime from time-machine-client.js.

export function mountTimeMachineUI(runtime, { mountTo = document.body } = {}) {
  if (!runtime || typeof document === 'undefined') return null;
  if (document.getElementById('tm-bar')) return document.getElementById('tm-bar');

  const bar = document.createElement('div');
  bar.id = 'tm-bar';
  bar.setAttribute('aria-label', 'Time Machine');
  bar.innerHTML = `
    <style>
      #tm-bar{position:fixed;left:10px;right:10px;bottom:4px;z-index:8;display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:12px;
        background:rgba(14,16,22,.72);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
        color:#e8e8e8;font:12px/1.2 ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;pointer-events:auto}
      #tm-bar[hidden]{display:none}
      #tm-bar .tm-label{white-space:nowrap;color:#9aa;min-width:72px}
      #tm-bar input[type=range]{flex:1;min-width:80px}
      #tm-bar button{font:inherit;color:#e8e8e8;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:4px 8px;cursor:pointer}
      #tm-bar button:hover{background:rgba(255,255,255,.14)}
      #tm-bar .tm-branch{max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#bcd} /* ellipsis-ok: short branch name */
      @media (max-width:700px){#tm-bar{left:6px;right:6px;bottom:2px;gap:6px;padding:5px 8px} #tm-bar .tm-label{min-width:54px}}
    </style>
    <span class="tm-branch" id="tm-branch" title="branch">main</span>
    <button type="button" id="tm-live" title="Go to head">Live</button>
    <input id="tm-range" type="range" min="-1" max="-1" value="-1" step="1" aria-label="Timeline" />
    <span class="tm-label" id="tm-pos">head</span>
    <button type="button" id="tm-fork" title="Branch from cursor">Branch</button>
    <button type="button" id="tm-export" title="Export replay">Export</button>
  `;
  mountTo.appendChild(bar);
  const range = bar.querySelector('#tm-range');
  const pos = bar.querySelector('#tm-pos');
  const branchEl = bar.querySelector('#tm-branch');
  const liveBtn = bar.querySelector('#tm-live');
  const forkBtn = bar.querySelector('#tm-fork');
  const exportBtn = bar.querySelector('#tm-export');

  async function refresh() {
    try {
      const data = await runtime.allData();
      const a = runtime.getActive();
      const b = data.branches[a.branchId];
      const head = b?.headSeq ?? -1;
      range.min = String(-1);
      range.max = String(head);
      range.value = String(a.cursorSeq);
      branchEl.textContent = b?.name || a.branchId || 'main';
      pos.textContent = a.cursorSeq >= head ? 'head' : `@${a.cursorSeq}/${head}`;
      liveBtn.disabled = a.cursorSeq >= head && !runtime.isScrubbing();
    } catch {}
  }

  range.addEventListener('input', async () => {
    const v = parseInt(range.value, 10);
    try { await runtime.scrubTo(v); } catch {}
    refresh();
  });
  liveBtn.addEventListener('click', async () => {
    const data = await runtime.allData();
    const a = runtime.getActive();
    const head = data.branches[a.branchId]?.headSeq ?? -1;
    try { await runtime.scrubTo(head); } catch {}
    refresh();
  });
  forkBtn.addEventListener('click', async () => {
    const a = runtime.getActive();
    try { await runtime.forkFrom(a.cursorSeq); } catch {}
    refresh();
  });
  exportBtn.addEventListener('click', async () => {
    try {
      const bundle = await runtime.exportBundle();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `verse-replay-${Date.now()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {}
  });

  refresh();
  const timer = setInterval(refresh, 1500);
  bar._tmDestroy = () => { clearInterval(timer); bar.remove(); };
  return bar;
}
