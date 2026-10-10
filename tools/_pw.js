// Playwright loader shared by the test tools: uses the project's own install (CI / npm install),
// falls back to a global one, and ignores an executablePath that does not exist on this machine.
const fs = require('fs');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const launch = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = (o = {}) => { if (o.executablePath && !fs.existsSync(o.executablePath)) { o = Object.assign({}, o); delete o.executablePath; } return launch(o); };
module.exports = pw;
