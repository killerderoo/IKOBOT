// Renders a ~1 minute sales/promo video of the overlay, in English and Dutch.
// Real overlay frames (deterministic export) are composited over a brand-free gameplay backdrop,
// with caption cards rendered from card.html.
// Usage: NODE_PATH=$(npm root -g) node tools/promo/promo.cjs [outDir] [en,nl]
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'dist'));
const LANGS = (process.argv[3] || 'en,nl').split(',');
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'wartrain-promo-'));
const FPS = 30;

const T = {
  en: {
    title: ['ANIMATED TWITCH HYPE TRAIN OVERLAY', 'Every gifted sub joins the battle'],
    loco: ['1080P · 60 FPS · TRANSPARENT', 'ARMORED WAR TRAIN', 'Rolls across your stream in OBS — fully animated'],
    squad: ['1–4 GIFTED SUBS', 'JOIN THE SUB SQUAD', 'Up to 5 gifters per wagon — avatar, crown & name each'],
    air: ['SUB BOMB · 5+ SUBS', 'PRECISION AIRSTRIKE', 'Every sub bomb gets its own cannon wagon'],
    chop: ['SUB BOMB · 10+ SUBS', 'CHOPPER GUNNER', 'Bigger gift = bigger strike'],
    carpet: ['SUB BOMB · 25+ SUBS', 'CARPET BOMBING', 'Realistic fire, smoke columns, debris & dust'],
    nuke: ['SUB BOMB · 50+ SUBS', 'TACTICAL NUKE', 'Countdown, white-out, shockwave & mushroom cloud'],
    level: ['HYPE TRAIN LEVEL UP', 'MORE LEVELS = MORE FIREPOWER', 'Jets, gunships, bombers & extra artillery'],
    thanks: ['GRAND FINALE', 'TOP GIFTERS + LIVE COUNTER'],
    themes: '7 METALLIC THEMES',
    features: ['READY FOR YOUR STREAM', [
      'Transparent OBS browser source', 'StreamElements widget included',
      'Twitch EventSub relay (server-side)', 'Queue — never interrupts a train',
      'Usernames, avatars & ranks', 'Sub bombs scale with gift count',
      'Hype level drives the action', 'Sound hooks (muted by default)']],
    outro: ['ANIMATED TWITCH HYPE TRAIN OVERLAY', 'AVAILABLE NOW', 'Contact the creator for pricing & installation'],
  },
  nl: {
    title: ['GEANIMEERDE TWITCH HYPE TRAIN OVERLAY', 'Elke gifted sub doet mee aan de strijd'],
    loco: ['1080P · 60 FPS · TRANSPARANT', 'GEPANTSERDE OORLOGSTREIN', 'Rijdt over je stream in OBS — volledig geanimeerd'],
    squad: ['1–4 GIFTED SUBS', 'WORD LID VAN DE SUB SQUAD', 'Tot 5 gifters per wagon — elk met avatar, kroon & naam'],
    air: ['SUB BOMB · 5+ SUBS', 'PRECISION AIRSTRIKE', 'Elke sub bomb krijgt een eigen kanonwagon'],
    chop: ['SUB BOMB · 10+ SUBS', 'CHOPPER GUNNER', 'Hoe groter de gift, hoe groter de aanval'],
    carpet: ['SUB BOMB · 25+ SUBS', 'CARPET BOMBING', 'Echt vuur, rookkolommen, puin & stof'],
    nuke: ['SUB BOMB · 50+ SUBS', 'TACTICAL NUKE', 'Aftellen, witte flits, schokgolf & paddenstoelwolk'],
    level: ['HYPE TRAIN LEVEL OMHOOG', 'HOGER LEVEL = MEER VUURKRACHT', 'Straaljagers, helikopters, bommenwerpers & artillerie'],
    thanks: ['GROOTS EINDE', 'TOP GIFTERS + LIVE TELLER'],
    themes: '7 METALLIC THEMA\'S',
    features: ['KLAAR VOOR JOUW STREAM', [
      'Transparante OBS browserbron', 'StreamElements-widget inbegrepen',
      'Twitch EventSub-relay (server-side)', 'Wachtrij — onderbreekt nooit een trein',
      'Namen, avatars & rangen', 'Sub bombs groeien mee met de gift',
      'Hype-level bepaalt de actie', 'Geluid (standaard gedempt)']],
    outro: ['GEANIMEERDE TWITCH HYPE TRAIN OVERLAY', 'NU BESCHIKBAAR', 'Neem contact op voor prijs & installatie'],
  },
};

