const { chromium } = require('/workspace/void-loop/node_modules/playwright-core');
const U = 'http://localhost:8722/index.html';
(async () => {
  const b = await chromium.launch({ headless: !process.env.HEADED, executablePath: '/usr/bin/google-chrome', args: ['--auto-accept-this-tab-capture', '--use-fake-ui-for-media-stream', '--auto-select-desktop-capture-source=F-222'] });
  const out = {}, errs = [];
  for (const [name, q] of [['demo', ''], ['tabCapture', '?auto=tab'], ['repel', '?repel=bcc8eb']]) {
    const p = await b.newPage({ viewport: { width: 1000, height: 900 } }); p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto(U + q); await p.waitForTimeout(name === 'demo' ? 30000 : 15000);
    out[name] = await p.evaluate(() => { const F = window.__f222; return { source: F.source(), frames: F.frames, errColony: +(F.lastA * 1000).toFixed(3), errRandom: +(F.lastB * 1000).toFixed(3), budget: Math.round(F.mind.updates / F.mind.frames), shareError: F.shareError || null, repelCells: F.repelCells, stats: document.getElementById('stats').textContent }; });
    await p.screenshot({ path: 'shot-' + name + '.png' }); await p.close();
  }
  out.errs = errs.slice(0, 5); console.log(JSON.stringify(out, null, 1)); await b.close();
})();
