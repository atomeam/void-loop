const { chromium } = require(process.env.PW || 'playwright-core');
const U = process.env.URL || 'http://localhost:8720/index.html';
const L = [[0,0,500,380],[460,300,420,360],[840,0,420,340],[1220,260,400,400]];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome' });
  const ctx = await b.newContext({ viewport: { width: 640, height: 420 } }); const errs = []; const pages = [];
  for (const r of L) { const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); }); await p.goto(U + '?rect=' + r.join(',')); pages.push(p); }
  await pages[0].waitForTimeout(25000);
  const out = { shared: [] };
  for (const p of pages) out.shared.push(await p.evaluate(() => { const F = window.__f220; return { mode: F.mode, id: F.myId, rooms: F.snap.rooms.length, tick: F.snap.tick, eaten: F.snap.eaten, doors: F.snap.doors.map(d => d.k), belief: F.belief, title: document.title, favUpdates: F.favUpdates, fav: document.getElementById('fav').href.slice(-24), titlesSeen: [...new Set(F.titles)].length }; }));
  out.sameWorld = new Set(out.shared.map(s => s.eaten)).size <= 2 && out.shared.every(s => s.rooms === 4);
  await pages[1].screenshot({ path: 'shot-window2.png' });
  await pages[3].close(); await pages[0].waitForTimeout(4000);
  out.afterClose = await pages[0].evaluate(() => ({ rooms: window.__f220.snap.rooms.length, doors: window.__f220.snap.doors.map(d => d.k) }));
  const d = await ctx.newPage(); d.on('pageerror', e => errs.push(e.message)); await d.setViewportSize({ width: 1100, height: 700 }); await d.goto(U + '?desk=1'); await d.waitForTimeout(15000);
  out.desk = await d.evaluate(() => ({ mode: window.__f220.mode, rooms: window.__f220.snap.rooms.length, eaten: window.__f220.snap.eaten, doors: window.__f220.snap.doors.length, title: document.title }));
  await d.screenshot({ path: 'shot-desk.png' });
  out.errs = errs.slice(0, 5); console.log(JSON.stringify(out, null, 1)); await b.close();
})();
