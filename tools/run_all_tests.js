// Usage: node tools/run_all_tests.js [--quick]   - runs every browser test one after another, prints a summary, exits 1 if any failed.
// Logs go to $TMPDIR/bambul-tests/<name>.log (uploaded as a CI artifact on failure).
const { spawnSync } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const quick = process.argv.includes('--quick');
const ALL = [['tasks', 'test_tasks.js'], ['story', 'test_story.js'], ['voice', 'test_voice.js'], ['pain (dialogue pack)', 'test_pain.js'], ['chaos + seeds', 'test_chaos.js'], ['extras (pad, medals, daily)', 'test_extras.js'], ['stations (minigames, real input)', 'test_stations.js'], ['ui', 'test_ui.js'], ['mini', 'test_mini.js']];
const list = quick ? ALL.slice(0, 6) : ALL;
const out = path.join(process.env.CI ? '/tmp' : os.tmpdir(), 'bambul-tests'); fs.mkdirSync(out, { recursive: true });
const rows = []; let failed = 0;
for (const [name, file] of list) {
  const t0 = Date.now(), r = spawnSync(process.execPath, [path.join(__dirname, file)], { encoding: 'utf8', timeout: 20 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
  const log = (r.stdout || '') + (r.stderr || ''); fs.writeFileSync(path.join(out, file.replace(/\.js$/, '.log')), log);
  const m = log.match(/(\d+) passed, (\d+) failed/) || log.match(/PASS (\d+)\s+FAIL (\d+)/); const ok = r.status === 0;
  if (!ok) failed++;
  rows.push(`${ok ? 'ok  ' : 'FAIL'}  ${name.padEnd(36)} ${m ? m[1] + ' passed, ' + m[2] + ' failed' : '(exit ' + r.status + ')'}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(rows[rows.length - 1]);
}
console.log(failed ? `\n${failed} test file(s) failed. Logs: ${out}` : '\nall test files passed');
process.exit(failed ? 1 : 0);
