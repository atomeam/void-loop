const { chromium } = require('/workspace/void-loop/node_modules/playwright-core');
const U = 'http://localhost:8725/index.html';
(async () => {
  const b = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1100, height: 800 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto(U + '?auto=1'); await p.waitForFunction(() => window.__f225 && window.__f225.done, null, { timeout: 120000 });
  await p.waitForTimeout(800);
  const out = await p.evaluate(() => { const F = window.__f225, n = F.bits.length, q = Math.floor(n / 4);
    const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
    return { HL: F.HL, webgl2: F.webgl2, frames: F.frames, chars: n, textLen: document.getElementById('ed').innerText.length,
      firstQuarterBpc: +avg(F.bits.slice(0, q)).toFixed(2), lastQuarterBpc: +avg(F.bits.slice(-q)).toFixed(2),
      maxHeight: +Math.max(...F.strata.h).toFixed(2), highlightRanges: [0,1,2,3,4].map(k => CSS.highlights.get('s' + k)?.size ?? 0),
      ghost: F.ghost, stats: document.getElementById('stats').innerText.replace(/\s+/g, ' ') }; });
  await p.screenshot({ path: 'shot-auto.png' });
  // Tab acceptance check
  await p.click('#ed'); await p.keyboard.press('End'); await p.keyboard.press('Control+End'); await p.keyboard.type('The void is not e');
  const g = await p.evaluate(() => window.__f225.ghost); await p.keyboard.press('Tab');
  out.tabTest = { ghostAfterPrefix: g, tail: (await p.evaluate(() => document.getElementById('ed').innerText)).slice(-30) };
  out.errs = errs.slice(0, 5); console.log(JSON.stringify(out, null, 1)); await b.close();
})();
