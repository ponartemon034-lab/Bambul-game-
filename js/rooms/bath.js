/* ==========================================================================
   BATHROOM (id 'bath', width 550) - cool, damp, reflective.  Owner: bath artist.
   Layers (z): window/mirror/pipes 150-158 | washer/sink/toilet 96-136 | tub 85-120
   | foreground steam, drip pipe, clothesline -60..-85.  See docs/ROOM_BATH.md
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  if (!BB.defineRoom || !BB.art) { console.warn('[bath] engine / art toolkit missing'); return; }
  const A = BB.art, srand = BB.U.srand, clamp = BB.U.clamp;
  const TAU = Math.PI * 2;
  const F = S => (S && S.f) || {};
  const T = () => BB.t || 0;
  const TUBE_AX = 2050 + 270;                                   // absolute x of the fluorescent (engine flicker formula needs it)
  const tubeFlicker = t => 1 - .38 * (.5 + .5 * Math.sin(t * 37 + TUBE_AX) * Math.sin(t * 5.3));

  /* ------------------------------------------------------------------ helpers */
  const porc = (g, x0, x1) => A.lg(g, x0, 0, x1, 0, ['#a9b8b5', '#e9f0ee', '#f8fbfa', '#d5e0dd', '#94a6a3']);
  const chromeG = (g, x0, x1) => A.lg(g, x0, 0, x1, 0, ['#3d484d', '#cfdde2', '#ffffff', '#84959b', '#2f393e']);
  const rustG = (g, x0, x1) => A.lg(g, x0, 0, x1, 0, ['#3d3a33', '#8d8a7c', '#b0ad9d', '#6f6c60', '#34312b']);
  function mould(g, x, y, w, h, seed, n, a) {
    const r = srand(seed); a = a == null ? .6 : a;
    for (let i = 0; i < n; i++) {
      const cx = x + r() * w, cy = y + r() * h, rad = .7 + r() * 3;
      A.glow(g, cx, cy, rad * 2.4, 'rgba(34,46,26,' + (a * .35) + ')');
      g.fillStyle = 'rgba(16,24,14,' + (a * (.45 + r() * .5)) + ')';
      for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(cx + (r() - .5) * rad * 2, cy + (r() - .5) * rad * 2, .22 + r() * .65, 0, TAU); g.fill(); }
    }
  }
  /* tube between points: dark body, mid tone, specular strip */
  function tube(g, pts, wd, c0, c1, c2) {
    g.lineCap = 'round'; g.lineJoin = 'round';
    const pass = (col, w, dx, dy) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0][0] + dx, pts[0][1] + dy); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] + dx, pts[i][1] + dy); g.stroke(); };
    pass(c0, wd, 0, 0); pass(c1, wd * .66, -wd * .06, -wd * .06); pass(c2, wd * .22, -wd * .2, -wd * .2);
  }
  function hexNut(g, cx, cy, w, h, rot, base) {
    g.save(); g.translate(cx, cy); g.rotate(rot || 0);
    g.fillStyle = A.lg(g, 0, -h / 2, 0, h / 2, [A.shade(base || [190, 200, 205], 1.25), A.shade(base || [190, 200, 205], .6)]);
    g.beginPath(); g.moveTo(-w / 2, -h * .2); g.lineTo(-w * .32, -h / 2); g.lineTo(w * .32, -h / 2); g.lineTo(w / 2, -h * .2); g.lineTo(w / 2, h / 2); g.lineTo(-w / 2, h / 2); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(-w / 2 + .3, -h * .2, w - .6, .5);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-w * .02, -h / 2, .6, h); g.fillRect(-w / 2, h / 2 - .6, w, .6);
    g.restore();
  }
  let _blob = null;
  function blob() { return _blob || (_blob = BB.bake(48, 48, g => A.glow(g, 24, 24, 24, 'rgba(236,248,250,1)'), { B: 1 })); }
  function steamWisps(g, t, x0, y0, w, h, n, a, seed) {
    const b = blob(); g.save();
    for (let i = 0; i < n; i++) {
      const ph = (t * (.035 + (i % 3) * .01) + i * .37 + seed) % 1, s = 26 + (i % 4) * 14 + ph * 22;
      g.globalAlpha = a * Math.sin(ph * Math.PI) * (.6 + .4 * Math.sin(i * 7.3 + t * .4));
      g.drawImage(b, x0 + ((i * 53.7 + seed * 91) % w) + Math.sin(t * .3 + i) * 12, y0 + h - ph * h, s * 1.3, s);
    }
    g.restore();
  }
  function sparkle(g, x, y, s, a) {
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,255,' + a + ')';
    g.fillRect(x - s, y - s * .08, s * 2, s * .16); g.fillRect(x - s * .08, y - s, s * .16, s * 2);
    A.glow(g, x, y, s * .8, 'rgba(255,255,255,' + a * .5 + ')'); g.restore();
  }
  /* water body for stream: mode 'calm' | 'sput' | 'howl' ; x,y0 outlet, y1 impact */
  function water(g, t, x, y0, y1, mode) {
    const len = y1 - y0;
    if (mode === 'calm') {
      const w = 2.6;
      g.fillStyle = A.lg(g, x - w, 0, x + w, 0, ['rgba(170,215,240,.35)', 'rgba(240,252,255,.85)', 'rgba(150,200,230,.35)']);
      g.fillRect(x - w, y0, w * 2, len);
      g.fillStyle = 'rgba(255,255,255,.55)';
      for (let k = 0; k < 6; k++) { const yy = y0 + ((t * 70 + k * len / 6) % len); g.fillRect(x - .5 + Math.sin(yy * .6) * .3, yy, 1, 4); }
    } else if (mode === 'sput') {
      const burst = .5 + .5 * Math.sin(t * 6.2);
      for (let yy = y0; yy < y1; yy += 2) {
        const w = 1.6 + 1.1 * Math.sin(yy * .5 - t * 30) * burst + .9 * burst, gap = Math.sin(yy * .22 - t * 14) > .93 ? 0 : 1;
        g.fillStyle = 'rgba(205,212,196,' + (.62 * gap) + ')'; g.fillRect(x - w + Math.sin(yy * .3 + t * 8) * .6, yy, w * 2, 2.2);
      }
      g.fillStyle = 'rgba(150,120,70,.22)'; g.fillRect(x - .8, y0, 1.6, len);
    }
  }
  function ripple(g, t, x, y, rx, a, n) {
    for (let k = 0; k < n; k++) { const ph = (((t * 1.4 + k / n) % 1) + 1) % 1; g.strokeStyle = 'rgba(235,250,255,' + a * (1 - ph) + ')'; g.lineWidth = .5; g.beginPath(); g.ellipse(x, y, rx * (.25 + ph * .85), rx * (.25 + ph * .85) * .3, 0, 0, TAU); g.stroke(); }
  }
  const shaker = (o, amp, on) => { if (on) { const t = T(); o.dx = Math.sin(t * 71 + o.ax) * amp; o.dy = Math.cos(t * 83) * amp * .6; } else { o.dx = 0; o.dy = 0; } };
  const hasProp = (kind, v, s) => { try { return BB.props && BB.props.get && BB.props.get(kind, v, s); } catch (e) { return null; } };

  /* =============================================================== WALL (550 x 260) */
  function wall(g, w, h) {
    const TOP = 65;                                                  // tiles start 195 cm above the floor
    A.plaster(g, 0, 0, w, h, { top: '#8ea29d', bottom: '#74898a', seed: 4 });
    A.blotches(g, 0, 0, w, TOP + 14, 31, 26, 'rgba(24,38,28,.20)', 10, 38);
    // peeling paint flakes + bare plaster
    const r = srand(77);
    for (let i = 0; i < 9; i++) {
      const px = r() * w, py = 6 + r() * (TOP - 14), pw = 10 + r() * 26, ph = 5 + r() * 12;
      g.fillStyle = 'rgba(190,188,168,.55)'; g.beginPath(); g.moveTo(px, py); g.lineTo(px + pw, py + ph * .2); g.lineTo(px + pw * .8, py + ph); g.lineTo(px + pw * .1, py + ph * .8); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(30,40,32,.5)'; g.lineWidth = .7; g.stroke();
    }
    mould(g, 0, 0, w, TOP - 6, 41, 90, .85);
    // ---- tile field
    A.tiles(g, 0, TOP, w, h - TOP, { w: 15, h: 15, c1: '#c1d3ce', c2: '#9fb7b3', seed: 12, dirt: .12, grout: 'rgba(34,58,56,.55)' });
    // soft tile glaze: gloss streaks + light pool under the tube
    g.save(); g.beginPath(); g.rect(0, TOP, w, h - TOP); g.clip();
    A.glow(g, 270, 150, 240, 'rgba(238,255,252,.20)');
    g.globalAlpha = .10; g.fillStyle = A.lg(g, 0, 0, 160, 0, ['rgba(255,255,255,0)', 'rgba(255,255,255,1)', 'rgba(255,255,255,0)']);
    for (let x = -60; x < w; x += 190) { g.save(); g.translate(x, 0); g.transform(1, 0, -.35, 1, 0, 0); g.fillRect(0, TOP, 90, h); g.restore(); }
    g.restore();
    // dark border strip with bevel
    g.fillStyle = A.lg(g, 0, 124, 0, 132, ['#5b8d8f', '#2c5659']); g.fillRect(0, 124, w, 8);
    g.fillStyle = 'rgba(255,255,255,.32)'; g.fillRect(0, 124, w, .9); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 132, w, 1.6);
    for (let x = 0; x < w; x += 15) { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, 124, .7, 8); }
    // top lip trim
    g.fillStyle = A.lg(g, 0, TOP - 3, 0, TOP + 2, ['#d9e2de', '#a7b8b3']); g.fillRect(0, TOP - 3, w, 4);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, TOP + 1, w, 1.5);
    g.fillStyle = A.lg(g, 0, TOP + 2, 0, TOP + 12, ['rgba(0,0,0,.28)', 'rgba(0,0,0,0)']); g.fillRect(0, TOP + 2, w, 10);
    // missing tiles (bare adhesive) above the tub
    { const x = 322, y = 90, ww = 30, hh = 30;
      g.fillStyle = '#767468'; g.fillRect(x, y, ww, hh);
      A.blotches(g, x, y, ww, hh, 5, 10, 'rgba(255,255,230,.18)', 3, 8); A.grain(g, x, y, ww, hh, .3, .5);
      g.fillStyle = '#5c5a50'; for (let i = 0; i < 9; i++) g.fillRect(x + r() * ww, y + r() * hh, 4 + r() * 5, .8 + r());
      g.fillStyle = A.lg(g, 0, y, 0, y + 6, ['rgba(0,0,0,.6)', 'rgba(0,0,0,0)']); g.fillRect(x, y, ww, 6);
      g.fillStyle = A.lg(g, x, 0, x + 5, 0, ['rgba(0,0,0,.45)', 'rgba(0,0,0,0)']); g.fillRect(x, y, 5, hh);
      g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x - .3, y + hh, ww, .8); g.fillRect(x + ww, y, .8, hh);
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(x + ww, y + hh); g.lineTo(x + ww - 7, y + hh); g.lineTo(x + ww, y + hh - 6); g.fill();
    }
    // cracks
    g.strokeStyle = 'rgba(20,34,34,.7)'; g.lineWidth = .55;
    [[470, 176, 12, 14], [140, 205, -10, 12], [388, 214, 9, -16], [232, 98, 8, 10]].forEach(([x, y, dx, dy]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx * .4, y + dy * .3); g.lineTo(x + dx * .3, y + dy * .6); g.lineTo(x + dx, y + dy); g.stroke(); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x + .5, y, .5, dy * .5); });
    // mould in grout (worst around the tub corner) + water streaks + rust trails
    mould(g, 300, 150, 200, 110, 55, 130, .9); mould(g, 0, 190, 90, 60, 56, 40, .7); mould(g, 200, 215, 100, 45, 57, 36, .7);
    A.streaks(g, 0, TOP, w, h - TOP, 77, 34, 'rgba(228,244,242,.16)');
    A.streaks(g, 160, 70, 40, 110, 78, 6, 'rgba(120,76,40,.38)'); A.streaks(g, 288, 70, 20, 150, 79, 5, 'rgba(120,76,40,.38)'); A.streaks(g, 40, 70, 50, 70, 80, 5, 'rgba(120,76,40,.3)');
    A.streaks(g, 222, 150, 60, 80, 81, 8, 'rgba(240,244,236,.22)');     // limescale / splashes around the sink
    A.glow(g, 250, 172, 52, 'rgba(236,240,226,.14)');
    // washer / toilet wall stains
    A.blotches(g, 0, 175, w, 80, 91, 14, 'rgba(20,30,24,.14)', 14, 40);
    A.wallAO(g, w, h); A.grain(g, 0, 0, w, h, .09, .6);
    A.hole(g, 400, 24, 50, 34);                                      // small high window -> city
  }

  /* ============================================================ FLOOR (plan 550 x 520) */
  function floor(g, w, d) {
    A.tiles(g, 0, 0, w, d, { w: 25, h: 25, c1: '#c3d0cc', c2: '#93a9a6', checker: true, seed: 5, dirt: .10, grout: 'rgba(20,38,38,.55)' });
    const r = srand(8);
    // wet sheen: light pool under the tube + glossy streaks
    A.glow(g, 270, 120, 230, 'rgba(225,248,250,.26)'); A.glow(g, 120, 120, 120, 'rgba(210,235,240,.10)');
    for (let i = 0; i < 16; i++) { const x = r() * w, y = r() * 300; g.fillStyle = 'rgba(235,252,255,' + (.06 + r() * .09) + ')'; g.fillRect(x, y, 30 + r() * 80, 1 + r() * 3); }
    // dark grime in the grout lines & corners
    A.blotches(g, 0, 0, w, d, 12, 60, 'rgba(18,30,22,.18)', 14, 60);
    A.blotches(g, 0, 0, w, 40, 14, 40, 'rgba(14,26,18,.30)', 10, 32);
    // puddles (dark glossy ovals w/ bright rims)
    [[205, 100, 42, 14], [420, 62, 28, 9], [470, 110, 24, 8], [120, 70, 20, 7]].forEach(([x, y, rx, ry]) => {
      g.save(); g.translate(x, y); g.scale(1, ry / rx);
      g.fillStyle = A.rg(g, 0, 0, 0, rx, ['rgba(12,28,34,.55)', 'rgba(20,40,46,.4)', 'rgba(20,40,46,0)']); g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill();
      g.strokeStyle = 'rgba(235,252,255,.35)'; g.lineWidth = 1.4; g.beginPath(); g.arc(0, 0, rx * .82, 3.6, 5.6); g.stroke(); g.restore();
    });
    // tub mat: dingy rubber mat in front of the tub (z 15..80 -> y 80..145)
    { const x = 322, y = 82, mw = 150, mh = 58;
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 2, y + 3, mw, mh);
      g.fillStyle = A.lg(g, 0, y, 0, y + mh, ['#8d9b7e', '#6f7d62']); g.fillRect(x, y, mw, mh);
      for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.10)'; g.fillRect(x + 4, y + 4 + i * 4, mw - 8, 2); }
      g.strokeStyle = 'rgba(40,50,32,.7)'; g.lineWidth = 1.4; g.strokeRect(x + 2, y + 2, mw - 4, mh - 4);
      A.blotches(g, x, y, mw, mh, 33, 8, 'rgba(20,24,12,.32)', 4, 14); mould(g, x, y, mw, mh, 34, 40, .5);
      g.fillStyle = 'rgba(210,235,240,.25)'; g.beginPath(); g.ellipse(x + 40, y + 30, 18, 6, 0, 0, 7); g.fill();
      A.grain(g, x, y, mw, mh, .2, .6);
    }
    // drain grate in front of the tub
    g.save(); g.translate(400, 150); g.fillStyle = '#10181a'; g.beginPath(); g.ellipse(0, 0, 11, 6, 0, 0, 7); g.fill();
    g.fillStyle = A.lg(g, -10, 0, 10, 0, ['#5d6a6e', '#aab8bc', '#4a565a']); g.beginPath(); g.ellipse(0, 0, 9.5, 5, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.65)'; g.lineWidth = .8; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(k * 2.6, -4.6); g.lineTo(k * 2.6, 4.6); g.stroke(); } g.restore();
    // rust ring + hair under washer / boiler leak
    A.glow(g, 60, 60, 36, 'rgba(120,70,30,.25)'); A.glow(g, 295, 20, 26, 'rgba(100,70,40,.28)');
    // coves along the wall (shadow strip) + toilet base shadow
    g.fillStyle = A.lg(g, 0, 0, 0, 20, ['rgba(0,0,0,.55)', 'rgba(0,0,0,0)']); g.fillRect(0, 0, w, 20);
    A.grain(g, 0, 0, w, d, .10, .8);
  }

  /* ============================================================ CEILING (plan 550 x 520) */
  function ceil(g, w, d) {
    g.fillStyle = A.lg(g, 0, 0, 0, d, ['#59706f', '#a2b3ae']); g.fillRect(0, 0, w, d);
    A.blotches(g, 0, 0, w, d, 21, 40, 'rgba(24,36,28,.22)', 14, 50);
    mould(g, 0, 0, w, 90, 22, 90, .85); mould(g, 0, 0, 90, d, 23, 40, .7); mould(g, w - 90, 0, 90, d, 24, 40, .7); mould(g, 300, 40, 160, 100, 25, 80, .8);
    // a damp patch under the leaky pipe + plank seams
    A.glow(g, 175, 40, 60, 'rgba(70,64,40,.30)');
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let x = 0; x < w; x += 20) g.fillRect(x, 0, .9, d);
    A.grain(g, 0, 0, w, d, .12, .8);
    // fluorescent channel shadow + light pool
    A.glow(g, 270, 120, 190, 'rgba(210,245,250,.18)');
  }
  /* ================================================================ SPRITE ART */
  /* ---- washing machine 62 x 86 ---- */
  function bakeWasher(g, w, h) {
    A.rrect(g, 0, 0, w, h, 2.4, A.lg(g, 0, 0, w, 0, ['#b8c3c0', '#edf2f0', '#f7faf8', '#dbe3e0', '#a5b2af']));
    A.rect(g, 0, 0, w, 2.4, 'rgba(255,255,255,.75)');
    A.rrect(g, 3, 3, w - 6, 19, 1.5, 'rgba(110,135,135,.16)'); A.rect(g, 3, 22, w - 6, .9, 'rgba(0,0,0,.3)'); A.rect(g, 3, 23, w - 6, .6, 'rgba(255,255,255,.6)');
    A.rrect(g, 5, 6, 21, 12, 1.2, '#1b2627'); A.rrect(g, 6, 7.5, 19, 9, 1, '#2d3b3c'); A.rect(g, 9, 11, 13, 2.2, '#aab6b4'); A.rect(g, 9, 11, 13, .6, '#fff');
    A.rrect(g, 30, 6.5, 12, 6.5, 1, '#06161a'); g.fillStyle = '#48dca6'; g.font = 'bold 5px monospace'; g.fillText('E4', 32.4, 11.6);
    for (let i = 0; i < 3; i++) { A.rrect(g, 30 + i * 4.2, 15.4, 3, 2.2, .6, '#99a5a3'); A.rect(g, 30 + i * 4.2, 15.4, 3, .5, '#fff'); }
    A.ell(g, 50, 13, 6.8, 6.8, 'rgba(0,0,0,.28)'); A.ell(g, 50, 12.6, 6, 6, A.rg(g, 48, 10.6, 0, 7, ['#f4f6f5', '#8b9795'])); A.line(g, 50, 12.6, 53, 9.4, '#2a3636', 1);
    // porthole door
    A.ell(g, 31.4, 55.8, 23, 23, 'rgba(0,0,0,.28)');
    A.ell(g, 31, 55, 22, 22, A.rg(g, 26, 47, 2, 26, ['#f4f7f6', '#bcc7c4', '#77858a']));
    A.ell(g, 31, 55, 19.4, 19.4, '#161b1e');
    A.ell(g, 31, 55, 16.6, 16.6, A.rg(g, 28, 50, 1, 18, ['#2a4750', '#0c161c']));
    // static clothes in the drum (a sock caught in the seal)
    g.save(); g.beginPath(); g.arc(31, 55, 16.5, 0, TAU); g.clip();
    ['#a8453a', '#cfcab9', '#3b5a85', '#b99c46'].forEach((c, i) => A.ell(g, 24 + i * 5, 63 - (i % 2) * 3, 7, 4.5, c));
    A.ell(g, 31, 66, 14, 5, 'rgba(0,0,0,.35)'); g.restore();
    g.fillStyle = '#b8473b'; g.beginPath(); g.moveTo(46, 68); g.quadraticCurveTo(52, 70, 51, 80); g.lineTo(46.5, 80.5); g.quadraticCurveTo(46, 73, 43, 70); g.closePath(); g.fill();
    g.fillStyle = '#e9e6dc'; g.fillRect(46.2, 74, 5, 1.6); g.fillRect(46.4, 77.4, 5, 1.6);
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1.1; g.beginPath(); g.arc(31, 55, 14.5, 3.6, 4.9); g.stroke();
    A.line(g, 36, 45, 40, 47, 'rgba(255,255,255,.25)', 1.6);
    // kick panel, stickers, grime
    A.rect(g, 3, h - 7, w - 6, 5, A.lg(g, 0, h - 7, 0, h - 2, ['#8b9895', '#63706e']));
    A.rect(g, 44, 26, 12, 7, '#d98b2c'); A.rect(g, 44, 26, 12, 1, 'rgba(255,255,255,.4)'); A.rect(g, 46, 29, 6, .8, '#6b3f10'); A.rect(g, 46, 31, 8, .8, '#6b3f10');
    A.streaks(g, 0, h - 40, w, 40, 14, 9, 'rgba(120,84,44,.34)'); A.blotches(g, 0, h - 24, 24, 24, 15, 4, 'rgba(70,60,30,.25)', 4, 11);
    A.grain(g, 0, 0, w, h, .13, .5); A.bevel(g, 0, 0, w, h, 'rgba(255,255,255,.4)', 'rgba(0,0,0,.28)');
    g.fillStyle = A.lg(g, w - 8, 0, w, 0, ['rgba(0,0,0,0)', 'rgba(0,0,0,.2)']); g.fillRect(w - 8, 0, 8, h);
  }
  function dynWasher(g, t, S) {
    if (!F(S).washerOn) return;
    g.save(); g.beginPath(); g.arc(31, 55, 16.5, 0, TAU); g.clip();
    g.fillStyle = A.rg(g, 31, 55, 1, 18, ['#2d4b54', '#0a1218']); g.fillRect(13, 37, 36, 36);
    const cols = ['#b4483b', '#d8d4c4', '#3e5f8a', '#c6a64a', '#7a5a8a', '#8aa07a', '#b88a7e'];
    for (let k = 0; k < 7; k++) {
      const a = t * 3.4 + k * .9, rr = 7 + 4 * Math.sin(k * 2.3 + t * .7);
      g.fillStyle = cols[k]; g.beginPath(); g.ellipse(31 + Math.cos(a) * rr, 57 + Math.sin(a) * rr * .9, 5.4, 3.2, a, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(160,205,225,.32)'; g.beginPath(); g.moveTo(14, 60 + Math.sin(t * 4) * 1.2); for (let x = 14; x <= 48; x += 3) g.lineTo(x, 60 + Math.sin(t * 4 + x * .5) * 1.4); g.lineTo(48, 74); g.lineTo(14, 74); g.fill();
    for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(15 + (k * 37 % 30) + Math.sin(t * 3 + k) * 2, 62 + ((t * 9 + k * 5) % 10), .6 + (k % 3) * .3, 0, TAU); g.fill(); }
    g.restore();
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1.1; g.beginPath(); g.arc(31, 55, 14.5, 3.6, 4.9); g.stroke();
    g.fillStyle = Math.sin(t * 9) > 0 ? '#06161a' : '#0b2c24'; g.fillRect(31, 7.5, 10, 4.5);
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(70,230,170,.8)'; g.font = 'bold 4.4px monospace'; g.fillText(Math.sin(t * 9) > 0 ? '12:' + (30 + (t | 0) % 30) : 'ПРМ', 31.5, 11.4); g.restore();
    g.strokeStyle = 'rgba(210,225,230,.5)'; g.lineWidth = .7; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { const o = Math.sin(t * 30 + k) * .8; g.beginPath(); g.arc(-2 - k * 2.2, 46, 6 + k * 3, 3.3 + o * .1, 4.2); g.stroke(); g.beginPath(); g.arc(64 + k * 2.2, 46, 6 + k * 3, -1.1, -.2 - o * .1); g.stroke(); }
  }

  /* ---- boiler + supply pipes 44 x 134 ---- */
  function bakeBoiler(g, w, h) {
    A.ell(g, 22, 69, 20, 5, '#3b4646');
    g.fillStyle = A.lg(g, 2, 0, 42, 0, ['#aeb7b2', '#ecefe6', '#fbfcf4', '#d4d9cd', '#8d9690']); g.fillRect(2, 5, 40, 64);
    A.ell(g, 22, 5, 20, 5, '#d8dccf'); A.ell(g, 22, 5, 20, 5, A.rg(g, 18, 4, 1, 22, ['rgba(255,255,255,.7)', 'rgba(120,130,120,.5)']));
    A.ell(g, 22, 69, 20, 5, A.lg(g, 2, 0, 42, 0, ['#4a5252', '#a3acab', '#3e4747']));
    g.fillStyle = '#566'; g.fillRect(2, 5, .8, 64); g.fillRect(41.2, 5, .8, 64);
    // dial + label
    A.ell(g, 22, 38, 7, 7, '#2a2f2f'); A.ell(g, 22, 38, 6, 6, '#e8e3cd'); A.line(g, 22, 38, 25.5, 34.5, '#b02a1a', 1);
    for (let i = 0; i < 9; i++) { const a = 2.4 + i * .5; A.line(g, 22 + Math.cos(a) * 4.2, 38 + Math.sin(a) * 4.2, 22 + Math.cos(a) * 5.4, 38 + Math.sin(a) * 5.4, '#333', .5); }
    A.rect(g, 8, 18, 28, 8, '#d9c37a'); g.fillStyle = '#4b3b10'; g.font = 'bold 4px sans-serif'; g.fillText('ТЕПЛО-ГОРЯЧ 50 л', 9.2, 23.4);
    A.rrect(g, 30, 52, 8, 4, 1, '#222'); A.ell(g, 33.4, 54, 1.1, 1.1, '#400');
    A.streaks(g, 2, 50, 40, 20, 61, 7, 'rgba(120,76,36,.5)'); A.grain(g, 2, 5, 40, 64, .12, .5);
    // pipes: cold (blue) + hot (copper) down to the washer area
    tube(g, [[12, 72], [12, h]], 3.6, '#1d3a6a', '#3f78c4', '#9ec3f0');
    tube(g, [[32, 72], [32, h]], 3.6, '#4a2412', '#b8693a', '#f0b88a');
    [[12, 96], [32, 96]].forEach(([x, y]) => { A.rrect(g, x - 3.4, y, 6.8, 9, 1.4, chromeG(g, x - 3.4, x + 3.4)); A.line(g, x - 3, y + 4.5, x + 3, y + 4.5, 'rgba(0,0,0,.4)', .6); });
    A.rrect(g, 7, 118, 10, 3, 1, '#555'); A.rrect(g, 27, 118, 10, 3, 1, '#555');
    A.streaks(g, 4, 72, 36, 62, 62, 5, 'rgba(110,200,170,.28)');
  }
  function dynBoiler(g, t, S) {
    const p = .55 + .45 * Math.sin(t * 2.1);
    g.save(); g.globalCompositeOperation = 'lighter'; A.glow(g, 33.4, 54, 6, 'rgba(255,40,20,' + (.5 * p) + ')'); g.restore();
    g.fillStyle = 'rgba(255,60,40,' + (.55 + .45 * p) + ')'; g.beginPath(); g.arc(33.4, 54, .9, 0, TAU); g.fill();
  }
  /* ---- stuff on top of the washer 44 x 24 ---- */
  function bakeWashTop(g, w, h) {
    A.ell(g, 22, 22, 20, 3, 'rgba(0,0,0,.3)');
    g.fillStyle = '#3d4552'; g.beginPath(); g.moveTo(2, 22); g.quadraticCurveTo(4, 8, 14, 8); g.quadraticCurveTo(26, 6, 30, 18); g.lineTo(32, 22); g.fill();      // dark T-shirt
    g.fillStyle = '#8b6a52'; g.beginPath(); g.moveTo(12, 22); g.quadraticCurveTo(20, 10, 34, 12); g.quadraticCurveTo(40, 16, 38, 22); g.fill();               // brown towel
    A.rect(g, 14, 17, 22, 1.2, 'rgba(255,255,255,.25)'); A.rect(g, 14, 20, 22, 1.2, 'rgba(255,255,255,.18)');
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(14, 12, 8, 2, -.3, 0, 7); g.fill();
    // detergent bottle (blue)
    A.rrect(g, 34, 2, 8, 20, 2, A.lg(g, 34, 0, 42, 0, ['#1f5a9e', '#4f9ae0', '#174a85'])); A.rrect(g, 35.6, 0, 4.8, 3.4, 1, '#eee');
    A.rect(g, 34, 9, 8, 7, '#f3f1e4'); A.rect(g, 35, 11, 6, 1, '#d33'); A.rect(g, 35, 13, 6, .7, '#555'); A.rect(g, 35.2, 3, .8, 17, 'rgba(255,255,255,.4)');
    // loose sock on the floor of the pile
    g.fillStyle = '#d6d3c6'; g.beginPath(); g.ellipse(6, 21, 4, 1.7, .2, 0, 7); g.fill();
  }

  /* ---- mop (leaning) 38 x 150 and bucket 32 x 32 ---- */
  function bakeMop(g, w, h) {
    // handle
    g.save(); g.lineCap = 'round';
    g.strokeStyle = '#2b1d12'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(12, 128); g.lineTo(29, 4); g.stroke();
    g.strokeStyle = '#a97a4a'; g.lineWidth = 1.9; g.beginPath(); g.moveTo(12, 128); g.lineTo(29, 4); g.stroke();
    g.strokeStyle = 'rgba(255,230,180,.5)'; g.lineWidth = .5; g.beginPath(); g.moveTo(11.3, 128); g.lineTo(28.3, 4); g.stroke();
    g.restore();
    A.rect(g, 25, 14, 5, 7, 'rgba(0,0,0,.25)');
    // clamp + head
    A.rrect(g, 3, 122, 20, 6, 1.4, chromeG(g, 3, 23)); A.rect(g, 3, 122, 20, .8, '#fff');
    const r = srand(3);
    for (let i = 0; i < 26; i++) {
      const x0 = 5 + i * .72, len = 18 + r() * 8; g.strokeStyle = i % 3 ? '#8b8d83' : '#6f7266'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(x0, 127); g.quadraticCurveTo(x0 + (r() - .5) * 4, 138, x0 + (r() - .3) * 7, 127 + len); g.stroke();
    }
    A.blotches(g, 2, 130, 24, 20, 5, 4, 'rgba(30,26,12,.45)', 4, 9);
    // rag tied on
    g.fillStyle = '#b05a3a'; g.beginPath(); g.moveTo(22, 125); g.lineTo(31, 132); g.lineTo(27, 135); g.lineTo(21, 129); g.fill();
  }
  function bakeBucket(g, w, h) {
    A.ell(g, 16, 30, 14, 2.4, 'rgba(0,0,0,.4)');
    g.fillStyle = A.lg(g, 1, 0, 31, 0, ['#9a7a10', '#e8c22c', '#f6d84a', '#caa21a', '#836510']);
    g.beginPath(); g.moveTo(1.5, 6); g.lineTo(30.5, 6); g.lineTo(27, 30); g.lineTo(5, 30); g.closePath(); g.fill();
    for (let i = 0; i < 3; i++) A.line(g, 4.5 + i * .6, 10 + i * 6, 27.5 - i * .6, 10 + i * 6, 'rgba(0,0,0,.14)', .6);
    A.rect(g, 10, 14, 12, 8, '#f1efe0'); g.fillStyle = '#222'; g.font = 'bold 4px sans-serif'; g.fillText('10 Л', 12.4, 20);
    A.ell(g, 16, 6, 14.6, 3.6, '#a98818'); A.ell(g, 16, 6.4, 13.2, 2.9, '#241f12'); A.ell(g, 16, 7.1, 12.2, 2.2, 'rgba(96,100,72,.9)');
    A.ell(g, 12, 6.6, 4, .9, 'rgba(255,255,255,.28)');
    g.strokeStyle = '#1b1b1b'; g.lineWidth = .9; g.beginPath(); g.arc(16, 6, 14.6, 3.5, 5.9); g.stroke();
    A.line(g, 2, 7, 3, 28, 'rgba(255,255,255,.35)', .8); A.streaks(g, 4, 16, 24, 14, 71, 4, 'rgba(60,50,20,.4)');
  }

  /* ---- exposed pipes ---- */
  function bakePipeRun(g, w, h) {
    tube(g, [[0, 8], [w - 9, 8], [w - 4.6, 12], [w - 4.6, h]], 4.6, '#3a382f', '#8b897a', '#dcdac9');
    A.blotches(g, 0, 4, w, 8, 7, 14, 'rgba(150,72,28,.55)', 1.5, 4);
    [30, 102, 180].forEach((x, i) => {
      A.rrect(g, x - 2.9, 2.4, 5.8, 11.2, 1.2, A.lg(g, x - 3, 0, x + 3, 0, ['#4f4b3e', '#c2bea8', '#5b5748']));
      A.line(g, x - 2.8, 5.5, x + 2.8, 5.5, 'rgba(0,0,0,.4)', .5); A.line(g, x - 2.8, 10.5, x + 2.8, 10.5, 'rgba(0,0,0,.4)', .5);
    });
    // leaking union: lime crust + wet stain
    g.fillStyle = 'rgba(214,230,214,.85)'; g.beginPath(); g.ellipse(102, 13.4, 3.6, 1.7, 0, 0, 7); g.fill();
    A.streaks(g, 99, 13, 6, 3, 9, 3, 'rgba(70,52,28,.7)');
    // clamps
    [60, 140, 206].forEach(x => { A.rect(g, x - 3, 1.4, 6, 13, '#555249'); A.rect(g, x - 3, 1.4, 6, .8, 'rgba(255,255,255,.35)'); A.screws(g, [[x, 3.2], [x, 12.8]], .8, '#222'); A.rect(g, x - 1, 12, 2, 4, '#444'); });
    // sweat beads
    const r = srand(2); for (let i = 0; i < 26; i++) { const x = r() * (w - 14); g.fillStyle = 'rgba(230,245,250,.7)'; g.beginPath(); g.ellipse(x, 10.6 + r() * 1.4, .45, .7, 0, 0, 7); g.fill(); }
  }
  function dynPipeRun(g, t, S, o) {
    const P = 2.3, u = (t % P) / P, x = 102.2, y0 = 14, y1 = 203;
    if (u < .42) { const k = u / .42; g.fillStyle = 'rgba(205,235,248,.9)'; g.beginPath(); g.ellipse(x, y0 + k * 1.6, .5 + k * .9, .7 + k * 1.3, 0, 0, TAU); g.fill(); }
    else { const v = (u - .42) / .58, y = y0 + (y1 - y0) * v * v; g.fillStyle = 'rgba(205,235,248,.85)'; g.beginPath(); g.moveTo(x, y - 3.2); g.quadraticCurveTo(x + 1.2, y, x, y + 1); g.quadraticCurveTo(x - 1.2, y, x, y - 3.2); g.fill(); }
    const since = (u - .96 + 1) % 1; if (since < .35) { g.strokeStyle = 'rgba(230,250,255,' + (.7 * (1 - since / .35)) + ')'; g.lineWidth = .5; g.beginPath(); g.ellipse(x, y1, 1.5 + since * 24, .6 + since * 6, 0, 0, TAU); g.stroke(); }
    g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { const ph = (t * .3 + i * .33) % 1; if (ph < .12) sparkle(g, 18 + i * 78 + (i * 31 % 17), 10.6, 1.4, .8 * (1 - ph / .12)); } g.restore();
  }
  function bakeRiser(g, w, h) {
    A.rect(g, 8 - 6, h - 3, 12, 3, '#2a2a28');
    tube(g, [[8, 0], [8, h - 4]], 5.2, '#383630', '#85836f', '#d3d1be');
    A.blotches(g, 4, 0, 8, h, 8, 22, 'rgba(150,70,26,.55)', 1.5, 4);
    // insulation wrap (grey tape) 150-190 cm
    for (let y = 70; y < 112; y += 3.2) { A.line(g, 4.9, y + 2, 11.1, y - 1, '#9aa0a0', 2); A.line(g, 4.9, y + 1.4, 11.1, y - 1.6, 'rgba(255,255,255,.3)', .5); }
    A.rect(g, 4.8, 68, 6.4, 1, 'rgba(0,0,0,.4)');
    // valve with red wheel
    A.rrect(g, 3.4, 134, 9.2, 10, 1.6, chromeG(g, 3.4, 12.6));
    A.rect(g, 11, 138, 6, 2.2, '#555'); A.ell(g, 18, 139, 3.6, 3.6, '#b3231b'); A.ell(g, 18, 139, 2.4, 2.4, '#7a1611'); A.line(g, 14.8, 137, 21.2, 141, 'rgba(255,255,255,.3)', .6);
    A.streaks(g, 4, 144, 8, 40, 5, 3, 'rgba(120,76,36,.6)');
    A.rrect(g, 1.8, 40, 12.4, 3, 1, '#4f4d44'); A.rrect(g, 1.8, 196, 12.4, 3, 1, '#4f4d44');
    A.rrect(g, 0, h - 8, 16, 5, 1.2, '#5a5850'); A.glow(g, 8, h - 3, 9, 'rgba(120,70,30,.45)');
  }

  /* ---- towels on the wall rail 34 x 82 ---- */
  function bakeHooks(g, w, h) {
    A.rrect(g, 0, 0, w, 4.4, 1.2, A.lg(g, 0, 0, 0, 4.4, ['#b99b72', '#6f5236'])); A.rect(g, 0, 0, w, .8, 'rgba(255,255,255,.4)');
    [5, 17, 29].forEach(x => { tube(g, [[x, 2.4], [x, 7], [x + 2.6, 9.4]], 1.4, '#555', '#aaa', '#fff'); });
    // sagging damp towel on hook 2
    const sh = '#c2753e';
    g.fillStyle = A.lg(g, 8, 0, 26, 0, ['#8c4b22', '#d8894d', '#e39a60', '#a85c2c']);
    g.beginPath(); g.moveTo(9, 6); g.lineTo(26, 6); g.quadraticCurveTo(27.6, 40, 25.4, 72); g.lineTo(9.6, 74); g.quadraticCurveTo(8, 40, 9, 6); g.fill();
    for (let i = 0; i < 5; i++) { A.rect(g, 9, 20 + i * 2.6, 17, .9, 'rgba(255,240,215,.55)'); }
    for (let i = 0; i < 6; i++) A.line(g, 10 + i * 2.8, 74, 10 + i * 2.8, 79 + (i % 2) * 2, '#c78250', .9);
    A.streaks(g, 9, 8, 17, 66, 12, 6, 'rgba(60,30,10,.28)'); A.rect(g, 9, 62, 17, 12, 'rgba(30,24,16,.28)');
    mould(g, 9, 56, 17, 18, 13, 10, .5);
    A.rect(g, 8.4, 6, 1.4, 66, 'rgba(0,0,0,.28)');
    // washcloth + loofah on hook 3
    g.fillStyle = '#6a8fa3'; g.beginPath(); g.moveTo(27, 10); g.lineTo(33, 10); g.lineTo(33, 26); g.lineTo(27.6, 25); g.fill();
    g.fillStyle = '#c9ae63'; g.beginPath(); g.ellipse(4.6, 17, 2.6, 6, 0, 0, 7); g.fill(); A.line(g, 4.6, 11, 4.6, 23, 'rgba(90,70,20,.6)', .5);
  }
  /* ---- small high window (frame 60 x 44; wall hole is punched at wall x 400..450) ---- */
  function bakeWindow(g, w, h) {
    // sill with a tragic cactus, soap and cobweb
    A.rect(g, 0, 40, w, 4, A.lg(g, 0, 40, 0, 44, ['#e5e3d4', '#8d8b7a'])); A.rect(g, 0, 40, w, .8, '#fff');
    // frame (even-odd ring around the hole)
    g.save(); g.beginPath(); g.rect(1.5, 3, 57, 38); g.rect(5, 6, 50, 34); g.fillStyle = A.lg(g, 0, 0, 0, 44, ['#ece8d4', '#bdb9a2']); g.fill('evenodd'); g.restore();
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(5, 6, 50, 1.6); g.fillRect(5, 6, 1.6, 34);
    // glass (left sash closed, right sash tilted open)
    g.fillStyle = A.lg(g, 0, 6, 0, 40, ['rgba(150,190,215,.22)', 'rgba(100,140,170,.12)']); g.fillRect(6, 7, 23, 32);
    g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.moveTo(8, 7); g.lineTo(16, 7); g.lineTo(9, 30); g.lineTo(8, 30); g.fill();
    A.rect(g, 28.8, 6, 2.6, 34, A.lg(g, 28, 0, 32, 0, ['#c9c5ae', '#f2efe0', '#a6a28c']));
    g.fillStyle = '#d9d5c0'; g.beginPath(); g.moveTo(31.4, 7); g.lineTo(54, 7); g.lineTo(52.6, 12); g.lineTo(31.4, 12); g.fill();
    g.fillStyle = 'rgba(120,160,190,.2)'; g.beginPath(); g.moveTo(31.4, 12); g.lineTo(52.6, 12); g.lineTo(54, 38); g.lineTo(31.4, 38); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = .6; g.strokeRect(5, 6, 50, 34);
    // cobweb
    g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = .3; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(54.5, 7); g.lineTo(54.5 - 10 * Math.cos(i * .3), 7 + 10 * Math.sin(i * .32 + .1)); g.stroke(); }
    // plant
    A.rrect(g, 9, 34, 8, 6, 1.4, A.lg(g, 9, 0, 17, 0, ['#8a3f22', '#c86a3c', '#74321a'])); A.rect(g, 8.4, 33.4, 9.2, 1.6, '#a9532c');
    g.fillStyle = '#6b7a2e'; g.beginPath(); g.ellipse(13, 29, 2.3, 5.4, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(9.6, 31, 1.4, 3.2, -.5, 0, 7); g.fill(); g.fillStyle = '#a38a3a'; g.beginPath(); g.ellipse(13, 25, 1.6, 2, 0, 0, 7); g.fill();
    A.rrect(g, 44, 38, 8, 2.4, 1.2, '#cfd8c6');
    A.grain(g, 0, 0, w, h, .12, .5);
  }
  function dynWindow(g, t) {
    const r = srand(5); g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) { const x = 7 + r() * 22, y = 8 + r() * 30; g.fillStyle = 'rgba(210,235,250,.35)'; g.beginPath(); g.ellipse(x, y, .5, .8, 0, 0, TAU); g.fill();
      const ph = (t * .25 + r() * 3) % 1; if (ph < .08) sparkle(g, x, y, 1.6, .9 * (1 - ph / .08)); }
    g.restore();
    const ph = (t * .17) % 1; g.fillStyle = 'rgba(220,240,255,.5)'; g.fillRect(14.5, 8 + ph * 30, .5, 4 + ph * 3);
  }
  /* ---- vent with a lazy fan 28 x 28 ---- */
  function bakeVent(g, w, h) {
    A.rrect(g, 0, 0, w, h, 1.5, A.lg(g, 0, 0, 0, h, ['#dcdbc8', '#a9a894'])); A.rect(g, 2.4, 2.4, w - 4.8, h - 4.8, '#0a1213');
    A.rect(g, 0, 0, w, .8, '#fff'); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(2.4, 2.4, w - 4.8, 1.6);
    A.streaks(g, 0, h - 4, w, 6, 4, 6, 'rgba(90,70,40,.5)');
  }
  function dynVent(g, t) {
    g.save(); g.beginPath(); g.rect(2.4, 2.4, 23.2, 23.2); g.clip();
    for (let k = 0; k < 3; k++) { const a = t * 2.4 + k * 2.09; g.fillStyle = 'rgba(70,80,80,.8)'; g.beginPath(); g.moveTo(14, 14); g.arc(14, 14, 11, a, a + .7); g.fill(); }
    A.ell(g, 14, 14, 2, 2, '#202a2a'); g.restore();
    g.fillStyle = A.lg(g, 0, 2.4, 0, 25, ['#c9c7b3', '#8f8e7b']);
    for (let y = 4; y < 26; y += 3.8) { g.fillRect(2.4, y, 23.2, 1.6); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(2.4, y, 23.2, .4); g.fillStyle = A.lg(g, 0, 2.4, 0, 25, ['#c9c7b3', '#8f8e7b']); }
    g.strokeStyle = 'rgba(210,210,200,.7)'; g.lineWidth = .4; g.beginPath(); g.moveTo(4, 25.4); g.quadraticCurveTo(6, 30 + Math.sin(t * 1.2) * 1.5, 5, 33 + Math.sin(t * 1.7)); g.stroke();
  }
  /* ---- ceiling fluorescent: housing + self-lit tube, night light ---- */
  function bakeHousing(g, w, h) {
    A.rect(g, 0, 0, w, h, A.lg(g, 0, 0, 0, h, ['#a9afa8', '#6c726d', '#363a37'])); A.rect(g, 0, 0, w, .9, 'rgba(255,255,255,.4)');
    A.rect(g, 0, 0, 3, h, '#4a4f4a'); A.rect(g, w - 3, 0, 3, h, '#4a4f4a'); A.screws(g, [[7, 3.5], [w - 7, 3.5]], .8, '#222');
    A.blotches(g, 0, 0, w, h, 3, 6, 'rgba(120,72,30,.35)', 2, 5); A.streaks(g, 0, h - 2, w, 8, 4, 8, 'rgba(120,76,36,.5)');
    A.line(g, 20, h, 22, h + 3, 'rgba(0,0,0,.4)', .8);
  }
  function bakeTube(g, w, h) {
    A.rrect(g, 0, 0, 5, h, 1, '#caccc5'); A.rrect(g, w - 5, 0, 5, h, 1, '#caccc5');
    A.rrect(g, 4, .2, w - 8, h - .4, h / 2, A.lg(g, 0, 0, 0, h, ['#ffffff', '#d9f4fb', '#a5ccd6']));
  }
  function dynTube(g, t, S, o) {
    const f = tubeFlicker(t); g.save(); g.globalAlpha = clamp(.35 + .65 * f, 0, 1);
    g.globalCompositeOperation = 'lighter'; A.glow(g, 62, 2.5, 40, 'rgba(180,235,250,' + (.5 * f) + ')'); g.restore();
    if (f < .72) { g.fillStyle = 'rgba(20,40,50,' + (.5 * (1 - f / .72)) + ')'; g.fillRect(5, 0, 114, 5); }
  }
  function bakeNight(g, w, h) {
    A.glow(g, 5, 5, 11, 'rgba(255,150,70,.55)');
    A.rrect(g, 1, 1, 8, 10, 2, A.lg(g, 1, 0, 9, 0, ['#dcd7c6', '#a8a390'])); A.rrect(g, 2.2, 2.2, 5.6, 4.6, 1.6, A.rg(g, 5, 4.5, 0, 3.4, ['#fff2c0', '#ff9d48']));
    A.rect(g, 3, 7.6, 4, .5, '#777'); A.rect(g, 3, 9, 4, .5, '#777');
  }
  /* ---- wall-hung sink 66 x 30 (heights 62..92) ---- */
  function bakeSink(g, w, h) {
    A.rrect(g, 3, 0, w - 6, 6, 1.6, A.lg(g, 0, 0, 0, 6, ['#fbfdfc', '#c3d0cd']));                      // back lip
    A.rect(g, 3, 5, w - 6, 1.6, 'rgba(0,0,0,.2)');
    // front bowl body
    g.beginPath(); g.moveTo(.8, 9.4); g.bezierCurveTo(1, 16, 8, 27, 24, 29.4); g.lineTo(42, 29.4); g.bezierCurveTo(58, 27, 65, 16, 65.2, 9.4); g.closePath();
    g.fillStyle = A.lg(g, 0, 0, w, 0, ['#9db0ac', '#e6eeec', '#f7fbf9', '#d0dcd9', '#8ea19d']); g.fill();
    g.fillStyle = A.lg(g, 0, 9, 0, 29, ['rgba(0,0,0,.0)', 'rgba(0,0,0,.28)']); g.fill();
    // rim ring + basin
    A.ell(g, 33, 9.2, 32.4, 6.2, A.lg(g, 0, 3, 0, 15, ['#ffffff', '#cdd9d6']));
    A.ell(g, 33, 9.8, 28, 4.7, A.lg(g, 0, 5, 0, 14, ['#6d8582', '#c9d8d5']));
    A.ell(g, 33, 9.8, 28, 4.7, A.rg(g, 33, 8, 3, 29, ['rgba(255,255,255,0)', 'rgba(0,0,0,.18)']));
    g.strokeStyle = 'rgba(190,168,104,.55)'; g.lineWidth = .9; g.beginPath(); g.ellipse(33, 10, 24, 3.7, 0, 0, TAU); g.stroke();   // limescale line
    A.ell(g, 33, 11.4, 3.4, 1.1, '#2c3638'); A.ell(g, 33, 11.1, 2.5, .7, '#8c9a9d');                        // drain
    // overflow hole, rust trail from faucet to drain, hair
    A.ell(g, 33, 6.2, 2, .7, '#445');
    g.fillStyle = A.lg(g, 20, 6, 33, 11, ['rgba(150,80,30,0)', 'rgba(150,80,30,.6)']); g.beginPath(); g.moveTo(19, 6); g.lineTo(24, 6); g.lineTo(34, 11); g.lineTo(31, 12); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(30,24,16,.8)'; g.lineWidth = .35; g.beginPath(); g.moveTo(35, 11); g.quadraticCurveTo(40, 8, 44, 11); g.moveTo(36, 12); g.quadraticCurveTo(41, 13, 46, 10.6); g.stroke();
    A.specks(g, 8, 8, 50, 4, 5, 18, 'rgba(240,244,236,.7)', 1);                                              // toothpaste / soap specks
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1; g.beginPath(); g.ellipse(33, 9.2, 31.6, 5.7, 0, 3.4, 6.05); g.stroke();
    A.streaks(g, 8, 11, 50, 18, 6, 8, 'rgba(120,96,50,.28)'); A.blotches(g, 2, 12, 62, 16, 7, 5, 'rgba(60,50,30,.16)', 3, 9);
    A.grain(g, 0, 0, w, h, .1, .5);
  }
  function dynSink(g, t, S) {
    const f = F(S), on = f.faucetOn || f.faucetHowl, howl = f.faucetHowl && !f.faucetFixed;
    if (!on) { const u = (t % 1.7) / 1.7; if (!f.faucetFixed && u > .94) ripple(g, t, 22, 10.8, 5, .5, 1); return; }
    g.fillStyle = f.faucetFixed ? 'rgba(165,215,236,.55)' : howl ? 'rgba(215,235,240,.7)' : 'rgba(160,170,140,.55)';
    g.beginPath(); g.ellipse(33, 10.2, 25.5, 3.7, 0, 0, TAU); g.fill();
    ripple(g, t, 22, 10.6, f.faucetFixed ? 6 : 10, .7, 3);
    if (howl) {
      for (let k = 0; k < 14; k++) { const u = (t * 2.2 + k * .17) % 1, side = k % 2 ? 1 : -1, x = 22 + side * (3 + u * (10 + (k * 7) % 22)), y = 8 - Math.sin(u * 3.14) * (10 + (k * 5) % 12) + u * u * 14; g.fillStyle = 'rgba(235,248,255,' + (.8 * (1 - u * .6)) + ')'; g.beginPath(); g.arc(x, y, .5 + (k % 3) * .35, 0, TAU); g.fill(); }
      g.save(); g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 9; k++) { const x = 8 + k * 6 + Math.sin(t * 9 + k) * 2; A.glow(g, x, 8 + Math.sin(t * 13 + k) * 1.5, 4, 'rgba(230,248,255,.35)'); } g.restore();
    }
  }

  /* ---- faucet (hero prop) 44 x 50, bottom at height 70 ---- */
  function mkFaucet(fixed) {
    return (g, w, h) => {
      const rot = fixed ? 0 : .26;
      // deck plate + AO onto the rim
      A.ell(g, 22, 36, 21, 2.2, 'rgba(0,0,0,.28)');
      A.rrect(g, 3, 31, 38, 4.6, 1.8, chromeG(g, 3, 41)); A.rect(g, 4, 31, 36, .8, '#fff');
      // left handle (cold)
      A.rrect(g, 5.3, 24, 4.4, 7.4, 1, chromeG(g, 5.3, 9.7)); A.rrect(g, 1.2, 21.4, 12.6, 4.8, 2.2, chromeG(g, 1.2, 13.8)); A.rect(g, 2, 21.8, 11, .7, '#fff');
      A.ell(g, 7.5, 21.6, 1.7, 1.2, '#2a6bd0');
      // right handle (hot) - crooked + screw cap missing when broken
      g.save(); g.translate(35.8, 31); g.rotate(rot);
      A.rrect(g, -2.2, -7.6, 4.4, 8, 1, chromeG(g, -2.2, 2.2)); A.rrect(g, -6.4, -10.4, 12.6, 4.8, 2.2, chromeG(g, -6.4, 6.2)); A.rect(g, -5.6, -10, 11, .7, '#fff');
      if (fixed) A.ell(g, -.2, -10.2, 1.7, 1.2, '#c4261c'); else { A.ell(g, -.2, -10.2, 1.5, 1.1, '#241a14'); A.line(g, -1, -10, 1, -9.2, '#887', .5); }
      g.restore();
      // body
      A.rrect(g, 16, 17, 12, 15, 2.6, chromeG(g, 16, 28)); A.rect(g, 16.6, 17, 10.8, .8, '#fff');
      // spout
      const sp = (col, wd, dx) => { g.strokeStyle = col; g.lineWidth = wd; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(22 + dx, 19); g.lineTo(22 + dx, 10); g.quadraticCurveTo(22 + dx, 4.4, 16.4 + dx, 4.4); g.quadraticCurveTo(11 + dx, 4.4, 11 + dx, 10); g.lineTo(11 + dx, 19.5); g.stroke(); };
      sp('#2d383d', 5.8, 0); sp('#a3b3ba', 4.2, -.1); sp('#e9f2f5', 1.5, -.6);
      A.rrect(g, 8, 19, 6, 3.4, 1.2, '#8e9da3'); for (let i = 0; i < 3; i++) A.line(g, 9 + i * 1.8, 19.3, 9 + i * 1.8, 22, 'rgba(0,0,0,.4)', .4);
      // nut
      if (fixed) { hexNut(g, 22, 19.8, 11.5, 4.8, 0); }
      else {
        g.fillStyle = '#6b5a2a'; g.fillRect(17.4, 19.6, 9.2, 3.4);                                                // exposed brass thread in the gap
        for (let i = 0; i < 5; i++) A.line(g, 17.6 + i * 2, 19.6, 18.4 + i * 2, 23, 'rgba(210,180,90,.75)', .5);
        A.rect(g, 16, 23, 12, .9, 'rgba(0,0,0,.45)');
        hexNut(g, 23.4, 17.4, 11.5, 4.8, -.2);
        g.fillStyle = 'rgba(130,60,20,.6)'; g.beginPath(); g.ellipse(24.4, 22.4, 3.4, 1.1, 0, 0, TAU); g.fill();
        A.streaks(g, 16.5, 22.5, 11, 9, 4, 4, 'rgba(140,70,26,.6)');
        g.fillStyle = 'rgba(210,235,248,.75)'; g.beginPath(); g.ellipse(26.6, 20.2, .7, 1.1, 0, 0, TAU); g.fill();
      }
      A.grain(g, 0, 0, w, h, .06, .4);
    };
  }
  function dynFaucet(g, t, S, o) {
    const f = F(S), on = f.faucetOn || f.faucetHowl, fixed = f.faucetFixed, howl = f.faucetHowl && !fixed;
    const nx = 24.8, ny = fixed ? 21 : 20.6;
    if (on) {
      if (fixed) water(g, t, 11, 22, 45, 'calm');
      else if (howl) {
        g.save();
        for (let k = 0; k < 18; k++) {
          const a = Math.PI / 2 + (k / 17 - .5) * 1.9 + Math.sin(t * 31 + k * 2) * .12, L = 12 + ((t * 38 + k * 13) % 26);
          g.strokeStyle = 'rgba(232,247,255,' + (.7 - (L / 60)) + ')'; g.lineWidth = 1.5 - (k % 3) * .35; g.beginPath(); g.moveTo(11, 22); g.lineTo(11 + Math.cos(a) * L, 22 + Math.sin(a) * L * 1.5); g.stroke();
        }
        water(g, t, 11, 22, 45, 'sput');
        for (let k = 0; k < 16; k++) {
          const u = (t * 1.5 + k / 16) % 1, side = k % 2 ? 1 : -1, x = 11 + side * (5 + u * (22 + (k * 9) % 30)), y = 22 + 80 * u * u - 20 * u;
          g.fillStyle = 'rgba(232,246,255,' + (.8 * (1 - u * .7)) + ')'; g.beginPath(); g.arc(x, y, .6 + (k % 4) * .3, 0, TAU); g.fill();
        }
        // jets out of the loose nut
        for (let k = 0; k < 6; k++) { const L = 8 + ((t * 44 + k * 9) % 14); g.strokeStyle = 'rgba(240,250,255,.7)'; g.lineWidth = .8; g.beginPath(); g.moveTo(nx, 19); g.lineTo(nx + L, 19 - L * .35 + L * L * .012); g.stroke(); }
        steamWisps(g, t, -10, -34, 64, 54, 9, .30, 2);
        // vibration marks
        g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = .8; g.lineCap = 'round';
        for (let k = 0; k < 3; k++) { const o2 = Math.sin(t * 50 + k) * .8; g.beginPath(); g.arc(22, 14, 18 + k * 3.4 + o2, 3.6, 4.7); g.stroke(); g.beginPath(); g.arc(22, 14, 18 + k * 3.4 - o2, -1.55, -.45); g.stroke(); }
        g.restore();
      } else water(g, t, 11, 22, 45, 'sput');
      // splash at the impact point
      g.fillStyle = 'rgba(240,252,255,.7)'; for (let k = 0; k < (howl ? 8 : 4); k++) { const u = (t * 3 + k * .27) % 1; g.beginPath(); g.arc(11 + (k % 2 ? 1 : -1) * u * (howl ? 9 : 4), 46 - Math.sin(u * 3.14) * (howl ? 7 : 3), .5, 0, TAU); g.fill(); }
    }
    if (!fixed) {
      const P = 1.55, u = (t % P) / P;                                       // leak from the loose nut runs down the body into the basin
      if (u < .5) { const k = u / .5; g.fillStyle = 'rgba(200,232,248,.9)'; g.beginPath(); g.ellipse(27.2, 22.4 + k * 1.2, .5 + k * .5, .8 + k, 0, 0, TAU); g.fill(); }
      else { const v = (u - .5) / .5, y = 23.6 + 22 * v * v; g.fillStyle = 'rgba(200,232,248,.9)'; g.beginPath(); g.moveTo(27.2, y - 2.4); g.quadraticCurveTo(28.3, y, 27.2, y + .9); g.quadraticCurveTo(26.1, y, 27.2, y - 2.4); g.fill(); }
      // misaligned parts catch a glint: pulsing hint on the nut
      const ph = (t * .42) % 1; if (ph < .22) sparkle(g, nx - 1, ny - 2.4, 3.2, Math.sin(ph / .22 * Math.PI) * .95);
    } else { const ph = (t * .3) % 1; if (ph < .12) sparkle(g, 16, 7, 2.2, Math.sin(ph / .12 * Math.PI) * .9); }
  }
  /* items on the sink rim */
  function bakeSinkItems(g, w, h) {
    // glass with toothbrushes
    A.line(g, 8.6, 14, 6.4, 3, '#c43a2a', 1.3); A.line(g, 10.6, 14, 12.6, 4, '#2c6fc4', 1.3); A.rect(g, 5.6, 1.4, 1.8, 2.8, '#eee'); A.rect(g, 11.8, 2.2, 1.8, 2.8, '#eee');
    g.fillStyle = 'rgba(190,225,235,.35)'; g.beginPath(); g.moveTo(5.2, 9); g.lineTo(14.2, 9); g.lineTo(13.4, 21); g.lineTo(6, 21); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = .7; g.stroke(); A.rect(g, 6.2, 17.5, 7, 3, 'rgba(120,150,150,.4)'); A.rect(g, 6.6, 9.4, .8, 10, 'rgba(255,255,255,.7)');
    // toothpaste tube (squeezed in the middle)
    g.fillStyle = '#e8e8e0'; g.beginPath(); g.moveTo(17, 19); g.lineTo(27, 17); g.lineTo(28, 20.4); g.lineTo(18, 21.6); g.fill(); A.rect(g, 17.4, 18.8, 3, 2.2, '#1f66b8'); A.rect(g, 27, 17.3, 2.4, 3, '#cc3b2b');
    // soap dish
    A.rrect(g, 50, 18.4, 13, 3, 1.4, '#e9f0ed'); A.rrect(g, 52, 14.2, 8.4, 5, 2, A.lg(g, 0, 14, 0, 19, ['#efe0a8', '#bba46a'])); A.ell(g, 56, 14.4, 3.6, .8, 'rgba(255,255,255,.6)');
  }
  /* pipes under the sink 40 x 66 (heights 0..66), z 134 */
  function bakePlumb(g, w, h) {
    // supply hoses + angle valves
    tube(g, [[4, 0], [4, 12]], 2.2, '#2b2b2b', '#5a8fc9', '#bcd8f5'); tube(g, [[36, 0], [36, 12]], 2.2, '#2b2b2b', '#c9584a', '#f5c8c0');
    [4, 36].forEach((x, i) => { A.rrect(g, x - 3, 11, 6, 8, 1.4, chromeG(g, x - 3, x + 3)); A.rrect(g, x - 1.4, 18.6, 2.8, 4, .8, '#9aa'); A.ell(g, x + (i ? 4 : -4), 14.6, 1.6, 1.6, i ? '#c2261c' : '#2467c8'); });
    A.streaks(g, 0, 20, 8, 20, 3, 3, 'rgba(120,80,40,.45)');
    // trap
    tube(g, [[20, 0], [20, 31], [22, 37], [28, 38], [31, 32], [31, 24], [40, 24]], 3.8, '#8d9588', '#e3e7d8', '#ffffff');
    hexNut(g, 20, 12, 6.4, 3, 0, [210, 214, 200]); hexNut(g, 31, 28, 6.4, 3, Math.PI / 2, [210, 214, 200]);
    g.fillStyle = 'rgba(150,120,40,.4)'; g.fillRect(18.2, 14, 3.6, 16); g.fillStyle = 'rgba(90,70,30,.35)'; g.beginPath(); g.ellipse(26, 38.2, 4.5, 1, 0, 0, TAU); g.fill();
    // rag on the pipe
    g.fillStyle = '#b79aa0'; g.beginPath(); g.moveTo(14, 18); g.lineTo(27, 19); g.lineTo(25, 33); g.lineTo(19, 30); g.lineTo(15, 35); g.closePath(); g.fill(); A.rect(g, 14.4, 18.2, 12, .8, 'rgba(255,255,255,.4)'); A.streaks(g, 14, 19, 12, 14, 5, 3, 'rgba(60,40,40,.4)');
    // leak bowl on the floor
    A.ell(g, 25, 63, 12, 2.8, 'rgba(0,0,0,.4)'); A.ell(g, 25, 61.4, 11.5, 3.4, '#cfd6d0'); A.ell(g, 25, 61.8, 10, 2.6, '#2e3c40'); A.ell(g, 25, 62.4, 9, 1.8, 'rgba(90,120,120,.9)');
    A.rect(g, 13.6, 61.4, 22, 3.4, 'rgba(180,190,184,.0)');
  }
  function dynPlumb(g, t) {
    const P = 1.3, u = (t % P) / P, x = 26;
    if (u < .45) { const k = u / .45; g.fillStyle = 'rgba(210,235,246,.9)'; g.beginPath(); g.ellipse(x, 39 + k, .5 + k * .5, .7 + k, 0, 0, TAU); g.fill(); }
    else { const v = (u - .45) / .55, y = 40 + 21 * v * v; g.fillStyle = 'rgba(210,235,246,.9)'; g.beginPath(); g.moveTo(x, y - 2.2); g.quadraticCurveTo(x + 1, y, x, y + .8); g.quadraticCurveTo(x - 1, y, x, y - 2.2); g.fill(); }
    ripple(g, t - .6, x, 62, 5, .6, 1);
  }

  /* ---- mirror cabinet 56 x 84 (heights 122..206) ---- */
  function mkMirror(clean) {
    return (g, w, h) => {
      A.rrect(g, 0, 0, w, h, 2.2, A.lg(g, 0, 0, w, 0, ['#c3cac4', '#f1f3ee', '#bec5bf']));
      const mx = 3, my = 3, mw = 50, mh = 78;
      g.save(); g.beginPath(); g.rect(mx, my, mw, mh); g.clip();
      if (clean) {
        g.fillStyle = A.lg(g, mx, my, mx + mw, my + mh, ['#d6e8e8', '#9dbcc1', '#7aa0a8', '#b8d2d4']); g.fillRect(mx, my, mw, mh);
        g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(mx + 6, my + 7, 38, 2.2);                               // reflection of the tube
        g.strokeStyle = 'rgba(40,70,70,.14)'; g.lineWidth = .5; for (let x = mx; x < mx + mw; x += 15) { g.beginPath(); g.moveTo(x, my); g.lineTo(x, my + mh); g.stroke(); } for (let y = my; y < my + mh; y += 15) { g.beginPath(); g.moveTo(mx, y); g.lineTo(mx + mw, y); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(mx + 14, my); g.lineTo(mx + 30, my); g.lineTo(mx + 6, my + mh); g.lineTo(mx - 6, my + mh); g.fill();
        g.fillStyle = 'rgba(20,50,60,.30)'; g.beginPath(); g.ellipse(mx + 30, my + 60, 8, 14, 0, 0, TAU); g.fill();    // blurred silhouette (the hero's shape)
        A.ell(g, mx + 30, my + 44, 5, 5.5, 'rgba(20,50,60,.30)');
      } else {
        g.fillStyle = A.lg(g, mx, my, mx + mw, my + mh, ['#8a9b98', '#667a78', '#566a69']); g.fillRect(mx, my, mw, mh);
        A.blotches(g, mx, my, mw, mh, 9, 24, 'rgba(225,228,215,.30)', 6, 18); A.blotches(g, mx, my, mw, mh, 10, 10, 'rgba(50,38,24,.28)', 4, 12);
        A.glow(g, mx, my + mh, 26, 'rgba(34,26,16,.6)'); A.glow(g, mx + mw, my, 20, 'rgba(34,26,16,.5)');
        A.streaks(g, mx, my, mw, mh, 11, 14, 'rgba(235,240,228,.30)'); A.specks(g, mx + 6, my + 30, 38, 22, 12, 26, 'rgba(250,250,240,.8)', 1.2);
        g.strokeStyle = 'rgba(245,245,235,.20)'; g.lineWidth = 2; g.lineCap = 'round'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(mx + 15 + i * 6, my + 48, 8 + i, 3.4, 5.6); g.stroke(); }
        // chipped corner + crack
        g.fillStyle = '#2a1d14'; g.beginPath(); g.moveTo(mx, my + mh); g.lineTo(mx + 11, my + mh); g.lineTo(mx + 7, my + mh - 5); g.lineTo(mx + 2, my + mh - 11); g.lineTo(mx, my + mh - 9); g.fill();
        g.fillStyle = '#6a4a30'; g.fillRect(mx, my + mh - 3, 9, 1.4);
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = .5; [[mx + mw, my + 18, mx + 36, my + 34], [mx + 36, my + 34, mx + 28, my + 33], [mx + 36, my + 34, mx + 38, my + 46], [mx + 36, my + 34, mx + 30, my + 40]].forEach(l => { g.beginPath(); g.moveTo(l[0], l[1]); g.lineTo(l[2], l[3]); g.stroke(); });
        g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(mx + 10, my); g.lineTo(mx + 20, my); g.lineTo(mx + 2, my + 40); g.lineTo(mx, my + 40); g.lineTo(mx, my + 20); g.fill();
      }
      g.restore();
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.strokeRect(mx, my, mw, mh); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = .5; g.strokeRect(mx - .6, my - .6, mw + 1.2, mh + 1.2);
      A.rrect(g, w - 2.6, 36, 1.6, 12, .8, '#8b8f88'); A.screws(g, [[1.6, 10], [1.6, 74]], .7, '#777');
      A.bevel(g, 0, 0, w, h, 'rgba(255,255,255,.5)', 'rgba(0,0,0,.25)');
      A.streaks(g, 0, 68, w, 16, 13, 4, 'rgba(110,76,36,.35)'); mould(g, 0, 74, 56, 10, 14, 10, .5);
    };
  }
  function dynMirror(g, t, S) {
    if (F(S).mirrorDone) {
      const ph = (t * .23) % 1; if (ph < .35) { const x = 3 + (ph / .35) * 70 - 20; g.save(); g.beginPath(); g.rect(3, 3, 50, 78); g.clip(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.moveTo(x, 3); g.lineTo(x + 7, 3); g.lineTo(x - 13, 81); g.lineTo(x - 20, 81); g.fill(); g.restore(); }
      const ph2 = (t * .4) % 1; if (ph2 < .1) sparkle(g, 44, 12, 3, Math.sin(ph2 / .1 * Math.PI));
    } else {
      for (let i = 0; i < 4; i++) { const P = 7 + i * 2.3, u = ((t + i * 3.1) % P) / P; if (u < .6) { const x = 10 + i * 11 + (i % 2) * 3, y = 6 + u / .6 * 60; g.fillStyle = 'rgba(210,230,236,.4)'; g.fillRect(x, y - 8 * u, .5, 8 * u); g.fillStyle = 'rgba(235,248,252,.8)'; g.beginPath(); g.ellipse(x + .25, y, .7, 1, 0, 0, TAU); g.fill(); } }
    }
  }
  function bakeVanity(g, w, h) {
    A.rrect(g, 0, 0, w, h, 1.6, A.lg(g, 0, 0, 0, h, ['#ffffff', '#cfe9ee'])); A.rect(g, 0, h - 1.2, w, 1.2, 'rgba(0,0,0,.3)');
    A.rect(g, 0, 0, 2.5, h, '#9aa49f'); A.rect(g, w - 2.5, 0, 2.5, h, '#9aa49f');
    A.glow(g, w / 2, h, 20, 'rgba(210,240,245,.4)'); A.specks(g, 4, 1, w - 8, h - 2, 3, 8, 'rgba(60,70,40,.5)', .8);
  }
  function dynVanity(g, t) { const f = 1 - .15 * (.5 + .5 * Math.sin(t * 37 + 2300) * Math.sin(t * 5.3)); g.fillStyle = 'rgba(0,0,0,' + (1 - f) * 1.5 + ')'; g.fillRect(0, 0, 48, 6); }
  function bakeBin(g, w, h) {
    g.fillStyle = A.lg(g, 0, 0, w, 0, ['#9ea6a2', '#e9eeea', '#c9d0cb', '#8e9692']); g.beginPath(); g.moveTo(1, 6); g.lineTo(w - 1, 6); g.lineTo(w - 3, h); g.lineTo(3, h); g.fill();
    A.rrect(g, 0, 3, w, 4, 2, A.lg(g, 0, 3, 0, 7, ['#f4f7f4', '#b9c1bd'])); A.ell(g, w / 2, 3, w / 2 - 1, 1.5, '#222');
    // tissues + packaging overflowing
    g.fillStyle = '#f0f0e8'; [[5, 3, 4, 5], [10, 1, 5, 6], [15, 3, 4, 5]].forEach(([x, y, a, b]) => { g.beginPath(); g.moveTo(x, y + b); g.quadraticCurveTo(x + a * .3, y - 1, x + a, y + b); g.fill(); });
    A.rect(g, 12, 0, 3, 4, '#d4402e');
    A.streaks(g, 2, 8, w - 4, h - 8, 3, 3, 'rgba(70,60,30,.3)'); A.rect(g, w - 5, 8, .8, h - 10, 'rgba(255,255,255,.4)');
  }

  /* ================================================================ TOILET */
  const dirtCache = {};
  function dirtLayer() {
    return dirtCache.v || (dirtCache.v = BB.bake(42, 46, (g, w, h) => {
      g.strokeStyle = 'rgba(150,108,44,.75)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(21, 9.4, 13.4, 4, 0, 0, TAU); g.stroke();      // limescale ring
      g.fillStyle = 'rgba(105,120,40,.55)'; g.beginPath(); g.ellipse(21, 10.8, 9.5, 2.5, 0, 0, TAU); g.fill();                              // murky water
      A.streaks(g, 4, 11, 34, 24, 21, 12, 'rgba(126,92,40,.55)'); A.streaks(g, 8, 9, 26, 6, 22, 4, 'rgba(90,64,30,.6)');
      A.blotches(g, 3, 4, 36, 12, 23, 9, 'rgba(110,88,34,.45)', 2, 6);                                                                  // seat stains
      A.specks(g, 3, 3, 36, 7, 24, 30, 'rgba(60,40,18,.85)', 1.2); A.glow(g, 21, 44, 18, 'rgba(50,46,20,.5)');
      mould(g, 6, 34, 30, 12, 25, 22, .8); A.grain(g, 0, 0, w, h, .1, .5);
    }));
  }
  function bakeBowl(g, w, h) {
    // bowl body + pedestal
    g.beginPath(); g.moveTo(1.2, 9); g.bezierCurveTo(.4, 22, 8, 33, 13, 36); g.lineTo(12.4, 41); g.lineTo(8.8, 43); g.lineTo(8.8, 45.6); g.lineTo(33.2, 45.6); g.lineTo(33.2, 43); g.lineTo(29.6, 41); g.lineTo(29, 36); g.bezierCurveTo(34, 33, 41.6, 22, 40.8, 9); g.closePath();
    g.fillStyle = A.lg(g, 0, 0, w, 0, ['#9bacaa', '#e9f1ef', '#fafdfc', '#d0dcd9', '#8c9e9b']); g.fill();
    g.fillStyle = A.lg(g, 0, 10, 0, 45, ['rgba(0,0,0,0)', 'rgba(0,0,0,.30)']); g.fill();
    A.rect(g, 12.6, 36, 17, 1.3, 'rgba(0,0,0,.25)');
    A.ell(g, 21, 45.3, 14, 1.4, 'rgba(0,0,0,.35)');
    // seat ring + opening (lid missing, hinge stubs left)
    A.ell(g, 21, 8.4, 20, 6.6, A.lg(g, 1, 0, 41, 0, ['#c7d3d0', '#fbfdfc', '#dfe8e5', '#aab9b6']));
    A.ell(g, 21, 8.8, 14.8, 4.5, A.lg(g, 0, 4, 0, 13, ['#ced9d6', '#8da09d']));
    A.ell(g, 21, 9.6, 12.6, 3.6, A.lg(g, 0, 6, 0, 13, ['#304043', '#5b7c82']));
    A.ell(g, 21, 11, 8.4, 2, 'rgba(150,205,215,.8)'); A.ell(g, 19, 10.4, 4, .6, 'rgba(255,255,255,.6)');
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1; g.beginPath(); g.ellipse(21, 8.4, 19.4, 6.1, 0, 3.4, 6.0); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = .7; g.beginPath(); g.ellipse(21, 8.8, 14.8, 4.5, 0, .2, 2.9); g.stroke();
    A.rrect(g, 9, .8, 4, 2.6, .8, chromeG(g, 9, 13)); A.rrect(g, 29, .8, 4, 2.6, .8, chromeG(g, 29, 33));
    A.grain(g, 0, 0, w, h, .06, .4);
  }
  function dynBowl(g, t, S) {
    const f = F(S), clean = clamp(f.toiletClean || 0, 0, 1);
    if (clean < 1) { g.save(); g.globalAlpha = 1 - clean; g.drawImage(dirtLayer(), 0, 0, 42, 46); g.restore(); }
    if (f.toiletFlush) {
      g.save(); g.beginPath(); g.ellipse(21, 9.6, 13.6, 4.2, 0, 0, TAU); g.clip();
      g.fillStyle = 'rgba(140,205,225,.92)'; g.fillRect(6, 4, 30, 12);
      for (let k = 0; k < 5; k++) { const a = t * 7 + k * 1.26; g.strokeStyle = 'rgba(255,255,255,' + (.75 - k * .08) + ')'; g.lineWidth = 1.1; g.beginPath(); g.ellipse(21, 10.2, 12 - k * 2.1, 3.4 - k * .6, a, a, a + 2.1); g.stroke(); }
      g.fillStyle = '#1b2a2e'; g.beginPath(); g.ellipse(21 + Math.cos(t * 7) * .6, 10.6, 2.2, .7, 0, 0, TAU); g.fill();
      for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(21 + Math.cos(t * 5 + k * .8) * (3 + k), 9.8 + Math.sin(t * 5 + k) * 1.2, .5, 0, TAU); g.fill(); }
      g.restore();
      g.strokeStyle = 'rgba(190,230,245,.6)'; g.lineWidth = .7; g.beginPath(); g.ellipse(21, 8.8, 14.9, 4.6, 0, 0, TAU); g.stroke();
    }
    if (clean >= 1) {
      g.save(); g.globalAlpha = .75; g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(5, 16); g.quadraticCurveTo(4, 24, 9, 30); g.stroke(); g.beginPath(); g.moveTo(37, 16); g.quadraticCurveTo(38, 22, 35, 27); g.stroke(); g.restore();
      [[8, 6], [34, 5], [20, 13], [12, 22]].forEach(([x, y], i) => { const ph = (t * .55 + i * .27) % 1; if (ph < .16) sparkle(g, x, y, 2.6, Math.sin(ph / .16 * Math.PI)); });
    } else if (clean > 0) { g.save(); g.globalAlpha = clean * .6; g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo(5, 16); g.quadraticCurveTo(4, 24, 9, 30); g.stroke(); g.restore(); }
  }
  function mkTank(fixed) {
    return (g, w, h) => {
      A.rrect(g, 0, 3, w, h - 3, 2.6, porc(g, 0, w));
      g.fillStyle = A.lg(g, 0, 3, 0, h, ['rgba(255,255,255,0)', 'rgba(0,0,0,.18)']); g.fillRect(0, 3, w, h - 3);
      A.rrect(g, -1, 0, w + 2, 5.4, 2.4, A.lg(g, 0, 0, 0, 5.4, ['#fcfefd', '#c5d3d0'])); A.rect(g, 0, 0, w, .8, '#fff');
      A.rect(g, 0, 5.4, w, 1.2, 'rgba(0,0,0,.18)');
      // flush plate (centre 22, 17.5)
      if (fixed) {
        A.rrect(g, 12.5, 11, 19, 12.6, 2.4, '#bcc9c6'); A.rrect(g, 13, 11.5, 18, 11.6, 2.2, A.lg(g, 0, 11, 0, 23, ['#ffffff', '#dfe8e5']));
        A.ell(g, 18, 17.3, 3, 3, chromeG(g, 15, 21)); A.ell(g, 18, 16.8, 2.3, 2.3, A.rg(g, 17.4, 16.2, 0, 2.4, ['#ffffff', '#9fb0b4']));
        A.ell(g, 26.2, 17.3, 4, 4, chromeG(g, 22, 30)); A.ell(g, 26.2, 16.8, 3.2, 3.2, A.rg(g, 25.4, 16, 0, 3.4, ['#ffffff', '#9fb0b4']));
        A.screws(g, [[14.6, 12.8], [29.4, 12.8]], .6, '#8a979a');
      } else {
        g.save(); g.translate(14.5, 12.6); g.rotate(-.13);
        A.rrect(g, -2, -1.6, 19.4, 12.6, 2.2, '#8b8573'); A.rrect(g, -1.6, -1.2, 18.6, 11.8, 2, A.lg(g, 0, -1, 0, 11, ['#ece6c8', '#c2bb98']));
        g.strokeStyle = 'rgba(60,50,30,.7)'; g.lineWidth = .5; g.beginPath(); g.moveTo(12, -1); g.lineTo(10.5, 3); g.lineTo(13, 6); g.lineTo(11.4, 10.6); g.stroke();
        A.ell(g, 3.6, 5.6, 3.2, 3.2, '#1a1612'); g.strokeStyle = '#a7a28f'; g.lineWidth = .5; g.beginPath(); for (let i = 0; i < 5; i++) { g.lineTo(2 + (i % 2) * 3.2, 3.4 + i * .9); } g.stroke();   // missing button -> spring
        g.save(); g.translate(11.6, 5.6); g.rotate(.22); A.ell(g, 0, 1.4, 3.6, 3.3, '#7b765f'); A.ell(g, 0, 0.6, 3.6, 3.3, A.lg(g, 0, -3, 0, 3, ['#efe9cc', '#c4bd9b'])); A.rect(g, -4, -.4, 8, 1.5, 'rgba(120,128,130,.8)'); g.restore();   // sunken cracked button + tape
        A.ell(g, 15.6, 1.2, .8, .8, '#b99a3b'); A.ell(g, 15.4, 1.2, .35, .35, '#fff6');
        g.restore();
        A.ell(g, 12.4, 22.6, .8, .8, '#caa13a');                                                                       // loose screw
        g.strokeStyle = '#8f999c'; g.lineWidth = .8; for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(18.4 + (i % 2) * .6, 23.8 + i * 1.8, .8, .5, 0, 0, TAU); g.stroke(); }  // chain dangling from the missing button
        A.rect(g, 12.8, 25.5, 4, 1, 'rgba(0,0,0,.2)');
      }
      A.streaks(g, 2, 6, w - 4, h - 6, 31, 10, 'rgba(150,120,60,.34)'); A.blotches(g, 0, 20, w, 24, 32, 6, 'rgba(70,60,30,.14)', 3, 9);
      g.fillStyle = 'rgba(80,100,100,.5)'; g.font = 'bold 3px sans-serif'; g.fillText('ЭКОНОМ', 3.4, h - 3);
      mould(g, 2, h - 6, w - 4, 6, 33, 5, .35); A.bevel(g, 0, 3, w, h - 3, 'rgba(255,255,255,.4)', 'rgba(0,0,0,.2)'); A.grain(g, 0, 0, w, h, .08, .5);
    };
  }
  function dynTank(g, t, S, o) {
    const f = F(S);
    if (f.toiletFlush) {
      g.strokeStyle = 'rgba(210,240,250,.7)'; g.lineWidth = .7; g.lineCap = 'round';
      for (let k = 0; k < 3; k++) { const a = Math.sin(t * 40 + k) * .6; g.beginPath(); g.arc(22, 20, 25 + k * 3 + a, 2.7, 3.45); g.stroke(); g.beginPath(); g.arc(22, 20, 25 + k * 3 - a, -.3, .45); g.stroke(); }
      g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(22, 17.4, 8, 5.6, 0, 0, TAU); g.fill();
    } else if (!f.flushFixed) {
      const ph = (t * .38) % 1; if (ph < .2) sparkle(g, 24, 16, 3.4, Math.sin(ph / .2 * Math.PI) * .95);
    }
  }
  function bakeKit(g, w, h) {
    // brush stand
    A.ell(g, 9, 45.4, 8, 1.6, 'rgba(0,0,0,.35)');
    g.fillStyle = A.lg(g, 2, 0, 16, 0, ['#8e9895', '#e5ebe8', '#a2adaa']); g.beginPath(); g.moveTo(2, 22); g.lineTo(16, 22); g.lineTo(14.6, 45); g.lineTo(3.4, 45); g.closePath(); g.fill();
    A.ell(g, 9, 22, 7, 1.7, '#cfd8d5'); A.ell(g, 9, 22.4, 5.8, 1.1, '#2a2e2c');
    A.line(g, 9, 22, 11.2, 3, '#444a49', 1.6); A.line(g, 9, 22, 11.2, 3, '#7c8582', .6);
    g.fillStyle = '#5a4a2e'; g.beginPath(); g.ellipse(8.4, 22, 3.6, 2.2, 0, 0, TAU); g.fill();
    for (let i = 0; i < 9; i++) A.line(g, 5.6 + i * .7, 22, 4.6 + i * .9, 17 - (i % 3), '#6b5a34', .5);
    A.streaks(g, 3, 24, 12, 21, 4, 4, 'rgba(110,88,36,.5)'); A.rect(g, 3.8, 24, .8, 20, 'rgba(255,255,255,.5)');
    // cleaner bottle with swan neck
    g.fillStyle = A.lg(g, 19, 0, 29, 0, ['#0e5f86', '#42b4e0', '#0b4d6e']);
    g.beginPath(); g.moveTo(19.4, 46); g.lineTo(19.2, 28); g.quadraticCurveTo(19.2, 24, 22, 21); g.lineTo(22, 14); g.quadraticCurveTo(22, 9, 27, 9); g.quadraticCurveTo(29.6, 9, 29.6, 11.6); g.lineTo(27.4, 11.6); g.quadraticCurveTo(25.6, 11.6, 25.6, 13.6); g.lineTo(25.6, 21); g.quadraticCurveTo(28.6, 24, 28.6, 28); g.lineTo(28.6, 46); g.closePath(); g.fill();
    A.rect(g, 19.6, 30, 8.8, 11, '#f3f0dc'); A.rect(g, 19.6, 30, 8.8, 2.4, '#d83222'); g.fillStyle = '#222'; g.font = 'bold 2.6px sans-serif'; g.fillText('ХЛОРЫЧ', 20.3, 36); A.rect(g, 20.6, 37.6, 6.8, .6, '#999');
    A.rect(g, 20.2, 28, .8, 17, 'rgba(255,255,255,.45)'); A.ell(g, 24, 45.6, 5, 1, 'rgba(0,0,0,.35)');
  }
  function bakeRoll(g, w, h) {
    tube(g, [[3, 2], [3, 8], [10, 8]], 1.4, '#555', '#aaa', '#fff');
    A.rrect(g, 4, 1, 11, 12, 2, A.lg(g, 4, 0, 15, 0, ['#c6c8c0', '#fbfbf6', '#d9dbd2'])); A.ell(g, 4.6, 7, 1.8, 6, '#e8e8df'); A.ell(g, 4.6, 7, .8, 1.5, '#8a7a5a');
    g.fillStyle = A.lg(g, 0, 12, 0, 54, ['#f7f7f1', '#e1e1d6']);
    g.beginPath(); g.moveTo(5, 12); g.lineTo(14, 12); g.quadraticCurveTo(15.6, 34, 13, 46); g.quadraticCurveTo(15, 52, 11, 53); g.lineTo(6, 50); g.quadraticCurveTo(8, 30, 5, 12); g.fill();
    for (let y = 18; y < 48; y += 6) A.line(g, 6.4, y, 14, y - .5, 'rgba(0,0,0,.13)', .4);
    A.streaks(g, 6, 14, 8, 34, 4, 2, 'rgba(120,100,50,.3)');
  }
  function bakeShelf(g, w, h) {
    // spare rolls, freshener, sponge basket on a shelf
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(2, h - 3, w - 4, 2);
    A.rrect(g, 0, h - 5, w, 3.4, .8, A.lg(g, 0, h - 5, 0, h - 1.6, ['#d9d2bc', '#8f876e'])); A.rect(g, 0, h - 5, w, .7, 'rgba(255,255,255,.5)');
    A.rect(g, 4, h - 2, 3, 3, '#555'); A.rect(g, w - 7, h - 2, 3, 3, '#555');
    for (let i = 0; i < 3; i++) { const x = 4 + i * 11; A.rrect(g, x, h - 17, 10, 12, 2, A.lg(g, x, 0, x + 10, 0, ['#c6c8c0', '#fbfbf6', '#d0d2c9'])); A.ell(g, x + 5, h - 17, 5, 1.4, '#ececE2'); A.ell(g, x + 5, h - 17, 1.8, .7, '#888'); }
    A.rrect(g, 38, h - 24, 7, 19, 2, A.lg(g, 38, 0, 45, 0, ['#2a6b3a', '#5fbf7a', '#235c32'])); A.rrect(g, 39, h - 27, 5, 4, 1, '#ddd'); A.rect(g, 38.4, h - 17, 6.2, 5, '#f0f0e0');
    A.rrect(g, 46, h - 11, 6, 6, 1, '#3d78c9'); A.rect(g, 46, h - 11, 6, 1, 'rgba(255,255,255,.4)');
    A.streaks(g, 0, h - 5, w, 6, 3, 3, 'rgba(100,80,40,.4)');
  }
  function bakeHose(g, w, h) {
    tube(g, [[10, 0], [10, 30], [4, 36], [4, 44]], 2.4, '#4e5a5c', '#c3d1d6', '#fff');
    A.rrect(g, 1.6, 40, 5.6, 8, 1.3, chromeG(g, 1.6, 7.2)); A.ell(g, 8.4, 44, 1.4, 1.4, '#2467c8');
    A.rrect(g, 7.8, 0, 4.6, 4, 1, chromeG(g, 7.8, 12.4)); A.streaks(g, 2, 46, 8, 6, 3, 3, 'rgba(120,76,36,.6)');
  }
  /* ================================================================== TUB */
  function bakeTubBack(g, w, h) {                                  // shower fittings on the wall behind the curtain (172 x 142, heights 78..220)
    A.glow(g, 130, 112, 30, 'rgba(236,242,228,.25)'); A.streaks(g, 100, 112, 60, 30, 3, 8, 'rgba(236,242,228,.3)');
    // wall mixer
    A.rrect(g, 112, 116, 36, 7, 2.5, chromeG(g, 112, 148)); A.rect(g, 113, 116, 34, .8, '#fff');
    [[112, '#2a6bd0'], [148, '#c4261c']].forEach(([x, c]) => { A.rrect(g, x - 5, 112, 10, 5, 2, chromeG(g, x - 5, x + 5)); A.ell(g, x, 112.8, 1.6, 1.1, c); A.rrect(g, x - 2, 116, 4, 8, 1, chromeG(g, x - 2, x + 2)); });
    tube(g, [[130, 122], [130, 130], [127, 134]], 4.4, '#2d383d', '#a3b3ba', '#e9f2f5');
    A.ell(g, 130, 117, 3.4, 3.4, '#2c2c2c'); A.ell(g, 130, 117, 2.6, 2.6, chromeG(g, 127, 133));
    A.streaks(g, 118, 124, 24, 14, 4, 5, 'rgba(150,100,50,.55)'); hexNut(g, 130, 124, 5, 2.4, 0);
    // shower rail + head and hose
    tube(g, [[152, 26], [152, 100]], 1.8, '#4a565b', '#c3d1d6', '#fff'); A.rrect(g, 149.6, 54, 5, 6, 1.4, chromeG(g, 149.6, 154.6));
    g.save(); g.translate(144, 44); g.rotate(-.5); A.rrect(g, -3, 0, 6, 5, 1.6, chromeG(g, -3, 3)); g.beginPath(); g.moveTo(-3, 5); g.lineTo(3, 5); g.lineTo(9, 14); g.lineTo(-9, 14); g.closePath(); g.fillStyle = A.lg(g, -9, 0, 9, 0, ['#667', '#e8f0f2', '#556']); g.fill(); A.rect(g, -9, 14, 18, 1.2, '#2a2f31'); for (let i = -3; i <= 3; i++) A.ell(g, i * 2.4, 14.6, .45, .35, '#111'); g.restore();
    g.strokeStyle = '#161a1b'; g.lineWidth = 2.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(138, 56); g.bezierCurveTo(128, 76, 150, 92, 136, 110); g.bezierCurveTo(132, 114, 134, 116, 131, 118); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = .5; g.setLineDash([.9, 1.1]); g.beginPath(); g.moveTo(137.4, 56); g.bezierCurveTo(127.4, 76, 149.4, 92, 135.4, 110); g.stroke(); g.setLineDash([]);
    // wire caddy with bottles
    g.strokeStyle = '#9aa'; g.lineWidth = .6; g.strokeRect(10, 78, 46, 8); for (let x = 14; x < 56; x += 5) { g.beginPath(); g.moveTo(x, 78); g.lineTo(x, 86); g.stroke(); }
    A.rrect(g, 13, 56, 8, 24, 2.4, A.lg(g, 13, 0, 21, 0, ['#2a7a3a', '#6fd08a', '#23662f'])); A.rrect(g, 14.6, 53, 4.8, 4, 1, '#ddd'); A.rect(g, 13, 64, 8, 8, '#f3f2e2'); A.rect(g, 14, 66, 6, 1, '#2a7a3a');
    A.rrect(g, 24, 62, 7.6, 18, 2.4, A.lg(g, 24, 0, 32, 0, ['#c9cdc6', '#fff', '#bcc2ba'])); A.rrect(g, 25.4, 59.4, 4.8, 3.6, 1, '#999'); A.rect(g, 24, 68, 7.6, 5, '#3b78c7');
    A.rrect(g, 35, 66, 8, 14, 2.2, A.lg(g, 35, 0, 43, 0, ['#c25d10', '#ffa940', '#a64d0a'])); A.rrect(g, 36.6, 63.4, 4.8, 3.4, 1, '#ddd');
    g.fillStyle = '#c3a85a'; g.beginPath(); g.ellipse(50, 74, 4, 5.2, 0, 0, TAU); g.fill(); A.line(g, 50, 66, 50, 70, '#5a5a5a', .5);
    A.streaks(g, 10, 86, 46, 16, 5, 5, 'rgba(120,100,60,.5)'); mould(g, 4, 88, 60, 30, 6, 28, .7);
  }
  function bakeTub(g, w, h) {
    const hh = 54;
    A.ell(g, w / 2, h - 1, w * .48, 2, 'rgba(0,0,0,.45)');
    [8, w - 20].forEach(x => { A.rrect(g, x, hh - 2, 12, 6, 2, A.lg(g, 0, hh - 2, 0, hh + 4, ['#6e7774', '#2a2f2e'])); });
    g.beginPath(); g.roundRect(0, 0, w, hh, [6, 6, 10, 10]); g.fillStyle = A.lg(g, 0, 0, 0, hh, ['#fcfefd', '#e5eeec', '#c5d5d1', '#a3b6b2']); g.fill();
    g.fillStyle = A.lg(g, 0, 0, w, 0, ['rgba(0,0,0,.26)', 'rgba(0,0,0,0)', 'rgba(255,255,255,.10)', 'rgba(0,0,0,0)', 'rgba(0,0,0,.28)']); g.beginPath(); g.roundRect(0, 0, w, hh, [6, 6, 10, 10]); g.fill();
    A.rect(g, 3, 0, w - 6, 3.4, 'rgba(255,255,255,.85)'); A.rect(g, 0, 3.4, w, 1.2, 'rgba(0,0,0,.14)');
    // overflow + soap line + rust drips
    A.ell(g, 150, 14, 4.4, 4.4, chromeG(g, 145, 155)); A.ell(g, 150, 14, 2.1, 2.1, '#1a1f20'); A.streaks(g, 146, 18, 8, 22, 4, 4, 'rgba(140,86,40,.6)');
    g.fillStyle = 'rgba(180,170,120,.28)'; g.fillRect(0, 9, w, 2.2);
    A.streaks(g, 0, 6, w, hh - 6, 5, 22, 'rgba(70,86,76,.22)');
    // chips in the enamel + scratches
    [[36, 38, 2.6, 1.4], [104, 44, 2, 1.2], [20, 28, 1.6, 1]].forEach(([x, y, a, b]) => { g.fillStyle = 'rgba(60,52,44,.7)'; g.beginPath(); g.ellipse(x, y, a, b, .3, 0, TAU); g.fill(); g.fillStyle = 'rgba(150,90,40,.5)'; g.beginPath(); g.ellipse(x + 1, y + 1.4, a * .8, b * .6, .3, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x - a, y - b - .6, a * 2, .5); });
    // grimy base + mould in the lower corners
    g.fillStyle = A.lg(g, 0, 36, 0, hh, ['rgba(40,50,30,0)', 'rgba(40,52,30,.42)']); g.fillRect(0, 36, w, hh - 36);
    mould(g, 0, 44, 40, 10, 7, 14, .5); mould(g, w - 40, 44, 40, 10, 8, 12, .45);
    A.rrect(g, 56, 22, 40, 12, 3, 'rgba(0,0,0,.06)');
    A.grain(g, 0, 0, w, h, .1, .5);
  }
  function bakeTubInside(g, w, h) {
    g.save();
    g.fillStyle = A.lg(g, 0, 0, w, 0, ['rgba(160,185,180,0)', 'rgba(160,185,180,1)', 'rgba(160,185,180,1)', 'rgba(160,185,180,0)']); g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = A.lg(g, 0, 0, 0, h, ['#e8f0ee', '#a9bdb8', '#667c79', '#3d5250']); g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(190,172,110,.35)'; g.fillRect(0, 7.4, w, 1.6);                              // tide line of soap scum
    mould(g, 0, 6, w, 6, 4, 26, .7); A.streaks(g, 0, 2, w, h, 5, 12, 'rgba(80,100,90,.28)');
    g.strokeStyle = 'rgba(25,20,16,.8)'; g.lineWidth = .35; g.beginPath(); g.moveTo(40, 9); g.quadraticCurveTo(46, 7, 52, 10); g.moveTo(110, 8); g.quadraticCurveTo(116, 11, 122, 8); g.stroke();
    g.restore();
  }
  function bakeCurtain(g, w, h) {
    const pleat = (x0, x1, seed) => {
      const r = srand(seed);
      for (let x = x0; x < x1; x += 1) {
        const s = Math.sin((x - x0) * .75 + r() * .08), c = s * .5 + .5;
        g.fillStyle = A.lg(g, 0, 8, 0, h, ['#a9c4b0', '#8cab99', '#6e8c7c']); g.fillRect(x, 6, 1.05, h - 6);
        g.fillStyle = 'rgba(255,255,255,' + (c * .17) + ')'; g.fillRect(x, 6, 1.05, h - 6); g.fillStyle = 'rgba(0,0,0,' + ((1 - c) * .26) + ')'; g.fillRect(x, 6, 1.05, h - 6);
      }
    };
    const body = (x0, x1, seed) => {
      pleat(x0, x1, seed);
      // faded wave / fish print
      g.save(); g.beginPath(); g.rect(x0, 6, x1 - x0, h - 6); g.clip(); g.strokeStyle = 'rgba(245,250,240,.28)'; g.lineWidth = 1.1;
      for (let y = 22; y < h - 20; y += 14) { g.beginPath(); for (let x = x0; x <= x1; x += 3) g.lineTo(x, y + Math.sin(x * .22 + y) * 2.2); g.stroke(); }
      for (let y = 30; y < h - 26; y += 28) for (let x = x0 + 6; x < x1 - 6; x += 23) { A.ell(g, x, y, 3.4, 1.8, 'rgba(250,250,240,.30)'); g.fillStyle = 'rgba(250,250,240,.30)'; g.beginPath(); g.moveTo(x + 3, y); g.lineTo(x + 6, y - 2); g.lineTo(x + 6, y + 2); g.fill(); }
      // dirty hem: soap scum + black mould creeping up
      g.fillStyle = A.lg(g, 0, h - 40, 0, h, ['rgba(60,70,30,0)', 'rgba(50,60,24,.55)']); g.fillRect(x0, h - 40, x1 - x0, 40);
      mould(g, x0, h - 34, x1 - x0, 34, seed + 3, Math.round((x1 - x0) * .9), .95);
      A.streaks(g, x0, 10, x1 - x0, h - 10, seed + 4, 9, 'rgba(30,40,24,.22)');
      g.restore();
      g.fillStyle = 'rgba(50,60,40,.9)'; g.beginPath(); g.moveTo(x0, h - 3); for (let x = x0; x <= x1; x += 4) g.lineTo(x, h - 2 + Math.sin(x * .6) * 1.4); g.lineTo(x1, h - 6); g.lineTo(x0, h - 6); g.fill();
    };
    body(2, 104, 3); body(156, 170, 9);
    // rod + rings
    A.rect(g, 0, 1, w, 2.8, chromeG(g, 0, 0)); g.fillStyle = A.lg(g, 0, 1, 0, 3.8, ['#ffffff', '#7e8d92', '#2a3438']); g.fillRect(0, 1, w, 2.8);
    for (let x = 6; x < 106; x += 7.5) { g.strokeStyle = '#cfdce1'; g.lineWidth = .6; g.beginPath(); g.ellipse(x, 3.4, 1.2, 2.6, 0, 0, TAU); g.stroke(); }
    for (let x = 157; x < 170; x += 4) { g.strokeStyle = '#cfdce1'; g.lineWidth = .6; g.beginPath(); g.ellipse(x, 3.4, 1.2, 2.6, 0, 0, TAU); g.stroke(); }
    A.rect(g, 0, 0, 3, 6, '#aab4b6'); A.rect(g, w - 3, 0, 3, 6, '#aab4b6');
  }
  function bakeTubItems(g, w, h) {
    const rim = 24;                                                // local y of the tub rim top
    // rubber duck
    g.save(); g.translate(34, rim - 1);
    A.ell(g, 0, 0, 9, 1.8, 'rgba(0,0,0,.28)');
    g.fillStyle = A.lg(g, -8, 0, 8, 0, ['#d9a413', '#ffd93a', '#ffee77', '#d29c10']); g.beginPath(); g.moveTo(-8, -3); g.quadraticCurveTo(-9, 0, -4, 0); g.lineTo(6, 0); g.quadraticCurveTo(10, -2, 9, -7); g.quadraticCurveTo(9, -9, 8, -9); g.quadraticCurveTo(2, -10, -6, -6); g.closePath(); g.fill();
    A.ell(g, 4, -12, 4.2, 4.2, A.rg(g, 3, -13, 0, 5, ['#fff2a0', '#e9b514'])); g.fillStyle = '#f08a1c'; g.beginPath(); g.moveTo(7.4, -12.6); g.lineTo(12.4, -11.6); g.lineTo(7.6, -10); g.fill();
    A.ell(g, 5.4, -13.4, .9, .9, '#111'); A.ell(g, 5.7, -13.7, .3, .3, '#fff'); A.line(g, 2.4, -15.5, 6.6, -15, '#111', .45);
    A.ell(g, -1, -4, 3.6, 2.2, 'rgba(255,240,150,.5)'); g.restore();
    // bottles cluster + scrub brush + dish
    A.rrect(g, 56, rim - 14, 6.4, 14, 2, A.lg(g, 56, 0, 62.4, 0, ['#9e3a6e', '#e36fa8', '#8c2f5e'])); A.rrect(g, 57.4, rim - 16.4, 3.6, 3, 1, '#ddd'); A.rect(g, 56, rim - 8, 6.4, 4, '#f0efe2');
    A.rrect(g, 64, rim - 10, 8, 10, 2, A.lg(g, 64, 0, 72, 0, ['#3c78b8', '#79b4ea', '#2d6399'])); A.rrect(g, 66, rim - 12, 4, 2.4, 1, '#ddd');
    A.rrect(g, 74, rim - 5.5, 14, 4.4, 1.6, '#8a6a3a'); for (let i = 0; i < 9; i++) A.line(g, 75.4 + i * 1.4, rim - 5.5, 75.4 + i * 1.4, rim - 7.6, '#d1c28f', .6);
    A.rrect(g, 92, rim - 2, 14, 2, 1, '#e9f0ed'); A.rrect(g, 93, rim - 5, 9, 3.2, 1.6, '#9cc9a0');
    // folded towels + drape over the front apron
    A.rrect(g, 128, rim - 12, 36, 12, 2.4, A.lg(g, 0, rim - 12, 0, rim, ['#f2efe6', '#cfcab9'])); A.rrect(g, 130, rim - 7, 32, 7, 2, A.lg(g, 0, rim - 7, 0, rim, ['#4a8c96', '#2f6a74']));
    for (let x = 132; x < 160; x += 4) A.rect(g, x, rim - 6.6, .7, 6, 'rgba(255,255,255,.16)');
    g.fillStyle = A.lg(g, 0, rim - 2, 0, rim + 20, ['#4a8c96', '#2d646d']); g.beginPath(); g.moveTo(138, rim - 2); g.lineTo(158, rim - 2); g.quadraticCurveTo(160, rim + 10, 157, rim + 19); g.lineTo(139, rim + 18); g.quadraticCurveTo(136, rim + 9, 138, rim - 2); g.fill();
    for (let i = 0; i < 4; i++) A.rect(g, 138, rim + 4 + i * 3.6, 20, .8, 'rgba(255,255,255,.28)');
    A.rect(g, 138, rim + 14, 20, 5, 'rgba(0,0,0,.18)'); mould(g, 138, rim + 10, 20, 9, 5, 9, .5);
  }

  /* ============================================================ floor clutter */
  function bakeBottles(g, w, h) {
    A.ell(g, 16, h - 1, 16, 2.2, 'rgba(0,0,0,.4)');
    A.rrect(g, 3, h - 21, 8, 21, 2.6, A.lg(g, 3, 0, 11, 0, ['#c24a6c', '#ff93b3', '#a93b5a'])); A.rrect(g, 4.4, h - 24, 5.2, 4, 1, '#ddd'); A.rect(g, 3, h - 13, 8, 7, '#f3f1e2'); A.rect(g, 4, h - 11, 6, 1, '#c24a6c');
    A.rrect(g, 12, h - 24, 7.6, 24, 2.4, A.lg(g, 12, 0, 19.6, 0, ['#2f8a4b', '#74d68c', '#277a40'])); g.fillStyle = '#ccc'; g.beginPath(); g.moveTo(14, h - 24); g.lineTo(18, h - 24); g.lineTo(21.4, h - 27); g.lineTo(21.4, h - 25); g.lineTo(18.6, h - 22); g.fill(); A.rect(g, 12, h - 15, 7.6, 7, '#f3f1e2');
    A.rrect(g, 21, h - 14, 9, 14, 2.4, A.lg(g, 21, 0, 30, 0, ['#d8dcd6', '#fff', '#c6cbc4'])); A.rrect(g, 23, h - 17, 5, 3.4, 1, '#3b78c7'); A.rect(g, 21, h - 9, 9, 4, '#3b78c7');
    A.rrect(g, 0, h - 5, 9, 4, 1.4, '#e8d34a'); A.rect(g, 0, h - 5, 9, 1.6, '#5e9c3a');
    A.rect(g, 4.2, h - 18, .8, 14, 'rgba(255,255,255,.45)');
  }
  function bakeScale(g, w, h) {
    A.ell(g, w / 2, h - .5, w * .5, 1.6, 'rgba(0,0,0,.4)');
    A.rrect(g, 0, 1, w, h - 1.8, 2, A.lg(g, 0, 0, 0, h, ['#f3f6f2', '#9aa59f'])); A.rect(g, 0, 1, w, .8, '#fff');
    A.rrect(g, 9, 2.4, 12, 1.8, .8, '#1c2a24'); g.fillStyle = '#7eec9e'; g.font = 'bold 1.6px monospace'; g.fillText('Err', 13, 3.8);
    A.specks(g, 2, 3, w - 4, h - 3, 3, 8, 'rgba(70,60,30,.6)', .8);
  }
  function bakeSlippers(g, w, h) {
    A.ell(g, w / 2, h - .6, w / 2, 1.6, 'rgba(0,0,0,.4)');
    [[0, '#7c5a3c'], [13, '#6e4e32']].forEach(([x, c], i) => {
      g.fillStyle = A.lg(g, 0, 0, 0, h, ['#a07850', c]); g.beginPath(); g.moveTo(x + 1, h - 1); g.quadraticCurveTo(x, 1, x + 6, 1.6); g.quadraticCurveTo(x + 11, 1.2, x + 11.4, h - 1); g.closePath(); g.fill();
      A.rect(g, x + 1, h - 2.2, 10.4, 1.4, '#35291d'); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x + 3, 2.4, 5, .7);
    });
    A.ell(g, 18, 3.4, 1.4, 1, 'rgba(255,255,255,.25)');
  }

  /* ============================================================== foreground */
  function bakeFgPipe(g, w, h) {
    tube(g, [[8, 0], [8, h - 6]], 6.6, '#14201f', '#3b4d4b', '#7a9592');
    A.rrect(g, 3.4, 12, 9.2, 5, 1.2, '#1b2625'); A.rrect(g, 3.4, 60, 9.2, 5, 1.2, '#1b2625');
    A.streaks(g, 4, 0, 8, h - 4, 3, 3, 'rgba(120,76,36,.5)');
    g.fillStyle = 'rgba(190,220,230,.5)'; g.beginPath(); g.ellipse(8, h - 4, 3.4, 2, 0, 0, TAU); g.fill();
  }
  function dynFgPipe(g, t, S, o) {
    const P = 3.1, u = (t % P) / P, x = 8, y0 = o.h - 4;
    if (u < .5) { const k = u / .5; g.fillStyle = 'rgba(205,235,248,.85)'; g.beginPath(); g.ellipse(x, y0 + k * 2, 1.3 + k * 1.3, 1.8 + k * 3.2, 0, 0, TAU); g.fill(); }
    else { const v = (u - .5) / .5, y = y0 + 5 + 150 * v * v; g.fillStyle = 'rgba(210,238,250,.7)'; g.beginPath(); g.moveTo(x, y - 6); g.quadraticCurveTo(x + 2.4, y, x, y + 2); g.quadraticCurveTo(x - 2.4, y, x, y - 6); g.fill(); }
  }
  function bakeLine(g, w, h) {
    g.strokeStyle = 'rgba(210,214,200,.9)'; g.lineWidth = .9; g.beginPath(); g.moveTo(0, 5); g.quadraticCurveTo(w / 2, 14, w, 6); g.stroke();
    const sag = x => 5 + (14 - 5) * 2 * (x / w) * (1 - x / w) * 2 * .5 + (6 - 5) * x / w;     // approx point on the sagging line
    const peg = (x) => { const y = sag(x); A.rect(g, x - 1, y - 1.4, 2, 5.6, '#c9863a'); };
    // big faded towel
    g.fillStyle = A.lg(g, 80, 0, 126, 0, ['#8c5a3a', '#d89462', '#e8a874', '#a46a42']); g.beginPath(); g.moveTo(84, sag(84)); g.lineTo(128, sag(128)); g.quadraticCurveTo(131, 36, 127, h - 6); g.lineTo(86, h - 3); g.quadraticCurveTo(83, 30, 84, sag(84)); g.fill();
    for (let i = 0; i < 4; i++) A.rect(g, 85, 20 + i * 4, 43, 1, 'rgba(255,240,220,.5)'); A.rect(g, 85, h - 12, 42, 8, 'rgba(30,24,16,.2)');
    peg(92); peg(120);
    // socks + a t-shirt
    [[40, '#9b3a32'], [52, '#385e8f']].forEach(([x, c]) => { g.fillStyle = c; g.beginPath(); g.moveTo(x, sag(x)); g.lineTo(x + 7, sag(x)); g.lineTo(x + 7, sag(x) + 18); g.quadraticCurveTo(x + 11, sag(x) + 27, x + 3, sag(x) + 26); g.lineTo(x - .6, sag(x) + 22); g.closePath(); g.fill(); A.rect(g, x, sag(x) + 6, 7, 1.4, 'rgba(255,255,255,.5)'); peg(x + 3.5); });
    g.fillStyle = '#d5d2c0'; g.beginPath(); g.moveTo(170, sag(170)); g.lineTo(206, sag(206)); g.lineTo(212, sag(212) + 10); g.lineTo(204, sag(204) + 12); g.lineTo(203, h - 8); g.lineTo(174, h - 6); g.lineTo(173, sag(173) + 12); g.lineTo(165, sag(165) + 10); g.closePath(); g.fill();
    A.rect(g, 176, 24, 24, 6, 'rgba(70,90,120,.35)'); peg(178); peg(200);
    A.streaks(g, 160, 8, 60, 40, 2, 4, 'rgba(0,0,0,.12)');
  }
  function dynSteam(g, t, S, o) {
    const f = F(S), k = f.faucetHowl && !f.faucetFixed ? 2.2 : 1;
    steamWisps(g, t, 0, 0, o.w, o.h, 8, .11 * k, o.x * .01);
  }

  /* ===================================================================== ROOM */
  BB.defineRoom({
    id: 'bath',
    wallColor: ['#8ea29d', '#74898a'],
    partitionFace: '#6f8f8c',
    floorColor: ['#a9b8b5', '#6d8785'],
    gloss: .30,
    ambient: { color: [80, 98, 106] },
    ambientNow: (S, t) => { const f = tubeFlicker(t), h = F(S).faucetHowl && !F(S).faucetFixed ? 1 + .08 * Math.sin(t * 40) : 1; return [(72 + 12 * f) * h, (90 + 12 * f) * h, (98 + 12 * f) * h]; },
    wall, floor, ceil,
    objects: [
      // ---- back wall layer (z ~150-158)
      { id: 'window', x: 425, y: 198, z: 157, w: 60, h: 44, shadow: false, bake: bakeWindow, dyn: dynWindow },
      { id: 'vent', x: 345, y: 218, z: 157, w: 28, h: 28, shadow: false, bake: bakeVent, dyn: dynVent },
      { id: 'pipeRun', x: 186, y: 217, z: 150, w: 232, h: 16, shadow: false, bake: bakePipeRun, dyn: dynPipeRun },
      { id: 'riser', x: 300, y: 0, z: 151, w: 24, h: 260, shadow: false, bake: bakeRiser },
      { id: 'boiler', x: 65, y: 86, z: 148, w: 44, h: 134, shadow: false, bake: bakeBoiler, dyn: dynBoiler },
      { id: 'hooks', x: 206, y: 85, z: 154, w: 34, h: 82, shadow: false, bake: bakeHooks },
      { id: 'mirror', x: 250, y: 122, z: 150, w: 56, h: 84, depth: 11, shadow: false, bake: { dirty: mkMirror(false), clean: mkMirror(true) }, dyn: dynMirror,
        variant: function (S) { shaker(this, .3, F(S).faucetHowl && !F(S).faucetFixed); return F(S).mirrorDone ? 'clean' : 'dirty'; } },
      { id: 'vanity', x: 250, y: 207, z: 146, w: 48, h: 6, post: true, shadow: false, bake: bakeVanity, dyn: dynVanity },
      { id: 'tubBack', x: 395, y: 78, z: 153, w: 172, h: 142, shadow: false, bake: bakeTubBack },
      { id: 'paper', x: 472, y: 10, z: 156, w: 20, h: 58, shadow: false, bake: bakeRoll },
      { id: 'toiletHose', x: 486, y: 18, z: 156, w: 16, h: 54, shadow: false, bake: bakeHose },
      { id: 'shelf', x: 505, y: 134, z: 154, w: 54, h: 32, shadow: false, bake: bakeShelf },
      { id: 'plumb', x: 250, y: 0, z: 134, w: 40, h: 66, shadow: false, bake: bakePlumb, dyn: dynPlumb, reflect: .3 },
      // ---- washing machine corner
      { id: 'washer', x: 65, z: 106, w: 62, h: 86, depth: 52, reflect: .55, shadow: { w: 34, a: .5 }, bake: bakeWasher, dyn: dynWasher,
        variant: function (S) { shaker(this, .55, F(S).washerOn); return '_'; } },
      { id: 'washTop', x: 62, y: 86, z: 103, w: 44, h: 24, shadow: false, bake: bakeWashTop },
      // ---- mop corner
      { id: 'mop', x: 150, z: 128, w: 38, h: 150, reflect: .4, shadow: { w: 14, a: .35 }, bake: bakeMop, hidden: S => !!(S && S.tools && S.tools.mop) },
      { id: 'bucket', x: 178, z: 104, w: 32, h: 32, reflect: .5, shadow: { w: 16, a: .45 }, bake: bakeBucket,
        dyn: (g, t) => { ripple(g, t, 16, 7, 8, .5, 2); } },
      // ---- sink
      { id: 'sink', x: 250, y: 62, z: 116, w: 66, h: 30, shadow: false, bake: bakeSink, dyn: dynSink,
        variant: function (S) { shaker(this, .3, F(S).faucetHowl && !F(S).faucetFixed); return '_'; } },
      { id: 'sinkItems', x: 250, y: 85, z: 114, w: 66, h: 24, shadow: false, bake: bakeSinkItems },
      { id: 'faucet', x: 250, y: 70, z: 112, w: 44, h: 50, shadow: false, bake: { broken: mkFaucet(false), fixed: mkFaucet(true) }, dyn: dynFaucet,
        variant: function (S) { const f = F(S); shaker(this, .55, f.faucetHowl && !f.faucetFixed); return f.faucetFixed ? 'fixed' : 'broken'; } },
      // ---- tub
      { id: 'curtain', x: 395, y: 56, z: 118, w: 172, h: 138, shadow: false, bake: bakeCurtain,
        variant: function () { this.dx = Math.sin(T() * .7 + 1) * .5; return '_'; } },
      { id: 'tub', x: 395, z: 86, w: 172, h: 58, depth: 74, topRGB: [168, 188, 184], reflect: .5, shadow: { w: 90, a: .5 }, bake: bakeTub },
      { id: 'tubInside', x: 395, y: 58, z: 85.5, w: 168, h: 12, shadow: false, bake: bakeTubInside },
      { id: 'tubItems', x: 395, y: 40, z: 84, w: 172, h: 42, shadow: false, bake: bakeTubItems },
      // ---- toilet
      { id: 'tank', x: 505, y: 38, z: 136, w: 44, h: 44, depth: 22, topRGB: [236, 242, 240], reflect: .45, shadow: false,
        bake: { broken: mkTank(false), fixed: mkTank(true) }, dyn: dynTank,
        variant: function (S) { const f = F(S); shaker(this, .35, f.toiletFlush); return f.flushFixed ? 'fixed' : 'broken'; } },
      { id: 'bowl', x: 505, z: 98, w: 42, h: 46, reflect: .75, shadow: { w: 17, a: .5 }, bake: bakeBowl, dyn: dynBowl },
      { id: 'kit', x: 470, z: 60, w: 30, h: 46, reflect: .5, shadow: { w: 14, a: .4 }, bake: bakeKit, hidden: S => clamp(F(S).toiletClean || 0, 0, 1) >= 1 },
      // ---- floor clutter
      { id: 'bottles', x: 298, z: 64, w: 34, h: 28, reflect: .5, shadow: { w: 16, a: .4 }, bake: bakeBottles },
      { id: 'bin', x: 292, z: 118, w: 22, h: 28, reflect: .4, shadow: { w: 10, a: .4 }, bake: bakeBin },
      { id: 'scale', x: 205, z: 70, w: 32, h: 7, reflect: .6, shadow: false, bake: bakeScale },
      { id: 'slippers', x: 118, z: 52, w: 26, h: 8, reflect: .5, shadow: false, bake: bakeSlippers },
      // ---- ceiling + practical lights
      { id: 'housing', x: 270, y: 249, z: 45, w: 140, h: 11, shadow: false, bake: bakeHousing },
      { id: 'tube', x: 270, y: 245, z: 44, w: 124, h: 5, post: true, shadow: false, bake: bakeTube, dyn: dynTube },
      { id: 'night', x: 118, y: 24, z: 156, w: 10, h: 12, post: true, shadow: false, bake: bakeNight },
      // ---- foreground dressing
      { id: 'fgPipe', x: 330, y: 190, z: -85, w: 16, h: 106, blur: 2.2, shadow: false, bake: bakeFgPipe, dyn: dynFgPipe },
      { id: 'fgLine', x: 450, y: 208, z: -75, w: 250, h: 60, blur: 1.8, shadow: false, bake: bakeLine },
      { id: 'fgSteamA', x: 120, y: 30, z: -62, w: 190, h: 120, shadow: false, bake: () => { }, dyn: dynSteam },
      { id: 'fgSteamB', x: 430, y: 30, z: -62, w: 190, h: 120, shadow: false, bake: () => { }, dyn: dynSteam }
    ],
    lights: [
      { x: 270, y: 240, z: 40, r: 430, color: '196,232,240', i: .66, flicker: .38, bloom: .05 },
      { x: 118, y: 36, z: 120, r: 120, color: '255,160,80', i: .45, bloom: .08 },
      { x: 250, y: 205, z: 120, r: 190, color: '224,246,240', i: .42, flicker: .15, bloom: .04 },
      { x: 425, y: 215, z: 120, r: 230, color: '110,140,220', i: .3, bloom: .04 },
      { x: 66, y: 164, z: 130, r: 70, color: '255,60,40', i: .3, bloom: .08 },
      { x: 250, y: 100, z: 70, r: 150, color: '170,225,255', i: .55, flicker: .6, bloom: .08, on: S => !!(F(S).faucetHowl && !F(S).faucetFixed) }
    ],
    hotspots: [
      { id: 'washer', x: 65, r: 55, h: 90 },
      { id: 'mopStand', x: 150, r: 40, h: 100 },
      { id: 'faucet', x: 250, r: 60, h: 100 },
      { id: 'tub', x: 395, r: 85, h: 100 },
      { id: 'toilet', x: 505, r: 50, h: 70 }
    ],
    solids: []
  });
})();
