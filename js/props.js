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
  /* grime: smudges + specks inside current clip */
  function grime(g, bb, seed, a) {
    const [x0, y0, x1, y1] = bb, w = x1 - x0, h = y1 - y0; a = a == null ? 1 : a;
    A.blotches(g, x0, y0, w, h, seed, Math.max(2, Math.round(w * h / 40)), 'rgba(50,38,20,' + (.16 * a) + ')', 1.5, Math.max(3, Math.min(w, h) * .5));
    A.specks(g, x0, y0, w, h, seed + 1, Math.round(w * h / 5), 'rgba(30,22,12,' + (.35 * a) + ')', .8);
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
    return sp;
  }
  /* glass highlight streak */
  const glint = (g, x, y, w, h, a) => { g.fillStyle = 'rgba(255,255,255,' + (a || .5) + ')'; g.beginPath(); g.roundRect(x, y, w, h, w / 2); g.fill(); };
  /* fabric blob with folds */
  function fabric(g, path, bb, c, seed, o) {
    o = o || {};
    body(g, path, bb, c, { hi: .25, lo: .4, rim: .34, grain: .22, fn: gg => { if (o.pattern) o.pattern(gg); creases(gg, bb, seed, o.n || 9, { dark: .3, light: .14, len: .5, w: .9 }); A.blotches(gg, bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1], seed + 3, 6, 'rgba(20,12,6,.14)', 2, 7); } });
  }

  /* ============================================================ registry */
  const DEF = {};
  PR.defs = DEF;
  function def(kind, o) { DEF[kind] = o; o.kind = kind; return o; }
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
        gg.fillStyle = tone.logo; gg.beginPath(); gg.arc(-len * .05, 0, rad * .62, 0, TAU); gg.fill();
        gg.fillStyle = tone.text; gg.font = 'bold ' + (rad * .62) + 'px Arial, sans-serif'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText(tone.label || 'ПИВО', -len * .05, rad * .04);
        gg.fillStyle = 'rgba(0,0,0,.18)'; gg.fillRect(-len * .5, -rad, len * .13, rad * 2); gg.fillStyle = 'rgba(255,255,255,.55)'; gg.fillRect(-len * .5, -rad, len * .035, rad * 2);
        gg.fillStyle = 'rgba(255,255,255,.4)'; gg.fillRect(len * .44, -rad, len * .06, rad * 2);
        sheenV(gg, -rad, rad, .6, .55);
        if (dent > 0) { creases(gg, [dx - len * .22, -rad, dx + len * .22, rad], seed, 9, { ang: 1.2, spread: 1.6, len: .6, dark: .38, light: .3, w: .55 }); gg.fillStyle = 'rgba(0,0,0,.18)'; gg.fillRect(dx - len * .12, -rad, len * .24, rad * 2); }
        A.specks(gg, -len / 2, -rad, len, rad * 2, seed, 10, 'rgba(40,25,10,.45)', .6);
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
    energy: { base: '#222', band: '#17181c', band2: '#9dff3c', logo: '#9dff3c', text: '#101010', label: '' }
  };

  def('trash', {
    variants: ['canCrushed', 'bottle', 'pizzaBox', 'chipBag', 'paperBalls', 'cup', 'cigPack', 'noodleCup', 'wrappers', 'banana', 'newspaper', 'rag', 'jar', 'sludge', 'canPair', 'energy', 'tin'],
    size(v) { return { canCrushed: [14, 7.5], bottle: [28, 8], pizzaBox: [38, 14], chipBag: [21, 25], paperBalls: [19, 11], cup: [23, 9], cigPack: [16, 12], noodleCup: [16, 22], wrappers: [20, 8], banana: [24, 9], newspaper: [34, 14], rag: [22, 9], jar: [11, 17], sludge: [22, 11], canPair: [22, 13], energy: [17, 7.5], tin: [16, 10] }[v]; },
    paint(g, v, s, r, cw, ch) { TRASH[v](g, r); }
  });
  const TRASH = {
    canCrushed(g, r) { g.save(); g.rotate(-.06); canLying(g, 12.5, 3.35, .42, 1, TONE.blue, 3); g.restore(); },
    energy(g) { canLying(g, 15, 2.9, .3, -2, TONE.energy, 7); g.fillStyle = '#9dff3c'; g.fillRect(-4, -7, 1.2, 3.5); },
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
          gg.fillStyle = 'rgba(0,0,0,.22)'; gg.fillRect(-9, 2.2, 9.5, 1.3); A.specks(gg, -9, -3.5, 9.5, 7, 4, 12, 'rgba(60,50,30,.5)', .5);
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
          A.specks(gg, -6, -10, 12, 10, 8, 40, 'rgba(60,50,40,.28)', .4); A.blotches(gg, -6, -10, 12, 5, 4, 4, 'rgba(110,50,10,.35)', 1, 2);
        }
      });
      // peeled foil lid
      g.fillStyle = A.lg(g, -6, 0, 6, 0, ['#9aa0a8', '#eef0f2', '#8a9098']); g.beginPath(); g.moveTo(-6.6, -10.2); g.lineTo(6.6, -10.2); g.lineTo(7.6, -11.4); g.lineTo(-7.6, -11.4); g.fill();
      g.fillStyle = A.lg(g, 0, -17, 0, -10, ['#e8eaee', '#a0a6ae']); g.beginPath(); g.moveTo(-6.2, -11.2); g.quadraticCurveTo(-8.4, -15.5, -2.6, -17); g.quadraticCurveTo(0, -14, 2, -11.2); g.fill(); creases(g, [-7, -17, 2, -11], 5, 4, { len: .4, dark: .25 });
      // noodles
      g.strokeStyle = '#e8c45a'; g.lineWidth = .75; g.lineCap = 'round';
      for (const [x, d] of [[-2.6, 4.2], [-.8, 6], [1.8, 3.2], [3.6, 5]]) { g.beginPath(); g.moveTo(x, -11.4); g.bezierCurveTo(x + 1.5, -11.4 + d * .4, x - 2, -11.4 + d * .6, x + .8, -11.4 + d); g.stroke(); }
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
      const petal = (pts, c) => { fabric(g, blobPath(pts), [Math.min(...pts.filter((_, i) => i % 2 === 0)), -9, Math.max(...pts.filter((_, i) => i % 2 === 0)), 0], c, pts[0] * 7 + 3, { n: 3 }); };
      // inner cream sides
      petal([0, -2.6, -5, -2.2, -11.4, -.7, -9.5, -.3, -4, -.9], '#efe2a2');
      petal([0, -2.6, 5, -2.4, 11.8, -1.3, 10, -.3, 4, -1], '#efe2a2');
      petal([0, -2.8, -2, -4, -3, -7.6, 1, -8.2, 3, -4.4], '#e8d78c');
      // yellow outside overlay
      petal([-.4, -3.2, -4.8, -3.0, -10.8, -1.2, -9.4, -.45, -4.3, -1.6], '#e2b92a');
      petal([.4, -3.2, 5, -3.1, 11.2, -1.8, 9.8, -.5, 4.6, -1.7], '#d9ae22');
      petal([0, -3.4, -1.4, -4.6, -2, -7.4, .8, -7.8, 2.2, -4.9], '#e9c437');
      g.fillStyle = '#4a3416'; g.beginPath(); g.ellipse(0, -3.2, 1.5, 1.1, 0, 0, TAU); g.fill();
      A.specks(g, -10, -8, 20, 8, 6, 36, 'rgba(70,40,10,.6)', .5);
      g.strokeStyle = 'rgba(90,55,15,.5)'; g.lineWidth = .4; g.beginPath(); g.moveTo(-9, -.8); g.quadraticCurveTo(-5, -2.4, -1, -3); g.moveTo(9, -.9); g.quadraticCurveTo(5, -2.4, 1, -3); g.stroke();
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
      fabric(g, blobPath(pts), [-11, -8.5, 11, 0], '#7d7a70', 41, { n: 14, pattern: gg => { gg.fillStyle = 'rgba(0,0,0,.16)'; for (let y = -9; y < 0; y += 1.1) gg.fillRect(-12, y, 24, .35); gg.fillStyle = 'rgba(190,170,40,.35)'; gg.fillRect(-12, -6.3, 24, 1.4); } });
      g.save(); g.beginPath(); blobPath(pts)(g); g.clip(); A.blotches(g, -11, -9, 22, 9, 3, 7, 'rgba(30,20,6,.35)', 1.5, 5); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.beginPath(); g.ellipse(-2.6, -3.4, 1.3, .9, .3, 0, TAU); g.fill(); g.beginPath(); g.ellipse(5.2, -2.6, .8, .6, 0, 0, TAU); g.fill(); g.restore();
      g.strokeStyle = '#7d7a70'; g.lineWidth = .35; for (const [x, y, a] of [[10.2, -2.2, .2], [10, -1.2, .6], [-9.6, -1.8, 2.9]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 2.4, y + Math.sin(a) * 1.6); g.stroke(); }
    },
    jar(g) {
      contact(g, 0, 12, .55, .16);
      const path = rrP(-4.6, -13.2, 9.2, 13.2, 1.2);
      g.save(); g.beginPath(); path(g); g.clip();
      g.fillStyle = A.lg(g, -4.6, 0, 4.6, 0, ['#5a6a58', '#b6c7b0', '#8fa38b', '#4a5848']); g.fillRect(-5, -14, 10, 14);
      g.fillStyle = A.lg(g, 0, -9.4, 0, 0, ['#6b6a22', '#4a4614', '#2b2a0c']); g.fillRect(-5, -9.4, 10, 9.4);       // murky brine
      g.fillStyle = A.lg(g, -4.6, 0, 4.6, 0, ['rgba(0,0,0,.45)', 'rgba(255,255,255,.18)', 'rgba(0,0,0,.05)', 'rgba(0,0,0,.5)']); g.fillRect(-5, -14, 10, 14);
      g.fillStyle = '#7d8a3a'; g.beginPath(); g.ellipse(-.6, -4.6, 1.3, 3.2, .2, 0, TAU); g.fill(); g.fillStyle = '#9aa84a'; g.beginPath(); g.ellipse(1.8, -3, 1.1, 2.4, -.3, 0, TAU); g.fill(); A.specks(g, -4, -9, 8, 9, 5, 14, 'rgba(210,220,160,.4)', .4);
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
})();
