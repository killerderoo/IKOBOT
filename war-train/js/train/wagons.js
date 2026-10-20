/* War Train — locomotive and wagon components.
   Static armor is painted once into an offscreen sprite; moving parts (wheels, turrets, barrels,
   lights, flags, nameplates, avatars) are drawn live every frame on top of it. */
window.WT = window.WT || {};
(function (WT) {
  'use strict';
  const U = WT.U, P = WT.P;

  const SPR_TOP = 470, SPR_H = 440, PAD = 60;
  const ACCENT = '#ff7a1a', HOT = '#ff3b1f', GOLD = '#ffc840';

  // ---------------------------------------------------------------- Gun --
  class Gun {
    constructor(o) {
      Object.assign(this, { px: 0, py: 0, len: 150, thick: 22, rest: -0.12, maxRecoil: 22, coils: 0, twin: false, dome: 34, tone: 0, flip: false }, o);
      this.aimKeys = [];     // [{t, a}] angle keyframes (radians, negative = up)
      this.lastFire = -99;
      this.chargeFrom = -99; this.chargeTo = -99;
    }
    aimTo(t0, t1, a) { this.aimKeys.push({ t0, t1, a }); this.aimKeys.sort((x, y) => x.t0 - y.t0); }
    angle(t) {
      let a = this.rest;
      for (const k of this.aimKeys) {
        if (t >= k.t1) a = k.a;
        else if (t > k.t0) { a = U.lerp(a, k.a, U.easeInOut(U.inv(k.t0, k.t1, t))); break; }
        else break;
      }
      return this.flip ? Math.PI - a : a;
    }
    recoil(t) {
      const d = t - this.lastFire;
      if (d < 0 || d > 0.6) return 0;
      return this.maxRecoil * (d < 0.05 ? d / 0.05 : 1 - U.easeOutCubic((d - 0.05) / 0.55));
    }
    heat(t) {
      if (t >= this.chargeFrom && t <= this.chargeTo) return U.inv(this.chargeFrom, this.chargeTo, t);
      const d = t - this.chargeTo;
      return d > 0 && d < 0.5 ? 1 - d / 0.5 : 0;
    }
    hot(t) { const d = t - this.lastFire; return d >= 0 && d < 1.4 ? 1 - d / 1.4 : 0; }
    muzzle(sx, dy, t) {
      const a = this.angle(t), L = this.len - this.thick * 0.6 + this.thick * 0.7;
      return { x: sx + this.px + Math.cos(a) * L, y: this.py + dy + Math.sin(a) * L, a };
    }
    draw(ctx, sx, dy, t) {
      const a = this.angle(t), r = this.recoil(t), heat = this.heat(t), hot = this.hot(t);
      ctx.save();
      ctx.translate(sx + this.px, this.py + dy);
      ctx.rotate(a);
      if (this.twin) {
        ctx.save(); ctx.translate(0, -this.thick * 0.55); P.barrel(ctx, this.len, this.thick * 0.8, r, { heat, hot }); ctx.restore();
        ctx.save(); ctx.translate(0, this.thick * 0.55); P.barrel(ctx, this.len * 0.96, this.thick * 0.8, r * 0.7, { heat, hot }); ctx.restore();
      } else {
        P.barrel(ctx, this.len, this.thick, r, { coils: this.coils, heat, hot });
      }
      // breech block / mantlet
      ctx.fillStyle = P.metal(ctx, -this.thick, this.thick, this.tone);
      U.roundRect(ctx, -this.thick * 1.1 - r * 0.3, -this.thick * 0.9, this.thick * 1.6, this.thick * 1.8, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
      if (this.dome) P.turretDome(ctx, sx + this.px, this.py + dy + this.dome * 0.35, this.dome, this.tone);
      if (heat > 0.01) {
        const m = this.muzzle(sx, dy, t);
        P.glowSprite(ctx, WT.sprites.orange, m.x, m.y, 60 + 140 * heat, heat);
        P.glowSprite(ctx, WT.sprites.white, m.x, m.y, 30 + 40 * heat, heat * 0.9);
      }
    }
  }

  // ---------------------------------------------------------------- Car --
  class Car {
    constructor(kind, width, tone) {
      this.kind = kind;
      this.w = width;
      this.tone = tone || 0;
      this.left = 0;           // world x of the car's left edge (train front is world x = 0)
      this.guns = [];
      this.bogies = [80, width - 80];
      this.phase = U.hash(kind + width) % 100 / 16;
    }
    build() {
      const c = U.canvas(this.w + PAD * 2, SPR_H), x = c.getContext('2d');
      x.translate(PAD, -SPR_TOP);
      this.paintChassis(x);
      this.paint(x);
      this.sprite = c;
      return this;
    }
    paintChassis(x) {
      const w = this.w;
      x.fillStyle = '#121416';
      x.fillRect(4, 872, w - 8, 22);
      x.fillStyle = '#23272c';
      x.fillRect(4, 872, w - 8, 4);
      P.rivets(x, 14, 884, w - 28, 26, 2);
      P.hazard(x, 4, 886, 28, 8);
      P.hazard(x, w - 32, 886, 28, 8);
      // skirt shadow between bogies
      x.fillStyle = 'rgba(0,0,0,0.55)';
      x.fillRect(this.bogies[0] + 76, 894, Math.max(0, this.bogies[this.bogies.length - 1] - this.bogies[0] - 152), 10);
    }
    paint() {}

    // Suspension: soft body bob + jolts at the rail joints (joints are every 160px, fixed on screen).
    bob(sx, t) {
      const s = Math.sin(t * 7.3 + this.phase) * 1.4 + Math.sin(t * 13.1 + this.phase * 2) * 0.6;
      const j = ((sx + this.w * 0.5) % 160 + 160) % 160;
      const jolt = j < 18 ? Math.sin((j / 18) * Math.PI) * 2.2 : 0;
      return s - jolt;
    }

    draw(ctx, sx, st) {
      const dy = this.bob(sx, st.t);
      for (const b of this.bogies) P.bogie(ctx, sx + b, st.wheelAng, st.speed);
      if (st.speed > 420) {
        // cheap horizontal motion blur: a faint ghost trailing behind
        ctx.globalAlpha = U.clamp((st.speed - 420) / 900, 0, 0.3);
        ctx.drawImage(this.sprite, sx - PAD - st.speed * 0.014, SPR_TOP + dy);
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(this.sprite, sx - PAD, SPR_TOP + dy);
      this.drawLive(ctx, sx, dy, st);
      return dy;
    }
    drawLive(ctx, sx, dy, st) { for (const g of this.guns) g.draw(ctx, sx, dy, st.t); }
  }

  // --------------------------------------------------------- Locomotive --
  class Locomotive extends Car {
    constructor() {
      super('loco', 680, 0);
      this.bogies = [90, 300, 560];
      this.turret = new Gun({ px: 340, py: 672, len: 170, thick: 26, twin: true, dome: 40, rest: -0.1, maxRecoil: 26 });
      this.mg = new Gun({ px: 590, py: 688, len: 70, thick: 9, dome: 14, rest: -0.18, maxRecoil: 6 });
      this.guns = [this.turret, this.mg];
    }
    paint(x) {
      const w = this.w;
      // cab
      x.beginPath();
      x.moveTo(26, 872); x.lineTo(26, 622); x.lineTo(50, 596); x.lineTo(232, 596); x.lineTo(254, 622); x.lineTo(254, 872); x.closePath();
      x.fillStyle = P.metal(x, 596, 872, 1); x.fill();
      x.strokeStyle = 'rgba(0,0,0,0.9)'; x.lineWidth = 2; x.stroke();
      x.fillStyle = '#0a0a0b'; x.fillRect(40, 586, 200, 12);
      P.rivets(x, 40, 610, 200, 20);
      // glowing slit windows
      for (let i = 0; i < 3; i++) {
        x.fillStyle = '#070707'; x.fillRect(56 + i * 60, 636, 46, 22);
        x.save(); x.shadowColor = ACCENT; x.shadowBlur = 16;
        x.fillStyle = '#ff8a2a'; x.fillRect(59 + i * 60, 644, 40, 7);
        x.restore();
      }
      P.plate(x, 40, 676, 98, 180, { tone: 1, spacing: 20 });
      P.plate(x, 144, 676, 98, 180, { tone: 1, spacing: 20 });
      P.stencil(x, 'WT-01', 141, 720, 30, '#d9d3c4');
      P.hazard(x, 60, 800, 160, 14);
      // engine hull
      x.beginPath();
      x.moveTo(254, 872); x.lineTo(254, 690); x.quadraticCurveTo(256, 676, 274, 676);
      x.lineTo(574, 676); x.lineTo(628, 698); x.lineTo(668, 770); x.lineTo(668, 872); x.closePath();
      x.fillStyle = P.metal(x, 676, 872, 0); x.fill();
      x.strokeStyle = 'rgba(0,0,0,0.9)'; x.lineWidth = 2; x.stroke();
      // armored hood band + vents
      x.fillStyle = '#16191c'; x.fillRect(262, 680, 312, 16);
      P.vents(x, 300, 684, 120, 8, 8);
      P.vents(x, 440, 684, 110, 8, 7);
      // side armor panels
      P.plate(x, 266, 712, 104, 146, { spacing: 24 });
      P.plate(x, 376, 712, 104, 146, { spacing: 24 });
      P.plate(x, 486, 712, 110, 146, { spacing: 24 });
      x.beginPath(); x.moveTo(602, 712); x.lineTo(626, 712); x.lineTo(658, 772); x.lineTo(658, 858); x.lineTo(602, 858); x.closePath();
      x.fillStyle = P.metal(x, 712, 858, 1); x.fill(); x.strokeStyle = '#000'; x.stroke();
      P.insignia(x, 428, 786, 50, ACCENT);
      // chains draped over the armor
      P.chain(x, 272, 708, 372, 708, 22);
      P.chain(x, 484, 708, 596, 708, 26);
      // smokestacks
      x.fillStyle = P.metal(x, 600, 680, 1);
      x.fillRect(496, 612, 34, 66); x.fillRect(420, 636, 22, 42);
      x.fillStyle = '#0b0c0d'; x.fillRect(490, 604, 46, 12); x.fillRect(416, 630, 30, 9);
      x.strokeStyle = 'rgba(0,0,0,0.9)'; x.strokeRect(496, 612, 34, 66);
      // headlight housing + nose details
      x.fillStyle = '#0b0c0d';
      x.beginPath(); x.arc(652, 742, 18, 0, 6.283); x.fill();
      x.fillStyle = '#ffd9a0';
      x.beginPath(); x.arc(652, 742, 10, 0, 6.283); x.fill();
      P.hazard(x, 610, 830, 54, 16);
      // plow
      x.beginPath(); x.moveTo(640, 872); x.lineTo(676, 872); x.lineTo(712, 936); x.lineTo(640, 936); x.closePath();
      x.fillStyle = P.metal(x, 872, 936, 1); x.fill(); x.strokeStyle = '#000'; x.stroke();
      for (let i = 0; i < 4; i++) { x.strokeStyle = 'rgba(255,122,26,0.5)'; x.beginPath(); x.moveTo(648 + i * 14, 878); x.lineTo(664 + i * 14, 932); x.stroke(); }
      // neon underglow strip
      P.neon(x, 30, 862, w - 22, 862, 3, ACCENT);
    }
    drawLive(ctx, sx, dy, st) {
      const t = st.t;
      P.flag(ctx, sx + 46, 500 + dy, 98, 84, 50, t, HOT);
      super.drawLive(ctx, sx, dy, st);
      // rotating amber beacon on the cab roof
      const b = 0.5 + 0.5 * Math.sin(t * 10);
      P.glowSprite(ctx, WT.sprites.orange, sx + 140, 582 + dy, 50 + 50 * b, 0.5 + 0.5 * b);
      // headlight core
      P.glowSprite(ctx, WT.sprites.white, sx + 652, 742 + dy, 70, 0.9);
      P.glowSprite(ctx, WT.sprites.orange, sx + 652, 742 + dy, 160, 0.6);
      // window flicker
      P.glowSprite(ctx, WT.sprites.orange, sx + 140, 648 + dy, 260, 0.18 + 0.06 * Math.sin(t * 23));
    }
    stack(sx, dy) { return { x: sx + 513, y: 604 + dy }; }
    headlight(sx, dy) { return { x: sx + 652, y: 742 + dy }; }
  }

  // --------------------------------------------------- GifterCannonWagon --
  // Accepts { username, avatarUrl, giftCount, tier, eventId }. One wagon per gifter.
  class GifterCannonWagon extends Car {
    constructor(g) {
      super('gifter', 600, 0);
      this.g = Object.assign({ username: 'Anonymous', avatarUrl: '', giftCount: 1, tier: '1000', eventId: '' }, g);
      this.g.username = U.cleanName(this.g.username);
      this.cannon = new Gun({ px: 330, py: 742, len: 280, thick: 32, coils: 3, dome: 66, rest: -0.12, maxRecoil: 40 });
      this.guns = [this.cannon];
      this.Tc = 0;
      this.shotTimes = [];
      this.avatar = null;
      this.hue = U.hash(this.g.username) % 360;
      if (this.g.avatarUrl) this.loadAvatar(this.g.avatarUrl);
    }
    loadAvatar(url) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { this.avatar = img; };
      img.onerror = () => {
        // retry without CORS so the avatar still shows (canvas export may be tainted then)
        if (img.crossOrigin) { const i2 = new Image(); i2.onload = () => { this.avatar = i2; }; i2.src = url; }
      };
      img.src = url;
    }
    rank() {
      const n = this.g.giftCount;
      if (n >= 50) return { label: 'GENERAL', icon: 'crown' };
      if (n >= 20) return { label: 'COLONEL', icon: 'star' };
      if (n >= 10) return { label: 'SERGEANT', n: 3 };
      if (n >= 5) return { label: 'CORPORAL', n: 2 };
      return { label: 'PRIVATE', n: 1 };
    }
    tierLabel() {
      const t = String(this.g.tier);
      return t === '3000' ? 'TIER 3' : t === '2000' ? 'TIER 2' : t.toLowerCase() === 'prime' ? 'PRIME' : 'TIER 1';
    }
    // Schedule this wagon's cannon routine around Tc (the moment it's centred on screen).
    schedule(Tc) {
      this.Tc = Tc;
      const c = this.cannon;
      c.aimTo(Tc - 1.0, Tc - 0.3, -0.52);
      c.chargeFrom = Tc - 0.55; c.chargeTo = Tc + 0.15;
      this.shotTimes = [Tc + 0.15];
      if (this.g.giftCount >= 5) this.shotTimes.push(Tc + 0.8);
      if (this.g.giftCount >= 20) this.shotTimes.push(Tc + 1.25);
      c.aimTo(Tc + 1.5, Tc + 2.1, -0.16);
    }
    paint(x) {
      const w = this.w;
      // armored side skirt
      P.plate(x, 8, 790, w - 16, 82, { c: 10, spacing: 26 });
      P.hazard(x, 14, 782, w - 28, 10);
      // gunner cupola + shield wall
      P.plate(x, 14, 690, 34, 92, { c: 4, rivets: false, tone: 1 });
      P.sandbags(x, 52, 790, 150);
      // SUB GIFTER neon label box
      x.fillStyle = '#0a0a0b';
      U.chamfer(x, 24, 806, 136, 48, 8); x.fill();
      x.strokeStyle = ACCENT; x.lineWidth = 2; x.save(); x.shadowColor = ACCENT; x.shadowBlur = 14; x.stroke(); x.restore();
      P.glowText(x, WT.cfg.labels.gifter, 92, 824, 19, ACCENT, { core: '#ffd2a8', blur: 16 });
      P.glowText(x, '★ ★ ★', 92, 843, 12, GOLD, { blur: 6 });
      // gift-count badge housing
      x.fillStyle = '#0a0a0b';
      U.chamfer(x, 480, 802, 104, 56, 8); x.fill();
      x.strokeStyle = GOLD; x.lineWidth = 2; x.stroke();
      // ammo crates and shells on deck
      P.crate(x, 470, 740, 62, 46, 'AMMO');
      P.crate(x, 536, 752, 50, 34, '', 'olive');
      P.shells(x, 540, 750, 4);
      // turret ring
      x.fillStyle = '#16191c'; U.roundRect(x, 246, 776, 170, 16, 6); x.fill();
      P.neon(x, 20, 866, w - 20, 866, 2, ACCENT);
    }
    drawAvatar(ctx, cx, cy, r, t) {
      // shield-shaped frame
      const shield = () => {
        ctx.beginPath();
        ctx.moveTo(cx - r, cy - r * 0.95);
        ctx.lineTo(cx + r, cy - r * 0.95);
        ctx.lineTo(cx + r, cy + r * 0.2);
        ctx.quadraticCurveTo(cx + r, cy + r * 0.85, cx, cy + r * 1.25);
        ctx.quadraticCurveTo(cx - r, cy + r * 0.85, cx - r, cy + r * 0.2);
        ctx.closePath();
      };
      ctx.save();
      shield();
      ctx.fillStyle = `hsl(${this.hue},35%,18%)`;
      ctx.fill();
      ctx.clip();
      if (this.avatar) {
        ctx.drawImage(this.avatar, cx - r, cy - r, r * 2, r * 2.3);
      } else {
        // placeholder: helmeted soldier silhouette + initials
        ctx.fillStyle = `hsl(${this.hue},30%,30%)`;
        ctx.beginPath(); ctx.arc(cx, cy - r * 0.1, r * 0.42, Math.PI, 0); ctx.lineTo(cx + r * 0.52, cy); ctx.lineTo(cx - r * 0.52, cy); ctx.fill();
        ctx.fillStyle = '#1a1c1f';
        ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.85, r * 0.75, r * 0.5, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#e9e4da';
        ctx.font = `${r * 0.55}px ${P.FONT_STENCIL}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(this.g.username.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || '?', cx, cy + r * 0.45);
      }
      ctx.restore();
      shield();
      ctx.lineWidth = 4;
      ctx.strokeStyle = GOLD;
      ctx.save(); ctx.shadowColor = ACCENT; ctx.shadowBlur = 14 + 6 * Math.sin(t * 6); ctx.stroke(); ctx.restore();
    }
    drawLive(ctx, sx, dy, st) {
      const t = st.t, Tc = this.Tc;
      // gunner avatar on the deck, behind the cannon
      const pop = U.easeOutBack(U.inv(Tc - 1.6, Tc - 1.2, t));
      if (pop > 0.01) {
        ctx.save();
        ctx.translate(sx + 128, 742 + dy);
        ctx.scale(pop, pop);
        this.drawAvatar(ctx, 0, -18, 44, t);
        // crown drops onto the shield
        const cd = U.easeOutBack(U.inv(Tc - 1.25, Tc - 0.9, t));
        ctx.globalAlpha = U.clamp(cd * 2, 0, 1);
        P.glowSprite(ctx, WT.sprites.gold, 0, -84 - (1 - cd) * 60, 90, 0.5 * cd);
        P.crown(ctx, 0, -84 - (1 - cd) * 60 + Math.sin(t * 4) * 2, 34, GOLD);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
      super.drawLive(ctx, sx, dy, st);
      this.drawPlate(ctx, sx, dy, t);
      this.drawCounter(ctx, sx, dy, t);
      // floating "+N SUBS" callout after the first shot
      const f = t - this.shotTimes[0];
      if (f > 0 && f < 1.8) {
        const a = f < 0.2 ? f / 0.2 : 1 - U.inv(1.2, 1.8, f);
        ctx.globalAlpha = a;
        P.glowText(ctx, `+${this.g.giftCount} SUB${this.g.giftCount > 1 ? 'S' : ''}`, sx + 250, 560 + dy - f * 70, 50, GOLD, { glowColor: ACCENT, core: '#fff3d0' });
        ctx.globalAlpha = 1;
      }
    }
    drawPlate(ctx, sx, dy, t) {
      const Tc = this.Tc, k = U.inv(Tc - 1.7, Tc - 1.3, t);
      const x = sx + 172, y = 798 + dy, w = 298, h = 66;
      // dark empty slot until the plate slams in
      ctx.fillStyle = '#08090a';
      U.chamfer(ctx, x, y, w, h, 10); ctx.fill();
      if (k <= 0) return;
      const s = U.easeOutBack(k);
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.scale(s, s);
      ctx.translate(-w / 2, -h / 2);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#2a2e33'); g.addColorStop(1, '#0d0f11');
      ctx.fillStyle = g;
      U.chamfer(ctx, 0, 0, w, h, 10); ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = ACCENT;
      ctx.save(); ctx.shadowColor = ACCENT; ctx.shadowBlur = 12; ctx.stroke(); ctx.restore();
      // rank icon
      const rk = this.rank();
      if (rk.icon === 'crown') P.crown(ctx, 30, h / 2, 30, GOLD);
      else if (rk.icon === 'star') P.star(ctx, 30, h / 2, 16, GOLD);
      else P.chevrons(ctx, 30, h / 2 + 4, 26, rk.n, GOLD);
      // username — always fits, never overlaps
      ctx.fillStyle = '#f4efe6';
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      U.fitFont(ctx, this.g.username, w - 70, 34, P.FONT_UI, '700', 16);
      ctx.fillText(this.g.username, 56, 38);
      ctx.font = `500 14px ${P.FONT_UI}`;
      ctx.fillStyle = '#ffb070';
      ctx.fillText(`${rk.label}  •  ${this.tierLabel()}  •  ${this.g.giftCount} GIFTED`, 56, 57);
      ctx.restore();
      // impact flash when it lands
      if (k < 1) P.glowSprite(ctx, WT.sprites.orange, x + w / 2, y + h / 2, 420, (1 - k) * 0.6);
    }
    drawCounter(ctx, sx, dy, t) {
      const f = U.inv(this.shotTimes[0], this.shotTimes[0] + 0.9, t);
      const n = Math.round(this.g.giftCount * U.easeOutCubic(f));
      const x = sx + 532, y = 822 + dy;
      P.glowText(ctx, `×${n}`, x, y, n >= 100 ? 26 : 34, GOLD, { blur: f > 0 && f < 1 ? 24 : 10, core: '#fff1c8' });
      ctx.font = `600 12px ${P.FONT_UI}`; ctx.textAlign = 'center'; ctx.fillStyle = '#c9b48a';
      ctx.fillText('GIFTED SUBS', x, 849 + dy);
    }
  }

  // ------------------------------------------------------- ThemedWagon --
  class ThemedWagon extends Car {
    constructor(theme, data) {
      super(theme, 560, theme === 'blackops' ? 2 : theme === 'warzone' ? 3 : 0);
      this.data = data || {};
      if (theme === 'hype') {
        this.guns = [
          new Gun({ px: 150, py: 676, len: 80, thick: 10, dome: 16, rest: -0.35, maxRecoil: 6, twin: true }),
          new Gun({ px: 410, py: 676, len: 80, thick: 10, dome: 16, rest: -0.42, maxRecoil: 6, twin: true }),
        ];
      } else if (theme === 'warzone') {
        this.guns = [new Gun({ px: 430, py: 728, len: 170, thick: 22, dome: 40, rest: -0.3, maxRecoil: 20, tone: 3 })];
      } else {
        this.guns = [new Gun({ px: 470, py: 684, len: 90, thick: 12, dome: 18, rest: -0.25, maxRecoil: 8, tone: 2 })];
      }
    }
    paint(x) {
      const w = this.w, th = this.kind, L = WT.cfg.labels;
      if (th === 'hype') {
        P.plate(x, 10, 680, w - 20, 192, { c: 12, spacing: 24 });
        for (let i = 1; i < 6; i++) { x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(10 + i * ((w - 20) / 6), 690, 3, 172); }
        x.fillStyle = '#070708'; U.chamfer(x, 50, 706, w - 100, 92, 12); x.fill();
        x.strokeStyle = '#3a2a1c'; x.lineWidth = 3; x.stroke();
        P.hazard(x, 10, 672, w - 20, 10);
      } else if (th === 'blackops') {
        P.plate(x, 10, 690, w - 20, 182, { c: 6, tone: 2, spacing: 30 });
        x.save(); x.beginPath(); x.rect(10, 690, w - 20, 182); x.clip();
        x.strokeStyle = 'rgba(255,255,255,0.035)'; x.lineWidth = 26;
        for (let i = -200; i < w + 200; i += 70) { x.beginPath(); x.moveTo(i, 872); x.lineTo(i + 180, 690); x.stroke(); }
        x.restore();
        P.stencil(x, L.blackops, w / 2 - 30, 742, 52, '#d8d2c6', 'center', 380);
        P.neon(x, 60, 774, w - 120, 774, 3, ACCENT);
        P.skull(x, w - 62, 740, 54, '#d8d2c6');
        // rocket pod on the roof
        x.fillStyle = P.metal(x, 650, 690, 2); U.chamfer(x, 90, 652, 170, 38, 6); x.fill();
        x.strokeStyle = '#000'; x.stroke();
        for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) {
          x.fillStyle = '#050505'; x.beginPath(); x.arc(108 + c * 27, 663 + r * 16, 6, 0, 6.283); x.fill();
          x.fillStyle = HOT; x.beginPath(); x.arc(108 + c * 27, 663 + r * 16, 2.3, 0, 6.283); x.fill();
        }
      } else {
        // warzone: open gondola with sandbags and containers
        P.plate(x, 10, 760, w - 20, 112, { c: 8, tone: 3, spacing: 26 });
        P.crate(x, 40, 712, 84, 48, 'AMMO', 'olive');
        P.crate(x, 128, 724, 64, 36, '', 'olive');
        P.shells(x, 200, 758, 5);
        P.sandbags(x, 262, 762, 120);
        x.fillStyle = '#0a0a0b'; U.chamfer(x, 40, 666, 250, 40, 6); x.fill();
        x.strokeStyle = ACCENT; x.lineWidth = 2; x.stroke();
        P.glowText(x, L.warzone, 165, 687, 30, ACCENT, { core: '#ffd8b0', blur: 14 });
        x.fillStyle = '#16191c'; x.fillRect(88, 706, 6, 8); x.fillRect(236, 706, 6, 8);
      }
      P.neon(x, 20, 866, w - 20, 866, 2, th === 'blackops' ? HOT : ACCENT);
    }
    drawLive(ctx, sx, dy, st) {
      const t = st.t;
      if (this.kind === 'hype') this.drawHype(ctx, sx, dy, t);
      super.drawLive(ctx, sx, dy, st);
      if (this.kind === 'warzone') P.flag(ctx, sx + 520, 640 + dy, 120, 70, 42, t + 1, ACCENT);
      if (this.kind !== 'hype') this.drawRecruits(ctx, sx, dy);
    }
    drawHype(ctx, sx, dy, t) {
      const L = WT.cfg.labels, hype = this.data.hype || {};
      const flick = 0.85 + 0.15 * Math.sin(t * 31) * Math.sin(t * 7);
      ctx.globalAlpha = flick;
      P.glowText(ctx, L.hype, sx + this.w / 2, 744 + dy, 56, ACCENT, { core: '#ffd9b8', blur: 26 });
      ctx.globalAlpha = 1;
      // level + progress bar
      const lvl = hype.level || 1, prog = hype.goal ? U.clamp(hype.progress / hype.goal, 0, 1) : 0;
      const bx = sx + 60, by = 812 + dy, bw = this.w - 120;
      ctx.fillStyle = '#08090a'; U.chamfer(ctx, bx, by, bw, 36, 6); ctx.fill();
      ctx.strokeStyle = '#3d2b1c'; ctx.lineWidth = 2; ctx.stroke();
      const fill = (bw - 120) * prog * U.easeOutCubic(U.clamp((t - (this.data.t0 || 0)) / 1.2, 0, 1));
      const g = ctx.createLinearGradient(bx + 110, 0, bx + 110 + fill, 0);
      g.addColorStop(0, HOT); g.addColorStop(1, '#ffb347');
      ctx.fillStyle = g;
      ctx.fillRect(bx + 110, by + 9, fill, 18);
      P.glowSprite(ctx, WT.sprites.orange, bx + 110 + fill, by + 18, 60, 0.8);
      ctx.font = `700 20px ${P.FONT_UI}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = GOLD;
      ctx.fillText(hype.complete ? 'COMPLETE' : `LEVEL ${lvl}`, bx + 12, by + 19);
    }
    drawRecruits(ctx, sx, dy) {
      const list = this.data.recruits || [];
      const y = this.kind === 'blackops' ? 798 : 790;
      const slotW = 236;
      list.slice(0, 2).forEach((r, i) => {
        const x = sx + 30 + i * (slotW + 14) + (this.kind === 'warzone' ? 0 : 0);
        ctx.fillStyle = 'rgba(8,9,10,0.92)';
        U.chamfer(ctx, x, y + dy, slotW, 54, 7); ctx.fill();
        ctx.strokeStyle = r.type === 'resub' ? GOLD : ACCENT; ctx.lineWidth = 2; ctx.stroke();
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#f4efe6';
        U.fitFont(ctx, U.cleanName(r.username), slotW - 24, 24, P.FONT_UI, '700', 13);
        ctx.fillText(U.cleanName(r.username), x + 12, y + dy + 27);
        ctx.font = `500 13px ${P.FONT_UI}`; ctx.fillStyle = r.type === 'resub' ? GOLD : '#ffb070';
        ctx.fillText(r.type === 'resub' ? `VETERAN • ${r.months || 1} MONTHS` : 'NEW RECRUIT', x + 12, y + dy + 45);
      });
    }
  }

  // ------------------------------------------------- Heavy artillery --
  class ArtilleryWagon extends Car {
    constructor() {
      super('artillery', 820, 0);
      this.bogies = [90, 410, 730];
      this.guns = [
        new Gun({ px: 170, py: 752, len: 210, thick: 24, dome: 44, rest: -0.28, maxRecoil: 26, coils: 2 }),
        new Gun({ px: 410, py: 726, len: 320, thick: 40, dome: 84, rest: -0.2, maxRecoil: 46, coils: 3 }),
        new Gun({ px: 650, py: 752, len: 210, thick: 24, dome: 44, rest: -0.36, maxRecoil: 26, coils: 2 }),
      ];
    }
    paint(x) {
      const w = this.w;
      P.plate(x, 8, 784, w - 16, 88, { c: 12, spacing: 28 });
      P.hazard(x, 14, 776, w - 28, 10);
      // outrigger legs
      for (const lx of [40, w - 70]) {
        x.fillStyle = '#16191c';
        x.beginPath(); x.moveTo(lx, 860); x.lineTo(lx + 30, 860); x.lineTo(lx + 44, 930); x.lineTo(lx - 14, 930); x.closePath(); x.fill();
        x.strokeStyle = '#3a3f46'; x.stroke();
      }
      // energy cores
      for (const cx of [292, 528]) {
        x.fillStyle = '#0a0a0b'; U.roundRect(x, cx - 18, 796, 36, 64, 8); x.fill();
        x.save(); x.shadowColor = ACCENT; x.shadowBlur = 20;
        const g = x.createLinearGradient(0, 802, 0, 854); g.addColorStop(0, '#ffd08a'); g.addColorStop(1, HOT);
        x.fillStyle = g; U.roundRect(x, cx - 11, 802, 22, 52, 6); x.fill();
        x.restore();
      }
      x.fillStyle = '#0a0a0b'; U.chamfer(x, 340, 798, 140, 60, 8); x.fill();
      x.strokeStyle = GOLD; x.lineWidth = 2; x.stroke();
      P.crown(x, 410, 818, 30, GOLD);
      P.stencil(x, 'ULTIMATE', 410, 845, 15, GOLD);
      P.stencil(x, 'HEAVY ARTILLERY', 150, 826, 22, '#cfc8b8', 'center', 230);
      P.stencil(x, 'GIFTER DIVISION', 676, 826, 22, '#cfc8b8', 'center', 230);
      P.neon(x, 20, 866, w - 20, 866, 3, GOLD);
    }
    drawLive(ctx, sx, dy, st) {
      super.drawLive(ctx, sx, dy, st);
      const p = 0.6 + 0.4 * Math.sin(st.t * 8);
      P.glowSprite(ctx, WT.sprites.orange, sx + 292, 828 + dy, 110, p * 0.7);
      P.glowSprite(ctx, WT.sprites.orange, sx + 528, 828 + dy, 110, p * 0.7);
    }
  }

  // ----------------------------------------------------------- Caboose --
  class Caboose extends Car {
    constructor() {
      super('caboose', 420, 1);
      this.guns = [new Gun({ px: 70, py: 690, len: 80, thick: 10, dome: 16, rest: -0.2, maxRecoil: 6, flip: true, tone: 1 })];
    }
    paint(x) {
      const w = this.w;
      P.plate(x, 10, 700, w - 20, 172, { c: 10, tone: 1, spacing: 24 });
      P.plate(x, 150, 648, 130, 56, { c: 6, tone: 1, spacing: 20 });
      for (let i = 0; i < 3; i++) {
        x.fillStyle = '#060606'; x.fillRect(166 + i * 36, 664, 26, 18);
        x.save(); x.shadowColor = ACCENT; x.shadowBlur = 10; x.fillStyle = '#ff9a3a'; x.fillRect(169 + i * 36, 670, 20, 6); x.restore();
      }
      P.stencil(x, 'REAR GUARD', w / 2 + 10, 760, 30, '#d9d3c4', 'center', 300);
      P.hazard(x, 40, 790, w - 80, 14);
      P.chain(x, 40, 820, w - 40, 820, 18);
      P.skull(x, w / 2 + 10, 838, 30, '#8f8a80');
      x.fillStyle = '#08090a'; x.fillRect(10, 740, 10, 110);
      P.neon(x, 20, 866, w - 20, 866, 2, HOT);
    }
    drawLive(ctx, sx, dy, st) {
      super.drawLive(ctx, sx, dy, st);
      P.flag(ctx, sx + 392, 600 + dy, 104, 70, 42, st.t + 2, HOT);
      // red tail lights at the rear (left) end
      const fade = st.tailFade == null ? 1 : st.tailFade;
      const blink = 0.75 + 0.25 * Math.sin(st.t * 6);
      for (const ly of [762, 832]) {
        ctx.fillStyle = '#2a0805'; ctx.beginPath(); ctx.arc(sx + 12, ly + dy, 9, 0, 6.283); ctx.fill();
        P.glowSprite(ctx, WT.sprites.red, sx + 12, ly + dy, 70, blink * fade);
        P.glowSprite(ctx, WT.sprites.red, sx + 4, ly + dy, 220, 0.45 * blink * fade);
      }
    }
  }

  WT.Gun = Gun;
  WT.Car = Car;
  WT.Locomotive = Locomotive;
  WT.GifterCannonWagon = GifterCannonWagon;
  WT.ThemedWagon = ThemedWagon;
  WT.ArtilleryWagon = ArtilleryWagon;
  WT.Caboose = Caboose;
})(window.WT);
