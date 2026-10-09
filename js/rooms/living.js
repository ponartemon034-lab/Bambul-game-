/* ==========================================================================
   LIVING ROOM (id 'living', width 850) - warm, dusty, lived in.
   Orange floor lamp + blue TV glow + cold moon through the window.
   Owner: environment artist (hall + living).  See docs/ROOMS_HALL_LIVING.md
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const A = BB.art, U = BB.U, srand = U.srand, clamp = U.clamp, P2 = Math.PI * 2;
  const F = S => (S && S.f) || {};

  /* ------------------------------------------------------------ local helpers */
  function soft(g, x, y, w, h, a, c) {
    c = c || 'rgba(0,0,0,';
    g.save(); g.translate(x, y); g.scale(w / 2, h / 2);
    g.fillStyle = A.rg(g, 0, 0, 0, 1, [c + a + ')', c + (a * .45) + ')', c + '0)']);
    g.beginPath(); g.arc(0, 0, 1, 0, P2); g.fill(); g.restore();
  }
  let _tile = null;
  function tileNoise() {
    if (_tile) return _tile;
    const c = BB.mk(64, 64), g = c.getContext('2d'), d = g.createImageData(64, 64), r = srand(9);
    for (let i = 0; i < d.data.length; i += 4) { const v = r() < .5 ? 20 : 235; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 40 + r() * 215; }
    g.putImageData(d, 0, 0); return _tile = c;
  }
  function grainOn(g, x, y, w, h, a, sc) {
    g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a || .08;
    const t = tileNoise(), s = 64 * (sc || .3);
    for (let xx = x; xx < x + w; xx += s) for (let yy = y; yy < y + h; yy += s) g.drawImage(t, xx, yy, s, s);
    g.restore();
  }
  /* dust film on upward-facing edges: call after painting; strips = [[x,y,w]] */
  function dustTop(g, x, y, w, a) { g.fillStyle = 'rgba(170,160,140,' + (a || .5) + ')'; g.fillRect(x, y - .7, w, 1.2); g.fillStyle = 'rgba(210,200,180,' + ((a || .5) * .5) + ')'; g.fillRect(x, y - 1.4, w, .8); }
  function stainRing(g, x, y, rx, ry, a, col) {
    col = col || 'rgba(120,92,40,';
    soft(g, x, y, rx * 2, ry * 2, a, col);
    g.strokeStyle = col + (a * 1.4) + ')'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(x, y, rx * .86, ry * .86, 0, 0, P2); g.stroke();
  }
  /* sprite painted lazily, drawn each frame with a horizontal wave (cloth) */
  function cloth(o, paint, amp, freq, ph, top) {
    let img = null;
    o.dyn = (g, t, S) => {
      if (!img) img = BB.bake(o.w, o.h, paint);
      const n = 28, sh = o.h / n, boost = 1 + (F(S).tvOn ? 0 : 0);
      for (let i = 0; i < n; i++) {
        const k = Math.pow(i / n, 1.6), dx = (Math.sin(t * freq + ph + i * .12) * amp + Math.sin(t * freq * .43 + ph * 2) * amp * .8) * k * boost;
        g.drawImage(img, 0, i * sh * img.height / o.h, img.width, sh * img.height / o.h + 1, dx, i * sh, o.w, sh + .6);
      }
    };
    return o;
  }

  /* ------------------------------------------------------------------ walls */
  const WIN = { x: 355, y: 92, w: 150, h: 116 };
  function wall(g, w, h, room) {
    const r = srand(15);
    A.wallpaper(g, 0, 0, w, h, { base: '#94704f', top: '#a07a56', bottom: '#6c5038', pattern: 'damask', stripe: 'rgba(60,30,15,.16)', step: 15, seam: 58, seed: 6 });
    // tone the damask with a second, lighter lattice for depth
    g.fillStyle = 'rgba(255,215,160,.05)'; for (let xx = 0; xx < w; xx += 15) g.fillRect(xx + 7, 0, .7, h);
    A.grain(g, 0, 0, w, h, .12, .3);
    // nicotine halo toward the ceiling, soot, grime streaks, damp
    g.fillStyle = A.lg(g, 0, 0, 0, 90, ['rgba(120,85,25,.38)', 'rgba(120,85,25,0)']); g.fillRect(0, 0, w, 90);
    A.streaks(g, 0, 0, w, 150, 8, 60, 'rgba(50,35,15,.12)');
    A.blotches(g, 0, 0, w, h, 14, 36, 'rgba(50,30,10,.10)', 12, 46);
    stainRing(g, 700, 22, 52, 22, .26); stainRing(g, 120, 12, 40, 18, .2); A.streaks(g, 660, 0, 80, 90, 31, 12, 'rgba(105,80,36,.22)');
    // mould in the top corner above the window
    for (let i = 0; i < 24; i++) soft(g, 520 + r() * 40, 4 + r() * 30, 5 + r() * 12, 4 + r() * 8, .3, 'rgba(25,30,18,');
    // peeling wallpaper near the TV and the shelves
    const peel = (x, y, pw, ph, seed) => {
      const rr = srand(seed), pts = [];
      for (let i = 0; i < 14; i++) { const a = i / 14 * P2, k = .7 + .3 * rr(); pts.push([x + pw / 2 + Math.cos(a) * pw / 2 * k, y + ph / 2 + Math.sin(a) * ph / 2 * k]); }
      const path = (dx, dy) => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0] + dx, p[1] + dy) : g.moveTo(p[0] + dx, p[1] + dy)); g.closePath(); };
      path(0, 1.4); g.fillStyle = 'rgba(0,0,0,.4)'; g.fill(); path(0, 0); g.fillStyle = '#b6ab92'; g.fill();
      g.save(); path(0, 0); g.clip(); A.blotches(g, x, y, pw, ph, seed, 4, 'rgba(70,55,35,.4)', 3, 8); g.restore();
      g.save(); g.beginPath(); g.moveTo(x + pw * .1, y + ph * .3); g.quadraticCurveTo(x + pw * .5, y - ph * .05, x + pw * .92, y + ph * .25); g.lineTo(x + pw * .78, y + ph * .5); g.quadraticCurveTo(x + pw * .5, y + ph * .36, x + pw * .2, y + ph * .55); g.closePath();
      g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 2.5; g.shadowOffsetY = 2; g.fillStyle = '#8f6c4c'; g.fill(); g.shadowColor = 'transparent'; g.strokeStyle = 'rgba(255,225,185,.5)'; g.lineWidth = .8; g.stroke(); g.restore();
    };
    peel(700, 20, 50, 48, 71); peel(585, 118, 30, 36, 73); peel(60, 20, 36, 40, 77); peel(810, 120, 28, 30, 79);
    // window reveal (wall thickness), then punch the hole
    const wx = WIN.x, wy = h - WIN.y - WIN.h, ww = WIN.w, wh = WIN.h;
    g.fillStyle = A.lg(g, wx - 9, 0, wx, 0, ['rgba(0,0,0,0)', 'rgba(20,10,5,.55)']); g.fillRect(wx - 9, wy - 9, 9, wh + 18);
    g.fillStyle = A.lg(g, wx + ww, 0, wx + ww + 9, 0, ['rgba(20,10,5,.55)', 'rgba(0,0,0,0)']); g.fillRect(wx + ww, wy - 9, 9, wh + 18);
    g.fillStyle = A.lg(g, 0, wy - 9, 0, wy, ['rgba(0,0,0,0)', 'rgba(20,10,5,.6)']); g.fillRect(wx, wy - 9, ww, 9);
    A.hole(g, wx, wy, ww, wh);
    // a thin bright edge on the plaster inside the opening
    g.fillStyle = 'rgba(240,220,190,.35)'; g.fillRect(wx - .6, wy, .6, wh); g.fillRect(wx + ww, wy, .6, wh);
    A.skirting(g, w, h, { base: '#2f2118', crown: '#b9a98c', bh: 11, ch: 6 });
    A.wallAO(g, w, h);
    g.fillStyle = A.lg(g, 0, 0, 40, 0, ['rgba(0,0,0,.3)', 'rgba(0,0,0,0)']); g.fillRect(0, 0, 40, h);
    g.fillStyle = A.lg(g, w - 40, 0, w, 0, ['rgba(0,0,0,0)', 'rgba(0,0,0,.3)']); g.fillRect(w - 40, 0, 40, h);
  }

  /* ------------------------------------------------------------------ floor */
  function floor(g, w, d) {
    const r = srand(33);
    A.planks(g, 0, 0, w, d, { c1: '#9a6e45', c2: '#6c4a2e', ph: 14, pl: 126, seed: 5 });
    g.fillStyle = A.lg(g, 0, 0, 0, 40, ['rgba(0,0,0,.55)', 'rgba(0,0,0,0)']); g.fillRect(0, 0, w, 40);
    // wear lane where he shuffles between sofa and fridge, worn patches, sun-bleached boards by the window
    g.fillStyle = A.lg(g, 0, 110, 0, 220, ['rgba(220,190,140,0)', 'rgba(220,190,140,.13)', 'rgba(220,190,140,0)']); g.fillRect(0, 110, w, 110);
    A.blotches(g, 0, 0, w, d, 12, 80, 'rgba(15,8,2,.15)', 12, 50);
    for (let i = 0; i < 70; i++) { const x = r() * w, y = 30 + r() * 250; g.strokeStyle = 'rgba(230,200,150,' + (.06 + r() * .1) + ')'; g.lineWidth = .6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 + r() * 30, y + (r() - .5) * 4); g.stroke(); }
    // laminate swelling seams
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 9; i++) g.fillRect(30 + r() * (w - 60), 20 + r() * 290, 1, 22);
    // big rug under the table (dark wine red, Persian style, scuffed)
    const rx = 300, ry = 18, rw = 290, rh = 128;
    soft(g, rx + rw / 2, ry + rh / 2 + 4, rw + 22, rh + 22, .55);
    g.fillStyle = '#5b1f22'; g.fillRect(rx, ry, rw, rh);
    g.fillStyle = '#3d1417'; g.fillRect(rx + 7, ry + 7, rw - 14, rh - 14);
    g.fillStyle = '#6c2b27'; g.fillRect(rx + 13, ry + 13, rw - 26, rh - 26);
    g.strokeStyle = '#c3a45e'; g.lineWidth = 1; g.strokeRect(rx + 4.5, ry + 4.5, rw - 9, rh - 9); g.strokeRect(rx + 11, ry + 11, rw - 22, rh - 22);
    for (let i = 0; i < 12; i++) { const cx = rx + 24 + i * (rw - 48) / 11; A.poly(g, [cx, ry + 8.5, cx + 3, ry + 11, cx, ry + 13.5, cx - 3, ry + 11], '#c3a45e'); A.poly(g, [cx, ry + rh - 13.5, cx + 3, ry + rh - 11, cx, ry + rh - 8.5, cx - 3, ry + rh - 11], '#c3a45e'); }
    const mcx = rx + rw / 2, mcy = ry + rh / 2;
    for (let k = 0; k < 3; k++) { const s = 1 - k * .28; A.poly(g, [mcx, mcy - 36 * s, mcx + 70 * s, mcy, mcx, mcy + 36 * s, mcx - 70 * s, mcy], ['#a8854a', '#3c1518', '#8e3a2a'][k]); }
    for (let i = 0; i < 6; i++) { const a = i / 6 * P2; A.ell(g, mcx + Math.cos(a) * 28, mcy + Math.sin(a) * 14, 4, 2.4, '#d9c28a'); }
    for (let i = 0; i < 1400; i++) { g.fillStyle = 'rgba(' + (r() < .5 ? '0,0,0,' : '255,230,190,') + (.04 + r() * .07) + ')'; g.fillRect(rx + r() * rw, ry + r() * rh, 1.2, 1.2); }
    g.strokeStyle = '#d3c7a2'; g.lineWidth = .8; for (let i = 0; i < 30; i++) { const y = ry + 2 + i * (rh - 4) / 29; g.beginPath(); g.moveTo(rx - 4, y); g.lineTo(rx, y); g.moveTo(rx + rw, y); g.lineTo(rx + rw + 4, y); g.stroke(); }
    A.blotches(g, rx, ry, rw, rh, 4, 14, 'rgba(0,0,0,.25)', 4, 14);
    // beer ring stains, crumbs and a chip-bag shadow on the rug
    g.strokeStyle = 'rgba(20,6,6,.5)'; g.lineWidth = .9; for (const [x, y] of [[418, 88], [452, 58], [500, 96]]) { g.beginPath(); g.ellipse(x, y, 4, 2.4, 0, 0, P2); g.stroke(); }
    g.fillStyle = 'rgba(230,200,140,.7)'; for (let i = 0; i < 40; i++) g.fillRect(380 + r() * 150, 40 + r() * 80, 1.2, 1);
    // small hallway-side mat by the sofa: stained throw rug
    g.save(); g.translate(150, 108); g.rotate(-.04); soft(g, 0, 2, 138, 50, .4); g.fillStyle = '#3a4a50'; g.fillRect(-60, -20, 120, 40); g.fillStyle = '#566a70'; for (let i = 0; i < 6; i++) g.fillRect(-60, -20 + i * 7, 120, 3); g.restore();
    // laundry spill, sock, chip crumbs by the sofa; extension cable + speaker wires across the floor
    g.strokeStyle = '#0c0c0e'; g.lineWidth = 1.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(660, 66); g.bezierCurveTo(620, 100, 560, 70, 540, 118); g.bezierCurveTo(520, 140, 470, 112, 330, 124); g.stroke();
    g.strokeStyle = '#1d1d22'; g.lineWidth = .9; g.beginPath(); g.moveTo(720, 70); g.bezierCurveTo(700, 110, 640, 90, 610, 128); g.bezierCurveTo(590, 150, 470, 140, 420, 150); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = .35; g.beginPath(); g.moveTo(660, 65); g.bezierCurveTo(620, 99, 560, 69, 540, 117); g.stroke();
    A.rrect(g, 316, 119, 26, 9, 1.5, '#d3cfbe'); A.rrect(g, 317, 120, 24, 7, 1, '#bfbba8'); for (let i = 0; i < 4; i++) A.rect(g, 320 + i * 5, 122, 3, 2.4, '#26262a'); A.ell(g, 345, 123, 1.8, 1.4, '#e44');
    // greasy patch from a dropped pizza, sticky cola puddle, dust bunnies against the skirting
    soft(g, 200, 160, 40, 18, .3, 'rgba(60,30,5,'); soft(g, 618, 140, 28, 12, .3, 'rgba(50,25,5,'); for (let i = 0; i < 16; i++) soft(g, 20 + r() * 800, 8 + r() * 10, 10 + r() * 14, 5, .35, 'rgba(110,100,90,');
    // moonlight on the floor: four panes of the window, skewed by the angle of the light
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const x0 = WIN.x + 6 + i * 74, y0 = 4 + j * 86, pw = 66, ph = 78, sk = .75;
      g.fillStyle = A.lg(g, 0, y0, 0, y0 + ph + 70, ['rgba(130,165,235,.25)', 'rgba(130,165,235,.06)']);
      g.beginPath(); g.moveTo(x0 + y0 * sk, y0); g.lineTo(x0 + pw + y0 * sk, y0); g.lineTo(x0 + pw + (y0 + ph) * sk, y0 + ph); g.lineTo(x0 + (y0 + ph) * sk, y0 + ph); g.closePath(); g.fill();
    }
    g.restore();
  }

  /* ------------------------------------------------------------------ ceiling */
  function ceil(g, w, d) {
    const r = srand(97);
    g.fillStyle = A.lg(g, 0, 0, 0, d, ['#7a6e52', '#8f8468']); g.fillRect(0, 0, w, d);
    A.blotches(g, 0, 0, w, d, 9, 70, 'rgba(70,50,15,.15)', 14, 56); A.grain(g, 0, 0, w, d, .12, .5);
    stainRing(g, 600, 50, 70, 38, .3); stainRing(g, 190, 80, 50, 26, .24); stainRing(g, 420, 90, 90, 60, .12, 'rgba(70,50,15,');
    g.strokeStyle = 'rgba(25,18,8,.55)'; g.lineWidth = .9; g.beginPath(); let cx = 80, cy = 40; g.moveTo(cx, cy); for (let i = 0; i < 26; i++) { cx += 12 + r() * 22; cy += (r() - .5) * 18; g.lineTo(cx, cy); } g.stroke();
    // chandelier rosette (x 425, z 70 -> plan y 90) and cable
    soft(g, 425, 90, 90, 90, .55, 'rgba(25,15,5,'); A.ell(g, 425, 90, 12, 12, '#c9c1a6'); A.ell(g, 425, 90, 12, 12, 'rgba(0,0,0,.2)'); A.ell(g, 424, 89, 9, 9, '#e0d9c0');
    // sagging smoke stain around the lamp, flaking paint
    for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * 220, s = 2 + r() * 6; A.poly(g, [x, y, x + s, y + s * .3, x + s * .6, y + s], 'rgba(190,180,150,' + (.2 + r() * .25) + ')'); }
  }

  /* ---------------------------------------------------------------- sprites */
  function paintWallCarpet(g, w, h) {
    const r = srand(5);
    soft(g, w / 2 + 2, h / 2 + 3, w + 6, h + 6, .5);
    const bh = h - 12;
    g.fillStyle = '#6c1d20'; g.fillRect(0, 0, w, bh);
    g.fillStyle = '#41121a'; g.fillRect(8, 8, w - 16, bh - 16); g.fillStyle = '#7d2a28'; g.fillRect(15, 15, w - 30, bh - 30);
    g.strokeStyle = '#cfae64'; g.lineWidth = 1; g.strokeRect(4, 4, w - 8, bh - 8); g.strokeRect(12, 12, w - 24, bh - 24);
    for (let i = 0; i < 22; i++) { const cx = 14 + i * (w - 28) / 21; A.poly(g, [cx, 5.5, cx + 3.2, 8.5, cx, 11.5, cx - 3.2, 8.5], '#cfae64'); A.poly(g, [cx, bh - 11.5, cx + 3.2, bh - 8.5, cx, bh - 5.5, cx - 3.2, bh - 8.5], '#cfae64'); }
    for (let j = 0; j < 4; j++) for (const sx of [0, 1]) { const cy = 22 + j * 28; A.poly(g, [(sx ? w - 8 : 8) - 1, cy, (sx ? w - 8 : 8) + 3, cy + 5, (sx ? w - 8 : 8) - 1, cy + 10, (sx ? w - 8 : 8) - 5, cy + 5], '#cfae64'); }
    const cx = w / 2, cy = bh / 2;
    for (let k = 0; k < 4; k++) { const s = 1 - k * .22; A.poly(g, [cx, cy - 56 * s, cx + 76 * s, cy, cx, cy + 56 * s, cx - 76 * s, cy], ['#c19a54', '#3a1018', '#9a3a2a', '#2c3b52'][k]); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * P2; A.ell(g, cx + Math.cos(a) * 30, cy + Math.sin(a) * 20, 5, 3, '#d8c48a'); }
    for (let i = 0; i < 2600; i++) { g.fillStyle = 'rgba(' + (r() < .5 ? '0,0,0,' : '255,215,170,') + (.05 + r() * .09) + ')'; g.fillRect(r() * w, r() * bh, 1.1, 1.1); }
    A.blotches(g, 0, 0, w, bh, 3, 14, 'rgba(0,0,0,.28)', 5, 18); A.blotches(g, 0, 0, w, bh, 9, 8, 'rgba(255,200,140,.12)', 8, 20);
    g.fillStyle = A.lg(g, 0, 0, 0, 24, ['rgba(0,0,0,.35)', 'rgba(0,0,0,0)']); g.fillRect(0, 0, w, 24);
    g.strokeStyle = '#d6c9a0'; g.lineWidth = .9; for (let i = 0; i < 100; i++) { const x = 1 + i * (w - 2) / 99; g.beginPath(); g.moveTo(x, bh); g.lineTo(x + (r() - .5) * 1.4, bh + 6 + r() * 5); g.stroke(); }
    for (const x of [8, w / 2, w - 8]) { A.ell(g, x, 2, 1.1, 1.1, '#aaa'); }
    // a cigarette-burn hole and a nail with a hanging key
    A.ell(g, 52, 46, 2.2, 2, '#1a0a0a'); g.strokeStyle = 'rgba(200,120,60,.5)'; g.lineWidth = .5; g.beginPath(); g.arc(52, 46, 3, 0, P2); g.stroke();
    grainOn(g, 0, 0, w, h, .08, .3);
  }
  function paintFrame(img) {
    return (g, w, h) => {
      soft(g, w / 2 + 1, h / 2 + 2, w + 3, h + 3, .42);
      A.rrect(g, 1, 1, w - 2, h - 2, 1.5, A.lg(g, 0, 0, w, 0, ['#5d3b22', '#85603c', '#4a2e19'])); A.rect(g, 1, 1, w - 2, .8, 'rgba(255,230,190,.3)');
      const x = 3.6, y = 3.6, pw = w - 7.2, ph = h - 7.2;
      if (img === 'family') {
        g.fillStyle = A.lg(g, 0, y, 0, y + ph, ['#a89a78', '#7a6e52']); g.fillRect(x, y, pw, ph);
        for (let i = 0; i < 3; i++) { A.ell(g, x + pw * (.25 + i * .25), y + ph * .38, 2.4, 2.8, '#d2b18a'); A.rrect(g, x + pw * (.25 + i * .25) - 3.4, y + ph * .5, 6.8, ph * .45, 2, ['#3b4a5a', '#7a3a3a', '#3a3a30'][i]); }
      } else if (img === 'lada') {
        g.fillStyle = A.lg(g, 0, y, 0, y + ph, ['#4f7a9a', '#c9d3d0']); g.fillRect(x, y, pw, ph); A.poly(g, [x, y + ph, x + pw * .3, y + ph * .5, x + pw * .6, y + ph * .75, x + pw, y + ph * .4, x + pw, y + ph], '#3e5e44');
        A.rrect(g, x + pw * .25, y + ph * .6, pw * .5, ph * .22, 2, '#b43a2c');
      } else { // poster of a band
        g.fillStyle = A.lg(g, 0, y, 0, y + ph, ['#1d2548', '#6a2f5a']); g.fillRect(x, y, pw, ph); g.fillStyle = '#f2e6b4'; g.font = 'bold 5.4px Impact,Arial,sans-serif'; g.textAlign = 'center'; g.fillText('НОЧНОЙ', x + pw / 2, y + ph * .62); g.fillText('ДОЖОР', x + pw / 2, y + ph * .62 + 6);
        for (let i = 0; i < 3; i++) A.ell(g, x + pw * (.25 + i * .25), y + ph * .28, 3, 3.4, '#171322');
      }
      g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + pw * .6, y); g.lineTo(x, y + ph * .6); g.fill();
      grainOn(g, 0, 0, w, h, .08, .3);
    };
  }
  function paintClock(g, w, h) {
    soft(g, w / 2 + 1, h / 2 + 2, w + 3, h + 3, .42);
    A.ell(g, w / 2, h / 2, w / 2 - 1, h / 2 - 1, '#2a2118'); A.ell(g, w / 2, h / 2, w / 2 - 2.6, h / 2 - 2.6, '#d9d2b8'); A.ell(g, w / 2 - 3, h / 2 - 4, w / 3, h / 4, 'rgba(255,255,255,.1)');
    for (let i = 0; i < 12; i++) { const a = i / 12 * P2; A.line(g, w / 2 + Math.cos(a) * 9.4, h / 2 + Math.sin(a) * 9.4, w / 2 + Math.cos(a) * 11, h / 2 + Math.sin(a) * 11, '#333', .7); }
    A.line(g, w / 2, h / 2, w / 2 + 5, h / 2 - 5, '#222', 1.1); A.line(g, w / 2, h / 2, w / 2 - 1, h / 2 + 8, '#222', .8); A.ell(g, w / 2, h / 2, 1, 1, '#a22');
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = .5; g.beginPath(); g.moveTo(w - 6, 8); g.lineTo(w - 12, 12); g.lineTo(w - 10, 18); g.stroke(); // cracked glass
    grainOn(g, 0, 0, w, h, .08, .3);
  }
  function paintRadiator(g, w, h) {
    soft(g, w / 2, h - 1, w + 4, 6, .5);
    g.fillStyle = A.lg(g, 0, 0, 0, h, ['#e6e2d4', '#cbc6b4']); g.fillRect(2, 8, w - 4, h - 12);
    for (let i = 0; i < 16; i++) { const x = 3 + i * (w - 6) / 16; g.fillStyle = A.lg(g, x, 0, x + 5.4, 0, ['#d0cbb8', '#f3f0e4', '#b6b19e']); g.fillRect(x, 9, 5.4, h - 16); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 5.2, 9, .6, h - 16); }
    A.rect(g, 1, 6, w - 2, 4, '#d7d2c0'); A.rect(g, 1, 6, w - 2, 1, 'rgba(255,255,255,.7)'); A.rect(g, 1, h - 8, w - 2, 4, '#c0bba8');
    A.blotches(g, 2, 8, w - 4, h - 12, 5, 8, 'rgba(120,85,30,.25)', 3, 9); A.streaks(g, 2, 8, w - 4, h - 12, 3, 8, 'rgba(120,70,20,.3)');
    // wet socks, a towel hanging on the radiator
    g.fillStyle = '#6a7a8a'; g.beginPath(); g.moveTo(12, 6); g.lineTo(26, 6); g.lineTo(26, 24); g.quadraticCurveTo(26, 30, 18, 30); g.lineTo(12, 30); g.closePath(); g.fill(); A.rect(g, 12, 6, 14, 3, '#9aa6b2');
    g.fillStyle = '#a65a4a'; g.beginPath(); g.moveTo(w - 36, 6); g.lineTo(w - 22, 6); g.lineTo(w - 24, 36); g.lineTo(w - 36, 38); g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(w - 28, 6, 3, 31);
    A.rect(g, w - 52, 5, 10, 4, '#555'); A.rect(g, w - 52, 9, 3, 18, '#4a4a55');
    grainOn(g, 0, 0, w, h, .1, .3);
  }

  /* window: frame, sashes, glass dirt (glass is mostly transparent so the city shows through) */
  function paintWindow(g, w, h) {
    const r = srand(8), fx = 8, fy = 6, iw = w - 16, ih = h - 17;
    // sill (stone slab, lit from above)
    g.fillStyle = A.lg(g, 0, h - 11, 0, h, ['#cfc7b0', '#8c846f']); g.fillRect(0, h - 11, w, 11); A.rect(g, 0, h - 11, w, 1.2, 'rgba(255,255,255,.6)'); A.rect(g, 0, h - 1.4, w, 1.4, 'rgba(0,0,0,.4)');
    A.blotches(g, 0, h - 11, w, 11, 2, 6, 'rgba(60,45,20,.3)', 3, 7); for (let i = 0; i < 14; i++) A.rect(g, 3 + r() * (w - 8), h - 9 + r() * 6, 2 + r() * 4, .8, 'rgba(255,255,255,.2)');
    // white-painted wooden frame, flaking, with a central mullion and a transom
    const wood = (x, y, ww, hh) => { g.fillStyle = A.lg(g, x, y, x + ww, y + hh, ['#d8d3c3', '#bcb6a2']); g.fillRect(x, y, ww, hh); A.rect(g, x, y, ww, .7, 'rgba(255,255,255,.7)'); A.rect(g, x, y + hh - .8, ww, .8, 'rgba(0,0,0,.28)'); };
    wood(fx - 8, fy, 8, ih); wood(fx + iw, fy, 8, ih); wood(fx - 8, fy - 5, iw + 16, 6); wood(fx - 8, fy + ih - 1, iw + 16, 6);
    wood(fx + iw / 2 - 3, fy, 6, ih); wood(fx, fy + ih * .36, iw, 5);
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = .7; g.strokeRect(fx, fy, iw, ih);
    for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * ih; A.poly(g, [x, y, x + 2 + r() * 3, y + .5, x + 1.5, y + 2.4 + r() * 2], 'rgba(100,70,40,.6)'); }       // flaked paint exposing wood
    // latches
    A.rrect(g, fx + iw / 2 - 5.4, fy + ih * .65, 3, 9, 1, '#8c8a82'); A.rrect(g, fx + iw / 2 + 2.4, fy + ih * .65, 3, 9, 1, '#8c8a82');
    // glass: faint sheen, grime in corners, rain streaks and a crack
    g.save(); g.beginPath(); g.rect(fx, fy, iw, ih); g.clip();
    g.fillStyle = A.lg(g, fx, fy, fx + iw, fy + ih, ['rgba(180,200,230,.0)', 'rgba(200,215,240,.1)', 'rgba(180,200,230,0)']); g.fillRect(fx, fy, iw, ih);
    g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(fx + 10, fy); g.lineTo(fx + 40, fy); g.lineTo(fx, fy + 40); g.lineTo(fx, fy + 10); g.fill(); g.beginPath(); g.moveTo(fx + iw - 50, fy + ih); g.lineTo(fx + iw - 14, fy); g.lineTo(fx + iw - 4, fy); g.lineTo(fx + iw - 40, fy + ih); g.fill();
    A.blotches(g, fx, fy, iw, ih, 22, 10, 'rgba(80,70,50,.22)', 3, 12); A.streaks(g, fx, fy, iw, ih, 14, 16, 'rgba(120,130,150,.22)');
    g.fillStyle = A.lg(g, 0, fy + ih - 20, 0, fy + ih, ['rgba(60,50,35,0)', 'rgba(60,50,35,.3)']); g.fillRect(fx, fy + ih - 20, iw, 20);
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = .4; g.beginPath(); g.moveTo(fx + iw - 4, fy + ih * .36 + 5); g.lineTo(fx + iw - 22, fy + ih * .55); g.lineTo(fx + iw - 18, fy + ih * .8); g.moveTo(fx + iw - 22, fy + ih * .55); g.lineTo(fx + iw - 40, fy + ih * .6); g.stroke();
    for (let i = 0; i < 22; i++) { const x = fx + r() * iw, y = fy + r() * ih; A.ell(g, x, y, .5 + r() * .7, .8 + r() * 1.2, 'rgba(200,215,235,.35)'); }
    g.restore();
    // tape cross on a pane + a draught stopper strip
    g.fillStyle = 'rgba(190,170,110,.55)'; g.fillRect(fx + 6, fy + 8, 22, 1.6); g.fillRect(fx + 16, fy + 3, 1.6, 12);
    A.rect(g, fx, fy + ih - 3, iw, 3, '#9b3a2e'); A.rect(g, fx, fy + ih - 3, iw, .6, 'rgba(255,255,255,.3)');
    grainOn(g, 0, 0, w, h, .08, .3);
  }
  function paintSillStuff(g, w, h) {
    soft(g, w / 2, h - 1, w, 4, .4);
    A.rrect(g, 4, h - 11, 12, 11, 1, '#9d5535'); A.rect(g, 4, h - 11, 12, 1.5, '#b4684a'); A.rect(g, 4, h - 7, 12, .7, 'rgba(0,0,0,.2)');
    g.fillStyle = '#3f6f45'; for (const [x, hh, ww] of [[10, 18, 5], [5.5, 11, 3.6], [14.5, 12, 3.6]]) { g.beginPath(); g.roundRect(x - ww / 2, h - 11 - hh, ww, hh + 2, 2.5); g.fill(); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x, h - 11 - hh, ww / 2, hh); g.fillStyle = '#3f6f45'; }
    g.fillStyle = '#dfe6ca'; for (let i = 0; i < 14; i++) g.fillRect(4 + (i * 7 % 12), h - 28 + (i * 5 % 18), .7, .7);
    A.ell(g, 12, h - 29, 1.6, 1.2, '#d65a8a');
    // dead beer bottle and a pack of cigarettes
    A.rrect(g, 30, h - 22, 6, 22, 2.4, A.lg(g, 30, 0, 36, 0, ['#2a5a2c', '#5aa05a', '#1d4020'])); A.rect(g, 31.6, h - 29, 2.8, 8, '#2a5a2c'); A.rect(g, 31.4, h - 30, 3.2, 1.4, '#c9b24a'); A.rect(g, 30, h - 14, 6, 6, '#d9d4b8');
    A.rrect(g, 42, h - 7, 11, 7, .8, '#b8332a'); A.rect(g, 42, h - 5, 11, 1.4, '#e8e4d4');
    grainOn(g, 0, 0, w, h, .1, .3);
  }
  function paintBlinds(g, w, h) {
    // venetian blinds raised mostly out of the way, bunched at the top, slats askew
    const r = srand(3);
    A.rect(g, 0, 0, w, 3.2, '#9a968a'); A.rect(g, 0, 0, w, .7, 'rgba(255,255,255,.5)');
    for (let y = 3.2, i = 0; y < h - 4; y += 3, i++) { const tilt = (r() - .5) * 1.1; g.fillStyle = A.lg(g, 0, y, 0, y + 3, ['#e0dccb', '#aaa592']); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + tilt); g.lineTo(w, y + 2.6 + tilt); g.lineTo(0, y + 2.6); g.fill(); A.rect(g, 0, y + 2.4, w, .5, 'rgba(0,0,0,.28)'); }
    g.strokeStyle = '#6a6a62'; g.lineWidth = .5; for (const x of [w * .22, w * .78]) { g.beginPath(); g.moveTo(x, 3); g.lineTo(x, h - 4); g.stroke(); }
    // bent slats at the bottom
    A.poly(g, [w * .5, h - 5, w * .72, h - 1, w * .96, h - 4.6, w * .96, h - 2.6, w * .72, h + 0, w * .5, h - 3], '#d6d2c0'); A.rect(g, 0, h - 5.5, w, 1.6, '#bbb7a4');
    A.blotches(g, 0, 0, w, h, 3, 6, 'rgba(100,80,40,.25)', 3, 9);
    grainOn(g, 0, 0, w, h, .1, .3);
  }
  function paintCurtain(side) {
    return (g, w, h) => {
      const r = srand(side ? 4 : 6);
      // heavy olive-brown drape, vertical folds, with tie-back band and a ragged hem
      for (let i = 0; i < 9; i++) { const x0 = i * w / 9, ww = w / 9 + .8; g.fillStyle = A.lg(g, x0, 0, x0 + ww, 0, ['#4a4a2c', '#8a8250', '#5a5632', '#33341f']); g.fillRect(x0, 0, ww, h); }
      g.fillStyle = A.lg(g, 0, 0, 0, h, ['rgba(0,0,0,.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,.28)']); g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(' + (r() < .5 ? '0,0,0,' : '255,240,180,') + (.05 + r() * .06) + ')'; g.fillRect(r() * w, r() * h, .6, 10 + r() * 50); }
      // sun-faded top (it faces the window) + sooty hem, hooks along the rod
      g.fillStyle = A.lg(g, 0, 0, 0, 50, ['rgba(220,200,130,.28)', 'rgba(220,200,130,0)']); g.fillRect(0, 0, w, 50);
      g.fillStyle = A.lg(g, 0, h - 26, 0, h, ['rgba(40,30,10,0)', 'rgba(40,30,10,.5)']); g.fillRect(0, h - 26, w, 26);
      for (let i = 0; i < 6; i++) { const x = 2 + i * (w - 4) / 5; A.rect(g, x, 0, 1.2, 3.4, '#888'); }
      const ty = h * .58; g.fillStyle = A.lg(g, 0, ty, 0, ty + 6, ['#c7b074', '#7a6430']); g.fillRect(side ? 0 : 0, ty, w, 5); A.rect(g, 0, ty, w, .8, 'rgba(255,255,255,.35)');
      g.beginPath(); g.moveTo(0, h); for (let i = 0; i <= 18; i++) g.lineTo(i * w / 18, h - 1.4 - (i % 2) * 1.6 - r()); g.lineTo(w, h); g.fillStyle = 'rgba(0,0,0,0)'; g.fill();
      grainOn(g, 0, 0, w, h, .12, .3);
    };
  }
  function paintRod(g, w, h) {
    g.fillStyle = A.lg(g, 0, 0, 0, 5, ['#d6c48a', '#6a5a2a']); g.fillRect(8, 1.5, w - 16, 3.2); A.rect(g, 8, 1.5, w - 16, .7, 'rgba(255,255,255,.55)');
    for (const x of [4, w - 4]) { A.ell(g, x, 3, 3.6, 3.6, '#a88b42'); A.ell(g, x - 1, 2, 1.2, 1.2, 'rgba(255,255,255,.6)'); }
    for (const x of [w * .12, w * .88]) A.rect(g, x, 3, 1.2, 5, '#777');
    soft(g, w / 2, 6, w - 10, 3, .3); dustTop(g, 10, 1.5, w - 20, .5);
  }

  function paintSofa(g, w, h) {
    const r = srand(2), fab = ['#5a4a2e', '#7e6a40', '#4a3c24'];
    soft(g, w / 2, h - 3, w + 4, 8, .0);
    // legs (wooden, short, splayed)
    for (const x of [10, w - 10]) { g.fillStyle = A.lg(g, x - 3, 0, x + 3, 0, ['#2a1a10', '#5a3a22', '#2a1a10']); g.beginPath(); g.moveTo(x - 4, h - 9); g.lineTo(x + 4, h - 9); g.lineTo(x + 3, h); g.lineTo(x - 3, h); g.fill(); }
    // body: back rest
    const body = (x, y, ww, hh, rad, c) => { g.beginPath(); g.roundRect(x, y, ww, hh, rad); g.fillStyle = c; g.fill(); };
    body(14, 4, w - 28, 54, [14, 14, 3, 3], A.lg(g, 0, 4, 0, 58, ['#6e5c36', '#4f4129']));
    // three back cushions
    for (let i = 0; i < 3; i++) { const x = 30 + i * (w - 60) / 3; body(x, 8, (w - 60) / 3 - 2, 46, 8, A.lg(g, 0, 8, 0, 54, ['#85704a', '#5e4d30'])); g.fillStyle = A.rg(g, x + (w - 60) / 6, 24, 0, 30, ['rgba(255,225,160,.16)', 'rgba(255,225,160,0)']); g.fillRect(x, 8, (w - 60) / 3, 46); A.line(g, x + 2, 12, x + (w - 60) / 3 - 4, 12, 'rgba(255,235,180,.15)', .8); }
    // seat cushions with seams and a sagging dent on the left (lying spot)
    for (let i = 0; i < 2; i++) { const x = 28 + i * (w - 56) / 2; body(x, 48, (w - 56) / 2 - 1, 24, 6, A.lg(g, 0, 48, 0, 72, ['#8a744b', '#5c4a2e'])); A.rect(g, x + 4, 48.6, (w - 56) / 2 - 9, 1, 'rgba(255,235,180,.3)'); }
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(70, 56, 34, 5, 0, 0, P2); g.fill();
    // armrests (rolled, worn lighter on top)
    for (const left of [true, false]) {
      const x = left ? 0 : w - 30; body(x, 26, 30, 56, [12, 12, 3, 3], A.lg(g, x, 0, x + 30, 0, left ? ['#5c4a2c', '#8a7448', '#4d3e26'] : ['#4d3e26', '#8a7448', '#5c4a2c']));
      body(x + 2, 24, 26, 12, 7, '#8f784a'); A.rect(g, x + 5, 25, 20, 1.2, 'rgba(255,240,190,.35)'); A.blotches(g, x + 2, 24, 26, 12, left ? 4 : 5, 3, 'rgba(40,25,5,.35)', 3, 7);
    }
    // base skirt and front edge
    body(4, h - 22, w - 8, 16, 3, A.lg(g, 0, h - 22, 0, h - 6, ['#4d3d25', '#2f2517'])); A.rect(g, 6, h - 22, w - 12, 1, 'rgba(255,235,180,.25)');
    // plaid blanket in a heap on the right half + hanging over the arm
    g.save(); g.beginPath(); g.moveTo(w - 100, 56); g.bezierCurveTo(w - 88, 38, w - 62, 34, w - 40, 44); g.bezierCurveTo(w - 30, 30, w - 20, 40, w - 8, 80); g.lineTo(w - 90, 82); g.bezierCurveTo(w - 108, 76, w - 108, 66, w - 100, 56); g.closePath(); g.clip();
    g.fillStyle = '#7b2a2a'; g.fillRect(w - 112, 30, 112, 56);
    g.fillStyle = 'rgba(20,10,10,.55)'; for (let x = w - 112; x < w; x += 8) g.fillRect(x, 30, 3.4, 56); for (let y = 30; y < 86; y += 8) g.fillRect(w - 112, y, 112, 3.4);
    g.fillStyle = 'rgba(230,220,190,.3)'; for (let x = w - 108; x < w; x += 16) g.fillRect(x, 30, .8, 56);
    for (const [fx, fy, fr] of [[w - 84, 52, 12], [w - 56, 44, 14], [w - 28, 56, 12]]) { g.fillStyle = A.rg(g, fx, fy, 0, fr, ['rgba(255,170,150,.22)', 'rgba(0,0,0,.25)']); g.fillRect(fx - fr, fy - fr, fr * 2, fr * 2); }
    g.fillStyle = A.lg(g, 0, 60, 0, 86, ['rgba(0,0,0,0)', 'rgba(0,0,0,.4)']); g.fillRect(w - 112, 60, 112, 28); g.restore();
    // pillows
    const pillow = (x, y, ww, hh, rot, c1, c2, stripe) => { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.moveTo(-ww / 2, -hh / 2 + 3); g.quadraticCurveTo(0, -hh / 2 - 2, ww / 2, -hh / 2 + 3); g.quadraticCurveTo(ww / 2 + 3, 0, ww / 2, hh / 2 - 3); g.quadraticCurveTo(0, hh / 2 + 2, -ww / 2, hh / 2 - 3); g.quadraticCurveTo(-ww / 2 - 3, 0, -ww / 2, -hh / 2 + 3); g.closePath(); g.fillStyle = A.lg(g, 0, -hh / 2, 0, hh / 2, [c1, c2]); g.fill(); g.save(); g.clip(); if (stripe) { g.fillStyle = 'rgba(255,255,255,.3)'; for (let k = -ww / 2; k < ww / 2; k += 6) g.fillRect(k, -hh / 2, 2.6, hh); } g.fillStyle = A.rg(g, 0, 0, 0, ww / 2, ['rgba(255,255,255,.14)', 'rgba(0,0,0,.2)']); g.fillRect(-ww / 2, -hh / 2, ww, hh); g.restore(); A.line(g, -ww / 2 + 3, 0, ww / 2 - 3, 0, 'rgba(0,0,0,.18)', .6); g.restore(); };
    pillow(48, 40, 36, 28, -.18, '#b3862e', '#7c5a1a', false); pillow(w - 50, 36, 34, 26, .22, '#7e8f94', '#4d5d62', true); pillow(94, 44, 26, 22, .1, '#7a3a3a', '#4c2020', false);
    // crumbs, chip-bag, stains and grime
    g.fillStyle = 'rgba(230,200,130,.8)'; for (let i = 0; i < 46; i++) g.fillRect(36 + r() * 140, 52 + r() * 18, 1 + r(), .9);
    A.rrect(g, 128, 46, 14, 8, 1, '#c63a2a'); A.rect(g, 128, 46, 14, 1.3, '#e4e0c8'); A.poly(g, [130, 54, 134, 56, 139, 54], '#8a2218');
    A.blotches(g, 14, 4, w - 28, h - 10, 9, 14, 'rgba(25,12,0,.3)', 4, 12); A.streaks(g, 14, 48, w - 28, 24, 11, 6, 'rgba(25,12,0,.2)');
    grainOn(g, 0, 0, w, h, .16, .25);
    // upholstery weave
    g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = .1; g.fillStyle = '#000'; for (let y = 6; y < h; y += 1.7) g.fillRect(0, y, w, .45); g.restore();
  }
  function paintFloorLamp(g, w, h) {
    soft(g, w / 2, h - 1.5, 30, 7, .6);
    g.fillStyle = A.lg(g, 0, h - 4, 0, h, ['#8a8a82', '#3a3a38']); g.beginPath(); g.ellipse(w / 2, h - 2.4, 14, 3.2, 0, 0, P2); g.fill(); A.rect(g, w / 2 - 14, h - 4, 28, .8, 'rgba(255,255,255,.2)');
    g.fillStyle = A.lg(g, w / 2 - 1.5, 0, w / 2 + 1.5, 0, ['#5a5230', '#e6d48a', '#4a4222']); g.fillRect(w / 2 - 1.5, 38, 3, h - 42);
    for (const y of [70, 110]) { A.ell(g, w / 2, y, 2.6, 1.6, '#a8944a'); }
    // fabric shade (orange, scorched at the top, stained)
    const sy = 2, sh = 40, tw = 22, bw = 42;
    g.fillStyle = A.lg(g, w / 2 - bw / 2, 0, w / 2 + bw / 2, 0, ['#9a4d1c', '#e49648', '#f2b468', '#e49648', '#8a4418']);
    g.beginPath(); g.moveTo(w / 2 - tw / 2, sy); g.lineTo(w / 2 + tw / 2, sy); g.lineTo(w / 2 + bw / 2, sy + sh); g.lineTo(w / 2 - bw / 2, sy + sh); g.closePath(); g.fill();
    A.ell(g, w / 2, sy, tw / 2, 2.4, '#7a3a14'); A.ell(g, w / 2, sy + sh, bw / 2, 4, 'rgba(255,200,120,.35)'); A.ell(g, w / 2, sy + sh, bw / 2 - 1, 3, '#ffd89c');
    g.strokeStyle = 'rgba(120,50,10,.25)'; g.lineWidth = .5; for (let i = 0; i < 12; i++) { const x = -1 + i / 11 * 2; g.beginPath(); g.moveTo(w / 2 + x * tw / 2, sy); g.lineTo(w / 2 + x * bw / 2, sy + sh); g.stroke(); }
    soft(g, w / 2 + 6, sy + 12, 14, 12, .5, 'rgba(60,20,0,');
    grainOn(g, 0, 0, w, h, .1, .3);
  }
  function paintCoffeeTable(g, w, h) {
    soft(g, w / 2, h - 1, w + 6, 6, .45);
    // top slab with ring stains and cigarette burns, thick edge
    g.fillStyle = A.lg(g, 0, 0, 0, 5, ['#6d4a2e', '#3b2616']); g.fillRect(0, 0, w, 6); A.rect(g, 0, 0, w, .9, 'rgba(255,230,190,.4)'); A.rect(g, 0, 5, w, 1, 'rgba(0,0,0,.45)');
    for (let i = 0; i < 24; i++) { g.strokeStyle = 'rgba(20,10,4,.25)'; g.lineWidth = .4; const x = 3 + i * 4.4; g.beginPath(); g.moveTo(x, 0.4); g.lineTo(x + 2, 5.6); g.stroke(); }
    // apron + legs (turned legs), lower shelf with magazines and a controller
    A.rect(g, 6, 6, w - 12, 5, '#3a2616'); A.rect(g, 6, 6, w - 12, .8, 'rgba(0,0,0,.4)');
    for (const x of [4, w - 12]) { g.fillStyle = A.lg(g, x, 0, x + 8, 0, ['#2a1a0e', '#6d4a2e', '#2a1a0e']); g.beginPath(); g.moveTo(x + 1, 11); g.lineTo(x + 7, 11); g.lineTo(x + 6, 20); g.lineTo(x + 7.4, 24); g.lineTo(x + 6, h - 2); g.lineTo(x + 2, h - 2); g.lineTo(x + .6, 24); g.lineTo(x + 2, 20); g.closePath(); g.fill(); }
    A.rect(g, 10, h - 14, w - 20, 2.6, '#4a3220'); A.rect(g, 10, h - 14, w - 20, .6, 'rgba(255,230,190,.3)');
    const mags = [['#a43a3a', 14, 30], ['#d6c65a', 20, 26], ['#3f6aa4', 24, 34], ['#e8e4d0', 16, 28]];
    mags.forEach(([c, x, ww], i) => { g.save(); g.translate(x + 12, h - 14 - i * 1.3); g.rotate((i - 1.5) * .015); A.rect(g, -ww / 2 + 8, -1.4, ww, 1.4, c); g.restore(); });
    A.rrect(g, w - 38, h - 18, 14, 4, 2, '#1c1c20'); A.ell(g, w - 34, h - 18.5, 1.2, .8, '#b33'); A.ell(g, w - 28, h - 18.5, 1.2, .8, '#38c');
    A.blotches(g, 6, 11, w - 12, h - 14, 5, 6, 'rgba(0,0,0,.3)', 4, 10);
    grainOn(g, 0, 0, w, h, .1, .3);
  }
  function paintPizza(g, w, h) {
    const r = srand(20);
    soft(g, w / 2, h - 1, w + 2, 4, .5);
    const stack = [['#c9a064', 31, 3.4, 0], ['#d6b072', 34, 3.2, .03], ['#bf9558', 33, 3.2, -.02]];
    let y = h - 2;
    stack.forEach(([c, ww, hh, rot], i) => { g.save(); g.translate(w / 2 - 3 + (i - 1) * 1.5, y - hh / 2); g.rotate(rot); g.fillStyle = A.lg(g, 0, -hh / 2, 0, hh / 2, [c, '#8a6a3a']); g.fillRect(-ww / 2, -hh / 2, ww, hh); A.rect(g, -ww / 2, -hh / 2, ww, .6, 'rgba(255,240,200,.45)'); A.rect(g, -ww / 2, hh / 2 - .6, ww, .6, 'rgba(0,0,0,.3)'); g.fillStyle = 'rgba(100,30,10,.6)'; g.fillRect(-ww / 2 + 3, -hh / 2 + .8, 8, 1.4); g.restore(); y -= hh - .2; });
    // open top box with a half-eaten pizza and a bitten crust, grease stains
    const ty = y; g.save(); g.translate(w / 2 - 3, ty); A.poly(g, [-14, 0, 14, 0, 15, -2.4, -15, -2.4], '#d1ac6e'); A.poly(g, [-15, -2.4, 15, -2.4, 20, -12, -10, -13], '#b8924f'); A.poly(g, [-15, -2.4, -10, -13, -9.4, -12.4, -14.4, -2.4], 'rgba(0,0,0,.2)');
    g.fillStyle = '#e1b862'; g.beginPath(); g.moveTo(-11, -2.6); g.quadraticCurveTo(-6, -5.4, 8, -4.6); g.lineTo(11, -2.6); g.closePath(); g.fill(); g.fillStyle = '#c84a30'; for (let i = 0; i < 5; i++) g.fillRect(-8 + i * 3.6, -4.2, 1.6, .8);
    g.fillStyle = 'rgba(170,60,40,.8)'; g.font = 'bold 3.2px Arial,sans-serif'; g.fillText('ПИЦЦА', -7, -9); g.restore();
    A.blotches(g, 0, 0, w, h, 3, 4, 'rgba(110,60,10,.35)', 2, 5);
    grainOn(g, 0, 0, w, h, .1, .3);
  }
  function paintCans(g, w, h) {
    const r = srand(4);
    soft(g, w / 2, h - 1, w + 2, 4, .5);
    const can = (x, y, rot, c, crushed) => { g.save(); g.translate(x, y); g.rotate(rot); const ch = crushed ? 8 : 12; g.fillStyle = A.lg(g, -2.8, 0, 2.8, 0, [A.shade(A.hex(c), .55), c, A.shade(A.hex(c), 1.25), A.shade(A.hex(c), .5)]); g.fillRect(-2.8, -ch, 5.6, ch); A.ell(g, 0, -ch, 2.8, .8, '#cfd0cc'); A.ell(g, 0, 0, 2.8, .7, '#555'); A.rect(g, -2.8, -ch * .55, 5.6, ch * .22, 'rgba(255,255,255,.7)'); if (crushed) { A.poly(g, [-2.8, -4, 2.8, -6, 2.8, -3, -2.8, -1], 'rgba(0,0,0,.35)'); } g.restore(); };
    can(6, h - 1, 0, '#2d6a38', false); can(12, h - 1, .04, '#b3862a', false); can(18.5, h - 1, -.05, '#2d6a38', true); can(25, h - 1, 0, '#a6a8a0', false);
    g.save(); g.translate(31, h - 3); g.rotate(-1.5); can(0, 0, 0, '#2d6a38', false); g.restore();
    soft(g, 33, h - 1, 12, 2.2, .5, 'rgba(120,80,10,');
    grainOn(g, 0, 0, w, h, .1, .3);
  }
  const shishaState = { img: null };
  function paintShisha(g, w, h) {
    const cx = w / 2 - 1;
    soft(g, w / 2, h - 1, 18, 4, .55);
    // glass base (blue tinted, murky water inside), brass stem, tray, bowl with foil
    g.beginPath(); g.moveTo(cx - 4, h - 26); g.bezierCurveTo(cx - 11, h - 20, cx - 11, h - 2, cx - 4, h - 1); g.lineTo(cx + 4, h - 1); g.bezierCurveTo(cx + 11, h - 2, cx + 11, h - 20, cx + 4, h - 26); g.closePath();
    g.fillStyle = A.lg(g, cx - 10, 0, cx + 10, 0, ['rgba(50,95,150,.85)', 'rgba(150,200,240,.8)', 'rgba(40,80,130,.9)']); g.fill();
    g.save(); g.clip(); g.fillStyle = 'rgba(140,110,50,.55)'; g.fillRect(cx - 12, h - 14, 24, 14); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(cx - 7, h - 24, 1.6, 20); g.restore();
    g.fillStyle = A.lg(g, cx - 1.6, 0, cx + 1.6, 0, ['#6a5420', '#e8d086', '#5a4418']); g.fillRect(cx - 1.6, 12, 3.2, h - 36);
    for (const y of [20, 34]) { A.ell(g, cx, y, 3.4, 1.2, '#b89a42'); }
    A.ell(g, cx, h - 27, 9, 2, '#c9ad5a'); A.ell(g, cx, h - 27.5, 9, 2, '#e9d58a'); A.ell(g, cx, h - 27.8, 6.6, 1.2, '#8a7230');
    g.fillStyle = A.lg(g, cx - 4, 0, cx + 4, 0, ['#6c3c28', '#b6724c', '#5a2f1e']); g.beginPath(); g.moveTo(cx - 5, 3); g.lineTo(cx + 5, 3); g.lineTo(cx + 3, 13); g.lineTo(cx - 3, 13); g.fill();
    A.ell(g, cx, 3, 5, 1.4, '#d4d6d8'); for (let i = 0; i < 6; i++) A.rect(g, cx - 4 + i * 1.5, 2, .5, .6, '#555'); A.ell(g, cx - 1.5, 2.6, .9, .6, '#ff7a28');
    // hose: dark wine red, coiled onto the table, mouthpiece
    g.strokeStyle = '#4a1218'; g.lineWidth = 1.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + 6, h - 20); g.bezierCurveTo(cx + 22, h - 22, cx + 20, h - 3, cx + 12, h - 3); g.bezierCurveTo(cx + 3, h - 3, cx + 3, h - 8, cx - 4, h - 4); g.stroke();
    g.strokeStyle = 'rgba(255,200,200,.25)'; g.lineWidth = .4; g.stroke(); A.rrect(g, cx - 9, h - 6, 6, 3, 1.4, '#c9c0a8');
    grainOn(g, 0, 0, w, h, .08, .3);
  }
  function shishaDyn(g, t, S) {            // glowing coal + curling smoke
    A.glow(g, 10.5, 4, 6, 'rgba(255,120,30,.45)');
    for (let i = 0; i < 6; i++) { const k = (t * .22 + i / 6) % 1, x = 10 + Math.sin(t * 1.4 + i * 1.7) * (2 + k * 7), y = 3 - k * 30; g.fillStyle = 'rgba(225,225,230,' + (.17 * (1 - k)) + ')'; g.beginPath(); g.arc(x, y, 2 + k * 5, 0, P2); g.fill(); }
  }
  function paintDesk(g, w, h) {         // ashtray + remote + phone + cables
    soft(g, w / 2, h - 1, w + 2, 4, .5);
    A.ell(g, 9, h - 2.4, 8.6, 2.4, '#2e3c40'); A.ell(g, 9, h - 3.4, 8.6, 2.2, '#9fb7b9'); A.ell(g, 9, h - 3.8, 6.6, 1.6, '#25383c');
    g.fillStyle = '#6c5a44'; for (let i = 0; i < 12; i++) { const a = i * 2.2; g.fillRect(5 + (i * 3.1 % 8), h - 7.4 + Math.sin(a) * .9, 1.6, 1); } g.fillStyle = '#e8e4d0'; for (let i = 0; i < 9; i++) g.fillRect(4 + (i * 2.7 % 9), h - 6.6 - (i % 3) * .6, 1.5, .9);
    g.fillStyle = '#d9d4bc'; g.fillRect(14, h - 9.4, 4, .8);
    g.save(); g.translate(22, h - 2); g.rotate(-.06); A.rrect(g, 0, -2, 14, 2, .6, '#1b1b1f'); A.rect(g, 1, -2, 12, .4, 'rgba(255,255,255,.3)'); for (let i = 0; i < 5; i++) A.rect(g, 2 + i * 2, -1.5, 1.2, .7, ['#c22', '#444', '#4a8', '#444', '#cc3'][i]); g.restore();
    g.strokeStyle = '#111'; g.lineWidth = .8; g.beginPath(); g.moveTo(34, h - 1); g.bezierCurveTo(30, h - 4, 26, h - 1, 24, h - 3); g.stroke();
    grainOn(g, 0, 0, w, h, .08, .3);
  }
  const ashSmoke = (g, t) => { for (let i = 0; i < 3; i++) { const k = (t * .3 + i / 3) % 1; g.fillStyle = 'rgba(210,210,215,' + (.2 * (1 - k)) + ')'; g.beginPath(); g.arc(14 + Math.sin(t * 2 + i * 2) * 2 * k, h0 - k * 22, 1 + k * 3, 0, P2); g.fill(); } };
  const h0 = 12;

  function paintTvUnit(g, w, h) {
    soft(g, w / 2, h - 1, w + 6, 7, .5);
    g.fillStyle = A.lg(g, 0, 0, w, 0, ['#3b2517', '#5b3b24', '#3b2517']); g.fillRect(0, 0, w, h - 6); A.rect(g, 0, 0, w, 1.4, 'rgba(255,230,190,.35)'); A.rect(g, 0, 4, w, .8, 'rgba(0,0,0,.4)');
    g.fillStyle = '#1e140c'; g.fillRect(3, h - 7, w - 6, 7); A.rect(g, 0, h - 8, w, 1, 'rgba(0,0,0,.4)');
    // open console bay (left) with a dusty console + blinking LED, closed doors (right)
    A.rect(g, 6, 6, 52, 30, '#120c08'); A.rect(g, 6, 6, 52, 30, 'rgba(0,0,0,.2)'); A.rect(g, 6, 35, 52, 1, 'rgba(255,230,190,.2)');
    A.rrect(g, 10, 22, 30, 12, 1.2, '#26262b'); A.rect(g, 10, 22, 30, .8, 'rgba(255,255,255,.2)'); dustTop(g, 10, 22, 30, .6); A.rrect(g, 14, 28, 14, 1.8, .8, '#111'); A.ell(g, 36, 28, .9, .9, '#2a8a3a');
    A.rrect(g, 44, 26, 11, 8, 1, '#3d3d44'); dustTop(g, 44, 26, 11, .5);
    g.strokeStyle = '#0a0a0c'; g.lineWidth = 1; g.beginPath(); g.moveTo(12, 34); g.bezierCurveTo(14, 38, 20, 33, 30, 36); g.stroke(); g.strokeStyle = '#2b2b30'; g.beginPath(); g.moveTo(40, 34); g.bezierCurveTo(46, 38, 50, 31, 56, 36); g.stroke();
    for (const x of [62, 62 + 28.5]) { A.rect(g, x, 6, 27.5, 30, '#523521'); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = .7; g.strokeRect(x + .4, 6.4, 26.7, 29.2); g.strokeStyle = 'rgba(255,230,190,.14)'; g.strokeRect(x + 3, 9, 21.5, 24); }
    A.rrect(g, 84, 18, 1.8, 7, .8, '#b9b49a'); A.rrect(g, 90, 18, 1.8, 7, .8, '#b9b49a');
    A.blotches(g, 0, 0, w, h, 4, 8, 'rgba(0,0,0,.25)', 4, 10); dustTop(g, 0, 0, w, .35);
    grainOn(g, 0, 0, w, h, .1, .3);
  }
  function paintTv(g, w, h) {
    const sw = 94, sh = 54, sx = 3, sy = 3;
    soft(g, w / 2, h - 1, 34, 3, .5);
    g.fillStyle = A.lg(g, 0, sy - 2, 0, sh + 6, ['#222226', '#101012']); g.beginPath(); g.roundRect(0, 0, w, sh + 8, 2.4); g.fill(); A.rect(g, 1, 0, w - 2, .7, 'rgba(255,255,255,.28)');
    g.fillStyle = A.lg(g, 0, sy, sw, sy + sh, ['#0a0c10', '#14181e', '#07090c']); g.fillRect(sx, sy, sw, sh);
    g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 38, sy); g.lineTo(sx, sy + 24); g.fill(); g.fillStyle = 'rgba(255,255,255,.04)'; g.beginPath(); g.moveTo(sx + sw, sy + sh); g.lineTo(sx + sw - 32, sy + sh); g.lineTo(sx + sw, sy + sh - 20); g.fill();
    // fingerprints + dust on the dead screen
    for (let i = 0; i < 6; i++) soft(g, sx + 14 + i * 14, sy + 20 + (i % 3) * 8, 6, 8, .06, 'rgba(255,255,255,'); A.streaks(g, sx, sy, sw, sh, 3, 5, 'rgba(255,255,255,.04)');
    A.rect(g, 0, sh + 3.6, w, 4.2, '#18181b'); A.rrect(g, w - 12, sh + 4.8, 4, 1.4, .6, '#444'); A.ell(g, w - 16, sh + 5.5, .8, .8, '#e33');
    // stand: a trapezoid neck + base plate
    A.poly(g, [w / 2 - 6, sh + 8, w / 2 + 6, sh + 8, w / 2 + 14, h - 1.4, w / 2 - 14, h - 1.4], '#16161a'); A.rect(g, w / 2 - 22, h - 2.4, 44, 2.4, '#0f0f12'); A.rect(g, w / 2 - 22, h - 2.4, 44, .5, 'rgba(255,255,255,.15)');
    dustTop(g, 0, 0, w, .4);
    grainOn(g, 0, 0, w, h, .08, .3);
  }
  function tvDyn(g, t, S) {               // self-lit screen content (post sprite)
    const w = 94, h = 54, fl = .86 + Math.sin(t * 31) * .06 + Math.sin(t * 7.3) * .06;
    g.save(); g.beginPath(); g.rect(0, 0, w, h); g.clip(); g.globalAlpha = fl;
    g.fillStyle = A.lg(g, 0, 0, 0, h, ['#3c78b8', '#2a5a96']); g.fillRect(0, 0, w, h);
    // a football match on a very green pitch, ball + players, ticker
    g.fillStyle = A.lg(g, 0, 10, 0, h, ['#2f8f48', '#1e6a34']); g.fillRect(0, 12, w, h - 12);
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = .8; g.strokeRect(5, 18, w - 10, h - 24); g.beginPath(); g.moveTo(w / 2, 18); g.lineTo(w / 2, h - 6); g.stroke(); g.beginPath(); g.arc(w / 2, 36, 7, 0, P2); g.stroke();
    const bx = w / 2 + Math.sin(t * .9) * 26, by = 34 + Math.sin(t * 1.7) * 6;
    for (let i = 0; i < 8; i++) { const px = 12 + i * 10.5 + Math.sin(t * 1.1 + i * 2) * 5, py = 24 + (i % 4) * 7 + Math.cos(t * .9 + i) * 3; g.fillStyle = i < 4 ? '#e8c22a' : '#d33a3a'; g.fillRect(px, py, 2.2, 3.6); g.fillStyle = '#e4c0a0'; g.fillRect(px + .3, py - 1.4, 1.6, 1.4); }
    A.ell(g, bx, by, 1.5, 1.5, '#fff');
    g.fillStyle = 'rgba(10,20,50,.85)'; g.fillRect(0, 0, w, 9); g.fillStyle = '#f2f2f2'; g.font = 'bold 4.4px Arial,sans-serif'; g.fillText('ЛИГА МОЛОДЦОВ   2 : 2   87\'', 4, 6.2);
    g.fillStyle = 'rgba(200,20,20,.9)'; g.fillRect(0, h - 6, w, 6); g.fillStyle = '#fff'; const off = (t * 22) % 160; g.fillText('СРОЧНО: ХОЗЯИН КВАРТИРЫ ВЫЕХАЛ ЗА ПЛАТОЙ  •  ПОГОДА: ПЛОХО  •  ', 94 - off, h - 1.8);
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,.14)'; for (let y = 0; y < h; y += 1.4) g.fillRect(0, y, w, .55);
    g.fillStyle = 'rgba(255,255,255,' + (.06 + Math.max(0, Math.sin(t * 1.3 - 2) * .1)) + ')'; g.fillRect(0, (t * 37) % (h + 12) - 6, w, 5);
    g.restore();
  }
  function paintSpeaker(g, w, h) {
    soft(g, w / 2, h - 1, w + 4, 5, .5);
    A.rect(g, 3, h - 22, 2, 22, '#2a2a2c'); A.rect(g, w - 5, h - 22, 2, 22, '#2a2a2c'); A.rect(g, 0, h - 2.6, w, 2.6, '#222');
    g.fillStyle = A.lg(g, 0, 0, w, 0, ['#17171a', '#2a2a2f', '#141417']); g.beginPath(); g.roundRect(1, 0, w - 2, h - 22, 2); g.fill(); A.rect(g, 1, 0, w - 2, .8, 'rgba(255,255,255,.25)');
    A.ell(g, w / 2, 12, 6, 6, '#0b0b0d'); A.ell(g, w / 2, 12, 4.4, 4.4, '#2b2b30'); A.ell(g, w / 2, 12, 1.6, 1.6, '#111'); g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = .4; g.beginPath(); g.arc(w / 2, 12, 5.8, 0, P2); g.stroke();
    A.ell(g, w / 2, 24, 3, 3, '#0b0b0d'); A.ell(g, w / 2, 24, 2, 2, '#333');
    dustTop(g, 1, 0, w - 2, .5); A.ell(g, w - 5, h - 26, .8, .8, '#2f8a3a');
    g.strokeStyle = '#0a0a0c'; g.lineWidth = .9; g.beginPath(); g.moveTo(w - 4, h - 3); g.bezierCurveTo(w + 4, h - 2, w - 2, h + 1, w, h); g.stroke();
    grainOn(g, 0, 0, w, h, .08, .3);
  }
  function paintShelves(g, w, h) {
    const r = srand(12), tiers = [0, 46, 92, 138, 184];
    soft(g, w / 2, h - 1, w + 4, 7, .5);
    g.fillStyle = A.lg(g, 0, 0, w, 0, ['#3b2517', '#5b3b24', '#3b2517']); g.fillRect(0, 0, w, h - 4); g.fillStyle = '#150e08'; g.fillRect(3, 3, w - 6, h - 10);
    A.rect(g, 0, 0, w, 1.4, 'rgba(255,230,190,.3)'); A.rect(g, 0, h - 6, w, 2, '#241609');
    for (let i = 0; i < 5; i++) { const y = 3 + i * 36 + 3; if (i) { A.rect(g, 2, y + 33, w - 4, 2.6, '#53361f'); A.rect(g, 2, y + 33, w - 4, .6, 'rgba(255,230,190,.28)'); } }
    const shelfY = i => 3 + i * 36 + 36;     // y of the shelf board top for tier i (items sit here)
    const bookRow = (x0, x1, base, seed) => { const rr = srand(seed); let x = x0; while (x < x1 - 3) { const bw = 2.2 + rr() * 3.4, bh = 18 + rr() * 11, lean = rr() < .12 ? (rr() - .5) * .5 : 0; const c = ['#7a2f2a', '#3b4f6e', '#c9b872', '#4a6a4a', '#a0522d', '#d8d0bc', '#2f3138', '#8e6a3a'][rr() * 8 | 0]; g.save(); g.translate(x + bw / 2, base); g.rotate(lean); g.fillStyle = A.lg(g, -bw / 2, 0, bw / 2, 0, [A.shade(A.hex(c), .8), c, A.shade(A.hex(c), .65)]); g.fillRect(-bw / 2, -bh, bw, bh); A.rect(g, -bw / 2, -bh + 2, bw, .7, 'rgba(255,255,255,.35)'); A.rect(g, -bw / 2, -bh * .5, bw, .5, 'rgba(255,255,255,.2)'); dustTop(g, -bw / 2, -bh, bw, .6); g.restore(); x += bw + .2 + (lean ? 3 : 0); } };
    // tier 0 (top): books + a small statue
    bookRow(5, 52, shelfY(0) - 2.4 + 0, 3);
    // tier 1: figurines
    const fy1 = shelfY(1) - 2.4;
    A.rrect(g, 8, fy1 - 14, 9, 14, 3, '#b8423a'); A.ell(g, 12.5, fy1 - 14, 3.6, 3.6, '#e8c9a0'); A.rect(g, 9, fy1 - 8, 7, 2, '#e8d070'); dustTop(g, 8, fy1 - 14, 9, .6);       // matryoshka
    A.rrect(g, 22, fy1 - 8, 6, 8, 3, '#3a3a40'); A.poly(g, [22, fy1 - 8, 22.8, fy1 - 12, 24, fy1 - 8], '#3a3a40'); A.poly(g, [26, fy1 - 8, 27.2, fy1 - 12, 28, fy1 - 8], '#3a3a40'); A.ell(g, 24, fy1 - 8, 3.2, 1.4, '#3a3a40');   // cat statue
    A.rect(g, 40, fy1 - 18, 20, 18, '#d8d2bc'); A.rect(g, 41.4, fy1 - 16.6, 17.2, 15.2, '#5a7a92'); A.ell(g, 50, fy1 - 10, 4, 4, '#e0c8a0'); A.rect(g, 40, fy1 - 18, 20, .8, 'rgba(255,255,255,.5)'); dustTop(g, 40, fy1 - 18, 20, .6);     // framed photo
    // "Bambu-printed" things: benchy boat + gradient vase
    g.save(); g.translate(64, fy1); A.poly(g, [0, -3, 14, -3, 12, 0, 2, 0], '#e8742a'); A.rect(g, 5, -8, 5, 5, '#f4f0e0'); A.rect(g, 6.6, -13, 1.6, 5, '#c9462e'); A.rect(g, 3, -5, 2, 2, '#2a6ac0'); A.rect(g, 0, -3.2, 14, .5, 'rgba(0,0,0,.2)'); for (let y = -13; y < 0; y += 1) A.rect(g, 0, y, 14, .2, 'rgba(0,0,0,.08)'); g.restore();
    g.save(); g.translate(78, fy1); g.fillStyle = A.lg(g, 0, -20, 0, 0, ['#d646a8', '#6a46d6', '#2ac0d6']); g.beginPath(); g.moveTo(1, 0); g.bezierCurveTo(-2, -8, 8, -10, 3, -20); g.lineTo(9, -20); g.bezierCurveTo(4, -10, 14, -8, 11, 0); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.16)'; g.lineWidth = .3; for (let y = -19; y < 0; y += 1.1) { g.beginPath(); g.moveTo(1, y); g.lineTo(11, y); g.stroke(); } g.restore();
    // tier 2: radio, jar of coins, dead plant
    const fy2 = shelfY(2) - 2.4;
    A.rrect(g, 6, fy2 - 20, 30, 20, 2, '#6a5a3a'); A.rect(g, 8, fy2 - 17, 17, 14, '#3a3224'); for (let i = 0; i < 6; i++) A.rect(g, 8, fy2 - 17 + i * 2.4, 17, .5, 'rgba(0,0,0,.4)'); A.ell(g, 30, fy2 - 13, 3, 3, '#cfc9b2'); A.ell(g, 30, fy2 - 6, 2, 2, '#cfc9b2'); A.rect(g, 6, fy2 - 20, 30, .8, 'rgba(255,255,255,.3)'); A.line(g, 36, fy2 - 20, 46, fy2 - 38, '#aaa', .5); dustTop(g, 6, fy2 - 20, 30, .7);
    g.fillStyle = 'rgba(200,215,225,.45)'; g.beginPath(); g.roundRect(48, fy2 - 16, 13, 16, 2); g.fill(); g.fillStyle = '#c8a832'; for (let i = 0; i < 9; i++) A.ell(g, 51 + (i * 3) % 8, fy2 - 2 - (i % 3) * 1.8, 1.6, .6, '#c8a832'); A.rect(g, 48, fy2 - 17.4, 13, 1.6, '#8a7a55');
    A.rrect(g, 68, fy2 - 9, 11, 9, 1.4, '#9a5a3a'); g.strokeStyle = '#6a5a30'; g.lineWidth = .7; for (const [dx, dy] of [[-4, -16], [0, -22], [4, -14], [7, -18]]) { g.beginPath(); g.moveTo(73.5, fy2 - 9); g.lineTo(73.5 + dx, fy2 - 9 + dy); g.stroke(); A.ell(g, 73.5 + dx, fy2 - 9 + dy, 1.4, .9, '#9a8a40'); }
    // tier 3: mixed books piled flat + vinyl + a trophy
    const fy3 = shelfY(3) - 2.4;
    bookRow(5, 40, fy3, 21); for (let i = 0; i < 4; i++) { A.rect(g, 44, fy3 - 3 - i * 3.4, 26 - i * 2, 3.2, ['#5a6a8a', '#a8483a', '#d8d0b8', '#4a6a4a'][i]); A.rect(g, 44, fy3 - 3 - i * 3.4, 26 - i * 2, .6, 'rgba(255,255,255,.4)'); dustTop(g, 44, fy3 - 3 - i * 3.4, 26 - i * 2, .5); }
    A.ell(g, 78, fy3 - 2, 5, 1.6, '#c8a832'); A.rect(g, 77, fy3 - 9, 2, 7, '#c8a832'); A.poly(g, [72, fy3 - 17, 84, fy3 - 17, 82, fy3 - 9, 74, fy3 - 9], '#d8bc42'); A.rect(g, 72, fy3 - 17, 12, .6, 'rgba(255,255,255,.6)');
    // tier 4 (bottom): boxes, tangled cables, an old VHS stack
    const fy4 = shelfY(4) - 2.4 + 3;
    for (let i = 0; i < 6; i++) { A.rect(g, 6 + i * 4.6, fy4 - 18, 4.2, 18, ['#222', '#2a2a30', '#1a1a1e'][i % 3]); A.rect(g, 7 + i * 4.6, fy4 - 14, 2.2, 3, '#d8d0b8'); }
    cardboardMini(g, 40, fy4 - 20, 24, 20); g.strokeStyle = '#111'; g.lineWidth = 1; g.beginPath(); g.moveTo(66, fy4); g.bezierCurveTo(70, fy4 - 10, 74, fy4 - 2, 80, fy4 - 6); g.bezierCurveTo(84, fy4 - 9, 76, fy4 - 13, 72, fy4); g.stroke();
    // cobwebs in corners + dust veil
    g.strokeStyle = 'rgba(230,230,220,.35)'; g.lineWidth = .3; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(w - 3, 3); g.lineTo(w - 3 - i * 4, 3 + 14); g.stroke(); } g.beginPath(); g.moveTo(w - 3, 3); g.quadraticCurveTo(w - 12, 9, w - 3 - 18, 17); g.stroke(); g.beginPath(); g.moveTo(w - 3, 3); g.quadraticCurveTo(w - 8, 14, w - 3, 24); g.stroke();
    g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = A.lg(g, 0, 0, 0, h, ['rgba(190,180,160,.18)', 'rgba(190,180,160,0)']); g.fillRect(0, 0, w, h); g.restore();
    grainOn(g, 0, 0, w, h, .12, .3);
  }
  function cardboardMini(g, x, y, w, h) { g.fillStyle = A.lg(g, x, y, x + w, y + h, ['#b08d60', '#8a6a42']); g.fillRect(x, y, w, h); A.rect(g, x, y, w, .8, 'rgba(255,240,200,.4)'); A.rect(g, x + w / 2 - 2, y, 4, h, 'rgba(214,190,128,.6)'); }
  function paintLaundry(g, w, h) {
    const r = srand(30);
    soft(g, w / 2, h - 1, w + 6, 8, .6);
    // wicker basket
    g.fillStyle = A.lg(g, 0, h - 24, 0, h, ['#8c6a3a', '#5c4224']); g.beginPath(); g.moveTo(8, h - 24); g.lineTo(w - 8, h - 24); g.lineTo(w - 12, h - 1); g.lineTo(12, h - 1); g.closePath(); g.fill();
    g.save(); g.clip(); g.strokeStyle = 'rgba(30,18,6,.55)'; g.lineWidth = .7; for (let y = h - 22; y < h; y += 3) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } for (let x = 6; x < w; x += 4) { g.beginPath(); g.moveTo(x, h - 24); g.lineTo(x + (x < w / 2 ? 1 : -1) * 2, h); g.stroke(); } g.restore();
    A.rect(g, 6, h - 25, w - 12, 2.4, '#a07c48'); A.rect(g, 6, h - 25, w - 12, .6, 'rgba(255,230,180,.4)');
    // overflowing laundry: shirts, a jeans leg, towel, socks
    const heap = [['#4b6a8a', 14, 26, 14, 10, -.2], ['#c9c2a8', 26, 30, 16, 9, .15], ['#8a3a3a', 38, 26, 14, 10, -.1], ['#5a5f68', 46, 31, 14, 9, .25], ['#6a8a5a', 20, 22, 12, 9, .1]];
    heap.forEach(([c, x, y, ww, hh, rot]) => { g.save(); g.translate(x, h - y); g.rotate(rot); g.beginPath(); g.moveTo(-ww / 2, hh / 2); g.quadraticCurveTo(-ww / 2 - 1, -hh / 2, 0, -hh / 2 - 2); g.quadraticCurveTo(ww / 2 + 1, -hh / 2, ww / 2, hh / 2); g.closePath(); g.fillStyle = A.lg(g, 0, -hh / 2, 0, hh / 2, [A.shade(A.hex(c), 1.15), A.shade(A.hex(c), .7)]); g.fill(); A.line(g, -ww / 3, 0, ww / 3, -1, 'rgba(0,0,0,.25)', .5); g.restore(); });
    g.fillStyle = '#2f4a78'; g.beginPath(); g.moveTo(w - 20, h - 30); g.lineTo(w - 12, h - 28); g.lineTo(w - 8, h - 6); g.lineTo(w - 16, h - 5); g.closePath(); g.fill(); A.line(g, w - 16, h - 28, w - 12, h - 6, 'rgba(255,255,255,.2)', .5);
    g.fillStyle = '#e8e4d4'; A.ell(g, 6, h - 3, 3.4, 1.4, '#d8d4c2'); A.ell(g, 3, h - 2, 2, 1, '#d8d4c2'); A.ell(g, w - 2, h - 2, 3, 1.2, '#7a8aa0');
    g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(8, h - 24, w - 16, 2); dustTop(g, 14, h - 36, 30, .3);
    grainOn(g, 0, 0, w, h, .12, .3);
  }
  function paintPlant(g, w, h) {
    const r = srand(40);
    soft(g, w / 2, h - 1, 36, 8, .6);
    g.fillStyle = A.lg(g, w / 2 - 14, 0, w / 2 + 14, 0, ['#6a3a22', '#b86a42', '#5a2e1a']); g.beginPath(); g.moveTo(w / 2 - 14, h - 28); g.lineTo(w / 2 + 14, h - 28); g.lineTo(w / 2 + 10, h - 1); g.lineTo(w / 2 - 10, h - 1); g.fill(); A.rect(g, w / 2 - 15, h - 30, 30, 4, '#c27a50'); A.rect(g, w / 2 - 15, h - 30, 30, .8, 'rgba(255,230,200,.4)'); A.ell(g, w / 2, h - 29, 13, 2, '#2b1a0c');
    A.blotches(g, w / 2 - 14, h - 28, 28, 27, 7, 4, 'rgba(230,230,210,.35)', 2, 6); // limescale
    const stems = 5;
    for (let s = 0; s < stems; s++) {
      const a = -.7 + s * .35 + (r() - .5) * .12, len = 70 + r() * 40; let x = w / 2, y = h - 29, px = x, py = y;
      g.strokeStyle = '#5a4a28'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y);
      for (let k = 1; k <= 10; k++) { const u = k / 10; px = w / 2 + Math.sin(a) * len * u + Math.sin(u * 3) * 3; py = h - 29 - Math.cos(a) * len * u * .95; g.lineTo(px, py); } g.stroke();
      for (let k = 3; k <= 10; k++) { const u = k / 10, lx = w / 2 + Math.sin(a) * len * u + Math.sin(u * 3) * 3, ly = h - 29 - Math.cos(a) * len * u * .95; for (const sd of [-1, 1]) { const ang = sd * (1 + r() * .6) + (r() - .5) * .3 + (k > 7 ? .4 * sd : 0), L = 11 + r() * 8 - (10 - k) * .3, dead = r() < .22; g.save(); g.translate(lx, ly); g.rotate(ang + Math.PI / 2 * 0); g.fillStyle = dead ? '#8a7a3a' : (r() < .3 ? '#8aa040' : '#4a7a3a'); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(L * .5, -L * .35 * sd, L, dead ? L * .5 : 0); g.quadraticCurveTo(L * .5, L * .3 * sd, 0, 0); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = .4; g.beginPath(); g.moveTo(0, 0); g.lineTo(L * .9, 0); g.stroke(); g.restore(); } }
    }
    for (let i = 0; i < 5; i++) A.ell(g, w / 2 - 20 + r() * 40, h - 2, 3, 1.2, '#7a8a3a');
    grainOn(g, 0, 0, w, h, .08, .3);
  }
  function paintChandelier(g, w, h) {
    const cx = w / 2;
    A.line(g, cx, 0, cx, 16, '#222', 1); A.ell(g, cx, 16, 6, 3, '#a89a5a'); A.ell(g, cx, 16, 6, 3, 'rgba(0,0,0,.2)');
    g.strokeStyle = '#b8a45a'; g.lineWidth = 1.5; g.lineCap = 'round';
    for (let i = 0; i < 5; i++) { const x = cx + (i - 2) * 13, ya = i === 2 ? 20 : 26 - Math.abs(i - 2) * 1; g.beginPath(); g.moveTo(cx, 17); g.quadraticCurveTo(cx + (i - 2) * 7, 28, x, 30 + Math.abs(i - 2) * 2); g.stroke(); const by = 30 + Math.abs(i - 2) * 2; A.rect(g, x - 2.2, by, 4.4, 3, '#a8984a');
      // tulip-shaped milk-glass shades (two broken / missing)
      if (i === 3) { A.rect(g, x - 1.4, by + 3, 2.8, 2, '#d8d0b0'); A.line(g, x, by + 3, x + .5, by + 9, '#999', .5); continue; }
      g.beginPath(); g.moveTo(x - 2.2, by + 3); g.bezierCurveTo(x - 9, by + 6, x - 7, by + 17, x - 3, by + 18); g.lineTo(x + 3, by + 18); g.bezierCurveTo(x + 7, by + 17, x + 9, by + 6, x + 2.2, by + 3); g.closePath(); g.fillStyle = A.lg(g, x - 8, 0, x + 8, 0, ['#cfc9b4', '#f4f0e0', '#bbb6a2']); g.fill(); A.rect(g, x - 3, by + 17, 6, .8, 'rgba(0,0,0,.2)'); if (i === 1) { g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = .4; g.beginPath(); g.moveTo(x + 4, by + 5); g.lineTo(x + 1, by + 12); g.stroke(); } }
    dustTop(g, cx - 10, 17, 20, .6);
    grainOn(g, 0, 0, w, h, .08, .3);
  }
  function paintBottles(g, w, h) {
    soft(g, w / 2, h - 1, w + 4, 5, .55);
    const bottle = (x, rot, c, lay) => { g.save(); g.translate(x, h - (lay ? 3 : 1)); g.rotate(rot); g.beginPath(); g.roundRect(-3, -(lay ? 20 : 22), 6, lay ? 20 : 22, 2.4); g.fillStyle = A.lg(g, -3, 0, 3, 0, [A.shade(A.hex(c), .55), c, A.shade(A.hex(c), 1.3), A.shade(A.hex(c), .5)]); g.fill(); A.rect(g, -1.4, -(lay ? 25 : 27), 2.8, 6, c); A.rect(g, -1.6, -(lay ? 25.6 : 27.6), 3.2, 1.2, '#c9b24a'); A.rect(g, -3, -12, 6, 6, 'rgba(230,224,196,.9)'); g.restore(); };
    bottle(6, 0, '#4a2a14', false); bottle(13, .03, '#2a5a2c', false); bottle(20, -.04, '#4a2a14', false); bottle(25, -1.45, '#2a5a2c', true);
    soft(g, 29, h - .5, 10, 2, .4, 'rgba(120,80,10,');
    grainOn(g, 0, 0, w, h, .08, .3);
  }
  function paintSlippers(g, w, h) {
    soft(g, w / 2, h - 1, w + 4, 5, .5);
    for (const [x, rot, c] of [[8, .1, '#7a6a8a'], [21, -.35, '#7a6a8a']]) { g.save(); g.translate(x, h - 1); g.rotate(rot); g.fillStyle = A.lg(g, 0, -6, 0, 0, [c, A.shade(A.hex(c), .6)]); g.beginPath(); g.moveTo(-8, 0); g.quadraticCurveTo(-8, -6, -2, -6.4); g.quadraticCurveTo(5, -6, 8, -1.6); g.lineTo(8, 0); g.closePath(); g.fill(); A.rect(g, -8, -1.4, 16, 1.4, '#cfc9b2'); g.fillStyle = 'rgba(255,255,255,.2)'; for (let i = 0; i < 8; i++) g.fillRect(-6 + i * 1.8, -5.4 + (i % 2), .8, 2); g.restore(); }
    grainOn(g, 0, 0, w, h, .08, .3);
  }
  function paintLeaves(g, w, h) {   // foreground: hanging pothos from a macrame, blurred
    const r = srand(9);
    A.line(g, w * .5, 0, w * .5, 8, '#1c1810', 1);
    for (let v = 0; v < 4; v++) {
      let x = w * (.28 + v * .15), y = 8; g.strokeStyle = '#142010'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(w * .5, 8);
      const pts = []; for (let k = 1; k <= 9; k++) { x += (r() - .5) * 5 + (v - 1.5) * 1.6; y += 6 + r() * 3; g.lineTo(x, y); pts.push([x, y]); } g.stroke();
      pts.forEach(([px, py], k) => { if (k % 2) return; for (const sd of [-1, 1]) { g.save(); g.translate(px, py); g.rotate(sd * (.9 + r() * .5)); g.fillStyle = r() < .3 ? '#2f4f1e' : '#1d3414'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(7, -5, 13, 1); g.quadraticCurveTo(7, 6, 0, 0); g.fill(); g.restore(); } });
    }
    A.ell(g, w * .5, 6, 16, 6, '#1a130c');
  }
  function paintChair(g, w, h) {      // foreground: dark kitchen-chair back with slats, blurred
    g.fillStyle = '#0c0907'; for (const x of [2, w - 6]) g.fillRect(x, 0, 4, h);
    for (let i = 0; i < 5; i++) g.fillRect(2, 8 + i * 9.5, w - 4, 3.6);
    g.fillRect(0, 0, w, 6); A.rect(g, 3, 0, w - 8, .8, 'rgba(255,220,170,.18)');
  }
  function paintShaft(g, w, h) {      // volumetric moonbeam (additive, post)
    g.fillStyle = A.lg(g, 0, 0, 0, h, ['rgba(140,170,240,.12)', 'rgba(140,170,240,.03)']);
    for (let i = 0; i < 2; i++) { const x0 = 8 + i * 66; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + 60, 0); g.lineTo(x0 + 60 + 70, h); g.lineTo(x0 + 70, h); g.closePath(); g.fill(); }
  }
  function shaftDyn(g, t) {
    for (let i = 0; i < 22; i++) { const k = (i * .137 + t * .02 * (1 + i % 3)) % 1, x = 10 + ((i * 53.7) % 120) + k * 60 + Math.sin(t * .7 + i) * 4, y = k * 180; g.fillStyle = 'rgba(210,225,255,' + (.35 * Math.sin(k * 3.14) * (.5 + .5 * Math.sin(t * 1.3 + i))) + ')'; g.fillRect(x, y, 1.1, 1.1); }
  }
  function paintFootGlow(g, w, h) { g.fillStyle = A.rg(g, w / 2, h / 2, 0, w / 2, ['rgba(255,190,110,.38)', 'rgba(255,170,90,.12)', 'rgba(255,170,90,0)']); g.fillRect(0, 0, w, h); }

  /* ----------------------------------------------------------------- the room */
  const D = (id, x, z, w, h, o) => Object.assign({ id, x, z, w, h }, o);
  const objects = [
    D('wallCarpet', 195, 158, 200, 150, { y: 66, bake: paintWallCarpet, shadow: false }),
    D('photoFamily', 330, 158, 24, 30, { y: 155, bake: paintFrame('family'), shadow: false }),
    D('photoLada', 54, 158, 30, 24, { y: 152, bake: paintFrame('lada'), shadow: false }),
    D('posterBand', 650, 158, 46, 62, { y: 130, bake: paintFrame('band'), shadow: false }),
    D('clock', 790, 158, 26, 26, { y: 188, bake: paintClock, shadow: false }),
    D('radiator', 430, 156, 112, 66, { y: 4, bake: paintRadiator, shadow: false }),
    D('windowFrame', 430, 156, 166, 128, { y: 84, bake: paintWindow, shadow: false }),
    D('sillStuff', 395, 152, 56, 32, { y: 93, bake: paintSillStuff, shadow: false }),
    D('blinds', 430, 154.5, 152, 40, { y: 168, bake: paintBlinds, shadow: false }),
    D('curtainRod', 430, 150, 196, 8, { y: 212, bake: paintRod, shadow: false }),
    cloth(D('curtainL', 346, 146, 52, 150, { y: 63, shadow: false }), paintCurtain(0), 1.5, 1.2, 0),
    cloth(D('curtainR', 514, 146, 52, 150, { y: 63, shadow: false }), paintCurtain(1), 1.8, .9, 2),
    D('sofa', 195, 52, 220, 96, { bake: paintSofa, depth: 82, topRGB: [100, 82, 52], sideRGB: [72, 58, 36], shadow: { w: 112, a: .5 } }),
    D('floorLamp', 338, 94, 46, 172, { bake: paintFloorLamp, shadow: { w: 18, a: .5 } }),
    D('lampShadeGlow', 338, 93, 90, 90, { y: 126, post: true, postMode: 'lighter', bake: paintFootGlow, shadow: false }),
    D('coffeeTable', 450, 44, 110, 45, { bake: paintCoffeeTable, depth: 56, topRGB: [70, 46, 28], sideRGB: [40, 26, 16], shadow: { w: 58, a: .5 } }),
    D('pizzaStack', 424, 66, 40, 26, { y: 45, bake: paintPizza, shadow: false }),
    D('beerCans', 476, 82, 40, 14, { y: 45, bake: paintCans, shadow: false }),
    D('shisha', 494, 90, 28, 66, { y: 45, bake: paintShisha, dyn: shishaDyn, shadow: false }),
    D('tableDesk', 440, 51, 40, 12, { y: 45, bake: paintDesk, shadow: false,
      dyn: (g, t) => { for (let i = 0; i < 3; i++) { const k = (t * .3 + i / 3) % 1; g.fillStyle = 'rgba(210,210,215,' + (.22 * (1 - k)) + ')'; g.beginPath(); g.arc(9 + Math.sin(t * 2 + i * 2) * 2 * k, 6 - k * 24, 1 + k * 3, 0, P2); g.fill(); } } }),
    D('tvUnit', 650, 96, 124, 46, { bake: paintTvUnit, depth: 42, topRGB: [88, 58, 36], sideRGB: [50, 32, 20], shadow: { w: 62, a: .5 } }),
    D('tv', 650, 104, 100, 66, { y: 46, bake: paintTv, shadow: false }),
    D('tvScreen', 650, 103.9, 94, 54, { y: 58.5, post: true, hidden: S => !F(S).tvOn, dyn: tvDyn, shadow: false }),
    D('speakerR', 733, 100, 24, 64, { bake: paintSpeaker, shadow: { w: 14, a: .5 } }),
    D('speakerL', 572, 102, 24, 64, { bake: paintSpeaker, shadow: { w: 14, a: .5 } }),
    D('shelves', 775, 130, 90, 192, { bake: paintShelves, depth: 30, topRGB: [70, 46, 28], sideRGB: [40, 26, 16], shadow: { w: 46, a: .5 } }),
    D('laundry', 90, 26, 62, 38, { bake: paintLaundry, shadow: { w: 32, a: .5 } }),
    D('plant', 524, 124, 66, 128, { bake: paintPlant, shadow: { w: 22, a: .45 } }),
    D('chandelier', 425, 70, 74, 52, { y: 207, bake: paintChandelier, shadow: false }),
    D('bottles', 318, 30, 36, 28, { bake: paintBottles, shadow: false }),
    D('slippers', 250, 20, 30, 8, { bake: paintSlippers, shadow: false }),
    D('moonShaft', 470, 100, 210, 200, { y: 4, post: true, postMode: 'lighter', bake: paintShaft, dyn: shaftDyn, shadow: false }),
    // foreground
    D('fgLeaves', 560, -105, 80, 90, { y: 172, bake: paintLeaves, blur: 3, shadow: false }),
    D('fgChair', 742, -120, 46, 100, { bake: paintChair, blur: 3.2, shadow: false })
  ];

  BB.defineRoom({
    id: 'living',
    wallColor: ['#a07a56', '#6c5038'], partitionFace: '#8a6648',
    floorColor: ['#8a6440', '#4a3220'], gloss: .2,
    ambient: { color: [128, 108, 104] },
    ambientNow(S) { return F(S).tvOn ? [100, 94, 108] : [128, 108, 104]; },
    wall, floor, ceil, objects,
    lights: [
      { x: 338, y: 150, z: 88, r: 400, color: '255,166,84', i: 1.1, flicker: .02, bloom: .12 },
      { x: 425, y: 215, z: 70, r: 420, color: '255,206,150', i: .36, bloom: .04 },
      { x: 650, y: 90, z: 60, r: 360, color: '110,160,255', i: .95, flicker: .5, bloom: .1, on: S => !!F(S).tvOn },
      { x: 430, y: 150, z: 120, r: 440, color: '120,150,230', i: .5, bloom: .05 },
      { x: 494, y: 100, z: 80, r: 60, color: '255,120,40', i: .35, flicker: .6, bloom: 0 }
    ],
    hotspots: [
      { id: 'sofa', x: 195, r: 120, h: 80 }, { id: 'tv', x: 650, r: 75, h: 120 },
      { id: 'laundry', x: 90, r: 55, h: 40 }
    ],
    solids: []
  });
})();
