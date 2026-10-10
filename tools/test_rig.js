// Physical rig self-test (Playwright): smoothness, planted feet, no NaN, all states draw. Usage: node tools/test_rig.js
const { chromium, chromePath } = require('./_pw');
const http = require('http'), fs = require('fs'), path = require('path'); const root = path.resolve(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(root, p), (e, d) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': mime[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); });
let pass = 0, fail = 0; const ok = (n, c, i) => { (c ? pass++ : fail++); console.log((c ? 'PASS ' : 'FAIL ') + n + (i !== undefined ? '  ' + JSON.stringify(i) : '')); };
srv.listen(0, async () => {
  const br = await chromium.launch({ executablePath: chromePath(), args: ['--no-sandbox'] }); const pg = await br.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await pg.goto('http://localhost:' + srv.address().port + '/index.html?q=low&enhance=0'); await pg.waitForFunction(() => window.BB && BB.built && BB.rig && BB.rig.ready, { timeout: 90000 });
  ok('rig assets loaded', await pg.evaluate(() => BB.rig.ready));
  const r = await pg.evaluate(() => {
    const out = {}; const dt = 1 / 60; const AH = BB.rig.ankleH();
    for (const [mode, v, per] of [['walk', 170, 52], ['run', 310, 62], ['carry', 150, 52]]) {
      const inst = BB.rig.create(); let ph = 0, t = 0, prev = null, prev2 = null, maxJump = 0, maxSlip = 0, nan = false; const slips = [];
      const hist = [];
      for (let i = 0; i < 360; i++) {
        ph += v / per * dt * Math.PI; t += dt; inst.update(dt, { phase: ph, t, vy: 0 }, mode, mode === 'carry' ? 'bag' : null);
        const o = inst.out; if (!o) continue;
        const ang = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]); const cur = { tr: o.torso, hr: o.headRot, tN: ang(o.hipN, o.kneeN), sN: ang(o.kneeN, o.ankleN), fN: o.footRotN, tF: ang(o.hipF, o.kneeF), sF: ang(o.kneeF, o.ankleF), fF: o.footRotF, s: o.sleeveRot, f: o.fRotN };
        for (const k in cur) if (!isFinite(cur[k])) nan = true;
        if (prev && prev2 && i > 120) for (const k in cur) { const d2 = Math.abs(cur[k] - 2 * prev[k] + prev2[k]); if (d2 > maxJump) { maxJump = d2; out[mode + 'Key'] = k + '@' + i; } }
        prev2 = prev; prev = cur;
        // planted foot: world x of the lowest ankle must drift with the ground (-v*dt per frame) while it touches
        hist.push({ aN: o.ankleN.slice(), aF: o.ankleF.slice(), t });
      }
      // stance detection: ankle y near ground -> world foot x = hip x(0) + ankle x - distance travelled
      let slip = 0, n = 0;
      for (let i = 130; i < hist.length - 1; i++) for (const k of ['aN', 'aF']) {
        const y0 = hist[i][k][1], y1 = hist[i + 1][k][1]; if (Math.abs(y0 + AH) < .8 && Math.abs(y1 + AH) < .8) { const dx = (hist[i + 1][k][0] - hist[i][k][0]) + v * dt; slip = Math.max(slip, Math.abs(dx)); n++; }
      }
      out[mode] = { maxJump: +maxJump.toFixed(3), slipPerFrame: +slip.toFixed(2), stanceFrames: n, nan };
    }
    return out;
  });
  for (const m of ['walk', 'run', 'carry']) { ok(m + ': no NaN', !r[m].nan); ok(m + ': joint angles have no jerks (max 2nd difference ' + r[m].maxJump + ' rad/frame^2)', r[m].maxJump < (m === 'run' ? .12 : .05), [r[m], r[m + 'Key']]); ok(m + ': stance feet stay planted (max drift ' + r[m].slipPerFrame + ' cm/frame)', r[m].slipPerFrame < 1.2 && (r[m].stanceFrames > 20 || m === 'run'), r[m]); }
  // every hero state draws without errors, in the real game
  const st = await pg.evaluate(() => { const S = BB.S; if (S._st) { S._st.introDone = 1; } const bad = []; for (const s of BB.char.STATES.map(x => x.id)) { try { BB.P.force = s; } catch (e) { } } BB.P.force = null; return BB.char.STATES.length; });
  for (const s of ['idle', 'walk', 'run', 'carry', 'jump', 'fall', 'pickup', 'phone', 'mop', 'vac', 'scrub', 'repair', 'cheer', 'panic', 'tired', 'shock', 'sit', 'stumble', 'openFridge', 'shrug']) {
    await pg.evaluate(x => { BB.P.force = x; BB.P.held = x === 'mop' ? 'mop' : x === 'vac' ? 'vac' : x === 'carry' ? 'bag' : null; }, s); await pg.waitForTimeout(250);
  }
  await pg.evaluate(() => { BB.P.force = null; BB.P.held = null; });
  // a state switch must not teleport any joint (blend walk -> run -> jump -> idle in one go)
  const sw = await pg.evaluate(() => {
    const inst = BB.rig.create(), dt = 1 / 60; let ph = 0, t = 0, prev = null, worst = 0, wn = '', ws = '', wi = 0;
    const seq = [['walk', 60], ['run', 60], ['jump', 30], ['fall', 30], ['idle', 60], ['walk', 60]];
    for (const [s, n] of seq) for (let i = 0; i < n; i++) {
      if (s === 'walk' || s === 'run') ph += (s === 'run' ? 310 / 62 : 170 / 52) * dt * Math.PI; t += dt;
      inst.update(dt, { phase: ph, t, vy: s === 'jump' ? 200 : -50 }, s, null, { crouch: 1, lean: 0, lift: 0 }, { aA: .1, eA: .2, aB: -.1, eB: -.2, head: 0 });
      const o = inst.out, an = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]), cur = [o.torso, an(o.hipN, o.kneeN), an(o.kneeN, o.ankleN), o.fRotN, o.headRot]; if (prev) for (let k = 0; k < cur.length; k++) { const d = Math.abs(cur[k] - prev[k]); if (d > worst) { worst = d; wn = ['torso', 'thigh', 'shin', 'fore', 'head'][k]; ws = s; wi = i; } } prev = cur;
    }
    return { worst, wn, ws, wi };
  });
  ok('state changes blend (worst per-frame joint step ' + sw.worst.toFixed(3) + ' rad in ' + sw.wn + ' during ' + sw.ws + '#' + sw.wi + ')', sw.worst < .35, sw);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
  console.log(pass + ' passed, ' + fail + ' failed'); await br.close(); srv.close(); process.exit(fail ? 1 : 0);
});
