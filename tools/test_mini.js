// Usage: node tools/test_mini.js [fridge faucet toilet printer dishes mirror vacJam]   (default: all)
// Loads index.html in Chromium, forces a fresh state S, runs each BB.mini minigame end-to-end with REAL pointer/keyboard
// input (and a wrong-choice path), asserts flags + onDone results, saves a screenshot per stage into $MINI_OUT.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const root = path.resolve(__dirname, '..');
const OUT = process.env.MINI_OUT || path.join(os.tmpdir(), 'mini_shots');
fs.mkdirSync(OUT, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
function serve() { return new Promise(res => { const s = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; const f = path.join(root, p); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end('nf'); return; } r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(d); }); }); s.listen(0, () => res(s)); }); }

let pg, fails = 0, passes = 0;
const log = [];
function ok(cond, msg) { if (cond) { passes++; console.log('  PASS ' + msg); } else { fails++; console.log('  FAIL ' + msg); } }
const wait = ms => pg.waitForTimeout(ms);
const ev = (fn, arg) => pg.evaluate(fn, arg);
const shot = async name => { await wait(80); await pg.screenshot({ path: path.join(OUT, name + '.png') }); };
const stage = () => ev(() => BB.mini._R && BB.mini._R.stageId);
const F = () => ev(() => JSON.parse(JSON.stringify(BB.S.f)));
const done = () => ev(() => window.__done);
async function waitStage(name, ms = 6000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await stage()) === name) return true; await wait(60); } console.log('   (stage now ' + (await stage()) + ', wanted ' + name + ')'); return false; }
async function cvBox() { return ev(() => { const b = BB.mini._R.dom.cv.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }); }
async function toPage(lx, ly) { const b = await cvBox(); return { x: b.x + lx / 760 * b.w, y: b.y + ly / 400 * b.h }; }
async function mmove(lx, ly, steps = 1) { const p = await toPage(lx, ly); await pg.mouse.move(p.x, p.y, { steps }); }
async function click(lx, ly) { const p = await toPage(lx, ly); await pg.mouse.move(p.x, p.y); await pg.mouse.down(); await pg.mouse.up(); await wait(60); }
async function drag(path_, stepEach = 6) { // path_ = [[lx,ly],...]
  const p0 = await toPage(...path_[0]); await pg.mouse.move(p0.x, p0.y); await pg.mouse.down();
  for (let i = 1; i < path_.length; i++) { const p = await toPage(...path_[i]); await pg.mouse.move(p.x, p.y, { steps: stepEach }); }
  await pg.mouse.up(); await wait(60);
}
async function actions() { return ev(() => BB.mini._R.acts.map(a => ({ label: a.label, dis: !!a.disabled }))); }
async function act(i) { const sel = '.mn-actions .mn-btn'; const els = await pg.$$(sel); await els[i].click(); await wait(80); }
async function actByLabel(re) { const l = await actions(); const i = l.findIndex(a => re.test(a.label)); if (i < 0) throw new Error('no action ' + re + ' in ' + JSON.stringify(l)); await act(i); return i; }
async function holdBtn(i, ms) { const els = await pg.$$('.mn-actions .mn-btn'); const b = await els[i].boundingBox(); await pg.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await pg.mouse.down(); await wait(ms); await pg.mouse.up(); await wait(60); }
async function targets() { return ev(() => BB.mini._R.targets().map(t => ({ id: t.id, x: t.x, y: t.y, w: t.w, h: t.h, cx: t.cx, cy: t.cy, r: t.r, label: t.label, off: !!t.off }))); }
async function clickTarget(id) { const ts = await targets(); const t = ts.find(t => t.id === id); if (!t) throw new Error('no target ' + id + ' in ' + ts.map(t => t.id)); const cx = t.r != null ? t.cx : t.x + t.w / 2, cy = t.r != null ? t.cy : t.y + t.h / 2; await click(cx, cy); }
async function scrubUntil(minProg, areaPts, maxMs = 25000) {
  const t0 = Date.now(); let k = 0;
  while (Date.now() - t0 < maxMs) {
    const p = await ev(() => BB.mini._R.stage && BB.mini._R.stageId); // placeholder to keep loop cheap
    const prog = await ev(() => { const pr = document.querySelector('.mn-prog i'); return pr ? parseFloat(pr.style.width) : -1; });
    if (prog >= minProg) return prog;
    const pts = areaPts[k++ % areaPts.length]; const pp = []; for (let j = 0; j < 8; j++) pp.push([pts[0] + (j % 2 ? 1 : -1) * pts[2], pts[1] + (j % 3 - 1) * pts[3]]);
    await drag(pp, 3);
  }
  return -2;
}
async function start(id) { await ev(id => { window.__done = null; BB.mini.start(id, BB.S, r => { window.__done = r; }); }, id); await wait(250); }
async function freshState(x) {
  await ev(() => {
    BB.S = { mode: 'play', total: 900, time: 900, f: {}, tools: { box: 1 }, carry: { trash: 0, cloth: 0 }, items: [], stains: [], dust: [], mg: {}, calls: {}, lazy: 0 };
    window.__done = null;
  });
  if (x) await ev(x => __bb.teleport(+x), x);
  await wait(200);
}
async function closePanel() { await pg.keyboard.press('Escape'); await wait(150); }
const timeNow = () => ev(() => BB.S.time);

