// The play-throughs of the pages under /games/, used by tools/games-page.mjs (one function per page; each opens its page at 390 px and plays it the way a
// person would). Kept apart so the chess run stays readable.
import path from 'node:path';
export const RUNS = {
  hub: async ({ p, ctx, ok, open, sane, out, offline }) => {
    const m = await open(p, '/games/'); await sane(p, 'games hub', m);
    ok(await p.locator('#list a').count() === 7, 'games hub: seven games listed');
    ok(await p.locator('a[href="/?q=play%20connect%20four"]').count() === 1, 'games hub: the stage\'s 3D games linked');
    await p.screenshot({ path: path.join(out, 'games-hub.png'), fullPage: true }); await offline(ctx, p, '/games/', 'games hub', '#list a');
  },
  checkers: async ({ p, ctx, ok, open, sane, out, offline }) => {
    const m = await open(p, '/games/checkers/?level=easy'); await sane(p, 'checkers', m);
    const c = (n) => p.locator(`#cb button[aria-label^="${n}"]`);
    await c('c3').click(); ok(await p.locator('#cb .tgt').count() >= 1, 'checkers: a man shows where it can go');
    await c('d4').click(); await p.waitForTimeout(1200); ok(/Your move/.test(await p.locator('#status').innerText()) && await p.locator('#cb .man.cpu').count() === 12, 'checkers: c3-d4 played and the computer answered');
    await p.click('#undo'); ok(await p.locator('#cb button[aria-label^="c3 red man"]').count() === 1, 'checkers: undo puts the man back on c3');
    await p.screenshot({ path: path.join(out, 'checkers.png') }); await offline(ctx, p, '/games/checkers/', 'checkers', '#cb button');
  },
  solitaire: async ({ p, ctx, ok, open, sane, out, offline }) => {
    const m = await open(p, '/games/solitaire/?deal=7&draw=1'); await sane(p, 'solitaire', m);
    ok(await p.locator('#tab6 .cardx').count() === 7 && await p.locator('#tab6 .cardx.back').count() === 6, 'solitaire: the seventh column has 7 cards, 6 face down');
    await p.click('#stock'); ok(await p.locator('#waste .cardx').count() === 1, 'solitaire: the stock turns a card');
    let moved = false; for (let k = 0; k < 30 && !moved; k++) { await p.click('#hint'); const sel = await p.locator('.cardx.selc').count(); if (sel) { const before = await p.evaluate(() => document.querySelector('#stats').textContent); await p.locator('.cardx.selc').last().click(); moved = (await p.evaluate(() => document.querySelector('#stats').textContent)) !== before; } else await p.click('#stock'); }
    ok(moved, 'solitaire: a hinted card tapped goes where it belongs');
    await p.click('#undo'); ok(true, 'solitaire: undo pressed');
    await p.screenshot({ path: path.join(out, 'solitaire.png') }); await offline(ctx, p, '/games/solitaire/', 'solitaire', '#tab0');
  },
  mines: async ({ p, ctx, ok, open, sane, out, offline }) => {
    const m = await open(p, '/games/mines/?level=beginner&board=5'); await sane(p, 'mines', m);
    await p.locator('#grid button').nth(40).click(); ok(await p.locator('#grid button.o').count() >= 9, 'mines: the first open is safe and clears an area (' + await p.locator('#grid button.o').count() + ' open)');
    const closed = p.locator('#grid button:not(.o)').first(); await closed.click({ button: 'right' }); ok((await p.locator('#left').innerText()) === '9', 'mines: a right-click flag counts down the mines left');
    await p.screenshot({ path: path.join(out, 'mines.png') }); await offline(ctx, p, '/games/mines/', 'mines', '#grid button');
  },
  word: async ({ p, ctx, ok, open, sane, out, offline }) => {
    const m = await open(p, '/games/word/'); await sane(p, 'word', m); await p.waitForTimeout(400);
    const ans = await p.evaluate(() => JSON.parse(localStorage.getItem('a2m.void.games.word.v1')).game.answer);
    await p.keyboard.type('xyzzq'); await p.keyboard.press('Enter'); ok(/not in the list/.test(await p.locator('#status').innerText()), 'word: a made-up word is refused');
    for (let i = 0; i < 5; i++) await p.keyboard.press('Backspace');
    const first = ans === 'crane' ? 'stone' : 'crane'; await p.keyboard.type(first); await p.keyboard.press('Enter');
    ok(await p.locator('#tiles div.g, #tiles div.y, #tiles div.b').count() === 5, 'word: a guess is marked letter by letter');
    for (const ch of ans) await p.click(`#kbd [data-k="${ch}"]`); await p.click('#kbd [data-k="enter"]');
    ok(/Two tries/.test(await p.locator('#status').innerText()) && /Played 1/.test(await p.locator('#stats').innerText()), 'word: the answer typed on the screen keyboard wins in two');
    await p.screenshot({ path: path.join(out, 'word.png') }); await offline(ctx, p, '/games/word/', 'word', '#tiles div');
  },
  sudoku: async ({ p, ctx, ok, open, sane, out, offline }) => {
    const m = await open(p, '/games/sudoku/?level=easy&puzzle=12'); await sane(p, 'sudoku', m);
    ok(await p.locator('#grid button.giv').count() === 40, 'sudoku: an easy puzzle shows 40 clues');
    await p.click('#hint'); const h = await p.locator('#status').innerText(); ok(/Hint: (only \d fits here|in (row|column|box) \d, \d can go only here)/.test(h), 'sudoku: a hint names its reason (' + h + ')');
    const n = h.match(/only (\d) fits|, (\d) can go/); const num = n[1] || n[2]; await p.click(`#pad [data-n="${num}"]`);
    ok(await p.locator('#grid button.giv').count() === 40 && await p.evaluate(() => [...document.querySelectorAll('#grid button')].filter((b) => !b.classList.contains('giv') && /^\d$/.test(b.textContent)).length) === 1, 'sudoku: the hinted number goes in');
    await p.click('#notes'); await p.locator('#grid button:not(.giv)').nth(3).click(); await p.click('#pad [data-n="4"]'); ok(await p.locator('#grid .notes').count() === 1, 'sudoku: notes mode writes a pencil mark');
    await p.click('#undo'); ok(await p.locator('#grid .notes').count() === 0, 'sudoku: undo takes it away');
    await p.screenshot({ path: path.join(out, 'sudoku.png') }); await offline(ctx, p, '/games/sudoku/', 'sudoku', '#grid button');
  },
  merge: async ({ p, ctx, ok, open, sane, out, offline }) => {
    const m = await open(p, '/games/merge/?seed=7'); await sane(p, 'merge', m);
    ok(await p.evaluate(() => [...document.querySelectorAll('#board div')].filter((d) => d.textContent).length) === 2, 'merge: a new game starts with two tiles');
    for (const k of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) await p.keyboard.press(k);
    ok(+(await p.locator('#moves').innerText()) >= 3, 'merge: the arrow keys slide the tiles (' + await p.locator('#moves').innerText() + ' moves)');
    const mv = +(await p.locator('#moves').innerText()); await p.click('#undo'); ok(+(await p.locator('#moves').innerText()) === mv - 1, 'merge: undo takes one move back');
    const bx = await p.locator('#board').boundingBox(); await p.mouse.move(bx.x + 300, bx.y + 150); await p.mouse.down(); await p.mouse.move(bx.x + 60, bx.y + 160, { steps: 5 }); await p.mouse.up(); ok(true, 'merge: a swipe made');
    await p.screenshot({ path: path.join(out, 'merge.png') }); await offline(ctx, p, '/games/merge/', 'merge', '#board div');
  },
};
