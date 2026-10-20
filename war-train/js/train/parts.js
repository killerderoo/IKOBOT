/* War Train — procedural drawing kit: armor plates, rivets, hazard stripes, wheels, bogies,
   cannons, skull insignia, crowns, flags, chains and crates. All coordinates are design pixels. */
window.WT = window.WT || {};
(function (WT) {
  'use strict';
  const U = WT.U;
  const P = {};

  P.FONT_STENCIL = '"Black Ops One", Impact, "Arial Black", sans-serif';
  P.FONT_UI = 'Oswald, "Arial Narrow", "Roboto Condensed", Arial, sans-serif';
  P.WHEEL_Y = 918;
  P.WHEEL_R = 30;

  const TONES = [
    ['#5a6169', '#33393f', '#1a1d21'], // gunmetal
    ['#3d4146', '#22262a', '#101214'], // dark steel
    ['#2a2c2f', '#17181a', '#0a0a0b'], // matte black
    ['#55503f', '#36332a', '#1c1b16'], // olive drab
  ];

  P.metal = (ctx, y0, y1, tone) => {
    const t = TONES[tone || 0], g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, t[0]);
    g.addColorStop(0.18, t[1]);
    g.addColorStop(1, t[2]);
    return g;
  };

  P.rivets = (ctx, x, y, w, spacing, r) => {
    r = r || 2.2;
    for (let px = x; px <= x + w + 0.1; px += spacing) {
      ctx.fillStyle = '#0c0d0f';
      ctx.beginPath(); ctx.arc(px, y + 0.8, r, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#8a9099';
      ctx.beginPath(); ctx.arc(px - 0.6, y - 0.4, r * 0.55, 0, 6.283); ctx.fill();
    }
  };

  P.plate = (ctx, x, y, w, h, o) => {
    o = o || {};
    U.chamfer(ctx, x, y, w, h, o.c == null ? 8 : o.c);
    ctx.fillStyle = P.metal(ctx, y, y + h, o.tone);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.stroke();
    // bevel highlight on the top edge
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + (o.c || 8) + 2, y + 2);
    ctx.lineTo(x + w - (o.c || 8) - 2, y + 2);
    ctx.stroke();
    // grime toward the bottom
    const g = ctx.createLinearGradient(0, y + h * 0.55, 0, y + h);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,6,4,0.45)');
    U.chamfer(ctx, x, y, w, h, o.c == null ? 8 : o.c);
    ctx.fillStyle = g;
    ctx.fill();
    if (o.rivets !== false) {
      const sp = o.spacing || 22;
      P.rivets(ctx, x + 10, y + 7, w - 20, sp);
      P.rivets(ctx, x + 10, y + h - 7, w - 20, sp);
    }
  };

  P.hazard = (ctx, x, y, w, h, color) => {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = '#121212';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color || '#e8701c';
    for (let i = -h; i < w + h; i += 22) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + 11, y + h);
      ctx.lineTo(x + i + 11 + h, y);
      ctx.lineTo(x + i + h, y);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  };

  P.vents = (ctx, x, y, w, h, n) => {
    ctx.fillStyle = '#08090a';
    const step = w / n;
    for (let i = 0; i < n; i++) {
      U.roundRect(ctx, x + i * step + 2, y, step - 4, h, 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.moveTo(x + i * step + 3, y + h + 1); ctx.lineTo(x + (i + 1) * step - 3, y + h + 1); ctx.stroke();
    }
  };

  // Glowing neon bar (baked into sprites with shadowBlur; cheap at runtime because it's cached).
  P.neon = (ctx, x1, y1, x2, y2, w, color) => {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,235,200,0.9)';
    ctx.lineWidth = Math.max(1, w * 0.35);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  };

  P.glowText = (ctx, text, x, y, size, color, o) => {
    o = o || {};
    ctx.save();
    ctx.font = `${o.weight || ''} ${size}px ${o.font || P.FONT_STENCIL}`.trim();
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'middle';
    if (o.glow !== false) {
      ctx.shadowColor = o.glowColor || color;
      ctx.shadowBlur = o.blur || 22;
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
    if (o.core) {
      ctx.fillStyle = o.core;
      ctx.fillText(text, x, y);
    }
    ctx.restore();
  };

  P.stencil = (ctx, text, x, y, size, color, align, maxW) => {
    ctx.save();
    if (maxW) U.fitFont(ctx, text, maxW, size, P.FONT_STENCIL);
    else ctx.font = `${size}px ${P.FONT_STENCIL}`;
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(text, x + 2, y + 2);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  P.skull = (ctx, cx, cy, s, fill, eye) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s / 100, s / 100);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(-42, 4);
    ctx.bezierCurveTo(-48, -50, 48, -50, 42, 4);
    ctx.bezierCurveTo(40, 18, 30, 22, 28, 30);
    ctx.lineTo(28, 46);
    ctx.lineTo(-28, 46);
    ctx.lineTo(-28, 30);
    ctx.bezierCurveTo(-30, 22, -40, 18, -42, 4);
    ctx.fill();
    // eyes / nose / teeth cut-outs
    ctx.fillStyle = eye || '#0b0b0c';
    ctx.beginPath(); ctx.ellipse(-17, 2, 12, 13, 0.2, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.ellipse(17, 2, 12, 13, -0.2, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(-6, 26); ctx.lineTo(6, 26); ctx.closePath(); ctx.fill();
    ctx.fillRect(-18, 34, 36, 3);
    for (let i = -14; i <= 14; i += 9.3) ctx.fillRect(i - 1, 30, 2.5, 16);
    ctx.restore();
  };

  // Crossed-rifles-and-skull insignia medallion.
  P.insignia = (ctx, cx, cy, r, accent) => {
    ctx.save();
    ctx.fillStyle = '#0c0d0f';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#2c3036';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.shadowColor = accent; ctx.shadowBlur = 16;
    ctx.strokeStyle = accent;
    ctx.beginPath(); ctx.arc(cx, cy, r - 7, 0, 6.283); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#9aa0a8';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(cx - r * 0.6, cy + r * 0.55); ctx.lineTo(cx + r * 0.6, cy - r * 0.55); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + r * 0.6, cy + r * 0.55); ctx.lineTo(cx - r * 0.6, cy - r * 0.55); ctx.stroke();
    P.skull(ctx, cx, cy - 2, r * 1.05, '#e9e4da');
    ctx.restore();
  };

  P.wheel = (ctx, cx, cy, r, ang, speed) => {
    ctx.fillStyle = '#0b0c0d';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#3c4148';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, r - 3, 0, 6.283); ctx.stroke();
    ctx.fillStyle = '#23272c';
    ctx.beginPath(); ctx.arc(cx, cy, r - 7, 0, 6.283); ctx.fill();
    // spokes; ghosted copies fake rotational motion blur at speed
    const ghosts = speed > 260 ? 3 : 1;
    for (let gI = 0; gI < ghosts; gI++) {
      ctx.globalAlpha = ghosts > 1 ? 0.45 : 1;
      const a0 = ang - gI * 0.12;
      ctx.strokeStyle = '#5b626b';
      ctx.lineWidth = 3;
      for (let k = 0; k < 6; k++) {
        const a = a0 + (k * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
        ctx.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8));
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 6.283); ctx.fill();
    // rim highlight
    ctx.strokeStyle = 'rgba(255,140,60,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r - 1, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
  };

  P.bogie = (ctx, cx, ang, speed) => {
    const y = P.WHEEL_Y, r = P.WHEEL_R;
    P.wheel(ctx, cx - 38, y, r, ang, speed);
    P.wheel(ctx, cx + 38, y, r, ang + 0.7, speed);
    // side frame + leaf spring
    ctx.fillStyle = '#16191c';
    U.roundRect(ctx, cx - 74, y - 12, 148, 22, 6); ctx.fill();
    ctx.strokeStyle = '#3a3f46'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#2b2f35';
    for (let i = 0; i < 3; i++) { U.roundRect(ctx, cx - 22, y - 26 + i * 5, 44, 4, 2); ctx.fill(); }
    ctx.fillStyle = '#0b0c0d';
    ctx.beginPath(); ctx.arc(cx - 38, y, 7, 0, 6.283); ctx.arc(cx + 38, y, 7, 0, 6.283); ctx.fill();
  };

  // Barrel drawn along +x from the pivot. `heat` 0..1 lights the energy coils.
  P.barrel = (ctx, len, thick, recoil, o) => {
    o = o || {};
    const x0 = -thick * 0.6 - recoil;
    const g = ctx.createLinearGradient(0, -thick / 2, 0, thick / 2);
    g.addColorStop(0, '#6d747d');
    g.addColorStop(0.35, '#2e3338');
    g.addColorStop(1, '#0f1113');
    ctx.fillStyle = g;
    // tapered tube
    ctx.beginPath();
    ctx.moveTo(x0, -thick / 2);
    ctx.lineTo(x0 + len, -thick * 0.36);
    ctx.lineTo(x0 + len, thick * 0.36);
    ctx.lineTo(x0, thick / 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
    // muzzle brake
    ctx.fillStyle = '#1b1e22';
    U.roundRect(ctx, x0 + len - thick * 0.2, -thick * 0.55, thick * 0.9, thick * 1.1, 3); ctx.fill();
    ctx.fillStyle = '#060707';
    ctx.fillRect(x0 + len + thick * 0.05, -thick * 0.55, thick * 0.12, thick * 1.1);
    ctx.fillRect(x0 + len + thick * 0.35, -thick * 0.55, thick * 0.12, thick * 1.1);
    // coils / bands
    const coils = o.coils || 0;
    for (let i = 0; i < coils; i++) {
      const cx = x0 + len * (0.25 + (i * 0.5) / Math.max(1, coils));
      ctx.fillStyle = '#121416';
      ctx.fillRect(cx, -thick * 0.56, thick * 0.35, thick * 1.12);
      if (o.heat > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,${120 + 80 * o.heat | 0},40,${o.heat})`;
        ctx.shadowColor = '#ff7a1a';
        ctx.shadowBlur = 20 * o.heat;
        ctx.fillRect(cx + 2, -thick * 0.5, thick * 0.35 - 4, thick);
        ctx.restore();
      }
    }
    // hot glowing barrel tip after firing
    if (o.hot > 0.01) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const hg = ctx.createLinearGradient(x0 + len * 0.6, 0, x0 + len + thick, 0);
      hg.addColorStop(0, 'rgba(255,80,20,0)');
      hg.addColorStop(1, `rgba(255,120,40,${0.8 * o.hot})`);
      ctx.fillStyle = hg;
      ctx.fillRect(x0 + len * 0.6, -thick * 0.45, len * 0.4 + thick, thick * 0.9);
      ctx.restore();
    }
    // top highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0 + 4, -thick / 2 + 2); ctx.lineTo(x0 + len - 4, -thick * 0.36 + 2); ctx.stroke();
  };

  P.turretDome = (ctx, x, y, r, tone) => {
    ctx.fillStyle = P.metal(ctx, y - r, y + r * 0.4, tone || 0);
    ctx.beginPath();
    ctx.moveTo(x - r, y + r * 0.35);
    ctx.bezierCurveTo(x - r, y - r * 0.9, x + r, y - r * 0.9, x + r, y + r * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.arc(x, y + r * 0.2, r * 0.82, Math.PI * 1.2, Math.PI * 1.55); ctx.stroke();
    P.rivets(ctx, x - r * 0.7, y + r * 0.2, r * 1.4, r * 0.35, 1.8);
  };

  P.crown = (ctx, cx, cy, s, color) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s / 40, s / 40);
    ctx.fillStyle = color || '#ffc840';
    ctx.beginPath();
    ctx.moveTo(-20, 10); ctx.lineTo(-22, -10); ctx.lineTo(-10, 0); ctx.lineTo(0, -16);
    ctx.lineTo(10, 0); ctx.lineTo(22, -10); ctx.lineTo(20, 10); ctx.closePath();
    ctx.fill();
    ctx.fillRect(-20, 11, 40, 6);
    ctx.fillStyle = '#ff3b1f';
    ctx.beginPath(); ctx.arc(0, 4, 3.2, 0, 6.283); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(-22, -11, 2.5, 0, 6.283); ctx.arc(0, -17, 2.5, 0, 6.283); ctx.arc(22, -11, 2.5, 0, 6.283); ctx.fill();
    ctx.restore();
  };

  P.chevrons = (ctx, cx, cy, s, n, color) => {
    ctx.save();
    ctx.strokeStyle = color || '#ffc840';
    ctx.lineWidth = s * 0.22;
    ctx.lineJoin = 'miter';
    for (let i = 0; i < n; i++) {
      const y = cy - s * 0.3 + i * s * 0.32 - (n - 1) * s * 0.16;
      ctx.beginPath(); ctx.moveTo(cx - s * 0.45, y + s * 0.3); ctx.lineTo(cx, y); ctx.lineTo(cx + s * 0.45, y + s * 0.3); ctx.stroke();
    }
    ctx.restore();
  };

  P.star = (ctx, cx, cy, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  };

  P.flag = (ctx, x, yTop, poleH, w, h, t, accent) => {
    ctx.fillStyle = '#2a2d31';
    ctx.fillRect(x - 2, yTop, 4, poleH);
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath(); ctx.arc(x, yTop, 4, 0, 6.283); ctx.fill();
    // waving cloth (flows backward = left, since the train moves right)
    const seg = 14;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i <= seg; i++) {
      const u = i / seg, px = x - u * w, py = yTop + 6 + Math.sin(t * 9 - u * 5) * 6 * u;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    for (let i = seg; i >= 0; i--) {
      const u = i / seg, px = x - u * w, py = yTop + 6 + h + Math.sin(t * 9 - u * 5 + 0.4) * 6 * u;
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#121314';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = accent || '#c0261a';
    ctx.fillRect(x - w, yTop + 6 + h - 8, w, 4);
    ctx.restore();
    P.skull(ctx, x - w * 0.5, yTop + 6 + h * 0.5 + Math.sin(t * 9 - 2.5) * 3, h * 0.55, '#d9d4ca', '#121314');
  };

  P.chain = (ctx, x1, y1, x2, y2, sag) => {
    const n = Math.max(4, Math.round(Math.hypot(x2 - x1, y2 - y1) / 9));
    ctx.strokeStyle = '#6f6a5e';
    ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, px = U.lerp(x1, x2, u), py = U.lerp(y1, y2, u) + Math.sin(u * Math.PI) * sag;
      ctx.beginPath();
      if (i % 2) ctx.ellipse(px, py, 5, 2.4, 0, 0, 6.283);
      else ctx.ellipse(px, py, 4.5, 1.2, 0, 0, 6.283);
      ctx.stroke();
    }
  };

  P.crate = (ctx, x, y, w, h, label, tone) => {
    ctx.fillStyle = tone === 'olive' ? '#4a4a32' : '#3b3426';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, w, 3);
    if (label) {
      ctx.fillStyle = '#1a1712';
      ctx.fillRect(x + w * 0.15, y + h * 0.32, w * 0.7, h * 0.36);
      P.stencil(ctx, label, x + w / 2, y + h / 2 + 1, Math.min(14, h * 0.28), '#e0b25a');
    }
  };

  P.shells = (ctx, x, y, n) => {
    for (let i = 0; i < n; i++) {
      const sx = x + i * 11;
      const g = ctx.createLinearGradient(sx, 0, sx + 9, 0);
      g.addColorStop(0, '#7a5a22'); g.addColorStop(0.4, '#d9a441'); g.addColorStop(1, '#5a3f14');
      ctx.fillStyle = g;
      ctx.fillRect(sx, y - 26, 9, 26);
      ctx.fillStyle = '#2a2d31';
      ctx.beginPath(); ctx.moveTo(sx, y - 26); ctx.lineTo(sx + 4.5, y - 38); ctx.lineTo(sx + 9, y - 26); ctx.fill();
    }
  };

  P.sandbags = (ctx, x, y, w) => {
    for (let row = 0; row < 2; row++) {
      for (let px = x + (row ? 16 : 0); px < x + w - 20; px += 34) {
        const g = ctx.createLinearGradient(0, y - row * 14 - 14, 0, y - row * 14);
        g.addColorStop(0, '#6d6447'); g.addColorStop(1, '#3a3526');
        ctx.fillStyle = g;
        U.roundRect(ctx, px, y - row * 14 - 15, 34, 15, 7);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
  };

  P.glowSprite = (ctx, spr, x, y, size, alpha) => {
    if (alpha <= 0.01) return;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(spr, x - size / 2, y - size / 2, size, size);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  // Weathering pass, painted on top of a finished wagon sprite (only where armor already exists):
  // fire-lit top, ambient occlusion, grime, rust streaks, scratches, grain and bullet holes.
  P.weather = (x, w, seed, o) => {
    o = o || {};
    const r = U.rng(seed), top = 480, bot = 905;
    x.save();
    x.globalCompositeOperation = 'source-atop';
    let g = x.createLinearGradient(0, 560, 0, 900);
    g.addColorStop(0, 'rgba(255,140,60,0.13)');
    g.addColorStop(0.45, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.38)');
    x.fillStyle = g; x.fillRect(-60, top, w + 120, bot - top);
    g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.16)');
    x.fillStyle = g; x.fillRect(-60, top, w + 120, bot - top);
    for (let i = 0; i < w / 14; i++) {
      const cx = r() * w, cy = 600 + r() * 280, rr = 20 + r() * 50;
      const rg = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
      rg.addColorStop(0, `rgba(${r() < 0.3 ? '60,35,18' : '6,5,4'},${0.12 + r() * 0.16})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = rg; x.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
    for (let i = 0; i < w / 20; i++) {
      const sx = r() * w, sy = 620 + r() * 230, len = 18 + r() * 70;
      const sg = x.createLinearGradient(0, sy, 0, sy + len);
      sg.addColorStop(0, `rgba(140,66,24,${0.35 + r() * 0.25})`); sg.addColorStop(1, 'rgba(140,66,24,0)');
      x.fillStyle = sg; x.fillRect(sx, sy, 1.2 + r() * 3, len);
    }
    x.strokeStyle = 'rgba(210,214,220,0.16)';
    x.lineWidth = 0.8;
    for (let i = 0; i < w / 7; i++) {
      const sx = r() * w, sy = 620 + r() * 240, a = (r() - 0.5) * 0.8, l = 4 + r() * 16;
      x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); x.stroke();
    }
    for (let i = 0; i < w * 6; i++) {
      x.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.09)';
      x.fillRect(r() * w, top + r() * (bot - top), 1.5, 1.5);
    }
    for (let i = 0; i < (o.holes || 0); i++) {
      const cx = 30 + r() * (w - 60), cy = 700 + r() * 150, hr = 2.5 + r() * 3;
      x.strokeStyle = 'rgba(0,0,0,0.6)'; x.lineWidth = 1;
      for (let k = 0; k < 5; k++) { const a = r() * 6.283; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(a) * hr * 3, cy + Math.sin(a) * hr * 3); x.stroke(); }
      x.fillStyle = 'rgba(150,150,150,0.18)'; x.beginPath(); x.arc(cx - 0.6, cy - 0.6, hr + 1.2, 0, 6.283); x.fill();
      x.fillStyle = '#050505'; x.beginPath(); x.arc(cx, cy, hr * 0.8, 0, 6.283); x.fill();
      if (r() < 0.15) { x.fillStyle = 'rgba(255,110,30,0.35)'; x.beginPath(); x.arc(cx, cy, hr * 0.45, 0, 6.283); x.fill(); }
    }
    x.restore();
  };

  WT.P = P;
})(window.WT);
