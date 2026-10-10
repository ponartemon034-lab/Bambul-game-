// Screenshots of the hero in many states inside the real game -> <outdir>/<state>.png (cropped around the hero)
// Usage: node tools/rig_states.js <outdir> [state,state,...]
const { chromium, chromePath } = require('./_pw');
const http = require('http'), fs = require('fs'), path = require('path'); const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
srv.listen(0, async () => {
  const out = process.argv[2] || '/tmp/states'; fs.mkdirSync(out, { recursive: true });
  const states = (process.argv[3] || 'idle,walk,run,carry,jump,pickup,phone,mop,vac,scrub,repair,cheer,panic,tired,shock,openFridge,shrug,point').split(',');
  const br = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] }); const pg = await br.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('http://localhost:' + srv.address().port + '/index.html?q=low&enhance=0&autostart=1'); await pg.waitForFunction(() => window.BB && BB.built && BB.rig && BB.rig.ready, { timeout: 90000 });
  await pg.evaluate(() => { const S = BB.S; S._st.introDone = 1; S.intro = 0; S.countdown = 1; BB.P.force = null; __bb.teleport(1650); BB.S.time = 1e6; });
  await pg.waitForTimeout(800);
  for (const st of states) {
    await pg.evaluate(s => { BB.P.force = s; BB.P.held = ({ mop: 'mop', vac: 'vac', carry: 'bag', phone: null })[s] || null; if (s === 'walk' || s === 'run' || s === 'carry') { BB.P.vx = 0; } }, st);
    await pg.waitForTimeout(900);
    const box = await pg.evaluate(() => { const v = BB.view, c = document.querySelector('#cv').getBoundingClientRect(); return { x: c.left + c.width * .5, y: c.top + c.height * .62, w: c.width, h: c.height }; });
    await pg.screenshot({ path: out + '/' + st + '.png', clip: { x: Math.max(0, box.x - 190), y: Math.max(0, box.y - 250), width: 380, height: 360 } });
  }
  console.log('wrote', states.length, 'shots', errs.join('|') || 'no errors'); await br.close(); srv.close();
});
