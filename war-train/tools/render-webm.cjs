// Prerenders one demo pass (15 s, 60 fps, 1920×1080) to a transparent VP9 WebM with alpha,
// plus an MP4 preview composited on a dark background (MP4 has no alpha).
// Usage: NODE_PATH=$(npm root -g) node tools/render-webm.cjs [outDir] [fps]
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

(async () => {
  const out = path.resolve(process.argv[2] || path.join(__dirname, '../dist'));
  const fps = +(process.argv[3] || 60);
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'wartrain-'));
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => console.error('page error:', e));
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + '?export=1&mode=loop&persist=0');
  await page.waitForFunction(() => window.WarTrain && window.WarTrain.exportFrame);
  // 60 fps simulation always; at 30 fps we just keep every second frame.
  const first = await page.evaluate(() => window.WarTrain.exportFrame());
  const D = await page.evaluate(() => window.WarTrain.runDuration());
  const total = Math.round(D * 60);
  const keep = 60 / fps;
  let idx = 0;
  const write = (url) => fs.writeFileSync(path.join(frames, `f${String(idx++).padStart(5, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
  write(first);
  for (let i = 1; i < total; i++) {
    const url = await page.evaluate((render) => (render ? window.WarTrain.exportFrame() : (window.WarTrain.step(1), null)), i % keep === 0);
    if (url) write(url);
    if (i % 120 === 0) process.stdout.write(`\rframe ${i}/${total}`);
  }
  await browser.close();
  console.log(`\nencoding ${idx} frames…`);
  const webm = path.join(out, 'war-train-15s-alpha.webm');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(fps), '-i', path.join(frames, 'f%05d.png'),
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '32', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4',
    '-auto-alt-ref', '0', '-metadata:s:v:0', 'alpha_mode=1', webm], { stdio: 'inherit' });
  const mp4 = path.join(out, 'war-train-15s-preview.mp4');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x2f343a:s=1920x1080:r=${fps}`, '-framerate', String(fps),
    '-i', path.join(frames, 'f%05d.png'), '-filter_complex', '[0][1]overlay=format=auto:shortest=1,format=yuv420p', '-c:v', 'libx264', '-crf', '22', '-preset', 'medium', mp4], { stdio: 'inherit' });
  fs.rmSync(frames, { recursive: true, force: true });
  console.log('wrote', webm, '\nwrote', mp4);
})();
