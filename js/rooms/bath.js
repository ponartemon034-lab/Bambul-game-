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
    for (let k = 0; k < n; k++) { const ph = (t * 1.4 + k / n) % 1; g.strokeStyle = 'rgba(235,250,255,' + a * (1 - ph) + ')'; g.lineWidth = .5; g.beginPath(); g.ellipse(x, y, rx * (.25 + ph * .85), rx * (.25 + ph * .85) * .3, 0, 0, TAU); g.stroke(); }
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
    A.rg; g.fillStyle = A.lg(g, 0, TOP + 2, 0, TOP + 12, ['rgba(0,0,0,.28)', 'rgba(0,0,0,0)']); g.fillRect(0, TOP + 2, w, 10);
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
    A.tiles(g, 0, 0, w, d, { w: 25, h: 25, c1: '#a9b8b5', c2: '#6d8785', checker: true, seed: 5, dirt: .14, grout: 'rgba(14,30,30,.7)' });
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
//@@END
})();
