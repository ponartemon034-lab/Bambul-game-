// Contact sheet of the physical rig: node tools/rig_sheet.js <out.png> [walk|run|carry|jump|fall|stumble|blend]
const { chromium, chromePath } = require('./_pw');
const http = require('http'), fs = require('fs'), path = require('path'); const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
srv.listen(0, async () => {
  const out = process.argv[2] || '/tmp/rig.png', mode = process.argv[3] || 'walk';
  const br = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] }); const pg = await br.newPage({ viewport: { width: 1400, height: 400 } }); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://localhost:' + srv.address().port + '/index.html?q=low&enhance=0'); await pg.waitForFunction(() => window.BB && BB.built && BB.rig && BB.rig.ready, { timeout: 60000 });
  await pg.evaluate(o => { Object.assign(window, o); }, { __N: +(process.env.N || 8), __S: +(process.env.S || 1.55), __W: +(process.env.W || 175), __H: +(process.env.H || 330) });
  const url = await pg.evaluate(mode => {
    const N = +(window.__N || 8), S = +(window.__S || 1.55), W = +(window.__W || 175), H = +(window.__H || 330), c = document.createElement('canvas'); c.width = N * W; c.height = H; const g = c.getContext('2d');
    g.fillStyle = '#6f8aa0'; g.fillRect(0, 0, c.width, c.height);
    const inst = BB.rig.create(); const speed = mode === 'run' ? 310 : 170, per = mode === 'run' ? 62 : 52; let ph = 0, t = 0;
    const st = mode === 'blend' ? 'walk' : mode;
    const dt = 1 / 60; const cycleT = (2 * per) / speed;                   // seconds per full cycle
    const step = (state, v) => { ph += v / (state === 'run' ? 62 : 52) * dt * Math.PI; t += dt; inst.update(dt, { phase: ph, t, vy: state === 'jump' ? 200 : -100 }, state, mode === 'carry' ? 'bag' : null); };
    for (let i = 0; i < 240; i++) step(st === 'jump' || st === 'fall' ? 'stand' : st, st === 'jump' || st === 'fall' ? 0 : speed);          // warm up
    const drawH = () => {};
    for (let f = 0; f < N; f++) {
      const n = Math.round(cycleT / dt / N * (mode === 'jump' ? 0 : 1)) || 4;
      for (let i = 0; i < n; i++) step(mode === 'blend' ? (f < 6 ? 'walk' : 'run') : st, mode === 'blend' ? (f < 6 ? 170 : 310) : speed);
      g.save(); g.translate(f * W + W / 2, H - 22); g.scale(S, S); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = .5; g.beginPath(); g.moveTo(-60, 0); g.lineTo(60, 0); g.stroke();
      inst.draw(g, mode === 'carry' ? 'bag' : null, (gg, h, x, y) => { gg.fillStyle = '#23232b'; gg.fillRect(x - 8, y, 16, 22); }, {}, 0); g.restore();
    }
    return c.toDataURL('image/png');
  }, mode);
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', out, errs.join('|') || 'no errors');
  await br.close(); srv.close();
});
