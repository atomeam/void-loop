// field-worker — runs a field mind's slow thinking (an evolutionary generation) off the page's thread, or on it when a Worker is blocked.
// The owner, 2026-10-17 (asked by Owner, F-033 and F-035): "Worker-driven mind ... fall back if Worker is blocked".
//   spawnMind(moduleUrl, fnName, local, opts) -> { mode: 'worker'|'main', call(arg) -> Promise, close() }
// The worker is a Blob module worker that imports the SAME pure module the page uses (so there is one law, not two copies) and
// answers { id, fn, arg } with { id, out } or { id, err }. If a Worker cannot be made (blocked, no Blob URLs, CSP), if it errors,
// or if an answer takes longer than the timeout, the handle drops to 'main' for good and calls `local(arg)` instead, so the card
// never stops thinking. Nothing here touches the DOM beyond Worker / Blob / URL.

/** the worker's source text for a module at an absolute URL. Pure. */
export function mindSource(absUrl) {
  return 'import * as M from ' + JSON.stringify(String(absUrl)) + ';'
    + 'self.onmessage=async(e)=>{const d=e.data||{};try{self.postMessage({id:d.id,out:await M[d.fn](d.arg)})}catch(x){self.postMessage({id:d.id,err:String(x&&x.message||x)})}};'
    + 'self.postMessage({ready:1});';
}

export function spawnMind(moduleUrl, fnName, local, { timeout = 4000, base } = {}) {
  let w = null, mode = 'main', seq = 0, ready = false; const pend = new Map();
  const fallBack = () => {
    mode = 'main'; try { w && w.terminate(); } catch (_) { /* gone */ } w = null;
    for (const [, p] of pend) { clearTimeout(p.t); Promise.resolve().then(() => local(p.arg)).then(p.res, p.rej); } pend.clear();
  };
  try {
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) throw new Error('no worker');
    const abs = new URL(moduleUrl, base || (typeof location !== 'undefined' ? location.href : 'http://localhost/')).href;
    const blobUrl = URL.createObjectURL(new Blob([mindSource(abs)], { type: 'text/javascript' }));
    w = new Worker(blobUrl, { type: 'module' }); mode = 'worker';
    setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch (_) { /* fine */ } }, 15000);
    w.onmessage = (e) => {
      const d = e.data || {}; if (d.ready) { ready = true; return; }
      const p = pend.get(d.id); if (!p) return; pend.delete(d.id); clearTimeout(p.t);
      if (d.err) { Promise.resolve().then(() => local(p.arg)).then(p.res, p.rej); } else p.res(d.out);
    };
    w.onerror = () => fallBack(); w.onmessageerror = () => fallBack();
  } catch (_) { w = null; mode = 'main'; }
  return {
    get mode() { return mode; },
    call(arg) {
      if (mode !== 'worker' || !w) return Promise.resolve().then(() => local(arg));
      return new Promise((res, rej) => {
        const id = ++seq, t = setTimeout(() => { if (pend.has(id)) fallBack(); }, ready ? timeout / 2 : timeout);
        pend.set(id, { res, rej, arg, t });
        try { w.postMessage({ id, fn: fnName, arg }); } catch (_) { fallBack(); }
      });
    },
    close() { try { w && w.terminate(); } catch (_) { /* gone */ } w = null; mode = 'main'; for (const [, p] of pend) clearTimeout(p.t); pend.clear(); }
  };
}
