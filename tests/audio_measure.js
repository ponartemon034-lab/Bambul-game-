// Headless audio QA: node tests/audio_measure.js [calibrate|report|live|all]
// - calibrate: renders every sound untrimmed in an OfflineAudioContext, computes per-sound trims, writes them into js/audio.js
// - report:    renders with trims, prints peak / active-RMS table
// - live:      real AudioContext (autoplay allowed): every sound, stress, leak/node-count checks, limiter check
const { chromium } = require('../tools/_pw');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const mode = process.argv[2] || 'all';
function serve() { return new Promise(res => { const s = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end('nf'); return; } r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }); s.listen(0, () => res(s)); }); }

// target active-RMS (dBFS, before buses/master) and peak ceiling per sound
const PEAK_CEIL = -4;
function targetFor(r) {
  const n = r.name;
  if (r.kind === 'music') return -19;
  if (r.kind === 'amb') return -34;
  if (r.kind === 'loop') {
    if (n === 'faucetHowl') return -33;
    if (n === 'tv') return -33;
    if (n === 'phoneRing') return -28;
    if (n === 'fridgeHum' || n === 'bathBuzz' || n === 'workFans') return -33;
    return -28;
  }
  if (n === 'step') return -28;
  if (n === 'uiHover') return -34;
  if (['uiClick', 'uiBack', 'tick', 'jump', 'land', 'heaterTick'].includes(n)) return -26;
  if (/Voice$/.test(n)) return -24;
  if (['win', 'endGood', 'endOk', 'endBad', 'bad', 'taskDone', 'success2'].includes(n)) return -21;
  if (n === 'faucetHowl' || n === 'flies' || n === 'tv') return -26;
  if (['doorKnock', 'doorBell', 'phoneRing', 'urgent', 'printerBeep', 'printerError'].includes(n)) return -24;
  return -23;
}

(async () => {
  const srv = await serve(); const port = srv.address().port;
  const br = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] }).catch(() => chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] }));
  const pg = await br.newPage();
  const logs = []; pg.on('console', m => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text()); }); pg.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
  const open = async () => { await pg.goto('http://localhost:' + port + '/tests/audio_preview.html', { waitUntil: 'load' }); await pg.waitForFunction(() => window.AQ); };
  await open();

  if (mode === 'calibrate' || mode === 'all') {
    const raw = await pg.evaluate(() => AQ.measureAll(false));
    const trim = {};
    for (const r of raw) {
      if (r.kind === 'music' && r.I !== 0.5) continue;
      const key = r.kind === 'music' ? 'music' : (r.kind === 'loop' || r.kind === 'amb') ? 'L_' + r.name : r.name;
      const tg = targetFor(r); let g = Math.pow(10, (tg - r.rmsDb) / 20); const gp = Math.pow(10, (PEAK_CEIL - r.peakDb) / 20);
      g = Math.min(g, gp); trim[key] = +g.toFixed(3);
    }
    const body = '  const TRIM = ' + JSON.stringify(trim).replace(/,/g, ', ') + ';';
    const f = path.join(root, 'js/audio.js'); let s = fs.readFileSync(f, 'utf8');
    s = s.replace(/\/\*BEGIN-TRIM\*\/[\s\S]*?\/\*END-TRIM\*\//, '/*BEGIN-TRIM*/\n' + body + '\n  /*END-TRIM*/');
    fs.writeFileSync(f, s); console.log('trims written for', Object.keys(trim).length, 'sounds');
    await open();
  }
  if (mode === 'report' || mode === 'all') {
    const rows = await pg.evaluate(() => AQ.measureAll(true));
    const f = x => (x >= 0 ? ' ' : '') + x.toFixed(1);
    console.log('kind  name              dur   peak dBFS  active RMS dBFS  crest  active%  flags');
    for (const r of rows) console.log(r.kind.padEnd(5), r.name.padEnd(17), r.dur.toFixed(1).padStart(4), f(r.peakDb).padStart(10), f(r.rmsDb).padStart(15), f(r.crest).padStart(8), (r.activeFrac * 100).toFixed(0).padStart(7), (r.nan ? ' NaN' : '') + (r.peak >= 0.99 ? ' CLIP' : '') + (Math.abs(r.dc) > 0.01 ? ' DC' : ''));
    const sf = rows.filter(r => r.kind === 'sfx'), rm = sf.map(r => r.rmsDb), pk = rows.map(r => r.peakDb);
    console.log('sfx RMS window: min', Math.min(...rm).toFixed(1), 'max', Math.max(...rm).toFixed(1), '| max peak', Math.max(...pk).toFixed(1), 'dBFS | clipped:', rows.filter(r => r.peak >= .99).length, '| NaN:', rows.filter(r => r.nan).length);
  }
  if (mode === 'live' || mode === 'all') {
    const rep = await pg.evaluate(() => AQ.live());
    console.log('LIVE', JSON.stringify(rep, null, 1));
  }
  console.log(logs.join('\n') || 'no console errors/warnings');
  await br.close(); srv.close();
})();
