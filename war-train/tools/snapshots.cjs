// Renders key frames of one demo pass to PNG (transparent) and reports console errors + alpha stats.
// Usage: NODE_PATH=$(npm root -g) node tools/snapshots.cjs [outDir] [times...]
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const out = path.resolve(process.argv[2] || 'snapshots');
  const times = process.argv.slice(3).map(Number);
  const T = times.length ? times : [0.8, 2.6, 5.7, 8.0, 11.3, 14.2];
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const url = 'file://' + path.resolve(__dirname, '../index.html') + '?export=1&mode=loop&persist=0';
  await page.goto(url);
  await page.waitForFunction(() => window.WarTrain && window.WarTrain.exportFrame);
  let frame = 0;
  for (const t of T) {
    const target = Math.round(t * 60);
    await page.evaluate((n) => window.WarTrain.step(n), target - frame);
    frame = target;
    const res = await page.evaluate(() => {
      const c = document.getElementById('wt-canvas'), x = c.getContext('2d');
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let transparent = 0, opaque = 0;
      for (let i = 3; i < d.length; i += 4) { if (d[i] === 0) transparent++; else if (d[i] === 255) opaque++; }
      const corners = [[0, 0], [c.width - 1, 0], [0, 40], [c.width - 1, 40]].map(([px, py]) => x.getImageData(px, py, 1, 1).data[3]);
      return { url: c.toDataURL('image/png'), transparent: transparent / (d.length / 4), opaque: opaque / (d.length / 4), corners, particles: window.WarTrain.fx.p.length };
    });
    fs.writeFileSync(path.join(out, `t${t.toFixed(1)}.png`), Buffer.from(res.url.split(',')[1], 'base64'));
    console.log(`t=${t}s  fully-transparent px ${(res.transparent * 100).toFixed(1)}%  opaque ${(res.opaque * 100).toFixed(1)}%  top-corner alpha ${res.corners.join(',')}  particles ${res.particles}`);
  }
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no console errors');
  await browser.close();
})();
