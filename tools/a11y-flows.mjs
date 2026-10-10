// The visitors Void would exclude (frontier #23), first piece: the main flows run with the keyboard alone and with reduced motion, and every
// step says whether it holds or where it falls short. A step that falls short is a finding for the log, not a failing test: the fixes come
// after, one by one, and each one turns its step into a line that must hold. tools/test_void.mjs calls runFlows() and prints the report.
// Steps: [flow, id, what a visitor needs]. Each probe returns null when it holds, or a sentence saying how it falls short.
export async function runFlows(fresh) {
  const report = [];
  const step = async (flow, id, need, probe) => {
    let why = null; try { why = await probe(); } catch (e) { why = 'could not be checked: ' + String((e && e.message) || e).split('\n')[0].slice(0, 120); }
    report.push({ flow, id, need, ok: why == null, why });
  };

  // ---- keyboard alone ----
  const K = await fresh();
  const focusedIn = (sel) => K.p.evaluate((s) => !!document.activeElement && !!document.activeElement.closest(s), sel);
  await step('keyboard', 'start', 'the ask box has focus on load, so typing works with no pointer', async () => (await K.p.evaluate(() => document.activeElement && document.activeElement.id)) === 'input' ? null : 'focus is not in the ask box on load');
  await step('keyboard', 'names', 'every button and field in the page has a name a screen reader can say', async () => {
    const bad = await K.p.evaluate(() => [...document.querySelectorAll('button, input, textarea, select, [role=button]')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; })
      .filter((e) => !((e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.title || e.placeholder || (e.textContent || '').trim() || (e.labels && e.labels.length))))
      .map((e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : ''))).slice(0, 6));
    return bad.length ? 'no accessible name: ' + bad.join(', ') : null;
  });
  await K.p.keyboard.type('set a timer for 1 minute'); await K.p.keyboard.press('Enter'); await K.p.waitForTimeout(900);
  await step('keyboard', 'ask-timer', 'typing a request and pressing Enter makes the thing', async () => (await K.p.$$('#stage .thing')).length ? null : 'no card appeared after typing and Enter');
  await step('keyboard', 'announced', 'what happened is announced to a screen reader (a live region says it)', async () => {
    const live = await K.p.evaluate(() => [...document.querySelectorAll('[aria-live], [role=status], [role=alert]')].map((e) => (e.textContent || '').trim()).filter(Boolean));
    return live.length ? null : 'no live region said anything after the card appeared';
  });
  await step('keyboard', 'reach-card', 'Tab from the ask box reaches the new card\'s controls within a dozen presses', async () => {
    await K.p.focus('#input'); for (let i = 0; i < 12; i++) { await K.p.keyboard.press('Tab'); if (await focusedIn('#stage')) return null; }
    return 'twelve Tab presses never reached anything inside the stage';
  });
  await step('keyboard', 'focus-visible', 'the focused element shows where focus is', async () => {
    const o = await K.p.evaluate(() => { const shows = (e) => { const s = getComputedStyle(e); return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none'); }; const e = document.activeElement; if (!e || e === document.body) return 'nothing is focused'; const row = e.closest('#row'); /* the ask box shows focus on its bar (#row:focus-within) */ return shows(e) || (row && shows(row)) ? null : 'the focused ' + e.tagName.toLowerCase() + ' has no outline or ring'; });
    return o;
  });
  await step('keyboard', 'dismiss', 'Escape (or another key) takes the card back off the stage', async () => {
    const before = (await K.p.$$('#stage .thing')).length; await K.p.keyboard.press('Escape'); await K.p.waitForTimeout(80); await K.p.keyboard.press('Escape'); /* Esc, Esc takes the last thing back */ await K.p.waitForTimeout(500);
    const after = (await K.p.$$('#stage .thing')).length;
    return after < before ? null : 'Escape, Escape did not remove the card (' + before + ' before, ' + after + ' after)';
  });
  await K.p.focus('#input'); await K.p.keyboard.type('what is a black hole'); await K.p.keyboard.press('Enter'); await K.p.waitForTimeout(1200);
  await step('keyboard', 'ask-answer', 'a question gets an answer page', async () => (await K.p.$('.vpage.on')) ? null : 'no answer page after a question');
  await step('keyboard', 'answer-reachable', 'the answer page can be read and its links reached by keyboard (focus moves into it, or it is announced)', async () => {
    const moved = await K.p.evaluate(() => !!document.activeElement && !!document.activeElement.closest('.vpage'));
    const heading = await K.p.evaluate(() => !!document.querySelector('.vpage.on h1, .vpage.on h2, .vpage.on [role=heading]'));
    const said = await K.p.evaluate(() => [...document.querySelectorAll('[aria-live], [role=status]')].some((e) => (e.textContent || '').trim().length > 20));
    return moved || said ? (heading ? null : 'the answer has no heading to navigate by') : 'focus stays in the ask box and the answer is not announced';
  });
  await step('keyboard', 'answer-close', 'the answer page closes from the keyboard', async () => {
    await K.p.keyboard.press('Escape'); await K.p.waitForTimeout(80); await K.p.keyboard.press('Escape'); /* Esc, Esc takes the last thing back */ await K.p.waitForTimeout(500);
    return (await K.p.$('.vpage.on')) ? 'Escape did not close the answer page' : null;
  });
  await K.ctx.close();

  // ---- reduced motion ----
  const R = await fresh(); await R.p.emulateMedia({ reducedMotion: 'reduce' }); await R.p.reload(); await R.p.waitForTimeout(800);
  await step('reduced-motion', 'no-endless-motion', 'nothing on the empty page animates forever', async () => {
    const run = await R.p.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity).map((a) => (a.animationName || (a.effect.target && (a.effect.target.id || a.effect.target.className)) || 'animation')).slice(0, 6));
    return run.length ? 'still running forever: ' + run.join(', ') : null;
  });
  await step('reduced-motion', 'sky-still', 'the sky tint is set once and does not drift', async () => (await R.p.evaluate(() => window.__voidSky && window.__voidSky.drifting)) === false ? null : 'the sky is still drifting');
  await R.p.focus('#input'); await R.p.keyboard.type('what is a black hole'); await R.p.keyboard.press('Enter'); await R.p.waitForTimeout(1200);
  await step('reduced-motion', 'answer-without-tilt', 'an answer page does not tilt or fly in', async () => {
    const t = await R.p.evaluate(() => { const e = document.querySelector('.vpage.on'); if (!e) return null; const s = getComputedStyle(e); return { anim: s.animationName, dur: s.animationDuration, tr: s.transitionDuration }; });
    if (!t) return 'no answer page to look at';
    return t.anim && t.anim !== 'none' && parseFloat(t.dur) > 0.05 ? 'the answer page still plays "' + t.anim + '" (' + t.dur + ')' : null;
  });
  await R.ctx.close();
  return report;
}

export const formatReport = (report) => report.map((s) => (s.ok ? 'ok   ' : 'SHORT') + ' ' + s.flow + ' / ' + s.id + (s.ok ? '' : ': ' + s.why) + '  (needs: ' + s.need + ')').join('\n');
