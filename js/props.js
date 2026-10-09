/* ==========================================================================
   BB.props - procedural small props, tools and floor decals.  Owner: props agent.
   Everything is painted in CENTIMETRES (BB.bake space) and cached. See docs/PROPS.md
   ========================================================================== */
(function () {
  'use strict';
  const BB = window.BB = window.BB || {};
  const { clamp, lerp, srand } = BB.U;
  const A = BB.art;
  const PR = BB.props = {};
  const TAU = Math.PI * 2;
  const PADX = 2, PADT = 2, PADB = 2.5;

  /* ------------------------------------------------------------ colour utils */
  const _cc = {};
  function css(c) {
    if (Array.isArray(c)) return c;
    if (_cc[c]) return _cc[c];
    const t = BB.mk(1, 1), g = t.getContext('2d', { willReadFrequently: true });
    g.fillStyle = '#000'; g.fillStyle = c; g.fillRect(0, 0, 1, 1);
    const d = g.getImageData(0, 0, 1, 1).data; return _cc[c] = [d[0], d[1], d[2]];
  }
  const col = (c, f) => A.shade(css(c), f);
  const mixc = (a, b, t) => A.mix(css(a), css(b), t);
  const rgba = (c, a) => { const x = css(c); return 'rgba(' + x[0] + ',' + x[1] + ',' + x[2] + ',' + a + ')'; };
  function hash(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  /* seeded value noise -> fn(x,y) in 0..1 */
  function makeNoise(seed) {
    const r = srand(seed), N = 64, L = new Float32Array(N * N); for (let i = 0; i < L.length; i++) L[i] = r();
    const at = (x, y) => L[((y & 63) << 6) + (x & 63)];
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      return lerp(lerp(at(xi, yi), at(xi + 1, yi), u), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), u), v);
    };
  }

  /* ------------------------------------------------------- painting helpers */
  const P_ = f => g => f(g);
  /* lit body: gradient light from top-left, dark rim, rim light. path(g) builds the path. bb = [x0,y0,x1,y1] */
  function body(g, path, bb, c, o) {
    o = o || {}; const [x0, y0, x1, y1] = bb;
    g.save(); g.beginPath(); path(g); g.clip();
    g.fillStyle = A.lg(g, x0, y0, x0 + (x1 - x0) * (o.gx == null ? .35 : o.gx), y1, [[0, col(c, 1 + (o.hi == null ? .28 : o.hi))], [.45, col(c, 1)], [1, col(c, 1 - (o.lo == null ? .38 : o.lo))]]);
    g.fillRect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2);
    if (o.fn) o.fn(g);
    if (o.grain !== false) A.grain(g, x0, y0, x1 - x0, y1 - y0, o.grain || .12, .35);
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(0,0,0,' + (o.rim == null ? .3 : o.rim) + ')'; g.lineWidth = o.rw || 1.6; g.beginPath(); path(g); g.stroke();
    if (o.rl !== 0) { g.save(); g.translate(.45, .55); g.strokeStyle = 'rgba(255,255,255,' + (o.rl || .22) + ')'; g.lineWidth = .8; g.beginPath(); path(g); g.stroke(); g.restore(); }
    g.restore();
  }
  const pathOf = pts => g => { g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); };
  /* smooth closed blob through points (quadratic midpoints) */
  const blobPath = pts => g => {
    const n = pts.length / 2; const mx = i => (pts[(i % n) * 2] + pts[((i + 1) % n) * 2]) / 2, my = i => (pts[(i % n) * 2 + 1] + pts[((i + 1) % n) * 2 + 1]) / 2;
    g.moveTo(mx(n - 1), my(n - 1)); for (let i = 0; i < n; i++) g.quadraticCurveTo(pts[i * 2], pts[i * 2 + 1], mx(i), my(i)); g.closePath();
  };
  /* polygon with rounded corners (arcTo) */
  const polyR = (pts, r) => g => {
    const n = pts.length / 2, P = i => [pts[((i + n) % n) * 2], pts[((i + n) % n) * 2 + 1]];
    let a = P(n - 1), b = P(0); g.moveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    for (let i = 0; i < n; i++) { const c = P(i), d = P(i + 1); g.arcTo(c[0], c[1], (c[0] + d[0]) / 2, (c[1] + d[1]) / 2, r); }
    g.closePath();
  };
  const ellP = (cx, cy, rx, ry, rot) => g => { g.ellipse(cx, cy, rx, ry, rot || 0, 0, TAU); };
  const rrP = (x, y, w, h, r) => g => { g.roundRect(x, y, w, h, r); };
  /* horizontal cylinder shading gradient (for vertical bodies) */
  const cylH = (g, x0, x1, c, k) => A.lg(g, x0, 0, x1, 0, [[0, col(c, .5)], [.2, col(c, 1.05 + (k || 0))], [.35, col(c, 1.35 + (k || 0))], [.7, col(c, .85)], [1, col(c, .42)]]);
  /* vertical cylinder shading (for bodies lying on their side) */
  const cylV = (g, y0, y1, c, k) => A.lg(g, 0, y0, 0, y1, [[0, col(c, 1.3 + (k || 0))], [.22, col(c, 1.25 + (k || 0))], [.5, col(c, .92)], [1, col(c, .45)]]);
  /* contact shadow lying on the floor under an object (y=0 ground) */
  const contact = (g, x, w, a, h) => { g.save(); g.fillStyle = A.rg(g, x, 0, 0, w / 2, ['rgba(0,0,0,' + (a || .5) + ')', 'rgba(0,0,0,0)']); g.translate(x, 0); g.scale(1, h || .2); g.translate(-x, 0); g.fillRect(x - w / 2, -w / 2, w, w); g.restore(); };
  /* creases / wrinkles inside current clip */
  function creases(g, bb, seed, n, o) {
    o = o || {}; const r = srand(seed), [x0, y0, x1, y1] = bb, w = x1 - x0, h = y1 - y0;
    g.save(); g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const ax = x0 + r() * w, ay = y0 + r() * h, ang = (o.ang == null ? r() * TAU : o.ang + (r() - .5) * (o.spread || 1.2)), len = (o.len || .35) * Math.max(w, h) * (.4 + r() * .8);
      const bx = ax + Math.cos(ang) * len, by = ay + Math.sin(ang) * len, cx = (ax + bx) / 2 + (r() - .5) * len * .5, cy = (ay + by) / 2 + (r() - .5) * len * .5;
      g.strokeStyle = 'rgba(0,0,0,' + (o.dark || .26) + ')'; g.lineWidth = (o.w || .7) * (.6 + r() * .8); g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(cx, cy, bx, by); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,' + (o.light || .12) + ')'; g.lineWidth = (o.w || .7) * .8; g.beginPath(); g.moveTo(ax + .55, ay + .7); g.quadraticCurveTo(cx + .55, cy + .7, bx + .55, by + .7); g.stroke();
    }
    g.restore();
  }
  /* round specks (inside clip) */
  function dots(g, bb, seed, n, c, smax) { const r = srand(seed), [x0, y0, x1, y1] = bb; g.fillStyle = c; g.beginPath(); for (let i = 0; i < n; i++) { const rad = .12 + r() * (smax || .5), x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0); g.moveTo(x + rad, y); g.arc(x, y, rad, 0, TAU); } g.fill(); }
  /* grime: smudges + specks inside current clip */
  function grime(g, bb, seed, a) {
    const [x0, y0, x1, y1] = bb, w = x1 - x0, h = y1 - y0; a = a == null ? 1 : a;
    A.blotches(g, x0, y0, w, h, seed, Math.max(2, Math.round(w * h / 40)), 'rgba(50,38,20,' + (.16 * a) + ')', 1.5, Math.max(3, Math.min(w, h) * .5));
    dots(g, bb, seed + 1, Math.round(w * h / 5), 'rgba(30,22,12,' + (.35 * a) + ')', .4);
  }
  /* a rope/tube along bezier pts [x,y]*n (poly through points smoothed) with lit cylinder look */
  function samplePath(pts, steps) {
    const out = [], n = pts.length - 1;
    for (let s = 0; s <= steps; s++) {
      const u = s / steps * n, i = Math.min(n - 1, u | 0), f = u - i;
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n, i + 2)];
      const q = k => .5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * f + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * f * f + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * f * f * f);
      out.push([q(0), q(1)]);
    }
    return out;
  }
  function strokePts(g, pts, w, style, dash) { g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = style; g.lineWidth = w; if (dash) g.setLineDash(dash); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.stroke(); g.restore(); }
  function tube(g, pts, w, c, o) {
    o = o || {}; const sp = samplePath(pts, o.steps || 40);
    strokePts(g, sp.map(p => [p[0] + .2, p[1] + .5]), w * 1.08, 'rgba(0,0,0,.35)');
    strokePts(g, sp, w, col(c, .62));
    strokePts(g, sp.map(p => [p[0] - w * .06, p[1] - w * .1]), w * .78, col(c, 1));
    strokePts(g, sp.map(p => [p[0] - w * .14, p[1] - w * .24]), w * .32, col(c, 1.38));
    if (o.segs) for (const [a, b, c2, wf] of o.segs) { const sub = sp.slice(Math.round(a * (sp.length - 1)), Math.round(b * (sp.length - 1)) + 1), ww = w * (wf || 1); strokePts(g, sub, ww, col(c2, .62)); strokePts(g, sub.map(p => [p[0] - ww * .06, p[1] - ww * .1]), ww * .78, col(c2, 1)); strokePts(g, sub.map(p => [p[0] - ww * .14, p[1] - ww * .24]), ww * .32, col(c2, 1.3)); }
    if (o.ribs) { const [a, b, c2, gap] = o.ribs; for (let i = Math.round(a * (sp.length - 1)); i <= Math.round(b * (sp.length - 1)); i += gap || 1) { const p0 = sp[Math.max(0, i - 1)], p1 = sp[Math.min(sp.length - 1, i + 1)], nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0], l = Math.hypot(nx, ny) || 1; g.strokeStyle = c2; g.lineWidth = .28; g.beginPath(); g.moveTo(sp[i][0] + nx / l * w * .5, sp[i][1] + ny / l * w * .5); g.lineTo(sp[i][0] - nx / l * w * .5, sp[i][1] - ny / l * w * .5); g.stroke(); } }
    if (o.stripes) { const [a, b, c2, gap, sw] = o.stripes; for (let i = Math.round(a * (sp.length - 1)); i <= Math.round(b * (sp.length - 1)); i += gap) { const p0 = sp[Math.max(0, i - 1)], p1 = sp[Math.min(sp.length - 1, i + 1)], nx = -(p1[1] - p0[1]), ny = p1[0] - p0[0], l = Math.hypot(nx, ny) || 1; g.strokeStyle = c2; g.lineWidth = sw || .9; g.lineCap = 'butt'; g.beginPath(); g.moveTo(sp[i][0] + nx / l * w * .46 - w * .05, sp[i][1] + ny / l * w * .46 - w * .1); g.lineTo(sp[i][0] - nx / l * w * .46 - w * .05, sp[i][1] - ny / l * w * .46 - w * .1); g.stroke(); } }
    return sp;
  }
  /* glass highlight streak */
  const glint = (g, x, y, w, h, a) => { g.fillStyle = 'rgba(255,255,255,' + (a || .5) + ')'; g.beginPath(); g.roundRect(x, y, w, h, w / 2); g.fill(); };
  /* fabric blob with folds */
  function fabric(g, path, bb, c, seed, o) {
    o = o || {};
    body(g, path, bb, c, { hi: .22, lo: .26, rim: .3, grain: .2, fn: gg => { if (o.pattern) o.pattern(gg); creases(gg, bb, seed, o.n || 9, { dark: .2, light: .16, len: .45, w: 1.1 }); gg.fillStyle = A.rg(gg, (bb[0] + bb[2]) * .5 - 3, bb[1] + 2, 0, (bb[2] - bb[0]) * .45, ['rgba(255,255,255,.14)', 'rgba(255,255,255,0)']); gg.fillRect(bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]); A.blotches(gg, bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1], seed + 3, 6, 'rgba(20,12,6,.14)', 2, 7); } });
  }

  /* ============================================================ registry */
  const DEF = {};
  PR.defs = DEF;
  function def(kind, o) { DEF[kind] = o; o.kind = kind; o.variants = o.variants || ['_']; return o; }
  const cache = {};
  function resolve(kind, variant) {
    const d = DEF[kind]; if (!d) return null;
    const vs = d.variants;
    if (variant == null) return vs ? vs[0] : '_';
    if (typeof variant === 'number') return vs ? vs[((variant % vs.length) + vs.length) % vs.length] : '_';
    if (d.freeVariant) return variant;
    return vs && vs.indexOf(variant) >= 0 ? variant : (vs ? vs[0] : '_');
  }
  function render(kind, variant, state, B) {
    const d = DEF[kind], v = resolve(kind, variant), s = (state && d.states && d.states.indexOf(state) >= 0) ? state : (d.states ? d.states[0] : '_');
    const sz = d.size(v, s), cw = sz[0], ch = sz[1], w = cw + PADX * 2, h = ch + PADT + PADB;
    const rng = srand(hash(kind + v + s));
    const img = BB.bake(w, h, g => { g.translate(w / 2, h - PADB); d.paint(g, v, s, rng, cw, ch); }, B ? { B } : null);
    const hand = d.hand ? d.hand(v, s) : [0, -ch];
    return { img, w, h, cw, ch, ox: w / 2, oy: h - PADB, hx: w / 2 + hand[0], hy: h - PADB + hand[1], kind, variant: v, state: s };
  }
  /* BB.props.get(kind, variant, state) -> {img,w,h,ox,oy,hx,hy,cw,ch}.  ox,oy = floor anchor (bottom centre) in cm from the sprite's top-left. */
  PR.get = function (kind, variant, state) {
    if (!DEF[kind]) { kind = 'trash'; }
    const d = DEF[kind], v = resolve(kind, variant), s = (state && d.states && d.states.indexOf(state) >= 0) ? state : (d.states ? d.states[0] : '_');
    const key = kind + '|' + v + '|' + s + '|' + (BB.quality ? BB.quality.name : '');
    return cache[key] || (cache[key] = render(kind, variant, state));
  };
  PR.kinds = () => Object.keys(DEF);
  PR.variants = kind => (DEF[kind] && DEF[kind].variants || ['_']).slice();
  PR.states = kind => (DEF[kind] && DEF[kind].states || ['_']).slice();
  PR.trash = v => PR.get('trash', v);
  PR.cloth = v => PR.get('cloth', v);
  PR.sizeOf = (kind, variant, state) => { const d = DEF[kind]; const v = resolve(kind, variant); return d.size(v, state && d.states && d.states.indexOf(state) >= 0 ? state : (d.states ? d.states[0] : '_')); };

  /* UI icon: high-res re-bake fitted into a sizePx square (cached) */
  const iconCache = {};
  PR.icon = function (kind, variant, sizePx, state) {
    const key = kind + '|' + variant + '|' + state + '|' + sizePx; if (iconCache[key]) return iconCache[key];
    if (!DEF[kind]) kind = 'trash';
    const d = DEF[kind], v = resolve(kind, variant), s = state && d.states && d.states.indexOf(state) >= 0 ? state : (d.states ? d.states[0] : '_');
    const sz = d.size(v, s), m = Math.max(sz[0], sz[1]), fit = sizePx * .86, B = clamp(fit / m, .8, 18);
    const im = render(kind, variant, state, B);
    const c = BB.mk(sizePx, sizePx), g = c.getContext('2d');
    const k = B, dw = im.w * k, dh = im.h * k, dx = (sizePx - im.cw * k) / 2 - PADX * k, dy = sizePx * .5 + im.ch * k / 2 - (im.h - PADB) * k + (PADB * k) * 0;
    // soft floor shadow
    g.save(); g.fillStyle = A.rg(g, sizePx / 2, dy + (im.h - PADB) * k, 0, im.cw * k * .55, ['rgba(0,0,0,.35)', 'rgba(0,0,0,0)']); g.translate(sizePx / 2, dy + (im.h - PADB) * k); g.scale(1, .18); g.translate(-sizePx / 2, -(dy + (im.h - PADB) * k)); g.fillRect(0, dy + (im.h - PADB) * k - sizePx, sizePx, sizePx * 2); g.restore();
    g.drawImage(im.img, dx, dy, dw, dh);
    c.kind = kind; return iconCache[key] = c;
  };

  /* ============================================================ TRASH */
  const sheenV = (g, y0, y1, a1, a2) => { g.fillStyle = A.lg(g, 0, y0, 0, y1, [[0, 'rgba(255,255,255,' + (a1 == null ? .5 : a1) + ')'], [.35, 'rgba(255,255,255,.04)'], [.7, 'rgba(0,0,0,.12)'], [1, 'rgba(0,0,0,' + (a2 == null ? .5 : a2) + ')']]); g.fillRect(-60, y0 - 2, 120, y1 - y0 + 4); };
  const sheenH = (g, x0, x1, a1, a2) => { g.fillStyle = A.lg(g, x0, 0, x1, 0, [[0, 'rgba(0,0,0,' + (a2 == null ? .5 : a2) + ')'], [.22, 'rgba(255,255,255,' + (a1 == null ? .45 : a1) + ')'], [.4, 'rgba(255,255,255,.04)'], [.8, 'rgba(0,0,0,.18)'], [1, 'rgba(0,0,0,' + (a2 == null ? .5 : a2) + ')']]); g.fillRect(x0 - 1, -80, x1 - x0 + 2, 100); };

  /* aluminium can lying on its side; len along x. tone: {band,band2,logo,text} */
  function canLying(g, len, rad, dent, dx, tone, seed) {
    const R = x => rad * (1 - dent * Math.exp(-Math.pow((x - dx) / (len * .2), 2))) * (1 + .045 * Math.sin(x * 3.3 + seed));
    const top = [], bot = [];
    for (let i = 0; i <= 28; i++) { const x = -len / 2 + len * i / 28; const taper = i < 1 || i > 27 ? .86 : 1; top.push([x, -R(x) * taper]); bot.push([x, R(x) * taper]); }
    const path = gg => { gg.moveTo(top[0][0], top[0][1]); top.forEach(p => gg.lineTo(p[0], p[1])); for (let i = bot.length - 1; i >= 0; i--) gg.lineTo(bot[i][0], bot[i][1]); gg.closePath(); };
    contact(g, 0, len * 1.2, .55, .13);
    g.save(); g.translate(0, -rad * .95);
    body(g, path, [-len / 2, -rad, len / 2, rad], tone.base || '#c9ccd0', {
      grain: .18, fn: gg => {
        gg.fillStyle = tone.band; gg.fillRect(-len * .37, -rad * 1.2, len * .74, rad * 2.4);
        gg.fillStyle = tone.band2; gg.fillRect(-len * .37, -rad * 1.2, len * .74, rad * .45); gg.fillRect(-len * .37, rad * .78, len * .74, rad * .5);
        if (tone.claw) { gg.fillStyle = tone.logo; for (let i = -1; i <= 1; i++) { gg.beginPath(); gg.moveTo(-len * .2 + i * rad * .7, -rad * .95); gg.lineTo(-len * .2 + i * rad * .7 + rad * .45, -rad * .95); gg.lineTo(-len * .2 + i * rad * .7 + rad * .15, rad * .95); gg.lineTo(-len * .2 + i * rad * .7 - rad * .3, rad * .95); gg.fill(); } }
        else { gg.fillStyle = tone.logo; gg.beginPath(); gg.arc(-len * .17, 0, rad * .66, 0, TAU); gg.fill();
        gg.fillStyle = tone.text; gg.font = 'bold ' + (rad * .5) + 'px Arial, sans-serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText(tone.label || 'ПИВО', -len * .17, rad * .04); }
        gg.fillStyle = 'rgba(0,0,0,.18)'; gg.fillRect(-len * .5, -rad, len * .13, rad * 2); gg.fillStyle = 'rgba(255,255,255,.55)'; gg.fillRect(-len * .5, -rad, len * .035, rad * 2);
        gg.fillStyle = 'rgba(255,255,255,.4)'; gg.fillRect(len * .44, -rad, len * .06, rad * 2);
        sheenV(gg, -rad, rad, .6, .55);
        if (dent > 0) { creases(gg, [dx - len * .22, -rad, dx + len * .22, rad], seed, 9, { ang: 1.2, spread: 1.6, len: .6, dark: .38, light: .3, w: .55 }); gg.fillStyle = 'rgba(0,0,0,.18)'; gg.fillRect(dx - len * .12, -rad, len * .24, rad * 2); }
        dots(gg, [-len / 2, -rad, (-len / 2)+(len), (-rad)+(rad * 2)], seed, 10, 'rgba(40,25,10,.45)', .6);
      }
    });
    g.restore();
  }
  function canStand(g, rad, hgt, tone, seed, crush, open) {
    const hh = hgt * (1 - crush * .45);
    const path = gg => { gg.moveTo(-rad * .88, -hh); gg.lineTo(-rad, -hh + hgt * .06); gg.lineTo(-rad, -hgt * .05); gg.quadraticCurveTo(-rad, 0, -rad * .85, 0); gg.lineTo(rad * .85, 0); gg.quadraticCurveTo(rad, 0, rad, -hgt * .05); gg.lineTo(rad, -hh + hgt * .06); gg.lineTo(rad * .88, -hh); gg.closePath(); };
    contact(g, 0, rad * 3.4, .55);
    body(g, path, [-rad, -hh, rad, 0], tone.band, {
      grain: .15, fn: gg => {
        gg.fillStyle = cylH(gg, -rad, rad, tone.band); gg.fillRect(-rad, -hh, rad * 2, hh);
        gg.fillStyle = rgba(tone.band2, 1); gg.fillRect(-rad, -hh * .62, rad * 2, hh * .09); gg.fillRect(-rad, -hh * .2, rad * 2, hh * .07);
        gg.fillStyle = rgba(tone.logo, 1); gg.beginPath(); gg.ellipse(0, -hh * .42, rad * .68, hh * .13, 0, 0, TAU); gg.fill();
        gg.fillStyle = tone.text; gg.font = 'bold ' + (rad * .5) + 'px Arial'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText(tone.label || 'ПИВО', 0, -hh * .42);
        gg.fillStyle = A.lg(gg, -rad, 0, rad, 0, [[0, 'rgba(0,0,0,.55)'], [.22, 'rgba(255,255,255,.4)'], [.45, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,.5)']]); gg.fillRect(-rad, -hh, rad * 2, hh);
        if (crush) creases(gg, [-rad, -hh, rad, 0], seed, 10, { ang: 0, spread: 1.4, len: .5, dark: .35, light: .25, w: .55 });
      }
    });
    // top rim ellipse (aluminium) + tab
    g.beginPath(); g.ellipse(0, -hh, rad * .88, rad * .27, 0, 0, TAU); g.fillStyle = A.lg(g, -rad, 0, rad, 0, ['#8e949c', '#e8ebee', '#9aa0a8']); g.fill();
    g.beginPath(); g.ellipse(0, -hh, rad * .66, rad * .2, 0, 0, TAU); g.fillStyle = open ? '#1a1410' : '#b8bdc4'; g.fill();
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = .35; g.stroke();
    g.fillStyle = '#d8dce0'; g.beginPath(); g.ellipse(rad * .1, -hh - rad * .04, rad * .3, rad * .1, open ? -.9 : -.1, 0, TAU); g.fill();
  }
  const TONE = {
    blue: { base: '#c9ccd0', band: '#1d4f9c', band2: '#e8c24a', logo: '#f1f1f1', text: '#1d4f9c', label: 'ПИВО' },
    green: { base: '#c9ccd0', band: '#26733a', band2: '#e9e2b4', logo: '#e8c24a', text: '#1f4d2a', label: 'ЛЁД' },
    red: { base: '#c9ccd0', band: '#b02b24', band2: '#f0d9a0', logo: '#f4f0e4', text: '#b02b24', label: 'ХМЕЛЬ' },
    energy: { base: '#222', band: '#17181c', band2: '#9dff3c', logo: '#9dff3c', text: '#101010', claw: 1 }
  };

  def('trash', {
    variants: ['canCrushed', 'bottle', 'pizzaBox', 'chipBag', 'paperBalls', 'cup', 'cigPack', 'noodleCup', 'wrappers', 'banana', 'newspaper', 'rag', 'jar', 'sludge', 'canPair', 'energy', 'tin'],
    size(v) { return { canCrushed: [14, 7.5], bottle: [28, 8], pizzaBox: [38, 14], chipBag: [21, 25], paperBalls: [19, 11], cup: [23, 9], cigPack: [16, 12], noodleCup: [16, 22], wrappers: [20, 8], banana: [24, 9], newspaper: [34, 14], rag: [22, 9], jar: [11, 17], sludge: [22, 11], canPair: [22, 13], energy: [17, 7.5], tin: [16, 10] }[v]; },
    paint(g, v, s, r, cw, ch) { TRASH[v](g, r); }
  });
  const TRASH = {
    canCrushed(g, r) { g.save(); g.rotate(-.06); canLying(g, 12.5, 3.35, .42, 2.8, TONE.blue, 3); g.restore(); },
    energy(g) { canLying(g, 15, 2.9, .3, 3.5, TONE.energy, 7); },
    canPair(g) {
      canStand(g, 3.3, 12, TONE.green, 5, 0, true);
      g.save(); g.translate(8.5, 0); canLying(g, 10, 3.3, .5, -1, TONE.red, 9); g.restore();
    },
    bottle(g) {
      const R = x => x < -13 ? 3.3 * Math.sqrt(Math.max(0, 1 - Math.pow((x + 13) / 3.4 - 1, 2))) * 0 + 3.3 : x < 4 ? 3.4 : x < 8.2 ? lerp(3.4, 1.35, Math.pow((x - 4) / 4.2, .8)) : x < 12.2 ? 1.35 : 1.8;
      const top = [], bot = []; for (let i = 0; i <= 40; i++) { const x = -13.4 + i * 26.4 / 40; const e = i === 0 ? .8 : 1; top.push([x, -R(x) * e]); bot.push([x, R(x) * e]); }
      const path = gg => { gg.moveTo(top[0][0], top[0][1]); top.forEach(p => gg.lineTo(p[0], p[1])); for (let i = bot.length - 1; i >= 0; i--) gg.lineTo(bot[i][0], bot[i][1]); gg.closePath(); };
      contact(g, 0, 30, .5, .1);
      g.save(); g.translate(0, -3.2);
      body(g, path, [-13.4, -3.4, 13, 3.4], '#4b2512', {
        grain: .1, fn: gg => {
          gg.fillStyle = A.lg(gg, 0, -3.4, 0, 3.4, [[0, '#8a4a1c'], [.3, '#5a2c12'], [.7, '#3a1c0b'], [1, '#6c3716']]); gg.fillRect(-14, -4, 28, 8);
          gg.fillStyle = 'rgba(210,150,60,.45)'; gg.fillRect(-13, 1.2, 17, 2.3);         // amber remnants + warm bounce
          gg.fillStyle = '#d9cfb0'; gg.fillRect(-9, -3.5, 9.5, 7); gg.fillStyle = '#a82a22'; gg.fillRect(-9, -1.2, 9.5, 2.5); gg.fillStyle = '#f0e2b0'; gg.font = 'bold 1.9px Arial'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('ЖИГУЛИ', -4.3, .1);
          gg.fillStyle = 'rgba(0,0,0,.22)'; gg.fillRect(-9, 2.2, 9.5, 1.3); dots(gg, [-9, -3.5, (-9)+(9.5), (-3.5)+(7)], 4, 12, 'rgba(60,50,30,.5)', .5);
          gg.fillStyle = 'rgba(255,255,255,.55)'; gg.beginPath(); gg.roundRect(-12.8, -2.6, 22, .8, .4); gg.fill(); gg.fillStyle = 'rgba(255,255,255,.35)'; gg.beginPath(); gg.roundRect(5, -1.1, 6, .45, .2); gg.fill();
          gg.fillStyle = 'rgba(0,0,0,.35)'; gg.fillRect(11.7, -2, .5, 4);
        }
      });
      g.fillStyle = A.lg(g, 0, -1.8, 0, 1.8, ['#d8b04a', '#8a6a1c']); g.beginPath(); g.roundRect(12, -1.9, 1.3, 3.8, .5); g.fill();
      g.restore();
    },
    pizzaBox(g, r) {
      contact(g, 0, 42, .6, .16);
      const fr = pathOf([-18.5, 0, 18.5, 0, 18.5, -4.2, -18.5, -4.2]);
      body(g, fr, [-18.5, -4.2, 18.5, 0], '#a88650', { fn: gg => { gg.fillStyle = 'rgba(0,0,0,.2)'; for (let x = -18; x < 18; x += .9) gg.fillRect(x, -4.2, .35, 4.2); gg.fillStyle = 'rgba(0,0,0,.35)'; gg.fillRect(-18.5, -3.8, 37, .5); } });
      const tp = pathOf([-18.5, -4.2, 18.5, -4.2, 16.4, -13.3, -16.2, -13.3]);
      body(g, tp, [-18.5, -13.3, 18.5, -4.2], '#d9d0bd', {
        gx: .1, fn: gg => {
          gg.fillStyle = '#c42a22'; gg.beginPath(); gg.moveTo(-13, -6); gg.lineTo(13, -6); gg.lineTo(12, -8); gg.lineTo(-12, -8); gg.fill();
          gg.fillStyle = '#f4efe2'; gg.font = 'bold 2.5px Arial'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('ПИЦЦА', 0, -7.05);
          gg.fillStyle = '#c42a22'; gg.beginPath(); gg.ellipse(0, -10.8, 4.4, 1.5, 0, 0, TAU); gg.fill(); gg.fillStyle = '#e8c24a'; gg.beginPath(); gg.ellipse(0, -10.9, 3.3, 1, 0, 0, TAU); gg.fill();
          A.blotches(gg, -16, -13.3, 33, 9, 12, 7, 'rgba(180,110,20,.38)', 1.5, 4); A.blotches(gg, -16, -13.3, 33, 9, 14, 3, 'rgba(160,30,10,.3)', 1, 2.4);
          gg.fillStyle = 'rgba(0,0,0,.4)'; gg.fillRect(-18, -4.9, 36, .7);
          grime(gg, [-18, -13.3, 18, -4.2], 5, .6); creases(gg, [-18, -13.3, 18, -4.2], 22, 3, { len: .25, dark: .15 });
        }
      });
      // lid gap + peeking slice with crust
      g.fillStyle = '#2a1608'; g.beginPath(); g.moveTo(-9, -4.2); g.lineTo(9, -4.2); g.lineTo(8.4, -5.2); g.lineTo(-8.4, -5.2); g.fill();
      g.fillStyle = '#d9a242'; g.beginPath(); g.moveTo(-6, -4.3); g.quadraticCurveTo(-4, -6.8, 2, -5.4); g.quadraticCurveTo(5, -4.8, 7, -4.3); g.fill(); g.fillStyle = '#b8431d'; g.beginPath(); g.ellipse(-1.5, -5, 1.1, .5, 0, 0, TAU); g.fill();
    },
    chipBag(g) {
      contact(g, 0, 22, .55, .16);
      const teeth = (y0, dir) => { const a = []; for (let i = 0; i <= 12; i++) a.push(-9.4 + i * 18.8 / 12, y0 + (i % 2 ? dir * 1.7 : 0)); return a; };
      const T = teeth(-24.2, 1), pts = T.slice();
      pts.push(10.6, -18, 11.2, -10, 9.6, -2.2);
      const B = teeth(-.3, -1); for (let i = B.length - 2; i >= 0; i -= 2) pts.push(B[i], B[i + 1]);
      pts.push(-10.6, -3, -11.3, -11, -10.8, -18);
      body(g, pathOf(pts), [-11.5, -25, 11.5, 0], '#d8481c', {
        hi: .45, lo: .5, fn: gg => {
          gg.fillStyle = A.lg(gg, 0, -25, 0, 0, ['#f0c020', '#e9741c', '#c0301a']); gg.fillRect(-12, -25, 24, 25);
          gg.fillStyle = A.lg(gg, 0, -26, 0, -20, ['#b8bcc4', '#f2f4f6', '#8a9098']); gg.fillRect(-12, -26, 24, 6.2); gg.fillRect(-12, -3.2, 24, 3.2);
          gg.fillStyle = 'rgba(0,0,0,.2)'; for (let x = -11; x < 11; x += 1.1) { gg.fillRect(x, -25, .35, 6); gg.fillRect(x, -3.2, .35, 3.2); }
          gg.fillStyle = '#fff3c0'; gg.beginPath(); gg.ellipse(0, -12, 6.4, 5.2, -.2, 0, TAU); gg.fill(); gg.fillStyle = '#c0301a'; gg.font = 'bold 3.3px Arial'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('ЧИПСЫ', 0, -12.5); gg.font = 'bold 1.6px Arial'; gg.fillText('ПАПРИКА', 0, -9.8);
          creases(gg, [-11, -20, 11, -3], 31, 20, { dark: .4, light: .3, len: .5, w: .6 });
          gg.fillStyle = 'rgba(0,0,0,.18)'; gg.beginPath(); gg.moveTo(-11, -20); gg.lineTo(-4, -14); gg.lineTo(-11, -4); gg.fill(); gg.fillStyle = 'rgba(255,255,255,.25)'; gg.beginPath(); gg.moveTo(9, -20); gg.lineTo(5, -14); gg.lineTo(8, -5); gg.lineTo(11, -8); gg.fill();
        }
      });
      g.fillStyle = '#e9b050'; g.beginPath(); g.ellipse(11.5, -.8, 1.5, .8, .3, 0, TAU); g.fill(); g.beginPath(); g.ellipse(-12.5, -.7, 1.2, .8, -.4, 0, TAU); g.fill();
    },
    paperBalls(g, r) {
      const ball = (x, y, rad, seed) => {
        const rr = srand(seed), n = 11, pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, k = rad * (.88 + rr() * .24); pts.push(x + Math.cos(a) * k, y + Math.sin(a) * k); }
        contact(g, x, rad * 3, .4, .12);
        body(g, blobPath(pts), [x - rad, y - rad, x + rad, y + rad], '#e9e6de', {
          hi: .1, lo: .42, rim: .22, fn: gg => {
            gg.fillStyle = A.rg(gg, x - rad * .4, y - rad * .45, 0, rad * 1.7, ['rgba(255,255,255,.9)', 'rgba(255,255,255,0)']); gg.fillRect(x - rad, y - rad, rad * 2, rad * 2);
            gg.strokeStyle = 'rgba(30,50,120,.35)'; gg.lineWidth = .3; for (let i = 0; i < 4; i++) { gg.beginPath(); gg.moveTo(x - rad + rr() * rad, y - rad + i * rad * .5); gg.lineTo(x + rr() * rad, y - rad + i * rad * .5 + rr()); gg.stroke(); }
            creases(gg, [x - rad, y - rad, x + rad, y + rad], seed, 8, { len: .6, dark: .32, light: .2, w: .45 });
          }
        });
      };
      ball(-4.8, -3.3, 3.3, 11); ball(4.6, -2.8, 2.8, 17); ball(-.4, -7.6, 3.1, 23);
    },
    cup(g) {
      contact(g, 0, 20, .5, .12);
      g.fillStyle = 'rgba(70,36,14,.9)'; g.beginPath(); g.ellipse(12.5, -.8, 6.4, 1.1, .03, 0, TAU); g.fill();       // spill
      g.fillStyle = A.rg(g, 11, -1.2, 0, 6, ['rgba(160,100,50,.55)', 'rgba(160,100,50,0)']); g.fillRect(4, -3, 16, 3);
      g.save(); g.translate(-2, -3.9); g.rotate(.07);
      const path = pathOf([-7.5, -3.7, 7.5, -4.4, 7.5, 4.4, -7.5, 2.9]);
      body(g, path, [-7.5, -4.4, 7.5, 4.4], '#f1eee7', {
        fn: gg => {
          gg.fillStyle = A.lg(gg, 0, -4.4, 0, 4.4, ['#ffffff', '#efece4', '#a8a398']); gg.fillRect(-8, -5, 16, 10);
          gg.fillStyle = '#a97a4c'; gg.fillRect(-4.2, -5, 6.6, 10); gg.fillStyle = 'rgba(0,0,0,.2)'; for (let x = -4; x < 2.4; x += .55) gg.fillRect(x, -5, .22, 10); gg.fillStyle = A.lg(gg, 0, -4.4, 0, 4.4, ['rgba(255,255,255,.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,.4)']); gg.fillRect(-4.2, -5, 6.6, 10);
          gg.fillStyle = '#7a3a22'; gg.beginPath(); gg.arc(-6.1, -1, 1.1, 0, TAU); gg.fill();
          gg.fillStyle = 'rgba(80,45,20,.5)'; gg.fillRect(2.4, -1, 5.5, 1.1); gg.fillRect(6, 0, 1.5, 4.5);  // coffee drip
        }
      });
      g.fillStyle = A.lg(g, 0, -5.4, 0, 5.4, ['#4a4a4e', '#17171a']); g.beginPath(); g.roundRect(7.2, -5.1, 1.8, 10.2, .7); g.fill();
      g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(7.4, -4.8, .4, 9.4); g.restore();
    },
    cigPack(g, r) {
      // butts on the ground
      for (const [x, a] of [[-6.2, .05], [-2.2, -.12]]) { g.save(); g.translate(x, -.6); g.rotate(a); contact(g, 0, 4.4, .4, .1); g.fillStyle = A.lg(g, 0, -.5, 0, .5, ['#f4f0e8', '#aaa498']); g.fillRect(-1.4, -.5, 2.1, 1.05); g.fillStyle = '#d58a2c'; g.fillRect(.7, -.5, 1.0, 1.05); g.fillStyle = '#3a3a3a'; g.fillRect(-1.6, -.5, .3, 1.05); g.restore(); }
      g.save(); g.translate(5, 0); g.rotate(-.18);
      contact(g, 0, 8, .5, .14);
      body(g, rrP(-2.9, -9.8, 5.8, 9.8, .4), [-2.9, -9.8, 2.9, 0], '#e8e3d6', {
        fn: gg => {
          gg.fillStyle = '#c52c2a'; gg.fillRect(-3, -9.8, 6, 3.9); gg.fillStyle = '#f4efe2'; gg.fillRect(-3, -5.6, 6, .5);
          gg.fillStyle = '#f4efe2'; gg.font = 'bold 1.5px Arial'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('ПАРУС', 0, -7.8);
          gg.fillStyle = '#222'; gg.fillRect(-3, -3.3, 6, 3.3); gg.fillStyle = '#fff'; gg.font = 'bold .9px Arial'; gg.fillText('КУРЕНИЕ ВРЕДИТ', 0, -1.7);
          gg.fillStyle = A.lg(gg, -3, 0, 3, 0, ['rgba(0,0,0,.4)', 'rgba(255,255,255,.2)', 'rgba(0,0,0,0)', 'rgba(0,0,0,.3)']); gg.fillRect(-3, -10, 6, 10);
          grime(gg, [-3, -10, 3, 0], 3, .5);
        }
      });
      g.fillStyle = '#e8e3d6'; g.fillRect(-.9, -11.4, 1.1, 1.8); g.fillStyle = '#d58a2c'; g.fillRect(-.9, -10.5, 1.1, .9);
      g.restore();
    },
    noodleCup(g) {
      contact(g, 0, 14, .55, .16);
      const path = pathOf([-4.6, 0, 4.6, 0, 6.3, -10.2, -6.3, -10.2]);
      body(g, path, [-6.3, -10.2, 6.3, 0], '#f0ece0', {
        fn: gg => {
          gg.fillStyle = cylH(gg, -6.3, 6.3, '#efe9da'); gg.fillRect(-7, -11, 14, 11);
          gg.fillStyle = '#d6301f'; gg.beginPath(); gg.moveTo(-5.7, -2.4); gg.lineTo(5.7, -2.4); gg.lineTo(6.0, -8); gg.lineTo(-6.0, -8); gg.fill();
          gg.fillStyle = '#f3c22a'; gg.fillRect(-6, -5.6, 12, 1.8); gg.fillStyle = '#fff'; gg.font = 'bold 2.2px Arial'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('ЛАПША', 0, -6.4);
          gg.fillStyle = A.lg(gg, -6.3, 0, 6.3, 0, [[0, 'rgba(0,0,0,.45)'], [.2, 'rgba(255,255,255,.3)'], [.5, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,.45)']]); gg.fillRect(-7, -11, 14, 11);
          dots(gg, [-6, -10, (-6)+(12), (-10)+(10)], 8, 40, 'rgba(60,50,40,.28)', .4); A.blotches(gg, -6, -10, 12, 5, 4, 4, 'rgba(110,50,10,.35)', 1, 2);
        }
      });
      // peeled foil lid
      g.fillStyle = A.lg(g, -6, 0, 6, 0, ['#9aa0a8', '#eef0f2', '#8a9098']); g.beginPath(); g.moveTo(-6.6, -10.2); g.lineTo(6.6, -10.2); g.lineTo(7.6, -11.4); g.lineTo(-7.6, -11.4); g.fill();
      g.fillStyle = A.lg(g, 0, -15, 0, -10, ['#f0f2f4', '#98a0a8']); g.beginPath(); g.moveTo(-6.4, -11.3); g.quadraticCurveTo(-8.6, -13.6, -5.6, -15.2); g.quadraticCurveTo(-2.6, -14.6, -.8, -11.3); g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = .3; g.stroke();
      // noodles
      g.strokeStyle = '#e8c45a'; g.lineWidth = .75; g.lineCap = 'round';
      for (const [x, d] of [[-.6, 2.6], [1.2, 4], [3.1, 2.2], [4.4, 3.2]]) { g.beginPath(); g.moveTo(x, -11.4); g.bezierCurveTo(x + 1.5, -11.4 + d * .4, x - 2, -11.4 + d * .6, x + .8, -11.4 + d); g.stroke(); }
      g.strokeStyle = 'rgba(160,110,20,.5)'; g.lineWidth = .25; g.beginPath(); g.moveTo(-.2, -11.4); g.bezierCurveTo(1.5, -9, -2, -8, 1, -5.5); g.stroke();
      // fork
      g.save(); g.translate(2.4, -10.5); g.rotate(.32); g.fillStyle = A.lg(g, -.5, 0, .5, 0, ['#cfd2d6', '#fafafa', '#8a8e94']); g.fillRect(-.45, -10.2, .9, 10.5); g.fillRect(-1.4, -12.6, 2.8, 2.7); g.fillStyle = '#e8e4da'; for (let i = -1; i <= 1; i++) g.fillRect(i * .85 - .15, -14.2, .32, 2); g.restore();
    },
    wrappers(g) {
      const w = (x, y, rad, c, seed) => {
        const rr = srand(seed), n = 9, pts = []; for (let i = 0; i < n; i++) { const a = i / n * TAU + rr() * .3, k = rad * (.65 + rr() * .6); pts.push(x + Math.cos(a) * k * 1.3, y + Math.sin(a) * k * .8); }
        contact(g, x, rad * 3.5, .35, .12);
        fabric(g, pathOf(pts), [x - rad * 1.6, y - rad, x + rad * 1.6, y + rad], c, seed, { n: 10 });
        creases(g, [x - rad, y - rad, x + rad, y + rad], seed + 4, 6, { len: .5, dark: .35, light: .35, w: .45 });
      };
      w(-6.3, -2.4, 2.8, '#d7a431', 3); w(5.5, -2.2, 2.6, '#c33a2c', 8); w(-.5, -5.3, 2.5, '#3b6bb8', 12); w(8, -1.2, 1.5, '#e8e0cc', 1);
    },
    banana(g) {
      contact(g, 0, 25, .45, .13);
      const peel = (pts, c1, c2, sd) => {
        const xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1), bb = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
        body(g, blobPath(pts), bb, c1, { hi: .25, lo: .4, rim: .35, grain: .12, fn: gg => { gg.fillStyle = A.lg(gg, 0, bb[1], 0, bb[3], [c1, c2]); gg.fillRect(bb[0] - 1, bb[1] - 1, bb[2] - bb[0] + 2, bb[3] - bb[1] + 2); dots(gg, bb, sd, 9, 'rgba(70,40,10,.5)', .35); creases(gg, bb, sd, 3, { len: .6, dark: .2, light: .25, w: .4 }); } });
      };
      peel([0, -3, -4, -2.4, -9.4, -1.2, -11.2, -.5, -8.4, -.2, -3.5, -.8], '#e6d38a', '#cdb560', 3);      // inner (cream) sides lying flat
      peel([0, -3, 4, -2.7, 9.8, -1.4, 11.6, -.5, 8.6, -.2, 3.6, -.9], '#e8d68e', '#cdb560', 4);
      peel([0, -3.2, -2.4, -4.4, -3.4, -7.8, 1, -8.6, 3.2, -5, 2.6, -3.4], '#efde92', '#d2b862', 5);
      peel([-.3, -3.4, -4.6, -3.3, -9.2, -1.8, -10.6, -.9, -7.6, -.5, -3.2, -1.7], '#f0c722', '#c99a14', 6);   // yellow outer skin overlay
      peel([.3, -3.4, 4.4, -3.4, 9.4, -2, 10.8, -1, 7.8, -.6, 3.4, -1.9], '#efc21c', '#c4960f', 7);
      g.fillStyle = '#4a3416'; g.beginPath(); g.ellipse(0, -3.4, 1.4, 1, 0, 0, TAU); g.fill(); g.fillStyle = '#6a4a20'; g.beginPath(); g.ellipse(-.3, -3.7, .8, .5, 0, 0, TAU); g.fill();
    },
    newspaper(g, r) {
      contact(g, 0, 37, .45, .15);
      const base = [-16.5, -1.4, -9, -.2, 4, -.4, 16, -1.2, 17, -7, 14.5, -12.6, 1, -13, -12, -12.7, -16, -9];
      body(g, pathOf(base), [-17, -13, 17, 0], '#d4cdb2', {
        gx: .15, fn: gg => {
          gg.fillStyle = '#1e1c18'; gg.font = 'bold 3.6px serif'; gg.textAlign = 'left'; gg.textBaseline = 'top'; gg.fillText('ВЕСТИ', -13, -12.4);
          gg.fillRect(-13, -8.1, 26, .35);
          gg.fillStyle = '#8b8878'; gg.fillRect(-13, -7.4, 8, 4.5); gg.fillStyle = '#a49f8b'; gg.beginPath(); gg.arc(-9, -5.5, 1.5, 0, TAU); gg.fill();
          for (let c = 0; c < 2; c++) for (let l = 0; l < 4; l++) { gg.fillStyle = 'rgba(40,36,28,.6)'; gg.fillRect(-3.5 + c * 8, -7.4 + l * 1.15, 6.5 - (l === 3 ? 3 : 0), .4); }
          gg.fillStyle = 'rgba(60,40,10,.2)'; A.blotches(gg, -17, -13, 34, 13, 5, 7, 'rgba(120,90,30,.28)', 2, 6);
          gg.fillStyle = A.lg(gg, 0, -13, 0, 0, ['rgba(255,255,255,.2)', 'rgba(0,0,0,.18)']); gg.fillRect(-17, -13, 34, 13);
          creases(gg, [-17, -13, 17, 0], 51, 9, { dark: .22, light: .22, len: .55, w: .7 });
          grime(gg, [-17, -13, 17, 0], 9, .8);
        }
      });
      // curled up corner
      g.fillStyle = A.lg(g, 0, -4, 0, 0, ['#efe8cc', '#c8c0a2']); g.beginPath(); g.moveTo(8, -1); g.lineTo(16, -1.2); g.quadraticCurveTo(15, -4.5, 9.4, -4.6); g.fill(); g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = .4; g.stroke();
    },
    rag(g) {
      contact(g, 0, 23, .5, .14);
      const pts = [-10, -1.5, -7, -5.5, -2, -8, 3, -7, 8, -5.5, 10.5, -2, 6, -.3, -2, -.2, -7, -.4];
      fabric(g, blobPath(pts), [-11, -8.5, 11, 0], '#b0aa96', 41, { n: 9, pattern: gg => { gg.fillStyle = 'rgba(0,0,0,.08)'; for (let y = -9; y < 0; y += 1.1) gg.fillRect(-12, y, 24, .35); gg.fillStyle = 'rgba(200,170,60,.45)'; gg.fillRect(-12, -6.3, 24, 1.4); } });
      g.save(); g.beginPath(); blobPath(pts)(g); g.clip(); A.blotches(g, -11, -9, 22, 9, 3, 7, 'rgba(30,20,6,.35)', 1.5, 5); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.beginPath(); g.ellipse(-2.6, -3.4, 1.3, .9, .3, 0, TAU); g.fill(); g.beginPath(); g.ellipse(5.2, -2.6, .8, .6, 0, 0, TAU); g.fill(); g.restore();
      g.strokeStyle = '#b0aa96'; g.lineWidth = .35; for (const [x, y, a] of [[10.2, -2.2, .2], [10, -1.2, .6], [-9.6, -1.8, 2.9]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 2.4, y + Math.sin(a) * 1.6); g.stroke(); }
    },
    jar(g) {
      contact(g, 0, 12, .55, .16);
      const path = rrP(-4.6, -13.2, 9.2, 13.2, 1.2);
      g.save(); g.beginPath(); path(g); g.clip();
      g.fillStyle = A.lg(g, -4.6, 0, 4.6, 0, ['#5a6a58', '#b6c7b0', '#8fa38b', '#4a5848']); g.fillRect(-5, -14, 10, 14);
      g.fillStyle = A.lg(g, 0, -9.4, 0, 0, ['#6b6a22', '#4a4614', '#2b2a0c']); g.fillRect(-5, -9.4, 10, 9.4);       // murky brine
      g.fillStyle = A.lg(g, -4.6, 0, 4.6, 0, ['rgba(0,0,0,.45)', 'rgba(255,255,255,.18)', 'rgba(0,0,0,.05)', 'rgba(0,0,0,.5)']); g.fillRect(-5, -14, 10, 14);
      g.fillStyle = '#7d8a3a'; g.beginPath(); g.ellipse(-.6, -4.6, 1.3, 3.2, .2, 0, TAU); g.fill(); g.fillStyle = '#9aa84a'; g.beginPath(); g.ellipse(1.8, -3, 1.1, 2.4, -.3, 0, TAU); g.fill(); dots(g, [-4, -9, (-4)+(8), (-9)+(9)], 5, 14, 'rgba(210,220,160,.4)', .4);
      g.fillStyle = 'rgba(210,225,190,.65)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(-3.4 + i * 1.4, -9.4 + (i % 2) * .3, .9 + (i % 3) * .3, .5, 0, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.roundRect(-3.7, -12, .8, 10, .4); g.fill();
      g.fillStyle = '#d9cfae'; g.fillRect(-4.8, -7.6, 9.6, 3.3); g.fillStyle = '#7a2a2a'; g.font = 'bold 1.3px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ОГУРЦЫ', 0, -5.95); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(-4.8, -4.6, 9.6, .3);
      g.restore(); g.strokeStyle = 'rgba(30,50,30,.5)'; g.lineWidth = .5; g.beginPath(); path(g); g.stroke();
      g.save(); g.translate(.3, -14.3); g.rotate(-.1); g.fillStyle = A.lg(g, -5, 0, 5, 0, ['#8a6a1c', '#e0b94a', '#a67e22', '#6a4c10']); g.beginPath(); g.roundRect(-5.2, -2.2, 10.4, 2.8, .5); g.fill(); g.fillStyle = 'rgba(0,0,0,.3)'; for (let x = -4.8; x < 5; x += .55) g.fillRect(x, -2, .2, 2.4); g.fillStyle = 'rgba(150,60,20,.4)'; g.beginPath(); g.ellipse(2, -.8, 1.2, .6, 0, 0, TAU); g.fill(); g.restore();
    },
    sludge(g, r) {
      contact(g, 0, 24, .5, .14);
      const pts = [-10.4, -1.3, -8.5, -4, -3, -5.2, 2.5, -4.4, 8.5, -4, 11, -1.4, 6, 0, -1, -.2, -8, -.3];
      body(g, blobPath(pts), [-11, -6, 11, 0], '#58652a', {
        hi: .5, lo: .55, rim: .4, fn: gg => {
          gg.fillStyle = A.lg(gg, 0, -6, 0, 0, ['#9bab3c', '#5d6c22', '#2c3412']); gg.fillRect(-12, -6, 24, 6);
          gg.fillStyle = A.rg(gg, -3, -3.2, 0, 8, ['rgba(220,230,120,.35)', 'rgba(220,230,120,0)']); gg.fillRect(-12, -6, 24, 6);
          A.blotches(gg, -11, -6, 22, 6, 33, 8, 'rgba(70,40,14,.45)', 1, 3);
          gg.fillStyle = 'rgba(255,255,230,.6)'; gg.beginPath(); gg.ellipse(-5.2, -4.1, 3.0, .7, -.1, 0, TAU); gg.fill();
        }
      });
      const bub = (x, y, rad) => { g.fillStyle = A.rg(g, x - rad * .3, y - rad * .35, 0, rad, ['rgba(240,255,170,.95)', 'rgba(120,150,40,.7)']); g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); g.strokeStyle = 'rgba(30,50,10,.5)'; g.lineWidth = .3; g.stroke(); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(x - rad * .35, y - rad * .4, rad * .25, 0, TAU); g.fill(); };
      bub(4.2, -4.8, 1.7); bub(7.5, -3.2, 1.0); bub(-7, -3.2, 1.2); bub(.5, -2.2, .8);
      // googly eyes on a big bubble
      g.save(); g.translate(-1.6, -6.4); for (const [dx, pd] of [[-1.55, .3], [1.5, -.2]]) { g.fillStyle = '#f6f6ee'; g.beginPath(); g.arc(dx, 0, 1.45, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = .25; g.stroke(); g.fillStyle = '#111'; g.beginPath(); g.arc(dx + pd, .35, .62, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(dx + pd - .2, .1, .18, 0, TAU); g.fill(); } g.restore();
      g.fillStyle = '#58652a'; g.fillRect(-3.4, -6.6, 3.6, 1.2);
    },
    tin(g) {
      contact(g, 0, 17, .5, .14);
      const fr = rrP(-6.6, -2.6, 13.2, 2.6, .5);
      body(g, fr, [-6.6, -2.6, 6.6, 0], '#9097a0', { fn: gg => { gg.fillStyle = A.lg(gg, 0, -2.6, 0, 0, ['#e4e8ec', '#8a9098', '#b7bcc2']); gg.fillRect(-7, -3, 14, 3.2); } });
      body(g, pathOf([-6.6, -2.6, 6.6, -2.6, 6, -8.6, -6, -8.6]), [-6.6, -8.6, 6.6, -2.6], '#7a5a2a', {
        gx: .1, fn: gg => {
          gg.fillStyle = A.lg(gg, 0, -8.6, 0, -2.6, ['#6a4a20', '#2f1d0c']); gg.fillRect(-7, -9, 14, 7);
          gg.fillStyle = 'rgba(190,140,60,.55)'; gg.beginPath(); gg.ellipse(-1, -5.2, 4.8, 1.3, 0, 0, TAU); gg.fill();
          for (const [x, a] of [[-3.6, .1], [.2, -.05]]) { gg.save(); gg.translate(x, -5.2); gg.rotate(a); gg.fillStyle = A.lg(gg, 0, -1.2, 0, 1.2, ['#c8cacc', '#6a6e72']); gg.beginPath(); gg.ellipse(0, 0, 3.2, 1.05, 0, 0, TAU); gg.fill(); gg.fillStyle = '#9a9ea0'; gg.beginPath(); gg.moveTo(3, 0); gg.lineTo(4.6, -.9); gg.lineTo(4.6, .9); gg.fill(); gg.fillStyle = '#111'; gg.beginPath(); gg.arc(-2.1, -.15, .22, 0, TAU); gg.fill(); gg.restore(); }
          gg.fillStyle = 'rgba(255,230,160,.35)'; gg.fillRect(-6, -8.6, 12, .5);
        }
      });
      // peeled lid roll
      g.save(); g.translate(4.4, -7.6); g.strokeStyle = '#d6dadd'; g.lineWidth = 1.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(3.4, -.6, 5.2, -3.8, 2.8, -4.6); g.bezierCurveTo(.8, -5, .8, -2.8, 2.4, -2.9); g.stroke(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = .3; g.stroke(); g.restore();
      g.fillStyle = 'rgba(210,60,40,.9)'; g.fillRect(-6.6, -2.2, 13.2, .55);
    }
  };

  /* ============================================================ CLOTH */
  const CLOTHV = ['sockBlue', 'sockRed', 'tshirt', 'jeans', 'towel', 'hoodie', 'shirt', 'sockPair'];
  function sock(g, y0, c, o) {
    o = o || {}; g.save(); g.translate(o.dx || 0, y0 || 0); if (o.rot) g.rotate(o.rot);
    const pts = o.pts || [[-10.5, -5.3], [-5.5, -5.5], [-.5, -4.4], [4.5, -3.2], [9.5, -2.9]];
    const w = o.w || 5.2;
    contact(g, 0, 26, .4, .12);
    const sp = tube(g, pts, w, c, {
      segs: [[0, .22, o.cuff || '#e8e4da', 1.04], [.0, .06, o.cuff2 || c, 1.02], [.8, 1, o.toe || '#222a3a', 1.0], [.4, .56, o.heel || o.toe || '#222a3a', 1.04]],
      stripes: o.stripe ? [.28, .78, o.stripe, 4, 1.1] : null, ribs: [0, .21, 'rgba(0,0,0,.28)', 1]
    });
    if (o.hole) { const p = sp[Math.round(sp.length * .5)]; g.fillStyle = '#120c08'; g.beginPath(); g.ellipse(p[0] - .4, p[1] - w * .1, 1.2, .9, .4, 0, TAU); g.fill(); g.strokeStyle = 'rgba(230,220,200,.7)'; g.lineWidth = .3; g.stroke(); for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(p[0] + Math.cos(k * 1.7) * 1.2, p[1] + Math.sin(k * 1.7) * .9); g.lineTo(p[0] + Math.cos(k * 1.7) * 2, p[1] + Math.sin(k * 1.7) * 1.5); g.stroke(); } }
    g.restore();
  }
  def('cloth', {
    variants: CLOTHV,
    size(v) { return { sockBlue: [24, 9], sockRed: [24, 9], tshirt: [36, 14], jeans: [38, 14], towel: [38, 13], hoodie: [36, 16], shirt: [34, 14], sockPair: [28, 12] }[v]; },
    paint(g, v, s, r) { CLOTH[v](g, r); }
  });
  const CLOTH = {
    sockBlue(g) { sock(g, 0, '#3f78b8', { stripe: '#e8ecf2', toe: '#e8ecf2', heel: '#e8ecf2', cuff: '#e8ecf2' }); },
    sockRed(g) { sock(g, 0, '#b02e2a', { toe: '#2a2a2e', heel: '#2a2a2e', cuff: '#2a2a2e', hole: 1, rot: .05 }); },
    sockPair(g) { sock(g, 0, '#7c7f86', { dx: -1, stripe: '#d9b238', toe: '#d9b238', heel: '#d9b238', cuff: '#d9b238', w: 4.8 }); sock(g, -3.5, '#5a7a4a', { dx: 2, rot: -.09, pts: [[-9, -3.5], [-4, -4.4], [1, -3.4], [6, -2.6], [10, -2.2]], toe: '#3a3a3a', heel: '#3a3a3a', cuff: '#c9c6bc', w: 4.6 }); },
    tshirt(g) {
      contact(g, 0, 40, .55, .13);
      const pts = [-3.8, -11.6, -9.4, -10.6, -18.2, -6.4, -16.6, -2.6, -10.6, -4.6, -9.8, -.6, 9.8, -.6, 10.6, -4.8, 16.6, -2.6, 18.2, -6.6, 9.4, -10.6, 3.8, -11.6, 0, -10.4];
      fabric(g, polyR(pts, 1.6), [-18, -11.5, 18, 0], '#3b6aa0', 5, {
        n: 12, pattern: gg => {
          gg.fillStyle = '#eef0f2'; gg.font = 'bold 3.2px Arial'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.save(); gg.translate(.5, -5.6); gg.rotate(-.06); gg.fillText('ДАЧА', 0, 0); gg.font = 'bold 1.5px Arial'; gg.fillText('ЛЕТО 2009', 0, 2.3); gg.restore();
          gg.fillStyle = 'rgba(255,255,255,.1)'; gg.fillRect(-18, -4, 36, 1.4);
          A.blotches(gg, -10, -8, 20, 8, 2, 3, 'rgba(70,45,10,.34)', 1.6, 3.2);
        }
      });
      g.fillStyle = '#1e3454'; g.beginPath(); g.ellipse(0, -10.8, 3.6, 1.3, 0, 0, TAU); g.fill(); g.fillStyle = '#16263f'; g.beginPath(); g.ellipse(0, -10.7, 2.5, .8, 0, 0, TAU); g.fill();
    },
    jeans(g) {
      contact(g, 0, 42, .55, .13);
      const leg = (pts, w, c, k) => tube(g, pts, w, c, { segs: [[0, .09, '#2a3c60', 1.02], [.9, 1, '#5a82b8', 1.02]], stripes: null });
      leg([[-12, -4.6], [-4, -4.3], [4, -3.4], [12, -4.6], [17, -3.4]], 7.6, '#33507f');
      const sp = tube(g, [[-13, -9.4], [-5, -9.8], [4, -8.8], [10, -7.6], [17, -8.8]], 7.4, '#3b5a8d', { segs: [[0, .09, '#2a3c60', 1.04], [.9, 1, '#6a90c6', 1.02]] });
      g.save(); g.lineCap = 'round';
      g.strokeStyle = 'rgba(180,210,255,.28)'; g.lineWidth = .5; g.setLineDash([.9, .7]); g.beginPath(); g.moveTo(sp[6][0], sp[6][1] + .4); for (let i = 7; i < sp.length - 4; i++) g.lineTo(sp[i][0], sp[i][1] + 1.3); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#1e2c4a'; g.fillRect(-13.8, -13.3, 4.4, 8.6); g.fillStyle = '#9a7a38'; g.beginPath(); g.arc(-11.5, -9, 1, 0, TAU); g.fill(); g.fillStyle = '#e0c060'; g.beginPath(); g.arc(-11.7, -9.2, .35, 0, TAU); g.fill();
      for (const [x, y] of [[-1.5, -10.6], [4.5, -9.4]]) { g.fillStyle = '#c89a4a'; g.beginPath(); g.arc(x, y, .55, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(210,225,255,.35)'; g.lineWidth = .9; g.beginPath(); g.moveTo(sp[18][0] - 1, sp[18][1] - 1.5); g.quadraticCurveTo(sp[18][0], sp[18][1], sp[22][0] + 1, sp[22][1] - 1.2); g.stroke();
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(-2, -8.4, 1.6, 1.2, 0, 0, TAU); g.fill(); creases(g, [-10, -13, 14, -3], 6, 8, { len: .25, dark: .35, light: .15 });
      g.restore();
    },
    towel(g) {
      contact(g, 0, 40, .55, .13);
      const pts = [-18, -1.6, -17.4, -5, -12, -8.8, -4, -11, 6, -10.6, 14, -8, 18.4, -4.2, 18.2, -1.2, 8, -.4, -4, -.8];
      fabric(g, blobPath(pts), [-19, -11.5, 19, 0], '#2f8a98', 9, {
        n: 11, pattern: gg => {
          for (const x of [-14, 12]) { gg.fillStyle = '#eef3ee'; gg.fillRect(x, -13, 2.2, 14); gg.fillStyle = '#d4a53a'; gg.fillRect(x + 2.9, -13, 1.1, 14); gg.fillRect(x - 1.8, -13, 1.1, 14); }
          gg.strokeStyle = 'rgba(0,0,0,.1)'; gg.lineWidth = .25; for (let y = -12; y < 0; y += .7) { gg.beginPath(); gg.moveTo(-19, y); gg.lineTo(19, y + .5); gg.stroke(); }
          A.blotches(gg, -18, -11, 36, 11, 6, 5, 'rgba(60,40,10,.3)', 2, 5);
        }
      });
      g.strokeStyle = '#e8ece6'; g.lineWidth = .35; for (let i = 0; i < 14; i++) { const y = -1.2 - i * .55; g.beginPath(); g.moveTo(18.2, y); g.lineTo(20 + (i % 3) * .3, y + (i % 2 ? .5 : -.4)); g.stroke(); }
    },
    hoodie(g) {
      contact(g, 0, 40, .55, .13);
      const pts = [-4.4, -11.8, -9.6, -10.8, -18.4, -6.8, -17, -2.2, -10.8, -4.4, -10, -.6, 10, -.6, 10.8, -4.6, 17, -2.4, 18.4, -6.8, 9.6, -10.8, 4.4, -11.8, 0, -10.6];
      fabric(g, blobPath([-6.6, -12.4, -4, -15.6, 1.4, -16, 5, -13.6, 4, -11, -3, -10]), [-7, -16, 5, -10], '#4a5c47', 21, { n: 4 });
      fabric(g, polyR(pts, 1.8), [-19, -15, 19, 0], '#566a52', 11, {
        n: 14, pattern: gg => {
          gg.fillStyle = 'rgba(0,0,0,.2)'; gg.beginPath(); gg.roundRect(-6.5, -6.6, 13, 5.2, 1.6); gg.fill(); gg.fillStyle = 'rgba(255,255,255,.06)'; gg.fillRect(-6.5, -6.6, 13, .5);
          gg.fillStyle = '#e8e6da'; gg.font = 'bold 2.6px Arial'; gg.textAlign = 'center'; gg.fillText('БАМБУЛЬ', .5, -3.4);
          A.blotches(gg, -12, -11, 24, 11, 4, 4, 'rgba(60,40,10,.3)', 2, 4);
        }
      });
      g.fillStyle = '#33402f'; g.beginPath(); g.ellipse(-.4, -11.6, 4, 1.5, 0, 0, TAU); g.fill(); g.fillStyle = '#1b231b'; g.beginPath(); g.ellipse(-.4, -11.5, 2.8, .9, 0, 0, TAU); g.fill();
      g.strokeStyle = '#e8e6da'; g.lineWidth = .45; g.lineCap = 'round'; g.beginPath(); g.moveTo(-2.2, -10.8); g.quadraticCurveTo(-3.2, -8.6, -2.6, -7); g.moveTo(1.4, -10.8); g.quadraticCurveTo(2.2, -8.6, 1.8, -7.4); g.stroke();
    },
    shirt(g) {
      contact(g, 0, 38, .55, .13);
      const pts = [-3.6, -11.6, -9, -10.4, -17, -6.6, -15.6, -2.4, -9.8, -4.4, -9.2, -.6, 9.2, -.6, 9.8, -4.6, 15.6, -2.4, 17, -6.8, 9, -10.4, 3.6, -11.6, 0, -10.2];
      fabric(g, polyR(pts, 1.5), [-17, -11.5, 17, 0], '#a63a32', 13, {
        n: 11, pattern: gg => {
          gg.fillStyle = 'rgba(20,10,10,.38)'; for (let x = -18; x < 18; x += 3.2) gg.fillRect(x, -13, 1.2, 14); for (let y = -12; y < 1; y += 3.2) gg.fillRect(-18, y, 36, 1.2);
          gg.fillStyle = 'rgba(240,230,200,.16)'; for (let x = -16.4; x < 18; x += 3.2) gg.fillRect(x, -13, .35, 14); for (let y = -10.4; y < 1; y += 3.2) gg.fillRect(-18, y, 36, .35);
          gg.fillStyle = 'rgba(0,0,0,.2)'; gg.fillRect(-.25, -12, .5, 12); A.blotches(gg, -12, -10, 24, 10, 7, 3, 'rgba(70,45,10,.3)', 1.4, 3);
        }
      });
      g.fillStyle = '#ece6d6'; g.beginPath(); g.moveTo(-3.7, -11.2); g.lineTo(0, -8.8); g.lineTo(3.7, -11.2); g.lineTo(2.6, -12.4); g.lineTo(0, -10.8); g.lineTo(-2.6, -12.4); g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = .3; g.stroke();
      g.fillStyle = '#ece6d6'; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, -7.6 + i * 2.6, .38, 0, TAU); g.fill(); }
    }
  };

  def('sock', { variants: ['sockBlue', 'sockRed', 'sockPair'], size: v => DEF.cloth.size(v), paint: (g, v, s, r) => CLOTH[v](g, r) });
  def('towel', { variants: ['towel'], size: v => DEF.cloth.size(v), paint: (g, v, s, r) => CLOTH[v](g, r) });

  /* ============================================================ BAG */
  function plasticBag(g, o) {
    const bw = o.bw, bu = o.bu, by = o.by, nw = o.nw, ny = o.ny, c = o.c || '#10141d';
    const L = [[-bw * .78, -.3], [-bu * .94, -by * .45], [-bu, -by], [-(bu + nw) * .5 * .9, -(by + ny) * .52], [-nw * 1.15, -ny * .93], [-nw, -ny]];
    const pts = []; L.forEach(p => pts.push(p[0], p[1])); for (let i = L.length - 1; i >= 0; i--) pts.push(-L[i][0], L[i][1]); pts.push(0, 0.5);
    const path = blobPath(pts);
    contact(g, 0, bu * 2.5, .6, .16);
    body(g, path, [-bu, -ny, bu, 0], c, {
      hi: .5, lo: .45, rim: .4, grain: .12, fn: gg => {
        const r = srand(o.seed || 5);
        gg.fillStyle = A.rg(gg, -bu * .45, -by * .75, 0, bu * 1.1, ['rgba(170,195,255,.5)', 'rgba(170,195,255,0)']); gg.fillRect(-bu - 1, -ny - 1, bu * 2 + 2, ny + 2);
        gg.fillStyle = A.lg(gg, -bu, 0, bu, 0, [[0, 'rgba(0,0,0,.35)'], [.18, 'rgba(120,150,220,.16)'], [.5, 'rgba(0,0,0,0)'], [.85, 'rgba(90,120,190,.22)'], [1, 'rgba(0,0,0,.45)']]); gg.fillRect(-bu - 1, -ny - 1, bu * 2 + 2, ny + 2);
        for (let i = 0; i < (o.lumps == null ? 5 : o.lumps); i++) { const x = (r() - .5) * bu * 1.5, y = -by * (.15 + r() * .8), rx = 2.5 + r() * 4, ry = 2 + r() * 4; gg.fillStyle = A.rg(gg, x - rx * .3, y - ry * .35, 0, Math.max(rx, ry), ['rgba(200,220,255,.34)', 'rgba(200,220,255,0)']); gg.beginPath(); gg.ellipse(x, y, rx, ry, 0, 0, TAU); gg.fill(); gg.strokeStyle = 'rgba(0,0,0,.28)'; gg.lineWidth = .5; gg.beginPath(); gg.ellipse(x + .5, y + .5, rx, ry, 0, .5, 3.3); gg.stroke(); }
        // stretch wrinkles converging at the neck
        gg.lineCap = 'round'; for (let i = 0; i < 8; i++) { const a = -bu * .9 + r() * bu * 1.8, y = -by * (.25 + r() * .75), tx = (r() - .5) * nw; gg.strokeStyle = 'rgba(190,210,255,' + (.12 + r() * .16) + ')'; gg.lineWidth = .35 + r() * .5; gg.beginPath(); gg.moveTo(a, y); gg.quadraticCurveTo((a + tx) * .55, y - (y + ny) * .3, tx, -ny); gg.stroke(); gg.strokeStyle = 'rgba(0,0,0,.35)'; gg.lineWidth = .4; gg.beginPath(); gg.moveTo(a + .5, y + .4); gg.quadraticCurveTo((a + tx) * .55 + .5, y - (y + ny) * .3 + .4, tx + .4, -ny + .3); gg.stroke(); }
        gg.fillStyle = 'rgba(210,225,255,.5)'; gg.beginPath(); gg.roundRect(-bu * .72, -by * .95, 1.4, by * .6, .7); gg.fill();
        gg.fillStyle = 'rgba(210,225,255,.25)'; gg.beginPath(); gg.roundRect(bu * .55, -by * .75, 1, by * .4, .5); gg.fill();
        if (o.items) o.items(gg, r);
      }
    });
  }
  function knotEars(g, y, sz, c, o) {
    c = c || '#1b2130'; o = o || {};
    for (const sgn of [-1, 1]) {
      g.save(); g.translate(sgn * sz * .35, y); g.rotate(sgn * (o.sp || .5));
      body(g, polyR([-sz * .45, 0, sz * .45, 0, sz * .62, -sz * 1.85, 0, -sz * 2.2, -sz * .3, -sz * 1.6], .5), [-sz * .6, -sz * 2.3, sz * .7, 0], c, { hi: .6, lo: .3, rim: .35, grain: .08, fn: gg => creases(gg, [-sz * .5, -sz * 2.2, sz * .6, 0], 3, 3, { len: .5, ang: -1.5, spread: .6 }) });
      g.restore();
    }
    body(g, blobPath([-sz * .75, y + sz * .2, -sz * .6, y - sz * .55, 0, y - sz * .8, sz * .62, y - sz * .5, sz * .78, y + sz * .15, 0, y + sz * .6]), [-sz, y - sz, sz, y + sz], c, { hi: .7, lo: .3, rim: .4, grain: .08, fn: gg => { creases(gg, [-sz, y - sz, sz, y + sz], 7, 4, { len: .6, dark: .35, light: .3, w: .45 }); gg.fillStyle = 'rgba(200,220,255,.4)'; gg.beginPath(); gg.ellipse(-sz * .25, y - sz * .35, sz * .25, sz * .13, -.4, 0, TAU); gg.fill(); } });
  }
  const BAGJUNK = (gg, r) => {                  // bumps of rubbish poking against the plastic
    gg.fillStyle = 'rgba(190,150,70,.2)'; gg.beginPath(); gg.ellipse(8, -8, 4, 5, .4, 0, TAU); gg.fill();
    gg.fillStyle = 'rgba(60,130,60,.2)'; gg.beginPath(); gg.ellipse(-8, -14, 3, 7, .3, 0, TAU); gg.fill();
  };
  def('bag', {
    states: ['full', 'half', 'empty', 'held'],
    size(v, s) { return { full: [40, 51], half: [36, 40], empty: [32, 32], held: [34, 58] }[s]; },
    hand(v, s) { return s === 'held' ? [0, -56] : s === 'full' ? [0, -48] : [0, -(s === 'half' ? 38 : 30)]; },
    paint(g, v, s) {
      if (s === 'full') { plasticBag(g, { bw: 11, bu: 17.5, by: 16, nw: 3.4, ny: 39, items: BAGJUNK, seed: 5 }); knotEars(g, -41, 3.2); }
      else if (s === 'held') {
        g.save(); g.rotate(.05);
        plasticBag(g, { bw: 8.5, bu: 13.5, by: 14, nw: 3.0, ny: 46, items: BAGJUNK, seed: 9, lumps: 4 }); knotEars(g, -49, 3.0, null, { sp: .65 });
        g.restore();
      }
      else if (s === 'half') {
        plasticBag(g, { bw: 12, bu: 16.5, by: 13, nw: 10, ny: 28, seed: 3, lumps: 4, items: BAGJUNK });
        // folded-over open mouth with rubbish peeking
        g.fillStyle = '#05070c'; g.beginPath(); g.ellipse(0, -28.5, 11.6, 3.2, 0, 0, TAU); g.fill();
        const rr = srand(4); const cols = ['#c9402c', '#e8d9a0', '#3f7a3a', '#cfcfd4', '#8a5a2a'];
        for (let i = 0; i < 7; i++) { g.fillStyle = cols[i % 5]; g.beginPath(); g.ellipse(-8 + i * 2.6 + rr(), -29.6 - rr() * 2.2, 1.6 + rr() * 1.6, 1.2 + rr(), rr() * 3, 0, TAU); g.fill(); }
        g.strokeStyle = '#2b3448'; g.lineWidth = 2.4; g.beginPath(); g.ellipse(0, -28.5, 11.8, 3.4, 0, .1, Math.PI - .1); g.stroke();
        g.strokeStyle = 'rgba(190,210,255,.45)'; g.lineWidth = .7; g.beginPath(); g.ellipse(0, -29.3, 11.3, 3.1, 0, Math.PI + .3, TAU - .2); g.stroke();
        creases(g, [-11, -32, 11, -27], 5, 6, { ang: 0, spread: .6, len: .2 });
      } else {
        plasticBag(g, { bw: 11, bu: 13.5, by: 6, nw: 9, ny: 22, seed: 8, lumps: 1, c: '#1b2130' });
        g.fillStyle = '#05070c'; g.beginPath(); g.moveTo(-9, -22); g.quadraticCurveTo(0, -17, 9, -22); g.quadraticCurveTo(0, -25, -9, -22); g.fill();
        g.strokeStyle = '#2b3448'; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(-9.4, -22); g.quadraticCurveTo(-14, -26, -12.5, -31); g.moveTo(9.4, -22); g.quadraticCurveTo(15, -24, 15.5, -28.5); g.stroke();
        g.strokeStyle = 'rgba(190,210,255,.4)'; g.lineWidth = .6; g.beginPath(); g.moveTo(-9.8, -22.3); g.quadraticCurveTo(-14.4, -26.3, -13, -30.8); g.stroke();
      }
    }
  });

  /* ============================================================ VACUUM */
  def('vacuum', {
    states: ['idle', 'on', 'snagged'],
    size(v, s) { return s === 'snagged' ? [94, 52] : [92, 31]; },
    hand(v, s) { return [-4, -28]; },
    paint(g, v, s) {
      const on = s === 'on', sn = s === 'snagged';
      contact(g, 0, 84, .6, .12);
      // cord on the floor (behind the body)
      if (sn) { tube(g, [[34, -13], [37, -20], [40, -34], [41, -44]], 1.3, '#15161a'); g.fillStyle = '#d33'; g.beginPath(); g.roundRect(39.2, -48, 3.6, 4.8, .6); g.fill(); g.fillStyle = '#ddd'; g.fillRect(40, -50, .5, 2); g.fillRect(41.6, -50, .5, 2); }
      else tube(g, [[33, -11], [38, -8], [37, -3.2], [30.5, -1.4], [37, -1]], 1.3, '#15161a');
      // hose + wand + floor head
      const hose = [[-12, -13.5], [-18, -15], [-24, -13], [-26.5, -8], [-25, -5], [-29, -4.8]];
      const sp = samplePath(hose, 40);
      strokePts(g, sp.map(p => [p[0] + .3, p[1] + .6]), 4.6, 'rgba(0,0,0,.4)');
      strokePts(g, sp, 4.3, '#3a3d43'); strokePts(g, sp, 4.3, 'rgba(0,0,0,.55)', [.55, 1.05]);
      strokePts(g, sp.map(p => [p[0] - .35, p[1] - .9]), 1.3, 'rgba(190,200,215,.55)', [.55, 1.05]);
      strokePts(g, sp.map(p => [p[0] - .5, p[1] - 1.2]), .5, 'rgba(255,255,255,.25)');
      // wand + head
      g.save(); g.translate(-30, -4.2); g.rotate(.16);
      g.fillStyle = A.lg(g, 0, -1, 0, 1, ['#e9edf1', '#7a8088']); g.fillRect(-4.6, -1, 6, 2); 
      body(g, rrP(-15, -2, 11.2, 4.4, 1.8), [-15, -2, -3.8, 2.4], '#27292d', { hi: .6, lo: .4, rim: .5, fn: gg => { gg.fillStyle = '#9ea4ac'; gg.fillRect(-14.6, 1.3, 10.4, .9); gg.fillStyle = 'rgba(255,255,255,.18)'; gg.fillRect(-14.2, -1.6, 9.6, .6); for (let x = -14; x < -4.5; x += 1.2) { gg.fillStyle = 'rgba(0,0,0,.4)'; gg.fillRect(x, 1.4, .3, .8); } } });
      g.restore();
      // body
      g.save(); if (sn) { g.translate(22, -1); g.rotate(-.1); g.translate(-22, 1); }
      // wheels
      const wheel = (x, y, r) => { g.fillStyle = A.rg(g, x - r * .2, y - r * .2, 0, r, ['#444', '#16171a']); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = .5; g.beginPath(); g.arc(x, y, r * .9, .3, 2.5); g.stroke(); g.fillStyle = A.lg(g, x - r * .5, y - r * .5, x + r * .5, y + r * .5, ['#d0d4d8', '#6a6e74']); g.beginPath(); g.arc(x, y, r * .45, 0, TAU); g.fill(); g.fillStyle = '#2a2c30'; g.beginPath(); g.arc(x, y, r * .12, 0, TAU); g.fill(); };
      wheel(-4, -2.2, 2.2); wheel(24, -6.4, 6.4); 
      body(g, rrP(-12, -26, 46, 20, 9), [-12, -26, 34, -6], '#a3282a', {
        hi: .5, lo: .5, rim: .4, fn: gg => {
          gg.fillStyle = A.lg(gg, 0, -26, 0, -6, ['#d04a3c', '#a82a2a', '#6a1618']); gg.fillRect(-13, -27, 48, 22);
          gg.fillStyle = '#2f3237'; gg.fillRect(-13, -17.4, 48, 1.1); gg.fillStyle = 'rgba(255,255,255,.2)'; gg.fillRect(-13, -26, 48, 1);
          gg.fillStyle = 'rgba(255,255,255,.55)'; gg.beginPath(); gg.roundRect(-4, -24.6, 24, 1.6, .8); gg.fill();
          gg.fillStyle = '#e8e4d8'; gg.font = 'bold 2.4px Arial'; gg.textAlign = 'left'; gg.textBaseline = 'middle'; gg.fillText('БАМБУЛЬ 2000', 1, -12); gg.fillStyle = 'rgba(0,0,0,.4)'; gg.fillRect(-13, -9.6, 48, .5);
          A.blotches(gg, -12, -26, 46, 20, 5, 5, 'rgba(40,30,10,.3)', 1.5, 4); dots(gg, [-12, -26, 34, -6], 3, 40, 'rgba(60,50,30,.5)', .35);
        }
      });
      // chrome inlet ring + lid knob + switch
      body(g, rrP(-14.4, -17.6, 4, 8.4, 1.2), [-14.4, -17.6, -10.4, -9.2], '#9aa0a8', { hi: .8, lo: .5, grain: .05, fn: gg => { gg.fillStyle = A.lg(gg, 0, -17.6, 0, -9.2, ['#f4f6f8', '#8a9098', '#d0d4d8']); gg.fillRect(-15, -18, 6, 10); } });
      body(g, rrP(10, -29.2, 11, 3.8, 1.6), [10, -29.2, 21, -25.4], '#1e1f23', { hi: .8, lo: .3, grain: .05 });
      g.fillStyle = on ? '#6bff7a' : '#4a5a4a'; g.beginPath(); g.arc(27.5, -22, 1.1, 0, TAU); g.fill();
      if (on) { g.fillStyle = A.rg(g, 27.5, -22, 0, 6, ['rgba(110,255,130,.6)', 'rgba(110,255,130,0)']); g.fillRect(20, -29, 15, 15); }
      g.fillStyle = '#d6d2c6'; g.beginPath(); g.arc(28.5, -9.4, 1.1, 0, TAU); g.fill();
      g.restore();
      if (on) {
        g.save(); g.lineCap = 'round'; for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(255,255,255,' + (.35 - i * .05) + ')'; g.lineWidth = .35; g.beginPath(); g.moveTo(-46 + i * 1.5, -8 + i * 1.7 - 6 * (i % 2)); g.lineTo(-37 + i, -3.2 - (i % 3) * .3); g.stroke(); }
        dots(g, [-46, -10, -38, -2], 9, 14, 'rgba(210,200,180,.7)', .3); g.restore();
        g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = .4; for (const dx of [-1.2, 1.2]) { g.beginPath(); g.moveTo(-12 + dx, -27.5); g.lineTo(34 + dx, -27.5); g.stroke(); }
      }
      if (sn) {
        g.fillStyle = '#e7b200'; g.beginPath(); g.moveTo(-12, -36); g.lineTo(-4, -49); g.lineTo(4, -36); g.closePath(); g.fill(); g.strokeStyle = '#2a2000'; g.lineWidth = .7; g.lineJoin = 'round'; g.stroke();
        g.fillStyle = '#2a2000'; g.font = 'bold 8px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', -4, -40.4);
      }
    }
  });

  /* ============================================================ MOP & BUCKET */
  function mopHead(g, wet, ang) {
    // strands (drawn first = behind), handle, clamp
    const r = srand(77), c = wet ? '#9a9482' : '#d8d2c2';
    for (let i = 0; i < 46; i++) {
      const t = i / 45 * 2 - 1, x0 = t * 4, x1 = t * 12.5 + (r() - .5) * 3, yE = -.4 - r() * 1.4, len = 5 + r() * 2;
      g.strokeStyle = A.mix(css(c), css('#5a5444'), r() * (wet ? .55 : .35)); g.lineWidth = .62 + r() * .3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x0, -9.5); g.bezierCurveTo(x0 + t * 3, -9.5 + len * .4, x1 - t * 2, -len * .6, x1, yE); g.stroke();
    }
    g.fillStyle = A.rg(g, 0, -3, 0, 14, ['rgba(255,255,255,.12)', 'rgba(255,255,255,0)']); g.fillRect(-15, -10, 30, 10);
    if (wet) { g.fillStyle = 'rgba(60,70,80,.55)'; g.beginPath(); g.ellipse(0, -.25, 16, 1.2, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(190,225,245,.7)'; g.beginPath(); g.ellipse(-11, 1.2, .7, 1, 0, 0, TAU); g.ellipse(9, 1.1, .6, .9, 0, 0, TAU); g.fill(); }
    body(g, rrP(-6.2, -13, 12.4, 4.4, 1.3), [-6.2, -13, 6.2, -8.6], '#6e747c', { hi: .5, lo: .45, rim: .4, grain: .1, fn: gg => { gg.fillStyle = '#e0a418'; gg.fillRect(-6.4, -11.2, 12.8, 1.1); gg.fillStyle = 'rgba(0,0,0,.25)'; gg.fillRect(-6.4, -9.2, 12.8, .6); } });
    g.fillStyle = A.lg(g, -1.4, 0, 1.4, 0, ['#8a6a14', '#f1c837', '#c19a1c', '#6a4e0a']); g.fillRect(-1.2, -ang, 2.4, ang - 12.6);
    g.fillStyle = '#2a64b8'; g.beginPath(); g.roundRect(-1.6, -ang - 2, 3.2, 9, 1.4); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(-.9, -ang - 1.4, .5, 7.6);
    g.fillStyle = '#1b2a44'; g.beginPath(); g.arc(0, -ang + 1.5, .5, 0, TAU); g.fill();
  }
  def('mop', {
    states: ['dry', 'wet'],
    size() { return [34, 132]; },
    hand(v, s) { return [4.5, -75]; },
    paint(g, v, s) { contact(g, 0, 32, .5, .13); g.save(); g.rotate(.07); mopHead(g, s === 'wet', 126); g.restore(); }
  });

  function bucketBody(g, water) {
    const W0 = 10.5, W1 = 14.2, H = 27.5, TOPY = -H, ry = 3.9;
    contact(g, 0, 34, .6, .15);
    // body (tapered, lit cylinder)
    const path = pathOf([-W0, 0, W0, 0, W1, TOPY, -W1, TOPY]);
    body(g, path, [-W1, TOPY, W1, 0], '#e3b81c', {
      hi: .2, lo: .4, rim: .35, fn: gg => {
        gg.fillStyle = cylH(gg, -W1, W1, '#e3b81c', -.05); gg.fillRect(-W1 - 1, TOPY, W1 * 2 + 2, H + 1);
        gg.fillStyle = 'rgba(0,0,0,.18)'; for (const y of [-6, -14, -22]) gg.fillRect(-W1, y, W1 * 2, .8); gg.fillStyle = 'rgba(255,255,255,.18)'; for (const y of [-6, -14, -22]) gg.fillRect(-W1, y + .8, W1 * 2, .45);
        gg.fillStyle = '#2d62b2'; gg.fillRect(-W1, -17.4, W1 * 2, 6.4); gg.fillStyle = A.lg(gg, -W1, 0, W1, 0, [[0, 'rgba(0,0,0,.45)'], [.25, 'rgba(255,255,255,.3)'], [.6, 'rgba(0,0,0,.05)'], [1, 'rgba(0,0,0,.45)']]); gg.fillRect(-W1, -17.4, W1 * 2, 6.4);
        gg.fillStyle = '#f3f0e2'; gg.font = 'bold 3.3px Arial'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('ВЕДРО', 0, -14.2);
        gg.fillStyle = 'rgba(0,0,0,.35)'; for (const sc of ['a', 'b']) { } 
        grime(gg, [-W1, -H, W1, 0], 9, .35); gg.fillStyle = 'rgba(60,50,30,.3)'; gg.fillRect(-W0, -2.6, W0 * 2, 2.6);
        gg.fillStyle = A.lg(gg, 0, TOPY, 0, 0, ['rgba(255,255,255,.18)', 'rgba(0,0,0,0)', 'rgba(0,0,0,.28)']); gg.fillRect(-W1, TOPY, W1 * 2, H);
      }
    });
    // rim: back wall interior, water surface, front rim
    g.fillStyle = '#2a2208'; g.beginPath(); g.ellipse(0, TOPY, W1 + .3, ry, 0, 0, TAU); g.fill();
    g.fillStyle = A.lg(g, -W1, 0, W1, 0, ['#8a6c0c', '#f3d24a', '#b9930f']); g.beginPath(); g.ellipse(0, TOPY, W1 + .5, ry + .3, 0, 0, TAU); g.ellipse(0, TOPY, W1 - .9, ry - .75, 0, 0, TAU, true); g.fill('evenodd');
    if (water) {
      const wy = TOPY + 1.6;
      g.save(); g.beginPath(); g.ellipse(0, TOPY, W1 - .9, ry - .75, 0, 0, TAU); g.clip();
      g.fillStyle = A.lg(g, 0, wy - 3, 0, wy + 3, water); g.fillRect(-W1, wy - 3, W1 * 2, 7);
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-4.5, wy - .3, 4.8, .8, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(240,235,215,.5)'; for (const [x, y, r] of [[5.4, wy + .4, .9], [7.4, wy + 1, .7], [3.4, wy + 1.2, .6], [-8, wy + .8, .7]]) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
      g.restore();
    } else { g.fillStyle = '#17120a'; g.beginPath(); g.ellipse(0, TOPY, W1 - .9, ry - .75, 0, 0, TAU); g.fill(); }
    // wire handle (lying folded to the left)
    g.save(); g.strokeStyle = '#8c9298'; g.lineWidth = .8; g.lineCap = 'round'; g.beginPath(); g.moveTo(-W1 - .2, TOPY - .5); g.bezierCurveTo(-W1 - 5, TOPY - 8, -W1 - 8, TOPY - 2, -W1 - 3.5, TOPY + 1.2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = .3; g.beginPath(); g.moveTo(-W1 - .2, TOPY - .9); g.bezierCurveTo(-W1 - 5, TOPY - 8.4, -W1 - 8, TOPY - 2.4, -W1 - 3.5, TOPY + .8); g.stroke(); g.restore();
    g.fillStyle = '#6a6f74'; g.beginPath(); g.arc(-W1 - .3, TOPY - .4, 1, 0, TAU); g.fill();
    // water slosh drop on the side
    if (water) { g.fillStyle = 'rgba(70,60,40,.45)'; g.beginPath(); g.moveTo(6, TOPY + 3); g.quadraticCurveTo(6.8, -18, 6.1, -12); g.lineTo(5.2, -12); g.quadraticCurveTo(5, -18, 5.4, TOPY + 3); g.fill(); }
  }
  def('bucket', {
    states: ['dirty', 'clean', 'empty', 'mop'],
    size(v, s) { return s === 'mop' ? [50, 128] : [38, 34]; },
    hand() { return [-17, -29]; },
    paint(g, v, s) {
      const water = s === 'dirty' || s === 'mop' ? ['#7a6f50', '#4e4630'] : s === 'clean' ? ['#8cc6dc', '#4f8fae'] : null;
      bucketBody(g, water);
      if (s === 'mop') { g.save(); g.beginPath(); g.rect(-60, -200, 120, 174); g.clip(); g.translate(1, -22); g.rotate(.13); mopHead(g, true, 104); g.restore(); }
    }
  });

  /* ============================================================ TOOLBOX */
  def('toolbox', {
    states: ['closed', 'open'],
    size(v, s) { return s === 'open' ? [52, 44] : [50, 26]; },
    hand() { return [0, -28]; },
    paint(g, v, s) {
      const open = s === 'open', W = 23, H = 17;
      contact(g, 0, 56, .6, .14);
      const RED = '#b3241c';
      if (open) {
        // lid raised behind
        g.save(); body(g, rrP(-W, -H - 24, W * 2, 21, 2), [-W, -H - 24, W, -H - 3], '#8c1a14', {
          hi: .35, lo: .45, fn: gg => { gg.fillStyle = A.lg(gg, 0, -H - 24, 0, -H - 3, ['#c3362a', '#8c1a14', '#5a0e0a']); gg.fillRect(-W, -H - 24, W * 2, 21); gg.fillStyle = 'rgba(0,0,0,.3)'; gg.fillRect(-W + 2, -H - 21, W * 2 - 4, 15); gg.fillStyle = 'rgba(255,255,255,.12)'; gg.fillRect(-W + 2, -H - 21, W * 2 - 4, .8); gg.fillStyle = '#d8d4c8'; gg.font = 'bold 2.6px Arial'; gg.textAlign = 'center'; gg.fillText('ИНСТРУМЕНТ', 0, -H - 13); } }); g.restore();
        // box tub: back, inner tray, front
        body(g, rrP(-W, -H - 2, W * 2, H + 2, 2), [-W, -H - 2, W, 0], RED, { hi: .3, lo: .5, fn: gg => { gg.fillStyle = '#2a0e0a'; gg.fillRect(-W + 1, -H - 1, W * 2 - 2, 8); } });
        const tray = pathOf([-W + 2, -H, W - 2, -H, W - 3, -H + 9, -W + 3, -H + 9]);
        body(g, tray, [-W, -H, W, -H + 9], '#3a3f46', { fn: gg => { gg.fillStyle = 'rgba(0,0,0,.35)'; gg.fillRect(-4, -H, .8, 9); gg.fillRect(8, -H, .8, 9); } });
        // tools lying in tray
        g.save(); g.translate(-12, -H + 4); g.rotate(-.12); g.fillStyle = A.lg(g, 0, -1, 0, 1.2, ['#e8ecf0', '#6e747c']); g.fillRect(-7, -1, 14, 2); g.beginPath(); g.arc(-7, 0, 2.2, 0, TAU); g.arc(7, 0, 1.8, 0, TAU); g.fill(); g.restore();
        g.fillStyle = '#e9a21a'; g.beginPath(); g.roundRect(-3, -H + 2.4, 7, 2.6, 1.2); g.fill(); g.fillStyle = '#b9440a'; g.beginPath(); g.roundRect(5, -H + 2.4, 6, 2.6, 1.2); g.fill();
        g.fillStyle = '#c9ccd0'; for (const [x, y] of [[13, -H + 3], [15, -H + 5], [12, -H + 6]]) { g.beginPath(); g.arc(x, y, .9, 0, TAU); g.fill(); g.fillStyle = '#6a6e74'; g.beginPath(); g.arc(x, y, .35, 0, TAU); g.fill(); g.fillStyle = '#c9ccd0'; }
        g.fillStyle = '#f0d21a'; g.beginPath(); g.ellipse(-2, -H + 7.4, 3.2, 1.2, 0, 0, TAU); g.fill(); g.fillStyle = '#7a6a0a'; g.beginPath(); g.ellipse(-2, -H + 7.5, 1.5, .5, 0, 0, TAU); g.fill();
        // front panel
        body(g, rrP(-W, -H + 8, W * 2, H - 8, 1.6), [-W, -H + 8, W, 0], RED, { hi: .35, lo: .45, fn: gg => { gg.fillStyle = 'rgba(0,0,0,.2)'; gg.fillRect(-W, -3.6, W * 2, .8); grime(gg, [-W, -H + 8, W, 0], 5, .8); creases(gg, [-W, -H + 8, W, 0], 7, 3, { ang: .3, len: .2, dark: .3, light: .35, w: .35 }); gg.fillStyle = 'rgba(255,255,255,.13)'; gg.fillRect(-W, -H + 8.6, W * 2, .7); gg.fillStyle = 'rgba(80,30,5,.5)'; gg.beginPath(); gg.ellipse(-17, -4, 1.8, .9, 0, 0, TAU); gg.fill(); } });
        g.fillStyle = A.lg(g, 0, -H + 12, 0, -H + 17, ['#e8ecf0', '#8c9298']); g.beginPath(); g.roundRect(-14, -H + 11, 4, 4.6, .8); g.roundRect(10, -H + 11, 4, 4.6, .8); g.fill();
      } else {
        body(g, rrP(-W, -H, W * 2, H, 2.2), [-W, -H, W, 0], RED, {
          hi: .4, lo: .5, fn: gg => {
            gg.fillStyle = A.lg(gg, 0, -H, 0, 0, ['#d1493a', '#b3241c', '#6e100c']); gg.fillRect(-W, -H, W * 2, H);
            gg.fillStyle = 'rgba(0,0,0,.35)'; gg.fillRect(-W, -9.2, W * 2, .9); gg.fillStyle = 'rgba(255,255,255,.18)'; gg.fillRect(-W, -8.3, W * 2, .5);
            gg.fillStyle = 'rgba(0,0,0,.2)'; for (const x of [-12, 12]) { gg.fillRect(x - 6, -7.4, 12, .7); gg.fillRect(x - 6, -3.4, 12, .7); gg.fillStyle = 'rgba(255,255,255,.1)'; gg.fillRect(x - 6, -6.7, 12, .4); gg.fillStyle = 'rgba(0,0,0,.2)'; }
            gg.fillStyle = A.lg(gg, -W, 0, W, 0, [[0, 'rgba(0,0,0,.35)'], [.1, 'rgba(255,255,255,.12)'], [.9, 'rgba(0,0,0,.05)'], [1, 'rgba(0,0,0,.4)']]); gg.fillRect(-W, -H, W * 2, H);
            gg.fillStyle = '#f0e4c0'; gg.fillRect(5, -15, 8, 4.2); gg.fillStyle = '#1b1b1b'; gg.font = 'bold 2.2px Arial'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('МОЁ', 9, -12.9);
            grime(gg, [-W, -H, W, 0], 11, 1); creases(gg, [-W, -H, W, 0], 3, 5, { ang: .4, len: .25, dark: .4, light: .4, w: .35 });
            gg.fillStyle = 'rgba(120,60,20,.5)'; gg.beginPath(); gg.ellipse(-18, -5, 2.4, 1.2, .3, 0, TAU); gg.fill(); gg.beginPath(); gg.ellipse(15.5, -1.6, 2.8, .9, 0, 0, TAU); gg.fill();
          }
        });
        g.fillStyle = A.lg(g, 0, -11.4, 0, -6.8, ['#f0f2f4', '#868c94']); for (const x of [-15.4, 11.2]) { g.beginPath(); g.roundRect(x, -10.6, 4.2, 5, .8); g.fill(); g.fillStyle = '#4a4e54'; g.fillRect(x + 1.4, -9.2, 1.4, 2.2); g.fillStyle = A.lg(g, 0, -11.4, 0, -6.8, ['#f0f2f4', '#868c94']); }
        // handle
        g.strokeStyle = '#3a3c40'; g.lineWidth = 2.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(-9, -H); g.quadraticCurveTo(-9, -H - 6.6, -6, -H - 6.8); g.lineTo(6, -H - 6.8); g.quadraticCurveTo(9, -H - 6.6, 9, -H); g.stroke();
        g.strokeStyle = '#1b1c20'; g.lineWidth = 2.1; g.beginPath(); g.moveTo(-5, -H - 6.8); g.lineTo(5, -H - 6.8); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = .35; g.beginPath(); g.moveTo(-5, -H - 7.4); g.lineTo(5, -H - 7.4); g.stroke();
        for (const x of [-9, 9]) { g.fillStyle = '#7a8088'; g.beginPath(); g.roundRect(x - 1.6, -H - .6, 3.2, 1.6, .5); g.fill(); }
      }
    }
  });

  /* ============================================================ HANDSET */
  def('handset', {
    states: ['lying', 'hanging'],
    size(v, s) { return s === 'hanging' ? [16, 58] : [34, 16]; },
    hand(v, s) { return s === 'hanging' ? [0, -56] : [0, -6]; },
    paint(g, v, s) {
      const cream = '#d9ccaa';
      const unit = () => {
        const path = gg => { gg.moveTo(-12, -6.1); gg.quadraticCurveTo(-13.4, -6.1, -13.4, -3.6); gg.lineTo(-13.4, -2); gg.quadraticCurveTo(-13.4, 0, -11.4, 0); gg.lineTo(-9, 0); gg.quadraticCurveTo(-7.4, 0, -7, -1.7); gg.lineTo(-6.5, -2.6); gg.lineTo(6.5, -2.6); gg.lineTo(7, -1.7); gg.quadraticCurveTo(7.4, 0, 9, 0); gg.lineTo(11.4, 0); gg.quadraticCurveTo(13.4, 0, 13.4, -2); gg.lineTo(13.4, -3.6); gg.quadraticCurveTo(13.4, -6.1, 12, -6.1); gg.lineTo(8.6, -6.1); gg.quadraticCurveTo(7.2, -6.1, 6.6, -4.8); gg.lineTo(6, -4.2); gg.lineTo(-6, -4.2); gg.lineTo(-6.6, -4.8); gg.quadraticCurveTo(-7.2, -6.1, -8.6, -6.1); gg.closePath(); };
        body(g, path, [-13.4, -6.1, 13.4, 0], cream, {
          hi: .35, lo: .45, rim: .35, grain: .12, fn: gg => {
            gg.fillStyle = A.lg(gg, 0, -6.1, 0, 0, ['#f1e8c8', '#d4c7a4', '#9c8e6a']); gg.fillRect(-14, -7, 28, 8);
            gg.fillStyle = 'rgba(40,30,15,.6)'; for (const sx of [-10.2, 10.2]) for (let i = 0; i < 7; i++) { gg.beginPath(); gg.arc(sx + (i % 3 - 1) * 1.1, -4.4 + ((i / 3) | 0) * 1.2, .26, 0, TAU); gg.fill(); }
            gg.fillStyle = 'rgba(255,255,255,.55)'; gg.beginPath(); gg.roundRect(-5.4, -3.6, 10.8, .55, .27); gg.fill();
            grime(gg, [-13.4, -6.1, 13.4, 0], 14, .9);
          }
        });
      };
      if (s === 'hanging') {
        const coil = []; for (let i = 0; i < 80; i++) { const u = i / 79, ph = u * TAU * 9; coil.push([Math.sin(u * 2.4) * 1.5 + Math.sin(ph) * 1.6, -27 - u * 29 + Math.cos(ph) * .6]); }
        strokePts(g, coil.map(p => [p[0] + .35, p[1]]), 1.0, 'rgba(0,0,0,.35)'); strokePts(g, coil, .85, '#1c1a16'); strokePts(g, coil.map(p => [p[0] - .2, p[1] - .1]), .3, 'rgba(255,255,255,.35)');
        g.save(); g.translate(0, -13.4); g.rotate(-Math.PI / 2 + .04); unit(); g.restore();
      } else {
        contact(g, 0, 30, .5, .13);
        unit();
        // coiled cord curling away
        const pts = []; for (let i = 0; i <= 90; i++) { const u = i / 90; pts.push([13 + u * 14 + Math.sin(u * 7) * 3, -2 - Math.abs(Math.sin(u * 3.1)) * 3 + (i % 2 ? .5 : 0)]); }
        const coil = []; for (let i = 0; i < 52; i++) { const u = i / 51, ph = u * TAU * 7; coil.push([13.4 + u * 15 + Math.cos(ph) * .6, -2 + Math.sin(ph) * 1.6 + Math.sin(u * 3) * -1.5]); }
        strokePts(g, coil.map(p => [p[0], p[1] + .4]), 1.0, 'rgba(0,0,0,.4)'); strokePts(g, coil, .85, '#1c1a16'); strokePts(g, coil.map(p => [p[0] - .1, p[1] - .22]), .3, 'rgba(255,255,255,.35)');
      }
    }
  });
})();
