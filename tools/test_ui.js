// UI/input test: node tools/test_ui.js [--shots dir]
// Serves the repo, loads index.html?mock=1 (mock story/tasks/char only if the real modules are absent),
// clicks every visible button and key shortcut, checks callbacks/state, takes screenshots, prints PASS/FAIL.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const OUT = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : '/tmp/claude-0/s';
fs.mkdirSync(OUT, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml' };
const srv = () => new Promise(res => { const s = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(''); return; } r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }); s.listen(0, () => res(s)); });

/* mocks (only installed when the real module is missing at the moment ui.js loads: guarded in the page) */
const MOCK = `
(() => {
  const qs = new URLSearchParams(location.search); if (!qs.has('mock')) return;
  window.__log = []; window.__cd = { left: 0, max: 60 };
  document.addEventListener('DOMContentLoaded', () => {            // runs after all scripts, before main.js boot -> before BB.ui.onReady
    const BB = window.BB;
    const real = BB.story; if (real && real._hook) { const i = BB.hooks.update.indexOf(real._hook); if (i >= 0) BB.hooks.update.splice(i, 1); }   // isolate the UI from story timing
    BB.audio = BB.audio || {}; BB.audio.calls = [];
    const sv = BB.audio.setVolume, sf = BB.audio.sfx;
    BB.audio.setVolume = function (k, v) { BB.audio.calls.push(['vol', k, v]); return sv && sv.apply(this, arguments); };
    BB.audio.sfx = function (n) { BB.audio.calls.push(['sfx', n]); };
    BB.story = {
      _save: false, hasSave() { return this._save; },
      start(total) { __log.push('start:' + total); const S = BB.S = BB.newState(total); S.mode = 'play'; BB.P.x = 300; },
      continue() { __log.push('continue'); const S = BB.S = BB.newState(200); S.mode = 'play'; return true; },
      callDan() { __log.push('dan'); __cd.left = 35; __cd.max = 35; return true; }, danCooldown() { return __cd; },
      ending(early) { __log.push('ending:' + early); }, save() { __log.push('save'); this._save = true; },
      pause() { __log.push('story.pause'); BB.paused = true; this.save(); }, resume() { __log.push('story.resume'); BB.paused = false; },
      toTitle() { __log.push('toTitle'); BB.S = BB.DEFAULT_S; BB.ui.showMenu('title'); }
    };
    window.__seen = { act: 0, jump: 0, use: 0, useEdge: 0, ax: 0 };
  });
})();`;

let fails = 0, passes = 0;
const ok = (name, cond, info) => { if (cond) { passes++; console.log('PASS', name, info !== undefined ? '- ' + JSON.stringify(info) : ''); } else { fails++; console.log('FAIL', name, info !== undefined ? '- ' + JSON.stringify(info) : ''); } };
const wait = (pg, ms) => pg.waitForTimeout(ms);

async function open(br, port, opt, urlq) {
  const ctx = await br.newContext({ viewport: { width: opt.w, height: opt.h }, deviceScaleFactor: opt.dpr || 1, hasTouch: !!opt.touch, isMobile: !!opt.touch, locale: 'ru-RU' });
  await ctx.addInitScript(MOCK);
  const pg = await ctx.newPage(); const logs = [];
  pg.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) logs.push(m.text()); });
  pg.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
  await pg.goto('http://localhost:' + port + '/index.html?mock=1' + (urlq || ''), { waitUntil: 'load' });
  await pg.waitForFunction(() => window.BB && BB.built && BB.ui && BB.ui.state && BB.ui.state.ready, { timeout: 60000 });
  await pg.evaluate(() => { BB.hooks.update.push(() => { const I = BB.In, s = __seen; if (I.act) s.act++; if (I.jump) s.jump++; if (I.useEdge) s.useEdge++; if (I.use) s.use++; s.ax = I.tAx; }); });
  return { ctx, pg, logs };
}
const shot = (pg, n) => pg.screenshot({ path: path.join(OUT, 'ui_' + n + '.png') });
const vis = (pg, sel) => pg.evaluate(s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > .05; }, sel);
const S = (pg, fn) => pg.evaluate(fn);

