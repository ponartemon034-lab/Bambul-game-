/* ==========================================================================
   BAMBOUL - UI / INPUT / MULTIPLATFORM  (owner: UI agent)
   HUD, menus, dialogue, panels, touch controls, settings, fullscreen, result.
   Contract: docs/ARCHITECTURE.md section 4 (BB.ui).  Details: docs/UI.md
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const U = BB.U || { clamp: (v, a, b) => Math.min(b, Math.max(a, v)), lerp: (a, b, t) => a + (b - a) * t };
  const clamp = U.clamp;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const safe = (f, d) => { try { return f(); } catch (e) { console.error('[ui]', e); return d; } };

  /* ------------------------------------------------------------------ CFG */
  const CFG_DEF = { vol: .7, music: true, sfx: true, musicVol: .8, sfxVol: 1, censor: false, subs: true, touch: false, quality: 'auto', debug: false, muted: false };
  let stored = {}; try { stored = JSON.parse(localStorage.getItem('bamboul.cfg') || '{}') || {}; } catch (e) { }
  const CFG = BB.CFG = Object.assign(BB.CFG || {}, CFG_DEF, stored);
  BB.saveCFG = () => { try { localStorage.setItem('bamboul.cfg', JSON.stringify(CFG)); } catch (e) { } };
  BB.applyCFG = () => {
    const A = BB.audio; if (!A || !A.setVolume) return;
    const m = CFG.muted ? 0 : CFG.vol;
    safe(() => { A.setVolume('master', m); A.setVolume('music', CFG.music ? CFG.musicVol : 0); A.setVolume('sfx', CFG.sfx ? CFG.sfxVol : 0); });
  };

  /* censor helper (same stems as legacy) */
  const SWEAR = /(бля[а-яё]*|пизд[а-яё]*|ху[йеёяю][а-яё]*|[а-яё]*(?:заеб|наеб|проеб|уеб|ебан|ебуч|ёб)[а-яё]*|сук[аи]|говн[а-яё]*|дерьм[а-яё]*|муда[а-яё]*|жоп[а-яё]*|сран[а-яё]*|хер[а-яё]*|хрен[а-яё]*)/gi;
  if (!BB.cz) BB.cz = t => (CFG.censor && t != null) ? String(t).replace(SWEAR, m => m[0] + '*'.repeat(Math.max(1, m.length - 1))) : t;
  const cz = t => BB.cz(t);

  /* ---------------------------------------------------------------- tiny DOM */
  function h(tag, attrs, kids) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k]; if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    if (kids) for (const c of [].concat(kids)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  }
  const IC = {
    hand: '<path d="M8 13V5.5a1.5 1.5 0 013 0V11m0-6.5a1.5 1.5 0 013 0V11m0-3.5a1.5 1.5 0 013 0v6.5a6 6 0 01-6 6h-.5a6 6 0 01-4.7-2.3L3.5 14.5a1.6 1.6 0 012.4-2L8 14"/>',
    vac: '<path d="M4 18a3 3 0 106 0 3 3 0 00-6 0zM7 15V9c0-2 1.5-3 3.5-3H20M17 6v8"/><path d="M15 14h5v4h-5z"/>',
    mop: '<path d="M14 3l-3 10M6 21l1.5-6.5h9L18 21zM9 21v-3M12 21v-3M15 21v-3"/>',
    box: '<rect x="3" y="9" width="18" height="11" rx="1.5"/><path d="M8 9V6h8v3M3 14h18M11 13h2v3h-2z"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="3.2"/>',
    bag: '<path d="M7 8h10l1 12H6zM9 8a3 3 0 016 0"/>',
    fs: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    tap: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/>',
    scrub: '<path d="M5 15l8-8 6 6-8 8zM9 11l4 4"/>',
    next: '<path d="M7 5l10 7-10 7z"/>'
  };
  const ic = (n, c) => '<svg class="ic ' + (c || '') + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + IC[n] + '</svg>';
  const sfx = n => { const A = BB.audio; if (A && A.sfx) safe(() => A.sfx(n)); };
  const fmt = s => { s = Math.max(0, Math.ceil(s)); return (s / 60 | 0) + ':' + String(s % 60).padStart(2, '0'); };
  const WHO = {
    bamboul: { name: 'Бамбуль', ch: 'Б' }, dan: { name: 'Дэн', ch: 'Д' }, landlord: { name: 'Аркадий Семёнович', ch: 'А' }, narr: { name: '', ch: '' }
  };
  const TOOLS = [['hand', 'Руки', 'hand', 'Digit1'], ['vac', 'Пылесос', 'vac', 'Digit2'], ['mop', 'Швабра', 'mop', 'Digit3'], ['box', 'Инструменты', 'box', 'Digit4']];

  /* ---------------------------------------------------------------- state */
  const st = {
    ready: false, qs: null, root: null, k: 1, menu: null, stack: [], menuPaused: false,
    dlg: null, dlgQ: [], ring: null, panels: [], tasksOpen: false, touch: false, touchAuto: false,
    bub: null, bq: [], bt: 0, prog: null, pollT: 0, lastClock: -1, lastPct: -1, prevDone: null, prevTime: null,
    danLocal: 0, danMax: 60, promptKey: '', pillW: 0, bubW: 0, bubH: 0, titleT: 0, total: 480, toasts: [], cues: []
  };
  const S_ = () => BB.S || BB.DEFAULT_S || { f: {}, tools: {}, mode: 'menu', time: 0, total: 1 };
  const playing = () => { const S = BB.S; return !!(S && (S.mode === 'play' || S.mode === 'ending')); };
  const els = {};

  function busy() { return !!(st.menu || st.dlg || st.ring || st.panels.length); }

  /* ================================================================ BUILD */
  function build(root) {
    root.innerHTML = '';
    root.classList.add('ui-root');
    // HUD ------------------------------------------------------------
    els.hud = h('div', { id: 'hud', 'aria-live': 'off' });
    els.hud.innerHTML =
      '<div class="hud-top">' +
      '<div class="clock" id="clock" role="timer" aria-label="До приезда хозяина"><small>Хозяин приедет через</small><b id="clockT">8:00</b></div>' +
      '<div class="clean" id="clean" aria-label="Чистота квартиры"><div class="clean-h"><span>Чистота</span><b id="cleanP">0%</b></div><div class="bar"><i id="cleanBar"></i><u></u><u></u></div></div>' +
      '<div class="hbtns">' +
      '<button class="ib" id="bTasks" data-act="tasks" aria-label="Список дел (Tab)" title="Список дел (Tab)">' + ic('list') + '<kbd>Tab</kbd></button>' +
      '<button class="ib" id="bDan" data-act="dan" aria-label="Позвонить Дэну (T)" title="Позвонить Дэну (T)">' + ic('phone') +
      '<svg class="cd" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16.5" pathLength="100"/></svg><em id="danCd"></em><kbd>T</kbd></button>' +
      '<button class="ib" id="bPause" data-act="pause" aria-label="Пауза (Esc)" title="Пауза (Esc)">' + ic('pause') + '<kbd>Esc</kbd></button>' +
      '</div></div>' +
      '<div class="tools" id="tools" role="toolbar" aria-label="Инструменты">' +
      TOOLS.map(t => '<button class="slot" data-tool="' + t[0] + '" aria-label="' + t[1] + ' (' + t[3].slice(5) + ')">' + ic(t[2]) + '<kbd>' + t[3].slice(5) + '</kbd><span>' + t[1] + '</span></button>').join('') +
      '<div class="bagc" id="bagc" title="Мусорный мешок">' + ic('bag') + '<b id="bagN">0</b></div></div>';
    root.append(els.hud);
    els.clock = $('#clock', root); els.clockT = $('#clockT', root); els.cleanP = $('#cleanP', root); els.cleanBar = $('#cleanBar', root);
    els.danCd = $('#danCd', root); els.bDan = $('#bDan', root); els.tools = $('#tools', root); els.bagN = $('#bagN', root);

    els.sub = h('div', { id: 'sub', class: 'sub', 'aria-live': 'polite' }); root.append(els.sub);
    els.cues = h('div', { id: 'cues', class: 'cues', 'aria-live': 'polite' }); root.append(els.cues);
    els.toasts = h('div', { id: 'toasts', class: 'toasts', 'aria-live': 'polite' }); root.append(els.toasts);
    els.bub = h('div', { id: 'bubble', class: 'bubble', 'aria-hidden': 'true' }); root.append(els.bub);
    els.pill = h('div', { id: 'pill', class: 'pill', 'aria-hidden': 'true' }); root.append(els.pill);
    els.tasks = h('aside', { id: 'tasksNote', class: 'tasksNote', hidden: true, 'aria-label': 'Список дел' }); root.append(els.tasks);

    // touch ----------------------------------------------------------
    els.touch = h('div', { id: 'touch' });
    els.touch.innerHTML =
      '<div id="joy" aria-label="Стик движения"><i id="knob"></i><span class="arr l">&lsaquo;</span><span class="arr r">&rsaquo;</span></div>' +
      '<button class="tb" id="tJ" aria-label="Прыжок">' + ic('up') + '<small>прыжок</small></button>' +
      '<button class="tb hold" id="tF" aria-label="Убирать (держать)">' + ic('scrub') + '<small>держи</small></button>' +
      '<button class="tb big" id="tE" aria-label="Действие"><b>E</b><small id="tELbl">действие</small></button>';
    root.append(els.touch);

    // dialogue -------------------------------------------------------
    els.dlg = h('div', { id: 'dlg', class: 'dlg', hidden: true, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Диалог' });
    els.dlg.innerHTML =
      '<div class="dlg-vig"></div><div class="dlg-box">' +
      '<div class="dlg-rib" id="dlgRib"></div>' +
      '<div class="dlg-av"><canvas id="dlgCv" width="128" height="128"></canvas><span id="dlgLetter"></span></div>' +
      '<div class="dlg-main"><div class="dlg-who" id="dlgWho"></div><p class="dlg-txt" id="dlgTxt"></p>' +
      '<div class="dlg-ch" id="dlgCh"></div></div>' +
      '<div class="dlg-bt"><button class="skip" id="dlgSkip" type="button">Пропустить</button><button class="nx" id="dlgNext" type="button" aria-label="Дальше">' + ic('next') + '<span>Дальше</span><kbd>E</kbd></button></div>' +
      '</div>';
    root.append(els.dlg);
    els.dlgBox = $('.dlg-box', els.dlg); els.dlgTxt = $('#dlgTxt', root); els.dlgWho = $('#dlgWho', root); els.dlgCh = $('#dlgCh', root);
    els.dlgCv = $('#dlgCv', root); els.dlgLetter = $('#dlgLetter', root); els.dlgRib = $('#dlgRib', root);
    $('#dlgNext', root).addEventListener('click', () => dlgAdvance());
    $('#dlgSkip', root).addEventListener('click', () => dlgSkip());
    els.dlgBox.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; dlgAdvance(); });

    // ring -----------------------------------------------------------
    els.ring = h('div', { id: 'ring', class: 'ring', hidden: true, role: 'alertdialog', 'aria-label': 'Входящий звонок' });
    els.ring.innerHTML = '<div class="ring-av"><canvas id="ringCv" width="96" height="96"></canvas><span id="ringLetter"></span><i></i></div>' +
      '<div class="ring-tx"><small>Входящий звонок</small><b id="ringWho">Аркадий Семёнович</b></div>' +
      '<button class="btn ok" id="rYes" type="button">Взять трубку<kbd>E</kbd></button><button class="btn bad" id="rNo" type="button">Сбросить<kbd>N</kbd></button>';
    root.append(els.ring);
    $('#rYes', root).addEventListener('click', () => ringEnd(true));
    $('#rNo', root).addEventListener('click', () => ringEnd(false));

    els.panels = h('div', { id: 'panels', class: 'panels' }); root.append(els.panels);
    els.menu = h('div', { id: 'menu', class: 'menu', hidden: true }); root.append(els.menu);
    els.rotate = h('div', { id: 'rotate', class: 'rotate', role: 'status' });
    els.rotate.innerHTML = '<div class="phoneico"></div><h2>Поверни телефон</h2><p>Бамбуль любит ландшафт: тогда видно и квартиру, и грязь.</p>';
    els.rotate.append(h('button', { class: 'btn alt', type: 'button', text: 'Всё равно играть', onclick: () => { els.rotate.classList.add('dismiss'); } }));
    root.append(els.rotate);
    els.fade = h('div', { id: 'fade', class: 'fade' }); root.append(els.fade);

    bindTouch(); bindHud();
  }

  /* ================================================================ HUD */
  function bindHud() {
    els.hud.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'tasks') openTasks();
      else if (b.dataset.act === 'dan') callDan();
      else if (b.dataset.act === 'pause') pause();
      else if (b.dataset.tool) selectTool(b.dataset.tool);
    });
  }
  function selectTool(id) {
    const S = BB.S; if (!S || S.mode !== 'play' || busy()) return;
    const def = TOOLS.find(t => t[0] === id);
    if (id !== 'hand' && !(S.tools && S.tools[id])) { toast('Сначала найди: ' + def[1].toLowerCase(), 'warn'); return; }
    const T = BB.tasks; let r;
    if (T && T.setTool) r = safe(() => T.setTool(id)); else if (T && T.selectTool) r = safe(() => T.selectTool(id)); else S.active = id;
    if (r === false) { toast('Это сейчас не взять', 'warn'); return; }
    sfx('uiClick'); hud.update();
  }
  function callDan() {
    const S = BB.S; if (!S || S.mode !== 'play' || busy()) return;
    const cd = danCooldown();
    if (cd.left > .05) { toast('Дэн занят. Перезвонить можно через ' + Math.ceil(cd.left) + ' с', 'warn'); return; }
    let r = true;
    if (BB.story && BB.story.callDan) r = safe(() => BB.story.callDan(), true);
    else dialog([{ who: 'dan', text: 'Алло? ...Слушай, я на работе. Сам разберёшься.' }], null, { phone: true });
    if (r !== false) { st.danLocal = st.danMax = (BB.story && BB.story.CFG && BB.story.CFG.danCooldown) || 60; }
  }
  /* cooldown source: BB.story.danCooldown() -> {left,max} | seconds ; S.calls.danCd ; local fallback */
  function danCooldown() {
    const S = BB.S || {}; let left = st.danLocal, max = st.danMax;
    if (BB.story && BB.story.danCooldown) {
      const v = safe(() => BB.story.danCooldown(S));
      if (typeof v === 'number') left = v; else if (v && typeof v === 'object') { left = v.left || 0; max = v.max || max; }
    } else if (S.calls && typeof S.calls.danCd === 'number') left = S.calls.danCd;
    return { left: Math.max(0, left), max: Math.max(1, max) };
  }
  function progress() {
    const S = BB.S; if (!S || !BB.tasks || !BB.tasks.progress) return st.prog || { score: 0, parts: [], done: 0, total: 0 };
    return safe(() => BB.tasks.progress(S), st.prog) || st.prog || { score: 0, parts: [], done: 0, total: 0 };
  }
  function refreshHud(full) {
    const S = BB.S; if (!S || !playing()) return;
    const p = st.prog = progress();
    const pct = Math.round(clamp(p.score || 0, 0, 100));
    if (pct !== st.lastPct) { st.lastPct = pct; els.cleanP.textContent = pct + '%'; els.cleanBar.style.width = pct + '%'; els.hud.classList.toggle('clean-ok', pct >= 80); }
    // tools
    const act = S.active || 'hand';
    $$('.slot', els.tools).forEach(b => {
      const id = b.dataset.tool, has = id === 'hand' || !!(S.tools && S.tools[id]);
      b.classList.toggle('on', id === act); b.classList.toggle('lock', !has); b.setAttribute('aria-pressed', id === act ? 'true' : 'false');
    });
    const bag = S.carry ? ((S.carry.trash | 0) + (S.carry.haul | 0)) : 0; els.bagN.textContent = bag; $('#bagc', els.hud).classList.toggle('has', bag > 0);
    $('#bagc', els.hud).title = S.carry ? 'В руках: ' + (S.carry.trash | 0) + (S.carry.haul ? ', полный мешок: ' + S.carry.haul : '') : 'Мусор';
    // progress toasts: newly completed parts
    const done = {}; (p.parts || []).forEach(x => { done[x.id] = x.p >= .999; });
    if (st.prevDone) for (const id in done) if (done[id] && !st.prevDone[id]) { const part = p.parts.find(x => x.id === id); toast('Готово: ' + (part ? part.label : id), 'ok'); sfx('taskDone'); }
    st.prevDone = done;
    if (st.tasksOpen) renderTasks();
  }
  const hud = { update() { refreshHud(true); } };

  function updateClock() {
    const S = BB.S; if (!S) return;
    const left = S.mode === 'ending' ? 0 : S.time;
    const sec = Math.ceil(Math.max(0, left));
    if (sec !== st.lastClock) {
      const crossed = [300, 120, 60, 30, 10].find(th => st.prevTime != null && st.prevTime > th && left <= th);
      st.lastClock = sec; els.clockT.textContent = fmt(left);
      els.clock.classList.toggle('warn', left <= 120); els.clock.classList.toggle('low', left <= 60);
      if (crossed && S.mode === 'play') {
        els.clock.classList.remove('flash'); void els.clock.offsetWidth; els.clock.classList.add('flash');
        toast(crossed >= 60 ? 'Осталось ' + (crossed / 60) + ' ' + (crossed === 60 ? 'минута' : crossed === 300 ? 'минут' : 'минуты') : 'Осталось ' + crossed + ' секунд', crossed <= 60 ? 'bad' : 'warn');
      }
    }
    st.prevTime = left;
  }

  /* ---- checklist note ---------------------------------------------------- */
  function partsHTML(parts, big) {
    return parts.map(x => {
      const pct = Math.round(clamp(x.p, 0, 1) * 100), done = x.p >= .999, sm = big ? x.text : (done ? '' : (x.hint || x.where || x.text));
      return '<li class="' + (done ? 'done' : '') + '"><span class="tk" aria-hidden="true">' + (done ? '&#10003;' : '') + '</span>' +
        '<div class="pt"><b>' + esc(cz(x.label)) + '</b>' + (sm ? '<small>' + esc(cz(sm)) + '</small>' : '') +
        '<i class="mb"><u style="width:' + pct + '%"></u></i></div><em>' + pct + '%</em></li>';
    }).join('');
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function checklistParts(p) {
    const S = BB.S; if (S && BB.tasks && BB.tasks.checklist) { const c = safe(() => BB.tasks.checklist(S)); if (c && c.length) return c; }
    return p.parts || [];
  }
  function renderTasks() {
    const p = st.prog || progress(), parts = checklistParts(p);
    const sig = Math.round(p.score) + '|' + parts.map(x => x.id + ':' + Math.round(x.p * 100) + ':' + (x.hint || x.text || '')).join(',');
    if (sig === st.tasksSig && els.tasks.firstChild) return; st.tasksSig = sig;
    els.tasks.innerHTML = '<header><h3>Что надо сделать</h3><span class="sc">' + Math.round(p.score || 0) + '%</span><button type="button" class="x" aria-label="Закрыть список" data-close>' + ic('x') + '</button></header>' +
      '<ul>' + (parts.length ? partsHTML(parts) : '<li><div class="pt"><b>Пока пусто</b><small>Задачи появятся, когда начнётся игра.</small></div></li>') + '</ul>' +
      '<footer>' + (p.total ? 'Сделано ' + p.done + ' из ' + p.total + '. ' : '') + 'Закрыть: <kbd>Tab</kbd></footer>';
    $('[data-close]', els.tasks).addEventListener('click', () => openTasks(false));
  }
  function openTasks(force) {
    const want = force == null ? !st.tasksOpen : !!force;
    if (want && (!playing() || st.menu || st.dlg || st.ring)) return;
    st.tasksOpen = want; els.tasks.hidden = !want; if (want) { st.prog = progress(); st.tasksSig = ''; renderTasks(); sfx('uiClick'); } else if (force == null) sfx('uiBack');
    $('#bTasks', els.hud).classList.toggle('on', want);
  }

  /* ================================================================ TOAST / CUES */
  function toast(text, kind) {
    text = cz(String(text || '')); if (!text) return;
    if (st.toasts.some(t => t.text === text)) return;
    const el = h('div', { class: 'toast ' + (kind || ''), text }); const t = { el, text, ttl: 2.6 };
    els.toasts.append(el); st.toasts.push(t); requestAnimationFrame(() => el.classList.add('in'));
    while (st.toasts.length > 3) killToast(st.toasts[0]);
  }
  function killToast(t) { const i = st.toasts.indexOf(t); if (i < 0) return; st.toasts.splice(i, 1); t.el.classList.remove('in'); setTimeout(() => t.el.remove(), 300); }
  /* subtitles for sound cues: BB.ui.cue('[звонит телефон]') */
  function cue(text, dur) {
    if (!CFG.subs || !text) return; text = cz(String(text));
    if (st.cues.some(c => c.text === text)) return;
    const el = h('div', { class: 'cue', text }); els.cues.append(el); const c = { el, text, ttl: dur || 2.2 }; st.cues.push(c);
    if (st.cues.length > 3) { const o = st.cues.shift(); o.el.remove(); }
  }

  /* ================================================================ SAY (barks) */
  function say(text, o) {
    o = o || {}; text = cz(String(text == null ? '' : text)); if (!text) return false;
    if (!o.force && (st.dlg || st.ring || !playing() || (BB.S && BB.S.mode !== 'play' && !o.force))) return false;
    const it = { text, who: o.who || 'bamboul', prio: o.prio == null ? 1 : o.prio, dur: o.dur || clamp(1.7 + text.length * .055, 2.4, 7) };
    if (st.bub) {
      if (st.bub.text === text) return true;
      if (it.prio > st.bub.prio) { st.bub = null; hideBubble(); }
      else { if (!st.bq.some(q => q.text === text)) { st.bq.push(it); if (st.bq.length > 3) { st.bq.sort((a, b) => b.prio - a.prio); st.bq.length = 3; } } return true; }
    }
    showBub(it); return true;
  }
  function showBub(it) {
    st.bub = it; st.bt = it.dur;
    const phone = it.who === 'dan' || it.who === 'landlord';
    const el = phone ? els.sub : els.bub;
    el.className = (phone ? 'sub ' : 'bubble ') + it.who + ' on';
    el.innerHTML = phone ? '<b>' + esc(WHO[it.who].name) + ' <em>по телефону</em></b><span></span>' : '<span></span>';
    $('span', el).textContent = it.text;
    el.style.fontSize = it.text.length > 110 ? '.84em' : it.text.length > 70 ? '.92em' : '';
    st.bubPhone = phone; st.bubW = el.offsetWidth; st.bubH = el.offsetHeight;
  }
  function hideBubble() { els.bub.classList.remove('on'); els.sub.classList.remove('on'); }
  function clearBarks() { st.bub = null; st.bq.length = 0; hideBubble(); }

  /* ================================================================ DIALOGUE */
  function dialog(lines, onEnd, opts) {
    opts = opts || {}; if (!Array.isArray(lines)) lines = [lines];
    lines = lines.filter(l => l != null && l !== '').map(l => typeof l === 'string' ? { who: 'bamboul', text: l } : l);
    if (!lines.length) { onEnd && safe(onEnd); return null; }
    const d = { lines, i: -1, onEnd, opts, typed: 0, full: '', line: null, typing: false, shown: 0 };
    if (st.dlg) { st.dlgQ.push(d); return d; }
    startDlg(d); return d;
  }
  function startDlg(d) {
    st.dlg = d; clearBarks(); openTasks(false); releaseTouch();
    els.dlg.hidden = false; requestAnimationFrame(() => els.dlg.classList.add('on'));
    updateBusy(); nextLine();
  }
  function portrait(canvas, letterEl, who, mood) {
    let src = null;
    if (BB.char && BB.char.portrait && who !== 'narr') src = safe(() => BB.char.portrait(who, mood || 'neutral'));
    const g = canvas.getContext('2d'); g.clearRect(0, 0, canvas.width, canvas.height);
    if (src && (src.width || src.naturalWidth)) {
      const w = src.width || src.naturalWidth, hh = src.height || src.naturalHeight, s = Math.max(canvas.width / w, canvas.height / hh);
      safe(() => g.drawImage(src, (canvas.width - w * s) / 2, 0, w * s, hh * s));
      canvas.style.display = ''; letterEl.textContent = ''; return;
    }
    canvas.style.display = 'none'; letterEl.textContent = (WHO[who] || WHO.bamboul).ch;
  }
  function nextLine() {
    const d = st.dlg; if (!d) return;
    d.i++; if (d.i >= d.lines.length) return endDlg();
    const L = d.line = d.lines[d.i], who = L.who || 'bamboul', info = WHO[who] || { name: who, ch: String(who)[0] || '?' };
    const phone = d.opts.phone || who === 'landlord' && d.opts.phone !== false;
    els.dlg.className = 'dlg on who-' + who + (phone && who !== 'narr' ? ' phone' : '') + (who === 'narr' ? ' narr' : '');
    els.dlgRib.textContent = phone && who !== 'narr' ? (who === 'landlord' ? 'ТРУБКА · ХОЗЯИН НА ПРОВОДЕ' : 'ТРУБКА · ' + (info.name || '').toUpperCase()) : '';
    els.dlgWho.textContent = L.name || info.name; els.dlgCh.innerHTML = ''; els.dlgCh.classList.remove('show');
    portrait(els.dlgCv, els.dlgLetter, who, L.mood);
    d.full = cz(typeof L.text === 'function' ? L.text() : L.text || ''); d.typed = 0; d.typing = true; d.shown = -1;
    $('#dlgSkip', els.dlg).hidden = d.lines.length - d.i < 2 || d.lines.slice(d.i).some(l => l.choices && l.choices.length);
    if (who === 'landlord') sfx('landlordVoice'); else if (who === 'dan') sfx('danVoice');
    renderTyped(true);
  }
  function renderTyped(force) {
    const d = st.dlg; if (!d) return; const n = d.typing ? Math.floor(d.typed) : d.full.length;
    if (!force && n === d.shown) return; d.shown = n;
    els.dlgTxt.innerHTML = '<span>' + esc(d.full.slice(0, n)) + '</span><span class="rest">' + esc(d.full.slice(n)) + '</span>';
    if (n >= d.full.length && d.typing) finishTyping();
  }
  function finishTyping() {
    const d = st.dlg; if (!d) return; d.typing = false; d.typed = d.full.length;
    const L = d.line;
    if (L && L.choices && L.choices.length) {
      els.dlgCh.innerHTML = '';
      L.choices.forEach((c, i) => els.dlgCh.append(h('button', { class: 'btn ch', type: 'button', onclick: () => dlgChoose(i) }, [h('kbd', { text: String(i + 1) }), cz(c.text)])));
      els.dlgCh.classList.add('show'); $('#dlgNext', els.dlg).classList.add('wait');
      const f = $('button', els.dlgCh); f && f.focus({ preventScroll: true });
    } else $('#dlgNext', els.dlg).classList.remove('wait');
  }
  function dlgAdvance() {
    const d = st.dlg; if (!d) return false;
    if (d.typing) { d.typed = d.full.length; renderTyped(true); finishTyping(); return true; }
    if (d.line && d.line.choices && d.line.choices.length) return true;     // must choose
    sfx('uiClick'); nextLine(); return true;
  }
  function dlgChoose(i) {
    const d = st.dlg; if (!d || !d.line || !d.line.choices) return false; const c = d.line.choices[i]; if (!c) return false;
    sfx('uiClick'); els.dlgCh.innerHTML = ''; els.dlgCh.classList.remove('show'); d.line = { who: d.line.who, text: '' };
    if (c.lines && c.lines.length) d.lines.splice(d.i + 1, 0, ...c.lines.map(l => typeof l === 'string' ? { who: 'bamboul', text: l } : l));
    if (c.run) safe(() => c.run(i));
    if (st.dlg === d) nextLine(); return true;
  }
  function dlgSkip() {
    const d = st.dlg; if (!d) return; let j = d.lines.findIndex((l, i) => i > d.i && l.choices && l.choices.length);
    d.i = (j < 0 ? d.lines.length : j) - 1; nextLine();
  }
  function endDlg() {
    const d = st.dlg; st.dlg = null; els.dlg.classList.remove('on'); els.dlg.hidden = true; els.dlgCh.innerHTML = '';
    updateBusy();
    if (d && d.onEnd) safe(() => d.onEnd());
    if (!st.dlg && st.dlgQ.length) startDlg(st.dlgQ.shift());
  }

  /* ---- incoming call -------------------------------------------------------- */
  function ring(who, onAnswer, onDecline) {
    who = who || 'landlord'; if (st.ring) ringEnd(false, true);
    st.ring = { who, onAnswer, onDecline }; clearBarks(); openTasks(false); releaseTouch();
    $('#ringWho', els.ring).textContent = (WHO[who] || { name: who }).name;
    els.ring.className = 'ring who-' + who; els.ring.hidden = false; portrait($('#ringCv', els.ring), $('#ringLetter', els.ring), who, 'angry');
    requestAnimationFrame(() => els.ring.classList.add('on')); updateBusy();
    setTimeout(() => { try { $('#rYes', els.ring).focus({ preventScroll: true }); } catch (e) { } }, 30);
    return { close: () => ringEnd(false, true) };
  }
  function ringEnd(answer, silent) {
    const r = st.ring; if (!r) return; st.ring = null; els.ring.classList.remove('on'); els.ring.hidden = true; updateBusy(); sfx('uiClick');
    if (silent) return;
    const cb = answer ? r.onAnswer : r.onDecline; if (cb) safe(() => cb());
  }

  /* ================================================================ PANEL (minigames) */
  function panel(o) {
    o = o || {};
    const root = h('div', { class: 'pnl' + (o.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || 'Окно' });
    root.innerHTML = '<div class="pnl-win"><div class="pnl-tape"></div><header><h2></h2><button type="button" class="x" aria-label="Закрыть (Esc)">' + ic('x') + '</button></header>' +
      '<p class="pnl-hint"></p><div class="pnl-prog" hidden><i></i></div><div class="pnl-body"></div></div>';
    const body = $('.pnl-body', root), hint = $('.pnl-hint', root), prog = $('.pnl-prog', root), titleEl = $('h2', root);
    titleEl.textContent = cz(o.title || ''); hint.textContent = cz(o.hint || ''); hint.hidden = !o.hint;
    const api = { el: body, root, closed: false, opts: o };
    api.setHint = t => { hint.textContent = cz(t || ''); hint.hidden = !t; hint.classList.remove('pop'); void hint.offsetWidth; hint.classList.add('pop'); };
    api.setTitle = t => { titleEl.textContent = cz(t || ''); root.setAttribute('aria-label', t || 'Окно'); };
    api.setProgress = p => { prog.hidden = false; $('i', prog).style.width = Math.round(clamp(p, 0, 1) * 100) + '%'; };
    api.shake = () => { const w = $('.pnl-win', root); w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake'); };
    api.close = () => {
      if (api.closed) return; api.closed = true;
      const i = st.panels.indexOf(api); if (i >= 0) st.panels.splice(i, 1);
      root.classList.remove('on'); setTimeout(() => root.remove(), 220); updateBusy(); sfx('uiBack');
      if (api.prev && api.prev.isConnected) safe(() => api.prev.focus({ preventScroll: true }));
      if (o.onClose) safe(() => o.onClose(api));
    };
    $('.x', root).addEventListener('click', api.close);
    root.addEventListener('pointerdown', e => { if (e.target === root) { /* backdrop: ignore on purpose (touch safety) */ } });
    api.prev = document.activeElement;
    els.panels.append(root); st.panels.push(api); releaseTouch(); openTasks(false); updateBusy();
    if (o.build) safe(() => o.build(body, api));
    requestAnimationFrame(() => root.classList.add('on'));
    setTimeout(() => { if (api.closed) return; const f = focusables(root).find(x => !x.classList.contains('x')) || $('.x', root); f && f.focus({ preventScroll: true }); }, 40);
    return api;
  }
  function focusables(root) {
    return $$('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])', root).filter(e => !e.disabled && !e.hidden && e.offsetParent !== null);
  }
  function trapTab(root, e) {
    const f = focusables(root); if (!f.length) return;
    const i = f.indexOf(document.activeElement); let n = e.shiftKey ? i - 1 : i + 1;
    if (n < 0) n = f.length - 1; if (n >= f.length) n = 0; f[n].focus({ preventScroll: true });
  }

  /* ================================================================ MENUS */
  const SUB = { settings: 1, help: 1, new: 1 };
  function btn(text, cls, fn, extra) {
    const b = h('button', { class: 'btn ' + (cls || ''), type: 'button', onclick: fn }, [text].concat(extra || []));
    return b;
  }
  function showMenu(kind, arg) {
    arg = arg || {};
    if (st.menu && SUB[kind] && st.menu.kind !== kind) st.stack.push(st.menu);
    else if (st.menu && !SUB[kind]) st.stack.length = 0;
    st.menu = { kind, arg };
    if ((kind === 'pause' || kind === 'door') && BB.S && BB.S.mode === 'play' && !BB.paused) {
      if (kind === 'pause' && BB.story && BB.story.pause) { safe(() => BB.story.pause()); st.menuPaused = 'story'; }
      if (!BB.paused) BB.paused = true;
      if (!st.menuPaused) st.menuPaused = 'ui';
    }
    releaseTouch(); openTasks(false); clearBarks();
    const m = els.menu; m.hidden = false; m.className = 'menu m-' + kind + (kind === 'title' ? ' on-scene' : '');
    m.innerHTML = '';
    const sheet = h('div', { class: 'sheet' }); m.append(sheet);
    const B = { title, new: newMenu, help, settings, pause: pauseMenu, door, result: resultMenu }[kind];
    if (B) B(sheet, arg);
    updateBusy();
    requestAnimationFrame(() => { m.classList.add('on'); const d = $('[data-default]', m) || $('.btn', m); d && d.focus({ preventScroll: true }); });
    if (kind === 'title') titleScene(true);
  }
  function closeMenu() {
    st.menu = null; st.stack.length = 0; els.menu.hidden = true; els.menu.classList.remove('on');
    if (st.menuPaused) { const by = st.menuPaused; st.menuPaused = false; if (by === 'story' && BB.story && BB.story.resume) safe(() => BB.story.resume()); BB.paused = false; }
    updateBusy();
  }
  /* external abort hooks used by story.js / minigames */
  function closeDialog() { const had = !!(st.dlg || st.ring || st.dlgQ.length); st.dlgQ.length = 0; if (st.dlg) { st.dlg = null; els.dlg.classList.remove('on'); els.dlg.hidden = true; els.dlgCh.innerHTML = ''; } if (st.ring) { st.ring = null; els.ring.classList.remove('on'); els.ring.hidden = true; } updateBusy(); return had; }
  function closePanel() { const n = st.panels.length; st.panels.slice().forEach(p => p.close()); return n; }
  function menuBack() {
    if (!st.menu) return;
    const k = st.menu.kind;
    if (k === 'pause') return resume();
    if (k === 'door') return doorNo();
    if (SUB[k]) { sfx('uiBack'); const p = st.stack.pop(); if (p) { st.menu = null; showMenu(p.kind, p.arg); } else closeMenu(); }
  }
  function updateBusy() {
    const b = busy(), app = $('#app'); if (app) app.classList.toggle('busy', b);
    if (b) releaseTouch();
    const root = st.root; if (root) { root.classList.toggle('has-menu', !!st.menu); root.classList.toggle('has-dlg', !!st.dlg || !!st.ring); }
  }

  /* ---- title ---------------------------------------------------------------- */
  function title(sheet) {
    const hasSave = !!(BB.story && BB.story.hasSave && safe(() => BB.story.hasSave(), false));
    const best = bestScore();
    sheet.append(...[
      h('div', { class: 'brand' }, [h('h1', { class: 'logo', text: 'БАМБУЛЬ' }), h('p', { class: 'tagline' }, [h('span', { text: 'хозяин едет' })])]),
      h('p', { class: 'lead', text: 'Через пару минут приедет хозяин квартиры. А у тебя там — археология.' }),
      h('div', { class: 'col menu-btns' }, [
        btn('Новая игра', 'primary', () => showMenu('new')),
        hasSave ? btn('Продолжить', '', continueGame) : btn('Продолжить', 'dis', () => toast('Сохранения пока нет. Начни новую игру.', 'warn'), []),
        btn('Как играть', '', () => showMenu('help')),
        btn('Настройки', '', () => showMenu('settings'))
      ]),
      best ? h('p', { class: 'fine best', text: 'Лучший результат: ' + best.score + '% · оценка ' + best.grade }) : null,
      h('p', { class: 'fine', text: 'A/D — идти · Пробел — прыжок · E — действие · F — убирать · Esc — пауза' })
    ].filter(Boolean));
    const first = $('.primary', sheet); first && first.setAttribute('data-default', '');
    const fsb = h('button', { class: 'ib corner', type: 'button', 'aria-label': 'Полный экран', title: 'Полный экран', html: ic('fs'), onclick: toggleFS });
    els.menu.append(fsb);
  }
  function titleScene(on) {
    const P = BB.P; st.titleOn = on;
    if (on && P && BB.cam) { P.x = 700; P.y = 0; P.dir = 1; P.vx = 0; BB.cam.focus = { x: 700 }; BB.snapCamera && BB.snapCamera(); }
  }
  function continueGame() {
    let ok = false;
    if (BB.story && BB.story.continue) ok = safe(() => BB.story.continue(), false) !== false;
    else if (BB.story && BB.story.load) ok = safe(() => BB.story.load(), false) !== false;
    if (!ok) { toast('Не получилось загрузить сохранение', 'bad'); return; }
    leaveTitle();
  }
  function leaveTitle() { st.titleOn = false; if (BB.cam) BB.cam.focus = null; closeMenu(); BB.paused = false; st.prevDone = null; st.prevTime = null; st.lastClock = -1; st.lastPct = -1; st.danLocal = 0; hud.update(); }

  /* ---- new game --------------------------------------------------------------- */
  function newMenu(sheet) {
    const opts = [[600, 'Не спеша', '10 минут', 'Для тех, кто любит перекуры'], [480, 'Как обычно', '8 минут', 'Как раз, чтобы не успеть'], [300, 'Паника', '5 минут', 'Хозяин уже на лестнице']];
    sheet.append(h('h2', { text: 'Сколько у тебя времени?' }), h('p', { class: 'fine', text: 'Столько осталось до приезда хозяина. Чем меньше — тем смешнее.' }));
    const row = h('div', { class: 'cards' });
    opts.forEach((o, i) => {
      const b = h('button', { class: 'card' + (o[0] === 480 ? ' pick' : ''), type: 'button', 'data-total': o[0], onclick: () => newGame(o[0]) }, [h('small', { text: o[1] }), h('b', { text: o[2] }), h('span', { text: o[3] })]);
      if (o[0] === 480) b.setAttribute('data-default', ''); row.append(b);
    });
    sheet.append(row, h('div', { class: 'rowb' }, [btn('Назад', 'alt', menuBack)]));
  }
  function newGame(total) {
    total = total || 480; st.total = total; sfx('uiClick');
    leaveTitle(); BB.paused = false; clearBarks(); st.dlgQ.length = 0;
    if (BB.audio && BB.audio.init) safe(() => BB.audio.init());
    if (BB.story && BB.story.start) safe(() => BB.story.start(total));
    else {
      BB.S = BB.newState ? BB.newState(total) : Object.assign({}, BB.DEFAULT_S, { f: {}, items: [], stains: [], dust: [], tools: {}, total, time: total });
      BB.S.mode = 'play'; BB.S.time = BB.S.time || total; BB.S.total = total;
      if (BB.P) { BB.P.x = 300; } BB.snapCamera && BB.snapCamera();
    }
    if (BB.S && BB.S.mode !== 'play') BB.S.mode = 'play';
    st.prevDone = null; st.lastClock = -1; st.lastPct = -1; hud.update(); updateClock();
  }

  /* ---- help ------------------------------------------------------------------- */
  function help(sheet) {
    const K = (k, t) => ['<dt>' + k + '</dt><dd>' + t + '</dd>'].join('');
    sheet.append(h('h2', { text: 'Как играть' }));
    const wrap = h('div', { class: 'helpgrid' });
    wrap.innerHTML =
      '<section class="paper"><h3>Клавиатура</h3><dl class="keys">' +
      K('<kbd>A</kbd> <kbd>D</kbd> / <kbd>&larr;</kbd> <kbd>&rarr;</kbd>', 'идти (<kbd>Shift</kbd> — бежать)') + K('<kbd>Пробел</kbd>', 'прыжок: через коробки и хлам') +
      K('<kbd>E</kbd>', 'действие: взять, открыть, починить, ответить') + K('<kbd>F</kbd>', 'держать — убирать пылесосом и шваброй') +
      K('<kbd>1</kbd>–<kbd>4</kbd>', 'руки · пылесос · швабра · инструменты') + K('<kbd>Tab</kbd>', 'список дел') +
      K('<kbd>T</kbd>', 'позвонить Дэну (подсказка)') + K('<kbd>Esc</kbd> / <kbd>P</kbd>', 'пауза') + K('<kbd>M</kbd>', 'звук вкл/выкл') + K('<kbd>F3</kbd>', 'отладка') + '</dl></section>' +
      '<section class="paper tilt"><h3>Телефон / планшет</h3><dl class="keys">' +
      K('Стик слева', 'идти; тянуть до упора — бежать') + K('Кнопка ↑', 'прыжок') + K('Большая <b>E</b>', 'действие, на ней написано какое') +
      K('Кнопка «держи»', 'убирать: удерживай') + K('Верхние кнопки', 'список дел, звонок Дэну, пауза') + K('Нижняя полоска', 'выбор инструмента') + '</dl></section>' +
      '<section class="paper tips"><h3>Что к чему</h3><ul>' +
      '<li><b>Мусор</b> — подбери и неси к мешку в прихожей или к ведру на кухне.</li>' +
      '<li><b>Пылесос</b> (шкаф в прихожей) и <b>швабра</b> (ванная): выбери, встань на грязь и держи F.</li>' +
      '<li><b>Ящик с инструментами</b> (мастерская) нужен для крана, смыва и принтера.</li>' +
      '<li>Холодильник, кран, туалет, принтер — это мини-игры. Дэн подскажет, если позвонить.</li>' +
      '<li>Когда таймер красный — хозяин уже во дворе. Чистота считается по-честному.</li></ul></section>';
    sheet.append(wrap, h('div', { class: 'rowb' }, [btn('Понятно', 'primary', menuBack)]));
    $('.btn', sheet).setAttribute('data-default', '');
  }

  /* ---- settings --------------------------------------------------------------- */
  function settings(sheet) {
    sheet.append(h('h2', { text: 'Настройки' }));
    const box = h('div', { class: 'paper setbox' }); sheet.append(box);
    const row = (label, ctl, sub) => h('label', { class: 'set' }, [h('span', { class: 'sl' }, [label, sub ? h('small', { text: sub }) : null]), ctl]);
    const slider = (key, onch) => {
      const out = h('output', { text: Math.round(CFG[key] * 100) + '%' });
      const inp = h('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round(CFG[key] * 100), 'aria-label': key });
      inp.addEventListener('input', () => { CFG[key] = inp.value / 100; out.textContent = inp.value + '%'; if (key === 'musicVol') CFG.music = CFG[key] > 0; if (key === 'sfxVol') CFG.sfx = CFG[key] > 0; if (CFG.muted && key === 'vol') CFG.muted = false; BB.saveCFG(); BB.applyCFG(); });
      inp.addEventListener('change', () => sfx('uiClick'));
      const w = h('span', { class: 'sw' }, [inp, out]); return w;
    };
    const toggle = (key, after) => {
      const c = h('input', { type: 'checkbox', role: 'switch', 'aria-label': key }); c.checked = !!CFG[key];
      c.addEventListener('change', () => { CFG[key] = c.checked; BB.saveCFG(); BB.applyCFG(); sfx('uiClick'); after && after(c.checked); }); return c;
    };
    box.append(
      row('Громкость', slider('vol')), row('Музыка', slider('musicVol')), row('Звуки', slider('sfxVol')),
      row('Запикать мат', toggle('censor'), 'Звёздочки вместо крепких слов'),
      row('Реалистичный герой', toggle('realHero'), 'Вместо мультяшного: полные анимации только у мультяшного'),
      row('Субтитры звуков', toggle('subs'), 'Подписи вроде «[звонит телефон]»'),
      row('Сенсорное управление', toggle('touch', v => setTouch(v)), 'Всегда показывать стик и кнопки'),
      row('Показать отладку', toggle('debug', v => { if (BB.debug) BB.debug.on = v; }), 'То же, что F3')
    );
    const qrow = h('div', { class: 'set qual' }), qb = h('span', { class: 'seg', role: 'radiogroup', 'aria-label': 'Качество графики' });
    [['auto', 'Авто'], ['low', 'Низкое'], ['med', 'Среднее'], ['high', 'Высокое']].forEach(q => {
      const b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(CFG.quality === q[0]), class: CFG.quality === q[0] ? 'on' : '', text: q[1], 'data-q': q[0] }); b.onclick = () => setQuality(q[0], qb); qb.append(b);
    });
    qrow.append(h('span', { class: 'sl' }, ['Графика', h('small', { id: 'qNote', text: 'Тени, размытие и частицы. Слабый телефон — ставь «Низкое».' })]), qb);
    box.append(qrow);
    box.append(row('Полный экран', h('button', { class: 'btn alt sm', type: 'button', id: 'fsBtn', text: fsEl() ? 'Выйти' : 'Включить', onclick: toggleFS })));
    sheet.append(h('div', { class: 'rowb' }, [btn('Готово', 'primary', menuBack)]));
    $('.primary', sheet).setAttribute('data-default', '');
  }
  function setQuality(q, group) {
    CFG.quality = q; BB.saveCFG();
    if (group) $$('button', group).forEach(b => { const on = b.dataset.q === q; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    if (q !== 'auto' && BB.setQuality) safe(() => BB.setQuality(q));
    let note = 'Применено.';
    if (q !== 'auto') { if (BB.rebuild) safe(() => BB.rebuild()); else note = 'Размытие и частицы — сразу; запечённые картинки обновятся после перезагрузки страницы.'; }
    else note = 'Выбор по устройству при следующем запуске.';
    const n = $('#qNote'); if (n) n.textContent = note; sfx('uiClick');
  }
  function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function toggleFS() {
    const app = $('#app'); const msg = 'Браузер не разрешил полный экран. На iPhone он недоступен: добавь игру «На экран Домой».';
    try {
      if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      const rq = app.requestFullscreen || app.webkitRequestFullscreen;
      if (!rq) { toast(msg, 'warn'); return; }
      const p = rq.call(app); if (p && p.catch) p.catch(() => toast(msg + ' (нужно нажать кнопку самому)', 'warn'));
    } catch (e) { toast(msg, 'warn'); }
  }
  function onFs() { const b = $('#fsBtn'); if (b) b.textContent = fsEl() ? 'Выйти' : 'Включить'; setTimeout(() => BB.fit && BB.fit(), 80); measure(); }

  /* ---- pause / door ------------------------------------------------------------ */
  function pause() {
    const S = BB.S; if (!S || S.mode !== 'play' || st.menu || st.dlg || st.ring) return false;
    if (!(BB.story && BB.story.pause) && BB.story && BB.story.save) safe(() => BB.story.save());
    sfx('uiClick'); showMenu('pause'); return true;
  }
  function resume() { if (!st.menu) return; sfx('uiBack'); closeMenu(); }
  function pauseMenu(sheet) {
    const S = BB.S || {};
    sheet.append(h('h2', { text: 'Пауза' }), h('p', { class: 'fine', text: 'Игра сохранена. Осталось: ' + fmt(S.time || 0) + ' · чистота ' + Math.round((progress().score) || 0) + '%' }),
      h('div', { class: 'col menu-btns' }, [
        btn('Продолжить', 'primary', resume), btn('Список дел', '', () => { closeMenu(); openTasks(true); }),
        btn('Как играть', '', () => showMenu('help')), btn('Настройки', '', () => showMenu('settings')),
        btn('Выйти в меню', 'bad', () => toMenu())]));
    $('.primary', sheet).setAttribute('data-default', '');
  }
  function toMenu() {
    const hadStory = BB.story && BB.story.toTitle;
    if (!hadStory && BB.story && BB.story.save && BB.S && BB.S.mode === 'play') safe(() => BB.story.save());
    closeMenu(); BB.paused = false; clearBarks(); closeDialog(); closePanel(); openTasks(false);
    if (hadStory) { safe(() => BB.story.toTitle()); if (!st.menu) showMenu('title'); BB.paused = false; return; }
    if (BB.audio && BB.audio.stopAll) safe(() => BB.audio.stopAll());
    BB.S = BB.DEFAULT_S; if (BB.In && BB.In.reset) BB.In.reset(); BB.player && BB.player.lock && BB.player.lock(false);
    showMenu('title');
  }
  function door(sheet, arg) {
    sheet.append(h('h2', { text: arg.title || 'Открыть дверь?' }),
      h('p', { class: 'lead', text: arg.text || 'Если открыть сейчас, хозяин зайдёт и оценит квартиру как есть. Время ещё осталось: ' + fmt((BB.S && BB.S.time) || 0) + '.' }),
      h('div', { class: 'rowb' }, [btn(arg.yes || 'Открыть', 'bad', doorYes), btn(arg.no || 'Ещё пободаюсь с пылью', 'primary', doorNo)]));
    $('.primary', sheet).setAttribute('data-default', '');
  }
  function doorYes() { const a = st.menu && st.menu.arg || {}; closeMenu(); if (a.onYes) safe(() => a.onYes()); else if (BB.story && BB.story.ending) safe(() => BB.story.ending(true)); }
  function doorNo() { const a = st.menu && st.menu.arg || {}; closeMenu(); a.onNo && safe(() => a.onNo()); }

  /* ---- result ------------------------------------------------------------------ */
  const GRADES = [[92, 'S', 'Хоромы, хоть царя селить'], [80, 'A', 'Придраться почти не к чему'], [60, 'B', 'Жить можно'], [40, 'C', 'Терпимо, но с запашком'], [20, 'D', 'Археологи в восторге'], [-1, 'F', 'Филиал помойки']];
  function gradeOf(score) { return GRADES.find(g => score >= g[0]); }
  function bestScore() { try { return JSON.parse(localStorage.getItem('bamboul.best') || 'null'); } catch (e) { return null; } }
  function result(sc, parts, opts) {
    opts = opts || {}; if (typeof sc === 'number') sc = { score: sc }; sc = sc || {};
    const p = progress(); parts = parts || p.parts || [];
    const score = Math.round(sc.score != null ? sc.score : p.score || 0), g = gradeOf(score);
    const total = (BB.S && BB.S.total) || st.total;
    const prev = bestScore(), isBest = !prev || score > prev.score;
    if (isBest) try { localStorage.setItem('bamboul.best', JSON.stringify({ score, grade: sc.grade || g[1], total })); } catch (e) { }
    clearBarks(); st.dlgQ.length = 0; openTasks(false);
    showMenu('result', { sc, parts, score, grade: sc.grade || g[1], title: sc.title || sc.ending || g[2], text: sc.text || sc.sub || '', opts, isBest, prev, total, left: sc.left != null ? sc.left : (BB.S && BB.S.time) });
    sfx(score >= 60 ? 'endGood' : score >= 30 ? 'endOk' : 'endBad');
  }
  function resultMenu(sheet, a) {
    const paper = h('div', { class: 'paper act' });
    paper.innerHTML = '<div class="act-h"><small>Акт осмотра квартиры</small><span class="act-no">№ ' + (1000 + (a.score * 7 + a.total) % 9000) + '</span></div>' +
      '<h2 class="act-t">' + esc(cz(a.title)) + '</h2>' + (a.text ? '<p class="act-s">' + esc(cz(a.text)) + '</p>' : '') +
      '<ul class="parts">' + (a.parts.length ? partsHTML(a.parts, true) : '<li><div class="pt"><b>Без замечаний (комиссия не нашла, что осматривать)</b></div></li>') + '</ul>' +
      '<div class="act-sum"><div><small>Чистота</small><b>' + a.score + '%</b></div><div><small>Лучший</small><b>' + Math.max(a.score, a.prev ? a.prev.score : 0) + '%</b>' + (a.isBest ? '<i class="rec">рекорд!</i>' : '') + '</div></div>' +
      '<div class="stamp g-' + a.grade + '" aria-label="Оценка ' + a.grade + '">' + a.grade + '</div>';
    sheet.append(paper, h('div', { class: 'rowb' }, [
      btn('Ещё раз', 'primary', () => { const t = a.total || 480; closeMenu(); if (a.opts.onAgain) safe(() => a.opts.onAgain()); else newGame(t); }),
      btn('В меню', 'alt', () => { closeMenu(); if (a.opts.onMenu) safe(() => a.opts.onMenu()); else toMenu(); })]));
    $('.primary', sheet).setAttribute('data-default', '');
  }

  /* ================================================================ TOUCH CONTROLS */
  const tp = { joy: null, jx: 0, btn: {} };
  function isCoarse() { return !!(window.matchMedia && (matchMedia('(pointer:coarse)').matches || (navigator.maxTouchPoints > 0 && !matchMedia('(hover:hover)').matches))); }
  function setTouch(on) {
    st.touch = !!on; const app = $('#app'); app.classList.toggle('touch', st.touch); if (!on) releaseTouch(); measure();
  }
  function releaseTouch() {
    const In = BB.In; if (In) { In.tAx = 0; In.tUse = false; }
    tp.joy = null; const k = $('#knob'); if (k) k.style.transform = ''; $$('.tb.down').forEach(b => b.classList.remove('down')); tp.btn = {};
  }
  function bindTouch() {
    const joy = $('#joy', els.touch), knob = $('#knob', els.touch);
    const setAx = e => {
      const r = joy.getBoundingClientRect(), R = r.width / 2, dx = e.clientX - (r.left + R), dy = e.clientY - (r.top + R);
      const rr = Math.min(R * .9, Math.hypot(dx, dy)), a = Math.atan2(dy, dx);
      knob.style.transform = 'translate(' + Math.cos(a) * rr + 'px,' + Math.sin(a) * rr + 'px)';
      const ax = clamp(dx / (R * .72), -1, 1); BB.In.tAx = Math.abs(ax) < .16 ? 0 : ax; BB.In.usedTouch = true;
      if (dy < -R * .8 && !tp.up) { tp.up = true; BB.In.jump = true; } else if (dy > -R * .5) tp.up = false;
    };
    joy.addEventListener('pointerdown', e => { e.preventDefault(); if (busy()) return; tp.joy = e.pointerId; try { joy.setPointerCapture(e.pointerId); } catch (_) { } BB.audio && BB.audio.init && BB.audio.init(); joy.classList.add('down'); setAx(e); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === tp.joy) setAx(e); });
    const end = e => { if (e.pointerId !== tp.joy) return; tp.joy = null; tp.up = false; BB.In.tAx = 0; knob.style.transform = ''; joy.classList.remove('down'); };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => joy.addEventListener(n, end));
    const bindBtn = (id, down, up) => {
      const b = $('#' + id, els.touch);
      b.addEventListener('pointerdown', e => { e.preventDefault(); if (busy()) return; tp.btn[id] = e.pointerId; try { b.setPointerCapture(e.pointerId); } catch (_) { } b.classList.add('down'); BB.audio && BB.audio.init && BB.audio.init(); BB.In.usedTouch = true; down && down(e); });
      const rel = e => { if (tp.btn[id] !== e.pointerId) return; delete tp.btn[id]; b.classList.remove('down'); up && up(e); };
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => b.addEventListener(n, rel));
      b.addEventListener('contextmenu', e => e.preventDefault());
    };
    bindBtn('tJ', () => { BB.In.jump = true; });
    bindBtn('tF', () => { BB.In.tUse = true; BB.In.useEdge = true; }, () => { BB.In.tUse = false; });
    bindBtn('tE', () => { BB.In.act = true; });
  }

  /* ================================================================ GEOMETRY / FRAME */
  function measure() {
    const app = $('#app'); if (!app) return; const r = app.getBoundingClientRect(); st.k = r.height / 720; st.W = r.width; st.Hh = r.height;
    const top = $('.hud-top', els.hud); st.hudBottom = top && playing() ? top.getBoundingClientRect().bottom + 8 : 8;
  }
  let acc = 0;
  function frame(dt, t) {
    if (!st.ready) return;
    const S = BB.S, play = playing();
    els.hud.classList.toggle('off', !play || (st.menu && (st.menu.kind === 'title' || st.menu.kind === 'result')));
    if (!play) { els.pill.classList.remove('on'); els.bub.classList.remove('on'); }
    // title scene: slow cinematic drift, hero idle
    if (st.titleOn && BB.cam && BB.cam.focus) { st.titleT += dt; BB.cam.focus.x = 640 + Math.sin(st.titleT * .13) * 140 + Math.sin(st.titleT * .31) * 25; }
    if (st.menuPaused === false && !BB.paused && BB.timeScale !== 1) { /* keep */ }
    // typewriter
    if (st.dlg && st.dlg.typing) { st.dlg.typed += dt * (st.dlg.opts.cps || 52); renderTyped(); }
    // toasts / cues / bubble timers
    for (let i = st.toasts.length - 1; i >= 0; i--) { const q = st.toasts[i]; q.ttl -= dt; if (q.ttl <= 0) killToast(q); }
    for (let i = st.cues.length - 1; i >= 0; i--) { const q = st.cues[i]; q.ttl -= dt; if (q.ttl <= 0) { q.el.remove(); st.cues.splice(i, 1); } }
    if (st.bub && !BB.paused) { st.bt -= dt; if (st.bt <= 0) { st.bub = null; hideBubble(); if (st.bq.length) { st.bq.sort((a, b) => b.prio - a.prio); showBub(st.bq.shift()); } } }
    if (st.danLocal > 0 && !BB.paused) st.danLocal = Math.max(0, st.danLocal - dt);
    if (!play) return;
    updateClock();
    acc += dt; if (acc > .25) { acc = 0; refreshHud(); measure(); }
    // dan cooldown ring
    const cd = danCooldown(), frac = cd.left > .05 ? cd.left / cd.max : 0;
    els.bDan.classList.toggle('cool', frac > 0); els.bDan.style.setProperty('--cd', (frac * 100).toFixed(1));
    const cdTxt = frac > 0 ? String(Math.ceil(cd.left)) : ''; if (els.danCd.textContent !== cdTxt) els.danCd.textContent = cdTxt;
    placeOverlays();
  }
  function placeOverlays() {
    const S = BB.S, P = BB.P, k = st.k; if (!P || !BB.sx) return;
    const L = BB.LAYOUT || { playerH: 178 }, can = S.mode === 'play' && !busy() && !BB.paused;
    // prompt pill ---------------------------------------------------------
    const cur = BB.cur, pill = els.pill; let pillOn = false, px = 0, py = 0;
    const useHint = !!(S.hintUse && can);
    if (can && cur && cur.hot && cur.prompt) {
      const key = cur.prompt + '|' + st.touch + '|' + useHint;
      if (key !== st.promptKey) {
        st.promptKey = key;
        pill.innerHTML = '<span class="cap">' + (st.touch ? ic('tap') : 'E') + '</span><span class="tx"></span>' + (useHint ? '<span class="hold"><kbd>' + (st.touch ? 'держи' : 'F') + '</kbd>' + (st.touch ? '' : ' убирать') + '</span>' : '');
        $('.tx', pill).textContent = cz(cur.prompt); st.pillW = pill.offsetWidth; st.pillH = pill.offsetHeight;
      }
      pillOn = true; px = BB.sx(cur.ax, 0) * k; py = BB.sy((cur.hot.h || 100) + 12, 0) * k;
    } else if (useHint) {
      const key = 'hold|' + st.touch; if (key !== st.promptKey) { st.promptKey = key; pill.innerHTML = '<span class="hold only"><kbd>' + (st.touch ? 'держи' : 'F') + '</kbd> убирать</span>'; st.pillW = pill.offsetWidth; st.pillH = pill.offsetHeight; }
      pillOn = true; px = BB.sx(P.x, 0) * k; py = BB.sy(P.y + 60, 0) * k;
    } else st.promptKey = '';
    if (pillOn) {
      const w = st.pillW || 160, hh = st.pillH || 40, m = 8;
      const x = clamp(px, w / 2 + m, st.W - w / 2 - m), y = clamp(py, st.hudBottom + hh + 4, st.Hh - hh - 8);
      pill.style.transform = 'translate3d(' + (x - w / 2).toFixed(1) + 'px,' + (y - hh).toFixed(1) + 'px,0)'; st.pillX = x; st.pillY = y - hh;
    }
    pill.classList.toggle('on', pillOn);
    // touch E label
    if (st.touch) {
      const lbl = $('#tELbl'), tx = can && cur && cur.prompt ? cz(cur.prompt) : 'действие';
      if (lbl.textContent !== tx) lbl.textContent = tx;
      $('#tE').classList.toggle('idle', !(cur && cur.hot)); $('#tF').classList.toggle('idle', !S.hintUse);
    }
    // speech bubble over hero -----------------------------------------------
    if (st.bub && !st.bubPhone) {
      const b = els.bub; if (!st.bubW) { st.bubW = b.offsetWidth; st.bubH = b.offsetHeight; }
      const w = b.offsetWidth || st.bubW, hh = b.offsetHeight || st.bubH, m = 10;
      let cx = BB.sx(P.x, 0) * k, top = BB.sy(P.y + (L.playerH || 178) + 10, 0) * k - hh - 12;
      if (pillOn && Math.abs(cx - st.pillX) < (w + st.pillW) / 2 + 8 && st.pillY < top + hh + 6) top = Math.min(top, st.pillY - hh - 10);
      const x = clamp(cx, w / 2 + m, st.W - w / 2 - m), y = Math.max(top, st.hudBottom);
      const tail = clamp(cx - (x - w / 2), 18, w - 18);
      b.style.transform = 'translate3d(' + (x - w / 2).toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)'; b.style.setProperty('--tail', tail.toFixed(0) + 'px');
      b.classList.toggle('notail', top < st.hudBottom - 2);
    }
  }

  /* ================================================================ KEYS */
  function menuNav(e) {
    const c = e.code, items = focusables(els.menu).filter(x => x.tagName === 'BUTTON' || x.tagName === 'INPUT');
    const i = items.indexOf(document.activeElement);
    if (c === 'ArrowDown' || c === 'ArrowRight' || (c === 'Tab' && !e.shiftKey)) { items[(i + 1) % items.length] && items[(i + 1) % items.length].focus(); return true; }
    if (c === 'ArrowUp' || c === 'ArrowLeft' || (c === 'Tab' && e.shiftKey)) { items[(i - 1 + items.length) % items.length] && items[(i - 1 + items.length) % items.length].focus(); return true; }
    return false;
  }
  function activate(e) {
    const a = document.activeElement;
    if (a && a.tagName === 'BUTTON' && a.closest('#ui')) { a.click(); return true; }
    const d = $('[data-default]', els.menu); if (d) { d.click(); return true; }
    return false;
  }
  function onKey(e, down) {
    if (!st.ready) return false;
    const c = e.code, S = BB.S;
    if (!down) return busy();
    if (c === 'KeyM' && !e.ctrlKey && !e.metaKey) { CFG.muted = !CFG.muted; BB.saveCFG(); BB.applyCFG(); toast(CFG.muted ? 'Звук выключен (M)' : 'Звук включён (M)'); return true; }
    if (st.ring) {
      if (['Enter', 'Space', 'KeyE', 'KeyY', 'Digit1', 'NumpadEnter'].includes(c)) { ringEnd(true); return true; }
      if (['Escape', 'KeyN', 'Digit2'].includes(c)) { ringEnd(false); return true; }
      if (c === 'Tab' || c.startsWith('Arrow')) { trapTab(els.ring, e); return true; }
      return true;
    }
    if (st.dlg) {
      if (['Space', 'Enter', 'KeyE', 'NumpadEnter'].includes(c)) {
        const a = document.activeElement; if (a && a.closest && a.closest('#dlgCh') && (c === 'Enter' || c === 'Space')) { a.click(); return true; }
        dlgAdvance(); return true;
      }
      const m = /^(?:Digit|Numpad)([1-9])$/.exec(c); if (m) { dlgChoose(+m[1] - 1); return true; }
      if (c === 'Tab' || c === 'ArrowDown' || c === 'ArrowUp') { const f = $$('button', els.dlgCh); if (f.length) { const i = f.indexOf(document.activeElement); f[(i + ((c === 'ArrowUp' || e.shiftKey) ? -1 : 1) + f.length) % f.length].focus(); } return true; }
      return true;
    }
    if (st.panels.length) {
      const p = st.panels[st.panels.length - 1];
      if (c === 'Escape') { p.close(); return true; }
      if (c === 'Tab') { trapTab(p.root, e); return true; }
      if (c === 'Space' || c === 'Enter') { const a = document.activeElement; if (a && a.tagName === 'BUTTON' && p.root.contains(a) && c === 'Space') a.click(); }
      return true;
    }
    if (st.menu) {
      if (c === 'Escape') { menuBack(); return true; }
      if (c === 'Enter' || c === 'Space' || c === 'NumpadEnter') { e.preventDefault(); activate(e); return true; }
      if (menuNav(e)) { e.preventDefault(); return true; }
      return true;
    }
    if (!S || S.mode !== 'play') return false;
    if (c === 'Escape' || c === 'KeyP') { pause(); return true; }
    if (c === 'Tab') { openTasks(); return true; }
    if (c === 'KeyT') { callDan(); return true; }
    const t = TOOLS.find(x => x[3] === c); if (t) { selectTool(t[0]); return true; }
    return false;
  }
  function onBlur() {
    releaseTouch();
    if (document.hidden && BB.S && BB.S.mode === 'play' && !busy()) pause();
  }

  /* ================================================================ READY */
  function onReady(qs) {
    qs = qs || new URLSearchParams(location.search); st.qs = qs;
    const root = st.root = $('#ui'); if (!root) return;
    build(root);
    if (!BB.S) BB.S = BB.DEFAULT_S;
    if (qs.get('q') == null && CFG.quality && CFG.quality !== 'auto' && BB.setQuality) safe(() => BB.setQuality(CFG.quality));
    if (CFG.debug && BB.debug) BB.debug.on = true;
    BB.applyCFG();
    setTouch(CFG.touch || qs.has('touch') || isCoarse());
    st.touchAuto = !st.touch;
    addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && !st.touch) setTouch(true); }, { passive: true, capture: true });
    addEventListener('resize', measure); addEventListener('orientationchange', () => setTimeout(measure, 250));
    document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);
    document.addEventListener('keydown', e => { // keys inside sliders / selects never reach main.js: handle Esc here
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.code === 'Escape' && st.menu) { menuBack(); e.preventDefault(); }
    });
    root.addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.dataset.noclick) sfx('uiClick'); }, true);
    root.addEventListener('contextmenu', e => e.preventDefault());
    if (BB.on) {
      BB.on('progress', () => { if (st.ready) refreshHud(); });
      BB.on('toast', d => toast(typeof d === 'string' ? d : d && d.text, d && d.kind));
    }
    st.ready = true; measure();
    const a = qs.get('autostart');
    if (a != null && a !== '0') { const n = +a; newGame(n > 10 ? n : 480); if (qs.has('pause')) setTimeout(pause, 300); }
    else {
      showMenu('title'); const m = qs.get('menu');
      if (m === 'settings' || m === 'help' || m === 'new') showMenu(m);
    }
  }

  /* ================================================================ PUBLIC */
  BB.ui = {
    onReady, busy, onKey, onBlur, frame, say, dialog, toast, panel, ring, cue,
    showMenu, closeMenu, closeDialog, closePanel, result, openTasks, pause, resume, toMenu, newGame, selectTool, toggleFullscreen: toggleFS,
    hud, get state() { return st; }, setTouch, isTouch: () => st.touch, releaseTouch,
    bubbleActive: () => !!st.bub, dialogActive: () => !!st.dlg, menuKind: () => st.menu && st.menu.kind
  };
  BB.ui.hud = hud;
})();
