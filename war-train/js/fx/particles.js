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
      };
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
        const set = o.kind === 'steam' ? this.sprites.steam : o.kind === 'warm' ? this.sprites.warm : this.sprites.smoke;
        this.add({
          t: 'smoke', spr: set[(this.rnd() * set.length) | 0], layer: o.layer || 'back',
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
          t: 'spark', x, y, vx: Math.cos(a) * sp + (o.vx || 0), vy: Math.sin(a) * sp, life: this.r(0.25, 0.8) * (o.life || 1),
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
      this.ring(x, y, 90 * scale, { life: 0.3, w: 4 });
    }

    // ---- simulation -----------------------------------------------------
    update(dt) {
      const cur = this.p, keep = [], bursts = [];
      this.p = []; // particles spawned during this step land here
      for (let i = 0; i < cur.length; i++) {
        const q = cur[i];
        q.age += dt;
        if (q.age >= q.life) {
          if (q.t === 'blast' && q.burst) bursts.push(q);
          continue;
        }
        if (q.vx !== undefined) {
          const dr = Math.exp(-(q.drag || 0) * dt);
          q.vx *= dr; q.vy *= dr;
          q.vy += (q.g || 0) * dt;
          q.x += q.vx * dt; q.y += q.vy * dt;
        }
        if (q.t === 'blast' && this.rnd() < 0.8) {
          this.add({ t: 'ember', x: q.x, y: q.y, vx: this.r(-40, 40), vy: this.r(-40, 40), life: this.r(0.3, 0.7), g: 0, drag: 1, size: this.r(2, 4), ph: 0, layer: 'front' });
        }
        if (q.vr) q.rot += q.vr * dt;
        keep.push(q);
      }
      this.p = keep.concat(this.p);
      for (const q of bursts) this.burst(q.x, q.y, q.scale, q.gold);
      if (this.p.length > this.max) this.p.splice(0, this.p.length - this.max);
      if (this.shakeT > 0) this.shakeT -= dt;
      else this.shakeAmt *= Math.exp(-10 * dt);
    }

    draw(ctx, layer) {
      for (let i = 0; i < this.p.length; i++) {
        const q = this.p[i];
        if (q.layer !== layer) continue;
        const k = q.age / q.life;
        switch (q.t) {
          case 'smoke': {
            const s = q.size * (1 + (q.grow - 1) * U.easeOutCubic(k));
            ctx.globalAlpha = q.alpha * Math.min(1, k * 6) * (1 - k);
            ctx.save();
            ctx.translate(q.x, q.y);
            ctx.rotate(q.rot);
            ctx.drawImage(q.spr, -s, -s, s * 2, s * 2);
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