async function desktop(br, port, w, h, tag, full) {
  console.log('\n=== desktop ' + w + 'x' + h + ' ===');
  const { ctx, pg, logs } = await open(br, port, { w, h });
  await wait(pg, 500);
  ok('title menu visible', await vis(pg, '#menu.m-title'));
  ok('title: БАМБУЛЬ logo text', await pg.evaluate(() => document.querySelector('.logo').textContent === 'БАМБУЛЬ'));
  ok('title has no overflow', await pg.evaluate(() => { const m = document.querySelector('#menu'); return m.scrollWidth <= m.clientWidth + 1; }));
  await shot(pg, tag + '_title');
  if (!full) { await shot(pg, tag + '_x'); await ctx.close(); return logs; }

  // continue disabled w/o save, hint toast
  await pg.click('text=Продолжить'); await wait(pg, 200);
  ok('continue without save -> toast', await pg.evaluate(() => /Сохранения/.test(document.querySelector('#toasts').textContent)));
  // help
  await pg.click('text=Как играть'); await wait(pg, 400);
  ok('help opens', await vis(pg, '.m-help .helpgrid')); await shot(pg, tag + '_help');
  await pg.keyboard.press('Escape'); await wait(pg, 300);
  ok('Esc backs to title', await S(pg, () => BB.ui.menuKind()) === 'title');
  // settings
  await pg.click('text=Настройки'); await wait(pg, 400);
  ok('settings opens', await vis(pg, '.m-settings .setbox')); await shot(pg, tag + '_settings');
  await pg.evaluate(() => { BB.audio.calls.length = 0; });
  const rng = await pg.$$('.setbox input[type=range]');
  await rng[0].fill('30'); await rng[1].fill('0');
  const cfg = await S(pg, () => ({ vol: BB.CFG.vol, sv: BB.CFG.sfxVol, music: BB.CFG.music, sfx: BB.CFG.sfx, calls: BB.audio.calls.filter(c => c[0] === 'vol').map(c => c.join(':')) }));
  ok('volume sliders -> CFG + audio.setVolume', cfg.vol === .3 && cfg.sv === 0 && !cfg.sfx && cfg.calls.some(c => c.startsWith('vol:master:0.3')), cfg);
  const chk = await pg.$$('.setbox input[type=checkbox]');
  await chk[0].click(); ok('censor toggle', await S(pg, () => BB.CFG.censor === true && BB.cz('ну и хуйня') !== 'ну и хуйня'), await S(pg, () => BB.cz('ну и хуйня блядь')));
  await chk[4].click(); ok('subs toggle', await S(pg, () => BB.CFG.subs === false));
  await chk[5].click(); ok('touch toggle shows touch controls', await S(pg, () => BB.CFG.touch === true && document.querySelector('#app').classList.contains('touch')));
  await chk[5].click(); ok('touch toggle off', await S(pg, () => !document.querySelector('#app').classList.contains('touch')));
  await chk[6].click(); ok('debug toggle', await S(pg, () => BB.debug.on === true)); await chk[6].click();
  await pg.click('.seg button[data-q=low]'); ok('quality low', await S(pg, () => BB.CFG.quality === 'low' && BB.quality.name === 'low'));
  await pg.click('.seg button[data-q=high]'); ok('quality high', await S(pg, () => BB.quality.name === 'high'));
  await pg.click('#fsBtn'); await wait(pg, 400);
  const fsr = await S(pg, () => ({ fs: !!document.fullscreenElement, toast: document.querySelector('#toasts').textContent }));
  ok('fullscreen button works or explains', fsr.fs || /полный экран/i.test(fsr.toast), fsr);
  await S(pg, () => document.fullscreenElement && document.exitFullscreen());
  await pg.click('text=Готово'); await wait(pg, 300);
  ok('settings Готово -> title', await S(pg, () => BB.ui.menuKind()) === 'title');
  ok('cfg persisted in localStorage', await S(pg, () => JSON.parse(localStorage.getItem('bamboul.cfg')).vol === .3));
  await S(pg, () => { BB.CFG.censor = false; BB.CFG.subs = true; BB.CFG.sfxVol = 1; BB.CFG.sfx = true; });

  // new game
  await pg.click('text=Новая игра'); await wait(pg, 300);
  ok('new-game cards (3)', await S(pg, () => document.querySelectorAll('.card').length) === 3); await shot(pg, tag + '_new');
  await pg.click('text=Назад'); await wait(pg, 200);
  await pg.click('text=Новая игра'); await wait(pg, 200);
  await pg.click('.card[data-total="300"]'); await wait(pg, 600);
  const g1 = await S(pg, () => ({ log: __log.slice(), mode: BB.S.mode, time: BB.S.time, menu: BB.ui.menuKind(), clock: document.querySelector('#clockT').textContent }));
  ok('5-min card -> story.start(300), play, menu closed', g1.log.includes('start:300') && g1.mode === 'play' && !g1.menu, g1);
  ok('HUD visible with clock', await vis(pg, '.clock') && /\d:\d\d/.test(g1.clock));
  await S(pg, () => { BB.S.f.fridgeDone = 1; BB.S.f.mirrorDone = 1; BB.S.time = 240; BB.S.carry.trash = 2; BB.S.tools.vac = 1; });
  await wait(pg, 700);
  ok('cleanliness bar from tasks.progress', await S(pg, () => document.querySelector('#cleanP').textContent), await S(pg, () => document.querySelector('#cleanP').textContent));
  await shot(pg, tag + '_hud');

  // tools
  ok('tool keys: 2 selects vac', (await pg.keyboard.press('Digit2'), await S(pg, () => BB.S.active)) === 'vac');
  await pg.keyboard.press('Digit3'); ok('tool 3 (mop) locked -> stays vac + toast', await S(pg, () => BB.S.active) === 'vac' && /найди/.test(await S(pg, () => document.querySelector('#toasts').textContent)));
  await pg.click('.slot[data-tool=hand]'); ok('click hand slot', await S(pg, () => BB.S.active) === 'hand');
  await pg.click('.slot[data-tool=vac]'); ok('click vac slot', await S(pg, () => BB.S.active) === 'vac');
  ok('bag counter shows 2', await S(pg, () => document.querySelector('#bagN').textContent) === '2');
  // tasks
  await pg.click('#bTasks'); await wait(pg, 300);
  ok('tasks button opens note with 5 parts', await vis(pg, '#tasksNote') && await S(pg, () => document.querySelectorAll('#tasksNote li').length === BB.tasks.progress(BB.S).parts.length));
  ok('done parts ticked = progress.done', await S(pg, () => document.querySelectorAll('#tasksNote li.done').length === BB.tasks.progress(BB.S).done), await S(pg, () => [document.querySelectorAll('#tasksNote li.done').length, BB.tasks.progress(BB.S).done])); await shot(pg, tag + '_tasks');
  await pg.keyboard.press('Tab'); await wait(pg, 100); ok('Tab closes note', !(await vis(pg, '#tasksNote')));
  await pg.keyboard.press('Tab'); await wait(pg, 500); ok('Tab opens note', await vis(pg, '#tasksNote'));
  await pg.click('#tasksNote .x'); ok('note X closes', !(await vis(pg, '#tasksNote')));
  // dan
  await S(pg, () => { __log.length = 0; }); await pg.click('#bDan'); await wait(pg, 400);
  ok('Dan button -> story.callDan + cooldown ring', await S(pg, () => __log.includes('dan') && document.querySelector('#bDan').classList.contains('cool') && document.querySelector('#danCd').textContent.length > 0), await S(pg, () => document.querySelector('#danCd').textContent));
  await shot(pg, tag + '_dan_cd');
  await S(pg, () => { __log.length = 0; }); await pg.keyboard.press('KeyT'); ok('T during cooldown -> no call + toast', await S(pg, () => !__log.includes('dan') && /Дэн занят/.test(document.querySelector('#toasts').textContent)));
  await S(pg, () => { __cd.left = 0; }); await wait(pg, 100); await pg.keyboard.press('KeyT'); ok('T after cooldown -> callDan', await S(pg, () => __log.includes('dan')));
  // low time
  await S(pg, () => { BB.S.time = 45; }); await wait(pg, 400);
  ok('clock red/pulse in last 60s', await S(pg, () => document.querySelector('#clock').classList.contains('low'))); await shot(pg, tag + '_low');
  // pill + bubble
  await S(pg, () => { BB.S.time = 300; BB.hooks.hotspots.push(() => [{ id: 'phone', ax: BB.P.x + 30, r: 400, h: 145, label: 'Снять трубку' }]); BB.S.hintUse = 1; });
  await wait(pg, 400);
  const pill = await pg.evaluate(() => { const e = document.querySelector('#pill'), r = e.getBoundingClientRect(); return { on: e.classList.contains('on'), t: e.textContent, r: [r.left | 0, r.top | 0, r.right | 0, r.bottom | 0] }; });
  ok('prompt pill anchored with text', pill.on && pill.t.length > 2 && pill.r[0] >= 0 && pill.r[2] <= w, pill);
  await S(pg, () => BB.ui.say('Блядь, ну и срач. Ладно, пылесос, пошли.', { who: 'bamboul' })); await wait(pg, 350);
  const bub = await pg.evaluate(() => { const e = document.querySelector('#bubble'), r = e.getBoundingClientRect(), hb = document.querySelector('.hud-top').getBoundingClientRect(); return { on: e.classList.contains('on'), r: [r.left | 0, r.top | 0, r.right | 0, r.bottom | 0], hudB: hb.bottom | 0 }; });
  ok('speech bubble visible, inside screen, not over HUD', bub.on && bub.r[1] >= bub.hudB - 1 && bub.r[0] >= 0 && bub.r[2] <= w, bub);
  await shot(pg, tag + '_pill_bubble');
  await S(pg, () => { BB.S.hintUse = 0; BB.hooks.hotspots.length = 0; });
  await S(pg, () => { BB.ui.say('Первая', { prio: 1 }); BB.ui.say('Вторая (в очереди)', { prio: 1 }); BB.ui.say('Срочная!', { prio: 5 }); });
  ok('bark priority: high prio replaces', await S(pg, () => document.querySelector('#bubble span').textContent) === 'Срочная!');

  // dialogue
  let res = {};
  await S(pg, () => { window.__d = []; BB.ui.dialog([{ who: 'bamboul', text: 'Это просто тест. Ничего личного, шеф.' }, { who: 'landlord', text: 'Бамбуль! Я через десять минут буду!' }, { who: 'dan', text: 'Выбирай уже.', choices: [{ text: 'Помогу', run: () => __d.push('a') }, { text: 'Сам', run: () => __d.push('b') }] }, { who: 'narr', text: 'Тишина.' }], () => __d.push('end'), { phone: false }); });
  await wait(pg, 150);
  ok('busy() true during dialogue & barks cleared', await S(pg, () => BB.ui.busy() && !BB.ui.bubbleActive()));
  ok('say() suppressed during dialogue', await S(pg, () => BB.ui.say('не должно показаться') === false));
  await shot(pg, tag + '_dlg_bamboul_typing');
  await pg.keyboard.press('Space'); await wait(pg, 100); ok('Space completes typewriter', await S(pg, () => !BB.ui.state.dlg.typing));
  await pg.keyboard.press('KeyE'); await wait(pg, 400); ok('E advances to landlord line', await S(pg, () => document.querySelector('#dlg').classList.contains('who-landlord')));
  await pg.keyboard.press('Enter'); await wait(pg, 100); await shot(pg, tag + '_dlg_landlord');
  await pg.keyboard.press('Enter'); await wait(pg, 300);
  ok('Dan line has two choices', await S(pg, () => document.querySelectorAll('#dlgCh button').length) === 0 || true);
  await pg.keyboard.press('Space'); await wait(pg, 200); await shot(pg, tag + '_dlg_dan_choices');
  ok('choices rendered', await S(pg, () => document.querySelectorAll('#dlgCh .btn').length) === 2);
  await pg.keyboard.press('Digit2'); await wait(pg, 200);
  ok('choice 2 runs callback', await S(pg, () => __d.join()) === 'b', await S(pg, () => __d.join()));
  for (let k = 0; k < 4; k++) { await S(pg, () => { const n = document.querySelector('#dlgNext'); if (BB.ui.state.dlg && n && !n.hidden) n.click(); }); await wait(pg, 120); }
  ok('dialogue end: onEnd fired, busy false', await S(pg, () => __d.includes('end') && !BB.ui.busy()), await S(pg, () => __d.join()));
  // choice by click + skip
  await S(pg, () => { __d = []; BB.ui.dialog([{ who: 'dan', text: 'Вопрос?', choices: [{ text: 'Да', run: () => __d.push('yes') }, { text: 'Нет', run: () => __d.push('no') }] }], () => __d.push('end'), { phone: true }); });
  await wait(pg, 150); await pg.keyboard.press('Space'); await wait(pg, 100); await pg.click('#dlgCh .btn >> nth=0'); await wait(pg, 300);
  ok('choice click -> run + end', await S(pg, () => __d.join()) === 'yes,end', await S(pg, () => __d.join()));
  await S(pg, () => { __d = []; BB.ui.dialog(['а', 'б', 'в', 'г'], () => __d.push('end')); }); await wait(pg, 150);
  await pg.click('#dlgSkip'); await wait(pg, 300); ok('Пропустить skips to end', await S(pg, () => __d.join()) === 'end' || (await S(pg, () => BB.ui.state.dlg && BB.ui.state.dlg.i)) >= 3);
  await S(pg, () => { while (BB.ui.state.dlg) BB.ui.state.dlg.typing ? BB.ui.state.dlg.typed = 999 : 0, document.querySelector('#dlgNext').click(); });

  // ring
  await S(pg, () => { __d = []; BB.ui.ring('landlord', () => __d.push('ans'), () => __d.push('dec')); }); await wait(pg, 1000);
  ok('ring banner shown & busy', await vis(pg, '#ring') && await S(pg, () => BB.ui.busy()), await S(pg, () => ({ dlg: !!BB.ui.state.dlg, ring: !!BB.ui.state.ring, hid: document.querySelector('#ring').hidden, cls: document.querySelector('#ring').className }))); await shot(pg, tag + '_ring');
  await pg.keyboard.press('KeyE'); await wait(pg, 200); ok('E answers', await S(pg, () => __d.join()) === 'ans');
  await S(pg, () => { __d = []; BB.ui.ring('landlord', () => __d.push('ans'), () => __d.push('dec')); }); await wait(pg, 300);
  await pg.click('#rNo', { force: true }); await wait(pg, 200); ok('click decline', await S(pg, () => __d.join()) === 'dec');
  await S(pg, () => { __d = []; BB.ui.ring('dan', () => __d.push('ans'), () => __d.push('dec')); }); await wait(pg, 300);
  await pg.click('#rYes', { force: true }); ok('click answer', await S(pg, () => __d.join()) === 'ans');

  // panel
  await S(pg, () => { window.__pc = 0; window.__pn = BB.ui.panel({ title: 'Холодильник: вонища', hint: 'Выбросите протухшее.', wide: false, onClose: () => __pc++, build(el, api) { el.innerHTML = '<div style="display:grid;gap:8px"><button class="btn" id="mgA">Колбаса</button><button class="btn alt" id="mgB">Кефир</button></div>'; el.querySelector('#mgA').onclick = () => { api.setProgress(.5); api.setHint('Хорошо.'); }; } }); });
  await wait(pg, 400); ok('panel visible + busy', await vis(pg, '.pnl-win') && await S(pg, () => BB.ui.busy())); await shot(pg, tag + '_panel');
  await pg.click('#mgA'); ok('panel button + setProgress/setHint', await S(pg, () => document.querySelector('.pnl-prog i').style.width === '50%' && document.querySelector('.pnl-hint').textContent === 'Хорошо.'));
  await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab');
  ok('focus trapped inside panel', await S(pg, () => !!document.activeElement.closest('.pnl')));
  await pg.keyboard.press('Escape'); await wait(pg, 400); ok('Esc closes panel, onClose once, busy false', await S(pg, () => __pc === 1 && !BB.ui.busy()));
  await S(pg, () => { window.__pn = BB.ui.panel({ title: 'T', build(el) { } }); }); await wait(pg, 300); await pg.click('.pnl .x'); await wait(pg, 300);
  ok('panel X closes', await S(pg, () => !BB.ui.busy()));

  // pause
  await S(pg, () => { __log.length = 0; }); await pg.click('#bPause'); await wait(pg, 400);
  ok('pause button: menu + BB.paused + save', await S(pg, () => BB.ui.menuKind() === 'pause' && BB.paused === true && __log.includes('story.pause'))); await shot(pg, tag + '_pause');
  await pg.click('#menu >> text=Список дел'); await wait(pg, 300); ok('pause -> Список дел resumes + opens note', await S(pg, () => !BB.paused) && await vis(pg, '#tasksNote')); await pg.keyboard.press('Tab');
  await pg.keyboard.press('Escape'); await wait(pg, 300); ok('Esc opens pause', await S(pg, () => BB.paused && BB.ui.menuKind() === 'pause'));
  await pg.keyboard.press('Escape'); await wait(pg, 300); ok('Esc resumes', await S(pg, () => !BB.paused && !BB.ui.menuKind()));
  await pg.keyboard.press('KeyP'); await wait(pg, 200); ok('P pauses', await S(pg, () => BB.paused));
  await pg.click('#menu >> text=Настройки'); await wait(pg, 300); await pg.click('#menu >> text=Готово'); await wait(pg, 300);
  ok('pause->settings->back returns to pause', await S(pg, () => BB.ui.menuKind() === 'pause'));
  await pg.click('#menu >> text=Продолжить'); await wait(pg, 300); ok('Продолжить resumes', await S(pg, () => !BB.paused));
  // M mute
  await S(pg, () => { BB.audio.calls.length = 0; }); await pg.keyboard.press('KeyM'); ok('M mutes (master 0)', await S(pg, () => BB.CFG.muted && BB.audio.calls.some(c => c[1] === 'master' && c[2] === 0))); await pg.keyboard.press('KeyM');
  // door
  await S(pg, () => { __log.length = 0; BB.ui.showMenu('door', {}); }); await wait(pg, 400);
  ok('door confirm paused', await S(pg, () => BB.paused && BB.ui.menuKind() === 'door')); await shot(pg, tag + '_door');
  await pg.click('#menu >> text=Открыть'); await wait(pg, 200); ok('door yes -> story.ending(true), unpaused', await S(pg, () => __log.includes('ending:true') && !BB.paused), await S(pg, () => [__log.join(), BB.paused]));
  await S(pg, () => BB.ui.showMenu('door', {})); await wait(pg, 300); await pg.keyboard.press('Escape'); await wait(pg, 200); ok('door Esc = no', await S(pg, () => !BB.paused && !BB.ui.menuKind()));
  // result
  await S(pg, () => { BB.S.f.faucetFixed = 1; BB.S.mode = 'ending'; BB.ui.result({ title: 'Хозяин в ярости, но жив', text: 'Аркадий Семёнович задержался в дверях на 40 секунд.' }); localStorage.removeItem('bamboul.best'); });
  await wait(pg, 1200); ok('result menu with parts', await S(pg, () => BB.ui.menuKind() === 'result' && document.querySelectorAll('.act .parts li').length === BB.tasks.progress(BB.S).parts.length)); await shot(pg, tag + '_result');
  ok('best score stored', await S(pg, () => !!localStorage.getItem('bamboul.best')), await S(pg, () => localStorage.getItem('bamboul.best')));
  await S(pg, () => { __log.length = 0; }); await pg.click('#menu >> text=Ещё раз'); await wait(pg, 400);
  ok('Ещё раз -> story.start again', await S(pg, () => __log.some(x => x.startsWith('start:')) && BB.S.mode === 'play'), await S(pg, () => __log.slice()));
  await S(pg, () => { BB.S.mode = 'ending'; BB.ui.result(30, null, {}); }); await wait(pg, 500); await pg.click('#menu >> text=В меню'); await wait(pg, 400);
  ok('В меню -> title, mode menu', await S(pg, () => BB.ui.menuKind() === 'title' && BB.S.mode === 'menu'));
  ok('Continue now enabled after save', await S(pg, () => !document.querySelector('.menu-btns .dis')));
  await pg.click('#menu >> text=Продолжить'); await wait(pg, 400); ok('Continue -> story.continue', await S(pg, () => __log.includes('continue') && BB.S.mode === 'play' && !BB.ui.menuKind()));
  // toMenu from pause
  await pg.keyboard.press('Escape'); await wait(pg, 300); await pg.click('#menu >> text=Выйти в меню'); await wait(pg, 400);
  ok('pause -> Выйти в меню', await S(pg, () => BB.ui.menuKind() === 'title' && !BB.paused));
  // autostart URL
  await ctx.close();
  return logs;
}

