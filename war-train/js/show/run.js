/* War Train — one 15-second train pass (six scenes). A Run owns the train composition, the motion
   curve, every timed cue (cannon fire, steam, sound) and the HUD text. Scene timing:
     1  0–2s    approach out of the smoke          4   7–10s  HYPE TRAIN / BLACK OPS / WARZONE pass
     2  2–4s    armored locomotive + turret fire   5  10–13s  heavy artillery + THANK YOU celebration
     3  4–7s    SUB GIFTER cannon wagon(s)         6  13–15s  caboose exits, tail lights fade
   Every extra gifter wagon in the same pass stretches scene 3 by cfg.extraGifterSeconds (G). */
window.WT = window.WT || {};
(function (WT) {
  'use strict';
  const U = WT.U, P = WT.P;
  const C = 960, GAP = 26;
  const ACCENT = '#ff7a1a', GOLD = '#ffc840';

  class Run {
    constructor(ctrl, payload) {
      const cfg = WT.cfg;
      this.ctrl = ctrl;
      this.fx = ctrl.fx;
      this.sound = ctrl.sound;
      this.p = payload;
      const n = payload.gifters.length;
      const G = (this.G = Math.max(0, n - 1) * cfg.extraGifterSeconds);
      this.D = cfg.showDuration + G;

      // --- composition (front → rear) -------------------------------------
      this.loco = new WT.Locomotive();
      this.gifterCars = payload.gifters.map((g) => new WT.GifterCannonWagon(g));
      this.hype = new WT.ThemedWagon('hype', { hype: payload.hype, t0: 7 + G - 0.8 });
      this.blackops = new WT.ThemedWagon('blackops', { recruits: payload.recruits.slice(0, 2) });
      this.warzone = new WT.ThemedWagon('warzone', { recruits: payload.recruits.slice(2, 4) });
      this.art = new WT.ArtilleryWagon();
      this.caboose = new WT.Caboose();
      this.cars = [this.loco, ...this.gifterCars, this.hype, this.blackops, this.warzone, this.art, this.caboose];
      let x = 0;
      for (const car of this.cars) {
        car.left = x - car.w;
        x = car.left - GAP;
        car.build();
      }

      // --- motion curve: screen x of the train front over time ------------
      const ctr = (car, shift) => C + (shift || 0) - (car.left + car.w / 2);
      const K = [[0, -760], [1.2, 150], [3.0, ctr(this.loco)]];
      this.gifterCars.forEach((car, i) => {
        const Tc = 5.5 + i * cfg.extraGifterSeconds;
        K.push([Tc - 0.9, ctr(car, -75)], [Tc + 0.9, ctr(car, 75)]);
        car.schedule(Tc);
      });
      K.push([8.3 + G, ctr(this.blackops)]);
      K.push([10.6 + G, ctr(this.art, -60)], [12.4 + G, ctr(this.art, 60)]);
      const exitOff = 1990 - this.caboose.left;
      K.push([14.6 + G, exitOff], [15 + G, exitOff + 520]);
      this.off = U.monotone(K.map((k) => k[0]), K.map((k) => k[1]));

      this.cues = [];
      this.buildCues();
      this.cues.sort((a, b) => a.t - b.t);
      this.ci = 0;
      this.prevT = -1;
      this.acc = {};
    }

    vel(t) { return (this.off(t + 0.01) - this.off(t - 0.01)) / 0.02; }
    sxOf(car, t) { return car.left + this.off(t); }
    at(t, fn) { this.cues.push({ t, fn }); }

    fire(car, gun, t, o) {
      o = o || {};
      const sx = this.sxOf(car, t), dy = car.bob(sx, t);
      gun.lastFire = t;
      const m = gun.muzzle(sx, dy, t);
      if (o.tracer) {
        this.fx.tracer(m.x, m.y, m.a + this.fx.r(-0.05, 0.05), { len: 110 });
        this.fx.flash(m.x, m.y, 50, m.a, { life: 0.05 });
        return m;
      }
      this.fx.muzzle(m.x, m.y, m.a, o.scale || 1);
      if (o.target) this.fx.blast(m.x, m.y, m.a, { target: o.target, life: o.life || 0.55, gold: o.gold, scale: o.burst || 1, size: o.size || 24 });
      this.fx.shake(o.shake || 6, 0.25);
      this.sound.play('cannon', { gain: o.gain || 1 });
      return m;
    }

    buildCues() {
      const G = this.G, fx = this.fx, D = this.D;
      // Scene 1 — approach
      this.at(0.05, () => this.sound.play('rumble', { duration: D - 0.3 }));
      this.at(0.7, () => this.sound.play('whistle'));
      // Scene 2 — locomotive
      const tur = this.loco.turret, mg = this.loco.mg;
      tur.aimTo(1.9, 2.4, -0.34);
      tur.aimTo(3.7, 4.3, -0.1);
      mg.aimTo(2.0, 2.2, -0.3);
      this.at(2.0, () => this.sound.play('clank'));
      this.at(2.55, () => this.fire(this.loco, tur, 2.55, { target: [1500, 300], shake: 8 }));
      this.at(3.3, () => this.fire(this.loco, tur, 3.3, { target: [1680, 360], shake: 8 }));
      this.at(3.0, () => {
        const sx = this.sxOf(this.loco, 3), dy = this.loco.bob(sx, 3);
        fx.steam(sx + 300, 682 + dy, { n: 8 });
        fx.steam(sx + 460, 682 + dy, { n: 8 });
        for (const b of [90, 300, 560]) fx.steam(sx + b, 905, { n: 4, vx: -160, vy: -30, size: 40 });
        this.sound.play('steam');
      });
      for (let tt = 2.25; tt < 3.85; tt += 0.075) {
        if ((tt > 2.7 && tt < 2.95)) continue; // short pause between bursts
        this.at(tt, ((T) => () => { this.fire(this.loco, mg, T, { tracer: true }); })(tt));
      }
      // Scene 3 — gifter cannon wagons
      this.gifterCars.forEach((car) => {
        const g = car.g;
        this.at(car.Tc - 1.65, () => this.sound.play('clank'));
        this.at(car.Tc - 0.55, () => this.sound.play('reload'));
        car.shotTimes.forEach((st, k) => {
          this.at(st, () => {
            const m = this.fire(car, car.cannon, st, {
              target: null, scale: k === 0 ? 1.5 : 1.1, shake: k === 0 ? 14 : 8, gain: 1.3,
            });
            fx.blast(m.x, m.y, m.a, { target: [m.x + 470 + k * 60, m.y - 300 - k * 40], life: 0.55, gold: g.giftCount >= 10 || k === 0, scale: k === 0 ? 1.4 : 1, size: k === 0 ? 30 : 22 });
            if (k === 0) {
              this.ctrl.onGifterFired(g);
              this.sound.play('sting', { gain: 0.8 });
            }
          });
        });
        this.at(car.Tc + 1.6, () => this.sound.play('reload'));
      });
      // Scene 4 — themed wagons
      for (let tt = 7.0 + G; tt < 8.5 + G; tt += 0.09) {
        this.at(tt, ((T) => () => { this.hype.guns.forEach((gn) => this.fire(this.hype, gn, T, { tracer: true })); })(tt));
      }
      this.at(8.4 + G, () => this.fire(this.blackops, this.blackops.guns[0], 8.4 + G, { tracer: true }));
      this.warzone.guns[0].aimTo(8.6 + G, 9.1 + G, -0.55);
      this.at(9.45 + G, () => this.fire(this.warzone, this.warzone.guns[0], 9.45 + G, { target: [1450, 280], shake: 9 }));
      // Scene 5 — heavy artillery volleys
      const Ta = 11.5 + G, ag = this.art.guns;
      ag[0].aimTo(9.9 + G, 10.5 + G, -0.72);
      ag[1].aimTo(9.9 + G, 10.5 + G, -0.98);
      ag[2].aimTo(9.9 + G, 10.5 + G, -0.62);
      const targets = [[[560, 250], [960, 150], [1360, 250]], [[700, 330], [1080, 200], [1500, 300]], [[460, 320], [860, 210], [1240, 160]]];
      [Ta - 0.9, Ta - 0.1, Ta + 0.7].forEach((tv, v) => {
        if (v === 0) this.at(tv, () => this.sound.play('sting', { gain: 1.2 }));
        ag.forEach((gn, i) => {
          const T = tv + i * 0.05;
          this.at(T, () => this.fire(this.art, gn, T, { target: targets[v][i], gold: true, burst: i === 1 ? 1.5 : 1.15, scale: i === 1 ? 1.6 : 1.1, shake: 16, life: 0.5, size: i === 1 ? 32 : 24 }));
        });
      });
      ag.forEach((gn, i) => gn.aimTo(Ta + 1.3, Ta + 2.0, gn.rest));
      // Scene 6 — departure
      this.at(13.1 + G, () => this.sound.play('whistle', { gain: 0.6 }));
      this.at(13.3 + G, () => {
        const sx = this.sxOf(this.caboose, 13.3 + G);
        fx.steam(sx + 30, 880, { n: 5, vx: -220, vy: -30, size: 36, alpha: 0.35 });
        this.sound.play('steam');
      });
      this.caboose.guns[0].aimTo(12.6 + G, 13.0 + G, -0.4);
    }

    // emit `rate` particles per second deterministically
    every(key, rate, dt, fn) {
      this.acc[key] = (this.acc[key] || 0) + rate * dt;
      while (this.acc[key] >= 1) { this.acc[key] -= 1; fn(); }
    }

    update(t, dt) {
      while (this.ci < this.cues.length && this.cues[this.ci].t <= t) {
        if (this.cues[this.ci].t > this.prevT) this.cues[this.ci].fn();
        this.ci++;
      }
      this.prevT = t;
      const fx = this.fx, D = this.D, off = this.off(t), v = this.vel(t);
      const acc = (this.vel(t + 0.05) - this.vel(t - 0.05)) / 0.1;

      // battlefield smoke banks — heavy at the start, thin later, none near the end so the loop is clean
      const bankRate = t < 2.4 ? 14 : t < D - 4.6 ? 2.2 : 0;
      this.every('bank', bankRate * fx.mult, dt, () => fx.smoke(fx.r(-100, 2000), fx.r(830, 950), { n: 1, size: fx.r(130, 230), life: 3.6, alpha: 0.5, vx: 30, vy: -8, jitter: 10, grow: 1.4 }));
      // distant muzzle flashes / tracers on the horizon
      if (t < 2.8 || (t > 9 + this.G && t < 12.8 + this.G)) {
        this.every('dist', 5, dt, () => {
          const x = fx.r(t < 2.8 ? 700 : 100, 1880), y = fx.r(560, 780);
          fx.flash(x, y, fx.r(50, 120), 0, { layer: 'back', alpha: 0.45, life: 0.09 });
          if (fx.rnd() < 0.5) fx.tracer(x, y, fx.r(-1.2, -0.6), { layer: 'back', speed: 1400, len: 60, life: 0.35, color: '255,140,60' });
        });
      }
      // locomotive stack smoke + embers
      const lsx = this.sxOf(this.loco, t);
      if (lsx > -720 && lsx < 1960) {
        const s = this.loco.stack(lsx, this.loco.bob(lsx, t));
        this.every('stack', 26, dt, () => fx.smoke(s.x, s.y, { n: 1, vx: -90, vy: -150, size: 34, grow: 3.2, life: 2.2, alpha: 0.85, jitter: 25 }));
        this.every('stackE', 6, dt, () => fx.embers(s.x, s.y, { n: 1, spread: 10, lift: 2 }));
      }
      // wheel sparks while braking, hot rail embers under the train
      const front = off, rear = this.caboose.left + off;
      if (acc < -260) {
        this.every('brake', 40, dt, () => {
          const car = this.cars[(fx.rnd() * this.cars.length) | 0], sx = car.left + off;
          const b = car.bogies[(fx.rnd() * car.bogies.length) | 0];
          if (sx + b > 0 && sx + b < 1920) fx.sparks(sx + b + fx.r(-40, 40), 944, { n: 4, angle: -2.6, spread: 0.5, speed: 380, gravity: 900 });
        });
      }
      this.every('rail', 9, dt, () => {
        const x = fx.r(Math.max(0, rear), Math.min(1920, front));
        if (front > 0 && rear < 1920) fx.embers(x, 944, { n: 1, spread: 4 });
      });
      // scene 3 charge-up: energy converging on each gifter cannon muzzle
      for (const car of this.gifterCars) {
        const c = car.cannon;
        if (t > c.chargeFrom && t < c.chargeTo) {
          const sx = this.sxOf(car, t), m = c.muzzle(sx, car.bob(sx, t), t);
          this.every('chg' + car.g.username, 70, dt, () => {
            const a = fx.r(0, 6.283), r = fx.r(70, 150);
            fx.add({ t: 'ember', x: m.x + Math.cos(a) * r, y: m.y + Math.sin(a) * r, vx: -Math.cos(a) * r / 0.28, vy: -Math.sin(a) * r / 0.28, life: 0.28, g: 0, drag: 0, size: fx.r(2, 4), ph: 0, layer: 'front' });
          });
        }
      }
      // scene 5: embers raining from the sky
      if (t > 10.4 + this.G && t < 13 + this.G) this.every('rain', 30, dt, () => fx.embers(fx.r(200, 1720), fx.r(150, 400), { n: 1, lift: -0.6, spread: 20 }));
      // scene 6: smoke swallowing the tail
      if (t > 13.2 + this.G && t < D - 0.6) {
        const sx = this.sxOf(this.caboose, t);
        this.every('tail', 14, dt, () => fx.smoke(sx + fx.r(-20, 60), fx.r(760, 900), { n: 1, size: 90, alpha: 0.55, vx: -40, vy: -20, life: 1.6, layer: 'front' }));
      }
      this.speed = v;
    }

    // ------------------------------------------------------------- drawing --
    draw(ctx, t) {
      const off = this.off(t), v = this.vel(t), D = this.D;
      const st = { t, wheelAng: off / P.WHEEL_R, speed: Math.abs(v), tailFade: 1 - U.inv(13.9 + this.G, 14.8 + this.G, t) };
      this.drawGround(ctx, t, off);
      this.fx.draw(ctx, 'back');
      this.drawBeam(ctx, t, off);
      const dys = [];
      for (const car of this.cars) {
        const sx = car.left + off;
        if (sx > 2150 || sx + car.w < -250) { dys.push(0); continue; }
        dys.push(car.draw(ctx, sx, st));
      }
      // couplers
      for (let i = 0; i < this.cars.length - 1; i++) {
        const a = this.cars[i], b = this.cars[i + 1];
        const x1 = b.left + b.w + off - 6, x2 = a.left + off + 6;
        if (x2 < -50 || x1 > 1970) continue;
        const y = 880 + (dys[i] + dys[i + 1]) / 2;
        ctx.fillStyle = '#0d0e10'; ctx.fillRect(x1, y - 4, x2 - x1, 8);
        P.chain(ctx, x1, y + 6, x2, y + 6, 5);
      }
      this.fx.draw(ctx, 'front');
      this.drawHud(ctx, t);
    }

    drawGround(ctx, t, off) {
      const D = this.D, rA = U.envelope(t, 0, D, 0.8, 1.0), Y = WT.cfg.railY;
      if (rA <= 0) return;
      ctx.globalAlpha = rA;
      const g = ctx.createLinearGradient(0, Y - 10, 0, Y + 60);
      g.addColorStop(0, 'rgba(10,8,7,0.0)');
      g.addColorStop(0.2, 'rgba(10,8,7,0.7)');
      g.addColorStop(1, 'rgba(10,8,7,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, Y - 10, 1920, 70);
      ctx.fillStyle = '#2a2420';
      for (let x = 0; x < 1920; x += 40) ctx.fillRect(x, Y + 4, 26, 10);
      const rg = ctx.createLinearGradient(0, Y - 4, 0, Y + 6);
      rg.addColorStop(0, '#8d949c'); rg.addColorStop(0.4, '#3a3f45'); rg.addColorStop(1, '#151719');
      ctx.fillStyle = rg;
      ctx.fillRect(0, Y - 4, 1920, 9);
      // glowing rail: faint everywhere, hot under the train
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.22 + 0.08 * Math.sin(t * 5);
      ctx.fillStyle = `rgba(255,110,30,${pulse})`;
      ctx.fillRect(0, Y - 4, 1920, 2);
      const front = off + 600, rear = this.caboose.left + off - 300;
      const a = Math.max(0, rear), b = Math.min(1920, front);
      if (b > a) {
        const hg = ctx.createLinearGradient(rear, 0, front, 0);
        hg.addColorStop(0, 'rgba(255,90,20,0)');
        hg.addColorStop(0.15, 'rgba(255,110,30,0.55)');
        hg.addColorStop(0.85, 'rgba(255,130,40,0.55)');
        hg.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = hg;
        ctx.fillRect(a, Y - 6, b - a, 5);
        ctx.globalAlpha = rA * 0.5;
        ctx.fillRect(a, Y - 18, b - a, 16);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    drawBeam(ctx, t, off) {
      const lsx = this.sxOf(this.loco, t);
      const h = this.loco.headlight(lsx, this.loco.bob(lsx, t));
      if (h.x > 2100) return;
      const a = U.envelope(t, 0.1, 6, 0.8, 1.5) * (0.9 + 0.1 * Math.sin(t * 40));
      if (a <= 0) return;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      const g = ctx.createLinearGradient(h.x, 0, h.x + 1100, 0);
      g.addColorStop(0, 'rgba(255,200,140,0.45)');
      g.addColorStop(0.3, 'rgba(255,140,60,0.16)');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y - 10); ctx.lineTo(h.x + 1100, h.y - 170); ctx.lineTo(h.x + 1100, h.y + 190); ctx.lineTo(h.x, h.y + 10);
      ctx.closePath();
      ctx.fill();
      // glare when the lamp is still hidden behind the left edge: "lights emerging from the smoke"
      P.glowSprite(ctx, WT.sprites.orange, Math.max(h.x, -40), h.y, 420, a * 0.7);
      P.glowSprite(ctx, WT.sprites.white, Math.max(h.x, -40), h.y, 160, a * 0.8);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    drawHud(ctx, t) {
      const G = this.G, L = WT.cfg.labels;
      // Scene 1: tactical "incoming" readout
      const ia = U.envelope(t, 0.25, 2.7, 0.2, 0.4);
      if (ia > 0) {
        ctx.globalAlpha = ia * (Math.sin(t * 18) > -0.6 ? 1 : 0.4);
        const txt = L.incoming.slice(0, Math.floor(U.inv(0.3, 1.2, t) * L.incoming.length));
        ctx.fillStyle = ACCENT;
        ctx.beginPath(); ctx.moveTo(130, 452); ctx.lineTo(150, 488); ctx.lineTo(110, 488); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#111'; ctx.font = `bold 24px ${P.FONT_UI}`; ctx.textAlign = 'center'; ctx.fillText('!', 130, 484);
        P.glowText(ctx, txt, 170, 472, 34, '#ffd2a8', { align: 'left', glowColor: ACCENT, blur: 14 });
        ctx.fillStyle = 'rgba(255,122,26,0.6)';
        ctx.fillRect(110, 500, 520 * U.inv(0.3, 1.4, t), 2);
        ctx.globalAlpha = 1;
      }
      // Scene 4: hype train level-up / completion banner above the HYPE TRAIN wagon
      const hy = this.p.hype;
      if (hy && hy.event) {
        const ba = U.envelope(t, 6.6 + G, 9.8 + G, 0.3, 0.5);
        if (ba > 0) {
          const hx = U.clamp(this.sxOf(this.hype, t) + this.hype.w / 2, 360, 1560);
          const s = U.easeOutBack(U.inv(6.6 + G, 7.0 + G, t));
          ctx.save(); ctx.globalAlpha = ba; ctx.translate(hx, 600); ctx.scale(s, s);
          const txt = hy.event === 'complete' ? `HYPE TRAIN COMPLETE — LEVEL ${hy.level}` : `HYPE TRAIN LEVEL ${hy.level}!`;
          P.glowText(ctx, txt, 0, 0, 50, GOLD, { glowColor: ACCENT, core: '#fff1cc', blur: 26 });
          ctx.restore();
        }
      }
      // Scene 5: THANK YOU, SUB GIFTERS!
      const ta = U.envelope(t, 10.15 + G, 13.9 + G, 0.15, 0.9);
      if (ta > 0) this.drawThanks(ctx, t, ta);
    }

    drawThanks(ctx, t, alpha) {
      const G = this.G, L = WT.cfg.labels, t0 = 10.15 + G;
      ctx.save();
      ctx.globalAlpha = alpha;
      // soft dark backing so the text stays readable over any game
      const bg = ctx.createLinearGradient(0, 220, 0, 520);
      bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(0.3, 'rgba(5,4,3,0.55)'); bg.addColorStop(0.75, 'rgba(5,4,3,0.55)'); bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 220, 1920, 300);
      // title slam
      const k = U.inv(t0, t0 + 0.35, t), s = 1.7 - 0.7 * U.easeOutCubic(k);
      ctx.save();
      ctx.translate(C, 300);
      ctx.scale(s, s);
      ctx.font = `86px ${P.FONT_STENCIL}`;
      const size = U.fitFont(ctx, L.thanks, 1500, 86, P.FONT_STENCIL);
      P.glowText(ctx, L.thanks, 0, 0, size, ACCENT, { core: '#ffe6cc', blur: 30 });
      ctx.restore();
      if (k < 1) P.glowSprite(ctx, WT.sprites.white, C, 300, 1200 * (1 - k), (1 - k) * 0.6);
      // rule lines
      const lw = 700 * U.easeOutCubic(U.inv(t0 + 0.2, t0 + 0.7, t));
      ctx.fillStyle = ACCENT;
      ctx.fillRect(C - lw, 352, lw * 2, 2);
      // roster chips (most recent gifters) — measured so they never overlap
      const list = this.p.recent.slice(0, 5);
      ctx.font = `700 30px ${P.FONT_UI}`;
      let fs = 30;
      const measure = () => list.map((g) => ctx.measureText(`${U.cleanName(g.username)}  ×${g.giftCount}`).width + 76);
      let widths = measure();
      while (widths.reduce((a, b) => a + b, 0) + (list.length - 1) * 18 > 1760 && fs > 16) {
        fs -= 2; ctx.font = `700 ${fs}px ${P.FONT_UI}`; widths = measure();
      }
      const total = widths.reduce((a, b) => a + b, 0) + (list.length - 1) * 18;
      let cx = C - total / 2;
      list.forEach((g, i) => {
        const a = U.inv(t0 + 0.45 + i * 0.12, t0 + 0.75 + i * 0.12, t);
        if (a > 0) {
          const w = widths[i], y = 390 + (1 - U.easeOutBack(a)) * 30;
          ctx.globalAlpha = alpha * a;
          ctx.fillStyle = 'rgba(10,10,11,0.9)';
          U.chamfer(ctx, cx, y, w, fs + 26, 8); ctx.fill();
          ctx.strokeStyle = i === 0 ? GOLD : ACCENT; ctx.lineWidth = 2; ctx.stroke();
          P.crown(ctx, cx + 30, y + (fs + 26) / 2, fs * 0.9, GOLD);
          ctx.font = `700 ${fs}px ${P.FONT_UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillStyle = '#f4efe6';
          const nm = U.cleanName(g.username);
          ctx.fillText(nm, cx + 56, y + (fs + 26) / 2 + 1);
          ctx.fillStyle = GOLD;
          ctx.fillText(`×${g.giftCount}`, cx + 56 + ctx.measureText(nm + '  ').width, y + (fs + 26) / 2 + 1);
        }
        cx += widths[i] + 18;
      });
      // animated total counter
      ctx.globalAlpha = alpha * U.inv(t0 + 0.6, t0 + 0.9, t);
      const cr = this.p.counter;
      const cnt = Math.round(U.lerp(cr[0], cr[1], U.easeOutCubic(U.inv(t0 + 0.6, t0 + 1.8, t))));
      P.glowText(ctx, `${L.total}: ${cnt}`, C, 474, 34, GOLD, { font: P.FONT_STENCIL, glowColor: ACCENT, blur: 16 });
      ctx.restore();
    }
  }

  WT.Run = Run;
})(window.WT);
