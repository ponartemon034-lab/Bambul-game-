// Usage: node tools/test_tasks.js   - drives the real page with tests/tasks_selftest.js, prints the log, exits 1 on failure.
const { chromium, chromePath } = require('./_pw');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
(async () => {
  const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end('nf'); return; } r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
  await new Promise(r => srv.listen(0, r));
  const br = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox', '--use-gl=swiftshader', '--ignore-gpu-blocklist'] }).catch(() => chromium.launch({ args: ['--no-sandbox'] }));
  const pg = await br.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; pg.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); }); pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await pg.goto('http://localhost:' + srv.address().port + '/index.html' + (process.argv[2] || '?autostart'), { waitUntil: 'load' });
  await pg.waitForFunction(() => window.BB && BB.built, { timeout: 90000 });
  await pg.addScriptTag({ path: path.join(root, 'tests/tasks_selftest.js') });
  const res = await pg.evaluate(() => window.__tasksSelfTest());
  console.log(res.log.join('\n')); console.log('\nPASS ' + res.pass + '  FAIL ' + res.fail); if (res.fails.length) console.log('FAILED:\n - ' + res.fails.join('\n - '));
  console.log(errs.length ? 'console errors:\n' + errs.join('\n') : 'no console errors');
  await br.close(); srv.close(); process.exit(res.fail || errs.length ? 1 : 0);
})();
