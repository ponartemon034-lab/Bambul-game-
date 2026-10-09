/* ==========================================================================
   BAMBOUL 2.5D ENGINE  (Canvas 2D, true pinhole perspective)
   --------------------------------------------------------------------------
   World units are CENTIMETRES.  x: along the apartment, y: height above floor,
   z: depth away from camera (gameplay lane is z = 0, back wall is z = wallZ).
   Everything on screen is projected through one pinhole camera, so every layer
   has its own genuine parallax:  scale(z) = D / (D + z).
   Owner: lead.  Do not edit from room / gameplay modules - use the hooks.
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  function srand(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  BB.U = { clamp, lerp, srand, smooth: t => t * t * (3 - 2 * t) };

  /* ---------------------------------------------------------------- layout */
  const L = BB.LAYOUT = {
    ceilH: 260, wallZ: 160, frontZ: -360, doorW: 96, doorH: 212, partT: 14, playerH: 178,
    rooms: [
      { id: 'hall',    name: 'Прихожая',   x0: 0,    x1: 600 },
      { id: 'living',  name: 'Гостиная',   x0: 600,  x1: 1450 },
      { id: 'kitchen', name: 'Кухня',      x0: 1450, x1: 2050 },
      { id: 'bath',    name: 'Ванная',     x0: 2050, x1: 2600 },
      { id: 'work',    name: 'Мастерская', x0: 2600, x1: 3300 }
    ]
  };
  L.worldW = L.rooms[L.rooms.length - 1].x1;
  L.partitions = L.rooms.slice(1).map(r => r.x0);            // x of every inner wall (each has a doorway)
  L.roomOf = x => { for (const r of L.rooms) if (x < r.x1) return r; return L.rooms[L.rooms.length - 1]; };
  BB.roomById = id => L.rooms.find(r => r.id === id);
  BB.abs = (id, rel) => BB.roomById(id).x0 + rel;            // room-relative x -> world x

  /* ----------------------------------------------------------------- view */
  const V = BB.view = { W: 1280, H: 720, ppc: 1.6, D: 650, camH: 170, floorY: 560, hor: 0, zoom: 1, scale: 1, cw: 1280, ch: 720 };
  const cam = BB.cam = { x: 400, shake: 0, shx: 0, shy: 0 };
  function recalc() { V.hor = V.floorY - V.camH * V.ppc * V.zoom; }
  V.ppcz = () => V.ppc * V.zoom;
  const sc = BB.sc = z => V.D / (V.D + z);
  /* world -> screen (logical px) */
  const sx = BB.sx = (x, z) => V.W / 2 + (x - cam.x) * V.ppc * V.zoom * sc(z || 0) + cam.shx;
  const sy = BB.sy = (y, z) => V.hor - (y - V.camH) * V.ppc * V.zoom * sc(z || 0) + cam.shy;
  BB.pxPerCm = z => V.ppc * V.zoom * sc(z || 0);
  BB.parallax = z => sc(z || 0);                                // relative to gameplay lane

  /* ------------------------------------------------------------- quality */
  const QS = {
    high: { bake: 2.2, band: 3, lightDiv: 4, particles: 1, reflect: true, blur: true, maxPx: 2.6e6, grain: true, bloom: true, shadows: true, enhance: true, fx: true },
    med:  { bake: 1.7, band: 4, lightDiv: 5, particles: .6, reflect: true, blur: true, maxPx: 1.6e6, grain: false, bloom: true, shadows: true, enhance: true, fx: true },
    low:  { bake: 1.25, band: 6, lightDiv: 6, particles: .3, reflect: false, blur: false, maxPx: 0.9e6, grain: false, bloom: false, shadows: false, enhance: true, fx: false }
  };
  const Q = BB.quality = Object.assign({ name: 'high' }, QS.high);
  BB.setQuality = name => { if (!QS[name]) name = 'med'; Object.assign(Q, QS[name], { name }); };

  /* ------------------------------------------------------------- canvases */
  const mk = BB.mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  /* Bake a drawing into a canvas. Drawing space = CENTIMETRES, origin top-left, y down. */
  BB.bake = function (wcm, hcm, fn, o) {
    o = o || {}; const B = o.B || Q.bake;
    const c = mk(wcm * B, hcm * B), g = c.getContext('2d'); g.scale(B, B);
    try { fn(g, wcm, hcm); } catch (e) { console.error('[bake]', e); g.fillStyle = '#f0f'; g.fillRect(0, 0, wcm, hcm); }
    c.cmW = wcm; c.cmH = hcm; c.B = B;
    if (o.blur && Q.blur) {
      const out = mk(c.width, c.height), og = out.getContext('2d');
      if ('filter' in og) { og.filter = 'blur(' + Math.max(1, o.blur * B) + 'px)'; og.drawImage(c, 0, 0); og.filter = 'none'; out.cmW = wcm; out.cmH = hcm; out.B = B; return out; }
    }
    return c;
  };

  /* Bake-time realism pass: top-light gradient, ambient-occlusion band along inner edges, soft rim highlight on top edges, micro grain. */
  BB.enhance = function (c, str) {
    str = str == null ? 1 : str; const W = c.width, H = c.height, B = c.B || 1; if (W < 8 || H < 8) return c;
    const g = c.getContext('2d'); const tmp = () => { const t = mk(W, H); return [t, t.getContext('2d')]; };
    const [bl, blg] = tmp(); const hasF = 'filter' in blg;
    if (hasF) { blg.filter = 'blur(' + Math.max(1, 1.8 * B) + 'px)'; blg.drawImage(c, 0, 0); blg.filter = 'none'; }
    g.save(); g.globalCompositeOperation = 'source-atop';
    if (hasF) {                                   // inner edge band -> ambient occlusion
      const [e, eg] = tmp(); eg.drawImage(c, 0, 0); eg.globalCompositeOperation = 'source-in'; eg.fillStyle = '#05030a'; eg.fillRect(0, 0, W, H); eg.globalCompositeOperation = 'destination-out'; eg.drawImage(bl, 0, 0);
      g.globalAlpha = .55 * str; g.drawImage(e, 0, 0);
      const [r, rg] = tmp(); rg.drawImage(c, 0, 0); rg.globalCompositeOperation = 'source-in'; rg.fillStyle = '#fff4dc'; rg.fillRect(0, 0, W, H); rg.globalCompositeOperation = 'destination-out'; rg.drawImage(c, 0, Math.max(1, 1.6 * B)); // top edge highlight
      g.globalAlpha = .26 * str; g.drawImage(r, 0, 0);
    }
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(255,244,222,.11)'); gr.addColorStop(.45, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(6,4,14,.24)');
    g.globalAlpha = str; g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const gx = g.createLinearGradient(0, 0, W, 0); gx.addColorStop(0, 'rgba(255,240,215,.05)'); gx.addColorStop(1, 'rgba(0,0,12,.12)'); g.fillStyle = gx; g.fillRect(0, 0, W, H);   // key light from the left
    g.restore(); return c;
  };

  BB.avgColor = function (c, sx0, sy0, sw, sh) {
    const t = mk(1, 1), g = t.getContext('2d');
    try { g.drawImage(c, sx0, sy0, Math.max(1, sw), Math.max(1, sh), 0, 0, 1, 1); const d = g.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; } catch (e) { return [90, 80, 70]; }
  };
  const shade = (rgb, f) => 'rgb(' + rgb.map(v => clamp(v * f | 0, 0, 255)).join(',') + ')';

  /* --------------------------------------------------------------- hooks */
  /* Gameplay / UI modules plug in here (see docs/ARCHITECTURE.md). */
  BB.hooks = { drawables: [], decals: [], post: [], update: [], lights: [], hotspots: [] };
  /* tiny event bus: BB.on('task:done', fn); BB.emit('task:done', data) */
  const _ev = {};
  BB.on = (n, f) => { (_ev[n] = _ev[n] || []).push(f); return f; };
  BB.off = (n, f) => { _ev[n] = (_ev[n] || []).filter(x => x !== f); };
  BB.emit = (n, d) => { for (const f of (_ev[n] || []).slice()) { try { f(d); } catch (e) { console.error('[event ' + n + ']', e); } } };
  BB.actors = [];                 // {id,x,y,z,facing,draw(g,t,k),shadow,reflect,zBias}
  BB.DEFAULT_S = { f: {}, items: [], stains: [], dust: [], tools: {}, mode: 'menu', time: 0, total: 1 };
  BB.S = null;
  BB.rooms = {};                  // id -> definition
  BB.defineRoom = def => { BB.rooms[def.id] = def; };
  BB.world = { objects: [], hotspots: [], solids: [], lights: [], hot: id => BB.world.hotspots.find(h => h.id === id), rooms: [] };
  BB.debug = { on: false, collide: true, layers: true, hot: true };

  /* ------------------------------------------------------------ world build */
  function bakeSprite(o) {
    if (!o.bake) return;
    const fns = typeof o.bake === 'function' ? { _: o.bake } : o.bake;
    o.img = {};
    for (const k in fns) { o.img[k] = BB.bake(o.w, o.h, fns[k], { blur: o.blur }); if (Q.enhance && !o.blur && o.enhance !== false) { try { BB.enhance(o.img[k], o.enhance || 1); } catch (e) { } } }
    if (o.depth) {                       // average colours for extruded side / top faces
      const im = o.img[Object.keys(o.img)[0]], B = im.B;
      const top = BB.avgColor(im, 0, 0, im.width, Math.max(1, 3 * B)), side = BB.avgColor(im, im.width - 3 * B, im.height * .2, 3 * B, im.height * .6);
      o.topRGB = o.topRGB || top; o.sideRGB = o.sideRGB || side;
    }
  }
  function prepObject(o, room) {
    o.room = room; o.ax = room.x0 + (o.x || 0); o.y = o.y || 0; o.z = o.z || 0;
    o.zs = o.z + (o.zBias || 0);
    bakeSprite(o);
  }
  function pad(room, idx) { return { l: idx === 0 ? 260 : 0, r: idx === L.rooms.length - 1 ? 260 : 0 }; }

  BB.buildWorld = async function (onProgress) {
    recalc();
    const W = BB.world; W.objects.length = 0; W.hotspots.length = 0; W.solids.length = 0; W.lights.length = 0; W.rooms.length = 0;
    const total = L.rooms.length + 1; let done = 0;
    const tick = async () => { done++; onProgress && onProgress(done / total); await new Promise(r => setTimeout(r, 0)); };
    BB.sky = makeSky(); await TEX.load([...new Set(Object.values(TEXMAP).flatMap(m => [m.wall[0], m.floor[0]]))]).catch(() => { }); await tick();
    for (let i = 0; i < L.rooms.length; i++) {
      const lr = L.rooms[i], def = BB.rooms[lr.id] || { id: lr.id };
      const room = Object.assign({}, def, { id: lr.id, name: lr.name, x0: lr.x0, x1: lr.x1, w: lr.x1 - lr.x0, idx: i });
      room.pad = pad(room, i); room.ambient = def.ambient || { color: [60, 56, 66] };
      const tw = room.w + room.pad.l + room.pad.r; room.tx0 = room.x0 - room.pad.l; room.tw = tw;
      room.wallImg = BB.bake(tw, L.ceilH, (g, w, h) => { BB.defaultWall(g, w, h, room); if (def.wall) def.wall(g, w, h, room); }, { B: Math.min(Q.bake, 1.9) });
      { const tm = TEXMAP[lr.id]; if (tm && Q.enhance && BB.useTex !== false) { try { TEX.apply(room.wallImg, tm.wall, room.wallImg.B || 1.5); } catch (e) { console.warn('[tex]', e); } } }
      const FD = L.wallZ - L.frontZ; room.FD = FD;
      room.floorImg = BB.bake(tw, FD, (g, w, d) => { BB.defaultFloor(g, w, d, room); if (def.floor) def.floor(g, w, d, room); }, { B: Math.min(Q.bake, 1.5) });
      { const tm = TEXMAP[lr.id]; if (tm && Q.enhance && BB.useTex !== false) { try { TEX.apply(room.floorImg, tm.floor, room.floorImg.B || 1.5); } catch (e) { console.warn('[tex]', e); } } }
      room.ceilImg = BB.bake(tw, FD, (g, w, d) => { BB.defaultCeil(g, w, d, room); if (def.ceil) def.ceil(g, w, d, room); }, { B: 1 });
      room.objects = (def.objects || []).slice(); room.objects.forEach(o => prepObject(o, room));
      room.lights = (def.lights || []).map(l => Object.assign({ z: 40, y: 200, r: 300, i: 1, color: '255,200,140' }, l, { ax: room.x0 + l.x, room }));
      room.hotspots = (def.hotspots || []).map(h => Object.assign({ r: 50, h: 120, z: 0 }, h, { ax: room.x0 + h.x, room: room.id }));
      room.solids = (def.solids || []).map(s => Object.assign({}, s, { ax0: room.x0 + s.x0, ax1: room.x0 + s.x1 }));
      W.rooms.push(room); W.objects.push(...room.objects); W.hotspots.push(...room.hotspots); W.solids.push(...room.solids); W.lights.push(...room.lights);
      await tick();
    }
    BB.built = true;
  };
  BB.roomObj = id => BB.world.rooms.find(r => r.id === id);


  /* ------------------------------------------------- photo material layers (CC0 ambientCG textures, assets/tex) */
  const TEX = BB.tex = { img: {}, ready: false };
  TEX.load = function (names) {
    return Promise.all(names.map(n => new Promise(res => { const out = {}; let left = 2; const done = () => { if (!--left) { TEX.img[n] = out; res(); } };
      ['c', 's'].forEach(k => { const im = new Image(); im.onload = () => { out[k] = im; done(); }; im.onerror = () => { done(); }; im.src = 'assets/tex/' + n + '_' + k + '.jpg'; }); })));
  };
  /* spec = [name, tileCm, colorAlpha, shadeAlpha]; blends the albedo + relief shading of a real material over a painted canvas, keeping its alpha (holes) */
  TEX.apply = function (c, spec, B) {
    if (!spec || !TEX.img[spec[0]]) return; const t = TEX.img[spec[0]], W = c.width, H = c.height, g = c.getContext('2d'); if (!t.c || !t.s) return;
    const mask = mk(W, H); mask.getContext('2d').drawImage(c, 0, 0); const sc_ = spec[1] * B / 512;
    g.save(); g.globalCompositeOperation = 'overlay';
    for (const [im, a] of [[t.c, spec[2]], [t.s, spec[3]]]) { if (!a) continue; const pat = g.createPattern(im, 'repeat'); try { pat.setTransform(new DOMMatrix().scale(sc_, sc_)); } catch (e) { } g.globalAlpha = a; g.fillStyle = pat; g.fillRect(0, 0, W, H); }
    g.restore(); g.save(); g.globalCompositeOperation = 'destination-in'; g.drawImage(mask, 0, 0); g.restore();
  };
  const TEXMAP = {
    hall: { wall: ['Plaster007', 80, .5, .75], floor: ['Concrete012', 80, .6, .95] },
    living: { wall: ['Plaster006', 90, .35, .7], floor: ['Planks037B', 90, .8, .95] },
    kitchen: { wall: ['Plaster001', 80, .4, .7], floor: ['Concrete034', 90, .55, .95] },
    bath: { wall: ['Concrete034', 100, .3, .65], floor: ['Tiles052', 60, .5, .9] },
    work: { wall: ['Concrete012', 90, .45, .75], floor: ['Concrete034', 100, .65, .95] }
  };

  /* ---------------------------------------------- default procedural surfaces */
  BB.defaultWall = function (g, w, h, room) {
    const c = room.wallColor || ['#6f6258', '#54493f'];
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  };
  BB.defaultFloor = function (g, w, d, room) {
    const c = room.floorColor || ['#6a4d36', '#3e2b1d'];
    const gr = g.createLinearGradient(0, 0, 0, d); gr.addColorStop(0, c[1]); gr.addColorStop(1, c[0]); g.fillStyle = gr; g.fillRect(0, 0, w, d);
  };
  BB.defaultCeil = function (g, w, d, room) {
    const gr = g.createLinearGradient(0, 0, 0, d); gr.addColorStop(0, '#2b2622'); gr.addColorStop(1, '#4b443d'); g.fillStyle = gr; g.fillRect(0, 0, w, d);
  };

  /* --------------------------------------------------------- distant city */
  function makeSky() {
    const x0 = -2400, x1 = L.worldW + 2400, w = x1 - x0, h = 1100;
    const img = BB.bake(w, h, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0a0d22'); gr.addColorStop(.55, '#1d2142'); gr.addColorStop(.85, '#4a3550'); gr.addColorStop(1, '#6b4a52'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const r = srand(7);
      for (let i = 0; i < 260; i++) { g.fillStyle = 'rgba(255,255,240,' + (.15 + r() * .6) + ')'; g.fillRect(r() * w, r() * h * .55, 1.6, 1.6); }
      g.fillStyle = '#f4ecd0'; g.beginPath(); g.arc(w * .56, 150, 34, 0, 7); g.fill();
      g.fillStyle = 'rgba(244,236,208,.12)'; g.beginPath(); g.arc(w * .56, 150, 120, 0, 7); g.fill();
      for (let layer = 0; layer < 3; layer++) {
        let x = -20; const col = ['#2a2745', '#1c1b33', '#121226'][layer], base = h - layer * 40;
        while (x < w) {
          const bw = 70 + r() * 130, bh = 160 + r() * 360 + (2 - layer) * 40;
          g.fillStyle = col; g.fillRect(x, base - bh, bw, bh + 200);
          if (layer > 0) for (let wx = x + 8; wx < x + bw - 10; wx += 16) for (let wy = base - bh + 14; wy < base - 20; wy += 22) if (r() < .32) { g.fillStyle = r() < .7 ? 'rgba(255,214,130,.85)' : 'rgba(150,200,255,.7)'; g.fillRect(wx, wy, 7, 10); }
          x += bw + r() * 12;
        }
      }
    }, { B: .4 });
    return { img, x0, z: 2600, w, h };
  }

  /* --------------------------------------------------------------- helpers */
  const dn = (g, pts, fill) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fillStyle = fill; g.fill(); };
  /* soft ellipse lying on the floor (x,z world cm; rx,rz half-sizes cm) */
  BB.floorEllipse = function (g, x, z, rx, rz, rgba, y0) {
    const k = V.ppc * V.zoom * sc(z), cx = sx(x, z), cy = sy(y0 || 0, z), ry = rz * V.camH * V.ppc * V.zoom * sc(z) * sc(z) / V.D;
    if (ry < .5 || rx * k < .5) return;
    g.save(); g.translate(cx, cy); g.scale(rx * k, ry);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, rgba); gr.addColorStop(1, rgba.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill(); g.restore();
  };
  /* generic flat floor quad decal (x0..x1, z0..z1 world cm) */
  BB.floorQuad = function (g, x0, x1, z0, z1, fill) { dn(g, [sx(x0, z0), sy(0, z0), sx(x1, z0), sy(0, z0), sx(x1, z1), sy(0, z1), sx(x0, z1), sy(0, z1)], fill); };

  /* Draw the visible faces of an axis aligned box (world cm). cols = {front,left,right,top,bottom} fill styles */
  function boxFaces(g, x0, x1, y0, y1, z0, z1, cols) {
    const P = (x, y, z) => [sx(x, z), sy(y, z)];
    if (cam.x < x0 && cols.left) { const a = P(x0, y0, z0), b = P(x0, y1, z0), c = P(x0, y1, z1), d = P(x0, y0, z1); dn(g, [...a, ...b, ...c, ...d], typeof cols.left === 'function' ? cols.left(a[0], d[0]) : cols.left); }
    if (cam.x > x1 && cols.right) { const a = P(x1, y0, z0), b = P(x1, y1, z0), c = P(x1, y1, z1), d = P(x1, y0, z1); dn(g, [...a, ...b, ...c, ...d], typeof cols.right === 'function' ? cols.right(a[0], d[0]) : cols.right); }
    if (V.camH > y1 && cols.top) { const a = P(x0, y1, z0), b = P(x1, y1, z0), c = P(x1, y1, z1), d = P(x0, y1, z1); dn(g, [...a, ...b, ...c, ...d], cols.top); }
    if (V.camH < y0 && cols.bottom) { const a = P(x0, y0, z0), b = P(x1, y0, z0), c = P(x1, y0, z1), d = P(x0, y0, z1); dn(g, [...a, ...b, ...c, ...d], cols.bottom); }
    if (cols.front) { const a = P(x0, y0, z0), b = P(x1, y1, z0); g.fillStyle = cols.front; g.fillRect(a[0], b[1], b[0] - a[0], a[1] - b[1]); }
    if (cols.back && z1 > z0) { /* never visible from the camera */ }
  }
  BB.boxFaces = boxFaces;

  /* ---------------------------------------------------------- partitions */
  function wallFaceFill(g, ya, yb, base, ceilCol) {
    const gr = g.createLinearGradient(0, ya, 0, yb); gr.addColorStop(0, ceilCol); gr.addColorStop(.12, base); gr.addColorStop(1, shadeCss(base, .62)); return gr;
  }
  const _cc = {};
  function shadeCss(css, f) {
    const key = css + f; if (_cc[key]) return _cc[key];
    const m = /^#([0-9a-f]{6})$/i.exec(css); if (!m) return css;
    const n = parseInt(m[1], 16); const r = clamp((n >> 16) * f | 0, 0, 255), g_ = clamp(((n >> 8) & 255) * f | 0, 0, 255), b = clamp((n & 255) * f | 0, 0, 255);
    return _cc[key] = 'rgb(' + r + ',' + g_ + ',' + b + ')';
  }
  BB.shadeCss = shadeCss;
  function drawPartition(g, p) {
    const hx = L.partT / 2, x0 = p.x - hx, x1 = p.x + hx, Hc = L.ceilH, dj = L.doorW / 2, dh = L.doorH;
    const left = BB.roomObj(p.left), right = BB.roomObj(p.right);
    const colL = (left && left.partitionFace) || (left && left.wallColor && left.wallColor[0]) || '#6f6258';
    const colR = (right && right.partitionFace) || (right && right.wallColor && right.wallColor[0]) || '#6f6258';
    const trim = '#6b4a30', trimD = '#3b2616', ceilC = '#2a2420';
    const yTop = sy(Hc, 0), yBot = sy(0, 0);
    const fl = (x, y0, y1, c) => wallFaceFill(g, sy(y1, L.wallZ), sy(y0, 0), c, ceilC);
    const faceL = (a, b) => wallFaceFill(g, yTop - 50, yBot, colL, ceilC), faceR = (a, b) => wallFaceFill(g, yTop - 50, yBot, colR, ceilC);
    if (p.solid) {                         // end walls: one full block
      boxFaces(g, x0, x1, 0, Hc, L.frontZ + 40, L.wallZ + 2, { left: faceL, right: faceR, front: '#1a1512' });
      return;
    }
    // far block (behind the doorway) and its jamb (end face toward camera)
    boxFaces(g, x0, x1, 0, Hc, dj, L.wallZ + 2, { left: faceL, right: faceR, front: wallFaceFill(g, sy(Hc, dj), sy(0, dj), '#53473d', ceilC) });
    // door casing on the jamb
    boxFaces(g, x0 - 3, x1 + 3, 0, dh + 4, dj - 3, dj + 2, { left: trim, right: trim, front: trim, top: trim });
    // lintel over the doorway: underside and front
    boxFaces(g, x0, x1, dh + 4, Hc, -dj, dj, { left: faceL, right: faceR, front: wallFaceFill(g, sy(Hc, -dj), sy(dh, -dj), '#4a3f36', ceilC), bottom: '#1b1613' });
    boxFaces(g, x0 - 3, x1 + 3, dh, dh + 6, -dj - 3, dj + 2, { left: trim, right: trim, front: trim, bottom: trimD });
    // dark gap shading on the floor of the doorway
    BB.floorQuad(g, x0, x1, -dj, dj, 'rgba(0,0,0,.18)');
    // baseboards on both faces of the far block
    if (cam.x < x0) dn(g, [sx(x0, dj), sy(0, dj), sx(x0, dj), sy(12, dj), sx(x0, L.wallZ), sy(12, L.wallZ), sx(x0, L.wallZ), sy(0, L.wallZ)], 'rgba(20,12,8,.55)');
    if (cam.x > x1) dn(g, [sx(x1, dj), sy(0, dj), sx(x1, dj), sy(12, dj), sx(x1, L.wallZ), sy(12, L.wallZ), sx(x1, L.wallZ), sy(0, L.wallZ)], 'rgba(20,12,8,.55)');
  }

  /* ----------------------------------------------- floor / ceiling in bands */
  function drawPlane(g, room, isCeil) {
    const img = isCeil ? room.ceilImg : room.floorImg, B = img.B || img.width / room.tw;
    const hv = V.hor + cam.shy, k0 = V.ppc * V.zoom, dyS = (isCeil ? (L.ceilH - V.camH) : V.camH) * k0;
    const yWall = isCeil ? sy(L.ceilH, L.wallZ) : sy(0, L.wallZ);
    const step = Q.band;
    let ya, yEnd;
    if (isCeil) { ya = yWall; yEnd = 0; } else { ya = yWall; yEnd = V.H; }
    const dir = isCeil ? -1 : 1;
    for (let y = ya; isCeil ? y > yEnd : y < yEnd; y += dir * step) {
      const y2 = isCeil ? Math.max(yEnd, y - step) : Math.min(yEnd, y + step);
      const ym = (y + y2) / 2, s = Math.abs(ym - hv) / dyS; if (s <= .02) continue;
      const z = V.D / s - V.D, zA = V.D / (Math.abs(y - hv) / dyS) - V.D, zB = V.D / (Math.abs(y2 - hv) / dyS) - V.D;
      const k = k0 * s;
      const xL = cam.x - (V.W / 2 + 40) / k, xR = cam.x + (V.W / 2 + 40) / k;
      const a = Math.max(room.tx0, xL), b = Math.min(room.tx0 + room.tw, xR); if (b <= a) continue;
      const v0 = (L.wallZ - Math.min(zA, zB)) * B, v1 = (L.wallZ - Math.max(zA, zB)) * B; // zA at wall side
      const vs = Math.min(v0, v1), vh = Math.max(1, Math.abs(v1 - v0));
      const dy0 = Math.min(y, y2), dh = Math.abs(y2 - y) + 1;
      g.drawImage(img, (a - room.tx0) * B, clamp(vs, 0, img.height - 1), (b - a) * B, Math.min(vh, img.height - vs), sx(a, z) , dy0, (b - a) * k, dh);
    }
  }

  /* --------------------------------------------------------------- sprites */
  function spriteScreen(o) {
    const k = V.ppc * V.zoom * sc(o.z), x = sx(o.ax + (o.dx || 0), o.z), yb = sy(o.y + (o.dy || 0), o.z);
    return { k, x, yb };
  }
  function drawSprite(g, o, S, t) {
    const { k, x, yb } = spriteScreen(o);
    const w = o.w * k, h = o.h * k;
    if (x + w / 2 < -60 || x - w / 2 > V.W + 60 || yb - h > V.H + 60 || yb < -60) return;
    // contact shadow on the floor
    if (o.y === 0 && o.shadow !== false && o.w && o.z < L.wallZ - 4) {
      const sh = o.shadow || {}, rx = (sh.w || o.w * .55), rz = sh.d || Math.min(o.depth || 18, 34);
      BB.floorEllipse(g, o.ax + (sh.dx || 0), o.z + (o.depth ? o.depth / 2 : 6), rx, rz, 'rgba(0,0,0,' + (sh.a || .42) + ')');
    }
    if (o.depth) {
      const y1 = o.y + o.h, ax0 = o.ax - o.w / 2, ax1 = o.ax + o.w / 2, tr = o.topRGB, sr = o.sideRGB;
      if (tr || sr) boxFaces(g, ax0, ax1, o.y, y1, o.z, o.z + o.depth, { left: shade(sr || tr, .55), right: shade(sr || tr, .62), top: tr ? shade(tr, 1.05) : null });
    }
    if (o.alpha != null) g.globalAlpha = o.alpha;
    const img = o.img && o.img[o.variant ? (o.variant(S) || '_') : '_'];
    const flip = o.flip;
    if (img) {
      if (flip) { g.save(); g.translate(x, 0); g.scale(-1, 1); g.drawImage(img, -w / 2, yb - h, w, h); g.restore(); }
      else g.drawImage(img, x - w / 2, yb - h, w, h);
    }
    if (o.dyn) { g.save(); g.translate(x - w / 2, yb - h); g.scale(k, k); try { o.dyn(g, t, S, o); } catch (e) { if (!o._err) { o._err = 1; console.error('[dyn]', o.id, e); } } g.restore(); }
    if (o.alpha != null) g.globalAlpha = 1;
  }

  function drawActor(g, a, t) {
    const k = V.ppc * V.zoom * sc(a.z || 0), x = sx(a.x, a.z || 0), yb = sy(a.y || 0, a.z || 0);
    g.save(); g.translate(x, yb); g.scale(k, k); a.draw(g, t, k); g.restore();
  }
  function actorShadow(g, a) {
    if (a.shadow === false) return;
    const nl = nearestLight(a.x), lift = clamp((a.y || 0) / 120, 0, .7);
    let dx = 0; if (nl) dx = clamp(-(nl.ax - a.x) * .12, -34, 34);
    BB.floorEllipse(g, a.x + dx, (a.z || 0), (a.shadowW || 34) * (1 - lift * .6), 14, 'rgba(0,0,0,' + (.5 * (1 - lift)) + ')');
    BB.floorEllipse(g, a.x, (a.z || 0), (a.shadowW || 34) * .7 * (1 - lift * .5), 8, 'rgba(0,0,0,' + (.35 * (1 - lift)) + ')');
  }
  function nearestLight(x) {
    let best = null, bd = 1e9; const S = BB.S || BB.DEFAULT_S;
    for (const l of BB.world.lights) { if (l.on && !l.on(S)) continue; const d = Math.abs(l.ax - x); if (d < l.r && d < bd) { bd = d; best = l; } }
    return best;
  }

  /* -------------------------------------------------------------- lighting */
  let lm = null, lg = null, refl = null, rg = null, noiseC = null, dotImg = null;
  function ensureBuffers() {
    const lw = Math.ceil(V.W / Q.lightDiv), lh = Math.ceil(V.H / Q.lightDiv);
    if (!lm || lm.width !== lw || lm.height !== lh) { lm = mk(lw, lh); lg = lm.getContext('2d'); }
    if (!dotImg) {
      dotImg = mk(32, 32); const g = dotImg.getContext('2d'); const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,240,210,1)'); gr.addColorStop(.35, 'rgba(255,230,190,.5)'); gr.addColorStop(1, 'rgba(255,220,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    }
    if (Q.grain && !noiseC) {
      noiseC = mk(128, 128); const g = noiseC.getContext('2d'), d = g.createImageData(128, 128), r = srand(3);
      for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - .5) * 90; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      g.putImageData(d, 0, 0);
    }
  }
  function lightsList(S, t) {
    const list = [];
    for (const l of BB.world.lights) {
      if (l.on && !l.on(S)) continue;
      const f = l.flicker ? 1 - l.flicker * (.5 + .5 * Math.sin(t * 37 + l.ax) * Math.sin(t * 5.3)) : 1;
      list.push({ ax: l.ax, y: l.y, z: l.z, r: l.r, i: (l.i || 1) * f, color: l.color, bloom: l.bloom == null ? .1 : l.bloom, room: l.room, cone: l.cone, puddle: l.puddle });
    }
    for (const fn of BB.hooks.lights) { const a = fn(S, t); if (a) for (const l of a) list.push(Object.assign({ z: 0, bloom: 0, color: '255,230,200' }, l)); }
    return list;
  }
  function drawLighting(g, S, t) {
    ensureBuffers();
    const d = Q.lightDiv, lw = lm.width, lh = lm.height, mode = BB.lightMode || 'normal';
    lg.globalCompositeOperation = 'source-over'; lg.setTransform(1, 0, 0, 1, 0, 0);
    // ambient per room with soft borders
    const rooms = BB.world.rooms;
    lg.fillStyle = 'rgb(20,18,28)'; lg.fillRect(0, 0, lw, lh);
    for (const r of rooms) {
      const a = sx(r.x0, 0) / d, b = sx(r.x1, 0) / d, f = 70 / d; if (b + f < 0 || a - f > lw) continue;
      const col = (r.ambientNow ? r.ambientNow(S, t) : r.ambient.color).map(Math.round), c = 'rgb(' + col.join(',') + ')', c0 = 'rgba(' + col.join(',') + ',0)';
      const first = r.idx === 0, last = r.idx === rooms.length - 1;
      const x0 = first ? a - 2000 : a - f, x1 = last ? b + 2000 : b + f, span = x1 - x0;
      const gr = lg.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, first ? c : c0); gr.addColorStop(first ? 0 : clamp(2 * f / span, 0, .49), c); gr.addColorStop(last ? 1 : clamp(1 - 2 * f / span, .51, 1), c); gr.addColorStop(1, last ? c : c0);
      lg.fillStyle = gr; lg.fillRect(x0, 0, span, lh);
    }
    const lights = lightsList(S, t);
    lg.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const k = V.ppc * V.zoom * sc(l.z), x = sx(l.ax, l.z) / d, y = sy(l.y, l.z) / d, r = l.r * k / d;
      if (x + r < 0 || x - r > lw) continue;
      const gr = lg.createRadialGradient(x, y, 0, x, y, r), c = l.color;
      gr.addColorStop(0, 'rgba(' + c + ',' + clamp(l.i, 0, 1.4) + ')'); gr.addColorStop(.45, 'rgba(' + c + ',' + clamp(l.i * .45, 0, 1) + ')'); gr.addColorStop(1, 'rgba(' + c + ',0)');
      lg.fillStyle = gr; lg.fillRect(x - r, y - r, r * 2, r * 2);
    }
    lg.globalCompositeOperation = 'source-over';
    if (mode === 'full') return lights;
    g.save(); g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true; g.drawImage(lm, 0, 0, lw * d, lh * d); g.fillStyle = 'rgb(238,238,240)'; g.fillRect(0, 0, V.W, V.H); g.restore();   // + global exposure trim
    // bloom / light shafts
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (!l.bloom) continue;
      const k = V.ppc * V.zoom * sc(l.z), x = sx(l.ax, l.z), y = sy(l.y, l.z), r = l.r * k * .8;
      if (x + r < 0 || x - r > V.W) continue;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(' + l.color + ',' + (l.bloom * l.i) + ')'); gr.addColorStop(1, 'rgba(' + l.color + ',0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.restore();
    return lights;
  }


  /* ------------------------------------------------------------ light fx */
  function lightFX(g, lights) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      if (!l.room || l.z > 400) continue;
      const gl = l.room.gloss || 0, k = V.ppc * V.zoom * sc(l.z), x = sx(l.ax, l.z), yTop = sy(l.y, l.z);
      if (x < -300 || x > V.W + 300) continue;
      // volumetric cone under ceiling lamps
      if (l.cone !== false && l.y >= 175 && l.r >= 180 && l.i > .3) {
        const yb = sy(0, l.z), w = Math.min(l.r * .42, 150) * k, gr = g.createLinearGradient(0, yTop, 0, yb);
        gr.addColorStop(0, 'rgba(' + l.color + ',' + (.055 * l.i) + ')'); gr.addColorStop(1, 'rgba(' + l.color + ',0)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - 6 * k, yTop); g.lineTo(x + 6 * k, yTop); g.lineTo(x + w, yb); g.lineTo(x - w, yb); g.closePath(); g.fill();
      }
      // pool of light on the floor (stronger on glossy floors)
      if (l.puddle !== false && l.y >= 80 && l.i > .3) BB.floorEllipse(g, l.ax, l.z, Math.min(l.r * .5, 190), Math.min(l.r * .16, 60), 'rgba(' + l.color + ',' + Math.min(.22, .05 + gl * .55) * Math.min(1, l.i) + ')');
    }
    g.restore();
  }
  function silOf(o, key, im) {
    o._sil = o._sil || {}; if (o._sil[key]) return o._sil[key];
    const w = Math.max(4, im.width >> 2), h = Math.max(4, im.height >> 2), c = mk(w, h), cg = c.getContext('2d'); cg.drawImage(im, 0, 0, w, h);
    cg.globalCompositeOperation = 'source-in'; cg.fillStyle = '#04020a'; cg.fillRect(0, 0, w, h);
    const o2 = mk(w, h), g2 = o2.getContext('2d'); if ('filter' in g2) g2.filter = 'blur(1.4px)'; g2.drawImage(c, 0, 0); return o._sil[key] = o2;
  }
  function wallShadows(g, list, S) {
    const kW = V.ppc * V.zoom * sc(L.wallZ), yTop = sy(L.ceilH, L.wallZ), yBot = sy(0, L.wallZ);
    for (const o of list) {
      if (!o.img || o.part || o.draw || o.post || o.shadowCast === false || o.z > L.wallZ - 16 || o.z < -10 || o.h < 28 || !o.room) continue;
      const room = o.room; let best = null, bs = 0;
      for (const l of room.lights) { if (l.on && !l.on(S)) continue; if (l.z >= o.z - 6 || l.r < 120) continue; const d = Math.abs(l.ax - o.ax), sc_ = (l.i || 1) * Math.max(0, 1 - d / (l.r * 1.15)); if (sc_ > bs) { bs = sc_; best = l; } }
      if (!best || bs < .12) continue;
      const t = (L.wallZ - best.z) / (o.z - best.z); if (!(t > 1.04 && t < 3.2)) continue;
      const key = o.variant ? (o.variant(S) || '_') : '_', im = o.img[key]; if (!im) continue;
      const cx = best.ax + (o.ax - best.ax) * t, yb = best.y + (o.y - best.y) * t, yt = best.y + (o.y + o.h - best.y) * t, w = o.w * t * kW;
      const X = sx(cx, L.wallZ), Ya = sy(yb, L.wallZ), Yb = sy(yt, L.wallZ), y0 = Math.min(Ya, Yb), hh = Math.abs(Ya - Yb);
      if (X + w / 2 < 0 || X - w / 2 > V.W || hh < 4) continue;
      g.save(); g.beginPath(); g.rect(sx(room.x0, L.wallZ), yTop, room.w * kW, yBot - yTop); g.clip();
      g.globalAlpha = Math.min(.42, .5 * bs / Math.pow(t, .7)); g.drawImage(silOf(o, key, im), X - w / 2, y0, w, hh); g.restore();
    }
  }
  let bloomA = null, bloomB = null;
  function bloomPass(g) {
    const cw = g.canvas.width, ch = g.canvas.height, bw = Math.max(32, cw >> 3), bh = Math.max(18, ch >> 3);
    if (!bloomA || bloomA.width !== bw) { bloomA = mk(bw, bh); bloomB = mk(bw, bh); }
    const a = bloomA.getContext('2d'), b = bloomB.getContext('2d'); if (!('filter' in b)) return;
    a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'copy'; a.drawImage(g.canvas, 0, 0, bw, bh);
    b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'copy'; b.filter = 'brightness(.72) contrast(2.8) blur(2.6px)'; b.drawImage(bloomA, 0, 0); b.filter = 'none';
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'lighter'; g.globalAlpha = .22; g.imageSmoothingEnabled = true; g.drawImage(bloomB, 0, 0, cw, ch); g.restore();
  }

  /* ----------------------------------------------------------- reflections */
  function reflectPass(g, list, S, t, glossMax) {
    if (!Q.reflect || glossMax <= .12) return;
    const w = Math.ceil(V.W / 3), h = Math.ceil(V.H / 3);
    if (!refl || refl.width !== w || refl.height !== h) { refl = mk(w, h); rg = refl.getContext('2d'); }
    rg.setTransform(1, 0, 0, 1, 0, 0); rg.clearRect(0, 0, w, h); rg.setTransform(1 / 3, 0, 0, 1 / 3, 0, 0);
    let any = false;
    for (const o of list) {
      if (!o.reflect) continue;
      const room = o.room || BB.roomObj(L.roomOf(o.ax != null ? o.ax : o.x).id); const gl = (room && room.gloss) || 0; if (gl <= 0) continue;
      if (o.draw) { // actor
        const k = V.ppc * V.zoom * sc(o.z || 0), x = sx(o.x, o.z || 0), yb = sy(o.y || 0, o.z || 0);
        if (x < -100 || x > V.W + 100) continue;
        rg.save(); rg.translate(x, yb + 2); rg.scale(k, -k); rg.globalAlpha = gl * o.reflect; o.draw(rg, t, k); rg.restore(); any = true;
      } else if (o.img) {
        const { k, x, yb } = spriteScreen(o), im = o.img[o.variant ? (o.variant(S) || '_') : '_']; if (!im || o.y > 5) continue;
        if (x + o.w * k / 2 < 0 || x - o.w * k / 2 > V.W) continue;
        rg.save(); rg.globalAlpha = gl * o.reflect; rg.translate(x, yb); rg.scale(1, -1); rg.drawImage(im, -o.w * k / 2, 0, o.w * k, o.h * k); rg.restore(); any = true;
      }
    }
    if (!any) return;
    rg.setTransform(1, 0, 0, 1, 0, 0); rg.globalCompositeOperation = 'destination-in';
    const gr = rg.createLinearGradient(0, V.floorY / 3, 0, V.H / 3); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(.75, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    rg.fillStyle = gr; rg.fillRect(0, 0, w, h); rg.globalCompositeOperation = 'source-over';
    g.save(); g.imageSmoothingEnabled = true; g.drawImage(refl, 0, 0, V.W, V.H); g.restore();
  }

  /* ------------------------------------------------------------- particles */
  const parts = [];
  function updateParticles(dt, t) {
    const want = Math.round(70 * Q.particles);
    const rnd = Math.random;
    while (parts.length < want) parts.push({ x: cam.x + (rnd() - .5) * 1400, y: 20 + rnd() * 230, z: -60 + rnd() * 220, vx: (rnd() - .5) * 6, vy: (rnd() - .5) * 2.5, s: .5 + rnd() * 1.2, a: .15 + rnd() * .5, ph: rnd() * 6 });
    for (const p of parts) {
      p.x += (p.vx + Math.sin(t * .5 + p.ph) * 3) * dt; p.y += (p.vy + Math.cos(t * .4 + p.ph) * 1.5) * dt;
      if (p.x < cam.x - 800) p.x += 1600; else if (p.x > cam.x + 800) p.x -= 1600;
      if (p.y < 10) p.y = 250; else if (p.y > 255) p.y = 15;
    }
    if (parts.length > want) parts.length = want;
  }
  function drawParticles(g, lights, near) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const p of parts) {
      if ((p.z < 0) !== near) continue;
      const x = sx(p.x, p.z), y = sy(p.y, p.z), k = V.ppc * V.zoom * sc(p.z);
      if (x < -10 || x > V.W + 10) continue;
      let lit = 0; for (const l of lights) { const dx = (l.ax - p.x), dy = (l.y - p.y); const d2 = dx * dx + dy * dy, r2 = l.r * l.r; if (d2 < r2) lit = Math.max(lit, (1 - d2 / r2) * l.i); }
      if (lit < .05) continue;
      g.globalAlpha = clamp(p.a * lit * .55, 0, .6); const r = p.s * k * 3.2; g.drawImage(dotImg, x - r, y - r, r * 2, r * 2);
    }
    g.restore();
  }

  /* ------------------------------------------------------------------ render */
  const list = [];
  BB.frameStats = { objs: 0, drawn: 0, rooms: 0 };
  BB.render = function (g, S, t, dt) {
    S = S || BB.DEFAULT_S; recalc();
    if (cam.shake > 0) { cam.shake = Math.max(0, cam.shake - dt * 2.2); cam.shx = (Math.random() - .5) * 14 * cam.shake; cam.shy = (Math.random() - .5) * 9 * cam.shake; } else { cam.shx = cam.shy = 0; }
    g.setTransform(V.scale, 0, 0, V.scale, 0, 0);
    g.fillStyle = '#07060a'; g.fillRect(0, 0, V.W, V.H);
    if (!BB.built) return;
    updateParticles(dt, t);
    // visible rooms (a room is visible if any part of it can be on screen at any depth)
    const halfFar = (V.W / 2 + 120) / (V.ppc * V.zoom * sc(L.wallZ)), vis = BB.world.rooms.filter(r => r.x1 > cam.x - halfFar && r.x0 < cam.x + halfFar);
    BB.frameStats.rooms = vis.length;
    // 0. distant city (parallax from its own depth)
    { const s = BB.sky, k = V.ppc * V.zoom * sc(s.z), x = sx(s.x0, s.z), yb = sy(-250, s.z);
      g.drawImage(s.img, x, yb - s.h * k, s.w * k, s.h * k); }
    // 1. ceilings, floors and back walls
    for (const r of vis) drawPlane(g, r, true);
    for (const r of vis) {
      const k = V.ppc * V.zoom * sc(L.wallZ);
      g.drawImage(r.wallImg, sx(r.tx0, L.wallZ), sy(L.ceilH, L.wallZ), r.tw * k, L.ceilH * k + 1);
    }
    for (const r of vis) drawPlane(g, r, false);
    // fog toward the back wall (cheap depth cue on the floor)
    { const yw = sy(0, L.wallZ); const gr = g.createLinearGradient(0, yw, 0, yw + 90); gr.addColorStop(0, 'rgba(10,8,14,.55)'); gr.addColorStop(1, 'rgba(10,8,14,0)'); g.fillStyle = gr; g.fillRect(0, yw, V.W, 90); }
    // 2. floor decals from gameplay (stains, dust...)
    for (const fn of BB.hooks.decals) fn(g, t, S, vis);
    // 3. gather drawables
    list.length = 0;
    for (const r of vis) for (const o of r.objects) { if (o.hidden && o.hidden(S)) continue; list.push(o); }
    for (const fn of BB.hooks.drawables) { const a = fn(S, t, vis); if (a) for (const o of a) { if (o.ax == null) o.ax = o.x; if (o.zs == null) o.zs = o.z || 0; list.push(o); } }
    for (const a of BB.actors) { if (a.hidden) continue; a.zs = (a.z || 0) + (a.zBias == null ? -.02 : a.zBias); list.push(a); }
    for (const p of L.partitions.concat([0, L.worldW])) {
      if (p > cam.x + halfFar || p < cam.x - halfFar) continue;
      const solid = p === 0 || p === L.worldW;
      list.push({ part: { x: p, solid, left: solid ? (p === 0 ? 'hall' : 'work') : L.roomOf(p - 1).id, right: solid ? (p === 0 ? 'hall' : 'work') : L.roomOf(p + 1).id }, zs: solid ? -300 : 40 });
    }
    list.sort((a, b) => (b.zs - a.zs));
    BB.frameStats.objs = list.length;
    // reflections go on the floor, below everything standing on it
    let gloss = 0; for (const r of vis) gloss = Math.max(gloss, r.gloss || 0);
    reflectPass(g, list, S, t, gloss);
    if (Q.shadows) wallShadows(g, list, S);
    // 4. paint far -> near, with painter's fog between depth bands
    const fogBands = [[260, .10], [150, .08], [90, .06]];
    let fb = 0, drawn = 0;
    const fogCol = 'rgba(24,20,34,';
    for (const o of list) {
      while (fb < fogBands.length && o.zs < fogBands[fb][0]) { g.fillStyle = fogCol + fogBands[fb][1] + ')'; g.fillRect(0, 0, V.W, V.H); fb++; }
      if (o.part) { drawPartition(g, o.part); continue; }
      if (o.draw) { actorShadow(g, o); drawActor(g, o, t); drawn++; continue; }
      if (o.post) continue;
      drawSprite(g, o, S, t); drawn++;
    }
    BB.frameStats.drawn = drawn;
    // 5. light, then self-lit things and atmosphere
    const lights = drawLighting(g, S, t);
    if (Q.fx && lights) lightFX(g, lights);
    for (const o of list) if (o.post && !o.part && !o.draw) { if (o.hidden && o.hidden(S)) continue; g.save(); g.globalCompositeOperation = o.postMode || 'source-over'; drawSprite(g, o, S, t); g.restore(); }
    drawParticles(g, lights || [], false); drawParticles(g, lights || [], true);
    for (const fn of BB.hooks.post) fn(g, t, S);
    if (Q.bloom) bloomPass(g);
    // 6. grade: vignette + grain
    { const gr = g.createRadialGradient(V.W / 2, V.H * .52, V.H * .35, V.W / 2, V.H * .52, V.W * .72); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(4,3,8,.58)'); g.fillStyle = gr; g.fillRect(0, 0, V.W, V.H); }
    { g.save(); g.globalCompositeOperation = 'overlay'; const gg = g.createLinearGradient(0, 0, 0, V.H); gg.addColorStop(0, 'rgba(60,105,150,.16)'); gg.addColorStop(.55, 'rgba(0,0,0,0)'); gg.addColorStop(1, 'rgba(255,165,85,.12)'); g.fillStyle = gg; g.fillRect(0, 0, V.W, V.H); g.restore(); }
    if (Q.grain && noiseC) { g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = .07; const ox = (t * 977 | 0) % 128, oy = (t * 631 | 0) % 128; for (let x = -ox; x < V.W; x += 128) for (let y = -oy; y < V.H; y += 128) g.drawImage(noiseC, x, y); g.restore(); }
    if (BB.debug.on) drawDebug(g, S, t, vis);
  };

  /* ------------------------------------------------------------- debug view */
  function drawDebug(g, S, t, vis) {
    g.save(); g.font = '12px monospace'; g.textBaseline = 'top';
    const D = BB.debug;
    if (D.layers) {
      [['sky', BB.sky.z], ['back wall', L.wallZ], ['doorway', L.doorW / 2], ['gameplay', 0], ['foreground', -120]].forEach(([n, z], i) => {
        g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(8, 8 + i * 16, 230, 15); g.fillStyle = '#9f9'; g.fillText(n + '  z=' + z + '  parallax=' + sc(z).toFixed(3) + ' (' + (sc(z) * 100 | 0) + '%)', 12, 9 + i * 16);
      });
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(8, 92, 300, 15); g.fillStyle = '#ff9'; g.fillText('cam.x=' + cam.x.toFixed(0) + ' ppc=' + V.ppc + ' D=' + V.D + ' camH=' + V.camH + ' drawn=' + BB.frameStats.drawn + ' q=' + Q.name, 12, 93);
      // 1m ruler at the gameplay lane
      const k = V.ppc * V.zoom; g.strokeStyle = '#ff0'; g.fillStyle = '#ff0'; for (let cmH = 0; cmH <= 200; cmH += 50) { const y = sy(cmH, 0); g.beginPath(); g.moveTo(V.W - 70, y); g.lineTo(V.W - 40, y); g.stroke(); g.fillText(cmH + 'cm', V.W - 38, y - 6); }
      g.beginPath(); g.moveTo(V.W - 55, sy(0, 0)); g.lineTo(V.W - 55, sy(200, 0)); g.stroke();
    }
    for (const r of vis) { const a = sx(r.x0, 0), b = sx(r.x1, 0); g.strokeStyle = 'rgba(80,200,255,.7)'; g.strokeRect(a, 130, b - a, V.H - 150); g.fillStyle = '#8df'; g.fillText(r.id + ' [' + r.x0 + '..' + r.x1 + ']', a + 6, 134); }
    if (D.collide) for (const s of BB.world.solids) { if (s.active && !s.active(S)) continue; const a = sx(s.ax0, 0), b = sx(s.ax1, 0), y = sy(s.top, 0), y0 = sy(0, 0); g.strokeStyle = '#f55'; g.strokeRect(a, y, b - a, y0 - y); g.fillStyle = 'rgba(255,60,60,.15)'; g.fillRect(a, y, b - a, y0 - y); }
    if (D.hot) for (const h of BB.world.hotspots) { const a = sx(h.ax - h.r, 0), b = sx(h.ax + h.r, 0), y0 = sy(0, 0); g.strokeStyle = '#6f6'; g.strokeRect(a, y0 - 14, b - a, 14); g.fillStyle = '#6f6'; g.fillText(h.id, a + 2, y0 + 3); const yy = sy(h.h, 0); g.beginPath(); g.arc(sx(h.ax, 0), yy, 4, 0, 7); g.stroke(); }
    for (const a of BB.actors) { const x = sx(a.x, a.z || 0), y = sy(a.y || 0, a.z || 0), yt = sy((a.y || 0) + (a.height || L.playerH), a.z || 0); g.strokeStyle = '#0ff'; g.beginPath(); g.moveTo(x - 40, y); g.lineTo(x + 40, y); g.moveTo(x - 40, yt); g.lineTo(x + 40, yt); g.moveTo(x, y); g.lineTo(x, yt); g.stroke(); }
    g.restore();
  }

  /* ---------------------------------------------------------------- resize */
  BB.resize = function (canvas, cssW, cssH) {
    const dprWant = Math.min(window.devicePixelRatio || 1, 2);
    let px = cssW * dprWant * cssH * dprWant;
    let dpr = dprWant; if (px > Q.maxPx) dpr = dprWant * Math.sqrt(Q.maxPx / px);
    canvas.width = Math.max(2, Math.round(cssW * dpr)); canvas.height = Math.max(2, Math.round(cssH * dpr));
    V.cw = canvas.width; V.ch = canvas.height;
    V.H = 720; V.scale = canvas.height / V.H; V.W = canvas.width / V.scale;
    V.dpr = dpr; recalc();
  };
  /* camera helpers used by main.js */
  BB.lightInfoAt = function (x) { const l = nearestLight(x); if (!l) return null; return { side: l.ax >= x ? 1 : -1, i: Math.min(1, (l.i || 1) * (1 - Math.abs(l.ax - x) / (l.r * 1.2))), color: l.color }; };
  BB.camLimits = function () { const half = (V.W / 2) / (V.ppc * V.zoom); return [Math.min(half, L.worldW / 2), Math.max(L.worldW - half, L.worldW / 2)]; };
  recalc();
})();
