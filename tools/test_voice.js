// Voice system self-test (Playwright). Usage: node tools/test_voice.js
const { chromium, chromePath } = require('./_pw');
const http = require('http'), fs = require('fs'), path = require('path'); const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
srv.listen(0, async () => {
  const br = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const pg = await br.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await pg.goto('http://localhost:' + srv.address().port + '/index.html?autostart=1&q=low&enhance=0'); await pg.waitForFunction(() => window.BB && BB.built); await pg.waitForTimeout(2500);
  await pg.evaluate(() => { BB.story.skipIntro && BB.story.skipIntro(); window.__log = []; const sp = BB.voice.speak; BB.voice.speak = (t, w) => { window.__log.push([w, t]); return sp(t, w); }; });
  // 1. the 60 authored lines + laundry lines exist as pools and have clips
  const r1 = await pg.evaluate(async () => {
    const m = await (await fetch('assets/voice/manifest.json')).json(); const miss = []; let n = 0;
    for (const cat of ['owner:comes', 'chore:avoid', 'pickup', 'faucet:open', 'tired', 'wait', 'oops', 'allDone', 'owner:left', 'laundry:pick', 'laundry:load', 'laundry:start', 'laundry:wait', 'laundry:noise', 'move']) for (const e of BB.dlg._POOL[cat] || []) { n++; if (!m[BB.voice._key('bamboul', e.t)]) miss.push(cat + ': ' + e.t.slice(0, 40)); }
    const all = []; for (const cat in BB.dlg._POOL) for (const e of BB.dlg._POOL[cat]) { if (typeof e.t === 'string') all.push(e.t); }
    const noClip = all.filter(t => !m[BB.voice._key('bamboul', t)] && !m[BB.voice._key('landlord', t)] && !m[BB.voice._key('dan', t)]);
    return { n, miss, total: all.length, noClip: noClip.length, sample: noClip.slice(0, 3), clips: Object.keys(m).length };
  });
  ok('authored/event pools all have clips', r1.miss.length === 0, { checked: r1.n, miss: r1.miss.slice(0, 3) }); ok('every pooled line has a clip', r1.noClip === 0, { total: r1.total, noClip: r1.noClip, sample: r1.sample });
  const laundry = await pg.evaluate(() => ['laundry:pick', 'laundry:load', 'laundry:start', 'laundry:wait', 'laundry:noise'].reduce((a, c) => a + BB.dlg._POOL[c].length, 0)); ok('>= 10 laundry lines', laundry >= 10, laundry);
  // 2. router: gameplay categories now resolve to real pools
  const cases = [['garbage', { pickup: 1 }], ['garbage', { toss: 2 }], ['garbage', { clothes: 1 }], ['garbage', { clothesIn: 2 }], ['garbage', { bagFull: 1 }], ['vacuum', { start: 1 }], ['vacuum', { jam: 1 }], ['mop', { start: 1 }], ['mop', { done: 1 }], ['tools', { tool: 'mop' }], ['tools', { need: 'box' }], ['panic', { t: 60 }], ['phoneRing', {}], ['success', { all: 1 }], ['door', {}], ['faucet', { leak: 1 }], ['idle', { stove: 1 }]];
  const dead = await pg.evaluate(cs => cs.filter(([c, x]) => { BB.dlg._reset(); return !BB.dlg.bark(c, x, { force: true }); }).map(c => c[0] + JSON.stringify(c[1])), cases); ok('router: no dead gameplay barks', dead.length === 0, dead);
  // 3. one voice at a time + clips are used (not fallback)
  const r3 = await pg.evaluate(async () => { BB.voice.stats.clip = 0; BB.voice.stats.fallback = 0; let maxPlaying = 0; const A = window.Audio, live = new Set(); window.Audio = function (s) { const a = new A(s); const p = a.play.bind(a); a.play = () => { live.add(a); maxPlaying = Math.max(maxPlaying, [...live].filter(x => !x.paused).length); return p(); }; a.addEventListener('pause', () => live.delete(a)); return a; };
    for (const c of ['owner:comes', 'pickup', 'tired', 'laundry:load', 'faucet:open']) { BB.dlg._reset(); BB.dlg.bark(c, {}, { force: true }); await new Promise(r => setTimeout(r, 4600)); } await new Promise(r => setTimeout(r, 1500)); return { maxPlaying, stats: BB.voice.stats }; });
  ok('never two clips at once', r3.maxPlaying <= 1, r3); ok('queued barks all played from clips (no browser-TTS fallback)', r3.stats.clip >= 4 && r3.stats.fallback === 0, r3.stats);
  // 4. no immediate repeats from a category
  const rep = await pg.evaluate(() => { let same = 0, last = ''; for (let i = 0; i < 80; i++) { const t = BB.dlg.line('owner:comes', {}); if (t === last) same++; last = t; } return same; }); ok('no back-to-back repeats (owner:comes x80)', rep === 0, rep);
  await pg.waitForTimeout(8000);
  // 5. real gameplay events fire voiced lines: laundry + trash + mop
  const r5 = await pg.evaluate(async () => { const S = BB.S; window.__log.length = 0; BB.dlg._reset(); const sleep = ms => new Promise(r => setTimeout(r, ms));
    S.carry.cloth = 2; BB.player.teleport(BB.abs('bath', 65)); await sleep(300); const h = BB.world.hot('washer'); BB.tasks.interact(h, S); await sleep(9000);
    return window.__log.map(x => x[1].slice(0, 50)); });
  ok('washing: load + start lines spoken', r5.length >= 2, r5);
  // 6. toggle off silences, volume knob exists
  const r6 = await pg.evaluate(async () => { BB.CFG.voice = false; window.__log.length = 0; const before = BB.voice.stats.clip; BB.voice.speak('Тест', 'bamboul'); BB.CFG.voice = true; return BB.voice.stats.clip === before; }); ok('voice toggle off = silent', r6);
  // 7. missing manifest/unreachable clip does not throw
  const r7 = await pg.evaluate(async () => { try { BB.voice.speak('Реплика, которой нет ни в одном кэше, 12345', 'bamboul'); return true; } catch (e) { return false; } }); ok('unknown line falls back safely', r7);
  ok('no console/page errors', errs.length === 0, errs.slice(0, 3));
  console.log(pass + ' passed, ' + fail + ' failed'); await br.close(); srv.close();
});