const THEMES = [['steel', 'BLUE STEEL'], ['chrome', 'CHROME'], ['blackgold', 'BLACK & GOLD'], ['crimson', 'CRIMSON OPS'], ['desert', 'DESERT STORM'], ['arctic', 'ARCTIC'], ['toxic', 'TOXIC']];
const ACCENT = { steel: '#ff7a1a', chrome: '#33d1ff', blackgold: '#ffb52e', crimson: '#ff2d2d', desert: '#ff8a2a', arctic: '#36b8ff', toxic: '#7dff3a' };

// Segments: frames come from a scenario; `win` is the run-time window to capture (may use G = extra scene-3 time).
const SEGMENTS = [
  { id: 'title', scen: { gifts: [2] }, win: () => [0.0, 4.4], card: (L) => ({ type: 'title', title: L.title[0], sub: L.title[1] }), cardAt: 0.6 },
  { id: 'loco', scen: { gifts: [2] }, win: () => [2.0, 4.8], card: (L) => cap(L.loco) },
  { id: 'squad', scen: { gifts: [2, 1, 3, 1, 4] }, win: () => [4.1, 7.4], card: (L) => cap(L.squad) },
  { id: 'air', scen: { gifts: [5] }, win: () => [4.7, 8.7], card: (L) => cap(L.air) },
  { id: 'chop', scen: { gifts: [15] }, win: () => [5.4, 9.8], card: (L) => cap(L.chop) },
  { id: 'carpet', scen: { gifts: [40] }, win: () => [5.4, 10.2], card: (L) => cap(L.carpet) },
  { id: 'nuke', scen: { gifts: [100] }, win: () => [5.3, 12.6], card: (L) => cap(L.nuke) },
  { id: 'level', scen: { gifts: [1], level: 5 }, win: (G) => [6.8 + G, 11.8 + G], card: (L) => cap(L.level) },
  { id: 'thanks', scen: { gifts: [3, 1, 25, 10, 5], level: 3 }, win: (G) => [10.0 + G, 13.7 + G], card: (L) => ({ type: 'top', kicker: L.thanks[0], title: L.thanks[1] }) },
  ...THEMES.map(([th, label], i) => ({ id: 'theme_' + th, scen: { gifts: [5], theme: th }, win: () => [2.3, 3.3], card: (L) => ({ type: 'caption', kicker: L.themes, title: label, accent: ACCENT[th] }), hard: true, cardAt: 0, first: i === 0, last: i === THEMES.length - 1 })),
  { id: 'features', still: true, dur: 6.5, card: (L) => ({ type: 'features', title: L.features[0], items: L.features[1] }) },
  { id: 'outro', scen: { gifts: [2] }, win: () => [13.9, 17.4], card: (L) => ({ type: 'outro', title: L.outro[1], cta: L.outro[1] === 'AVAILABLE NOW' ? 'GET THE WAR TRAIN' : 'HAAL DE WAR TRAIN', sub: L.outro[2] }), cardAt: 0.5 },
];
function cap(a) { return { type: 'caption', kicker: a[0], title: a[1], sub: a[2] }; }

