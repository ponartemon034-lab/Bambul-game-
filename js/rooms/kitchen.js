/* ==========================================================================
   KITCHEN  (room id 'kitchen', width 600)  - owner: kitchen environment artist
   Practical, harsh overhead light, stained surfaces, food packaging.
   Everything is painted in CENTIMETRES (see docs/ARCHITECTURE.md section 2).
   Notes: docs/ROOM_KITCHEN.md
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const A = BB.art, U = BB.U;
  if (!A || !U || !BB.defineRoom) { console.error('[kitchen] engine / art toolkit missing'); return; }
  const R = U.srand, clamp = U.clamp, TAU = Math.PI * 2;
  const P = c => typeof c === 'string' ? A.hex(c) : c;
  const sh = (c, f) => A.shade(P(c), f);
  const mx = (a, b, t) => A.mix(P(a), P(b), t);
  const ra = (c, a) => { const x = P(c); return 'rgba(' + x[0] + ',' + x[1] + ',' + x[2] + ',' + a + ')'; };
  const F = (S, k) => (S && S.f && S.f[k]) || 0;
  const FONT = "'Caveat','Segoe Script','Comic Sans MS',cursive", SANS = "'Golos Text','Arial',sans-serif";
  const lg = A.lg, rg = A.rg, ell = A.ell, rect = A.rect;

  /* ------------------------------------------------------------ painters */
  const rr = (g, x, y, w, h, r, c) => A.rrect(g, x, y, w, h, r, c);
  function txt(g, s, x, y, px, c, rot, font, al) {
    g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.font = px + 'px ' + (font || FONT); g.fillStyle = c; g.textAlign = al || 'left'; g.textBaseline = 'middle'; g.fillText(s, 0, 0); g.restore();
  }
  /* flat painted panel with vertical gradient + bevel */
  function face(g, x, y, w, h, c, o) {
    o = o || {}; const r = o.r == null ? .8 : o.r;
    rr(g, x, y, w, h, r, lg(g, 0, y, 0, y + h, [sh(c, o.top || 1.08), sh(c, o.bot || .86)]));
    g.fillStyle = 'rgba(255,255,255,' + (o.hi == null ? .16 : o.hi) + ')'; g.fillRect(x + r, y, w - 2 * r, .9);
    g.fillStyle = 'rgba(0,0,0,' + (o.lo == null ? .28 : o.lo) + ')'; g.fillRect(x + r, y + h - 1, w - 2 * r, 1);
  }
  /* dirt layer that only lands on already painted pixels */
  function dirt(g, x, y, w, h, seed, k, tone) {
    k = k == null ? 1 : k; const col = tone || 'rgba(72,52,22,';
    g.save(); g.globalCompositeOperation = 'source-atop'; g.beginPath(); g.rect(x, y, w, h); g.clip();
    A.blotches(g, x, y, w, h, seed, Math.max(1, Math.round(w * h / 420 * k)), col + (.10 * k) + ')', 2, Math.max(4, Math.min(w, h) * .5));
    A.streaks(g, x, y, w, h, seed + 3, Math.max(2, Math.round(w / 5 * k)), col + (.2 * k) + ')');
    A.specks(g, x, y, w, h, seed + 5, Math.round(w * h / 70 * k), 'rgba(40,28,12,.4)', 1.0);
    g.restore();
  }
  /* inner edge shading (ambient occlusion) on painted pixels */
  function aoEdges(g, x, y, w, h, s, a) {
    g.save(); g.globalCompositeOperation = 'source-atop'; a = a || .35;
    g.fillStyle = lg(g, x, 0, x + s, 0, ['rgba(0,0,0,' + a + ')', 'rgba(0,0,0,0)']); g.fillRect(x, y, s, h);
    g.fillStyle = lg(g, x + w - s, 0, x + w, 0, ['rgba(0,0,0,0)', 'rgba(0,0,0,' + a + ')']); g.fillRect(x + w - s, y, s, h);
    g.fillStyle = lg(g, 0, y + h - s, 0, y + h, ['rgba(0,0,0,0)', 'rgba(0,0,0,' + a * .9 + ')']); g.fillRect(x, y + h - s, w, s);
    g.restore();
  }
  function shineV(g, x, y, w, h, a) { g.save(); g.globalCompositeOperation = 'source-atop'; g.fillStyle = lg(g, x, 0, x + w, 0, ['rgba(255,255,255,0)', 'rgba(255,255,255,' + a + ')', 'rgba(255,255,255,0)']); g.fillRect(x, y, w, h); g.restore(); }
  function drop(g, x, y, r, c) { g.beginPath(); g.moveTo(x, y - r * 2); g.quadraticCurveTo(x + r * 1.3, y - r * .2, x, y + r); g.quadraticCurveTo(x - r * 1.3, y - r * .2, x, y - r * 2); g.fillStyle = c; g.fill(); }
  function bubbles(g, x, y, w, h, seed, n, c) { const r = R(seed); g.strokeStyle = c || 'rgba(255,255,255,.55)'; g.lineWidth = .35; for (let i = 0; i < n; i++) { g.beginPath(); g.arc(x + r() * w, y + r() * h, .5 + r() * 1.6, 0, TAU); g.stroke(); } }

  /* ---------------------------------------------------------------- wall */
  const DADO = 110;                                  // canvas y of the green oil-paint panel top (150 cm above floor)
  const WIN = { x: 195, y: 55, w: 110, h: 93 };      // window hole (canvas coords): heights 112..205 cm
  function wall(g, w, h) {
    const r = R(31);
    // upper whitewashed plaster, nicotine stained near the ceiling
    rect(g, 0, 0, w, DADO + 2, lg(g, 0, 0, 0, DADO, ['#b9ae8e', '#cdc5a8', '#d6cfb6']));
    A.blotches(g, 0, 0, w, DADO, 4, 46, 'rgba(120,90,30,.13)', 10, 46);
    A.blotches(g, 0, 0, w, 40, 9, 22, 'rgba(60,45,18,.12)', 14, 40);
    A.blotches(g, 372, 0, 80, DADO, 12, 12, 'rgba(70,45,10,.20)', 8, 34);             // grease cloud above the stove
    A.grain(g, 0, 0, w, DADO, .13, .7);
    // peeling plaster patches
    [[520, 22, 26, 17], [38, 60, 14, 22], [570, 70, 18, 14], [466, 12, 14, 10]].forEach((p, i) => {
      const rr2 = R(70 + i); g.beginPath(); g.moveTo(p[0], p[1]);
      for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; g.lineTo(p[0] + Math.cos(a) * p[2] * (.6 + rr2() * .5), p[1] + Math.sin(a) * p[3] * (.6 + rr2() * .5)); }
      g.closePath(); g.fillStyle = '#8f8a78'; g.fill(); g.strokeStyle = 'rgba(255,250,230,.55)'; g.lineWidth = .7; g.stroke();
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fill();
    });
    // green oil-paint dado
    rect(g, 0, DADO, w, h - DADO, lg(g, 0, DADO, 0, h, ['#738a69', '#62775a', '#4e6148']));
    for (let x = 0; x < w; x += 37 + r() * 20) { g.fillStyle = 'rgba(255,255,255,' + (.015 + r() * .03) + ')'; g.fillRect(x, DADO, 6 + r() * 12, h - DADO); }
    A.blotches(g, 0, DADO, w, h - DADO, 17, 40, 'rgba(15,22,10,.18)', 8, 30);
    A.grain(g, 0, DADO, w, h - DADO, .14, .6);
    // scuffs & splashes on the paint
    A.specks(g, 0, DADO + 30, w, 100, 22, 90, 'rgba(210,205,170,.22)', 1.4);
    A.specks(g, 0, DADO + 60, w, 70, 23, 40, 'rgba(60,35,20,.38)', 1.8);
    // dado edge: ridge line
    rect(g, 0, DADO - .5, w, 1.8, '#26301f'); rect(g, 0, DADO + 1.4, w, .8, 'rgba(255,255,255,.18)');
    rect(g, 0, DADO + 2.2, w, 4, lg(g, 0, DADO + 2, 0, DADO + 7, ['rgba(0,0,0,.28)', 'rgba(0,0,0,0)']));
    // ---- backsplash tiles (counter 90 cm up to 150 cm), window sill row
    const TX = 98, TW = 386, TY = DADO - 2, TH = 66;
    A.tiles(g, TX, TY, TW, TH, { w: 15, h: 15, c1: '#e0dac4', c2: '#cfc8ac', grout: 'rgba(70,58,30,.55)', dirt: .16, seed: 12 });
    // decorative green border row + flower tiles
    for (let x = TX; x < TX + TW; x += 15) {
      rect(g, x + .5, TY + 15.5, 14, 14, '#6e8e6c'); rect(g, x + .5, TY + 15.5, 14, 4, 'rgba(255,255,255,.14)');
      const rx = R(x); if (rx() < .55) { g.fillStyle = '#e8e3cf'; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; ell(g, x + 7.5 + Math.cos(a) * 2.6, TY + 22.5 + Math.sin(a) * 2.6, 1.6, 1.6, '#e8e3cf'); } ell(g, x + 7.5, TY + 22.5, 1.3, 1.3, '#c9a43c'); }
    }
    g.strokeStyle = 'rgba(70,58,30,.6)'; g.lineWidth = .8; g.beginPath(); g.moveTo(TX, TY + 15); g.lineTo(TX + TW, TY + 15); g.moveTo(TX, TY + 30); g.lineTo(TX + TW, TY + 30); g.stroke();
    // grease on tiles: golden-brown cloud behind the stove, drips, splatter
    A.blotches(g, 372, TY - 6, 76, TH + 10, 33, 18, 'rgba(110,70,14,.38)', 6, 26);
    A.streaks(g, 376, TY, 66, TH, 5, 14, 'rgba(100,60,10,.35)');
    A.specks(g, 366, TY, 88, TH, 6, 110, 'rgba(80,45,8,.55)', 1.6);
    A.blotches(g, TX, TY, TW, TH, 41, 30, 'rgba(90,70,20,.14)', 5, 20);
    // missing tile -> bare cement, one cracked tile
    rect(g, 356, TY + 30, 15, 15, '#7d776a'); A.grain(g, 356, TY + 30, 15, 15, .3, .5); rect(g, 356, TY + 30, 15, 2.5, 'rgba(0,0,0,.35)');
    g.strokeStyle = 'rgba(20,14,6,.7)'; g.lineWidth = .6; g.beginPath(); g.moveTo(141, TY + 1); g.lineTo(144, TY + 8); g.lineTo(141, TY + 13); g.lineTo(145, TY + 19); g.stroke();
    // tile top edge shadow + lip
    rect(g, TX, TY - 1.5, TW, 1.5, 'rgba(0,0,0,.5)'); rect(g, TX, TY, TW, 1, 'rgba(255,255,255,.3)');
    // ---- window hole, frame, bars, reveal
    A.hole(g, WIN.x, WIN.y, WIN.w, WIN.h);
    const wx = WIN.x, wy = WIN.y, ww = WIN.w, wh = WIN.h;
    // frame (white paint peeled to wood)
    const frame = (x, y, w2, h2) => { rect(g, x, y, w2, h2, lg(g, x, 0, x + w2, 0, ['#e6e0d0', '#cfc8b4'])); };
    frame(wx - 7, wy - 7, ww + 14, 7); frame(wx - 7, wy + wh, ww + 14, 4); frame(wx - 7, wy, 7, wh); frame(wx + ww, wy, 7, wh);
    frame(wx + ww / 2 - 2, wy, 4, wh); frame(wx, wy + 24, ww, 3.6);
    // reveal depth (dark inner border)
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(wx, wy, ww, 1.8); g.fillRect(wx, wy, 1.8, wh); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(wx + ww - 1, wy, 1, wh);
    // peeling frame spots + handles
    A.specks(g, wx - 7, wy - 7, ww + 14, wh + 11, 77, 60, 'rgba(120,95,50,.7)', 1.8);
    A.blotches(g, wx - 7, wy - 7, ww + 14, wh + 11, 78, 10, 'rgba(70,50,20,.2)', 3, 10);
    rr(g, wx + ww / 2 - 7, wy + 52, 3.2, 12, 1, '#d6d0c0'); rr(g, wx + ww / 2 + 3.6, wy + 52, 3.2, 12, 1, '#d6d0c0');
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(wx - 7, wy + wh + 3, ww + 14, 1.2);
    // outer window trim shadow on the tile
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(wx - 9, wy - 9, ww + 18, 2); g.fillRect(wx - 9, wy - 9, 2, wh + 16); g.fillRect(wx + ww + 7, wy - 9, 2, wh + 16);
    // ---- cabinet shadows on wall behind upper cabinets (soft AO on the wall)
    g.fillStyle = lg(g, 0, 40, 0, 62, ['rgba(0,0,0,.0)', 'rgba(0,0,0,.28)']); g.fillRect(100, 40, 92, 22); g.fillRect(312, 40, 62, 22); g.fillRect(452, 40, 92, 22);
    // ---- sockets, switch, cables
    const plate = (x, y, n) => { rr(g, x, y, 8, 8, 1, '#e6e0cc'); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x, y + 7.2, 8, .8); ell(g, x + 2.4, y + 4, .9, .9, '#2a2418'); ell(g, x + 5.6, y + 4, .9, .9, '#2a2418'); A.blotches(g, x, y, 8, 8, n, 3, 'rgba(90,60,10,.35)', 1, 4); };
    plate(122, TY + 36, 3); plate(334, TY + 36, 5); plate(420, 20, 7);
    rr(g, 566, 134, 7, 11, 1, '#e6e0cc'); rr(g, 568, 137, 3, 5, .6, '#c9c2ac'); g.fillStyle = 'rgba(70,45,10,.25)'; g.fillRect(566, 140, 7, 5);   // light switch  (h ~ 105-125 cm)
    A.cable(g, [[126, TY + 44], [124, TY + 60], [118, TY + 66]], 1.1, '#e9e5d4'); A.cable(g, [[338, TY + 44], [340, TY + 56], [346, TY + 63]], 1.1, '#18181c');
    A.cable(g, [[573, 140], [585, 141], [592, 120], [600, 108]], .7, '#6a5a3a');
    // heating riser pipes in the right corner (silver paint, rust drips)
    [584, 590].forEach((x, i) => { rect(g, x, 0, 3.6, h, lg(g, x, 0, x + 3.6, 0, ['#59575a', '#c1c0bc', '#6b6a6a'])); rect(g, x - .6, 78 + i * 6, 4.8, 3, '#7f7d7c'); rect(g, x - .6, 190 - i * 8, 4.8, 3, '#7f7d7c'); });
    A.streaks(g, 582, 80, 14, 170, 8, 5, 'rgba(120,60,20,.5)');
    // black mould in the damp upper-left corner
    A.blotches(g, 0, 0, 50, 36, 91, 14, 'rgba(18,20,8,.5)', 2, 9); A.blotches(g, 0, 0, 36, 70, 92, 9, 'rgba(22,26,10,.28)', 3, 12);
    // baseboard (hidden mostly) + soot AO
    rect(g, 0, h - 9, w, 9, '#2c241d'); rect(g, 0, h - 9, w, 1, 'rgba(255,255,255,.14)');
    A.wallAO(g, w, h);
    // corner shadows (left/right)
    g.fillStyle = lg(g, 0, 0, 22, 0, ['rgba(0,0,0,.35)', 'rgba(0,0,0,0)']); g.fillRect(0, 0, 22, h); g.fillStyle = lg(g, w - 22, 0, w, 0, ['rgba(0,0,0,0)', 'rgba(0,0,0,.35)']); g.fillRect(w - 22, 0, 22, h);
  }

  /* --------------------------------------------------------------- floor */
  function floor(g, w, d) {
    const T = 30, r = R(5);
    // linoleum-like tile, brown/cream chequer, worn
    for (let y = 0, j = 0; y < d; y += T, j++) for (let x = 0, i = 0; x < w; x += T, i++) {
      const dark = (i + j) % 2; g.fillStyle = dark ? mx('#6b5b45', '#5a4c3a', r()) : mx('#9a8a68', '#85775a', r()); g.fillRect(x, y, T, T);
      g.fillStyle = lg(g, x, y, x + T, y + T, ['rgba(255,255,255,.07)', 'rgba(0,0,0,.08)']); g.fillRect(x, y, T, T);
    }
    g.strokeStyle = 'rgba(25,18,10,.55)'; g.lineWidth = .9; g.beginPath();
    for (let y = 0; y <= d; y += T) { g.moveTo(0, y); g.lineTo(w, y); } for (let x = 0; x <= w; x += T) { g.moveTo(x, 0); g.lineTo(x, d); } g.stroke();
    A.grain(g, 0, 0, w, d, .16, .8);
    // walking path wear (lighter, scuffed) in front of counters and between rooms
    g.save(); g.globalAlpha = .55; A.blotches(g, 20, 140, w - 40, 56, 3, 60, 'rgba(210,190,140,.20)', 14, 38); g.restore();
    A.blotches(g, 0, 60, w, 120, 8, 70, 'rgba(25,16,6,.16)', 10, 42);
    // grime along the back wall and under the units
    g.fillStyle = lg(g, 0, 0, 0, 40, ['rgba(10,6,2,.7)', 'rgba(10,6,2,0)']); g.fillRect(0, 0, w, 40);
    // rubber mat in front of the sink
    g.save(); g.translate(250, 112); rr(g, -62, 0, 124, 40, 3, '#3f4a40'); g.fillStyle = 'rgba(0,0,0,.35)'; for (let x = -58; x < 58; x += 6) g.fillRect(x, 3, 2.4, 34);
    A.blotches(g, -62, 0, 124, 40, 6, 10, 'rgba(10,8,2,.35)', 3, 14); g.restore();
    // grease aura around the stove
    A.blotches(g, 370, 70, 90, 80, 14, 16, 'rgba(60,35,5,.35)', 8, 24);
    // spills: ketchup splat, coffee ring, dried milk, noodles, crumbs
    const splat = (x, y, c, n, s0) => { const rr2 = R(x * 3 + y); for (let i = 0; i < n; i++) { const a = rr2() * TAU, dd = rr2() * s0; ell(g, x + Math.cos(a) * dd * 1.6, y + Math.sin(a) * dd * .7, .6 + rr2() * 1.6, .5 + rr2() * 1.2, c); } ell(g, x, y, s0 * .45, s0 * .28, c); };
    splat(468, 168, 'rgba(150,28,20,.8)', 26, 9); splat(150, 188, 'rgba(235,225,200,.55)', 12, 11); splat(318, 212, 'rgba(120,70,20,.5)', 16, 10);
    ell(g, 213, 205, 6, 3.2, 'rgba(60,35,15,.55)'); ell(g, 213, 205, 4.2, 2, 'rgba(120,80,40,.4)');
    ell(g, 505, 132, 8, 4, 'rgba(210,205,180,.35)');
    g.strokeStyle = 'rgba(224,200,130,.8)'; g.lineWidth = .9; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(398 + i * 2, 192 + i * 2); g.bezierCurveTo(402 + i * 4, 186, 410 + i * 3, 198, 414 + i * 3, 192 + i); g.stroke(); }  // spilled noodles
    A.specks(g, 100, 100, 480, 160, 9, 260, 'rgba(210,190,130,.55)', 1.3); A.specks(g, 100, 100, 480, 160, 10, 140, 'rgba(15,10,4,.55)', 1.7);
    // cracked tile + chipped corner
    g.strokeStyle = 'rgba(15,10,4,.9)'; g.lineWidth = .8; g.beginPath(); g.moveTo(272, 120); g.lineTo(279, 131); g.lineTo(274, 141); g.lineTo(283, 152); g.lineTo(281, 162); g.stroke();
    // cigarette ash trail & old gum
    ell(g, 355, 170, 3, 1.6, 'rgba(70,70,74,.7)'); ell(g, 62, 160, 1.8, 1, 'rgba(180,150,160,.8)');
    // fridge: dark water ring + shadow zone
    ell(g, 65, 112, 36, 15, 'rgba(18,28,12,.35)');
    // shade zones under the table and chair
    ell(g, 480, 80, 36, 14, 'rgba(0,0,0,.28)');
    // dirty corners + shadows of the partitions (door sills)
    g.fillStyle = lg(g, 0, 0, 14, 0, ['rgba(0,0,0,.4)', 'rgba(0,0,0,0)']); g.fillRect(0, 0, 14, d); g.fillStyle = lg(g, w - 14, 0, w, 0, ['rgba(0,0,0,0)', 'rgba(0,0,0,.4)']); g.fillRect(w - 14, 0, 14, d);
  }

  /* ------------------------------------------------------------- ceiling */
  function ceil(g, w, d) {
    g.fillStyle = lg(g, 0, 0, 0, d, ['#a79f86', '#c5bea5']); g.fillRect(0, 0, w, d);
    A.blotches(g, 0, 0, w, d, 61, 50, 'rgba(110,85,40,.18)', 12, 50);
    A.blotches(g, 370, 0, 90, 110, 62, 14, 'rgba(25,16,6,.4)', 8, 36);           // soot above the stove
    // water stain rings
    [[500, 70, 28], [64, 40, 20]].forEach(([x, y, rad]) => { for (let i = 0; i < 3; i++) { g.strokeStyle = 'rgba(100,70,20,' + (.16 + i * .1) + ')'; g.lineWidth = 1 + i * .5; g.beginPath(); g.ellipse(x, y, rad - i * 4, (rad - i * 4) * .6, .3, 0, TAU); g.stroke(); } ell(g, x, y, rad * .7, rad * .4, 'rgba(110,80,30,.12)'); });
    // ceiling rose for the pendant lamp (z=30 -> plan y = 160 - 30 = 130)
    ell(g, 300, 130, 11, 6, 'rgba(0,0,0,.35)'); ell(g, 300, 130, 8, 4.5, '#d9d3bd'); ell(g, 300, 130, 3, 1.8, '#26221c');
    A.blotches(g, 270, 105, 60, 50, 63, 6, 'rgba(25,18,8,.35)', 6, 18);
    // plaster seam + cracks
    g.strokeStyle = 'rgba(20,14,6,.5)'; g.lineWidth = .7; g.beginPath(); g.moveTo(0, 211); g.lineTo(w, 208); g.stroke();
    g.beginPath(); g.moveTo(180, 0); g.lineTo(186, 24); g.lineTo(181, 40); g.lineTo(190, 66); g.stroke();
    // vent grille above the hood and cobweb in the corner
    rr(g, 400, 8, 22, 12, 1, '#9a9488'); g.fillStyle = 'rgba(0,0,0,.5)'; for (let i = 0; i < 5; i++) g.fillRect(402 + i * 4, 10, 2, 8);
    g.strokeStyle = 'rgba(240,240,230,.4)'; g.lineWidth = .4; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(24 * Math.cos(i * .3), 24 * Math.sin(i * .3)); g.stroke(); } for (let k = 1; k < 4; k++) { g.beginPath(); g.arc(0, 0, k * 6, 0, 1.5); g.stroke(); }
    A.grain(g, 0, 0, w, d, .12, .8);
    g.fillStyle = lg(g, 0, 0, 0, 36, ['rgba(0,0,0,.4)', 'rgba(0,0,0,0)']); g.fillRect(0, 0, w, 36);
  }

  const objects = [], lights = [];
  /*@@OBJECTS@@*/

  BB.defineRoom({
    id: 'kitchen',
    wallColor: ['#cdc5a8', '#62775a'], partitionFace: '#7e8c6c',
    floorColor: ['#8a7a5a', '#4a3e2c'], gloss: .14,
    ambient: { color: [86, 90, 102] },
    wall, floor, ceil, objects, lights,
    hotspots: [
      { id: 'fridge', x: 65, r: 65, h: 130 },
      { id: 'dishes', x: 250, r: 75, h: 100 },
      { id: 'stove', x: 410, r: 50, h: 100 },
      { id: 'bin', x: 520, r: 55, h: 70 }
    ],
    solids: []
  });
})();
