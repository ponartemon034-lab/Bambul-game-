/* ==========================================================================
   BAMBOUL - BB.mini : staged, clue-driven repair / cleaning minigames.
   Owner: minigame agent.  See docs/MINIGAMES.md.
   ids: fridge, faucet, toilet, printer, dishes, mirror, vacJam
   BB.mini.start(id, S, onDone)  onDone({win, timeCost, partial, id, stage})
   Progress lives in S.f (world flags) and S.mg[id] (private stage memory),
   so closing mid-way and re-opening resumes at the same stage.
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const rng = seed => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const W = 760, H = 400;                      // logical stage canvas size
  const FONT = '"Golos Text",system-ui,"Segoe UI",Roboto,Arial,sans-serif';
  const DISPLAY = '"Rubik Dirt",Impact,"Arial Black",sans-serif';
  const COL = { ink: '#12100e', soot: '#221d19', paper: '#efe2c4', mustard: '#d9a93a', navy: '#2d3050', rust: '#c2512f', moss: '#86ad55', dim: '#a89a80' };

  /* ------------------------------------------------------------ painting kit */
  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function box(g, x, y, w, h, r, fill) { rr(g, x, y, w, h, r); g.fillStyle = fill; g.fill(); }
  function lg(g, x0, y0, x1, y1, stops) { const k = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => k.addColorStop(Array.isArray(s) ? s[0] : i / (stops.length - 1), Array.isArray(s) ? s[1] : s)); return k; }
  function rg(g, x, y, r0, r1, stops) { const k = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach((s, i) => k.addColorStop(Array.isArray(s) ? s[0] : i / (stops.length - 1), Array.isArray(s) ? s[1] : s)); return k; }
  function ell(g, x, y, rx, ry, fill, rot) { g.beginPath(); g.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), rot || 0, 0, TAU); g.fillStyle = fill; g.fill(); }
  function line(g, x0, y0, x1, y1, c, w) { g.strokeStyle = c; g.lineWidth = w || 1; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  function poly(g, pts, fill) { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fillStyle = fill; g.fill(); }
  function glow(g, x, y, r, rgb, a) { g.fillStyle = rg(g, x, y, 0, r, [[0, 'rgba(' + rgb + ',' + a + ')'], [1, 'rgba(' + rgb + ',0)']]); g.fillRect(x - r, y - r, r * 2, r * 2); }
  function shadowE(g, x, y, rx, ry, a) { g.save(); g.translate(x, y); g.scale(1, ry / rx); g.fillStyle = rg(g, 0, 0, 0, rx, [[0, 'rgba(0,0,0,' + (a == null ? .45 : a) + ')'], [1, 'rgba(0,0,0,0)']]); g.fillRect(-rx, -rx, rx * 2, rx * 2); g.restore(); }
  function txt(g, s, x, y, o) { o = o || {}; g.font = (o.font || '700 14px ' + FONT); g.fillStyle = o.color || COL.paper; g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic'; if (o.stroke) { g.lineWidth = o.sw || 3; g.strokeStyle = o.stroke; g.lineJoin = 'round'; g.strokeText(s, x, y); } g.fillText(s, x, y); }
  function wrapText(g, s, x, y, maxW, lh, o) { const words = s.split(' '); let ln = ''; let yy = y; g.font = (o && o.font) || '600 13px ' + FONT; for (const w of words) { const t = ln ? ln + ' ' + w : w; if (g.measureText(t).width > maxW && ln) { txt(g, ln, x, yy, o); ln = w; yy += lh; } else ln = t; } if (ln) txt(g, ln, x, yy, o); return yy + lh; }
  let _noise = null;
  function noise() { if (_noise) return _noise; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), d = g.createImageData(128, 128), r = rng(7); for (let i = 0; i < d.data.length; i += 4) { const v = 90 + r() * 140 | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); return _noise = c; }
  function grain(g, x, y, w, h, a) { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.globalAlpha = a || .08; g.globalCompositeOperation = 'overlay'; const t = noise(); for (let xx = x - (x % 128); xx < x + w; xx += 128) for (let yy = y - (y % 128); yy < y + h; yy += 128) g.drawImage(t, xx, yy); g.restore(); }
  function vignette(g, a) { g.fillStyle = rg(g, W / 2, H / 2, H * .35, W * .62, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,' + (a == null ? .5 : a) + ')']]); g.fillRect(0, 0, W, H); }
  /* tiled wall (kitchen / bath) */
  function tileWall(g, x, y, w, h, base, grout, tw, seed) {
    const r = rng(seed || 3); g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); box(g, x, y, w, h, 0, grout);
    const th = tw; for (let yy = y; yy < y + h; yy += th) for (let xx = x - ((yy / th | 0) % 2) * tw / 2; xx < x + w; xx += tw) { const v = r() * .12 - .06; g.fillStyle = lg(g, xx, yy, xx + tw, yy + th, [shadeC(base, 1 + v + .08), shadeC(base, 1 + v - .06)]); g.fillRect(xx + 1.5, yy + 1.5, tw - 3, th - 3); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(xx + 1.5, yy + 1.5, tw - 3, 1.5); }
    g.restore();
  }
  function hexC(c) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function shadeC(c, f) { const a = hexC(c); return 'rgb(' + a.map(v => clamp(Math.round(v * f), 0, 255)).join(',') + ')'; }
  function mixC(a, b, t) { const x = hexC(a), y = hexC(b); return 'rgb(' + x.map((v, i) => Math.round(lerp(v, y[i], t))).join(',') + ')'; }
  function chrome(g, x, y, w, h, vertical) { const k = vertical ? lg(g, x, y, x + w, y, [[0, '#6c7479'], [.2, '#e9eef0'], [.35, '#9aa3a8'], [.55, '#f6fafb'], [.8, '#838c91'], [1, '#4f565a']]) : lg(g, x, y, x, y + h, [[0, '#d8dfe2'], [.25, '#f9fcfd'], [.5, '#8a9398'], [.8, '#cfd6d9'], [1, '#596064']]); g.fillStyle = k; g.fillRect(x, y, w, h); }
  function stickyNote(g, x, y, w, h, text, rot) { g.save(); g.translate(x, y); g.rotate(rot || 0); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(3, 4, w, h); g.fillStyle = '#f2e27a'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 0, w, 5); txt(g, text, 6, 17, { font: '600 11px "Caveat",cursive,' + FONT, color: '#3b2f10' }); g.restore(); }

  /* ------------------------------------------------------------ small utils */
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const pickOf = (arr, memo, key) => { if (!arr || !arr.length) return ''; let i = Math.floor(Math.random() * arr.length); if (arr.length > 1 && memo[key] === i) i = (i + 1) % arr.length; memo[key] = i; return arr[i]; };
  const ptDist = (a, b, c, d) => Math.hypot(a - c, b - d);
  const rectOf = t => t.r != null ? { x: t.cx - t.r, y: t.cy - t.r, w: t.r * 2, h: t.r * 2 } : { x: t.x, y: t.y, w: t.w, h: t.h };
  const inRect = (t, x, y) => { const b = rectOf(t); return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; };

  /* ---------------------------------------------------------------- scrub mechanic */
  /* A dirt layer (own canvas) + per-cell hit points. Brush moves erase dirt; progress = share of dirt removed. */
  function Scrub(o) {
    const cs = 10, nx = Math.ceil(o.w / cs), ny = Math.ceil(o.h / cs);
    const hp = new Float32Array(nx * ny), cv = document.createElement('canvas'); cv.width = o.w; cv.height = o.h;
    const g = cv.getContext('2d'), r = rng(o.seed || 5);
    // visuals
    if (o.paint) o.paint(g, r);
    else for (const a of o.areas) {
      const col = a.col || '#8a5a1e';
      g.save(); g.translate(a.x, a.y); g.rotate(a.rot || 0);
      for (let i = 0; i < 7; i++) { const ox = (r() - .5) * a.rx * 1.1, oy = (r() - .5) * a.ry * 1.1, k = .55 + r() * .5; g.fillStyle = rg(g, ox, oy, 0, a.rx * k, [[0, col], [.75, col], [1, 'rgba(0,0,0,0)']]); g.globalAlpha = (a.alpha || .85) * (.5 + r() * .5); g.beginPath(); g.ellipse(ox, oy, a.rx * k, a.ry * k, r() * 3, 0, TAU); g.fill(); }
      g.globalAlpha = 1; for (let i = 0; i < 26; i++) { g.fillStyle = r() < .5 ? 'rgba(40,25,10,.5)' : 'rgba(255,255,255,.12)'; const sx = (r() - .5) * a.rx * 2, sy = (r() - .5) * a.ry * 2; g.beginPath(); g.arc(sx, sy, .8 + r() * 2.2, 0, TAU); g.fill(); }
      g.restore();
    }
    for (const a of o.areas) {
      const c = Math.cos(-(a.rot || 0)), s = Math.sin(-(a.rot || 0));
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const px = i * cs + cs / 2 - a.x, py = j * cs + cs / 2 - a.y, qx = px * c - py * s, qy = px * s + py * c;
        if ((qx * qx) / (a.rx * a.rx) + (qy * qy) / (a.ry * a.ry) <= 1) hp[j * nx + i] = Math.max(hp[j * nx + i], a.th || 1.4);
      }
    }
    const init = hp.slice(); let total = 0; for (const v of init) total += v;
    const api = {
      cv, w: o.w, h: o.h, total, r: o.brush || 24,
      prog() { if (!total) return 1; let s = 0; for (let i = 0; i < hp.length; i++) s += hp[i]; return clamp(1 - s / total, 0, 1); },
      brush(x, y, amt) {
        const R2 = api.r, i0 = Math.max(0, (x - R2) / cs | 0), i1 = Math.min(nx - 1, (x + R2) / cs | 0), j0 = Math.max(0, (y - R2) / cs | 0), j1 = Math.min(ny - 1, (y + R2) / cs | 0);
        let erased = 0;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const k = j * nx + i; if (hp[k] <= 0) continue; const d = Math.hypot(i * cs + cs / 2 - x, j * cs + cs / 2 - y); if (d > R2) continue;
          hp[k] -= amt * (1 - d / R2 * .55); erased += amt;
          if (hp[k] <= 0) { hp[k] = 0; g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = rg(g, i * cs + cs / 2, j * cs + cs / 2, 0, cs * 1.1, [[0, 'rgba(0,0,0,1)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(i * cs - cs, j * cs - cs, cs * 3, cs * 3); g.restore(); }
        }
        g.save(); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = clamp(amt * .5, 0, .7); g.fillStyle = rg(g, x, y, 0, R2, [[0, 'rgba(0,0,0,1)'], [.7, 'rgba(0,0,0,.6)'], [1, 'rgba(0,0,0,0)']]); g.beginPath(); g.arc(x, y, R2, 0, TAU); g.fill(); g.restore();
        return erased;
      },
      clearAll() { for (let i = 0; i < hp.length; i++) hp[i] = 0; g.clearRect(0, 0, o.w, o.h); },
      draw(g2, x, y, a) { g2.save(); if (a != null) g2.globalAlpha = a; g2.drawImage(cv, x || 0, y || 0); g2.restore(); },
      ser() { let s = ''; for (let i = 0; i < hp.length; i++) s += init[i] <= 0 ? '0' : String(clamp(Math.ceil(hp[i] / init[i] * 9), 0, 9)); return s; },
      load(s) {
        if (!s || s.length !== hp.length) return; g.save(); g.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < hp.length; i++) { if (init[i] <= 0) continue; const f = +s[i] / 9; hp[i] = init[i] * f; if (f === 0) { g.fillStyle = '#000'; g.fillRect((i % nx) * cs - 1, (i / nx | 0) * cs - 1, cs + 2, cs + 2); } else if (f < 1) { g.fillStyle = 'rgba(0,0,0,' + (1 - f) * .8 + ')'; g.fillRect((i % nx) * cs, (i / nx | 0) * cs, cs, cs); } }
        g.restore();
      }
    };
    return api;
  }
  /* sponge / brush / cloth cursor */
  function drawTool(g, kind, x, y, ang, t, down) {
    g.save(); g.translate(x, y); g.rotate(ang || -.5 + (down ? Math.sin(t * 30) * .12 : 0));
    if (kind === 'brush') {
      box(g, -6, -60, 12, 46, 6, lg(g, -6, 0, 6, 0, ['#c2512f', '#e58a60', '#8e3a20'])); box(g, -14, -18, 28, 14, 4, '#3a3f49');
      for (let i = -12; i <= 12; i += 3) line(g, i, -4, i + Math.sin(i + t * (down ? 30 : 0)) * 1.5, 8, '#d8cfae', 2.2);
    } else if (kind === 'cloth') {
      g.fillStyle = lg(g, -24, -10, 24, 12, ['#9db8c9', '#6e8fa6']); g.beginPath(); g.moveTo(-26, -8); g.quadraticCurveTo(0, -18 + Math.sin(t * 12) * 2, 26, -10); g.lineTo(24, 12); g.quadraticCurveTo(0, 18, -25, 10); g.closePath(); g.fill(); line(g, -20, -2, 18, 2, 'rgba(255,255,255,.3)', 1);
    } else { // sponge
      box(g, -26, -13, 52, 28, 7, lg(g, 0, -13, 0, 15, ['#f2d24a', '#caa21c'])); box(g, -26, 3, 52, 12, [0, 0, 7, 7], lg(g, 0, 3, 0, 15, ['#4f8f4b', '#2f6a35']));
      for (let i = 0; i < 9; i++) ell(g, -20 + i * 5.3, -5 + (i % 3) * 3, 1.5, 1.2, 'rgba(120,90,0,.5)');
    }
    g.restore();
  }

  /* ------------------------------------------------------------ dialogue pools (Bamboul / Dan) */
  const LN = {
    fridge: {
      open: ['Блядь, это холодильник или филиал биолаборатории?', 'Открыл дверцу — получил по лицу историей пищевой промышленности.', 'Оно... дышит? Нет, это просто я задержал дыхание.'],
      bad: ['Эта колбаса уже знает, кто будет следующим хозяином квартиры.', 'Я не помню, когда купил это. Оно, кажется, помнит.', 'Срок годности закончился ещё при старом интерфейсе Windows.', 'Если оно шевельнётся, я вызываю Дэна и эвакуирую дом.', 'Убрал одну банку. За ней лежит ещё одна. Это матрёшка из ошибок.'],
      good: ['Стоп! Это же нормальная еда! Единственная в доме!', 'Ой. Это был завтрак. Единственный.', 'Нормальную еду в мешок? Я себя не прощу. Ну, секунд десять.'],
      full: ['Мешок полный. Пора на встречу с помойкой.', 'Мешок просит эвакуации. Несу к баку.'],
      scrub: ['Блядь, полка липнет. Я теперь тоже часть холодильника.', 'Липкое не отмывается, оно просто смиряется.'],
      prog: ['О, тут даже стекло существует. Я думал, оно легенда.'],
      close: ['Закрыть и сделать вид, что ничего не было? Звучит как план. И он даже выполнен.'],
      done: ['Готово. Я теперь почти человек. Почти — ключевое слово.', 'Холодильник чист. Пахнет почти пустотой. Прекрасная пустота.']
    },
    faucet: {
      open: ['КРАН, БЛЯДЬ, ПОЧЕМУ ТЫ ВОЕШЬ, КАК СИГНАЛИЗАЦИЯ НА КОНЦЕ СВЕТА?!', 'Я хотел помыть руки, а не вызвать древнее зло.', 'Соседи думают, что у меня в ванной открыли портал.'],
      closed: ['Закрыл. Тишина. Я победил сантехнику. Пока.'],
      found: ['Вот она, гайка. Люфтит, как моя дисциплина.', 'Тут гайка? Тут прокладка? Тут моя последняя нервная клетка.'],
      wrongPart: ['Это не оно. Оно вообще не вибрирует.', 'Нет, это просто красиво. Ищем то, что трясётся.'],
      wrongTool: ['Ну конечно. Я выбрал инструмент, который ничего не решает.', 'Эта штука не для этого. Она для других моих ошибок.'],
      tool: ['Разводной ключ. Классика. Дедовский метод.', 'Ключ в руке — я официально сантехник.'],
      miss: ['Перетянул! Если я ещё раз так сделаю и оно завоет, я перееду в лес.', 'Недотянул. Слишком нежно. Как с котом.'],
      hit: ['Есть щелчок. Идём дальше.', 'Подтягиваем. Ещё чуть-чуть.'],
      test: ['Так, медленно открываем…', 'Если сейчас завоет — я ухожу в монастырь.'],
      done: ['О, вода. Просто вода. Цивилизация вернулась.', 'Тишина. Я — сантехник. Запишите дату.']
    },
    toilet: {
      inspect: ['Я не буду задавать вопрос, как это вообще произошло.', 'Это уже не унитаз, это босс второго уровня.', 'Блядь, я пришёл убрать квартиру, а попал в сантехнический техникум.'],
      cleaner: ['Химия пошла. Если оно зашипело — это хороший знак. Или плохой.', 'Пена. Теперь оно хотя бы злится красиво.'],
      scrub: ['Тру. Тру. Тру. Философия уборки.', 'Сначала чистим, потом чиним. Или наоборот? Где инструкция к жизни?'],
      cistern: ['Кнопка смыва сломана. Конечно. Почему бы и нет.', 'Так, бачок. Тут внутри целая вселенная ржавых деталей.'],
      wrong: ['Нет. Это не от этого. Это от другой жизни.', 'Ложка?! Бамбуль, соберись.'],
      right: ['Вот этот шток! Прям как оригинал, только целый.'],
      clip: ['Щёлк. Ещё щёлк.', 'Западло, но держится.'],
      clipBad: ['Не в том порядке. Инженер из меня как из пельменя.', 'Пластик не прощает. Снова.'],
      test: ['Кнопка нажалась. Вода пошла. Я официально инженер.', 'Смыло! Эпохальное событие.'],
      done: ['Я больше никогда не буду откладывать уборку. До следующей уборки.', 'Блестит. Работает. Подозрительно хорошо.']
    },
    printer: {
      start: ['Весь зелёный, блядь. Я хотел использовать катушку до последнего — ну и использовал. До последнего нервного импульса.', 'Он застрял в трубке. Не туда, не сюда. Прямо как я в жизни.', 'Система толкает пруток, а пруток решил стать недвижимостью.', 'Катушка закончилась на самом интересном месте. Как сериал, только за мои деньги.'],
      read: ['Блядь, я напечатал три часа ради пластиковой кляксы с характером.', 'Ошибка подачи. Пруток где-то в трубке. Хуй его знает где, но он там.', 'Я хотел распечатать держатель. Получил пластиковое доказательство своей самоуверенности.'],
      open: ['Не трогай ничего. Я уже тронул всё, теперь надо понять, что именно я сломал.', 'Крышка открыта. Внутри — тайны, провода и мои долги.'],
      pathWrong: ['Так, вытягивать? Проталкивать? Читать инструкцию? Последнее звучит опасно.', 'Не тут. Подача же стоит позже по дороге.', 'Не-а. Проверь, что ты выбрал нужную трубку, а не самую подозрительную.'],
      pathRight: ['Вот. Тут встал. Не туда, не сюда. Теперь надо решать: толкать или тянуть или отстёгивать.'],
      actionBad: ['Я нажал "продолжить", потому что надеялся на чудо. Чудо посмотрело на меня и вышло из чата.', 'Ну конечно. Я нажал на единственную кнопку, которая ничего не решает.'],
      actionRight: ['Фиксатор! Дедовский принцип: если не лезет — отпусти, а потом тяни.'],
      collet: ['Придавил кольцо — слышишь щелчок? Теперь тянем.'],
      stuck: ['Не идёт. Держит кольцо. Надо сначала придавить.'],
      pulled: ['Трубка снята. Пруток в ней сидит, как жилец без прописки.'],
      snap: ['ТРЫНЬ. Порвал. Теперь в трубке пруток и сожаление.', 'Слишком резко. Пластик не любит драмы.'],
      cleared: ['Вытащил! Зелёный червяк. Мой хозяин, мой позор.', 'Принтер снова может дышать. Я нет, но он да.'],
      plug: ['Трубка встала на место. Щёлк — как в лучших домах.'],
      thread: ['Прут пошёл. Только не туда-сюда, ещё не хватало.', 'Заряжаем пруток. Через гейт, через хаб, в трубку.'],
      feedLow: ['Мало. Подпитываем.'],
      feedHigh: ['Перебор! Получилась клякса с характером.', 'Остановись, Бамбуль, ты не на пожарном рукаве.'],
      done: ['Принтер снова работает. Запишите дату. Технологический прогресс победил Бамбуля на один раунд меньше.', 'Если сейчас тестовая подача пройдёт, я клянусь больше никогда… Ладно, не буду врать. Прошла!']
    },
    dishes: {
      start: ['Тарелки. Горой. Они выглядят как геологический слой моей лени.', 'Это посуда или экспонаты музея засохшей еды?'],
      prog: ['Одна тарелка сверкает. Остальные в шоке.'],
      done: ['Посуда чистая. Мойка пустая. Кто я теперь?']
    },
    mirror: {
      start: ['Зеркало в разводах. Это не грязь, это арт-объект.'],
      done: ['О, а вот и я. Давно не виделись. Красавец.']
    },
    vacJam: {
      start: ['Пылесос заглох. Он там что-то съел. Опять носок?!', 'Он подавился. Я его понимаю — я тоже когда-то подавился.'],
      found: ['Вот что его держит! Намотало на валик.'],
      wrong: ['Не оно. Колесо крутится — проверено.'],
      done: ['Свободен! Включай, зверь.']
    }
  };
  const DAN = { // fallback phrasing for hints; stage-specific text is supplied by each stage
    pre: ['Слушай сюда. ', 'Так. Не нажимай всё подряд. ', 'Бамбуль, вдох-выдох. ', 'Сфоткай, что там. Нет, не своё лицо. ']
  };

  /* ---------------------------------------------------------------- UI css */
  function css() {
    if (document.getElementById('mn-css')) return;
    const s = document.createElement('style'); s.id = 'mn-css';
    s.textContent = `
.mn-root{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:flex-end;padding:10px 16px;box-sizing:border-box;font-family:${FONT};color:${COL.paper};background:linear-gradient(90deg,rgba(8,6,5,0) 0%,rgba(8,6,5,.15) 35%,rgba(8,6,5,.66) 100%);user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.mn-panel{width:min(660px,100%);max-height:100%;display:flex;flex-direction:column;gap:8px;box-sizing:border-box;background:linear-gradient(180deg,#2a241f,#1b1714);border:2px solid ${COL.mustard};box-shadow:6px 6px 0 #000a,0 0 70px #000c;padding:10px 12px 12px;overflow:auto;overscroll-behavior:contain}
.mn-panel *{box-sizing:border-box}
.mn-head{display:flex;align-items:center;gap:10px}
.mn-head h2{margin:0;font:400 24px/1 ${DISPLAY};color:${COL.mustard};text-shadow:2px 2px 0 ${COL.navy};white-space:nowrap}
.mn-pips{flex:1;display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;min-width:0}
.mn-pip{font-size:11px;font-weight:800;letter-spacing:.03em;padding:3px 7px;border:1.5px solid ${COL.navy};color:${COL.dim};background:#0c0a09;border-radius:2px;white-space:nowrap}
.mn-pip.done{color:#0d1a08;background:${COL.moss};border-color:${COL.moss}}
.mn-pip.cur{color:#16120c;background:${COL.mustard};border-color:${COL.mustard}}
.mn-x{background:none;border:2px solid ${COL.navy};color:${COL.paper};min-width:44px;min-height:40px;font:800 18px ${FONT};cursor:pointer}
.mn-x:hover,.mn-x:focus-visible{border-color:${COL.mustard}}
.mn-body{display:flex;flex-direction:column;gap:8px;min-height:0}
.mn-view{position:relative;min-width:0}
.mn-cv{display:block;width:100%;height:auto;aspect-ratio:${W}/${H};background:#0c0a09;border:2px solid ${COL.navy};touch-action:none;cursor:crosshair;outline:none}
.mn-cv:focus-visible{border-color:${COL.mustard}}
.mn-info{min-height:18px;margin:4px 2px 0;font-size:13px;color:${COL.dim}}
.mn-prog{position:relative;height:16px;background:#0c0a09;border:2px solid ${COL.navy};margin-top:4px}
.mn-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#5f8a3a,${COL.moss});transition:width .12s}
.mn-prog b{position:absolute;inset:0;font:700 11px/12px ${FONT};text-align:center;color:#fff;text-shadow:1px 1px 0 #000}
.mn-side{display:flex;flex-direction:column;gap:8px;min-width:0}
.mn-say{display:flex;gap:9px;align-items:center;min-height:50px;border-left:4px solid ${COL.mustard};background:#0007;padding:6px 10px}
.mn-say.dan{border-left-color:#6b86d6}
.mn-av{width:40px;height:40px;flex:none;border-radius:50%;background:${COL.navy};overflow:hidden;display:grid;place-items:center;font:800 18px ${FONT};color:${COL.paper}}
.mn-av canvas{width:100%;height:100%;display:block}
.mn-say .who{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:${COL.mustard};font-weight:800}
.mn-say.dan .who{color:#9db2f0}
.mn-say .tx{font-size:15px;line-height:1.3}
.mn-hint{margin:0;font-size:14px;line-height:1.35;color:${COL.paper};background:#d9a93a22;border:1px dashed ${COL.mustard}88;padding:6px 9px}
.mn-actions{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.mn-actions.one{grid-template-columns:1fr}
.mn-btn{position:relative;display:flex;gap:8px;align-items:center;text-align:left;background:${COL.mustard};color:#16120c;border:0;min-height:50px;padding:7px 12px;font:800 15px/1.15 ${FONT};box-shadow:4px 4px 0 ${COL.navy};cursor:pointer;touch-action:manipulation}
.mn-btn:active,.mn-btn.hold{transform:translate(2px,2px);box-shadow:2px 2px 0 ${COL.navy}}
.mn-btn.alt{background:${COL.paper}}
.mn-btn.bad{background:${COL.rust};color:#fff}
.mn-btn.big{min-height:64px;font-size:19px;justify-content:center;text-align:center}
.mn-btn[disabled]{opacity:.42;cursor:not-allowed}
.mn-btn:focus-visible,.mn-btn.kf{outline:3px solid #fff;outline-offset:2px}
.mn-btn.pulse{animation:mnpulse 1s infinite}
.mn-btn small{display:block;font-weight:600;font-size:12px;opacity:.8;margin-top:2px}
.mn-btn kbd{position:absolute;top:2px;right:5px;font:700 10px ${FONT};opacity:.55}
.mn-btn canvas{flex:none;width:58px;height:46px}
.mn-btn .t{min-width:0}
.mn-foot{display:flex;gap:8px;flex-wrap:wrap}
.mn-foot .mn-btn{min-height:42px;font-size:13px;flex:1;min-width:130px;background:#3a3f6b;color:${COL.paper};box-shadow:3px 3px 0 #000a}
.mn-foot .mn-btn.dan{background:#334a9a}
.mn-foot .cd{position:absolute;left:0;bottom:0;height:3px;background:#9db2f0;width:0}
.mn-pen{position:absolute;pointer-events:none;font:900 26px ${FONT};color:#ff7a5a;text-shadow:2px 2px 0 #000;animation:mnfloat 1.1s ease-out forwards}
.mn-shake{animation:mnshake .28s}
@keyframes mnshake{20%{transform:translateX(-7px)}60%{transform:translateX(7px)}}
@keyframes mnfloat{from{transform:translateY(0);opacity:1}to{transform:translateY(-46px);opacity:0}}
@keyframes mnpulse{50%{box-shadow:0 0 0 4px #fff8,4px 4px 0 ${COL.navy}}}
@media (max-width:899px){.mn-root{justify-content:center;padding:6px;background:rgba(8,6,5,.6)}}
@media (max-height:600px) and (min-width:640px){
 .mn-root{padding:4px 8px}
 .mn-panel{width:min(100%,960px);padding:6px 10px 8px;gap:5px}
 .mn-head h2{font-size:20px}
 .mn-body{flex-direction:row;gap:10px;align-items:flex-start}
 .mn-view{flex:1.25 1 0}
 .mn-side{flex:1 1 0;gap:5px}
 .mn-btn{min-height:44px;font-size:14px}
 .mn-btn.big{min-height:52px;font-size:17px}
 .mn-say{min-height:42px;padding:4px 8px}
 .mn-say .tx{font-size:13px}
 .mn-hint{font-size:12.5px;padding:4px 7px}
}
@media (prefers-reduced-motion:reduce){.mn-btn.pulse,.mn-shake{animation:none}}
`;
    document.head.appendChild(s);
  }

  /* ---------------------------------------------------------------- the run */
  const defs = {};
  let R = null, prevOverride = null, prevFocus = null, prevLock = false;
  const keyDown = e => { if (R) R.onKey(e, true); };
  const keyUp = e => { if (R) R.onKey(e, false); };

  function makeRun(def, id, S, onDone) {
    const m = S.mg[id] = S.mg[id] || {};
    const r = { id, def, S, m, onDone, t: 0, stageT: 0, parts: [], timeCost: 0, stage: null, stageId: null, hover: null, focus: -1, pd: false, pmoved: 0, px: W / 2, py: H / 2, cur: { x: W / 2, y: H / 2, kb: false }, arrows: {}, holdA: null, aFocus: -1, danCd: 0, tip: '', flash: 0, flashC: '#c2512f', closed: false, memo: {}, loops: {}, acts: [], sfxT: {}, won: false, camShift: false, keyHeld: false };
    const f = S.f;

    /* ---- DOM ---- */
    const root = el('div', 'mn-root'), panel = el('div', 'mn-panel'); root.appendChild(panel);
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', def.title);
    const head = el('div', 'mn-head'), h2 = el('h2'); h2.textContent = def.title;
    const pips = el('div', 'mn-pips'), xb = el('button', 'mn-x', '✕'); xb.title = 'Отойти (прогресс сохранится) — Esc'; xb.setAttribute('aria-label', 'Закрыть, прогресс сохранится');
    head.append(h2, pips, xb);
    const body = el('div', 'mn-body'), view = el('div', 'mn-view'), side = el('div', 'mn-side');
    const cv = el('canvas', 'mn-cv'); const dpr = Math.min(2, window.devicePixelRatio || 1) * 1.15; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.tabIndex = 0; cv.setAttribute('aria-label', 'Сцена: ' + def.title);
    const g = cv.getContext('2d');
    const info = el('div', 'mn-info'); info.setAttribute('aria-live', 'polite');
    const prog = el('div', 'mn-prog'), progI = el('i'), progB = el('b'); prog.append(progI, progB); prog.hidden = true;
    view.append(cv, info, prog);
    const say = el('div', 'mn-say'), av = el('div', 'mn-av'), sb = el('div'), sWho = el('div', 'who'), sTx = el('div', 'tx'); sb.append(sWho, sTx); say.append(av, sb);
    const hint = el('p', 'mn-hint'); const acts = el('div', 'mn-actions');
    const foot = el('div', 'mn-foot');
    const danB = el('button', 'mn-btn dan', 'Позвонить Дэну <kbd>D</kbd>'), cd = el('i', 'cd'); danB.appendChild(cd);
    const rstB = el('button', 'mn-btn', 'Сбросить шаг <kbd>R</kbd>'), clB = el('button', 'mn-btn', 'Отойти <kbd>Esc</kbd><small></small>');
    clB.querySelector('small').textContent = 'прогресс сохранится';
    foot.append(danB, rstB, clB);
    side.append(say, hint, acts, foot); body.append(view, side); panel.append(head, body); document.body.appendChild(root);
    r.dom = { root, panel, cv, acts, hint, info };

    const portraits = {};
    function avatar(who) {
      if (r._av === who) return; r._av = who; av.innerHTML = '';
      try { const c = BB.char && BB.char.portrait && BB.char.portrait(who, 'neutral'); if (c && (c.nodeType === 1)) { const cc = document.createElement('canvas'); cc.width = cc.height = 80; const x = cc.getContext('2d'); const s = Math.max(80 / c.width, 80 / c.height); x.drawImage(c, 0, 0, c.width, c.height, (80 - c.width * s) / 2, 0, c.width * s, c.height * s); av.appendChild(cc); return; } } catch (e) { }
      av.textContent = who === 'dan' ? 'Д' : 'Б'; av.style.background = who === 'dan' ? '#334a9a' : COL.navy;
    }
    r.sayLine = (who, text, quiet) => {
      say.classList.toggle('dan', who === 'dan'); sWho.textContent = who === 'dan' ? 'Дэн · по телефону' : 'Бамбуль'; sTx.textContent = text; avatar(who);
      if (who !== 'dan' && !quiet) { try { BB.ui && BB.ui.say && BB.ui.say(text, { who: 'bamboul', dur: 3.4, prio: 1 }); } catch (e) { } }
    };
    r.bark = (cat, ev, force) => {
      const pool = LN[cat] && LN[cat][ev]; let t = null;
      if ((ev === 'start' || ev === 'done' || ev === 'open') && Math.random() < .4) { try { const x = BB.dlg && BB.dlg.line && BB.dlg.line(cat, { event: ev, S, stage: r.stageId }); if (typeof x === 'string' && x.length > 3) t = x; } catch (e) { } }
      if (!t) t = pickOf(pool, r.memo, cat + ev);
      if (t) r.sayLine('bamboul', t); return t;
    };
    r.barkOpt = (cat, ev, p) => { if (Math.random() < (p == null ? .5 : p)) r.bark(cat, ev); };
    r.setHint = t => { hint.textContent = t || ''; hint.hidden = !t; };
    r.setInfo = t => { info.textContent = t || ''; };
    r.setProg = (p, label) => { if (p == null) { prog.hidden = true; return; } prog.hidden = false; progI.style.width = Math.round(clamp(p, 0, 1) * 100) + '%'; progB.textContent = label || (Math.round(clamp(p, 0, 1) * 100) + '%'); };
    r.sfx = (n, o) => { try { BB.audio && BB.audio.sfx && BB.audio.sfx(n, Object.assign({ x: BB.P && BB.P.x }, o || {})); } catch (e) { } };
    r.sfxT_ = (n, gap, o) => { const k = r.t; if (!r.sfxT[n] || k - r.sfxT[n] > gap) { r.sfxT[n] = k; r.sfx(n, o); } };
    r.loop = (n, on, o) => { if (!!r.loops[n] === !!on) return; r.loops[n] = !!on; try { BB.audio && BB.audio.loop && BB.audio.loop(n, !!on, o || { x: BB.P && BB.P.x }); } catch (e) { } };
    r.penalty = (sec, why) => {
      if (S.time != null && S.time > 0) S.time = Math.max(0, S.time - sec); r.timeCost += sec;
      const p = el('div', 'mn-pen', '−' + sec + ' с'); p.style.left = '50%'; p.style.top = '30%'; view.appendChild(p); setTimeout(() => p.remove(), 1200);
      panel.classList.remove('mn-shake'); void panel.offsetWidth; panel.classList.add('mn-shake'); r.flash = .35; r.flashC = '#c2512f'; r.sfx('bad');
      try { BB.player && BB.player.mood && BB.player.mood('shock', .8); } catch (e) { }
    };
    r.good = () => { r.flash = .3; r.flashC = '#86ad55'; };
    r.emit = p => { r.parts.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 1, max: 1, size: 3, col: '#fff', kind: 'dot', grow: 0, alpha: 1 }, p, { max: p.life || 1 })); if (r.parts.length > 260) r.parts.splice(0, 40); };
    r.floatText = (x, y, s, col) => r.emit({ x, y, vy: -26, life: 1.2, kind: 'txt', txt: s, col: col || '#fff', size: 15 });
    r.setAnim = a => { r.anim = a; };
    r.act = (type, dur) => { try { BB.player && BB.player.doAct && BB.player.doAct(type, dur || .8); } catch (e) { } };
    r.addTrash = n => { try { if (BB.tasks && BB.tasks.addTrash) BB.tasks.addTrash(n); else { S.carry = S.carry || { trash: 0, cloth: 0 }; S.carry.trash = (S.carry.trash || 0) + n; } if (BB.player && BB.P && !BB.P.held) BB.player.setHeld('bag'); } catch (e) { } };

    /* ---- pips ---- */
    function updatePips() {
      const list = def.pips ? def.pips(r) : []; pips.innerHTML = '';
      for (const p of list) { const e = el('span', 'mn-pip' + (p.done ? ' done' : '') + (p.cur ? ' cur' : '')); e.textContent = (p.done ? '✓ ' : '') + p.l; pips.appendChild(e); }
    }
    r.pips = updatePips;

    /* ---- actions (DOM buttons / cards) ---- */
    r.setActions = (list, opts) => {
      acts.innerHTML = ''; r.acts = list || []; r.holdA = null; r.aFocus = -1;
      acts.classList.toggle('one', r.acts.length === 1);
      r.acts.forEach((a, i) => {
        const b = el('button', 'mn-btn' + (a.cls ? ' ' + a.cls : '') + (a.big ? ' big' : '') + (a.pulse ? ' pulse' : '')); b.type = 'button';
        if (a.draw) { const c = document.createElement('canvas'); c.width = 116; c.height = 92; a.draw(c.getContext('2d'), 116, 92); b.appendChild(c); }
        const t = el('span', 't'); const l = el('span'); l.textContent = a.label; t.appendChild(l); if (a.sub) { const s = el('small'); s.textContent = a.sub; t.appendChild(s); } b.appendChild(t);
        if (list.length > 1 && !a.big) { const k = el('kbd'); k.textContent = i + 1; b.appendChild(k); }
        if (a.disabled) b.disabled = true;
        if (a.hold) {
          const dn = ev => { ev.preventDefault(); if (b.disabled) return; b.classList.add('hold'); try { b.setPointerCapture(ev.pointerId); } catch (e) { } a.fn(true); }, up = () => { if (b.classList.contains('hold')) { b.classList.remove('hold'); a.fn(false); } };
          b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
          b.addEventListener('keydown', ev => { if (ev.code === 'Enter' || ev.code === 'Space') ev.preventDefault(); });
          b._hold = a; if (!r.holdA) r.holdA = { a, b };
        } else b.addEventListener('click', () => r.runAction(i));
        b.dataset.i = i; a.el = b; acts.appendChild(b);
      });
    };
    r.runAction = i => { const a = r.acts[i]; if (!a || a.disabled || r.closed) return; r.sfx('uiClick'); a.fn(); };
    r.enable = (i, on) => { const a = r.acts[i]; if (a && a.el) { a.disabled = !on; a.el.disabled = !on; } };

    /* ---- stage control ---- */
    r.go = (name) => {
      if (r.stage && r.stage.leave) { try { r.stage.leave(); } catch (e) { console.error('[mini leave]', e); } }
      const mk = def.stages[name]; if (!mk) { console.error('[mini] no stage', name); return; }
      r.stageId = name; m.stage = name; r.stageT = 0; r.hover = null; r.focus = -1; r.pd = false; r.tip = ''; r.parts.length = 0;
      r.stage = mk(r); r.setActions([]); r.setProg(null); r.setInfo('');
      r.setHint(typeof r.stage.hint === 'function' ? r.stage.hint() : r.stage.hint);
      r.anim = r.stage.anim || def.anim;
      if (r.stage.enter) r.stage.enter();
      updatePips(); r.dom.cv.style.cursor = r.stage.cursor || 'crosshair';
    };
    r.targets = () => { const s = r.stage; if (!s || !s.targets) return []; return typeof s.targets === 'function' ? s.targets() : s.targets; };
    r.kbMode = () => { const s = r.stage; if (!s) return 'none'; if (s.kb) return s.kb; if (s.targets) return 'targets'; if (r.acts.length > 1) return 'cards'; return 'none'; };

    /* ---- pointer on canvas ---- */
    function toLocal(ev) { const b = cv.getBoundingClientRect(); return { x: (ev.clientX - b.left) / b.width * W, y: (ev.clientY - b.top) / b.height * H }; }
    function hit(x, y) { const ts = r.targets(); for (let i = ts.length - 1; i >= 0; i--) if (!ts[i].off && inRect(ts[i], x, y)) return i; return -1; }
    function ptr(type, x, y, ev) {
      r.px = x; r.py = y; const s = r.stage; if (!s) return;
      if (type === 'down') { r.pd = true; r.pmoved = 0; r.pdx = x; r.pdy = y; }
      if (type === 'move' && r.pd) r.pmoved = Math.max(r.pmoved, Math.hypot(x - r.pdx, y - r.pdy));
      if (type === 'move' || type === 'down') { const i = hit(x, y); r.hover = i; if (i >= 0) { r.focus = i; const t = r.targets()[i]; r.tip = t.label || ''; if (t.info) r.setInfo(t.info); } else r.tip = ''; }
      if (s.ptr) s.ptr(type, x, y, ev);
      if (type === 'up') {
        r.pd = false;
        if (s.pick && !s.ownClick && r.pmoved < 10) { const i = hit(x, y); if (i >= 0) { r.focus = i; r.sfx('uiClick'); s.pick(r.targets()[i], i); } }
      }
    }
    cv.addEventListener('pointerdown', ev => { ev.preventDefault(); try { cv.setPointerCapture(ev.pointerId); } catch (e) { } r.cur.kb = false; const p = toLocal(ev); r.cur.x = p.x; r.cur.y = p.y; ptr('down', p.x, p.y, ev); });
    cv.addEventListener('pointermove', ev => { const p = toLocal(ev); if (!r.cur.kb || r.pd || ev.movementX || ev.movementY) { r.cur.x = p.x; r.cur.y = p.y; } ptr('move', p.x, p.y, ev); });
    const upH = ev => { if (!r.pd && ev.type !== 'pointerup') return; const p = toLocal(ev); ptr('up', p.x, p.y, ev); };
    cv.addEventListener('pointerup', upH); cv.addEventListener('pointercancel', upH);
    cv.addEventListener('pointerleave', () => { if (!r.pd) { r.hover = -1; r.tip = ''; } });
    xb.onclick = () => r.close('user'); clB.onclick = () => r.close('user');
    rstB.onclick = () => r.resetStep();
    danB.onclick = () => r.callDan();
    r.resetStep = () => { r.sfx('uiBack'); if (r.stage && r.stage.reset) { r.stage.reset(); r.sayLine('bamboul', 'Так, начнём этот шаг сначала. Прогресс предыдущих шагов не трогаем.', true); } else r.sayLine('bamboul', 'Тут и так всё с чистого листа. Лист, правда, жирный.', true); };

    /* ---- Dan ---- */
    r.callDan = () => {
      if (r.danCd > 0) { r.sayLine('bamboul', 'Дэн сбросил. Говорит, перезвони через ' + Math.ceil(r.danCd) + ' с — у него «мало минут».', true); return; }
      r.danCd = 24; r.sfx('phoneRing'); setTimeout(() => r.sfx('pickupPhone'), 250);
      let hintTxt = r.stage && r.stage.dan; if (typeof hintTxt === 'function') hintTxt = hintTxt();
      if (!hintTxt) hintTxt = 'Пока просто сделай то, что написано в подсказке под картинкой.';
      let flavour = '';
      try { const ls = BB.dlg && BB.dlg.script && BB.dlg.script('danHint:' + id, { stage: r.stageId, S, m }); if (Array.isArray(ls) && ls.length) { const L0 = ls[0]; flavour = (typeof L0 === 'string' ? L0 : L0 && L0.text) || ''; } } catch (e) { }
      const pre = pickOf(DAN.pre, r.memo, 'danpre');
      r.sayLine('dan', (flavour ? flavour + ' ' : pre) + hintTxt); r.sfx('danVoice');
      try { S.calls = S.calls || {}; S.calls.miniDan = (S.calls.miniDan || 0) + 1; } catch (e) { }
      if (r.stage && r.stage.danHighlight) r.stage.danHighlight();
    };

    /* ---- keyboard ---- */
    const ARR = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyW: [0, -1], KeyS: [0, 1] };
    function moveFocus(dx, dy) {
      const mode = r.kbMode();
      if (mode === 'targets') {
        const ts = r.targets().map((t, i) => ({ t, i })).filter(o => !o.t.off); if (!ts.length) return;
        if (r.focus < 0 || !ts.find(o => o.i === r.focus)) { r.focus = ts[0].i; } else {
          const c = rectOf(r.targets()[r.focus]), cx = c.x + c.w / 2, cy = c.y + c.h / 2; let best = null, bd = 1e9;
          for (const o of ts) { if (o.i === r.focus) continue; const b = rectOf(o.t), bx = b.x + b.w / 2 - cx, by = b.y + b.h / 2 - cy, along = bx * dx + by * dy; if (along <= 1) continue; const perp = Math.abs(bx * dy - by * dx); const d = along + perp * 1.6; if (d < bd) { bd = d; best = o.i; } }
          if (best == null) { const idx = ts.findIndex(o => o.i === r.focus); const n = (dx + dy > 0) ? (idx + 1) % ts.length : (idx - 1 + ts.length) % ts.length; best = ts[n].i; }
          r.focus = best;
        }
        const t = r.targets()[r.focus]; r.tip = t.label || ''; if (t.info) r.setInfo(t.info); r.cur.kb = true; r.sfx('uiHover');
        if (r.stage.focusMove) r.stage.focusMove(t, r.focus);
      } else if (mode === 'cards') {
        const n = r.acts.length; if (!n) return; r.aFocus = r.aFocus < 0 ? 0 : (r.aFocus + ((dx + dy) > 0 ? 1 : -1) + n) % n;
        r.acts.forEach((a, i) => a.el && a.el.classList.toggle('kf', i === r.aFocus)); r.sfx('uiHover');
      }
    }
    r.onKey = (e, down) => {
      if (r.closed) return; const c = e.code;
      const tag = e.target && e.target.tagName; const onBtn = tag === 'BUTTON';
      if (c === 'Tab') { e.stopImmediatePropagation(); return; }                 // native focus traversal inside the panel
      e.stopImmediatePropagation();
      const mode = r.kbMode();
      if (c === 'Escape') { if (down) { e.preventDefault(); r.close('user'); } return; }
      if (down && !e.repeat) {
        if (/^Digit[1-9]$/.test(c) || /^Numpad[1-9]$/.test(c)) { e.preventDefault(); r.runAction(+c.slice(-1) - 1); return; }
        if (c === 'KeyD') { e.preventDefault(); r.callDan(); return; }
        if (c === 'KeyR') { e.preventDefault(); r.resetStep(); return; }
      }
      if (ARR[c]) {
        e.preventDefault(); if (down) r.arrows[c] = true; else delete r.arrows[c];
        if (down && !e.repeat && mode !== 'cursor') { const v = ARR[c]; moveFocus(v[0], v[1]); }
        return;
      }
      if (c === 'Space' || c === 'Enter' || c === 'NumpadEnter') {
        e.preventDefault();
        if (down && e.repeat) return;
        // 1) cursor mode: Space/Enter == pointer button
        if (mode === 'cursor') {
          if (down) { r.cur.kb = true; ptr('down', r.cur.x, r.cur.y); r.keyHeld = true; } else if (r.keyHeld) { r.keyHeld = false; ptr('up', r.cur.x, r.cur.y); }
          return;
        }
        // 2) hold-to-act button
        if (r.holdA && !(onBtn && !e.target._hold)) {
          const { a, b } = r.holdA; if (down) { if (!a.disabled) { b.classList.add('hold'); a.fn(true); r.keyHeld = true; } } else if (r.keyHeld) { r.keyHeld = false; b.classList.remove('hold'); a.fn(false); } return;
        }
        if (!down) return;
        // 3) focused DOM button
        if (onBtn && e.target.dataset.i != null) { r.runAction(+e.target.dataset.i); return; }
        // 4) focused canvas target
        if (mode === 'targets' && r.focus >= 0 && r.stage.pick) { const t = r.targets()[r.focus]; if (t && !t.off) { r.cur.kb = true; r.sfx('uiClick'); r.stage.pick(t, r.focus); return; } }
        if (mode === 'cards' && r.aFocus >= 0) { r.runAction(r.aFocus); return; }
        // 5) primary
        if (r.stage && r.stage.keyPrimary) { r.stage.keyPrimary(); return; }
        const pi = r.acts.findIndex(a => a.primary && !a.disabled); if (pi >= 0) { r.runAction(pi); return; }
        if (r.acts.length === 1) r.runAction(0);
      }
    };

    /* ---- frame loop ---- */
    let last = performance.now(), raf = 0;
    function frame(now) {
      if (r.closed) return; raf = requestAnimationFrame(frame);
      let dt = Math.min(.05, (now - last) / 1000); last = now;
      if (!BB.paused) {
        r.t += dt; r.stageT += dt; if (r.danCd > 0) { r.danCd = Math.max(0, r.danCd - dt); } cd.style.width = (r.danCd / 24 * 100) + '%';
        danB.style.opacity = r.danCd > 0 ? .75 : 1;
        // arrow keys → virtual cursor
        if (r.kbMode() === 'cursor') {
          let dx = 0, dy = 0; for (const k in r.arrows) { const v = ARR[k]; if (v) { dx += v[0]; dy += v[1]; } }
          if (dx || dy) { const sp = 250 * dt, l = Math.hypot(dx, dy); r.cur.kb = true; r.cur.x = clamp(r.cur.x + dx / l * sp, 0, W); r.cur.y = clamp(r.cur.y + dy / l * sp, 0, H); ptr('move', r.cur.x, r.cur.y); }
        }
        if (r.stage && r.stage.tick) r.stage.tick(dt);
        for (let i = r.parts.length - 1; i >= 0; i--) { const p = r.parts[i]; p.life -= dt; if (p.life <= 0) { r.parts.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.size += p.grow * dt; }
        if (r.flash > 0) r.flash -= dt;
        // world guards
        if (S.mode && S.mode !== 'play' || (BB.S && BB.S !== S)) { r.close('abort'); return; }
      }
      draw();
    }
    function draw() {
      g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0); g.clearRect(0, 0, W, H);
      if (r.stage && r.stage.draw) { g.save(); try { r.stage.draw(g, r.t, r); } catch (e) { console.error('[mini draw]', e); } g.restore(); }
      // particles
      for (const p of r.parts) {
        const a = clamp(p.life / p.max, 0, 1) * p.alpha; g.globalAlpha = a;
        if (p.kind === 'txt') txt(g, p.txt, p.x, p.y, { font: '900 ' + p.size + 'px ' + FONT, color: p.col, align: 'center', stroke: '#000' });
        else if (p.kind === 'ring') { g.strokeStyle = p.col; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, p.size, 0, TAU); g.stroke(); }
        else if (p.kind === 'bub') { g.strokeStyle = 'rgba(255,255,255,.7)'; g.fillStyle = 'rgba(200,230,255,.25)'; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, p.size, 0, TAU); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(p.x - p.size * .4, p.y - p.size * .4, p.size * .3, p.size * .3); }
        else if (p.kind === 'streak') { g.strokeStyle = p.col; g.lineWidth = p.size; g.lineCap = 'round'; g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - p.vx * .035, p.y - p.vy * .035); g.stroke(); }
        else { g.fillStyle = p.col; g.beginPath(); g.arc(p.x, p.y, Math.max(.3, p.size), 0, TAU); g.fill(); }
        g.globalAlpha = 1;
      }
      // focus / hover ring + tooltip
      const s = r.stage, ts = r.targets();
      if (s && ts.length && !s.noRing) {
        const i = r.hover >= 0 ? r.hover : (r.cur.kb ? r.focus : -1);
        if (i >= 0 && ts[i] && !ts[i].off) {
          const b = rectOf(ts[i]); const pul = .5 + .5 * Math.sin(r.t * 7);
          g.save(); g.strokeStyle = 'rgba(255,230,140,' + (.65 + pul * .35) + ')'; g.lineWidth = 2.5; g.setLineDash([7, 5]); g.lineDashOffset = -r.t * 18; rr(g, b.x - 4, b.y - 4, b.w + 8, b.h + 8, 8); g.stroke(); g.restore();
          if (ts[i].label) { g.font = '700 13px ' + FONT; const tw = g.measureText(ts[i].label).width + 16; let tx = clamp(b.x + b.w / 2 - tw / 2, 4, W - tw - 4), ty = b.y - 30 < 4 ? b.y + b.h + 8 : b.y - 30; box(g, tx, ty, tw, 24, 4, 'rgba(18,16,14,.92)'); rr(g, tx, ty, tw, 24, 4); g.strokeStyle = COL.mustard; g.lineWidth = 1.5; g.stroke(); txt(g, ts[i].label, tx + 8, ty + 16.5, { font: '700 13px ' + FONT, color: COL.paper }); }
        }
      }
      if (s && s.cursor !== 'none' && r.cur.kb && r.kbMode() === 'cursor') { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(r.cur.x, r.cur.y, 11, 0, TAU); g.moveTo(r.cur.x - 16, r.cur.y); g.lineTo(r.cur.x + 16, r.cur.y); g.moveTo(r.cur.x, r.cur.y - 16); g.lineTo(r.cur.x, r.cur.y + 16); g.stroke(); }
      if (r.flash > 0) { g.globalAlpha = clamp(r.flash * 1.4, 0, .35); g.fillStyle = r.flashC; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    }

    /* ---- open / close ---- */
    r.close = (reason) => {
      if (r.closed) return; r.closed = true; cancelAnimationFrame(raf);
      try { if (r.stage && r.stage.leave) r.stage.leave(); } catch (e) { }
      try { def.onClose && def.onClose(r, reason); } catch (e) { console.error(e); }
      for (const k in r.loops) if (r.loops[k]) try { BB.audio && BB.audio.loop && BB.audio.loop(k, false); } catch (e) { }
      window.removeEventListener('keydown', keyDown, true); window.removeEventListener('keyup', keyUp, true);
      root.remove();
      BB.overrideAnim = prevOverride; try { if (BB.cam) BB.cam.focus = prevFocus; BB.player && BB.player.lock && BB.player.lock(prevLock); } catch (e) { }
      R = null; BB.mini.active = null; BB.mini._R = null;
      const res = { id, win: r.won, timeCost: r.timeCost, partial: !r.won, stage: r.stageId, reason: reason || 'user', aborted: reason === 'abort' };
      if (r.won) { r.sfx('taskDone'); try { BB.player && BB.player.doAct && BB.player.doAct('cheer', 1.1); } catch (e) { } }
      try { onDone && onDone(res); } catch (e) { console.error('[mini onDone]', e); }
    };
    r.win = () => { r.won = true; r.good(); r.setHint(''); r.setActions([{ label: 'Готово!', big: true, primary: true, fn: () => r.close('win') }]); updatePips(); };

    /* hero + camera */
    prevOverride = BB.overrideAnim; prevLock = !!(BB.P && BB.P.locked);
    BB.overrideAnim = () => { if (!R || R.closed) return null; const a = R.anim; return typeof a === 'function' ? a() : a; };
    try { BB.player && BB.player.lock && BB.player.lock(true); if (BB.P) BB.P.vx = 0; } catch (e) { }
    try {
      if (BB.cam && BB.view && window.innerWidth >= 900 && BB.P) { prevFocus = BB.cam.focus; BB.cam.focus = { x: BB.P.x + .28 * BB.view.W / BB.view.ppc, zoom: 1 }; r.camShift = true; } else prevFocus = BB.cam ? BB.cam.focus : null;
    } catch (e) { }
    window.addEventListener('keydown', keyDown, true); window.addEventListener('keyup', keyUp, true);
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) { }
    r.sfx('uiClick');
    r.begin = () => { last = performance.now(); raf = requestAnimationFrame(frame); };
    return r;
  }

  /* ============================================================================
     FRIDGE
     ========================================================================== */
  const FOOD = [
    { id: 'kefir', n: 'Кефир', d: 'Срок годности — март. Какого года, он не уточняет.', bad: 1, k: 'carton', sx: 0, sl: 0 },
    { id: 'eggs', n: 'Яйца', d: 'Куплены вчера. Единственные взрослые в этом холодильнике.', k: 'eggs', sx: 0, sl: 1 },
    { id: 'mayo', n: 'Майонез', d: 'Открыт в позапрошлом году. Помнит ещё прошлый ремонт.', bad: 1, k: 'jar', sx: 0, sl: 2 },
    { id: 'tupper', n: 'Контейнер', d: 'Не открываем. Он уже самостоятельный субъект права.', bad: 1, k: 'tub', sx: 0, sl: 3 },
    { id: 'sausage', n: 'Колбаса', d: 'Зелёная, с пушком. Пушок, кажется, уже голосует.', bad: 1, k: 'sausage', sx: 1, sl: 0 },
    { id: 'beer', n: 'Пиво', d: 'Холодное и свежее. Это не еда, это инфраструктура.', k: 'beer', sx: 1, sl: 1 },
    { id: 'borsch', n: 'Кастрюля борща', d: 'В ней кто-то живёт. Платит ли он за аренду?', bad: 1, k: 'pot', sx: 1, sl: 2 },
    { id: 'cheese', n: 'Сыр', d: 'Плесень — не как у дорблю. Как у соседа снизу.', bad: 1, k: 'cheese', sx: 1, sl: 3 },
    { id: 'dumpl', n: 'Пельмени', d: 'Слиплись в один большой пельмень. Монолит.', bad: 1, k: 'bag', sx: 2, sl: 0 },
    { id: 'mustard', n: 'Горчица', d: 'Ей сносу нет. Переживёт и холодильник, и хозяина.', k: 'tube', sx: 2, sl: 1 },
    { id: 'jars', n: 'Банка за банкой', d: 'Убрал одну — за ней ещё. Матрёшка из ошибок.', bad: 1, k: 'jars', sx: 2, sl: 2 },
    { id: 'cuke', n: 'Огурец', d: 'Мягкий. Очень мягкий. Скорее философский.', bad: 1, k: 'cuke', sx: 2, sl: 3 },
    { id: 'thing', n: 'Нечто в пакете', d: 'Опознанию не подлежит. Подписано: «не трогать (Бамбуль)».', bad: 1, k: 'blob', sx: 3, sl: 0 },
    { id: 'frank', n: 'Сосиски', d: 'В упаковке, нормальные. Почти подозрительно.', k: 'pack', sx: 3, sl: 1 },
    { id: 'yog', n: 'Йогурт «Дэна»', d: 'Запечатан и подписан. Тронешь — будет шаурма.', k: 'cup', sx: 3, sl: 2 }
  ];
  const FR = { cx0: 36, cx1: 530, shelfY: [96, 180, 264, 360], slotsX: [[90, 208, 326, 444], [90, 208, 326, 444], [90, 208, 326, 444], [120, 270, 420]], bagX: 655, bagY: 378, cap: 5 };
  FOOD.forEach(it => { it.cx = FR.slotsX[it.sx][it.sl]; it.by = FR.shelfY[it.sx] - 2; });
  const frRect = it => ({ x: it.cx - 33, y: it.by - 68, w: 66, h: 70 });

  function fuzz(g, cx, cy, rx, ry, seed, n, col) {
    const r = rng(seed); for (let i = 0; i < (n || 16); i++) { const a = r() * TAU, d = Math.sqrt(r()), x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d, s = 2 + r() * 4; g.fillStyle = rg(g, x, y, 0, s, [[0, col || 'rgba(190,205,170,.95)'], [.6, 'rgba(120,150,100,.7)'], [1, 'rgba(100,130,90,0)']]); g.beginPath(); g.arc(x, y, s, 0, TAU); g.fill(); }
  }
  function stink(g, cx, y, t, seed) {
    g.save(); g.lineWidth = 2; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { const ph = t * 2.2 + seed + k * 2.1, x0 = cx - 12 + k * 12; g.strokeStyle = 'rgba(150,200,90,' + (.55 + .3 * Math.sin(ph)) + ')'; g.beginPath(); for (let j = 0; j <= 10; j++) { const yy = y - j * 4 - ((t * 14 + k * 9) % 12), xx = x0 + Math.sin(j * .9 + ph) * 3.5; j ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); }
    g.restore();
  }
  function drawFood(g, it, cx, by, t, o) {
    o = o || {}; const bad = !!it.bad, sd = it.id.length * 13 + it.id.charCodeAt(0);
    g.save(); g.translate(cx, by); shadowE(g, 0, 1, 30, 5, .4);
    switch (it.k) {
      case 'carton': {
        const bulge = bad ? 3 : 0;
        g.beginPath(); g.moveTo(-14, 0); g.quadraticCurveTo(-14 - bulge, -26, -14, -50); g.lineTo(14, -50); g.quadraticCurveTo(14 + bulge, -26, 14, 0); g.closePath(); g.fillStyle = lg(g, -14, 0, 14, 0, ['#cfd3cf', '#fbfbf5', '#bdc2be']); g.fill();
        poly(g, [-14, -50, 0, -62, 14, -50], '#e9ece6'); poly(g, [-14, -50, 0, -62, 0, -52], '#b8beb8'); box(g, -14, -34, 28, 16, 0, '#3a6bb0'); txt(g, 'КЕФИР', 0, -22, { font: '800 8px ' + FONT, color: '#fff', align: 'center' }); ell(g, -5, -41, 4, 3, '#fff'); ell(g, 6, -43, 3, 2.4, '#222');
        if (bad) fuzz(g, 0, -56, 8, 3, sd, 6); break;
      }
      case 'eggs': {
        box(g, -24, -14, 48, 14, 3, '#b49e7a'); for (let i = 0; i < 6; i++) { const x = -18 + (i % 3) * 18, y = -22 - (i / 3 | 0) * -2; ell(g, x, y - (i / 3 | 0) * 0, 8, 10, lg(g, x - 8, 0, x + 8, 0, ['#d9c9ab', '#fbf3e3', '#cdbb9a'])); } box(g, -26, -8, 52, 8, 3, '#a3906e'); break;
      }
      case 'jar': {
        box(g, -16, -44, 32, 44, 7, lg(g, -16, 0, 16, 0, ['rgba(200,220,215,.8)', 'rgba(250,255,250,.9)', 'rgba(190,210,205,.8)'])); box(g, -13, -38, 26, 34, 5, bad ? '#d9d0a2' : '#f4efd8'); box(g, -17, -52, 34, 10, 3, '#2f5ea8'); box(g, -13, -28, 26, 14, 1, '#e8e4d4'); txt(g, 'МАЙОНЕЗ', 0, -18, { font: '800 6.4px ' + FONT, color: '#b32', align: 'center' });
        if (bad) { ell(g, 0, -31, 9, 3, 'rgba(110,130,70,.8)'); fuzz(g, 0, -40, 9, 3, sd, 7); } break;
      }
      case 'tub': {
        box(g, -26, -34, 52, 34, 4, lg(g, 0, -34, 0, 0, ['rgba(120,170,150,.85)', 'rgba(60,90,70,.9)'])); box(g, -28, -42, 56, 10, 3, '#a8d0cf'); box(g, -30, -36, 5, 8, 2, '#4a8f9a'); box(g, 25, -36, 5, 8, 2, '#4a8f9a'); stickyNote(g, -14, -29, 28, 20, 'НЕ ОТКР.', -.06);
        if (bad) { ell(g, 0, -34, 13, 3, 'rgba(60,40,20,.5)'); } break;
      }
      case 'sausage': {
        for (let i = 0; i < 2; i++) { g.save(); g.translate(0, -8 - i * 14); g.rotate(i ? .05 : -.04); box(g, -27, -7, 54, 14, 7, lg(g, 0, -7, 0, 7, ['#e8a190', '#a9524a'])); if (bad) fuzz(g, 0, 0, 26, 6, sd + i, 14); g.restore(); } break;
      }
      case 'bag': {
        g.beginPath(); g.moveTo(-22, 0); g.bezierCurveTo(-30, -20, -20, -44, 0, -44); g.bezierCurveTo(22, -44, 30, -20, 22, 0); g.closePath(); g.fillStyle = lg(g, 0, -44, 0, 0, ['#dfeaf2', '#9fb7c8']); g.fill(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1; g.stroke();
        const r2 = rng(sd); for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(255,255,255,' + (.4 + r2() * .5) + ')'; g.fillRect(-20 + r2() * 40, -40 + r2() * 38, 2, 2); } poly(g, [-9, -44, 0, -52, 9, -44], '#c9d9e6'); txt(g, 'ПЕЛЬМЕНИ', 0, -18, { font: '800 7px ' + FONT, color: '#27508a', align: 'center' }); break;
      }
      case 'tube': {
        g.beginPath(); g.moveTo(-9, 0); g.lineTo(-11, -40); g.lineTo(11, -40); g.lineTo(9, 0); g.closePath(); g.fillStyle = lg(g, -11, 0, 11, 0, ['#c99a1b', '#f2c64a', '#b7861a']); g.fill(); box(g, -7, -50, 14, 11, 3, '#b83a2e'); txt(g, 'ГОРЧ', 0, -18, { font: '800 8px ' + FONT, color: '#7a1f12', align: 'center' }); break;
      }
      case 'pot': {
        box(g, -30, -34, 60, 34, 5, lg(g, -30, 0, 30, 0, ['#9c2f2a', '#d4584c', '#7e221f'])); for (let i = 0; i < 5; i++) ell(g, -22 + i * 11, -16 + (i % 2) * 6, 2.2, 2.2, '#f3e6d0');
        g.save(); g.translate(2, -37); g.rotate(-.1); box(g, -30, -8, 60, 8, 3, lg(g, 0, -8, 0, 0, ['#c9c2b4', '#8f897c'])); box(g, -5, -14, 10, 6, 2, '#222'); g.restore(); if (bad) { fuzz(g, 20, -36, 10, 3, sd, 7, 'rgba(160,200,120,.9)'); ell(g, 26, -33, 5, 2, 'rgba(70,110,50,.8)'); } break;
      }
      case 'cheese': {
        poly(g, [-28, 0, 26, 0, 22, -26, -22, -34], lg(g, 0, -34, 0, 0, ['#f1d56a', '#c9a22d'])); poly(g, [-22, -34, 22, -26, 14, -40], '#f6e48d'); for (const [x, y, r] of [[-10, -12, 4], [8, -9, 3], [-2, -22, 3], [14, -18, 3.4]]) ell(g, x, y, r, r * .8, '#a77f1f');
        if (bad) { fuzz(g, -4, -14, 18, 12, sd, 14, 'rgba(120,175,170,.95)'); fuzz(g, 14, -8, 8, 8, sd + 2, 6, 'rgba(90,150,160,.9)'); } break;
      }
      case 'jars': {
        for (let i = 1; i >= 0; i--) { const x = -14 + i * 28, h = 40 - i * 4; box(g, x - 13, -h, 26, h, 6, lg(g, x - 13, 0, x + 13, 0, ['rgba(160,150,100,.9)', 'rgba(220,200,130,.9)', 'rgba(120,110,70,.9)'])); box(g, x - 14, -h - 8, 28, 9, 3, i ? '#8a3a2e' : '#7b6a2a'); fuzz(g, x, -h + 6, 9, 3, sd + i, 6); } break;
      }
      case 'cuke': {
        g.save(); g.rotate(-.12); g.beginPath(); g.moveTo(-8, 0); g.bezierCurveTo(-14, -20, -4, -42, 4, -52); g.lineTo(11, -48); g.bezierCurveTo(8, -30, 12, -14, 8, 0); g.closePath(); g.fillStyle = lg(g, -10, 0, 10, 0, ['#6f7d2a', '#aebd54', '#5d6a22']); g.fill(); for (let i = 0; i < 6; i++) ell(g, -3 + (i % 2) * 8, -6 - i * 8, 1.2, 1, 'rgba(40,50,10,.5)'); ell(g, 2, -50, 5, 3, 'rgba(220,210,120,.8)'); g.restore(); break;
      }
      case 'blob': {
        g.beginPath(); g.moveTo(-22, 0); g.bezierCurveTo(-34, -24, -12, -40, 0, -36); g.bezierCurveTo(10, -50, 30, -30, 22, 0); g.closePath(); g.fillStyle = lg(g, 0, -40, 0, 0, ['#2b2f29', '#12140f']); g.fill(); g.strokeStyle = 'rgba(160,170,150,.35)'; g.lineWidth = 2; g.stroke(); poly(g, [-6, -37, 0, -50, 6, -37], '#2b2f29'); txt(g, '?', 0, -12, { font: '900 22px ' + FONT, color: 'rgba(200,220,170,.7)', align: 'center' }); fuzz(g, 4, -22, 12, 8, sd, 8, 'rgba(160,190,130,.55)'); break;
      }
      case 'beer': {
        for (let i = 0; i < 2; i++) { const x = -10 + i * 20; box(g, x - 6, -34, 12, 34, 3, lg(g, x - 6, 0, x + 6, 0, ['#4a2a10', '#9a5b22', '#3b210d'])); box(g, x - 3.5, -52, 7, 20, 2, lg(g, x - 4, 0, x + 4, 0, ['#4a2a10', '#9a5b22', '#3b210d'])); box(g, x - 4, -54, 8, 3, 1, '#d9a93a'); box(g, x - 6, -24, 12, 12, 0, '#e8dcb8'); } break;
      }
      case 'pack': {
        box(g, -24, -22, 48, 22, 3, lg(g, 0, -22, 0, 0, ['#f0c6b8', '#d68c7c'])); box(g, -24, -22, 48, 5, 2, '#fff8'); for (let i = 0; i < 4; i++) box(g, -18 + i * 10, -17, 8, 14, 4, '#b95a4c'); txt(g, 'СОСИСКИ', 0, -24, { font: '800 7px ' + FONT, color: '#7a2a20', align: 'center' }); break;
      }
      case 'cup': {
        g.beginPath(); g.moveTo(-15, -34); g.lineTo(15, -34); g.lineTo(11, 0); g.lineTo(-11, 0); g.closePath(); g.fillStyle = lg(g, -15, 0, 15, 0, ['#c9dbe8', '#f5f9fc', '#b4c6d4']); g.fill(); box(g, -16, -38, 32, 5, 2, '#d7d9db'); box(g, -13, -26, 26, 11, 0, '#3a6bb0'); txt(g, 'ДЭН', 0, -17, { font: '900 8px ' + FONT, color: '#fff', align: 'center' }); break;
      }
    }
    g.restore();
    if (bad && !o.noStink) stink(g, cx, by - 54, t, sd);
  }
  function drawBag(g, x, y, count, cap, t, shakeT) {
    const f = count / cap, w = 52 + f * 24, h = 66 + f * 34, sh = shakeT > 0 ? Math.sin(shakeT * 60) * 3 : 0;
    g.save(); g.translate(x + sh, y); shadowE(g, 0, 2, w * .75, 9, .55);
    g.beginPath(); g.moveTo(-w * .42, -h * .8); g.bezierCurveTo(-w * .75, -h * .5, -w * .65, -2, -w * .3, 0); g.lineTo(w * .3, 0); g.bezierCurveTo(w * .65, -2, w * .75, -h * .5, w * .42, -h * .8); g.closePath();
    g.fillStyle = lg(g, -w / 2, 0, w / 2, 0, ['#0e0e12', '#3a3d4a', '#0b0b0e']); g.fill(); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1.2; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.17)'; g.beginPath(); g.ellipse(-w * .22, -h * .45, 5, h * .28, .15, 0, TAU); g.fill();
    // gathered neck + knot
    poly(g, [-w * .42, -h * .8, -9, -h * .98, 9, -h * .98, w * .42, -h * .8], '#16171d'); g.strokeStyle = '#d9a93a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-9, -h * .93); g.lineTo(9, -h * .93); g.stroke(); poly(g, [-7, -h * .98, -22, -h * 1.12, -4, -h * 1.0], '#0e0e12'); poly(g, [7, -h * .98, 22, -h * 1.1, 4, -h * 1.0], '#0e0e12');
    if (count >= cap) txt(g, 'ПОЛОН', 0, -h * .4, { font: '900 12px ' + FONT, color: '#ff7a5a', align: 'center' });
    g.restore();
  }
  function drawFridgeClosed(g, t, r, open01) {
    const rot = r.S.f.fridgeRot == null ? 10 : r.S.f.fridgeRot;
    tileWall(g, 0, 0, W, H, '#cfc4a6', '#8e8566', 46, 11); g.fillStyle = lg(g, 0, 0, W, 0, ['rgba(0,0,0,.45)', 'rgba(255,240,200,.12)', 'rgba(0,0,0,.5)']); g.fillRect(0, 0, W, H);
    box(g, 0, 380, W, 20, 0, '#4b3f33'); shadowE(g, 380, 392, 170, 10, .55);
    const x0 = 255, w = 250;
    // body
    box(g, x0 - 6, 6, w + 12, 388, 10, '#9a9486'); box(g, x0, 10, w, 384, 8, lg(g, x0, 0, x0 + w, 0, ['#cfc9b8', '#f0ebdb', '#d6d0bf', '#b9b3a2']));
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0 + 3, 126, w - 6, 5); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x0 + 3, 131, w - 6, 2);
    grain(g, x0, 10, w, 384, .1); for (const [x, y, a] of [[x0 + 30, 220, .12], [x0 + 180, 300, .1], [x0 + 70, 80, .08]]) { g.fillStyle = 'rgba(120,100,50,' + a + ')'; g.beginPath(); g.ellipse(x, y, 26, 40, .3, 0, TAU); g.fill(); }
    chrome(g, x0 + w - 28, 38, 8, 78, true); chrome(g, x0 + w - 28, 156, 8, 128, true);
    // magnets & notes
    const mags = [[x0 + 36, 62, '#c2512f'], [x0 + 74, 82, '#2d6fb3'], [x0 + 52, 168, '#86ad55'], [x0 + 150, 200, '#d9a93a'], [x0 + 90, 250, '#aa4f9a']];
    for (const [x, y, c] of mags) { ell(g, x + 2, y + 3, 11, 11, 'rgba(0,0,0,.3)'); ell(g, x, y, 11, 11, rg(g, x - 3, y - 3, 1, 12, ['#fff', c])); }
    stickyNote(g, x0 + 100, 150, 100, 52, 'ПОМЫТЬ ПОТОМ', .05); txt(g, '(какого года?)', x0 + 108, 186, { font: '600 11px "Caveat",cursive,' + FONT, color: '#5a3a18' });
    stickyNote(g, x0 + 30, 96, 80, 30, 'Дэн: ВЫКИНЬ', -.08);
    box(g, x0 + 62, 276, 70, 58, 0, '#e9e1c8'); txt(g, 'СЧЁТ', x0 + 97, 296, { font: '800 10px ' + FONT, color: '#793', align: 'center' }); txt(g, 'за свет', x0 + 97, 312, { font: '600 10px ' + FONT, color: '#793', align: 'center' });
    // haze + flies
    if (rot > 0 || open01 > 0) { glow(g, 380, 150, 150, '140,190,70', .12 + .08 * Math.sin(t * 2)); }
    for (let i = 0; i < 4; i++) { const a = t * (1.8 + i * .3) + i * 1.7, x = 380 + Math.cos(a) * (70 + i * 14), y = 170 + Math.sin(a * 1.3) * 60; ell(g, x, y, 2, 1.6, '#111'); ell(g, x - 1.5, y - 1.5, 2.4, 1.2, 'rgba(255,255,255,.35)'); }
    if (open01 > 0) { // door swinging open: dark gap from the left
      g.fillStyle = 'rgba(20,28,20,' + open01 * .85 + ')'; g.fillRect(x0, 10, w * open01 * .8, 384); glow(g, 380, 200, 200 * open01, '200,255,200', .4 * open01);
    }
    vignette(g, .4);
  }
  function drawFridgeIn(g, t, r, st) {
    st = st || {}; const f = r.S.f, rot = f.fridgeRot == null ? 10 : f.fridgeRot, haze = st.haze != null ? st.haze : clamp(rot / 10, 0, 1);
    tileWall(g, 0, 0, W, H, '#cfc4a6', '#8e8566', 46, 11); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, W, H);
    // bag side (floor)
    box(g, 520, 380, W - 520, 20, 0, '#4b3f33');
    // cavity
    const cx0 = FR.cx0, cx1 = FR.cx1; box(g, cx0 - 8, 4, cx1 - cx0 + 16, 392, 10, '#aaa493');
    g.fillStyle = lg(g, 0, 12, 0, 392, ['#e6efe7', '#d1ddd3', '#b9c8bd']); g.fillRect(cx0, 12, cx1 - cx0, 380);
    g.fillStyle = lg(g, cx0, 0, cx1, 0, ['rgba(0,0,0,.28)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,.28)']); g.fillRect(cx0, 12, cx1 - cx0, 380);
    for (let x = cx0 + 22; x < cx1; x += 44) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, 12, 2, 380); g.fillStyle = 'rgba(0,0,0,.06)'; g.fillRect(x + 2, 12, 3, 380); }
    glow(g, (cx0 + cx1) / 2, 18, 300, '245,255,235', .55);
    box(g, cx0 + 70, 12, cx1 - cx0 - 140, 7, 3, '#fffff0');
    // door rack at far left
    box(g, 0, 8, cx0, 384, 0, lg(g, 0, 0, cx0, 0, ['#8d8778', '#c7c1af'])); for (let i = 0; i < 4; i++) { box(g, 4, 70 + i * 80, cx0 - 6, 8, 2, 'rgba(255,255,255,.3)'); }
    // shelves
    const dirtA = st.dirt == null ? 1 : st.dirt;
    for (let i = 0; i < 3; i++) {
      const y = FR.shelfY[i];
      g.fillStyle = 'rgba(180,220,230,.35)'; poly(g, [cx0, y, cx1, y, cx1 - 16, y - 12, cx0 + 16, y - 12], 'rgba(200,230,236,.42)');
      box(g, cx0, y, cx1 - cx0, 9, 0, lg(g, 0, y, 0, y + 9, ['rgba(215,240,245,.85)', 'rgba(120,170,180,.6)'])); g.fillStyle = 'rgba(255,255,255,.8)'; g.fillRect(cx0, y, cx1 - cx0, 1.5); box(g, cx0, y + 9, cx1 - cx0, 4, 0, 'rgba(0,0,0,.18)');
      if (dirtA > 0 && !st.noResidue) { const r2 = rng(40 + i); for (let k = 0; k < 6; k++) { const px = cx0 + 40 + r2() * (cx1 - cx0 - 80); g.globalAlpha = .55 * dirtA; ell(g, px, y - 2, 18 + r2() * 24, 3.5, 'rgba(160,100,30,.8)'); g.globalAlpha = 1; } }
    }
    // drawer (crisper)
    g.fillStyle = 'rgba(120,170,150,.35)'; g.fillRect(cx0 + 4, 296, cx1 - cx0 - 8, 92);
    if (!st.noDrawerFront) { }
    st.drawerFront = true;
    if (haze > 0 && !st.noHaze) for (let i = 0; i < 5; i++) { const x = 120 + i * 90 + Math.sin(t * .6 + i) * 26, y = 90 + (i % 3) * 80 + Math.cos(t * .5 + i * 2) * 14; glow(g, x, y, 90, '130,190,60', .12 * haze + .04); }
  }
  function drawDrawerFront(g, st) {
    const cx0 = FR.cx0, cx1 = FR.cx1; g.fillStyle = 'rgba(150,200,175,.5)'; g.fillRect(cx0 + 4, 342, cx1 - cx0 - 8, 48); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(cx0 + 4, 342, cx1 - cx0 - 8, 2); box(g, 230, 360, 100, 8, 4, 'rgba(60,90,80,.8)'); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(cx0 + 10, 350, 160, 3);
    if (st && st.dirtDrawer) { }
  }
  function fliesDraw(g, t, n, cx, cy, spread) {
    for (let i = 0; i < n; i++) { const a = t * (2 + i * .37) + i * 2.1, x = cx + Math.cos(a) * spread * (.5 + .5 * Math.sin(i + t * .3)) + Math.sin(a * 3.1) * 8, y = cy + Math.sin(a * 1.4 + i) * spread * .6 + Math.cos(a * 4) * 5; ell(g, x, y, 2.2, 1.7, '#0c0c0c'); g.globalAlpha = .55; ell(g, x - 2, y - 2, 2.6, 1.1, '#cde', Math.sin(t * 90 + i)); ell(g, x + 2, y - 2, 2.6, 1.1, '#cde', -Math.sin(t * 90 + i)); g.globalAlpha = 1; }
  }

  defs.fridge = {
    title: 'Холодильник', anim: 'inspect', first: 'open',
    isDone: S => !!S.f.fridgeDone,
    init(r) {
      const m = r.m, f = r.S.f;
      m.bagged = m.bagged || []; m.bag = m.bag || 0; m.carried = m.carried || 0; m.wrong = m.wrong || 0;
      if (!m.stage) m.stage = f.fridgeOpen ? 'sort' : 'open';
      if (m.stage === 'open' && f.fridgeOpen) m.stage = 'sort';
      f.fridgeRot = FOOD.filter(i => i.bad && m.bagged.indexOf(i.id) < 0).length;
      if (m.stage === 'sort' || m.stage === 'scrub') { f.fridgeOpen = 1; f.fridgeStage = Math.max(f.fridgeStage || 0, m.stage === 'sort' ? 1 : 2); }
      if (f.fridgeRot > 0) r.loop('flies', true);
      return m.stage;
    },
    onClose(r, reason) { r.loop('flies', false); if (r.stageId === 'scrub' && r.stage && r.stage.save) r.stage.save(); },
    pips(r) { const o = ['open', 'sort', 'scrub', 'close'], l = ['Открыть', 'Выбросить', 'Отмыть', 'Закрыть'], c = o.indexOf(r.stageId); return o.map((k, i) => ({ l: l[i], done: i < c || r.won, cur: i === c && !r.won })); },
    stages: {}
  };
  defs.fridge.stages.open = r => {
    let t0 = -1;
    const open = () => {
      if (t0 >= 0) return; t0 = 0; const f = r.S.f; f.fridgeOpen = 1; f.fridgeStage = 1; r.sfx('fridgeOpen'); r.act('disgust', 1.4); r.setAnim('openFridge'); r.loop('flies', true); r.sfx('disgust'); r.bark('fridge', 'open'); r.setActions([]);
    };
    return {
      hint: 'Холодильник закрыт, и оттуда подозрительно тянет. Открой дверцу: нажми кнопку, тапни по дверце или Enter.', anim: 'idle',
      targets: [{ x: 255, y: 8, w: 250, h: 388, label: 'Дверца холодильника', info: 'Липкая ручка, магниты, записки. За дверцей — неизвестность.' }],
      dan: 'Открой дверцу и не вдыхай. Потом выкидывай то, что с пушком и вонючими зелёными волнами. Нормальную еду не трогай.',
      enter() { r.setActions([{ label: 'Открыть холодильник', sub: 'задержи дыхание', big: true, primary: true, fn: open }]); },
      pick: open,
      tick(dt) { if (t0 >= 0) { t0 += dt; if (t0 > 1.1) { t0 = -2; r.setAnim('inspect'); r.go('sort'); } } },
      draw(g, t) { drawFridgeClosed(g, t, r, t0 >= 0 ? clamp(t0 / .9, 0, 1) : 0); }
    };
  };
  defs.fridge.stages.sort = r => {
    const m = r.m, f = r.S.f, bagged = new Set(m.bagged);
    const items = () => FOOD.filter(i => !bagged.has(i.id));
    let drag = null, fly = [], bagShake = 0, shakeId = null, shakeT = 0, endT = -1, hold = false;
    const rotLeft = () => FOOD.filter(i => i.bad && !bagged.has(i.id)).length;
    function bagItem(it, from) {
      if (m.bag >= FR.cap) { bagShake = .4; r.sfx('bad'); r.setHint('Мешок набит под завязку. Вынеси его к баку (кнопка ниже), потом вернись и продолжи.'); return false; }
      if (!it.bad) {
        m.wrong++; shakeId = it.id; shakeT = .5; r.penalty(4); r.bark('fridge', 'good');
        if (m.wrong % 3 === 0) r.setHint('Подсказка: тухлое — с пушком, с зелёными вонючими волнами и датой «март». Нормальное — без волн: яйца, пиво, горчица, сосиски, йогурт.');
        return false;
      }
      bagged.add(it.id); m.bagged.push(it.id); m.bag++; f.fridgeRot = rotLeft();
      fly.push({ it, x0: from ? from.x : it.cx, y0: from ? from.y : it.by - 30, t: 0 }); r.sfx(m.bag >= FR.cap ? 'bagFull' : 'toss'); r.sfx('bag');
      r.floatText(it.cx, it.by - 70, 'в мешок', '#b6e08a'); r.good();
      if (f.fridgeRot === 0) { r.setAnim('inspect'); endT = 0; } else if (Math.random() < .7) r.bark('fridge', 'bad');
      if (m.bag >= FR.cap && f.fridgeRot > 0) { r.bark('fridge', 'full'); showFull(); }
      refresh(); return true;
    }
    function showFull() {
      r.setActions([{ label: 'Вынести мешок к баку', sub: 'окно закроется, прогресс сохранится', big: true, primary: true, fn: () => { const n = m.bag; r.addTrash(n); m.carried += n; m.bag = 0; r.close('bag'); } }]);
    }
    function refresh() { r.setInfo('Тухлого осталось: ' + rotLeft() + '  ·  в мешке: ' + m.bag + '/' + FR.cap); }
    return {
      hint: 'Выбрось тухлое: оно с пушком и зелёными вонючими волнами. Перетащи в мешок справа (или тапни / Enter). Нормальную еду не трогай — −4 с.',
      anim: 'inspect', ownClick: true, kb: 'targets', noRing: false,
      dan: () => { const left = FOOD.filter(i => i.bad && !bagged.has(i.id)).map(i => i.n); return 'Выбрасывай только то, что воняет и зеленеет. Осталось выкинуть: ' + (left.slice(0, 4).join(', ') || 'ничего') + (left.length > 4 ? ' и ещё ' + (left.length - 4) : '') + '.'; },
      targets: () => items().map(i => { const b = frRect(i); return { id: i.id, x: b.x, y: b.y, w: b.w, h: b.h, label: i.n, info: i.n + ' — ' + i.d, it: i }; }),
      enter() { refresh(); if (m.bag >= FR.cap && rotLeft() > 0) showFull(); r.sayLine('bamboul', 'Так. Что тут у нас… Выкидываю только то, что с пушком.', true); },
      reset() { drag = null; },
      pick(tg) { bagItem(tg.it); },
      ptr(type, x, y) {
        if (type === 'down') { for (const tg of r.targets()) if (inRect(tg, x, y)) { drag = { it: tg.it, x, y }; r.sfx('pickup'); break; } }
        else if (type === 'move' && drag) { drag.x = x; drag.y = y; }
        else if (type === 'up' && drag) { const it = drag.it, tap = r.pmoved < 10, inBag = x > 535 && y > 150; const d = drag; drag = null; if (tap || inBag) bagItem(it, { x: d.x, y: d.y }); }
      },
      tick(dt) {
        if (bagShake > 0) bagShake -= dt; if (shakeT > 0) shakeT -= dt;
        for (const q of fly) q.t += dt; fly = fly.filter(q => q.t < .45);
        if (endT >= 0) { endT += dt; if (endT > 1.0) { endT = -1; const n = m.bag; if (n > 0) { r.addTrash(n); m.carried += n; m.bag = 0; r.sayLine('bamboul', 'Мешок на ' + n + ' — отнесу к баку, как закончу.', true); } f.fridgeStage = 2; r.sfx('taskDone'); r.go('scrub'); } }
      },
      draw(g, t) {
        drawFridgeIn(g, t, r, { haze: rotLeft() / 10 });
        for (const it of items()) { if (drag && drag.it === it) continue; let dx = 0; if (shakeId === it.id && shakeT > 0) dx = Math.sin(shakeT * 70) * 4; const hov = r.hover >= 0 && r.targets()[r.hover] && r.targets()[r.hover].id === it.id; drawFood(g, it, it.cx + dx, it.by - (hov ? 3 : 0), t); }
        drawDrawerFront(g);
        fliesDraw(g, t, 5 + (rotLeft() > 4 ? 3 : 0), 280, 170, 190 * Math.min(1, .3 + rotLeft() / 8));
        // bag area
        glow(g, FR.bagX, FR.bagY - 40, 110, '255,230,150', drag ? .22 : .07);
        if (drag) { g.save(); g.setLineDash([8, 6]); g.lineDashOffset = -t * 20; g.strokeStyle = 'rgba(255,230,140,.9)'; g.lineWidth = 3; rr(g, 548, 168, 200, 224, 14); g.stroke(); g.restore(); txt(g, 'СЮДА', FR.bagX, 190, { font: '900 15px ' + FONT, color: COL.mustard, align: 'center' }); }
        drawBag(g, FR.bagX, FR.bagY, m.bag, FR.cap, t, bagShake);
        for (let i = 0; i < FR.cap; i++) { g.fillStyle = i < m.bag ? COL.moss : 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(FR.bagX - 40 + i * 20, 160, 6, 0, TAU); g.fill(); }
        // counter note
        stickyNote(g, 560, 18, 170, 58, 'ТУХЛОГО: ' + rotLeft(), .04); txt(g, 'уберёшь — сделаешь вид, что жил чисто', 566, 66, { font: '600 9px ' + FONT, color: '#5a4a1c' });
        for (const q of fly) { const k = clamp(q.t / .45, 0, 1), x = lerp(q.x0, FR.bagX, k), y = lerp(q.y0, FR.bagY - 60, k) - Math.sin(k * Math.PI) * 70; drawFood(g, q.it, x, y, t, { noStink: true }); }
        if (drag) { g.save(); g.globalAlpha = .96; drawFood(g, drag.it, drag.x, drag.y + 30, t, { noStink: true }); g.restore(); }
        vignette(g, .35);
      }
    };
  };
  defs.fridge.stages.scrub = r => {
    const m = r.m, f = r.S.f; const areas = []; const r2 = rng(77);
    for (let i = 0; i < 3; i++) for (let k = 0; k < 4; k++) areas.push({ x: 90 + k * 118 + r2() * 30, y: FR.shelfY[i] - 3, rx: 34 + r2() * 20, ry: 7 + r2() * 3, th: 1.3 });
    areas.push({ x: 130, y: 345, rx: 60, ry: 12, th: 1.5 }, { x: 330, y: 360, rx: 70, ry: 12, th: 1.5 });
    for (const [x, y, rx, ry] of [[130, 50, 34, 22], [400, 130, 30, 24], [240, 222, 36, 22], [470, 300, 24, 26]]) areas.push({ x, y, rx, ry, th: 1.7, col: '#7d5a24', alpha: .8 });
    const sc = Scrub({ w: W, h: H, areas, seed: 21, brush: 24 }); sc.load(m.cells);
    let lx = 0, ly = 0, lastSave = 0, done = false, said = false, doneT = -1;
    return {
      hint: 'Полки липкие. Зажми и води губкой по жёлто-бурым пятнам (стрелки + Space/Enter с клавиатуры). Шкала внизу — прогресс.',
      anim: 'scrubFridge', cursor: 'none', kb: 'cursor',
      dan: 'Липкие пятна на полках и стенках. Води губкой туда-сюда, пока шкала не дойдёт до конца. Тереть надо, а не смотреть.',
      enter() { r.setProg(sc.prog()); r.sayLine('bamboul', 'Теперь полки. Они липнут. Это либо сироп, либо чья-то судьба.', true); },
      reset() { },
      save() { m.cells = sc.ser(); },
      leave() { m.cells = sc.ser(); },
      ptr(type, x, y) {
        if (type === 'down') { lx = x; ly = y; }
        else if (type === 'move' && r.pd && !done) { const d = Math.hypot(x - lx, y - ly); if (d > .5) { sc.brush(x, y, Math.min(d, 40) * .02); if (Math.random() < .5) r.emit({ x: x + (Math.random() - .5) * 20, y: y + (Math.random() - .5) * 14, vx: (Math.random() - .5) * 20, vy: -12, life: .8, kind: 'bub', size: 2 + Math.random() * 4, alpha: .9 }); r.sfxT_('scrub', .22); } lx = x; ly = y; }
      },
      tick(dt) {
        const p = sc.prog(); r.setProg(p, 'Липкость убрана: ' + Math.round(p * 100) + '%'); lastSave += dt; if (lastSave > .8) { lastSave = 0; m.cells = sc.ser(); }
        if (!said && p > .5) { said = true; r.bark('fridge', 'prog'); }
        if (!done && p >= .96) { done = true; sc.clearAll(); m.cells = sc.ser(); f.fridgeStage = 3; doneT = 0; r.good(); r.sfx('taskDone'); r.bark('fridge', 'scrub'); }
        if (doneT >= 0) { doneT += dt; if (doneT > 1.0) { doneT = -1; r.go('close'); } }
      },
      draw(g, t) {
        drawFridgeIn(g, t, r, { haze: 0, noResidue: true, dirt: 0 });
        sc.draw(g, 0, 0);
        for (const it of FOOD) if (!it.bad) drawFood(g, it, it.cx, it.by, t);
        drawDrawerFront(g);
        if (!done && (r.pd || r.cur.kb)) drawTool(g, 'sponge', r.cur.x + 12, r.cur.y + 6, -.35, t, r.pd); else if (!done) drawTool(g, 'sponge', r.px + 12, r.py + 6, -.35, t, false);
        vignette(g, .35);
      }
    };
  };
  defs.fridge.stages.close = r => {
    const f = r.S.f; let t0 = -1, phase = 0;
    const closeIt = () => { if (t0 >= 0) return; t0 = 0; r.setActions([]); r.sfx('fridgeClose'); r.setAnim('openFridge'); };
    return {
      hint: 'Чисто и пусто — почти красота. Закрой дверцу и сделай вид, что так и было.', anim: 'idle',
      dan: 'Всё. Просто закрой дверцу.',
      enter() { r.setActions([{ label: 'Закрыть дверцу', big: true, primary: true, fn: closeIt }]); r.loop('flies', false); },
      tick(dt) {
        if (t0 >= 0) { t0 += dt; if (t0 > .8 && !phase) { phase = 1; f.fridgeOpen = 0; f.fridgeDone = 1; f.fridgeStage = 4; f.fridgeRot = 0; r.bark('fridge', 'close'); setTimeout(() => { if (!r.closed) r.bark('fridge', 'done'); }, 1400); } if (t0 > 1.0 && phase === 1) { phase = 2; r.setAnim('idle'); r.win(); } }
      },
      draw(g, t) {
        const k = t0 < 0 ? 0 : clamp(t0 / .8, 0, 1);
        drawFridgeIn(g, t, r, { haze: 0, noResidue: true, dirt: 0 });
        for (const it of FOOD) if (!it.bad) drawFood(g, it, it.cx, it.by, t);
        drawDrawerFront(g); glow(g, 280, 200, 260, '255,255,230', .12 + .04 * Math.sin(t * 3));
        for (let i = 0; i < 6; i++) { const x = 100 + i * 80 + Math.sin(t * 2 + i) * 6, y = 40 + ((t * 20 + i * 70) % 330); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x, y, 2, 2); }
        if (k > 0) { g.save(); g.globalAlpha = k; drawFridgeClosed(g, t, r, 0); g.restore(); }
        vignette(g, .3);
      }
    };
  };

  /* ============================================================================
     PUBLIC API
     ========================================================================== */
  function start(id, S, onDone) {
    if (R) return false;                                   // double-open guard
    const def = defs[id]; S = S || BB.S;
    if (!def || !S) { try { onDone && onDone({ id, win: false, error: 'unknown' }); } catch (e) { } return false; }
    S.f = S.f || {}; S.mg = S.mg || {};
    if (def.isDone && def.isDone(S)) {
      try { BB.ui && BB.ui.toast && BB.ui.toast('Тут уже всё сделано.'); } catch (e) { }
      try { onDone && onDone({ id, win: true, already: true, timeCost: 0 }); } catch (e) { console.error(e); } return true;
    }
    css();
    R = makeRun(def, id, S, onDone); BB.mini.active = id; BB.mini._R = R;
    try {
      const first = def.init ? def.init(R) : null;
      R.go(first || R.m.stage || def.first);
      if (def.greet) def.greet(R);
    } catch (e) { console.error('[mini start]', e); R.close('error'); return false; }
    R.begin();
    return true;
  }
  BB.mini = {
    start, active: null, _R: null, defs, ids: Object.keys(defs),
    abort() { if (R) R.close('abort'); },
    isActive() { return !!R; }
  };
  /* no-op safety: close if the page goes away */
  window.addEventListener('pagehide', () => { if (R) R.close('abort'); });
})();
