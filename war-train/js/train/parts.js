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

  P.wheel = (ctx, cx, cy, r, ang, speed, o) => {
    o = o || {};
    // flange (slightly larger, behind the tyre) + steel tyre + wheel centre
    ctx.fillStyle = '#0a0b0c';
    ctx.beginPath(); ctx.arc(cx, cy, r + 2.5, 0, 6.283); ctx.fill();
    const tg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
    tg.addColorStop(0, '#4c535b'); tg.addColorStop(1, '#1d2125');
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#7d858e'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, r - 1, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
    ctx.fillStyle = '#16191c';
    ctx.beginPath(); ctx.arc(cx, cy, r - 5, 0, 6.283); ctx.fill();
    const ghosts = speed > 260 ? 3 : 1;
    const spokes = o.spokes || (r > 34 ? 12 : 8);
    for (let gI = 0; gI < ghosts; gI++) {
      ctx.globalAlpha = ghosts > 1 ? 0.4 : 1;
      const a0 = ang - gI * 0.1;
      ctx.strokeStyle = '#4f565e';
      ctx.lineWidth = r > 34 ? 3.2 : 2.6;
      ctx.lineCap = 'round';
      for (let k = 0; k < spokes; k++) {
        const a = a0 + (k * 2 * Math.PI) / spokes;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * 0.28, cy + Math.sin(a) * r * 0.28);
        ctx.quadraticCurveTo(cx + Math.cos(a + 0.12) * r * 0.6, cy + Math.sin(a + 0.12) * r * 0.6, cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6));
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
      if (o.counterweight) {
        ctx.fillStyle = '#2a2f35';
        ctx.beginPath(); ctx.arc(cx, cy, r - 6, a0 + Math.PI - 0.7, a0 + Math.PI + 0.7); ctx.arc(cx, cy, r * 0.42, a0 + Math.PI + 0.7, a0 + Math.PI - 0.7, true); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // hub with bolt circle
    ctx.fillStyle = '#2c3137';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.3, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#8a9199';
    for (let k = 0; k < 6; k++) { const a = ang + k * 1.047; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2, 1.3, 0, 6.283); ctx.fill(); }
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, 6.283); ctx.fill();
  };

  P.coil = (ctx, x, y1, y2, w, turns) => {
    ctx.strokeStyle = '#59606a'; ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i <= turns * 2; i++) {
      const yy = U.lerp(y1, y2, i / (turns * 2));
      ctx.lineTo(x + (i % 2 ? w / 2 : -w / 2), yy);
    }
    ctx.stroke();
  };

  P.bogie = (ctx, cx, ang, speed) => {
    const y = P.WHEEL_Y, r = P.WHEEL_R;
    P.wheel(ctx, cx - 38, y, r, ang, speed);
    P.wheel(ctx, cx + 38, y, r, ang + 0.7, speed);
    // brake shoes on the inner side of each wheel
    ctx.fillStyle = '#121416';
    ctx.fillRect(cx - 8, y - 14, 6, 26); ctx.fillRect(cx + 2, y - 14, 6, 26);
    // cast side frame (arched)
    ctx.fillStyle = '#1a1d21';
    ctx.beginPath();
    ctx.moveTo(cx - 78, y - 6); ctx.lineTo(cx - 60, y - 20); ctx.lineTo(cx + 60, y - 20); ctx.lineTo(cx + 78, y - 6);
    ctx.lineTo(cx + 70, y + 6); ctx.lineTo(cx + 20, y + 4); ctx.quadraticCurveTo(cx, y + 16, cx - 20, y + 4); ctx.lineTo(cx - 70, y + 6); ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3d434a'; ctx.lineWidth = 1.2; ctx.stroke();
    // axle boxes
    for (const ax of [cx - 38, cx + 38]) {
      ctx.fillStyle = '#262a2f'; U.roundRect(ctx, ax - 11, y - 10, 22, 20, 3); ctx.fill();
      ctx.strokeStyle = '#4a5058'; ctx.stroke();
      ctx.fillStyle = '#8a9199';
      for (const [bx, by] of [[-7, -6], [7, -6], [-7, 6], [7, 6]]) { ctx.beginPath(); ctx.arc(ax + bx, y + by, 1.4, 0, 6.283); ctx.fill(); }
    }
    // bolster coil springs
    P.coil(ctx, cx - 16, y - 32, y - 18, 9, 4);
    P.coil(ctx, cx + 16, y - 32, y - 18, 9, 4);
    ctx.fillStyle = '#2b3036'; ctx.fillRect(cx - 28, y - 36, 56, 5);
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
    // fume extractor bulge + thermal sleeve bands
    if (!o.coils && len > 100) {
      const fx0 = x0 + len * 0.45, fw = thick * 1.6;
      const fg = ctx.createLinearGradient(0, -thick * 0.62, 0, thick * 0.62);
      fg.addColorStop(0, '#666d76'); fg.addColorStop(0.4, '#2c3136'); fg.addColorStop(1, '#0e1012');
      ctx.fillStyle = fg; U.roundRect(ctx, fx0, -thick * 0.6, fw, thick * 1.2, thick * 0.5); ctx.fill();
      ctx.fillStyle = '#121416';
      ctx.fillRect(x0 + len * 0.22, -thick * 0.48, 3, thick * 0.96); ctx.fillRect(x0 + len * 0.75, -thick * 0.42, 3, thick * 0.84);
    }
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
    if (r >= 30) {
      // commander hatch, periscope, vision block and smoke grenade launchers
      ctx.fillStyle = '#24282d';
      U.roundRect(ctx, x - r * 0.42, y - r * 0.62, r * 0.5, r * 0.16, 3); ctx.fill();
      ctx.fillStyle = '#121416'; ctx.fillRect(x + r * 0.15, y - r * 0.72, r * 0.14, r * 0.2);
      ctx.fillStyle = 'rgba(255,150,60,0.7)'; ctx.fillRect(x + r * 0.16, y - r * 0.7, r * 0.12, r * 0.05);
      ctx.fillStyle = '#0b0c0d'; ctx.fillRect(x - r * 0.75, y - r * 0.05, r * 0.4, r * 0.08);
      for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.translate(x - r * 0.88 + i * 5, y - r * 0.25); ctx.rotate(-0.5);
        ctx.fillStyle = '#2f343a'; ctx.fillRect(0, -3, 12, 6); ctx.fillStyle = '#0b0c0d'; ctx.fillRect(10, -3, 2, 6);
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - r * 0.95, y + r * 0.05); ctx.quadraticCurveTo(x, y - r * 0.25, x + r * 0.95, y + r * 0.05); ctx.stroke();
    }
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

  // ---- small detail kit ------------------------------------------------
  const tube = (ctx, w, col) => { ctx.strokeStyle = '#0b0c0d'; ctx.lineWidth = w + 1.5; ctx.stroke(); ctx.strokeStyle = col || '#5d646d'; ctx.lineWidth = w; ctx.stroke(); };

  P.handrail = (ctx, x1, x2, y, postH) => {
    ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y);
    const n = Math.max(2, Math.round((x2 - x1) / 60));
    for (let i = 0; i <= n; i++) { const px = U.lerp(x1, x2, i / n); ctx.moveTo(px, y); ctx.lineTo(px, y + postH); }
    tube(ctx, 2.2, '#7a8189');
  };

  P.ladder = (ctx, lx, y1, y2, w) => {
    w = w || 16;
    ctx.beginPath(); ctx.moveTo(lx, y1); ctx.lineTo(lx, y2); ctx.moveTo(lx + w, y1); ctx.lineTo(lx + w, y2);
    for (let y = y1 + 8; y < y2; y += 13) { ctx.moveTo(lx, y); ctx.lineTo(lx + w, y); }
    tube(ctx, 2, '#6c737b');
  };

  P.pipe = (ctx, pts, w, col) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.lineJoin = 'round';
    tube(ctx, w || 4, col || '#4b525a');
    ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] - (w || 4) * 0.3) : ctx.moveTo(p[0], p[1] - (w || 4) * 0.3))); ctx.stroke();
    // flanges at every joint
    ctx.fillStyle = '#2a2e33';
    for (const p of pts) { ctx.fillRect(p[0] - 3, p[1] - (w || 4) * 0.9, 6, (w || 4) * 1.8); }
  };

  P.door = (ctx, x0, y0, w, h, o) => {
    o = o || {};
    U.roundRect(ctx, x0, y0, w, h, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    U.roundRect(ctx, x0 + 2, y0 + 2, w - 4, h - 4, 2); ctx.stroke();
    ctx.fillStyle = '#16191c';
    ctx.fillRect(x0 - 3, y0 + h * 0.15, 5, 10); ctx.fillRect(x0 - 3, y0 + h * 0.75, 5, 10); // hinges
    ctx.fillStyle = '#80878f';
    ctx.fillRect(x0 + w - 10, y0 + h * 0.48, 6, 3); // handle
    if (o.window) {
      ctx.fillStyle = '#060606'; ctx.fillRect(x0 + 6, y0 + 8, w - 12, h * 0.22);
      ctx.fillStyle = 'rgba(255,140,50,0.55)'; ctx.fillRect(x0 + 8, y0 + 10 + h * 0.1, w - 16, 3);
    }
  };

  P.louvre = (ctx, x0, y0, w, h, n) => {
    ctx.fillStyle = '#0a0b0c'; ctx.fillRect(x0, y0, w, h);
    const step = h / n;
    for (let i = 0; i < n; i++) {
      const g = ctx.createLinearGradient(0, y0 + i * step, 0, y0 + (i + 1) * step);
      g.addColorStop(0, '#5a616a'); g.addColorStop(1, '#1b1e22');
      ctx.fillStyle = g; ctx.fillRect(x0 + 1, y0 + i * step + 1, w - 2, step * 0.6);
    }
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.strokeRect(x0, y0, w, h);
  };

  P.label = (ctx, x0, y0, w, h, text, col) => {
    ctx.fillStyle = col || '#d6a825'; ctx.fillRect(x0, y0, w, h);
    ctx.fillStyle = '#111'; ctx.font = `700 ${Math.round(h * 0.7)}px ${P.FONT_UI}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x0 + w / 2, y0 + h / 2 + 1);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.strokeRect(x0 + 1.5, y0 + 1.5, w - 3, h - 3);
  };

  P.toolbox = (ctx, x0, y0, w, h) => {
    ctx.fillStyle = P.metal(ctx, y0, y0 + h, 3); ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.strokeRect(x0, y0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(x0, y0 + h * 0.3, w, 1.5);
    ctx.fillStyle = '#8a9199'; ctx.fillRect(x0 + w * 0.2, y0 + h * 0.42, 5, 4); ctx.fillRect(x0 + w * 0.8 - 5, y0 + h * 0.42, 5, 4);
  };

  P.jerrycan = (ctx, x0, y0, col) => {
    const w = 20, h = 28;
    ctx.fillStyle = col || '#4d5233';
    U.roundRect(ctx, x0, y0, w, h, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.moveTo(x0 + 3, y0 + 8); ctx.lineTo(x0 + w - 3, y0 + h - 3); ctx.moveTo(x0 + w - 3, y0 + 8); ctx.lineTo(x0 + 3, y0 + h - 3); ctx.stroke();
    ctx.fillStyle = '#2a2d22'; ctx.fillRect(x0 + 3, y0 - 4, 8, 5); ctx.fillRect(x0 + 13, y0 - 2, 4, 3);
  };

  P.tank = (ctx, x0, y0, w, h) => {
    const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
    g.addColorStop(0, '#6a717a'); g.addColorStop(0.35, '#3a4046'); g.addColorStop(1, '#14171a');
    ctx.fillStyle = g; U.roundRect(ctx, x0, y0, w, h, h / 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#121416'; ctx.fillRect(x0 + w * 0.25, y0 - 1, 4, h + 2); ctx.fillRect(x0 + w * 0.72, y0 - 1, 4, h + 2);
  };

  P.trackLinks = (ctx, x0, y0, n, vertical) => {
    for (let i = 0; i < n; i++) {
      const px = vertical ? x0 : x0 + i * 15, py = vertical ? y0 + i * 15 : y0;
      ctx.fillStyle = '#26292d'; U.roundRect(ctx, px, py, 14, 14, 2); ctx.fill();
      ctx.fillStyle = '#4a5058'; ctx.fillRect(px + 3, py + 5, 8, 4);
      ctx.fillStyle = '#121314'; ctx.fillRect(px + (vertical ? 0 : 12), py + (vertical ? 12 : 0), vertical ? 14 : 3, vertical ? 3 : 14);
    }
  };

  P.boltGrid = (ctx, x0, y0, w, h, sp) => {
    for (let y = y0; y <= y0 + h; y += sp) for (let x = x0; x <= x0 + w; x += sp) {
      ctx.fillStyle = '#0c0d0f'; ctx.fillRect(x - 1.6, y - 1.6, 3.6, 3.6);
      ctx.fillStyle = '#7d848c'; ctx.fillRect(x - 1.4, y - 1.4, 2, 2);
    }
  };

  P.seams = (ctx, x0, y0, w, h, cols, rows) => {
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.2;
    for (let i = 1; i < cols; i++) { const xx = x0 + (w * i) / cols; ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y0 + h); ctx.stroke(); }
    for (let i = 1; i < (rows || 1); i++) { const yy = y0 + (h * i) / rows; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + w, yy); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let i = 1; i < cols; i++) { const xx = x0 + (w * i) / cols + 1.2; ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y0 + h); ctx.stroke(); }
  };

  P.lampCage = (ctx, cx, cy, r, col) => {
    ctx.fillStyle = '#0b0c0d'; ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, 6.283); ctx.fill();
    ctx.fillStyle = col || '#ffcf8a'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#2b2f34'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - r - 2, cy); ctx.lineTo(cx + r + 2, cy); ctx.moveTo(cx, cy - r - 2); ctx.lineTo(cx, cy + r + 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r + 3, 0, 6.283); ctx.stroke();
  };

  P.netting = (ctx, x0, y0, w, h, seed) => {
    const r = U.rng(seed || 3);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0, y0 + h);
    for (let i = 0; i <= 10; i++) ctx.lineTo(x0 + (w * i) / 10, y0 + (i % 2 ? 6 : 0) + r() * 8);
    ctx.lineTo(x0 + w, y0 + h); ctx.closePath();
    ctx.fillStyle = 'rgba(58,62,38,0.85)'; ctx.fill();
    ctx.clip();
    for (let i = 0; i < w / 6; i++) { ctx.fillStyle = ['rgba(90,86,52,0.8)', 'rgba(36,40,26,0.8)', 'rgba(110,92,58,0.7)'][i % 3]; ctx.beginPath(); ctx.arc(x0 + r() * w, y0 + r() * h, 4 + r() * 8, 0, 6.283); ctx.fill(); }
    ctx.strokeStyle = 'rgba(15,16,10,0.6)'; ctx.lineWidth = 0.8;
    for (let i = -h; i < w; i += 7) { ctx.beginPath(); ctx.moveTo(x0 + i, y0 + h); ctx.lineTo(x0 + i + h, y0); ctx.moveTo(x0 + i + h, y0 + h); ctx.lineTo(x0 + i, y0); ctx.stroke(); }
    ctx.restore();
  };

  P.buffer = (ctx, x, y, dir) => {
    ctx.fillStyle = '#1c1f23'; ctx.fillRect(dir > 0 ? x : x - 14, y - 4, 14, 8);
    ctx.fillStyle = '#3a4047'; ctx.fillRect(dir > 0 ? x + 12 : x - 18, y - 10, 6, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(dir > 0 ? x + 12 : x - 18, y - 10, 6, 2);
  };

  // Antenna whip that bends backward with speed (live).
  P.antenna = (ctx, x, y, len, t, speed) => {
    const bend = U.clamp(speed / 900, 0, 1) * 0.6 + Math.sin(t * 9) * 0.05;
    ctx.strokeStyle = '#59616a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - len * bend * 0.3, y - len * 0.6, x - len * bend, y - len * Math.cos(bend));
    ctx.stroke();
    ctx.fillStyle = '#121416'; ctx.fillRect(x - 4, y - 2, 8, 5);
    if (Math.sin(t * 5) > 0.6) P.glowSprite(ctx, WT.sprites.red, x - len * bend, y - len * Math.cos(bend), 18, 1);
  };

  // Generic underframe: truss, brake gear, air reservoir, steps, buffers.
  P.underframe = (ctx, w, bogies) => {
    ctx.strokeStyle = '#1e2226'; ctx.lineWidth = 3;
    for (let i = 0; i < bogies.length - 1; i++) {
      const a = bogies[i] + 80, b = bogies[i + 1] - 80;
      if (b - a < 40) continue;
      ctx.beginPath();
      ctx.moveTo(a, 894); ctx.lineTo(a + 20, 912); ctx.lineTo(b - 20, 912); ctx.lineTo(b, 894);
      for (let x = a + 20; x < b - 20; x += 40) { ctx.moveTo(x, 912); ctx.lineTo(x + 20, 894); ctx.lineTo(x + 40, 912); }
      ctx.stroke();
      if (b - a > 140) {
        P.tank(ctx, (a + b) / 2 - 50, 897, 70, 13);
        ctx.fillStyle = '#16191c'; ctx.fillRect((a + b) / 2 + 30, 896, 18, 12);
      }
    }
    // end steps + buffers + coupler hooks
    for (const [sx, dir] of [[8, -1], [w - 8, 1]]) {
      ctx.strokeStyle = '#4a5058'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx + dir * -4, 894); ctx.lineTo(sx + dir * -4, 912); ctx.lineTo(sx + dir * -20, 912); ctx.stroke();
      P.buffer(ctx, dir > 0 ? w - 4 : 4, 878, dir);
    }
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