const T = {};
T.fridge = async () => {
  console.log('== FRIDGE'); await freshState(1450 + 65);
  await start('fridge');
  ok(await ev(() => BB.mini.active === 'fridge'), 'BB.mini.active set');
  ok(!(await ev(() => BB.mini.start('fridge', BB.S, () => { }))), 'double-open refused');
  await shot('fridge_1_closed');
  ok((await stage()) === 'open', 'stage open');
  await pg.keyboard.press('Enter'); await wait(300); await shot('fridge_2_opening');
  ok(await waitStage('sort'), 'stage sort after opening');
  let f = await F(); ok(f.fridgeOpen === 1 && f.fridgeStage === 1 && f.fridgeRot === 10, 'flags after open: fridgeOpen=1 stage=1 rot=10 ' + JSON.stringify([f.fridgeOpen, f.fridgeStage, f.fridgeRot]));
  await shot('fridge_3_sort');
  // wrong: bin the eggs
  const t0 = await timeNow(); await drag([[ (await targets()).find(t => t.id === 'eggs').x + 30, 150 ], [400, 200], [650, 300]]);
  await wait(200); f = await F(); ok((await timeNow()) === t0 - 4 && f.fridgeRot === 10, 'good food in bag costs 4 s, rot unchanged (' + t0 + '->' + await timeNow() + ')');
  await shot('fridge_4_wrong');
  const bads = ['kefir', 'mayo', 'tupper', 'sausage', 'borsch', 'cheese', 'dumpl', 'jars', 'cuke', 'thing'];
  for (let i = 0; i < 5; i++) { const t = (await targets()).find(t => t.id === bads[i]); await drag([[t.x + t.w / 2, t.y + t.h / 2], [t.x + t.w / 2 + 40, t.y + 20], [650, 300]]); await wait(120); }
  f = await F(); ok(f.fridgeRot === 5, 'rot 5 after 5 items (' + f.fridgeRot + ')');
  await shot('fridge_5_bagfull');
  ok((await actions()).some(a => /бак/.test(a.label)), 'bag-full action present');
  await actByLabel(/бак/); await wait(200);
  let d = await done(); ok(d && d.win === false && d.partial && d.reason === 'bag', 'onDone partial on bag carry ' + JSON.stringify(d));
  ok((await ev(() => BB.S.carry.trash)) === 5, 'carry.trash = 5');
  ok(!(await ev(() => BB.mini.active)), 'closed');
  // reopen resumes
  await start('fridge'); ok((await stage()) === 'sort', 'reopen resumes at sort'); f = await F(); ok(f.fridgeRot === 5 && f.fridgeOpen === 1, 'rot persisted 5');
  for (let i = 5; i < 10; i++) { const t = (await targets()).find(t => t.id === bads[i]); await click(t.x + t.w / 2, t.y + t.h / 2); await wait(100); }
  ok(await waitStage('scrub', 4000), 'stage scrub after last rotten item'); f = await F(); ok(f.fridgeRot === 0 && f.fridgeStage === 2, 'rot 0 stage 2');
  ok((await ev(() => BB.S.carry.trash)) === 10, 'carry.trash 10 (auto hand-over)');
  await shot('fridge_6_scrub0');
  const half = await scrubUntil(35, [[130, 96, 60, 6], [330, 180, 70, 6], [200, 264, 60, 6], [400, 130, 25, 14]]);
  await shot('fridge_7_scrub_half');
  await closePanel(); d = await done(); ok(d && !d.win, 'closing mid-scrub = partial'); const keep = await ev(() => BB.S.mg.fridge.cells);
  await start('fridge'); ok((await stage()) === 'scrub', 'reopen resumes at scrub');
  const p1 = await ev(() => parseFloat(document.querySelector('.mn-prog i').style.width)); ok(p1 >= half - 5, 'scrub progress kept after reopen (' + p1 + ' vs ' + half + ')');
  const full = await scrubUntil(99, [[130, 96, 60, 6], [330, 180, 70, 6], [200, 264, 60, 6], [400, 130, 25, 14], [100, 345, 50, 5], [330, 360, 60, 5], [130, 50, 25, 14], [240, 222, 28, 14], [470, 300, 18, 18], [450, 96, 50, 6], [100, 180, 60, 6], [450, 264, 50, 6], [450, 180, 40, 6], [210, 96, 60, 6]], 60000);
  ok(await waitStage('close', 4000), 'stage close after full scrub (prog ' + full + ')'); f = await F(); ok(f.fridgeStage === 3, 'fridgeStage 3');
  await shot('fridge_8_close');
  await actByLabel(/Закрыть дверцу/); await wait(400); await shot('fridge_9_closing'); await wait(1200);
  f = await F(); ok(f.fridgeDone === 1 && f.fridgeOpen === 0 && f.fridgeStage === 4, 'final flags done=1 open=0 stage=4 ' + JSON.stringify([f.fridgeDone, f.fridgeOpen, f.fridgeStage]));
  await shot('fridge_10_done'); await actByLabel(/Готово/); await wait(200);
  d = await done(); ok(d && d.win === true && d.timeCost === 4, 'onDone win, timeCost 4 -> ' + JSON.stringify(d));
  await start('fridge'); d = await done(); ok(d && d.win && d.already, 'reopen after done = already');
};

