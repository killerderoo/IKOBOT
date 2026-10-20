// Renders mockup frames for each SUB BOMB tier (transparent PNGs + previews on a dark backdrop).
// Usage: NODE_PATH=$(npm root -g) node tools/mockups.cjs <outDir>
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const SCENES = [
  { name: 'loco', count: 1, times: [1.0, 2.7] },
  { name: 'supply', count: 1, times: [5.75] },
  { name: 'airstrike', count: 5, times: [6.25, 6.85] },
  { name: 'chopper', count: 10, times: [7.3, 8.2] },
  { name: 'carpet', count: 25, times: [7.2, 8.3] },
  { name: 'nuke', count: 50, times: [6.7, 8.2, 9.4, 10.8, 14.6] },
];

(async () => {
  const out = path.resolve(process.argv[2] || 'mockups');
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  for (const sc of SCENES) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?export=1&mode=events&persist=0');
    await page.waitForFunction(() => window.WarTrain && window.WarTrain.step);
    await page.evaluate((n) => {
      const W = window.WarTrain;
      W.handle(W.mock.gift(n, n >= 50 ? 'Warlord_Wim' : n >= 25 ? 'SgtKilljoy' : n >= 10 ? 'Nightfall_NL' : n >= 5 ? 'GhostRecon_77' : 'PvtRyan'));
      W.handle(W.mock.resub('MajorTom_NL', 14)); W.handle(W.mock.sub('PvtPixel')); W.handle(W.mock.hypeLevel(3));
      while (!W.controller.run) W.step(1);
    }, sc.count);
    let f = 0;
    for (const t of sc.times) {
      const n = Math.round(t * 60);
      await page.evaluate((k) => window.WarTrain.step(k), n - f);
      f = n;
      const url = await page.evaluate(() => document.getElementById('wt-canvas').toDataURL('image/png'));
      const file = path.join(out, `${sc.name}_${t.toFixed(2)}.png`);
      fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x343a42:s=1920x1080', '-i', file,
        '-filter_complex', '[0][1]overlay=format=auto', '-frames:v', '1', '-q:v', '3', file.replace('.png', '_view.jpg')]);
    }
    console.log(sc.name, errors.length ? 'ERRORS ' + errors.join(' | ') : 'ok');
    await page.close();
  }
  await browser.close();
})();
