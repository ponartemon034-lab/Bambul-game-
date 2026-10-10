/* ==========================================================================
   lines_user.js - the authored Bamboul lines (dlg.USER, js/dialogue_plus.js) replace the old ambient chatter.
   Every flavour category of BB.dlg gets the lines that fit the situation: after a call, cleaning, rubbish, the tap, being tired,
   standing about, mishaps ... Informational barks (tool hints, door, boxes, tutorial) and the phone calls themselves keep their text.
   Loaded after dialogue / lines_despair; the pools are replaced in place, so cooldowns / priorities of each category stay as they were.
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const dlg = BB.dlg; if (!dlg || !dlg._POOL || !dlg.USER) return;
  const U = dlg.USER, POOL = dlg._POOL, EMO = dlg.EMO = dlg.EMO || {};
  const G = { owner: U.owner, chore: U.chore, trash: U.trash, faucet: U.faucet, tired: U.tired, wait: U.wait, oops: U.oops };
  const rows = (names) => { const out = []; for (const n of names) { const w = typeof n === 'string' ? 1 : n[1], g = G[typeof n === 'string' ? n : n[0]]; for (const r of g) out.push({ t: r[0], w, when: null }); } return out; };
  const set = (cats, groups) => { for (const c of cats) POOL[c] = rows(groups); };

  /* ---- after a phone call with the landlord: dread, hope for a jam, back to work ---- */
  const HANG = [
    ['Сука, лишь бы не приехал раньше времени.', 'panic'], ['Только бы он в пробке застрял на сутки, блядь.', 'panic'],
    ['Господи, пусть там ремонт на дороге до конца месяца, прошу тебя, блядь.', 'panic'], ['Ну всё, блядь, часики тикают. Надо шевелиться, нахуй.', 'annoyed'],
    ['Лишь бы не приехал, лишь бы не приехал, лишь бы не приехал, сука…', 'panic'], ['Охуенно. Просто охуенно. И что мне теперь делать за эти минуты?', 'angry'],
    ['Пускай переезд закроют на час. Или на два. Или навсегда, сука.', 'angry'], ['Хоть бы его там колесо поймало. Нет, блядь, не колесо — лучше ремонт дороги на неделю.', 'annoyed'],
    ['Ладно, думай, Бамбуль, думай. Мусор, кран, холодильник… Нет, всё сразу, блядь!', 'panic'], ['Он сейчас едет и считает, сколько я ему должен. Мразь.', 'angry']
  ];
  POOL['phone:hangup'] = HANG.map(r => ({ t: r[0], w: 1, when: null })); HANG.forEach(r => { EMO[r[0]] = r[1]; });
  set(['phone:ignore', 'phone:answer'], ['owner']);

  /* ---- the boss is coming ---- */
  set(['time:300', 'time:120', 'phone:ring', 'owner:comes'], ['owner']);

  /* ---- panic when the clock runs out: the despair lines of the last levels ---- */
  const D = dlg.DESPAIR;
  if (D) { const pan = D.S3.concat(D.S5).map(r => ({ t: r[0], w: 1, when: null })); for (const c of ['time:60', 'time:30', 'time:10']) POOL[c] = pan.slice(); }

  /* ---- rubbish, bags, clothes ---- */
  set(['pickup', 'toss', 'cloth', 'clothIn', 'stash', 'laundry:pick', 'laundry:load'], ['trash']);
  set(['bagFull'], ['trash', ['oops', .5]]);

  /* ---- the tap ---- */
  set(['faucet:open', 'faucet:inspect', 'faucet:tighten', 'faucet:neighbours'], ['faucet']);

  /* ---- mishaps and failures ---- */
  set(['oops', 'fail', 'spam', 'boom', 'vac:snag', 'vac:stuck', 'mop:wet', 'fridge:disgust', 'fridge:rotten', 'fridge:bad', 'faucet:wrong', 'toilet:wrong',
    'toilet:flushFail', 'printer:error', 'printer:wrong', 'printer:setback', 'cleanLow'], ['oops', ['owner', .4]]);

  /* ---- cleaning and repairs in progress ---- */
  set(['chore:avoid', 'vac:start', 'vac:run', 'vac:unjam', 'mop:start', 'mop:run', 'mop:bucket', 'tool:vac', 'tool:mop', 'tool:box', 'laundry:start', 'laundry:wait', 'laundry:noise',
    'dishes', 'mirror', 'fridge:open', 'fridge:scrub', 'fridge:close', 'toilet:inspect', 'toilet:clean', 'toilet:scrub', 'printer:inspect', 'printer:clearing', 'printer:rethread',
    'printer:test', 'printer:last'], ['chore', ['tired', .6]]);

  /* ---- a job is finished ---- */
  set(['vac:done', 'mop:done', 'fridge:done', 'toilet:done', 'toilet:flush', 'printer:success', 'faucet:done', 'faucet:tested', 'success', 'cleanHigh'], ['tired', ['chore', .4]]);

  /* ---- standing about, walking in, general mood ---- */
  set(['idle', 'idle:l1', 'idle:l2'], ['wait', 'chore']); set(['idle:l3', 'idle:l4'], ['tired', 'oops']); set(['idle:l5'], ['tired', 'owner']);
  set(['wait'], ['wait']); set(['tired'], ['tired']);
  set(['roomEnter:hall', 'roomEnter:living', 'roomEnter:kitchen', 'roomEnter:bath', 'roomEnter:work'], ['chore', 'trash', 'tired']);
  set(['jump', 'land', 'tv:on', 'tv:off', 'sofa', 'pc', 'stove', 'tub'], ['wait', 'tired', 'chore']);

  /* ---- walking around: everything authored, plus the level-gated despair lines kept by lines_despair.js ---- */
  const gated = (POOL.move || []).filter(e => e.when);
  POOL.move = rows([['owner', 2.5], ['chore', 2.5], ['trash', 2.5], ['faucet', 2.5], ['tired', 2.5], ['wait', 2.5], ['oops', 2.5]]).concat(gated);
})();
