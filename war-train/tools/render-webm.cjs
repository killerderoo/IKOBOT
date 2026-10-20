// Prerenders one demo pass (15 s, 60 fps, 1920×1080) to a transparent VP9 WebM with alpha,
// plus an MP4 preview composited on a dark background (MP4 has no alpha).
// Usage: NODE_PATH=$(npm root -g) node tools/render-webm.cjs [outDir] [fps] [gifts]
//   gifts: optional comma list of gift counts for one showcase pass, e.g. 5,10,25,50
//          (gifts < 5 share a squad wagon, each SUB BOMB gets its own); default = demo pass
//   level: optional hype train level for the showcase (more attacks), default 3
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

(async () => {
  const out = path.resolve(process.argv[2] || path.join(__dirname, '../dist'));
  const fps = +(process.argv[3] || 60);
  const gifts = (process.argv[4] || '').split(',').map(Number).filter((n) => n > 0);
  const level = +(process.argv[5] || 3);
  const tag = gifts.length ? 'showcase' : '15s';
  const frames = fs.mkdtempSync(path.join(os.tmpdir(), 'wartrain-'));
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => console.error('page error:', e));
  const mode = gifts.length ? `events&maxGifters=${gifts.length}` : 'loop';
  await page.goto('file://' + path.resolve(__dirname, '../index.html') + `?export=1&mode=${mode}&persist=0`);
  await page.waitForFunction(() => window.WarTrain && window.WarTrain.exportFrame);
  if (gifts.length) {
    await page.evaluate(([list, level]) => {
      const W = window.WarTrain, names = ['PvtRyan', 'Kilo141', 'LtLemon', 'SnipeQueen', 'GhostRecon_77', 'Nightfall_NL', 'SgtKilljoy', 'Warlord_Wim'];
      list.forEach((n, i) => W.handle(W.mock.gift(n, names[i % names.length])));
      W.handle(W.mock.resub('MajorTom_NL', 14)); W.handle(W.mock.sub('PvtPixel')); W.handle(W.mock.hypeLevel(level));
      while (!W.controller.run) W.step(1);
    }, [gifts, level]);
  }
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
  const webm = path.join(out, `war-train-${tag}-alpha.webm`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(fps), '-i', path.join(frames, 'f%05d.png'),
    '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '32', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4',
    '-auto-alt-ref', '0', '-metadata:s:v:0', 'alpha_mode=1', webm], { stdio: 'inherit' });
  const mp4 = path.join(out, `war-train-${tag}-preview.mp4`);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `color=c=0x2f343a:s=1920x1080:r=${fps}`, '-framerate', String(fps),
    '-i', path.join(frames, 'f%05d.png'), '-filter_complex', '[0][1]overlay=format=auto:shortest=1,format=yuv420p', '-c:v', 'libx264', '-crf', '22', '-preset', 'medium', mp4], { stdio: 'inherit' });
  fs.rmSync(frames, { recursive: true, force: true });
  console.log('wrote', webm, '\nwrote', mp4);
})();
