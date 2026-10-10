// Usage: node tools/shot.js <url-path> <out.png> [--w 1280 --h 720] [--x 900] [--wait 800] [--eval "js"] [--keys "KeyD:600"]
const { chromium, chromePath } = require('./_pw');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
function serve() { return new Promise(res => { const s = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end('nf'); return; } r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }); s.listen(0, () => res(s)); }); }
(async () => {
  const a = process.argv.slice(2); const url = a[0], out = a[1]; const opt = {};
  for (let i = 2; i < a.length; i += 2) opt[a[i].replace(/^--/, '')] = a[i + 1];
  const srv = await serve(); const port = srv.address().port;
  const br = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox', '--use-gl=swiftshader', '--ignore-gpu-blocklist'] }).catch(async () => chromium.launch({ args: ['--no-sandbox'] }));
  const pg = await br.newPage({ viewport: { width: +(opt.w || 1280), height: +(opt.h || 720) }, deviceScaleFactor: +(opt.dpr || 1) });
  const logs = []; pg.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text()); }); pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  await pg.goto('http://localhost:' + port + '/' + url, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.BB && BB.built, { timeout: 60000 }).catch(() => logs.push('build timeout'));
  if (opt.x) await pg.evaluate(x => { __bb.teleport(+x); }, opt.x);
  if (opt.eval) await pg.evaluate(opt.eval);
  if (opt.keys) { for (const k of opt.keys.split(',')) { const [c, ms] = k.split(':'); await pg.keyboard.down(c); await pg.waitForTimeout(+ms); await pg.keyboard.up(c); } }
  await pg.waitForTimeout(+(opt.wait || 900));
  await pg.screenshot({ path: out });
  if (opt.after) { const r = await pg.evaluate(opt.after); console.log('after:', JSON.stringify(r)); }
  console.log(logs.join('\n') || 'no console errors');
  await br.close(); srv.close();
})();