(async () => {
  const want = process.argv.slice(2); const srv = await serve(); const port = srv.address().port;
  const br = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--ignore-gpu-blocklist'] }).catch(async () => chromium.launch({ args: ['--no-sandbox'] }));
  pg = await br.newPage({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 720) } });
  const errs = []; pg.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); }); pg.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await pg.goto('http://localhost:' + port + '/index.html?q=low&enhance=0', { waitUntil: 'load' });
  await pg.waitForFunction(() => window.BB && BB.built, { timeout: 60000 }).catch(() => errs.push('build timeout'));
  await ev(() => { if (BB.ui) BB.ui.busy = () => false; });
  for (const id of (want.length ? want : Object.keys(T))) { try { await T[id](); } catch (e) { fails++; console.log('  FAIL (exception) ' + id + ': ' + e.message); await shot('ERR_' + id).catch(() => { }); if (await ev(() => BB.mini.active).catch(() => 0)) await ev(() => BB.mini.abort()).catch(() => { }); } }
  console.log('console errors: ' + (errs.length ? '\n' + errs.join('\n') : 'none'));
  console.log(`RESULT: ${passes} passed, ${fails} failed; screenshots in ${OUT}`);
  await br.close(); srv.close(); process.exit(fails ? 1 : 0);
})();
