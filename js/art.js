/* ==========================================================================
   BB.art - shared procedural painting toolkit. All coordinates in CENTIMETRES
   (the same space as BB.bake callbacks).  Owner: lead (rooms may add local helpers).
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const { clamp, lerp, srand } = BB.U;
  const A = BB.art = {};

  /* ---- small primitives ---- */
  A.rect = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  A.rrect = (g, x, y, w, h, r, c) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = c; g.fill(); };
  A.ell = (g, x, y, rx, ry, c) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fillStyle = c; g.fill(); };
  A.poly = (g, pts, c) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fillStyle = c; g.fill(); };
  A.line = (g, x0, y0, x1, y1, c, w) => { g.strokeStyle = c; g.lineWidth = w || 1; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
  A.lg = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach((s, i) => gr.addColorStop(Array.isArray(s) ? s[0] : i / (stops.length - 1), Array.isArray(s) ? s[1] : s)); return gr; };
  A.rg = (g, x, y, r0, r1, stops) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach((s, i) => gr.addColorStop(Array.isArray(s) ? s[0] : i / (stops.length - 1), Array.isArray(s) ? s[1] : s)); return gr; };
  A.glow = (g, x, y, r, c) => { g.fillStyle = A.rg(g, x, y, 0, r, [c, c.replace(/[\d.]+\)$/, '0)')]); g.fillRect(x - r, y - r, r * 2, r * 2); };
  A.vgrad = (g, x, y, w, h, c0, c1) => { g.fillStyle = A.lg(g, 0, y, 0, y + h, [c0, c1]); g.fillRect(x, y, w, h); };
  A.hgrad = (g, x, y, w, h, c0, c1) => { g.fillStyle = A.lg(g, x, 0, x + w, 0, [c0, c1]); g.fillRect(x, y, w, h); };

  /* ---- colour helpers ---- */
  A.hex = c => { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  A.mix = (a, b, t) => { const x = typeof a === 'string' ? A.hex(a) : a, y = typeof b === 'string' ? A.hex(b) : b; return 'rgb(' + x.map((v, i) => Math.round(lerp(v, y[i], t))).join(',') + ')'; };
  A.shade = (c, f) => { const x = typeof c === 'string' && c[0] === '#' ? A.hex(c) : c; return 'rgb(' + x.map(v => clamp(Math.round(v * f), 0, 255)).join(',') + ')'; };

  /* ---- tiny cached noise tile for grain/grime (drawn with alpha over surfaces) ---- */
  let noiseTile = null;
  function tile() {
    if (noiseTile) return noiseTile;
    const c = BB.mk(128, 128), g = c.getContext('2d'), d = g.createImageData(128, 128), r = srand(11);
    for (let i = 0; i < d.data.length; i += 4) { const v = 80 + r() * 150 | 0; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); return noiseTile = c;
  }
  /* multiply-ish grain over a rect */
  A.grain = (g, x, y, w, h, a, scale) => {
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.globalAlpha = a || .08; g.globalCompositeOperation = 'overlay';
    const t = tile(), s = (scale || 1), ts = 128 * s;
    for (let xx = x - (x % ts); xx < x + w; xx += ts) for (let yy = y - (y % ts); yy < y + h; yy += ts) g.drawImage(t, xx, yy, ts, ts);
    g.restore();
  };
  /* blotchy damp / dirt stains */
  A.blotches = (g, x, y, w, h, seed, n, col, rmin, rmax) => {
    const r = srand(seed);
    for (let i = 0; i < n; i++) A.glow(g, x + r() * w, y + r() * h, rmin + r() * (rmax - rmin), col);
  };
  /* vertical drips / streaks from the top of a rect */
  A.streaks = (g, x, y, w, h, seed, n, col) => {
    const r = srand(seed); g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    for (let i = 0; i < n; i++) { const xx = x + r() * w, len = h * (.15 + r() * .6), ww = .6 + r() * 2.4; g.fillStyle = A.lg(g, 0, y, 0, y + len, [col, col.replace(/[\d.]+\)$/, '0)')]); g.fillRect(xx, y, ww, len); }
    g.restore();
  };
  /* scuffs/specks of dirt */
  A.specks = (g, x, y, w, h, seed, n, col, smax) => {
    const r = srand(seed); g.fillStyle = col; for (let i = 0; i < n; i++) { const s = .4 + r() * (smax || 1.6); g.fillRect(x + r() * w, y + r() * h, s * (1 + r()), s); }
  };

  /* ---- surfaces: all draw into a rect (x,y,w,h) in cm ---- */
  A.wallpaper = (g, x, y, w, h, o) => {
    o = o || {}; const base = o.base || '#7a6a58', stripe = o.stripe || 'rgba(255,230,180,.07)', step = o.step || 16, sw = o.sw || 6;
    g.fillStyle = A.lg(g, 0, y, 0, y + h, [o.top || base, o.bottom || A.shade(base, .8)]); g.fillRect(x, y, w, h);
    if (o.pattern === 'damask') { const r = srand(o.seed || 5); g.fillStyle = stripe; for (let xx = x + 8; xx < x + w; xx += step) for (let yy = y + 10; yy < y + h; yy += step * 1.4) { g.beginPath(); g.ellipse(xx + ((yy / (step * 1.4) | 0) % 2) * step / 2, yy, 2.6, 5, 0, 0, 7); g.fill(); } }
    else { g.fillStyle = stripe; for (let xx = x + 3; xx < x + w; xx += step) g.fillRect(xx, y, sw, h); }
    for (let xx = x + (o.seam || 53); xx < x + w; xx += (o.seam || 53)) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(xx, y, .8, h); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(xx + .8, y, .6, h); }
    A.grain(g, x, y, w, h, .10);
  };
  A.plaster = (g, x, y, w, h, o) => {
    o = o || {}; g.fillStyle = A.lg(g, 0, y, 0, y + h, [o.top || '#8d887c', o.bottom || '#6e6a60']); g.fillRect(x, y, w, h);
    A.blotches(g, x, y, w, h, o.seed || 3, Math.round(w * h / 9000), 'rgba(40,35,25,.10)', 12, 55);
    A.grain(g, x, y, w, h, .14, .7);
  };
  A.tiles = (g, x, y, w, h, o) => {
    o = o || {}; const tw = o.w || 15, th = o.h || 15, c1 = o.c1 || '#9fb3b0', c2 = o.c2 || '#8aa19e', grout = o.grout || 'rgba(15,35,35,.55)', r = srand(o.seed || 9);
    for (let yy = y, j = 0; yy < y + h; yy += th, j++) for (let xx = x - (o.brick ? (j % 2) * tw / 2 : 0), i = 0; xx < x + w; xx += tw, i++) {
      g.fillStyle = (i + j) % 2 && o.checker ? c2 : A.mix(c1, c2, r() * .6); g.fillRect(xx, yy, tw, th);
      g.fillStyle = 'rgba(255,255,255,' + (.04 + r() * .06) + ')'; g.fillRect(xx + 1, yy + 1, tw - 2, th * .35);
      if (r() < (o.dirt || .08)) { g.fillStyle = 'rgba(50,50,15,.18)'; g.fillRect(xx, yy, tw, th); }
    }
    g.strokeStyle = grout; g.lineWidth = .9;
    g.beginPath(); for (let yy = y; yy <= y + h; yy += th) { g.moveTo(x, yy); g.lineTo(x + w, yy); } for (let xx = x, j = 0; xx <= x + w; xx += tw) { g.moveTo(xx, y); g.lineTo(xx, y + h); } g.stroke();
    A.grain(g, x, y, w, h, .08);
  };
  /* plan-view wooden floor: planks run along x */
  A.planks = (g, x, y, w, h, o) => {
    o = o || {}; const c1 = o.c1 || '#7a5436', c2 = o.c2 || '#5a3b26', ph = o.ph || 14, pl = o.pl || 120, r = srand(o.seed || 21);
    for (let yy = y, j = 0; yy < y + h; yy += ph, j++) {
      let xx = x - r() * pl;
      while (xx < x + w) {
        const l = pl * (.6 + r() * .8); g.fillStyle = A.mix(c1, c2, r()); g.fillRect(xx, yy, l, ph);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(xx + l - .8, yy, .8, ph); g.fillStyle = 'rgba(255,255,255,' + (.03 + r() * .05) + ')'; g.fillRect(xx, yy, l, 1.2);
        for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(0,0,0,' + (.04 + r() * .06) + ')'; g.fillRect(xx + r() * l, yy + r() * ph, 10 + r() * 40, .7); }
        xx += l;
      }
      g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x, yy, w, .9);
    }
    A.grain(g, x, y, w, h, .1);
  };
  A.concrete = (g, x, y, w, h, o) => {
    o = o || {}; g.fillStyle = A.lg(g, 0, y, 0, y + h, [o.c1 || '#5c5c62', o.c2 || '#3a3a42']); g.fillRect(x, y, w, h);
    A.blotches(g, x, y, w, h, o.seed || 6, Math.round(w * h / 6000), 'rgba(0,0,0,.14)', 10, 50); A.grain(g, x, y, w, h, .16, .8);
    const r = srand(o.seed || 6); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = .8; for (let i = 0; i < 6; i++) { g.beginPath(); let xx = x + r() * w, yy = y + r() * h; g.moveTo(xx, yy); for (let k = 0; k < 6; k++) { xx += (r() - .3) * 25; yy += (r() - .5) * 12; g.lineTo(xx, yy); } g.stroke(); }
  };

  /* ---- lighting-ish painting helpers ---- */
  A.contact = (g, x, y, w, a) => { g.fillStyle = A.rg(g, x, y, 0, w / 2, ['rgba(0,0,0,' + (a || .45) + ')', 'rgba(0,0,0,0)']); g.save(); g.translate(x, y); g.scale(1, .22); g.translate(-x, -y); g.fillRect(x - w / 2, y - w / 2, w, w); g.restore(); };
  /* edge highlight and underside shade for a box-like face */
  A.bevel = (g, x, y, w, h, hi, lo) => { g.fillStyle = hi || 'rgba(255,255,255,.18)'; g.fillRect(x, y, w, 1.2); g.fillRect(x, y, 1.2, h); g.fillStyle = lo || 'rgba(0,0,0,.3)'; g.fillRect(x, y + h - 1.4, w, 1.4); g.fillRect(x + w - 1.2, y, 1.2, h); };
  A.metal = (g, x, y, w, h, base) => { base = base || '#9aa0a8'; g.fillStyle = A.lg(g, x, 0, x + w, 0, [A.shade(base, .7), A.shade(base, 1.25), A.shade(base, .9), A.shade(base, .6)]); g.fillRect(x, y, w, h); };
  A.screws = (g, pts, r, c) => { for (const [x, y] of pts) { A.ell(g, x, y, r, r, c || '#2a2a2a'); A.ell(g, x - r * .25, y - r * .25, r * .4, r * .4, 'rgba(255,255,255,.35)'); } };
  A.cable = (g, pts, w, c) => { g.strokeStyle = c || '#16161a'; g.lineWidth = w || 1.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); };
  /* window light shaft painted into a plan (additive) */
  A.rays = (g, x, y, w, h, a) => { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = A.lg(g, 0, y, 0, y + h, ['rgba(255,235,190,' + a + ')', 'rgba(255,235,190,0)']); g.fillRect(x, y, w, h); g.restore(); };
  /* generic crown moulding + baseboard for back-wall canvases */
  A.skirting = (g, w, h, o) => {
    o = o || {}; const bh = o.bh || 11, ch = o.ch || 7;
    g.fillStyle = o.base || '#3b2a20'; g.fillRect(0, h - bh, w, bh); g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(0, h - bh, w, 1.3); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, h - 1.5, w, 1.5);
    g.fillStyle = o.crown || '#b8aa94'; g.fillRect(0, 0, w, ch); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(0, ch, w, 1.6); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, 0, w, 1);
  };
  /* ambient-occlusion at the wall/floor junction & corners for a back wall */
  A.wallAO = (g, w, h) => {
    g.fillStyle = A.lg(g, 0, h - 50, 0, h, ['rgba(0,0,0,0)', 'rgba(0,0,0,.38)']); g.fillRect(0, h - 50, w, 50);
    g.fillStyle = A.lg(g, 0, 0, 0, 40, ['rgba(0,0,0,.4)', 'rgba(0,0,0,0)']); g.fillRect(0, 0, w, 40);
  };
  /* door-hole punching helper for back walls: erases a rectangle (window) leaving transparency */
  A.hole = (g, x, y, w, h) => { g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.fillRect(x, y, w, h); g.restore(); };
})();
