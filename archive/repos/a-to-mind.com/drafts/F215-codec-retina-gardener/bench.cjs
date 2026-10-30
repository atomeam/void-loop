// Headless bench for F-215. Serve the drafts/ folder on :8716 (python3 -m http.server 8716), then:
//   node bench.cjs "?agent=1" 60    and    node bench.cjs "?agent=0" 60     (add &cpu for the Canvas2D path)
// Needs playwright-core (PW env var points at it) and Chrome (CHROME env var).
const { chromium } = require(process.env.PW || 'playwright-core');
const q = process.argv[2] || ''; const secs = +(process.argv[3] || 25);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--enable-unsafe-webgpu', '--use-angle=swiftshader', '--enable-features=Vulkan'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8716/F215-codec-retina-gardener/index.html' + q);
  await p.waitForFunction(() => window.__f215 && window.__f215.ready, null, { timeout: 20000 });
  await p.waitForTimeout(secs * 1000);
  const r = await p.evaluate(() => { const f = window.__f215, s = f.stats.samples, half = s.slice(s.length >> 1);
    const avg = a => a.reduce((x, y) => x + y[1], 0) / Math.max(1, a.length);
    return { mode: f.W.mode, codec: f.R.codec, blinks: f.R.frames, inBandFirst: avg(s.slice(0, 10)), inBandLastHalf: avg(half), thoughts: f.G.thoughts, acts: f.G.acts,
      classes: [...Array(16).keys()].map(f.classOf) }; });
  r.pageErrors = errs; console.log(JSON.stringify(r)); await b.close();
})();
