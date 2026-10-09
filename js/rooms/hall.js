/* ==========================================================================
   HALLWAY (id 'hall', width 600) - cold, cluttered, transitional. Bare bulb.
   Owner: environment artist (hall + living).  See docs/ROOMS_HALL_LIVING.md
   Everything is painted in centimetres; sprites are authored with real sizes.
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const A = BB.art, U = BB.U, srand = U.srand, clamp = U.clamp, P2 = Math.PI * 2;
  const F = S => (S && S.f) || {};

  /* ------------------------------------------------------------ local helpers */
  function soft(g, x, y, w, h, a, c) {                 // soft elliptical blob (shadows / stains / glows)
    c = c || 'rgba(0,0,0,';
    g.save(); g.translate(x, y); g.scale(w / 2, h / 2);
    g.fillStyle = A.rg(g, 0, 0, 0, 1, [c + a + ')', c + (a * .45) + ')', c + '0)']);
    g.beginPath(); g.arc(0, 0, 1, 0, P2); g.fill(); g.restore();
  }
  let _tile = null;
  function tileNoise() {
    if (_tile) return _tile;
    const c = BB.mk(64, 64), g = c.getContext('2d'), d = g.createImageData(64, 64), r = srand(5);
    for (let i = 0; i < d.data.length; i += 4) { const v = r() < .5 ? 20 : 235; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 40 + r() * 215; }
    g.putImageData(d, 0, 0); return _tile = c;
  }
  /* grain that only lands on already painted (opaque) pixels of a sprite */
  function grainOn(g, x, y, w, h, a, sc) {
    g.save(); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = a || .08;
    const t = tileNoise(), s = 64 * (sc || .3);
    for (let xx = x; xx < x + w; xx += s) for (let yy = y; yy < y + h; yy += s) g.drawImage(t, xx, yy, s, s);
    g.restore();
  }
  function shadowOf(img) {
    const s = BB.mk(img.width, img.height), sg = s.getContext('2d');
    sg.drawImage(img, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#000'; sg.fillRect(0, 0, s.width, s.height);
    const o = BB.mk(s.width, s.height), og = o.getContext('2d');
    if ('filter' in og) og.filter = 'blur(' + Math.max(1, (img.B || 2) * 1.6) + 'px)'; og.drawImage(s, 0, 0); return o;
  }
  /* sprite that is painted once lazily and swung around a pivot every frame */
  function swing(o, paint, pivot, amp, freq, ph) {
    let img = null, sh = null;
    o.dyn = (g, t, S) => {
      if (!img) { img = BB.bake(o.w, o.h, paint); sh = shadowOf(img); }
      const a = (Math.sin(t * freq + ph) * amp + Math.sin(t * freq * .37 + ph * 2.1) * amp * .8) * (1 + (F(S).doorOpen ? 2.4 : 0) + (F(S).phoneRing ? .6 : 0));
      g.save(); g.translate(pivot[0], pivot[1]); g.rotate(a);
      g.globalAlpha = .38; g.drawImage(sh, -pivot[0] + 3.5, -pivot[1] + 1.5, o.w, o.h);
      g.globalAlpha = 1; g.drawImage(img, -pivot[0], -pivot[1], o.w, o.h); g.restore();
    };
    return o;
  }
  /* coiled telephone cord along a quadratic bezier */
  function coil(g, p, r, loops, c1, c2, wd) {
    const N = Math.round(loops * 16);
    [[c1, wd], [c2, wd * .38]].forEach(([c, lw], pass) => {
      g.strokeStyle = c; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
      for (let i = 0; i <= N; i++) {
        const u = i / N, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, cc = u * u;
        const x = a * p[0] + b * p[2] + cc * p[4], y = a * p[1] + b * p[3] + cc * p[5];
        let dx = 2 * (1 - u) * (p[2] - p[0]) + 2 * u * (p[4] - p[2]), dy = 2 * (1 - u) * (p[3] - p[1]) + 2 * u * (p[5] - p[3]);
        const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
        const ph = u * loops * P2, off = Math.sin(ph) * r - (pass ? r * .25 : 0), al = Math.cos(ph) * r * .6;
        const px = x - dy * off + dx * al, py = y + dx * off + dy * al;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.stroke();
    });
  }
  /* torn / peeling wallpaper patch */
  function peel(g, x, y, w, h, seed, older, under, flap) {
    const r = srand(seed), n = 16, pts = [];
    for (let i = 0; i < n; i++) { const a = i / n * P2, k = .72 + .28 * r(), j = (i % 2 ? .1 : -.06) * r(); pts.push([x + w / 2 + Math.cos(a) * w / 2 * (k + j), y + h / 2 + Math.sin(a) * h / 2 * (k - j)]); }
    const path = (sc, ox, oy) => { g.beginPath(); pts.forEach((p, i) => { const px = x + w / 2 + (p[0] - x - w / 2) * sc + ox, py = y + h / 2 + (p[1] - y - h / 2) * sc + oy; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath(); };
    path(1.05, 0, 1.2); g.fillStyle = 'rgba(0,0,0,.35)'; g.fill();                       // shadow of the lifted edge
    path(1, 0, 0); g.fillStyle = under || '#9a9482'; g.fill();                           // bare plaster
    g.save(); path(1, 0, 0); g.clip(); A.blotches(g, x, y, w, h, seed + 3, 5, 'rgba(60,50,35,.35)', 3, 9);
    g.strokeStyle = 'rgba(60,50,40,.35)'; g.lineWidth = .5; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(x + r() * w, y + r() * h); g.lineTo(x + r() * w, y + r() * h); g.stroke(); } g.restore();
    g.save(); path(.78, w * .05, h * .12); g.fillStyle = older || '#b3a47a'; g.fill(); g.clip();    // older wallpaper layer (warm, flowery)
    g.fillStyle = 'rgba(150,60,50,.4)'; for (let xx = x; xx < x + w; xx += 7) for (let yy = y; yy < y + h; yy += 8) { g.beginPath(); g.arc(xx + ((yy / 8 | 0) % 2) * 3.5, yy, 1.5, 0, P2); g.fill(); }
    g.fillStyle = 'rgba(60,90,50,.3)'; for (let xx = x + 3; xx < x + w; xx += 7) g.fillRect(xx, y, .8, h);
    g.restore();
    // the hanging flap of the current wallpaper (with its shadow) along the top edge
    g.save(); g.beginPath(); g.moveTo(x + w * .12, y + h * .3); g.quadraticCurveTo(x + w * .5, y - h * .02, x + w * .9, y + h * .22); g.lineTo(x + w * .8, y + h * .52); g.quadraticCurveTo(x + w * .5, y + h * .36, x + w * .22, y + h * .55); g.closePath();
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 2.5; g.shadowOffsetY = 2; g.fillStyle = flap || '#838a78'; g.fill(); g.shadowColor = 'transparent';
    g.strokeStyle = 'rgba(240,242,225,.6)'; g.lineWidth = .9; g.beginPath(); g.moveTo(x + w * .12, y + h * .3); g.quadraticCurveTo(x + w * .5, y - h * .02, x + w * .9, y + h * .22); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fill(); g.restore();
  }
  function stainRing(g, x, y, rx, ry, a) {
    soft(g, x, y, rx * 2, ry * 2, a, 'rgba(112,88,40,');
    g.strokeStyle = 'rgba(96,74,32,' + (a * 1.4) + ')'; g.lineWidth = 1.3; g.beginPath(); g.ellipse(x, y, rx * .86, ry * .86, 0, 0, P2); g.stroke();
    g.strokeStyle = 'rgba(96,74,32,' + (a * .8) + ')'; g.lineWidth = .7; g.beginPath(); g.ellipse(x + 1, y, rx * .64, ry * .62, 0, 0, P2); g.stroke();
  }
  function staples(g, x0, y0, x1, y1, step) {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; A.rect(g, x - .9, y - .9, 1.8, 1.8, 'rgba(70,70,70,.9)'); }
  }
  function cardbox(g, x, y, w, h, o) {
    o = o || {}; const r = srand(o.seed || 3), base = o.base || '#b08d60';
    g.fillStyle = A.lg(g, x, y, x + w, y + h, [A.shade(A.hex(base), 1.1), base, A.shade(A.hex(base), .8)]); g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(70,45,15,.07)'; for (let yy = y + 1; yy < y + h; yy += 1.3) g.fillRect(x, yy, w, .45);
    g.fillStyle = 'rgba(255,235,190,.2)'; g.fillRect(x, y, w, 1.4); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x, y + h - 1.6, w, 1.6); g.fillRect(x + w - 1.2, y, 1.2, h);
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, y, 1.2, h);
    if (o.tape !== false) { const tx = x + w * (o.tx || .5) - 2.6; g.fillStyle = 'rgba(214,190,128,.78)'; g.fillRect(tx, y, 5.2, h); g.fillStyle = 'rgba(255,255,230,.3)'; g.fillRect(tx + 1, y, 1, h); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(tx + 5.2, y, .8, h); }
    if (o.label) { const lx = x + w * .12, ly = y + h * .5; A.rect(g, lx, ly, w * .3, h * .3, 'rgba(240,238,228,.92)'); g.fillStyle = 'rgba(30,30,35,.8)'; g.fillRect(lx + 1, ly + 1.2, w * .3 - 2, .8); g.fillRect(lx + 1, ly + 3, w * .22, .7); g.fillRect(lx + 1, ly + 4.5, w * .26, .7); }
    if (o.text) { g.save(); g.fillStyle = o.tcol || 'rgba(120,30,25,.78)'; g.font = 'bold ' + (o.fs || 4.4) + 'px Arial,sans-serif'; g.textAlign = 'center'; g.fillText(o.text, x + w * (o.tx2 || .5), y + h * .38); g.restore(); }
    for (let i = 0; i < 3; i++) soft(g, x + r() * w, y + r() * h, 10 + r() * 14, 5 + r() * 6, .12, 'rgba(60,35,10,');
    g.fillStyle = 'rgba(40,25,5,.2)'; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + 4 + r() * 4, y + h); g.lineTo(x, y + h - 5); g.fill();
  }

  /* ------------------------------------------------------------------ walls */
  function wall(g, w, h, room) {
    const ox = room.x0 - room.tx0, r = srand(41);
    A.wallpaper(g, 0, 0, w, 150, { base: '#7f8777', top: '#8f9484', bottom: '#667060', stripe: 'rgba(228,236,208,.08)', step: 10.5, sw: 3, seam: 61, seed: 2 });
    g.fillStyle = 'rgba(40,55,50,.12)'; for (let xx = 8; xx < w; xx += 10.5) g.fillRect(xx, 0, .8, 150);
    g.fillStyle = A.lg(g, 0, 150, 0, h, ['#4d6157', '#2f3c36']); g.fillRect(0, 150, w, 110);       // oil-painted dado panel
    A.grain(g, 0, 150, w, 110, .17, .3); A.grain(g, 0, 0, w, 150, .1, .3);
    g.save(); g.translate(ox, 0);
    // dado rail with highlight + shadow cast onto the panel
    A.rect(g, -260, 148, w, 3.2, '#a9b39a'); A.rect(g, -260, 148, w, 1, 'rgba(255,255,255,.35)'); A.rect(g, -260, 151.2, w, 5, 'rgba(0,0,0,.28)');
    A.rect(g, -260, 140, w, 8, 'rgba(0,0,0,.08)');
    // paint chips on the panel show cold plaster / primer
    for (let i = 0; i < 26; i++) { const x = -250 + r() * 850, y = 156 + r() * 90, s = 1 + r() * 3.6; A.poly(g, [x, y, x + s * 1.4, y + s * .3, x + s, y + s, x - s * .2, y + s * .7], 'rgba(176,170,150,' + (.5 + r() * .4) + ')'); A.poly(g, [x, y + s * .7, x + s, y + s, x + s * .6, y + s * 1.4], 'rgba(0,0,0,.3)'); }
    // grime, finger smudges, scuffs (heights where hands / bags brush)
    A.streaks(g, -260, 0, w, 160, 7, 46, 'rgba(50,45,30,.13)');
    A.blotches(g, -260, 0, w, 150, 12, 26, 'rgba(45,38,25,.10)', 10, 40);
    for (let i = 0; i < 30; i++) { const x = -240 + r() * 820, y = 160 + r() * 80; g.strokeStyle = 'rgba(10,15,12,' + (.1 + r() * .2) + ')'; g.lineWidth = .8 + r() * 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6 + r() * 22, y + (r() - .5) * 6); g.stroke(); }
    // ceiling leak stains
    stainRing(g, 505, 14, 46, 22, .22); stainRing(g, 110, 8, 36, 18, .18); A.streaks(g, 470, 0, 80, 90, 31, 12, 'rgba(105,80,36,.22)');
    // peeling wallpaper: behind the phone, over the door, by the mirror, in the corner
    peel(g, 226, 100, 62, 56, 11, '#a69d83', '#8d8776');
    peel(g, 30, 18, 46, 38, 23, '#9f967b');
    peel(g, 335, 42, 34, 52, 35, '#a89f84');
    peel(g, 548, 90, 36, 44, 49, '#a39a7e');
    peel(g, 410, 120, 26, 22, 53, '#a39a7e');
    // surface-mounted wiring: fuse box -> ceiling -> bulb, switch drop, phone line along the skirting
    g.lineCap = 'round';
    A.line(g, 200, 74, 200, 118, 'rgba(225,222,205,.95)', 1.1); staples(g, 200, 80, 200, 116, 11);   // not used: fuse down
    A.line(g, 190, 118, 190, 126, '#d8d4c0', 1.1);
    A.line(g, 205, 52, 205, 12, '#d8d4c0', 1.3); A.line(g, 205, 12, 300, 12, '#d8d4c0', 1.3); staples(g, 205, 52, 205, 12, 12); staples(g, 205, 12, 300, 12, 14);
    A.line(g, 205, 52, 205, 12, 'rgba(255,255,255,.35)', .4);
    // phone cable: from the phone down the wall, along the skirting to the left
    A.line(g, 262, 172, 262, 232, '#e1ddc8', .9); A.line(g, 262, 232, 262, 243, '#e1ddc8', .9); A.line(g, 262, 243, 60, 243, '#e1ddc8', .9);
    staples(g, 262, 175, 262, 243, 15); staples(g, 262, 243, 60, 243, 22);
    // heating pipe near the ceiling with clamps
    A.rect(g, -260, 24, w, 3.6, '#76736a'); A.rect(g, -260, 24, w, 1, 'rgba(255,255,255,.35)'); A.rect(g, -260, 27, w, 1.2, 'rgba(0,0,0,.3)');
    for (let x = 10; x < 600; x += 87) { A.rect(g, x, 22, 3.4, 9, '#2f2f2e'); A.rect(g, x, 22, 1, 9, 'rgba(255,255,255,.2)'); }
    for (let i = 0; i < 9; i++) soft(g, 20 + r() * 560, 31, 8 + r() * 14, 3, .3, 'rgba(120,64,20,');
    // water-stain trail of rust on the wall below the pipe
    A.streaks(g, 100, 28, 120, 40, 61, 5, 'rgba(120,64,20,.25)');
    // dark outline recess around the entrance door (frame is a sprite)
    A.rect(g, 38, 38, 4, 222, 'rgba(0,0,0,.1)');
    g.restore();
    A.skirting(g, w, h, { base: '#211914', crown: '#a7a28d', bh: 11, ch: 6 });
    A.wallAO(g, w, h);
    // vertical AO in the room corner (right end) + left end
    g.fillStyle = A.lg(g, ox + 560, 0, ox + 600, 0, ['rgba(0,0,0,0)', 'rgba(0,0,0,.35)']); g.fillRect(ox + 560, 0, 45, h);
  }

  /* ------------------------------------------------------------------ floor */
  function floor(g, w, d, room) {
    const ox = room.x0 - room.tx0, r = srand(77), T = 32;
    for (let yy = 0, j = 0; yy < d; yy += T, j++) for (let xx = 0, i = 0; xx < w; xx += T, i++) {
      const a = (i + j) % 2 ? 0 : 1, v = (r() - .5) * 10;
      g.fillStyle = a ? 'rgb(' + (104 + v) + ',' + (94 + v) + ',' + (82 + v) + ')' : 'rgb(' + (88 + v) + ',' + (80 + v) + ',' + (70 + v) + ')'; g.fillRect(xx, yy, T, T);
      g.fillStyle = 'rgba(255,240,210,' + (.025 + r() * .035) + ')'; g.fillRect(xx, yy, T, 1.2);
      if (r() < .1) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(xx, yy, T, T); }
    }
    g.fillStyle = 'rgba(8,6,5,.65)'; for (let yy = 0; yy < d; yy += T) g.fillRect(0, yy, w, .9); for (let xx = 0; xx < w; xx += T) g.fillRect(xx, 0, .9, d);
    // traffic wear: lighter scuffed lane where the hero walks, darker grime along the wall
    g.fillStyle = A.lg(g, 0, 90, 0, 250, ['rgba(190,170,130,0)', 'rgba(190,170,130,.10)', 'rgba(190,170,130,0)']); g.fillRect(0, 90, w, 160);
    g.fillStyle = A.lg(g, 0, 0, 0, 40, ['rgba(0,0,0,.6)', 'rgba(0,0,0,0)']); g.fillRect(0, 0, w, 40);
    A.blotches(g, 0, 0, w, d, 4, 70, 'rgba(15,10,5,.16)', 12, 46);
    A.grain(g, 0, 0, w, d, .16, .4);
    g.save(); g.translate(ox, 0);
    // door mat (worn) in front of the entrance door
    const mx = 46, my = 10, mw = 100, mh = 66;
    soft(g, mx + mw / 2, my + mh / 2 + 3, mw + 16, mh + 12, .5);
    g.fillStyle = A.lg(g, 0, my, 0, my + mh, ['#6a553d', '#54432f']); g.fillRect(mx, my, mw, mh);
    for (let i = 0; i < 900; i++) { g.fillStyle = 'rgba(' + (30 + r() * 60 | 0) + ',' + (22 + r() * 40 | 0) + ',14,' + (.25 + r() * .5) + ')'; g.fillRect(mx + r() * mw, my + r() * mh, .7, 1.8); }
    g.strokeStyle = 'rgba(190,160,110,.35)'; g.lineWidth = 1; g.strokeRect(mx + 3, my + 3, mw - 6, mh - 6);
    g.fillStyle = 'rgba(210,180,120,.6)'; g.font = 'bold 7.5px Arial,sans-serif'; g.textAlign = 'center'; g.fillText('ДОМ', mx + mw / 2 - 12, my + mh / 2 + 3); g.fillStyle = 'rgba(210,180,120,.25)'; g.fillText('ЛОМ', mx + mw / 2 + 18, my + mh / 2 + 3);
    A.blotches(g, mx, my, mw, mh, 8, 12, 'rgba(0,0,0,.25)', 3, 9);
    // muddy footprint track from the door, dried slush puddle, orange peel
    for (let i = 0; i < 12; i++) { const px = 100 + i * 14 + (i % 2 ? 4 : -4), py = 62 + i * 8; g.save(); g.translate(px, py); g.rotate(.15 + (i % 2 ? .12 : -.1)); soft(g, 0, 0, 7.5, 16, .22 - i * .012, 'rgba(14,10,6,'); soft(g, 0, -9, 3, 5, .15, 'rgba(14,10,6,'); g.restore(); }
    soft(g, 120, 68, 60, 24, .3, 'rgba(10,12,16,'); g.strokeStyle = 'rgba(160,160,150,.15)'; g.lineWidth = 1; g.beginPath(); g.ellipse(120, 68, 26, 9, 0, 0, P2); g.stroke();
    // flyers and an unopened bill
    const sheet = (x, y, a, c) => { g.save(); g.translate(x, y); g.rotate(a); soft(g, 1.5, 2, 24, 30, .35); g.fillStyle = c; g.fillRect(-10, -14, 20, 28); g.fillStyle = 'rgba(30,30,40,.5)'; for (let k = 0; k < 6; k++) g.fillRect(-7, -10 + k * 4, 14 - (k % 3) * 3, .9); g.restore(); };
    sheet(160, 40, .5, '#d6d2c2'); sheet(176, 52, -.3, '#b9cdb5'); sheet(205, 108, .9, '#d7ccae'); sheet(268, 90, .1, '#e0dccd');
    // greasy dark patches, scuffs from boxes and bags, a paw print of something
    soft(g, 330, 78, 96, 40, .34); soft(g, 468, 82, 46, 24, .38, 'rgba(10,8,4,'); soft(g, 468, 82, 30, 12, .3, 'rgba(60,70,30,');
    for (let i = 0; i < 22; i++) { const x = 220 + r() * 300, y = 40 + r() * 140; g.strokeStyle = 'rgba(200,185,150,' + (.05 + r() * .1) + ')'; g.lineWidth = .7; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8 + r() * 26, y + (r() - .5) * 6); g.stroke(); }
    // dirt in the tile joints near door and a dust bunny drift under the shoes
    soft(g, 340, 95, 70, 18, .22, 'rgba(95,88,80,'); soft(g, 520, 60, 80, 22, .2, 'rgba(95,88,80,');
    // coins, cap, crumbs
    A.ell(g, 232, 150, 1.6, 1.2, '#b9b07c'); A.ell(g, 250, 164, 1.4, 1, '#a9a070'); g.fillStyle = 'rgba(90,60,30,.7)'; for (let i = 0; i < 24; i++) g.fillRect(300 + r() * 150, 100 + r() * 70, 1, .8);
    g.restore();
  }

  /* ------------------------------------------------------------------ ceiling */
  function ceil(g, w, d, room) {
    const ox = room.x0 - room.tx0, r = srand(93);
    g.fillStyle = A.lg(g, 0, 0, 0, d, ['#4e4a42', '#6f6a5f']); g.fillRect(0, 0, w, d);
    A.blotches(g, 0, 0, w, d, 9, 60, 'rgba(30,25,15,.12)', 14, 50);
    A.grain(g, 0, 0, w, d, .14, .5);
    g.save(); g.translate(ox, 0);
    stainRing(g, 130, 52, 62, 34, .3); stainRing(g, 480, 30, 80, 40, .26); stainRing(g, 330, 150, 30, 16, .16);
    g.strokeStyle = 'rgba(15,12,8,.55)'; g.lineWidth = .9; g.beginPath(); let cx = 20, cy = 70; g.moveTo(cx, cy); for (let i = 0; i < 20; i++) { cx += 12 + r() * 22; cy += (r() - .5) * 16; g.lineTo(cx, cy); } g.stroke();
    g.strokeStyle = 'rgba(15,12,8,.4)'; g.lineWidth = .7; g.beginPath(); cx = 360; cy = 10; g.moveTo(cx, cy); for (let i = 0; i < 9; i++) { cx += (r() - .35) * 10; cy += 8 + r() * 12; g.lineTo(cx, cy); } g.stroke();
    // flaking paint
    for (let i = 0; i < 40; i++) { const x = r() * 600, y = r() * 200, s = 2 + r() * 6; A.poly(g, [x, y, x + s, y + s * .3, x + s * .6, y + s], 'rgba(150,145,125,' + (.25 + r() * .25) + ')'); }
    // cable to the bulb rosette (bulb hangs at x 300, z 30 -> plan y 130)
    A.line(g, 205, 0, 205, 24, '#d8d4c0', 1.3); A.line(g, 205, 24, 300, 130, 'rgba(0,0,0,.25)', 2); A.line(g, 205, 0, 300, 130, '#d8d4c0', 1.2);
    soft(g, 300, 130, 40, 40, .35); A.ell(g, 300, 130, 7.5, 7.5, '#d9d6c6'); A.ell(g, 300, 130, 7.5, 7.5, 'rgba(0,0,0,.2)'); A.ell(g, 299, 129, 5.5, 5.5, '#e8e6d8'); A.ell(g, 300, 130, 2.6, 2.6, '#222');
    soft(g, 300, 131, 30, 30, .45, 'rgba(10,8,4,');              // soot above the bulb
    g.restore();
  }

  /* ---------------------------------------------------------------- sprites */
  function paintDoor(open) {
    return (g, w, h) => {
      const r = srand(17);
      // wooden casing
      g.fillStyle = A.lg(g, 0, 0, w, 0, ['#5d3b25', '#7c5638', '#4a2e1c']); g.fillRect(0, 0, w, h);
      A.rect(g, 0, 0, w, 1.3, 'rgba(255,230,190,.25)'); A.rect(g, 0, 0, 1.3, h, 'rgba(255,230,190,.18)');
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 7, w, 1.6); g.fillRect(6.4, 7, 1.6, h - 7); g.fillRect(w - 8, 7, 1.6, h - 7);
      const lx = 9, ly = 10, lw = 90, lh = 205;
      if (!open) {
        g.save(); g.beginPath(); g.rect(lx, ly, lw, lh); g.clip();
        g.fillStyle = A.lg(g, lx, 0, lx + lw, 0, ['#4d281c', '#7a3f2c', '#6a3626', '#44221a']); g.fillRect(lx, ly, lw, lh);
        const st = 15;
        for (let j = -1; j < 16; j++) for (let i = -1; i < 7; i++) {
          const cx = lx + i * st + (j % 2 ? st / 2 : 0), cy = ly + j * st * .9;
          g.fillStyle = A.rg(g, cx, cy, 0, st * .62, ['rgba(255,190,150,.2)', 'rgba(255,190,150,0)']); g.fillRect(cx - st, cy - st, st * 2, st * 2);
        }
        g.strokeStyle = 'rgba(14,5,3,.7)'; g.lineWidth = .9; g.beginPath();
        for (let k = -20; k < 30; k++) { g.moveTo(lx + k * st / 1, ly - 10); g.lineTo(lx + k * st + lh * 1.1, ly + lh + 10); g.moveTo(lx + k * st, ly - 10); g.lineTo(lx + k * st - lh * 1.1, ly + lh + 10); }
        g.stroke();
        g.strokeStyle = 'rgba(255,190,150,.12)'; g.lineWidth = .5; g.beginPath(); for (let k = -20; k < 30; k++) { g.moveTo(lx + k * st + .8, ly - 10); g.lineTo(lx + k * st + lh * 1.1 + .8, ly + lh + 10); } g.stroke();
        // brass studs at crossings
        for (let j = 0; j < 16; j++) for (let i = 0; i < 7; i++) { const cx = lx + i * st + (j % 2 ? 0 : st / 2) - st / 2 + st / 2, cy = ly + st * .9 * (j + .5) + 2; if (cx > lx + 2 && cx < lx + lw - 2 && cy < ly + lh - 2) { A.ell(g, cx, cy, .9, .9, '#b79a4e'); A.ell(g, cx - .25, cy - .25, .35, .35, '#f2e3a0'); } }
        // wear: darker top & bottom, lighter hand zone, torn corners with foam
        A.blotches(g, lx, ly + 95, lw, 36, 3, 8, 'rgba(255,200,160,.16)', 5, 12);
        g.fillStyle = A.lg(g, 0, ly, 0, ly + 30, ['rgba(0,0,0,.4)', 'rgba(0,0,0,0)']); g.fillRect(lx, ly, lw, 30);
        g.fillStyle = A.lg(g, 0, ly + lh - 40, 0, ly + lh, ['rgba(0,0,0,0)', 'rgba(0,0,0,.5)']); g.fillRect(lx, ly + lh - 40, lw, 40);
        A.poly(g, [lx + 62, ly + 176, lx + 78, ly + 170, lx + 74, ly + 190, lx + 66, ly + 188], '#d3c9a4'); A.poly(g, [lx + 64, ly + 178, lx + 76, ly + 174, lx + 72, ly + 188], 'rgba(0,0,0,.28)');
        for (let k = 0; k < 14; k++) { g.strokeStyle = 'rgba(215,170,130,' + (.1 + r() * .15) + ')'; g.lineWidth = .5; g.beginPath(); const x = lx + 20 + r() * 60, y = ly + 60 + r() * 100; g.moveTo(x, y); g.lineTo(x + 3 + r() * 8, y + (r() - .5) * 4); g.stroke(); }
        g.restore();
        // peephole (brass ring, fisheye glass)
        const px = 54, py = 62; A.ell(g, px, py, 2.6, 2.6, '#8e7a3c'); A.ell(g, px, py, 1.9, 1.9, '#1a1a1a'); A.ell(g, px - .5, py - .5, .8, .8, 'rgba(180,220,255,.7)');
        // number plate
        A.rrect(g, 44, 28, 20, 9, 1.5, '#2d4fa0'); g.fillStyle = '#e6e6e6'; g.font = 'bold 6.2px Arial,sans-serif'; g.textAlign = 'center'; g.fillText('47', 54, 35); A.rect(g, 44, 28, 20, 1, 'rgba(255,255,255,.35)');
        // upper lock + deadbolt escutcheons, handle bar
        A.rrect(g, 78, 92, 9, 17, 1.5, '#a9a58a'); A.ell(g, 82.5, 100, 2, 2, '#322'); A.rect(g, 78, 92, 9, 1, 'rgba(255,255,255,.4)');
        A.rrect(g, 78, 118, 9, 12, 1.5, '#8e8a72'); A.ell(g, 82.5, 124, 1.5, 1.5, '#222');
        A.ell(g, 82.5, 114, 3, 3, '#cfcfc7'); A.ell(g, 81.8, 113.4, 1, 1, '#fff');
        const hg = A.lg(g, 70, 0, 77, 0, ['#8a8a86', '#f1f1ea', '#72726e']); A.rrect(g, 70, 86, 7, 48, 3, hg); A.rect(g, 70, 86, 7, 2, 'rgba(255,255,255,.4)');
        A.rect(g, 77, 92, 2, 4, '#555'); A.rect(g, 77, 124, 2, 4, '#555');
        // chain track and chain
        A.rect(g, 80, 56, 12, 2.2, '#b9b58f'); A.rect(g, 80, 56, 12, .6, 'rgba(255,255,255,.4)'); A.ell(g, 91, 57, 1.5, 1.5, '#999');
        g.strokeStyle = '#c9c7b0'; g.lineWidth = .9; g.beginPath(); g.moveTo(80, 57); g.quadraticCurveTo(70, 72, 62, 66); g.stroke(); g.setLineDash([1, .8]); g.strokeStyle = '#6a6a64'; g.stroke(); g.setLineDash([]);
        // shoe kicks at the bottom
        for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(12,8,6,.45)'; g.fillRect(lx + 6 + r() * 70, ly + lh - 14 - r() * 10, 12 + r() * 12, 1.2); }
        // frame shading around the leaf
        g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.2; g.strokeRect(lx, ly, lw, lh);
        // hinges
        [28, 100, 172].forEach(y => { A.rect(g, lx - 1.2, ly + y, 2.4, 14, '#2b2b2b'); A.rect(g, lx - 1.2, ly + y, .8, 14, '#777'); });
        A.rect(g, 6, h - 3.5, w - 12, 3.5, '#8e8b7e'); A.rect(g, 6, h - 3.5, w - 12, 1, 'rgba(255,255,255,.3)');   // threshold
      } else {
        // open: stairwell beyond (cold, dim), leaf swung into the hallway as a slim slanted panel
        g.save(); g.beginPath(); g.rect(lx, ly, lw, lh); g.clip();
        g.fillStyle = A.lg(g, 0, ly, 0, ly + lh, ['#17232b', '#2c4048', '#101a20']); g.fillRect(lx, ly, lw, lh);
        g.fillStyle = A.lg(g, 0, ly + 100, 0, ly + lh, ['#33503f', '#223a30']); g.fillRect(lx, ly + 100, lw, lh - 100);   // painted stairwell wall
        g.fillStyle = '#9ab0b2'; g.fillRect(lx, ly + 99, lw, 2.2);
        g.fillStyle = A.lg(g, 0, ly + 176, 0, ly + lh, ['#3d4143', '#262a2c']); g.fillRect(lx, ly + 176, lw, 30);           // landing floor
        A.poly(g, [lx + 36, ly + 176, lx + lw, ly + 140, lx + lw, ly + 148, lx + 40, ly + 184], '#2a2f30');                 // stair stringer
        for (let k = 0; k < 5; k++) A.rect(g, lx + 40 + k * 10, ly + 176 - k * 7, 14, 2, '#51585a');
        g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.moveTo(lx + 38, ly + 130); g.lineTo(lx + lw, ly + 96); g.stroke(); for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(lx + 42 + k * 12, ly + 129 - k * 7); g.lineTo(lx + 42 + k * 12, ly + 176 - k * 7); g.stroke(); }
        soft(g, lx + 56, ly + 12, 70, 36, .9, 'rgba(160,200,215,'); A.ell(g, lx + 56, ly + 10, 4, 4, '#dfeefa');
        soft(g, lx + 64, ly + 150, 80, 16, .22, 'rgba(0,0,0,');
        g.fillStyle = 'rgba(210,230,240,.5)'; g.font = 'bold 5px Arial,sans-serif'; g.fillText('ЖЭК', lx + 62, ly + 124);
        g.restore();
        // door leaf, swung inward (slanted quilted slab at the hinge side)
        const lx2 = lx, top = ly - 6;
        A.poly(g, [lx2 - 1, top, lx2 + 22, ly + 12, lx2 + 22, ly + lh - 10, lx2 - 1, ly + lh], '#6e382a');
        g.save(); g.beginPath(); g.moveTo(lx2 - 1, top); g.lineTo(lx2 + 22, ly + 12); g.lineTo(lx2 + 22, ly + lh - 10); g.lineTo(lx2 - 1, ly + lh); g.closePath(); g.clip();
        for (let j = 0; j < 14; j++) { g.fillStyle = A.rg(g, lx2 + 11, ly + 10 + j * 14.6, 0, 9, ['rgba(255,190,150,.2)', 'rgba(255,190,150,0)']); g.fillRect(lx2, ly + j * 14.6, 24, 22); }
        g.fillStyle = A.lg(g, lx2, 0, lx2 + 22, 0, ['rgba(0,0,0,.3)', 'rgba(0,0,0,.0)']); g.fillRect(lx2, ly - 8, 24, lh + 10); g.restore();
        A.rrect(g, lx2 + 16, ly + 100, 4, 22, 1.5, '#d6d6cd');
        g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1.2; g.strokeRect(lx, ly, lw, lh);
        A.rect(g, 6, h - 3.5, w - 12, 3.5, '#8e8b7e');
      }
      grainOn(g, 0, 0, w, h, .09, .35);
    };
  }

  function paintSwitch(on) {
    return (g, w, h) => {
      const cx = w / 2, cy = h / 2;
      soft(g, cx, cy, 24, 30, .5, 'rgba(60,45,25,');                             // greasy finger halo
      soft(g, cx + 1, cy + 1.5, 13, 17, .45);                                    // plate shadow
      A.rrect(g, cx - 4.4, cy - 6.5, 8.8, 13, 1.4, A.lg(g, cx - 4.4, 0, cx + 4.4, 0, ['#e7e3d2', '#cfc9b2']));
      A.rrect(g, cx - 4.4, cy - 6.5, 8.8, 13, 1.4, 'rgba(0,0,0,.05)'); A.rect(g, cx - 4.4, cy - 6.5, 8.8, .8, 'rgba(255,255,255,.7)');
      A.screws(g, [[cx, cy - 5.3], [cx, cy + 5.3]], .55, '#8a8574');
      const ty = on ? cy - 2.7 : cy + .3;
      A.rrect(g, cx - 2.6, ty, 5.2, 4.6, 1, on ? '#f6f2e2' : '#cfc9b4'); A.rect(g, cx - 2.6, on ? ty : ty + 3.4, 5.2, 1.2, 'rgba(0,0,0,.25)');
      g.fillStyle = 'rgba(90,70,40,.5)'; g.beginPath(); g.arc(cx - 1.4, cy + 3.4, 1.4, 0, P2); g.fill(); g.fillRect(cx + 1, cy - 4, 1, 3.5);
      A.line(g, cx + 5.8, cy - 7, cx + 6.2, cy - 15, 'rgba(0,0,0,.4)', .5);
      grainOn(g, 0, 0, w, h, .08, .3);
    };
  }

  function paintFuse(g, w, h) {
    soft(g, w / 2 + 1.5, h / 2 + 2.5, w + 4, h + 4, .42);
    const x = 3, y = 5, bw = 28, bh = 34;
    g.fillStyle = A.lg(g, x, 0, x + bw, 0, ['#9b9d97', '#c6c8c0', '#8d8f89']); g.fillRect(x, y, bw, bh);
    A.rect(g, x, y, bw, 1.1, 'rgba(255,255,255,.5)'); A.rect(g, x, y + bh - 1.4, bw, 1.4, 'rgba(0,0,0,.4)');
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = .7; g.strokeRect(x + 2.5, y + 2.5, bw - 5, bh - 5);
    // door with a window showing meter and a row of old plug fuses ("пробки")
    A.rect(g, x + 4, y + 5, bw - 8, 10, '#1d2224'); A.rect(g, x + 4, y + 5, bw - 8, 10, 'rgba(120,170,190,.18)'); A.rect(g, x + 4, y + 5, bw - 8, 1, 'rgba(255,255,255,.4)');
    g.fillStyle = '#e8e4d0'; g.fillRect(x + 6, y + 7.5, 13, 5); g.fillStyle = '#222'; g.font = 'bold 3.6px monospace'; g.fillText('02739', x + 6.6, y + 11.4); A.ell(g, x + 22, y + 10, 2, 2, '#b43');
    for (let i = 0; i < 3; i++) { A.ell(g, x + 8 + i * 6.2, y + 23, 2.3, 2.3, '#8a5a2c'); A.ell(g, x + 8 + i * 6.2, y + 23, 1.1, 1.1, '#241d10'); }
    A.rect(g, x + 4, y + 28, bw - 8, 1.2, '#444'); A.rrect(g, x + bw - 7, y + 17, 3.4, 5, .8, '#333');
    // wires, seal blob, hand-written tag, rust
    A.ell(g, x + 4, y + bh - 2, 1.6, 1.4, '#76748a'); soft(g, x + 20, y + 28, 14, 7, .28, 'rgba(110,60,20,');
    A.rect(g, x + 1, y + 20, 1.6, 8, '#d7d2b4'); g.fillStyle = 'rgba(40,40,40,.7)'; g.fillRect(x + 1.4, y + 22, .9, .6); g.fillRect(x + 1.4, y + 24, .9, .6);
    A.line(g, 17, 5, 17, 0, '#d8d4c0', 1.2); A.line(g, 17, y + bh, 17, h, '#d8d4c0', 1.2);
    grainOn(g, 0, 0, w, h, .1, .3);
  }

  function paintIntercom(g, w, h) {
    soft(g, w / 2 + 1, h / 2 + 2, w + 3, h, .4);
    A.rrect(g, 3, 4, 11, 26, 2, A.lg(g, 3, 0, 14, 0, ['#bdbfb6', '#e0e1d8'])); A.rect(g, 3, 4, 11, 1, 'rgba(255,255,255,.5)');
    A.rrect(g, 4.4, 6, 8, 14, 3, '#3a3c3d'); A.rrect(g, 4.4, 6, 8, 3, 1.4, 'rgba(255,255,255,.18)');
    for (let i = 0; i < 6; i++) A.ell(g, 8.4, 11 + i * 1.5, .7, .4, '#111');
    A.ell(g, 8.4, 25, 1.2, 1.2, '#7a2a24'); A.ell(g, 8.4, 25, .5, .5, '#e66');
    // keys on hooks + dangling lanyard
    A.rect(g, 4, 34, 9, 2, '#6e4a2a'); A.ell(g, 6, 37, .9, .9, '#aaa'); A.ell(g, 11, 37, .9, .9, '#aaa');
    A.line(g, 6, 37, 6, 41, '#999', .5); A.rrect(g, 4.8, 41, 2.8, 4, .5, '#c9b46a'); A.line(g, 11, 37, 11, 40, '#888', .5); A.ell(g, 11, 41.5, 2, 2, 'rgba(0,0,0,0)'); g.strokeStyle = '#777'; g.lineWidth = .5; g.beginPath(); g.arc(11, 41.5, 1.7, 0, P2); g.stroke();
    A.line(g, 8.4, 30, 8, 34, '#222', .9);
    grainOn(g, 0, 0, w, h, .08, .3);
  }

  /* ---- the wall telephone (hero prop): everything drawn in dyn so it can shake / swap hands ---- */
  const phoneImgs = {};
  function phoneAssets() {
    if (phoneImgs.body) return phoneImgs;
    phoneImgs.body = BB.bake(30, 36, (g, w, h) => {
      const x = 2, y = 2, bw = 26, bh = 32;
      soft(g, w / 2 + 1, h / 2 + 2, bw + 4, bh + 3, .38);
      g.fillStyle = A.lg(g, x, y, x + bw, y + bh, ['#e1d9bf', '#d1c8aa', '#bfb594']);
      g.beginPath(); g.roundRect(x, y, bw, bh, [3, 3, 4.5, 4.5]); g.fill();
      g.strokeStyle = 'rgba(255,255,240,.7)'; g.lineWidth = .7; g.beginPath(); g.moveTo(x + 3, y + .4); g.lineTo(x + bw - 3, y + .4); g.stroke();
      g.strokeStyle = 'rgba(70,55,30,.5)'; g.lineWidth = .8; g.beginPath(); g.moveTo(x + 3, y + bh - .4); g.lineTo(x + bw - 3, y + bh - .4); g.stroke();
      // cradle with two hook-switch prongs at the top
      A.rrect(g, x + 2.5, y + 1.5, 4.6, 8, 1.4, '#c5bc9d'); A.rrect(g, x + bw - 7.1, y + 1.5, 4.6, 8, 1.4, '#c5bc9d');
      A.rect(g, x + 2.5, y + 1.5, 4.6, .8, 'rgba(255,255,255,.5)'); A.rect(g, x + bw - 7.1, y + 1.5, 4.6, .8, 'rgba(255,255,255,.5)');
      A.rrect(g, x + 9, y + 3, 8, 3.4, 1.5, '#b9b08e'); A.rrect(g, x + 10.4, y + 3.6, 5.2, 1.4, .7, 'rgba(0,0,0,.18)');
      // keypad bezel + 12 push buttons with legends
      A.rrect(g, x + 4.2, y + 11, bw - 8.4, 16.6, 1.8, '#a89f80'); A.rrect(g, x + 4.8, y + 11.6, bw - 9.6, 15.4, 1.5, '#b5ac8c');
      const lab = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];
      for (let j = 0; j < 4; j++) for (let i = 0; i < 3; i++) {
        const bx = x + 6.2 + i * 4.9, by = y + 12.6 + j * 3.6;
        A.rrect(g, bx, by, 4.2, 3, .8, 'rgba(0,0,0,.35)'); A.rrect(g, bx, by - .2, 4.1, 2.8, .8, (i + j * 3) % 5 === 4 ? '#ece8d6' : '#f0ecde'); A.rect(g, bx + .3, by - .1, 3.5, .5, 'rgba(255,255,255,.8)');
        g.fillStyle = '#4b463a'; g.font = 'bold 2.3px Arial,sans-serif'; g.textAlign = 'center'; g.fillText(lab[i + j * 3], bx + 2.1, by + 1.9);
      }
      // grime where thumbs hit, label card, redial key, yellowing
      soft(g, x + 13, y + 20, 14, 10, .12, 'rgba(100,70,20,'); A.rrect(g, x + 6, y + 28.4, 14, 2.4, .5, '#ece6cf'); g.fillStyle = 'rgba(40,40,40,.6)'; g.fillRect(x + 7, y + 29.2, 7, .5); g.fillRect(x + 7, y + 30.1, 4, .4);
      A.ell(g, x + bw - 4, y + 29.6, 1.1, 1.1, '#a55'); A.screws(g, [[x + 3, y + bh - 2.8], [x + bw - 3, y + bh - 2.8]], .7, '#8d866c');
      grainOn(g, 0, 0, w, h, .1, .22);
    });
    phoneImgs.handset = BB.bake(36, 10, (g, w, h) => {
      const x = 2, y = 1;
      soft(g, w / 2 + .5, h / 2 + 1.5, 32, 7, .3);
      g.fillStyle = A.lg(g, 0, y, 0, y + 7, ['#e8e0c6', '#cfc6a6', '#a99f80']);
      g.beginPath(); g.moveTo(x + 2, y + 1.5); g.quadraticCurveTo(x + 17, y - 1.2, x + 32, y + 1.5); g.lineTo(x + 32, y + 6.2); g.quadraticCurveTo(x + 17, y + 3.4, x + 2, y + 6.2); g.closePath(); g.fill();
      for (const ex of [x - .5, x + 25.5]) { g.fillStyle = A.lg(g, 0, y - 1, 0, y + 8, ['#ebe3c9', '#c9bf9d', '#a79d7e']); g.beginPath(); g.roundRect(ex, y - .6, 7.5, 7.6, 2.4); g.fill(); g.fillStyle = 'rgba(40,35,25,.65)'; for (let k = 0; k < 4; k++) for (let m = 0; m < 2; m++) g.fillRect(ex + 1.6 + k * 1.2, y + 2 + m * 1.5, .6, .6); A.rect(g, ex + .5, y - .4, 6, .6, 'rgba(255,255,255,.55)'); }
      A.rect(g, x + 8, y + 1.3, 15, .7, 'rgba(255,255,255,.4)'); g.fillStyle = 'rgba(80,60,20,.18)'; g.fillRect(x + 10, y + 3.5, 10, 2);
      grainOn(g, 0, 0, w, h, .1, .22);
    });
    return phoneImgs;
  }
  function phoneDyn(g, t, S) {
    const f = F(S), im = phoneAssets(), ring = f.phoneRing && !f.phoneUp, up = !!f.phoneUp;
    const sh = ring ? Math.sin(t * 58) * .38 : 0, hop = ring ? Math.abs(Math.sin(t * 29)) * .35 : 0;
    // sprite 60 x 100: wall plate at x 15..45 (body 30x36 image), top y 6
    const bx = 15 + sh, by = 6 - hop * .3;
    g.drawImage(im.body, bx, by, 30, 36);
    if (up) {                                            // handset off the hook, dangling on the coiled cord
      const sw = Math.sin(t * 1.9) * 3.2 + Math.sin(t * 3.7) * 1.1, hx = 24 + sw, hy = 78 + Math.cos(t * 1.9) * .6;
      coil(g, [bx + 7, by + 35.5, bx + 3, 60, hx - 2, hy - 4], 2.1, 12, '#cfc7a8', '#f1ead2', 1.15);
      g.save(); g.translate(hx, hy); g.rotate(1.35 + sw * .03); g.drawImage(im.handset, -18, -5, 36, 10); g.restore();
    } else {
      g.save(); g.translate(bx + 15, by + 4.5 - hop); g.rotate(ring ? Math.sin(t * 61) * .018 : 0); g.drawImage(im.handset, -18, -5.5, 36, 10); g.restore();
      coil(g, [bx + 1.5, by + 5, bx - 10, by + 22, bx + 6, by + 36], 2, 8, '#cfc7a8', '#f1ead2', 1.1);
    }
    if (ring) {                                          // vibration arcs + pulsing "ring" marks
      const k = (Math.sin(t * 9) * .5 + .5);
      g.save(); g.strokeStyle = 'rgba(255,236,170,' + (.35 + .5 * k) + ')'; g.lineWidth = 1; g.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const o = 3 + i * 3.6 + k * 1.2; g.beginPath(); g.arc(30, 24, 21 + o, -2.5, -.64); g.stroke(); g.beginPath(); g.arc(30, 24, 21 + o, 3.78, 5.64 - Math.PI * 2 + Math.PI * 2); g.globalAlpha = 0; g.stroke(); g.globalAlpha = 1; }
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { const o = 2 + i * 3.2 + k; g.beginPath(); g.moveTo(30 + s * (17 + o), 6 - o * .3); g.lineTo(30 + s * (20 + o), 3 - o * .6); g.stroke(); }
      g.restore();
    }
  }
  function paintPhoneBack(g, w, h) {            // drop shadow + grimy halo on the wall (static)
    soft(g, 30, 25, 46, 52, .36, 'rgba(60,50,30,'); soft(g, 32, 27, 34, 40, .4);
    // pencil-written numbers on the wallpaper next to the phone
    g.save(); g.fillStyle = 'rgba(40,40,60,.65)'; g.font = 'italic 4.2px "Caveat",cursive'; g.textAlign = 'left';
    g.rotate(-.05); g.fillText('Аркадий С.', 2, 18); g.fillText('8-9..-..-47', 2, 23.5); g.fillText('ДЭН !!!', 2, 29); g.restore();
    g.strokeStyle = 'rgba(40,40,60,.5)'; g.lineWidth = .6; g.beginPath(); g.moveTo(2, 31); g.lineTo(14, 30.4); g.stroke();
    A.rrect(g, 47, 14, 9, 9, .5, 'rgba(240,230,120,.85)'); g.fillStyle = 'rgba(40,30,20,.7)'; g.fillRect(48.5, 16.5, 5.5, .6); g.fillRect(48.5, 18.2, 4, .6); g.fillRect(48.5, 19.9, 5, .6);
    A.rrect(g, 49, 24.5, 8, 8, .5, 'rgba(235,150,170,.85)'); g.fillStyle = 'rgba(40,30,20,.7)'; g.fillRect(50.2, 27, 5, .6); g.fillRect(50.2, 28.7, 3.5, .6);
  }

  function paintHookBoard(g, w, h) {
    soft(g, w / 2, h / 2 + 3, w + 6, h * .7, .38);
    g.fillStyle = A.lg(g, 0, 4, 0, 24, ['#6c4a30', '#4f3320']); g.fillRect(4, 8, w - 8, 14);
    A.rect(g, 4, 8, w - 8, 1.2, 'rgba(255,225,180,.3)'); A.rect(g, 4, 20.5, w - 8, 1.5, 'rgba(0,0,0,.4)');
    g.strokeStyle = 'rgba(20,10,5,.35)'; g.lineWidth = .5; for (let i = 0; i < 16; i++) { g.beginPath(); g.moveTo(4 + i * 6.5, 9); g.bezierCurveTo(8 + i * 6.5, 13, 3 + i * 6.5, 17, 7 + i * 6.5, 21); g.stroke(); }
    for (let i = 0; i < 5; i++) {
      const hx = 14 + i * 19; A.ell(g, hx, 14, 1.2, 1.2, '#aaa'); g.strokeStyle = '#7e7e7a'; g.lineWidth = 1.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx, 14); g.lineTo(hx, 19); g.quadraticCurveTo(hx, 24, hx + 2.6, 22); g.stroke();
      g.strokeStyle = '#e1e1da'; g.lineWidth = .5; g.beginPath(); g.moveTo(hx - .4, 14); g.lineTo(hx - .4, 19); g.stroke();
    }
    // shapka (fur hat) on the last hook, scarf strip, a bunch of keys on the first
    g.save(); g.translate(14 + 4 * 19, 26);
    g.fillStyle = A.lg(g, -10, 0, 10, 0, ['#3d2b1e', '#6d5038', '#3a281c']); g.beginPath(); g.ellipse(0, 4, 10.5, 8, 0, 0, P2); g.fill();
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(0, 9, 9, 3.4, 0, 0, P2); g.fill();
    g.strokeStyle = 'rgba(150,120,85,.5)'; g.lineWidth = .5; for (let k = 0; k < 32; k++) { const a = k / 32 * P2; g.beginPath(); g.moveTo(Math.cos(a) * 3, 2 + Math.sin(a) * 2.5); g.lineTo(Math.cos(a) * 10, 4 + Math.sin(a) * 7.5); g.stroke(); }
    A.rect(g, -4, -4, 8, 5, '#2c2018'); g.restore();
    g.save(); g.translate(14 + 19, 22); for (let k = 0; k < 3; k++) { A.line(g, 0, 0, -2 + k * 2.4, 6 + k, '#aaa', .5); A.ell(g, -2 + k * 2.4, 7 + k, 1.2, 1.5, ['#c8b252', '#b9bdb6', '#c8b252'][k]); } g.restore();
    grainOn(g, 0, 0, w, h, .1, .3);
  }

  function paintCoat(kind) {
    return (g, w, h) => {
      const cx = w / 2, r = srand(kind === 'wool' ? 3 : kind === 'puff' ? 5 : 8);
      const P = { wool: ['#2f3645', '#434b5e', '#232a36'], puff: ['#7b6a30', '#a08c46', '#5d5024'], hood: ['#585b61', '#7d8087', '#44464b'] }[kind];
      A.ell(g, cx, 2.2, 2.4, 2.1, 'rgba(0,0,0,.4)');
      const body = (pts) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); };
      if (kind === 'wool') {                                           // long wool overcoat 46 x 112
        body([cx - 3, 3, cx - 11, 6, cx - 21, 14, cx - 23, 40, cx - 24, 108, cx - 12, 111, cx, 108, cx + 12, 111, cx + 24, 108, cx + 23, 40, cx + 21, 14, cx + 11, 6, cx + 3, 3]);
        g.fillStyle = A.lg(g, cx - 24, 0, cx + 24, 0, [P[2], P[1], P[0], P[2]]); g.fill();
        g.save(); body([cx - 3, 3, cx - 11, 6, cx - 21, 14, cx - 23, 40, cx - 24, 108, cx - 12, 111, cx, 108, cx + 12, 111, cx + 24, 108, cx + 23, 40, cx + 21, 14, cx + 11, 6, cx + 3, 3]); g.clip();
        for (let i = 0; i < 14; i++) { const x = cx - 24 + i * 3.7 + r() * 2; g.fillStyle = 'rgba(0,0,0,' + (.12 + r() * .15) + ')'; g.fillRect(x, 8, 1.3 + r() * 2, 104); g.fillStyle = 'rgba(180,190,215,' + (.05 + r() * .08) + ')'; g.fillRect(x + 1.8, 8, .9, 104); }
        g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(cx - .5, 14, 1, 100);                                    // front seam
        for (let k = 0; k < 4; k++) { A.ell(g, cx - 3.2, 34 + k * 17, 1.7, 1.7, '#171a21'); A.ell(g, cx - 3.5, 33.6 + k * 17, .6, .6, 'rgba(255,255,255,.3)'); }
        A.blotches(g, cx - 24, 70, 48, 42, 4, 7, 'rgba(150,140,110,.18)', 3, 7);                        // dust / lint
        g.fillStyle = A.lg(g, 0, 90, 0, 112, ['rgba(60,45,25,0)', 'rgba(60,45,25,.5)']); g.fillRect(cx - 25, 90, 50, 22);   // mud hem
        g.restore();
        A.poly(g, [cx - 12, 5, cx - 3, 3, cx - 1, 22, cx - 10, 17], '#232a36'); A.poly(g, [cx + 12, 5, cx + 3, 3, cx + 1, 22, cx + 10, 17], '#232a36');
        A.line(g, cx - 12, 5, cx - 1, 22, 'rgba(255,255,255,.12)', .5);
        A.rect(g, cx - 25, 38, 6, 70, 'rgba(0,0,0,.2)');                                                 // sleeve fall
      } else if (kind === 'puff') {                                    // short puffer jacket 50 x 70
        body([cx - 3, 3, cx - 12, 6, cx - 23, 13, cx - 25, 40, cx - 24, 66, cx - 6, 69, cx + 6, 69, cx + 24, 66, cx + 25, 40, cx + 23, 13, cx + 12, 6, cx + 3, 3]);
        g.fillStyle = A.lg(g, cx - 25, 0, cx + 25, 0, [P[2], P[1], P[0], P[2]]); g.fill();
        g.save(); body([cx - 3, 3, cx - 12, 6, cx - 23, 13, cx - 25, 40, cx - 24, 66, cx - 6, 69, cx + 6, 69, cx + 24, 66, cx + 25, 40, cx + 23, 13, cx + 12, 6, cx + 3, 3]); g.clip();
        for (let y = 14; y < 70; y += 9.5) { g.fillStyle = A.lg(g, 0, y, 0, y + 9.5, ['rgba(255,240,170,.22)', 'rgba(0,0,0,0)', 'rgba(0,0,0,.32)']); g.fillRect(cx - 26, y, 52, 9.5); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(cx - 26, y + 9, 52, .7); }
        g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(cx - .4, 8, .8, 62);
        A.blotches(g, cx - 25, 40, 50, 30, 6, 6, 'rgba(60,40,15,.3)', 3, 8); g.restore();
        A.rrect(g, cx - 10, 4, 20, 6, 3, P[2]); A.rect(g, cx - 10, 4, 20, 1, 'rgba(255,240,170,.3)');
        A.rect(g, cx + 1.5, 9, 2.2, 3, '#bbb');
      } else {                                                          // grey hoodie with a long scarf 44 x 74
        body([cx - 3, 3, cx - 10, 6, cx - 20, 18, cx - 22, 44, cx - 21, 70, cx - 6, 73, cx + 6, 73, cx + 21, 70, cx + 22, 44, cx + 20, 18, cx + 10, 6, cx + 3, 3]);
        g.fillStyle = A.lg(g, cx - 22, 0, cx + 22, 0, [P[2], P[1], P[0], P[2]]); g.fill();
        g.save(); body([cx - 3, 3, cx - 10, 6, cx - 20, 18, cx - 22, 44, cx - 21, 70, cx - 6, 73, cx + 6, 73, cx + 21, 70, cx + 22, 44, cx + 20, 18, cx + 10, 6, cx + 3, 3]); g.clip();
        for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(' + (r() < .5 ? '0,0,0,' : '255,255,255,') + (.04 + r() * .07) + ')'; g.fillRect(cx - 22 + r() * 44, 10 + r() * 62, .7, 8 + r() * 14); }
        g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(cx - 12, 52, 24, 14); A.rrect(g, cx - 11, 50, 22, 14, 2, 'rgba(0,0,0,.08)');
        g.restore();
        A.ell(g, cx, 12, 11, 8, P[2]); A.ell(g, cx, 14, 8, 5, '#2c2d30'); A.line(g, cx - 3, 20, cx - 3.4, 32, '#ddd', .5); A.line(g, cx + 3, 20, cx + 3.4, 31, '#ddd', .5);
        // striped scarf draped over the hook and hanging down the front
        for (let i = 0; i < 14; i++) A.poly(g, [cx + 4 + i * .2, 8 + i * 3.6, cx + 11 + i * .2, 8 + i * 3.6, cx + 11.4 + i * .2, 11.4 + i * 3.6, cx + 4.4 + i * .2, 11.4 + i * 3.6], i % 2 ? '#8e2a2a' : '#d6d0b4');
        g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(cx + 4, 8, 3, 50);
      }
      g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(cx - 8, 4, 16, 1);
    };
  }

  function paintShoeRack(g, w, h) {
    const r = srand(21);
    soft(g, w / 2, h - 1, w + 4, 8, .55);
    // 3-tier metal rack
    g.fillStyle = '#35373a'; for (const x of [3, w - 5]) g.fillRect(x, 0, 2.2, h);
    A.rect(g, 3, 0, .6, h, 'rgba(255,255,255,.3)');
    const shoes = [[['#a73', 'sneak', 11], ['#46505e', 'boot', 14], ['#d6d3c8', 'sneak', 22], ['#252528', 'boot', 36], ['#7c3a2b', 'sneak', 51], ['#2b3b52', 'sneak', 60]], [['#1e1e20', 'boot', 8], ['#6b5a3d', 'boot', 24], ['#9a4a43', 'slip', 42], ['#32353a', 'sneak', 54]], [['#25282b', 'sneak', 14], ['#bfae6e', 'slip', 34]]];
    [0, 1, 2].forEach(tier => {
      const y = 14 + tier * 15; A.rect(g, 3, y, w - 6, 1.8, '#4a4d51'); A.rect(g, 3, y, w - 6, .6, 'rgba(255,255,255,.35)');
      shoes[tier].forEach(([c, type, x]) => shoe(g, x, y, c, type, r() < .5));
    });
    // top: dusty pile (cap, plastic bag)
    A.rrect(g, 36, -0.5, 24, 1.5, .6, '#202225');
    grainOn(g, 0, 0, w, h, .08, .3);
  }
  function shoe(g, x, y, c, type, flip) {
    g.save(); g.translate(x, y); if (flip) g.scale(-1, 1);
    if (type === 'boot') { g.fillStyle = c; g.beginPath(); g.moveTo(-5, 0); g.lineTo(-5, -9); g.lineTo(0, -10); g.lineTo(1, -4); g.quadraticCurveTo(6, -4, 8, -1.2); g.lineTo(8, 0); g.closePath(); g.fill(); A.rect(g, -5, -9.5, 5, 1, 'rgba(255,255,255,.2)'); }
    else if (type === 'slip') { g.fillStyle = c; g.beginPath(); g.moveTo(-5, 0); g.quadraticCurveTo(-5, -4.6, 0, -5.4); g.quadraticCurveTo(5, -4.6, 8, -1.8); g.lineTo(8, 0); g.closePath(); g.fill(); A.rect(g, -5, -1.6, 13, 1.2, 'rgba(255,255,255,.25)'); }
    else { g.fillStyle = c; g.beginPath(); g.moveTo(-5, 0); g.lineTo(-5, -6.5); g.quadraticCurveTo(-1, -7.5, 1, -5.5); g.quadraticCurveTo(6, -4.8, 8.4, -2); g.lineTo(8.4, 0); g.closePath(); g.fill(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = .4; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-0.5 + k * 1.6, -5.6 + k * .4); g.lineTo(1 + k * 1.6, -4.4 + k * .5); g.stroke(); } }
    g.fillStyle = type === 'slip' ? '#cfc9b8' : '#e3e0d4'; g.fillRect(-5.4, -1.6, 14, 1.6); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(-5.4, -.4, 14, .4);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.moveTo(-5, 0); g.lineTo(-5, -6); g.lineTo(-2, 0); g.fill();
    g.restore();
  }
  function paintShoePile(g, w, h) {
    soft(g, w / 2, h - 3, w + 6, 12, .6);
    const items = [[10, 'boot', '#272a2e', 0], [27, 'sneak', '#8d3c2f', 0], [44, 'sneak', '#4a4f60', 1], [56, 'slip', '#9a8a4a', 0], [19, 'sneak', '#c8c4b4', 0], [38, 'boot', '#33302a', 1]];
    items.forEach(([x, type, c, fl], i) => {
      g.save(); g.translate(0, i >= 4 ? -3 : 0); g.translate(x, h - 1 - (i >= 4 ? 5 : 0)); if (i === 4) { g.rotate(-.25); } if (i === 5) { g.rotate(.15); g.translate(0, -2); } g.translate(-x, -(h - 1 - (i >= 4 ? 5 : 0)));
      shoe(g, x, h - 1 - (i >= 4 ? 5 : 0), c, type, !!fl); g.restore();
    });
    // one boot knocked over on its side + mud lump
    g.save(); g.translate(66, h - 1); g.rotate(-1.4); shoe(g, 0, 0, '#1d1f22', 'boot', false); g.restore();
    soft(g, 30, h - 1.5, 30, 3, .25, 'rgba(30,22,12,');
    grainOn(g, 0, 0, w, h, .1, .3);
  }

  function paintUmbrellas(g, w, h) {
    soft(g, w / 2, h - 1.5, 26, 6, .55);
    A.rrect(g, 4, h - 28, 20, 28, 3, A.lg(g, 4, 0, 24, 0, ['#2f3a40', '#53636a', '#27323a'])); A.rect(g, 4, h - 28, 20, 1.4, 'rgba(255,255,255,.3)'); A.rect(g, 5, h - 10, 18, 7, 'rgba(0,0,0,.18)');
    A.ell(g, 14, h - 28, 10, 2, '#111');
    // umbrellas: a long black one (hook handle), a folded green one, a child's yellow
    g.strokeStyle = '#17181a'; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(10, h - 26); g.lineTo(10, 18); g.stroke();
    g.beginPath(); g.moveTo(10, 18); g.arc(7, 16, 3.2, 0, -Math.PI, true); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = .5; g.beginPath(); g.moveTo(10.6, h - 26); g.lineTo(10.6, 20); g.stroke();
    g.save(); g.translate(18, h - 26); g.rotate(.14); g.fillStyle = '#34503f'; g.fillRect(-2.4, -48, 4.8, 48); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(.4, -48, 2, 48); A.rect(g, -2.4, -48, 4.8, 2, '#555'); A.rrect(g, -2, -54, 4, 8, 1.4, '#9a6a3a'); g.restore();
    g.save(); g.translate(13, h - 26); g.rotate(-.06); g.fillStyle = '#c9a53a'; g.fillRect(-1.9, -38, 3.8, 38); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(.3, -38, 1.7, 38); g.restore();
    grainOn(g, 0, 0, w, h, .08, .3);
  }

  function paintBulb(on) {
    return (g, w, h) => {
      const cx = w / 2;
      A.line(g, cx, 0, cx, 21, '#1c1c1c', .9); A.line(g, cx - .2, 0, cx - .2, 21, 'rgba(255,255,255,.2)', .3);
      A.rrect(g, cx - 3.4, 20, 6.8, 6, 1, '#d8d4c4'); A.rect(g, cx - 3.4, 20, 6.8, 1, 'rgba(255,255,255,.5)'); A.rect(g, cx - 3.4, 22, 6.8, .6, 'rgba(0,0,0,.2)'); A.rect(g, cx - 3.4, 24, 6.8, .6, 'rgba(0,0,0,.2)');
      A.rect(g, cx - 3, 26, 6, 2.6, '#b8a56a');
      g.beginPath(); g.moveTo(cx - 2.4, 28); g.bezierCurveTo(cx - 8.5, 33, cx - 8.5, 46, cx, 48); g.bezierCurveTo(cx + 8.5, 46, cx + 8.5, 33, cx + 2.4, 28); g.closePath();
      g.fillStyle = on ? A.rg(g, cx, 40, 0, 9, ['#fffdf0', '#ffe9a8', '#f2c970']) : A.rg(g, cx - 1.5, 38, 0, 11, ['rgba(220,225,230,.55)', 'rgba(130,140,150,.4)', 'rgba(60,66,72,.65)']); g.fill();
      if (!on) { g.strokeStyle = 'rgba(210,220,230,.6)'; g.lineWidth = .5; g.stroke(); A.line(g, cx - 1, 31, cx - 1, 38, '#6a6a60', .4); A.line(g, cx + 1, 31, cx + 1, 38, '#6a6a60', .4); g.strokeStyle = '#7d7a68'; g.lineWidth = .35; g.beginPath(); g.moveTo(cx - 1, 38); g.bezierCurveTo(cx - 3, 40, cx + 3, 40, cx + 1, 38); g.stroke(); A.ell(g, cx - 3.2, 37, 1.2, 2.6, 'rgba(255,255,255,.35)'); }
      else { g.strokeStyle = '#ff9e30'; g.lineWidth = .5; g.beginPath(); g.moveTo(cx - 1, 33); g.bezierCurveTo(cx - 3, 38, cx + 3, 38, cx + 1, 33); g.stroke(); }
    };
  }

  const boxPaint = (o, extra) => (g, w, h) => {
    cardbox(g, 0, 0, w, h, o);
    if (extra) extra(g, w, h);
    grainOn(g, 0, 0, w, h, .1, .35);
  };
  const paintBoxA = boxPaint({ seed: 3, label: true, tx: .45 }, (g, w, h) => {
    g.save(); g.beginPath(); g.moveTo(2, h - 8); g.bezierCurveTo(-2, h - 4, 6, h, 14, h - 1); g.lineTo(12, h - 8); g.closePath(); g.fillStyle = 'rgba(210,225,235,.65)'; g.fill(); g.clip();
    g.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(1 + i * 2.2, h - 7.2 + j * 1.9, .8, 0, P2); g.fill(); } g.restore();
  });
  const paintBoxB = boxPaint({ seed: 8, base: '#a7845a', text: 'ХРУПКОЕ', fs: 3.6, tx: .72, tx2: .45 }, (g, w, h) => { A.rect(g, w * .1, h * .58, w * .4, h * .26, 'rgba(0,0,0,.14)'); g.fillStyle = 'rgba(40,40,40,.6)'; g.font = 'bold 2.8px Arial,sans-serif'; g.fillText('Т-ПЛЕЙ', w * .13, h * .78); });
  const paintBoxC = boxPaint({ seed: 6, base: '#bd9a6c', text: '↑ ВВЕРХ ↑', fs: 3.8, tcol: 'rgba(30,30,30,.7)', tx: .62, tx2: .45 });
  const paintBoxD = boxPaint({ seed: 12, base: '#9d7c54', tx: .3, label: true });
  function paintBoxesLeft(g, w, h) {
    soft(g, w / 2, h - 3, w, 8, .4);
    g.save(); g.translate(10, h - 3.5); g.rotate(-.04); A.rect(g, 0, -2.4, 44, 2.4, '#b29065'); A.rect(g, 0, -2.4, 44, .6, 'rgba(255,255,255,.3)'); A.rect(g, 0, -.4, 44, .4, 'rgba(0,0,0,.4)'); g.restore();
    g.save(); g.translate(24, h - 6); g.rotate(.05); A.rect(g, 0, -2.2, 34, 2.2, '#a6845a'); A.rect(g, 0, -2.2, 34, .6, 'rgba(255,255,255,.3)'); g.restore();
    A.ell(g, 8, h - 3, 3.2, 3, '#c9b268'); A.ell(g, 8, h - 3, 1.5, 1.5, '#2b2b2b'); g.fillStyle = 'rgba(210,225,235,.7)'; g.beginPath(); g.ellipse(58, h - 3, 7, 2.4, 0, 0, P2); g.fill();
    grainOn(g, 0, 0, w, h, .1, .3);
  }

  function paintMirror(g, w, h) {
    soft(g, w / 2 + 1, h / 2 + 2, w + 3, h + 3, .42);
    A.rrect(g, 3, 3, w - 6, h - 6, 2, A.lg(g, 3, 0, w - 3, 0, ['#4d3322', '#7b573a', '#3d281a']));
    A.rect(g, 3, 3, w - 6, .9, 'rgba(255,225,180,.3)');
    const x = 7.5, y = 7.5, mw = w - 15, mh = h - 15;
    g.save(); g.beginPath(); g.rect(x, y, mw, mh); g.clip();
    g.fillStyle = A.lg(g, x, y, x + mw, y + mh, ['#6c7f84', '#3d4c52', '#566a6e']); g.fillRect(x, y, mw, mh);
    // faint reflected room: dark door shape, lamp-light bloom
    g.fillStyle = 'rgba(20,25,28,.45)'; g.fillRect(x + 4, y + 28, 12, mh - 28); soft(g, x + mw - 8, y + 12, 22, 22, .3, 'rgba(255,240,200,');
    g.fillStyle = 'rgba(255,255,255,.13)'; g.beginPath(); g.moveTo(x, y + 6); g.lineTo(x + 14, y); g.lineTo(x + 30, y); g.lineTo(x, y + 36); g.fill();
    g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(x + mw, y + mh - 8); g.lineTo(x + mw, y + mh - 38); g.lineTo(x + mw - 22, y + mh); g.lineTo(x + mw - 4, y + mh); g.fill();
    A.blotches(g, x, y, mw, mh, 2, 8, 'rgba(10,15,15,.28)', 2, 8);       // silvering rot
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = .5; g.beginPath(); g.moveTo(x + mw, y + 6); g.lineTo(x + mw - 13, y + 18); g.lineTo(x + mw - 9, y + 26); g.moveTo(x + mw - 13, y + 18); g.lineTo(x + mw - 23, y + 20); g.stroke();     // crack
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = .3; g.beginPath(); g.moveTo(x + mw + .5, y + 6.6); g.lineTo(x + mw - 12.5, y + 18.6); g.stroke();
    g.restore();
    A.rect(g, x, y, mw, .8, 'rgba(0,0,0,.45)'); A.rect(g, x, y, .8, mh, 'rgba(0,0,0,.35)');
    // sticker + hair elastic on the frame
    A.rrect(g, w - 15, h - 16, 6, 5, .8, '#d65a7a'); g.strokeStyle = '#2a2a2a'; g.lineWidth = .6; g.beginPath(); g.arc(8, h - 5, 2, 0, P2); g.stroke();
    grainOn(g, 0, 0, w, h, .1, .3);
  }

  function paintCalendar(g, w, h) {
    soft(g, w / 2 + 1, h / 2 + 2, w + 2, h, .42);
    A.rect(g, 2, 2, w - 4, h - 4, '#e5e0cd'); g.fillStyle = A.lg(g, 0, 2, 0, 20, ['#27456c', '#4b7d9c']); g.fillRect(2, 2, w - 4, 17);       // photo: a blue lada-ish landscape
    A.poly(g, [2, 19, 9, 11, 14, 15, 20, 8, w - 2, 19], '#2f5a3a'); A.ell(g, w - 8, 7, 2, 2, '#f1e4a0');
    A.rect(g, 8, 20, 10, 4, '#b32'); A.rect(g, 6, 22, 14, 2, '#222');
    g.fillStyle = '#222'; g.font = 'bold 3.6px Arial,sans-serif'; g.textAlign = 'center'; g.fillText('ОКТЯБРЬ', w / 2, 29); g.fillStyle = 'rgba(40,40,40,.7)';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) g.fillRect(4 + c * 2.7, 31 + r * 1.6, 1.6, .8);
    A.rect(g, 4 + 3 * 2.7, 31 + 2 * 1.6, 2, 1.2, 'rgba(200,30,30,.8)');
    A.rect(g, 2, h - 4.2, w - 4, 1, 'rgba(0,0,0,.3)'); A.ell(g, w / 2, 3, 1.1, 1.1, '#c33'); A.line(g, w / 2, 3, w / 2, 1, '#777', .4);
    A.poly(g, [w - 2, h - 2, w - 9, h - 2, w - 2, h - 9], '#d4cfba'); A.poly(g, [w - 2, h - 9, w - 9, h - 2, w - 6, h - 5.5], 'rgba(0,0,0,.2)');
    grainOn(g, 0, 0, w, h, .1, .3);
  }

  function paintBagStand(level) {
    return (g, w, h) => {
      const cx = w / 2, r = srand(14 + level);
      soft(g, cx, h - 1.5, 40, 8, .6);
      // wire frame: ring on three legs with a foot spreader
      g.strokeStyle = '#6a6c70'; g.lineWidth = 1.3; g.lineCap = 'round';
      [[-14, 0], [14, 0], [0, 0]].forEach(([dx], i) => { g.beginPath(); g.moveTo(cx + dx * 1.15, h - 1); g.lineTo(cx + dx * .8, h - 26); g.stroke(); });
      g.strokeStyle = '#8e9094'; g.lineWidth = .6; [[-14], [14]].forEach(([dx]) => { g.beginPath(); g.moveTo(cx + dx * 1.15 - .4, h - 1); g.lineTo(cx + dx * .8 - .4, h - 26); g.stroke(); });
      g.strokeStyle = '#6a6c70'; g.lineWidth = 1; g.beginPath(); g.ellipse(cx, h - 7, 15, 3.2, 0, 0, P2); g.stroke();
      // the bag: black plastic with a bulge depending on fullness
      const bh = 26 + level * 3, bw = 16 + level * 2.4, top = h - 28 - (bh - 26) + 4;
      const grad = A.lg(g, cx - bw, 0, cx + bw, 0, ['#0a0a0c', '#2b2d33', '#101114', '#07070a']);
      g.beginPath(); g.moveTo(cx - 12, top + 6); g.bezierCurveTo(cx - bw - 4, top + 12, cx - bw - 2, top + bh - 4, cx - 10, h - 6); g.lineTo(cx + 10, h - 6); g.bezierCurveTo(cx + bw + 2, top + bh - 4, cx + bw + 4, top + 12, cx + 12, top + 6); g.closePath(); g.fillStyle = grad; g.fill();
      g.save(); g.clip();
      g.strokeStyle = 'rgba(170,180,200,.22)'; g.lineWidth = .6; for (let i = 0; i < 6; i++) { g.beginPath(); const x = cx - bw + r() * bw * 2; g.moveTo(x, top + 8); g.quadraticCurveTo(x + (r() - .5) * 8, top + bh * .5, x + (r() - .5) * 5, h - 8); g.stroke(); }
      g.fillStyle = 'rgba(190,200,220,.25)'; g.beginPath(); g.ellipse(cx - bw * .45, top + bh * .45, 1.6, bh * .32, .1, 0, P2); g.fill();
      // things poking through: can, bone, pizza-box corner
      if (level >= 2) { A.rrect(g, cx + 2, top + bh * .55, 4.5, 6, 1, '#b8483a'); A.rect(g, cx + 2, top + bh * .55 + 1, 4.5, .6, 'rgba(255,255,255,.5)'); }
      if (level >= 3) { A.poly(g, [cx - 8, top + bh * .3, cx - 2, top + bh * .25, cx - 3, top + bh * .42], '#d9cfa4'); }
      g.restore();
      // neck / knot and tails
      g.fillStyle = '#0e0e11'; g.beginPath(); g.moveTo(cx - 12, top + 6); g.quadraticCurveTo(cx - 5, top - 1, cx, top + 1); g.quadraticCurveTo(cx + 6, top - 2, cx + 12, top + 6); g.quadraticCurveTo(cx, top + 9, cx - 12, top + 6); g.fill();
      A.poly(g, [cx - 2, top + 1, cx - 9, top - 4, cx - 5, top - 5, cx + 1, top], '#17181b'); A.poly(g, [cx + 2, top + 1, cx + 9, top - 3, cx + 6, top - 6, cx + 1, top], '#1b1c20');
      if (level === 0) { g.fillStyle = 'rgba(0,0,0,.6)'; g.beginPath(); g.ellipse(cx, top + 6, 13, 3, 0, 0, P2); g.fill(); g.fillStyle = 'rgba(50,50,56,.7)'; g.beginPath(); g.ellipse(cx, top + 5.4, 12, 2.2, 0, 0, P2); g.fill(); }
      if (level >= 5) {                                   // overflow: junk piled on top and spilled in front
        A.rect(g, cx - 5, top - 3, 10, 4, '#d9d3c0'); A.rrect(g, cx + 3, top - 6, 5, 7, 1, '#2f5ea2'); A.ell(g, cx - 10, top - 1, 4, 2, '#8c3'); A.ell(g, cx + 16, h - 3, 3.5, 2, '#cbbf9a'); A.rrect(g, cx - 20, h - 5, 5, 4, 1, '#b8483a');
      }
      grainOn(g, 0, 0, w, h, .1, .3);
    };
  }
  function paintBagBack(g, w, h) { grainOn(g, 0, 0, w, h, 0); }

  function paintCloset(mode) {
    return (g, w, h) => {
      const r = srand(61), x0 = 3, bw = 88, top = 2, bh = h - top - 0, ch = 7;
      soft(g, w / 2, h - 2, w + 10, 12, .5);
      // carcass: polished veneer, cornice, plinth
      g.fillStyle = A.lg(g, x0, 0, x0 + bw, 0, ['#412819', '#6a4429', '#573621', '#3d2415']); g.fillRect(x0, top, bw, bh - 7);
      g.fillStyle = A.lg(g, 0, top - 3, 0, top + 6, ['#7a5233', '#4c2f1c']); g.fillRect(x0 - 1.5, top - 3, bw + 3, ch); A.rect(g, x0 - 1.5, top - 3, bw + 3, 1.1, 'rgba(255,220,170,.3)'); A.rect(g, x0 - 1.5, top + ch - 3.4, bw + 3, 1.3, 'rgba(0,0,0,.45)');
      g.fillStyle = '#2b1a10'; g.fillRect(x0 + 2, h - 8, bw - 4, 8); A.rect(g, x0 + 2, h - 8, bw - 4, .9, 'rgba(255,255,255,.15)');
      // dust drift along the cornice
      A.rect(g, x0 - 1.5, top - 4.4, bw + 3, 1.6, 'rgba(160,150,130,.5)');
      const doorY = top + ch + 1, doorH = bh - ch - 16;
      const drawDoor = (dx, dw, hingeLeft) => {
        g.fillStyle = A.lg(g, 0, doorY, 0, doorY + doorH, ['#5a3a24', '#68442b', '#51331f']); g.fillRect(dx, doorY, dw, doorH);
        g.strokeStyle = 'rgba(20,10,4,.75)'; g.lineWidth = .9; g.strokeRect(dx + .5, doorY + .5, dw - 1, doorH - 1);
        // inset panels
        for (const [py, ph] of [[8, doorH * .42 - 10], [doorH * .42 + 4, doorH * .58 - 14]]) {
          g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(dx + 4, doorY + py, dw - 8, ph); g.strokeStyle = 'rgba(255,225,180,.18)'; g.lineWidth = .6; g.strokeRect(dx + 4.3, doorY + py + .3, dw - 8.6, ph - .6);
          g.strokeStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.moveTo(dx + 4, doorY + py + ph); g.lineTo(dx + 4, doorY + py); g.lineTo(dx + dw - 4, doorY + py); g.stroke();
        }
        // wood grain streaks + wear on the edges
        for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(' + (r() < .5 ? '20,8,2,' : '255,200,140,') + (.06 + r() * .08) + ')'; g.lineWidth = .4 + r() * .5; const sx = dx + 3 + r() * (dw - 6); g.beginPath(); g.moveTo(sx, doorY + 2); g.bezierCurveTo(sx + (r() - .5) * 5, doorY + doorH * .3, sx + (r() - .5) * 5, doorY + doorH * .6, sx + (r() - .5) * 3, doorY + doorH - 2); g.stroke(); }
        g.fillStyle = A.lg(g, 0, doorY + doorH - 40, 0, doorY + doorH, ['rgba(0,0,0,0)', 'rgba(0,0,0,.35)']); g.fillRect(dx, doorY + doorH - 40, dw, 40);
        soft(g, dx + dw * .5, doorY + doorH * .5, dw * .8, 40, .12, 'rgba(255,230,190,');
      };
      const handle = (hx) => { const hy = doorY + doorH * .45; g.fillStyle = A.lg(g, hx, 0, hx + 3, 0, ['#8d8a82', '#f1efe6', '#74716a']); g.beginPath(); g.roundRect(hx, hy, 2.6, 22, 1.2); g.fill(); A.rect(g, hx - 1, hy + 3, 4.6, 1.4, '#555'); A.rect(g, hx - 1, hy + 17.4, 4.6, 1.4, '#555'); };
      if (mode === 'closed') {
        drawDoor(x0 + 1.5, bw / 2 - 1.5, false); drawDoor(x0 + bw / 2, bw / 2 - 1.5, true);
        A.rect(g, x0 + bw / 2 - 1, doorY, 2, doorH, '#1d1008');
        handle(x0 + bw / 2 - 6.5); handle(x0 + bw / 2 + 3.9); A.ell(g, x0 + bw / 2 + 12, doorY + doorH * .47, 1.1, 1.1, '#a89a5c');
      } else {
        // left half opened: dark interior with a rail of clothes, shelf of towels and the vacuum on the floor
        const ix = x0 + 2, iw = bw / 2 - 2, iy = doorY, ih = doorH;
        g.fillStyle = A.lg(g, ix, 0, ix + iw, 0, ['#0e0905', '#1e140b', '#150e08']); g.fillRect(ix, iy, iw, ih);
        g.save(); g.beginPath(); g.rect(ix, iy, iw, ih); g.clip();
        A.rect(g, ix, iy + 38, iw, 2.2, '#4a2f1b'); A.rect(g, ix, iy + 38, iw, .6, 'rgba(255,220,170,.25)');
        for (let k = 0; k < 4; k++) { A.rect(g, ix + 3, iy + 30 - k * 4.2, iw - 8, 4, ['#bdb9a9', '#7d93a6', '#c9bba0', '#9a6a6a'][k]); A.rect(g, ix + 3, iy + 30 - k * 4.2, iw - 8, .5, 'rgba(255,255,255,.4)'); }
        A.rect(g, ix, iy + 8, iw, 1.4, '#9c9a94');                                                     // rail
        [['#4b5e7a', 7], ['#7a3a3a', 12], ['#555a52', 16], ['#a79b72', 21], ['#3b3b44', 26]].forEach(([c, x], i) => { g.fillStyle = c; g.beginPath(); g.moveTo(ix + x - 3, iy + 10); g.lineTo(ix + x + 3, iy + 10); g.lineTo(ix + x + 4.2, iy + 36); g.lineTo(ix + x - 4.2, iy + 36); g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(ix + x + 1, iy + 10, 2, 26); A.line(g, ix + x, iy + 8.5, ix + x, iy + 10.5, '#bbb', .5); });
        soft(g, ix + iw / 2, iy + ih * .55, iw, ih * .6, .35, 'rgba(255,200,140,');
        if (mode === 'openVac') {                                                                       // canister vacuum, hose and tube
          const vx = ix + 4, vy = iy + ih - 25;
          soft(g, vx + 18, vy + 25, 38, 6, .6);
          g.fillStyle = A.lg(g, 0, vy, 0, vy + 21, ['#d9693a', '#a8441f', '#7a2e14']); g.beginPath(); g.roundRect(vx, vy + 3, 34, 19, 7); g.fill();
          A.rect(g, vx + 6, vy + 3, 22, 1.1, 'rgba(255,230,200,.5)'); A.rect(g, vx + 3, vy + 12, 28, 1, 'rgba(0,0,0,.3)');
          g.fillStyle = A.lg(g, vx - 1, 0, vx + 5, 0, ['#7a7a76', '#e9e9e2', '#6a6a66']); g.fillRect(vx - 1.5, vy + 6, 3.6, 12); g.fillRect(vx + 31.5, vy + 6, 3.6, 12);
          A.ell(g, vx + 7, vy + 22.5, 3.1, 3.1, '#222'); A.ell(g, vx + 27, vy + 22.5, 3.1, 3.1, '#222'); A.ell(g, vx + 7, vy + 22.5, 1.2, 1.2, '#999'); A.ell(g, vx + 27, vy + 22.5, 1.2, 1.2, '#999');
          A.rrect(g, vx + 12, vy + 6.5, 10, 4, 1, '#d8d2bc'); A.rect(g, vx + 13, vy + 7.5, 8, .8, '#444');
          g.strokeStyle = '#1f1f22'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(vx + 36, vy + 12); g.bezierCurveTo(vx + 44, vy + 4, vx + 40, vy - 10, vx + 28, vy - 2); g.bezierCurveTo(vx + 14, vy + 6, vx + 40, vy - 22, vx + 22, vy - 16); g.stroke();
          g.strokeStyle = 'rgba(160,165,175,.55)'; g.lineWidth = .5; g.setLineDash([.9, 1]); g.beginPath(); g.moveTo(vx + 36, vy + 11); g.bezierCurveTo(vx + 44, vy + 3, vx + 40, vy - 11, vx + 28, vy - 3); g.stroke(); g.setLineDash([]);
          g.strokeStyle = '#a8aaae'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(vx + 22, vy - 16); g.lineTo(vx + 14, vy - 28); g.stroke(); A.rrect(g, vx + 7, vy - 31, 12, 3, 1, '#d4d5d8');
          A.line(g, vx + 1, vy + 18, ix - 1, vy + 21, '#e6e0cf', .9); A.ell(g, ix + 1, vy + 22, 1.6, 1.2, '#222');
        } else {
          g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(ix, iy + ih - 6, iw, 6); A.rect(g, ix + 8, iy + ih - 12, 14, 6, 'rgba(40,40,40,.0)'); soft(g, ix + 22, iy + ih - 5, 24, 4, .5, 'rgba(60,50,40,'); A.rect(g, ix + 6, iy + ih - 5.4, 9, 2, '#6a6a60');
        }
        g.restore();
        g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 1.2; g.strokeRect(ix, iy, iw, ih);
        A.rect(g, ix + iw, doorY, 3, doorH, '#3b2415'); A.rect(g, ix + iw, doorY, .8, doorH, 'rgba(255,220,170,.2)');
        // right door still closed
        drawDoor(x0 + bw / 2 + 1, bw / 2 - 1.5, true); handle(x0 + bw / 2 + 4.5);
        // the open left door seen at a sharp angle: slim trapezoid hanging off the left edge
        const ox = x0 - 7;
        A.poly(g, [x0 + 1, doorY - 1, ox + 2, doorY + 5, ox + 2, doorY + doorH - 5, x0 + 1, doorY + doorH + 1], '#4b2e1b');
        A.poly(g, [x0 + 1, doorY - 1, ox + 2, doorY + 5, ox + 2, doorY + 8, x0 + 1, doorY + 2], 'rgba(255,220,170,.22)');
        g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = .8; g.beginPath(); g.moveTo(x0 + 1, doorY - 1); g.lineTo(ox + 2, doorY + 5); g.lineTo(ox + 2, doorY + doorH - 5); g.lineTo(x0 + 1, doorY + doorH + 1); g.stroke();
        A.rect(g, ox + 3.4, doorY + doorH * .45, 1.4, 20, '#cfcdc4');
      }
      grainOn(g, 0, 0, w, h, .12, .35);
      // gloss highlight streak on veneer
      g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = A.lg(g, x0, 0, x0 + bw, 0, ['rgba(255,235,200,0)', 'rgba(255,235,200,.1)', 'rgba(255,235,200,0)']); g.fillRect(x0, top, bw, bh); g.restore();
    };
  }

  function paintNewspapers(g, w, h) {
    soft(g, w / 2, h - 2, w + 3, 6, .45);
    for (let i = 0; i < 7; i++) { g.save(); g.translate(w / 2 + (i % 2 ? .6 : -.5), h - 1.2 - i * 1.9); g.rotate((i % 3 - 1) * .02); A.rect(g, -w / 2 + 1, -2, w - 2, 2.2, ['#d8d5c6', '#c9c5b2', '#e2dfd1'][i % 3]); A.rect(g, -w / 2 + 1, -2, w - 2, .5, 'rgba(255,255,255,.5)'); A.rect(g, -w / 2 + 1, -.2, w - 2, .4, 'rgba(0,0,0,.25)'); g.restore(); }
    g.fillStyle = 'rgba(30,30,30,.55)'; g.font = 'bold 3.6px Arial,sans-serif'; g.fillText('ПРАВДА', 4, h - 14.2); A.rect(g, 4, h - 12.5, 12, .6, 'rgba(30,30,30,.4)'); A.rect(g, 4, h - 11.4, 8, .5, 'rgba(30,30,30,.4)');
    g.strokeStyle = '#7a7a76'; g.lineWidth = .9; g.beginPath(); g.moveTo(w - 6, h - 16); g.lineTo(w - 6, h - 4); g.moveTo(w - 3, h - 16); g.lineTo(w - 3, h - 4); g.stroke();      // string around the stack
    grainOn(g, 0, 0, w, h, .1, .3);
  }
  function paintLooseBag(g, w, h) {      // black bag lying slumped near the stand
    soft(g, w / 2, h - 2, w + 5, 9, .6);
    g.beginPath(); g.moveTo(3, h - 2); g.bezierCurveTo(-1, h - 14, 8, h - 25, 20, h - 25); g.bezierCurveTo(32, h - 24, 40, h - 12, 38, h - 2); g.closePath();
    g.fillStyle = A.lg(g, 0, 0, w, 0, ['#0b0b0d', '#2c2e35', '#0d0d10']); g.fill();
    g.save(); g.clip(); g.fillStyle = 'rgba(190,200,225,.22)'; g.beginPath(); g.ellipse(13, h - 17, 2, 6, .3, 0, P2); g.fill(); g.strokeStyle = 'rgba(170,180,200,.2)'; g.lineWidth = .6; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(6 + i * 8, h - 3); g.quadraticCurveTo(10 + i * 7, h - 14, 16 + i * 6, h - 24); g.stroke(); } g.restore();
    A.poly(g, [18, h - 25, 12, h - 31, 16, h - 32, 22, h - 25], '#17181b'); A.poly(g, [21, h - 25, 28, h - 30, 30, h - 28, 23, h - 24], '#1b1c20');
    A.rrect(g, 25, h - 10, 4.5, 6, 1, '#4f8bd0'); A.ell(g, 36, h - 3, 3, 1.6, '#cfc7a4');
    grainOn(g, 0, 0, w, h, .1, .3);
  }

  /* foreground (blurred) occluders */
  function paintFgCable(g, w, h) {
    g.strokeStyle = '#08080a'; g.lineWidth = 1.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(w * .35, 0); g.bezierCurveTo(w * .1, h * .3, w * .8, h * .5, w * .55, h - 11); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = .5; g.beginPath(); g.moveTo(w * .33, 0); g.bezierCurveTo(w * .08, h * .3, w * .78, h * .5, w * .53, h - 11); g.stroke();
    A.rrect(g, w * .55 - 3.6, h - 11, 7.2, 8, 1.4, '#1a1a1c'); A.rect(g, w * .55 - 2.6, h - 3.2, 1.2, 3.2, '#9a9a96'); A.rect(g, w * .55 + 1.4, h - 3.2, 1.2, 3.2, '#9a9a96');
  }
  function paintFgJacket(g, w, h) {
    const cx = w / 2;
    A.line(g, cx, 0, cx, 6, '#0a0a0c', 1.4); g.strokeStyle = '#0d0d0f'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx - 20, 14); g.lineTo(cx, 6); g.lineTo(cx + 20, 14); g.stroke();
    g.fillStyle = A.lg(g, cx - 30, 0, cx + 30, 0, ['#0b0d12', '#232a36', '#0c0e13']); g.beginPath(); g.moveTo(cx - 20, 14); g.lineTo(cx - 33, 24); g.lineTo(cx - 34, h - 2); g.lineTo(cx - 20, h - 2); g.lineTo(cx - 17, 28); g.lineTo(cx + 17, 28); g.lineTo(cx + 20, h - 2); g.lineTo(cx + 34, h - 2); g.lineTo(cx + 33, 24); g.lineTo(cx + 20, 14); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(cx - 8, 28, 16, h - 30);
  }
  function paintFgBoot(g, w, h) {
    soft(g, w / 2, h - 2, w + 6, 8, .7);
    g.fillStyle = A.lg(g, 0, h - 26, 0, h, ['#1a1713', '#0a0907']); g.beginPath(); g.moveTo(8, h - 2); g.lineTo(8, h - 26); g.lineTo(22, h - 28); g.lineTo(24, h - 12); g.quadraticCurveTo(38, h - 11, w - 4, h - 4); g.lineTo(w - 4, h - 1); g.closePath(); g.fill();
    A.rect(g, 8, h - 3, w - 12, 2, '#2b2825'); soft(g, 20, h - 12, 12, 8, .3, 'rgba(255,255,255,');
    g.save(); g.translate(2, h - 2); g.fillStyle = '#1c1a17'; g.fillRect(0, -8, 18, 8); g.restore();
  }

  /* ----------------------------------------------------------------- the room */
  const D = (id, x, z, w, h, o) => Object.assign({ id, x, z, w, h }, o);
  const objects = [
    D('door', 95, 157, 108, 216, { bake: { closed: paintDoor(false), open: paintDoor(true) }, variant: S => F(S).doorOpen ? 'open' : 'closed', shadow: false }),
    D('intercom', 152, 157, 18, 46, { y: 112, bake: paintIntercom }),
    D('fusebox', 205, 157, 34, 46, { y: 160, bake: paintFuse }),
    D('switch', 185, 157, 26, 36, { y: 98, bake: { off: paintSwitch(false), on: paintSwitch(true) }, variant: S => F(S).lightHall ? 'on' : 'off' }),
    D('phoneBack', 255, 157.5, 60, 100, { y: 70, bake: paintPhoneBack, shadow: false }),
    D('phone', 255, 156.5, 60, 100, { y: 70, dyn: phoneDyn, shadow: false }),
    D('hookboard', 330, 155, 100, 40, { y: 150, bake: paintHookBoard, shadow: false }),
    swing(D('coatWool', 305, 150.5, 48, 114, { y: 50, shadow: false }), paintCoat('wool'), [24, 3], .011, 1.1, 0),
    swing(D('coatPuff', 349, 148.5, 52, 72, { y: 92, shadow: false }), paintCoat('puff'), [26, 3], .014, 1.35, 2),
    swing(D('coatHood', 330, 146, 46, 76, { y: 88, shadow: false }), paintCoat('hood'), [23, 3], .016, .9, 4),
    D('shoeRack', 335, 118, 70, 46, { bake: paintShoeRack, depth: 22, topRGB: [60, 62, 66], sideRGB: [40, 42, 46], shadow: { w: 34, a: .4 } }),
    D('shoePile', 338, 72, 76, 20, { bake: paintShoePile, shadow: { w: 38, a: .35 } }),
    D('umbrellas', 286, 134, 28, 84, { bake: paintUmbrellas }),
    D('boxA', 370, 14, 50, 31, { bake: paintBoxA, depth: 40, topRGB: [178, 146, 100], sideRGB: [122, 94, 60], hidden: S => F(S).boxesCleared, shadow: { w: 28, a: .5 } }),
    D('boxB', 408, 16, 34, 24, { bake: paintBoxB, depth: 38, topRGB: [170, 136, 92], sideRGB: [116, 88, 56], hidden: S => F(S).boxesCleared, shadow: { w: 20, a: .5 } }),
    D('boxC', 364, 17, 33, 15, { y: 31, bake: paintBoxC, depth: 34, topRGB: [190, 158, 112], sideRGB: [128, 100, 66], hidden: S => F(S).boxesCleared, shadow: false }),
    D('boxD', 410, 19, 28, 22, { y: 24, bake: paintBoxD, depth: 32, topRGB: [168, 134, 90], sideRGB: [112, 86, 54], hidden: S => F(S).boxesCleared, shadow: false }),
    D('boxesLeft', 385, 24, 72, 14, { bake: paintBoxesLeft, hidden: S => !F(S).boxesCleared, shadow: false }),
    D('newspapers', 436, 66, 28, 18, { bake: paintNewspapers }),
    D('mirror', 385, 157, 50, 86, { y: 108, bake: paintMirror, shadow: false }),
    D('calendar', 478, 157, 26, 38, { y: 138, bake: paintCalendar, shadow: false }),
    D('bagStand', 465, 52, 46, 72, { bake: { 0: paintBagStand(0), 1: paintBagStand(1), 2: paintBagStand(2), 3: paintBagStand(3), 4: paintBagStand(4), 5: paintBagStand(5) }, variant: S => String(clamp(F(S).bagFill | 0, 0, 5)), shadow: { w: 22, a: .5 },
      dyn: (g, t, S, o) => { const l = clamp(F(S).bagFill | 0, 0, 5); if (l < 3) return; for (let i = 0; i < l - 1; i++) { const a = t * (1.6 + i * .5) + i * 2.3, x = 23 + Math.cos(a) * (8 + i * 2), y = 24 + Math.sin(a * 1.3) * 7 - i * 2; g.fillStyle = 'rgba(8,8,8,.9)'; g.fillRect(x, y, 1.1, .8); } } }),
    D('looseBag', 505, 38, 42, 34, { bake: paintLooseBag, shadow: { w: 22, a: .4 } }),
    D('closet', 545, 105, 94, 232, { bake: { closed: paintCloset('closed'), openVac: paintCloset('openVac'), openEmpty: paintCloset('openEmpty') },
      variant: S => F(S).closetOpen ? ((S.tools && S.tools.vac) ? 'openEmpty' : 'openVac') : 'closed', depth: 55, topRGB: [60, 38, 24], sideRGB: [58, 36, 22], shadow: { w: 46, a: .5 } }),
    D('closetJunk', 545, 112, 92, 30, { y: 230, bake: (g, w, h) => { soft(g, w / 2, h - 1, w, 6, .4);
      cardbox(g, 8, 10, 38, 19, { seed: 4, base: '#a28058', label: true, tape: false });
      g.fillStyle = A.lg(g, 0, 10, 0, 28, ['#6f5a40', '#4b3b28']); g.beginPath(); g.roundRect(52, 8, 32, 21, 2); g.fill(); A.rect(g, 52, 8, 32, 1, 'rgba(255,255,255,.18)'); A.rect(g, 52, 17, 32, 1, 'rgba(0,0,0,.3)'); A.rrect(g, 64, 5.5, 8, 3, 1, '#2d2418'); A.rect(g, 57, 14, 3, 3, '#a89a62'); A.rect(g, 76, 14, 3, 3, '#a89a62');
      A.rect(g, 0, h - 3, w, 3, 'rgba(160,150,130,.5)'); grainOn(g, 0, 0, w, h, .1, .3); }, shadow: false }),
    D('bulb', 300, 30, 20, 50, { y: 210, bake: { off: paintBulb(false), on: paintBulb(true) }, variant: S => F(S).lightHall ? 'on' : 'off', shadow: false }),
    D('bulbGlow', 300, 29.5, 130, 130, { y: 143, post: true, postMode: 'lighter', hidden: S => !F(S).lightHall,
      bake: (g, w, h) => { g.fillStyle = A.rg(g, w / 2, h / 2, 0, w / 2, ['rgba(255,236,190,.55)', 'rgba(255,225,170,.16)', 'rgba(255,225,170,0)']); g.fillRect(0, 0, w, h); }, shadow: false }),
    // foreground, blurred
    D('fgCable', 150, -80, 14, 66, { y: 196, bake: paintFgCable, blur: 2.4, shadow: false }),
    D('fgBoot', 232, -108, 54, 30, { bake: paintFgBoot, blur: 3.2, shadow: false }),
    D('fgJacket', 515, -130, 70, 66, { y: 198, bake: paintFgJacket, blur: 3.4, shadow: false })
  ];

  BB.defineRoom({
    id: 'hall',
    wallColor: ['#7f8777', '#4d6157'], partitionFace: '#6c7767',
    floorColor: ['#4a4036', '#2f2922'], gloss: .12,
    ambient: { color: [122, 130, 150] },
    ambientNow(S) { return F(S).lightHall ? [165, 166, 172] : [120, 128, 150]; },
    wall, floor, ceil, objects,
    lights: [
      { x: 300, y: 205, z: 30, r: 420, color: '255,236,196', i: 1.2, flicker: .05, bloom: .14, on: S => !!F(S).lightHall },
      { x: 575, y: 125, z: 20, r: 300, color: '255,160,92', i: .42, bloom: 0 },
      { x: 255, y: 148, z: 120, r: 130, color: '255,222,150', i: .55, flicker: .9, bloom: .1, on: S => !!F(S).phoneRing && !F(S).phoneUp },
      { x: 95, y: 120, z: 110, r: 240, color: '135,170,230', i: .5, bloom: 0, on: S => !!F(S).doorOpen },
      { x: 95, y: 6, z: 120, r: 110, color: '150,170,215', i: .22, bloom: 0 }
    ],
    hotspots: [
      { id: 'frontDoor', x: 95, r: 60, h: 130 }, { id: 'switchHall', x: 185, r: 30, h: 115 },
      { id: 'phone', x: 255, r: 55, h: 145 }, { id: 'boxes', x: 385, r: 60, h: 60 },
      { id: 'bagStand', x: 465, r: 55, h: 70 }, { id: 'closet', x: 545, r: 55, h: 110 }
    ],
    solids: [{ x0: 345, x1: 425, top: 46, active: S => !F(S).boxesCleared }]
  });
})();
