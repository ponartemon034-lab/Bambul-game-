// Resolves Playwright and a Chromium binary without hardcoded machine paths.
// Playwright: normal require, then the global install of the cloud image. Chromium: $CHROME, else the newest /opt/pw-browsers build, else Playwright's own.
const fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
function chromePath() {
  if (process.env.CHROME) return process.env.CHROME;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try { const d = fs.readdirSync(base).filter(n => /^chromium-\d+$/.test(n)).sort().pop(); if (d) { const p = path.join(base, d, 'chrome-linux', 'chrome'); if (fs.existsSync(p)) return p; } } catch (e) { }
  return undefined;
}
module.exports = { chromium: pw.chromium, chromePath };