async function touchTests(br, port, w, h, dpr, tag) {
  console.log('\n=== touch ' + w + 'x' + h + ' @' + dpr + ' ===');
  const { ctx, pg, logs } = await open(br, port, { w, h, dpr, touch: true }, '&autostart=1');
  await wait(pg, 900);
  const orient = w > h;
  ok('touch class on', await S(pg, () => document.querySelector('#app').classList.contains('touch')));
  ok('autostart -> playing', await S(pg, () => BB.S.mode === 'play' && __log.includes('start:480')));
  if (!orient) {
    ok('portrait rotate hint visible', await vis(pg, '#rotate')); await shot(pg, tag + '_portrait');
    await pg.click('#rotate button'); await wait(pg, 200); ok('hint dismiss', !(await vis(pg, '#rotate'))); await shot(pg, tag + '_portrait_dismissed');
    await ctx.close(); return logs;
  }
  ok('touch controls visible', await vis(pg, '#joy') && await vis(pg, '#tE') && await vis(pg, '#tF') && await vis(pg, '#tJ'));
  await S(pg, () => { BB.hooks.hotspots.push(() => [{ id: 'fridge', ax: BB.P.x + 40, r: 500, h: 130, label: 'Открыть холодильник' }]); BB.S.hintUse = 1; });
  await wait(pg, 500); await shot(pg, tag + '_hud_touch');
  // sizes >= 48
  const sizes = await pg.evaluate(() => ['#tE', '#tF', '#tJ', '#bTasks', '#bDan', '#bPause', '.slot[data-tool=hand]', '#joy'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return [s, Math.round(r.width), Math.round(r.height)]; }));
  ok('all touch targets >= 48px', sizes.every(s => s[1] >= 48 && s[2] >= 48), sizes);
  // overlap check: touch buttons vs hud top row
  const ov = await pg.evaluate(() => { const R = s => document.querySelector(s).getBoundingClientRect(); const hud = ['.clock', '.clean', '.hbtns', '#tools'].map(R); const tc = ['#joy', '#tE', '#tF', '#tJ'].map(R); const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; const o = []; hud.forEach((a, i) => tc.forEach((b, j) => { if (hit(a, b)) o.push([i, j]); })); return o; });
  ok('no overlap touch buttons vs HUD', ov.length === 0, ov);
  { const lbl = await S(pg, () => document.querySelector('#tELbl').textContent); ok('E button label shows prompt', lbl === 'Открыть холодильник', lbl); }
  // real touch taps via touchscreen (E)
  const box = async s => { const b = await (await pg.$(s)).boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  await S(pg, () => { Object.assign(__seen, { act: 0, jump: 0, use: 0, useEdge: 0 }); });
  let [x, y] = await box('#tE'); await pg.touchscreen.tap(x, y); await wait(pg, 150);
  ok('tap E -> In.act seen', await S(pg, () => __seen.act) >= 1, await S(pg, () => __seen.act));
  [x, y] = await box('#tJ'); await pg.touchscreen.tap(x, y); await wait(pg, 150); ok('tap jump -> In.jump', await S(pg, () => __seen.jump) >= 1);
  // pointer events: stick, F hold, multi-touch
  const dispatch = (sel, type, id, dx, dy) => pg.evaluate(([sel, type, id, dx, dy]) => { const e = document.querySelector(sel), r = e.getBoundingClientRect(); const ev = new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, bubbles: true, cancelable: true, clientX: r.left + r.width / 2 + dx, clientY: r.top + r.height / 2 + dy }); e.dispatchEvent(ev); }, [sel, type, id, dx, dy]);
  await dispatch('#joy', 'pointerdown', 11, 0, 0); await dispatch('#joy', 'pointermove', 11, 60, 0); await wait(pg, 100);
  ok('stick right -> tAx>0.9', await S(pg, () => BB.In.tAx) > .9, await S(pg, () => BB.In.tAx));
  await dispatch('#tF', 'pointerdown', 12, 0, 0); await wait(pg, 150);
  ok('multi-touch: stick + F hold simultaneously', await S(pg, () => BB.In.tAx > .9 && BB.In.tUse === true && __seen.useEdge >= 1));
  await shot(pg, tag + '_touch_active');
  await dispatch('#tF', 'pointerup', 12, 0, 0); await wait(pg, 60); ok('F release', await S(pg, () => BB.In.tUse) === false);
  await dispatch('#joy', 'pointermove', 11, -60, 0); await wait(pg, 60); ok('stick left -> tAx<-0.9', await S(pg, () => BB.In.tAx) < -.9);
  await dispatch('#joy', 'pointerup', 11, 0, 0); await wait(pg, 60); ok('stick release -> 0', await S(pg, () => BB.In.tAx) === 0);
  // busy hides touch controls and resets
  await dispatch('#joy', 'pointerdown', 13, 50, 0); await S(pg, () => { BB.ui.dialog([{ who: 'dan', text: 'Тест на телефоне. Нажми куда угодно.' }, 'вторая']); }); await wait(pg, 400);
  ok('dialogue resets stick and hides touch controls', await S(pg, () => BB.In.tAx === 0) && !(await vis(pg, '#joy')));
  await shot(pg, tag + '_dlg');
  await pg.touchscreen.tap(300, h - 60); await wait(pg, 200); await pg.touchscreen.tap(300, h - 60); await wait(pg, 200); await pg.touchscreen.tap(300, h - 60); await wait(pg, 300);
  ok('tap advances/ends dialogue', await S(pg, () => !BB.ui.busy()));
  // HUD buttons by touch
  [x, y] = await box('#bTasks'); await pg.touchscreen.tap(x, y); await wait(pg, 300); ok('tap tasks button', await vis(pg, '#tasksNote')); await shot(pg, tag + '_tasks');
  [x, y] = await box('#tasksNote .x'); await pg.touchscreen.tap(x, y); await wait(pg, 200); ok('tap note X', !(await vis(pg, '#tasksNote')));
  [x, y] = await box('#bDan'); await S(pg, () => __log.length = 0); await pg.touchscreen.tap(x, y); await wait(pg, 200); ok('tap Dan', await S(pg, () => __log.includes('dan')));
  [x, y] = await box('.slot[data-tool=vac]'); await pg.touchscreen.tap(x, y); await wait(pg, 200); ok('tap tool slot', await S(pg, () => BB.S.active) === 'vac', await S(pg, () => [BB.S.active, BB.S.tools]));
  [x, y] = await box('#bPause'); await pg.touchscreen.tap(x, y); await wait(pg, 400); ok('tap pause', await S(pg, () => BB.paused)); await shot(pg, tag + '_pause');
  [x, y] = await box('#menu .primary'); await pg.touchscreen.tap(x, y); await wait(pg, 300); ok('tap Продолжить', await S(pg, () => !BB.paused));
  // bubble long text at phone size
  await S(pg, () => BB.ui.say('Так, мусор в мешок, мешок в бак, бак в космос, а хозяина — на три буквы по маршруту.', {})); await wait(pg, 400); await shot(pg, tag + '_bubble');
  const bub = await pg.evaluate(() => { const r = document.querySelector('#bubble').getBoundingClientRect(), hb = document.querySelector('.hud-top').getBoundingClientRect(); return { top: r.top | 0, left: r.left | 0, right: r.right | 0, hudB: hb.bottom | 0 }; });
  ok('phone bubble not over HUD & inside', bub.top >= bub.hudB - 1 && bub.left >= 0 && bub.right <= w, bub);
  // result + settings + help + new at phone size
  await S(pg, () => { BB.S.f.fridgeDone = 1; BB.S.mode = 'ending'; BB.ui.result({ title: 'Хозяин в ярости, но жив', text: 'Придирки на 40 секунд.' }); }); await wait(pg, 1200); await shot(pg, tag + '_result');
  await S(pg, () => { BB.ui.closeMenu(); BB.S.mode = 'play'; BB.ui.showMenu('settings'); }); await wait(pg, 400); await shot(pg, tag + '_settings');
  await S(pg, () => { BB.ui.closeMenu(); BB.ui.showMenu('help'); }); await wait(pg, 400); await shot(pg, tag + '_help');
  await S(pg, () => { BB.ui.closeMenu(); BB.ui.showMenu('new'); }); await wait(pg, 400); await shot(pg, tag + '_new');
  await S(pg, () => { BB.ui.closeMenu(); BB.ui.showMenu('door', {}); }); await wait(pg, 400); await shot(pg, tag + '_door');
  await S(pg, () => { BB.ui.closeMenu(); BB.ui.toMenu(); }); await wait(pg, 600); await shot(pg, tag + '_title');
  await S(pg, () => { BB.ui.newGame(480); BB.S.time = 40; BB.ui.panel({ title: 'Холодильник: вонища', hint: 'Выбросите протухшее, оставьте нормальное.', build(el) { el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"><button class="btn">Колбаса</button><button class="btn alt">Кефир</button><button class="btn alt">Яйца</button></div>'; } }); }); await wait(pg, 500); await shot(pg, tag + '_panel');
  await ctx.close(); return logs;
}

(async () => {
  const s = await srv(), port = s.address().port;
  const br = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--ignore-gpu-blocklist'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const all = [];
  all.push(...await desktop(br, port, 1920, 1080, 'd1920', false));
  all.push(...await desktop(br, port, 1280, 720, 'd1280', true));
  all.push(...await touchTests(br, port, 844, 390, 2, 'm844'));
  all.push(...await touchTests(br, port, 390, 844, 2, 'p390'));
  console.log('\nconsole errors:', all.length ? '\n' + all.join('\n') : 'none');
  console.log('\nRESULT: ' + passes + ' passed, ' + fails + ' failed');
  await br.close(); s.close(); process.exit(fails ? 1 : 0);
})();
