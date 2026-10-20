// Integration checks (no Twitch credentials needed):
//  1. StreamElements widget bundle: simulated onWidgetLoad / onEventReceived payloads
//  2. Local relay: server/server.mjs → SSE → overlay, via POST /api/emit
//  3. Queue: events arriving mid-pass are queued, not interrupting the running train
// Usage: node tools/build.cjs && NODE_PATH=$(npm root -g) node tools/test-integrations.cjs
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
let failed = 0;
const check = (name, ok, info) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); if (!ok) failed++; };

(async () => {
  const browser = await chromium.launch();

  // ---- 1. StreamElements ---------------------------------------------------
  {
    const se = path.join(root, 'dist/streamelements');
    const html = `<!doctype html><html><head><style>${fs.readFileSync(path.join(se, 'widget.css'), 'utf8')}</style></head><body>` +
      fs.readFileSync(path.join(se, 'widget.html'), 'utf8') + `<script>${fs.readFileSync(path.join(se, 'widget.js'), 'utf8')}</script></body></html>`;
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route('**/*', (r) => (r.request().url().startsWith('http://se.test') ? r.fulfill({ contentType: 'text/html', body: html }) : r.abort()));
    await page.goto('http://se.test/widget');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('onWidgetLoad', { detail: { fieldData: { loopDemo: false, quality: 'low', maxGifters: 2 } } })));
    await page.waitForFunction(() => window.WarTrain && window.WarTrain.controller);
    const r = await page.evaluate(() => {
      const fire = (listener, event) => window.dispatchEvent(new CustomEvent('onEventReceived', { detail: { listener, event } }));
      fire('subscriber-latest', { _id: 'a1', name: 'BulkBoss', sender: 'BulkBoss', amount: 5, tier: '1000', bulkGifted: true });
      for (let i = 0; i < 5; i++) fire('subscriber-latest', { _id: 'r' + i, name: 'rcpt' + i, sender: 'BulkBoss', amount: 1, gifted: true, isCommunityGift: true });
      fire('subscriber-latest', { _id: 'a2', name: 'lucky', sender: 'SingleGifter', amount: 1, tier: '2000', gifted: true });
      fire('subscriber-latest', { _id: 'a3', name: 'Veteran', amount: 9, tier: '1000' });
      fire('subscriber-latest', { _id: 'a4', name: 'Newbie', amount: 1, tier: '1000' });
      fire('subscriber-latest', { _id: 'a4', name: 'Newbie', amount: 1, tier: '1000' }); // duplicate delivery
      fire('follower-latest', { name: 'ignored' });
      const c = window.WarTrain.controller;
      return { gifters: c.pendingGifters.map((g) => `${g.username}x${g.giftCount}/${g.tier}`), recruits: c.pendingRecruits.map((x) => `${x.type}:${x.username}:${x.months}`), cfg: [window.WarTrain.config.quality, window.WarTrain.config.maxGiftersPerRun, window.WarTrain.config.sound.enabled] };
    });
    check('SE bulk gift counted once, recipients ignored', JSON.stringify(r.gifters) === JSON.stringify(['BulkBossx5/1000', 'SingleGifterx1/2000']), JSON.stringify(r.gifters));
    check('SE sub + resub mapped, duplicate dropped', JSON.stringify(r.recruits) === JSON.stringify(['resub:Veteran:9', 'sub:Newbie:1']), JSON.stringify(r.recruits));
    check('SE fieldData applied, sound muted by default', JSON.stringify(r.cfg) === JSON.stringify(['low', 2, false]), JSON.stringify(r.cfg));
    await page.waitForFunction(() => window.WarTrain.controller.run, null, { timeout: 5000 }).catch(() => {});
    check('SE events start a train pass', await page.evaluate(() => !!window.WarTrain.controller.run));
    check('SE page has no errors', errors.length === 0, errors.join(' | '));
    await page.close();
  }

  // ---- 2 + 3. Relay server → SSE → overlay ------------------------------------
  {
    const port = 8799;
    const srv = spawn(process.execPath, [path.join(root, 'server/server.mjs')], { env: Object.assign({}, process.env, { PORT: String(port), TWITCH_CLIENT_ID: '', TWITCH_USER_TOKEN: '' }), stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((res) => srv.stdout.on('data', (d) => { if (String(d).includes('relay on')) res(); }));
    const base = `http://127.0.0.1:${port}`;
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}/index.html?sse=${base}/events&persist=0`);
    await page.waitForFunction(() => window.WarTrain && window.WarTrain.controller);
    await page.waitForTimeout(800);
    const emit = (ev) => fetch(`${base}/api/emit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ev) }).then((r) => r.json());
    const res = await emit({ type: 'gift', username: 'RelayGifter', count: 7, tier: '1000' });
    check('relay accepts POST /api/emit', res.ok === true && res.overlays >= 1, JSON.stringify(res));
    await page.waitForFunction(() => window.WarTrain.controller.run, null, { timeout: 5000 }).catch(() => {});
    const running = await page.evaluate(() => window.WarTrain.controller.run && window.WarTrain.controller.run.p.gifters.map((g) => g.username + 'x' + g.giftCount));
    check('overlay received relay event and started the train', JSON.stringify(running) === JSON.stringify(['RelayGifterx7']), JSON.stringify(running));
    await emit({ type: 'gift', username: 'LateGifter', count: 3 });
    await page.waitForTimeout(600);
    const q = await page.evaluate(() => ({ running: window.WarTrain.controller.run.p.gifters.length, queued: window.WarTrain.controller.pendingGifters.map((g) => g.username) }));
    check('event during a pass is queued, current pass untouched', q.running === 1 && q.queued[0] === 'LateGifter', JSON.stringify(q));
    const staticFile = await fetch(`${base}/server/.env.example`).then((r) => r.status);
    check('relay never serves server/ files', staticFile === 403, 'status ' + staticFile);
    check('relay page has no errors', errors.length === 0, errors.join(' | '));
    await page.close();
    srv.kill();
  }

  await browser.close();
  console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
  process.exit(failed ? 1 : 0);
})();
