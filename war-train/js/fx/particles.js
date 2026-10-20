/* War Train — particle VFX: smoke, steam, sparks, embers, tracers, muzzle flashes, energy blasts,
   shockwaves and celebration bursts. Everything is drawn with alpha on a transparent canvas. */
window.WT = window.WT || {};
(function (WT) {
  'use strict';
  const U = WT.U;

  function radialSprite(r, g, b, soft) {
    const s = 128, c = U.canvas(s, s), x = c.getContext('2d');
    const grd = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, `rgba(${r},${g},${b},1)`);
    grd.addColorStop(soft, `rgba(${r},${g},${b},0.45)`);
    grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = grd;
    x.fillRect(0, 0, s, s);
    return c;
  }

  // ---- procedural textures (value-noise fBm) ------------------------------------------
  function noise2(seed) {
    const N = 64, grid = new Float32Array(N * N), r = U.rng(seed);
    for (let i = 0; i < grid.length; i++) grid[i] = r();
    const at = (x, y) => grid[(y & 63) * N + (x & 63)];
    const n = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    return (x, y) => { let s = 0, amp = 0.5, f = 1; for (let o = 0; o < 5; o++) { s += amp * n(x * f, y * f); f *= 2.03; amp *= 0.5; } return s / 0.96875; };
  }
  const sstep = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // Billowing smoke puff: ragged noisy edge, self-shadowed (lit from `lightDir`: -1 = from above, 1 = from below).
  function billow(dark, light, seed, lightDir, alpha) {
    const S = 128, c = U.canvas(S, S), x = c.getContext('2d'), img = x.createImageData(S, S), f = noise2(seed);
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const dx = (px - S / 2) / (S / 2), dy = (py - S / 2) / (S / 2), d = Math.sqrt(dx * dx + dy * dy);
      const i = (py * S + px) * 4;
      if (d >= 1) { img.data[i + 3] = 0; continue; }
      const n = f(px * 0.05 + seed * 7, py * 0.05);
      const edge = 1 - sstep(0.3, 1.0, d + (n - 0.5) * 0.65);
      const dens = U.clamp(edge * (0.45 + 0.85 * n), 0, 1);
      const lit = U.clamp(0.45 + lightDir * dy * 0.6 - dx * 0.12 + (n - 0.5) * 0.7, 0, 1);
      img.data[i] = dark[0] + (light[0] - dark[0]) * lit;
      img.data[i + 1] = dark[1] + (light[1] - dark[1]) * lit;
      img.data[i + 2] = dark[2] + (light[2] - dark[2]) * lit;
      img.data[i + 3] = 255 * Math.pow(dens, 1.3) * alpha;
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  // Fire colour ramp: deep red → orange → yellow → white-hot.
  function ramp(v) {
    if (v > 0.82) return [255, 248, 215];
    if (v > 0.6) return [255, 200 + 45 * (v - 0.6) / 0.22, 90 + 110 * (v - 0.6) / 0.22];
    if (v > 0.35) return [255, 110 + 90 * (v - 0.35) / 0.25, 25 + 65 * (v - 0.35) / 0.25];
    return [150 + 105 * v / 0.35, 30 + 80 * v / 0.35, 10 + 15 * v / 0.35];
  }

  // Turbulent flame tongue (tall) or fireball (round); `temp` scales how hot the colours read.
  function flameSprite(seed, temp, round) {
    const W = round ? 128 : 96, H = round ? 128 : 160, c = U.canvas(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), f = noise2(seed);
    const cx = W / 2, cy = round ? H / 2 : H * 0.66;
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4;
      const n = f(px * 0.06 + seed * 3, py * 0.045 + seed);
      let d;
      if (round) {
        const dx = (px - cx) / (W / 2), dy = (py - cy) / (H / 2);
        d = Math.sqrt(dx * dx + dy * dy) + (n - 0.5) * 0.55;
      } else {
        const dx = (px - cx) / (W * 0.42), up = py < cy;
        const dy = (py - cy) / (up ? H * 0.64 : H * 0.3);
        d = Math.sqrt(dx * dx + dy * dy) + (n - 0.5) * (up ? 0.9 * (1 - py / H) + 0.2 : 0.3);
      }
      const v = U.clamp((1 - d) * (0.75 + 0.6 * n) * temp, 0, 1);
      if (v <= 0.02) { img.data[i + 3] = 0; continue; }
      const col = ramp(v);
      img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2];
      img.data[i + 3] = 255 * sstep(0.02, 0.32, v);
    }
    x.putImageData(img, 0, 0);
    return c;
  }

  // Lumpy smoke puff so clouds don't look like perfect circles.
  function smokeSprite(r, g, b, seed) {
    const s = 128, c = U.canvas(s, s), x = c.getContext('2d'), rnd = U.rng(seed);
    for (let i = 0; i < 9; i++) {
      const px = s / 2 + (rnd() - 0.5) * 40, py = s / 2 + (rnd() - 0.5) * 40, pr = 22 + rnd() * 22;
      const grd = x.createRadialGradient(px, py, 0, px, py, pr);
      grd.addColorStop(0, `rgba(${r},${g},${b},0.35)`);
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      x.fillStyle = grd;
      x.fillRect(0, 0, s, s);
    }
    return c;
  }

  class FX {
    constructor(quality) {
      this.mult = quality === 'low' ? 0.45 : 1;
      this.max = quality === 'low' ? 900 : 2600;
      this.p = [];
      this.rnd = U.rng(1337);
      this.shakeAmt = 0;
      this.shakeT = 0;
      this.sprites = {
        smoke: [smokeSprite(26, 26, 30, 1), smokeSprite(34, 30, 30, 2), smokeSprite(22, 22, 26, 3)],
        warm: [smokeSprite(70, 44, 30, 4), smokeSprite(60, 36, 28, 5)],
        steam: [smokeSprite(205, 205, 212, 6), smokeSprite(190, 192, 200, 7)],
        orange: radialSprite(255, 130, 30, 0.25),
        red: radialSprite(255, 50, 30, 0.25),
        white: radialSprite(255, 240, 210, 0.2),
        gold: radialSprite(255, 200, 70, 0.25),
        hot: radialSprite(255, 236, 170, 0.35),
        soot: [smokeSprite(12, 11, 12, 8), smokeSprite(18, 15, 14, 9)],
      };
      // realistic textures (generated once)
      const sp = this.sprites;
      sp.billowDark = [0, 1, 2, 3].map((i) => billow([14, 13, 13], [92, 88, 84], 20 + i, -1, 0.95));
      sp.billowGray = [0, 1, 2].map((i) => billow([48, 47, 48], [150, 148, 146], 30 + i, -1, 0.8));
      sp.billowLit = [0, 1, 2].map((i) => billow([40, 22, 14], [235, 120, 45], 40 + i, 1, 0.95));
      sp.dust = [0, 1, 2].map((i) => billow([58, 46, 34], [150, 124, 92], 50 + i, -1, 0.85));
      sp.flameHot = [0, 1, 2, 3].map((i) => flameSprite(60 + i, 1.35));
      sp.flameMid = [0, 1, 2, 3].map((i) => flameSprite(70 + i, 1.0));
      sp.flameCool = [0, 1, 2].map((i) => flameSprite(80 + i, 0.7));
      sp.ballHot = [0, 1, 2].map((i) => flameSprite(90 + i, 1.2, true));
      sp.ballMid = [0, 1, 2].map((i) => flameSprite(95 + i, 0.95, true));
      // older smoke kinds now use the textured puffs
      sp.smoke = sp.billowDark; sp.soot = sp.billowDark; sp.warm = sp.billowLit;
    }

    reset(seed) {
      this.p.length = 0;
      this.rnd = U.rng(seed || 1337);
      this.shakeAmt = 0;
    }

    r(a, b) { return a + (b - a) * this.rnd(); }
    n(count) { return Math.max(1, Math.round(count * this.mult)); }

    add(o) {
      if (this.p.length >= this.max) this.p.shift();
      o.age = 0;
      o.layer = o.layer || 'front';
      this.p.push(o);
      return o;
    }

    shake(amount, dur) {
      this.shakeAmt = Math.max(this.shakeAmt, amount);
      this.shakeT = Math.max(this.shakeT, dur || 0.4);
    }
    shakeOffset(t) {
      if (this.shakeAmt < 0.05) return [0, 0];
      return [Math.sin(t * 91) * this.shakeAmt + Math.sin(t * 37) * this.shakeAmt * 0.5, Math.cos(t * 83) * this.shakeAmt * 0.7];
    }

    // ---- emitters -------------------------------------------------------
    smoke(x, y, o) {
      o = o || {};
      const cnt = this.n(o.n || 4);
      for (let i = 0; i < cnt; i++) {
        const S = this.sprites;
        const set = o.kind === 'steam' ? S.steam : o.kind === 'warm' ? S.billowLit : o.kind === 'dust' ? S.dust : o.kind === 'gray' ? S.billowGray : S.billowDark;
        const pick = (a) => a[(this.rnd() * a.length) | 0];
        this.add({
          t: 'smoke', spr: pick(o.kind === 'fire' ? S.billowLit : set), spr2: o.kind === 'fire' ? pick(S.billowDark) : null, spr3: o.kind === 'fire' ? pick(S.billowGray) : null,
          delay: o.delay ? this.r(0, o.delay) : 0, layer: o.layer || 'back',
          x: x + this.r(-1, 1) * (o.spread || 10), y: y + this.r(-1, 1) * (o.spread || 10),
          vx: (o.vx || 0) + this.r(-1, 1) * (o.jitter || 20), vy: (o.vy || -40) + this.r(-1, 1) * (o.jitter || 20),
          size: (o.size || 70) * this.r(0.7, 1.3), grow: o.grow || 1.8, life: (o.life || 2.2) * this.r(0.7, 1.2),
          alpha: o.alpha || 0.8, drag: o.drag || 0.6, rot: this.r(0, 6.28), vr: this.r(-0.4, 0.4),
        });
      }
    }
    steam(x, y, o) { this.smoke(x, y, Object.assign({ kind: 'steam', alpha: 0.55, size: 50, life: 1.3, vy: -120, jitter: 40, layer: 'front' }, o)); }

    sparks(x, y, o) {
      o = o || {};
      const cnt = this.n(o.n || 20);
      for (let i = 0; i < cnt; i++) {
        const a = (o.angle || -Math.PI / 2) + this.r(-1, 1) * (o.spread || Math.PI), sp = (o.speed || 500) * this.r(0.3, 1.1);
        this.add({
          t: 'spark', layer: o.layer || 'front', x, y, vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp, life: this.r(0.25, 0.8) * (o.life || 1),
          g: o.gravity == null ? 900 : o.gravity, drag: 1.5, w: this.r(1.2, 2.6), color: o.color || (this.rnd() < 0.7 ? '255,170,60' : '255,240,200'),
        });
      }
    }

    embers(x, y, o) {
      o = o || {};
      const cnt = this.n(o.n || 6);
      for (let i = 0; i < cnt; i++) {
        this.add({
          t: 'ember', layer: o.layer || 'front', x: x + this.r(-1, 1) * (o.spread || 30), y: y + this.r(-1, 1) * (o.spread || 30),
          vx: (o.vx || 0) + this.r(-30, 30), vy: this.r(-90, -20) * (o.lift || 1), life: this.r(1.2, 3.2) * (o.life || 1),
          g: -10, drag: 0.4, size: this.r(1.5, 4), ph: this.r(0, 6.28),
        });
      }
    }

    flash(x, y, size, angle, o) {
      o = o || {};
      this.add({ t: 'flash', x, y, size, angle: angle || 0, life: o.life || 0.12, layer: o.layer || 'front', spr: o.color === 'white' ? this.sprites.white : this.sprites.orange, alpha: o.alpha || 1 });
    }

    glow(x, y, size, o) {
      o = o || {};
      this.add({ t: 'glow', x, y, vx: o.vx || 0, vy: o.vy || 0, size, life: o.life || 0.5, layer: o.layer || 'front', spr: this.sprites[o.color || 'orange'], alpha: o.alpha == null ? 1 : o.alpha, drag: 0 });
    }

    tracer(x, y, angle, o) {
      o = o || {};
      const sp = o.speed || 2600;
      this.add({ t: 'tracer', x, y, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, life: o.life || 0.6, len: o.len || 90, layer: o.layer || 'front', color: o.color || '255,190,90', drag: 0 });
    }

    ring(x, y, maxR, o) {
      o = o || {};
      this.add({ t: 'ring', x, y, maxR, life: o.life || 0.5, color: o.color || '255,150,60', w: o.w || 6, layer: 'front' });
    }

    // Harmless cinematic energy projectile; bursts into a celebration flare at the end of its life.
    blast(x, y, angle, o) {
      o = o || {};
      const life = o.life || 0.7, sp = o.speed || 1500;
      let vx = Math.cos(angle) * sp, vy = Math.sin(angle) * sp, g = 380, drag = 0.25;
      if (o.target) { vx = (o.target[0] - x) / life; vy = (o.target[1] - y) / life; g = 0; drag = 0; }
      this.add({ t: 'blast', x, y, vx, vy, life, size: o.size || 26, g, drag, burst: o.burst !== false, scale: o.scale || 1, gold: !!o.gold, layer: 'front' });
    }

    burst(x, y, scale, gold) {
      scale = scale || 1;
      this.flash(x, y, 260 * scale, 0, { life: 0.25, color: 'white' });
      this.glow(x, y, 380 * scale, { life: 0.6, color: gold ? 'gold' : 'orange', alpha: 0.8 });
      this.ring(x, y, 120 * scale, { life: 0.45, w: 4, color: gold ? '255,190,80' : '255,140,50' });
      this.sparks(x, y, { n: 46 * scale, speed: 720 * scale, spread: Math.PI, gravity: 260, life: 1.6, color: gold ? '255,215,110' : undefined });
      this.embers(x, y, { n: 14 * scale, spread: 40 * scale });
      this.smoke(x, y, { n: 3, kind: 'warm', size: 90 * scale, alpha: 0.35, layer: 'front', vy: -10 });
    }

    // Big muzzle event used by every cannon.
    muzzle(x, y, angle, scale) {
      scale = scale || 1;
      this.flash(x, y, 200 * scale, angle, { life: 0.1, color: 'white' });
      this.flash(x + Math.cos(angle) * 40 * scale, y + Math.sin(angle) * 40 * scale, 260 * scale, angle, { life: 0.16 });
      this.glow(x, y, 300 * scale, { life: 0.35, alpha: 0.7 });
      this.sparks(x, y, { n: 26 * scale, angle, spread: 0.6, speed: 900 * scale, gravity: 500 });
      this.smoke(x, y, { n: 6 * scale, angle, vx: Math.cos(angle) * 160, vy: Math.sin(angle) * 160 - 30, size: 70 * scale, alpha: 0.75, layer: 'front', life: 2 });
      this.smoke(x, y, { n: 3, kind: 'warm', vx: Math.cos(angle) * 90, vy: -40, size: 60 * scale, alpha: 0.5, layer: 'front' });
      this.ring(x, y, 70 * scale, { life: 0.22, w: 2, color: '255,170,90' });
    }

    // ---- war effects ----------------------------------------------------
    // Rising flames: white-hot core → orange → red, fading into soot.
    fire(x, y, o) {
      o = o || {};
      const cnt = this.n(o.n || 3);
      for (let i = 0; i < cnt; i++) {
        this.add({
          t: 'fire', layer: o.layer || 'front', x: x + this.r(-1, 1) * (o.spread || 8), y: y + this.r(-1, 1) * (o.spread || 8) * 0.5,
          vx: (o.vx || 0) + this.r(-1, 1) * (o.jitter || 25), vy: (o.vy || -90) + this.r(-1, 1) * (o.jitter || 25),
          size: (o.size || 26) * this.r(0.7, 1.3), life: (o.life || 0.8) * this.r(0.7, 1.2), g: o.g == null ? -120 : o.g, drag: o.drag || 1.2,
          rot: this.r(0, 6.28), v: (this.rnd() * 4) | 0, ball: !!o.ball, delay: o.delay ? this.r(0, o.delay) : 0,
          end: o.smokeEnd ? 'smoke' : undefined, smokeSize: o.smokeSize,
        });
      }
    }

    debris(x, y, o) {
      o = o || {};
      const cnt = this.n(o.n || 8);
      for (let i = 0; i < cnt; i++) {
        const a = (o.angle == null ? -Math.PI / 2 : o.angle) + this.r(-1, 1) * (o.spread || 1.2), sp = (o.speed || 700) * this.r(0.35, 1);
        this.add({
          t: 'debris', layer: o.layer || 'front', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 1300, drag: 0.3,
          life: this.r(0.9, 1.8), w: this.r(4, 12) * (o.scale || 1), h: this.r(3, 7) * (o.scale || 1), rot: this.r(0, 6.28), vr: this.r(-14, 14),
          burning: this.rnd() < (o.burning == null ? 0.5 : o.burning), dirt: o.dirt && this.rnd() < 0.6,
        });
      }
    }

    // Missile with a smoke trail; explodes on arrival.
    missile(x, y, tx, ty, o) {
      o = o || {};
      const life = o.life || 0.7;
      this.add({ t: 'missile', layer: o.layer || 'front', x, y, vx: (tx - x) / life, vy: (ty - y) / life, life, drag: 0, end: o.end || 'explode', scale: o.scale || 1, endLayer: o.endLayer || 'back' });
    }

    // Airborne explosion: flash → turbulent fireball → fire tongues that turn into rolling,
    // fire-lit smoke → dark smoke column, plus secondary pops, burning debris and sparks.
    explosion(x, y, s, o) {
      o = o || {};
      s = s || 1;
      const layer = o.layer || 'front';
      this.flash(x, y, 520 * s, 0, { life: 0.09, color: 'white', layer });
      this.glow(x, y, 800 * s, { life: 0.4, alpha: 0.6, layer });
      this.add({ t: 'fireball', layer, x, y, vx: 0, vy: -40, g: -60, drag: 1, size: 120 * s, life: 0.9, v: (this.rnd() * 3) | 0 });
      for (let i = 0; i < this.n(22 * s); i++) {
        const a = this.r(0, 6.283), sp = this.r(80, 420) * s;
        this.add({ t: 'fire', layer, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, size: this.r(34, 70) * s, life: this.r(0.45, 1.0), g: -200, drag: 3.2, rot: 0, v: (this.rnd() * 4) | 0, ball: this.rnd() < 0.6, end: 'smoke', smokeSize: 70 * s });
      }
      this.smoke(x, y - 20 * s, { n: 8 * s, kind: 'fire', size: 80 * s, spread: 40 * s, jitter: 70 * s, vy: -70, life: 4, alpha: 1, layer, grow: 2.6, drag: 0.9, delay: 0.25 });
      for (let i = 0; i < 3; i++) {
        const ox = x + this.r(-90, 90) * s, oy = y + this.r(-60, 60) * s, d = this.r(0.12, 0.45);
        this.add({ t: 'fire', layer, x: ox, y: oy, vx: 0, vy: -50, size: 60 * s, life: 0.5, g: -100, drag: 1, rot: 0, v: i, ball: true, delay: d, end: 'smoke', smokeSize: 60 * s });
      }
      this.debris(x, y, { n: 10 * s, speed: 850 * s, spread: Math.PI, layer: o.debrisLayer || 'front', scale: Math.min(2, s) });
      this.sparks(x, y, { n: 34 * s, speed: 950 * s, gravity: 700, life: 1.2, layer: o.debrisLayer || 'front' });
      if (o.shake !== false) this.shake(8 * s, 0.3);
    }

    // Ground impact: flash, fire column, dirt + debris thrown up, dust skirt rolling along the ground,
    // and a tall smoke column that keeps billowing after the fire dies.
    groundBlast(x, y, s, o) {
      o = o || {};
      s = s || 1;
      const layer = o.layer || 'back';
      const near = o.near ? 'front' : layer; // impacts behind the train keep their debris behind it
      this.flash(x, y - 40 * s, 560 * s, 0, { life: 0.09, color: 'white', layer });
      this.glow(x, y - 80 * s, 900 * s, { life: 0.5, alpha: 0.5, layer });
      this.add({ t: 'fireball', layer, x, y: y - 50 * s, vx: 0, vy: -120 * s, g: -40, drag: 1.5, size: 130 * s, life: 0.85, v: (this.rnd() * 3) | 0 });
      for (let i = 0; i < this.n(26 * s); i++) {
        const a = -Math.PI / 2 + this.r(-0.6, 0.6), sp = this.r(180, 720) * s;
        this.add({ t: 'fire', layer, x: x + this.r(-25, 25) * s, y: y - 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size: this.r(36, 76) * s, life: this.r(0.5, 1.15), g: 120, drag: 2.2, rot: 0, v: (this.rnd() * 4) | 0, ball: this.rnd() < 0.5, end: 'smoke', smokeSize: 80 * s });
      }
      // tall smoke column (fire-lit at the base, darkening as it climbs)
      for (let i = 0; i < this.n(12 * s); i++) {
        const h = this.r(30, 280) * s;
        this.smoke(x + this.r(-30, 30) * s * (1 + h / (300 * s)), y - h, { n: 1, kind: 'fire', size: (70 + h * 0.35) * this.r(0.8, 1.2), spread: 10, vy: -90 - h * 0.25, jitter: 30, life: 4.8, alpha: 1, layer, grow: 2.3, drag: 0.6 });
        this.p[this.p.length - 1].delay = 0.15 + (h / (280 * s)) * 0.5; // plume climbs upward over time
      }
      // dust skirt rolling sideways along the ground
      for (const dir of [-1, 1]) this.smoke(x, y - 12, { n: 5 * s, kind: 'dust', vx: dir * 300 * s, vy: -18, jitter: 40, size: 70 * s, life: 2.4, alpha: 0.85, layer, grow: 2.4, drag: 1.4 });
      // dirt clods + metal debris
      this.debris(x, y - 10, { n: 14 * s, speed: 950 * s, spread: 0.9, layer: near, scale: Math.min(2, s), dirt: true });
      this.sparks(x, y - 20, { n: 26 * s, speed: 850 * s, spread: 0.9, gravity: 900, life: 1.3, layer: near });
      this.embers(x, y - 90 * s, { n: 16 * s, spread: 60 * s, lift: 1.5, layer });
      if (o.shake !== false) this.shake(9 * s, 0.35);
    }

    // ---- simulation -----------------------------------------------------
    update(dt) {
      const cur = this.p, keep = [], bursts = [];
      this.p = []; // particles spawned during this step land here
      for (let i = 0; i < cur.length; i++) {
        const q = cur[i];
        if (q.delay > 0) { q.delay -= dt; keep.push(q); continue; }
        q.age += dt;
        if (q.age >= q.life) {
          if ((q.t === 'blast' && q.burst) || q.end) bursts.push(q);
          continue;
        }
        if (q.vx !== undefined) {
          const dr = Math.exp(-(q.drag || 0) * dt);
          q.vx *= dr; q.vy *= dr;
          q.vy += (q.g || 0) * dt;
          q.x += q.vx * dt; q.y += q.vy * dt;
        }
        if (q.t === 'missile') {
          // several puffs per frame along the path so the trail reads as one continuous plume
          for (let k = 0; k < 4; k++) {
            const f = k / 4;
            this.add({ t: 'smoke', spr: this.sprites.steam[(this.rnd() * 2) | 0], layer: q.layer, x: q.x - q.vx * dt * f, y: q.y - q.vy * dt * f, vx: this.r(-8, 8), vy: this.r(-8, 3), size: 6 * q.scale, grow: 3, life: 1.0, alpha: 0.22, drag: 1, rot: this.r(0, 6), vr: 0 });
          }
        } else if (q.t === 'debris' && q.burning && this.rnd() < 0.6) {
          this.add({ t: 'ember', x: q.x, y: q.y, vx: 0, vy: 0, life: 0.4, g: -20, drag: 1, size: 3, ph: 0, layer: q.layer });
          if (this.rnd() < 0.35) this.add({ t: 'smoke', spr: this.sprites.billowDark[(this.rnd() * 4) | 0], layer: q.layer, x: q.x, y: q.y, vx: 0, vy: -20, size: 8, grow: 3, life: 1.0, alpha: 0.6, drag: 1, rot: this.rnd() * 6, vr: 0 });
        }
        if (q.t === 'blast' && this.rnd() < 0.8) {
          this.add({ t: 'ember', x: q.x, y: q.y, vx: this.r(-40, 40), vy: this.r(-40, 40), life: this.r(0.3, 0.7), g: 0, drag: 1, size: this.r(2, 4), ph: 0, layer: 'front' });
        }
        if (q.vr) q.rot += q.vr * dt;
        keep.push(q);
      }
      this.p = keep.concat(this.p);
      for (const q of bursts) {
        if (q.end === 'smoke') this.smoke(q.x, q.y - q.size * 0.4, { n: 1, kind: 'fire', size: q.smokeSize || q.size * 1.2, spread: 6, vx: q.vx * 0.3, vy: -60, jitter: 20, life: 3.2, alpha: 1, layer: q.layer, grow: 2.4, drag: 0.8 });
        else if (q.end === 'explode') this.explosion(q.x, q.y, q.scale, { layer: q.endLayer });
        else if (q.end === 'ground') this.groundBlast(q.x, q.y, q.scale, { layer: q.endLayer });
        else this.burst(q.x, q.y, q.scale, q.gold);
      }
      if (this.p.length > this.max) this.p.splice(0, this.p.length - this.max);
      if (this.shakeT > 0) this.shakeT -= dt;
      else this.shakeAmt *= Math.exp(-10 * dt);
    }

    draw(ctx, layer) {
      for (let i = 0; i < this.p.length; i++) {
        const q = this.p[i];
        if (q.layer !== layer || q.delay > 0) continue;
        const k = q.age / q.life;
        switch (q.t) {
          case 'smoke': {
            const s = q.size * (1 + (q.grow - 1) * U.easeOutCubic(k));
            const a = q.alpha * Math.min(1, k * 6) * Math.pow(1 - k, 1.2);
            ctx.save();
            ctx.translate(q.x, q.y);
            ctx.rotate(q.rot);
            if (q.spr2) {
              // fire-born smoke: glowing underside → dark soot → thinning gray
              const h = sstep(0, 0.35, k), g2 = sstep(0.45, 1, k);
              if (h < 1) { ctx.globalAlpha = a * (1 - h); ctx.drawImage(q.spr, -s, -s, s * 2, s * 2); }
              ctx.globalAlpha = a * h * (1 - g2); ctx.drawImage(q.spr2, -s, -s, s * 2, s * 2);
              if (g2 > 0) { ctx.globalAlpha = a * g2; ctx.drawImage(q.spr3, -s, -s, s * 2, s * 2); }
            } else {
              ctx.globalAlpha = a;
              ctx.drawImage(q.spr, -s, -s, s * 2, s * 2);
            }
            ctx.restore();
            break;
          }
          case 'spark': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 1 - k;
            ctx.strokeStyle = `rgb(${q.color})`;
            ctx.lineWidth = q.w;
            ctx.beginPath();
            ctx.moveTo(q.x, q.y);
            ctx.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'ember': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = (1 - k) * (0.6 + 0.4 * Math.sin(q.age * 14 + q.ph));
            const s = q.size * 4;
            ctx.drawImage(this.sprites.orange, q.x - s, q.y - s, s * 2, s * 2);
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'flash': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = q.alpha * (1 - k);
            ctx.save();
            ctx.translate(q.x, q.y);
            ctx.rotate(q.angle);
            const s = q.size * (0.7 + 0.5 * k);
            ctx.drawImage(q.spr, -s * 0.6, -s * 0.35, s * 1.6, s * 0.7);
            ctx.drawImage(q.spr, -s * 0.35, -s * 0.35, s * 0.7, s * 0.7);
            ctx.restore();
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'glow': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = q.alpha * (1 - k);
            const s = q.size / 2;
            ctx.drawImage(q.spr, q.x - s, q.y - s, s * 2, s * 2);
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'tracer': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 1 - k * 0.5;
            const sp = Math.hypot(q.vx, q.vy), ux = q.vx / sp, uy = q.vy / sp;
            const grd = ctx.createLinearGradient(q.x, q.y, q.x - ux * q.len, q.y - uy * q.len);
            grd.addColorStop(0, `rgba(255,250,230,1)`);
            grd.addColorStop(0.2, `rgba(${q.color},0.9)`);
            grd.addColorStop(1, `rgba(${q.color},0)`);
            ctx.strokeStyle = grd;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(q.x, q.y);
            ctx.lineTo(q.x - ux * q.len, q.y - uy * q.len);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'ring': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 1 - k;
            ctx.strokeStyle = `rgb(${q.color})`;
            ctx.lineWidth = q.w * (1 - k) + 1;
            ctx.beginPath();
            ctx.arc(q.x, q.y, q.maxR * U.easeOutCubic(k), 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'fire': {
            const S = this.sprites;
            const set = k < 0.3 ? (q.ball ? S.ballHot : S.flameHot) : k < 0.65 ? (q.ball ? S.ballMid : S.flameMid) : S.flameCool;
            const spr = set[q.v % set.length];
            const sz = q.size * (0.7 + 0.8 * U.easeOutCubic(k));
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = (k < 0.08 ? k / 0.08 : Math.pow(1 - (k - 0.08) / 0.92, 0.8)) * 0.95;
            ctx.save();
            ctx.translate(q.x, q.y);
            ctx.rotate(U.clamp(q.vx / 600, -0.5, 0.5));
            const w = q.ball ? sz * 2 : sz * 1.3, h = q.ball ? sz * 2 : sz * 2.2;
            ctx.drawImage(spr, -w / 2, -h * (q.ball ? 0.5 : 0.66), w, h);
            ctx.restore();
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'fireball': {
            const S = this.sprites, spr = (k < 0.4 ? S.ballHot : S.ballMid)[q.v % 3];
            const sz = q.size * (0.5 + 1.1 * U.easeOutCubic(Math.min(1, k * 2.5)));
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = Math.pow(1 - k, 1.5);
            ctx.drawImage(spr, q.x - sz, q.y - sz, sz * 2, sz * 2);
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'debris': {
            ctx.globalAlpha = 1 - Math.max(0, k - 0.7) / 0.3;
            ctx.save();
            ctx.translate(q.x, q.y);
            ctx.rotate(q.rot);
            ctx.fillStyle = q.dirt ? '#3a2e22' : q.burning ? '#2a1a10' : '#15171a';
            ctx.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
            if (q.burning) { ctx.fillStyle = 'rgba(255,120,30,0.9)'; ctx.fillRect(-q.w / 2, -q.h / 2, q.w * 0.4, q.h); }
            ctx.restore();
            break;
          }
          case 'missile': {
            const sp = Math.hypot(q.vx, q.vy) || 1, ux = q.vx / sp, uy = q.vy / sp, L = 26 * q.scale;
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#2b2f34'; ctx.lineWidth = 5 * q.scale; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - ux * L, q.y - uy * L); ctx.stroke();
            ctx.lineCap = 'butt';
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(this.sprites.hot, q.x - ux * L - 14 * q.scale, q.y - uy * L - 14 * q.scale, 28 * q.scale, 28 * q.scale);
            ctx.drawImage(this.sprites.orange, q.x - ux * L - 40 * q.scale, q.y - uy * L - 40 * q.scale, 80 * q.scale, 80 * q.scale);
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'bomb': {
            ctx.globalAlpha = 1;
            ctx.save();
            ctx.translate(q.x, q.y);
            ctx.rotate(Math.atan2(q.vy, q.vx));
            ctx.fillStyle = '#1d2024';
            U.roundRect(ctx, -14, -5, 26, 10, 5); ctx.fill();
            ctx.fillStyle = '#3a3f45'; ctx.fillRect(-18, -6, 5, 12);
            ctx.fillStyle = '#c0261a'; ctx.fillRect(4, -5, 2, 10);
            ctx.restore();
            break;
          }
          case 'blast': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = 1;
            const s = q.size * (1 + 0.15 * Math.sin(q.age * 60));
            const spr = q.gold ? this.sprites.gold : this.sprites.orange;
            ctx.drawImage(spr, q.x - s * 2.5, q.y - s * 2.5, s * 5, s * 5);
            ctx.drawImage(this.sprites.white, q.x - s, q.y - s, s * 2, s * 2);
            // streak
            const sp = Math.hypot(q.vx, q.vy) || 1;
            ctx.strokeStyle = 'rgba(255,170,70,0.6)';
            ctx.lineWidth = s * 0.6;
            ctx.beginPath();
            ctx.moveTo(q.x, q.y);
            ctx.lineTo(q.x - (q.vx / sp) * 110, q.y - (q.vy / sp) * 110);
            ctx.stroke();
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  WT.FX = FX;
})(window.WT);
