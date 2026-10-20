/* War Train — SUB BOMB killstreaks. Big gifts call in a cinematic strike while the gifter's cannon
   wagon is on screen. Coordinates are design pixels in "train space" (see Run.TRAIN_SCALE).
     REINFORCEMENTS (1+)  card only
     PRECISION AIRSTRIKE (5+)  jet formation fires missiles into the horizon
     CHOPPER GUNNER (10+)      attack helicopter strafes with minigun + rockets
     CARPET BOMBING (25+)      heavy bomber lays a wall of explosions
     TACTICAL NUKE (50+)       countdown, white-out, shockwave and mushroom cloud */
window.WT = window.WT || {};
(function (WT) {
  'use strict';
  const U = WT.U, P = WT.P;
  const ACCENT = '#ff7a1a', GOLD = '#ffc840', RED = '#ff2a1a';
  const GROUND = 936; // where ground impacts happen (just behind the rail)

  WT.killstreakFor = function (count) {
    const list = (WT.cfg.killstreaks || []).slice().sort((a, b) => b.min - a.min);
    for (const k of list) if (count >= k.min) return k;
    return { min: 1, kind: 'supply', label: 'REINFORCEMENTS', extra: 0 };
  };

  // ------------------------------------------------------------ aircraft art --
  function drawJet(ctx, x, y, s, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // afterburner
    const ab = 0.8 + 0.2 * Math.sin(t * 60);
    P.glowSprite(ctx, WT.sprites.orange, -92, 1, 90 * ab, 0.9);
    P.glowSprite(ctx, WT.sprites.hot, -88, 1, 36 * ab, 1);
    ctx.globalCompositeOperation = 'lighter';
    const cone = ctx.createLinearGradient(-86, 0, -150, 0);
    cone.addColorStop(0, 'rgba(255,190,110,0.9)'); cone.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = cone;
    ctx.beginPath(); ctx.moveTo(-84, -4); ctx.lineTo(-150 - 10 * ab, 1); ctx.lineTo(-84, 6); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    // far wing (darker)
    ctx.fillStyle = '#16191c';
    ctx.beginPath(); ctx.moveTo(14, -4); ctx.lineTo(-22, -4); ctx.lineTo(-44, -20); ctx.lineTo(-30, -20); ctx.fill();
    // fuselage
    const g = ctx.createLinearGradient(0, -10, 0, 10);
    g.addColorStop(0, '#6a7079'); g.addColorStop(0.45, '#33383e'); g.addColorStop(1, '#121417');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(100, 2); ctx.lineTo(62, -7); ctx.lineTo(-40, -9); ctx.lineTo(-80, -5); ctx.lineTo(-84, 5); ctx.lineTo(-40, 9); ctx.lineTo(62, 8); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1; ctx.stroke();
    // intake + canopy
    ctx.fillStyle = '#0b0c0d'; ctx.fillRect(8, 1, 26, 6);
    const cg = ctx.createLinearGradient(30, -14, 60, -6);
    cg.addColorStop(0, 'rgba(255,170,80,0.85)'); cg.addColorStop(1, 'rgba(40,30,30,0.9)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(46, -8, 18, 5, -0.06, Math.PI, 0); ctx.fill();
    // near wing, tail, stabiliser
    ctx.fillStyle = '#2a2e33';
    ctx.beginPath(); ctx.moveTo(18, 3); ctx.lineTo(-28, 3); ctx.lineTo(-58, 22); ctx.lineTo(-38, 22); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-50, -8); ctx.lineTo(-76, -36); ctx.lineTo(-88, -36); ctx.lineTo(-80, -6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-60, 5); ctx.lineTo(-86, 13); ctx.lineTo(-94, 13); ctx.lineTo(-82, 3); ctx.closePath(); ctx.fill();
    // missiles under the wing + nav light
    ctx.fillStyle = '#4b5057'; ctx.fillRect(-26, 23, 30, 3);
    if (Math.sin(t * 14) > 0.3) P.glowSprite(ctx, WT.sprites.red, -56, 22, 26, 1);
    ctx.restore();
  }

  function drawHeli(ctx, x, y, s, t, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);
    ctx.scale(s, s);
    // tail boom + fin + tail rotor
    ctx.fillStyle = '#1e2226';
    ctx.beginPath(); ctx.moveTo(-30, -10); ctx.lineTo(-150, -14); ctx.lineTo(-150, -6); ctx.lineTo(-30, 8); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-138, -12); ctx.lineTo(-160, -44); ctx.lineTo(-168, -44); ctx.lineTo(-156, -8); ctx.fill();
    ctx.strokeStyle = 'rgba(160,165,170,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-160, -26, 16, 0, 6.283); ctx.stroke();
    const ta = t * 50;
    ctx.strokeStyle = '#555b62'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-160 + Math.cos(ta) * 16, -26 + Math.sin(ta) * 16); ctx.lineTo(-160 - Math.cos(ta) * 16, -26 - Math.sin(ta) * 16); ctx.stroke();
    // body
    const g = ctx.createLinearGradient(0, -34, 0, 30);
    g.addColorStop(0, '#5c636b'); g.addColorStop(0.4, '#2c3136'); g.addColorStop(1, '#0f1113');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(70, 10); ctx.quadraticCurveTo(76, -18, 40, -28); ctx.lineTo(-20, -32); ctx.quadraticCurveTo(-46, -24, -46, 0);
    ctx.quadraticCurveTo(-44, 22, -10, 26); ctx.lineTo(50, 24); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    // canopy glass with warm reflection
    const cg = ctx.createLinearGradient(20, -26, 66, 4);
    cg.addColorStop(0, 'rgba(255,170,80,0.75)'); cg.addColorStop(1, 'rgba(30,25,25,0.95)');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.moveTo(66, 4); ctx.quadraticCurveTo(68, -16, 38, -24); ctx.lineTo(24, -22); ctx.lineTo(28, 2); ctx.closePath(); ctx.fill();
    // stub wing + rocket pod + minigun
    ctx.fillStyle = '#16191c'; ctx.fillRect(-18, 6, 40, 6);
    ctx.fillStyle = '#2a2e33'; U.roundRect(ctx, -14, 12, 34, 12, 5); ctx.fill();
    ctx.fillStyle = '#ff3b1f'; ctx.fillRect(18, 15, 3, 6);
    ctx.fillStyle = '#0c0d0f'; ctx.fillRect(60, 20, 26, 5);
    // skids
    ctx.strokeStyle = '#121416'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-30, 26); ctx.lineTo(-30, 36); ctx.moveTo(30, 24); ctx.lineTo(30, 36); ctx.moveTo(-50, 36); ctx.lineTo(50, 36); ctx.stroke();
    // rotor mast + blurred main rotor
    ctx.fillStyle = '#121416'; ctx.fillRect(-6, -44, 12, 14);
    ctx.fillStyle = 'rgba(120,125,130,0.18)';
    ctx.beginPath(); ctx.ellipse(0, -44, 150, 9, 0, 0, 6.283); ctx.fill();
    const ra = t * 32;
    ctx.strokeStyle = 'rgba(40,44,48,0.85)'; ctx.lineWidth = 4;
    for (let i = 0; i < 2; i++) {
      const c = Math.cos(ra + i * Math.PI / 2) * 150;
      ctx.beginPath(); ctx.moveTo(-c, -44); ctx.lineTo(c, -44); ctx.stroke();
    }
    if (Math.sin(t * 12) > 0.4) P.glowSprite(ctx, WT.sprites.red, -150, -10, 24, 1);
    ctx.restore();
  }

  function drawBomber(ctx, x, y, s, t, bayOpen) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    for (const ex of [-10, 60]) {
      P.glowSprite(ctx, WT.sprites.orange, ex - 50, 14, 50, 0.5 + 0.2 * Math.sin(t * 40 + ex));
    }
    const g = ctx.createLinearGradient(0, -18, 0, 18);
    g.addColorStop(0, '#5a6068'); g.addColorStop(0.5, '#2a2e33'); g.addColorStop(1, '#101214');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(190, 4); ctx.quadraticCurveTo(186, -14, 150, -16); ctx.lineTo(-170, -14); ctx.lineTo(-210, -8); ctx.lineTo(-212, 6); ctx.lineTo(-170, 14); ctx.lineTo(150, 16); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
    // tail fin
    ctx.fillStyle = '#25292e';
    ctx.beginPath(); ctx.moveTo(-150, -14); ctx.lineTo(-196, -78); ctx.lineTo(-218, -78); ctx.lineTo(-200, -8); ctx.closePath(); ctx.fill();
    // wing + engine pods
    ctx.fillStyle = '#1b1e22';
    ctx.beginPath(); ctx.moveTo(70, -6); ctx.lineTo(-40, -6); ctx.lineTo(-120, 12); ctx.lineTo(-60, 12); ctx.closePath(); ctx.fill();
    for (const ex of [-10, 60]) { ctx.fillStyle = '#2d3237'; U.roundRect(ctx, ex - 46, 8, 46, 12, 6); ctx.fill(); ctx.fillStyle = '#0a0a0b'; ctx.fillRect(ex - 2, 9, 3, 10); }
    // cockpit windows
    ctx.fillStyle = 'rgba(255,160,70,0.8)'; ctx.fillRect(150, -12, 22, 5);
    // bomb bay
    if (bayOpen) { ctx.fillStyle = '#050505'; ctx.fillRect(-60, 12, 110, 6); P.glowSprite(ctx, WT.sprites.red, 0, 18, 60, 0.4); }
    ctx.restore();
  }

  // Continuous vapour trail behind an aircraft: thin and bright at the engine, wide and faint behind.
  function drawContrail(ctx, x, y, len, alpha) {
    if (alpha <= 0 || x < -200) return;
    const x0 = x - len, g = ctx.createLinearGradient(x, 0, x0, 0);
    g.addColorStop(0, `rgba(225,228,232,${0.55 * alpha})`);
    g.addColorStop(0.4, `rgba(200,204,210,${0.22 * alpha})`);
    g.addColorStop(1, 'rgba(200,204,210,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y - 1.5); ctx.lineTo(x0, y - 14); ctx.lineTo(x0, y + 14); ctx.lineTo(x, y + 1.5);
    ctx.closePath();
    ctx.fill();
  }

  function drawTrefoil(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r * 0.18, 0, 6.283); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI / 2 + i * (2 * Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a - 0.5) * r * 0.28, y + Math.sin(a - 0.5) * r * 0.28);
      ctx.arc(x, y, r, a - 0.5, a + 0.5);
      ctx.arc(x, y, r * 0.28, a + 0.5, a - 0.5, true);
      ctx.fill();
    }
  }

  function drawIcon(ctx, kind, x, y, t) {
    if (kind === 'airstrike') drawJet(ctx, x + 6, y + 4, 0.48, t);
    else if (kind === 'chopper') drawHeli(ctx, x + 14, y + 12, 0.32, t, 0);
    else if (kind === 'carpet') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(0.6);
      ctx.fillStyle = '#d9d3c4'; U.roundRect(ctx, -12, -30, 24, 50, 12); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-14, 18); ctx.lineTo(14, 18); ctx.lineTo(18, 32); ctx.lineTo(-18, 32); ctx.fill();
      ctx.fillStyle = RED; ctx.fillRect(-12, -6, 24, 5);
      ctx.restore();
    } else if (kind === 'nuke') {
      ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(x, y, 38, 0, 6.283); ctx.fill();
      drawTrefoil(ctx, x, y, 32, '#111');
    } else {
      // supply crate on a parachute
      ctx.strokeStyle = '#cfc8b8'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 24, y - 16); ctx.lineTo(x - 10, y + 8); ctx.moveTo(x + 24, y - 16); ctx.lineTo(x + 10, y + 8); ctx.stroke();
      ctx.fillStyle = ACCENT; ctx.beginPath(); ctx.arc(x, y - 16, 26, Math.PI, 0); ctx.fill();
      P.crate(ctx, x - 14, y + 6, 28, 22, '', 'olive');
    }
  }

  // ------------------------------------------------------------- strikes --
  class Strike {
    constructor(mgr, g, t0, ks) {
      this.mgr = mgr; this.fx = mgr.fx; this.g = g; this.t0 = t0; this.ks = ks;
      this.dur = 3; this.fired = {}; this.acc = {};
    }
    once(key, cond, fn) { if (cond && !this.fired[key]) { this.fired[key] = true; fn(); } }
    every(key, rate, dt, fn) { this.acc[key] = (this.acc[key] || 0) + rate * dt; while (this.acc[key] >= 1) { this.acc[key] -= 1; fn(); } }
    get done() { return false; }
    update() {}
    drawBack() {}
    drawHud() {}
  }

  class Supply extends Strike {
    constructor(m, g, t0, ks) { super(m, g, t0, ks); this.dur = 2.6; }
  }

  class Airstrike extends Strike {
    constructor(m, g, t0, ks) {
      super(m, g, t0, ks);
      this.dur = 3.4;
      this.jets = [{ y: 290, dx: 0 }, { y: 330, dx: -170 }, { y: 360, dx: -330 }];
    }
    jetX(j, t) { return -260 + j.dx + (t - this.t0 - 0.25) * 2500; }
    update(t, dt) {
      const fx = this.fx, lt = t - this.t0;
      this.once('snd', lt > 0.1, () => this.mgr.sound.play('jet'));
      this.jets.forEach((j, i) => {
        const x = this.jetX(j, t);
        [380 + i * 140, 820 + i * 160].forEach((lx, k) => {
          this.once(`m${i}${k}`, x >= lx, () => {
            fx.missile(x + 10, j.y + 24, lx + 420 + fx.r(-60, 60), GROUND, { life: 0.5, end: 'ground', scale: 0.95, endLayer: 'back' });
            this.mgr.sound.play('clank', { gain: 0.5 });
          });
        });
      });
      this.once('boom', lt > 0.9, () => this.mgr.sound.play('explosion'));
    }
    drawBack(ctx, t) {
      const fade = 1 - U.inv(this.dur - 1.2, this.dur, t - this.t0);
      for (const j of this.jets) {
        const x = this.jetX(j, t);
        drawContrail(ctx, Math.min(x, 2400) - 100, j.y + 2, 1700, fade);
        if (x > -300 && x < 2300) drawJet(ctx, x, j.y, 1.2, t);
      }
    }
  }

  class Chopper extends Strike {
    constructor(m, g, t0, ks) { super(m, g, t0, ks); this.dur = 4.2; }
    pos(t) {
      const lt = t - this.t0;
      if (lt < 0.9) { const k = U.easeOutCubic(lt / 0.9); return { x: U.lerp(2150, 1500, k), y: U.lerp(330, 390, k), tilt: 0.12 * (1 - k) - 0.1 }; }
      if (lt < 3.2) { const k = (lt - 0.9) / 2.3; return { x: U.lerp(1500, 1120, k), y: 390 + Math.sin(lt * 3) * 8, tilt: -0.14 }; }
      const k = U.easeInCubic(Math.min(1, (lt - 3.2) / 1.0));
      return { x: U.lerp(1120, 2250, k), y: U.lerp(390, 230, k), tilt: 0.05 + 0.15 * k };
    }
    muzzle(p) { return { x: p.x + Math.cos(p.tilt) * 92 - Math.sin(p.tilt) * 30, y: p.y + Math.sin(p.tilt) * 92 + Math.cos(p.tilt) * 30 }; }
    update(t, dt) {
      const fx = this.fx, lt = t - this.t0, p = this.pos(t);
      this.once('snd', lt > 0, () => this.mgr.sound.play('chopper', { duration: this.dur }));
      if (lt > 1.0 && lt < 3.1) {
        this.once('gun', true, () => this.mgr.sound.play('minigun', { duration: 2.1 }));
        const tx = U.lerp(1350, 520, (lt - 1.0) / 2.1);
        this.every('mg', 26, dt, () => {
          const m = this.muzzle(p), ax = tx + fx.r(-40, 40) - m.x, ay = GROUND - m.y;
          fx.tracer(m.x, m.y, Math.atan2(ay, ax), { speed: 2800, len: 120, life: Math.hypot(ax, ay) / 2800, color: '255,200,110' });
          fx.flash(m.x, m.y, 40, Math.atan2(ay, ax), { life: 0.04 });
        });
        this.every('hit', 9, dt, () => {
          const x = tx + fx.r(-50, 50);
          fx.sparks(x, GROUND - 6, { n: 8, angle: -1.9, spread: 0.7, speed: 420 });
          fx.smoke(x, GROUND - 10, { n: 1, kind: 'warm', size: 40, alpha: 0.5, vy: -40, life: 1.2 });
          fx.flash(x, GROUND - 10, 70, 0, { life: 0.06, layer: 'back' });
        });
      }
      [1.7, 2.4].forEach((rt, i) => this.once('r' + i, lt >= rt, () => {
        fx.missile(p.x + 10, p.y + 24, U.lerp(1250, 700, i) + fx.r(-60, 60), GROUND, { life: 0.45, end: 'ground', scale: 1.1, endLayer: 'back' });
        this.mgr.sound.play('explosion', { gain: 0.8 });
      }));
    }
    drawBack(ctx, t) {
      const p = this.pos(t), lt = t - this.t0;
      // searchlight sweeping the ground
      const sa = U.envelope(lt, 0.5, 3.4, 0.3, 0.3);
      if (sa > 0) {
        const m = this.muzzle(p), gx = U.lerp(1300, 600, U.clamp((lt - 0.6) / 2.6, 0, 1));
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createLinearGradient(m.x, m.y, gx, GROUND);
        g.addColorStop(0, `rgba(255,230,190,${0.32 * sa})`); g.addColorStop(1, 'rgba(255,200,140,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(m.x - 6, m.y); ctx.lineTo(gx - 120, GROUND); ctx.lineTo(gx + 120, GROUND); ctx.lineTo(m.x + 6, m.y); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      drawHeli(ctx, p.x, p.y, 1.25, t, p.tilt);
    }
  }

  class CarpetBomb extends Strike {
    constructor(m, g, t0, ks) { super(m, g, t0, ks); this.dur = 4.4; this.y = 300; this.speed = 820; this.nextDrop = 140; }
    bx(t) { return -420 + (t - this.t0) * this.speed; }
    update(t, dt) {
      const fx = this.fx, x = this.bx(t);
      this.once('snd', t - this.t0 > 0.1, () => this.mgr.sound.play('jet', { gain: 0.7 }));
      while (x >= this.nextDrop && this.nextDrop < 1820) {
        const fall = Math.sqrt((2 * (GROUND - this.y - 20)) / 900);
        fx.add({ t: 'bomb', layer: 'back', x: this.nextDrop, y: this.y + 20, vx: this.speed * 0.85, vy: 0, g: 900, drag: 0, life: fall, end: 'ground', scale: 1.15, endLayer: 'back' });
        this.nextDrop += 105;
        if (this.nextDrop % 315 < 105) this.mgr.sound.play('explosion', { gain: 0.6, delay: fall });
      }
    }
    drawBack(ctx, t) {
      const x = this.bx(t), fade = 1 - U.inv(this.dur - 1, this.dur, t - this.t0);
      for (const ex of [-60, 10]) drawContrail(ctx, Math.min(x, 2500) + (ex - 50) * 1.3, this.y + 20, 1400, fade * 0.8);
      if (x > -500 && x < 2400) drawBomber(ctx, x, this.y, 1.3, t, x > 80 && x < 1840);
    }
  }

  class Nuke extends Strike {
    constructor(m, g, t0, ks) {
      super(m, g, t0, ks);
      this.dur = 6.6; this.X = 1380; this.det = 2.4;
    }
    update(t, dt) {
      const fx = this.fx, lt = t - this.t0, d = lt - this.det;
      this.once('siren', lt >= 0, () => this.mgr.sound.play('siren', { duration: 2.4 }));
      this.once('missile', lt >= 1.85, () => fx.add({ t: 'missile', layer: 'back', x: this.X + 160, y: -60, vx: -160 / 0.55, vy: (GROUND + 60) / 0.55, life: 0.55, drag: 0, scale: 1.6 }));
      this.once('det', d >= 0, () => {
        fx.groundBlast(this.X, GROUND, 2.4, { layer: 'back' });
        fx.explosion(this.X, GROUND - 120, 2, { layer: 'back' });
        fx.shake(30, 1.4);
        this.mgr.sound.play('explosion', { gain: 2 });
        this.mgr.sound.play('rumble', { duration: 4, gain: 1.6 });
      });
      if (d > 0 && d < 3.8) {
        const rise = U.easeOutCubic(Math.min(1, d / 2.6)), capY = U.lerp(GROUND - 120, 380, rise);
        const rx = U.lerp(90, 250, rise), ry = rx * 0.42;
        // stem
        this.every('stem', 50 * fx.mult, dt, () => {
          const y = fx.r(capY, GROUND);
          fx.fire(this.X + fx.r(-28, 28) * (1 + (GROUND - y) / 900), y, { n: 1, size: 40, vy: -120, life: 0.9, layer: 'back' });
          if (fx.rnd() < 0.5) fx.smoke(this.X + fx.r(-40, 40), y, { n: 1, kind: 'warm', size: 60, vy: -80, jitter: 20, life: 2.2, alpha: 0.5, layer: 'back' });
        });
        // rolling cap
        this.every('cap', 70 * fx.mult, dt, () => {
          const a = fx.r(0, 6.283), px = this.X + Math.cos(a) * rx, py = capY + Math.sin(a) * ry;
          const roll = Math.sin(a) < 0 ? 1 : -1; // top rolls outward, bottom rolls inward
          fx.smoke(px, py, { n: 1, kind: fx.rnd() < 0.6 ? 'soot' : 'warm', size: fx.r(90, 170), vx: Math.cos(a) * 60 * roll, vy: -30, jitter: 15, life: 2.8, alpha: 1, layer: 'back', grow: 1.5 });
          if (fx.rnd() < 0.35) fx.fire(this.X + Math.cos(a) * rx * 0.5, capY + Math.abs(Math.sin(a)) * ry * 0.5, { n: 1, size: 60, vy: -10, life: 0.8, layer: 'back', g: 0 });
        });
        // dust wall rolling out along the ground
        if (d < 1.6) this.every('dust', 40 * fx.mult, dt, () => {
          const dir = fx.rnd() < 0.5 ? -1 : 1, r = d * 1100;
          fx.smoke(this.X + dir * r, GROUND - fx.r(0, 40), { n: 1, kind: 'warm', size: 110, vx: dir * 300, vy: -20, life: 1.6, alpha: 0.6, layer: 'back' });
        });
        this.every('ash', 25, dt, () => fx.embers(fx.r(0, 1920), fx.r(200, 700), { n: 1, lift: -0.4, spread: 10 }));
      }
    }
    drawBack(ctx, t) {
      const d = t - this.t0 - this.det;
      if (d <= 0) return;
      const rise = U.easeOutCubic(Math.min(1, d / 2.6)), capY = U.lerp(GROUND - 120, 380, rise);
      const fade = 1 - U.inv(2.6, 4.0, d);
      // procedural mushroom body under the particle texture: dark rolling cap with a burning underside
      const rx = U.lerp(90, 250, rise) * 1.25, ry = rx * 0.5, sa = 0.9 * fade;
      const sg = ctx.createLinearGradient(this.X - 70, 0, this.X + 70, 0);
      sg.addColorStop(0, 'rgba(50,30,20,0)'); sg.addColorStop(0.3, `rgba(90,45,22,${0.75 * sa})`);
      sg.addColorStop(0.5, `rgba(255,150,60,${0.85 * sa})`); sg.addColorStop(0.7, `rgba(90,45,22,${0.75 * sa})`); sg.addColorStop(1, 'rgba(50,30,20,0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(this.X - 34, capY); ctx.lineTo(this.X + 34, capY);
      ctx.lineTo(this.X + 60 + (GROUND - capY) * 0.04, GROUND); ctx.lineTo(this.X - 60 - (GROUND - capY) * 0.04, GROUND); ctx.closePath();
      ctx.fill();
      const cg = ctx.createRadialGradient(this.X, capY + ry * 0.35, 0, this.X, capY, rx);
      cg.addColorStop(0, `rgba(255,180,90,${0.95 * sa})`); cg.addColorStop(0.35, `rgba(200,80,30,${0.85 * sa})`);
      cg.addColorStop(0.75, `rgba(48,26,18,${0.9 * sa})`); cg.addColorStop(1, 'rgba(30,20,16,0)');
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.ellipse(this.X, capY, rx, ry, 0, 0, 6.283); ctx.fill();
      // skirt ring around the stem
      ctx.fillStyle = `rgba(70,40,26,${0.55 * sa})`;
      ctx.beginPath(); ctx.ellipse(this.X, U.lerp(capY, GROUND, 0.45), rx * 0.5, ry * 0.3, 0, 0, 6.283); ctx.fill();
      // glowing core of the cap + stem
      P.glowSprite(ctx, WT.sprites.orange, this.X, capY, 700 * (0.6 + rise * 0.6), 0.6 * fade);
      P.glowSprite(ctx, WT.sprites.hot, this.X, capY, 260, 0.6 * fade);
      P.glowSprite(ctx, WT.sprites.orange, this.X, GROUND - 60, 900, 0.6 * fade);
      // shockwave ellipse racing along the ground
      if (d < 1.6) {
        const k = d / 1.6, rx = 2400 * U.easeOutCubic(k);
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = `rgba(255,220,170,${0.8 * (1 - k)})`;
        ctx.lineWidth = 16 * (1 - k) + 2;
        ctx.beginPath(); ctx.ellipse(this.X, GROUND - 20, rx, rx * 0.12, 0, 0, 6.283); ctx.stroke();
        ctx.strokeStyle = `rgba(255,160,90,${0.5 * (1 - k)})`;
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.arc(this.X, GROUND - 120, rx * 0.5, Math.PI, 0); ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    drawHud(ctx, t) {
      const lt = t - this.t0, d = lt - this.det;
      if (lt < this.det) {
        // red alarm vignette + countdown
        const pulse = 0.5 + 0.5 * Math.sin(lt * 14);
        const g = ctx.createRadialGradient(960, 540, 380, 960, 540, 1150);
        g.addColorStop(0, 'rgba(255,20,10,0)'); g.addColorStop(1, `rgba(255,20,10,${0.25 + 0.25 * pulse})`);
        ctx.fillStyle = g; ctx.fillRect(-100, -100, 2120, 1280);
        const n = Math.max(1, 3 - Math.floor(lt / 0.8)), k = (lt % 0.8) / 0.8;
        ctx.save();
        ctx.globalAlpha = 1 - k * 0.6;
        ctx.translate(960, 290); ctx.scale(1.6 - 0.6 * U.easeOutCubic(k), 1.6 - 0.6 * U.easeOutCubic(k));
        P.glowText(ctx, String(n), 0, 0, 170, RED, { glowColor: RED, core: '#ffd0c8', blur: 40 });
        ctx.restore();
        P.glowText(ctx, 'TACTICAL NUKE INCOMING', 960, 140, 48, RED, { glowColor: RED, core: '#ffe0d8', blur: 18 });
      }
      if (d > 0 && d < 1.2) {
        const k = d / 1.2;
        ctx.fillStyle = `rgba(255,252,240,${0.92 * Math.pow(1 - k, 2)})`;
        ctx.fillRect(-100, -100, 2120, 1280);
      }
      if (d > 0 && d < 3.5) {
        ctx.fillStyle = `rgba(255,110,40,${0.16 * (1 - d / 3.5)})`;
        ctx.fillRect(-100, -100, 2120, 1280);
      }
    }
  }

  const KINDS = { supply: Supply, airstrike: Airstrike, chopper: Chopper, carpet: CarpetBomb, nuke: Nuke };

  class StrikeManager {
    constructor(fx, sound) { this.fx = fx; this.sound = sound; this.list = []; }
    start(g, t0) {
      const ks = WT.killstreakFor(g.giftCount), K = KINDS[ks.kind] || Supply;
      const s = new K(this, g, t0, ks);
      this.list.push(s);
      return s;
    }
    update(t, dt) {
      for (const s of this.list) if (t >= s.t0) s.update(t, dt);
      this.list = this.list.filter((s) => t < s.t0 + s.dur + 0.5);
    }
    drawBack(ctx, t) { for (const s of this.list) if (t >= s.t0) s.drawBack(ctx, t); }
    drawHud(ctx, t) {
      for (const s of this.list) {
        if (t < s.t0) continue;
        s.drawHud(ctx, t);
        this.drawCard(ctx, s, t);
      }
    }
    // CoD-style killstreak card at the top of the screen.
    drawCard(ctx, s, t) {
      const lt = t - s.t0, nuke = s.ks.kind === 'nuke';
      const cardT = nuke ? lt - s.det - 0.4 : lt; // nuke card appears after the white-out
      const a = U.envelope(cardT, 0, 2.9, 0.2, 0.4);
      if (a <= 0) return;
      const w = 820, h = 128, x = 960 - w / 2;
      const y = 120 - (1 - U.easeOutBack(U.inv(0, 0.3, cardT))) * 160;
      const glitch = cardT < 0.25 ? (Math.sin(t * 190) * 14) : 0;
      const col = nuke ? '#ffd23a' : s.ks.kind === 'supply' ? ACCENT : GOLD;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(glitch, 0);
      const bg = ctx.createLinearGradient(x, 0, x + w, 0);
      bg.addColorStop(0, 'rgba(8,8,9,0.94)'); bg.addColorStop(1, 'rgba(20,14,10,0.9)');
      ctx.fillStyle = bg;
      U.chamfer(ctx, x, y, w, h, 14); ctx.fill();
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 20; ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
      // icon tile
      ctx.fillStyle = 'rgba(255,122,26,0.12)';
      U.chamfer(ctx, x + 10, y + 10, h - 20, h - 20, 10); ctx.fill();
      drawIcon(ctx, s.ks.kind, x + h / 2, y + h / 2, t);
      // texts
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = `600 18px ${P.FONT_UI}`; ctx.fillStyle = '#ffb070';
      const n = s.g.giftCount;
      ctx.fillText(s.ks.kind === 'supply' ? `NEW SUB GIFTER  •  ×${n}` : `SUB BOMB  •  ×${n} GIFTED SUBS`, x + h + 8, y + 34);
      U.fitFont(ctx, s.ks.label, w - h - 30, 54, P.FONT_STENCIL);
      ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.fillStyle = col; ctx.fillText(s.ks.label, x + h + 8, y + 86); ctx.restore();
      ctx.fillStyle = '#f4efe6';
      U.fitFont(ctx, `CALLED IN BY ${U.cleanName(s.g.username).toUpperCase()}`, w - h - 30, 20, P.FONT_UI, '700');
      ctx.fillText(`CALLED IN BY ${U.cleanName(s.g.username).toUpperCase()}`, x + h + 8, y + 113);
      // scanline sweep
      const sw = U.inv(0, 0.6, cardT);
      if (sw < 1) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,170,90,0.25)'; ctx.fillRect(x + w * sw - 40, y, 40, h); }
      ctx.restore();
    }
  }

  WT.StrikeManager = StrikeManager;
  WT.drawJet = drawJet;
  WT.drawHeli = drawHeli;
})(window.WT);
