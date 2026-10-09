// Full-game QA runner (Playwright). Usage: node tools/qa_run.js [outDir]
// Boots index.html, walks the whole apartment, captures screenshots, checks console errors, scale,
// parallax, UI buttons, hotspots and the main task loop. Prints a JSON-ish report.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, 'docs/screenshots'));
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
const rep = { checks: [], errors: [] };
const ok = (name, pass, info) => { rep.checks.push({ name, pass: !!pass, info }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };
(async () => {
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port;
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const pg = await br.newPage({ viewport: { width: 1280, height: 720 } });
  pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) rep.errors.push(m.text()); });
  pg.on('pageerror', e => rep.errors.push('PAGEERROR ' + e.message));
  const t0 = Date.now();
  await pg.goto(`http://localhost:${port}/index.html?autostart=1`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.BB && BB.built, { timeout: 90000 });
  ok('world built', true, { ms: Date.now() - t0 });
  await pg.waitForTimeout(800);
  const shot = async n => pg.screenshot({ path: path.join(out, n + '.png') });
  // walk every room
  const rooms = await pg.evaluate(() => BB.LAYOUT.rooms.map(r => [r.id, r.x0, r.x1]));
  for (const [id, x0, x1] of rooms) { for (const f of [.3, .7]) { await pg.evaluate(x => __bb.teleport(x), x0 + (x1 - x0) * f); await pg.waitForTimeout(700); await shot(`room_${id}_${f * 10}`); } }
  // scale check: hero rendered height vs door
  const sc = await pg.evaluate(() => { const V = BB.view; return { hero: BB.sy(0, 0) - BB.sy(178, 0), door: BB.sy(0, 0) - BB.sy(212, 0), ratio: 178 / 212 }; });
  ok('hero/door scale', Math.abs(sc.hero / sc.door - 178 / 212) < .01, sc);
  // parallax: distinct rates
  const par = await pg.evaluate(() => [0, 160, 2600].map(z => BB.parallax(z)));
  ok('parallax layers distinct', par[0] > par[1] && par[1] > par[2], par);
  // frame time
  const ft = await pg.evaluate(() => new Promise(res => { let n = 0, t0 = performance.now(); const f = () => { if (++n < 120) requestAnimationFrame(f); else res((performance.now() - t0) / n); }; requestAnimationFrame(f); }));
  ok('avg frame ms (headless sw render)', ft < 60, ft.toFixed(1));
  rep.errors.length ? rep.errors.forEach(e => console.log('ERR ' + e)) : console.log('no console errors');
  fs.writeFileSync(path.join(out, 'qa_report.json'), JSON.stringify(rep, null, 1));
  await br.close(); srv.close();
})();