const run = (args) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // backdrop
  await page.goto('file://' + path.join(__dirname, 'background.html'));
  await page.waitForTimeout(300);
  const bg = path.join(WORK, 'bg.png');
  await page.screenshot({ path: bg });

  // overlay frames per segment
  for (const seg of SEGMENTS) {
    if (seg.still) continue;
    const dir = path.join(WORK, seg.id);
    fs.mkdirSync(dir);
    const sc = seg.scen;
    await page.goto('file://' + path.join(ROOT, 'index.html') + `?export=1&mode=events&persist=0&maxWagons=8&theme=${sc.theme || 'steel'}`);
    await page.waitForFunction(() => window.WarTrain && window.WarTrain.step);
    const G = await page.evaluate((sc) => {
      const W = window.WarTrain, names = ['PvtRyan', 'Kilo141', 'SgtKilljoy', 'Nightfall_NL', 'GhostRecon_77', 'Warlord_Wim'];
      sc.gifts.forEach((n, i) => W.handle(W.mock.gift(n, n >= 50 ? 'Warlord_Wim' : names[i % names.length])));
      W.handle(W.mock.resub('MajorTom_NL', 14)); W.handle(W.mock.sub('PvtPixel')); W.handle(W.mock.hypeLevel(sc.level || 3));
      while (!W.controller.run) W.step(1);
      return W.controller.run.G;
    }, sc);
    const [a, b] = seg.win(G);
    await page.evaluate((n) => window.WarTrain.step(n), Math.max(0, Math.round(a * 60)));
    const n = Math.round((b - a) * FPS);
    for (let i = 0; i < n; i++) {
      const url = await page.evaluate(() => { window.WarTrain.step(2); return document.getElementById('wt-canvas').toDataURL('image/png'); });
      fs.writeFileSync(path.join(dir, `f${String(i).padStart(5, '0')}.png`), Buffer.from(url.split(',')[1], 'base64'));
    }
    seg.dur = n / FPS;
    console.log(`frames ${seg.id}: ${n}`);
  }

  for (const lang of LANGS) {
    const L = T[lang];
    const parts = [];
    for (const seg of SEGMENTS) {
      const cardPng = path.join(WORK, `card_${lang}_${seg.id}.png`);
      const data = seg.card(L);
      await page.goto('file://' + path.join(__dirname, 'card.html') + '?d=' + encodeURIComponent(JSON.stringify(data)));
      await page.waitForFunction(() => document.body.dataset.ready === '1');
      await page.screenshot({ path: cardPng, omitBackground: true });
      const D = seg.dur, out = path.join(WORK, `seg_${lang}_${seg.id}.mp4`);
      const cs = seg.cardAt == null ? 0.25 : seg.cardAt, ce = D - 0.35;
      const fadeV = seg.hard ? (seg.first ? `fade=t=in:st=0:d=0.25` : seg.last ? `fade=t=out:st=${(D - 0.25).toFixed(2)}:d=0.25` : 'null') : `fade=t=in:st=0:d=0.3,fade=t=out:st=${(D - 0.3).toFixed(2)}:d=0.3`;
      const cardFade = seg.hard ? 'format=rgba' : `format=rgba,fade=t=in:st=${cs}:d=0.35:alpha=1,fade=t=out:st=${ce.toFixed(2)}:d=0.3:alpha=1`;
      if (seg.still) {
        run(['-loop', '1', '-framerate', String(FPS), '-t', String(D), '-i', bg, '-loop', '1', '-framerate', String(FPS), '-t', String(D), '-i', cardPng,
          '-filter_complex', `[1]${cardFade}[c];[0][c]overlay=format=auto,${fadeV},format=yuv420p`, '-r', String(FPS), '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', out]);
      } else {
        run(['-loop', '1', '-framerate', String(FPS), '-t', D.toFixed(3), '-i', bg, '-framerate', String(FPS), '-i', path.join(WORK, seg.id, 'f%05d.png'),
          '-loop', '1', '-framerate', String(FPS), '-t', D.toFixed(3), '-i', cardPng,
          '-filter_complex', `[0][1]overlay=format=auto:shortest=1[v];[2]${cardFade}[c];[v][c]overlay=format=auto:shortest=1,${fadeV},format=yuv420p`,
          '-r', String(FPS), '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', out]);
      }
      parts.push(out);
    }
    const list = path.join(WORK, `list_${lang}.txt`);
    fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
    const final = path.join(OUT, `war-train-promo-${lang}.mp4`);
    run(['-f', 'concat', '-safe', '0', '-i', list, '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', final]);
    console.log('wrote', final);
  }
  await browser.close();
  fs.rmSync(WORK, { recursive: true, force: true });
})();
